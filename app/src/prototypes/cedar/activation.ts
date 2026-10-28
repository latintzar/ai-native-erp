/* THE MONO-ACCOUNT JOURNEY — the state behind it (FEED-IA §91 · THE CHECKPOINT §11 · §12 · §13).
 *
 * ═══ WHAT THIS FILE IS ══════════════════════════════════════════════════════════════════════
 * «This is now me crystallising the law. It's highly important.» §91 makes the account's whole
 * life ONE LINEAR PATH — one plan, one journey, ten steps — and this is the state that path is
 * made of: where the account stands, what the next thing is, and what would have to be true for it
 * to be done. The surfaces are `activation-web.tsx`; the guide that walks a person through the
 * live app is `activation-guide.ts`; neither of them decides anything, they read this.
 *
 * ═══ ROCOTO OWNS THE STATE (§91.5 · §27.16 · §13.5) ═════════════════════════════════════════
 * «Third-party onboarding tooling may control presentation, but Rocoto must own the underlying
 * activation state/events. If the external onboarding tool is removed later, the core activation
 * state must remain intact.» So the guide library presents and nothing else: every step below
 * completes off a store this app keeps for its own reasons, and pulling driver.js out would change
 * how a person is walked to a control and change nothing about what the account HAS DONE.
 *
 *   organisation   ← the GRANTS store's own `answered` (`grants.ts`) — the house's working style
 *   history        ← the IMPORT EVENT (`knows.ts`) — what actually arrived
 *   policies       ← the same grants store, the four consequential rows
 *   the rest       ← the activation ledger below: claimed · whatsapp · processed · revealed ·
 *                    guided · tested · cohort. Append-only, persisted, published — `knows.ts`'s
 *                    import store exactly, and for its reasons.
 *
 * NOTHING HERE IS A FLAG. «Completion based on actual product events, not "user clicked Next"»
 * (§13.3a) is kept structurally: an event says WHAT HAPPENED and WHEN, and a step is done because
 * the record contains that thing. A boolean would say only that something once set it.
 *
 * ═══ ONLY NUMBERS THAT ARE ACTUALLY TRUE (§11.3, and `knows.ts`'s own law) ══════════════════
 * The ready return (§91.4.6) states the value AS THEIR OWN PAST YEAR, and every figure in it is
 * either counted off the house's own record or derived from one stated assumption that is PRINTED
 * BESIDE IT. Nothing is called training. «Do not call this "model training complete" unless a model
 * was literally trained» — nothing here was.
 *
 * Two of the checkpoint's own example lines are deliberately absent: «company communication profile
 * ready» has no observer yet (§5.2 is another package's, and a tone fold does not exist), and
 * «validation completed» has no definition anybody could check. A line that cannot be counted is
 * left out rather than written smaller, and this is where that is recorded.
 */
import * as React from 'react';
import type { Cast } from '../../scenarios/data/cast';
import type { SectorId } from '../../scenarios/meta';
import { useConfig } from './config';
import { dayNow, useDay } from './day';
import {
  answeredCount, grantsNow, operationsSettings, resetGrants, setGrants, useGrants,
  type GrantId, type Grants,
} from './grants';
import {
  count, forgetImports, importHistory, productsOf, useImport, type ImportEvent,
} from './knows';
import {
  attentionReadings, bestCustomers, bestSellers, wholeSoles, seasons, type Ranked,
} from './insights';
import { buildSales, isStanding, todayId, type Sale } from './sale';
import { netTally } from './net';
import { tracesOf } from './trace';

/* ── THE COHORT'S OWN CEILING (§91.4.10 · FEED-IA §82.2) ──────────────────────────────────────
 * «Enabling their WhatsApp live FOR CERTAIN CUSTOMERS ONLY», and §82's working number: «a bounded
 * cohort such as up to 10». Stated once so the surface, the metric and the guard cannot disagree.
 * WHICH customers belong in it stays §28's — this file bounds the set and ranks the book; it
 * recommends nobody.
 */
export const COHORT_CAP = 10;

/* ── THE FOUR THAT MATTER (§11.5·4, which §91 keeps) ──────────────────────────────────────────
 * «Only the consequential ones: when to clarify; when to hold for a human; confirmation behavior;
 * off-catalogue policy; tone / Company DNA.» Four of the five are grants today. TONE IS ABSENT ON
 * PURPOSE: §5.1's profiles are another package's build, and a step that waited on a control nobody
 * has shipped would be a step nobody can finish. When the tone entry lands it joins this array and
 * the denominator moves with it — which is why the denominator is derived and never typed.
 */
export const CONSEQUENTIAL: GrantId[] = ['checkIn', 'ceiling', 'confirm', 'assortment'];

/* ── HOW LONG AN ORDER TAKES A PERSON, WHEN A PERSON DOES IT ──────────────────────────────────
 * The ready return says «you'd have saved X hours», and an hour is not a thing this app can count:
 * it is orders × a rate. So the rate is ONE NUMBER, stated here and PRINTED on the surface beside
 * the figure it makes — reading an order, keying it, and checking it back. A projection whose
 * assumption is on the screen is an argument a person can disagree with; the same projection with
 * the assumption hidden is the fake §11.3 forbids.
 */
export const MINUTES_AN_ORDER = 4;

/* ═══ THE LEDGER ═════════════════════════════════════════════════════════════════════════════ */

/* ═══ THE TEN EVENTS (canon §1.3) ════════════════════════════════════════════════════════════
 * «Ten events, appended to the same ledger every other object in this app folds from. Nothing about
 * the journey is a stored flag.» `statusOf` and `stepOf` are both pure folds of this list, so a
 * drive can put an account in any state by appending events — which is how the kit demonstrates all
 * ten steps without a backend.
 *
 * THREE OF THEM ARE SOMEBODY ELSE'S ACT, and that is the design: `invite` and `processed` are
 * Peter's. No status ever changes because a timer expired.
 */
