import * as React from 'react';
import type { Cast, Customer } from '../../scenarios/data/cast';

export const MADE_CUSTOMERS_STORAGE_KEY = 'rocoto-app-customers-made';
/** New scoped records live here only when the original key still holds unknown legacy bytes. */
export const SCOPED_MADE_CUSTOMERS_STORAGE_KEY = 'rocoto-app-customers-made-v2';
export const MADE_PREFIX = 'made-';
const STORE_VERSION = 2;

export const isMadeCustomer = (id: string): boolean => id.startsWith(MADE_PREFIX);

type StoredCustomer = Customer & { sector: string; requestId: string };
type Store = { version: typeof STORE_VERSION; customers: StoredCustomer[] };
export type CustomerDetails = Partial<Pick<Customer, 'phone' | 'email' | 'address' | 'at' | 'zone' | 'truck' | 'comercial' | 'channel'>>;
export type CustomerCreateResult =
  | { kind: 'created'; customer: Customer; replayed: boolean }
  | { kind: 'duplicate'; customer: Customer }
  | { kind: 'invalid' }
  | { kind: 'persistence-failed' };

const isStoredCustomer = (value: unknown): value is StoredCustomer => {
  if (!value || typeof value !== 'object') return false;
  const customer = value as StoredCustomer;
  return typeof customer.id === 'string' && typeof customer.name === 'string' && !!customer.name.trim()
    && typeof customer.sector === 'string' && typeof customer.requestId === 'string';
};

let legacyUnscoped = false;
let activeStorageKey = MADE_CUSTOMERS_STORAGE_KEY;
let storageUnavailable = false;
const emptyStore = (): Store => ({ version: STORE_VERSION, customers: [] });

const parseStore = (raw: string | null): Store | null => {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const record = value as { version?: unknown; customers?: unknown };
    if (record.version !== STORE_VERSION || !Array.isArray(record.customers)) return null;
    return { version: STORE_VERSION, customers: record.customers.filter(isStoredCustomer) };
  } catch { return null; }
};

function load(): Store {
  if (typeof window === 'undefined') return emptyStore();
  try {
    const original = window.localStorage.getItem(MADE_CUSTOMERS_STORAGE_KEY);
    if (original === null) return emptyStore();
    const current = parseStore(original);
    if (current) return current;

    /* The old array has no tenant. Leave it byte-for-byte intact and start a separate scoped book. */
    legacyUnscoped = true;
    activeStorageKey = SCOPED_MADE_CUSTOMERS_STORAGE_KEY;
    const scoped = window.localStorage.getItem(activeStorageKey);
    if (scoped === null) return emptyStore();
    const recovered = parseStore(scoped);
    if (recovered) return recovered;
    storageUnavailable = true;
    return emptyStore();
  } catch {
    storageUnavailable = true;
    return emptyStore();
  }
}

/** True means a separate migration/review may be offered; it never prevents a new scoped write. */
export const hasLegacyUnscopedCustomers = () => legacyUnscoped;
let store = load();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); };
const snapshot = () => store.customers;

function persist(next: StoredCustomer[]): boolean {
  if (storageUnavailable || typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(activeStorageKey, JSON.stringify({ version: STORE_VERSION, customers: next } satisfies Store));
  } catch {
    return false;
  }
  store = { version: STORE_VERSION, customers: next };
  listeners.forEach((listener) => listener());
  return true;
}

export const madeCustomersNow = (sector?: string): Customer[] =>
  sector ? store.customers.filter((customer) => customer.sector === sector) : store.customers;

export const useMadeCustomers = (sector?: string): Customer[] => {
  const all = React.useSyncExternalStore(subscribe, snapshot, snapshot);
  return React.useMemo(() => sector ? all.filter((customer) => customer.sector === sector) : all, [all, sector]);
};

export const newCustomerRequestId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

const enteredName = (value: string) => value.trim();
const duplicateKey = (value: string) => enteredName(value).toLocaleLowerCase('es-ES');
const supplied = <T extends object>(value: T): T => Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== '')) as T;

/** Creates only after persistence succeeds. Name matches are a choice for the caller, never an upsert. */
export function createCustomer({
  cast,
  name: rawName,
  details = {},
  requestId,
  allowDuplicate = false,
}: {
  cast: Cast;
  name: string;
  details?: CustomerDetails;
  requestId: string;
  allowDuplicate?: boolean;
}): CustomerCreateResult {
  const name = enteredName(rawName);
  if (!name || !requestId) return { kind: 'invalid' };
  const replay = store.customers.find((customer) => customer.sector === cast.sector && customer.requestId === requestId);
  if (replay) return { kind: 'created', customer: replay, replayed: true };
  const same = [...cast.customers, ...store.customers.filter((customer) => customer.sector === cast.sector)]
    .find((customer) => duplicateKey(customer.name) === duplicateKey(name));
  if (same && !allowDuplicate) return { kind: 'duplicate', customer: same };
  const born: StoredCustomer = {
    id: `${MADE_PREFIX}${newCustomerRequestId()}`,
    sector: cast.sector,
    requestId,
    name,
    channel: details.channel ?? cast.customers[0]?.channel ?? 'WhatsApp',
    tier: cast.customers[0]?.tier ?? 'tier 1',
    settles: 'cash on delivery',
    ...supplied(details),
  };
  if (!persist([...store.customers, born])) return { kind: 'persistence-failed' };
  return { kind: 'created', customer: born, replayed: false };
}

/** Legacy helper: retained for callers that only need a successful created customer. */
export function makeCustomer(cast: Cast, said: string, details?: CustomerDetails): Customer | null {
  const result = createCustomer({ cast, name: said, details, requestId: newCustomerRequestId() });
  return result.kind === 'created' ? result.customer : null;
}

/** Clears only the active versioned book. Legacy bytes are never read, removed or overwritten. */
export function clearMadeCustomers(): boolean {
  return persist([]);
}
