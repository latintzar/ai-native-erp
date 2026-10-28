/* THE LAYOUT MANIFEST — WHERE THE PRINT PUT EVERYTHING (FEED-IA §199.1 · E196.11)
 *
 * ═══ WHY A MANIFEST EXISTS AT ALL ═══════════════════════════════════════════════════════════
 * Peter, 2026-09-04 evening, verbatim: «if they're printing out a document and then they handwrite
 * on it, and then they take a half-assed photo at a wrong angle with bad lighting, we need to
 * automate it perfectly to the actual data that they handwrote… One QR code isn't going to have a
 * single order on the paper. There are multiple orders on the same paper, so how do you make sure
 * that we actually match them together? That's why one is knowing the format that we ended up
 * printing… in that part of the paper, there would be something about this project, and in that
 * part of the paper, something about that project.»
 *
 * THE-QR-SPEC QR-06 already says the house remembers WHAT it put on the paper. This says the house
 * also remembers WHERE. One record per printed run, in millimetres from each page's own top-left:
 * the mark, the three corner marks, every order block, every line row and the cells on it. A photo
 * is registered onto that geometry (marks → homography → rectified page), each cell is cropped
 * where the manifest says it stands, and a reading lands on the exact line id. The reader is never
 * asked which order a number belongs to — position answers that, and position is this file's job.
 *
 * ═══ WHY IT IS MEASURED AND NOT COMPUTED ════════════════════════════════════════════════════
 * `el papel` PAGINATES by arithmetic (constants.ts) and that is right: a page count must be stable
 * and testable without a browser. But WHERE A CELL LANDS is the browser's answer — grid tracks,
 * wrapping names, the sub-line, a long customer's two lines. A manifest computed from constants
 * would be a second, quieter layout engine that drifts from the printed page the first time type
 * wraps, and the whole point is that the crop lands on the ink. So the geometry is read off the
 * rendered print DOM at the moment the mark is issued, in the same commit that draws the paper.
 *
 * ═══ THE UNITS, AND WHY THE SCALE CANCELS ═══════════════════════════════════════════════════
 * The sheet is drawn at LIFE SIZE and transformed into its frame (`styled-components.ts`), so a
 * preview at 60% and the print host at 100% hold the same layout at different scales. Every
 * measurement here is taken as a FRACTION of the sheet's own rendered box and multiplied by the
 * paper's real millimetres — 210 × 297 on A4, 148 × 210 on A5 — so the manifest a preview records
 * and the manifest the print host records are the same numbers. That equality is asserted by
 * `drive-196-paper-manifest.py`, and it is what lets the manifest be recorded once, wherever the
 * mark is drawn.
 */
import { runtime } from './runtime-client';

/** The two papers the trade prints packing lists on, in their own millimetres. */
export type PaperFormatId = 'A4' | 'A5';
export const PAGE_MM: Record<PaperFormatId, { w: number; h: number }> = {
  A4: { w: 210, h: 297 },
  A5: { w: 148, h: 210 },
};

/** A rectangle on the page, in millimetres from the page's top-left. */
export type ManifestBox = { x: number; y: number; w: number; h: number };
/** A square mark on the page: its top-left corner and its side, in millimetres. */
export type ManifestMark = { x: number; y: number; size: number };
export type CornerId = 'tl' | 'tr' | 'bl' | 'br';
export type ManifestCorner = ManifestMark & { id: CornerId };

/* ── THE CORNER MARKS (THE-QR-SPEC QR-07) ─────────────────────────────────────────────────────
 * Solid squares of the sheet's own ink, 6 mm on a side, 5 mm in from the paper's edges, at the
 * three corners the QR does not hold. The QR sits where QR-03 puts it — the top right of the
 * packing masthead — so the marks take the other three: top left, bottom left, bottom right.
 * Four points spread across a page is what conditions a homography for a photograph taken at a
 * wrong angle, and how far apart they stand is the whole of it. Measured: `tl · bl · br` plus the
 * mark enclose 77.7 % of an A4 with their closest pair 160.5 mm apart; moving the third square to
 * `tr` bunches two of them along the top edge — 49.4 % and 36.4 mm — and leaves the sheet's left
 * edge carrying no point at all. The mark's own clear paper ALLOWS that corner (a `tr` square
 * stands 23.2 mm from the symbol's edge, past the mark-width QR-10.4 measured); the spread is what
 * rules it out. `drive-196-paper-manifest.py` measures both arrangements every run. */
