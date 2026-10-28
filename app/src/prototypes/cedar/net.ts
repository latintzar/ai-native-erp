/* THE NET — the six checks that stand over every order, named in one place (FEED-IA §32.B, §33.2).
 *
 * ═══ WHY THIS FILE EXISTS ════════════════════════════════════════════════════════════════════
 * «How do they know they're fine? — trust is not a vibe about 200 orders; it is trust in THE NET:
 * the fine ones are fine BECAUSE everything unusual got caught. So the UI's job is making the NET
 * LEGIBLE — the band IS the proof, and the grants screen is the dial.» (§32.B)
 *
 * The checks were always running. They were running in three different files under three different
 * names — a flag kind here, a predicate there, a grant somewhere else — so nothing on any screen
 * could say what stood guard, and a person pressing «Print 285 new» was trusting a feeling. This
 * module is the one register of them: each check with the trade's own word for it, the sentence
 * saying what it catches, the grant that sets it where a house sets one, and the predicate that
 * decides. Three surfaces read it and none of them writes their own copy of the list:
 *
 *   · the BAND's header line and its empty state (§33.2 — «trusting the mass is trusting named
 *     checks», and «Everything today passed the six checks · 288 confirmed alone»)
 *   · SETTINGS' grants section, where every dial says which check reads it
 *   · anything later that wants the same words — a report, an onboarding, the backend
 *
 * ═══ IT ASSERTS NOTHING IT CANNOT COUNT ══════════════════════════════════════════════════════
 * Every check here is a predicate over a real `Sale`, so every number a surface prints is a number
 * this file can be asked for. Nothing about the net is a claim in copy.
 *
 * THE SIXTH HAS NO DIAL, AND THAT IS THE POINT. Five checks are things a house decides how far to
 * trust; the change check is not negotiable, because a pick or a paper that stopped describing the
 * crate is wrong however much anybody trusts the software. Settings says so in one line rather than
 * drawing a control that cannot move.
 *
 * ═══ WHAT IT SAYS, IT SAYS AS WHAT IS ════════════════════════════════════════════════════════
 * Peter's standing law on negatives. Every `catches` sentence below states the thing that happens —
 * «stands for your yes», «comes back to you» — rather than the absence it is guarding against.
 *
 * ═══ A CHECK IS SHOWN AS A CHECK; ITS NAME IS ITS SUBJECT (FEED-IA §111.8) ═══════════════════
 * «Why is it calling "the" something "check" when it can just show the visual thing that it's a
 * check and put the name on it… or "Checking X…"» — Peter, S3, 2026-08-29.
 *
 * So the word «check» left the names. Every check now carries THREE strings and a mark:
 *
 *   `name`      the SUBJECT it stands over — «Quantity», «Money», «What changed». It is drawn
 *               beside `CHECK_MARK`, and the mark is what says the word the name no longer does.
 *   `checking`  the present tense, for the beat while it runs — «Checking the quantity…».
 *   `catches`   unchanged: the one sentence saying what it catches, as the thing that happens.
 *
 * «The quantity check» was the same noun six times with one word changing inside it, and the word
 * that changed was the only one carrying information. A mark costs 16px and says it once.
 */
import type { GlyphId } from './glyphs';
import type { GrantId } from './grants';
import {
  flagsOf, isDraft, isStanding, openNonSku, policyCounts, policyOf, type PolicyId, type Sale,
  standingConcernsOf,
} from './sale';

export type CheckId = 'quantity' | 'money' | 'amount' | 'catalogue' | 'question' | 'change';

/** THE MARK EVERY CHECK WEARS (§111.8, §30's one-mark-one-meaning). A surface DRAWS this beside
 *  `name`; nothing writes the word «check» into a name again. One glyph, one home, so the band,
 *  Settings, the stage and any report cannot each pick their own. */
export const CHECK_MARK: GlyphId = 'check';

export type Check = {
  id: CheckId;
  /** the SUBJECT it stands over, in the trade's own word — drawn beside `CHECK_MARK`, never
   *  wearing the word «check» itself (§111.8) */
  name: string;
  /** the present tense, for the beat while it runs: «Checking the quantity…» (§111.8) */
  checking: string;
  /** the one sentence saying what it catches, written as the thing that happens */
  catches: string;
  /** the dial a house turns on it, where a house turns one */
  grant?: GrantId;
  /** does this order trip it, right now. Derived, so raising a grant clears it on the next read. */
  caught: (sale: Sale) => boolean;
};

