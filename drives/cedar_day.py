#!/usr/bin/env python3
"""THE DAY CEDAR IS ACTUALLY ON — the Python mirror of `scenario-clock.ts`.

⚠ WHY THIS FILE EXISTS. Cedar's synthetic world follows THE WORKSPACE'S OWN CALENDAR for the
lifetime of one page load: `app/src/prototypes/cedar/scenario-clock.ts` takes a boot snapshot of the
current day in that workspace's zone and shifts the whole retained book onto it, so the river a
drive opens today holds today's days rather than the fixture's own. That shift arrived on
10 September 2026 (`a61b78d6`, `relativeFixtureDay`); before it the book was dated literally and
`day-packing-2025-08-25-paper` was a real control, which is why three public-proof suites —
`parsing-qr`, `paper-manifest` and `qr-library` — went from green to a timeout with ZERO assertions
taken without one line of their own changing. A drive that writes `2025-08-25` into a selector is
stale BY CONSTRUCTION from that commit onward, and each of those suites died at its own first
`wait_for`.

WHAT IS MIRRORED, AND FROM WHERE. Four functions, one per rule, each the exact arithmetic of the
TypeScript beside it (`app/src/prototypes/cedar/scenario-clock.ts`):

  `workspace_zone_of()`   ← `workspaceZoneOf()`   · the market's own zone
  `cedar_today_id()`      ← `cedarTodayId()`      · the workspace calendar day, `YYYY-MM-DD`
  `fixture_day_offset()`  ← `fixtureDayOffset()`  · a fixture day's distance from `FIXTURE_DAY`
  `relative_fixture_day()`← `relativeFixtureDay()`· that fixture day, landed on today's calendar

⚠ THE ZONE FOLLOWS THE COUNTRY (mirrored 2026-09-14, from that day's `scenario-clock.ts`). Peru
reads `America/Lima`, Spain reads `Europe/Madrid`, and the market is read from
`workspace-capabilities.ts` ONCE at module load — `WORKSPACE_TIME_ZONE =
workspaceZoneOf(workspaceCapabilitiesNow().country)`. Python stands outside the browser and can see
no localStorage, so THE DEFAULT HERE IS THE SHIPPED DEFAULT COUNTRY: both capability tables ship
`country: 'peru'` (`workspace-capabilities.ts:31,40`), a drive that clears localStorage gets it, and
`America/Lima` is therefore the day every drive in this key reads. `drive-198-parsing-qr.py` writes
the capability object out in full and names `country: 'peru'` in it, so it reads the same day for
the same reason rather than by luck. A DRIVE THAT SEEDS A SPANISH HOUSE MUST SAY SO:
`relative_fixture_day(day, zone=workspace_zone_of('spain'))`. Passing nothing is Peru, always.

THE CUT-OVER RULE, STATED, AND IT IS THE ZONE'S OWN. There is no hour rule beyond the zone itself:
the id is the instant formatted `en-CA` through `Intl.DateTimeFormat`, so the day rolls at 00:00 on
that market's wall clock and nowhere else. America/Lima has been a flat UTC−5 with no daylight
saving since 1994, so on this box (UTC) the Peru day is the UTC day from 05:00 UTC onward and the
UTC day MINUS ONE before it. Europe/Madrid keeps daylight saving, so a Spanish house rolls at
22:00 UTC in summer (CEST, UTC+2) and 23:00 UTC in winter (CET, UTC+1). A drive started before its
own market's roll therefore reads the previous UTC date — which is what the browser beside it reads
too, because both take the same instant through the same zone.

AND THAT WAS CHECKED AGAINST THE TYPESCRIPT RATHER THAN REASONED ABOUT (re-run 2026-09-14 against
the zone-aware module). It was loaded through `app/tools/ts-module.mjs` and asked the same questions
this file was asked — the boot day, seven fixture offsets and their landed days (including a leap
day and a year boundary), six calendar walks, `cedarTodayId` at four named instants, and each
market's own roll in both directions. Every answer matched: `2026-09-13T04:59:59Z` reads
«2026-09-12» in Lima on both sides and `05:00:00Z` reads «2026-09-13» on both; `2026-09-13T21:59Z`
reads «2026-09-13» in Madrid on both and `22:00Z` reads «2026-09-14» on both. `prepClockOf`'s
`hourCycle: 'h23'` moves the HOUR only, so the day this file mirrors is the same day with the Prep
clock in front of it; the hour half is `drives/drive-cedar-prep-clock.py`'s claim, not this file's.

AND THE SNAPSHOT IS PER PROCESS, THE WAY THE APP'S IS PER PAGE LOAD. `BOOT_NOW` in the TypeScript is
captured once at module load so midnight passing mid-session cannot split a run across two days;
`_BOOT_NOW` here is captured the same way, for the same reason. Pass `now=` to ask about another
instant.

⚠ AND THAT IS THE ONE WAY A CORRECT MIRROR STILL MISSES (added 2026-09-14). The two snapshots are
taken at different moments: this module freezes its instant when the drive imports it, and each page
takes its own `new Date()` when it loads. A run that sits wholly on one side of the market's
midnight therefore agrees with every page it opens; a run that SPANS that instant computes
yesterday's id in Python while the browser draws today's. `fixture_day_miss` below turns that into a
sentence a drive can redden on, because the alternative is what this pass was cleaning up: a silent
20-second `wait_for` on a selector nothing will ever match, zero assertions taken, and a runner line
that reads «FAIL None».

USE IT LIKE THIS, from a drive:

    from cedar_day import fixture_day_miss, relative_fixture_day

    DAY = relative_fixture_day('2025-08-25')      # the day the fixture's 25 August landed on
    page.locator(f'[data-testid="day-packing-{DAY}"]')

    drawn = await page.evaluate(
        "() => [...document.querySelectorAll('[data-day-whisper]')].map((w) =>"
        " w.getAttribute('data-day-whisper'))")
    miss = fixture_day_miss('2025-08-25', drawn)
    check(not miss, 'the river drew the fixture day this run computed', miss)
"""
from __future__ import annotations

