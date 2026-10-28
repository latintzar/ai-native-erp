#!/usr/bin/env python3
"""Cedar Prep — ONE CLOCK: the hour the card shows and the day it names are one reading.

FEED-IA §247.8, selected work item: one Prep clock in the workspace's timezone.

THE DEFECT, AS THE RELEASE RECORD STATES IT: «after midnight Madrid time the batch card's day
label follows the seeded workspace's Lima day while the countdown follows the browser's own clock,
so for a few hours the two can name different days». `shell/printing.tsx` read the day from
`todayId(cast)` — `scenario-clock.ts`'s America/Lima day, which dates the whole retained book — and
the hour from `new Date().toLocaleTimeString(…)`, the browser's own zone. At 00:30 in Madrid the
card said «Sunday 13.09 · 07:00» over «Next batch in 6h 30m» while Lima's 13.09 07:00 had gone ten
and a half hours earlier.

AND THE ZONE FOLLOWS THE COUNTRY (lead decision, 13 September 2026). Peru reads America/Lima;
Spain reads Europe/Madrid. Peter demos Cedar in Spain, so a Spanish workspace at half past midnight
in Madrid states «00:30 now» and names Madrid's day. The country is planted in the same
`rocoto-workspace-capabilities:fish` record `drive-cedar-country.py` writes, and
`scenario-clock.ts` reads it once at boot.

WHAT THIS DRIVE PINS. The workspace's market, the browser's zone and the instant are all three
fixed — the capability record for the market, `timezone_id` on the context, `clock.set_fixed_time`
for the instant — so the same walk is run for a Peruvian house and for a Spanish one, from Madrid,
from Lima and from UTC, at two instants that straddle a midnight. Every reading is arithmetic
rather than whatever hour the box happens to hold. Each walk asserts, off the DOM:

  · `prep-live-clock` states the WORKSPACE's own hour at that instant;
  · the pair the card shows — the seeded day with that hour — claims the workspace zone's own
    offset and no other, which is the formal way of saying it is one instant read in one zone;
  · THE MARKET CHOSE THAT ZONE: at every instant walked here Lima and Madrid hold different hours,
    so a Spanish workspace reading Lima's hour is caught by name;
  · `prep-batch-scope` names the first listed delivery's own day and slot;
  · `export-first-delivery` counts the minutes `minutesUntilSlot` counts from that same clock;
  · AND THE ONE-DAY LAW: the shown minute plus the countdown lands exactly on the day and slot the
    card names, with the shown hour's OWN day as the origin. This is the check the browser clock
    fails: its 00:30 belongs to the 14th while the label says the 13th.

Block `rolled` is the same law across a midnight that passes while Prep is open: the clock is
installed at Lima 23:50 and walked forward to 00:10, and the card has to follow the day it just
entered.

Block `stamp` carries the law one door further, into the library the Prep card opens: `usedWhen`
states a template's «Printed 09:12 today», and that hour and that «today» are the same reading.
Main's build filed a press made an hour and a quarter earlier as «Printed 13 Sept», because
Madrid had already entered the 14th while the card beside it still named the 13th.

RED FIRST, on the published build of `main` (`app/dist-export-review`, source 14157a5d):
  ROCOTO_DIST=app/dist-export-review ROCOTO_SHOTS=/tmp/cedar-prep-clock-red \\
    .venv/bin/python drives/drive-cedar-prep-clock.py
The `spain-` legs were red a second time, against the intermediate that read one clock and pinned
it to Lima for every market (this branch, 13 September evening, before `workspaceZoneOf`): a
Spanish workspace at 00:30 in Madrid still painted «17:30 now» over Lima's 13 September.
GREEN on this branch's build:
  ROCOTO_DIST=app/dist-prep-clock-zone .venv/bin/python drives/drive-cedar-prep-clock.py

Conventions (drives/README.md): `ROCOTO_DIST` names a built directory this drive serves itself on a
private loopback port; `ROCOTO_URL` names an `app.html` already served and overrides it;
`ROCOTO_SHOTS` selects the screenshot folder; `ROCOTO_ONLY` narrows the run to the named walks.
Every API request is aborted, so a run makes no provider call.
"""
from __future__ import annotations

