import { seedSoles, soles } from './currency';
import { CEDAR_GRANTS_PEN_VERSION, migrateGrantsCurrency } from './currency-migration';
/* THE GRANTS — what the house lets Rocoto do on its own, and the questions that set them.
 *
 * ═══ WHY THIS FILE EXISTS (THE-INTELLIGENCE §11) ═══════════════════════════════════════════
 * «The on-the-spot confirmation is ROCOTO'S act… Where Rocoto is not confident it stays SILENT —
 * no holding messages, no filler. UNLESS the house set Rocoto to check with the customer: then it
 * asks fluidly, the way a person would.» That «unless» is a CAPABILITY THE HOUSE GRANTS, and this
 * file is where the grants live.
 *
 * §11 names the two feeds into the capability model: the historical analysis (the dump, which
 * `knows.ts` owns) and «the settings — a QUESTIONNAIRE, then a settings screen». So there is ONE
 * set of answers here and TWO doors onto it: the questionnaire asks them one at a time, and
 * Settings keeps them as living rows. Both render the same question component, so the two can
 * never drift and re-answering in Settings goes through the code path that answered it first.
 *
 * ═══ WHAT THIS IS NOT ══════════════════════════════════════════════════════════════════════
 * It is NOT the onboarding questionnaire THE-APP-V2 §1.2 killed. Nothing here gates the app: the
 * defaults below are a working house, first run still lands in Sales, and a person who never opens
 * the questionnaire has an app that behaves exactly as it does today. A grant answers «what does
 * Rocoto do without me», never «which UI do I get» — the blend law stands, and no value in this
 * file removes a surface or hides a capability.
 *
 * ═══ WHY A STORE AND NOT THE CONFIG ════════════════════════════════════════════════════════
 * `config.ts` is a React context, and the object layer that has to obey these grants — `sale.ts` —
 * is not a component. A grant that only existed in context would have to be threaded through
 * `buildSales`, `flagsOf`, `isSticky` and every caller of all three, and one missed thread would be
 * a surface quietly disagreeing with the settings screen. So the grants take the shape `rules.ts`
 * already took for the same reason: a module singleton, persisted, published through
 * `useSyncExternalStore`. `grantsNow()` is what the fold reads; `useGrants()` is what a component
 * reads so it re-renders on the write.
 */
import * as React from 'react';
/* TYPE ONLY, AND THAT IS WHAT KEEPS THE CIRCLE OPEN: `stage.tsx` imports this file at runtime (it
   plays the contract), and this file names the stage's grammar only in its types. TypeScript erases
   the import, so there is no cycle in the bundle — the contract describes its own performance
   without depending on the thing that performs it. */
import type { StageExample } from './stage';

/* ── THE OBJECT ───────────────────────────────────────────────────────────────────────────── */

/** What an unfamiliar word means in this house. Both answers are ordinary trade. */
export type Assortment = 'catalogue' | 'one-offs';

/** The seven things a house decides about Rocoto. Named up here because the object below carries
 *  the list of the ones a person has answered, and because the store reads them at module init —
 *  a validator that referenced a constant declared further down would be a load-order crash. */
export type GrantId =
  | 'confirm' | 'upTo' | 'ceiling' | 'prices' | 'checkIn' | 'assortment' | 'days'
  /* ── AND THE THREE A HOUSE DECIDES ABOUT ITS OWN PAPERWORK (Musings 3+4) ────────────────────
   * They live in this file because they are the same KIND of fact — one sentence a person reads
   * about who does what — and they take the same store, the same question shape and the same row.
   * They are NOT in the questionnaire's walk: the walk asks what Rocoto may do alone, and these
   * three answer where the document of truth lives and how the money comes in. */
  | 'posture' | 'cadence' | 'invoice'
  /* ── AND THE FIVE THE CHECKPOINT'S §5 ADDS (THE-CHECKPOINT-2026-08-28 §5) ───────────────────
   * «Rocoto needs explicit controls over how the agent behaves» — tone, brevity, ambiguity,
   * voice notes, off-catalogue requests. THEY ARE ROWS ON THIS CONTRACT AND THAT IS THE WHOLE
   * TRICK (THE-ADMIN-BUILD §2.2): a new row renders, performs and persists without a seat edit,
   * because the seat asks the contract which settings belong to it.
   *
   * TWO OF THEM ARE THE WALK'S AND THREE ARE NOT, and the split is §5's own. `ambiguity` and
   * `offCatalogue` answer «what may Rocoto do when it is not sure» — that is the walk's question.
   * `tone`, `brevity` and `voiceNotes` answer «how does it write», which is a fact about the
   * words and never about the authority. See THE REGISTER below, where that line is drawn in
   * the ink as well as in the prose. */
  | 'tone' | 'brevity' | 'ambiguity' | 'voiceNotes' | 'offCatalogue';

export const GRANT_IDS: GrantId[] = [
  'confirm', 'upTo', 'ceiling', 'prices', 'checkIn', 'assortment', 'days',
  'posture', 'cadence', 'invoice',
  'tone', 'brevity', 'ambiguity', 'voiceNotes', 'offCatalogue',
];

/** WHO MAKES THE ALBARÁN (Musing 3). Two postures, one product: the surfaces, the verbs and the
 *  river are identical in both, and only the number's source, the rail's wording and the lock
 *  verb's consequence differ. Neither posture removes anything. */
export type Posture = 'rocoto' | 'erp';

/** WHEN AN ACCEPTED ORDER TRAVELS (FEED-IA §26.5). Both cadences stay reachable in both postures —
 *  it is a capability, never a thing a posture takes away. */
export type Cadence = 'stream' | 'file';

/** WHEN THE INVOICE EXISTS (Musing 4). An instrument choice, not a UI mode: the albarán carries
 *  the figure and the pay-by date either way, so charging needs no second document. */
export type Invoicing = 'spot' | 'after';

/* ── THE HOUSE'S APPETITE (FEED-IA §68 · THE-EXPORT-CANON §16.7) ──────────────────────────────
 * «The grace window is a setting. It still means they're slaves to the system… this is a SETTING,
 * an APPETITE, bro.» — Peter, §68.
 *
 * THE SYSTEM LEADS ATTENTION. THE HOUSE LEADS APPETITE. What is worth noticing is Rocoto's
 * judgment, said quietly on the row; how eagerly a document leaves is the house's own decision.
 *
 * IT GOVERNS THE SYSTEM RAIL AND NOTHING ELSE. §68.3 — «PRINTING ALWAYS MANUAL» — is a law about
 * the vocabulary as much as about the code: paper never auto-fires at any notch, the bay's packing
 * list never does, and the customer's copy answers to the clock rather than to an appetite. So the
 * field is named for the rail it moves and can never quietly claim the printer.
 *
 * THE VALUE LIVES HERE; ITS ROW LIVES IN TU AGENTE. This file is the policy (§53's data contract),
 * and the admin seat renders it — the surfaces below read the value and never ask the question.
 */
export type Appetite = 'at-once' | 'after-a-margin' | 'on-a-press';