import datetime as _dt
import zoneinfo
from collections.abc import Iterable

# `scenario-clock.ts` · PERU_TIME_ZONE and SPAIN_TIME_ZONE
PERU_TIME_ZONE = 'America/Lima'
SPAIN_TIME_ZONE = 'Europe/Madrid'
# `workspace-capabilities.ts` · WORKSPACE_CAPABILITIES_DEFAULTS.country and its Kit twin
DEFAULT_WORKSPACE_COUNTRY = 'peru'
# `scenario-clock.ts` · FIXTURE_DAY — the base day the retained book was written against
FIXTURE_DAY = '2025-08-22'


def workspace_zone_of(country: str) -> str:
    """The market's own zone — `workspaceZoneOf()`. Anything that is not Spain is Peru, as there."""
    return SPAIN_TIME_ZONE if country == 'spain' else PERU_TIME_ZONE


# `scenario-clock.ts` · WORKSPACE_TIME_ZONE, taken at module load. There it reads the house's own
# saved country; here it is the country a fresh house ships with, because a drive that clears
# localStorage gets exactly that one. A Spanish-seeded drive passes `zone=` and says so out loud.
WORKSPACE_TIME_ZONE = workspace_zone_of(DEFAULT_WORKSPACE_COUNTRY)

_ZONES: dict[str, zoneinfo.ZoneInfo] = {}
# `scenario-clock.ts` · BOOT_NOW — one snapshot per process, so a run cannot straddle midnight
_BOOT_NOW = _dt.datetime.now(_dt.timezone.utc)
_DAY = _dt.timedelta(days=1)


def cedar_today_id(now: _dt.datetime | None = None, zone: str = WORKSPACE_TIME_ZONE) -> str:
    """The workspace's calendar day containing an instant, as `YYYY-MM-DD`.

    The exact answer `cedarTodayId()` gives the browser: the instant read through the workspace's
    own zone, formatted `en-CA`. Both defaults are deliberately stable — the instant is this
    process's boot snapshot, the zone is the one a fresh house ships with.
    """
    instant = _BOOT_NOW if now is None else now
    if instant.tzinfo is None:
        instant = instant.replace(tzinfo=_dt.timezone.utc)
    return instant.astimezone(_zone(zone)).strftime('%Y-%m-%d')