import asyncio
import functools
import http.server
import json
import os
import pathlib
import re
import socketserver
import threading
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from playwright.async_api import BrowserContext, Page, async_playwright

DIST = os.environ.get("ROCOTO_DIST")
URL = os.environ.get("ROCOTO_URL")
ONLY = [name for name in os.environ.get("ROCOTO_ONLY", "").split(",") if name]
OUT = pathlib.Path(os.environ.get("ROCOTO_SHOTS", "/tmp/cedar-prep-clock"))
OUT.mkdir(parents=True, exist_ok=True)
GREEN: list[str] = []
RED: list[str] = []

# THE ZONE FOLLOWS THE COUNTRY — `scenario-clock.ts` · `workspaceZoneOf(country)`, read once at
# boot from `workspace-capabilities.ts`. Peru reads Lima, which has stood at UTC−5 with no daylight
# saving since 1994; Spain reads Madrid, which moves twice a year, so its offset is read from the
# zone at the walk's own instant rather than written down here.
MARKET_ZONES = {"peru": "America/Lima", "spain": "Europe/Madrid"}

# `output-templates.ts` · templatesKeyFor('fish'). The library writes its whole list on any change.
TEMPLATES_KEY = "rocoto:outputs:templates:fish"
# The press block `stamp` reports: Madrid 23:12 on the 13th · Lima 16:12 on the 13th. It stands an
# hour and eighteen minutes before `NIGHT`, which Madrid already files on the 14th.
PRESSED = datetime(2026, 9, 13, 21, 12, tzinfo=timezone.utc)
PRESSED_AT = "2026-09-13T21:12:00.000Z"

# The Spanish seed is `drive-cedar-country.py`'s own: euros with Money quiet (FEED-IA §247.9).
CAPABILITIES = {
    "peru": {"version": 1, "pricing": True, "inventory": False},
    "spain": {
        "version": 1, "pricing": True, "inventory": False, "money": False,
        "country": "spain", "moneyByCountry": {"peru": True, "spain": False},
    },
}


def boot(country: str) -> str:
    """The workspace this walk opens, planted before the app's first script runs."""
    stored = json.dumps(CAPABILITIES[country])
    return (
        "if (!sessionStorage.getItem('cedar-prep-clock')) {\n"
        "  sessionStorage.setItem('cedar-prep-clock', '1');\n"
        "  localStorage.clear();\n"
        "  localStorage.setItem('rocoto-app-front-door', 'months');\n"
        "  localStorage.setItem('rocoto-app-config',"
        " JSON.stringify({version:1, sector:['fish'], cast:'fish'}));\n"
        f"  localStorage.setItem('rocoto-workspace-capabilities:fish', {json.dumps(stored)});\n"
        "}\n"
        "window.print = () => { window.__printed = (window.__printed || 0) + 1; };\n"
    )


def workspace_zone(country: str) -> str:
    """`workspaceZoneOf(country)` — the market's own zone."""
    return MARKET_ZONES[country]


def zone_offset(instant: datetime, zone: str) -> int:
    """The minutes a zone stands from UTC at one instant, so Madrid's move is read rather than told."""
    offset = instant.astimezone(ZoneInfo(zone)).utcoffset()
    return round(offset.total_seconds() / 60) if offset else 0

# ── THE ARITHMETIC, MIRRORED FROM THE SOURCE IT ASSERTS ──────────────────────────────────────
# `app/src/prototypes/cedar/scenario-clock.ts` · prepClockOf · clockMinutesOf · minutesUntilSlot
# `app/src/prototypes/cedar/shell/printing.tsx` · countdownWords
# `app/src/prototypes/cedar/sale.ts` · dayLabelOf, whose WEEKDAYS start on Sunday the way
# `Date#getDay` does.
WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]


def prep_clock(instant: datetime, zone: str) -> tuple[str, str]:
    """`prepClockOf(instant, zone)` — the calendar day and the wall clock of one instant."""
    local = instant.astimezone(ZoneInfo(zone))
    return local.strftime("%Y-%m-%d"), local.strftime("%H:%M")


