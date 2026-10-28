import { soles } from './currency';
/* THE INSIGHTS — every number «Your data» says, computed (FEED-IA §60, §63 · THE-DATA-CANON §2).
 *
 * «Maybe this is a place where we give them some insights on it» — followed by twelve of them, by
 * name. And then the gap he named himself: «We haven't done any real computation in design on how
 * we're going to analyze that data.» This file IS that computation.
 *
 * ═══ THE HOUSE LAW OF THE FOLD (THE-DATA-CANON §0) ══════════════════════════════════════════
 * Every function here is a PURE READ. No clock, no `Math.random`, no state of its own: hand it the
 * same `(cast, edits, grants)` and it returns the same numbers, byte for byte. That is not a
 * performance nicety — it is what makes the seat unable to disagree with the river, with Customers
 * or with Stock, because all four are folds of one ledger. A figure that cannot be produced this
 * way stays OUT of the seat.
 *
 * ═══ THE TWO WORLDS, AND THE RECONCILIATION LAW (THE-DATA-CANON §0) ═════════════════════════
 * The demo has two disconnected pasts and they obey different physics:
 *
 *   WORLD A — the sale ledger (`sale.ts` + `day.ts`). Five real calendar days, ~614 real
 *             documents, real figures, real hours, real disputes. A customer's product MIX churns
 *             between days by construction (each day draws from its own seed).
 *   WORLD B — the knows history (`knows.ts`). Five past albaranes per customer on a STABLE shelf:
 *             the same products every visit, deterministic quantities, asked/given pairs.
 *
 * SO: **volume, money and hour questions read World A. Basket and habit questions read World B.**
 * And the law that follows from it, which this file obeys absolutely:
 *
 *   ⛔ DAY-OVER-DAY BASKET COMPARISON INSIDE WORLD A IS BANNED. Diffing two World A days reports
 *      GENERATOR NOISE as customer behaviour. «Their basket changed» is computed from World B's
 *      k=0 against k=1 and from nowhere else. It is the one temptation in this file, and the
 *      reason a whole law exists to forbid it.
 *
 * ═══ EVERY READING CARRIES ITS METHOD (FEED-IA §63) ═════════════════════════════════════════
 * «The thing with the design should be married to your bunch of information coming out. It has a
 * bunch of explanations, and then you go and read the way they do it.» So every fold returns its
 * `method` — one sentence naming the WINDOW, the WORLD and the COST BASIS. The method line is
 * where honesty lives: a stranger can check the claim against it. A reading whose method cannot be
 * written is a reading that does not ship.
 *
 * ═══ A GAP SHIPS AS A GAP ═══════════════════════════════════════════════════════════════════
 * Where the demo world lacks the data, the fold returns EMPTY and says so — it never interpolates,
 * never rounds an absence up into a claim. `seasons()` waits for a months-spanning ledger.
 * `profitables()` counts only the goods that carry a cost row and its method line says which.
 * Faking over a gap is the one sin this whole layer exists to prevent.
 */
import { CASTS, type Cast, type Customer, type Product } from '../../scenarios/data/cast';
import {
  amount, basketOf, count, dayPatternOf, familiarReach, historyOf, houseStyle, importedMonths,
  importedMonthKeys, importedMonthsFor, monthOf, monthKeyOf, monthLabelOf, treeOf, HISTORY_DEPTH,
  IMPORTED_MINT, IMPORT_MONTHS, MENUS_SEEDED,
  type ImportEvent, type Knows, type Observation, type PastAlbaran,
} from './knows';
/* TYPE ONLY — the register's own names live on the contract, and the analysis layer names one of
   them rather than inventing a second vocabulary for the same three words. */
import type { ToneProfile } from './grants';
import { feedDayOf, groupByDay, todayId, type Sale } from './sale';

/* ── WHAT EVERY READING CARRIES ───────────────────────────────────────────────────────────── */

/** THE METHOD LINE (§63). One sentence: the window, the world, and — where money is involved —
 *  the cost basis. It ships UNDER the figure, at ParagraphXSmall, secondary. */
export type Method = string;

/** A figure with its own shape under it. `spark` is the series a 32px sparkline draws. */
export type Level = {
  value: number;
  /** the series behind the figure, oldest first */
  spark: number[];
  /** the direction against the previous comparable period, or nothing where there is none */
  delta?: { from: number; to: number };
  method: Method;
};

/** A RANKED ROW — a customer or a product, its figure, and its share of the top row (the 2px
 *  magnitude bar reads `share`). */
export type Ranked = {
  id: string;
  name: string;
  figure: number;
  /** 0…1 against the leader, for the hairline magnitude bar */
  share: number;
  /** the second fact the row carries, in words — units sold, albaranes counted */
  detail?: string;
};

/** WHY A CUSTOMER WANTS A PERSON TODAY. The four readings of §2.8/§2.10/§2.11/§2.12, in the
 *  priority order the projection rule fixes: dropped > changed > different > incidencia. */
export type ReadingKind = 'dropped' | 'changed' | 'different' | 'incidencia';

export type AttentionReading = {
  customer: string;
  name: string;
  kind: ReadingKind;
  /** the reading, as the sentence that rides the customer's row */
  line: string;
  /** what it is read off — the numbers, in words */
  evidence: string;
  /** ── WHAT THE ACCOUNT IS WORTH, so a list of readings can be RANKED (the walk, P1-6) ────────
   *  «Biggest opportunity accounts» is Peter's own phrase for this list, and it came back
   *  alphabetical: five accounts at 83–322 € an albarán stood where the house's 10.000 € accounts
   *  belonged. A row reading is about ONE customer and says nothing about size, so the size rides
   *  the reading — their own year, counted the way every other year figure here is counted.
   *  It is filled by `attentionReadings`, which is the fold that produces a LIST; a single row's
   *  reading needs no rank and carries none. */
  figure?: number;
};

/** PRIORITY, STATED ONCE (THE-DATA-CANON §2.0.e). «Cap: ONE reading per row» — so when two
 *  readings compete for a row, this is what decides, and it decides everywhere identically. */
export const READING_PRIORITY: ReadingKind[] = ['dropped', 'changed', 'different', 'incidencia'];

const rankOf = (k: ReadingKind): number => READING_PRIORITY.indexOf(k);

/* ── SMALL SHARED MATHS ───────────────────────────────────────────────────────────────────── */

const round = (n: number): number => Math.round(n * 100) / 100;

const sum = (ns: number[]): number => ns.reduce((a, b) => a + b, 0);

const mean = (ns: number[]): number => (ns.length ? sum(ns) / ns.length : 0);

/**
 * THE MONEY WORDS THIS LAYER SPEAKS. The unit rides the number — never a line of its own.
 *
 * ⚠ AND THE THOUSANDS ARE GROUPED FROM FOUR DIGITS (AUDIT-2 C35). Spanish CLDR groups only from
 * five digits up, so a plain `toLocaleString` printed «10.222 €» beside «7065 €» in one ranked
 * list: the top row read as thousands and the four under it read as reference numbers. `count`
 * is the house's own grouped figure and it is the only one this layer says money with, so a
 * column of amounts is one column.
 */
export const wholeSoles = (n: number): string => soles(n, 0);

