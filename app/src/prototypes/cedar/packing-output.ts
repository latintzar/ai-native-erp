/** Packing output is independent of warehouse preparation and delivery-note price snapshots.
 * It records an operator-confirmed packing copy, never a browser print callback or physical proof. */
import type { Sale } from './sale';
import type { SectorId } from '../../scenarios/meta';
import { layoutWithoutWords, type OpaquePaperManifest } from './paper-manifest';

export const PACKING_OUTPUT_KEY = 'rocoto-packing-output-v1';
export const PACKING_OUTPUT_VERSION = 2;
export type PackingCapture = { sector: SectorId; day: string; sale: string; revision: string };
export type PackingConfirmation = { requestedAt: string; requestedBy: string; confirmedAt: string; confirmedBy: string; attemptId: string };
export type PackingOutput = PackingCapture & PackingConfirmation & { evidence: 'operator-confirmed' };
export type PackingHistory = { records: Record<string, PackingOutput>; persistenceError: boolean };
type StoragePort = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const packingOutputKey = (scope: Pick<PackingCapture, 'sector' | 'day' | 'sale'>): string =>
  JSON.stringify([scope.sector, scope.day, scope.sale]);

export const isPackingCapture = (value: unknown): value is PackingCapture => {
  if (!value || typeof value !== 'object') return false;
  const capture = value as Record<string, unknown>;
  return typeof capture.sector === 'string' && ['fish', 'meat', 'fruit'].includes(capture.sector)
    && typeof capture.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(capture.day)
    && typeof capture.sale === 'string' && capture.sale.length > 0
    && typeof capture.revision === 'string' && capture.revision.length > 0;
};

const isConfirmation = (value: unknown): value is PackingConfirmation => {
  if (!value || typeof value !== 'object') return false;
  const confirmation = value as Record<string, unknown>;
  return typeof confirmation.requestedAt === 'string' && Number.isFinite(Date.parse(confirmation.requestedAt))
    && typeof confirmation.requestedBy === 'string' && confirmation.requestedBy.length > 0
    && typeof confirmation.confirmedAt === 'string' && Number.isFinite(Date.parse(confirmation.confirmedAt))
    && typeof confirmation.confirmedBy === 'string' && confirmation.confirmedBy.length > 0
    && typeof confirmation.attemptId === 'string' && confirmation.attemptId.length > 0;
};

/** Keep the exact content rather than a short collision-prone hash. Workflow ticks and the
 * delivery-note price snapshot are not packing content. Goods, allocations and instructions are. */
export const packingRevisionOf = (sale: Sale): string => JSON.stringify({
  template: 'packing-v1',
  id: sale.id, number: sale.number, day: sale.day, deliveryDay: sale.deliveryDay, at: sale.at,
  customer: {
    id: sale.customer.id, name: sale.customer.name, provisional: sale.customer.provisional,
    truck: sale.customer.truck, zone: sale.customer.zone, slot: sale.customer.slot ?? sale.window,
  },
  lines: sale.lines.map(({ price: _price, tierPriced: _tier, pinnedPrice: _pin, filledBy: _source,
    usual: _usual, ...goods }) => goods),
}, (_key, value) => value && typeof value === 'object' && !Array.isArray(value)
  ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) : value);

/* ═══ THE PACKING MARK'S OWN SPEC (FEED-IA §196.5 — E193.05) ══════════════════════════════
 * Peter: «the qr code generation and reading is a spec in its own, but i expect us to handle it
 * all alongside everything else.» THE-QR-SPEC.md is that spec; these are the numbers it states,
 * held HERE so the paper that draws the mark and the drive that reads it cannot disagree.
 *
 * `scheme` · the payload is an opaque, self-describing locator and nothing else (§191.1: «the QR
 *   holds no customer, product, quantity, price or lot data»). Self-describing matters: a generic
 *   scanner in a cold room shows a person something they can recognise.
 * `ecc` · «M», 15% recovery. Chosen against «Q» because the payload is 37 characters, which fits
 *   a version-3 symbol (29 modules) at M and needs a version-4 (33 modules) at Q — and the mark's
 *   printed footprint is fixed by the masthead's budget, so Q would buy recovery by spending
 *   module SIZE, which is the thing a phone camera actually needs. THE-QR-SPEC carries the
 *   arithmetic and the occlusion evidence.
 * `quietModules` · 4, the ISO/IEC 18004 minimum, drawn INSIDE the mark's own box so a tight
 *   masthead can never crop it.
 * `pagePx` · 76 CSS px at 96 dpi = 20.1 mm, so a version-3 symbol inside its quiet zone draws a
 *   0.54 mm module — above the 0.5 mm floor for laser print read by a phone. The mark may grow;
 *   it may never shrink below this.
 * `minModuleMm` · the floor that number is checked against. */