def cedar_day_id(offset_days: int, now: _dt.datetime | None = None,
                 zone: str = WORKSPACE_TIME_ZONE) -> str:
    """Today's workspace day, walked `offset_days` forward (or back, on a negative)."""
    return _shift_calendar_id(cedar_today_id(now, zone), offset_days)


def fixture_day_offset(day: str) -> int:
    """How many calendar days a fixture date stands from `FIXTURE_DAY` — `fixtureDayOffset()`.

    Both ends are read at noon UTC, which is what the TypeScript does, so a DST edge in any zone
    can never round the difference to the wrong day.
    """
    return round((_noon(day) - _noon(FIXTURE_DAY)) / _DAY)


def relative_fixture_day(day: str, now: _dt.datetime | None = None,
                         zone: str = WORKSPACE_TIME_ZONE) -> str:
    """A synthetic fixture date, landed on Cedar's current workspace day — `relativeFixtureDay()`.

    `relative_fixture_day('2025-08-25')` is the day the app draws where the fixture wrote
    25 August 2025: `FIXTURE_DAY` + 3 became today + 3.
    """
    return _shift_calendar_id(cedar_today_id(now, zone), fixture_day_offset(day))


def fixture_day_miss(day: str, drawn: Iterable[str | None],
                     zone: str = WORKSPACE_TIME_ZONE) -> str:
    """Empty when the day this process computed for `day` stands among the days a page drew.

    Otherwise the sentence a red should carry: the day that was asked for, the days that were
    actually drawn, the zone they were computed in, and — when that market's calendar has rolled
    since this module was imported — the fact that it rolled, with the id a live clock gives now.
    That last clause is the whole reason this function exists: a run may START before the market's
    midnight and reach its first `wait_for` after it, and no amount of correctness in the arithmetic
    above can make one frozen snapshot match two different calendar days. Naming it is what turns a
    20-second silence into a red that says why. The zone is named too, because the other way to miss
    is a house seeded into the other market while this module answers for Peru.
    """
    want = relative_fixture_day(day, zone=zone)
    days = [one for one in drawn if one]
    if want in days:
        return ''
    live = relative_fixture_day(day, now=_dt.datetime.now(_dt.timezone.utc), zone=zone)
    rolled = ('' if live == want
              else f', and the {zone} day rolled mid-run — a live clock reads {live}')
    return f'asked for {want} in {zone}, the river drew {days[:6] or "no days at all"}{rolled}'


def _zone(name: str) -> zoneinfo.ZoneInfo:
    """One `ZoneInfo` per zone, held — the mirror of the TypeScript's own formatter cache."""
    held = _ZONES.get(name)
    if held is None:
        held = _ZONES[name] = zoneinfo.ZoneInfo(name)
    return held


def _noon(day: str) -> _dt.datetime:
    """`Date.parse(`${day}T12:00:00Z`)`, as a datetime."""
    return _dt.datetime.strptime(day, '%Y-%m-%d').replace(hour=12, tzinfo=_dt.timezone.utc)


def _shift_calendar_id(day: str, days: int) -> str:
    """`shiftCalendarId()` — walk a calendar id by whole days at noon UTC, safe from every edge."""
    return (_noon(day) + _dt.timedelta(days=days)).strftime('%Y-%m-%d')


if __name__ == '__main__':
    print('the zone a fresh house keeps · ' + WORKSPACE_TIME_ZONE)
    print('that zone today              · ' + cedar_today_id())
    print('a Spanish house today        · '
          + cedar_today_id(zone=workspace_zone_of('spain')))
    print('a day that was drawn         · ' + (fixture_day_miss('2025-08-25',
                                                                [relative_fixture_day('2025-08-25')])
                                               or 'the river drew it'))
    print('a day that was absent        · ' + fixture_day_miss('2025-08-25', ['1999-01-01']))
    print('FIXTURE_DAY                  · ' + FIXTURE_DAY + ' → ' + relative_fixture_day(FIXTURE_DAY))
    for _fixture in ('2025-08-22', '2025-08-25', '2025-08-26'):
        print('%s (offset %+d) · %s' % (_fixture, fixture_day_offset(_fixture),
                                        relative_fixture_day(_fixture)))