/* ═══ THE ANALYSIS WINDOW ENDS AT TODAY (FEED-IA §63 · AUDIT-2 C15) ═══════════════════════════
 * The river's ledger runs `DAY_OFFSETS = [3, 2, 1, 0, -1]` — three days of HORIZON above today,
 * which is exactly right for a river a person scrolls up into and exactly wrong for an analysis.
 * The seat plotted five days of which three had yet to happen, captioned them «What each day came
 * to» in the past tense, and the falling right-hand slope read as a collapse when it was an
 * unfilled order book.
 *
 * SO THE WINDOW IS CUT ONCE, HERE, and every fold on the seat reads the cut ledger — the house
 * law of the fold applied to time. A day that has not happened is not a reading; it is a promise,
 * and promises live in the river.
 */
export function upToToday(cast: Cast, sales: Sale[]): Sale[] {
  const today = todayId(cast);
  /* the day id is ISO, so the string order IS the calendar order */
  return sales.filter((s) => s.day <= today);
}

/** «22.08» — the trade's own way of writing a date, and the only one this layer writes. The ISO
 *  id is a key; `dd.mm` is the app's word for a day, on this seat as everywhere else. */
const shortOf = (cast: Cast, day: string): string => feedDayOf(cast, day).short;

/** «21.08 – 22.08» — the window every arithmetic region is counted over, said once. */
const spanOf = (cast: Cast, days: Array<{ day: string }>): string => {
  if (!days.length) return '';
  const first = shortOf(cast, days[0].day);
  const last = shortOf(cast, days[days.length - 1].day);
  return first === last ? first : `${first} – ${last}`;
};

/* ═══ REGION 2 · TUS NÚMEROS — arithmetic, counted off the record (World A) ═══════════════════
 * Zero saffron here. A sum is the house's own number; the accent is for readings Rocoto MADE.
 */

/** THE DAY TOTALS, oldest first — the series everything in this region is a reading of, and it
 *  ENDS AT TODAY (C15). The cut is made on the day's own offset rather than on the sales handed
 *  in, so a caller that forgets `upToToday` still cannot plot a day that has not happened. */
export function dayTotals(cast: Cast, sales: Sale[]): Array<{ day: string; total: number; orders: number }> {
  return groupByDay(cast, sales)
    .filter((g) => g.day.offset <= 0)
    .map((g) => ({ day: g.day.id, total: round(g.total), orders: g.sales.length }))
    .reverse();
}

/**
 * §2.1 · FACTURACIÓN TÍPICA — what a day of this house comes to.
 *
 * ⚠ SAID PER WEEKDAY, NEVER AVERAGED ACROSS THE WEEK. A Sunday in this trade carries six per cent
 * of a Friday's load, so a mean taken across the window is a figure NOBODY'S day looks like. The
 * reading is today's own weekday, and the delta is against the last comparable day in the window.
 * The window itself now ends at today (C15), so it is the days that have closed plus this one.
 */
export function typicalTake(cast: Cast, all: Sale[]): Level {
  const sales = upToToday(cast, all);
  const days = dayTotals(cast, sales);
  const today = todayId(cast);
  const at = days.findIndex((d) => d.day === today);
  const here = at >= 0 ? days[at] : days[days.length - 1];
  const before = at > 0 ? days[at - 1] : undefined;
  return {
    value: here?.total ?? 0,
    spark: days.map((d) => d.total),
    delta: before ? { from: before.total, to: here.total } : undefined,
    /* THE WINDOW IS NAMED IN THE TRADE'S OWN DATES (C15). «The last 5 days» was a phrase for a
       window that held three days of horizon; a span a person can hold a calendar to says the
       same thing and can be checked. And the second sentence states what the figure IS — the
       fact that a Friday is read on Friday's own scale — rather than what it is not (§7). */
    method: `${count(sales.length)} delivery notes · ${spanOf(cast, days)}. Today’s figure uses the same weekday scale.`,
  };
}

/** §2.2 · PEDIDOS AL DÍA — the same window, counted as documents. */
export function ordersPerDay(cast: Cast, all: Sale[]): Level {
  const sales = upToToday(cast, all);
  const days = dayTotals(cast, sales);
  const today = todayId(cast);
  const at = days.findIndex((d) => d.day === today);
  const here = at >= 0 ? days[at] : days[days.length - 1];
  const before = at > 0 ? days[at - 1] : undefined;
  return {
    value: here?.orders ?? 0,
    spark: days.map((d) => d.orders),
    delta: before ? { from: before.orders, to: here.orders } : undefined,
    method: `The delivery notes of ${spanOf(cast, days)}, counted one day at a time.`,
  };
}

/** §2.3 · VALOR MEDIO DEL PEDIDO — the mean figure over the window. */
export function averageOrder(cast: Cast, all: Sale[]): Level {
  const sales = upToToday(cast, all);
  const days = dayTotals(cast, sales);
  const today = todayId(cast);
  const own = sales.filter((s) => s.day === today);
  const before = sales.filter((s) => s.day === days[days.findIndex((d) => d.day === today) - 1]?.day);
  return {
    value: round(mean(own.map((s) => s.figure))),
    spark: days.map((d) => (d.orders ? round(d.total / d.orders) : 0)),
    delta: before.length ? { from: round(mean(before.map((s) => s.figure))), to: round(mean(own.map((s) => s.figure))) } : undefined,
    method: `Today’s mean: ${count(own.length)} delivery notes over what they came to.`,
  };
}

/**
 * §2.5 · TUS SEMANAS — the week's shape, this period against the prior one.
 *
 * Two series, told apart by STROKE (solid = this period, dashed = prior) because the chart kit has
 * no palette by design. The prior series is the same window shifted — where the ledger is only
 * five days deep it comes back empty, and the chart draws one line and says so.
 */
export function weekShape(cast: Cast, all: Sale[]): { now: number[]; prior: number[]; labels: string[]; method: Method } {
  const days = dayTotals(cast, upToToday(cast, all));
  return {
    now: days.map((d) => d.total),
    /* THE PRIOR WEEK DOES NOT EXIST IN A FIVE-DAY LEDGER, and an invented one would be the exact
       fake this file forbids. It stays empty until a months-spanning import fills it. */
    prior: [],
    labels: days.map((d) => d.day),
    /* PRESENT PERFECT, BECAUSE TODAY IS STILL RUNNING (C15). The window ends at today and today
       is open, so «came to» would close a day that has hours left in it. And the dates are the
       trade's `dd.mm`, never the ISO key the series is indexed by. */
    method: `What each day has come to, ${spanOf(cast, days)}.`,
  };
}

/**
 * §2.7 · TUS TEMPORADAS — the season breakdown.
 *
 * ⚠ IT WAITS UNTIL A YEAR ARRIVES, AND THE WAIT IS THE HONEST ANSWER. World A holds five days and
 * World B twelve, all of them in one month: there is no season in an un-imported ledger to read.
 * The year-scale SENTENCES in `buildKnows` («since May», «14 Fridays») are seeded evidence TEXT —
 * a figure typed off a sentence is a fake. So before an import this returns empty and the region
 * shows the door with an affirmative line instead of a chart of nothing.
 *
 * AFTER AN IMPORT IT READS THE MINTED LEDGER (THE-DATA-CANON §4 / §6.4): eleven months of events
 * folded out of each account's own rhythm and its own usual albarán, plus the live month off the
 * day ledger itself. Twelve bars, and every one of them counted rather than scaled.
 */
