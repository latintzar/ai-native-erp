/* WORKSPACE CAPABILITIES — whether this house uses Pricing and Inventory at all.
 *
 * This is deliberately separate from `grants.ts`. A grant answers what Rocoto may do without a
 * person; a workspace capability answers which operational book the company keeps here. Turning
 * one off removes its controls and projections but never erases its ledger. The persistence key is
 * scoped to the selected house: one tenant's answer must never become another tenant's posture.
 */
import * as React from 'react';

export type WorkspaceCountry = 'peru' | 'spain';
export type WorkspaceCapability = 'pricing' | 'inventory' | 'money';

export type WorkspaceCapabilities = {
  version: 1;
  pricing: boolean;
  inventory: boolean;
  money: boolean;
  country: WorkspaceCountry;
  moneyByCountry: Record<WorkspaceCountry, boolean>;
};

export const WORKSPACE_CAPABILITIES_KEY = 'rocoto-workspace-capabilities';
export const workspaceCapabilitiesKey = (scope: string): string =>
  `${WORKSPACE_CAPABILITIES_KEY}:${scope || 'default'}`;

export const WORKSPACE_CAPABILITIES_DEFAULTS: WorkspaceCapabilities = {
  version: 1,
  pricing: true,
  inventory: false,
  money: true,
  country: 'peru',
  moneyByCountry: { peru: true, spain: false },
};

export const KIT_WORKSPACE_CAPABILITIES_DEFAULTS: WorkspaceCapabilities = {
  version: 1,
  pricing: true,
  inventory: false,
  money: true,
  country: 'peru',
  moneyByCountry: { peru: true, spain: false },
};

const runtimeDefaults = (): WorkspaceCapabilities => {
  if (typeof window === 'undefined') return WORKSPACE_CAPABILITIES_DEFAULTS;
  const host = window.location.hostname;
  return host === 'kit.soyrocoto.com' || host === 'localhost' || host === '127.0.0.1'
    ? KIT_WORKSPACE_CAPABILITIES_DEFAULTS
    : WORKSPACE_CAPABILITIES_DEFAULTS;
};

export function parseWorkspaceCapabilities(
  raw: unknown,
  defaults: WorkspaceCapabilities = runtimeDefaults(),
): WorkspaceCapabilities {
  if (!raw || typeof raw !== 'object') return defaults;
  const value = raw as Record<string, unknown>;
  const country = value.country === 'spain' || value.country === 'peru' ? value.country : defaults.country;
  const savedMoney = value.moneyByCountry && typeof value.moneyByCountry === 'object'
    ? value.moneyByCountry as Record<string, unknown> : {};
  const moneyByCountry = {
    peru: typeof savedMoney.peru === 'boolean' ? savedMoney.peru : (country === 'peru' && typeof value.money === 'boolean' ? value.money : defaults.moneyByCountry.peru),
    spain: typeof savedMoney.spain === 'boolean' ? savedMoney.spain : (country === 'spain' && typeof value.money === 'boolean' ? value.money : defaults.moneyByCountry.spain),
  };
  return {
    version: 1,
    pricing: typeof value.pricing === 'boolean' ? value.pricing : defaults.pricing,
    inventory: typeof value.inventory === 'boolean' ? value.inventory : defaults.inventory,
    money: moneyByCountry[country],
    country,
    moneyByCountry,
  };
}

/** The browser Kit has three demo houses; production replaces this with its trusted tenant scope. */
function activeScope(): string {
  if (typeof window === 'undefined') return 'default';
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem('rocoto-app-config') ?? 'null');
    if (raw && typeof raw === 'object') {
      const cast = (raw as Record<string, unknown>).cast;
      if (typeof cast === 'string' && cast.trim()) return cast.trim();
    }
  } catch {
    /* An unreadable app config falls back without reading another tenant's capability key. */
  }
  return 'fish';
}

function read(scope: string): WorkspaceCapabilities {
  if (typeof window === 'undefined') return WORKSPACE_CAPABILITIES_DEFAULTS;
  const defaults = runtimeDefaults();
  try {
    const raw = window.localStorage.getItem(workspaceCapabilitiesKey(scope));
    return raw ? parseWorkspaceCapabilities(JSON.parse(raw), defaults) : defaults;
  } catch {
    return defaults;
  }
}

const heldByScope = new Map<string, WorkspaceCapabilities>();
const current = (scope: string): WorkspaceCapabilities => {
  const held = heldByScope.get(scope);
  if (held) return held;
  const value = read(scope);
  heldByScope.set(scope, value);
  return value;
};
let saveError = '';
const listeners = new Set<() => void>();
const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const publish = (scope: string, next: WorkspaceCapabilities): boolean => {
  try {
    window.localStorage.setItem(workspaceCapabilitiesKey(scope), JSON.stringify(next));
  } catch {
    saveError = 'Saving this setting stalled. The workspace stands as it was.';
    listeners.forEach((listener) => listener());
    return false;
  }
  heldByScope.set(scope, next);
  saveError = '';
  listeners.forEach((listener) => listener());
  return true;
};

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    const prefix = `${WORKSPACE_CAPABILITIES_KEY}:`;
    if (!event.key?.startsWith(prefix) || !event.newValue) return;
    const scope = event.key.slice(prefix.length);
    if (!scope) return;
    try {
      heldByScope.set(scope, parseWorkspaceCapabilities(JSON.parse(event.newValue)));
      listeners.forEach((listener) => listener());
    } catch {
      /* Another tab's incomplete write never changes this tab's working state. */
    }
  });
}

export const workspaceCapabilitiesNow = (scope: string = activeScope()): WorkspaceCapabilities =>
  current(scope);

export const workspaceCapabilityEnabled = (
  capability: WorkspaceCapability,
  scope: string = activeScope(),
): boolean => current(scope)[capability];

export const useWorkspaceCapabilities = (scope: string = activeScope()): WorkspaceCapabilities =>
  React.useSyncExternalStore(subscribe, () => current(scope), () => WORKSPACE_CAPABILITIES_DEFAULTS);

export const useWorkspaceCapabilityError = (): string =>
  React.useSyncExternalStore(subscribe, () => saveError, () => '');

export function setWorkspaceCapability(
  capability: WorkspaceCapability,
  enabled: boolean,
  scope: string = activeScope(),
): boolean {
  const previous = current(scope);
  return publish(scope, capability === 'money'
    ? { ...previous, money: enabled, moneyByCountry: { ...previous.moneyByCountry, [previous.country]: enabled } }
    : { ...previous, [capability]: enabled });
}

/** Country is presentation and financial-demo scope. The communications workspace remains the
 * selected house. Spain starts with Money quiet; the person can enable it again explicitly. */
export function setWorkspaceCountry(country: WorkspaceCountry, scope: string = activeScope()): boolean {
  const previous = current(scope);
  return publish(scope, { ...previous, country, money: previous.moneyByCountry[country] });
}

export const workspaceFinancialScope = (
  scope: string = activeScope(),
  country: WorkspaceCountry = current(scope).country,
): string => `${scope}:country:${country}`;

export const peruFinancialActionsEnabled = (scope: string = activeScope()): boolean =>
  current(scope).country === 'peru';

export function resetWorkspaceCapabilities(scope: string = activeScope()): boolean {
  return publish(scope, runtimeDefaults());
}
