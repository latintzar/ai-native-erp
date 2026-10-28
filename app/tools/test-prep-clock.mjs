/* Cedar's one clock — the day a surface names and the hour it shows, read from one instant.
 *
 * FEED-IA §247.8, selected work item: one Prep clock in the workspace's timezone.
 *
 * THE DEFECT THIS SUITE HOLDS. Prep printed `todayId(cast)` — the workspace's Peru day — beside a
 * wall clock read with `new Date().toLocaleTimeString(…)`, the BROWSER's zone. For every hour
 * where Lima and the browser stand on different dates the card named one day and the countdown
 * counted from another: at 00:30 in Madrid the label said «Sunday 13.09 · 07:00» over «Next batch
 * in 6h 30m», while Lima's 13.09 07:00 had passed ten and a half hours earlier.
 *
 * `scenario-clock.ts` answers both halves from one reading: `prepClockOf(instant, zone)` returns
 * `{ dayId, hhmm }` and `minutesUntilSlot(day, slot, clock)` counts from that pair's own day.
 *
 * AND THE SECOND DEFECT, THE MARKET HALF (lead decision, 13 September 2026). That one reading was
 * pinned to `America/Lima` for every workspace, so a Spanish house at half past midnight in Madrid
 * read «17:30 now» and named Lima's 13 September — seven hours and a calendar day from the clock
 * on the wall in front of it, which is the demo Peter gives. `workspaceZoneOf(country)` is the
 * rule now: Peru reads Lima, Spain reads Madrid, and `cedarTodayId` follows it too.
 *
 * Run: node tools/test-prep-clock.mjs
 */
import strict from 'node:assert/strict';

/* THE COUNT THIS FILE PRINTS IS THE COUNT IT RAN, the way `test-print-measures.mjs` does it. */
let checks = 0;
const counted = (name) => (...args) => { checks += 1; return strict[name](...args); };
const assert = {
  equal: counted('equal'),
  notEqual: counted('notEqual'),
  deepEqual: counted('deepEqual'),
  ok: counted('ok'),
};
import { loadTypeScript } from './ts-module.mjs';

const {
  WORKSPACE_TIME_ZONE, cedarTodayId, clockMinutesOf, minutesUntilSlot, prepClockOf, workspaceClock,
  workspaceZoneOf,
} = loadTypeScript('src/prototypes/cedar/scenario-clock.ts', 'cedar-prep-clock');

/* ── ONE ZONE, AND THE MARKET CHOOSES IT ──────────────────────────────────────────────────── */

/* THE ZONE FOLLOWS THE COUNTRY (lead decision, 13 September 2026). `workspaceZoneOf` is the whole
   rule and it is pure, so both markets are held here at once. Peter demos Cedar in Spain: a
   Spanish house at half past midnight in Madrid reads Madrid's hour and names Madrid's day. */
assert.equal(workspaceZoneOf('peru'), 'America/Lima');
assert.equal(workspaceZoneOf('spain'), 'Europe/Madrid');

/* THE BOOT READING IS THAT RULE APPLIED TO THE STORED COUNTRY. Node holds no window, so
   `workspaceCapabilitiesNow()` hands back its own defaults — country `peru` — and every assertion
   below is measured against Lima. The drive proves the stored-country half in a browser. */
assert.equal(workspaceClock().timeZone, 'America/Lima',
  'a Peru workspace reads the zone its cast is dated in');
assert.equal(WORKSPACE_TIME_ZONE, 'America/Lima');
assert.equal(workspaceClock(), workspaceClock(), 'the clock is one frozen reading, handed out again');

/* ── THE INSTANTS THAT STRADDLE MIDNIGHT ──────────────────────────────────────────────────── */

/** 00:30 on 14 September in Madrid · 17:30 on the 13th in Lima · 22:30 on the 13th in UTC. */
const MADRID_MIDNIGHT = new Date('2026-09-13T22:30:00Z');
/** 06:30 on the 14th in Madrid · 04:30 on the 14th in UTC · 23:30 on the 13th in Lima. */
const LIMA_LATE = new Date('2026-09-14T04:30:00Z');

assert.deepEqual(prepClockOf(MADRID_MIDNIGHT, 'Europe/Madrid'), { dayId: '2026-09-14', hhmm: '00:30' });
assert.deepEqual(prepClockOf(MADRID_MIDNIGHT, 'America/Lima'), { dayId: '2026-09-13', hhmm: '17:30' });
assert.deepEqual(prepClockOf(MADRID_MIDNIGHT, 'UTC'), { dayId: '2026-09-13', hhmm: '22:30' });

