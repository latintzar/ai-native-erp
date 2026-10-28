/* THE PRINT QUEUE — durable browser print attempts.
 *
 * Enqueue records a request; no timer, queue drain, popup, or browser callback proves paper came
 * out. The controller first persists `printing` after it has captured immutable generated HTML,
 * then asks the browser for its dialog. Only an explicit operator confirmation or verified
 * connector receipt may append the sale ledger event. This journal is recovery evidence, never
 * incoming email, files, addresses, or popup HTML.
 */
import * as React from 'react';
import type { SectorId } from '../../scenarios/meta';
import { dayNow } from './day';
import { capturePackingOutputs, isPackingCapture, packingOutputs, type PackingCapture, type PackingConfirmation } from './packing-output';
import { SHEET, paginate, type PaperRow } from '../../rocoto/paper';
import { dayLabelFromId, materialCursorForSale, printCapturedSale, printDay, printSale, slotOf, type Sale } from './sale';
import { SECTORS } from '../../scenarios/data/cast';
import { saleRevisionOf } from './export-model';
import type { PrintLayoutProfile } from './print-layout';
import { CEDAR_PRINT_JOURNAL_PEN_VERSION, migratePrintJournalCurrency } from './currency-migration';

/* ── WHAT IS ON THE PRINTER ───────────────────────────────────────────────────────────────── */

/** WHAT A SHEET IS ABOUT. The THREE things this trade prints (FEED-IA §20, §37.7): the day's own
 *  delivery sheet, one customer's albarán, and the day's packing lists. It is declared here rather
 *  than in the view because the queue outlives the view: a job survives the print surface being
 *  closed, and the surface is what re-reads the queue.
 *
 *  ═══ THE THIRD KIND IS A KIND NOW, NOT A RESERVED STRING (§37.7, the seam closed) ══════════
 *  The packing job used to ride an `albaran` subject under a key no sale could hold —
 *  `packing:<day>` — because this file's union had two kinds and `print-view.tsx` could not add
 *  one. That worked and it lied: the queue believed a packing list was somebody's albarán, so
 *  anything reasoning over the queue by kind (a per-sale lookup, a count of documents owed, a row
 *  that names what it is) had to know the string trick or be quietly wrong. Three products means
 *  three kinds; the reserved key retires with the seam. */
export type PrintRunKind = 'albaranes' | 'packing';
type PrintScope = { day: string; truck?: number | null; salesIds?: string[] };
export type PrintSubject =
  | ({ kind: 'day'; divider?: PrintRunKind; run?: 'albaranes' } & PrintScope)
  | { kind: 'albaran'; sale: string }
  | ({ kind: 'packing' } & PrintScope);

/* ── THE SEND RAILS ON A JOB (§20, and §35.4 which settled them) ──────────────────────────────
 * «The send rails ride the same act: if the house connected Rocoto to send emails for them,
 * clicking print also offers the email send… And if the CUSTOMER integrated their own ERP
 * (tSpoonLab), the albarán can land straight in it.»
 *
 * THE OFFER BECAME A SCHEDULE (§35.4: «scheduled by default at the requested delivery time»). Both
 * rails now STATE themselves on the queue row — the customer's copy goes at the hour they asked
 * for, and a customer with their own system gets it there too — because a person who has just
 * pressed print is watching paper, not answering a second question about mail. The act that used
 * to live here (`sendRail`) went with the offer; the schedule is a ledger fact in `sale.ts`, where
 * the export centre and the albarán's own block read it.
 */

export type RailKind = 'email' | 'erp';

export type SendRail = {
  kind: RailKind;
  /** who receives it, in the words the person would use */
  to: string;
  /** the hour it goes — the customer's own slot */
  at: string;
  sent: boolean;
};

/** THE HOUR THE CUSTOMER'S OWN SEND GOES OUT (§20, corrected by §35.4). It used to be one window
 *  for the whole house — «the 09:00 window» — and §35.4 replaced that with the customer's own
 *  answer: «scheduled by default at the REQUESTED DELIVERY TIME». So the hour comes off the sale
 *  (`slotOf`), and this constant is what a rail falls back to where a sale is not in hand. */
export const SEND_WINDOW = '09:00';

/* ── THE JOB ──────────────────────────────────────────────────────────────────────────────── */

export type JobState = 'waiting' | 'printing' | 'printed';

export type PrintConfirmation = { at: string; by: string; requestedAt: string; requestedBy: string; revision: string; materialCursor: number; attemptId: string };

/** Minimal evidence needed to recover one albarán confirmation after a browser reload. It is the
 * rendered line-price fact, never an incoming message, email address, or popup HTML. */
export type PrintSaleSnapshot = { sale: string; prices: Record<string, number> };

