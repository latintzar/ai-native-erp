/* THE RULE — the one object in this app a person writes and then leaves running. V2-STOCK.
 *
 * ═══ WHAT A RULE IS (THE-APP-V2 §2) ══════════════════════════════════════════════════════════
 * «If they maintain a par level, it's just a rule they set — it does the announcement on a
 * scheduled basis, replenished every day, they say at what time. All the AI features end up
 * stacked on top of this.»
 *
 * So the rule is NOT a mode, NOT a questionnaire answer, and NOT a second inventory system. It is
 * `par(product, level, replenishAt)`, written on the product's own card, and its whole behaviour
 * is that it EMITS AN ANNOUNCEMENT once a day at the time it was given. The emission is an event
 * in the product's ledger exactly like a photographed arrival or a hand-typed count — the only
 * thing that distinguishes it is its attribution, «by rule · 06:00», and the accent that marks it,
 * because the emission is the machine's own act (the standing colour law).
 *
 * ═══ THE THREE PROPERTIES THAT MAKE IT AN OBJECT AND NOT A SETTING ════════════════════════════
 *
 * 1 · EMISSIONS ARE DERIVED, NEVER STORED. `emissions(rule, now)` is a pure function of the rule
 *     and the clock. Nothing writes an event row into storage on a timer, so a prototype that was
 *     shut on Tuesday and opened on Thursday has Wednesday's emission in the ledger, and two
 *     surfaces reading the same rule can never disagree about what it emitted.
 *
 * 2 · STOPPING A RULE IS A DATE, NOT A DELETION. `until` closes the window; the emissions inside
 *     the window survive forever, because they happened. A ledger that loses its history when a
 *     rule is dropped is a ledger nobody can be audited from — the same doctrine as the variance
 *     posting in LOTS-EXPLAINED §4: the record remembers, always.
 *
 * 3 · A RULE BELONGS TO A CATALOGUE. `sector` is stamped on it, so switching the cast in Settings
 *     shows that house's rules and not somebody else's — a product id alone is ambiguous across
 *     three casts that all have a first product.
 *
 * ═══ WHO USES WHAT ═══════════════════════════════════════════════════════════════════════════
 * V2-CORE renders the company's rules as a list in Settings: `useRules()` for the set,
 * `ruleSentence()` for the words on the row, `deleteRule()` for the act, and `seedRules()` to
 * plant the first one. V2-STOCK owns the authoring UI on the product card, `stopRule()` on it,
 * and the emission's appearance in the ledger.
 *
 * NO PROVIDER. The store is a module singleton read through `useSyncExternalStore`, deliberately:
 * `main.tsx` and `App.tsx` belong to V2-CORE, and a rules surface that needs a provider mounted
 * above it could not be written without editing them. Any component anywhere calls `useRules()`
 * and every one of them re-renders on the same write.
 */
import * as React from 'react';
import type { SectorId } from '../../scenarios/meta';

/* ── THE OBJECT ───────────────────────────────────────────────────────────────────────────── */

/** One kind today. The union exists because the shape of this file is «rules the person sets»,
 *  and the second kind — a standing reorder, a watch — lands beside this one without a migration. */
export type RuleKind = 'par';

export type Rule = {
  id: string;
  kind: RuleKind;
  /** the catalogue this rule was written in */
  sector: SectorId;
  /** Product.id in that catalogue */
  product: string;
  /** the level it is kept at */
  level: number;
  /** the unit the level is counted in — it shares the number's line wherever it is drawn */
  unit: string;
  /** «06:00» — the time of day the announcement goes out, 24h */
  replenishAt: string;
  /** the first day it can emit, `YYYY-MM-DD` */
  from: string;
  /** the last day it can emit. Set when somebody stops it; everything before survives. */
  until?: string;
};

/** What the person hands the authoring UI. Identity and dates are the store's business. */
export type RuleDraft = {
  kind?: RuleKind;
  sector: SectorId;
  product: string;
  level: number;
  unit: string;
  replenishAt: string;
};

/* ── DAYS ─────────────────────────────────────────────────────────────────────────────────────
 * A day is a `YYYY-MM-DD` string and never a Date, because a Date is an instant and «the day the
 * rule started» is not one. The two converters below are the only place the two ideas meet.
 */

export const dayKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** A day plus a `HH:MM` — the instant an emission carries. */
export function instantOf(day: string, at: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  const [hh, mm] = at.split(':').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0);
}

