import * as React from 'react';
import { loadConfig, type AppConfig, type Derived } from './config';
import PrintView from './print-view';
import { PRINT_LAYOUT_DEFAULTS, type PrintLayoutProfile } from './print-layout';
import { enqueueAll, markPrintRunRequested, printSetupNow, printJobsForRun, latestPrintJobForSubject, type PrintJob, type PrintOrder } from './print-queue';
import { findPrintArtifactByJob, loadPrintArtifact, savePrintArtifact } from './print-artifacts';
import { PrintActivityHost } from './print-activity';
import type { Sale } from './sale';
import type { Cast } from '../../scenarios/data/cast';
import { posthog, isPostHogConfigured } from '../../posthog';

export type BrowserPrintResult =
  | { status: 'dialog-requested' }
  | { status: 'blocked'; message: string }
  | { status: 'host-unavailable'; message: string };
export type BrowserPrintRequest = {
  /** A retry retains this key and the exact generated copy. Print again gets a new key. */
  idempotencyKey: string;
  title: string;
  paper: 'A4' | 'A5';
  document: React.ReactNode;
  /* THE ATTEMPT NAMES THE TEMPLATE IT WAS PRINTED UNDER (THE-OUTPUTS-SPEC OUT-01.7). A template
     edit raises its revision, so a sheet photographed weeks later is registered against the
     geometry that was on the paper rather than against today's. */
  capture: { sector: string; jobIds: string[]; createdAt: string; createdBy: string; templateId?: string; templateRevision?: number };
};
export type PrintSourceRunInput = {
  idempotencyKey: string;
  title: string;
  cast: Cast;
  derived: Derived;
  sales: Sale[];
  makeOrders?: (sales: Sale[]) => PrintOrder[];
  orders?: PrintOrder[];
  copies?: number;
  /** Frozen layout choices and any sale-history value used by this exact captured copy. */
  layoutProfile?: PrintLayoutProfile;
  /** The template this run came from, frozen at its revision (THE-OUTPUTS-SPEC OUT-01.7). */
  template?: { id: string; revision: number };
};
export type PrintSourceRunResult = BrowserPrintResult & { jobIds: string[] };
export type PrintFeedback = {
  key: string; sector: string; title: string; jobIds: string[];
  status: BrowserPrintResult['status'] | 'preparing'; message?: string;
};
export const PRINT_FEEDBACK_EVENT = 'rocoto:print-feedback';

type Pending = { request: BrowserPrintRequest; popup: Window | null; finish: (result: BrowserPrintResult) => void };
type CachedDocument = { html?: string; retained?: boolean; submitted?: boolean; active?: Promise<BrowserPrintResult> };
type RecoveryInput = Pick<PrintSourceRunInput, 'idempotencyKey' | 'title'>;
type SourceAttempt = { request: BrowserPrintRequest; jobIds: string[]; recovery?: { input: RecoveryInput; jobs: PrintJob[] } };
let renderThroughHost: ((pending: Pending) => void) | null = null;
let activeKey: string | null = null;
const cachedDocuments = new Map<string, CachedDocument>();
const sourceAttempts = new Map<string, SourceAttempt>();
let sequence = 0;
const session = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
export const newPrintAttemptKey = (scope: string): string => scope + ':attempt:' + session + ':' + (++sequence);
export const isDocumentPrintReady = (): boolean => renderThroughHost !== null;
export const isDocumentPrintBusy = (): boolean => activeKey !== null;
const frozen = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] ?? character));
const popupHead = (): string => Array.from(document.head.querySelectorAll('style, link[rel="stylesheet"]')).map((node) => {
  if (node instanceof HTMLStyleElement) {
    // Styletron inserts through CSSOM: a style element's outerHTML can be empty while its sheet
    // holds every layout rule. Capture those rules now, not the empty tag or future live styles.
    const copy = node.cloneNode(false) as HTMLStyleElement;
    try { copy.textContent = node.sheet ? Array.from(node.sheet.cssRules).map((rule) => rule.cssText).join('\n') : node.textContent; }
    catch { copy.textContent = node.textContent; }
    return copy.outerHTML;
  }
  return node.outerHTML;
}).join('\n');
const feedback = (request: BrowserPrintRequest, result: BrowserPrintResult | { status: 'preparing' }): void => {
  window.dispatchEvent(new CustomEvent<PrintFeedback>(PRINT_FEEDBACK_EVENT, { detail: {
    key: request.idempotencyKey, sector: request.capture.sector, title: request.title,
    jobIds: request.capture.jobIds, ...result,
  } }));
};

