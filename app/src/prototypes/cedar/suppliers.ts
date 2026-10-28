/* SUPPLIER FORWARDING — the fourth export category (FEED-IA §35.7).
 *
 * ═══ THE DOCTRINE, VERBATIM ═════════════════════════════════════════════════════════════════
 * «If enabled: chosen products (all, or categories) are sent AS A LIST by email to a partner
 * supplier (company name · the person/team that handles it · address), on a CUTOFF TIMER per
 * product category — his real example: chicken and turkey cut off at 01:30 and sent daily to the
 * beef supplier; later arrivals roll to the next day. The send is AUTOMATIC — no person presses it
 * at 01:30. Tracked by date and sent-or-not. This is why product knowledge matters: CATEGORISATION
 * IS THE ROUTING.» (§35.7)
 *
 * Four rails carry an albarán out of this house — PRINT · ERP · EMAIL (§35.3) and this one. It is
 * the odd one of the four because it is the only rail that is not about ONE document: it aggregates
 * a whole day's lines across every customer into a single list for one partner, and it goes out on
 * a timer rather than in a person's hand.
 *
 * ═══ THE ROUTING IS THE LADDER, AND NOTHING ELSE ════════════════════════════════════════════
 * A partner holds LADDER NODES (`catalogue.ts`'s tree), not words: `n-shellfish`, `n-cephalopod`.
 * A product is routed by grounding its own NAME onto the tree — the same walk the writing line
 * makes and the same walk `trace.ts` labels a correction with — and then asking whether the
 * partner's set contains that node or any of its ancestors. So «gamba roja de Palamós» reaches the
 * marisco partner because the intelligence already knows what a gamba is, which is exactly what
 * §35.7 means by «this is why product knowledge matters». No second opinion is written here.
 *
 * ═══ THE RUNS ARE DERIVED, NEVER STORED (the `rules.ts` law) ════════════════════════════════
 * A run is a pure function of the partner, the day's own orders and the clock. Nothing writes a
 * run row on a timer, so a prototype opened tomorrow has tomorrow's runs and two surfaces reading
 * one partner can never disagree about what went out. The ONE thing that is stored is the run a
 * PERSON asked for out of turn — «send what's waiting now» — because a hand is an event and an
 * event has to be remembered.
 *
 * ═══ THE WINDOW, AND WHY THE ROLL FALLS OUT OF IT ═══════════════════════════════════════════
 * The run for day D closes at the cutoff T and carries everything that came in since the previous
 * close: the orders of day D−1 that arrived at or after T, plus the orders of day D that arrived
 * before it. Say it that way and «later arrivals roll to the next day» is not a rule anybody had
 * to write — it is what the window does. A cutoff of 01:30 sits before the market opens, so a
 * morning's orders never make that morning's list and every one of them rolls; a cutoff of 06:00
 * sits inside the morning, so a run splits the day and only the late half rolls.
 *
 * ═══ WHAT A DAY IS HERE ═════════════════════════════════════════════════════════════════════
 * A sale belongs to its delivery day and carries the hour it reached the desk, which is how every
 * other surface in this app reads it. The window above is therefore stated in (day, hour) pairs
 * off those two fields and reads no clock of its own — the app's clock does not run, it states the
 * morning the cast is standing in (`day.ts`).
 *
 * NO PROVIDER, the same decision as `rules.ts`, `grants.ts` and `print-queue.ts`: a module
 * singleton published through `useSyncExternalStore`, so Settings and anything later that wants to
 * say «this goes to Mariscos Vidal» read one set and re-render on one write.
 */
import * as React from 'react';
import type { SectorId } from '../../scenarios/meta';
import type { Cast, PartnerSeed, Product } from '../../scenarios/data/cast';
import { FORWARDING_PARTNERS } from '../../scenarios/data/cast';
import { ancestorsOf, ground, liftTo, nameOfNode, nodeOf } from './catalogue';
import { dayFromId, dayIdOf, shiftDay, type Sale } from './sale';

/* ── THE OBJECT ───────────────────────────────────────────────────────────────────────────── */

/** A partner supplier, as a house configured it. `sector` is stamped on it for the same reason a
 *  rule carries one: three casts all have a first shelf, and a house switched in Settings must see
 *  its own partners rather than somebody else's. */