const addDays = (day: string, n: number): string => {
  const [y, m, d] = day.split('-').map(Number);
  return dayKey(new Date(y, (m || 1) - 1, (d || 1) + n));
};

/* ── THE EMISSION ─────────────────────────────────────────────────────────────────────────────
 * An announcement the rule made. It states a LEVEL — «I'm telling you how much we have now» in
 * the Stock Announcement's own two-mode grammar — so the ledger folds it as a set and not as a
 * delta, which is what «replenished every day» actually means on the floor.
 */
export type Emission = {
  id: string;
  ruleId: string;
  product: string;
  /** what the rule announced */
  level: number;
  unit: string;
  /** the day it went out */
  day: string;
  /** the instant it went out */
  at: Date;
  /** the time as the rule states it, for the attribution line */
  replenishAt: string;
};

/** How far back a card's ledger is worth reading. A rule left running for a month is real; a
 *  ledger with thirty identical rows in it is unreadable, so the card shows the recent window and
 *  the count says how many there have been. */
export const EMISSION_WINDOW_DAYS = 5;

/**
 * Every announcement this rule has made, oldest first.
 *
 * THE WINDOW IS `[from, min(today, until)]`, inclusive at both ends, and TODAY'S EMISSION IS IN IT
 * the moment the rule exists. That is the simulation THE-APP-V2 §2 asks for, and it is the honest
 * reading of the object as well: the rule is a standing instruction about the day, so the day it
 * is written is a day it governs. The stamp carries the rule's own time, so what the row says
 * happened and what the rule promises are the same sentence.
 */
export function emissions(rule: Rule, now: Date = new Date(), window = EMISSION_WINDOW_DAYS): Emission[] {
  const today = dayKey(now);
  const last = rule.until && rule.until < today ? rule.until : today;
  if (last < rule.from) return [];

  const days: string[] = [];
  for (let day = rule.from; day <= last; day = addDays(day, 1)) {
    days.push(day);
    if (days.length > 366) break; /* a clock that ran backwards is not a reason to hang */
  }

  return days.slice(-window).map((day) => ({
    id: `${rule.id}:${day}`,
    ruleId: rule.id,
    product: rule.product,
    level: rule.level,
    unit: rule.unit,
    day,
    at: instantOf(day, rule.replenishAt),
    replenishAt: rule.replenishAt,
  }));
}

/** How many announcements this rule has made in total, window or no window. */
export function emissionCount(rule: Rule, now: Date = new Date()): number {
  const today = dayKey(now);
  const last = rule.until && rule.until < today ? rule.until : today;
  if (last < rule.from) return 0;
  const a = instantOf(rule.from, '00:00').getTime();
  const b = instantOf(last, '00:00').getTime();
  return Math.round((b - a) / 86400000) + 1;
}

/** Is this rule still emitting? */
export const isLive = (rule: Rule, now: Date = new Date()): boolean =>
  !rule.until || rule.until >= dayKey(now);

/** The rule's own sentence, and the only words that describe it anywhere in the app. The level's
 *  unit shares the level's line, here as everywhere: «Kept at par 40 kg · replenishes 06:00». */
export const ruleSentence = (rule: Rule): string =>
  `Kept at par ${formatLevel(rule.level)} ${rule.unit} · replenishes ${rule.replenishAt}`;

/** A level as it is read, not as it is stored: Spain's separators, and no tail of zeros. */
export function formatLevel(level: number, locale = 'es-ES'): string {
  return level.toLocaleString(locale, { maximumFractionDigits: 2 });
}

/* ── THE TIMES ON OFFER ───────────────────────────────────────────────────────────────────────
 * Half-hours across the working morning and into the afternoon. The authoring UI puts the house's
 * own hour — the cast's `hour`, 05:00 for fish and 08:00 for meat — at the top of this list, so
 * the default is the market the person actually stands in.
 */
export const REPLENISH_TIMES: string[] = [
  '04:00', '04:30', '05:00', '05:30', '06:00', '06:30', '07:00', '07:30',
  '08:00', '08:30', '09:00', '10:00', '11:00', '12:00', '14:00', '16:00', '18:00',
];

/** The offered time nearest the one the house keeps, so a cast on 06:30 opens on 06:30. */
export function nearestTime(hour: string): string {
  if (REPLENISH_TIMES.includes(hour)) return hour;
  const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const want = minutes(hour);
  return REPLENISH_TIMES.reduce((best, t) =>
    Math.abs(minutes(t) - want) < Math.abs(minutes(best) - want) ? t : best,
  );
}