export function seasons(
  cast: Cast,
  sales: Sale[],
  imported?: ImportEvent,
): { months: Array<{ label: string; value: number }>; method: Method } {
  /* THE LIVE MONTH IS THE LAST BAR, folded off the day ledger the whole seat reads — and it ends
     at today (C15), so the month a person is standing in is what has happened in it. */
  const live = new Map<string, number>();
  for (const s of upToToday(cast, sales)) {
    const m = monthKeyOf(s.day);
    if (!m) continue;
    live.set(m, (live.get(m) ?? 0) + s.figure);
  }
  const liveMonths = [...live.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, value]) => ({ key, label: monthLabelOf(key), value: round(value) }));

  if (!imported) {
    /* ONE month is not a season. Two are the smallest thing worth a twelve-bar chart. */
    const months = liveMonths.length >= 2
      ? liveMonths.map(({ label, value }) => ({ label, value }))
      : [];
    return {
      months,
      /* A GAP GETS ONE FORM, NOT BOTH (THE-DATA-CANON §2.0f: an insight «states its basis in the
         method line OR waits with an affirmative sentence and the import door»). This line used
         to read «The months your albaranes cover. A year of history reads the whole seasons.»
         under a waiting region whose own sentence already says «A year of albaranes draws your
         seasons, month by month.» — the same fact, twice, four pixels apart, in two wordings.
         A method line explains a READING; where there is no reading to explain, the sentence and
         the door are the whole surface and the footnote dies with the chart it would have
         qualified. When months do draw, the span comes back and states what they are counted on. */
      method: months.length > 0 ? `The months your delivery notes cover.` : '',
    };
  }

  /* ── THE CURVE IS MONTHS THAT CLOSED (the acceptance walk, P1-14) ────────────────────────────
   * The running month was drawn on the same series as the eleven behind it, so a house's year fell
   * off a cliff at the right-hand edge — from ~1.050 to ~350 — because the last bar held five days
   * of trade and the eleven before it held whole months. The method line said so honestly and the
   * PICTURE still said the business had collapsed, on the calmest surface in the product. A chart
   * whose caption has to defend it against its own shape is a chart drawing two different
   * quantities on one series.
   *
   * So a bar is a month THAT CLOSED. The running month is the whole of «Tus números» and the whole
   * of the day ledger a few hundred pixels away — it is not missing from the app, it is off a
   * series it was never comparable on. The method says which months the curve holds.
   */
  const monthNow = monthKeyOf(todayId(cast));
  const closed = liveMonths.filter((m) => m.key !== monthNow).map(({ label, value }) => ({ label, value }));
  const minted = importedMonths(cast).map((m) => ({ label: m.label, value: m.figure }));
  const months = [...minted, ...closed];
  return {
    months,
    method: `${IMPORTED_MINT} Every bar is a month that closed — ${months.length ? `${months[0].label}–${months[months.length - 1].label}` : 'the year you sent'}.`,
  };
}

/**
 * §2.3's PROJECTION — ONE ACCOUNT'S MONTHS, for the sheet's 32px sparkline.
 *
 * «The customer SHEET's "The numbers" embed gains the ink delta chip vs their own typical
 * (`basketOf().typical`) and a 32px sparkline of their months (`monthOf`).» Their number on their
 * sheet; the house's number in the seat.
 *
 * ⚠ IT IS EMPTY UNTIL A YEAR ARRIVES, for the same reason `seasons()` is: one month of history
 * draws one point, and a sparkline of one point is a dot pretending to be a trend.
 */
export function monthsFor(
  cast: Cast,
  customer: Customer,
  live: Array<{ day: string; figure: number }>,
  imported?: ImportEvent,
): Array<{ label: string; value: number }> {
  if (!imported) return [];
  const minted = importedMonthsFor(cast, customer).map((m) => ({ label: m.label, value: m.figure }));
  const here = monthOf(cast, customer, monthKeyOf(todayId(cast)), live);
  return [...minted, { label: monthLabelOf(here.month), value: round(here.figure) }];
}

/* ═══ REGION 3 · TUS CLIENTES — analysis, Rocoto's own readings (NoticedMark) ═════════════════ */

/* ═══ THE TWO REGISTERS OF A RANKING (FEED-IA §106.2 · THE-JOURNEY-CANON §6.2) ════════════════
 *
 * «The Wrapped is the MOMENT, the seat is the LEDGER — one number set, two registers.» The two
 * registers differ in exactly one thing, and the acceptance walk found the product had only one:
 *
 *   THE SEAT reads THE MONTH (customers) and THE DAYS THE RIVER HOLDS (goods). It is a working
 *   surface about the morning, and its figures move as the morning does.
 *   THE REVEAL reads THE YEAR — the twelve months of the hydration, which is the very thing its
 *   own first screen counts («the 77.363 albaranes you sent, 12 months of them») and the very
 *   thing its curve draws.
 *
 * ⚠ THE DEFECT THIS CLOSES. The Wrapped's screens 3 and 4 ranked the LIVE window under a year's
 * chart: a house's best customer was introduced as «10.222 € · 6 albaranes» against 77.363 read,
 * and «what you sell most» was counted over two days. The picture said a year and the rows said
 * Tuesday. The window is therefore an argument on the fold, and the REVEAL'S register is the
 * default — because the reveal's own caller cannot say which window it wants without a year of
 * arithmetic leaking into a surface. The seat asks for its own window by name.
 *
 * ⚠ ONE CALLER OWES A WORD (a seam, for the package that holds `activation-web.tsx`). The going-
 * live card ranks the book with this fold to suggest a first cohort, and its row prints the figure
 * as «… this month». With the reveal's register as the default it is now reading the YEAR, so that
 * row's own sentence should either say the year or the call should name its window:
 * `bestCustomers(cast, sales, COHORT_CAP, 'month')`. One argument, one file, and the fold is ready
 * for either.
 *
 * ⚠ AND THE YEAR IS MINTED THE WAY THE MONTHS ARE, NEVER SCALED. `importedMonthsFor` is the
 * hydration's own ledger — every account's delivery weekdays counted on the calendar, each albarán
 * at what one of theirs usually comes to — and the year folds read exactly it, plus the live month
 * off the day ledger, which is the same composition `monthsFor` and `seasons` already use. Nothing
 * here interpolates and nothing is a ratio of a sample.
 */
export type RankWindow = 'month' | 'year';

/** THE WINDOW THE GOODS RANKING READS — the river's own days, or the imported year. */
export type SellerWindow = 'live' | 'year';

/** «Sep–Aug» — the year's own span, in the labels the seasons chart already draws. */
const yearSpan = (cast: Cast): string => {
  const keys = importedMonthKeys(cast);
  const first = keys[0] ? monthLabelOf(keys[0].key) : '';
  const last = monthLabelOf(monthKeyOf(todayId(cast)));
  return first ? `${first}–${last}` : last;
};

/** ONE ACCOUNT'S YEAR — the eleven minted months plus the live one, counted rather than scaled. */
function yearOf(
  cast: Cast,
  customer: Customer,
  live: Sale[],
): { figure: number; albaranes: number } {
  let figure = 0;
  let albaranes = 0;
  for (const m of importedMonthsFor(cast, customer)) {
    figure += m.figure;
    albaranes += m.albaranes;
  }
  const here = monthOf(cast, customer, monthKeyOf(todayId(cast)), live);
  return { figure: round(figure + here.figure), albaranes: albaranes + here.albaranes };
}