/* ── THE REGISTER (THE-CHECKPOINT-2026-08-28 §5) ──────────────────────────────────────────────
 * «Have a small set of useful default tone profiles. Also support a profile based on the company's
 * real communication history — current concept: Company DNA. This can be inferred from
 * WhatsApp/email history rather than forcing the customer to write a style prompt.»
 *
 * ═══ THREE NAMED REGISTERS AND ONE READ ONE ═════════════════════════════════════════════════
 * The three are the trade's own: PLAIN states the fact, CORDIAL greets and closes, DRY gives the
 * order and the figure. HOUSE is the fourth and it is a different KIND of answer — it is not a
 * register somebody picked, it is the register the house's own year of messages already reads as.
 * `knows.ts` folds the style observations and `insights.ts` names what they come to; this file
 * holds only the ANSWER, which is the shape every other setting takes.
 *
 * ═══ IT IS NEVER A STYLE PROMPT (§27.6: «do not turn settings into a giant prompt editor») ═══
 * There is no textarea in this file and none in the seat that draws it. A register is a NAMED
 * value with a sentence, exactly like a ceiling is a number with a sentence.
 *
 * ═══ TONE IS NOT AUTONOMY, AND THE INK SAYS SO ══════════════════════════════════════════════
 * «Tone and autonomy are separate. A warm/friendly tone must not imply permissive operational
 * authority.» The saffron mark on a row means ROCOTO DOES THIS BY ITSELF (the standing colour
 * law), so every register row below answers `rocoto: () => false` — deliberately, and not because
 * nothing happens. A house that turns the register cordial has changed the WORDS and has changed
 * no grant, and the section reads that way at a glance because the marks did not move.
 */

/** THE NAMED REGISTERS. Three the trade already speaks in, and the house's own. */
export type ToneProfile = 'flat' | 'cordial' | 'dry' | 'house';

/** HOW MUCH IT SAYS. «Company can control how concise Rocoto is. Default should avoid long AI
 *  prose» — so the middle notch is the default and the long one is a thing a house asks for. */
export type Brevity = 'short' | 'concise' | 'full';

/**
 * WHEN ROCOTO STOPS AND ASKS — the three-way distinction, as the policy's own options.
 *
 * «Rocoto must distinguish: I do not know; multiple plausible SKUs / variants remain; history
 * makes one interpretation sufficiently likely. Do not turn meaningful ambiguity into a
 * physical/commercial action silently.» The three cases are the three notches, and each notch
 * names the CASE at which the house wants Rocoto to stop:
 *
 *   `unknown`  it stops only where it has no reading at all
 *   `plural`   it stops where more than one of the house's own sorts fits          ← today
 *   `history`  it stops even where the past leans one way, because a lean is not an answer
 *
 * THE DEFAULT IS WHAT IS BUILT (FEED-IA §80.3). The app resolves and SHOWS THE GROUND — «what it
 * read it as» stands on the line — and the two other notches are the house saying it wants the
 * fork earlier or later than that. Nothing here invents a HOLD: whether ambiguity may hold a
 * document is §28's open call and stays his.
 *
 * ⚠ THE READ-SIDE FOLD IS `sale.ts`'s. The contract states the policy (§53's data contract, and
 * THE-ADMIN-BUILD §2.2's whole point); the object layer reads it where `assortment` and `checkIn`
 * are already read. The default IS today's behaviour, so the contract can carry the policy before
 * that fold lands without any surface saying something the app would not do.
 */
export type Ambiguity = 'unknown' | 'plural' | 'history';

/**
 * A REQUEST FOR SOMETHING OUTSIDE THE LIST (§5's off-catalogue pattern).
 *
 * «Some distributors source products outside the normal catalogue. A meat company may accept a
 * request for flowers and source them from a third party. Rocoto needs to support this pattern in
 * some form. Exact subcontracting / sourcing workflow remains open.»
 *
 * SO THE PATTERN IS ACKNOWLEDGED AS A POLICY AND THE WORKFLOW IS NOT INVENTED (§27.9). Both
 * answers end at the same place — a person, with the customer's own words on it — and what
 * differs is the sentence that goes back: whether the house is a house that will go and find it.
 * Who supplies it, at what price, and whose albarán it rides is §28's open call.
 */
export type Sourcing = 'own' | 'sourced';

/* THE VALUES EACH OF THEM MAY TAKE, declared UP HERE beside their types — the store reads storage
   at module init, so a validator reaching for a constant declared further down would be a
   load-order crash (the same reason `GRANT_IDS` sits where it does). */
export const TONE_VALUES: readonly ToneProfile[] = ['flat', 'cordial', 'dry', 'house'];
export const BREVITY_VALUES: readonly Brevity[] = ['short', 'concise', 'full'];
export const AMBIGUITY_VALUES: readonly Ambiguity[] = ['unknown', 'plural', 'history'];
export const SOURCING_VALUES: readonly Sourcing[] = ['own', 'sourced'];

/** ONE MARGIN, CHOSEN — never a length we compute (§16.7: «the confidence-derived window is
 *  dead»). Minutes, because the surface states the HOUR it arrives at and never a countdown. */
export type Margin = 10 | 30 | 60;

export const MARGIN_STEPS: Margin[] = [10, 30, 60];

/** The multiples of a customer's usual amount a person can hand Rocoto. */
export const UP_TO_STEPS = [2, 3, 5, 10];

/** The money ceilings on one order. The lowest of them is inside a normal morning's biggest
 *  albarán, because a ceiling no order ever reaches is a setting nobody can feel. */
export const CEILING_STEPS = [500, 1000, 2000, 3000].map(seedSoles);

export type Grants = {
  version: number;
  /** Rocoto confirms an order with the customer on its own */
  confirm: boolean;
  /** …as long as the line is inside this many times what that customer usually takes */
  upTo: number;
  /** …and the order is inside this much money */
  ceiling: number;
  /** Rocoto answers a price question off the price sheet */
  prices: boolean;
  /** Rocoto asks the customer itself where something is unclear — §11's «unless» */
  checkIn: boolean;
  /** what a word the catalogue has no row for means here */
  assortment: Assortment;
  /** the days the house serves, as `Date.getDay()` numbers */
  days: number[];
  /** who makes and numbers the albarán */
  posture: Posture;
  /** when an accepted order reaches the ERP */
  cadence: Cadence;
  /** when the invoice exists */
  invoice: Invoicing;
  /** HOW EAGERLY AN ALBARÁN LEAVES FOR THE HOUSE'S OWN SYSTEM (§68). The system rail only. */
  dispatch: Appetite;
  /** the margin, where the appetite is «after a margin». Minutes (§16.7). */
  dispatchWait: Margin;
  /** the register Rocoto writes in (§5.1) */
  tone: ToneProfile;
  /** how much it says (§5.3) */
  brevity: Brevity;
  /** the case at which it stops and asks (§5.4) */
  ambiguity: Ambiguity;
  /** Rocoto may answer with a voice note (§5.9) */
  voiceNotes: boolean;
  /** what happens with a request for something outside the list (§5.10) */
  offCatalogue: Sourcing;
  /** ── WHAT THE HOUSE TOOK OUT OF ITS OWN DNA (§5.2: «editable, never forced») ───────────────
   *  The Company DNA is READ rather than written, so the one edit that matters is the house
   *  saying «that is not us» about a line Rocoto inferred. The ids of the dropped observations
   *  live here beside the answer they qualify; the fold itself stays a pure read. */
  dnaDropped: string[];
  /** which of these the person has answered themselves */
  answered: GrantId[];
};

export const GRANTS_VERSION = CEDAR_GRANTS_PEN_VERSION;

