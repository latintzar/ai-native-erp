/* THE SCHEDULED BRIEFING — §23's second example, and only its second example.
 *
 * ═══ WHAT PETER ASKED FOR, VERBATIM (THE-CHECKPOINT-2026-08-28 §23) ═════════════════════════
 * «There needs to be a simple scheduled-output area. Explicit examples: send orders / required
 * information to a sub-supplier; send scheduled briefings to selected team members. Relevant
 * operational surfaces can deep-link into this setting. Do not turn Rocoto into a generic Zapier
 * clone.»
 *
 * SO THERE ARE TWO SCHEDULED OUTPUTS IN THIS APP AND THIS FILE HOLDS THE SECOND ONE.
 *   · THE SUB-SUPPLIER SEND is built and lives where it belongs — `supplier-forwarding.tsx`, on
 *     the Connections seat, as a partner's own daily list closing at a cut-off. It is a category
 *     timer, and it stays one (THE-CHECKPOINT-MAP P7's «deliberately NOT»).
 *   · THE TEAM BRIEFING is this: a paper the house already prints, at an hour, to people the house
 *     already has. Three facts, one row.
 *
 * ═══ WHY IT IS NOT A BUILDER ════════════════════════════════════════════════════════════════
 * «Do not turn Rocoto into a generic Zapier clone» is a design constraint with teeth: a trigger
 * picker, a condition tree and an action list would be a second product living inside this one.
 * The three fields below are the WHOLE vocabulary — WHAT, at WHAT HOUR, to WHOM — and each of them
 * takes its values from things the app already has rather than from a general-purpose type. The
 * body is one of the day papers `print-view.tsx` already draws; the hour comes off the house's own
 * opening hour; the people are the house's own members. Nothing here can express a thing the app
 * cannot then do.
 *
 * ═══ THE TYPES BEYOND THE TWO ARE §28'S, AND THEY STAY OPEN ═════════════════════════════════
 * «exact scheduled-email types beyond explicit examples» is on Peter's own open list. So this file
 * holds the two papers a briefing can be — both of them organs that exist — and grows a third only
 * when he names one.
 *
 * ═══ THE STORE ═════════════════════════════════════════════════════════════════════════════
 * A module singleton published through `useSyncExternalStore`, the shape `rules.ts`, `grants.ts`
 * and `incoming.ts` already keep, for the reason they keep it: any file reads it, every reader
 * re-renders on one write, and no provider has to be mounted above them. When Row 0 lands, the
 * truth moves to the server policy and the UI stays a renderer of it either way.
 */
import * as React from 'react';
import { clockAfter } from './day';

/** WHICH PAPER GOES. Both are organs the app already draws — a briefing is a paper somebody would
 *  otherwise walk to the printer for, sent instead. */
export type BriefingBody = 'day' | 'packing';

export const BRIEFING_BODIES: Array<{ value: BriefingBody; label: string; sub: string }> = [
  { value: 'day', label: 'The day’s sheet', sub: 'Every stop in the order it is delivered, with the goods under it.' },
  { value: 'packing', label: 'The packing lists', sub: 'One list per stop, the way the bay picks it.' },
];

export type Briefing = {
  version: number;
  body: BriefingBody;
  /** the hour it goes, «06:30» */
  at: string;
  /** the members it reaches, by id */
  to: string[];
  /** the house's own hour and owner have been planted (the `seedRules` law) */
  seeded: boolean;
};

export const BRIEFING_VERSION = 1;

export const BRIEFING_DEFAULTS: Briefing = {
  version: BRIEFING_VERSION,
  body: 'day',
  at: '06:00',
  to: [],
  seeded: false,
};

export const BRIEFING_STORAGE_KEY = 'rocoto-app-briefing';

/** THE THREE HOURS A HOUSE PICKS FROM, off its OWN opening hour rather than off a list somebody
 *  liked: before the doors open, as they open, and once the round is out. A briefing that arrived
 *  at an hour nobody in that house is standing up would be a scheduled output nobody reads. */
export const briefingHours = (hour: string): string[] =>
  [clockAfter(hour, -60), hour, clockAfter(hour, 120)];

/** «The day's sheet» · «The packing lists» */
export const bodyWords = (b: BriefingBody): string =>
  BRIEFING_BODIES.find((x) => x.value === b)?.label ?? BRIEFING_BODIES[0].label;

/** The whole row, in one line: what · at what hour · to whom. An empty roster says what to do
 *  next, the way every other unanswered value in this app does.
 *
 *  FIRST NAMES, BECAUSE THE ROW HAS TO FIT A PHONE (§77.2, read off the 390 shot). «The day's
 *  sheet · 05:00 · Roser Vilalta» took 58% of a 390px row and left the label to break into three
 *  lines — «The / day's / briefing». The house's own people are first-name people on every other
 *  surface in this app (the handover chip, the stage's caption), so the row says what they say. */