export type Partner = PartnerSeed & { sector: SectorId };

/** What the add flow hands the store. Identity is the store's business. */
export type PartnerDraft = Omit<PartnerSeed, 'id'> & { sector: SectorId };

/** A run a PERSON asked for, out of turn. The only stored fact in this file, because a hand is an
 *  event: the timer's own runs are derived and this one happened. */
export type HandRun = {
  id: string;
  sector: SectorId;
  /** Partner.id */
  partner: string;
  /** the day it was asked for, `YYYY-MM-DD` */
  day: string;
  /** the hour it went, in the day's own clock */
  at: string;
  /** how many lines it carried */
  lines: number;
};

/** One row of the log: a date, an hour, what it carried and whether it has gone (§35.7: «tracked
 *  by date and sent-or-not»). */
export type Run = {
  day: string;
  at: string;
  /** the day this run's window OPENED on — where its lines rolled from */
  from: string;
  lines: number;
  sent: boolean;
  /** a hand asked for this one; the rest are the timer's */
  byHand: boolean;
};

/* ── THE HOURS ON OFFER ───────────────────────────────────────────────────────────────────────
 * A closed register, the way `rules.ts` offers replenish times — a cutoff a person types is a
 * cutoff nobody can read back consistently. It runs through the small hours because that is where
 * the founder's own example lives: a list that closes at 01:30 gives the partner the whole night.
 */
export const CUTOFF_TIMES: string[] = [
  '00:00', '00:30', '01:00', '01:30', '02:00', '02:30', '03:00', '04:00', '05:00',
  '06:00', '07:00', '08:00', '09:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00',
];

/* ── THE ROUTING ──────────────────────────────────────────────────────────────────────────────
 * One walk, read three ways: what a product IS, what shelf it sits on, and whether a partner's set
 * claims it. Every one of them starts at `ground`, so the routing and the intelligence are the
 * same machinery seen from two sides.
 */

/** The node a product's own name grounds onto, and every ancestor above it — deepest first.
 *
 *  IT IS KEYED BY THE WORD, AND REMEMBERED. A morning of three hundred orders is some thousands of
 *  lines, and grounding runs a list of thirty-odd expressions over the name every time; the answer
 *  depends on the name and on nothing else, so it is worked out once per word. */
const CHAINS = new Map<string, string[]>();

export function chainOf(product: Product): string[] {
  const key = `${product.family}·${product.name}`;
  const held = CHAINS.get(key);
  if (held) return held;
  const node = ground(product.name, product.family);
  const made = [node, ...ancestorsOf(node).map((n) => n.id)];
  CHAINS.set(key, made);
  return made;
}

/** THE ROUTING ITSELF. A partner takes this product when its set holds the product's own node or
 *  anything above it — which is what makes a FAMILY mean «everything under it» without a second
 *  rule being written for the word «all». */
export const takes = (partner: Partner, product: Product): boolean =>
  chainOf(product).some((n) => partner.categories.includes(n));

/** The L1 shelf a product sits on — the level a house's own resolution stops at (§10.1). */
export const categoryOf = (product: Product): string =>
  liftTo(ground(product.name, product.family), 'category');

/** Everything in this house's catalogue that a node claims. */
export const goodsIn = (cast: Cast, node: string): Product[] =>
  cast.products.filter((p) => chainOf(p).includes(node));

/** Everything in this house's catalogue that a partner takes. */
export const goodsFor = (cast: Cast, partner: Partner): Product[] =>
  cast.products.filter((p) => takes(partner, p));

/** One node a partner's set may hold, with the goods that would route through it. */
export type LadderPick = {
  node: string;
  /** L0 or L1 — the two levels §35.7 offers («all, or categories») */
  level: 'family' | 'category';
  name: string;
  goods: Product[];
};

/**
 * THE PICKER'S OWN LIST — the ladder this house actually reaches.
 *
 * Not the whole tree: a fish house choosing between «Aves» and «Curados» is a house being asked
 * about goods it has never sold. So the list is grown from the house's OWN catalogue — every
 * family it touches, and under each one the categories its products land on — which also means
 * every row in the picker routes something real, and a partner cannot be configured to receive an
 * empty list forever.
 */
