/* OUR PAPER, READ BACK — the kit's half of the read contract (FEED-IA E196 · §196.5 · §198.1)
 *
 * ═══ WHAT THIS IS FOR ════════════════════════════════════════════════════════════════════════
 * The bay prints a packing list. The goods are weighed. Somebody writes the final weight in the
 * box the sheet left for it, in pen, on paper, standing in a cold room. Then a phone photographs
 * that paper and the numbers have to come back onto the lines they belong to.
 *
 * Two things make that possible, and this file is the kit's half of both:
 *
 *   THE MANIFEST  — recorded at PRINT time, so the geometry is known rather than guessed: which
 *                   cell of which row of which order sits at which millimetre of which page.
 *   THE READING   — the runtime reads each of those cells off the photograph and hands back the
 *                   value AND THE CROP OF THE INK, so a person judges the handwriting itself.
 *
 * ⚠ NO MANIFEST, NO READING (the contract's own rule). A photograph this house holds no layout
 * for is answered 422, and the kit takes the Parsewise road instead (§196.5). Reading cells off a
 * page whose geometry nobody recorded would put an invented number exactly where a person stops
 * checking — the one failure THE-PARSING-SPEC is written against end to end.
 *
 * ═══ WHAT NEVER HAPPENS HERE ═════════════════════════════════════════════════════════════════
 * Nothing in this file writes to a sale. A reading is a PROPOSAL until a person accepts it, the
 * same law §191.1 gave the capture road: «a capture is not an OCR result… no field is silently
 * invented». The accept is `paper-read-back.tsx`'s act and it fires `sale.ts`'s own line events,
 * so a weight that lands from paper is indistinguishable — in the ledger, in the trace, in the
 * export — from a weight a hand typed. One road into the document, always.
 */
import * as React from 'react';
import {
  RuntimeRefused,
  RuntimeUnreachable,
  runtime,
  type PaperCell,
  type PaperManifest,
  type PaperRead,
  type PaperReading,
} from './runtime-client';

/* ── THE FIVE POSTURES, AND EVERY ONE OF THEM SAYS WHAT IS ───────────────────────────────────
 * `unmatched` is the honest one that matters: the runtime ANSWERED, and its answer was «this is
 * not one of ours». That is a road, not a failure — it is what sends the photo to Parsewise. */
export type PaperReadState =
  | { state: 'reading' }
  | { state: 'read'; result: PaperRead }
  | { state: 'unmatched'; because: string }
  | { state: 'unreachable' }
  | { state: 'unavailable'; because: string };

/* ── EVERY SENTENCE THIS ROAD SAYS, AND EVERY ONE OF THEM SAYS WHAT IS ──────────────────────
 * There is no «no value read», no «reading unavailable», no «0 readings». A box with nothing in it
 * is «left as printed»; a reading already on its line is «On the line»; a photograph of somebody
 * else's document sends the person to the road that WILL read it. The postures that draw nothing
 * carry no words at all, because a surface that is absent has nothing to announce. */
export const PAPER_READ_COPY = {
  /** the 422: the runtime holds no layout for this sheet, so the other road opens */
  unmatched: 'Read the lines from the photo.',
  /** the head of the review, completed by the day, the run and the count */
  head: 'Your packing list',
  /** what a cell with no ink in it is */
  blank: 'left as printed',
  printed: 'printed',
  accept: 'Accept',
  readings: 'readings',
  /** a reading that is already on its line — a record, said as what IS */
  landed: 'On the line',
  dismiss: 'Dismiss',
  keep: 'Keep this one',
  close: 'Close',
  print: 'Print the final copy',
  enlarge: 'See the writing bigger',
  /** the evidence sentence a document keeps once the readings are on its lines */
  journal: 'Read from your paper',
} as const;

/** WHO READ IT, IN THE WORD A PERSON SAYS. The wire carries a model id; a line of evidence a
 *  person reads carries the name of the thing that read it. */
export const readerWord = (reader: PaperRead['evidence']['reader']): string =>
  reader === 'claude' ? 'Claude' : 'Gemini';

/** THE READING'S OWN SENTENCE — what read it, off how many pages, how many marks it found.
 *  It is `parsing.ts`'s `evidenceLine` for the other road, written to the same grammar so the two
 *  capture roads state their evidence in one voice. */
export const paperEvidenceLine = (result: PaperRead): string => [
  'Read by ' + readerWord(result.evidence.reader),
  String(result.pages.length) + ' page' + (result.pages.length === 1 ? '' : 's'),
  String(result.evidence.marksFound) + ' of 4 marks found',
  String(result.evidence.ms) + ' ms',
].join(' · ');