export const REGISTRATION = {
  sizeMm: 6,
  insetMm: 5,
  corners: ['tl', 'bl', 'br'] as const,
};

/** The cells a hand may write in or a reader may crop, by name. A cell the paper does not carry
 *  is ABSENT rather than invented: a rectangle where there is no cell would have a reader cropping
 *  blank paper and answering about it. */
export type ManifestCells = { qty?: ManifestBox; unit?: ManifestBox; finalWeight?: ManifestBox };
export type ManifestRow = {
  line: string;
  /** the goods as PRINTED, so a reading can be asked for in the paper's own words */
  product: string;
  printed: { qty: string; unit: string };
  cells: ManifestCells;
};
/** One order's block on one page. An order whose lines run over a page break has a block on each
 *  page it appears on, each carrying the same identity and only that page's rows. */
export type ManifestBlock = { sale: string; number: string; customer: string; rows: ManifestRow[] };
/** `index` is the page's position in the run, from 0. The folio on the paper prints `index + 1`. */
export type ManifestPage = { index: number; blocks: ManifestBlock[] };

export type PaperManifest = {
  version: 1;
  locator: string;
  token: string;
  day: string;
  paper: PaperFormatId;
  pageMm: { w: number; h: number };
  marks: { qr: ManifestMark; corners: ManifestCorner[] };
  pages: ManifestPage[];
};

/* ── THE TWO COPIES, AND WHY THEY ARE NOT THE SAME RECORD (§191.1 · QR-11) ────────────────────
 * The manifest the RUNTIME keeps carries the paper's own words — the customer, the order number,
 * the goods, the printed amount — because that is what a handwriting reader is given as context:
 * «the final-weight cell of line "Merluza · 12 kg"». The runtime is the house's own server, behind
 * the house's own door, and THE-RUNTIME-SPEC says how long it keeps it.
 *
 * The copy this BROWSER keeps is a different thing. §191.1 fixes what may stand in `localStorage`
 * beside a mark: an opaque locator, a day, document ids. A laptop in a bay is shared, borrowed and
 * left logged in, so the register holds GEOMETRY AND IDS — where every cell landed, and which sale
 * and which line it belongs to — and no word a person could read off it. The kit already holds the
 * orders themselves in the session that drew them, so it can say «Merluza» whenever it has the
 * right to; it simply never writes it down here. */
export type OpaqueManifestRow = { line: string; cells: ManifestCells };
export type OpaqueManifestBlock = { sale: string; rows: OpaqueManifestRow[] };
export type OpaqueManifestPage = { index: number; blocks: OpaqueManifestBlock[] };
export type OpaquePaperManifest = Omit<PaperManifest, 'pages'> & { pages: OpaqueManifestPage[] };

/** The register's copy: the same geometry, with every printed word left out. Key order is fixed
 *  here so two copies of one layout compare as the same string after a round trip through JSON. */
export const opaquePaperManifest = (manifest: PaperManifest): OpaquePaperManifest => ({
  version: manifest.version,
  locator: manifest.locator,
  token: manifest.token,
  day: manifest.day,
  paper: manifest.paper,
  pageMm: { w: manifest.pageMm.w, h: manifest.pageMm.h },
  marks: manifest.marks,
  pages: manifest.pages.map((page) => ({
    index: page.index,
    blocks: page.blocks.map((block) => ({
      sale: block.sale,
      rows: block.rows.map((row) => ({ line: row.line, cells: row.cells })),
    })),
  })),
});

/** A layout a PREVIOUS build stored carried the paper's words in it. Reading such a record back
 *  drops it whole — the next drawing of that paper measures a fresh, opaque one — so a device that
 *  ran that build does not go on holding words §191.1 says may not stand in a browser's storage.
 *  It answers about a record ALREADY IN STORAGE; what a caller hands `rememberPackingMark` is
 *  written as it is given, which is what keeps the promise falsifiable. */
export const layoutWithoutWords = (layout: OpaquePaperManifest | undefined): OpaquePaperManifest | undefined => {
  if (!layout) return undefined;
  const words = (layout.pages ?? []).some((page) => (page.blocks ?? []).some((block) =>
    'number' in block || 'customer' in block
    || (block.rows ?? []).some((row) => 'product' in row || 'printed' in row)));
  return words ? undefined : layout;
};

