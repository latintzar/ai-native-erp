/* THE KIT'S ONE PARSING SEAM (FEED-IA §196.5 — E193.05)
 *
 * Peter, 2026-09-04: «for the parsing and qr shit, not sure what youre using. i have no idea.
 * maybe we need an api. idk. maybe use parsewise so its solid cos like im not sure that for the
 * tabular data if claude ocr will be best. how do u set it to recognise standard formats and
 * stuff?»
 *
 * The answer, in three parts, and this file is the kit's half of it:
 *
 * 1 · WHAT READS A TABLE. A photographed or PDF'd albarán is a TABLE, and a table is read by a
 *     document engine with layout and citations, not by asking a chat model to look at a picture.
 *     So every image/PDF/Office source goes through Parsewise, from the runtime (E193.06), which
 *     holds the key. THE-PARSING-SPEC states the whole contract.
 * 2 · HOW IT «RECOGNISES STANDARD FORMATS». By being TOLD the format: each of the three kinds
 *     declares a JSON Schema (Draft 2020-12) of the fields it expects, and Parsewise's
 *     schema-driven extract shapes its answer to it. `PARSE_FIELDS` below is the kit's copy of
 *     that declaration, so the surface and the service name the same columns.
 * 3 · WHAT IS NEVER SENT THROUGH IT. A source that is ALREADY tabular text — a TSV paste, a CSV,
 *     a spreadsheet export — is read EXACTLY, here, by the deterministic reader that already
 *     exists. An exact reading beats a probabilistic one, always; extraction is for the sources
 *     that have no rows to read.
 *
 * A parse is a PROPOSAL. §191.1 — «A capture is not an OCR result… no field is silently
 * invented.» The rows land in a review the person walks before anything is written.
 */
import * as React from 'react';
import { RuntimeUnreachable, runtime, type ParseResult, type ParsedRow } from './runtime-client';
import { matches, termsOf, wordsOf } from './search';
import type { Product } from '../../scenarios/data/cast';

export type ParseKind = 'albaran' | 'catalogue' | 'stock';

/** THE THREE STANDARD FORMATS, as the kit names them. The runtime turns each into the JSON Schema
 *  it hands Parsewise; both halves read this list so a column can never exist on one side only.
 *  §196.5's «standard formats» are these, and nothing here is guessed at extraction time. */
export const PARSE_FIELDS: Record<ParseKind, readonly string[]> = {
  albaran: ['product', 'quantity', 'unit', 'price', 'lot'],
  catalogue: ['sku', 'name', 'unit', 'price'],
  stock: ['product', 'quantity', 'unit', 'lot', 'date'],
};

/** What each kind's capture door accepts. Images and PDFs are extracted; text tables are read. */
export const PARSE_ACCEPT = 'image/*,.pdf,.csv,.tsv,.txt,.xlsx,.xls';

const TEXT_TABLE = /^(text\/plain|text\/csv|text\/tab-separated-values)$/;
const EXTRACTABLE = /^(image\/|application\/pdf|application\/vnd\.openxmlformats|application\/vnd\.ms-)/;

/** A source whose rows are already written down is read exactly, here, and never extracted. */
export const isTextTable = (source: Blob, name = ''): boolean =>
  TEXT_TABLE.test(source.type) || /\.(csv|tsv|txt)$/i.test(name);

/** A source with no rows to read — a photo, a scan, a PDF, a spreadsheet's binary — is extracted. */
export const isExtractable = (source: Blob, name = ''): boolean =>
  !isTextTable(source, name) && (EXTRACTABLE.test(source.type) || /\.(pdf|png|jpe?g|heic|webp|xlsx?|docx?)$/i.test(name));

/* ── THE POSTURE, AND ITS HONEST WORDS ──────────────────────────────────────────────────────
 * Four states, and one of them is «the runtime is not there». A kit surface that needs the
 * runtime says so; it never shows a row nobody read. */
export type Extraction =
  | { state: 'reading'; kind: ParseKind }
  | { state: 'read'; kind: ParseKind; result: ParseResult }
  | { state: 'unreachable'; kind: ParseKind }
  | { state: 'unavailable'; kind: ParseKind; because: string };

export const EXTRACTION_COPY = {
  reading: 'Reading the document…',
  unreachable: 'Runtime offline',
  unavailable: 'Extraction unavailable',
  /** POSITIVE, both times: the source is on screen and the manual paths are open beside it. */
  fallback: 'Write the lines from the source.',
  stockFallback: 'Add each product below and check every quantity before you confirm.',
  retry: 'Read it again',
} as const;

/** The evidence line a read wears: what read it, off how many pages, and how sure it is. It is
 *  the source card's own sentence — «Read by Parsewise · 1 page · 1 table · 4 rows · 92%». */
