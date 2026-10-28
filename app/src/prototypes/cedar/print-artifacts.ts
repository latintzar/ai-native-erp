/**
 * Durable copies of HTML that Rocoto itself rendered for browser printing.  This is deliberately
 * not an inbox/cache: callers provide no source email, attachment, or supplier payload here.
 * Production replaces this browser kit adapter with the authenticated server artifact service.
 */
export type PrintPaper = 'A4' | 'A5';
export type PrintArtifact = Readonly<{
  key: string;
  sector: string;
  title: string;
  paper: PrintPaper;
  html: string;
  createdAt: string;
  createdBy: string;
  jobIds: string[];
  sha256: string;
}>;

type Input = Omit<PrintArtifact, 'sha256'>;
type Stored = PrintArtifact & { storageKey: string; sectorJobs: string[] };

const DATABASE = 'rocoto-print-artifacts';
const VERSION = 1;
const STORE = 'copies';
const TIMEOUT_MS = 2500;
const MAX_HTML = 32 * 1024 * 1024; // Three-copy all-day runs are normal; larger runs split safely.
const safe = (message: string) => message;
const storageKey = (sector: string, key: string) => `${sector}\u0000${key}`;
const sectorJob = (sector: string, jobId: string) => `${sector}\u0000${jobId}`;

/** A copy is accepted only when the renderer has supplied a complete reproducible print document. */
const generatedHtml = (html: string): boolean => /<!doctype html/i.test(html)
  && /<base\s/i.test(html) && /<style[\s>]/i.test(html)
  && /rocoto-print-document/i.test(html);

const encodedBytes = (html: string): number | null => {
  try {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(html).byteLength;
    if (typeof Blob !== 'undefined') return new Blob([html]).size;
  } catch { /* size must be known before a durable copy is accepted */ }
  return null;
};

/** Each async boundary owns its timeout: late database handles are closed and late transactions abort. */
const open = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  if (typeof window === 'undefined' || !window.indexedDB) { reject(new Error('Print copies are unavailable in this browser.')); return; }
  let settled = false;
  let timer: number | undefined;
  const fail = (message: string) => {
    if (settled) return;
    settled = true;
    if (timer !== undefined) window.clearTimeout(timer);
    reject(new Error(message));
  };
  const succeed = (db: IDBDatabase) => {
    if (settled) { db.close(); return; }
    settled = true;
    if (timer !== undefined) window.clearTimeout(timer);
    resolve(db);
  };
  timer = window.setTimeout(() => fail('Print copy storage timed out. Try again.'), TIMEOUT_MS);
  let request: IDBOpenDBRequest;
  try { request = window.indexedDB.open(DATABASE, VERSION); }
  catch { fail('Opening print copies stalled.'); return; }
  request.onupgradeneeded = () => {
    try {
      const db = request.result;
      const store = db.objectStoreNames.contains(STORE) ? request.transaction!.objectStore(STORE) : db.createObjectStore(STORE, { keyPath: 'storageKey' });
      if (!store.indexNames.contains('sector')) store.createIndex('sector', 'sector', { unique: false });
      if (!store.indexNames.contains('sectorJob')) store.createIndex('sectorJob', 'sectorJobs', { unique: false, multiEntry: true });
    } catch {
      try { request.transaction?.abort(); } catch { /* nothing to clean up */ }
      fail('Opening print copies stalled.');
    }
  };
  request.onsuccess = () => succeed(request.result);
  request.onerror = () => fail('Opening print copies stalled.');
  request.onblocked = () => fail('Print copy storage is busy. Close another Rocoto tab and try again.');
});

const digest = async (html: string): Promise<string> => {
  if (typeof crypto === 'undefined' || !crypto.subtle || typeof TextEncoder === 'undefined') return '';
  try {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(html));
    return `sha256:${Array.from(new Uint8Array(bytes)).map((value) => value.toString(16).padStart(2, '0')).join('')}`;
  } catch { return ''; }
};

const complete = (transaction: IDBTransaction): Promise<void> => new Promise((resolve, reject) => {
  let settled = false;
  const finish = (error?: Error) => {
    if (settled) return;
    settled = true;
    window.clearTimeout(timer);
    error ? reject(error) : resolve();
  };
  const timer = window.setTimeout(() => {
    try { transaction.abort(); } catch { /* it may already have completed */ }
    finish(new Error('Print copy storage timed out. Try again.'));
  }, TIMEOUT_MS);
  transaction.oncomplete = () => finish();
  transaction.onabort = () => finish(new Error('Saving the print copy stalled.'));
  transaction.onerror = () => finish(new Error('Saving the print copy stalled.'));
});

