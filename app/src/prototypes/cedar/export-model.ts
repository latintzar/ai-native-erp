/* The export worker's contract. The kit reports the transport state it can evidence. */
import type { Sale } from './sale';
export type ExportDestination = 'file' | 'customer-email' | 'erp-api';
export type ExportJobStatus = 'ready' | 'scheduled' | 'sending' | 'download-requested' | 'accepted' | 'failed' | 'cancelled' | 'paused' | 'partial';
export type ConnectionCadence = 'manual' | 'daily' | 'continuous';
export type ExportSnapshot = { jobId: string; destination: ExportDestination; day: string; saleIds: string[]; revision: string; idempotencyKey: string; status: ExportJobStatus; createdAt: string; completedAt?: string; evidence?: string; error?: string; };
export type ApiConnectionLifecycle = { destinationName: string; configured: boolean; cadence: ConnectionCadence; lastSuccessAt?: string; nextScheduledAt?: string; manualResyncAvailable: boolean; };
export const ERP_JOB_STATES: ExportJobStatus[] = ['ready', 'scheduled', 'sending', 'partial', 'accepted', 'failed', 'paused'];
export type FileDownloadRecord = {
  day: string;
  revision: string;
  saleRevisions: Record<string, string>;
  at: string;
  rows: number;
  orderCount: number;
  /** exactly what the browser wrote, from the saved payload itself. Records kept before the size
   *  was measured leave it absent, and a surface states the size it has. */
  bytes?: number;
  scope: 'all' | 'since-download';
  outputId?: string;
  fileName?: string;
  format?: 'CSV';
  requestedBy?: string;
};
const FILE_HISTORY_KEY = 'rocoto-app-export-files-v1';
const FILE_REQUEST_HISTORY_KEY = 'rocoto-app-export-file-requests-v1';
const sectorFileKey = (key: string, sector: string) => `${key}:${sector}`;
export const saleRevisionOf = (sales: Sale[]): string => {
  // Output identity includes customer routing and every rendered line option/trace fact.
  // It deliberately excludes source conversations, tool traces and print-attempt metadata.
  const exact = sales.map((sale) => ({
    id: sale.id, number: sale.number, day: sale.day, deliveryDay: sale.deliveryDay, at: sale.at,
    window: sale.window, state: sale.state, customer: sale.customer,
    lines: sale.lines.map((line) => ({
      id: line.id, product: { id: line.product.id, name: line.product.name, trace: line.product.trace },
      ordered: line.ordered, given: line.given, unit: line.unit, unitFactor: line.unitFactor,
      /* ⚠ `klass` LEFT THIS IDENTITY (FEED-IA §197.2): it names every RENDERED line fact, and
         no output renders a class any more. */
      price: line.price, lot: line.lot, allocations: line.allocations,
      amendment: line.amendment, prepNote: line.prepNote, customerOption: line.customerOption,
      unreadable: line.unreadable, dimensions: line.dimensions,
    })),
  }));
  let hash = 2166136261;
  for (const char of JSON.stringify(exact)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return `r${(hash >>> 0).toString(36)}`;
};
export const saleRevisionMapOf = (sales: Sale[]): Record<string, string> =>
  Object.fromEntries(sales.map((sale) => [sale.id, saleRevisionOf([sale])])) as Record<string, string>;
export const fileDownloadOf = (sector: string, day: string): FileDownloadRecord | undefined => {
  try { const raw = window.localStorage.getItem(sectorFileKey(FILE_HISTORY_KEY, sector)); const records = raw ? JSON.parse(raw) : {}; return records[day]; } catch { return undefined; }
};
const fileDownloadRecordsOf = (raw: string | null): FileDownloadRecord[] => {
  try {
    const parsed: unknown = JSON.parse(raw ?? '[]');
    return Array.isArray(parsed)
      ? parsed.filter((record): record is FileDownloadRecord => Boolean(record) && typeof record === 'object'
        && typeof (record as FileDownloadRecord).day === 'string'
        && typeof (record as FileDownloadRecord).at === 'string'
        && typeof (record as FileDownloadRecord).rows === 'number')
        .sort((a, b) => b.at.localeCompare(a.at))
      : [];
  } catch { return []; }
};
export const fileDownloadHistory = (sector: string): FileDownloadRecord[] => {
  try { return fileDownloadRecordsOf(window.localStorage.getItem(sectorFileKey(FILE_REQUEST_HISTORY_KEY, sector))); }
  catch { return []; }
};

const restoreStorageValue = (key: string, value: string | null) => {
  if (value === null) window.localStorage.removeItem(key);
  else window.localStorage.setItem(key, value);
};

/** Record the browser download request only when both sector-scoped indexes persist. The file has
 * already left through the browser by this point, so callers must surface `false` as an activity
 * warning rather than imply that the request itself failed. */
export const recordFileDownload = (sector: string, record: FileDownloadRecord): boolean => {
  const dayKey = sectorFileKey(FILE_HISTORY_KEY, sector);
  const requestKey = sectorFileKey(FILE_REQUEST_HISTORY_KEY, sector);
  let previousDays: string | null = null;
  let previousRequests: string | null = null;
  let writeStarted = false;
  try {
    previousDays = window.localStorage.getItem(dayKey);
    previousRequests = window.localStorage.getItem(requestKey);
    const parsed: unknown = previousDays ? JSON.parse(previousDays) : {};
    const records = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    const recent = fileDownloadRecordsOf(previousRequests);
    writeStarted = true;
    window.localStorage.setItem(dayKey, JSON.stringify({ ...records, [record.day]: record }));
    window.localStorage.setItem(requestKey, JSON.stringify([record, ...recent].slice(0, 50)));
    return true;
  } catch {
    if (writeStarted) {
      try {
        restoreStorageValue(dayKey, previousDays);
        restoreStorageValue(requestKey, previousRequests);
      } catch { /* Storage can remain unavailable; never report that the activity was recorded. */ }
    }
    return false;
  }
};
