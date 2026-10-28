import * as React from 'react';
import type { SectorId } from '../../scenarios/meta';

export type PhoneNumberPath = 'existing' | 'france';
export type PhoneRoutingMode = 'owner' | 'group';
export type PhoneSchedule = 'office-hours' | 'always';
export type PhoneRecordingPosture = 'metadata-only';

/**
 * The Kit may remember decisions, but it may never manufacture provider evidence. The fields
 * whose truth belongs to Twilio, a carrier or a real test route are deliberately narrow literal
 * states and are normalised back to pending/not-run on every browser write.
 */
export type PhoneConnectionConfig = {
  version: 1;
  tenant: SectorId;
  sourceNumber: string;
  numberPath: PhoneNumberPath;
  ownerId: string;
  routingMode: PhoneRoutingMode;
  ringGroupIds: string[];
  schedule: PhoneSchedule;
  fallbackNumber: string;
  fallbackVerification: 'pending';
  recordingPosture: PhoneRecordingPosture;
  forwardingAcknowledged: boolean;
  eligibilityState: 'pending';
  regulatoryState: 'pending';
  documentsState: 'not-started';
  inventoryState: 'not-reserved';
  inboundActivation: 'not-run';
  outboundActivation: 'not-run';
  providerState: 'pending';
  prepared: boolean;
  updatedAt?: string;
};

const cache = new Map<SectorId, PhoneConnectionConfig>();
const listeners = new Map<SectorId, Set<() => void>>();

export const phoneConnectionStorageKey = (tenant: SectorId): string =>
  `rocoto-phone-connection-v1:${tenant}`;

export const emptyPhoneConnectionConfig = (tenant: SectorId): PhoneConnectionConfig => ({
  version: 1,
  tenant,
  sourceNumber: '',
  numberPath: 'existing',
  ownerId: '',
  routingMode: 'owner',
  ringGroupIds: [],
  schedule: 'office-hours',
  fallbackNumber: '',
  fallbackVerification: 'pending',
  recordingPosture: 'metadata-only',
  forwardingAcknowledged: false,
  eligibilityState: 'pending',
  regulatoryState: 'pending',
  documentsState: 'not-started',
  inventoryState: 'not-reserved',
  inboundActivation: 'not-run',
  outboundActivation: 'not-run',
  providerState: 'pending',
  prepared: false,
});

const string = (value: unknown): string => typeof value === 'string' ? value : '';
const ids = (value: unknown): string[] => Array.isArray(value)
  ? Array.from(new Set(value.filter((item): item is string => typeof item === 'string' && item.length > 0)))
  : [];

function normalise(tenant: SectorId, value: unknown): PhoneConnectionConfig {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    version: 1,
    tenant,
    sourceNumber: string(raw.sourceNumber),
    numberPath: raw.numberPath === 'france' ? 'france' : 'existing',
    ownerId: string(raw.ownerId),
    routingMode: raw.routingMode === 'group' ? 'group' : 'owner',
    ringGroupIds: ids(raw.ringGroupIds),
    schedule: raw.schedule === 'always' ? 'always' : 'office-hours',
    fallbackNumber: string(raw.fallbackNumber),
    // Provider-owned facts stay pending no matter what a caller put in localStorage.
    fallbackVerification: 'pending',
    recordingPosture: 'metadata-only',
    forwardingAcknowledged: raw.forwardingAcknowledged === true,
    eligibilityState: 'pending',
    regulatoryState: 'pending',
    documentsState: 'not-started',
    inventoryState: 'not-reserved',
    inboundActivation: 'not-run',
    outboundActivation: 'not-run',
    providerState: 'pending',
    prepared: raw.prepared === true,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined,
  };
}

function read(tenant: SectorId): PhoneConnectionConfig {
  const held = cache.get(tenant);
  if (held) return held;
  let next = emptyPhoneConnectionConfig(tenant);
  if (typeof window !== 'undefined') {
    try {
      const stored = window.localStorage.getItem(phoneConnectionStorageKey(tenant));
      if (stored) next = normalise(tenant, JSON.parse(stored));
    } catch {
      // A malformed browser draft is local corruption, never a reason to break Connections.
    }
  }
  cache.set(tenant, next);
  return next;
}

function emit(tenant: SectorId): void {
  listeners.get(tenant)?.forEach((listener) => listener());
}

export function savePhoneConnectionConfig(
  tenant: SectorId,
  value: Partial<PhoneConnectionConfig>,
): PhoneConnectionConfig | null {
  const next = normalise(tenant, {
    ...read(tenant),
    ...value,
    tenant,
    updatedAt: new Date().toISOString(),
  });
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(phoneConnectionStorageKey(tenant), JSON.stringify(next));
    }
  } catch {
    return null;
  }
  cache.set(tenant, next);
  emit(tenant);
  return next;
}

/** Clear one tenant's prepared phone decisions. Provider facts were never stored here. */
export function resetPhoneConnectionConfig(tenant: SectorId): boolean {
  try {
    if (typeof window !== 'undefined') window.localStorage.removeItem(phoneConnectionStorageKey(tenant));
  } catch {
    return false;
  }
  cache.set(tenant, emptyPhoneConnectionConfig(tenant));
  emit(tenant);
  return true;
}

export function phoneConnectionConfigNow(tenant: SectorId): PhoneConnectionConfig {
  return read(tenant);
}

export function usePhoneConnectionConfig(tenant: SectorId): PhoneConnectionConfig {
  const subscribe = React.useCallback((listener: () => void) => {
    const tenantListeners = listeners.get(tenant) ?? new Set<() => void>();
    tenantListeners.add(listener);
    listeners.set(tenant, tenantListeners);
    return () => tenantListeners.delete(listener);
  }, [tenant]);
  const snapshot = React.useCallback(() => read(tenant), [tenant]);
  return React.useSyncExternalStore(subscribe, snapshot, snapshot);
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    const tenant = (['fish', 'meat', 'fruit'] as SectorId[])
      .find((candidate) => event.key === phoneConnectionStorageKey(candidate));
    if (!tenant) return;
    cache.delete(tenant);
    emit(tenant);
  });
}