export type ActivationKind =
  | 'invite'            // Peter mints a claim link for one address at one house
  | 'claim'             // the address is proven and a session exists
  | 'org'               // one organisation question, answered
  | 'whatsapp-prepared' // the house reviewed its lines; provider authorization still remains
  | 'whatsapp-connect'  // a verified provider callback bound the number
  | 'share'             // the provider link was sent
  | 'upload'            // a file was accepted
  | 'processed'         // Peter's manual mark, after his own regression
  | 'open-return'       // they came back and read the reveal
  | 'guided'            // the first steps ran to their end
  | 'tested'            // a roleplay test was completed (P1 writes this; nothing here does)
  | 'turn-on'           // a named cohort went live
  | 'expand';           // the whole book went live (§82.7)

export type ActivationEvent = {
  kind: ActivationKind;
  id: string;
  sector: SectorId;
  /** ISO instant — the hour it happened */
  at: string;
  /** who did it. Three of the twelve are the founder's; the rest are the customer's own press. */
  by?: 'founder' | 'customer' | 'provider';
  /** `org`: which question · `upload`: the file · `share`/`invite`: the address */
  field?: string;
  value?: string;
  /** `tested`: whose memory it ran against */
  customer?: string;
  /** `tested`: the test put a genuinely ambiguous family to it */
  ambiguity?: boolean;
  /** `tested`: it ran with no history at all */
  cold?: boolean;
  /** `turn-on`: the accounts turned on, by id — bounded by `COHORT_CAP` at the surface */
  customers?: string[];
};

export const ACTIVATION_STORAGE_KEY = 'rocoto-app-activation';

const KINDS: ActivationKind[] = [
  'invite', 'claim', 'org', 'whatsapp-prepared', 'whatsapp-connect', 'share', 'upload',
  'processed', 'open-return', 'guided', 'tested', 'turn-on', 'expand',
];

const isSector = (s: unknown): s is SectorId => s === 'fish' || s === 'meat' || s === 'fruit';

const isEvent = (e: unknown): e is ActivationEvent => {
  if (!e || typeof e !== 'object') return false;
  const x = e as Record<string, unknown>;
  return typeof x.id === 'string' && typeof x.at === 'string' && isSector(x.sector)
    && KINDS.includes(x.kind as ActivationKind);
};

function read(): ActivationEvent[] {
  try {
    const raw = window.localStorage.getItem(ACTIVATION_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isEvent) : [];
  } catch {
    return [];
  }
}