/**
 * §2.4 · TUS MEJORES CLIENTES — ranked by what they took, over the window the caller names.
 *
 * ONE NAMED WINDOW, never a spliced range, in both registers: `monthOf` is the reading the
 * customers book already draws on every row and it blends the two worlds by construction; the year
 * is the hydration's own months plus that same live month. Either way the window is said out loud
 * in the method line, which is where a stranger checks the claim.
 */
export function bestCustomers(
  cast: Cast,
  all: Sale[],
  top = 5,
  over: RankWindow = 'year',
): { rows: Ranked[]; method: Method } {
  const sales = upToToday(cast, all);
  const month = monthKeyOf(todayId(cast));
  const live = new Map<string, Sale[]>();
  for (const s of sales) {
    const held = live.get(s.customer.id);
    if (held) held.push(s);
    else live.set(s.customer.id, [s]);
  }
  const scored = cast.customers
    .map((c) => {
      const theirs = live.get(c.id) ?? [];
      const m = over === 'year' ? yearOf(cast, c, theirs) : monthOf(cast, c, month, theirs);
      return { id: c.id, name: c.name, figure: round(m.figure), albaranes: m.albaranes };
    })
    .filter((r) => r.figure > 0)
    .sort((a, b) => b.figure - a.figure)
    .slice(0, top);
  const lead = scored[0]?.figure ?? 1;
  return {
    rows: scored.map((r) => ({
      id: r.id,
      name: r.name,
      figure: r.figure,
      share: lead > 0 ? r.figure / lead : 0,
      detail: `${count(r.albaranes)} delivery notes`,
    })),
    /* ONE NAMED WINDOW, said as a sentence rather than as a design note. «in ONE named window»
       shipped the emphasis a spec uses to argue with itself (§5 mechanics, AUDIT-2 C31). */
    method: over === 'year'
      ? `What each account has taken over the year you sent, ${yearSpan(cast)} — their own delivery weekdays counted on the calendar, each delivery note at what one of theirs comes to, and this month off your own ledger.`
      : `What each account has taken this month — your history and the delivery notes since, in one window.`,
  };
}

/**
 * §2.9 · LOS MÁS RENTABLES — ranked by margin, on the goods that carry a cost.
 *
 * ⚠ THE COST BASIS IS NAMED IN THE METHOD LINE, ALWAYS. `cast.batches` carries a per-unit cost for
 * some of the catalogue and not all of it; a margin ranking that quietly counted the priced goods
 * and ignored the rest would be a number nobody can check. So the fold counts ONLY lines whose
 * product has a cost row, and the method line says which goods those are — by name.
 */
export function profitables(cast: Cast, all: Sale[], top = 5): { rows: Ranked[]; method: Method } {
  const sales = upToToday(cast, all);
  /** the per-unit cost of each product the house has a lote for */
  const cost = new Map<string, number>();
  for (const b of cast.batches) {
    if (!cost.has(b.product)) cost.set(b.product, b.cost);
  }
  const priced = cast.products.filter((p) => cost.has(p.id));

  const by = new Map<string, { name: string; margin: number }>();
  for (const s of sales) {
    let margin = 0;
    for (const l of s.lines) {
      const c = cost.get(l.product.id);
      if (c === undefined) continue;
      margin += l.given * (l.price - c);
    }
    if (margin <= 0) continue;
    const held = by.get(s.customer.id);
    if (held) held.margin += margin;
    else by.set(s.customer.id, { name: s.customer.name, margin });
  }
  const scored = [...by.entries()]
    .map(([id, v]) => ({ id, name: v.name, figure: round(v.margin) }))
    .sort((a, b) => b.figure - a.figure)
    .slice(0, top);
  const lead = scored[0]?.figure ?? 1;
  return {
    rows: scored.map((r) => ({ id: r.id, name: r.name, figure: r.figure, share: lead > 0 ? r.figure / lead : 0 })),
    method: priced.length === cast.products.length
      ? `What is left after the cost on your lotes, over the delivery notes of ${spanOf(cast, dayTotals(cast, sales))}.`
      : `Over ${priced.map((p) => p.name.toLowerCase()).join(', ')} — the goods that carry a cost on your lotes.`,
  };
}

/**
 * §2.6 · LOS QUE MÁS VENDES — the catalogue, ranked by what left the house, over the window the
 * caller names (the two registers above).
 *
 * THE LIVE WINDOW counts the river's own lines: real documents, real prices, real quantities.
 * THE YEAR reads each account's own SHELF across the albaranes their weekdays carried — World B's
 * basket, which is the stable thing a year of an account's paperwork is, spread over the same
 * minted albarán count the months are minted from. So a year's goods ranking is the year's
 * customers ranking, folded down the product column instead of across it.
 */
export function bestSellers(
  cast: Cast,
  all: Sale[],
  top = 5,
  over: SellerWindow = 'year',
): { rows: Ranked[]; method: Method } {
  const sales = upToToday(cast, all);
  const by = new Map<string, { product: Product; units: number; figure: number }>();

  if (over === 'year') {
    const month = monthKeyOf(todayId(cast));
    const live = new Map<string, Sale[]>();
    for (const s of sales) {
      const held = live.get(s.customer.id);
      if (held) held.push(s);
      else live.set(s.customer.id, [s]);
    }
    for (const c of cast.customers) {
      const theirs = live.get(c.id) ?? [];
      const albaranes = yearOf(cast, c, theirs).albaranes;
      if (albaranes <= 0) continue;
      const basket = basketOf(cast, c);
      for (const l of basket.lines) {
        /* THE SHELF IS COUNTED OVER THE ACCOUNT'S OWN LAST ALBARANES, so a line's share of ONE of
           their albaranes is what it carries divided by how many there were — and the year is that
           share on every albarán the calendar says they took. */
        const held = by.get(l.product.id) ?? { product: l.product, units: 0, figure: 0 };
        held.units += (l.qty / HISTORY_DEPTH) * albaranes;
        held.figure += (l.figure / HISTORY_DEPTH) * albaranes;
        by.set(l.product.id, held);
      }
    }
  } else {
    for (const s of sales) {
      for (const l of s.lines) {
        const held = by.get(l.product.id);
        if (held) {
          held.units += l.given;
          held.figure += l.given * l.price;
        } else {
          by.set(l.product.id, { product: l.product, units: l.given, figure: l.given * l.price });
        }
      }
    }
  }

  const scored = [...by.values()].sort((a, b) => b.figure - a.figure).slice(0, top);
  const lead = scored[0]?.figure ?? 1;
  return {
    rows: scored.map((r) => ({
      id: r.product.id,
      name: r.product.name,
      figure: round(r.figure),
      share: lead > 0 ? r.figure / lead : 0,
      detail: `${count(Math.round(r.units))} ${r.product.unit}`,
    })),
    method: over === 'year'
      ? `What left the house over the year you sent, ${yearSpan(cast)}, by goods — each account's own shelf across the delivery notes their weekdays carried.`
      : `What left the house ${spanOf(cast, dayTotals(cast, sales))}, by goods — quantity and what it came to.`,
  };
}