/** THE SIX, IN THE ORDER A MORNING MEETS THEM: the goods, the money, the reading, the list, the
 *  conversation, and the change that lands after everything else was settled. */
export const CHECKS: Check[] = [
  {
    id: 'quantity',
    name: 'Quantity',
    checking: 'Checking the quantity…',
    catches: 'A line bigger than what that customer usually takes stands for your yes.',
    grant: 'upTo',
    caught: (s) => flagsOf(s).some((f) => f.kind === 'unusual'),
  },
  {
    id: 'money',
    name: 'Money',
    checking: 'Checking the money…',
    catches: 'An order over the ceiling you set stands for your yes.',
    grant: 'ceiling',
    caught: (s) => flagsOf(s).some((f) => f.kind === 'big'),
  },
  {
    id: 'amount',
    name: 'Amount',
    checking: 'Checking the amount…',
    catches: 'A line whose amount arrived unclear stands until it has one.',
    grant: 'checkIn',
    caught: (s) => flagsOf(s).some((f) => f.kind === 'unreadable'),
  },
  {
    id: 'catalogue',
    name: 'Catalogue',
    checking: 'Checking the catalogue…',
    catches: 'A word your list has a row for goes straight on; anything else comes to you.',
    grant: 'assortment',
    caught: (s) => openNonSku(s).length > 0,
  },
  {
    id: 'question',
    name: 'Question',
    checking: 'Checking the question…',
    catches: 'A customer’s own question stands until somebody answers it.',
    grant: 'prices',
    caught: (s) => Boolean(s.needsReply),
  },
  {
    id: 'change',
    /* IT HAS NO GRANT ON PURPOSE (see the header). A pick or a paper that stopped describing the
       crate is wrong at every level of trust, so there is nothing here for a house to set. */
    name: 'What changed',
    checking: 'Checking what changed…',
    catches: 'A pick or a paper that stopped describing the crate comes back to you.',
    caught: (s) => Boolean(s.prep?.stale) || Boolean(s.printed?.stale),
  },
];

/** How many the net names. Written as a word because it is read inside sentences. */
export const CHECK_COUNT_WORD = 'six';

/** The check a grant sets, for the row that grant draws in Settings. */
export const checkForGrant = (id: GrantId): Check | undefined => CHECKS.find((c) => c.grant === id);

/** Did every check pass this order — the predicate the word «fine» actually means (§32.B). */
export const passesNet = (sale: Sale): boolean => !CHECKS.some((c) => c.caught(sale));

/** What each check caught in a set of orders. A check that caught nothing is absent from the map,
 *  because a surface printing «0 caught» would be spending a line on an absence. */
export function netCounts(sales: Sale[]): Partial<Record<CheckId, number>> {
  const out: Partial<Record<CheckId, number>> = {};
  for (const check of CHECKS) {
    const n = sales.filter(check.caught).length;
    if (n > 0) out[check.id] = n;
  }
  return out;
}

/** THE MORNING'S OWN NUMBERS (§33.2). Everything a surface needs to say what the net did today,
 *  counted off the real ledger — «no invented numbers» is a property of this function. */
export type NetTally = {
  /** every order for the day in scope */
  orders: number;
  /** the ones every check passed */
  passed: number;
  /** the ones Rocoto committed on arrival with nobody touching them (the inversion, §6.2) */
  alone: number;
  /** what each check caught, for the register a person can open */
  counts: Partial<Record<CheckId, number>>;
  /** E193.19 · the ones that still need a person: a standing reply/check concern, or the operator's own flag */
  owed: number;
};

const owedNow = (s: Sale): boolean =>
  Boolean(s.flagged) || standingConcernsOf(s).some((c) => c.kind === 'check' || c.kind === 'response');

export function netTally(sales: Sale[], day: string): NetTally {
  const today = sales.filter((s) => s.day === day);
  return {
    orders: today.length,
    passed: today.filter(passesNet).length,
    alone: today.filter((s) => s.autoCommitted).length,
    counts: netCounts(today),
    owed: today.filter(owedNow).length,
  };
}