/**
 * THE STARTING ANSWERS ARE A WORKING HOUSE.
 *
 * They are chosen so that a prototype nobody has configured behaves exactly as the feed already
 * behaves — Rocoto confirms the clean orders, asks the customer where the house's own transcript
 * shows it asking, and brings the rest to the desk. Every one of them is then a real fact a person
 * can change, and the change is visible on the same screen they change it on.
 */
export const GRANT_DEFAULTS: Grants = {
  version: GRANTS_VERSION,
  confirm: true,
  upTo: 3,
  ceiling: seedSoles(3000),
  prices: false,
  checkIn: true,
  assortment: 'catalogue',
  days: [1, 2, 3, 4, 5, 6],
  /* THE THESIS IS THE DEFAULT: Rocoto makes the document, the ERP invoices downstream. The other
     posture is one row away and takes nothing off the screen. */
  posture: 'rocoto',
  cadence: 'file',
  invoice: 'after',
  /* THE MIDDLE NOTCH IS THE SAFE FIRST ANSWER (§16.7): a document leaves by itself, and the margin
     is where a correction fits. The house moves it either way in one row. */
  dispatch: 'after-a-margin',
  dispatchWait: 30,
  /* ── THE REGISTER'S OWN STARTING ANSWERS ───────────────────────────────────────────────────
   * CORDIAL, because a house answering its own customers greets them, and because the house's own
   * register — the fourth profile — is OFFERED and never imposed (FEED-IA §83.2): a default that
   * silently adopted what Rocoto inferred would be the software deciding it had read them right.
   * CONCISE, because «default should avoid long AI prose» is §5.3 verbatim.
   * PLURAL, because that is what §80.3 built: resolve where the past settles it, show the ground,
   * and stop where more than one of the house's own sorts fits.
   * WRITING rather than speaking, because a voice note going out in the house's name is a bigger
   * act than a line of text, and §83.2 applies to it too.
   * OWN, because a house sells its list, and sourcing is the thing a house opts into. */
  tone: 'cordial',
  brevity: 'concise',
  ambiguity: 'plural',
  voiceNotes: false,
  offCatalogue: 'own',
  dnaDropped: [],
  answered: [],
};

/* ── THE WORDS FOR A DAY ──────────────────────────────────────────────────────────────────────
 * The week starts on Monday because a delivery week does. A contiguous run reads as a run —
 * «Monday to Saturday» — and anything else is said as the days themselves.
 */

const WEEK = [1, 2, 3, 4, 5, 6, 0];

const DAY_NAME: Record<number, string> = {
  1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday', 0: 'Sunday',
};

const DAY_SHORT: Record<number, string> = {
  1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 0: 'Sun',
};

/** The days in the week's own order. */
export const orderedDays = (days: number[]): number[] => WEEK.filter((d) => days.includes(d));

const contiguous = (days: number[]): boolean => {
  const at = days.map((d) => WEEK.indexOf(d));
  return at.every((n, i) => i === 0 || n === at[i - 1] + 1);
};

/** «Monday to Saturday» · «Monday · Wednesday · Friday» · «Every day». */
export function daysWords(days: number[], short = false): string {
  const on = orderedDays(days);
  const name = short ? DAY_SHORT : DAY_NAME;
  if (on.length === 0) return 'Set the days you serve';
  if (on.length === 7) return 'Every day';
  if (on.length > 2 && contiguous(on)) {
    return short ? `${name[on[0]]}–${name[on[on.length - 1]]}` : `${name[on[0]]} to ${name[on[on.length - 1]]}`;
  }
  return on.map((d) => name[d]).join(' · ');
}

/** Money as Spain writes it, with the unit on the number's own line, wherever a grant says one. */
export const moneyWords = (n: number): string =>
  soles(n, 0);

/* ── THE STORE ────────────────────────────────────────────────────────────────────────────────
 * One module-level object, persisted, published through `useSyncExternalStore` — the same shape
 * `rules.ts` uses, for the same reason: any file anywhere reads it, and every reader re-renders on
 * the same write, with no provider to mount above them.
 */

export const GRANTS_STORAGE_KEY = 'rocoto-app-grants';

const num = (v: unknown, allowed: number[], fallback: number): number =>
  typeof v === 'number' && allowed.includes(v) ? v : fallback;

/** Read stored answers back into the shape this build knows. A field that fails its own validator
 *  takes the default and the rest are kept, so one new grant never throws away six answered ones. */
export function parseGrants(raw: unknown): Grants {
  if (!raw || typeof raw !== 'object') return GRANT_DEFAULTS;
  const r = migrateGrantsCurrency(raw) as Record<string, unknown>;
  if (r.version !== GRANTS_VERSION) return GRANT_DEFAULTS;
  const days = Array.isArray(r.days)
    ? r.days.filter((d): d is number => typeof d === 'number' && d >= 0 && d <= 6)
    : GRANT_DEFAULTS.days;
  const answered = Array.isArray(r.answered)
    ? r.answered.filter((a): a is GrantId => typeof a === 'string' && GRANT_IDS.includes(a as GrantId))
    : [];
  /* THE DROPPED DNA LINES ARE IDS AND NOTHING ELSE, so a stored blob that grew a field this build
     has never heard of cannot smuggle anything into the fold that reads them. */
  const dnaDropped = Array.isArray(r.dnaDropped)
    ? r.dnaDropped.filter((d): d is string => typeof d === 'string')
    : [];
  const one = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
    (typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback);
  return {
    version: GRANTS_VERSION,
    confirm: r.confirm !== false,
    upTo: num(r.upTo, UP_TO_STEPS, GRANT_DEFAULTS.upTo),
    ceiling: num(r.ceiling, CEILING_STEPS, GRANT_DEFAULTS.ceiling),
    prices: r.prices === true,
    checkIn: r.checkIn !== false,
    assortment: r.assortment === 'one-offs' ? 'one-offs' : 'catalogue',
    days: days.length ? days : GRANT_DEFAULTS.days,
    posture: r.posture === 'erp' ? 'erp' : 'rocoto',
    cadence: r.cadence === 'stream' ? 'stream' : 'file',
    invoice: r.invoice === 'spot' ? 'spot' : 'after',
    dispatch:
      r.dispatch === 'at-once' || r.dispatch === 'on-a-press' ? r.dispatch : GRANT_DEFAULTS.dispatch,
    dispatchWait: num(r.dispatchWait, MARGIN_STEPS, GRANT_DEFAULTS.dispatchWait) as Margin,
    tone: one<ToneProfile>(r.tone, TONE_VALUES, GRANT_DEFAULTS.tone),
    brevity: one<Brevity>(r.brevity, BREVITY_VALUES, GRANT_DEFAULTS.brevity),
    ambiguity: one<Ambiguity>(r.ambiguity, AMBIGUITY_VALUES, GRANT_DEFAULTS.ambiguity),
    voiceNotes: r.voiceNotes === true,
    offCatalogue: one<Sourcing>(r.offCatalogue, SOURCING_VALUES, GRANT_DEFAULTS.offCatalogue),
    dnaDropped,
    answered,
  };
}

function read(): Grants {
  try {
    const encoded = window.localStorage.getItem(GRANTS_STORAGE_KEY);
    if (!encoded) return GRANT_DEFAULTS;
    const source: unknown = JSON.parse(encoded);
    const migrated = migrateGrantsCurrency(source);
    const parsed = parseGrants(migrated);
    if (migrated !== source) {
      try {
        window.localStorage.setItem(GRANTS_STORAGE_KEY, JSON.stringify(parsed));
      } catch (error) {
        console.warn('Rocoto will retry the grant currency upgrade on the next boot', error);
      }
    }
    return parsed;
  } catch {
    return GRANT_DEFAULTS;
  }
}

