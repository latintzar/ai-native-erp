/**
 * A deliberately small, session-only source-file cache.
 *
 * It keeps a file and its display-only source label in memory while the current browser session
 * needs to display or re-download it. Nothing here writes to localStorage, IndexedDB, Cache
 * Storage, a service worker, a retry queue, or a log. A reload loses both bytes and label by
 * design. Durable records may keep only an opaque source reference and reviewed facts; they never
 * use this cache key as proof that a source can be reopened.
 */
export type SessionSourceDetails = Readonly<{
  source: Blob;
  /** User-provided name or preview label. Memory only; never copy this into a durable projection. */
  label?: string;
}>;

const sources = new Map<string, SessionSourceDetails>();

/**
 * Creates a tenant-local browser handle with no filename, provider id, path, or source wording.
 * It is safe to persist as a source reference, although it cannot make a session-only file
 * available after reload.
 */
const hex = (bytes: Uint8Array): string => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

export const createOpaqueSourceRef = (): string => {
  const sourceCrypto = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (typeof sourceCrypto?.randomUUID === 'function') return `src_${sourceCrypto.randomUUID().replace(/-/g, '')}`;
  const bytes = new Uint8Array(16);
  if (typeof sourceCrypto?.getRandomValues === 'function') {
    sourceCrypto.getRandomValues(bytes);
    return `src_${hex(bytes)}`;
  }
  /* Old browser fallback: a local display/cache handle, never an authorization token. */
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  return `src_${hex(bytes)}`;
};

/* Only issued UUID-shaped handles and our fixed legacy aliases can cross a durable boundary. */
export const isOpaqueSourceRef = (value: unknown): value is string =>
  typeof value === 'string' && /^src_(?:[a-f0-9]{32}|legacy_[a-z0-9]{12})$/.test(value);

/**
 * Legacy records sometimes used a raw filename-derived local key. This creates a stable opaque
 * in-memory alias without re-exposing or rewriting the old value. It is a migration bridge, not a
 * cryptographic identifier and must never be sent to a backend/provider.
 */
export const legacyOpaqueSourceRef = (legacy: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < legacy.length; index += 1) {
    hash ^= legacy.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `src_legacy_${(hash >>> 0).toString(36).padStart(12, '0')}`;
};

export const keepSessionSource = (sourceRef: string, source: Blob, details: Omit<SessionSourceDetails, 'source'> = {}): void => {
  sources.set(sourceRef, { source, ...details });
};

export const sessionSource = (sourceRef: string | undefined): Blob | undefined =>
  sourceRef ? sources.get(sourceRef)?.source : undefined;

export const sessionSourceDetails = (sourceRef: string | undefined): SessionSourceDetails | undefined =>
  sourceRef ? sources.get(sourceRef) : undefined;

export const discardSessionSource = (sourceRef: string | undefined): void => {
  if (sourceRef) sources.delete(sourceRef);
};

/** Explicitly useful on tenant switch or a user-initiated “clear temporary sources” action. */
export const clearSessionSources = (): void => {
  sources.clear();
};