/* ═══ WHAT THIS ACCOUNT KEEPS TAKING — World B (FEED-IA §83.2) ════════════════════════════════
 * «A little dropdown showing the customer's frequent purchases in most popular order.»
 *
 * ═══ WHY THIS IS A WORLD B READING, AND NOT A WORLD A ONE ═══════════════════════════════════
 * The house law at the head of this file: volume, money and hour questions read the sale ledger;
 * BASKET AND HABIT QUESTIONS READ WORLD B. «What do they usually take» is the habit question in
 * its plainest form, and World A cannot answer it — each of its days draws its own product mix
 * from its own seed, so counting a customer's goods across those days ranks the GENERATOR. World
 * B's shelf is a pure function of the customer, so a product carried by four of their last five
 * albaranes really was carried by four of them.
 *
 * ═══ MOST POPULAR MEANS COUNTED, NOT SPENT ═════════════════════════════════════════════════
 * `bestSellers` ranks by money, because the house's own top line is money. This ranks by HOW MANY
 * OF THEIR ALBARANES CARRIED IT, because the question a person is asking with the heart open is
 * «what does this account always take» — and the account that takes one crate of gamba a fortnight
 * and merluza every single visit is a merluza account, whatever the till says. Money breaks the
 * ties, so two goods on four visits each come back in the order that matters to the house.
 *
 * ═══ THE PHRASE IS THE COMPOSER'S OWN ══════════════════════════════════════════════════════
 * A row hands back `phrase` — the words that go INTO the chip field, exactly as a person would
 * write them — because the offer is an entry shortcut and not a picker of objects. It is the
 * house's own name for the goods, untouched (§41.5, §65.3: their names stay theirs), so the organ
 * parses it the way it parses typing and nothing enters the line down a second road.
 */

/** ONE OFFER: the words to write, what they are worth on this account, and its own little face. */
export type Frequent = {
  /** `Product.id` — the row's key, and what a consumer checks against the line it built */
  id: string;
  /** THE WORDS THE COMPOSER WOULD WRITE. The house's own name for the goods, verbatim. */
  phrase: string;
  /** how many of the albaranes in the window carried it */
  count: number;
  /** the window itself, so a row can say «4 of 5» without a second call */
  of: number;
  /** the name the painted library resolves a face from — the same string, kept separate because
   *  the phrase is for the PARSER and this is for the picture */
  face: string;
};

/**
 * THE FAVOURITES OF ONE ACCOUNT, most popular first (§83.2).
 *
 * A pure read, like everything else here: same customer, same rows, byte for byte. An account with
 * no history returns an EMPTY list and says so through its emptiness — the heart is drawn only
 * where there is something behind it, so a gap ships as a gap rather than as an empty menu.
 */
export function frequentOf(cast: Cast, customer: Customer, top = 6): { rows: Frequent[]; method: Method } {
  const past = historyOf(cast, customer);
  const basket = basketOf(cast, customer);
  const rows = basket.lines
    .slice()
    /* COUNT FIRST, MONEY SECOND. `basketOf` hands the lines back money-first, which is the house's
       own order and the wrong one for this question — so they are re-ranked here rather than
       `basketOf` being bent, because three other readings depend on its order. */
    .sort((a, b) => (b.albaranes - a.albaranes) || (b.figure - a.figure))
    .slice(0, top)
    .map((l) => ({
      id: l.product.id,
      phrase: l.product.name,
      count: l.albaranes,
      of: past.length,
      face: l.product.name,
    }));
  return {
    rows,
    method: `Last ${count(past.length)} delivery notes · how many carried each item.`,
  };
}

/* ═══ THE HOUR THIS ACCOUNT USUALLY TAKES DELIVERY (FEED-IA §86.4b) ═══════════════════════════
 * «It should suggest the typical delivery time of the customer btw» — said in the same breath as
 * «right now the new albarán ALREADY tells me a delivery time before I even entered it». The two
 * halves are one law: the hour may be OFFERED and may not be ASSERTED.
 *
 * IT IS THE ACCOUNT'S OWN STANDING WINDOW, and nothing is averaged into existence. Most houses
 * deliver on the morning of and most accounts asked for nothing (cast.ts's own note on `slot`), so
 * this returns NOTHING for most of the book — and that is the reading, not a gap in it. A house
 * that folded five arrival hours into a mean would be inventing an hour on the very control §86.4
 * exists to stop inventing on.
 */
export function usualHourOf(cast: Cast, customer: Customer): { hour: string | null; method: Method } {
  /* the cast is taken so this fold reads like every other one here and so a house-level default
     has somewhere to land the day one exists; the hour itself is the account's own */
  void cast;
  return {
    hour: customer.slot ?? null,
    method: customer.slot
      ? `The delivery window standing on ${customer.name}'s account.`
      : `${customer.name} keeps to the house default: the morning of.`,
  };
}

/* ═══ THE BASKET DIFF — World B ONLY (§2.8) ═══════════════════════════════════════════════════ */

/** what changed between a customer's last two albaranes: goods gone, goods new, quantities moved */
export type BasketDiff = {
  gone: string[];
  arrived: string[];
  moved: Array<{ product: string; from: number; to: number; unit: string }>;
};

/**
 * THE ONE COMPARISON THIS LAYER IS ALLOWED TO MAKE.
 *
 * `historyOf` k=0 against k=1 — the customer's last albarán against the one before it, on World B's
 * STABLE shelf. Because the shelf is a pure function of the customer, a product that appears or
 * disappears between two visits is a REAL change and not a reseed, and a quantity that moves is a
 * real move. That is the whole reason the diff reads World B and the ban on World A exists.
 */
export function basketDiff(cast: Cast, customer: Customer): BasketDiff | null {
  const past: PastAlbaran[] = historyOf(cast, customer);
  if (past.length < 2) return null;
  const [now, before] = past;
  const nowBy = new Map(now.lines.map((l) => [l.product.id, l]));
  const beforeBy = new Map(before.lines.map((l) => [l.product.id, l]));

  const gone = before.lines.filter((l) => !nowBy.has(l.product.id)).map((l) => l.product.name);
  const arrived = now.lines.filter((l) => !beforeBy.has(l.product.id)).map((l) => l.product.name);
  const moved: BasketDiff['moved'] = [];
  for (const l of now.lines) {
    const was = beforeBy.get(l.product.id);
    /* a hair of scale drift is not a change of mind — the threshold keeps the reading worth a
       glance at three hundred orders a day (the filler law) */
    if (!was || Math.abs(l.given - was.given) < Math.max(2, was.given * MOVED)) continue;
    moved.push({ product: l.product.name, from: was.given, to: l.given, unit: l.unit });
  }
  if (!gone.length && !arrived.length && !moved.length) return null;
  return { gone, arrived, moved };
}

/* ═══ PARA ATENDER — the readings that want a person today (§2.8, .10, .11, .12) ══════════════ */

/** how far under their own rhythm an account has to fall before it is worth saying */
const DROP = 0.6;

/**
 * IS IT A SLIP, OR IS IT THE GENERATOR TALKING?
 *
 * A threshold alone answered «66 of 296 accounts are slipping», which is not a reading — it is
 * oscillation crossing a line. A real slip is MONOTONE: each albarán at or under the one before
 * it, over the recent stretch. Noise almost never is, and a house that is genuinely drifting away
 * almost always is. So the detector asks for the SHAPE as well as the size, and the filler law
 * (§2.0.g — «worth a glance at 300 orders a day») is what it is defending.
 */
const slipping = (series: number[]): boolean => {
  const tail = series.slice(-3);
  return tail.length === 3 && tail[0] >= tail[1] && tail[1] >= tail[2];
};

/** how far a quantity has to move before it is a change of mind rather than a scale's opinion */
const MOVED = 0.4;

