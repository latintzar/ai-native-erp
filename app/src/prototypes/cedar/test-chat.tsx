import { soles } from './currency';
/* THE TEST CHAT — testing Rocoto against the house's own memory, as a product capability.
 *
 * ═══ WHAT THE CHECKPOINT ASKS FOR (§10, whole; §27.13) ══════════════════════════════════════
 * «Testing Rocoto against the company's own business memory is a first-class product capability.
 * This should not be hidden inside a generic demo mode and it should not require the user to
 * invent a workaround.» And, in the coding-agent instruction: «New test chat is a real product
 * capability, not a temporary demo hack.»
 *
 * So this file is the BRAIN and the SELECTOR of that capability, and nothing else:
 *
 *   THE SELECTOR   the small card that opens before the conversation begins — «Existing
 *                  customer» with the house's own book behind it, or «New customer», the
 *                  cold-start emulation.
 *   THE BRAIN      one function that takes a typed message and answers what Rocoto would do
 *                  with it: what it read, what it proposed, and whether it acts, clarifies,
 *                  holds or hands off.
 *
 * ═══ WHY THERE IS NO «NEW CHAT» (§10.2, and it is the reason the action reads as it does) ═══
 * «In normal production use, the distributor generally does not start conversations manually —
 * customers message them. Therefore a generic "new chat" action would be ambiguous and probably
 * unused.» The book's one creating action is therefore this one, and it says what it makes.
 *
 * ═══ THE BRAIN IS THE HOUSE'S OWN BRAIN, RE-READ — NEVER A SECOND ONE (§27.5) ═══════════════
 * Every judgment below comes out of a function this app already ships, on a `Sale` built from the
 * typed words:
 *
 *   chip-parse   `parseChips` — the same organ the albarán's own writing line runs, per keystroke
 *   catalogue    `productForNode` + `graduatedProducts` — the word resolved against the reference
 *   sale.ts      `resolveWord` (§80's ambiguity law) · `flagsOf` · `openNonSku` · `topReason` ·
 *                `rubricOf` · `answerOwed` · `askWords`
 *   net.ts       `passesNet` — the six checks, exactly as a real morning meets them
 *   knows.ts     `basketOf` · `historyOf` · `aboutCustomer` — the customer's private memory
 *
 * A test message therefore walks the same resolution a real one does, because it walks the same
 * code. Nothing here scores anything, and nothing here holds a list of what exists.
 *
 * ═══ THE POLICY IS `sale.ts`'S OWN (§9.9 · P3, LANDED) ══════════════════════════════════════
 * The four verdicts are `policyOf(sale)` — one function in `sale.ts`, folding `passesNet` /
 * `autoCommitted`, `rocotoAsked`, `answerOwed` / `standsInDay` and the escalation topic. This file
 * held a thin adapter over those same predicates while that function was still another package's
 * in-flight work; the adapter is gone and this surface is `policyOf`'s FIRST CONSUMER. The
 * inspector therefore prints the verdict the river prints, by construction rather than by care.
 *
 * ═══ AND NOTHING A TEST DOES REACHES THE HOUSE (§10.7, §27.14) ══════════════════════════════
 * The `Sale` this file builds is a VALUE, not a ledger entry: it is never written through
 * `sale.ts`'s event log, so `buildSales` cannot see it, so the river, the day, the counts and the
 * badge cannot either. Isolation here is structural rather than a filter somebody has to remember.
 */
import * as React from 'react';
import { ThemeProvider, useStyletron } from 'baseui';
import { Avatar } from 'baseui/avatar';
import { Button, KIND, SHAPE, SIZE } from 'baseui/button';
import { OverlayCard } from '../../rocoto/overlay-card';
import { Figure } from './figure';
import { AUTHOR, Message } from '../../rocoto/message';
import { whatsappTheme } from '../../rocoto-theme';
import { VoiceNoteBody } from './shell/media';
import type { Picture, VoiceNote } from './shell/threads';
import type { Cast, Customer, Product } from '../../scenarios/data/cast';
import {
  amendmentsOf, graduatedNode, graduatedProducts, ground, nearbyNodes, productForNode, sortsOf,
  useCatalogue, type CatalogueState,
} from './catalogue';
import { parseChips, type ChipLine, type ChipRegisters } from './chip-parse';
import { useConfig } from './config';
import { clockAfter, nowOf } from './day';
import { Glyph, STEP, type GlyphId } from './glyphs';
import { grantsNow } from './grants';
import { frequentOf } from './insights';
import { aboutCustomer, basketOf, historyOf, useKnows, type Knows } from './knows';
import {
  amountWords, askWords, dayLabelFromId, declineUntilOf, figureOf, policyOf,
  qtyWords, resolveWord, todayId, windowOf,
  type NeedsReply, type PolicyId, type Sale, type SaleLine, type ThreadRow,
} from './sale';
import { actionOwed, type Owed } from './tick';
import { passesNet } from './net';
import { Mark, SearchSeat, matches, termsOf, wordsOf } from './search';
import { bandOf, priceOn } from './tiers';
import type { Ladder, Trace, TraceFinal } from './trace';

/* ── WHO THE OPERATOR IS TYPING AS ────────────────────────────────────────────────────────── */

/** THE TWO PATHS §10.3 NAMES, and there are exactly two. «Existing customer» tests against the
 *  real private memory of a real account; «New customer» is the cold-start emulation. */
export type TestSubject =
  | { kind: 'existing'; customer: Customer }
  | { kind: 'new' };

/** THE COLD-START ACCOUNT, and every field on it is the least-claiming answer — the same four
 *  `customers-made.ts` gives an account a person opens by name (§86.4: only what was given).
 *  `tier` is deliberately EMPTY: a house's own `bandOf` answers for a customer whose band it does
 *  not hold, so the line still prices at the list price and the surface can say why. */
export const NEW_CUSTOMER: Customer = {
  id: 'test-new',
  name: 'New customer',
  channel: 'WhatsApp',
  tier: '',
  settles: 'cash on delivery',
};

export const subjectCustomer = (subject: TestSubject): Customer =>
  subject.kind === 'existing' ? subject.customer : NEW_CUSTOMER;

/** THE LABEL, VERBATIM FROM §10.6. «Clearly label the thread: TEST · Emulating Restaurante X» and
 *  «Clearly label: TEST · New customer». One string, written once, read by the list row, the
 *  conversation's own header and the drive. */
export const testLabel = (subject: TestSubject): string =>
  subject.kind === 'existing' ? `TEST · Emulating ${subject.customer.name}` : 'TEST · New customer';

/** The word the composer says the operator is writing AS. In a test chat the messages arrive FROM
 *  the customer, so the person at the desk is typing on the other side of the glass. */
export const asWords = (subject: TestSubject): string =>
  subject.kind === 'existing' ? `Write as ${subject.customer.name}` : 'Write as a new customer';

/* ── THE READING ──────────────────────────────────────────────────────────────────────────── */

/** ONE THING THE MESSAGE ASKED FOR, and what the reference made of it. `said` is always their own
 *  word; everything else is ours, and none of it replaces theirs (§65.3). */
export type Proposed = {
  /** their own word for the goods — «merluza» out of «12 kg merluza» */
  said: string;
  /** the SKU it landed on, where the reference answered */
  product?: Product;
  /** how many forms of it the house sells — §80.2's ambiguity is this number being over one */
  forms: number;
  ambiguous: boolean;
  /** what goes on the line, and in what */
  qty?: number;
  unit: string;
  /** what this customer usually takes of it, where their own memory holds an answer */
  usual?: number;
  /* ── THE LADDER'S RUNGS, AS THE PARSE ANSWERED THEM (THE-DENSE-BRIEF §C) ────────────────────
   * Carried here rather than re-derived downstream, so a correction's training row is labeled by
   * the very reading it disagrees with. L0 is the house's own family object; L1 and L2 are the
   * chips the writing line would have drawn. */
  l0?: string;
  l1?: string;
  l2?: string;
};