def clock_minutes(value: str) -> int:
    """`clockMinutesOf` — the minute of the day a slot or a wall clock names."""
    found = re.search(r"\d{1,2}:\d{2}", value)
    if found is None:
        return 0
    hour, minute = (int(part) for part in found.group(0).split(":"))
    return hour * 60 + minute


def _noon(day: str) -> datetime:
    return datetime.strptime(day, "%Y-%m-%d").replace(hour=12, tzinfo=timezone.utc)


def day_delta(start: str, end: str) -> int:
    """Whole calendar days between two ids, read at noon so a DST edge rounds to the right day."""
    return round((_noon(end) - _noon(start)) / timedelta(days=1))


def minutes_until_slot(day: str, slot: str, clock: tuple[str, str]) -> int:
    """`minutesUntilSlot(day, slot, clock)` — both ends read against the clock's own day."""
    return day_delta(clock[0], day) * 1_440 + clock_minutes(slot) - clock_minutes(clock[1])


def countdown_words(minutes: int) -> str:
    """`countdownWords` — it is read inside a sentence, so it starts like a sentence's middle."""
    if minutes <= 0:
        return "ready now"
    if minutes < 60:
        return f"in {minutes} min"
    hours, rest = divmod(minutes, 60)
    return f"in {hours}h" + (f" {rest}m" if rest else "")


def day_label(day: str) -> str:
    """`dayLabelFromId` — «Sunday 13.09»."""
    date = datetime.strptime(day, "%Y-%m-%d")
    return f"{WEEKDAYS[date.isoweekday() % 7]} {date.day:02d}.{date.month:02d}"


def claimed_offset(instant: datetime, day: str, hhmm: str) -> int:
    """The UTC offset a `{day, hh:mm}` pair CLAIMS for the instant it was read from.

    A true reading claims its zone's own offset. The pair Prep used to draw claimed one no zone on
    earth stands at: Lima's date carrying Madrid's hour at half past midnight claims UTC−22.
    """
    named = datetime.strptime(f"{day} {hhmm}", "%Y-%m-%d %H:%M").replace(tzinfo=timezone.utc)
    return round((named - instant) / timedelta(minutes=1))


def check(ok: bool, name: str, detail: str = "") -> None:
    (GREEN if ok else RED).append(name)
    print(("GREEN " if ok else "RED ") + name + ((" · " + detail) if detail else ""), flush=True)


def serve(directory: str) -> tuple[socketserver.TCPServer, str]:
    handler = functools.partial(
        type("Quiet", (http.server.SimpleHTTPRequestHandler,), {"log_message": lambda *args: None}),
        directory=directory,
    )
    server = socketserver.TCPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, f"http://127.0.0.1:{server.server_address[1]}/app.html"


async def open_prep(page: Page, url: str) -> None:
    await page.goto(url + "#/sales", wait_until="domcontentloaded")
    await page.locator("[data-testid=river]").wait_for(timeout=25_000)
    await page.locator("[data-testid=export-centre]").click()
    await page.locator("[data-testid=export-batch-hub]").wait_for(timeout=25_000)
    await page.wait_for_timeout(500)


async def read_card(page: Page) -> dict[str, str]:
    """The three sentences the card states, plus the first listed delivery's own day and slot."""
    rows = page.locator("[data-testid=export-delivery-timeline] > [role=button]")
    first = rows.first
    return {
        "rows": str(await rows.count()),
        "clock": " ".join((await page.locator("[data-testid=prep-live-clock]").inner_text()).split()),
        "countdown": " ".join((await page.locator("[data-testid=export-first-delivery]").inner_text()).split()),
        "scope": " ".join((await page.locator("[data-testid=prep-batch-scope]").inner_text()).split()),
        "row_day": await first.get_attribute("data-prep-day") or "",
        "row_slot": await first.get_attribute("data-prep-time") or "",
        "batch": await page.locator("[data-testid=export-batch-hub]").get_attribute("data-batch") or "",
    }