export type PrintJob = {
  id: string;
  subject: PrintSubject;
  /** what the paper is, said the way the row says it: «Albarán A-1042 · Can Solé» */
  what: string;
  /** how many sheets the document is, before copies */
  sheets: number;
  /** the A4/A5 shape this job was paged for when it entered the queue */
  paper: QueuePaper;
  /** copies captured for this attempt; later settings do not rewrite it */
  copies: number;
  /** Browser route captured for the request; the browser chooses the actual target. */
  printer: string;
  /** source revision captured for this request; later edits do not rewrite it */
  revision: string;
  /** sector captured with this attempt; queues never leak across demo houses */
  sector: SectorId;
  /** browser request wall-clock evidence, distinct from the kit ledger's display time */
  requestedAt: string;
  /** Durable logical run identity. It prevents an ordinary post-reload press from making another attempt. */
  runKey?: string;
  /** Optional immutable parent attempt for an explicit reprint. */
  reprintOf?: string;
  /** the pages the printer owes for this job, copies included */
  pages: number;
  /** the pages still to come out */
  left: number;
  state: JobState;
  /** the hour it was sent to the printer */
  at: string;
  /** named requester in this browser kit; production supplies the signed-in member. */
  requestedBy: string;
  /** material edit cursor captured at request; a late confirmation remains stale history */
  materialCursor: number;
  confirmedBy?: string;
  /** Durable operator acknowledgement used to retry the same domain write after a storage failure. */
  confirmationPending?: { at: string; by: string };
  /** persistence failure after an explicit confirmation attempt; it remains unconfirmed */
  failure?: string;
  /** the hour the last page came out */
  done?: string;
  rails: SendRail[];
  /** Captured generated line facts make an albarán confirmation recoverable after reload. */
  saleSnapshot?: PrintSaleSnapshot;
  /** what the ledger owes once the paper exists. `sale.ts` keeps the verbs; this only calls one. */
  record?: (confirmation: PrintConfirmation) => boolean | void;
  /** Immutable packing revisions captured before this job enters the queue. */
  packingOutput?: PackingCapture[];
};

/** What a surface hands `enqueue`. Everything else about a job is the queue's own arithmetic. */
export type PrintOrder = {
  subject: PrintSubject;
  what: string;
  sheets: number;
  /** the effective A4/A5 setting at the press; a queued job never changes shape afterwards */
  paper: QueuePaper;
  /** Optional for legacy callers; captured from setup at enqueue time. */
  copies?: number;
  revision?: string;
  sector?: SectorId;
  requestedBy?: string;
  requestedAt?: string;
  /** Durable logical run identity supplied by the browser-print controller. */
  runKey?: string;
  /** Optional immutable parent attempt supplied for an explicit reprint. */
  reprintOf?: string;
  materialCursor?: number;
  /** Captured generated line facts for recovery, never raw incoming source. */
  saleSnapshot?: PrintSaleSnapshot;
  at: string;
  rails?: SendRail[];
  record?: (confirmation: PrintConfirmation) => boolean | void;
  /** Immutable packing revisions captured before this job enters the queue. */
  packingOutput?: PackingCapture[];
};

/* ── THE SETUP ────────────────────────────────────────────────────────────────────────────── */

export const PAPER_SIZES = ['A4', 'A5', 'Ticket'] as const;
export type PaperSize = (typeof PAPER_SIZES)[number];
/** Ticket is retained only for legacy preferences; this browser renderer supports A4 and A5. */
export type QueuePaper = Extract<PaperSize, 'A4' | 'A5'>;

/** How many copies of every sheet. Three is as far as a bay ever goes on one press. */
export const COPY_STEPS = [1, 2, 3];

export type PrintSetup = {
  version: number;
  /** Legacy saved browser field; browser printing chooses the target in its native dialog. */
  printer: string;
  paper: PaperSize;
  copies: number;
  /** Legacy persisted-preference marker; browser printing never waits on it. */
  set: boolean;
};

export const PRINT_SETUP_VERSION = 1;

export const PRINT_SETUP_DEFAULTS: PrintSetup = {
  version: PRINT_SETUP_VERSION,
  printer: '',
  paper: 'A4',
  copies: 1,
  set: false,
};

export const PRINT_STORAGE_KEY = 'rocoto-app-print';

/** Read a stored setup back into the shape this build knows, one field at a time. */
export function parsePrintSetup(raw: unknown): PrintSetup {
  if (!raw || typeof raw !== 'object') return PRINT_SETUP_DEFAULTS;
  const r = raw as Record<string, unknown>;
  if (r.version !== PRINT_SETUP_VERSION) return PRINT_SETUP_DEFAULTS;
  const paper = PAPER_SIZES.find((p) => p === r.paper) ?? PRINT_SETUP_DEFAULTS.paper;
  const copies = COPY_STEPS.includes(Number(r.copies)) ? Number(r.copies) : PRINT_SETUP_DEFAULTS.copies;
  return {
    version: PRINT_SETUP_VERSION,
    printer: typeof r.printer === 'string' ? r.printer : '',
    paper,
    copies,
    set: r.set === true,
  };
}