/** WHAT WAS DRAWN, AS ONE STRING. A token names a set of documents; it does not name a LAYOUT —
 *  the same orders printed on A5 are the same token over a different sheet. So the register and
 *  the journal both compare this: a short fold of the whole record, so «is this the paper we
 *  already recorded?» is a question about what was drawn rather than about which paper it was. */
export const manifestPrint = (manifest: PaperManifest | OpaquePaperManifest): string => {
  const source = JSON.stringify(manifest);
  let a = 0xdeadbeef ^ source.length;
  let b = 0x41c6ce57 ^ source.length;
  for (let i = 0; i < source.length; i += 1) {
    const code = source.charCodeAt(i);
    a = Math.imul(a ^ code, 2654435761);
    b = Math.imul(b ^ code, 1597334677);
  }
  a = Math.imul(a ^ (a >>> 16), 2246822507) ^ Math.imul(b ^ (b >>> 13), 3266489909);
  b = Math.imul(b ^ (b >>> 16), 2246822507) ^ Math.imul(a ^ (a >>> 13), 3266489909);
  return (4294967296 * (2097151 & b) + (a >>> 0)).toString(36);
};

/* ── WHAT THE DOM IS ASKED ────────────────────────────────────────────────────────────────────
 * The print DOM states its own geometry through five attributes, so this file reads the paper
 * rather than re-deriving it. They are written in `print-view.tsx` (the rows and the marks) and
 * `rocoto/paper/paper.tsx` (the sheet), and every one of them is inert ink-free markup. */
export const PAPER_ATTR = {
  sheet: 'data-paper-sheet',
  mark: 'data-paper-mark',
  order: 'data-paper-order',
  name: 'data-paper-name',
  cell: 'data-paper-cell',
} as const;

const mm = (value: number): number => Math.round(value * 100) / 100;
const isCell = (value: string | null): value is keyof ManifestCells =>
  value === 'qty' || value === 'unit' || value === 'finalWeight';
const isCorner = (value: string | null): value is CornerId =>
  value === 'tl' || value === 'tr' || value === 'bl' || value === 'br';

/** Read the layout off the rendered print DOM, starting from the mark the paper carries.
 *
 *  Answers `undefined` rather than a half-manifest: no sheet, no mark, an unmeasurable box or a
 *  page with no rows on it all mean the paper is not standing yet, and a manifest that described a
 *  page that was never drawn would send a reader cropping at coordinates nothing was printed at. */