/** Capture all markup and CSS once. Retrying never reads today's settings or rebuilds an old copy. */
const completeHtml = (request: BrowserPrintRequest, body: string): string =>
  '<!doctype html><html><head><meta charset="utf-8">' +
  '<meta http-equiv="Content-Security-Policy" content="script-src \'none\'; object-src \'none\'; form-action \'none\'">' +
  '<base href="' + escapeHtml(document.baseURI) + '"><title>' + escapeHtml(request.title) + '</title>' +
  popupHead() + '<style>@page{size:' + request.paper + ';margin:0}' +
  'html,body{margin:0;background:white}body{print-color-adjust:exact;-webkit-print-color-adjust:exact}' +
  '#rocoto-print-document [data-baseweb="paper"]>div{break-after:page;page-break-after:always}' +
  '#rocoto-print-document [data-baseweb="paper"]>div:last-child{break-after:auto;page-break-after:auto}' +
  '</style></head><body><main id="rocoto-print-document">' + body + '</main></body></html>';

const waitForPrintAssets = async (popup: Window): Promise<void> => {
  let timer: number | undefined;
  const cleanup: Array<() => void> = [];
  const fonts = popup.document.fonts?.ready ?? Promise.resolve();
  const images = Array.from(popup.document.images).map((image) => image.complete
    ? image.naturalWidth > 0 ? Promise.resolve() : Promise.reject(new Error('Image unavailable'))
    : new Promise<void>((resolve, reject) => {
      const loaded = () => resolve();
      const failed = () => reject(new Error('Image unavailable'));
      image.addEventListener('load', loaded, { once: true });
      image.addEventListener('error', failed, { once: true });
      cleanup.push(() => { image.removeEventListener('load', loaded); image.removeEventListener('error', failed); });
    }));
  try {
    await Promise.race([
      Promise.all([fonts, ...images]).then(() => undefined),
      new Promise<never>((_, reject) => { timer = window.setTimeout(() => reject(new Error('Loading timed out')), 5000); }),
    ]);
  } finally { if (timer !== undefined) window.clearTimeout(timer); cleanup.forEach((fn) => fn()); }
};
const closePopup = (popup: Window | null): void => { try { popup?.close(); } catch { /* already closed */ } };
const populatePopup = (popup: Window, html: string): void => {
  popup.opener = null;
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
};

/** The generated document and request trail must be retained before asking the browser to print.
 * A dialog request is not evidence of paper: afterprint also fires when someone cancels. */
const sendCapturedDocument = async (popup: Window | null, request: BrowserPrintRequest, cached: CachedDocument): Promise<BrowserPrintResult> => {
  if (!cached.html) { closePopup(popup); return { status: 'blocked', message: 'The print copy is unavailable. Try again.' }; }
  if (!cached.retained) {
    const saved = await savePrintArtifact({
      key: request.idempotencyKey, sector: request.capture.sector, title: request.title, paper: request.paper,
      html: cached.html, createdAt: request.capture.createdAt, createdBy: request.capture.createdBy, jobIds: request.capture.jobIds,
    });
    if (!saved.ok) { closePopup(popup); return { status: 'blocked', message: saved.message }; }
    cached.retained = true;
  }
  if (!popup) return { status: 'blocked', message: 'The print window was blocked. Allow pop-ups and try again.' };
  try {
    populatePopup(popup, cached.html);
    await waitForPrintAssets(popup);
    if (popup.closed) return { status: 'blocked', message: 'The print window was closed. Try again.' };
    if (!markPrintRunRequested(request.capture.jobIds)) {
      closePopup(popup);
      return { status: 'blocked', message: 'Saving the print request stalled. Try again.' };
    }
    // Set before invoking the browser UI, so a repeat click or reload cannot infer a second run.
    cached.submitted = true;
    if (isPostHogConfigured) {
      posthog.capture('print_requested', {
        paper_size: request.paper,
        job_count: request.capture.jobIds.length,
        has_template: Boolean(request.capture.templateId),
      });
    }
    feedback(request, { status: 'dialog-requested' });
    popup.focus();
    popup.print();
    return { status: 'dialog-requested' };
  } catch {
    // Once print was invoked there is no safe browser receipt or automatic retry.
    if (cached.submitted) return { status: 'dialog-requested' };
    closePopup(popup);
    return { status: 'blocked', message: 'Loading the print copy stalled. Try again.' };
  }
};