/** THE ONE SENTENCE THE SETTINGS ROW HOLDS (§20: «a settings row, never a dialog per print»). */
export const setupWords = (s: PrintSetup): string =>
  s.paper === 'Ticket'
    ? 'Choose A4 or A5 before printing'
    : `${s.paper} · ${s.copies === 1 ? '1 copy' : `${s.copies} copies`}`;

/* ── HOW MANY SHEETS A DOCUMENT IS ────────────────────────────────────────────────────────────
 * Read off `el papel`'s OWN geometry rather than guessed, so the number the queue counts down and
 * the number the preview's stage prints on it come from one set of measurements. It is the first
 * page's capacity applied to every page — a page count that errs by one at the back of a long day
 * sheet, and never by an order of magnitude.
 */
export function sheetsFor(rows: number, subLines = 0, paper: QueuePaper = effectivePaper()): number {
  /* `paginate` is also what the preview uses. A synthetic row carries the same measured
     traceability height, so the queue never estimates A5 from A4 geometry. */
  const row: PaperRow = { id: 'sheet-row', cells: {}, sub: Array.from({ length: subLines }) };
  return paginate(Array.from({ length: rows }, () => row), paperFormat(paper), true, true).length;
}

/** THE TRAZABILIDAD SUB-LINE, at the size an albarán's own family produces. Fish carries eight
 *  facts three to a line, which is the deepest sub-line in the catalogue and therefore the honest
 *  one to size a queue's page count against. */
const ALBARAN_SUB_LINES = 3;

/* ── THE STORE ────────────────────────────────────────────────────────────────────────────── */



const read = (): PrintSetup => {
  try {
    const raw = window.localStorage.getItem(PRINT_STORAGE_KEY);
    return raw ? parsePrintSetup(JSON.parse(raw)) : PRINT_SETUP_DEFAULTS;
  } catch {
    return PRINT_SETUP_DEFAULTS;
  }
};

export const PRINT_JOURNAL_VERSION = CEDAR_PRINT_JOURNAL_PEN_VERSION;
export const PRINT_JOURNAL_KEY = 'rocoto-app-print-journal';

type StoredPrintJob = Omit<PrintJob, 'record'>;
type PrintJournal = { version: typeof PRINT_JOURNAL_VERSION; jobs: StoredPrintJob[] };

/** A journal is deliberately small: it is an activity trail and recovery evidence, not a cache of
 * messages, files, addresses, or browser-popup HTML. Functions and generated packing pages cannot
 * survive a reload, so they are never serialized. */
const storedJob = ({ record: _record, ...job }: PrintJob): StoredPrintJob => job;

const validSubject = (value: unknown): value is PrintSubject => {
  if (!value || typeof value !== 'object') return false;
  const subject = value as Record<string, unknown>;
  if (subject.kind === 'albaran') return typeof subject.sale === 'string';
  if ((subject.kind !== 'day' && subject.kind !== 'packing') || typeof subject.day !== 'string') return false;
  return subject.salesIds === undefined || (Array.isArray(subject.salesIds)
    && subject.salesIds.every((id) => typeof id === 'string' && id.length > 0));
};

const validStoredJob = (value: unknown): value is StoredPrintJob => {
  if (!value || typeof value !== 'object') return false;
  const job = value as Record<string, unknown>;
  const snapshot = job.saleSnapshot;
  const prices = snapshot && typeof snapshot === 'object' ? (snapshot as Record<string, unknown>).prices : undefined;
  const validSnapshot = snapshot === undefined || (Boolean(snapshot) && typeof snapshot === 'object'
    && typeof (snapshot as Record<string, unknown>).sale === 'string'
    && prices !== null && typeof prices === 'object'
    && Object.values(prices as Record<string, unknown>).every((price) => typeof price === 'number' && Number.isFinite(price))
    && (job.subject as PrintSubject).kind === 'albaran' && (snapshot as Record<string, unknown>).sale === (job.subject as { kind: 'albaran'; sale: string }).sale);
  const validPacking = job.packingOutput === undefined || (Array.isArray(job.packingOutput)
    && job.packingOutput.length > 0 && job.packingOutput.every(isPackingCapture)
    && (job.subject as PrintSubject).kind === 'packing');
  const pending = job.confirmationPending;
  const validPending = pending === undefined || (Boolean(pending) && typeof pending === 'object'
    && typeof (pending as Record<string, unknown>).at === 'string' && Number.isFinite(Date.parse((pending as Record<string, unknown>).at as string))
    && typeof (pending as Record<string, unknown>).by === 'string' && ((pending as Record<string, unknown>).by as string).length > 0);
  return typeof job.id === 'string' && validSubject(job.subject)
    && typeof job.what === 'string' && typeof job.sheets === 'number'
    && (job.paper === 'A4' || job.paper === 'A5') && typeof job.copies === 'number'
    && typeof job.printer === 'string' && typeof job.revision === 'string'
    && typeof job.sector === 'string' && SECTORS.includes(job.sector as SectorId) && typeof job.requestedAt === 'string'
    && (job.runKey === undefined || (typeof job.runKey === 'string' && job.runKey.trim().length > 0))
    && (job.reprintOf === undefined || (typeof job.reprintOf === 'string' && job.reprintOf.trim().length > 0))
    && typeof job.pages === 'number' && typeof job.left === 'number'
    && (job.state === 'waiting' || job.state === 'printing' || job.state === 'printed')
    && typeof job.at === 'string' && typeof job.requestedBy === 'string'
    && typeof job.materialCursor === 'number' && Array.isArray(job.rails) && validSnapshot && validPacking && validPending;
};