/**
 * §2.11 · LOS QUE PIDEN MENOS — accounts whose order value has fallen off its own baseline.
 *
 * THE SERIES IS THEIR OWN AND THE THRESHOLD IS STATED. Five World B figures make the rhythm; the
 * last one against the mean of the ones before it makes the reading. It fires only where the fall
 * is real and the account has a rhythm to fall off — an account with two albaranes has no baseline
 * and gets no reading, because a claim off two points is a guess with a number on it.
 */
function droppedOf(cast: Cast, customer: Customer): AttentionReading | null {
  const past = historyOf(cast, customer);
  if (past.length < 4) return null;
  const figures = past.map((a) => a.figure).reverse();
  const last = figures[figures.length - 1];
  const before = figures.slice(0, -1);
  const rhythm = mean(before);
  if (rhythm <= 0 || last >= rhythm * DROP) return null;
  if (!slipping(figures)) return null;
  return {
    customer: customer.id,
    name: customer.name,
    kind: 'dropped',
    line: 'Ordering well under their rhythm',
    evidence: `They ran at ${wholeSoles(rhythm)} a delivery note; the last one, ${wholeSoles(last)}.`,
  };
}

/**
 * §2.8 · CESTAS QUE CAMBIAN — the customer changed what they were taking.
 *
 * ⚠ THE ROW READING IS THE DESIGNED INSTANCE, NOT THE DIFF — and a screenshot is why. The canon
 * gives this reading two sources: World B's k=0-against-k=1 diff, and today's `changed` tag (a
 * customer who moved a line AFTER it was recorded — the hardest moment the product has, seeded
 * deliberately at about one row in a hundred).
 *
 * The diff fired on 210 of 296 accounts. Its premise — a stable shelf makes the delta honest —
 * holds for which PRODUCTS are on the albarán and NOT for how much of each: World B's quantities
 * are modular arithmetic and swing between visits by construction. So a quantity delta there is
 * the generator, exactly as a World A day-diff would be, and the reconciliation law applies to it
 * for the same reason.
 *
 * So the ROW carries the designed instance — real, legible, and a handful — and the diff stays on
 * the SHEET, where a person reads one customer's whole record with the asked/given pairs beside it
 * and can judge the movement themselves. The reading a book scans has to be one a person can act
 * on; the record a sheet holds can be richer than that.
 */
function changedOf(cast: Cast, customer: Customer, theirs: Sale[]): AttentionReading | null {
  const moved = theirs.find((s) => s.changed);
  if (moved?.changed) {
    const c = moved.changed;
    return {
      customer: customer.id,
      name: customer.name,
      kind: 'changed',
      line: 'Changed the order after it was recorded',
      evidence: `At ${c.at}: more ${c.raised.product}, less ${c.dropped.product}.`,
    };
  }
  return null;
}

/** THE DIFF ITSELF, for the surfaces that read ONE customer whole (the sheet, the seat's card). It
 *  is deliberately not a row reading — see `changedOf` for why. */
export function changedWords(cast: Cast, customer: Customer): string | null {
  const diff = basketDiff(cast, customer);
  if (!diff) return null;
  /* ⚠ A LINE THAT APPEARS OR DISAPPEARS IS NOT A CHANGE OF MIND HERE, and a screenshot proved it:
     the row reading fired on 230 of 296 accounts. World B's shelf is stable, but the per-visit
     PRESENCE filter drops a different line each visit by construction — so «sin merluza» is the
     generator, not the customer. That is the reconciliation law again, one world in: only a
     QUANTITY that actually moved speaks on a row. The comings and goings stay in `BasketDiff` for
     the sheet, where a person is reading one customer's whole record and can judge them. */
  const bits: string[] = [];
  for (const m of diff.moved) {
    const sign = m.to > m.from ? '+' : '−';
    bits.push(`${sign}${amount(Math.abs(round(m.to - m.from)))} ${m.unit} ${m.product.toLowerCase()}`);
  }
  for (const g of diff.gone) bits.push(`sin ${g.toLowerCase()}`);
  for (const a of diff.arrived) bits.push(`y ${a.toLowerCase()}`);
  return bits.length ? bits.slice(0, 3).join(' · ') : null;
}

/**
 * §2.12 · PIDEN COSAS NUEVAS — a line outside the shelf they have always kept.
 *
 * ⚠ ONLY THE DESIGNED SIGNALS SPEAK. The blunt set-difference of today's ledger lines against the
 * World B shelf would fire on most of the book, because the two worlds draw their baskets from
 * independent generators — that is the reconciliation law again, and firing it would fill this
 * region with generator noise dressed as insight. So the reading comes from the albarán's own
 * off-catalogue lines: something the house wrote down that its catalogue has no row for.
 */
function differentOf(cast: Cast, customer: Customer, theirs: Sale[]): AttentionReading | null {
  for (const s of theirs) {
    const off = s.lines.find((l) => l.nonSku);
    if (!off) continue;
    return {
      customer: customer.id,
      name: customer.name,
      kind: 'different',
      line: `Asked for ${off.product.name.toLowerCase()}`,
      evidence: `Outside your catalogue, on the delivery note of ${shortOf(cast, s.day)}.`,
    };
  }
  return null;
}

/**
 * §2.10 · INCIDENCIAS — the friction reading.
 *
 * ⚠ ONLY WHAT IS STILL OPEN RIDES A ROW. The first build fired on any dispute in either world, and
 * a screenshot answered it: World B seeds a complaint on every other account, so half the book
 * carried «incidencia» — and every one of those was CREDITED THE SAME DAY. A closed complaint from
 * a fortnight ago is not a call to make; it is record, and record belongs on the customer's sheet
 * where a person is reading their whole history.
 *
 * So the row reading is the OPEN ones: a dispute with no outcome yet. That is a handful, and every
 * one of them is somebody a person should ring today — which is the filler law's own bar (§2.0.g:
 * «worth a glance at 300 orders a day»).
 */
function incidenciaOf(cast: Cast, customer: Customer, theirs: Sale[]): AttentionReading | null {
  const live = theirs.find((s) => s.dispute && !s.dispute.outcome);
  if (live?.dispute) {
    return {
      customer: customer.id,
      name: customer.name,
      kind: 'incidencia',
      line: 'Open complaint',
      evidence: live.dispute.because,
    };
  }
  const past = historyOf(cast, customer).find((a) => a.dispute && !a.dispute.outcome);
  if (!past?.dispute) return null;
  return {
    customer: customer.id,
    name: customer.name,
    kind: 'incidencia',
    line: `Complaint on ${past.day}`,
    evidence: past.dispute.because,
  };
}

/**
 * THE ONE READING A CUSTOMER'S ROW CARRIES.
 *
 * THE CAP IS THE POINT (THE-DATA-CANON §2.0.e — the one-health-tag law, extended to insight). A
 * row is ONE customer, and a row wearing four readings is a row nobody reads. So every customer is
 * asked all four questions and keeps the highest-priority answer: dropped beats changed beats
 * different beats incidencia — the order of how much a person's morning wants to know it.
 */
export function readingFor(cast: Cast, customer: Customer, theirs: Sale[]): AttentionReading | null {
  const all = [
    droppedOf(cast, customer),
    changedOf(cast, customer, theirs),
    differentOf(cast, customer, theirs),
    incidenciaOf(cast, customer, theirs),
  ].filter((r): r is AttentionReading => r !== null);
  if (!all.length) return null;
  return all.sort((a, b) => rankOf(a.kind) - rankOf(b.kind))[0];
}

