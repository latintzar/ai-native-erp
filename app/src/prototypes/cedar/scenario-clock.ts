/** Cedar's synthetic world follows the workspace's own calendar for the lifetime of one page load.
 *
 * A boot snapshot keeps every store and memoized fixture on one day if midnight passes while the
 * operator is working. Reloading Cedar advances the whole synthetic world together. Provider and
 * user-action timestamps remain their recorded instants and never pass through this module.
 *
 * ═══ ONE CLOCK (FEED-IA §247.8, «one Prep clock in the workspace's timezone») ════════════════
 * The day a screen names and the hour a screen shows are one reading of one instant in ONE zone,
 * and that zone is the workspace's own. `prepClockOf` returns the pair — `{ dayId, hhmm }` — so a
 * surface that counts minutes to a delivery slot counts them from the same day it prints on the
 * card. `cedarTodayId` is that same reading with the hour dropped, which is what makes the two
 * agree at every hour of the day, in every browser zone.
 *
 * ═══ THE ZONE FOLLOWS THE COUNTRY (lead decision, 13 September 2026) ═════════════════════════
 * Peru reads `America/Lima`; Spain reads `Europe/Madrid`. The market a house selects in Settings
 * is the market whose wall clock it keeps, so a Spanish workspace at half past midnight in Madrid
 * reads «00:30» and names Madrid's day — the demo Peter gives in Spain shows the hour on his own
 * wall. The country is read from `workspace-capabilities.ts` ONCE, here, at module load: that is
 * the same boot snapshot every fixture day already stands on, and the Country control in Settings
 * reloads the page once the market saves (`areas/admin/app-settings.tsx`), so a market switch
 * re-dates the retained book on a fresh page load, the way it changes the currency.
 *
 * Fiscal and commercial dates keep Peru's calendar wherever the market stands: `peruDate` in
 * `money-model.ts` reads SUNAT's own zone directly and stays there. The rule is written out in
 * `PRINT-WORKFLOW.md` under «Clock, release and navigation boundaries».
 */
import { workspaceCapabilitiesNow, type WorkspaceCountry } from './workspace-capabilities';

const PERU_TIME_ZONE = 'America/Lima';
const SPAIN_TIME_ZONE = 'Europe/Madrid';
const FIXTURE_DAY = '2025-08-22';
const BOOT_NOW = new Date();

/** The market's own zone. It is pure, so `app/tools/test-prep-clock.mjs` holds both markets. */
export const workspaceZoneOf = (country: WorkspaceCountry): string =>
  country === 'spain' ? SPAIN_TIME_ZONE : PERU_TIME_ZONE;

/** The zone every Cedar day and every Cedar hour is read in, taken once at boot. */
export const WORKSPACE_TIME_ZONE = workspaceZoneOf(workspaceCapabilitiesNow().country);

const WORKSPACE_CLOCK = Object.freeze({ timeZone: WORKSPACE_TIME_ZONE });

/** The workspace's own clock: the one zone its day, its delivery slots and its hours are read in. */
export function workspaceClock(): { readonly timeZone: string } {
  return WORKSPACE_CLOCK;
}

/** One instant, read in one zone: the calendar day it falls on and the wall clock it shows. */
export type PrepClock = { dayId: string; hhmm: string };

/* A formatter per zone. `cedarTodayId` is read on every fixture day, every feed day and every
   render that asks what today is, and `Intl.DateTimeFormat` is the expensive half of that. */
const FORMATTERS = new Map<string, Intl.DateTimeFormat>();

const formatterFor = (zone: string): Intl.DateTimeFormat => {
  const held = FORMATTERS.get(zone);
  if (held) return held;
  const made = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  FORMATTERS.set(zone, made);
  return made;
};

const partsOf = (instant: Date, zone: string): Record<string, string> => Object.fromEntries(
  formatterFor(zone).formatToParts(instant).map((part) => [part.type, part.value]),
);

/** THE PAIR A SURFACE READS THE HOUR FROM: the day and the wall clock of one instant, one zone.
 *
 *  `hourCycle: 'h23'` is what makes Lima's midnight «00:00» rather than «24:00», so a countdown
 *  measured against it lands on the day the card names. */