export function measurePackingManifest(
  mark: Element | null | undefined,
  at: { locator: string; token: string; day: string; paper: PaperFormatId },
): PaperManifest | undefined {
  if (!mark || typeof document === 'undefined') return undefined;
  const root = mark.closest('[data-baseweb="paper"]');
  if (!root) return undefined;
  const sheets = Array.from(root.querySelectorAll<HTMLElement>(`[${PAPER_ATTR.sheet}]`));
  if (!sheets.length) return undefined;
  const page = PAGE_MM[at.paper];

  /* THE IDENTITY OF EVERY ORDER IN THE RUN, read once from the whole document — because an
     order's own head prints on the page its first line landed on, and its later lines can be on
     the next one. A block on page two names the same order as the block on page one. */
  const identity = new Map<string, { number: string; customer: string }>();
  for (const head of Array.from(root.querySelectorAll<HTMLElement>(`[${PAPER_ATTR.order}]`))) {
    const sale = head.getAttribute('data-sale');
    if (!sale || identity.has(sale)) continue;
    identity.set(sale, {
      number: head.getAttribute('data-number') ?? '',
      customer: head.getAttribute('data-customer') ?? '',
    });
  }

  const pages: ManifestPage[] = [];
  let qr: ManifestMark | undefined;
  let corners: ManifestCorner[] = [];

  for (let index = 0; index < sheets.length; index += 1) {
    const sheet = sheets[index];
    const paper = sheet.getBoundingClientRect();
    if (!(paper.width > 0) || !(paper.height > 0)) return undefined;
    /* THE ONLY CONVERSION IN THIS FILE. Everything is a fraction of the sheet's own rendered box,
       so the preview's scale and the print host's life size give the same millimetres. */
    const kx = page.w / paper.width;
    const ky = page.h / paper.height;
    const box = (element: Element): ManifestBox => {
      const rect = element.getBoundingClientRect();
      return {
        x: mm((rect.left - paper.left) * kx),
        y: mm((rect.top - paper.top) * ky),
        w: mm(rect.width * kx),
        h: mm(rect.height * ky),
      };
    };

    /* THE MARKS. The corner marks are printed on every page and stand at the same three places on
       all of them, so the run records one set; the QR is the masthead's and is on page one. */
    if (index === 0) {
      const symbol = sheet.querySelector('[data-testid="packing-document-qr"] svg');
      if (!symbol) return undefined;
      const drawn = box(symbol);
      qr = { x: drawn.x, y: drawn.y, size: mm((drawn.w + drawn.h) / 2) };
      for (const square of Array.from(sheet.querySelectorAll(`[${PAPER_ATTR.mark}]`))) {
        const id = square.getAttribute(PAPER_ATTR.mark);
        if (!isCorner(id)) continue;
        const drawnMark = box(square);
        corners.push({ id, x: drawnMark.x, y: drawnMark.y, size: mm((drawnMark.w + drawnMark.h) / 2) });
      }
      corners = corners.sort((a, b) => a.id.localeCompare(b.id));
      if (!corners.length) return undefined;
    }

    /* THE GOODS AS PRINTED, so a crop can be asked for in the paper's own words: «the final-weight
       cell of line "Merluza"». Read per page, because that is where the row actually stands. */
    const printedNames = new Map<string, string>();
    for (const named of Array.from(sheet.querySelectorAll<HTMLElement>(`[${PAPER_ATTR.name}]`))) {
      const key = `${named.getAttribute('data-sale') ?? ''}␞${named.getAttribute('data-line') ?? ''}`;
      if (!printedNames.has(key)) printedNames.set(key, (named.textContent ?? '').replace(/\s+/g, ' ').trim());
    }

    const order: string[] = [];
    const blocks = new Map<string, ManifestBlock>();
    const rows = new Map<string, ManifestRow>();
    for (const cell of Array.from(sheet.querySelectorAll<HTMLElement>(`[${PAPER_ATTR.cell}]`))) {
      const which = cell.getAttribute(PAPER_ATTR.cell);
      const sale = cell.getAttribute('data-sale');
      const line = cell.getAttribute('data-line');
      if (!isCell(which) || !sale || !line) continue;
      let block = blocks.get(sale);
      if (!block) {
        const named = identity.get(sale) ?? { number: '', customer: '' };
        block = { sale, number: named.number, customer: named.customer, rows: [] };
        blocks.set(sale, block);
        order.push(sale);
      }
      const key = `${sale}␞${line}`;
      let row = rows.get(key);
      if (!row) {
        row = { line, product: printedNames.get(key) ?? '', printed: { qty: '', unit: '' }, cells: {} };
        rows.set(key, row);
        block.rows.push(row);
      }
      row.cells[which] = box(cell);
      if (which === 'qty') row.printed.qty = cell.getAttribute('data-value') ?? (cell.textContent ?? '').trim();
      if (which === 'unit') row.printed.unit = cell.getAttribute('data-value') ?? (cell.textContent ?? '').trim();
    }
    pages.push({ index, blocks: order.map((sale) => blocks.get(sale) as ManifestBlock) });
  }

  if (!qr) return undefined;
  /* ⚠ A ROW WITH NO FINAL-WEIGHT BOX IS NOT READABLE PAPER, so it is never RECORDED as if it were
     (settled at RELEASE-195; THE-PAPER-SPEC PAP-02). The final-weight rectangle is the whole reason
     a photograph of this sheet is worth taking — it is the box printed empty for somebody to fill
     in — and `backend/app/paper.py`'s `Cells` types it as required for exactly that reason. The two
     halves were written independently and disagreed: the kit typed it optional, so a sheet whose
     template prints no final-weight column would have posted rows the runtime refuses, and the
     WHOLE manifest would 422 — the sheet in the person's hand silently unreadable, on a page nobody
     was told about. Dropping such a row keeps the rest of the sheet readable and says the same
     thing on both sides; a page left holding no rows at all records no manifest, which the line
     below already handles. */
  for (const entry of pages) {
    for (const block of entry.blocks) block.rows = block.rows.filter((row) => row.cells.finalWeight);
    entry.blocks = entry.blocks.filter((block) => block.rows.length);
  }
  if (!pages.some((entry) => entry.blocks.some((block) => block.rows.length))) return undefined;
  return {
    version: 1,
    locator: at.locator,
    token: at.token,
    day: at.day,
    paper: at.paper,
    pageMm: { w: page.w, h: page.h },
    marks: { qr, corners },
    pages,
  };
}