/** Open the window synchronously from the click. A submitted key never invokes print twice. */
export function requestDocumentPrint(request: BrowserPrintRequest): Promise<BrowserPrintResult> {
  const cached = cachedDocuments.get(request.idempotencyKey) ?? {};
  cachedDocuments.set(request.idempotencyKey, cached);
  if (cached.active) return cached.active;
  if (cached.submitted) return Promise.resolve({ status: 'dialog-requested' });
  if (activeKey && activeKey !== request.idempotencyKey) return Promise.resolve({ status: 'blocked', message: 'Another print is being prepared. Try again when it is ready.' });
  if (!renderThroughHost && !cached.html) return Promise.resolve({ status: 'host-unavailable', message: 'Print is still getting ready. Open the document again.' });
  const popup = window.open('', '_blank');
  let finish!: (result: BrowserPrintResult) => void;
  const active = new Promise<BrowserPrintResult>((resolve) => { finish = resolve; });
  cached.active = active; activeKey = request.idempotencyKey;
  const complete = (result: BrowserPrintResult) => {
    cached.active = undefined;
    if (activeKey === request.idempotencyKey) activeKey = null;
    finish(result);
  };
  if (cached.html) void sendCapturedDocument(popup, request, cached).then(complete);
  else renderThroughHost!({ request, popup, finish: complete });
  return active;
}
const requestAttempt = async (attempt: SourceAttempt): Promise<PrintSourceRunResult> => {
  const cache = cachedDocuments.get(attempt.request.idempotencyKey);
  if (attempt.recovery && !cache?.html && !cache?.active) return recoverSourceAttempt(attempt.recovery.input, attempt.recovery.jobs);
  feedback(attempt.request, { status: 'preparing' });
  const result = await requestDocumentPrint(attempt.request);
  feedback(attempt.request, result);
  return { ...result, jobIds: attempt.jobIds };
};

/** A retained run survives a reload. Open a retry window in the original user gesture, then
 * load its exact artifact; never rebuild that run from current customer, price or branding facts. */
function recoverSourceAttempt(input: RecoveryInput, jobs: PrintJob[]): Promise<PrintSourceRunResult> {
  const first = jobs[0];
  const request: BrowserPrintRequest = {
    idempotencyKey: input.idempotencyKey, title: input.title, paper: first.paper, document: null,
    capture: { sector: first.sector, jobIds: jobs.map((job) => job.id), createdAt: first.requestedAt, createdBy: first.requestedBy },
  };
  const attempt: SourceAttempt = { request, jobIds: request.capture.jobIds, recovery: { input, jobs } };
  sourceAttempts.set(input.idempotencyKey, attempt);
  const cached: CachedDocument = {};
  cachedDocuments.set(input.idempotencyKey, cached);
  // Any submitted part is enough to forbid a blind replay. The operator can inspect Activity or
  // deliberately Print again; closing or cancelling a native dialog supplies no finer receipt.
  const submitted = jobs.some((job) => job.state !== 'waiting');
  const popup = submitted ? null : window.open('', '_blank');
  activeKey = input.idempotencyKey;
  feedback(request, { status: 'preparing' });
  const active: Promise<BrowserPrintResult> = (async () => {
    const artifact = await loadPrintArtifact(input.idempotencyKey, first.sector);
    if (!artifact || artifact.jobIds.length !== jobs.length || !jobs.every((job) => artifact.jobIds.includes(job.id))) {
      closePopup(popup);
      return { status: 'blocked', message: 'The saved copy is unavailable. Use Print again to create a new copy.' };
    }
    request.title = artifact.title;
    request.paper = artifact.paper;
    request.capture.createdAt = artifact.createdAt;
    request.capture.createdBy = artifact.createdBy;
    cached.html = artifact.html;
    cached.retained = true;
    if (submitted) { cached.submitted = true; return { status: 'dialog-requested' }; }
    return sendCapturedDocument(popup, request, cached);
  })();
  cached.active = active;
  return active.then((result) => {
    cached.active = undefined;
    if (activeKey === input.idempotencyKey) activeKey = null;
    feedback(request, result);
    return { ...result, jobIds: attempt.jobIds };
  });
}