def measure(tag: str, card: dict[str, str], instant: datetime, zone: str, errors: list[str],
            country: str = "peru") -> None:
    """One walk's whole law, off the DOM the browser actually painted."""
    house = workspace_zone(country)
    workspace = prep_clock(instant, house)
    browser = prep_clock(instant, zone)
    check(int(card["rows"]) > 0, f"{tag}: Prep lists its upcoming deliveries", f"{card['rows']} rows")

    # 1 · THE HOUR IS THE WORKSPACE'S OWN.
    check(card["clock"] == f"{workspace[1]} now",
          f"{tag}: the clock states the workspace's own hour",
          f"{card['clock']} · workspace {workspace[1]} · browser {browser[1]}")

    # 2 · AND THE PAIR IT STANDS IN IS ONE INSTANT, READ IN ONE ZONE.
    shown = card["clock"].split(" ")[0]
    claimed = claimed_offset(instant, workspace[0], shown)
    check(claimed == zone_offset(instant, house),
          f"{tag}: the shown pair is this instant in the workspace's zone",
          f"{workspace[0]} {shown} claims UTC{claimed / 60:+.0f}h · {house} stands at "
          f"UTC{zone_offset(instant, house) / 60:+.0f}h")

    # 2b · AND THE MARKET IS WHAT CHOSE THAT ZONE (lead decision, 13 September 2026). Peru reads
    #      Lima, Spain reads Madrid. At every instant this drive walks the two markets hold
    #      different hours, so a Spanish workspace showing Lima's hour is caught here by name —
    #      which is the whole of Peter's Spain demo.
    peru_hour = prep_clock(instant, workspace_zone("peru"))[1]
    spain_hour = prep_clock(instant, workspace_zone("spain"))[1]
    check(peru_hour != spain_hour and card["clock"] == f"{workspace[1]} now",
          f"{tag}: the {country} market's own zone chose the clock",
          f"{card['clock']} · peru {peru_hour} · spain {spain_hour}")

    # 3 · THE BATCH NAMES THE FIRST LISTED DELIVERY. Green on either build; it is what ties the
    #     label the card prints to the row the list holds.
    named = card["scope"].split(" · ")
    check(len(named) >= 2 and named[0] == day_label(card["row_day"]) and named[1] == card["row_slot"],
          f"{tag}: the batch names the first listed delivery's own day and slot",
          f"{card['scope']} · row {card['row_day']} {card['row_slot']}")

    # 4 · THE COUNTDOWN IS MEASURED FROM THE CLOCK THE CARD SHOWS.
    wanted = countdown_words(minutes_until_slot(card["row_day"], card["row_slot"], workspace))
    check(card["countdown"] == f"Next batch {wanted}",
          f"{tag}: the countdown is measured from the workspace's clock",
          f"{card['countdown']} · wanted Next batch {wanted}")

    # 5 · THE ONE-DAY LAW. The shown minute plus the countdown lands on the named day and slot,
    #     with the shown hour's OWN day as the origin — which is the day of whichever zone shows
    #     that hour at this instant. A browser clock reading 00:30 belongs to the 14th, so a label
    #     naming the 13th is two days in one sentence.
    origin = workspace[0] if shown == workspace[1] else browser[0] if shown == browser[1] else ""
    counted = countdown_minutes(card["countdown"])
    target = day_delta(origin, card["row_day"]) * 1_440 + clock_minutes(card["row_slot"]) if origin else None
    if target is None or counted is None:
        lands = False
    elif card["countdown"].endswith("ready now"):
        # «ready now» is a floor rather than a count, so the law it carries is that the named slot
        # stands at or before the minute the card shows.
        lands = target <= clock_minutes(shown)
    else:
        lands = clock_minutes(shown) + counted == target
    check(lands,
          f"{tag}: the shown clock and the day the card names are one day",
          f"{shown} (of {origin or 'no zone here'}) + {counted} → {card['row_day']} {card['row_slot']}")

    check(not errors, f"{tag}: Prep raises zero page errors", errors[0][:160] if errors else "")


def countdown_minutes(words: str) -> int | None:
    """«Next batch in 13h 30m» → 810. The inverse of `countdownWords`, so the drive reads what the
    card actually printed rather than trusting the number it expected."""
    said = words.replace("Next batch ", "").strip()
    if said == "ready now":
        return 0
    hours = re.search(r"in (\d+)h(?: (\d+)m)?$", said)
    if hours:
        return int(hours.group(1)) * 60 + int(hours.group(2) or 0)
    minutes = re.search(r"in (\d+) min$", said)
    return int(minutes.group(1)) if minutes else None