/** EVERY reading in the book, priority-ordered — what the seat's «Need attention» region draws, and
 *  what the Customers narrows filter on. Folded once; the row and the seat read the same result. */
export function attentionReadings(cast: Cast, all: Sale[]): AttentionReading[] {
  /* THE READING IS OF WHAT HAS HAPPENED (C15). The book's narrows and the seat's cards are one
     fold, so the cut lives here rather than at either surface. */
  const sales = upToToday(cast, all);
  const by = new Map<string, Sale[]>();
  for (const s of sales) {
    const held = by.get(s.customer.id);
    if (held) held.push(s);
    else by.set(s.customer.id, [s]);
  }
  const out: AttentionReading[] = [];
  for (const c of cast.customers) {
    const theirs = by.get(c.id) ?? [];
    const r = readingFor(cast, c, theirs);
    /* THE WORTH IS FOLDED ONLY FOR THE ACCOUNTS THAT HAVE A READING — a handful of the book, so
       the list can be ranked by value without folding a year for three hundred accounts. */
    if (r) out.push({ ...r, figure: yearOf(cast, c, theirs).figure });
  }
  /* PRIORITY FIRST, THEN VALUE (the walk, P1-6). Alphabetical order inside a kind is the list
     saying «these five, in no order at all» — and the surfaces that read this fold are the ones
     asking «who do I ring today». The name breaks a tie so the fold stays deterministic. */
  return out.sort((a, b) => rankOf(a.kind) - rankOf(b.kind)
    || (b.figure ?? 0) - (a.figure ?? 0)
    || a.name.localeCompare(b.name, 'es'));
}

/** the readings a NARROW covers. «Need attention» is the calls to make; «Changed» is what moved. */
export const NARROW_KINDS: Record<'attend' | 'changes', ReadingKind[]> = {
  attend: ['dropped', 'incidencia'],
  changes: ['changed', 'different'],
};

/* ═══ REGION 1 · LO QUE ROCOTO SABE — the learning status (THE-DATA-CANON §3) ═════════════════
 * «Learned» is three verifiable quantities, and COVERAGE is the one this fold owns: how much of
 * their world Rocoto can name. Never a confidence percentage — knows.ts's own law — and never a
 * bar chart of an import: a Fact, a hairline meter, and the count SAID IN WORDS.
 */

export type Coverage = {
  id: string;
  label: string;
  /** how many are known */
  held: number;
  /** out of how many */
  of: number;
  /** the claim, in words — «The rhythm of 214 of 296 customers». The TILE prints the count and
   *  the meter; this sentence is the door's own name and the card's heading. */
  words: string;
};

/**
 * THE COVERAGE, AND IT MOVES WHEN THE HOUSE FEEDS IT (FEED-IA §60 · AUDIT-2 C5).
 *
 * «If that affects the app, it HYDRATES the app, it FEEDS the app.» The four facts used to read
 * the CAST and nothing else, so a house that had just imported a year saw «Read 77.363 albaranes
 * across 2.667 customers» on the fed card and «The rhythm of all 296 of your customers» forty
 * pixels below it — two counts of one book inside one band, one of them stale.
 *
 * ⚠ EVERY POST-IMPORT NUMBER IS TAKEN OFF THE EVENT, NEVER SCALED OFF THE SAMPLE. The event says
 * what arrived: `customers` accounts, `albaranes` documents over `months` months, `grounded` names
 * placed on the tree. A rhythm and a shelf are what a year of an account's albaranes ARE, and the
 * import carried a year for every account it named — so both are covered for all of them, counted
 * rather than estimated. Menus arrive with no import at all, so that fact keeps its own count and
 * stays the partial one. Interpolating a ratio off the 296-account sample would be the exact fake
 * the head of this file forbids.
 */
export function coverage(cast: Cast, imported?: ImportEvent): Coverage[] {
  const accounts = imported ? imported.customers : cast.customers.length;
  /* A RHYTHM IS ESTABLISHED WHERE THE RECORD SHOWS ONE, and «established» is `dayPatternOf`'s own
     test: a weekday earns its place by RECURRING — seen twice or more across the window. An account
     whose albaranes fall on a different day every time HAS no pattern, and counting it as one would
     be the first fake in a seat built to have none.
     THE FIRST BUILD COUNTED EVERY ACCOUNT and came back «Ritmo de 296 de 296 clientes» — a true
     sentence that reads as a lie, because a coverage of everything says nothing about coverage. */
  const rhythms = imported
    ? imported.customers
    : cast.customers.filter((c) => dayPatternOf(cast, c).days.length > 0).length;
  const shelves = imported
    ? imported.customers
    : cast.customers.filter((c) => basketOf(cast, c).lines.length >= 2).length;
  /* THE TREE FACT IS COMPLETE BY CONSTRUCTION: what the intake grounds is what it read, so the
     count is its own denominator — before an import the catalogue, after one the event's own. */
  const grounded = imported ? imported.grounded : cast.products.length;

  /* THE CLAIM IS SAID IN WORDS, AND A COMPLETE ONE IS SAID AS COMPLETE. «Ritmo de 296 de 296
     clientes» is true and reads as a rounding error; «El ritmo de tus 296 clientes» is the same
     count and says what it means. A fraction is for a coverage that is genuinely partial — which
     is what «2 cartas de 296» is, and why it stays a fraction. */
  const said = (held: number, of: number, whole: string, part: string): string =>
    (held >= of ? whole : part);

  return [
    {
      id: 'rhythms',
      label: 'Delivery schedules',
      held: rhythms,
      of: accounts,
      words: said(rhythms, accounts, `Delivery schedules for ${count(accounts)} customers.`, `Delivery schedules for ${count(rhythms)} of ${count(accounts)} customers.`),
    },
    {
      id: 'shelves',
      label: 'Frequent products',
      held: shelves,
      of: accounts,
      words: said(shelves, accounts, `Frequent products for ${count(accounts)} customers.`, `Frequent products for ${count(shelves)} of ${count(accounts)} customers.`),
    },
    {
      id: 'tree',
      label: 'Categorised products',
      held: grounded,
      of: grounded,
      words: `${count(grounded)} categorised products.`,
    },
    {
      id: 'menus',
      label: 'Customer menus',
      held: MENUS_SEEDED,
      of: accounts,
      words: `${count(MENUS_SEEDED)} customer menus, of ${count(accounts)} customers.`,
    },
  ];
}

/** WHAT THE FOUR FACTS WERE COUNTED OVER, said once under the grid — and it moves with the
 *  import for the same reason the facts do (C5). */
export const coverageMethod = (cast: Cast, imported?: ImportEvent): Method =>
  `${count(imported ? imported.customers : cast.customers.length)} accounts · ` +
  `${count(imported ? imported.grounded : cast.products.length)} products.`;

/* ── EVERY FIGURE OPENS, AND NOW IT DOES (FEED-IA §63 · AUDIT-2 C18) ──────────────────────────
 * «It should all be decided in front of you live, and an interaction can be evident from it.»
 * The seat printed «Every figure opens.» under four facts that had no door, no cursor and no
 * dialog — a promise the surface did not keep, under a region whose whole job is being checkable.
 *
 * SO A FACT OPENS ONTO ITS DERIVATION, not onto a dump of rows. The card states the RULE the
 * count was made by and then walks a handful of the house's own accounts and goods through it,
 * each one a door of its own. That is what «decided in front of you» buys a person: not the
 * 2.667 rows behind a number, but the test the number was made with and real cases meeting it.
 */
