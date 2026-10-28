/* THE LEARNING TRACE — every correction, made readable as labeled data (THE-DENSE-BRIEF §C·§7,
 * FEED-IA §33.2: «the learning TRACE export — log corrections with ladder context from today»).
 *
 * ═══ THE DOCTRINE THIS FILE IS ══════════════════════════════════════════════════════════════
 * «Accepting is nothing. Correcting the line IS the training signal — every such edit is an event
 * the model learns from. No thumbs, no ratings, no feedback UI» (THE-INTELLIGENCE §1). The app has
 * been writing those events into the sale ledger since the day the ledger existed. What it has
 * never had is a READ of them shaped like the thing they actually are: **the §C training corpus,
 * made readable.** A trace row is one supervised example — the words that arrived, the words a
 * person put there instead, and the rung of the L0–L4 granularity ladder the disagreement was on.
 *
 * That is the whole of «good UX opens good intelligence» as architecture: the editing surfaces ARE
 * the labeling tools, and this is the export that says so out loud. When the backend lands, it
 * persists exactly these rows; nothing about the surfaces changes, because the surfaces were
 * already writing them.
 *
 * ═══ IT IS READ-SIDE, AND IT WRITES NOTHING ═════════════════════════════════════════════════
 * No new event, no new store, no second copy of anything. `tracesOf` folds the ledger the same way
 * every other surface folds it and reads the corrections out of the result, so a trace can never
 * disagree with the albarán it came from.
 *
 * ═══ THE LADDER IS THE LABEL (THE-DENSE-BRIEF §C) ═══════════════════════════════════════════
 *   L0 FAMILY   pescado · carne · fruta — the family the house's shelf law is read from
 *   L1 KIND     the species/crop/cut a fishmonger would name: merluza, tomate, solomillo
 *   L2 SORT     the variety/origin/method that changes the name or the price: de pincho, raf
 *   L3 FORM     how it is sold or prepped: entero, en lomos, al vacío por separado
 *
 * The rungs come from `catalogue.ts`'s own parse — the same decomposition the writing line shows a
 * person as chips — so a trace row is labeled by the machinery the correction was made against,
 * never by a second opinion written here. L4 GRADE is deliberately absent: a grade is a closed
 * register the person picks from, not a name anything has to learn.
 *
 * ═══ THE SIX ACTS THAT TEACH ════════════════════════════════════════════════════════════════
 * Exactly the correction-class events already in the ledger — nothing was invented to fill the
 * list, and nothing that teaches was left out:
 *
 *   correct    they put their own word back where Rocoto filled differently
 *   amend      the trade's own qualifier, put on the name by hand
 *   unit-flip  the unit the house actually sells this in
 *   adopt      what an off-catalogue word IS: a product, or this one sale's own
 *   graduate   an amendment worth a catalogue row of its own
 *   prep-note  how this thing leaves the house, for this customer
 */
import type { Cast } from '../../scenarios/data/cast';
import {
  buildSales, policyOf, topReason,
  type PolicyId, type Sale, type SaleEvent, type SaleLine, type SaleState,
} from './sale';
import { dayNow } from './day';
import { ancestorsOf, ground, nameOfNode, parseWritten } from './catalogue';

/** The acts that teach. A transition, a print or a payment teaches nothing — accepting is nothing. */
export const TRACE_KINDS = ['correct', 'amend', 'unit-flip', 'adopt', 'graduate', 'prep-note'] as const;

export type TraceKind = (typeof TRACE_KINDS)[number];

/** Where on the granularity ladder this example sits. A rung the words never claimed is absent
 *  rather than empty — an unknown sort is not a sort called nothing. */
export type Ladder = {
  /** L0 · the family */
  l0?: string;
  /** L1 · the kind */
  l1?: string;
  /** L2 · the sort */
  l2?: string;
  /** L3 · the form or prep */
  l3?: string;
};

/* ── WHAT A LEARNING ROW HAS TO CARRY (THE CHECKPOINT §15 · MAP 15.1) ─────────────────────────
 * «Corrections are evidence. Capture: Rocoto prediction; chosen action policy; why it was
 * flagged/withheld; operator/customer correction; final accepted order; where available, final
 * albarán / fulfilled outcome.» Six things. Three of them have been on this row since the file
 * existed and three were missing:
 *
 *   PREDICTION   `before` — what the machine had. It is NOT duplicated at document scale here:
 *                §27.5 forbids a second copy of a working implementation, and a `prediction`
 *                field beside `before` would be exactly that. Where the document's own reading is
 *                wanted, `policyOf(sale).withheld` composes it from the sale.
 *   CORRECTION   `after` — what the person put there instead.
 *   THE EXAMPLE  `product` + `ladder` — the input side, labeled on the L0–L3 rungs.
 *   POLICY       NEW. What Rocoto decided about the document this correction happened on.
 *   WITHHELD     NEW. Why it was flagged or held, in the row's own one sentence — never a second
 *                wording, because `topReason` already picks the sentence the surfaces show.
 *   FINAL        NEW. Where the document ended up, and its number once it has one.
 *
 * ALL THREE ARE READ OFF THE SALE THE CORRECTION HAPPENED ON. Nothing new is stored, nothing is
 * computed twice, and no surface has to start writing anything: `tracesOf` already folds the sale
 * to find the line, and these three are three more questions asked of the same object.
 */