/** every reading on the sheet, page order kept, so a caller never walks pages by hand */
export const readingsOf = (result: PaperRead): PaperReading[] =>
  result.pages.flatMap((page) => page.readings);

/** a reading carries a value only where there is ink in the box AND a value came back */
export const hasValue = (reading: PaperReading): boolean =>
  reading.written && typeof reading.value === 'string' && reading.value.trim().length > 0;

/** ONE READING OF A WRITTEN NUMBER. The pen writes «21,4» and «21.4» on the same morning, so both
 *  are one number here — the same grammar the line's own quantity seat reads by.
 *
 *  AND IT WRITES «12.500,5». A six-digit quantity in Spain carries the thousands dot, and a
 *  reading the kit calls unlandable because the hand grouped its digits would send a person back
 *  to typing a number that is already on screen and already right. So where BOTH marks appear the
 *  last one is the decimal and the ones before it group — «12.500,5» and «12,500.5» are the same
 *  twelve and a half thousand. A single mark keeps its one meaning, the decimal, exactly as
 *  before: guessing that a lone «12.500» means twelve thousand would be inventing a number, and
 *  inventing numbers is the one thing this road may never do. */
export const paperNumber = (said: string): number => {
  const compact = said.trim().replace(/\s/g, '');
  const grouped = compact.includes(',') && compact.includes('.');
  const cut = Math.max(compact.lastIndexOf(','), compact.lastIndexOf('.'));
  const plain = grouped
    ? compact.slice(0, cut).replace(/[.,]/g, '') + '.' + compact.slice(cut + 1)
    : compact.replace(',', '.');
  if (!/^\d+(?:\.\d+)?$/.test(plain)) return Number.NaN;
  const value = Number(plain);
  return Number.isFinite(value) && value > 0 ? value : Number.NaN;
};

/** HOW MANY DECIMALS THE PEN ACTUALLY WROTE. «21,4» is one, «9,05» is two, «40» is none, and
 *  «12.500,5» is ONE — the digits after the mark `paperNumber` read as the decimal, never after
 *  the first mark it happened to find. A fixed count turns «21,4» into «21,400» down a column,
 *  which a person scanning reads as twenty-one thousand four hundred; that is the mis-read §195
 *  exists to stop, so the count comes off the writing itself. */
export const paperDecimals = (said: string): number => {
  const compact = said.trim().replace(/\s/g, '');
  const cut = Math.max(compact.lastIndexOf(','), compact.lastIndexOf('.'));
  return cut === -1 ? 0 : Math.min(3, compact.length - cut - 1);
};

/** the reading a person can actually put on a line: ink in the box, and a number in the ink */
export const landable = (reading: PaperReading, typed?: string): boolean => {
  const said = typed ?? reading.value ?? '';
  if (reading.cell === 'unit') return said.trim().length > 0;
  return Number.isFinite(paperNumber(said));
};

/** WHAT THE READING SAYS ABOUT ITSELF, in words, and only where it has something to say.
 *  A confident reading of clear handwriting says nothing at all — silence is the resting state,
 *  exactly as it is for a line's provenance (§80). */
export const CONFIDENT = 0.9;
export const postureOf = (reading: PaperReading): 'plain' | 'look' =>
  reading.check || reading.confidence < CONFIDENT ? 'look' : 'plain';

/** the sentence under a row that wants a person's eye — the runtime's own words where it sent
 *  any, and otherwise the sureness it did send, stated as a thing to do */
export const lookWords = (reading: PaperReading): string =>
  reading.check ?? ('Worth a look · read at ' + String(Math.round(Math.max(0, Math.min(1, reading.confidence)) * 100)) + '%');

/* ══ ONE READ PER PHOTOGRAPH, HOWEVER MANY SEATS LOOK AT IT ═════════════════════════════════
 * The same photo can be on screen twice — inside the capture card and on the document it belongs
 * to. Two seats must never mean two reads: a second read is a second charge, a second wait, and
 * two «Accept» buttons for one piece of paper. So the read lives in a keyed store and the seats
 * SUBSCRIBE to it. `parsing.ts` settled this shape for the Parsewise road; this is the same one.
 */
type Held = { read: PaperReadState; listeners: Set<() => void> };
const held = new Map<string, Held>();
const started = new Set<string>();

const publish = (key: string, read: PaperReadState) => {
  const row = held.get(key);
  if (!row) return;
  row.read = read;
  row.listeners.forEach((listener) => listener());
};