/* ── THE FEEDBACK, AND THE MARK IT CARRIES (§10.11) ────────────────────────────────────────────
 * «The user should be able to quickly mark: Correct / Needs correction. If correction is required,
 * make the actual field directly editable. The correction should enter the same evaluation /
 * learning pipeline as a real operator correction, WHILE REMAINING CLEARLY IDENTIFIED AS TEST
 * DATA.»
 *
 * SO THE MARK CARRIES THE FLAG, ALWAYS SET, NEVER OPTIONAL. `test: true` is a literal on the type
 * rather than a boolean a writer might forget: a row of this shape cannot exist unmarked, which is
 * the only way «clearly identified» survives a refactor.
 *
 * AND THE ROW IS THE PIPELINE'S OWN ROW. `TestTrace` is `trace.ts`'s `Trace` — the §C supervised
 * example, the same six fields and the same closed act vocabulary — plus the mark. Nothing about
 * the learning surfaces has to learn a second shape; what they have to do is READ the flag, which
 * §28 leaves open («exact treatment of intentionally adversarial test-chat corrections»).
 */
export type TestMark =
  | { kind: 'correct'; at: string; test: true }
  | {
      kind: 'corrected';
      at: string;
      test: true;
      /** the line it lands on */
      line: string;
      /** what the person put back where Rocoto filled differently */
      word?: { was: string; now: string };
      /** the unit the house actually sells it in */
      unit?: { was: string; now: string };
      /** THE AMOUNT IS RECORDED AND TEACHES NOTHING (trace.ts's own doctrine): an amount is a fact
       *  about this crate, not a name anything learns, so it never becomes a trace row. */
      qty?: { was: string; now: string };
    };

/** ONE TEST CORRECTION, IN THE LEARNING PIPELINE'S OWN SHAPE, MARKED. */
export type TestTrace = Trace & { test: true };

/** The trace rows one marked correction teaches — the acts that teach, and only those. A mark that
 *  moved nothing but the amount teaches nothing and yields none, which is the honest answer. */
export function testTraces(reading: TestReading, mark: TestMark | undefined): TestTrace[] {
  if (!mark || mark.kind !== 'corrected') return [];
  const line = reading.sale.lines.find((l) => l.id === mark.line);
  const p = reading.proposed.find((q) => q.product?.id === line?.product.id);
  const ladder: Ladder = { l0: p?.l0, l1: p?.l1, l2: p?.l2 };
  /* P3'S OWN THREE FIELDS ON A TRACE (§15.1), filled from the reading rather than re-derived: what
     Rocoto decided about this document, the sentence it withheld the reply on, and the state the
     document was in when the correction was taught. A test order never leaves `request` or
     `committed`, and it has no albarán number — so `final` says exactly that and claims nothing. */
  const base = {
    saleId: reading.sale.id,
    line: mark.line,
    product: line?.product.name ?? '',
    ladder,
    policy: reading.policy.id,
    withheld: reading.policy.id === 'act' ? undefined : reading.policy.because,
    final: { state: reading.sale.state } as TraceFinal,
    at: mark.at,
    test: true as const,
  };
  const out: TestTrace[] = [];
  if (mark.word) out.push({ ...base, event: 'correct', before: mark.word.was, after: mark.word.now });
  if (mark.unit) out.push({ ...base, event: 'unit-flip', before: mark.unit.was, after: mark.unit.now });
  return out;
}

/* ══ WHAT THE INSPECTOR SAYS ROCOTO DECIDED (FEED-IA §120.3 · §120.4, sharpening §110) ════════
 *
 * ⚠ THIS TYPE USED TO CARRY A `verdict` AND THE INSPECTOR PAINTED IT. «The whole "act clarify
 * hold the handoff" is wrong… either they need to edit and double-check the delivery note, or
 * they need to reply to the customer. Those are the two actions.» The leak that provoked §120 was
 * exactly here: `POLICY_WORD[p.id]` handed to a chip, so the one surface built to make Rocoto
 * inspectable was teaching a person the machine's four words.
 *
 * WHAT REPLACED IT IS TWO FIELDS, and each one is a different KIND of fact:
 *   `id`     THE MACHINE'S, and it is never painted — `sale.ts`'s own lower-case `PolicyId`,
 *            carried so a trace, a harness and a wiring contract still say what was decided.
 *   `owed`   THE PERSON'S, and it is the only half a surface may draw: EDIT the albarán, REPLY
 *            to the customer, or nothing at all where Rocoto answered and nothing is owed.
 *
 * `because` is unchanged: the one short reason, as the app already writes it. Reasons stay many;
 * actions became two.
 */
export type Policy = {
  /** the machine's own id (§120.3's «unpainted internal ids») — no surface prints this */
  id: PolicyId;
  /** which of the two actions the person owes, and `null` where the document is settled */
  owed: Owed | null;
  because: string;
};

/**
 * WHAT ROCOTO KNEW, WHAT IT DECIDED, AND WHY IT STOPPED — the whole answer to one message.
 *
 * It is a RECORD rather than a fold: a test conversation is a transcript of decisions taken at an
 * hour, so re-deriving it later against a catalogue somebody has since taught would quietly
 * rewrite what the operator saw. It is therefore computed once, when the message is sent, and
 * kept.
 */
export type TestReading = {
  /** the row in the test thread this reading is about */
  row: string;
  /** the sale the message built, as a VALUE — never in the ledger (§10.7) */
  sale: Sale;
  policy: Policy;
  /** the customer context Rocoto had — the memory sentences, or the cold-start's own fact */
  context: string[];
  proposed: Proposed[];
  /** what Rocoto said back on the customer's own channel — EMPTY on a HOLD or a HANDOFF, because
   *  those are abstentions and the silence is the behaviour (§9) */
  replies: string[];
  /** what this message did to the order (§77.5b), where it did anything */
  act?: { did: string; now: string };
  /** the account did not exist — the whole of the cold-start difference, in one flag */
  cold: boolean;
};

/* ── THE WORDS, DECOMPOSED ────────────────────────────────────────────────────────────────── */

/* A MESSAGE IS SEVERAL THINGS ASKED FOR, and a person writes them the way people write them: one
 * per line, or strung on commas and «y». The chip organ reads ONE thing asked for — it is the
 * albarán's writing line — so the message is cut into pieces first and each piece is handed over
 * whole. The cut is stated here and nowhere else. */
const PIECES = /\n|,|;| y | and /i;

const piecesOf = (text: string): string[] =>
  text.split(PIECES).map((p) => p.trim()).filter((p) => p.length > 0);

/** A question is a question — the one shape of message that is not an order at all (§9.3's «the
 *  customer asked something»). Read off the mark they typed, never guessed at. */
const isQuestion = (text: string): boolean => text.includes('?') || text.includes('¿');

/** What this customer usually takes of one product, out of their OWN record — the average across
 *  the albaranes in the window that carried it. It is `knows.ts`'s basket read one number deep,
 *  which is what makes the quantity check mean «far off THEIR usual» rather than «big». */
function usualOf(cast: Cast, customer: Customer, product: Product): number | undefined {
  const line = basketOf(cast, customer).lines.find((l) => l.product.id === product.id);
  if (!line || line.albaranes === 0) return undefined;
  return Math.round((line.qty / line.albaranes) * 100) / 100;
}

/** THE REFERENCE'S ANSWER TO ONE PIECE, at §80's own resolution: the node the words landed on, the
 *  product that grounds onto it, and how many forms of it the house sells. Nothing here reads a
 *  name — ambiguity is a fact about the FAMILY, computed. */