let GRANTS: Grants = typeof window === 'undefined' ? GRANT_DEFAULTS : read();

const listeners = new Set<() => void>();

if (typeof window !== 'undefined') window.addEventListener('storage', event => {
  if (event.key !== GRANTS_STORAGE_KEY) return;
  GRANTS = read();
  for (const listener of listeners) listener();
});

function publish(next: Grants): boolean {
  try {
    window.localStorage.setItem(GRANTS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    return false;
  }
  GRANTS = next;
  for (const l of listeners) l();
  return true;
}

const subscribe = (l: () => void): (() => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

/** WHAT THE OBJECT LAYER READS. `sale.ts` calls this inside the fold, so a grant is in force the
 *  moment it is written and no surface can be reading a different set from another. */
export const grantsNow = (): Grants => GRANTS;

const snapshot = grantsNow;

/** Write one or more grants. Answering marks the question as the person's own. */
export function setGrants(patch: Partial<Grants>, answeredId?: GrantId): boolean {
  /* `answered` is computed AFTER the spread so a patch carrying its own `answered` list
   * (the stage seed's whole-ladder writes) lands instead of being silently shadowed —
   * the §100 builder found the old order made that a no-op. A patch's list and an
   * answeredId compose: the id joins whichever list is standing. */
  const base = patch.answered ?? GRANTS.answered;
  const answered = answeredId && !base.includes(answeredId) ? [...base, answeredId] : base;
  return publish({ ...GRANTS, ...patch, answered });
}

/** Back to the starting answers, with nothing remembered. */
export function resetGrants(): boolean {
  return publish(GRANT_DEFAULTS);
}

/** ONE LINE OF THE HOUSE'S OWN DNA, KEPT OR DROPPED (§5.2: «editable, never forced»).
 *
 *  The inference itself stays a pure read of the house's messages — this is the house answering
 *  it. Dropping a line is a complete answer and needs no confirmation; taking it back is the same
 *  press again, which is why one function does both. */
export function toggleDnaLine(id: string): void {
  const dropped = GRANTS.dnaDropped.includes(id)
    ? GRANTS.dnaDropped.filter((d) => d !== id)
    : [...GRANTS.dnaDropped, id];
  publish({ ...GRANTS, dnaDropped: dropped });
}

/** The hook every component reads, so a grant written on one surface re-renders the others. */
export const useGrants = (): Grants => React.useSyncExternalStore(subscribe, snapshot, snapshot);

/* ── THE QUESTIONS ────────────────────────────────────────────────────────────────────────────
 * ONE LIST, TWO DOORS. The questionnaire walks it; Settings draws it as rows and re-houses the
 * same component when a row is opened. Every question therefore carries BOTH shapes of itself: the
 * words it asks in, and the words its answer reads as on a row.
 *
 * THE CHOICES ARE SENTENCES ABOUT WHAT HAPPENS. «Rocoto confirms it» and «It comes to you» are both
 * statements of what the house gets — there is no option here phrased as something Rocoto lacks,
 * because a person choosing between two futures should be able to picture both of them.
 */

export type Choice = {
  value: string;
  label: string;
  /** the one line the chosen chip says about itself */
  hint: string;
};

/* ── THE AGENT DATA CONTRACT (FEED-IA §53 · THE-ADMIN-CANON §5) ───────────────────────────────
 * Peter's forward question — «should we, in the runtime itself, have some data contract of what
 * settings can be changed, so then we surface those and we bring those to life?» — answered YES,
 * and answered HERE, because `CAPABILITY_QUESTIONS` was already ninety per cent of that contract:
 * a stable English id, a Spanish surface name, the values it may take, the sentence its row shows,
 * whether it is something Rocoto does alone, and which of the net's checks reads it.
 *
 * TWO FIELDS FINISH IT, and they are the two the administration needed:
 *
 *   `home`     WHICH SEAT RENDERS IT. The canon's placement rule, made data: autonomy dials
 *              (confirm · upTo · ceiling · prices · checkIn · assortment) live in Your agent, and
 *              working-style facts (days · posture · cadence · invoice) live in Operations. ONE
 *              store, ONE home each — the double-home tension resolved by a field rather than by a
 *              convention two files would eventually disagree about.
 *   `example`  HOW IT PERFORMS ITSELF. The stage (`stage.tsx`) is a PLAYER of this field, so a
 *              setting that lands next month lands with its own demonstration and the stage learns
 *              nothing. That is what makes «bring it to life» a thing the canon can keep growing
 *              rather than a screen somebody has to maintain.
 *
 * The contract's truth moves to the server policy when Row 0 lands (the BANK's grants/policy,
 * versioned). Until then this file IS the policy, and the UI is a renderer of it either way.
 */

/** WHICH SEAT OWNS A SETTING. One home each — the whole of the canon's placement rule. */
export type SettingHome = 'agent' | 'operations';

export type CapabilityQuestion = {
  id: GrantId;
  /** WHICH SEAT RENDERS THIS ONE (THE-ADMIN-CANON §5's placement rule). */
  home: SettingHome;
  /** THE LIVE EXAMPLE THE STAGE PLAYS (THE-ADMIN-CANON §6). A factory rather than a value, so the
   *  performance is written against a REAL order off the house's own river — its customer, its
   *  figure, its day — instead of against invented numbers. */
  example?: StageExample;
  /** the words the questionnaire asks in */
  prompt: string;
  /** one line under the prompt, saying why it is being asked */
  aside: string;
  choices: Choice[];
  /** several answers, rather than one */
  multi?: boolean;
  /** ONE line for the whole answer, where a chip's own hint would be said six times over. A multi
   *  answer needs it; a single answer says its hint and needs nothing. */
  summary?: (g: Grants) => string;
  selected: (g: Grants) => string[];
  choose: (g: Grants, value: string) => Partial<Grants>;
  /** THE SETTINGS ROW THIS ANSWER KEEPS. `sub` is OPTIONAL, and the default is to have none
   *  (§51.7 · AUDIT-2 C19/C20): a row is a label, a value and a mark, and where those three carry
   *  the fact a sentence under them is the explanatory prose the canon bans. A sub earns its line
   *  only where it says something the label and the value cannot. */
  row: { label: string; sub?: string; mark: GrantMark };
  /** what the row's trailing value reads */
  value: (g: Grants) => string;
  /** true where that value is something ROCOTO does — the row takes the saffron mark */
  rocoto: (g: Grants) => boolean;
  /** the question stands only where its answer means something */
  show?: (g: Grants) => boolean;
};

/** The tile a row and a question card carry. Linework, drawn in `settings.tsx`. Every value is a
 *  `GlyphId` out of the app's own vocabulary — this file names a MEANING and never an artwork. */
export type GrantMark =
  | 'confirm' | 'upTo' | 'ceiling' | 'price' | 'ask' | 'catalogue' | 'days'
  /** the albarán itself — the document the posture is about */
  | 'doc'
  /** the moment the data travels */
  | 'send'
  /** ── THE WORDS THAT GO OUT (§5's register rows) ──────────────────────────────────────────
   *  §51.19's law is ONE MEANING PER MARK, and the corollary is that rows about ONE meaning wear
   *  ONE mark: the six net rows all wear `check`, and the three register rows all wear `chat` —
   *  the conversation, which is what a register, a length and a voice note are all facts about.
   *  It is the same mark «The name it answers by» already wears one section above. */
  | 'chat';

export const CAPABILITY_QUESTIONS: CapabilityQuestion[] = [
  {
    id: 'confirm',
    home: 'agent',
    prompt: 'Can Rocoto confirm an order with the customer?',
    aside: 'A customer who orders at 06:40 has an answer at 06:40, from Rocoto, in your name.',
    choices: [
      {
        value: 'yes',
        label: 'Rocoto confirms it',
        hint: 'It answers on the spot and the delivery note is promised for the day they asked for.',
      },
      {
        value: 'no',
        label: 'Every order comes to you',
        hint: 'Rocoto reads the order and stands it in front of you with one verb on it.',
      },
    ],
    selected: (g) => [g.confirm ? 'yes' : 'no'],
    choose: (_g, v) => ({ confirm: v === 'yes' }),
    row: {
      label: 'Confirming orders',
      sub: 'The word that goes back to a customer the moment their order lands.',
      mark: 'confirm',
    },
    value: (g) => (g.confirm ? `Up to ${g.upTo}× their usual` : 'Every order comes to you'),
    rocoto: (g) => g.confirm,
  },
  {
    id: 'upTo',
    home: 'agent',
    prompt: 'How far past a customer’s usual can Rocoto go on its own?',
    aside: 'The finger slip this catches is the 12 that arrives as 120.',
    choices: UP_TO_STEPS.map((n) => ({
      value: String(n),
      label: `${n}× their usual`,
      hint: `A line over ${n}× what that customer usually takes comes to you for a yes.`,
    })),
    selected: (g) => [String(g.upTo)],
    choose: (_g, v) => ({ upTo: Number(v) }),
    row: {
      label: 'How much bigger than usual',
      sub: 'A line over this comes to you, with the multiple stated on it.',
      mark: 'upTo',
    },
    value: (g) => `${g.upTo}× their usual`,
    rocoto: () => false,
    show: (g) => g.confirm,
  },
  {
    id: 'ceiling',
    home: 'agent',
    /* ── THE PERFORMANCE (THE-ADMIN-CANON §6's script, v1) ─────────────────────────────────────
     * ONE incoming order, replayed under two values of this control. Below the limit Rocoto answers
     * on the spot and the albarán exists; above it, Rocoto says one honest holding line and the
     * conversation moves to a person. That is the whole of what a ceiling IS, and a person learns it
     * by moving the dial rather than by reading this sentence.
     *
     * EVERY NUMBER IN IT IS THE ORDER'S OWN. The figure, the day and the customer come off a real
     * sale on the house's river, and the person it escalates to comes off the house's own routing —
     * so the demonstration cannot say something the app would not do.
     *
     * ONE QUIET CHECK LINE, on the bubble where the decision happens: `money` is the net check this
     * dial sets, named by `net.ts`'s own word for it. The Monzo layer, and one line of it. */
    example: ({ figure, figureWords, handover, day, customer }) => ({
      opening: [
        {
          who: 'customer',
          text: `Morning — the usual for ${day}, and put two extra cajas of gamba on it.`,
        },
        {
          who: 'rocoto',
          text: `Read as ${customer}’s order for ${day}. It comes to ${figureWords}.`,
        },
      ],
      branches: [
        {
          id: 'inside',
          /* THE ORDER'S OWN FIGURE AGAINST THE HOUSE'S OWN CEILING. It closes over the real
             document's total, so moving the dial past it flips the performance — a predicate that
             named a number would be a demonstration of arithmetic rather than of the setting. */
          when: (g) => figure <= g.ceiling,
          caption: 'Inside the limit, Rocoto answers on the spot and the delivery note exists.',
          turns: [
            {
              who: 'rocoto',
              text: `Received. It is confirmed for ${day}.`,
              check: 'money',
              chip: { kind: 'albaran' },
            },
          ],
        },
        {
          id: 'over',
          when: () => true,
          caption: `Over the limit, Rocoto holds the line and ${handover} takes it.`,
          turns: [
            {
              who: 'rocoto',
              text: 'One moment — I will check this one and come straight back to you.',
              check: 'money',
              chip: {
                kind: 'handover',
                to: handover,
                line: `${figureWords} is over the ceiling you set, so it is standing with ${handover} rather than answered.`,
              },
            },
            {
              who: 'house',
              text: `All yours for ${day} — I have put the two extra cajas on.`,
            },
          ],
        },
      ],
    }),
    prompt: 'How big can one order be before you want to see it?',
    aside: 'Your biggest customers are exactly the ones you want to answer yourself.',
    choices: CEILING_STEPS.map((n) => ({
      value: String(n),
      label: moneyWords(n),
      hint: `An order over ${moneyWords(n)} comes to you before anything goes back to the customer.`,
    })),
    selected: (g) => [String(g.ceiling)],
    choose: (_g, v) => ({ ceiling: Number(v) }),
    row: {
      label: 'The ceiling on one order',
      sub: 'An order over this comes to you, with what it comes to on the card.',
      mark: 'ceiling',
    },
    value: (g) => moneyWords(g.ceiling),
    rocoto: () => false,
    show: (g) => g.confirm,
  },
  {
    id: 'prices',
    home: 'agent',
    prompt: 'Who answers a price question?',
    aside: 'It is the question that holds a customer’s own decision, so it is the one that wants speed.',
    choices: [
      {
        value: 'rocoto',
        label: 'Rocoto answers it',
        hint: 'It reads today’s price off your price sheet and replies in one sentence.',
      },
      {
        value: 'you',
        label: 'It comes to you',
        hint: 'The question stands on the sale with the thread beside it, ready for your words.',
      },
    ],
    selected: (g) => [g.prices ? 'rocoto' : 'you'],
    choose: (_g, v) => ({ prices: v === 'rocoto' }),
    row: {
      label: 'Price questions',
      sub: 'A customer asking what something is at today.',
      mark: 'price',
    },
    value: (g) => (g.prices ? 'Rocoto answers from your price sheet' : 'They come to you'),
    rocoto: (g) => g.prices,
  },
  {
    id: 'checkIn',
    home: 'agent',
    prompt: 'When something is unclear, can Rocoto ask the customer?',
    aside: 'A real question is conversation. Rocoto asks the way you would, in one line.',
    choices: [
      {
        value: 'yes',
        label: 'Rocoto asks them',
        hint: 'Like a person at the counter: “Quick one on the merluza — same as last week?”',
      },
      {
        value: 'no',
        label: 'It comes to you',
        hint: 'Rocoto stays quiet with the customer and hands you the one thing it needs.',
      },
    ],
    selected: (g) => [g.checkIn ? 'yes' : 'no'],
    choose: (_g, v) => ({ checkIn: v === 'yes' }),
    row: {
      label: 'Checking with the customer',
      sub: 'When a line needs one more fact.',
      mark: 'ask',
    },
    value: (g) => (g.checkIn ? 'Ask the customer' : 'It comes to you'),
    rocoto: (g) => g.checkIn,
  },
  {
    id: 'assortment',
    home: 'agent',
    prompt: 'What does a word off your catalogue mean?',
    aside: 'Choose whether unlisted items can be added as one-offs or need review.',
    choices: [
      {
        value: 'one-offs',
        label: 'We sell one-offs all the time',
        hint: 'Add the word to the delivery note as a one-off line and record it.',
      },
      {
        value: 'catalogue',
        label: 'Our catalogue is what we sell',
        hint: 'A word off your list comes to you, and you say what it is.',
      },
    ],
    selected: (g) => [g.assortment],
    choose: (_g, v) => ({ assortment: v === 'one-offs' ? 'one-offs' : 'catalogue' }),
    row: {
      label: 'Words off your catalogue',
      sub: 'When a name arrives off your catalogue.',
      mark: 'catalogue',
    },
    value: (g) => (g.assortment === 'one-offs' ? 'Add as one-offs' : 'They come to you'),
    rocoto: (g) => g.assortment === 'one-offs',
  },
  {
    id: 'ambiguity',
    home: 'agent',
    /* ── THE PERFORMANCE: ONE WORD, THREE THRESHOLDS ───────────────────────────────────────────
     * The same message under the three notches, on the house's OWN goods — `goods` comes off the
     * staged sale's first line, so a fish house watches this happen to merluza and a meat house
     * watches it happen to a cut. The three branches are the checkpoint's three cases, in order:
     * the past settles it and the line says what it was read as (§80.3, and today's behaviour);
     * more than one sort fits, so Rocoto asks; the past leans and the house wanted the fork
     * anyway. Nobody has to read a sentence about the difference — they move the dial. */
    example: ({ day, customer, goods }) => {
      const it = goods ?? 'the usual';
      return {
        opening: [
          { who: 'customer', text: `${day} — send me ${it}, same as always.` },
        ],
        branches: [
          {
            id: 'unknown',
            when: (g) => g.ambiguity === 'unknown',
            caption: 'Only where the reading is blank. The past settles the rest, and the line says what it read.',
            turns: [
              {
                who: 'rocoto',
                text: `On for ${day}. Read as the sort you have taken every week.`,
                chip: { kind: 'albaran' },
              },
            ],
          },
          {
            id: 'plural',
            when: (g) => g.ambiguity === 'plural',
            caption: 'Where more than one of your own sorts fits, Rocoto asks before anything is promised.',
            turns: [
              { who: 'rocoto', text: `Quick one — two sorts of ${it} are in today. Which one for ${day}?` },
              { who: 'customer', text: 'The one you sent last week.' },
              {
                who: 'rocoto',
                text: `That one. On for ${day}.`,
                chip: { kind: 'albaran' },
              },
            ],
          },
          {
            id: 'history',
            /* the fallback branch, as every script's last one is */
            when: () => true,
            caption: 'Even where the past leans one way, the fork goes to the customer, and their own word settles it.',
            turns: [
              {
                who: 'rocoto',
                text: `You have taken the same ${it} every week since May. Same one for ${day}, or the other?`,
              },
              { who: 'customer', text: 'Same one.' },
              { who: 'rocoto', text: `Same one, on for ${day}.`, chip: { kind: 'albaran' } },
            ],
          },
        ],
      };
    },
    prompt: 'When something has more than one reading, when does it stop?',
    aside: 'Three cases are distinct: a blank reading; more than one of your sorts fits; or your history settles it.',
    choices: [
      {
        value: 'unknown',
        label: 'Where the reading is blank',
        hint: 'Where more than one sort fits, use the reading your history settles and show it on the line.',
      },
      {
        value: 'plural',
        label: 'Where more than one sort fits',
        hint: 'Your history settles the choice, and the line states the reading used.',
      },
      {
        value: 'history',
        label: 'Where history is the only thing that settles it',
        hint: 'Even where the past leans one way, the fork goes in front of somebody.',
      },
    ],
    selected: (g) => [g.ambiguity],
    choose: (_g, v) => ({ ambiguity: v as Ambiguity }),
    row: {
      label: 'When it stops and asks',
      sub: 'The case at which a reading stops being enough.',
      mark: 'ask',
    },
    value: (g) => (g.ambiguity === 'unknown'
      ? 'Only where the reading is blank'
      : g.ambiguity === 'history'
        ? 'Where history is the only thing that settles it'
        : 'Where more than one of your sorts fits'),
    /* IT IS A THRESHOLD ON ROCOTO'S OWN ACT, so the saffron mark stands on the notch where Rocoto
       carries the reading itself. At the other two the fork reaches a person. */
    rocoto: (g) => g.ambiguity === 'unknown',
  },
  {
    id: 'offCatalogue',
    home: 'agent',
    /* ── THE PERFORMANCE: THE ASK NOBODY'S LIST HAS A ROW FOR ─────────────────────────────────
     * Peter's own example, played: a food house asked for flowers. Both branches end with a
     * person holding it — what differs is the sentence that goes back to the customer, which is
     * exactly as far as this setting goes until §28 rules on the sourcing workflow. */
    example: ({ day, handover }) => ({
      opening: [
        { who: 'customer', text: `Odd one — can you get me flowers for the terrace with ${day}’s drop?` },
      ],
      branches: [
        {
          id: 'sourced',
          when: (g) => g.offCatalogue === 'sourced',
          caption: 'You are a house that sources. Rocoto says so, and hands it to a person with a price to find.',
          turns: [
            {
              who: 'rocoto',
              text: `I will find you flowers for ${day} and come back with a price.`,
              chip: {
                kind: 'handover',
                to: handover,
                line: `Flowers for ${day}, in their own words, standing with ${handover} to source.`,
              },
            },
          ],
        },
        {
          id: 'own',
          when: () => true,
          caption: 'You sell your own list. Rocoto keeps the request whole and puts it in front of a person.',
          turns: [
            {
              who: 'rocoto',
              text: `I will come back to you on the flowers. ${day}’s drop is on.`,
              chip: {
                kind: 'handover',
                to: handover,
                line: `Flowers for ${day}, in their own words, standing with ${handover}.`,
              },
            },
          ],
        },
      ],
    }),
    prompt: 'What happens when a customer asks for something outside your catalogue?',
    aside: 'A meat house gets asked for flowers. Rocoto keeps the request whole either way.',
    choices: [
      {
        value: 'own',
        label: 'You sell your own list',
        hint: 'Rocoto says it will come back to them, and the request stands with a person in their own words.',
      },
      {
        value: 'sourced',
        label: 'You go and find it',
        hint: 'Rocoto says you will source it, and the request stands with a person to price.',
      },
    ],
    selected: (g) => [g.offCatalogue],
    choose: (_g, v) => ({ offCatalogue: v as Sourcing }),
    row: {
      label: 'Asks outside your catalogue',
      sub: 'What goes back to a customer who asks for something off your list.',
      mark: 'catalogue',
    },
    value: (g) => (g.offCatalogue === 'sourced'
      ? 'Rocoto says you will find it, and brings it to you'
      : 'Rocoto comes back to them, and brings it to you'),
    rocoto: () => false,
  },
  {
    id: 'days',
    home: 'operations',
    prompt: 'Which days do you serve?',
    aside: 'The days your van goes out. Rocoto promises a delivery day you actually keep.',
    choices: WEEK.map((d) => ({
      value: String(d),
      label: DAY_SHORT[d],
      hint: `${DAY_NAME[d]} is a day you serve.`,
    })),
    multi: true,
    summary: (g) => `You serve ${daysWords(g.days)}.`,
    selected: (g) => orderedDays(g.days).map(String),
    choose: (g, v) => {
      const d = Number(v);
      const on = g.days.includes(d);
      const next = on ? g.days.filter((x) => x !== d) : [...g.days, d];
      /* a house serves at least one day, so the last one on stays on */
      return { days: next.length ? next : g.days };
    },
    row: {
      label: 'Days you serve',
      sub: 'The days your van goes out, and the days Rocoto promises.',
      mark: 'days',
    },
    value: (g) => daysWords(g.days),
    rocoto: () => false,
  },
];

/* ── THE HOUSE'S OWN PAPERWORK (Musings 3+4) ──────────────────────────────────────────────────
 * THE SAME GRAMMAR, A DIFFERENT SUBJECT. These three are `CapabilityQuestion`s to the letter — the
 * same type, the same chips, the same row — so Settings mounts them with the component it already
 * has and re-answering one goes through the code path that answered the first seven.
 *
 * THEY STAY OUT OF THE WALK. `liveQuestions` is what the questionnaire counts and walks, and it
 * reads `CAPABILITY_QUESTIONS` alone: «answer a few questions and Rocoto sets itself up» is about
 * what Rocoto may do on its own, and where the document of truth lives is a fact about the house's
 * back office. Two lists, one grammar, one store.
 *
 * A POSTURE CHANGES NO SURFACE. Read the sentences: both options say who makes the albarán and who
 * invoices, and neither says a screen goes away. That is the blend law, one level up.
 */

export const HOUSE_QUESTIONS: CapabilityQuestion[] = [
  {
    id: 'posture',
    home: 'operations',
    prompt: 'Who makes the delivery note?',
    aside: 'Both ways are ordinary trade, and Rocoto works the same either way.',
    choices: [
      {
        value: 'rocoto',
        label: 'Rocoto makes it',
        hint: 'Rocoto numbers the delivery note and prints it, and your ERP invoices from it.',
      },
      {
        value: 'erp',
        label: 'Your ERP makes it',
        hint: 'Rocoto reads the orders and feeds them over; your ERP numbers the delivery note and invoices.',
      },
    ],
    selected: (g) => [g.posture],
    choose: (_g, v) => ({ posture: v === 'erp' ? 'erp' : 'rocoto' }),
    row: {
      label: 'Who makes the delivery note',
      sub: 'The document of truth, and whose number goes on it.',
      mark: 'doc',
    },
    value: (g) => (g.posture === 'erp'
      ? 'Your ERP makes it, and Rocoto feeds it'
      : 'Rocoto makes it, and your ERP invoices'),
    rocoto: (g) => g.posture === 'rocoto',
  },
  {
    id: 'cadence',
    home: 'operations',
    prompt: 'When do accepted orders reach your ERP?',
    aside: 'Your orders team can be processing while the morning is still arriving.',
    choices: [
      {
        value: 'stream',
        label: 'As each order accepts',
        hint: 'Accepted orders go to your ERP’s queue as they land.',
      },
      {
        value: 'file',
        label: 'With today’s file',
        hint: 'The day travels together, in one file, at the end of it.',
      },
    ],
    selected: (g) => [g.cadence],
    choose: (_g, v) => ({ cadence: v === 'stream' ? 'stream' : 'file' }),
    row: {
      label: 'When the data travels',
      sub: 'The moment an accepted order reaches your ERP.',
      mark: 'send',
    },
    value: (g) => (g.cadence === 'stream' ? 'As each order accepts' : 'With today’s file'),
    rocoto: () => false,
  },
  {
    id: 'invoice',
    home: 'operations',
    prompt: 'When does the invoice exist?',
    aside: 'The delivery note carries the figure and the pay-by date, so it charges either way.',
    choices: [
      {
        value: 'after',
        label: 'After payment',
        hint: 'The delivery note charges it, and the invoice follows once the money is in.',
      },
      {
        value: 'spot',
        label: 'On the spot',
        hint: 'A drop that pays at the door is invoiced there, off the delivery note it just signed.',
      },
    ],
    selected: (g) => [g.invoice],
    choose: (_g, v) => ({ invoice: v === 'spot' ? 'spot' : 'after' }),
    row: {
      label: 'When the invoice exists',
      sub: 'What a customer holds at the door, and what follows them home.',
      mark: 'price',
    },
    value: (g) => (g.invoice === 'spot' ? 'On the spot, at the door' : 'After payment'),
    rocoto: () => false,
  },
];

/* ── THE REGISTER (THE-CHECKPOINT-2026-08-28 §5.1, §5.3, §5.9) ────────────────────────────────
 * THE SAME GRAMMAR, A THIRD SUBJECT. These three are `CapabilityQuestion`s to the letter, so the
 * seat mounts them with the component it already has, the stage plays the two that have a
 * performance, and re-answering one goes through the code path that answered the first seven.
 *
 * THEY STAY OUT OF THE WALK, for the reason the paperwork three do and one more of their own: the
 * walk asks what Rocoto may do without being asked, and HOW IT WRITES IS NOT AN AUTHORITY. A
 * questionnaire that asked «cordial or dry?» between «how big can one order be» and «who answers a
 * price question» would be teaching, in its own sequence, exactly the confusion §5 forbids.
 *
 * AND NOT ONE OF THEM WEARS THE SAFFRON MARK. `rocoto: () => false` on all three, deliberately:
 * the mark means Rocoto acts alone, a register is not an act, and a house reading down this seat
 * sees the marks stop at the dials — which is «tone and autonomy are separate», in ink.
 */

export const REGISTER_QUESTIONS: CapabilityQuestion[] = [
  {
    id: 'tone',
    home: 'agent',
    /* ── THE PERFORMANCE: ONE ANSWER, FOUR REGISTERS ─────────────────────────────────────────
     * The same confirmed order said four ways. It is the cheapest possible demonstration of a
     * register and the only honest one: a person cannot judge a tone from the word «cordial»,
     * and they can judge it instantly from the sentence it produces. */
    example: ({ figureWords, day, customer }) => ({
      opening: [
        { who: 'customer', text: `Morning — the usual for ${day}, and two extra cajas.` },
      ],
      branches: [
        {
          id: 'flat',
          when: (g) => g.tone === 'flat',
          caption: 'Plain — it states what it read and what it did.',
          turns: [
            {
              who: 'rocoto',
              text: `${customer}’s order for ${day}, ${figureWords}. Confirmed.`,
              chip: { kind: 'albaran' },
            },
          ],
        },
        {
          id: 'dry',
          when: (g) => g.tone === 'dry',
          caption: 'Dry — the day and the figure, and it stops there.',
          turns: [
            { who: 'rocoto', text: `Confirmed. ${day}. ${figureWords}.`, chip: { kind: 'albaran' } },
          ],
        },
        {
          id: 'house',
          when: (g) => g.tone === 'house',
          caption: 'Your own house — the register Rocoto read off your own year of messages.',
          turns: [
            {
              who: 'rocoto',
              text: `Morning — got it, on for ${day}. ${figureWords} with the two extra. Anything else, tell me before nine.`,
              chip: { kind: 'albaran' },
            },
          ],
        },
        {
          id: 'cordial',
          /* the fallback branch, as every script's last one is */
          when: () => true,
          caption: 'Cordial — a good morning, the answer, and a way back to you.',
          turns: [
            {
              who: 'rocoto',
              text: `Good morning. That is on for ${day}, ${figureWords} with the two extra cajas. I am here if anything changes.`,
              chip: { kind: 'albaran' },
            },
          ],
        },
      ],
    }),
    prompt: 'How do responses read to your customers?',
    aside: 'Use the register your people already answer in. It sets the words; response rules set the actions.',
    choices: [
      { value: 'flat', label: 'Plain', hint: 'It states what it read and what it did, in the words the trade uses.' },
      { value: 'cordial', label: 'Cordial', hint: 'It opens with a good morning, answers, and leaves a way back to you.' },
      { value: 'dry', label: 'Dry', hint: 'The day and the figure, in one line.' },
      {
        value: 'house',
        label: 'Your own house',
        hint: 'Match your existing messages and show the reading used.',
      },
    ],
    selected: (g) => [g.tone],
    choose: (_g, v) => ({ tone: v as ToneProfile }),
    row: {
      label: 'The register it writes in',
      /* NO SUB. The label names the thing and the value IS the register — a sentence under them
         saying «how Rocoto sounds to a customer» is the explanatory prose §51.7 deletes. */
      mark: 'chat',
    },
    value: (g) => (g.tone === 'flat'
      ? 'Plain — what it read and what it did'
      : g.tone === 'dry'
        ? 'Dry — the day and the figure'
        : g.tone === 'house'
          ? 'Your own house, read off your messages'
          : 'Cordial — a good morning, the answer, a way back'),
    rocoto: () => false,
  },
  {
    id: 'brevity',
    home: 'agent',
    /* ── THE PERFORMANCE: ONE PRICE QUESTION, THREE LENGTHS ─────────────────────────────────── */
    example: ({ customer }) => ({
      opening: [
        { who: 'customer', text: `${customer} here — what is it at today?` },
      ],
      branches: [
        {
          id: 'short',
          when: (g) => g.brevity === 'short',
          caption: 'Just the answer. One line, and the customer is already ordering.',
          turns: [{ who: 'rocoto', text: 'S/ 48.36 the kilo today.' }],
        },
        {
          id: 'full',
          when: (g) => g.brevity === 'full',
          caption: 'The answer and its working, for a house whose customers ask how the number was reached.',
          turns: [
            {
              who: 'rocoto',
              text: 'S/ 48.36 the kilo today — the same class you took on Friday, off this morning’s sheet.',
            },
          ],
        },
        {
          id: 'concise',
          /* the fallback branch, and the default: the answer plus the one fact it turned on */
          when: () => true,
          caption: 'The answer, and the one fact it turned on.',
          turns: [{ who: 'rocoto', text: 'S/ 48.36 the kilo today — the same class as Friday.' }],
        },
      ],
    }),
    prompt: 'How much does Rocoto say?',
    aside: 'A customer at 06:40 wants the number. The rest is yours to ask for.',
    choices: [
      { value: 'short', label: 'Just the answer', hint: 'One line: what it read, and what it did.' },
      {
        value: 'concise',
        label: 'The answer and what it turned on',
        hint: 'One line, plus the single fact the answer depended on.',
      },
      {
        value: 'full',
        label: 'The answer and its working',
        hint: 'What it read, what it did, and where the number came from.',
      },
    ],
    selected: (g) => [g.brevity],
    choose: (_g, v) => ({ brevity: v as Brevity }),
    row: { label: 'How much it says', mark: 'chat' },
    value: (g) => (g.brevity === 'short'
      ? 'Just the answer'
      : g.brevity === 'full'
        ? 'The answer and its working'
        : 'The answer, and what it turned on'),
    rocoto: () => false,
  },
  {
    id: 'voiceNotes',
    home: 'agent',
    /* NO PERFORMANCE, AND THAT IS THE HONEST ANSWER (§53: a setting performs itself WHERE ONE
       FITS). A voice note is a thing you HEAR, and a stage that mimed one with a bubble saying
       «voice note» would be a drawing of the feature rather than the feature. The row states the
       fact and the seat's own dial card carries the choice. */
    prompt: 'Can Rocoto answer with a voice note?',
    aside: 'Choose whether replies can use voice notes when customers do.',
    choices: [
      {
        value: 'yes',
        label: 'It can send one',
        hint: 'A voice-note reply can use the same channel as the customer.',
      },
      { value: 'no', label: 'It writes', hint: 'Every answer goes back as text, on the rail it arrived on.' },
    ],
    selected: (g) => [g.voiceNotes ? 'yes' : 'no'],
    choose: (_g, v) => ({ voiceNotes: v === 'yes' }),
    row: { label: 'Voice notes', mark: 'chat' },
    value: (g) => (g.voiceNotes ? 'It can answer out loud' : 'It writes'),
    rocoto: () => false,
  },
];

/** The questions that mean something under the current answers. */
export const liveQuestions = (g: Grants): CapabilityQuestion[] =>
  CAPABILITY_QUESTIONS.filter((q) => (q.show ? q.show(g) : true));

/* ── THE CONTRACT, SPLIT BY HOME (THE-ADMIN-CANON §5's placement rule) ────────────────────────
 * ONE store, and one home seat per setting. These two functions are the whole of the split, and
 * they read the `home` field rather than a list — so a setting that changes seats changes one
 * character and both seats follow, and no setting can end up on both or on neither.
 *
 * THE WHOLE CONTRACT is the fifteen: the nine the walk asks about, the three about the house's own
 * paperwork, and the three about the register. `liveQuestions` stays what the QUESTIONNAIRE walks,
 * because the walk asks what Rocoto may do alone and where the document of truth lives — and how
 * it writes — are different questions.
 */
export const ALL_SETTINGS: CapabilityQuestion[] = [
  ...CAPABILITY_QUESTIONS, ...HOUSE_QUESTIONS, ...REGISTER_QUESTIONS,
];

/** The dials Your agent renders: what Rocoto may do without being asked.
 *
 *  THE REGISTER ROWS ARE THE SAME SEAT AND A DIFFERENT SECTION, and the LIST is what says so —
 *  `home` answers «which seat», membership of `REGISTER_QUESTIONS` answers «which section of it».
 *  A setting that should sound like a register rather than like a grant moves between two arrays
 *  and both sections follow, which is the same trick `home` plays one level up. */
export const agentSettings = (g: Grants): CapabilityQuestion[] =>
  ALL_SETTINGS.filter(
    (q) => q.home === 'agent' && !REGISTER_QUESTIONS.includes(q) && (q.show ? q.show(g) : true),
  );

/** The register rows Your agent renders under «How it speaks» — how Rocoto writes, never what it
 *  may do. Not one of them wears the saffron mark, and that is the point. */
export const registerSettings = (g: Grants): CapabilityQuestion[] =>
  REGISTER_QUESTIONS.filter((q) => (q.show ? q.show(g) : true));

/** The facts Operations renders: how the house itself runs. */
export const operationsSettings = (g: Grants): CapabilityQuestion[] =>
  ALL_SETTINGS.filter((q) => q.home === 'operations' && (q.show ? q.show(g) : true));

/** One entry by id, for a seat that wants a named row (the stage's control, a cross-surface door). */
export const settingOf = (id: GrantId): CapabilityQuestion | undefined =>
  ALL_SETTINGS.find((q) => q.id === id);

/** How many of the live questions the person has answered themselves. */
export const answeredCount = (g: Grants): number =>
  liveQuestions(g).filter((q) => g.answered.includes(q.id)).length;

/** The first question they have yet to answer, so the questionnaire resumes where they left it. */
export function firstUnanswered(g: Grants): number {
  const live = liveQuestions(g);
  const at = live.findIndex((q) => !g.answered.includes(q.id));
  return at === -1 ? 0 : at;
}