async def walk(context: BrowserContext, url: str, tag: str, instant: datetime, zone: str, width: int,
               country: str = "peru") -> None:
    page = await context.new_page()
    errors: list[str] = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    try:
        await open_prep(page, url)
        card = await read_card(page)
        print(f"— {tag} · {instant.isoformat()} · browser {zone} · {country} workspace "
              f"({workspace_zone(country)}) · {width}px · {card}", flush=True)
        await page.screenshot(path=str(OUT / f"{tag}-{width}.png"), animations="disabled")
        measure(tag, card, instant, zone, errors, country)
    except Exception as error:  # a walk that stopped early names where it stopped
        check(False, f"{tag}: the walk reached Prep and read its card", str(error)[:300])
        await page.screenshot(path=str(OUT / f"{tag}-{width}-failure.png"), full_page=True)
        (OUT / f"{tag}-{width}-failure.txt").write_text(await page.locator("body").inner_text())
    await page.close()


async def rolled_walk(context: BrowserContext, url: str, instant: datetime, zone: str, width: int) -> None:
    """MIDNIGHT PASSING WHILE PREP IS OPEN. The cast keeps its boot day — that is the boot snapshot
    in `scenario-clock.ts` — and the clock walks into the next one, so the countdown has to follow
    the day it just entered rather than the day the book was seeded on."""
    tag = "rolled"
    page = await context.new_page()
    errors: list[str] = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    try:
        await open_prep(page, url)
        before = await read_card(page)
        check(before["clock"] == f"{prep_clock(instant, workspace_zone('peru'))[1]} now",
              f"{tag}: the clock opens on the workspace's own hour",
              f"{before['clock']} · workspace {prep_clock(instant, workspace_zone('peru'))[1]}")
        # The card reads its clock on a 30-second interval; twenty minutes of it carries Lima past
        # midnight and fires that interval on the way.
        await context.clock.fast_forward("20:00")
        await page.wait_for_timeout(600)
        after = await read_card(page)
        moved = instant + timedelta(minutes=20)
        print(f"— {tag} · {moved.isoformat()} · {zone} · {width}px · {after}", flush=True)
        await page.screenshot(path=str(OUT / f"{tag}-{width}.png"), animations="disabled")
        check(after["clock"] != before["clock"], f"{tag}: the clock moved with the minutes",
              f"{before['clock']} → {after['clock']}")
        measure(tag, after, moved, zone, errors)
    except Exception as error:
        check(False, f"{tag}: the walk reached Prep and read its card", str(error)[:300])
        await page.screenshot(path=str(OUT / f"{tag}-{width}-failure.png"), full_page=True)
    await page.close()


async def open_library(page: Page, url: str) -> None:
    """«Your templates», behind Prep's square Email schedules control, with its sections opened.

    A row inside a closed disclosure is mounted and clipped, so each closed section is opened by
    keyboard and its 400 ms of travel waited out before anything is pressed or read.
    """
    await page.goto(url + "#/sales", wait_until="domcontentloaded")
    await page.locator("[data-testid=river]").wait_for(timeout=25_000)
    await page.locator("[data-testid=export-centre]").click()
    await page.locator("[data-testid=export-batch-hub]").wait_for(timeout=25_000)
    await page.locator("[data-testid=prep-email-schedules]").click()
    await page.locator("[data-testid=export-library]").wait_for(timeout=15_000)
    toggles = page.locator("[data-testid^=export-library-section-] button[aria-expanded][aria-controls]")
    for index in range(await toggles.count()):
        toggle = toggles.nth(index)
        if await toggle.get_attribute("aria-expanded") == "false":
            await toggle.focus()
            await toggle.press("Enter")
            await page.wait_for_timeout(420)