export type CoverageExample = {
  kind: 'customer' | 'product';
  id: string;
  name: string;
  /** what this one shows, in the fewest words that can be checked */
  says: string;
};

export type CoverageDetail = { rule: Method; examples: CoverageExample[] };

/** how many worked cases a card walks through — enough to see the rule bite, few enough to read */
const WORKED = 4;

export function coverageDetail(cast: Cast, id: string): CoverageDetail {
  if (id === 'rhythms') {
    const rows = cast.customers
      .map((c) => ({ c, p: dayPatternOf(cast, c) }))
      .filter((r) => r.p.days.length > 0)
      .slice(0, WORKED);
    return {
      rule: 'A weekday counts once it recurs — the same day of the week on two of the account’s delivery notes or more.',
      /* THE WEEKDAYS, AND NOT THE CADENCE. `dayPatternOf` also returns «about every N days», and
         on World B's `dd.mm` history that N comes back as four figures — the span is measured
         with `dayFromId`, which parses an ISO key rather than a trade date. The defect belongs to
         `knows.ts` and is reported rather than patched from here; this card shows the part of the
         pattern that is right, which is also the part the rule above is about. */
      examples: rows.map((r) => ({
        kind: 'customer', id: r.c.id, name: r.c.name,
        says: `${r.p.days.join(' · ')} — on ${count(historyOf(cast, r.c).length)} delivery notes`,
      })),
    };
  }
  if (id === 'shelves') {
    const rows = cast.customers
      .map((c) => ({ c, b: basketOf(cast, c) }))
      .filter((r) => r.b.lines.length >= 2)
      .slice(0, WORKED);
    return {
      rule: 'Products appearing in this customer’s delivery notes.',
      examples: rows.map((r) => ({
        kind: 'customer', id: r.c.id, name: r.c.name,
        says: `${count(r.b.lines.length)} products — ${r.b.lines.slice(0, 2).map((l) => l.product.name.toLowerCase()).join(', ')}`,
      })),
    };
  }
  if (id === 'tree') {
    const tree = treeOf(cast);
    return {
      rule: 'Each product in your records has a catalogue category.',
      examples: cast.products.slice(0, WORKED).map((p) => {
        const nodes = tree.filter((n) => n.products.includes(p.id));
        return {
          kind: 'product' as const, id: p.id, name: p.name,
          says: `${count(nodes.length)} ${nodes.length === 1 ? 'category' : 'categories'} — ${nodes.map((n) => n.name).slice(0, 2).join(', ')}`,
        };
      }),
    };
  }
  return {
    rule: 'Customer menus recorded from each account’s public listing.',
    examples: cast.customers.slice(0, MENUS_SEEDED).map((c) => ({
      kind: 'customer' as const, id: c.id, name: c.name,
      says: 'Customer menu recorded',
    })),
  };
}

/* ── SIX CARDS ACROSS THE KINDS, NEVER SIX DOWN ONE RANK (§60.2 · AUDIT-2 C17) ────────────────
 * `attentionReadings` comes back priority-ordered, and the seat took the first six of it. With
 * six or more `dropped` accounts in the book — which is the ordinary case — `changed`,
 * `different` and `incidencia` could never reach the surface at all, so three of §60's four named
 * readings were computed and had no home. The cards are DEALT instead: one of each kind in
 * priority order, round after round, until the six are full. A kind with nothing to say takes no
 * turn, and the highest-priority kinds still fill whatever the others leave.
 */
export function attentionSpread(readings: AttentionReading[], n: number): AttentionReading[] {
  const piles = READING_PRIORITY.map((k) => readings.filter((r) => r.kind === k));
  const out: AttentionReading[] = [];
  for (let round = 0; out.length < n; round++) {
    let dealt = false;
    for (const pile of piles) {
      if (round >= pile.length) continue;
      out.push(pile[round]);
      dealt = true;
      if (out.length === n) break;
    }
    if (!dealt) break;
  }
  return out;
}

/* ═══ THE COMPANY DNA, NAMED (THE-CHECKPOINT §5.2 · FEED-IA §83.2) ═══════════════════════════
 * `knows.ts` states the FACTS about how a house writes — five sentences, each with its evidence.
 * This names what they come to, because a person choosing a register needs a NAME and a house
 * should never have to write a style prompt to get one.
 *
 * IT IS A PURE READ LIKE EVERYTHING ELSE HERE. Hand it the same house, the same knowing and the
 * same dropped lines and it returns the same register, byte for byte. It carries its `method`, so
 * a stranger can check the claim against how it was made — which is the whole reason a register
 * inferred from somebody's messages is allowed to be offered at all.
 *
 * IT IS OFFERED, NEVER IMPOSED (§83.2). Nothing here writes a grant: the seat renders this beside
 * the three named registers as a fourth chip, and a house that never presses it is a house whose
 * setting never moved.
 *
 * AND A HOUSE THAT HAS BROUGHT NOTHING IN GETS `read: false` RATHER THAN A GUESS. A register
 * asserted off no messages is exactly the software having an opinion of its own.
 */

export type HouseVoice = {
  /** have this house's own messages been read at all */
  read: boolean;
  /** the named register they come closest to */
  register: Exclude<ToneProfile, 'house'>;
  /** that register, said as the thing it is */
  sentence: string;
  /** the lines it was read off, with anything the house dropped already gone */
  lines: Observation[];
  method: Method;
};

/** WHAT EACH REGISTER READS AS, in the same words the contract's own chips use — one place, so a
 *  DNA that says «cordial» and a chip that says «cordial» can never mean two different things. */
const REGISTER_SAYS: Record<Exclude<ToneProfile, 'house'>, string> = {
  flat: 'Plain — one line, the figure on it.',
  cordial: 'Cordial — a good morning, one line, the figure on it.',
  dry: 'Dry — the day and the figure.',
};

export function houseVoice(cast: Cast, knows: Knows, dropped: string[] = []): HouseVoice {
  const lines = houseStyle(knows, dropped);
  const { familiar, total } = familiarReach(cast);
  const months = knows.imported?.months ?? IMPORT_MONTHS;
  /* THE READING, AND IT TURNS ON THE LINES THE HOUSE KEPT. Dropping «you open with a good
     morning» is a house saying it does not, so the register follows the edit — which is what
     makes the edit worth offering rather than a checkbox that changes nothing. */
  const kept = (id: string) => lines.some((o) => o.id === id);
  const register: Exclude<ToneProfile, 'house'> = kept('style-open')
    ? (familiar * 2 >= total ? 'cordial' : 'flat')
    : 'dry';

  return {
    read: lines.length > 0,
    register,
    sentence: REGISTER_SAYS[register],
    lines,
    method: `Read off ${count(months)} months of your own messages — the rails your ${count(total)} accounts reach you on, your replies, and the people who send them. It names a register; the choice stays yours.`,
  };
}

/** the house's own name for the window every arithmetic region is read over */
export const windowWords = (cast: Cast, sales: Sale[]): string => {
  /* IN THE TRADE'S OWN DATES (C15). The foot used to print the ISO keys — «2025-08-21 –
     2025-08-25» — in an app that writes `dd.mm` on every other surface it has. */
  const days = dayTotals(cast, upToToday(cast, sales));
  return days.length ? spanOf(cast, days) : CASTS[cast.sector].label;
};