export const PACKING_QR = {
  scheme: 'rocoto:document/packing/v1/',
  ecc: 'M',
  quietModules: 4,
  pagePx: 76,
  minModuleMm: 0.5,
  pxPerMm: 96 / 25.4,
} as const;

/** A packing QR is a locator, never a copy of the document. The printable payload therefore
 * carries no customer, product, quantity, price, or lot data. Production persists an opaque,
 * unguessable token against the immutable output revision; the static Kit uses a deterministic
 * 53-bit token so the same preview keeps the same mark without pretending a server issued it. */
const locatorToken = (source: string): string => {
  let a = 0xdeadbeef ^ source.length;
  let b = 0x41c6ce57 ^ source.length;
  for (let i = 0; i < source.length; i += 1) {
    const code = source.charCodeAt(i);
    a = Math.imul(a ^ code, 2654435761);
    b = Math.imul(b ^ code, 1597334677);
  }
  a = Math.imul(a ^ (a >>> 16), 2246822507) ^ Math.imul(b ^ (b >>> 13), 3266489909);
  b = Math.imul(b ^ (b >>> 16), 2246822507) ^ Math.imul(a ^ (a >>> 13), 3266489909);
  return PACKING_QR.scheme + (4294967296 * (2097151 & b) + (a >>> 0)).toString(36);
};

export const packingDocumentLocator = (sales: Sale[]): string =>
  locatorToken(sales.map(packingRevisionOf).sort().join('\u241e'));

/* ── READING THE MARK BACK (FEED-IA §196.5 · §191.1) ────────────────────────────────────────
 * «A later paper photo may use that locator to align reviewed final weights/prices.» So the
 * locator has to be resolvable, and it has to be resolvable BY HAND as well as by a camera — a
 * phone with no barcode detector still has a person with eyes, and the short token is printed
 * under the mark for exactly that. Both roads arrive here. */

/** The part a person can read off the paper and type: the token after the scheme. */
export const packingLocatorToken = (locator: string): string =>
  locator.startsWith(PACKING_QR.scheme) ? locator.slice(PACKING_QR.scheme.length) : locator;

/** What a camera or a hand gave us, turned into a locator — or nothing, when it names no
 * document of ours. Case and surrounding space are forgiven; content is not invented. */
export const parsePackingLocator = (said: string): string | undefined => {
  const text = (said || '').trim();
  if (!text) return undefined;
  const token = (text.startsWith(PACKING_QR.scheme) ? text.slice(PACKING_QR.scheme.length) : text)
    .trim().toLowerCase();
  return /^[a-z0-9]{1,13}$/.test(token) ? PACKING_QR.scheme + token : undefined;
};

/* ── THE MARKS THIS HOUSE HAS ACTUALLY ISSUED (THE-QR-SPEC QR-06) ────────────────────────────
 * A locator is a one-way fold, so «which set of documents does this code name?» can be answered
 * two ways: by re-folding candidate sets and hoping one of them is the set the paper was printed
 * over, or by REMEMBERING what was issued. Production answers the second way — the token is
 * server-issued and bound to the immutable output revision — and so does this. The register holds
 * an opaque locator, a day, document ids and — since E196.11 — the LAYOUT the print produced, in
 * millimetres: rectangles, sale ids and line ids. No customer, no goods, no money (§191.1); the
 * words the paper printed live in the runtime's own copy of the manifest, which is what a reader
 * is given as context. `opaquePaperManifest` is the projection that keeps that promise, and
 * `drive-198-parsing-qr.py` reads this whole register back looking for a word.
 * The fold stays as the second road, for a mark this browser never drew. */
const MARK_KEY = 'rocoto-packing-marks-v1';
const MARK_CEILING = 200;
/** HOW MANY OF THOSE MARKS KEEP THEIR LAYOUT. A manifest is the biggest thing this register holds
 *  — a busy morning is tens of kilobytes of rectangles — and a browser gives one origin about five
 *  megabytes. The house needs to RECOGNISE two hundred papers and it needs to READ the ones still
 *  in circulation, so the locator ceiling stays at two hundred and the layout rides the most recent
 *  twenty. An older paper still resolves; its layout is the runtime's copy to hold. */
const MANIFEST_CEILING = 20;
/** The mark as issued, plus WHERE the print put everything (FEED-IA §199.1). Opaque about the
 *  business: a locator, a day, document ids, and geometry in millimetres. */
export type PackingMark = { locator: string; day: string; sales: string[]; at: string; manifest?: OpaquePaperManifest };

const readMarks = (): PackingMark[] => {
  try {
    const parsed = JSON.parse(browserStorage()?.getItem(MARK_KEY) ?? 'null');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((row): row is PackingMark => Boolean(row) && typeof row.locator === 'string'
      && typeof row.day === 'string' && Array.isArray(row.sales) && row.sales.every((id: unknown) => typeof id === 'string'));
  } catch { return []; }
};