/* ── THE STORE ────────────────────────────────────────────────────────────────────────────────
 * One module-level array, persisted, published through `useSyncExternalStore`. Every reader sees
 * the same set and every write reaches all of them; there is no provider to mount and no second
 * copy of a rule to fall out of step.
 */

export const RULES_STORAGE_KEY = 'rocoto-app-rules';

const isRule = (r: unknown): r is Rule => {
  if (!r || typeof r !== 'object') return false;
  const x = r as Record<string, unknown>;
  return (
    x.kind === 'par' &&
    typeof x.id === 'string' &&
    typeof x.product === 'string' &&
    typeof x.unit === 'string' &&
    typeof x.replenishAt === 'string' &&
    typeof x.from === 'string' &&
    Number.isFinite(x.level) &&
    (x.sector === 'fish' || x.sector === 'meat' || x.sector === 'fruit')
  );
};

function read(): Rule[] {
  try {
    const raw = window.localStorage.getItem(RULES_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isRule) : [];
  } catch {
    return [];
  }
}

let RULES: Rule[] = typeof window === 'undefined' ? [] : read();
const listeners = new Set<() => void>();
let saveError = '';
const publish = (next: Rule[]): boolean => {
  try {
    window.localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(next));
  } catch {
    saveError = 'Saving the replenishment rule stalled. The previous rule stands; keep your values here and try again.';
    for (const l of listeners) l();
    return false;
  }
  RULES = next;
  saveError = '';
  for (const l of listeners) l();
  return true;
};
export const useRuleSaveError = (): string => React.useSyncExternalStore(subscribe, () => saveError, () => '');