function write(next: ActivationEvent[]): boolean {
  try {
    window.localStorage.setItem(ACTIVATION_STORAGE_KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

let EVENTS: ActivationEvent[] = typeof window === 'undefined' ? [] : read();

const listeners = new Set<() => void>();

const subscribe = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

const snapshot = (): ActivationEvent[] => EVENTS;

let seq = 0;

const mint = (): string => `act-${Date.now().toString(36)}-${++seq}`;

/** RECORD A MOMENT. One writer, so every step of the journey is written the same way and the
 *  ledger cannot grow two shapes. */
export function record(a: {
  cast: Cast;
  kind: ActivationKind;
  by?: 'founder' | 'customer' | 'provider';
  field?: string;
  value?: string;
  customer?: string;
  ambiguity?: boolean;
  cold?: boolean;
  customers?: string[];
  at?: Date;
}): ActivationEvent {
  const event: ActivationEvent = {
    kind: a.kind,
    id: mint(),
    sector: a.cast.sector,
    at: (a.at ?? new Date()).toISOString(),
    by: a.by ?? 'customer',
    ...(a.field ? { field: a.field } : null),
    ...(a.value ? { value: a.value } : null),
    ...(a.customer ? { customer: a.customer } : null),
    ...(a.ambiguity ? { ambiguity: true } : null),
    ...(a.cold ? { cold: true } : null),
    ...(a.customers ? { customers: a.customers.slice(0, COHORT_CAP) } : null),
  };
  const next = [...EVENTS, event];
  if (!write(next)) throw new Error('Saving this setup step is still pending in this browser.');
  EVENTS = next;
  for (const fn of listeners) fn();
  return event;
}

/** THE SEAM P1 FILLS (§91.4.8 · §27.13). The roleplay test chat is a real product capability and
 *  another package; when a test finishes there it calls this, and the journey's eighth step reads
 *  the result. Nothing in the activation package calls it — a step that could tick itself would be
 *  exactly the «user clicked Next» completion §13.3a forbids. */
export const recordTest = (a: {
  cast: Cast; customer?: string; ambiguity?: boolean; cold?: boolean;
}): ActivationEvent => record({ ...a, kind: 'tested' });

/** THE EXPLICIT ACTIVATION STEP (§91.4.10 · §11.5·5). «Do not enable live sending accidentally.
 *  Require an explicit activation step.» So this is never called by a checkbox: the going-live
 *  flow collects the accounts, states which channel they arrive on, and one named act writes it.
 *
 *  IN THE DESIGN BUILD IT ARMS A LABELLED STATE AND REACHES NOTHING. There is no wire out of this
 *  prototype at all, and the surface says so in its own words. */
export const armCohort = (a: { cast: Cast; customers: string[] }): ActivationEvent =>
  record({ cast: a.cast, kind: 'turn-on', customers: a.customers });

/** Take the record back out — the undo for a house that armed the wrong ten, and the reset a demo
 *  needs to walk the journey again. */
export function forgetActivation(sector: SectorId): void {
  EVENTS = EVENTS.filter((e) => e.sector !== sector);
  write(EVENTS);
  for (const fn of listeners) fn();
}

export const useActivationEvents = (): ActivationEvent[] =>
  React.useSyncExternalStore(subscribe, snapshot, snapshot);

export const activationEventsNow = (): ActivationEvent[] => EVENTS;


/* ═══ THE JOURNEY (canon §1) ═════════════════════════════════════════════════════════════════
 * «The account carries a STATUS. The card carries a STEP. They are different objects and
 * conflating them is the mistake this section exists to prevent.»
 *
 *   STATUS is what the account IS — coarse, seven values over ten steps, read by every other
 *   system. STEP is where the person GOT TO — the card's pointer, derived.
 *
 * Nothing is stored. Both are pure folds of the ledger above, which is what makes the resume law
 * (§1.4) free: leaving halfway and coming back lands on the same step because the events say so.
 */

/** THE ACCOUNT'S STATUS — coarse, and the thing every other system reads (canon §1.1). */
export type AccountStatus =
  | 'invited'     // the link is minted and nobody has claimed it
  | 'claimed'     // real auth done; the house is answering its own setup
  | 'processing'  // the history is in; Rocoto is being built on it
  | 'ready'       // marked processed, the mail sent, the return unopened
  | 'testing'     // the return was read; the guide and free testing run
  | 'bounded'     // a named cohort of real customers is live
  | 'whole';      // the whole book is live (§82.7 — after the month)

/** THE CARD'S POINTER — derived, never stored (canon §1.0). */
export type StepId =
  | 'claim' | 'organisation' | 'whatsapp' | 'data' | 'processing'
  | 'return' | 'first-steps' | 'roleplay' | 'month' | 'live';

/** WHAT KIND OF THING A STEP OPENS, so the card and the modal do not each decide. */
export type StepDoor =
  /** the modal does it — the act belongs to the journey itself */
  | { kind: 'here' }
  /** an address in the app */
  | { kind: 'hash'; at: string }
  /** the guided walk, which drives the live app (§91.4.7) */
  | { kind: 'guide' }
  /** §10 / §91.4.8's roleplay test — P1's, named by id and never built here */
  | { kind: 'seam'; seam: string };

export type JourneyStep = {
  id: StepId;
  /** THE ACT, in three words or fewer (canon §3.1: «what it says»). This is what the card carries. */
  label: string;
  /** the same step said whole, for the modal's own head */
  title: string;
  /** one line: what this buys them. Never a warning, never a negative. */
  sub: string;
  done: boolean;
  /** what is true now, counted. Absent where there is nothing counted to say. */
  words?: string;
  door: StepDoor;
};

/** §10 / §91.4.8's door, named rather than built. */
export const TEST_SEAM = 'roleplay-test';

/** ONE COUNTED CLAIM ABOUT THE HOUSE'S READY STATE. */
export type ReadyFact = { id: string; label: string; value: string; words: string };

/** ONE SCREEN OF THE WRAPPED (canon §6.2). `said` is what the figure was counted over — never
 *  optional, because «a Wrapped figure with no denominator is the one thing that would make this
 *  surface untrustworthy». */
export type RevealScreen = {
  id: 'ready' | 'past' | 'who' | 'what' | 'room' | 'call';
  label: string;
  said: string;
  /** the headline figures, where the screen has them */
  figures?: Array<{ id: string; value: string; label: string }>;
  /** the ranked rows, where the screen is a list */
  rows?: Ranked[];
  /** the value series, where the screen carries the one AreaChart */
  series?: Array<{ month: string; figure: number }>;
};

export type Activation = {
  /** what the account IS (canon §1.1) */
  status: AccountStatus;
  /** where the person got to — the card's pointer (canon §1.0) */
  step: StepId;
  /** the next thing they must do, which is what the card says (§91.1) */
  next: JourneyStep | null;
  steps: JourneyStep[];
  done: number;
  of: number;
  /** the house's own name, for the sentence (§11.2's «[Company]») */
  house: string;
  /** the reveal is readable — marked processed, with a year behind it */
  ready: boolean;
  facts: ReadyFact[];
  method: string;
  reveal: RevealScreen[];
  cohort: { customers: string[]; armed: boolean; at?: string };
};

const lastOf = (kind: ActivationKind, sector: SectorId, events: ActivationEvent[]) => {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const e = events[i];
    if (e.kind === kind && e.sector === sector) return e;
  }
  return undefined;
};

/** THE HOUR, AS A SURFACE PRINTS IT — the ISO instant's own clock, never re-formatted per surface. */
const hour = (iso?: string): string => (iso ? iso.slice(11, 16) : '');

/** The shape a rank fold returns when nothing asked for it. */
const EMPTY_RANK: { rows: Ranked[]; method: string } = { rows: [], method: '' };

/**
 * THE STATUS, FOLDED (canon §1.1). Read backwards from the furthest transition, because a status is
 * «what is true now» and the last thing that happened is what makes it true.
 */
export function statusOf(
  sector: SectorId,
  events: ActivationEvent[],
  /** THE IMPORT IS EVIDENCE OF AN UPLOAD. `BringYourHistory` is the door a person actually drops a
   *  file into and it writes the IMPORT event; the journey's own `upload` is what a provider link
   *  or the backend would write. Both are «the history is received», so both move the status —
   *  otherwise a house that used the built door sits in `claimed` with its year already in. */
  imported?: ImportEvent,
): AccountStatus {
  const has = (k: ActivationKind) => Boolean(lastOf(k, sector, events));
  if (has('expand')) return 'whole';
  if (has('turn-on')) return 'bounded';
  if (has('open-return')) return 'testing';
  if (has('processed')) return 'ready';
  if (has('upload') || imported) return 'processing';
  if (has('claim')) return 'claimed';
  return 'invited';
}

/**
 * THE WHOLE READING, OFF STORES THAT WERE ALREADY BEING KEPT.
 *
 * Pure: it takes what it reads rather than reaching for it, so the same fold answers a render, a
 * drive and — when the backend lands — a request. `coverage(cast, imported)` is the shape it
 * follows, for the reason C5 minted: every post-import number comes off the EVENT, never scaled
 * off the sample the app draws with.
 */
export function activationOf(
  cast: Cast,
  a: {
    house: string;
    imported?: ImportEvent;
    grants: Grants;
    sales: Sale[];
    today: string;
    events: ActivationEvent[];
    /* ── THE REVEAL IS COMPUTED ONLY WHEN IT IS BEING READ ────────────────────────────────────
     * The six screens fold `bestCustomers`, `bestSellers`, `attentionReadings`, `seasons` and one
     * `productsOf` per ranked account — the heaviest reading in this file by an order of magnitude.
     * The CARD needs none of it: it needs the steps and the counts. And the card is mounted in the
     * RAIL, which stands on every surface in the app, so folding the Wrapped there would put six
     * analyses behind every keystroke of the day ledger. It cost `drive-admin` its hydration walk
     * before this flag existed. The reveal's own surface asks for it; nothing else does. */
    reveal?: boolean;
  },
): Activation {
  const { imported, events, grants } = a;
  const sector = cast.sector;

  const claimed = lastOf('claim', sector, events);
  const whatsappPrepared = lastOf('whatsapp-prepared', sector, events);
  const whatsappConnected = lastOf('whatsapp-connect', sector, events);
  const whatsapp = whatsappConnected ?? whatsappPrepared;
  const uploaded = lastOf('upload', sector, events);
  const processed = lastOf('processed', sector, events);
  const returned = lastOf('open-return', sector, events);
  const guided = lastOf('guided', sector, events);
  const tested = lastOf('tested', sector, events);
  const cohort = lastOf('turn-on', sector, events);

  /* THE ORGANISATION IS THE HOUSE'S OWN WORKING STYLE, and it is a store that already exists: the
     operations questions, asked one at a time (§91.4.2's «a trick to get them mentally involved»)
     and answered into `grants`. Nothing is copied — the modal mounts the app's own question. */
  const org = operationsSettings(grants);
  const orgAnswered = org.filter((q) => grants.answered.includes(q.id)).length;
  const orgDone = org.length > 0 && orgAnswered >= org.length;

  const consequential = CONSEQUENTIAL.filter((id) => grants.answered.includes(id)).length;
  const live = cohort?.customers?.length ?? 0;

  const accounts = imported ? imported.customers : cast.customers.length;
  const goods = imported ? imported.grounded : cast.products.length;
  /* THE UPLOAD IS THE EVENT, NOT THE IMPORT ORGAN'S SIDE EFFECT. `BringYourHistory` writes the
     import; the journey's own `upload` is what moves the status — and a house that imported before
     this canon existed still reads as uploaded, because the import event is evidence of it. */
  const hasHistory = Boolean(uploaded || imported);

  const steps: JourneyStep[] = [
    {
      id: 'claim',
      label: 'Claim the account',
      title: `${a.house} on Rocoto`,
      sub: 'Your own login, on your own email.',
      done: Boolean(claimed),
      words: claimed ? `Claimed at ${hour(claimed.at)}.` : undefined,
      door: { kind: 'here' },
    },
    {
      id: 'organisation',
      label: 'Tell us who you are',
      title: 'How your house works',
      sub: 'One question at a time — who makes the delivery note, how goods come in, how you price.',
      done: orgDone,
      words: org.length > 0 ? `${orgAnswered} of ${org.length} answered.` : undefined,
      door: { kind: 'here' },
    },
    {
      id: 'whatsapp',
      /* IT IS EARLY ON PURPOSE (§91.4.3): «so we can get the warming in days». */
      label: 'Review WhatsApp setup',
      title: 'Your WhatsApp Business number',
      sub: 'Review the lines and owners now. Messages start only after Meta confirms the connection.',
      done: Boolean(whatsapp),
      words: whatsappConnected
        ? `Connected at ${hour(whatsappConnected.at)}.`
        : whatsappPrepared
          ? `Prepared at ${hour(whatsappPrepared.at)} · provider activation required.`
          : undefined,
      door: { kind: 'here' },
    },
    {
      id: 'data',
      label: 'Bring your year in',
      title: 'Your records',
      sub: 'Delivery notes first. Drop them in yourself, or send the link to whoever runs your ERP.',
      done: hasHistory,
      words: imported
        ? `${count(imported.albaranes)} delivery notes across ${count(imported.customers)} customers.`
        : undefined,
      door: { kind: 'here' },
    },
    {
      id: 'processing',
      label: 'Review imported records',
      title: 'Review your records',
      sub: 'Review your imported delivery notes before you continue.',
      done: Boolean(processed),
      words: processed ? `Marked through at ${hour(processed.at)}.` : undefined,
      door: { kind: 'here' },
    },
    {
      id: 'return',
      label: 'Review your year',
      title: 'Your year, read back',
      sub: 'Activity and patterns from your records.',
      done: Boolean(returned),
      words: returned ? `Read at ${hour(returned.at)}.` : undefined,
      door: { kind: 'here' },
    },
    {
      id: 'first-steps',
      label: 'Take the first steps',
      title: 'A short walk through the app',
      sub: 'One thing at a time. Press the real control or the button — both do the same thing.',
      done: Boolean(guided),
      door: { kind: 'guide' },
    },
    {
      id: 'roleplay',
      label: 'Try it on your business',
      title: 'Test Rocoto as one of your customers',
      sub: 'Write the way they write, and watch what comes back.',
      done: Boolean(tested),
      words: tested?.customer ? `Tested as ${tested.customer}.` : undefined,
      door: { kind: 'seam', seam: TEST_SEAM },
    },
    {
      id: 'month',
      /* THE MONTH'S OWN DOING (§82.5): «during the month they configure what Rocoto may do» — and
         §11.5·4's consequential rows are exactly that list. The step is a DOOR into the agent seat
         and never a second copy of it (§27.5). */
      label: 'Set response rules',
      title: 'Response rules',
      sub: 'When it asks, when it holds, what it confirms, what it does with a word off your list.',
      done: consequential >= CONSEQUENTIAL.length,
      words: `${consequential} of ${CONSEQUENTIAL.length} answered · ${answeredCount(grants)} settings answered in all.`,
      door: { kind: 'hash', at: '#/admin/agent' },
    },
    {
      id: 'live',
      label: 'Turn Rocoto on',
      title: 'Go live for your first customers',
      sub: `Up to ${COHORT_CAP}, chosen by you. Rocoto answers those accounts and everything else keeps coming to you.`,
      done: Boolean(cohort),
      words: cohort ? `${live} of ${COHORT_CAP} live since ${hour(cohort.at)}.` : undefined,
      door: { kind: 'here' },
    },
  ];

  const next = steps.find((s) => !s.done) ?? null;
  const status = statusOf(sector, events, imported);

  /* ── SCREEN 1 · READY (canon §6.2) ───────────────────────────────────────────────────────
   * Checkpoint §11.2's grammar with the house's name in the sentence. Every figure is counted off
   * the import EVENT where one landed, and off the house's own book before that.
   *
   * TWO OF PETER'S OWN EXAMPLE LINES ARE DELIBERATELY ABSENT: «communication profile ready» has no
   * observer yet (the style fold is P7's, and the canon says «shown only once it exists»), and
   * «validation completed» has no definition anybody could check. */
  const facts: ReadyFact[] = [
    {
      id: 'customers',
      label: 'Customers linked',
      value: count(accounts),
      words: `${count(accounts)} accounts, each with its own words.`,
    },
    {
      id: 'goods',
      label: 'Products categorised',
      value: count(goods),
      words: `${count(goods)} products categorised.`,
    },
    {
      id: 'months',
      label: 'History imported',
      value: imported ? String(imported.months) : '0',
      words: imported
        ? `${imported.months} months imported from ${imported.file}.`
        : 'The history arrives with your first upload.',
    },
    {
      id: 'patterns',
      label: 'Buying patterns',
      value: count(imported ? imported.learned : 0),
      words: imported
        ? `${count(imported.learned)} patterns — where each customer’s words land, and what you fulfil them with.`
        : 'Patterns arrive with the history.',
    },
  ];

  /* ── SCREEN 2 · YOUR PAST YEAR (canon §6.2) ──────────────────────────────────────────────
   * «The honesty rule on this screen is absolute. "You'd have saved X hours" is a counterfactual,
   * and a counterfactual that hides its assumption is a lie with a chart on it.»
   *
   * ⚠ THE HOURS FIGURE IS NOT HERE, AND ITS ABSENCE IS THE SPECIFICATION. The canon's own open:
   * «There is no measured value for [the per-order minutes] yet. Peter's, and until he rules it the
   * screen shows the two measured figures and the value series, and the hours figure waits.» An
   * earlier build of this file computed it against a typed four minutes; that number was nobody's
   * measurement, so it is gone rather than rounded. When Peter rules the minutes, this is the one
   * place the third figure is added.
   *
   * WHAT IS MEASURED: the orders their year actually carried, and the share that would have come to
   * them — `accuracyTally`'s own `held` over the day's real orders, which is the same arithmetic
   * the river's band prints. */
  const tally = netTally(a.sales, a.today);
  const yearOrders = imported ? imported.albaranes : a.sales.filter((s) => s.day === a.today).length;
  /* «CAME TO YOU» IS MEASURED, AND `alone` IS ITS DEFINITION: the orders Rocoto committed on
     arrival with nobody touching them. Everything else came to a person — held, asked about or
     handed on. It is the same arithmetic the river's own band prints (§32.B), read once. */
  const came = tally.orders > 0 ? Math.round(((tally.orders - tally.alone) / tally.orders) * 100) : 0;
  /* THE ONE SERIES ON THE ONE CHART — THEIR YEAR, MONTH BY MONTH (canon §6.3: «one continuous
     quantity over time»). It is `seasons`, which is the fold that reads the IMPORTED ledger: eleven
     minted months plus the live one. The first build plotted `dayTotals` and drew five days of the
     demo river under a heading that says «your last year» — five points, every axis label the same
     date, a claim the picture could not keep. `seasons` returns EMPTY without an import and says so,
     which is the honest shape: no year, no curve. */
  const season = a.reveal ? seasons(cast, a.sales, imported) : { months: [], method: '' };
  const value = Math.round(a.sales.filter((s) => s.day === a.today).reduce((n, x) => n + x.figure, 0));

  const top = a.reveal ? bestCustomers(cast, a.sales, 5) : EMPTY_RANK;
  const sellers = a.reveal ? bestSellers(cast, a.sales, 5) : EMPTY_RANK;

  /* ── «COULD SELL MORE» (canon §6.2, screen 5) ────────────────────────────────────────────
   * «Each row is a product a customer's peers buy and they do not.» The gap is MEASURED — the
   * house's own book says who takes a line and who does not — and it is stated as what IS: how
   * many accounts take it, and one that could.
   *
   * ⚠ WHAT IS DELIBERATELY MISSING: the canon's «what it would be worth». A worth is that
   * customer's likely take × a price × a rhythm, which is three assumptions in a trench coat, and
   * it belongs to the same open as the hours (§6.2's ⚠). The gap is real; the money waits. */
  const ranked = a.reveal ? bestCustomers(cast, a.sales, 12).rows : [];
  const takes = new Map<string, Set<string>>();
  const takenBy = (id: string): Set<string> => {
    const held = takes.get(id);
    if (held) return held;
    const customer = cast.customers.find((c) => c.id === id);
    const set = new Set(customer ? productsOf(cast, customer).map((pr) => pr.id) : []);
    takes.set(id, set);
    return set;
  };
  const room = sellers.rows
    .map((prod) => {
      const buyers = ranked.filter((r) => takenBy(r.id).has(prod.id)).length;
      const offer = ranked.find((r) => !takenBy(r.id).has(prod.id));
      return offer
        ? {
          id: `${prod.id}-${offer.id}`,
          name: prod.name,
          figure: 0,
          share: 0,
          detail: `${buyers} of your biggest accounts take it. ${offer.name} is one to offer it to.`,
        }
        : null;
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
  /* «WORTH A CALL» — §91's «biggest opportunity accounts ("reasonably big but likely recently")».
     Peter's parenthesis decodes as BIG ENOUGH TO MATTER AND SOMETHING MOVED RECENTLY, so the
     Wrapped narrows `attentionReadings` to the readings that say a thing changed. */
  const worth = (a.reveal ? attentionReadings(cast, a.sales) : [])
    .filter((r) => r.kind === 'dropped' || r.kind === 'changed')
    .slice(0, 5);

  const reveal: RevealScreen[] = [
    {
      id: 'ready',
      label: `Ready for ${a.house}`,
      said: imported
        ? `${count(imported.albaranes)} delivery notes · ${imported.months} months.`
        : `${count(accounts)} accounts · ${count(goods)} goods.`,
      figures: facts.map((f) => ({ id: f.id, value: f.value, label: f.label })),
    },
    {
      id: 'past',
      label: 'If Rocoto had handled your last year',
      said: `Last ${count(yearOrders)} delivery notes. “Came to you” shows orders needing review, clarification, or handoff against today’s ${count(tally.orders)}.`
        + (season.months.length > 0 ? ' The curve is what each month came to, in thousands of soles.' : '')
        + (season.method ? ` ${season.method}` : ''),
      figures: [
        { id: 'orders', value: count(yearOrders), label: 'orders read' },
        { id: 'came', value: `${came}%`, label: 'came to you' },
        { id: 'value', value: wholeSoles(value), label: 'went through in a day' },
      ],
      /* IN THOUSANDS, AND THE METHOD SAYS SO — the seat's own convention («in thousands of soles»
         on Your weeks). A house's month is a seven-figure euro number and the value axis has room
         for five characters at this type size, so the first build printed «00.000» down the left
         edge: a chart that has stopped being readable. */
      series: season.months.map((m) => ({ month: m.label, figure: Math.round(m.value / 1000) })),
    },
    { id: 'who', label: 'Your best customers', said: top.method, rows: top.rows },
    { id: 'what', label: 'What you sell most', said: sellers.method, rows: sellers.rows },
    {
      id: 'room',
      label: 'Could sell more',
      said: 'Read across your twelve biggest accounts and the five lines that move most, over the '
        + 'delivery notes you sent.',
      rows: room,
    },
    {
      id: 'call',
      label: 'Worth a call',
      said: worth.length > 0
        ? 'Accounts whose own record moved — a rhythm that slipped, or a line they always took, gone.'
        : 'This fills in as accounts move off their own rhythm.',
      rows: worth.map((r) => ({
        id: r.customer,
        name: r.name,
        figure: 0,
        share: 0,
        detail: `${r.line} · ${r.evidence}`,
      })),
    },
  ];

  return {
    status,
    step: next ? next.id : steps[steps.length - 1].id,
    next,
    steps,
    done: steps.filter((s) => s.done).length,
    of: steps.length,
    house: a.house,
    ready: Boolean(imported && processed),
    facts,
    method: `${count(accounts)} accounts · ${count(goods)} goods.`,
    reveal,
    cohort: { customers: cohort?.customers ?? [], armed: Boolean(cohort), at: cohort?.at },
  };
}

/** THE ONE HOOK EVERY SURFACE READS. It subscribes to all four stores, so the card at the rail's
 *  foot and a figure on Your data move in the same frame. */
export function useActivation(cast: Cast, reveal = false): Activation {
  const { config } = useConfig();
  const imported = useImport(cast.sector);
  const grants = useGrants();
  const ledger = useDay(cast.sector);
  const events = useActivationEvents();
  const house = config.brand.name || cast.house.name;

  return React.useMemo(() => {
    const sales = buildSales(cast, ledger);
    return activationOf(cast, {
      house, imported, grants, sales, today: todayId(cast), events, reveal,
    });
  }, [cast, house, imported, grants, ledger, events, reveal]);
}

/** The same reading, outside a render — for a fold asked by a store rather than a screen. */
export function activationNow(cast: Cast, house: string, imported?: ImportEvent): Activation {
  const ledger = dayNow();
  const sales = ledger.sector === cast.sector ? buildSales(cast, ledger) : [];
  return activationOf(cast, {
    house, imported, grants: grantsNow(), sales, today: todayId(cast), events: EVENTS, reveal: true,
  });
}

/* ── WHAT THE MONTH IS CARRYING (canon §3.3 · checkpoint §12) ─────────────────────────────────
 * «It is the card, in its month phase.» From `ready` onward the card stops counting setup steps and
 * starts carrying the month — the same object, the same seat, the same modal, a different fold.
 * Each figure states what it was counted over: §12.2's clause, made structural.
 */
export type MonthFact = { id: string; label: string; value: string; said: string };

export function monthFacts(cast: Cast, a: {
  sales: Sale[]; today: string; cohort: number; taught: Array<{ saleId: string }>;
}): MonthFact[] {
  const today = a.sales.filter((s) => s.day === a.today);
  /* «WAITING» IS `isStanding`, THE APP'S ONE DEFINITION (§75.2). The river's rows, the export
     centre's review rail and this figure are three readings of one predicate. */
  const waiting = today.filter((s) => isStanding(s, a.today)).length;
  const corrected = new Set(a.taught.map((t) => t.saleId)).size;
  const clean = today.length > 0 ? Math.round(((today.length - corrected) / today.length) * 100) : 0;
  return [
    {
      id: 'live',
      label: 'Customers live',
      value: `${a.cohort} of ${COHORT_CAP}`,
      said: `Out of ${count(cast.customers.length)} accounts in your book.`,
    },
    {
      id: 'clean',
      label: 'Went through untouched',
      value: today.length > 0 ? `${clean}%` : '—',
      said: today.length > 0
        ? `${count(today.length - corrected)} of today’s ${count(today.length)} orders stood as Rocoto read them.`
        : 'The rate starts with the day’s first order.',
    },
    {
      id: 'waiting',
      label: 'Waiting for you',
      value: count(waiting),
      said: `Of today’s ${count(today.length)} orders, the ones standing for an answer.`,
    },
  ];
}

/** The month's numbers, subscribed. */
export function useMonthFacts(cast: Cast, cohort: number): MonthFact[] {
  const ledger = useDay(cast.sector);
  /* IT TAKES THE COHORT'S SIZE RATHER THAN FOLDING FOR IT. Calling `useActivation` here would run a
     second whole journey fold beside the card's own — one number's worth of work, twice, on the
     rail, on every surface. */
  return React.useMemo(() => monthFacts(cast, {
    sales: buildSales(cast, ledger),
    today: todayId(cast),
    cohort,
    taught: tracesOf(cast),
  }), [cast, ledger, cohort]);
}

/* ═══ THE STAGE — the journey's moments, made enterable (FEED-IA §100) ═══════════════════════
 *
 * ═══ PETER'S ASK, VERBATIM ══════════════════════════════════════════════════════════════════
 * «Maybe the app should start with asking me what I want to see — a normal app after someone's
 * used it, or a normal app as they log in? What are the different entry points, the different
 * stages I start with, so that I can understand where I'm going. That would clear it up for you as
 * well — the engineer uses eyes and then codes; you see the code first.»
 *
 * ═══ WHY THIS IS TWENTY LINES AND NOT A FLOW ENGINE ═════════════════════════════════════════
 * §100's own law: «Because stages are FOLDS OF EVENTS, entering a stage = seeding the ledger to
 * that moment — no scripted flows, no hard-coding, and therefore nothing that traps the wiring AI
 * later.» Everything this section needs already exists above it. A stage is READ by folding the
 * same ledger `statusOf` folds, and it is ENTERED by appending the events that moment is made of.
 * There is no stage field, nothing stores which stage is standing, and the backend that lands next
 * inherits a switch that only ever wrote real journey events.
 *
 * WHICH IS ALSO WHY IT PERSISTS FOR FREE. The house switch persists because the config is a store;
 * this persists because the LEDGER is one. A reload re-reads the events and folds the same stage.
 *
 * ═══ IT IS A FOUNDER CONTROL, NOT A DEBUG PANEL ═════════════════════════════════════════════
 * It serves three masters at once — Peter's demos, Peter's review, and a drive's deterministic
 * entry into any flow — and all three want the same thing: the app AS IT IS at that moment, with
 * nothing labelled «test». So the seed writes only what a real journey writes.
 */

/** THE EIGHT ENTERABLE MOMENTS, in the journey's own order (§100). Seven of them are one status
 *  each; `claimed` and `uploading` are the two halves of `claimed`, because «they are in and have
 *  answered nothing» and «the house is described and the year is on its way» are the two things a
 *  person most wants to enter separately, and the ledger already tells them apart. */
export type StageId =
  | 'invite' | 'claimed' | 'uploading' | 'processing'
  | 'ready' | 'testing' | 'bounded' | 'mature';

/** WHERE A STAGE OPENS. The surface a moment naturally shows — the same three kinds of door
 *  `StepDoor` already names, one level up: an address, the journey's own modal, the test chat. */
export type StageLanding =
  /** an address in the app, and nothing else to open */
  | { kind: 'hash'; at: string }
  /** the address, and then the journey card — which opens on the step this stage stands at */
  | { kind: 'journey'; at: string }
  /** the address, and then the conversation the roleplay test runs in */
  | { kind: 'chats'; at: string };

export type Stage = {
  id: StageId;
  /** the moment's own name — Peter's own words for it (§100) */
  name: string;
  /** what is true at it, in one line */
  said: string;
  /** what the app opens on, said as the thing a person will be looking at */
  lands: string;
  /** the status the ledger folds to once this stage is seeded — stated here so the surface, the
   *  seed and a drive read one table rather than three */
  status: AccountStatus;
  landing: StageLanding;
};

/** THE PILOT'S SIZE, in the seed. §82.2's «up to 10» is the CEILING (`COHORT_CAP`); a house that
 *  has just gone live is running a handful, so the seeded cohort is a handful and the month's own
 *  figure reads «4 of 10» rather than a full board on day one. */
export const STAGE_COHORT = 4;

export const STAGES: Stage[] = [
  {
    id: 'invite',
    name: 'Fresh invite',
    said: 'A link exists for one address. The account opens on their first press.',
    lands: 'the claim screen',
    status: 'invited',
    landing: { kind: 'journey', at: '#/sales' },
  },
  {
    id: 'claimed',
    name: 'Claimed',
    said: 'They signed in with their email address and can continue setup.',
    lands: 'the first question',
    status: 'claimed',
    landing: { kind: 'journey', at: '#/sales' },
  },
  {
    id: 'uploading',
    name: 'Uploading',
    said: 'Business details are saved. Prepare WhatsApp and add records.',
    lands: 'the upload',
    status: 'claimed',
    landing: { kind: 'hash', at: '#/admin/data' },
  },
  {
    id: 'processing',
    name: 'Processing',
    said: 'Records are in. Manual review is required before you continue.',
    lands: 'the reading',
    status: 'processing',
    landing: { kind: 'journey', at: '#/sales' },
  },
  {
    id: 'ready',
    name: 'Ready return',
    said: 'Marked through, the mail gone, and the year read back is waiting to be opened.',
    lands: 'the return',
    status: 'ready',
    landing: { kind: 'journey', at: '#/sales' },
  },
  {
    id: 'testing',
    name: 'Mid-testing',
    said: 'The return was read and the walk is done. Rocoto answers inside test threads.',
    lands: 'the test chat',
    status: 'testing',
    landing: { kind: 'chats', at: '#/sales' },
  },
  {
    id: 'bounded',
    name: 'Live-bounded',
    said: `${STAGE_COHORT} named accounts are live on WhatsApp, and the rest of the book comes to you.`,
    lands: 'this month',
    status: 'bounded',
    landing: { kind: 'journey', at: '#/sales' },
  },
  {
    id: 'mature',
    name: 'Mature in-use app',
    said: 'The whole book is live and the journey is behind them. The app in use.',
    lands: 'the day',
    status: 'whole',
    landing: { kind: 'hash', at: '#/sales' },
  },
];

/** The ladder, so «has this house reached X» is one comparison. */
const LADDER: StageId[] = STAGES.map((s) => s.id);

export const stageNamed = (id: StageId): Stage =>
  STAGES.find((s) => s.id === id) ?? STAGES[0];

/**
 * THE STAGE, FOLDED — `statusOf` with one more rung on it (§100).
 *
 * Six of the seven statuses are one stage each. `claimed` is the one that carries two moments, and
 * the ledger separates them without a new field: a house that has answered a question of its own,
 * bound its number or sent the provider link is BRINGING ITS YEAR IN, and one that has done none of
 * those has just walked through the door.
 */
export function stageOf(
  sector: SectorId,
  events: ActivationEvent[],
  imported?: ImportEvent,
): StageId {
  const status = statusOf(sector, events, imported);
  if (status === 'whole') return 'mature';
  if (status === 'bounded') return 'bounded';
  if (status === 'testing') return 'testing';
  if (status === 'ready') return 'ready';
  if (status === 'processing') return 'processing';
  if (status === 'invited') return 'invite';
  const moved = events.some((e) => e.sector === sector
    && (e.kind === 'org' || e.kind === 'whatsapp-prepared' || e.kind === 'whatsapp-connect' || e.kind === 'share'));
  return moved ? 'uploading' : 'claimed';
}

/** The stage this house stands at, subscribed — the founder surface's one read. */
export function useStage(cast: Cast): StageId {
  const events = useActivationEvents();
  const imported = useImport(cast.sector);
  return React.useMemo(
    () => stageOf(cast.sector, events, imported),
    [cast.sector, events, imported],
  );
}

/* ── THE SEED'S OWN CLOCK ─────────────────────────────────────────────────────────────────────
 * Every step of the journey PRINTS ITS HOUR («Claimed at 18:40», «Marked through at 08:30»), so a
 * seeded journey that happened in one millisecond would put the same minute on ten lines. The
 * sequence therefore lands on the days and hours a real one lands on — nine days back for the
 * invite, the mark-through three days after the upload, the whole-book expansion this morning.
 */
const SEED_DAYS = 9;

const when = (day: number, h: number, m: number): Date => {
  const d = new Date();
  d.setDate(d.getDate() - (SEED_DAYS - day));
  d.setHours(h, m, 0, 0);
  return d;
};

/** The file a year of albaranes arrives as. It is the DOCUMENT's own word and not a name off any
 *  house (cast law 10), which is why it can be written here. */
const SEED_FILE = 'albaranes-12-meses.csv';

/**
 * ENTER A STAGE — the whole switch, and the only thing §100 adds to the model.
 *
 * ═══ IT CLEARS FIRST, WHICH IS WHAT MAKES IT A SWITCH ═══════════════════════════════════════
 * Appending alone would only ever move a house FORWARD, and the entry points Peter asked for are
 * enterable from each other in both directions — the demo that starts at the mature app and then
 * shows the fresh invite is the demo he described. So the house's own record goes out first
 * (`forgetActivation` and `forgetImports`, both already the undo for exactly this) and the
 * sequence up to the chosen rung is written from nothing. Every other house is untouched: both
 * take a sector.
 *
 * ═══ THREE STORES, BECAUSE THREE STORES ARE WHAT THE JOURNEY IS FOLDED FROM ═════════════════
 * The ledger carries seven of the ten steps; the IMPORT carries «bring your year in» (and every
 * counted figure the return reads); the GRANTS carry «tell us who you are» and «set what it may
 * do» — which is the file header's own table, obeyed rather than worked around. A stage that wrote
 * only events would put a house at `bounded` with two steps of its own journey unticked.
 *
 * THE GRANTS COME BACK TO THEIR SEED FIRST, and that is the same totality the house switch already
 * has — `seedInto` drops the grants key outright when a house changes, because a seeded world is
 * seeded whole. It is also the only honest way DOWN the ladder: `setGrants` can add an answer and
 * has no way to take one back, so a mature house re-entered at the fresh invite would carry its
 * setup answers into a moment that is defined by not having given them.
 */
export function seedStage(id: StageId, cast: Cast): void {
  const rung = LADDER.indexOf(id);
  if (rung < 0) return;
  const at = (stage: StageId): boolean => rung >= LADDER.indexOf(stage);

  forgetActivation(cast.sector);
  forgetImports(cast.sector);

  /* THE ONE ACT THAT IS ALWAYS PETER'S (canon §1.1). Every stage stands on an invite. */
  record({ cast, kind: 'invite', by: 'founder', at: when(0, 9, 12) });

  if (at('claimed')) record({ cast, kind: 'claim', at: when(0, 18, 40) });

  if (at('uploading')) {
    /* ONE EVENT PER QUESTION THE HOUSE ANSWERED, off the app's own operations set rather than a
       typed number — the set grows and the seed grows with it. The grants below are what the STEP
       reads; these are what the ledger remembers. */
    operationsSettings(grantsNow()).forEach((q, i) => {
      record({ cast, kind: 'org', field: q.id, at: when(1, 8, 10 + i * 3) });
    });
    record({ cast, kind: 'whatsapp-prepared', at: when(1, 9, 5) });
    /* `share` IS DELIBERATELY ABSENT. It carries the ERP provider's own address, and there is no
       true one to write — §11.3's law reaches the ledger as much as it reaches a figure. The house
       brings its own year in, which is the other door the same step offers. */
  }

  if (at('processing')) {
    importHistory({ cast, file: SEED_FILE, at: when(2, 11, 48) });
    record({ cast, kind: 'upload', value: SEED_FILE, at: when(2, 11, 48) });
  }

  if (at('ready')) record({ cast, kind: 'processed', by: 'founder', at: when(5, 8, 30) });

  if (at('testing')) {
    record({ cast, kind: 'open-return', at: when(5, 19, 5) });
    record({ cast, kind: 'guided', at: when(5, 19, 22) });
    record({
      cast,
      kind: 'tested',
      /* THE TEST RAN AGAINST ONE OF THIS HOUSE'S OWN ACCOUNTS (cast law 10), and it put a real
         ambiguity to it — which is what the step's own line says when it says «Tested as X». */
      customer: cast.customers[0]?.name,
      ambiguity: true,
      at: when(6, 10, 15),
    });
  }

  if (at('bounded')) {
    record({
      cast,
      kind: 'turn-on',
      customers: cast.customers.slice(0, STAGE_COHORT).map((c) => c.id),
      at: when(7, 8, 40),
    });
  }

  if (at('mature')) record({ cast, kind: 'expand', at: when(9, 8, 5) });

  /* ── THE TWO STEPS THAT ARE ANSWERS AND NOT EVENTS ─────────────────────────────────────────
     «Tell us who you are» is the operations set; «set what it may do» is `CONSEQUENTIAL`. Both are
     read off the grants store, so a stage seeds them there or the journey it just wrote reads
     short by two. */
  resetGrants();
  const answered: GrantId[] = [
    ...(at('uploading') ? operationsSettings(grantsNow()).map((q) => q.id) : []),
    ...(at('bounded') ? CONSEQUENTIAL : []),
  ];
  /* ONE CALL PER ANSWER, because that is what answering IS in this store — `setGrants(patch, id)`
     marks one question as the person's own, and there is no bulk door to reach around it. */
  for (const id of new Set(answered)) setGrants({}, id);
}