assert.deepEqual(prepClockOf(LIMA_LATE, 'Europe/Madrid'), { dayId: '2026-09-14', hhmm: '06:30' });
assert.deepEqual(prepClockOf(LIMA_LATE, 'America/Lima'), { dayId: '2026-09-13', hhmm: '23:30' });
assert.deepEqual(prepClockOf(LIMA_LATE, 'UTC'), { dayId: '2026-09-14', hhmm: '04:30' });

/* LIMA'S OWN MIDNIGHT READS «00:00», which is what `hourCycle: 'h23'` buys: `hour12: false` on
   some ICU builds hands back «24:00», and a countdown measured against 1,440 minutes lands a whole
   day out on the one minute of the day it matters most. */
assert.deepEqual(prepClockOf(new Date('2026-09-13T05:00:00Z'), 'America/Lima'),
  { dayId: '2026-09-13', hhmm: '00:00' });
assert.deepEqual(prepClockOf(new Date('2026-09-14T04:59:00Z'), 'America/Lima'),
  { dayId: '2026-09-13', hhmm: '23:59' });
assert.deepEqual(prepClockOf(new Date('2026-09-14T05:00:00Z'), 'America/Lima'),
  { dayId: '2026-09-14', hhmm: '00:00' });
assert.deepEqual(prepClockOf(new Date('2026-09-14T00:00:00Z'), 'UTC'),
  { dayId: '2026-09-14', hhmm: '00:00' });

/* THE DEFAULT IS THE WORKSPACE'S OWN ZONE, so a caller that names nothing still reads one clock. */
for (const instant of [MADRID_MIDNIGHT, LIMA_LATE]) {
  assert.deepEqual(prepClockOf(instant), prepClockOf(instant, WORKSPACE_TIME_ZONE));
  /* AND THE SEEDED DAY IS THAT SAME READING WITH THE HOUR DROPPED. `cedarTodayId` dates the whole
     retained book; the wall clock beside it has to come off the same formatter or the two drift
     for the hours between the zones. */
  assert.equal(cedarTodayId(instant), prepClockOf(instant).dayId);
}

/* A SUMMER INSTANT AND A WINTER ONE, because Madrid moves and Lima has stood at UTC−5 since 1994. */
assert.deepEqual(prepClockOf(new Date('2026-01-15T23:30:00Z'), 'Europe/Madrid'),
  { dayId: '2026-01-16', hhmm: '00:30' });
assert.deepEqual(prepClockOf(new Date('2026-01-15T23:30:00Z'), 'America/Lima'),
  { dayId: '2026-01-15', hhmm: '18:30' });

/* ── THE SAME INSTANT, READ BY EACH MARKET ────────────────────────────────────────────────── */

/* THE SPAIN DEMO AS ARITHMETIC. At 22:30Z on the 13th a Spanish house stands on the 14th at 00:30
   and a Peruvian one on the 13th at 17:30. `cedarTodayId` dates the whole retained book, so it
   follows the market too, and the countdown comes off the same pair the card prints. */
for (const [country, zone, dayId, hhmm, untilHalfPastSeven] of [
  ['spain', 'Europe/Madrid', '2026-09-14', '00:30', 420],
  ['peru', 'America/Lima', '2026-09-13', '17:30', -600],
]) {
  assert.equal(workspaceZoneOf(country), zone, `${country} reads ${zone}`);
  const clock = prepClockOf(MADRID_MIDNIGHT, workspaceZoneOf(country));
  assert.deepEqual(clock, { dayId, hhmm }, `${country} reads this instant as its own day and hour`);
  assert.equal(cedarTodayId(MADRID_MIDNIGHT, workspaceZoneOf(country)), dayId,
    `the seeded day follows the ${country} market`);
  assert.equal(minutesUntilSlot(dayId, '07:30', clock), untilHalfPastSeven,
    `${country} counts its own day's 07:30 from its own hour`);
}

/* AND THE TWO MARKETS READ ONE INSTANT AS TWO DIFFERENT HOURS, which is why the toggle has to
   move the clock: a Spanish workspace reading Lima's 17:30 at midnight in Madrid is the demo
   failing in front of the person it is for. */
assert.notEqual(prepClockOf(MADRID_MIDNIGHT, workspaceZoneOf('spain')).hhmm,
  prepClockOf(MADRID_MIDNIGHT, workspaceZoneOf('peru')).hhmm);
assert.notEqual(cedarTodayId(MADRID_MIDNIGHT, workspaceZoneOf('spain')),
  cedarTodayId(MADRID_MIDNIGHT, workspaceZoneOf('peru')));

/* MADRID MOVES AND LIMA STANDS STILL, so the Spanish reading is pinned on both sides of the
   European change: CEST in September, CET in January. */