const parsePrintJournal = (raw: unknown): PrintJournal | undefined => {
  if (!raw || typeof raw !== 'object') return undefined;
  const journal = migratePrintJournalCurrency(raw) as Record<string, unknown>;
  if (journal.version !== PRINT_JOURNAL_VERSION || !Array.isArray(journal.jobs)) return undefined;
  if (!journal.jobs.every(validStoredJob)) return undefined;
  return { version: PRINT_JOURNAL_VERSION, jobs: journal.jobs };
};

const readJournal = (): PrintJob[] => {
  try {
    const encoded = window.localStorage.getItem(PRINT_JOURNAL_KEY);
    if (!encoded) return [];
    const source: unknown = JSON.parse(encoded);
    const migrated = migratePrintJournalCurrency(source);
    const parsed = parsePrintJournal(migrated);
    if (parsed && migrated !== source) {
      try {
        window.localStorage.setItem(PRINT_JOURNAL_KEY, JSON.stringify(parsed));
      } catch (error) {
        console.warn('Rocoto will retry the print-journal currency upgrade on the next boot', error);
      }
    }
    return parsed?.jobs ?? [];
  } catch {
    return [];
  }
};

/** Serialize and validate before a new queue snapshot is published. A private-mode failure leaves
 * the prior journal authoritative; callers can then state that the request could not be retained. */
const writeJournal = (jobs: PrintJob[]): boolean => {
  if (typeof window === 'undefined') return true;
  try {
    const encoded = JSON.stringify({ version: PRINT_JOURNAL_VERSION, jobs: jobs.map(storedJob) } satisfies PrintJournal);
    if (!parsePrintJournal(JSON.parse(encoded))) return false;
    window.localStorage.setItem(PRINT_JOURNAL_KEY, encoded);
    return true;
  } catch {
    return false;
  }
};

let JOBS: PrintJob[] = typeof window === 'undefined' ? [] : readJournal();
let SETUP: PrintSetup = typeof window === 'undefined' ? PRINT_SETUP_DEFAULTS : read();

/** The persisted setup answers a press that has no local paper argument. Ticket has no document
 * pagination in this kit, so it falls back to its full-sheet A4 document shape. */
const effectivePaper = (paper: PaperSize = SETUP.paper): QueuePaper => paper === 'A5' ? 'A5' : 'A4';
const paperFormat = (paper: QueuePaper): keyof typeof SHEET => paper === 'A5' ? 'a5' : 'a4';

const listeners = new Set<() => void>();

const subscribe = (l: () => void): (() => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

const announce = (): void => {
  for (const l of listeners) l();
};

const jobsSnapshot = (): PrintJob[] => JOBS;
const setupSnapshot = (): PrintSetup => SETUP;
/** Read-only current setup for print controllers that must capture copies before rendering. */
export const printSetupNow = (): PrintSetup => ({ ...SETUP });

/** Only publish a queue state that was retained first. This prevents a visual history claim that
 * vanishes on reload while a person is trying to establish who requested or confirmed paper. */
function replaceJobs(next: PrintJob[]): boolean {
  if (!writeJournal(next)) return false;
  JOBS = next;
  announce();
  return true;
}

function patch(id: string, next: (job: PrintJob) => PrintJob): boolean {
  return replaceJobs(JOBS.map((j) => (j.id === id ? next(j) : j)));
}

/* Browser-only builds have no printer receipt. Queueing records intent only; a real print
 * integration must call `markPrintDialogRequested`, then either explicit human confirmation or
 * a verified connector receipt must call `confirmPrintAttempt`. */
function pump(): void { /* No timer may infer a physical print. */ }

/* ── THE ACTS ─────────────────────────────────────────────────────────────────────────────── */

let seq = JOBS.reduce((largest, job) => Math.max(largest, Number(/^p(\d+)$/.exec(job.id)?.[1] ?? 0)), 0);
const printSessionId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);