function proposeOne(
  cast: Cast,
  customer: Customer,
  catalogue: CatalogueState,
  registers: ChipRegisters,
  piece: string,
  cold: boolean,
): Proposed | null {
  const read: ChipLine = parseChips(piece, registers);
  if (!read.name) return null;

  /* A GRADUATED SORT IS THE GOODS ITSELF (THE-OBJECT-MAP C7) — asked of the graduated members
     first, and only of them, exactly as the sheet's own add-a-line asks it. */
  const grown = graduatedProducts(cast, catalogue);
  const member = read.sort?.node ? grown.find((p) => graduatedNode(p.id) === read.sort?.node) : undefined;
  const base = member ?? productForNode(cast, read.name.node);
  const forms = base
    ? 1
      + amendmentsOf(cast.sector, catalogue).filter((a) => a.base === base.id).length
      + sortsOf(cast.sector, catalogue).filter((s) => s.under === base.id).length
    : 0;
  const said = resolveWord(base, forms);

  return {
    said: read.name.said.trim() || piece,
    product: base,
    forms,
    ambiguous: said.ambiguous,
    qty: read.quantity,
    unit: read.unit || base?.unit || 'kg',
    usual: base && !cold ? usualOf(cast, customer, base) : undefined,
    /* the rungs, as the parse and the house's own family object answered them */
    l0: base ? cast.families.find((f) => f.id === base.family)?.name : undefined,
    l1: read.name.name,
    l2: read.sort?.name,
  };
}

/* ── THE ORDER THE MESSAGE BUILDS ─────────────────────────────────────────────────────────── */

/** The pseudo-product a word the catalogue has no row for stands on, so the line can exist and say
 *  what it is. It carries the house's first family so the traceability profile is the house's own,
 *  and it is marked `nonSku` on the line, which is where §10's «off-catalogue behavior» is read. */
const offCatalogue = (cast: Cast, said: string): Product => ({
  id: `test-off-${said}`,
  name: said,
  family: cast.families[0]?.id ?? '',
  unit: 'kg',
  variableWeight: false,
  trace: {},
});

/** ONE PROPOSED THING, AS A LINE. Every field is either the parse's or the house's own price; the
 *  three facts that make the net fire — the missing amount, the customer's usual, the word off the
 *  list — are set here and read by `flagsOf` and `openNonSku` exactly as they are on a real one. */
function lineOf(
  cast: Cast,
  customer: Customer,
  p: Proposed,
  i: number,
  day: string,
  cold: boolean,
): SaleLine {
  const product = p.product ?? offCatalogue(cast, p.said);
  const qty = p.qty ?? 0;
  return {
    id: `t${i + 1}`,
    product,
    ordered: qty,
    given: qty,
    unit: p.unit,
    price: p.product ? priceOn(cast, product, bandOf(cast, customer), day) : 0,
    weighed: false,
    /* THE MISSING NUMBER IS A REAL STATE (§2.4's one hold): a word with no amount on it is a line
       whose crate is undetermined, and `flagsOf` reads exactly this field for it. */
    unreadable: p.qty === undefined ? p.said : undefined,
    nonSku: p.product ? undefined : true,
    /* §80.3 — AN AMBIGUOUS WORD IS FILLED AND SAID SO, in the grammar `fillWords` already draws.
       Which brain answered is the whole of the cold-start difference on this line: a warm account
       is filled from its own memory, a cold one from what the house had. */
    asked: p.ambiguous ? p.said : undefined,
    filledBy: p.ambiguous ? (cold ? 'model' : 'memory') : undefined,
    usual: p.usual,
  };
}

/** MIRRORS `sale.ts`'s own readback sentence, which is a module-private const there.
 *  ⚠ SEAM: exporting `readingOf` from `sale.ts` deletes this function and nothing else changes.
 *  It is written out rather than paraphrased so the two cannot drift into two sentences. */
const readbackWords = (customer: Customer, lines: number, day: string): string =>
  `Read from ${customer.channel} as ${lines} ${lines === 1 ? 'line' : 'lines'} for ${day}.`;

/* ── THE POLICY (the P3 seam) ─────────────────────────────────────────────────────────────── */

/**
 * THE VERDICT, AND THE SENTENCE UNDER IT — read straight off `sale.ts` (§9.9).
 *
 * ONE CLAUSE IS THIS SURFACE'S OWN, and it is the cold start. `policyOf` routes a stranger's first
 * order to HANDOFF through `escalationTopicOf`'s `newAccount` topic, which reads `coldStart(sale)`
 * — an empty `historyOf` on a customer the cast holds. The emulated new customer is not in the
 * cast at all, so the fold has nothing to look up; the test says so directly instead, in the
 * sentence `customers-made.ts`'s own law writes: a person opens an account from the name.
 */
export function policyOfTest(sale: Sale, cold: boolean): Policy {
  if (cold) {
    /* A STRANGER'S FIRST ORDER IS A REPLY, and the sentence says what IS: an account gets opened
       from the name they wrote in with. The machine still calls this a handoff, internally. */
    return { id: 'handoff', owed: 'reply', because: 'A person opens the account from their name.' };
  }
  const p = policyOf(sale);
  /* THE TWO-ACTION FOLD IS `tick.tsx`'S, which is `sale.ts`'s own `jobOf` renamed into §120's
     grammar. One fold, one answer — this surface never decides the two actions a second way. */
  return { id: p.id, owed: actionOwed(sale), because: p.says };
}

/* ── THE BRAIN ────────────────────────────────────────────────────────────────────────────── */

/** What the reading needs that only a surface can hold: the house, its catalogue state, and the
 *  private memory the test is being run against. */
export type TestWorld = {
  cast: Cast;
  catalogue: CatalogueState;
  knows: Knows;
};

/** The registers the parser needs and cannot know — its sector and the containers off its own
 *  catalogue. Same two the sheet's own writing line hands over.
 *  ⚠ THE GRADE REGISTER WAS THE THIRD, UNTIL FEED-IA §197.2 «Remove class everywhere». */
export function testRegisters(cast: Cast): ChipRegisters {
  return {
    sector: cast.sector,
    containers: [...new Set(cast.products.map((p) => p.pack?.unit).filter((u): u is string => Boolean(u)))],
  };
}

/** THE CONTEXT ROCOTO HAD, as sentences a person can argue with (§10.9's «customer context used»).
 *  Warm: what the house has actually noticed about this account, plus its own rhythm. Cold: the
 *  one true fact, said as what IS rather than as an absence of things. */
function contextOf(world: TestWorld, subject: TestSubject): string[] {
  if (subject.kind === 'new') {
    return [
      'A first message from a number new to the house.',
      'Rocoto reads what they ask for, as written.',
    ];
  }
  const { cast, knows } = world;
  const customer = subject.customer;
  const out: string[] = [];
  const past = historyOf(cast, customer);
  const basket = basketOf(cast, customer);
  if (past.length > 0) {
    out.push(
      `${past.length} delivery notes on the record · ${soles(basket.typical)} the usual order.`,
    );
  }
  /* THE MEMORY'S OWN SENTENCES (§10.3's routing and fulfilment observations). Two, because two is
     what a panel under a message has room for and what a person reads before acting. */
  for (const o of aboutCustomer(knows, customer.id).slice(0, 2)) out.push(o.sentence);
  return out;
}

/**
 * WHAT ROCOTO SAID BACK, ON THE CUSTOMER'S OWN CHANNEL — and the silences are the point.
 *
 * The checkpoint's own definition of the four: «HOLD — Do not reply yet. Put it into the operator
 * queue» and «HANDOFF — Assign it to the relevant person», with «HOLD and HANDOFF are successful
 * outcomes when acting automatically would be unsafe». So on both of those Rocoto sends NOTHING,
 * and the conversation shows exactly that: the customer's message, and no answer under it. A
 * holding sentence would be the app inventing an act it did not take — and it is the abstention
 * the operator started the test to see.
 *
 * ACT sends the readback. CLARIFY sends the readback and then the one question — both are messages
 * the app already writes, in the app's own words.
 */