const subscribe = (l: () => void): (() => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

const snapshot = (): Rule[] => RULES;

let seq = 0;
const nextId = (): string => `rule-${Date.now().toString(36)}-${++seq}`;

/** Write a par rule. A product carries at most ONE live par rule — a second one would be two
 *  answers to one question — so setting a rule where one is already running stops the old one
 *  today and starts the new one, and the old one's emissions stay in the ledger. */
export function setParRule(draft: RuleDraft, now: Date = new Date()): Rule | null {
  const today = dayKey(now);
  const rule: Rule = {
    id: nextId(),
    kind: draft.kind ?? 'par',
    sector: draft.sector,
    product: draft.product,
    level: draft.level,
    unit: draft.unit,
    replenishAt: draft.replenishAt,
    from: today,
  };
  const superseded = RULES.map((r) =>
    r.sector === rule.sector && r.product === rule.product && isLive(r, now) ? { ...r, until: today } : r,
  );
  return publish([...superseded, rule]) ? rule : null;
}

/** Stop a rule. It emits no more; every announcement it already made stays where it is. */
export function stopRule(id: string, now: Date = new Date()): void {
  const today = dayKey(now);
  publish(RULES.map((r) => (r.id === id ? { ...r, until: today } : r)));
}

/**
 * Take a rule off the register entirely — Settings' own act.
 *
 * TWO VERBS, TWO PLACES, DELIBERATELY. On the product card in Stock, a rule that ran and then
 * ended is STOPPED: the emissions it made are history and history stays. In Settings the list is
 * the register of what the company has standing, so the verb there is DELETE, for the rule that
 * should never have been written. A person who wrote «par 40 kg» on the wrong product deserves
 * the row gone, not a stopped rule sitting in the ledger forever.
 */
export function deleteRule(id: string): void {
  publish(RULES.filter((r) => r.id !== id));
}

/* ── THE FIRST RULE ───────────────────────────────────────────────────────────────────────────
 * A register with nothing in it teaches nothing, so the app starts with ONE rule written on the
 * house's own first product at the house's own hour. It is planted once per catalogue and the
 * plant is remembered, so deleting it deletes it — a demonstration that grows back is a
 * demonstration nobody can act on.
 */

export const SEEDED_STORAGE_KEY = 'rocoto-app-rules-seeded';

function seeded(): string[] {
  try {
    const raw = window.localStorage.getItem(SEEDED_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

/** Plant the demonstration rule for a catalogue, once and only once. */
export function seedRules(draft: RuleDraft, now: Date = new Date()): void {
  const done = seeded();
  if (done.includes(draft.sector)) return;
  if (!setParRule(draft, now)) return;
  try {
    window.localStorage.setItem(SEEDED_STORAGE_KEY, JSON.stringify([...done, draft.sector]));
  } catch {
    /* a prototype in a private window still has to run */
  }
}

/** Every rule ever written, live and stopped. */
export const allRules = (): Rule[] => RULES;

/** The live par rule on one product, if it has one. */
export const parRuleOf = (rules: Rule[], sector: SectorId, product: string, now: Date = new Date()): Rule | undefined =>
  rules.find((r) => r.kind === 'par' && r.sector === sector && r.product === product && isLive(r, now));

export type RulesState = {
  /** every rule, live and stopped, oldest first */
  rules: Rule[];
  /** the ones still emitting */
  live: Rule[];
  /** ── AND `from` IS STAMPED IN THE SAME CLOCK AS `until` ──────────────────────────────────
   *  §17.7's repair below handed the house's day to `stop` and stopped there, so a rule was
   *  ENDED on the house's morning and STARTED on the browser's — «2026-08-30» against a book
   *  living on «2025-08-22». `isLive` reads both stamps, so a rule written today was live only
   *  because `from` happened to be in the future of nothing: supersede an existing rule and the
   *  old one's `until` and the new one's `from` were a year apart, which is not one register of
   *  facts. One clock or none. */
  set: (draft: RuleDraft, at?: Date) => Rule | null;
  /** ── THE HOUSE'S CLOCK, HANDED IN (AUDIT-2 §17.7, diagnosed 2026-08-29) ───────────────────
   *  «Stop the rule and the row goes with it, in the same breath» was red, and the reason was a
   *  CLOCK rather than a rule: `stopRule` stamped `until` off `new Date()` — the browser's day —
   *  while every reader of a rule works on the HOUSE's day (`nowOf(cast)`, the demo's own morning).
   *  So `expectedOf` compared «2026-08-29» against a tomorrow of «2025-08-23», found the stop was
   *  not before it, and kept drawing the announcement of a rule nobody was keeping any more.
   *  A stamp written in one clock and read in another is not a fact, so the surface hands its own
   *  clock in. The default stays for the callers that have none. */
  stop: (id: string, at?: Date) => void;
  /** off the register, row and all — Settings' verb */
  remove: (id: string) => void;
};

/** The one hook every surface reads. Settings lists `live`; a product card asks `parRuleOf`. */
export function useRules(): RulesState {
  const rules = React.useSyncExternalStore(subscribe, snapshot, snapshot);
  return React.useMemo<RulesState>(
    () => ({
      rules,
      live: rules.filter((r) => isLive(r)),
      set: (draft, at) => setParRule(draft, at),
      stop: (id, at) => stopRule(id, at),
      remove: (id) => deleteRule(id),
    }),
    [rules],
  );
}

/**
 * The rule the PERSON is still keeping.
 *
 * TWO QUESTIONS, TWO READERS. `parRuleOf` answers «may this rule still emit today», and a rule
 * stopped this morning may — `stopRule` closes the window at TODAY, so today's announcement, which
 * already went out, stands. That is right for the ledger and wrong for the card, where the question
 * is whether a person is still keeping the product at a level. So the card reads the END DATE, and
 * the most recently written rule wins, which is what makes re-authoring on the same day land.
 *
 * THE SECTOR IS PART OF THE KEY. A product id alone is ambiguous across three casts that all have
 * a first product, so a house switched in Settings would otherwise read another house's rule.
 */
export function standingRule(rules: Rule[], sector: SectorId, product: string): Rule | undefined {
  return [...rules]
    .reverse()
    .find((r) => r.kind === 'par' && r.sector === sector && r.product === product && !r.until);
}

/* ── THE DEMONSTRATION RULE, WRITTEN ONCE ─────────────────────────────────────────────────────
 * The register plants ONE par rule per catalogue, on the house's own first product at the hour
 * that house keeps. It is offered here as a single verb so that whichever surface a person lands
 * on first plants it — Settings, where the register lives, or Stock, where the object it describes
 * is drawn. `seedRules` is guarded per catalogue, so the second caller is a no-op and the two can
 * never plant two rules.
 */

/** The level the demonstration keeps. One number, one home. */
export const DEMO_PAR_LEVEL = 40;

/** Plant the house's demonstration rule, whoever asks first. */
export function seedHouseRule(a: { sector: SectorId; product: string; unit: string; hour: string }): void {
  seedRules({
    sector: a.sector,
    product: a.product,
    level: DEMO_PAR_LEVEL,
    unit: a.unit,
    replenishAt: nearestTime(a.hour),
  });
}