const jobOf = (order: PrintOrder): PrintJob => {
  seq += 1;
  const copies = order.copies ?? SETUP.copies;
  const pages = Math.max(1, order.sheets) * copies;
  return {
    id: `p-${printSessionId}-${seq}`,
    subject: order.subject,
    what: order.what,
    sheets: order.sheets,
    paper: order.paper,
    copies,
    printer: 'Browser print dialog',
    revision: order.revision ?? 'Source revision unavailable',
    sector: order.sector ?? dayNow().sector,
    requestedAt: order.requestedAt ?? new Date().toISOString(),
    runKey: order.runKey,
    reprintOf: order.reprintOf,
    requestedBy: order.requestedBy ?? 'You',
    materialCursor: order.materialCursor ?? 0,
    saleSnapshot: order.saleSnapshot,
    pages,
    left: pages,
    state: 'waiting',
    at: order.at,
    rails: order.rails ?? [],
    record: order.record,
    packingOutput: order.packingOutput,
  };
};

/** WHAT THE QUEUE HOLDS ONTO. Everything still owed paper, plus the last few that came out — so
 *  the list reads as what is happening now without the trim ever eating a job the printer has not
 *  reached. Sliding the whole array was the old rule and it lost work at scale. */
const trim = (jobs: PrintJob[]): PrintJob[] => jobs;

/** SEND A DOCUMENT TO THE PRINTER. It joins the back of the queue and the header's count grows by
 *  its pages; the paper comes out on its own. */
export function enqueue(order: PrintOrder): string {
  const job = jobOf(order);
  if (!replaceJobs(trim([...JOBS, job]))) return '';
  pump();
  return job.id;
}

/** THE WHOLE DAY'S PAPER, IN ONE PRESS (FEED-IA §29.1, §31.1). «Print 108 new» is one act, so it is
 *  one write and one announcement: enqueueing them one at a time re-rendered a seven-hundred-row
 *  river a hundred and eight times inside a single click, which is a surface that freezes on the
 *  button the whole day is worked from. The printer still takes them one page at a time. */
export function enqueueAll(orders: PrintOrder[]): string[] {
  if (orders.length === 0) return [];
  const made = orders.map(jobOf);
  if (!replaceJobs(trim([...JOBS, ...made]))) return [];
  pump();
  return made.map((j) => j.id);
}

/** Persist rendered paper and copies. A browser print target is selected only in the native dialog. */
export function setPrintSetup(patchIn: Partial<PrintSetup>): boolean {
  const next = { ...SETUP, ...patchIn, version: PRINT_SETUP_VERSION };
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(PRINT_STORAGE_KEY, JSON.stringify(next));
  } catch {
    return false;
  }
  SETUP = next;
  announce();
  pump();
  return true;
}

/** Back to the starting answers, with nothing remembered. The queue empties with them. */
export function resetPrinting(): void {
  if (!replaceJobs([])) return;
  packingOutputs.reset();
  SETUP = PRINT_SETUP_DEFAULTS;
  try {
    window.localStorage.removeItem(PRINT_STORAGE_KEY);
    window.localStorage.removeItem(PRINT_JOURNAL_KEY);
  } catch { /* nothing to clear */ }
  announce();
}

/** Persist browser-dialog intent before invoking `window.print()`. It is not a physical-print receipt.
 * A second call for the same durable job is harmless; a journal failure returns false so a caller
 * must not open a popup whose request cannot survive reload. */
export function markPrintDialogRequested(id: string): boolean {
  const job = JOBS.find((value) => value.id === id);
  if (!job) return false;
  if (job.state === 'printed' || job.state === 'printing') return true;
  return patch(id, (value) => ({ ...value, state: 'printing', failure: undefined }));
}

/** Batch surfaces mark their complete immutable run in one acknowledged journal write. */
export function markPrintRunRequested(ids: string[]): boolean {
  const wanted = new Set(ids);
  const selected = [...wanted].map((id) => JOBS.find((job) => job.id === id));
  if (wanted.size === 0 || selected.some((job) => !job)) return false;
  if (selected.every((job) => job!.state !== 'waiting')) return true;
  const next = JOBS.map((job) => wanted.has(job.id) && job.state === 'waiting'
    ? { ...job, state: 'printing' as const, failure: undefined }
    : job);
  return replaceJobs(next);
}