export function houseLadder(cast: Cast): LadderPick[] {
  const under = new Map<string, string[]>();
  for (const p of cast.products) {
    const chain = chainOf(p);
    const family = chain.find((id) => nodeOf(id)?.level === 'family') ?? chain[chain.length - 1];
    const cat = categoryOf(p);
    const held = under.get(family) ?? [];
    if (nodeOf(cat)?.level === 'category' && !held.includes(cat)) held.push(cat);
    under.set(family, held);
  }
  const out: LadderPick[] = [];
  for (const [family, cats] of under) {
    out.push({ node: family, level: 'family', name: nameOfNode(family), goods: goodsIn(cast, family) });
    for (const c of cats) {
      out.push({ node: c, level: 'category', name: nameOfNode(c), goods: goodsIn(cast, c) });
    }
  }
  return out;
}

/* ── THE STORE ────────────────────────────────────────────────────────────────────────────── */

export const PARTNERS_STORAGE_KEY = 'rocoto-app-partners';
export const PARTNER_RUNS_STORAGE_KEY = 'rocoto-app-partner-runs';
export const PARTNERS_SEEDED_KEY = 'rocoto-app-partners-seeded';

const isSector = (s: unknown): s is SectorId => s === 'fish' || s === 'meat' || s === 'fruit';

const isPartner = (p: unknown): p is Partner => {
  if (!p || typeof p !== 'object') return false;
  const x = p as Record<string, unknown>;
  return (
    typeof x.id === 'string' &&
    typeof x.company === 'string' &&
    typeof x.contact === 'string' &&
    (x.contactKind === 'person' || x.contactKind === 'team') &&
    typeof x.email === 'string' &&
    typeof x.cutoff === 'string' &&
    Array.isArray(x.categories) &&
    x.categories.every((c) => typeof c === 'string') &&
    isSector(x.sector)
  );
};

const isHandRun = (r: unknown): r is HandRun => {
  if (!r || typeof r !== 'object') return false;
  const x = r as Record<string, unknown>;
  return (
    typeof x.id === 'string' &&
    typeof x.partner === 'string' &&
    typeof x.day === 'string' &&
    typeof x.at === 'string' &&
    Number.isFinite(x.lines) &&
    isSector(x.sector)
  );
};

function readList<T>(key: string, keep: (v: unknown) => v is T): T[] {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(keep) : [];
  } catch {
    return [];
  }
}

function writeList(key: string, next: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(next));
  } catch {
    /* a prototype in a private window still has to run */
  }
}

let PARTNERS: Partner[] = typeof window === 'undefined' ? [] : readList(PARTNERS_STORAGE_KEY, isPartner);
let HAND: HandRun[] = typeof window === 'undefined' ? [] : readList(PARTNER_RUNS_STORAGE_KEY, isHandRun);

const listeners = new Set<() => void>();