async def stamp_walk(context: BrowserContext, url: str, instant: datetime, zone: str, width: int) -> None:
    """THE ROW THAT REPORTS A PRESS READS THE SAME CLOCK (FEED-IA §247.8).

    `usedWhen` in `shell/printing.tsx` states «Printed 09:12 today» in the library the Prep card
    opens. It took the hour and the word «today» from the BROWSER's zone, so at this instant main's
    build filed a press made an hour and eighteen minutes earlier as «Printed 13 Sept» — a past
    day — while the card two doors away named the 13th and the house clock stood at 16:12 on it.

    THE STAMP IS SEEDED RATHER THAN PRESSED. The library persists its whole template list the
    moment anything in it changes, so one Duplicate writes the store, `lastUsedAt` is patched into
    that record and the page reloaded. The instant is then exact rather than whenever a press
    happened to land, and the walk needs none of the print pipeline.
    """
    tag = "stamp"
    page = await context.new_page()
    errors: list[str] = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    try:
        await open_library(page, url)
        await page.locator("[data-testid=export-row-more-albaran-default]").click()
        await page.locator("[data-testid=export-row-menu-albaran-default]").wait_for(timeout=10_000)
        await page.get_by_role("option", name="Duplicate").click()
        await page.wait_for_timeout(900)
        written = await page.evaluate("key => window.localStorage.getItem(key)", TEMPLATES_KEY)
        check(bool(written), f"{tag}: the library wrote its templates, so the stamp has a record to sit in")
        if not written:
            await page.close()
            return
        await page.evaluate(
            """([key, at]) => {
              const held = JSON.parse(window.localStorage.getItem(key));
              held.templates = held.templates.map((one) => one.id === 'albaran-default'
                ? { ...one, lastUsedAt: at } : one);
              window.localStorage.setItem(key, JSON.stringify(held));
            }""", [TEMPLATES_KEY, PRESSED_AT])
        await open_library(page, url)
        row = page.locator("[data-testid=export-output-albaran-default]")
        said = " ".join((await row.locator("[data-testid=export-used-albaran-default]").inner_text()).split())
        print(f"— {tag} · pressed {PRESSED.isoformat()} · read at {instant.isoformat()} · {zone} · «{said}»", flush=True)
        await page.screenshot(path=str(OUT / f"{tag}-{width}.png"), animations="disabled")
        await row.screenshot(path=str(OUT / f"{tag}-row-{width}.png"))

        # 1 · THE HOUR IS THE WORKSPACE'S OWN, and «today» is the workspace's day.
        pressed_here = prep_clock(PRESSED, workspace_zone("peru"))
        check(said == f"Printed {pressed_here[1]} today",
              f"{tag}: the row states the press in the workspace's own hour",
              f"{said} · workspace {pressed_here[1]} · browser {prep_clock(PRESSED, zone)[1]}")

        # 2 · AND THAT PAIR IS ONE INSTANT IN ONE ZONE, measured against the day the card names.
        stated = re.search(r"^Printed (\d{2}:\d{2}) today$", said)
        card_day = prep_clock(instant, workspace_zone("peru"))[0]
        claimed = claimed_offset(PRESSED, card_day, stated.group(1)) if stated else None
        check(claimed == zone_offset(PRESSED, workspace_zone("peru")),
              f"{tag}: «today» is the day the card names, and the hour belongs to it",
              f"{card_day} {stated.group(1) if stated else said} claims "
              + (f"UTC{claimed / 60:+.0f}h" if claimed is not None else "no hour at all"))

        check(not errors, f"{tag}: the library raises zero page errors", errors[0][:160] if errors else "")
    except Exception as error:
        check(False, f"{tag}: the walk reached the library and read the row", str(error)[:300])
        await page.screenshot(path=str(OUT / f"{tag}-{width}-failure.png"), full_page=True)
    await page.close()