const one = <T>(request: IDBRequest<T>, transaction: IDBTransaction): Promise<T> => new Promise((resolve, reject) => {
  let settled = false;
  const finish = (value?: T, error?: Error) => {
    if (settled) return;
    settled = true;
    window.clearTimeout(timer);
    error ? reject(error) : resolve(value as T);
  };
  const timer = window.setTimeout(() => {
    try { transaction.abort(); } catch { /* it may already have completed */ }
    finish(undefined, new Error('Print copy storage timed out. Try again.'));
  }, TIMEOUT_MS);
  request.onsuccess = () => finish(request.result);
  request.onerror = () => finish(undefined, new Error('Reading the print copy stalled.'));
});

const sameIds = (left: string[], right: string[]): boolean => left.length === right.length && left.every((value, index) => value === right[index]);
const sameArtifact = (existing: Stored, candidate: Stored): boolean =>
  existing.key === candidate.key && existing.sector === candidate.sector && existing.title === candidate.title
  && existing.paper === candidate.paper && existing.html === candidate.html && existing.createdAt === candidate.createdAt
  && existing.createdBy === candidate.createdBy && existing.sha256 === candidate.sha256 && sameIds(existing.jobIds, candidate.jobIds);

/** IndexedDB completion is the acknowledgement. A key may be read again only when every immutable fact matches. */
export async function savePrintArtifact(input: Input): Promise<{ ok: true; sha256: string } | { ok: false; message: string }> {
  if (!input.key || !input.sector || !input.title || !input.createdAt || !input.createdBy || !Array.isArray(input.jobIds)) return { ok: false, message: safe('Print copy details are incomplete.') };
  if (input.html.length === 0 || !generatedHtml(input.html)) return { ok: false, message: safe('Only a generated print copy can be saved.') };
  const bytes = encodedBytes(input.html);
  if (bytes === null) return { ok: false, message: safe('Checking the print copy size stalled. Try again.') };
  if (bytes > MAX_HTML) return { ok: false, message: safe('This print copy is too large. Choose a smaller run.') };
  if (input.paper !== 'A4' && input.paper !== 'A5') return { ok: false, message: safe('Print paper is invalid.') };
  try {
    const sha256 = await digest(input.html); // Empty means Web Crypto was unavailable; it is never a substitute hash.
    const jobIds = [...new Set(input.jobIds)];
    const record: Stored = { ...input, jobIds, sha256, storageKey: storageKey(input.sector, input.key), sectorJobs: jobIds.map((id) => sectorJob(input.sector, id)) };
    const db = await open();
    try {
      const transaction = db.transaction(STORE, 'readwrite');
      const store = transaction.objectStore(STORE);
      const existing = await one(store.get(record.storageKey), transaction);
      if (existing) {
        try { transaction.abort(); } catch { /* no mutation was made */ }
        if (sameArtifact(existing, record)) return { ok: true, sha256: existing.sha256 };
        return { ok: false, message: safe('This print copy already exists and stands as it is.') };
      }
      store.add(record);
      await complete(transaction);
      return { ok: true, sha256 };
    } finally { db.close(); }
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    return { ok: false, message: safe(message.includes('busy') || message.includes('timed out') ? message : 'Saving the print copy stalled. Try again.') };
  }
}

const materialize = (record: Stored | undefined): PrintArtifact | null => record ? {
  key: record.key, sector: record.sector, title: record.title, paper: record.paper, html: record.html,
  createdAt: record.createdAt, createdBy: record.createdBy, jobIds: [...record.jobIds], sha256: record.sha256,
} : null;

export async function loadPrintArtifact(key: string, sector: string): Promise<PrintArtifact | null> {
  if (!key || !sector) return null;
  try {
    const db = await open();
    try {
      const transaction = db.transaction(STORE, 'readonly');
      return materialize(await one(transaction.objectStore(STORE).get(storageKey(sector, key)), transaction));
    } finally { db.close(); }
  } catch { return null; }
}

export async function findPrintArtifactByJob(jobId: string, sector: string): Promise<PrintArtifact | null> {
  if (!jobId || !sector) return null;
  try {
    const db = await open();
    try {
      const transaction = db.transaction(STORE, 'readonly');
      return materialize(await one(transaction.objectStore(STORE).index('sectorJob').get(sectorJob(sector, jobId)), transaction));
    } finally { db.close(); }
  } catch { return null; }
}