export function briefingWords(b: Briefing, names: string[]): string {
  const first = names.map((n) => n.trim().split(/\s+/)[0]);
  const who = first.length === 0
    ? 'Pick who it goes to'
    : first.length <= 2
      ? first.join(' and ')
      : `${first.slice(0, 2).join(', ')} and ${first.length - 2} more`;
  return `${bodyWords(b.body)} · ${b.at} · ${who}`;
}

function parse(raw: unknown): Briefing {
  if (!raw || typeof raw !== 'object') return BRIEFING_DEFAULTS;
  const r = raw as Record<string, unknown>;
  if (r.version !== BRIEFING_VERSION) return BRIEFING_DEFAULTS;
  return {
    version: BRIEFING_VERSION,
    body: r.body === 'packing' ? 'packing' : 'day',
    at: typeof r.at === 'string' && /^\d{2}:\d{2}$/.test(r.at) ? r.at : BRIEFING_DEFAULTS.at,
    to: Array.isArray(r.to) ? r.to.filter((t): t is string => typeof t === 'string') : [],
    seeded: r.seeded === true,
  };
}

export const briefingStorageKey = (scope: string): string => `${BRIEFING_STORAGE_KEY}:${scope || 'default'}`;

function activeScope(): string {
  if (typeof window === 'undefined') return 'default';
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem('rocoto-app-config') ?? 'null');
    if (raw && typeof raw === 'object') {
      const cast = (raw as Record<string, unknown>).cast;
      if (typeof cast === 'string' && cast.trim()) return cast.trim();
    }
  } catch { /* unreadable selection never crosses a tenant key */ }
  return 'fish';
}

function read(scope: string): Briefing {
  try {
    const key = briefingStorageKey(scope);
    const scoped = window.localStorage.getItem(key);
    if (scoped) return parse(JSON.parse(scoped));
    const legacy = window.localStorage.getItem(BRIEFING_STORAGE_KEY);
    if (legacy) {
      const value = parse(JSON.parse(legacy));
      window.localStorage.setItem(key, JSON.stringify(value));
      window.localStorage.removeItem(BRIEFING_STORAGE_KEY);
      return value;
    }
    return BRIEFING_DEFAULTS;
  } catch {
    return BRIEFING_DEFAULTS;
  }
}

let currentScope = typeof window === 'undefined' ? 'default' : activeScope();
let BRIEFING: Briefing = typeof window === 'undefined' ? BRIEFING_DEFAULTS : read(currentScope);
let saveError = '';
const listeners = new Set<() => void>();

function ensureScope(scope: string = activeScope()): Briefing {
  if (scope !== currentScope) {
    currentScope = scope;
    BRIEFING = typeof window === 'undefined' ? BRIEFING_DEFAULTS : read(scope);
  }
  return BRIEFING;
}

function publish(next: Briefing, scope: string = activeScope()): boolean {
  ensureScope(scope);
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(briefingStorageKey(scope), JSON.stringify(next));
    }
  } catch {
    saveError = 'Saving this briefing stalled in this browser. Keep the editor open and try again.';
    for (const l of listeners) l();
    return false;
  }
  BRIEFING = next;
  saveError = '';
  for (const l of listeners) l();
  return true;
}

const subscribe = (l: () => void): (() => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    const prefix = `${BRIEFING_STORAGE_KEY}:`;
    if (!event.key?.startsWith(prefix) || event.newValue === null) return;
    const scope = event.key.slice(prefix.length);
    if (!scope || scope !== activeScope()) return;
    try {
      currentScope = scope;
      BRIEFING = parse(JSON.parse(event.newValue));
      for (const listener of listeners) listener();
    } catch { /* an incomplete other-tab write changes nothing */ }
  });
}

export const briefingNow = (scope: string = activeScope()): Briefing => ensureScope(scope);
const snapshot = (): Briefing => briefingNow();
export const useBriefing = (): Briefing =>
  React.useSyncExternalStore(subscribe, snapshot, () => BRIEFING_DEFAULTS);
export const useBriefingSaveError = (): string =>
  React.useSyncExternalStore(subscribe, () => saveError, () => '');

export function setBriefing(patch: Partial<Briefing>): boolean {
  ensureScope();
  return publish({ ...BRIEFING, ...patch });
}

/** ONE PERSON ON OR OFF THE BRIEFING. A house adds itself to a list; it never fills a form. */
export function toggleBriefingTo(id: string): boolean {
  ensureScope();
  const to = BRIEFING.to.includes(id) ? BRIEFING.to.filter((t) => t !== id) : [...BRIEFING.to, id];
  return publish({ ...BRIEFING, to });
}

/** Plant a useful plan once. It remains prepared only; no browser state authorizes delivery. */
export function seedBriefing(a: { at: string; to: string[] }): boolean {
  ensureScope();
  if (BRIEFING.seeded) return true;
  return publish({ ...BRIEFING, at: a.at, to: a.to, seeded: true });
}

export function resetBriefing(scope: string = activeScope()): boolean {
  ensureScope(scope);
  return publish(BRIEFING_DEFAULTS, scope);
}