/** Only explicit operator confirmation or verified connector receipt may close an attempt. */
export function confirmPrintAttempt(id: string, at: string, confirmedBy = 'You'): boolean {
  let job = JOBS.find(value => value.id === id);
  if (!job) return false;
  if (job.sector !== dayNow().sector) {
    patch(id, value => ({ ...value, failure: 'Open the matching workspace before confirming this print.' }));
    return false;
  }
  if (job.state === 'printed') return true;
  if (job.state !== 'printing') return false;
  /* Persist the exact human acknowledgement before any recoverable domain write. A retry keeps
   * this UTC time and actor, rather than inventing a second confirmation. */
  if (!job.confirmationPending) {
    const pending = { at, by: confirmedBy };
    if (!patch(id, value => ({ ...value, confirmationPending: pending, failure: undefined }))) return false;
    job = { ...job, confirmationPending: pending, failure: undefined };
  }
  const pendingConfirmation = job.confirmationPending;
  if (!pendingConfirmation) return false;
  const subject = job.subject;
  const confirmation: PrintConfirmation = {
    at: pendingConfirmation.at, by: pendingConfirmation.by, requestedAt: job.requestedAt, requestedBy: job.requestedBy,
    revision: job.revision, materialCursor: job.materialCursor, attemptId: job.id,
  };
  const packingConfirmation: PackingConfirmation = {
    requestedAt: confirmation.requestedAt, requestedBy: confirmation.requestedBy,
    confirmedAt: confirmation.at, confirmedBy: confirmation.by, attemptId: confirmation.attemptId,
  };
  try {
    /* A retained albarán uses its generated price facts. A current day sheet and its dividers
     * retain only their captured subject IDs: a divider records acknowledgement in this journal,
     * while a day sheet appends its own day event at the human confirmation time. */
    const saved = job.record
      ? job.record(confirmation)
      : job.saleSnapshot
        ? printCapturedSale({ ...job.saleSnapshot, ...confirmation, confirmedAt: confirmation.at, confirmedBy: confirmation.by })
        : subject.kind === 'packing' && job.packingOutput
          ? packingOutputs.complete(job.packingOutput, packingConfirmation)
          : subject.kind === 'day' && subject.salesIds?.length
            ? subject.divider
              ? true
              : (dayNow().events.some((event) => event.kind === 'print-day' && event.day === subject.day && event.at === confirmation.at)
                || printDay(subject.day, confirmation.at))
            : false;
    if (saved === false) {
      patch(id, value => ({ ...value, failure: 'Saving the confirmation stalled; this print stays awaiting confirmation.' }));
      return false;
    }
    if (!patch(id, value => ({ ...value, state: 'printed', left: 0, done: confirmation.at, confirmedBy: confirmation.by, confirmationPending: undefined, failure: undefined }))) return false;
    return true;
  } catch {
    patch(id, value => ({ ...value, failure: 'Saving the confirmation stalled; this print stays awaiting confirmation.' }));
    return false;
  }
}

/* ── THE READERS ──────────────────────────────────────────────────────────────────────────── */
export function printAttemptActivity(job: PrintJob): string {
  const copies = job.copies === 1 ? "1 copy" : `${job.copies} copies`;
  const requested = `Requested by ${job.requestedBy} · ${job.requestedAt} · ${job.paper} · ${copies} · revision ${job.revision}`;
  return job.state === "printed" ? `${requested} · confirmed by ${job.confirmedBy ?? "operator"} · ${job.done}` : job.failure ? `${requested} · ${job.failure}` : job.state === "printing" ? `${requested} · dialog requested · unconfirmed` : `${requested} · awaiting dialog`;
}

/** Durable non-React lookup for a logical browser-print run after a reload. */
export const printJobsForRun = (sector: string, runKey: string): PrintJob[] => {
  if (!sector || !runKey) return [];
  return JOBS.filter((job) => job.sector === sector && job.runKey === runKey).map((job) => ({
    ...job,
    subject: { ...job.subject, ...(job.subject.kind === 'albaran' ? {} : { salesIds: job.subject.salesIds ? [...job.subject.salesIds] : undefined }) },
    rails: job.rails.map((rail) => ({ ...rail })),
    saleSnapshot: job.saleSnapshot ? { sale: job.saleSnapshot.sale, prices: { ...job.saleSnapshot.prices } } : undefined,
  }));
};

export const useQueue = (sector?: SectorId): PrintJob[] => {
  const jobs = React.useSyncExternalStore(subscribe, jobsSnapshot, jobsSnapshot);
  return React.useMemo(() => sector ? jobs.filter((job) => job.sector === sector) : jobs, [jobs, sector]);
};
export const usePrintSetup = (): PrintSetup => React.useSyncExternalStore(subscribe, setupSnapshot, setupSnapshot);

/** Pages represent requests awaiting a receipt; they are never a physical-print count. */
export const pagesWaiting = (jobs: PrintJob[]): number => jobs.reduce((n, job) => n + (job.state === 'printed' ? 0 : job.left), 0);

