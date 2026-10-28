import * as React from 'react';
import {
  createOpaqueSourceRef,
  discardSessionSource,
  isOpaqueSourceRef,
  keepSessionSource,
  sessionSource,
  sessionSourceDetails,
} from './source-retention';

export type AlbaranIntakeKind = 'photo' | 'file' | 'paste';
export type AlbaranIntakeSource = {
  version: 1;
  scope: string;
  sale: string;
  kind: AlbaranIntakeKind;
  sourceRef: string;
  mime: string;
  size: number;
  capturedAt: string;
};

type IntakeBook = Record<string, AlbaranIntakeSource>;
type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;

const STORAGE_KEY = 'rocoto-albaran-intake-v1';
const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const keyOf = (scope: string, sale: string): string => scope + ':' + sale;
const browserStorage = (): StoragePort | null => typeof window === 'undefined' ? null : window.localStorage;

function valid(value: unknown): value is AlbaranIntakeSource {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return row.version === 1 && typeof row.scope === 'string' && typeof row.sale === 'string'
    && ['photo', 'file', 'paste'].includes(String(row.kind))
    && isOpaqueSourceRef(row.sourceRef) && typeof row.mime === 'string'
    && Number.isFinite(row.size) && Number(row.size) >= 0
    && typeof row.capturedAt === 'string' && Number.isFinite(Date.parse(row.capturedAt));
}

function read(): IntakeBook {
  try {
    const parsed = JSON.parse(browserStorage()?.getItem(STORAGE_KEY) || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter((entry) => valid(entry[1]))) as IntakeBook;
  } catch {
    return {};
  }
}

let snapshot: IntakeBook = read();
const listeners = new Set<() => void>();
const publish = (next: IntakeBook) => {
  snapshot = next;
  listeners.forEach((listener) => listener());
};

function persist(next: IntakeBook): boolean {
  try {
    const target = browserStorage();
    if (!target) throw new Error('Source history is unavailable');
    target.setItem(STORAGE_KEY, JSON.stringify(next));
    publish(next);
    return true;
  } catch {
    return false;
  }
}

export function retainAlbaranIntake(
  scope: string,
  sale: string,
  kind: AlbaranIntakeKind,
  source: Blob,
  label?: string,
): { ok: true } | { ok: false; message: string } {
  if (!scope || !sale) return { ok: false, message: 'Choose the customer first.' };
  if (source.size <= 0) return { ok: false, message: 'That source is empty.' };
  if (source.size > MAX_SOURCE_BYTES) return { ok: false, message: 'Choose a source smaller than 12 MB.' };
  const existing = snapshot[keyOf(scope, sale)];
  const sourceRef = createOpaqueSourceRef();
  keepSessionSource(sourceRef, source, label ? { label } : {});
  const record: AlbaranIntakeSource = {
    version: 1,
    scope,
    sale,
    kind,
    sourceRef,
    mime: source.type || 'application/octet-stream',
    size: source.size,
    capturedAt: new Date().toISOString(),
  };
  const next = { ...snapshot, [keyOf(scope, sale)]: record };
  if (!persist(next)) {
    discardSessionSource(sourceRef);
    return { ok: false, message: 'Attaching the source stalled. Try again.' };
  }
  discardSessionSource(existing?.sourceRef);
  return { ok: true };
}

export function removeAlbaranIntake(scope: string, sale: string): boolean {
  const key = keyOf(scope, sale);
  const existing = snapshot[key];
  if (!existing) return true;
  const next = { ...snapshot };
  delete next[key];
  if (!persist(next)) return false;
  discardSessionSource(existing.sourceRef);
  return true;
}

export const albaranIntakeSource = (sourceRef: string | undefined): Blob | undefined =>
  sessionSource(sourceRef);
export const albaranIntakeSourceDetails = (sourceRef: string | undefined) =>
  sessionSourceDetails(sourceRef);

export function useAlbaranIntake(scope: string, sale: string | null | undefined): AlbaranIntakeSource | undefined {
  return React.useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    () => sale ? snapshot[keyOf(scope, sale)] : undefined,
    () => undefined,
  );
}

if (typeof window !== 'undefined') window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEY || event.key === null) publish(read());
});