/* ── THE PASSAGE TO THE RUNTIME, AND THE POSTURE WHEN THERE IS NONE ───────────────────────────
 * The runtime stores manifests by token (THE-RUNTIME-SPEC), and a photo is read against the one
 * the paper names. A kit with no runtime in front of it still PRINTS, so the manifest lands in the
 * mark's own record either way and the journal states where the copy stands. Both sentences say
 * what IS: the runtime holds it, or this device holds it and will offer it again on the next
 * print. Nothing here is an error state, because nothing here failed the person holding the paper.
 */
export type ManifestPassage = 'sent' | 'held';
/** `print` is `manifestPrint` of the record that was OFFERED — the full one, the runtime's copy.
 *  It is what makes the journal a statement about a LAYOUT rather than about a token: the same
 *  orders re-drawn on a different sheet are the same token and a different paper, and the runtime
 *  is owed the new one. */
export type ManifestJournalEntry = { token: string; print: string; at: string; state: ManifestPassage; said: string };
export const MANIFEST_JOURNAL_KEY = 'rocoto-paper-manifest-journal-v1';
const JOURNAL_CEILING = 200;
export const MANIFEST_SAID: Record<ManifestPassage, string> = {
  sent: 'The runtime holds the layout of this paper.',
  held: 'This device holds the layout of this paper, ready for the runtime.',
};

const storage = (): Pick<Storage, 'getItem' | 'setItem'> | null =>
  typeof window === 'undefined' ? null : window.localStorage;

export const manifestJournal = (): ManifestJournalEntry[] => {
  try {
    const parsed = JSON.parse(storage()?.getItem(MANIFEST_JOURNAL_KEY) ?? 'null');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((row): row is ManifestJournalEntry => Boolean(row)
      && typeof row.token === 'string' && typeof row.print === 'string' && typeof row.at === 'string'
      && (row.state === 'sent' || row.state === 'held') && typeof row.said === 'string');
  } catch { return []; }
};

const journal = (token: string, print: string, state: ManifestPassage): void => {
  try {
    const rows = manifestJournal().filter((row) => row.token !== token);
    const next = [{ token, print, at: new Date().toISOString(), state, said: MANIFEST_SAID[state] }, ...rows]
      .slice(0, JOURNAL_CEILING);
    storage()?.setItem(MANIFEST_JOURNAL_KEY, JSON.stringify(next));
  } catch { /* a journal that cannot be written costs the sentence, never the manifest */ }
};

/** Offer a manifest to the runtime, once per LAYOUT while that layout stands sent.
 *
 *  ⚠ ONCE PER LAYOUT, NEVER ONCE PER TOKEN. The token names a set of documents, and the same set
 *  prints on A4 in the morning and on A5 in the afternoon — same token, different sheet, different
 *  millimetres. A journal keyed on the token alone would have left the runtime holding a one-page
 *  210 × 297 record for a two-page 148 × 210 paper, and every crop taken against it would land on
 *  blank sheet. So the offer is made whenever what was DRAWN differs from what was sent.
 *
 *  A run whose copy is held is offered again the next time the same paper is drawn, which is the
 *  retry a warehouse actually performs: it prints the sheet again. */
export async function sendPackingManifest(manifest: PaperManifest): Promise<ManifestPassage> {
  const print = manifestPrint(manifest);
  const standing = manifestJournal().find((row) => row.token === manifest.token);
  if (standing?.state === 'sent' && standing.print === print) return 'sent';
  try {
    await runtime.paper.manifest(manifest);
    journal(manifest.token, print, 'sent');
    return 'sent';
  } catch {
    /* A runtime that is not there is a POSTURE, and an answer that came back wrong is one too:
       the paper is printed, the layout is kept, and the next print offers it again. */
    journal(manifest.token, print, 'held');
    return 'held';
  }
}