/* ── THE TWO LOCKED SENTENCES (THE-LIVE-MATERIAL LM-2 · LM-16) ────────────────────────────────
 * Production proved both, and both are copy the kit did not have.
 *
 *   LM-2   «RECIBIDO», NEVER «CONFIRMADO», until the ERP is wired. Raquel, twice, in
 *          `backend/market_voice.py`: «Mientras no se vincule con mi ERP: "ok, recibido" — no
 *          "confirmado"». The word tracks whether the house can see its own stock, so a house
 *          whose allocation is not wired may say it HAS the message and may not say it has the
 *          goods. Saying «confirmado» there is a promise nothing behind it can keep.
 *   LM-16  THE QUESTION IS «¿ESTÁ BIEN ASÍ?», NEVER «¿lo confirmas?» (`backend/order_receipt.py`).
 *          The customer is checking OUR TRANSCRIPTION — something they can see and answer —
 *          rather than the state of a market stall at 04:00. It is the one sentence that makes an
 *          automated confirmation honest.
 *
 * THEY ARE QUOTED AS THEMSELVES, in Spanish, because they are LOCKED customer-facing copy and this
 * pane is the customer-facing channel — the same standing the trade's own nouns have in this build
 * (albarán, lote, tarifa). Between them stands the ORDER, said back in the goods and amounts they
 * wrote — `orderWords` below, and never the house's own machinery line.
 */
export const RECEIVED_WORD = 'Recibido.';
export const IS_THAT_RIGHT = '¿Está bien así?';

/* ── WHAT GOES OUT IS THE ORDER, NEVER OUR PLUMBING (the acceptance walk, P1-3) ───────────────
 * The customer's own channel carried «Read from WhatsApp as 2 lines for Friday 22.08.» as a plain
 * message bubble. That sentence is `sale.reading` — the HOUSE's machinery line, which the house's
 * own view correctly draws UNDER the bubble — and it tells a restaurant which rail we read them off
 * and how many lines our parser made. Neither is a fact about their order, and neither is anything
 * they can check.
 *
 * SO THE CUSTOMER IS SENT WHAT THEY CAN CHECK: the goods, the amounts, and the day. It is the same
 * ask — «is this right?» — about the thing they actually wrote, and it is read off the very lines
 * the albarán was built from, so the two can never disagree. The machinery line stays exactly where
 * it was, on the house's side (§9.11's own division).
 */
const GOODS_SAID = 3;

const orderWords = (sale: Sale, day: string): string => {
  const said = sale.lines
    .slice(0, GOODS_SAID)
    /* A LINE WHOSE AMOUNT IS STILL OPEN SAYS THE GOODS AND STOPS. «0 kg merluza» would be the app
       inventing a zero on the very message that is asking what the number is. */
    .map((l) => (l.unreadable
      ? l.product.name.toLowerCase()
      : `${qtyWords(l.given, l.unit)} ${l.product.name.toLowerCase()}`))
    .join(' · ');
  const rest = sale.lines.length - GOODS_SAID;
  /* a long order says the first three and counts the rest — a bubble is a message, not a document */
  const tail = rest > 0 ? ` · and ${rest} more` : '';
  return `${said}${tail} — for ${day}.`;
};

function repliesOf(sale: Sale, policy: Policy, day: string): string[] {
  const readback = sale.lines.length > 0 ? orderWords(sale, day) : null;
  /* ACT: the house HAS the message and has read it, and it asks the customer to check the reading
     — never to confirm goods nothing has allocated yet (LM-2, LM-16). */
  if (policy.id === 'act') {
    return readback ? [`${RECEIVED_WORD} ${readback}`, IS_THAT_RIGHT] : [];
  }
  /* CLARIFY: nothing was received whole, so the word is withheld — what goes out is the reading so
     far and the one question Rocoto needs answered. */
  if (policy.id === 'clarify') {
    return [...(readback ? [readback] : []), sale.rocotoAsked ?? policy.because];
  }
  return [];
}

/**
 * ONE TYPED MESSAGE, WALKED THE WAY A REAL ONE IS.
 *
 * `prior` is the order the conversation has built so far, so a second message ADDS to it rather
 * than starting again — which is what makes the pinned overlay (§77.5) and the act line (§77.5b)
 * say something true about a conversation rather than about a message.
 */
export function readTestMessage(
  world: TestWorld,
  subject: TestSubject,
  text: string,
  row: string,
  at: string,
  prior?: Sale,
): TestReading {
  const { cast, catalogue } = world;
  const cold = subject.kind === 'new';
  const customer = subjectCustomer(subject);
  const day = todayId(cast);
  const label = dayLabelFromId(day);
  const registers = testRegisters(cast);

  const proposed = piecesOf(text)
    .map((piece) => proposeOne(cast, customer, catalogue, registers, piece, cold))
    .filter((p): p is Proposed => p !== null);

  /* THE ORDER IS CUMULATIVE. The lines this message adds land after the ones the conversation
     already carried; a word already on the order RAISES its line rather than growing a second. */
  const held = prior ? [...prior.lines] : [];
  const grown: SaleLine[] = [];
  proposed.forEach((p, i) => {
    const fresh = lineOf(cast, customer, p, held.length + i, day, cold);
    const at2 = held.findIndex((l) => l.product.id === fresh.product.id);
    if (at2 >= 0) held[at2] = { ...held[at2], ordered: fresh.ordered, given: fresh.given, unit: fresh.unit, unreadable: fresh.unreadable };
    else grown.push(fresh);
  });
  const lines = [...held, ...grown];

  const asked = isQuestion(text) && proposed.length === 0;
  const needsReply: NeedsReply | undefined = asked
    ? { kind: 'ask', about: 'asks a question that has to be answered' }
    : undefined;

  const thread: ThreadRow[] = [{ id: `${row}-said`, author: 'received', text, time: at }];

  /* ── ROCOTO'S OWN CHECK, WHERE THE HOUSE GRANTED IT (THE-INTELLIGENCE §11) ──────────────────
   * `sale.ts`'s day fold writes exactly this: an unreadable amount plus the `checkIn` grant means
   * Rocoto asks the CUSTOMER rather than the desk, and the question it sends is `askWords`. It is
   * written here for the same reason — so the policy reads one field rather than re-deciding, and
   * so the swap to `sale.ts`'s own `policyOf` changes nothing. */
  const unclear = grantsNow().checkIn ? lines.find((l) => l.unreadable) : undefined;
  const rocotoAsked = unclear ? askWords(unclear) : undefined;
  if (rocotoAsked) thread.push({ id: `${row}-check`, author: 'ai', text: rocotoAsked, time: at });

  const base: Sale = {
    id: `test-${row}`,
    customer,
    at,
    day,
    deliveryDay: label,
    window: windowOf(cast),
    declineUntil: declineUntilOf(cast),
    /* A TEST ORDER IS NEVER `made`, so no surface ever prints this — it is stated rather than
       left blank so the type carries no lie. */
    number: 'TEST',
    lines,
    figure: figureOf(lines),
    /* `request` is «the net is still judging it», which is where every order starts. */
    state: 'request',
    thread,
    reading: readbackWords(customer, lines.length, label),
    stamps: {},
    needsReply,
    rocotoAsked,
    tier: bandOf(cast, customer),
  };

  /* ── THE COMMIT INVERSION, ON A TEST MESSAGE TOO (FEED-IA §6.2 · THE-INTELLIGENCE §11) ───────
   * «The machine committed it on arrival — nothing about it needed judging.» That is what makes
   * ACT reachable at all: an order the six checks pass, in a house that granted the confirm, is
   * COMMITTED by Rocoto the moment it lands, and the readback goes out with it.
   *
   * IT IS TWO STEPS BECAUSE `flagsOf` IS. A flag is «a reading of an order still being judged», so
   * it stops firing the instant the state moves off `request` — asking the net about the committed
   * document would be asking it about a decision already taken. So the net judges the REQUEST, and
   * the answer decides the state.
   */
  const clean = !cold && passesNet(base) && grantsNow().confirm;
  const sale: Sale = clean
    ? { ...base, state: 'committed', autoCommitted: true, stamps: { commit: at } }
    : base;

  const policy = policyOfTest(sale, cold);
  const replies = repliesOf(sale, policy, label);

  /* THE ACT LINE (§77.5b) — «show tool calls, so we know when a message caused the order to
     update». It exists only where the order actually moved, and that silence is the law. */
  const money = `${lines.length} ${lines.length === 1 ? 'line' : 'lines'} · ${soles(sale.figure)}`;
  const act = grown.length === 0 && (!prior || prior.lines.length === lines.length)
    ? undefined
    : {
        did: prior && prior.lines.length > 0
          ? `Added ${grown.map((l) => l.product.name).join(' and ') || 'to the order'}`
          : `Opened the order for ${label}`,
        now: money,
      };

  return {
    row,
    sale,
    policy,
    context: contextOf(world, subject),
    proposed,
    replies,
    act: lines.length > 0 ? act : undefined,
    cold,
  };
}