const subscribe = (l: () => void): (() => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

const announce = (): void => {
  for (const l of listeners) l();
};

const partnersSnapshot = (): Partner[] => PARTNERS;
const handSnapshot = (): HandRun[] => HAND;

let seq = 0;
const nextId = (prefix: string): string => `${prefix}-${Date.now().toString(36)}-${(seq += 1)}`;

/** Connect a partner. It starts running the moment it exists — the timer is the feature. */
export function addPartner(draft: PartnerDraft): Partner {
  const partner: Partner = { ...draft, id: nextId('partner') };
  PARTNERS = [...PARTNERS, partner];
  writeList(PARTNERS_STORAGE_KEY, PARTNERS);
  announce();
  return partner;
}

/** Take a partner off. Its runs go with it: a log about a partner nobody has is a log nobody can
 *  act on, and the sends themselves were emails that have already landed at their end. */
export function removePartner(id: string): void {
  PARTNERS = PARTNERS.filter((p) => p.id !== id);
  HAND = HAND.filter((r) => r.partner !== id);
  writeList(PARTNERS_STORAGE_KEY, PARTNERS);
  writeList(PARTNER_RUNS_STORAGE_KEY, HAND);
  announce();
}

/**
 * Sending through a provider cannot be simulated by writing a local run. This retained export is
 * deliberately a fail-closed compatibility seam until the server records a provider receipt.
 */
export function sendNow(_a: { sector: SectorId; partner: string; day: string; at: string; lines: number }): null {
  return null;
}

/* ── THE SEEDED PARTNERS ──────────────────────────────────────────────────────────────────────
 * Planted once per catalogue, exactly the way `rules.ts` plants the demonstration rule: a surface
 * with nothing on it teaches nothing, and a demonstration that grows back after you remove it
 * teaches the wrong thing. The names live in `cast.ts` (law 10: no name is typed into a screen).
 */

function seeded(): string[] {
  try {
    const raw = window.localStorage.getItem(PARTNERS_SEEDED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

/** Plant this catalogue's partners, once and only once. */
export function seedPartners(sector: SectorId): void {
  const done = seeded();
  if (done.includes(sector)) return;
  writeList(PARTNERS_SEEDED_KEY, [...done, sector]);
  const seeds = FORWARDING_PARTNERS[sector] ?? [];
  if (seeds.length === 0) return;
  PARTNERS = [...PARTNERS, ...seeds.map((s) => ({ ...s, sector }))];
  writeList(PARTNERS_STORAGE_KEY, PARTNERS);
  announce();
}

/** Back to the starting answers. Settings' «Start over» reaches this, and the demonstration comes
 *  back with it — which is what starting over means. */
export function resetPartners(): void {
  PARTNERS = [];
  HAND = [];
  writeList(PARTNERS_STORAGE_KEY, PARTNERS);
  writeList(PARTNER_RUNS_STORAGE_KEY, HAND);
  try {
    window.localStorage.removeItem(PARTNERS_SEEDED_KEY);
  } catch {
    /* nothing to clear */
  }
  announce();
}

/* ── THE READERS ──────────────────────────────────────────────────────────────────────────── */

/** Every partner this house has connected. */
export const usePartners = (): Partner[] =>
  React.useSyncExternalStore(subscribe, partnersSnapshot, partnersSnapshot);

/** Every run a hand asked for. */
export const useHandRuns = (): HandRun[] =>
  React.useSyncExternalStore(subscribe, handSnapshot, handSnapshot);

/* ── THE RUNS, DERIVED ────────────────────────────────────────────────────────────────────────
 * `HH:MM` and `YYYY-MM-DD` both sort as text, so an instant is a pair of them compared as a pair
 * and no Date is built to answer «has this gone yet».
 */

const instant = (day: string, at: string): string => `${day} ${at}`;

/** THE INSTANT JUST AFTER ONE. Every window here closes exclusively, which is what makes a cutoff
 *  belong to exactly one run — and it is wrong at exactly one place: the window that ends at the
 *  hour the house is standing in has to CONTAIN that hour, or the run a person asked for this very
 *  minute sits outside the count it was meant to empty. */
const justAfter = (at: string): string => `${at}￿`;

const dayBefore = (day: string): string => dayIdOf(shiftDay(dayFromId(day), -1));

/** THE DAY'S ARRIVALS, AS THIS PARTNER SEES THEM: one entry per order, the instant it reached the
 *  desk and how many of its lines this partner takes. Built once and then every window is a count
 *  over it, so a log of five days does not fold the book five times. */
type Arrival = { at: string; lines: number };

const arrivalsFor = (sales: Sale[], partner: Partner): Arrival[] => {
  const out: Arrival[] = [];
  for (const s of sales) {
    let n = 0;
    for (const l of s.lines) if (takes(partner, l.product)) n += 1;
    if (n > 0) out.push({ at: instant(s.day, s.at), lines: n });
  }
  return out;
};

/** THE WINDOW, WRITTEN ONCE. `open` is inclusive and `close` is exclusive, which is what makes a
 *  cutoff belong to exactly one run — and what makes the roll fall out rather than be ruled. */
const linesBetween = (arrivals: Arrival[], open: string, close: string): number =>
  arrivals.reduce((n, a) => (a.at >= open && a.at < close ? n + a.lines : n), 0);

/** The hand runs inside one window, so a line a person sent early is not counted again by the
 *  timer. A line goes out once. */
const handTakenIn = (runs: HandRun[], partner: Partner, open: string, close: string): number =>
  runs
    .filter((r) => r.partner === partner.id)
    .filter((r) => instant(r.day, r.at) >= open && instant(r.day, r.at) < close)
    .reduce((n, r) => n + r.lines, 0);

export type Forwarding = {
  /** the log, newest first: what has gone, by date, timer's and hand's alike */
  log: Run[];
  /** the run the timer is counting to */
  next: Run | null;
  /** the lines in hand that go on it — the roll, said as a number */
  waiting: number;
  /** what the last run carried */
  last: Run | null;
};

/**
 * ONE PARTNER'S WHOLE STORY, off the day's own orders.
 *
 * `days` is the river's own set of days, so the log covers exactly the days the app has orders
 * for and claims nothing about mornings it has never seen. A run that carried nothing prints no
 * row: «0 lines» is a line spent on an absence, which is the law every other count in this app
 * keeps.
 */
export function forwardingOf(a: {
  sales: Sale[];
  partner: Partner;
  runs: HandRun[];
  /** the days the river holds, in any order */
  days: string[];
  today: string;
  /** the hour the house is standing in */
  now: string;
}): Forwarding {
  const { sales, partner, runs, today, now } = a;
  const days = [...a.days].sort();
  const here = instant(today, now);
  const arrivals = arrivalsFor(sales, partner);

  const runOn = (day: string): Run => {
    const from = dayBefore(day);
    const open = instant(from, partner.cutoff);
    const close = instant(day, partner.cutoff);
    return {
      day,
      at: partner.cutoff,
      from,
      lines: Math.max(0, linesBetween(arrivals, open, close) - handTakenIn(runs, partner, open, close)),
      sent: close <= here,
      byHand: false,
    };
  };

  const timed = days.map(runOn);

  const byHand: Run[] = runs
    .filter((r) => r.partner === partner.id)
    .map((r) => ({ day: r.day, at: r.at, from: dayBefore(r.day), lines: r.lines, sent: true, byHand: true }));

  const log = [...timed.filter((r) => r.sent && r.lines > 0), ...byHand]
    .sort((x, y) => instant(y.day, y.at).localeCompare(instant(x.day, x.at)));

  const next = timed.find((r) => !r.sent) ?? null;

  /* WHAT IS ACTUALLY IN HAND. The next run's own count reaches to its close, and part of that
     window has yet to happen — an order standing for tomorrow morning is not a line waiting on the
     bench tonight. So the waiting count stops at the hour the house is standing in, which is the
     same discipline the print queue keeps when it says how much paper is still owed. */
  const waiting = (() => {
    if (!next) return 0;
    const open = instant(dayBefore(next.day), partner.cutoff);
    const close = justAfter(here);
    return Math.max(0, linesBetween(arrivals, open, close) - handTakenIn(runs, partner, open, close));
  })();

  return { log, next, waiting, last: log[0] ?? null };
}

/* ── THE WORDS ────────────────────────────────────────────────────────────────────────────────
 * The sentences live here beside the arithmetic that makes them true, the way `jobWords` lives
 * beside the print queue. Every one of them states what IS: a run with nothing on it says nothing
 * at all rather than saying it is empty.
 */

/** «Marisco · Cefalópodos» — the shelves this partner covers, in the separator the picker already
 *  reads its goods out with, because a fact is a list and «Marisco and Cefalópodos» is prose. */
export const categoryWords = (p: Partner): string => p.categories.map(nameOfNode).join(' · ');

/**
 * THE ARRANGEMENT, AS FACTS (THE-CONTENT-CANON §3, §4 · the 2026-08-28 sweep).
 *
 * ⚠ THE SENTENCE THAT USED TO LIVE HERE IS DEAD. It read «Orders for Marisco and Cefalópodos
 * arriving before 01:30 go to Mariscos Vidal as one list, every day. What comes in after 01:30
 * goes on the next day's list.» — twenty-nine words, printed WHOLE on every partner card, under a
 * section whose own lead already says «They cover part of your catalogue. Their day's orders go
 * out on one list, at your hour.» A string repeated on every card of a list is wallpaper, not a
 * helper (the sweep's own finding, applied to agent's routing rows and to ROLE_DOES), and the
 * canon's remedy for a slot with no job is that the SLOT dies rather than the prose getting
 * shorter inside it.
 *
 * WHAT SURVIVES IS THE FACTS, EACH SAID ONCE, EACH IN ITS OWN SEAT:
 *   · WHAT GOES — the shelves. Nothing else on the card names them; the paintings show the goods.
 *   · CLOSES — the hour a person SET. The timer line beside it is a reading of when the next one
 *     goes, and the log is what the past ones did; this is the arrangement itself.
 *   · SENDS — the cadence, carrying the accent, because the daily send is Rocoto's own act.
 *   · WHO IT GOES TO stays on the card's head, where §35.4 already puts company · person ·
 *     address on three lines. A «Goes to Mariscos Vidal» seat under a card titled «Mariscos
 *     Vidal» is the very repetition this sweep exists to remove.
 *
 * AND THE ROLL IS SHOWN RATHER THAN EXPLAINED: `openRunWords` already prints «Closes 01:30 · 368
 * lines rolled from today» on the open run's own row, so the rule arrives as a live number on the
 * surface that owns it. The empty state — the one place the feature meets somebody who has never
 * seen it — keeps its explaining sentence, said once, before anything is set up.
 */
export type PartnerFact = {
  label: string;
  value: string;
  /** the seat that names Rocoto's own act, and so carries the accent (§51 colour law) */
  act?: boolean;
};

export const forwardingFacts = (p: Partner): PartnerFact[] => [
  { label: 'What goes', value: categoryWords(p) },
  { label: 'Closes', value: p.cutoff },
  { label: 'Schedule', value: 'One list a day', act: true },
];

/** WHO READS IT AT THEIR END (§35.4's anatomy: company · the person or team · address). The
 *  address is a fact of its own and takes its own line wherever this is drawn — an email that
 *  wrapped mid-domain behind a stranded separator is the one line on a card a person copies. */
export const contactWords = (p: Partner): string =>
  p.contactKind === 'team' ? `The ${p.contact} team` : p.contact;

const plural = (n: number, word: string): string => (n === 1 ? word : `${word}s`);

/** What one log row says about itself. The date is already on the row's own leading column, so
 *  this line never says it twice. */
export const runWords = (run: Run): string =>
  run.byHand
    ? `Earlier local record ${run.at} · delivery awaiting verification · ${run.lines} ${plural(run.lines, 'line')}`
    : `Scheduled ${run.at} · delivery awaiting verification · ${run.lines} ${plural(run.lines, 'line')}`;

/** WHAT THE OPEN RUN'S ROW SAYS: the hour it closes, and the roll sitting on it — «368 lines
 *  rolled from today» is the founder's own sentence, said ONCE, on the row it belongs to. A run
 *  with nothing on it yet says its hour and stops there.
 *
 *  `from` is the day the window opened, said the way the river says days. */
export const openRunWords = (f: Forwarding, from: string): string =>
  f.next
    ? f.waiting > 0
      ? `Closes ${f.next.at} · ${f.waiting} ${plural(f.waiting, 'line')} rolled from ${from}`
      : `Closes ${f.next.at}`
    : '';

/** THE TIMER'S OWN LIFE, in one line (§35.7: no person presses it, so the surface shows the timer
 *  where a button would be). It says when the next one goes and what the last one carried.
 *
 *  `when` is the day said the way the river says it — «tomorrow», «Saturday 23.08» — because the
 *  nearness of a day is the river's word to give and not this file's. */
export function nextRunWords(f: Forwarding, when: string): string {
  if (!f.next) return f.last ? `Last scheduled run ${f.last.lines} ${plural(f.last.lines, 'line')}` : '';
  return f.last
    ? `Next scheduled run ${when} at ${f.next.at} · last scheduled run ${f.last.lines} ${plural(f.last.lines, 'line')}`
    : `Next scheduled run ${when} at ${f.next.at}`;
}

/* THE ROLL IS SAID ONCE, AND THE LOG SAYS IT. An earlier draft carried a sentence of its own —
 * «368 lines came in after the cutoff and go on the next list» — above a log row that already read
 * «Closes 01:30 · 368 lines waiting». On a phone the two sat four lines apart saying one number
 * twice, which is the same fault the print queue's row avoids by never repeating its page count.
 * The 2026-08-28 sweep finished the job: the rule's own sentence went with the rest of the card's
 * prose, so the roll now lives ENTIRELY in `openRunWords` — a real number, on the run it belongs
 * to — and the empty state is the one surface that still explains it in words. */