/** WHERE THE DOCUMENT ENDED UP. The number is absent until the albarán has one, which is the
 *  honest shape: a correction taught on a request is a correction on a document with no number. */
export type TraceFinal = { state: SaleState; number?: string };

/** ONE SUPERVISED EXAMPLE. `before` is what the machine had; `after` is what the person put there. */
export type Trace = {
  event: TraceKind;
  saleId: string;
  /** the line's own id inside that sale */
  line: string;
  /** the words the line carries — the input side of the example */
  product: string;
  ladder: Ladder;
  before: string;
  after: string;
  /** what Rocoto decided about this document — ACT · CLARIFY · HOLD · HANDOFF (§9, §15.1) */
  policy: PolicyId;
  /** why it was flagged or held, in the one sentence the surfaces already show. Absent on a
   *  document nothing was withheld on — a correction taught on a SURE albarán is a correction
   *  with no hold behind it, and an empty string would claim there was one. */
  withheld?: string;
  /** the state the document is in, and its number where it has one */
  final: TraceFinal;
  /** the hour it was taught, in the day's own clock */
  at: string;
};

const isTraceKind = (k: SaleEvent['kind']): k is TraceKind =>
  (TRACE_KINDS as readonly string[]).includes(k);

/** THE RUNGS, READ BY THE PARSE THE CORRECTION WAS MADE AGAINST. The line's name goes through
 *  `parseWritten` exactly as a person's typing does, so L1 and L2 are the chips the writing line
 *  would have drawn; L0 walks the tree up to the family; L3 is the bench's own instruction where
 *  the line carries one, else the residue the registers left over. */
function ladderOf(cast: Cast, line: SaleLine | undefined): Ladder {
  if (!line) return {};
  /* ⚠ NO GRADE REGISTER (FEED-IA §197.2 «Remove class everywhere»): the ladder is the kind, the
     sort and what the bench wrote — the rungs a name actually has. */
  const written = parseWritten(line.product.name, { sector: cast.sector });
  const node = written.kind?.node ?? ground(line.product.name, line.product.family);
  const family = [...ancestorsOf(node)].find((n) => n.level === 'family');
  return {
    l0: family ? family.name : undefined,
    l1: written.kind?.name ?? nameOfNode(node),
    l2: written.sort?.name ?? undefined,
    l3: line.prepNote ?? written.comment ?? undefined,
  };
}

/** The two sides of the example, per act. Every one of them reads fields the event already carries
 *  — this function invents no text and looks nothing up that the ledger did not record. */
function sides(e: Extract<SaleEvent, { kind: TraceKind }>, line: SaleLine | undefined): { before: string; after: string } {
  switch (e.kind) {
    case 'correct':
      return { before: e.filled, after: e.asked };
    case 'amend':
      return { before: line?.product.name ?? '', after: e.word };
    case 'unit-flip':
      return { before: e.from, after: e.to };
    case 'adopt':
      return { before: line?.product.name ?? '', after: e.how };
    case 'graduate':
      return { before: e.base, after: e.amendment };
    case 'prep-note':
      return { before: '', after: e.note };
  }
}

/**
 * EVERY CORRECTION IN THE DAY'S LEDGER, WITH ITS LADDER CONTEXT — the labeled-data view of the
 * morning. Oldest first, because a corpus is a sequence.
 */
export function tracesOf(cast: Cast): Trace[] {
  const edits = dayNow();
  if (edits.sector !== cast.sector) return [];
  const teaching = edits.events.filter((e): e is Extract<SaleEvent, { kind: TraceKind }> => isTraceKind(e.kind));
  /* A MORNING WITH NO CORRECTIONS COSTS NOTHING TO READ. Folding six hundred sales to answer «none»
     would put a full rebuild of the day behind every render of a surface that merely prints the
     count — so the ledger is asked the cheap question first. */
  if (teaching.length === 0) return [];
  const sales = buildSales(cast, edits);
  const bySale = new Map<string, Sale>(sales.map((s) => [s.id, s]));

  return teaching
    .map((e) => {
      const sale = bySale.get(e.sale);
      const line = sale?.lines.find((l) => l.id === e.line) ?? sale?.removed?.find((l) => l.id === e.line);
      const { before, after } = sides(e, line);
      /* THE DOCUMENT'S OWN VERDICT AND ITS HOLD, read off the sale this correction happened on
         (§15.1). A trace whose sale has been folded away carries neither rather than a guess —
         `policy: 'act'` on a document nobody can see would be a claim about nothing. */
      const policy = sale ? policyOf(sale) : null;
      const held = sale && policy && policy.id !== 'act' ? topReason(sale)?.text : undefined;
      return {
        event: e.kind,
        saleId: e.sale,
        line: e.line,
        product: line?.product.name ?? '',
        ladder: ladderOf(cast, line),
        before,
        after,
        policy: (policy?.id ?? 'act') satisfies PolicyId,
        withheld: held,
        final: { state: sale?.state ?? 'request', number: sale?.number || undefined },
        at: e.at,
      };
    })
    .sort((a, b) => a.at.localeCompare(b.at));
}

/** How many corrections the morning has taught. The one number Settings prints. */
export const taughtToday = (cast: Cast): number => tracesOf(cast).length;