export const evidenceLine = (result: ParseResult): string => [
  'Read by Parsewise',
  String(result.evidence.pages) + ' page' + (result.evidence.pages === 1 ? '' : 's'),
  String(result.evidence.tables) + ' table' + (result.evidence.tables === 1 ? '' : 's'),
  String(result.rows.length) + ' row' + (result.rows.length === 1 ? '' : 's'),
  Math.round(Math.max(0, Math.min(1, result.confidence)) * 100) + '%',
  /* §PAR-09.1: an order the runtime could not establish is STATED, never presented as read */
  ...(result.evidence.lineOrder === 'unknown' ? ['check the line order'] : []),
  ...(result.evidence.rowsMerged ? [String(result.evidence.rowsMerged) + ' row' + (result.evidence.rowsMerged === 1 ? '' : 's') + ' folded'] : []),
].join(' · ');

/* ── ONE READ PER SOURCE, HOWEVER MANY SEATS LOOK AT IT ─────────────────────────────────────
 * The same attached source can be on screen twice — inside the composer and on the document it
 * belongs to. Two seats must not mean two reads: a second read is a second charge against the
 * provider, a second wait, and two «put these lines on» buttons for one piece of paper. So the
 * read lives in a keyed store and the seats SUBSCRIBE to it. */
type Held = { extraction: Extraction; listeners: Set<() => void> };
const held = new Map<string, Held>();
const started = new Set<string>();

const publish = (key: string, extraction: Extraction) => {
  const row = held.get(key);
  if (!row) return;
  row.extraction = extraction;
  row.listeners.forEach((listener) => listener());
};

const start = (key: string, source: Blob, kind: ParseKind) => {
  held.set(key, { extraction: { state: 'reading', kind }, listeners: held.get(key)?.listeners ?? new Set() });
  runtime.parse(source, kind).then(
    (result) => publish(key, { state: 'read', kind, result }),
    (error: unknown) => publish(key, error instanceof RuntimeUnreachable
      ? { state: 'unreachable', kind }
      : { state: 'unavailable', kind, because: error instanceof Error ? error.message : 'Extraction unavailable' }),
  );
};

/** ONE CALL, ONE STATE. A source that arrives is read once; a source that changes leaves the read
 *  it replaced behind. `key` identifies the source — the opaque source ref, never its bytes. */
export function useExtraction(source: Blob | undefined, kind: ParseKind, key = ''): {
  extraction: Extraction | undefined;
  retry: () => void;
} {
  const id = key + '/' + kind;
  const subscribe = React.useCallback((listener: () => void) => {
    if (!source) return () => {};
    const row = held.get(id) ?? { extraction: { state: 'reading', kind } as Extraction, listeners: new Set<() => void>() };
    held.set(id, row);
    row.listeners.add(listener);
    return () => { row.listeners.delete(listener); };
  }, [id, kind, source]);
  const read = React.useCallback(() => (source ? held.get(id)?.extraction : undefined), [id, source]);
  React.useEffect(() => {
    if (!source || started.has(id)) return;
    started.add(id);
    start(id, source, kind);
  }, [id, kind, source]);
  const extraction = React.useSyncExternalStore(subscribe, read, () => undefined);
  return { extraction, retry: () => { if (source) start(id, source, kind); } };
}

/* ── THE PROPOSED ROW MEETS THE HOUSE'S OWN BOOK ────────────────────────────────────────────
 * Extraction returns what the PAPER said. What the house sells is the catalogue's business, so a
 * proposed row is matched by the SAME resolver the manual stock path uses — exact code first,
 * then a narrowing word-by-word match — and a row that matches nothing stays a proposal with no
 * product on it. Nothing is invented to make a row land. */
export function resolveParsedRow(products: Product[], row: ParsedRow): Product | undefined {
  const said = (row.name || '').trim();
  if (!said) return undefined;
  const normalized = termsOf(said).join(' ');
  if (!normalized) return undefined;
  const exact = products.filter((product) => product.code && termsOf(product.code).join(' ') === normalized);
  if (exact.length === 1) return exact[0];
  let shown = products;
  let matched = false;
  for (const word of said.split(/\s+/).filter(Boolean)) {
    const terms = termsOf(word);
    if (!terms.length) continue;
    const next = shown.filter((product) => matches(terms, wordsOf([product.name, product.code])));
    if (next.length) { shown = next; matched = true; }
  }
  return matched && shown.length === 1 ? shown[0] : undefined;
}

/** A quantity a person may still edit: the number the paper stated, in the house's own writing. */
export const parsedQuantity = (row: ParsedRow): string =>
  Number.isFinite(row.qty) ? String(row.qty).replace('.', ',') : '';