const start = (key: string, source: Blob) => {
  held.set(key, { read: { state: 'reading' }, listeners: held.get(key)?.listeners ?? new Set() });
  runtime.paper.read(source).then(
    (result) => publish(key, { state: 'read', result }),
    (error: unknown) => {
      if (error instanceof RuntimeUnreachable) { publish(key, { state: 'unreachable' }); return; }
      /* 422 IS AN ANSWER, NOT A FAULT. The runtime looked and holds no layout for this sheet, so
         it says so in its own positively worded sentence and the kit opens the other road. */
      if (error instanceof RuntimeRefused && error.status === 422) {
        publish(key, { state: 'unmatched', because: error.said || PAPER_READ_COPY.unmatched });
        return;
      }
      publish(key, { state: 'unavailable', because: error instanceof Error ? error.message : PAPER_READ_COPY.unmatched });
    },
  );
};

/** ONE CALL, ONE STATE. `key` identifies the photograph — the opaque source ref, never its bytes.
 *  A caller with no source gets `undefined`, and asks the runtime nothing at all. */
export function usePaperRead(source: Blob | undefined, key = ''): { read: PaperReadState | undefined; retry: () => void } {
  const id = 'paper/' + key;
  const subscribe = React.useCallback((listener: () => void) => {
    if (!source) return () => {};
    const row = held.get(id) ?? { read: { state: 'reading' } as PaperReadState, listeners: new Set<() => void>() };
    held.set(id, row);
    row.listeners.add(listener);
    return () => { row.listeners.delete(listener); };
  }, [id, source]);
  const readNow = React.useCallback(() => (source ? held.get(id)?.read : undefined), [id, source]);
  React.useEffect(() => {
    if (!source || started.has(id)) return;
    started.add(id);
    start(id, source);
  }, [id, source]);
  const read = React.useSyncExternalStore(subscribe, readNow, () => undefined);
  return { read, retry: () => { if (source) start(id, source); } };
}

/** WHETHER THIS PHOTOGRAPH IS OUR OWN PAPER. A read with `matched` set names the day and the
 *  orders the sheet was printed over; a read with `matched` null is a document of somebody else's
 *  and belongs on the Parsewise road. One question, asked in one place. */
export const matchedRead = (read: PaperReadState | undefined): PaperRead | undefined =>
  read && read.state === 'read' && read.result.matched && read.result.matched.sales.length > 0 ? read.result : undefined;

/* ── THE LAYOUT THE SHEET WAS PRINTED FROM ──────────────────────────────────────────────────
 * Asked for once per token, so the review can say what each box PRINTED — «printed 12,5 kg» — off
 * the paper's own record rather than off a line that may have moved since the press. A manifest
 * that does not come back is not an error here: the line's own figure is what the press wrote, so
 * the review states that instead and nothing on screen goes blank.
 */
const manifests = new Map<string, PaperManifest | null>();
const manifestListeners = new Set<() => void>();
const manifestStarted = new Set<string>();

export function usePaperManifest(token: string): PaperManifest | undefined {
  const subscribe = React.useCallback((listener: () => void) => {
    manifestListeners.add(listener);
    return () => { manifestListeners.delete(listener); };
  }, []);
  const read = React.useCallback(() => (token ? manifests.get(token) ?? undefined : undefined), [token]);
  React.useEffect(() => {
    if (!token || manifestStarted.has(token)) return;
    manifestStarted.add(token);
    runtime.paper.manifestOf(token).then(
      (manifest) => { manifests.set(token, manifest); manifestListeners.forEach((listener) => listener()); },
      () => { manifests.set(token, null); manifestListeners.forEach((listener) => listener()); },
    );
  }, [token]);
  const held_ = React.useSyncExternalStore(subscribe, read, () => undefined);
  return held_ ?? undefined;
}

/* ══ WHAT THE DOCUMENT KEEPS AFTERWARDS ═════════════════════════════════════════════════════
 * The accept writes the numbers onto the lines through `sale.ts`, and that is the durable fact.
 * Three things survive beside it, because they are about the READ rather than about the goods:
 *
 *   · the EVIDENCE, so the document can say where its weights came from — «Read from your paper ·
 *     7 of 9 lines · Gemini» — instead of a person having to remember;
 *   · the ROWS THE READING ASKED A PERSON TO LOOK AT, so the concern stands after the accept and
 *     can be dismissed like every other concern in the house (§128);
 *   · the ROWS A PERSON DISMISSED, so a dismissed reading stays dismissed.
 *
 * It is small, it is local, and it holds NO image bytes — the same custody law the paper review's
 * own record keeps (SRC-PRIV-01).
 */
/** a concern belongs to the BOX that raised it, not to the whole line — the line may carry three
 *  readings and only one of them wanted an eye */