/** The hour a test turn takes — the house's own morning, stepped so a conversation reads forward.
 *  Never the machine's clock: every other hour on this screen is the day's. */
export const testHour = (cast: Cast, turns: number): string => clockAfter(nowOf(cast), turns);

/* ══ THE SELECTOR (§10.3, §10.4) ═════════════════════════════════════════════════════════════
 * «Clicking it opens a small selector before the conversation begins. Step 1 — Who do you want to
 * test as?»
 *
 * TWO PATHS, AND THE FIRST ONE IS THE HOUSE'S OWN BOOK. §10.3 asks for search, recent / important
 * customers, the company name and «lightweight context such as last order date or usual
 * categories where useful» — every one of them read off the record rather than typed in.
 *
 * THE SEAT IS THE APP'S OWN (§35.1). `SearchSeat` and `matches` are the same grammar Sales, the
 * customers book and the chat list search with, so a person finds an account here the way they
 * find one everywhere.
 */

/** how many accounts stand under the seat before a person types — a shortlist, not a book */
const SHORTLIST = 5;

/** ONE ROW OF THE SHORTLIST, and its lightweight context: the day their last albarán went out and
 *  the goods they usually take. Both are folds of the record; neither is a number this file makes
 *  up, and an account with no record says only its name. */
type Candidate = {
  customer: Customer;
  because: string;
  /** the one thing Rocoto has noticed about this account, where it has noticed anything */
  noticed?: string;
  figure: number;
  words: string[];
};

function candidatesOf(cast: Cast, knows: Knows, threadCustomers: string[]): Candidate[] {
  const seen = new Set<string>();
  const out: Candidate[] = [];
  const add = (customer: Customer, because: string) => {
    if (seen.has(customer.id)) return;
    seen.add(customer.id);
    const past = historyOf(cast, customer);
    const basket = basketOf(cast, customer);
    const usual = basket.lines.slice(0, 2).map((l) => l.product.name).join(' · ');
    /* AND THE MEMORY'S OWN SENTENCE WHERE IT HAS ONE (§10.3's «lightweight context», map 10.4).
       `aboutCustomer` is the same `Observation` the customer's sheet reads — their rhythm, what
       the house actually fulfils their words with — so the picker and the sheet agree. */
    const noticed = aboutCustomer(knows, customer.id)[0]?.sentence;
    out.push({
      customer,
      /* THE CONTEXT §10.3 ASKS FOR, «where useful»: the last order's own day, what they take, and
         the one thing Rocoto has noticed. Where the record holds none of it, the row says the
         reason it is on the list and stops. */
      because: past.length > 0
        ? `Last order ${past[0].day}${usual ? ` · ${usual}` : ''}`
        : because,
      noticed,
      figure: basket.typical,
      words: wordsOf([customer.name, usual, noticed]),
    });
  };
  /* RECENT FIRST — the conversations the morning is actually carrying, newest first, which is the
     order the chat book itself stands in. */
  for (const id of threadCustomers) {
    const customer = cast.customers.find((c) => c.id === id);
    if (customer) add(customer, 'In the morning’s conversations');
  }
  /* THEN IMPORTANT — the accounts whose usual order is biggest. «Important» is a reading of the
     record, so it is the record that ranks them. */
  const byFigure = [...cast.customers]
    .map((customer) => ({ customer, typical: basketOf(cast, customer).typical }))
    .sort((a, b) => b.typical - a.typical);
  for (const { customer } of byFigure) add(customer, 'One of the house’s biggest accounts');
  return out;
}

function PathHead({ title, says }: { title: string; says: string }) {
  const [, theme] = useStyletron();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <span style={{ ...theme.typography.LabelMedium }}>{title}</span>
      <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary }}>{says}</span>
    </div>
  );
}

export function TestSelector({
  cast,
  recent,
  isOpen,
  onClose,
  onStart,
}: {
  cast: Cast;
  /** the customers the book is carrying today, newest conversation first */
  recent: string[];
  isOpen: boolean;
  onClose: () => void;
  onStart: (subject: TestSubject) => void;
}) {
  const [, theme] = useStyletron();
  const knows = useKnows(cast);
  const [query, setQuery] = React.useState('');
  const terms = React.useMemo(() => termsOf(query), [query]);
  const all = React.useMemo(() => candidatesOf(cast, knows, recent), [cast, knows, recent]);
  const shown = React.useMemo(
    () => (terms.length === 0 ? all.slice(0, SHORTLIST) : all.filter((c) => matches(terms, c.words)).slice(0, 12)),
    [all, terms],
  );

  React.useEffect(() => {
    if (!isOpen) setQuery('');
  }, [isOpen]);

  return (
    <OverlayCard
      isOpen={isOpen}
      onClose={onClose}
      size={560}
      ariaLabel="New test chat"
      /* THE CARD IS OPENED FROM INSIDE THE CHAT PANEL, which stands on rung 9 (`chats.tsx`), and
         this component's own layer rests at 8 — so without this the selector would paint UNDER
         the list it was opened from. 11 puts it over the panel and under the popovers Base opens
         from inside it (12), which is the same ladder the panel itself documents. */
      overrides={{ Root: { style: { zIndex: 11 } } }}
    >
      {/* the card brings its own gutter (`OverlayCard`'s `pad`), so this only stacks the block */}
      <div
        data-testid="test-selector"
        style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}
      >
        {/* THE HEADING NAMES THE THING (the content canon). The question §10.3 asks, said the way
            a person would ask it, and nothing under it explaining the screen. */}
        <h2 data-testid="test-selector-title" style={{ margin: 0, ...theme.typography.HeadingXSmall }}>
          Who do you want to test as?
        </h2>

        {/* ── PATH ONE · THE HOUSE'S OWN BOOK (§10.3) ────────────────────────────────────────── */}
        <div data-testid="test-path-existing" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale400, minWidth: 0 }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <PathHead title="Existing customer" says="Their own memory answers, exactly as it does in production." />
            </span>
            <SearchSeat value={query} onChange={setQuery} label="Find a customer" testid="test-search" />
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              maxHeight: 320,
              overflowY: 'auto',
              overflowX: 'clip',
              border: `1px solid ${theme.colors.borderOpaque}`,
              borderRadius: theme.borders.radius300,
              minWidth: 0,
            }}
          >
            {shown.map((c) => (
              <CandidateRow key={c.customer.id} candidate={c} terms={terms} onStart={() => onStart({ kind: 'existing', customer: c.customer })} />
            ))}
            {shown.length === 0 && (
              <p
                data-testid="test-search-empty"
                style={{ margin: 0, padding: theme.sizing.scale600, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}
              >
                {`0 accounts match “${query.trim()}”. Try the company’s own name.`}
              </p>
            )}
          </div>
        </div>

        {/* ── PATH TWO · THE COLD START (§10.3) ─────────────────────────────────────────────── */}
        <div
          data-testid="test-path-new"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.sizing.scale500,
            padding: theme.sizing.scale500,
            border: `1px solid ${theme.colors.borderOpaque}`,
            borderRadius: theme.borders.radius300,
            minWidth: 0,
          }}
        >
          <span style={{ flex: 1, minWidth: 0 }}>
            <PathHead title="New customer" says="An unknown number writing in for the first time." />
          </span>
          <Button
            kind={KIND.secondary}
            size={SIZE.compact}
            shape={SHAPE.pill}
            data-testid="test-start-new"
            onClick={() => onStart({ kind: 'new' })}
          >
            Start test as a new customer
          </Button>
        </div>
      </div>
    </OverlayCard>
  );
}