export function prepClockOf(instant: Date, zone: string = WORKSPACE_TIME_ZONE): PrepClock {
  const parts = partsOf(instant, zone);
  return { dayId: `${parts.year}-${parts.month}-${parts.day}`, hhmm: `${parts.hour}:${parts.minute}` };
}

/** The workspace's calendar day containing an instant. The default is deliberately boot-stable.
 *
 *  `zone` exists so the pure arithmetic can be held to both markets at once in a tool test; every
 *  caller in the app takes the default, which is the boot reading of the workspace's own zone. */
export function cedarTodayId(now: Date = BOOT_NOW, zone: string = WORKSPACE_TIME_ZONE): string {
  return prepClockOf(now, zone).dayId;
}

/** Anchor relative language in a live source to the workspace day that source occurred on. */
export function sourceReferenceDay(occurredAt: string | undefined, fallback = cedarTodayId()): string {
  if (!occurredAt) return fallback;
  const instant = new Date(occurredAt);
  return Number.isFinite(instant.getTime()) ? cedarTodayId(instant) : fallback;
}

/** A local-noon Date carrying a calendar id, safe from timezone and DST midnight shifts. */
export function cedarDayFromId(id: string): Date {
  const [year, month, day] = id.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1, 12);
}

/** «07:30» → 450. The minute of the day a slot or a wall clock names. */
export const clockMinutesOf = (value: string): number => {
  const [hour, minute] = value.match(/\d{1,2}:\d{2}/)?.[0].split(':').map(Number) ?? [0, 0];
  return hour * 60 + minute;
};

/** HOW LONG UNTIL A DELIVERY SLOT, MEASURED FROM ONE CLOCK (FEED-IA §247.8).
 *
 *  Both ends are read against `clock.dayId`, so the countdown a screen prints and the day label
 *  beside it are the same instant's two halves. Passing the seeded day with a browser-zone wall
 *  clock is what let «Sunday 13.09 · 07:00» stand over «Next batch in 6h 30m» at half past
 *  midnight in Madrid, where that slot had gone ten and a half hours earlier. */
export function minutesUntilSlot(day: string, slot: string, clock: PrepClock): number {
  const days = Math.round(
    (cedarDayFromId(day).getTime() - cedarDayFromId(clock.dayId).getTime()) / 86_400_000,
  );
  return days * 1_440 + clockMinutesOf(slot) - clockMinutesOf(clock.hhmm);
}

export function shiftCalendarId(id: string, days: number): string {
  const date = new Date(`${id}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function fixtureDayOffset(day: string): number {
  return Math.round((Date.parse(`${day}T12:00:00Z`) - Date.parse(`${FIXTURE_DAY}T12:00:00Z`)) / 86_400_000);
}

/** Shift a synthetic fixture date onto Cedar's current workspace day, preserving its offset. */
export function relativeFixtureDay(day: string, now: Date = BOOT_NOW): string {
  return shiftCalendarId(cedarTodayId(now), fixtureDayOffset(day));
}

/** Shift a retained fixture instant by calendar days, preserving its clock and UTC offset. */
export function relativeFixtureInstant(value: string, now: Date = BOOT_NOW): string {
  const match = /^(\d{4}-\d{2}-\d{2})(T.*)$/.exec(value);
  return match ? `${relativeFixtureDay(match[1], now)}${match[2]}` : value;
}

/** Convert the fixture's trade-form dd.mm into the same relative calendar position. */
export function relativeTradeDay(value: string, now: Date = BOOT_NOW): string {
  const match = /^(\d{2})\.(\d{2})$/.exec(value.trim());
  if (!match) return value;
  const shifted = relativeFixtureDay(`2025-${match[2]}-${match[1]}`, now);
  return `${shifted.slice(8, 10)}.${shifted.slice(5, 7)}`;
}

/** Shift trade-form dates embedded in retained synthetic prose, leaving lot numbers and times. */
export function relativeTradeText(value: string, now: Date = BOOT_NOW): string {
  return value.replace(/\b([0-3]\d\.[01]\d)\b/g, day => relativeTradeDay(day, now));
}

export const cedarClock = Object.freeze({
  timeZone: WORKSPACE_TIME_ZONE,
  fixtureDay: FIXTURE_DAY,
  bootInstant: BOOT_NOW.toISOString(),
});