export type PaperReadCheck = { sale: string; line: string; cell: PaperCell; says: string };
export type PaperReadAccepted = { sale: string; line: string; cell: PaperCell; value: string };
export type PaperReadRecord = {
  version: 1;
  scope: string;
  token: string;
  day: string;
  reader: string;
  at: string;
  /** ⚠ EVERY LINE THIS TOKEN'S PAPER HAS SHOWN, as `sale/line`, ACCUMULATED — never a count of
   *  readings, and never overwritten by the last photograph.
   *
   *  Two facts make a stored number wrong here. A line can carry THREE readings — a quantity, a
   *  unit and a final weight — so counting readings counts cells and calls them lines. And the
   *  runtime answers ONE PAGE PER PHOTOGRAPH (`backend/app/paper.py`), so a two-page sheet is two
   *  photographs against one token: a `rows` number rewritten by the second photograph, with the
   *  accepted list still accumulating under it, produced «8 of 4 lines». A union of line keys is
   *  right on both counts and stays right however the sheet arrives. */
  lines: string[];
  accepted: PaperReadAccepted[];
  checks: PaperReadCheck[];
};

/** one line of one order, named the one way, so a set of them counts LINES and not cells */
export const lineKey = (sale: string, line: string): string => sale + '/' + line;

const STORAGE_KEY = 'rocoto-paper-read-v1';
type Book = Record<string, PaperReadRecord>;

const canUseStorage = (): boolean => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const validRecord = (value: unknown): value is PaperReadRecord => {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return row.version === 1 && typeof row.scope === 'string' && typeof row.token === 'string'
    && typeof row.day === 'string' && typeof row.reader === 'string' && typeof row.at === 'string'
    && Array.isArray(row.lines) && Array.isArray(row.accepted) && Array.isArray(row.checks);
};

function readBook(): Book {
  if (!canUseStorage()) return {};
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([, row]) => validRecord(row))) as Book;
  } catch {
    return {};
  }
}

let book = readBook();
const bookListeners = new Set<() => void>();
const bookSubscribe = (listener: () => void): (() => void) => {
  bookListeners.add(listener);
  return () => { bookListeners.delete(listener); };
};

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return;
    book = readBook();
    bookListeners.forEach((listener) => listener());
  });
}

const recordKey = (scope: string, token: string): string => scope + ':' + token;

/** THE RECORD IS WRITTEN IN THE SAME PRESS THAT PUTS THE NUMBERS ON THE LINES. It returns whether
 *  it was kept, so a surface never claims an evidence line it could not save. */
export function keepPaperRead(record: PaperReadRecord): boolean {
  if (!canUseStorage()) return false;
  const next = { ...book, [recordKey(record.scope, record.token)]: record };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    book = next;
    bookListeners.forEach((listener) => listener());
    return true;
  } catch {
    return false;
  }
}

export function usePaperReadRecord(scope: string, token: string): PaperReadRecord | undefined {
  const state = React.useSyncExternalStore(bookSubscribe, () => book, () => book);
  return token ? state[recordKey(scope, token)] : undefined;
}

/** every read this house has landed, newest first — what a document reads to say where its
 *  weights came from, whichever sheet they arrived on */
export function usePaperReadRecords(scope: string): PaperReadRecord[] {
  const state = React.useSyncExternalStore(bookSubscribe, () => book, () => book);
  return React.useMemo(
    () => Object.values(state).filter((row) => row.scope === scope).sort((a, b) => (a.at < b.at ? 1 : -1)),
    [state, scope],
  );
}

/** HOW MANY LINES CARRY A READING FROM THIS PAPER. A line that took a quantity AND a unit is one
 *  line, because that is what the sentence says it is. */
export const acceptedLines = (record: PaperReadRecord): number =>
  new Set(record.accepted.map((row) => lineKey(row.sale, row.line))).size;

/** THE EVIDENCE, IN ONE POSITIVE SENTENCE. «Read from your paper · 7 of 9 lines · Gemini» — what
 *  happened, how much of it, and who read it. Nothing about what did not happen.
 *
 *  Both numbers count LINES. `Math.max` is the guard that keeps the sentence arithmetically true
 *  whatever a stored record carries: a landed line is a line the paper showed, so the total can
 *  never be the smaller of the two. */
export const journalLine = (record: PaperReadRecord): string => {
  const landed = acceptedLines(record);
  const shown = Math.max(new Set(record.lines).size, landed);
  return [PAPER_READ_COPY.journal,
    String(landed) + ' of ' + String(shown) + ' line' + (shown === 1 ? '' : 's'),
    record.reader].join(' · ');
};