/** Both records are built key by key in a fixed order — `opaquePaperManifest` for the layout, this
 *  file for the mark — so one string comparison really does answer «is this the same record?»
 *  after a round trip through `JSON.parse`. */
const sameLayout = (before: OpaquePaperManifest | undefined, after: OpaquePaperManifest | undefined): boolean =>
  JSON.stringify(before ?? null) === JSON.stringify(after ?? null);

/** Called where the mark is DRAWN, with the layout that drawing measured.
 *
 *  Idempotent on the same paper: re-previewing the sheet it already holds writes nothing. But a
 *  DIFFERENT drawing of the same documents replaces the layout — the same token prints on A4 in
 *  the morning and on A5 in the afternoon, and a register that kept the first one would hand a
 *  reader a one-page 210 × 297 record for a two-page 148 × 210 sheet. The hour the mark was issued
 *  at is kept through every re-drawing, because the mark is the same mark. */
export const rememberPackingMark = (locator: string, day: string, sales: string[], manifest?: OpaquePaperManifest): void => {
  try {
    const marks = readMarks();
    const standing = marks.find((mark) => mark.locator === locator);
    /* A drawing that measured nothing — a sheet still mounting — never erases a layout already held. */
    const layout = manifest ?? standing?.manifest;
    const kept: PackingMark = {
      locator,
      day,
      sales: [...sales].sort(),
      at: standing?.at ?? new Date().toISOString(),
      ...(layout ? { manifest: layout } : {}),
    };
    if (standing && standing.day === kept.day && sameLayout(standing.manifest, kept.manifest)
      && JSON.stringify(standing.sales) === JSON.stringify(kept.sales)) return;
    const next = [kept, ...marks.filter((mark) => mark.locator !== locator)]
      .slice(0, MARK_CEILING)
      .map((mark, index) => {
        /* `kept` is THIS drawing's own record and stands exactly as it was measured. Every other
           entry is a record already in storage: it keeps its layout while it is inside the ceiling
           and the layout is opaque, and a layout an earlier build wrote with the paper's words in
           it is dropped whole (§191.1) — the next drawing of that paper measures a fresh one. */
        if (mark === kept) return mark;
        const layout = index < MANIFEST_CEILING ? layoutWithoutWords(mark.manifest) : undefined;
        return layout
          ? { ...mark, manifest: layout }
          : { locator: mark.locator, day: mark.day, sales: mark.sales, at: mark.at };
      });
    browserStorage()?.setItem(MARK_KEY, JSON.stringify(next));
  } catch { /* a register that cannot be written costs the exact road, never the folded one */ }
};

export const packingMarks = (): PackingMark[] => readMarks();

export type PackingRun = { day: string; sales: Sale[] };
/** Which run the locator names, and whether that run still says what the paper says. A run edited
 * since it was printed resolves — the paper is still that document — and reports `current: false`,
 * because aligning weights against a changed sheet is the exact mistake this guards. */
export type PackingLocatorReading = { locator: string; day: string; sales: Sale[]; current: boolean };

export const resolvePackingLocator = (
  locator: string,
  runs: PackingRun[],
  printed?: PackingHistory,
  sector?: SectorId,
): PackingLocatorReading | undefined => {
  /* ROAD ONE · THE REGISTER. The paper was printed by this house, so the house knows what it put
     on it. The documents are looked up as they stand NOW, and `current` says whether re-folding
     them still gives the mark the paper carries — which is the whole question a scan asks. */
  const remembered = readMarks().find((mark) => mark.locator === locator);
  if (remembered) {
    const book = new Map(runs.flatMap((run) => run.sales.map((sale) => [sale.id, sale] as const)));
    const sales = remembered.sales.flatMap((id) => { const sale = book.get(id); return sale ? [sale] : []; });
    if (sales.length === remembered.sales.length) {
      return { locator, day: remembered.day, sales, current: packingDocumentLocator(sales) === locator };
    }
  }
  /* ROAD TWO · THE FOLD. A mark this browser never drew — printed on the desk, scanned on a phone
     — is still resolvable where a candidate set folds to it. */
  for (const run of runs) {
    if (run.sales.length && packingDocumentLocator(run.sales) === locator) {
      return { locator, day: run.day, sales: run.sales, current: true };
    }
  }
  /* AND A PAPER THAT NAMES WHAT WAS PRINTED BEFORE AN EDIT STILL RESOLVES — that is the whole
     point of a locator. The output history keeps each confirmed revision, so the same fold over
     THOSE revisions finds the run and says the paper is behind it. */
  if (!printed || !sector) return undefined;
  for (const run of runs) {
    if (!run.sales.length) continue;
    const revisions = run.sales.map((sale) =>
      printed.records[packingOutputKey({ sector, day: sale.day, sale: sale.id })]?.revision);
    if (revisions.some((revision) => !revision)) continue;
    if (locatorToken((revisions as string[]).sort().join('\u241e')) === locator) {
      return { locator, day: run.day, sales: run.sales, current: false };
    }
  }
  return undefined;
};