# ── THE WALKS ────────────────────────────────────────────────────────────────────────────────
# Two instants that straddle a midnight, read from three browser zones. At 22:30Z Madrid has
# entered the 14th while Lima and UTC stand on the 13th; at 04:30Z both Madrid and UTC hold the
# 14th while Lima is still at 23:30 on the 13th.
#
# THE `spain-` LEGS ARE THE MARKET HALF. They plant a Spanish workspace and walk the same instants:
# the zone follows the country, so the card has to read Madrid's hour and name Madrid's day. This
# is Peter's own demo — Cedar opened in Spain at half past midnight reads «00:30 now», never
# Lima's «17:30 now». Every `peru` leg stays exactly as it was.
NIGHT = datetime(2026, 9, 13, 22, 30, tzinfo=timezone.utc)
DAWN = datetime(2026, 9, 14, 4, 30, tzinfo=timezone.utc)
WALKS = [
    ("madrid-night", NIGHT, "Europe/Madrid", 1600, "peru"),
    ("madrid-night-phone", NIGHT, "Europe/Madrid", 390, "peru"),
    ("madrid-night-narrow", NIGHT, "Europe/Madrid", 320, "peru"),
    ("madrid-dawn", DAWN, "Europe/Madrid", 390, "peru"),
    ("utc-dawn", DAWN, "UTC", 1600, "peru"),
    ("utc-dawn-phone", DAWN, "UTC", 390, "peru"),
    ("utc-night", NIGHT, "UTC", 390, "peru"),
    ("lima-night", NIGHT, "America/Lima", 1600, "peru"),
    ("lima-dawn", DAWN, "America/Lima", 390, "peru"),
    ("spain-night", NIGHT, "Europe/Madrid", 1600, "spain"),
    ("spain-night-phone", NIGHT, "Europe/Madrid", 390, "spain"),
    ("spain-night-narrow", NIGHT, "Europe/Madrid", 320, "spain"),
    ("spain-dawn", DAWN, "Europe/Madrid", 390, "spain"),
    # A Spanish house read from a browser somewhere else: the market chooses the zone, the
    # browser stays out of it, so these paint the same card as `spain-night` and `spain-dawn`.
    ("spain-from-utc-night", NIGHT, "UTC", 390, "spain"),
    ("spain-from-lima-dawn", DAWN, "America/Lima", 390, "spain"),
]
# Lima 23:50 on the 13th, twenty minutes short of its own midnight.
ROLL = datetime(2026, 9, 14, 4, 50, tzinfo=timezone.utc)


async def main() -> None:
    servers: list[socketserver.TCPServer] = []
    if URL:
        url = URL.split("#")[0]
    elif DIST:
        server, url = serve(DIST)
        servers.append(server)
    else:
        raise SystemExit("Set ROCOTO_DIST to a built directory or ROCOTO_URL to a served app.html")

    async with async_playwright() as play:
        browser = await play.chromium.launch(headless=True, args=["--no-sandbox"])
        for tag, instant, zone, width, country in WALKS:
            if ONLY and tag not in ONLY:
                continue
            context = await browser.new_context(
                viewport={"width": width, "height": 1000 if width > 500 else 844},
                timezone_id=zone,
                locale="en-GB",
            )
            await context.clock.set_fixed_time(instant)
            await context.route("**/api/**", lambda route: route.abort())
            await context.add_init_script(boot(country))
            await walk(context, url, tag, instant, zone, width, country)
            await context.close()

        if not ONLY or "rolled" in ONLY:
            context = await browser.new_context(
                viewport={"width": 390, "height": 844}, timezone_id="Europe/Madrid", locale="en-GB")
            await context.clock.install(time=ROLL)
            await context.route("**/api/**", lambda route: route.abort())
            await context.add_init_script(boot("peru"))
            await rolled_walk(context, url, ROLL, "Europe/Madrid", 390)
            await context.close()

        # The desk keeps the last-used fact in its own column; the phone folds it into the
        # settings line, where `export-used-*` has no seat — so this block reads the desk.
        if not ONLY or "stamp" in ONLY:
            context = await browser.new_context(
                viewport={"width": 1600, "height": 1000}, timezone_id="Europe/Madrid", locale="en-GB")
            await context.clock.set_fixed_time(NIGHT)
            await context.route("**/api/**", lambda route: route.abort())
            await context.add_init_script(boot("peru"))
            await stamp_walk(context, url, NIGHT, "Europe/Madrid", 1600)
            await context.close()

        await browser.close()

    for server in servers:
        server.shutdown()

    (OUT / "results.json").write_text(json.dumps({"green": GREEN, "red": RED}, indent=2))
    print(f"\n{len(GREEN)} GREEN / {len(RED)} RED · shots in {OUT}", flush=True)
    for name in RED:
        print("RED · " + name, flush=True)
    if RED:
        raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())