/** ONE ACCOUNT ON THE SHORTLIST. The name leads, the record's own context sits under it, and the
 *  verb §10.3 writes — «Start test as [Customer]» — is the row's own act. */
function CandidateRow({
  candidate,
  terms,
  onStart,
}: {
  candidate: Candidate;
  terms: string[];
  onStart: () => void;
}) {
  const [, theme] = useStyletron();
  const [over, setOver] = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  const { customer } = candidate;
  return (
    <button
      type="button"
      data-testid="test-candidate"
      data-customer={customer.id}
      onClick={onStart}
      onMouseEnter={() => setOver(true)}
      onMouseLeave={() => setOver(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      aria-label={`Start test as ${customer.name}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: theme.sizing.scale400,
        width: '100%',
        boxSizing: 'border-box',
        padding: `${theme.sizing.scale400} ${theme.sizing.scale500}`,
        border: 'none',
        borderBottom: `1px solid ${theme.colors.borderOpaque}`,
        background: over ? theme.colors.backgroundSecondary : 'transparent',
        color: theme.colors.contentPrimary,
        textAlign: 'left',
        cursor: 'pointer',
        fontFamily: 'inherit',
        minWidth: 0,
      }}
    >
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ ...theme.typography.LabelSmall, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <Mark text={customer.name} terms={terms} />
        </span>
        <span
          data-testid="test-candidate-context"
          style={{
            ...theme.typography.ParagraphXSmall,
            color: theme.colors.contentTertiary,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {candidate.noticed ? `${candidate.because} · ${candidate.noticed}` : candidate.because}
        </span>
      </span>
      {candidate.figure > 0 && (
        <span style={{ flex: '0 0 auto', whiteSpace: 'nowrap' }}>
          <Figure value={candidate.figure} unit="S/" decimals={2} size="compact" locale="en-PE" />
        </span>
      )}
      {/* THE VERB §10.3 WRITES, VERBATIM — and it RIDES THE HOVER, because at rest it repeats the
          name standing two inches to its left (§25.5: a label saying what position already says).
          It is the row's own affordance: on hover, on focus, and to a screen reader through the
          button's own label — never a footer, so the pick stays one press. */}
      {(over || focused) && (
        <span
          data-testid="test-start-existing"
          style={{
            ...theme.typography.LabelXSmall,
            color: theme.colors.contentPrimary,
            flex: '0 0 auto',
            whiteSpace: 'nowrap',
          }}
        >
          {`Start test as ${customer.name}`}
        </span>
      )}
    </button>
  );
}

/* ── THE ACTION IN THE BOOK'S HEADER (§10.2) ───────────────────────────────────────────────── */

/** «Inside Chats, include an explicit action: New test chat.» One control, in the list header's
 *  own actions seat, wearing the app's own mark for a thing being written. */
export function NewTestChatAction({ onOpen }: { onOpen: () => void }) {
  const [, theme] = useStyletron();
  return (
    <span style={{ display: 'inline-flex', flex: '0 0 auto' }} title="New test chat">
      <Button
        kind={KIND.tertiary}
        size={SIZE.default}
        shape={SHAPE.circle}
        onClick={onOpen}
        data-testid="new-test-chat"
        aria-label="New test chat"
        overrides={{ BaseButton: { style: { width: '48px', height: '48px' } } }}
      >
        <Glyph id="draft" size={STEP.small} />
      </Button>
    </span>
  );
}

/* ── WHAT A SURFACE NEEDS TO RUN ONE ──────────────────────────────────────────────────────── */

/** The world a test chat is read against, assembled from the stores that already hold it. One
 *  hook, so a surface never wires four of them. */
export function useTestWorld(): TestWorld {
  const { derived } = useConfig();
  const cast = derived.cast;
  const catalogue = useCatalogue();
  const knows = useKnows(cast);
  return React.useMemo(
    () => ({ cast, catalogue: catalogue.state, knows }),
    [cast, catalogue.state, knows],
  );
}

/** The proposal a panel prints, said in the app's own words: the amount and its unit together. */
export const proposedQty = (p: Proposed): string =>
  p.qty === undefined ? '—' : qtyWords(p.qty, p.unit);

/* ══ THE ROLEPLAY (FEED-IA §91.4.8) ══════════════════════════════════════════════════════════
 * «The test chat wears the ROLEPLAYING UI of the current .com/demo, rebuilt in the kit: TWO
 * VIEWS, toggleable — the WhatsApp side (the customer's, WhatsApp colors) and their side (the
 * house's view). They START as the WhatsApp side, with a SUGGESTED first message (an order —
 * suggestions offered in every test-chat situation).»
 *
 * ═══ THE GRAMMAR IS LIFTED FROM THE .COM DEMO, WHICH ALREADY SOLVED THIS ════════════════════
 * `webapp/src/demo/ChatScreen.tsx` states the law this rebuild keeps, in its own words: «TWO
 * RENDERERS OVER ONE LOG… Flipping re-renders; it never re-fetches, never restarts and never
 * drops a message» and «ONE of everything: one Composer component, two instances… one set of
 * bubbles, WhatsApp's look coming only from a scoped re-declaration of the chat's custom
 * properties».
 *
 * EVERY CLAUSE SURVIVES THE REBUILD, in the kit's own materials:
 *   ONE LOG           both views read `thread.rows`. There is no second store and no second fetch,
 *                     so flipping cannot drop or reorder a message — it is the same array, drawn.
 *   ONE BUBBLE        the same `Message` component, with the same overrides object handed in by
 *                     the housing, so a change to the chat's bubble geometry changes this pane.
 *   ONE COMPOSER      the same `Composer`, mounted once by `ThreadView` under both views. The two
 *                     SPEAKERS are the difference the demo names: on the customer's side the words
 *                     go through the order brain; on the house's side they are the house talking.
 *   THE PAINT ONLY    `whatsappTheme` re-points four roles on a copy of the live theme. The type,
 *                     the spacing, the radii and the elevation stay the kit's.
 *
 * ═══ AND THE AUTHORS MIRROR, WHICH IS THE WHOLE OF «THE CUSTOMER'S VIEW» ═══════════════════
 * A test conversation's rows are written from the house's side: what the operator types arrives as
 * `received` and Rocoto answers as `ai`. On the CUSTOMER'S phone those are the other way round —
 * their own words go out on the right in green, and everything from the house arrives on the left
 * in white. The mapping is one function, and it is the only thing this renderer decides.
 */

/** WHICH SIDE OF THE GLASS THE OPERATOR IS LOOKING FROM. `customer` is where a roleplay starts. */
export type TestView = 'customer' | 'house';

/** THE TWO TABS, said the way the demo says them — «what your customer sees» and «what you see». */
export const TEST_VIEWS: Array<{ id: TestView; label: string; glyph: GlyphId }> = [
  { id: 'customer', label: 'What your customer sees', glyph: 'chat' },
  { id: 'house', label: 'What you see', glyph: 'brand' },
];

export function TestViewTabs({ view, onView }: { view: TestView; onView: (next: TestView) => void }) {
  const [, theme] = useStyletron();
  return (
    <div
      data-testid="test-views"
      data-view={view}
      role="tablist"
      aria-label="How to look at the conversation"
      style={{
        display: 'flex',
        gap: theme.sizing.scale300,
        padding: `${theme.sizing.scale300} ${theme.sizing.scale500}`,
        borderBottom: `1px solid ${theme.colors.borderOpaque}`,
        background: theme.colors.backgroundPrimary,
        flex: '0 0 auto',
        minWidth: 0,
      }}
    >
      {TEST_VIEWS.map((v) => {
        const on = v.id === view;
        return (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={on}
            data-testid={`test-view-${v.id}`}
            data-on={on ? 'yes' : 'no'}
            onClick={() => onView(v.id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: theme.sizing.scale200,
              /* THE HEIGHT NEVER MOVES BETWEEN STATES (§37.3): the selected tab is INK and an
                 underline, never a taller box — a tab row that grew on selection would jog the
                 conversation under it every time somebody flipped. */
              padding: `${theme.sizing.scale200} ${theme.sizing.scale300}`,
              border: 'none',
              borderBottom: `2px solid ${on ? theme.colors.contentPrimary : 'transparent'}`,
              background: 'transparent',
              ...theme.typography.LabelXSmall,
              color: on ? theme.colors.contentPrimary : theme.colors.contentTertiary,
              cursor: 'pointer',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
              minWidth: 0,
            }}
          >
            <Glyph id={v.glyph} size={STEP.small} />
            {v.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── THE SUGGESTED FIRST MESSAGE (§91.4.8, in §83.2's grammar) ────────────────────────────────
 * «A SUGGESTED first message (an order) — suggestions offered in every test-chat situation.»
 *
 * OFFERED, NEVER IMPOSED. §83.2's doctrine line — «we make AI available but don't impose it» — so
 * the suggestions are a quiet row above the composer that leaves the moment there is a
 * conversation, and pressing one WRITES IT INTO THE FIELD rather than sending it: the operator is
 * roleplaying, and putting words in their mouth and sending them is not an offer.
 *
 * AND EVERY ONE OF THEM IS THE HOUSE'S OWN WORDS. The first is the cast's own recorded customer
 * order, verbatim. The second is this account's own biggest line, as an order. The third is the
 * same goods with no amount, which is the shape that makes Rocoto ask — the case the operator most
 * wants to see. A cold start gets the two a stranger actually sends. Nothing is invented.
 */
/** ONE SUGGESTION, AND WHERE IT CAME FROM. The source is carried so the row can be checked — a
 *  suggestion whose provenance cannot be named is a sentence somebody invented. */
export type Suggestion = { words: string; source: string };

export function suggestionsFor(cast: Cast, subject: TestSubject): Suggestion[] {
  /* THE COLD START'S SUGGESTIONS ARE A DIFFERENT KIND, because there is no history to draw on: a
     first contact, a word off the house's list, and an order with nowhere to take it. Each is
     still the house's own material — its catalogue, and the reference's own neighbours. */
  if (subject.kind === 'new') {
    const first = cast.products[0];
    const near = first ? nearbyNodes(ground(first.name, first.family))[0] : undefined;
    return [
      { words: 'Hola, nos han pasado vuestro contacto.', source: 'a first contact' },
      first
        ? { words: `10 ${first.unit} ${first.name.toLowerCase()}`, source: 'an order still to match to an account' }
        : null,
      near ? { words: near.name.toLowerCase(), source: 'a word off the house’s list' } : null,
    ].filter((s): s is Suggestion => s !== null);
  }

  const customer = subject.customer;
  const favourites = frequentOf(cast, customer, 3).rows;
  const basket = basketOf(cast, customer);
  const top = basket.lines[0];
  /* THE SECOND LINE OF THEIR OWN SHELF, so the row holds four DIFFERENT asks. The first build drew
     «8,9 kg rape» beside «89 kg rape» beside «rape» — three chips about one product, which reads as
     a list that failed to vary rather than as four cases worth trying (the walk, P1-16). */
  const second = basket.lines[1] ?? top;
  const usual = top && top.albaranes > 0 ? Math.round((top.qty / top.albaranes) * 10) / 10 : 0;
  const usualSecond = second && second.albaranes > 0
    ? Math.round((second.qty / second.albaranes) * 10) / 10
    : 0;
  /* THE AMBIGUOUS ASK (§80.2): a word whose family holds more than one member, which is ambiguous
     by construction whatever the string says. The reference's own neighbours answer it. */
  const ambiguous = top ? nearbyNodes(ground(top.product.name, top.product.family)).length > 1 : false;
  /* WHAT THIS HOUSE DOES NOT SELL, read off the reference rather than typed. «una caja de wagyu»
     was one hard-coded string, IDENTICAL in a fish house and a meat one — and in the meat house
     wagyu is not obviously off the list at all. The neighbour of something they do sell, with no
     row in their own catalogue, is the same case made out of their own material. */
  const stranger = top
    ? nearbyNodes(ground(top.product.name, top.product.family))
      .find((n) => !cast.products.some((p) => p.name.toLowerCase() === n.name.toLowerCase()))
    : undefined;

  /* ── AND EVERY ONE OF THEM IS A MESSAGE (§91.4.8: «a suggested first message (an order)») ────
     A chip that reads «8,9 kg rape» is a line of an albarán, not a thing a restaurant sends at
     06:40. These are written the way the trade writes them — a greeting, an imperative, a day —
     over the house's own figures, which is also the shape the parser has to survive. */
  return [
    /* their usual order, in the house's own words for the goods */
    favourites[0] && usual > 0
      ? {
        words: `Hola, ponme ${amountWords(usual)} ${top.unit} de ${favourites[0].phrase.toLowerCase()}`,
        source: 'their usual order',
      }
      : null,
    /* an unusual quantity — their own rhythm, exceeded, which is what the quantity check is for */
    second && usualSecond > 0
      ? {
        words: `Necesito ${amountWords(Math.round(usualSecond * 10))} ${second.unit} de ${second.product.name.toLowerCase()} para mañana`,
        source: 'far past their usual',
      }
      : null,
    /* a genuinely ambiguous ask: the goods named with no form said, where the house sells more
       than one of them — an amount rides it, so what is open is the WORD and nothing else */
    top && ambiguous
      ? {
        words: `Mándame ${top.product.name.toLowerCase()}, lo de siempre`,
        source: 'ambiguous — more than one form in the house',
      }
      : null,
    /* something the catalogue has no row for, out of this house's own neighbourhood */
    stranger
      ? { words: `Y ponme una caja de ${stranger.name.toLowerCase()}`, source: 'off the catalogue' }
      : null,
  ].filter((s): s is Suggestion => s !== null).slice(0, 4);
}

export function Suggestions({ rows, onPick }: { rows: Suggestion[]; onPick: (w: string) => void }) {
  const [, theme] = useStyletron();
  if (rows.length === 0) return null;
  return (
    <div
      data-testid="test-suggestions"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: theme.sizing.scale300,
        flexWrap: 'wrap',
        padding: `0 ${theme.sizing.scale500} ${theme.sizing.scale300}`,
        minWidth: 0,
      }}
    >
      <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary, flex: '0 0 auto' }}>
        Try one of these
      </span>
      {rows.map((s) => (
        <Button
          key={s.words}
          kind={KIND.secondary}
          size={SIZE.mini}
          shape={SHAPE.pill}
          data-testid="test-suggestion"
          /* THE SOURCE RIDES THE CHIP AS DATA, AND NEVER AS A FACE (§4.4 · §109.7). A suggestion
             whose provenance cannot be named is a sentence somebody invented, so the provenance is
             carried — in the attribute a drive and a trace read. What it no longer does is SAY
             itself to the person: «the plain-history rule» puts the items on the surface and the
             method in the code, so the tooltip that named the algorithm is gone. */
          data-source={s.source}
          onClick={() => onPick(s.words)}
          overrides={{ BaseButton: { style: { maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } } }}
        >
          {s.words}
        </Button>
      ))}
    </div>
  );
}

/* ── THE EMULATED PHONE ───────────────────────────────────────────────────────────────────── */

/** WHAT THE KIT GENUINELY DOES NOT HAVE, because the kit is not WhatsApp: the white top bar with
 *  the house's own name on it. Everything else in this pane is the chat's own component. */
function PhoneTop({ house }: { house: string }) {
  const [, theme] = useStyletron();
  return (
    <div
      data-testid="wa-top"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: theme.sizing.scale400,
        padding: `${theme.sizing.scale400} ${theme.sizing.scale500}`,
        background: theme.colors.backgroundPrimary,
        borderBottom: `1px solid ${theme.colors.borderOpaque}`,
        flex: '0 0 auto',
        minWidth: 0,
      }}
    >
      <span aria-hidden="true" style={{ flex: '0 0 auto', display: 'inline-flex' }}>
        <Avatar name={house} size="scale900" />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          data-testid="wa-top-name"
          style={{ ...theme.typography.LabelSmall, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {house}
        </span>
        <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary, display: 'block' }}>
          online
        </span>
      </span>
    </div>
  );
}

/** ONE TURN, ON THE CUSTOMER'S PHONE. The author mirrors and nothing else changes. */
const mirrored = (author: 'received' | 'sent' | 'ai'): 'sent' | 'received' =>
  author === 'received' ? 'sent' : 'received';

export type PhoneTurn = {
  id: string;
  author: 'received' | 'sent' | 'ai';
  text: string;
  grouped?: boolean;
  voice?: VoiceNote;
  picture?: Picture;
};

/**
 * «LO QUE VE TU CLIENTE» — the same log, drawn from the other side of the glass.
 *
 * IT DRAWS THE MESSAGES AND NOTHING ELSE. No order card, no act line, no inspector: a customer's
 * phone carries none of those, and putting them here would make the pane a lie about the one thing
 * it exists to show. The house's own view carries all three.
 */
export function WhatsappPane({
  house,
  rows,
  bubble,
  onOpenPhoto,
  children,
}: {
  house: string;
  rows: PhoneTurn[];
  /** the chat's own bubble overrides, handed in — one geometry, two renderers */
  bubble: unknown;
  onOpenPhoto?: (picture: Picture) => void;
  /** the composer, mounted once by the housing and passed through */
  children?: React.ReactNode;
}) {
  const [, base] = useStyletron();
  const theme = React.useMemo(() => whatsappTheme(base as never), [base]);
  const port = React.useRef<HTMLDivElement>(null);
  /* A PHONE CARRIES ONLY WHAT WAS SAID. The house's own stream also holds rows that exist to carry
     an act line or a card; on the customer's side those are not messages, and an empty bubble
     where one stood would be this pane inventing a message nobody sent. */
  const said = React.useMemo(
    () => rows.filter((r) => r.text || r.voice || r.picture),
    [rows],
  );
  React.useEffect(() => {
    const el = port.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [said.length]);

  return (
    <ThemeProvider theme={theme as never}>
      <div
        data-testid="wa-pane"
        style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, minWidth: 0, background: theme.colors.mono100 }}
      >
        <PhoneTop house={house} />
        <div
          ref={port}
          data-testid="wa-thread"
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'clip',
            minHeight: 0,
            minWidth: 0,
            /* A PHONE'S TALK RESTS ON THE BOTTOM OF THE GLASS. Two messages stacked at the top of
               a full-height wallpaper read as a screen that failed to load; anchored at the foot
               they read as a conversation that has just started, which is what they are. */
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            padding: `${theme.sizing.scale400} ${theme.sizing.scale400} ${theme.sizing.scale600}`,
            /* THE WALLPAPER IS THE RE-THEMED GROUND, not a picture: the kit ships no doodle and a
               fetched one would be an asset with no licence in this repo. The pane still reads as
               a phone because the bubbles, the bar and the green do the work. */
            background: theme.colors.mono100,
          }}
        >
          {said.map((r) => (
            <Message
              key={r.id}
              author={mirrored(r.author) === 'sent' ? AUTHOR.sent : AUTHOR.received}
              status={mirrored(r.author) === 'sent' ? 'sent' : undefined}
              grouped={r.grouped}
              photo={r.picture ? { src: r.picture.src, alt: r.picture.alt, aspectRatio: r.picture.aspectRatio } : undefined}
              onOpenPhoto={r.picture && onOpenPhoto ? () => onOpenPhoto(r.picture as Picture) : undefined}
              slot={r.voice ? <VoiceNoteBody note={r.voice} testid={`wa-voice-${r.id}`} /> : undefined}
              overrides={bubble as never}
            >
              {r.text || undefined}
            </Message>
          ))}
          {said.length === 0 && (
            <p
              data-testid="wa-empty"
              style={{ margin: 0, padding: theme.sizing.scale600, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}
            >
              Write the first message as the customer.
            </p>
          )}
        </div>
        {children}
      </div>
    </ThemeProvider>
  );
}

/* ── THE EVENTS THE GUIDE CONSUMES (FEED-IA §91.4.7 · §27.16) ─────────────────────────────────
 * «The guide allows ONE act… bubble → the chat → full screen → New test chat», and then the
 * roleplay's own beats. The guided layer is another package's; ROCOTO OWNS THE STATE, so what this
 * one publishes is FACTS ABOUT WHAT HAPPENED and never a step number.
 *
 * They are DOM CustomEvents on `window` for the same reason the chat notices are a pure function
 * in `sale.ts`: the two packages meet at one named seam, neither imports the other, and a drive
 * can listen to the seam from outside. The names are stable and the payloads are small.
 *
 *   rocoto:test-selector   the selector opened — the «New test chat» press landed
 *   rocoto:test-started    a roleplay began           { thread, cold }
 *   rocoto:test-sent       a message went as the customer { thread, suggested }
 *   rocoto:test-replied    Rocoto answered            { thread, policy, owed }
 *                          ⚠ §120.3 CHANGED THIS PAYLOAD. It carried `verdict: 'CLARIFY'` — the
 *                          checkpoint's own upper-case word — and a guide that read it would have
 *                          had the four words to say. It now carries the machine's LOWER-CASE id
 *                          and, beside it, the fact a surface may actually draw: which of the two
 *                          actions the person owes, `edit` · `reply` · `none`.
 *   rocoto:test-view       the operator flipped sides { thread, view }
 *   rocoto:test-free       a message that was NOT a suggestion — free testing has begun
 */
export const TEST_EVENTS = {
  selector: 'rocoto:test-selector',
  started: 'rocoto:test-started',
  sent: 'rocoto:test-sent',
  replied: 'rocoto:test-replied',
  view: 'rocoto:test-view',
  free: 'rocoto:test-free',
} as const;

/* ── AND THE OTHER DIRECTION: «NEXT PERFORMS THE ACT» (THE-JOURNEY-CANON §3.4.6, §4.5) ─────────
 * «Each beat advances on the real act OR on Next, and NEXT PERFORMS THE ACT.» A guide that only
 * highlighted would leave a person who pressed Next on a screen that had not moved, which is the
 * whole failure mode of a tour.
 *
 * SO THE GUIDE ASKS AND ROCOTO ACTS. One event in, carrying the act by name; the test chat does
 * it with its own hands, publishes the same facts it publishes when a person does it, and the
 * guide learns what happened from those. Nothing reaches into a component's state, and the guide
 * can neither invent a message nor put the surface into a posture the surface would refuse.
 *
 *   { act: 'send-suggested' }        the first suggested chip is written and sent
 *   { act: 'flip', view: 'house' }   the toggle moves
 *   { act: 'open-panel' }            the newest inspector is opened and walked to
 */
export const TEST_DO = 'rocoto:test-do';

export type TestCommand =
  | { act: 'send-suggested' }
  | { act: 'flip'; view: TestView }
  | { act: 'open-panel' };

export function announce(name: string, detail?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(name, { detail }));
}