/** Freeze commercial facts, settings, actor and copies before any async work. */
export async function printSourceRun(input: PrintSourceRunInput): Promise<PrintSourceRunResult> {
  const existing = sourceAttempts.get(input.idempotencyKey);
  if (existing) return requestAttempt(existing);
  const noAttempt = (result: BrowserPrintResult): PrintSourceRunResult => {
    window.dispatchEvent(new CustomEvent<PrintFeedback>(PRINT_FEEDBACK_EVENT, { detail: {
      key: input.idempotencyKey, sector: input.cast.sector, title: input.title, jobIds: [], ...result,
    } }));
    return { ...result, jobIds: [] };
  };
  if (!isDocumentPrintReady()) return noAttempt({ status: 'host-unavailable', message: 'Print is still getting ready. Open the document again.' });
  if (isDocumentPrintBusy()) return noAttempt({ status: 'blocked', message: 'Another print is being prepared. Try again when it is ready.' });
  let attempt: SourceAttempt | undefined;
  try {
    /* E200 · the paper is the TEMPLATE's, and a template offers A4 and A5 alone, so a house-wide
       preference stored before this release can no longer stop a template from printing. */
    const sales = frozen(input.sales);
    if (sales.some((sale) => sale.archived)) return noAttempt({ status: 'blocked', message: 'A new print run takes live orders only.' });
    const savedRun = printJobsForRun(input.cast.sector, input.idempotencyKey);
    if (savedRun.length) return recoverSourceAttempt(input, savedRun);
    const config = frozen(loadConfig());
    const createdAt = new Date().toISOString();
    const createdBy = config.owner.name || 'You';
    const orders = (input.makeOrders ? input.makeOrders(sales) : input.orders ?? []).map((order) => ({
      ...order, runKey: input.idempotencyKey, reprintOf: latestPrintJobForSubject(input.cast.sector, order.subject)?.id, copies: input.copies ?? order.copies ?? printSetupNow().copies,
      sector: input.cast.sector, requestedBy: createdBy, requestedAt: createdAt,
    }));
    if (!orders.length) return noAttempt({ status: 'blocked', message: 'Select at least one document.' });
    const cast = frozen(input.cast), derived = frozen(input.derived);
    /* The template's own layout, frozen. A run that names no template prints the shipped values —
       the house-wide profile key it used to read retired with E200 (`print-layout.ts`). */
    const layoutProfile = frozen(input.layoutProfile ?? PRINT_LAYOUT_DEFAULTS);
    const jobIds = enqueueAll(orders);
    if (!jobIds.length) return noAttempt({ status: 'blocked', message: 'Saving the print request stalled. Try again.' });
    const request: BrowserPrintRequest = {
      idempotencyKey: input.idempotencyKey, title: input.title, paper: orders[0].paper,
      document: <SourcePaperDocument cast={cast} derived={derived} config={config} sales={sales} orders={orders} layoutProfile={layoutProfile} />,
      capture: { sector: input.cast.sector, jobIds, createdAt, createdBy, templateId: input.template?.id, templateRevision: input.template?.revision },
    };
    attempt = { request, jobIds };
    sourceAttempts.set(input.idempotencyKey, attempt);
    return await requestAttempt(attempt);
  } catch {
    const result: BrowserPrintResult = { status: 'blocked', message: 'Preparing the print copy stalled. Try again.' };
    if (attempt) { feedback(attempt.request, result); return { ...result, jobIds: attempt.jobIds }; }
    return noAttempt(result);
  }
}