/* ═══ WHAT ACCURACY MEANS INTERNALLY (THE CHECKPOINT §9.14) ═══════════════════════════════════
 *
 * «Customers repeatedly ask: "How accurate is it?" and "Will it know when not to reply and tell
 * me that I need to step in?"… What accuracy means internally — track separately: order
 * interpretation accuracy; autonomous resolution rate; safe abstention/escalation performance;
 * critical error rate; customer correction rate.»
 *
 * FIVE MEASURES. FOUR COMPUTE OFF THIS LEDGER AND THE FIFTH HAS NO DEFINITION YET, and saying so
 * is the honest shape rather than a hole: `CRITICAL_ERROR_OPEN` below is the sentence the surface
 * prints where the figure would go, and §28 owns the day it gets one.
 *
 * ═══ EVERY ONE OF THEM IS A COUNT WITH A DENOMINATOR, NEVER A RATE ═══════════════════════════
 * `knows.ts`'s law and `areas/admin/data.tsx`'s stand over this file too: «there is no field that
 * can hold a confidence percentage — a bare percent is the thing this product replaces». A rate is
 * a percent with the arithmetic hidden, so what is returned here is what was counted and what it
 * was counted out of, and the surface prints both on one line. A reader can do the division; what
 * they cannot do is un-hide a denominator somebody dropped.
 *
 * ═══ AND IT ASSERTS NOTHING IT CANNOT COUNT ══════════════════════════════════════════════════
 * Same property as the net above. `read` and `corrected` are read off the CORRECTIONS the morning
 * actually recorded — the trace rows, which are the ledger's own teaching events — so «read right
 * first time» means «no hand put anything right on it», which is a fact and not a grade.
 */

/** WHAT A HOUSE MEANS BY «A SERIOUS MISTAKE» IS THE HOUSE'S TO SAY. Peter's §28 leaves the
 *  definition open, so the surface says that in words instead of inventing a threshold. */
export const CRITICAL_ERROR_OPEN =
  'What counts as a serious mistake is yours to set, and the count follows the definition.';

export type Accuracy = {
  /** every document in the day in scope — the denominator the first four share */
  orders: number;
  /** read right first time: no hand put a word, a unit, a note or an amount right on it */
  read: number;
  /** a hand taught it something — the correction rate's own numerator */
  corrected: number;
  /** Rocoto committed it on arrival with nobody touching it (§6.2's inversion) */
  alone: number;
  /** Rocoto held it or handed it over rather than acting — §9.10's successful outcomes */
  held: number;
  /** …and a person has since settled it. Held-then-settled is what «safe abstention» counts. */
  settled: number;
  /** what each of the four verdicts came to, for the register a person can open */
  policy: Partial<Record<PolicyId, number>>;
};

/**
 * THE MORNING'S OWN ACCURACY, counted off the same river everything else on the seat reads.
 *
 * `taught` is the trace corpus — one row per correction — and it arrives as an argument rather
 * than being folded here, because `trace.ts` reads a CAST and this file has deliberately never
 * needed one. One fold of the day, handed down: the house law of every surface in this app.
 */
export function accuracyTally(sales: Sale[], day: string, taught: Array<{ saleId: string }>): Accuracy {
  /* A DRAFT IS NOT A DECISION (§74.4). A document nobody has named yet is a half-typed thought in
     the composer — the river keeps it out for the same reason, and counting it here would put the
     act of starting to type into the morning's accuracy. */
  const today = sales.filter((s) => s.day === day && !isDraft(s));
  const touched = new Set(taught.map((t) => t.saleId));
  const corrected = today.filter((s) => touched.has(s.id));
  const held = today.filter((s) => policyOf(s).id !== 'act');
  return {
    orders: today.length,
    read: today.length - corrected.length,
    corrected: corrected.length,
    alone: today.filter((s) => s.autoCommitted).length,
    held: held.length,
    settled: held.filter((s) => !isStanding(s, day)).length,
    /* THE FOUR VERDICTS ARE COUNTED WHERE THEY ARE DECIDED (§27.5). `policyCounts` lives beside
       `policyOf` in `sale.ts`; a second walk of the same list in this file would be a second
       place the vocabulary could drift. */
    policy: policyCounts(today),
  };
}