assert.deepEqual(prepClockOf(new Date('2026-09-13T22:30:00Z'), workspaceZoneOf('spain')),
  { dayId: '2026-09-14', hhmm: '00:30' });
assert.deepEqual(prepClockOf(new Date('2026-01-15T23:30:00Z'), workspaceZoneOf('spain')),
  { dayId: '2026-01-16', hhmm: '00:30' });

/* ── «07:30» IS 450 MINUTES ──────────────────────────────────────────────────────────────── */

assert.equal(clockMinutesOf('00:00'), 0);
assert.equal(clockMinutesOf('07:30'), 450);
assert.equal(clockMinutesOf('23:59'), 1439);
assert.equal(clockMinutesOf('10:15'), 615);
/* A SLOT CAN CARRY WORDS AROUND ITS HOUR — `slotOf` hands back whatever the cast wrote. */
assert.equal(clockMinutesOf('by 08:00'), 480);
assert.equal(clockMinutesOf('soon'), 0, 'an hourless slot counts from the top of the day');

/* ── THE DEFECT, STATED AS ARITHMETIC ─────────────────────────────────────────────────────── */

/* The pair Prep used to hold: the workspace's day with the BROWSER's hour. Same instant, same
   delivery, two answers 17 hours apart — which is exactly Madrid minus Lima. */
const mixed = { dayId: cedarTodayId(MADRID_MIDNIGHT), hhmm: prepClockOf(MADRID_MIDNIGHT, 'Europe/Madrid').hhmm };
const oneClock = prepClockOf(MADRID_MIDNIGHT);
assert.deepEqual(mixed, { dayId: '2026-09-13', hhmm: '00:30' });
assert.equal(minutesUntilSlot('2026-09-13', '07:00', mixed), 390,
  'the mixed pair puts a passed slot six and a half hours ahead');
assert.equal(minutesUntilSlot('2026-09-13', '07:00', oneClock), -630,
  'one clock says the 13th’s 07:00 went ten and a half hours ago');
assert.equal(minutesUntilSlot('2026-09-13', '07:00', mixed) - minutesUntilSlot('2026-09-13', '07:00', oneClock),
  1020, 'the gap is the seven-hour zone offset carried by a whole day of minutes');

/* AND THE BATCH THE ONE CLOCK LANDS ON is the next day's first slot, counted from Lima's 17:30. */
assert.equal(minutesUntilSlot('2026-09-14', '07:00', oneClock), 810, '13h 30m, and it names the 14th');

/* ── THE WORD «today» ON A RECORDED STAMP ─────────────────────────────────────────────────── */

/* `usedWhen` in `shell/printing.tsx` states «Printed 09:12 today» against the same reading. The
   press and the row that reports it are one house hour apart here; the browser's own zone puts a
   midnight between them, so the row used to drop to «13 Sep» while the card beside it still stood
   on the 13th. */
const PRESSED = new Date('2026-09-13T21:12:00Z');   // Madrid 23:12 on the 13th · Lima 16:12
const READ_BACK = new Date('2026-09-13T22:12:00Z'); // Madrid 00:12 on the 14th · Lima 17:12

assert.equal(prepClockOf(PRESSED).dayId, prepClockOf(READ_BACK).dayId,
  'on the house clock the press and the read-back are the same day, so the row says «today»');
assert.equal(prepClockOf(PRESSED).hhmm, '16:12', 'and the hour it states is the house hour');
assert.notEqual(prepClockOf(PRESSED, 'Europe/Madrid').dayId, prepClockOf(READ_BACK, 'Europe/Madrid').dayId,
  'the browser’s zone puts a midnight between the same two instants');

/* ── THE INVARIANT: THE PAIR IS ONE INSTANT, READ IN ONE ZONE ─────────────────────────────── */

/** The UTC offset a `{ dayId, hhmm }` pair CLAIMS for the instant it was read from.
 *
 *  A true reading claims its zone's own offset. The pair Prep used to draw claimed something no
 *  zone on earth stands at: Lima's date carrying Madrid's hour at 00:30 claims UTC−22. */
const claimedOffset = (instant, { dayId, hhmm }) => {
  const [year, month, day] = dayId.split('-').map(Number);
  const [hour, minute] = hhmm.split(':').map(Number);
  return (Date.UTC(year, month - 1, day, hour, minute) - instant.getTime()) / 60_000;
};

/** Each market's own offset at the instants walked below. Lima has stood at UTC−5 with no
 *  daylight saving since 1994; Madrid's +2 holds for all of them, since they fall on 13 September,
 *  inside CEST. A pair that claims anything else was read from two clocks. */
const MARKET_OFFSETS = [['peru', 'America/Lima', -300], ['spain', 'Europe/Madrid', 120]];