/** A retry continues a retained failed request. A new print must use a new key. */
export async function retrySourcePrint(key: string, sector?: string): Promise<PrintSourceRunResult> {
  if (activeKey && activeKey !== key) return { status: 'blocked', message: 'Another print is being prepared. Try again when it is ready.', jobIds: [] };
  const attempt = sourceAttempts.get(key);
  if (attempt) {
    if (sector && attempt.request.capture.sector !== sector) return { status: 'blocked', message: 'Open the matching workspace to retry this print.', jobIds: [] };
    return requestAttempt(attempt);
  }
  const jobs = sector ? printJobsForRun(sector, key) : [];
  if (!jobs.length) return { status: 'blocked', message: 'The saved print request is unavailable. Use Print again to create a new copy.', jobIds: [] };
  return recoverSourceAttempt({ idempotencyKey: key, title: jobs[0].what }, jobs);
}

/** Opens the exact generated copy; never reconstructs history from the current order. */
export async function openCapturedPrintCopy(jobId: string, sector: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const popup = window.open('', '_blank');
  if (!popup) return { ok: false, message: 'The copy window was blocked. Allow pop-ups and try again.' };
  popup.opener = null;
  const artifact = await findPrintArtifactByJob(jobId, sector);
  if (!artifact) { closePopup(popup); return { ok: false, message: 'This copy is unavailable in this browser.' }; }
  try { populatePopup(popup, artifact.html); popup.focus(); return { ok: true }; }
  catch { closePopup(popup); return { ok: false, message: 'Opening the print copy stalled.' }; }
}

export function SourcePaperDocument({ cast, derived, config, sales, orders, layoutProfile = PRINT_LAYOUT_DEFAULTS }: { cast: Cast; derived: Derived; config: AppConfig; sales: Sale[]; orders: PrintOrder[]; layoutProfile?: PrintLayoutProfile }) {
  const copies = orders.flatMap((order) => Array.from({ length: order.copies ?? 1 }, () => order));
  return <div>{copies.map((order, index) => <section key={index} style={{ breakAfter: index === copies.length - 1 ? undefined : 'page' }}>
    <PrintView cast={cast} derived={derived} sourceConfig={config} layoutProfile={layoutProfile} subject={order.subject} sales={sales} chrome="print" onClose={() => undefined} paper={order.paper === 'A5' ? 'a5' : 'a4'} stageWidth={order.paper === 'A5' ? 559 : 794} height={order.paper === 'A5' ? 794 : 1123} />
  </section>)}</div>;
}

/** One renderer under the application's providers, plus the shared activity surface. */
export function BrowserPrintHost() {
  const frame = React.useRef<HTMLDivElement>(null);
  const pendingRef = React.useRef<Pending | null>(null);
  const [pending, setPending] = React.useState<Pending | null>(null);
  React.useEffect(() => {
    renderThroughHost = (next) => { pendingRef.current = next; setPending(next); };
    return () => {
      renderThroughHost = null;
      if (pendingRef.current) {
        closePopup(pendingRef.current.popup);
        pendingRef.current.finish({ status: 'host-unavailable', message: 'The screen closed before the print copy was prepared. Try again.' });
        pendingRef.current = null;
      }
    };
  }, []);
  React.useLayoutEffect(() => {
    if (!pending || !frame.current) return;
    const cached = cachedDocuments.get(pending.request.idempotencyKey);
    if (!cached) return;
    if (!cached.html) cached.html = completeHtml(pending.request, frame.current.innerHTML);
    pendingRef.current = null;
    void sendCapturedDocument(pending.popup, pending.request, cached).then(pending.finish);
    setPending(null);
  }, [pending]);
  return <>
    <div aria-hidden="true" style={{ position: 'fixed', left: '-100000px', top: 0, width: '794px', pointerEvents: 'none' }}><div ref={frame}>{pending?.request.document}</div></div>
    <PrintActivityHost />
  </>;
}