export const jobFor = (jobs: PrintJob[], subject: PrintSubject): PrintJob | undefined =>
  [...jobs].reverse().find((job) => {
    if (job.subject.kind !== subject.kind) return false;
    if (subject.kind === 'albaran') return job.subject.kind === 'albaran' && job.subject.sale === subject.sale;
    if (job.subject.kind === 'albaran') return false;
    return job.subject.day === subject.day && job.subject.truck === subject.truck
      && (job.subject.salesIds ?? []).join('|') === (subject.salesIds ?? []).join('|')
      && (job.subject.kind === 'day' ? job.subject.divider : undefined) === (subject.kind === 'day' ? subject.divider : undefined)
      && (job.subject.kind === 'day' ? job.subject.run : undefined) === (subject.kind === 'day' ? subject.run : undefined);
  });

/** One subject matcher for live controls and a new request's previous-copy link. */
export const latestPrintJobForSubject = (sector: string, subject: PrintSubject): PrintJob | undefined =>
  jobFor(JOBS.filter((job) => job.sector === sector), subject);

export function jobWords(job: PrintJob, _setup: PrintSetup): string {
  if (job.state === 'printed') return 'Print confirmed';
  if (job.failure) return 'Awaiting confirmation · review Activity';
  if (job.state === 'printing') return 'Print dialog requested · awaiting confirmation';
  return 'Ready to open print dialog';
}

/** WHAT A RAIL SAYS ON THE ROW. Both of them STATE what happens now, because §35.4 made the mail
 *  a schedule rather than an offer: the paper wrote it, and the row says the hour it goes. */
export const railWords = (rail: SendRail): string =>
  rail.kind === 'erp'
    ? `Lands in their ${rail.to} at ${rail.at}`
    : `Goes to ${rail.to} by email at ${rail.at}`;

/* ── THE BUILDERS ─────────────────────────────────────────────────────────────────────────────
 * What a surface calls so it never has to compose a job by hand. `enqueue(albaranOrder(sale, now,
 * config.emailFeed))` is the whole of wiring a print control to this queue.
 */

/** ONE ALBARÁN, WITH ITS OWN SEND RAILS. The house's email is offered because it is this person's
 *  call on this document; the customer's own system states itself because it was arranged with
 *  them once. */
export function albaranOrder(
  sale: Sale,
  at: string,
  _email: { connected: boolean; address: string },
  paper: QueuePaper = effectivePaper(),
): PrintOrder {
  return {
    subject: { kind: 'albaran', sale: sale.id },
    what: `Delivery Note ${sale.number} · ${sale.customer.name}`,
    sheets: sheetsFor(sale.lines.length, ALBARAN_SUB_LINES, paper),
    paper,
    revision: saleRevisionOf([sale]),
    materialCursor: materialCursorForSale(sale.id),
    saleSnapshot: { sale: sale.id, prices: Object.fromEntries(sale.lines.map((line) => [line.id, line.price])) },
    at,
    /* Paper confirmation is independent of email and ERP. It records only this captured paper. */
    record: (confirmation) => printSale(sale, confirmation.at, {
      revision: confirmation.revision, materialCursor: confirmation.materialCursor, requestedAt: confirmation.requestedAt, requestedBy: confirmation.requestedBy, attemptId: confirmation.attemptId,
      confirmedAt: confirmation.at, confirmedBy: confirmation.by,
    }),
  };
}

/** THE DAY'S SHEET. It never leaves the building, so it rides no send rail at all. */
export function daySheetOrder(day: string, sheetSales: Sale[], at: string, paper: QueuePaper = effectivePaper()): PrintOrder {
  const rows = sheetSales.reduce((n, s) => n + s.lines.length, 0);
  return {
    subject: { kind: 'day', day, salesIds: sheetSales.map((sale) => sale.id) },
    what: `${dayLabelFromId(day)} · the day’s sheet`,
    sheets: sheetsFor(rows, 0, paper),
    paper,
    revision: saleRevisionOf(sheetSales),
    at,
    record: (confirmation) => dayNow().events.some((event) => event.kind === 'print-day' && event.day === day && event.at === confirmation.at) || printDay(day, confirmation.at),
  };
}


/** A run leaves one truck together (§138.9 / §142): its tick-off contents first, then exactly
 * those documents. Explicit IDs also let the preview show the same subset as the press. A house
 * still assigning a truck keeps its orders in a named group rather than losing them from paper. */
export type TruckRun = { day: string; truck: number | null; zone: string; sales: Sale[] };