/** Capture now: an edit or house switch while the job waits must not rewrite what it contains. */
export const capturePackingOutputs = (sales: Sale[], sector: SectorId): PackingCapture[] =>
  sales.map(sale => ({ sector, day: sale.day, sale: sale.id, revision: packingRevisionOf(sale) }));

export const remainingPackingSales = (sales: Sale[], sector: SectorId, history: PackingHistory): Sale[] =>
  sales.filter(sale => history.records[packingOutputKey({ sector, day: sale.day, sale: sale.id })]?.revision !== packingRevisionOf(sale));

/** Pending output remains uncompleted, but a second Remaining press should not duplicate it. */
export const unqueuedPackingSales = (sales: Sale[], sector: SectorId, pending: PackingCapture[]): Sale[] => {
  const queued = new Set(pending.map(output => JSON.stringify([packingOutputKey(output), output.revision])));
  return sales.filter(sale => !queued.has(JSON.stringify([
    packingOutputKey({ sector, day: sale.day, sale: sale.id }), packingRevisionOf(sale),
  ])));
};

export function parsePackingHistory(raw: string | null): PackingHistory {
  const records: PackingHistory['records'] = {};
  try {
    const parsed = JSON.parse(raw ?? 'null');
    /* The old timer-produced records cannot evidence an operator confirmation, so they remain pending. */
    if (parsed?.version !== PACKING_OUTPUT_VERSION || !Array.isArray(parsed.outputs)) return { records, persistenceError: false };
    for (const value of parsed.outputs) {
      if (value?.evidence !== 'operator-confirmed' || !isPackingCapture(value) || !isConfirmation(value)) continue;
      records[packingOutputKey(value)] = { ...value, evidence: 'operator-confirmed' };
    }
  } catch { /* No trustworthy evidence means the order remains to print. */ }
  return { records, persistenceError: false };
}

const browserStorage = (): StoragePort | null => typeof window === 'undefined' ? null : window.localStorage;

/** Storage failure keeps the order remaining and surfaces an error; it never claims saved. */
export function createPackingOutputStore(storage: () => StoragePort | null = browserStorage) {
  const read = (): PackingHistory => {
    try { return parsePackingHistory(storage()?.getItem(PACKING_OUTPUT_KEY) ?? null); }
    catch { return { records: {}, persistenceError: true }; }
  };
  let state = read();
  const listeners = new Set<() => void>();
  const publish = (next: PackingHistory) => { state = next; listeners.forEach(listener => listener()); };
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    refresh: () => publish(read()),
    /** A retry with the same attempt is idempotent. An older request cannot replace a newer confirmed revision. */
    complete: (captured: PackingCapture[], confirmation: PackingConfirmation): boolean => {
      if (!captured.length) return true;
      if (!captured.every(isPackingCapture) || !isConfirmation(confirmation)) return false;
      try {
        const target = storage();
        if (!target) throw new Error('Packing history storage unavailable');
        const previous = parsePackingHistory(target.getItem(PACKING_OUTPUT_KEY));
        const records = { ...previous.records };
        for (const capture of captured) {
          const existing = records[packingOutputKey(capture)];
          if (existing?.attemptId === confirmation.attemptId && existing.revision !== capture.revision) return false;
        }
        for (const capture of captured) {
          const key = packingOutputKey(capture);
          const existing = records[key];
          if (existing?.attemptId === confirmation.attemptId) continue;
          if (existing && existing.requestedAt >= confirmation.requestedAt) continue;
          records[key] = { ...capture, ...confirmation, evidence: 'operator-confirmed' };
        }
        target.setItem(PACKING_OUTPUT_KEY, JSON.stringify({ version: PACKING_OUTPUT_VERSION, outputs: Object.values(records) }));
        publish({ records, persistenceError: false });
        return true;
      } catch {
        publish({ ...state, persistenceError: true });
        return false;
      }
    },
    reset: () => {
      try { storage()?.removeItem(PACKING_OUTPUT_KEY); publish({ records: {}, persistenceError: false }); }
      catch { publish({ ...state, persistenceError: true }); }
    },
  };
}

export const packingOutputs = createPackingOutputStore();
if (typeof window !== 'undefined') window.addEventListener('storage', event => {
  if (event.key === PACKING_OUTPUT_KEY || event.key === null) packingOutputs.refresh();
});