const dayDelta = (from, to) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);

/** What a drive reads off the card: the shown minute plus the countdown lands on the named slot. */
const landsOn = (day, slot, clock) =>
  clockMinutesOf(clock.hhmm) + minutesUntilSlot(day, slot, clock)
    === dayDelta(clock.dayId, day) * 1_440 + clockMinutesOf(slot);

assert.ok(landsOn('2026-09-14', '07:00', oneClock), 'the countdown lands on the day it names');
assert.ok(landsOn('2026-09-13', '17:30', oneClock));

const SLOTS = ['07:00', '10:30', '10:45'];
const BROWSER_ZONES = ['Europe/Madrid', 'America/Lima', 'UTC', 'Pacific/Auckland', 'Asia/Kolkata'];

/* EVERY HOUR OF THE DAY, IN EVERY BROWSER ZONE, IN BOTH MARKETS. The browser's zone drops out of
   the reading altogether — that is the whole of the fix — and the market's zone is the only thing
   that selects it. Where the browser's date differs from the workspace's, the pair the card used
   to draw is caught twice: it claims an hour offset no zone holds, and its countdown to a delivery
   disagrees with the truthful one. */
let hoursWalked = 0;
let mixedCaught = 0;
for (const [country, marketZone, marketOffset] of MARKET_OFFSETS) {
  assert.equal(workspaceZoneOf(country), marketZone);
  for (let hour = 0; hour < 24; hour += 1) {
    const instant = new Date(Date.UTC(2026, 8, 13, hour, 30));
    const workspace = prepClockOf(instant, marketZone);
    assert.equal(claimedOffset(instant, workspace), marketOffset,
      `${instant.toISOString()} · the shown pair is this instant in ${marketZone}`);
    for (const zone of BROWSER_ZONES) {
      const browser = prepClockOf(instant, zone);
      /* The clock the surface shows is the market's, whatever the browser is set to. */
      assert.deepEqual(prepClockOf(instant, marketZone), workspace,
        `${zone} leaves the ${country} reading alone`);
      if (browser.dayId === workspace.dayId) continue;
      const mixed = { dayId: workspace.dayId, hhmm: browser.hhmm };
      assert.notEqual(claimedOffset(instant, mixed), marketOffset,
        `${zone} ${instant.toISOString()} · the mixed pair was never this instant here`);
      for (const slot of SLOTS) {
        assert.notEqual(minutesUntilSlot('2026-09-14', slot, mixed), minutesUntilSlot('2026-09-14', slot, workspace),
          `${zone} ${instant.toISOString()} · the mixed pair counts a different ${slot}`);
      }
      mixedCaught += 1;
    }
    hoursWalked += 1;
  }
}
assert.equal(hoursWalked, 48, 'the walk covered every hour of the day in both markets');
assert.ok(mixedCaught >= 48, `the walk met the two-day state ${mixedCaught} times`);

/* ── THE SAME MINUTE, A PASSED SLOT, AND A MID-SESSION MIDNIGHT ───────────────────────────── */

assert.equal(minutesUntilSlot('2026-09-13', '17:30', oneClock), 0, 'the slot standing on this minute is due now');
assert.ok(minutesUntilSlot('2026-09-13', '17:29', oneClock) < 0, 'a slot one minute past leaves the queue');
assert.equal(minutesUntilSlot('2026-09-13', '17:31', oneClock), 1);

/* MIDNIGHT PASSING WHILE PREP IS OPEN. The cast keeps its boot day — that is the boot snapshot —
   and the countdown follows the clock's own day, so the card names the 14th and counts to it. */
const rolled = { dayId: '2026-09-14', hhmm: '00:05' };
assert.equal(minutesUntilSlot('2026-09-14', '07:00', rolled), 415);
assert.ok(minutesUntilSlot('2026-09-13', '23:00', rolled) < 0,
  'the day that just ended leaves the queue the minute the clock turns');
assert.ok(landsOn('2026-09-14', '07:00', rolled));

/* ── THE DAY ARITHMETIC IS NOON-ANCHORED, so a span across any DST edge stays whole days ──── */

assert.equal(minutesUntilSlot('2026-11-01', '07:00', { dayId: '2026-03-01', hhmm: '07:00' }), 245 * 1_440);
assert.equal(minutesUntilSlot('2026-03-01', '07:00', { dayId: '2026-11-01', hhmm: '07:00' }), -245 * 1_440);
assert.equal(minutesUntilSlot('2027-01-01', '00:00', { dayId: '2026-12-31', hhmm: '23:59' }), 1);

console.log(`Cedar prep clock, one zone and the slot countdown: ${checks} checks passed`);