export function truckRuns(sales: Sale[], layout?: Pick<PrintLayoutProfile, 'packing'>): TruckRun[] {
  const groups = new Map<string, TruckRun>();
  for (const sale of sales) {
    const truck = sale.customer.truck ?? null;
    const key = `${sale.day}:${truck ?? 'assign'}`;
    const group = groups.get(key) ?? { day: sale.day, truck, zone: '', sales: [] };
    group.sales.push(sale);
    groups.set(key, group);
  }
  return [...groups.values()]
    .sort((a, b) => a.day.localeCompare(b.day) || (a.truck ?? Infinity) - (b.truck ?? Infinity))
    .map((group) => ({
      ...group,
      zone: [...new Set(group.sales.map((sale) => sale.customer.zone).filter(Boolean))].join(' · '),
      sales: [...group.sales].sort((a, b) => {
        const mode = layout?.packing.sort ?? 'route';
        if (mode === 'customer') return a.customer.name.localeCompare(b.customer.name) || a.id.localeCompare(b.id);
        if (mode === 'order-value') return b.figure - a.figure || a.customer.name.localeCompare(b.customer.name) || a.id.localeCompare(b.id);
        if (mode === 'lifetime-value') {
          const totals = layout?.packing.lifetimeValues ?? {};
          return (totals[b.customer.id] ?? 0) - (totals[a.customer.id] ?? 0) || a.customer.name.localeCompare(b.customer.name) || a.id.localeCompare(b.id);
        }
        return slotOf(a).localeCompare(slotOf(b)) || a.at.localeCompare(b.at) || a.id.localeCompare(b.id);
      }),
    }));
}

export const truckRunWords = (run: Pick<TruckRun, 'truck'>): string =>
  run.truck === null ? 'Truck to assign' : `Truck ${run.truck}`;

export const printRunWords = (kind: PrintRunKind, count: number): string =>
  `${count} ${kind === 'albaranes' ? (count === 1 ? 'delivery note' : 'delivery notes') : (count === 1 ? 'packing list' : 'packing lists')}`;

export function truckDividerOrder(run: TruckRun, kind: PrintRunKind, at: string, paper: QueuePaper = effectivePaper()): PrintOrder {
  return {
    subject: { kind: 'day', day: run.day, truck: run.truck, salesIds: run.sales.map((s) => s.id), divider: kind },
    what: `${truckRunWords(run)} · ${printRunWords(kind, run.sales.length)} · contents`,
    sheets: paginate(run.sales.map<PaperRow>((s) => ({ id: s.id, cells: {} })), paperFormat(paper), true, true).length,
    paper,
    revision: saleRevisionOf(run.sales),
    at,
  };
}

export function albaranRun(
  sales: Sale[], at: string, email: { connected: boolean; address: string }, paper: QueuePaper = effectivePaper(),
): PrintOrder[] {
  return truckRuns(sales).flatMap((run) => [
    truckDividerOrder(run, 'albaranes', at, paper),
    ...run.sales.map((sale) => albaranOrder(sale, at, email, paper)),
  ]);
}

/** One truck's packing document. The run builder, used by every batch door, puts its contents
 * sheet before it. Packing paper never records an albarán as printed. */
export function packingOrder(day: string, sales: Sale[], at: string, paper: QueuePaper = effectivePaper(), sector: SectorId = dayNow().sector, layout?: Pick<PrintLayoutProfile, 'packing'>): PrintOrder {
  const own = sales.filter((sale) => sale.day === day);
  const captured = capturePackingOutputs(own, sector);
  const runs = truckRuns(own, layout);
  const run = runs.length === 1 ? runs[0] : undefined;
  const rowCounts = own.map((sale) => 1 + sale.lines.length);
  // The paper renderer keeps every order block together in a lane, then pairs adjacent blocks.
  // This keeps the queue's page estimate in the same shape as a captured two-column document.
  const displayedRows = layout?.packing.columns === 2
    ? rowCounts.reduce((total, count, index) => index % 2 === 0 ? total + Math.max(count, rowCounts[index + 1] ?? 0) : total, 0)
    : rowCounts.reduce((total, count) => total + count, 0);
  const rows: PaperRow[] = Array.from({ length: displayedRows }, (_, index) => ({ id: `packing-row-${index}`, cells: {} }));
  return {
    subject: { kind: 'packing', day, truck: run?.truck, salesIds: own.map((sale) => sale.id) },
    what: `${run ? truckRunWords(run) : dayLabelFromId(day)} · ${printRunWords('packing', own.length)}`,
    packingOutput: captured,
    // Only explicit confirmation completes captured packing output; enqueueing proves nothing.
    record: (confirmation) => packingOutputs.complete(captured, {
      requestedAt: confirmation.requestedAt, requestedBy: confirmation.requestedBy,
      confirmedAt: confirmation.at, confirmedBy: confirmation.by, attemptId: confirmation.attemptId,
    }),
    sheets: paginate(rows, paperFormat(paper), true, true).length,
    paper,
    revision: saleRevisionOf(own),
    at,
  };
}
export function packingRun(day: string, sales: Sale[], at: string, paper: QueuePaper = effectivePaper(), sector: SectorId = dayNow().sector, layout?: Pick<PrintLayoutProfile, 'packing'>): PrintOrder[] {
  return truckRuns(sales.filter((sale) => sale.day === day), layout).flatMap((run) => [
    truckDividerOrder(run, 'packing', at, paper),
    packingOrder(day, run.sales, at, paper, sector, layout),
  ]);
}
