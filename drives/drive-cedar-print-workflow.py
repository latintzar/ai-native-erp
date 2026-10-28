#!/usr/bin/env python3
"""Cedar delivery-batch print workflow regression.

Runs the current English bundle and proves the operational seams added on 2026-09-10 and the
preparation corrections of 2026-09-11 (FEED-IA §246):

  · the relative day, packing with Inventory off, explicit batch scope, zero Remaining, range
    source identity, and one browser-history step for the direct Sales print screen;
  · EVERY LISTED DELIVERY IS A PIN, and the map box holds all of them at 1600 and at 390;
  · ONE SCROLL SURFACE — the preparation card has no range of its own, and the outer sheet is what
    moves it over the map;
  · the download screen states the exact file, and the file that lands on disk matches it — bytes,
    rows and money;
  · deliveries, documents, dividers, copies and sheets are five numbers with five nouns;
  · the Google ground hands the picture back to the checked-in tiles when its API refuses.

and, from the review round of 2026-09-11 (FEED-IA §246 · §247):

  · THE NEAR-TERM WINDOW — the list, the map and the heading's count are one set: the next batch's
    day and the two delivery days after it, with the book beyond it stated as a number;
  · EVERY MARK IS VISIBLE — no pin control intersects the clock card, at 320, 390 and 1600;
  · THE ROWS ARE THE KEYBOARD PATH — Tab from the map lands on the card's first control, and the
    marks stand outside the tab order while keeping their pointer target;
  · A MARK'S HIT BOX IS ITS OWN GLYPH, so a control never covers a mark it is not;
  · GOOGLE IS ONE LOAD — a configured key asks for the Maps JavaScript API once and for the Static
    Maps API never;
  · AND ITS MARKS ARE OURS — against a stubbed Maps API the Google ground draws the same controls,
    with the same sale ids, opening the same Delivery Note.

and, from the adversarial review of 2026-09-11 (FEED-IA §246 · §247):

  · A TYPED ADDRESS IS A DELIVERY WITH NO POINT — `cast.ts` seeds one, the rows, the heading,
    `data-upcoming`, `data-pins` and `prep-map-coverage` state one arithmetic, the row carries an
    address mark rather than a door into a map that cannot show it, and it still opens its own
    Delivery Note;
  · THE PICTURE SAYS WHETHER IT FITTED — `data-fitted` is asserted true at 320, 390 and 1600, and
    again on the Castellano entry (`/cedar/es/`), whose own card height is what decides it;
  · ⚠ THE MAPS STUB HANDS BACK A LOADER, NOT AN API. `importLibrary('maps')` is what attaches the
    `Map` and `OverlayView` constructors, exactly as Google documents `loading=async`, so a loader
    that reads them at `script.onload` takes the free ground and goes red here. The stub also counts
    `new api.Map`, which is the metered unit: ONE LOAD PER PICTURE A PERSON OPENS, three open at the
    most (Prep, a row's map screen, a Delivery Note), two once the note is closed;
  · THE DESK PAGER NAMES WHAT IT COUNTS — «2 of 113 documents» — and the phone keeps the ratio.

and, from the second print review of 2026-09-11 (FEED-IA §246):

  · A WINDOW WITH NO COORDINATES AT ALL — the cast is intercepted so every account's door is text,
    and the sticky picture area states what it holds in one line (`prep-map-empty`) with the map
    door and every other focusable control gone, at 390, 1600 and 320. This is also where the
    coverage line's PLURAL branch is read off a screen rather than off a tool test;
  · THE SINGULAR CARRIES ITS ARTICLE — «141 on the map · 1 at a typed address», the same words the
    row's own mark says in its aria.

and, from the closeout of 2026-09-13 (FEED-IA §247.8, «Prep map clustering»):

  · ⚠ DENSE MARKS ARE ONE CONTROL WITH A COUNT ON IT, so the three assertions that read the marks
    were RETARGETED on 2026-09-13. Before: every listed delivery drew its own `map-order-<id>`, and
    the drive counted those controls against the rows. Now: a delivery is EITHER its own mark or a
    named member of a group (`data-members` on a `map-cluster-<n>` control), and the sum of the two
    is what the rows are counted against. `data-markers` on the figure is every delivery the
    picture is about and never moves for a group; `data-drawn` is what the picture is drawing now;
    `data-clusters` is how many of the controls are groups;
  · AND A GROUP OPENS INTO ITS OWN MEMBERS — pressing one narrows the picture to those deliveries
    at a sharper ground, «Show all» and browser Back put the whole window back, and every member is
    still on the picture. Walked at 390, 1600 and 320, on the checked-in ground and on the stubbed
    Google ground, and on the nested map screen.

Run:
  ROCOTO_DIST=app/dist-print python3 drives/drive-cedar-print-workflow.py
  ROCOTO_URL=http://127.0.0.1:8107/app.html python3 drives/drive-cedar-print-workflow.py
"""
import asyncio
import functools
import http.server
import os
import pathlib
import re
import socketserver
import threading
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from playwright.async_api import async_playwright

DIST = os.environ.get("ROCOTO_DIST")
URL = os.environ.get("ROCOTO_URL")
OUT = pathlib.Path(os.environ.get("ROCOTO_SHOTS", "/tmp/cedar-print-workflow"))
OUT.mkdir(parents=True, exist_ok=True)
GREEN: list[str] = []
RED: list[str] = []

BOOT = """
if (!sessionStorage.getItem('cedar-print-workflow')) {
  sessionStorage.setItem('cedar-print-workflow', '1');
  localStorage.clear();
  localStorage.setItem('rocoto-app-front-door', 'months');
  localStorage.setItem('rocoto-app-config', JSON.stringify({version:1, sector:['fish'], cast:'fish'}));
  localStorage.setItem('rocoto-workspace-capabilities:fish', JSON.stringify({version:1, pricing:true, inventory:false}));
}
window.print = () => { window.__printed = (window.__printed || 0) + 1; };
"""

# The key a published build carries as a constant. A proof names one here to walk the loader and
# its fallback without an account; the checked-in tiles stay the truth for every assertion.
GOOGLE_BOOT = BOOT + "\nwindow.__ROCOTO_MAPS_KEY__ = 'proof-key';\n"

# ── THE MAPS API, ANSWERED BY THIS PROOF ─────────────────────────────────────────────────────
# `google-ground.ts` declares the slice of the Maps JavaScript API this app calls: a `Map`, and an
# `OverlayView` with `getPanes`, `getProjection` and the three lifecycle calls Google makes on the
# instance. This is that slice, with a linear Web-Mercator projection, so the drive can walk the
# Google ground WITHOUT an account. It proves the app's own contract — the marks, their ids, their
# presses — rather than Google's rendering, which is Google's to prove.
MAPS_STUB = """
(function () {
  const TILE = 256;
  const worldX = (lng, zoom) => ((lng + 180) / 360) * TILE * Math.pow(2, zoom);
  const worldY = (lat, zoom) => {
    const r = lat * Math.PI / 180;
    return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * TILE * Math.pow(2, zoom);
  };
  /* THE METERED UNIT, COUNTED. The <script> is fetched once per page whatever the book holds, so a
     request counter cannot see what a session costs. Every `new api.Map` is one map load, and the
     live count is the number of those hosts still in the document. */
  window.__ROCOTO_MAPS_BUILT = 0;
  class StubMap {
    constructor(element, options) {
      this.element = element;
      this.centre = options.center;
      this.zoom = options.zoom;
      this.overlays = [];
      element.setAttribute('data-stub-map', 'yes');
      window.__ROCOTO_MAPS_BUILT += 1;
    }
    setCenter(position) { this.centre = position; this.overlays.forEach((one) => one.draw && one.draw()); }
    setZoom(zoom) { this.zoom = zoom; this.overlays.forEach((one) => one.draw && one.draw()); }
  }
  class StubOverlayView {
    setMap(map) {
      if (!map) { if (this.onRemove) this.onRemove(); this.map = null; return; }
      this.map = map;
      map.overlays.push(this);
      this.pane = document.createElement('div');
      this.pane.style.position = 'absolute';
      this.pane.style.inset = '0';
      map.element.appendChild(this.pane);
      if (this.onAdd) this.onAdd();
      if (this.draw) this.draw();
    }
    getPanes() { return { overlayMouseTarget: this.pane }; }
    getProjection() {
      const map = this.map;
      if (!map) return null;
      const box = map.element.getBoundingClientRect();
      const cx = worldX(map.centre.lng, map.zoom);
      const cy = worldY(map.centre.lat, map.zoom);
      return {
        fromLatLngToDivPixel: (at) => ({
          x: worldX(at.lng, map.zoom) - cx + box.width / 2,
          y: worldY(at.lat, map.zoom) - cy + box.height / 2,
        }),
      };
    }
  }
  /* ⚠ THE CONSTRUCTORS ARRIVE WITH `importLibrary`, AND ONLY WITH IT (FEED-IA §247). Under
     `loading=async` Google publishes `google.maps` as a LOADER: `Map` and `OverlayView` are
     attached when `importLibrary('maps')` resolves, and a caller that reads them at `script.onload`
     may read undefined. The stub used to attach them at evaluation time, which asserted exactly the
     assumption under test — so it hands back a loader now, and a page that reads the constructors
     before asking for the library gets the free ground and goes RED here. */
  /* ⚠ AND THE LOADER ARRIVES AFTER THE BOOTSTRAP (measured on the published page, 11 September).
     The script tag's `load` fires with `google.maps` standing but `importLibrary` still absent —
     Google's `main.js` attaches it a moment later and then calls the `callback` named in the
     script URL. A loader that settled at `onload` drew the files under a valid key, so the stub
     now models that sequence: the bare namespace first, the library and the ready call after. */
  const maps = {};
  window.google = { maps };
  setTimeout(() => {
    maps.importLibrary = (name) => {
      if (name === 'maps') { maps.Map = StubMap; maps.OverlayView = StubOverlayView; }
      return Promise.resolve({ Map: StubMap, OverlayView: StubOverlayView });
    };
    if (typeof window.__rocotoMapsReady === 'function') window.__rocotoMapsReady();
  }, 40);
})();
"""


# The outer scrolling surface, found from the card the way the card itself finds it.
OUTER_SCROLL = """
(node, top) => {
  let host = node.parentElement;
  while (host) {
    const flow = getComputedStyle(host).overflowY;
    if (flow === 'auto' || flow === 'scroll') break;
    host = host.parentElement;
  }
  if (!host) { window.scrollTo(0, top); return { top: window.scrollY, max: document.body.scrollHeight }; }
  host.scrollTop = top;
  return { top: host.scrollTop, max: host.scrollHeight - host.clientHeight };
}
"""


async def scroll_outer(card, top):
    """Move the surface Prep lives on, and say where it landed. A focus restore from a closing
    sheet can put the surface back at the top a frame after the first ask, so the ask is repeated
    once before anything is measured against it."""
    state = await card.evaluate(OUTER_SCROLL, top)
    wanted = min(top, state["max"])
    if abs(state["top"] - wanted) > 1:
        await card.page.wait_for_timeout(200)
        state = await card.evaluate(OUTER_SCROLL, top)
    return state


def check(ok, name, detail=""):
    (GREEN if ok else RED).append(name)
    print(("GREEN " if ok else "RED ") + name + ((" · " + detail) if detail else ""), flush=True)


def parse_row(row: str) -> list[str]:
    """RFC 4180 back out again: a quoted cell holds this file's own separator."""
    cells, value, quoted, at = [], "", False, 0
    while at < len(row):
        char = row[at]
        if quoted:
            if char == '"' and at + 1 < len(row) and row[at + 1] == '"':
                value += '"'
                at += 1
            elif char == '"':
                quoted = False
            else:
                value += char
        elif char == '"':
            quoted = True
        elif char == ",":
            cells.append(value)
            value = ""
        else:
            value += char
        at += 1
    cells.append(value)
    return cells


def serve(directory):
    handler = functools.partial(
        type("Quiet", (http.server.SimpleHTTPRequestHandler,), {"log_message": lambda *args: None}),
        directory=directory,
    )
    server = socketserver.TCPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, f"http://127.0.0.1:{server.server_address[1]}/app.html"


async def open_prep(page, url):
    await page.goto(url + "#/sales", wait_until="domcontentloaded")
    await page.locator("[data-testid=river]").wait_for()
    await page.locator("[data-testid=export-centre]").click()
    await page.locator("[data-testid=export-batch-hub]").wait_for()
    await page.wait_for_timeout(500)


# ── WHAT THE PICTURE DRAWS, SINCE THE MARKS COLLAPSE INTO GROUPS (FEED-IA §247.8) ────────────
# A group is `map-cluster-<n>` CARRYING `data-members`, and it takes both halves to name it:
# `map-cluster-back` shares the testid prefix and is the way out rather than a group, and
# `data-members` alone is also how a Stock family row states its own children. Every helper below
# is additionally scoped to one picture.
GROUPS = '[data-testid^="map-cluster-"][data-members]'


async def marks_in(page, where):
    """Every delivery the picture is holding, as sale ids: the marks that stand alone and the
    members the groups name. A cluster is a way of SHOWING all of them, so this is the list the
    rows are counted against."""
    alone = await page.locator(f'{where} [data-testid^="map-order-"]').evaluate_all(
        "nodes => nodes.map(node => node.getAttribute('data-order-id'))")
    grouped = await page.locator(f"{where} {GROUPS}").evaluate_all(
        "nodes => nodes.flatMap(node => node.dataset.members.split(',').filter(Boolean))")
    return alone, grouped


async def map_facts(page, where):
    """What the picture says about itself: every delivery it is about, what it is drawing now, how
    many of the controls are groups, and the ground it found for them."""
    return await page.locator(f"{where} [data-testid=pin-map]").evaluate(
        "node => ({ markers: Number(node.dataset.markers), drawn: Number(node.dataset.drawn),"
        " clusters: Number(node.dataset.clusters), zoom: Number(node.dataset.zoom),"
        " fitted: node.dataset.fitted, ground: node.dataset.ground })")


async def covered_controls(page, where):
    """Every control on the picture whose own centre belongs to something else, read off the
    browser with `elementFromPoint` rather than off the arithmetic — a mark under a group's disc,
    a group under the mark the picture is titled after, one group under another. Returns the
    testids that lost their press and how many controls were asked."""
    seen = await page.locator(f'{where} [data-testid^="map-order-"], {where} {GROUPS}').evaluate_all(
        "nodes => nodes.map(node => { const r = node.getBoundingClientRect();"
        " const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);"
        " const owner = top && top.closest('[data-testid]');"
        " return { me: node.dataset.testid, mine: Boolean(top && node.contains(top)),"
        " took: owner ? owner.dataset.testid : 'the ground' }; })")
    return [f"{one['me']} → {one['took']}" for one in seen if not one["mine"]], len(seen)


async def first_mark(page, where, steps=4):
    """A mark that stands alone, opening groups until one does. On a dense window every delivery
    can be inside a group, and the contract under test — «a press on a mark opens that exact
    Delivery Note» — is about the mark rather than about how many presses reached it.

    ⚠ THE SMALLEST GROUP IS THE ONE THAT OPENS INTO MARKS, which is why this presses that one:
    the fewest members are the ones a refit can spread over the picture, while the biggest group
    is the one whose members share a street. Retargeted 2026-09-14 — pressing the first group in
    DOM order walked the densest one and could end on a group the picture has no room to open."""
    marks = page.locator(f'{where} [data-testid^="map-order-"]')
    for _ in range(steps):
        if await marks.count():
            return marks.first
        groups = await page.locator(f'{where} {GROUPS}[data-opens="true"]').evaluate_all(
            "nodes => nodes.map(node => ({ testid: node.dataset.testid,"
            " members: node.dataset.members.split(',').filter(Boolean).length }))")
        if not groups:
            return None
        smallest = min(groups, key=lambda one: one["members"])
        await page.locator(f'{where} [data-testid="{smallest["testid"]}"]').click()
        await page.wait_for_timeout(600)
    return marks.first if await marks.count() else None


async def cluster_checks(page, where, tag, shots=None, avoid=None):
    """DENSE MARKS ARE ONE CONTROL WITH A COUNT ON IT (FEED-IA §247.8).

    «Make sure that for all the addresses you actually come up with, they all show up on the map»
    (Peter, 2026-09-10) — so a group is asked to prove that it SHOWS its deliveries rather than
    hides them: the groups' members plus the marks are the whole set, counted once, against the
    figure's own `data-markers`. Pressing a group narrows the picture to those members at a ground
    at least as sharp, «Show all» and browser Back put the whole window back, and the picture keeps
    naming every delivery it is about the whole time."""
    groups = page.locator(f"{where} {GROUPS}")
    back = page.locator(f"{where} [data-testid=map-cluster-back]")
    whole = await map_facts(page, where)
    alone, members = await marks_in(page, where)
    check(whole["clusters"] > 0 and await groups.count() == whole["clusters"],
          f"{tag}: dense marks collapse into counted groups",
          f"{whole['clusters']} groups · {len(alone)} marks · {whole['markers']} deliveries"
          f" at zoom {whole['zoom']}")
    check(len(alone) + len(members) == whole["drawn"] == whole["markers"]
          and len(set(alone + members)) == len(alone) + len(members),
          f"{tag}: the groups and the marks are every delivery, counted once",
          f"{len(alone)} marks + {len(members)} members = {whole['drawn']} drawn of {whole['markers']}")
    stated = await groups.evaluate_all(
        "nodes => nodes.map(node => ({ testid: node.dataset.testid, ids: node.dataset.members,"
        " members: node.dataset.members.split(',').filter(Boolean).length,"
        " said: node.textContent.trim(), aria: node.getAttribute('aria-label'), tab: node.tabIndex }))")
    check(bool(stated) and all(one["said"] == str(one["members"])
              and one["aria"] == f"{one['members']} deliveries here"
              and re.fullmatch(r"map-cluster-\d+", one["testid"])
              and one["tab"] == -1
              for one in stated),
          f"{tag}: a group reads its own count and says the same thing in words",
          str([(one["testid"], one["said"], one["aria"]) for one in stated[:3]]))
    check(await back.count() == 0,
          f"{tag}: a whole window carries no way out, because it is already the whole window")
    # ⚠ EVERY CONTROL TAKES ITS OWN PRESS, ON EVERY PICTURE THIS WALKS. Added 2026-09-14: the
    # reading below used to be taken on Prep's whole window alone, so the nested map screen, the
    # narrowed pictures and Google's pane — where a group stood 9px from the drop it was drawn
    # beside and took no press at 320 — were never asked. It is asked here three times: on the
    # whole window, on the picture one press narrows it to, and at the end of the narrowing.
    covered, drawn_here = await covered_controls(page, where)
    check(not covered, f"{tag}: every control on the whole window takes its own press",
          f"{len(covered)} of {drawn_here} covered · {covered[:3]}")
    if shots:
        await page.screenshot(path=str(OUT / f"20-clusters-whole-{shots}.png"), animations="disabled")

    # FAIL CLOSED: with no group to press, every claim below is about something that is missing,
    # so each one is stated red rather than skipped — a picture that stopped grouping would
    # otherwise shrink this block to three assertions and still read green.
    if not stated:
        missing = ["a group opens onto its own deliveries, and the picture still names all of them",
                   "and every member of that group is still on the picture",
                   "the narrowed picture holds its members at a ground at least as sharp",
                   "the members stand as marks or as smaller groups, or the picture states the end",
                   "every control on the narrowed picture takes its own press",
                   "the way out stands on the narrowed picture, at the touch target"]
        if avoid is not None:
            missing.append("and it stands clear of the card over the picture's corner")
        missing += ["«Show all» puts the whole window back",
                    "a group opens again",
                    "browser Back shows the whole window again, and the screen it is on stands",
                    "the narrowing ends, and every control it ends on takes its own press",
                    "and the end of it still names every delivery the picture is about"]
        for what in missing:
            check(False, f"{tag}: {what}", "the picture draws no group to press")
        return

    # ── PRESSING A GROUP NARROWS THE PICTURE TO ITS OWN MEMBERS ───────────────────────────
    # ⚠ AND THE DELIVERY THE PICTURE IS TITLED AFTER STAYS ON IT. Retargeted 2026-09-14: a narrowed
    # map screen used to draw the pressed group's members alone, so the screen headed «Distribucions
    # Llorens» had no Llorens on it while a group was open (photographed). The narrowed set is the
    # members plus that one mark, which is why the drawn count carries the drop with it.
    titled = await page.locator(f'{where} [data-drop="true"]').evaluate_all(
        "nodes => nodes.map(node => node.getAttribute('data-order-id'))")
    biggest = max(stated, key=lambda one: one["members"])
    wanted = sorted(set(biggest["ids"].split(",")) | set(titled))
    await page.locator(f'{where} [data-testid="{biggest["testid"]}"]').click()
    await page.wait_for_timeout(700)
    narrowed = await map_facts(page, where)
    near_alone, near_members = await marks_in(page, where)
    check(narrowed["drawn"] == len(wanted) and narrowed["markers"] == whole["markers"],
          f"{tag}: a group opens onto its own deliveries, and the picture still names all of them",
          f"{narrowed['drawn']} drawn of {narrowed['markers']} · group held {biggest['members']}"
          f" · titled {titled}")
    check(sorted(near_alone + near_members) == wanted,
          f"{tag}: and every member of that group is still on the picture",
          f"{len(near_alone)} marks + {len(near_members)} members of {len(wanted)}")
    check(narrowed["fitted"] == "true" and narrowed["zoom"] >= whole["zoom"],
          f"{tag}: the narrowed picture holds its members at a ground at least as sharp",
          f"zoom {whole['zoom']} -> {narrowed['zoom']} · fitted {narrowed['fitted']}")
    # ⚠ RETARGETED 2026-09-14. Before: the members were drawn as MARKS once a refit made one group
    # of them, which at 390 ended at 270 marks at zoom 9 with 265 of them under another mark's
    # control — the smear this section exists to close, one press further in. Now the room the
    # picture has is what ends the narrowing: a group holding every mark the picture can group is
    # one this picture cannot open, so it states that (`data-opens="false"`) and keeps its count.
    opened = await groups.evaluate_all(
        "nodes => nodes.map(node => node.dataset.opens)")
    spread = [one for one in near_alone if one not in titled]
    check(len(spread) + len(opened) > 1 or opened == ["false"],
          f"{tag}: the members stand as marks or as smaller groups, or the picture states the end",
          f"{len(spread)} marks · {len(opened)} groups · opens {opened[:4]}")
    covered, drawn_here = await covered_controls(page, where)
    check(not covered, f"{tag}: every control on the narrowed picture takes its own press",
          f"{len(covered)} of {drawn_here} covered at zoom {narrowed['zoom']} · {covered[:3]}")
    standing = await back.count() == 1
    said = " ".join((await back.inner_text()).split()) if standing else ""
    shape = await back.bounding_box() if standing else {"x": 0.0, "y": 0.0, "width": 0.0, "height": 0.0}
    check(standing and said == "Show all"
          and shape["width"] >= 43.5 and shape["height"] >= 43.5,
          f"{tag}: the way out stands on the narrowed picture, at the touch target",
          f"«{said}» {shape['width']:.0f}×{shape['height']:.0f}")
    # ⚠ THE WAY OUT STANDS IN THE TOP BAND, AND A CARD OVER THE CORNER IS WHAT CROWDS IT. At 320
    # the clock card is 188 px of a 288 px box, and a control sized to its own words reached back
    # under it — photographed on 2026-09-13 before it was capped at the room the card leaves.
    if avoid is not None:
        card = await page.locator(avoid).bounding_box()
        clear = shape["x"] >= card["x"] + card["width"] - 0.5 or shape["y"] >= card["y"] + card["height"] - 0.5
        check(clear, f"{tag}: and it stands clear of the card over the picture's corner",
              f"way out at {shape['x']:.0f},{shape['y']:.0f} {shape['width']:.0f}×{shape['height']:.0f}"
              f" · card to {card['x'] + card['width']:.0f},{card['y'] + card['height']:.0f}")
    if shots:
        await page.screenshot(path=str(OUT / f"21-clusters-narrowed-{shots}.png"), animations="disabled")

    # ── AND «SHOW ALL» PUTS THE WHOLE WINDOW BACK ────────────────────────────────────────
    await back.click()
    await page.wait_for_timeout(600)
    restored = await map_facts(page, where)
    check(restored["drawn"] == whole["markers"] and restored["clusters"] > 0
          and await back.count() == 0,
          f"{tag}: «Show all» puts the whole window back",
          f"{restored['drawn']} of {restored['markers']} · {restored['clusters']} groups")

    # ── SO DOES BROWSER BACK, BECAUSE OPENING A GROUP IS A PLACE A PERSON WENT ───────────
    if await groups.count():
        await groups.first.click()
        await page.wait_for_timeout(700)
    check(await back.count() == 1, f"{tag}: a group opens again",
          f"{await groups.count()} groups to press")
    await page.go_back()
    await page.wait_for_timeout(700)
    popped = await map_facts(page, where)
    check(await back.count() == 0 and popped["drawn"] == whole["markers"],
          f"{tag}: browser Back shows the whole window again, and the screen it is on stands",
          f"{popped['drawn']} of {popped['markers']}")

    # ── AND THE NARROWING ENDS WHERE A FINGER CAN TELL THE CONTROLS APART ──────────────────
    # ⚠ THE DEFECT THIS CLOSES, MEASURED 2026-09-14 on the build before it: two presses on Prep's
    # own picture at 390 ended at 270 marks drawn at zoom 9, 265 of which had another mark over
    # their centre — every one of those presses opened whichever delivery owned the pixels, which
    # is the smear §247.8 exists to close, one press further in. One assertion is what was missing,
    # so the walk goes all the way down rather than one press in: it presses the BIGGEST group each
    # time, which is the densest end of the picture, until every group left states that this
    # picture has no room to open it.
    walked = []
    for _ in range(8):
        openable = await page.locator(f'{where} {GROUPS}[data-opens="true"]').evaluate_all(
            "nodes => nodes.map(node => ({ testid: node.dataset.testid,"
            " members: node.dataset.members.split(',').filter(Boolean).length }))")
        if not openable:
            break
        deepest = max(openable, key=lambda one: one["members"])
        await page.locator(f'{where} [data-testid="{deepest["testid"]}"]').click()
        await page.wait_for_timeout(650)
        walked.append(deepest["members"])
    end = await map_facts(page, where)
    end_alone, end_members = await marks_in(page, where)
    end_covered, end_drawn = await covered_controls(page, where)
    check(not end_covered,
          f"{tag}: the narrowing ends, and every control it ends on takes its own press",
          f"{len(walked)} presses {walked} · {end['clusters']} groups · {len(end_alone)} marks"
          f" at zoom {end['zoom']} · {len(end_covered)} of {end_drawn} covered · {end_covered[:3]}")
    check(len(end_alone) + len(end_members) == end["drawn"] and end["markers"] == whole["markers"],
          f"{tag}: and the end of it still names every delivery the picture is about",
          f"{len(end_alone)} marks + {len(end_members)} members = {end['drawn']} drawn"
          f" of {end['markers']}")
    if await back.count():
        await back.click()
        await page.wait_for_timeout(600)


async def map_and_scroll_checks(page, tag, shots=True):
    """Every listed delivery on the map, and one surface that scrolls."""
    hub = page.locator("[data-testid=export-batch-hub]")
    rows = page.locator("[data-testid=export-delivery-timeline] > [role=button]")
    pins = page.locator('[data-testid=prep-status] [data-testid^="map-order-"]')
    groups = page.locator(f"[data-testid=prep-status] {GROUPS}")
    # A DELIVERY WHOSE ADDRESS WAS TYPED HAS NO POINT (FEED-IA §246). Its row draws the address mark
    # instead of a door into a map that cannot show it, so the list is the marks plus the typed
    # addresses — never the marks alone, and never a heading standing over a number nobody states.
    addresses = page.locator('[data-testid=export-delivery-timeline] [data-testid^="prep-address-"]')
    row_count = await rows.count()
    pin_count = await pins.count()
    typed_count = await addresses.count()
    # ⚠ RETARGETED 2026-09-13 (FEED-IA §247.8). This counted `map-order-` controls against the
    # rows, which held while every delivery drew its own mark. Dense marks collapse into counted
    # groups now, so a delivery is either its own mark or a member a group names, and the two
    # together are what the rows are counted against — the same law, «they all show up on the map»,
    # asked of a picture that draws fewer controls than it holds deliveries.
    pin_ids, member_ids = await marks_in(page, "[data-testid=prep-status]")
    held = pin_ids + member_ids
    check(len(held) + typed_count == row_count and row_count > 0 and len(held) > 0,
          f"{tag}: every listed delivery is a mark, a group's member or a typed address",
          f"{row_count} rows · {pin_count} marks · {len(member_ids)} in {await groups.count()} groups"
          f" · {typed_count} typed")
    row_ids = await rows.evaluate_all(
        "nodes => nodes.map(node => node.getAttribute('data-testid').replace('prep-delivery-', ''))")
    typed_ids = await addresses.evaluate_all(
        "nodes => nodes.map(node => node.getAttribute('data-testid').replace('prep-address-', ''))")
    check(sorted(row_ids) == sorted(held + typed_ids),
          f"{tag}: the marks and the groups carry the exact listed sale ids",
          f"{len(set(row_ids) ^ set(held + typed_ids))} differ")
    scopes = await hub.evaluate(
        "node => ({ batch: node.dataset.batch, upcoming: node.dataset.upcoming, pins: node.dataset.pins,"
        " days: node.dataset.windowDays, later: node.dataset.later })")
    batch_words = await page.locator("[data-testid=prep-batch-scope]").inner_text()
    upcoming_words = await page.locator("[data-testid=prep-upcoming-heading]").inner_text()
    # ⚠ RETARGETED 2026-09-13: `data-pins` is the deliveries the picture holds, which used to be
    # the count of drawn controls and is now the marks plus the groups' members.
    check(int(scopes["upcoming"]) == row_count and int(scopes["pins"]) == len(held)
          and scopes["batch"] in batch_words and scopes["upcoming"] in upcoming_words,
          f"{tag}: both scopes are named on the card", f"{batch_words} | {upcoming_words}")

    # ── AND WHERE THE LIST AND THE PICTURE DISAGREE, ONE LINE SAYS SO ───────────────────────
    coverage = page.locator("[data-testid=prep-map-coverage]")
    if typed_count:
        said = " ".join((await coverage.inner_text()).split())
        # THE SINGULAR CARRIES ITS ARTICLE, the way the row's own mark says it: «… · a typed
        # address». One address and «1 at typed address» was the only state the seeded demo ever
        # showed, and it disagreed with the aria two lines below it.
        # ⚠ RETARGETED 2026-09-13: the line counts the deliveries the picture HOLDS — the marks
        # that stand alone plus the members the groups name — rather than the controls it draws.
        want = f"{len(held)} on the map · {typed_count} at " + (
            "a typed address" if typed_count == 1 else "typed addresses")
        check(said == want, f"{tag}: the line under the map states what the picture holds",
              f"«{said}» wanted «{want}»")
        mark = addresses.first
        check(await mark.evaluate("node => node.tagName") != "BUTTON"
              and await page.locator(f'[data-testid="prep-map-{typed_ids[0]}"]').count() == 0,
              f"{tag}: a typed address carries a mark rather than a door into a map without it",
              await mark.get_attribute("aria-label") or "")
        box = await mark.bounding_box()
        check(box is not None and round(box["width"]) == 56 and round(box["height"]) == 56,
              f"{tag}: and it keeps the row's own 56px square",
              f"{box['width']:.0f}×{box['height']:.0f}" if box else "gone")
    else:
        check(await coverage.count() == 0,
              f"{tag}: a window the picture holds whole says nothing about coverage")

    # ── THE WINDOW IS THE LIST AND THE WINDOW IS THE MAP ────────────────────────────────────
    days = await rows.evaluate_all("nodes => [...new Set(nodes.map(node => node.dataset.prepDay))]")
    check(len(days) <= 3 and int(scopes["days"]) == len(days) and int(scopes["upcoming"]) == row_count,
          f"{tag}: the list is the near-term window — the batch's day and the two after it",
          f"{len(days)} days {days}")
    more = page.locator("[data-testid=prep-upcoming-more]")
    later = int(scopes["later"])
    if later:
        said = " ".join((await more.inner_text()).split())
        check(said.startswith(f"{later} more after "),
              f"{tag}: the book beyond the window is stated as a number", said)
    else:
        check(await more.count() == 0,
              f"{tag}: a book that ends inside the window says nothing after it")

    # ── EVERY MARK IS VISIBLE — the clock card is a rectangle the fit keeps the marks out of ──
    # ⚠ RETARGETED 2026-09-13: a group stands at the mean of its own members, so it is drawn where
    # they are and it has to keep out of the same card. Both kinds of control are asked.
    clock = await page.locator("[data-testid=prep-status] > div").last.bounding_box()
    drawn = page.locator(f'[data-testid=prep-status] [data-testid^="map-order-"], [data-testid=prep-status] {GROUPS}')
    drawn_count = await drawn.count()
    covered = await drawn.evaluate_all(
        "(nodes, card) => nodes.filter(node => { const r = node.getBoundingClientRect();"
        " return r.left < card.x + card.width && r.right > card.x"
        " && r.top < card.y + card.height && r.bottom > card.y; }).length", clock)
    check(covered == 0, f"{tag}: every mark and every group stands clear of the clock card",
          f"{covered} of {drawn_count} under a {clock['width']:.0f}×{clock['height']:.0f} card")

    # ── A MARK'S HIT BOX IS ITS OWN GLYPH, AND A GROUP'S IS THE TOUCH TARGET ───────────────
    boxes = await pins.evaluate_all(
        "nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return [r.width, r.height]; })")
    widest = max((box[0] for box in boxes), default=0)
    check(widest <= 32.5 and drawn_count > 0,
          f"{tag}: a mark's control is its own glyph rather than a 44px square",
          f"widest {widest:.0f}px of {len(boxes)} marks · {drawn_count} controls drawn")
    group_boxes = await groups.evaluate_all(
        "nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return [r.width, r.height]; })")
    check(bool(group_boxes) and all(abs(box[0] - 44) < 1 and abs(box[1] - 44) < 1 for box in group_boxes),
          f"{tag}: and a group's control is the 44px touch target",
          f"{len(group_boxes)} groups {group_boxes[:3]}")

    # ── AND EVERY CONTROL TAKES ITS OWN PRESS ──────────────────────────────────────────────
    # ⚠ THE DEFECT THIS CLOSES, PHOTOGRAPHED 2026-09-13: a 44 px group drawn at its members' mean
    # landed on top of a mark that had stayed out of it, and every press aimed at that mark opened
    # the group instead — the nested map's own titled delivery was the one it happened to. The
    # grouping claims a mark its control would cover, the group is pushed off the picture's titled
    # mark, and this reads the answer off the browser rather than off the arithmetic.
    covered_control, asked = await covered_controls(page, "[data-testid=prep-status]")
    check(not covered_control,
          f"{tag}: every mark and every group takes its own press",
          f"{len(covered_control)} of {asked} covered · {covered_control[:3]}")

    # ── THE ROWS ARE THE KEYBOARD PATH ─────────────────────────────────────────────────────
    outside = await drawn.evaluate_all("nodes => nodes.filter(node => node.tabIndex !== -1).length")
    check(outside == 0, f"{tag}: the marks and the groups stand outside the tab order",
          f"{outside} of {drawn_count}")
    described = await page.locator("[data-testid=prep-status] [data-testid=pin-map] > div").get_attribute("aria-describedby")
    listed = await page.locator("[data-testid=export-delivery-timeline]").get_attribute("id")
    check(bool(described) and described == listed,
          f"{tag}: and the map points at the list that carries the same deliveries", str(described))
    await page.locator("[data-testid=prep-map-background]").focus()
    await page.keyboard.press("Tab")
    landed = await page.evaluate(
        "() => { const node = document.activeElement;"
        " const card = document.querySelector('[data-testid=prep-active-card]');"
        " return { inCard: Boolean(card && card.contains(node)),"
        " what: node ? (node.getAttribute('data-testid') || node.getAttribute('aria-label') || node.tagName) : '' }; }")
    check(landed["inCard"], f"{tag}: Tab from the map lands on the card's first control", str(landed))

    picture = await page.locator("[data-testid=prep-status]").bounding_box()
    # ⚠ RETARGETED 2026-09-13: the box has to hold every control it draws, groups included.
    frames = await drawn.evaluate_all(
        "nodes => nodes.map(node => { const r = node.getBoundingClientRect();"
        " return [r.left, r.top, r.right, r.bottom]; })")
    outside = [f for f in frames
               if f[0] < picture["x"] - 1 or f[1] < picture["y"] - 1
               or f[2] > picture["x"] + picture["width"] + 1
               or f[3] > picture["y"] + picture["height"] + 1]
    check(not outside, f"{tag}: the map box holds every mark and every group",
          f"{len(outside)} of {len(frames)} outside")
    fit = await page.locator("[data-testid=prep-status] [data-testid=pin-map]").evaluate(
        "node => ({ zoom: node.dataset.zoom, fit: node.dataset.fit, ground: node.dataset.ground,"
        " at: node.dataset.at, markers: node.dataset.markers, fitted: node.dataset.fitted })")
    check(fit["fit"] == "bounds" and fit["ground"] == "tiles" and int(fit["zoom"]) >= 8,
          f"{tag}: the picture states its ground, its zoom and its fit", str(fit))
    # ── AND IT STATES WHETHER IT FITTED (FEED-IA §246) ─────────────────────────────────────
    # `fitted: false` is the honest fallback to the whole box, which paints marks back under the
    # clock card. It was the one fit fact the figure kept to itself, so a copy change that grew the
    # card by a line could flip it with nothing anywhere going red.
    check(fit["fitted"] == "true", f"{tag}: and that the marks were fitted clear of the card",
          str(fit["fitted"]))
    tiles = await page.locator('[data-testid=prep-status] [data-testid=map-tile-ground] img').count()
    check(tiles > 0, f"{tag}: the fitted ground draws real tiles", str(tiles))

    # ── AND THE DENSE MARKS ARE GROUPS WITH COUNTS ON THEM (FEED-IA §247.8) ────────────────
    await cluster_checks(page, "[data-testid=prep-status]", tag, shots=tag if shots else None,
                         avoid="[data-testid=prep-status] > div:last-of-type")
    # Playwright brings a control into view before it presses it, so the surface is returned to the
    # top before the scroll block below measures the card at rest.
    await scroll_outer(page.locator("[data-testid=prep-active-card]"), 0)
    await page.wait_for_timeout(400)

    card = page.locator("[data-testid=prep-active-card]")
    inner = await card.evaluate(
        "node => ({ scrollHeight: node.scrollHeight, clientHeight: node.clientHeight,"
        " overflowY: getComputedStyle(node).overflowY })")
    check(inner["scrollHeight"] <= inner["clientHeight"] + 1 and inner["overflowY"] == "visible",
          f"{tag}: the preparation card has no scroll range of its own",
          f"{inner['scrollHeight']} in {inner['clientHeight']} · overflow-y {inner['overflowY']}")

    rest_card = (await card.bounding_box())["y"]
    rest_map = (await page.locator("[data-testid=prep-status]").bounding_box())["y"]
    check(rest_card > rest_map and rest_card < rest_map + picture["height"],
          f"{tag}: the card peeks over the map at rest", f"card {rest_card:.0f} · map {rest_map:.0f}")

    one_at = await scroll_outer(card, 200)
    await page.wait_for_timeout(450)
    one_card = (await card.bounding_box())["y"]
    one_map = (await page.locator("[data-testid=prep-status]").bounding_box())["y"]
    two_at = await scroll_outer(card, 400)
    await page.wait_for_timeout(450)
    two_card = (await card.bounding_box())["y"]
    two_map = (await page.locator("[data-testid=prep-status]").bounding_box())["y"]
    check(one_at["top"] == 200 and two_at["top"] == 400 and abs(two_map - one_map) < 2
          and two_card < one_card - 100,
          f"{tag}: the outer surface moves the card over a map that stays",
          f"map {one_map:.0f}->{two_map:.0f} · card {one_card:.0f}->{two_card:.0f}")
    if shots:
        await page.screenshot(path=str(OUT / f"08-prep-scrolled-{tag}.png"), animations="disabled")
    check(await card.get_attribute("data-expanded") == "true",
          f"{tag}: the card reads the outer scroll")

    reach = await scroll_outer(card, 100000)
    await page.wait_for_timeout(450)
    last = page.locator("[data-testid=export-delivery-timeline] > [role=button]").last
    frame = await last.bounding_box()
    viewport = page.viewport_size["height"]
    check(frame is not None and frame["y"] >= 0 and frame["y"] < viewport,
          f"{tag}: the last delivery row is reachable through the outer scroll",
          f"row at {frame['y']:.0f} of {viewport} · scrolled {reach['top']:.0f}")

    await scroll_outer(card, 0)
    await page.wait_for_timeout(450)
    back = (await card.bounding_box())["y"]
    check(await card.get_attribute("data-expanded") == "false" and abs(back - rest_card) < 3,
          f"{tag}: returning to the top restores the peek", f"{back:.0f}")


async def typed_address_checks(page, tag):
    """A DELIVERY WHOSE ADDRESS WAS TYPED (FEED-IA §246). `cast.ts` seeds one — an account with a
    printed door and no coordinate, which is the state `Customer.at` being optional reaches on its
    own road. The row keeps its Delivery Note and loses only the door into a picture that cannot
    show it, and the heading, the two data attributes and the line under the map all say the same
    two numbers."""
    hub = page.locator("[data-testid=export-batch-hub]")
    addresses = page.locator('[data-testid=export-delivery-timeline] [data-testid^="prep-address-"]')
    count = await addresses.count()
    check(count > 0, f"{tag}: the window carries a delivery whose address is typed", f"{count} of them")
    if not count:
        return
    sale_id = (await addresses.first.get_attribute("data-testid")).replace("prep-address-", "")
    row = page.locator(f'[data-testid="prep-delivery-{sale_id}"]')
    who = " ".join((await row.inner_text()).split("\n")[1].split())
    scopes = await hub.evaluate(
        "node => ({ upcoming: Number(node.dataset.upcoming), pins: Number(node.dataset.pins) })")
    heading = " ".join((await page.locator("[data-testid=prep-upcoming-heading]").inner_text()).split())
    said = " ".join((await page.locator("[data-testid=prep-map-coverage]").inner_text()).split())
    rows_now = await page.locator("[data-testid=export-delivery-timeline] > [role=button]").count()
    # ⚠ RETARGETED 2026-09-13 (FEED-IA §247.8): the coverage line counts the deliveries the picture
    # holds, which are the marks that stand alone plus the members the groups name.
    alone, members = await marks_in(page, "[data-testid=prep-status]")
    marks = len(alone) + len(members)
    typed_now = rows_now - marks
    stated = f"{marks} on the map · {typed_now} at " + (
        "a typed address" if typed_now == 1 else "typed addresses")
    check(scopes["upcoming"] == rows_now and scopes["pins"] == marks
          and heading == f"Upcoming deliveries · {rows_now}"
          and said == stated,
          f"{tag}: the rows, the heading, the pins and the coverage line state one arithmetic",
          f"{rows_now} rows · {marks} marks · «{heading}» · «{said}»")
    await row.scroll_into_view_if_needed()
    await page.wait_for_timeout(300)
    await page.screenshot(path=str(OUT / f"17-typed-address-{tag}.png"), animations="disabled")
    await row.click()
    await page.locator("[data-testid=prep-delivery-detail]").wait_for()
    opened = await page.locator("[data-testid=sale-detail]").get_attribute("data-sale")
    check(opened == sale_id, f"{tag}: a typed-address row opens its own Delivery Note",
          f"{who} · {sale_id} -> {opened}")
    check(await page.locator("[data-testid=prep-delivery-detail] [data-testid=map-square]").count() == 0,
          f"{tag}: and that note offers the door in words rather than a map square")
    await page.go_back()
    await page.locator("[data-testid=prep-delivery-detail]").wait_for(state="detached")
    await page.wait_for_timeout(300)


# ── A WINDOW WHERE EVERY DOOR WAS TYPED (FEED-IA §246) ───────────────────────────────────────
# `cast.ts` seeds ONE account whose address is text, which proves the ONE-typed-address shape. The
# shape underneath it — a house whose whole first week was typed, so the picture holds nothing at
# all — is the house's own normal state, and the seed cannot reach it without moving every pinned
# count in the runner. So the cast is INTERCEPTED instead: the built bundle is served through this
# handler, which takes the coordinate off every account in it. It is the same fixture the seed is,
# one width wider.
COORDINATE = re.compile(r"at:\s*\{\s*lat:[^{}]*\}")


def coordinates_stripped(hits):
    """Serve the built bundle with every `at: { lat, lng }` replaced by `at: void 0`. Property keys
    in an object literal survive minification, so this reaches both the literal doors and the
    generated ones; `hits` collects the count so the leg can FAIL CLOSED on a bundle it never
    actually changed."""
    async def handler(route):
        response = await route.fetch()
        body = await response.text()
        patched, landed = COORDINATE.subn("at:void 0", body)
        hits.append(landed)
        await route.fulfill(response=response, body=patched)
    return handler


async def typed_only_checks(browser, url, width, height, tag):
    """THE PICTURE STATES WHAT IT HOLDS WHEN IT HOLDS NOTHING. A sticky 260 px rectangle wearing a
    focusable «Open delivery map» that opens nothing is the defect the row already closed, standing
    on the larger of the two doors. The background belongs to the picture, so it renders with the
    picture; where there is no picture the area says what IS, in one line, with nothing to press."""
    context = await browser.new_context(viewport={"width": width, "height": height})
    await context.add_init_script(BOOT)
    hits: list[int] = []
    await context.route("**/*.js", coordinates_stripped(hits))
    page = await context.new_page()
    page.set_default_timeout(20_000)
    errors: list[str] = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    await open_prep(page, url)
    await page.wait_for_timeout(600)
    hub = page.locator("[data-testid=export-batch-hub]")
    scopes = await hub.evaluate(
        "node => ({ upcoming: Number(node.dataset.upcoming), pins: Number(node.dataset.pins) })")
    # FAIL CLOSED: a bundle the handler never touched would draw the ordinary picture and pass every
    # claim below for the wrong reason.
    check(sum(hits) > 0 and scopes["upcoming"] > 0 and scopes["pins"] == 0,
          f"{tag}: a window where every delivery stands at a typed address",
          f"{sum(hits)} coordinates taken off · {scopes['upcoming']} deliveries · {scopes['pins']} marks")
    check(await page.locator("[data-testid=prep-map-background]").count() == 0,
          f"{tag}: the picture's door stands only where there is a picture behind it")
    empty = page.locator("[data-testid=prep-map-empty]")
    said = " ".join((await empty.inner_text()).split()) if await empty.count() else ""
    check(await empty.is_visible() if await empty.count() else False,
          f"{tag}: and the area says what it holds, in one line", said)
    focusable = await page.locator("[data-testid=prep-status]").evaluate(
        "node => [...node.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')]"
        ".filter((one) => one.tabIndex >= 0).map((one) => one.getAttribute('aria-label')"
        " || one.dataset.testid || one.tagName)")
    check(focusable == [], f"{tag}: nothing in the picture area is in the tab order", str(focusable))
    coverage = " ".join((await page.locator("[data-testid=prep-map-coverage]").inner_text()).split())
    check(coverage == f"0 on the map · {scopes['upcoming']} at typed addresses",
          f"{tag}: the line under it states the same arithmetic in the plural", coverage)
    marks = await page.locator('[data-testid=export-delivery-timeline] [data-testid^="prep-address-"]').count()
    check(marks == scopes["upcoming"],
          f"{tag}: every row carries the address mark", f"{marks} of {scopes['upcoming']}")
    await page.screenshot(path=str(OUT / f"19-typed-only-{tag}.png"), animations="disabled")
    check(not errors, f"{tag}: a window with no coordinates raises zero page errors",
          errors[0][:160] if errors else "")
    await context.close()


async def download_checks(page, tag):
    """The screen describes the artifact, and the artifact matches the screen."""
    await page.locator("[data-testid=prep-download]").click()
    await page.locator("[data-testid=prep-download-screen]").wait_for()
    screen = page.locator("[data-testid=prep-download-screen]")
    stated = await screen.evaluate(
        "node => ({ bytes: Number(node.dataset.bytes), deliveries: Number(node.dataset.deliveries),"
        " lines: Number(node.dataset.lines), total: Number(node.dataset.total),"
        " sales: node.dataset.sales })")
    name = (await page.locator("[data-testid=prep-download-file-name]").inner_text()).strip()
    size = (await page.locator("[data-testid=prep-download-size]").inner_text()).strip()
    measures = (await page.locator("[data-testid=prep-download-measures]").inner_text()).strip()
    check(name.endswith(".csv") and "CSV" in size and str(stated["bytes"]) in size.replace(",", ""),
          f"{tag}: the download screen states the file, its format and its exact size",
          f"{name} · {size}")
    check(f"{stated['deliveries']} deliver" in measures and f"{stated['lines']} line" in measures,
          f"{tag}: and the deliveries and lines the file carries", measures)

    async with page.expect_download(timeout=20_000) as pending:
        await page.locator("[data-testid=prep-download-file]").click()
    saved = await pending.value
    path = await saved.path()
    payload = pathlib.Path(path).read_bytes()
    check(saved.suggested_filename == name and len(payload) == stated["bytes"],
          f"{tag}: the saved file is the file the screen described",
          f"{saved.suggested_filename} · {len(payload)} bytes of {stated['bytes']}")
    check(payload[:3] == b"\xef\xbb\xbf", f"{tag}: the payload opens with the byte-order mark")

    text = payload.decode("utf-8-sig")
    lines = [line for line in text.split("\r\n") if line]
    head = parse_row(lines[0])
    rows = [parse_row(line) for line in lines[1:]]
    check(len(rows) == stated["deliveries"],
          f"{tag}: the file holds one row per delivery", f"{len(rows)} rows")
    delivery_column = head.index("Delivery") if "Delivery" in head else -1
    check(delivery_column == 0, f"{tag}: the delivery number opens every row", str(head))
    total_column = head.index("Order total") if "Order total" in head else -1
    summed = round(sum(float(row[total_column]) for row in rows), 2) if total_column >= 0 else -1
    check(total_column >= 0 and abs(summed - stated["total"]) < 0.005,
          f"{tag}: the file's money column sums to the total the screen offered",
          f"{summed} · screen {stated['total']}")

    notice = (await page.locator("[data-testid=prep-download-notice]").inner_text()).strip()
    check(name in notice and str(stated["bytes"]) in notice.replace(",", ""),
          f"{tag}: the notice names the file and what it weighs", notice)
    await page.screenshot(path=str(OUT / f"06-download-{tag}.png"), animations="disabled")
    await page.locator("[data-testid=export-back]").click()
    await page.locator("[data-testid=export-batch-hub]").wait_for()
    return stated


async def library_file_checks(page, tag):
    """The export centre's own download and its history say the same thing as Prep's screen."""
    await page.locator("[data-testid=prep-email-schedules]").click()
    await page.locator("[data-testid=export-library]").wait_for()
    files = page.locator("[data-testid=export-library-section-file]")
    await files.wait_for()
    # A category keeps its rows mounted behind a closed disclosure, so «the row exists» proves
    # nothing about whether a finger can reach it: the disclosure is opened first, by keyboard,
    # which needs no hit test inside a long scrolling library, and its 400 ms of travel is waited
    # out before anything is pressed.
    toggle = files.locator("button[aria-expanded]").first
    if await toggle.get_attribute("aria-expanded") == "false":
        await toggle.focus()
        await toggle.press("Enter")
        await page.wait_for_timeout(700)
    opener = files.locator('button[data-testid^="export-run-"]')
    await opener.first.wait_for()
    await opener.first.scroll_into_view_if_needed()
    await page.wait_for_timeout(200)
    await opener.first.click()
    await page.locator("[data-testid=export-configured-file-flow]").wait_for()
    async with page.expect_download(timeout=20_000) as pending:
        await page.locator("[data-testid=export-download-configured-file]").click()
    saved = await pending.value
    payload = pathlib.Path(await saved.path()).read_bytes()
    said = (await page.locator("[data-testid=export-file-download-status]").inner_text()).strip()
    check(saved.suggested_filename in said and str(len(payload)) in said.replace(",", ""),
          f"{tag}: the library's own download names the file and what it weighs", said)
    stated = (await page.locator("[data-testid=export-file-columns]").inner_text()).strip()
    head = payload.decode("utf-8-sig").split("\r\n")[0]
    check(stated.endswith(head.replace(",", ", ")),
          f"{tag}: and the screen named the columns the file writes", f"{stated} | {head}")
    tile = await page.locator("[data-testid=export-configured-file-flow] [data-output-column]").all_inner_texts()
    check(bool(tile) and [word.strip() for word in tile] == head.split(",")[:len(tile)],
          f"{tag}: the preview tile draws those same heads", str(tile))
    await page.get_by_label("Back to the library").click()
    await page.locator("[data-testid=export-library]").wait_for()
    await page.locator("[data-testid=export-recent-files-toggle]").click()
    await page.locator("[data-testid=export-recent-file-list]").wait_for()
    row = page.locator("[data-testid=export-recent-file-list] article").first
    recorded = await row.locator("[data-recent-file-bytes]").get_attribute("data-recent-file-bytes")
    words = " ".join((await row.inner_text()).split())
    check(recorded is not None and int(recorded) == len(payload)
          and str(len(payload)) in words.replace(",", ""),
          f"{tag}: the recent-files row records what that file weighed",
          f"{recorded} bytes · {words[:90]}")
    await row.scroll_into_view_if_needed()
    await page.wait_for_timeout(300)
    await page.screenshot(path=str(OUT / f"11-recent-files-{tag}.png"), animations="disabled")
    await page.locator("[data-testid=export-templates-back]").click()
    await page.locator("[data-testid=export-batch-hub]").wait_for()


async def main():
    servers = []
    if URL:
        url = URL.split("#", 1)[0]
    else:
        if not DIST:
            raise SystemExit("Set ROCOTO_DIST or ROCOTO_URL.")
        server, url = serve(str(pathlib.Path(DIST).resolve()))
        servers.append(server)

    async with async_playwright() as play:
        browser = await play.chromium.launch(args=["--no-sandbox"])
        context = await browser.new_context(viewport={"width": 390, "height": 844}, accept_downloads=True)
        await context.add_init_script(BOOT)
        page = await context.new_page()
        page.set_default_timeout(20_000)
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        await page.goto(url + "#/sales", wait_until="domcontentloaded")
        await page.locator("[data-testid=river]").wait_for()

        today = datetime.now(ZoneInfo("America/Lima")).date().isoformat()
        day_ids = await page.locator("[data-day-whisper]").evaluate_all(
            "nodes => nodes.map(node => node.getAttribute('data-day-whisper'))"
        )
        future_days = sorted(day for day in day_ids if day and day > today)
        check(bool(future_days), "fixture carries a future delivery day", str(future_days[:2]))
        future = future_days[0] if future_days else today

        sticky = await page.locator("[data-day-whisper]").first.evaluate(
            "node => getComputedStyle(node.parentElement).position"
        )
        check(sticky == "sticky", "Sales day headers are sticky", sticky)
        old_controls = await page.locator(
            'button[data-testid^="day-"][data-testid$="-paper"], button[data-testid^="day-"][data-testid$="-scope"]'
        ).count()
        check(old_controls == 0, "Sales day headers carry one print control per document", str(old_controls))

        await page.locator("[data-testid=export-centre]").click()
        await page.locator("[data-testid=export-batch-hub]").wait_for()
        await page.wait_for_timeout(450)
        await page.screenshot(path=str(OUT / "01-batch-hub-390.png"), animations="disabled")
        rows = page.locator("[data-testid=export-delivery-timeline] > [role=button]")
        check(await rows.count() > 0,
              "the batch hub shows upcoming deliveries")
        check(await page.locator("[data-testid=export-first-delivery]").inner_text() != "",
              "the batch hub states time until the first delivery")
        # The card was painted a beat before this read, so the minute that just rolled over is the
        # same clock: both the browser's minute and the one before it are accepted (measured red once
        # at 23:40 → 23:41 with the fix otherwise green).
        clocks = await page.evaluate("[0, 60000].map((back) => new Date(Date.now() - back).toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit', hour12:false}))")
        live_clock = await page.locator("[data-testid=prep-live-clock]").inner_text()
        check(any(live_clock.startswith(clock) for clock in clocks),
              "Prep uses the browser's live clock", f"{live_clock[:5]} vs {clocks}")
        check(await page.locator("[data-testid=export-other-date]").count() == 0,
              "Prep keeps date selection in Sales")
        check(await page.locator("[data-testid=prep-main-actions] button").all_inner_texts() == ["Print", "Download"],
              "Prep has the two named main actions")
        await page.locator("[data-testid=export-filters]").click()
        checklist = page.locator("[data-testid=export-filters-sheet]")
        await checklist.wait_for()
        checklist_box = await checklist.bounding_box()
        check(checklist_box["height"] > 650 and await page.locator("[data-testid=export-filter-apply]").is_visible(),
              "the salesperson list uses a full-screen checklist with Apply",
              f"{checklist_box['width']:.0f}×{checklist_box['height']:.0f}")
        await checklist.locator("[data-testid=workflow-back]").click()
        await checklist.wait_for(state="detached")
        await page.wait_for_timeout(600)

        await map_and_scroll_checks(page, "390")
        await scroll_outer(page.locator("[data-testid=prep-active-card]"), 0)
        await page.wait_for_timeout(450)
        await typed_address_checks(page, "390")
        await scroll_outer(page.locator("[data-testid=prep-active-card]"), 0)
        await page.wait_for_timeout(450)

        # ⚠ RETARGETED 2026-09-13 (FEED-IA §247.8). Every delivery used to draw its own mark, so the
        # first `map-order-` control was always standing. Dense marks are groups now, so the walk
        # opens groups until a mark stands alone and then presses that: the contract under test is
        # «a press on a mark opens that exact Delivery Note», which a group's own depth never moved.
        # ⚠ RETARGETED AGAIN 2026-09-14 (FEED-IA §247.8). Prep draws its map into one arm of the L
        # the clock card leaves — about 132×100 px at 320 — and a book of 350 deliveries inside one
        # metro area is ONE group there at every zoom that box can hold. So on a dense day this
        # picture can run out of room with every delivery still inside a count, and the walk that
        # ended there returned no mark at all (measured: «a mark stands alone on Prep's picture»
        # red, and the step after it raised). The product's answer is the picture with the room:
        # the last group states that it cannot be opened here and hands the press to the surface
        # around the map, which on Prep is the control that opens the delivery map screen. The walk
        # follows that press, and the contract under test is unchanged — «a press on a mark opens
        # that exact Delivery Note».
        way_out = page.locator("[data-testid=prep-status] [data-testid=map-cluster-back]")
        order_pin = await first_mark(page, "[data-testid=prep-status]")
        handed_on = order_pin is None
        if handed_on:
            last_group = page.locator(f'[data-testid=prep-status] {GROUPS}[data-opens="false"]')
            stating = await last_group.count()
            drawn_groups = await page.locator(f"[data-testid=prep-status] {GROUPS}").count()
            check(stating > 0,
                  "a picture with no mark left standing states the group it has no room to open",
                  f"{stating} of {drawn_groups} groups")
            if stating:
                await last_group.first.click()
                await page.wait_for_timeout(900)
            check(await page.locator("[data-testid=prep-map-screen]").count() == 1,
                  "a group this picture has no room to open hands the press to the delivery map",
                  f"{await page.locator('[data-testid=prep-map-screen]').count()} map screen")
            order_pin = await first_mark(page, "[data-testid=prep-map-screen]")
        check(order_pin is not None,
              "a mark stands alone on the picture that press reaches, on its own or inside a group",
              "the delivery map screen" if handed_on else "Prep's own picture")
        pin_id = await order_pin.get_attribute("data-order-id") if order_pin else ""
        if order_pin:
            await order_pin.click()
            await page.locator("[data-testid=prep-delivery-detail]").wait_for()
        pin_note_id = await page.locator("[data-testid=sale-detail]").get_attribute("data-sale")
        check(pin_note_id == pin_id and await page.locator("[data-testid=open-chat]").count() == 1,
              "a real map pin opens its exact Delivery Note and communication",
              f"pin {pin_id} -> note {pin_note_id}")
        await page.go_back()
        await page.locator("[data-testid=prep-delivery-detail]").wait_for(state="detached")
        if handed_on:
            # unwind the picture the press was handed to, innermost layer first, so the walk below
            # meets Prep exactly as it left it
            screen_way_out = page.locator("[data-testid=prep-map-screen] [data-testid=map-cluster-back]")
            if await screen_way_out.count():
                await screen_way_out.click()
                await page.wait_for_timeout(600)
            await page.go_back()
            await page.locator("[data-testid=prep-map-screen]").wait_for(state="detached")
        check(await page.locator("[data-testid=export-batch-hub]").count() == 1,
              "browser Back from a map pin returns to Prep")
        if await way_out.count():
            await way_out.click()
            await page.wait_for_timeout(600)
        check(await way_out.count() == 0,
              "and «Show all» returns Prep's picture to the whole window")
        await rows.first.locator("button").focus()
        await rows.first.locator("button").press("Enter")
        await page.locator("[data-testid=prep-map-screen]").wait_for()
        # ⚠ RETARGETED 2026-09-13 (FEED-IA §247.8): the shared map holds every delivery that has a
        # point, as a mark of its own or as a member a group names.
        screen_alone, screen_members = await marks_in(page, "[data-testid=prep-map-screen]")
        map_pins = len(screen_alone) + len(screen_members)
        # THE PICTURE HOLDS EVERY DELIVERY THAT HAS A POINT (FEED-IA §246). A typed address has none,
        # and the card's own line says how many those are.
        drawable = await rows.count() - await page.locator(
            '[data-testid=export-delivery-timeline] [data-testid^="prep-address-"]').count()
        check(await page.locator("[data-testid=prep-map-screen] [data-testid=pin-map]").count() == 1
              and map_pins == drawable
              and await page.locator("[data-testid=prep-delivery-detail]").count() == 0,
              "Enter on a delivery map opens the shared map with every delivery on it",
              f"{map_pins} deliveries of {drawable} with a point ·"
              f" {len(screen_alone)} marks · {len(screen_members)} in groups")
        screen_box = await page.locator("[data-testid=prep-map-screen] [data-testid=pin-map] > div").bounding_box()
        screen_frames = await page.locator(
            '[data-testid=prep-map-screen] [data-testid^="map-order-"],'
            f' [data-testid=prep-map-screen] {GROUPS}').evaluate_all(
            "nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; })")
        screen_outside = [f for f in screen_frames
                          if f[0] < screen_box["x"] - 1 or f[1] < screen_box["y"] - 1
                          or f[2] > screen_box["x"] + screen_box["width"] + 1
                          or f[3] > screen_box["y"] + screen_box["height"] + 1]
        check(not screen_outside, "the nested map holds every mark and every group inside its own box",
              f"{len(screen_outside)} of {len(screen_frames)} outside")
        opened = (await rows.first.get_attribute("data-testid")).replace("prep-delivery-", "")
        titled = " ".join((await page.locator("[data-testid=prep-map-screen]").inner_text()).split())
        drop = page.locator(f'[data-testid=prep-map-screen] [data-testid="map-order-{opened}"]')
        marked = await drop.get_attribute("data-drop")
        customer = " ".join((await rows.first.inner_text()).split("\n")[1].split())
        check(marked == "true" and customer.split(" · ")[0] in titled,
              "the nested map marks the delivery it is titled after",
              f"{opened} · drop {marked} · «{titled[:48]}»")
        await page.screenshot(path=str(OUT / "01c-map-screen-390.png"), animations="disabled")
        # ── THE NESTED MAP GROUPS ITS MARKS TOO, AND ITS BACK STEPS NEST (FEED-IA §247.8) ──────
        # This picture has the room the background picture lacks — no clock card over it and more
        # than twice the height — so it is where a group opens into several smaller ones. Its
        # `cluster_checks` ends on a browser Back, which is the step that proves the nesting: the
        # innermost layer is the narrowing, so Back shows the whole window and the screen stands.
        await cluster_checks(page, "[data-testid=prep-map-screen]", "390 map screen", shots="390-screen")
        check(await page.locator("[data-testid=prep-map-screen]").count() == 1,
              "the nested map is still open after its own Back step")
        await page.go_back()
        await page.locator("[data-testid=prep-map-screen]").wait_for(state="detached")
        check(await page.locator("[data-testid=export-batch-hub]").count() == 1,
              "browser Back closes the nested map and keeps Prep")
        await rows.first.focus()
        await rows.first.press("Enter")
        await page.locator("[data-testid=prep-delivery-detail]").wait_for()
        check(await page.locator("[data-testid=prep-delivery-detail] [data-testid=sale-detail]").count() == 1,
              "Enter on a delivery row opens the shared Delivery Note")
        check(await page.locator("[data-testid=prep-go-sales]").count() == 1,
              "the nested Delivery Note offers Go to sales")
        await page.go_back()
        await page.locator("[data-testid=prep-delivery-detail]").wait_for(state="detached")
        check(await page.locator("[data-testid=export-batch-hub]").count() == 1,
              "browser Back closes the nested Delivery Note and keeps Prep")
        batch_ids = await rows.evaluate_all("nodes => nodes.filter(node => node.dataset.prepTime === nodes[0].dataset.prepTime && node.dataset.prepDay === nodes[0].dataset.prepDay).map(node => node.getAttribute('data-testid').replace('prep-delivery-', ''))")
        stated = await download_checks(page, "390")
        check(stated["sales"].split(",") == batch_ids,
              "Download opens on the same upcoming batch ids as Print",
              f"{len(batch_ids)} ids")

        await library_file_checks(page, "390")

        inventory = await page.evaluate(
            "JSON.parse(localStorage.getItem('rocoto-workspace-capabilities:fish')).inventory"
        )
        check(inventory is False, "the proof house has Inventory switched off", str(inventory))
        packing = page.locator("[data-testid=export-prepare-packing]")
        check(await packing.is_visible() and not await packing.is_disabled(),
              "Packing list remains available with Inventory switched off")
        batch_packing_count = int(await page.locator("[data-testid=export-batch-hub]").get_attribute("data-packing"))
        batch_day = await rows.first.get_attribute("data-prep-day")
        await packing.click()
        await page.locator("[data-testid=print-screen]").wait_for()
        check(await page.locator("[data-testid=print-screen-title]").inner_text() == "Packing list",
              "Packing list opens as a usable document")
        check(await page.locator("[data-testid=packing-order]").count() > 0,
              "Packing list contains working order rows")
        # THE PHONE KEEPS THE COMPACT RATIO (FEED-IA §246, lead decision 10). Its foot has one line
        # and the noun stands in the scope block two rows above it.
        phone_place = " ".join((await page.locator("[data-testid=print-run-place]").inner_text()).split())
        check(bool(re.fullmatch(r"\d+/\d+", phone_place)),
              "the phone pager keeps the compact ratio", phone_place)
        selected = await page.locator("[data-testid=print-period-selected]").get_attribute("aria-checked")
        selected_count = int((await page.locator("[data-testid=print-scope-count]").inner_text()).split()[0])
        check(selected == "true" and selected_count == batch_packing_count,
              "Packing list opens on the exact set the hub still owes the bay",
              f"{selected_count} selected · {batch_packing_count} owed on the hub")
        picker = page.locator("[data-testid=print-delivery-picker]")
        await picker.click()
        delivery_checklist = page.locator("[data-testid=print-delivery-checklist]")
        await delivery_checklist.wait_for()
        delivery_box = await delivery_checklist.bounding_box()
        first_choice = delivery_checklist.locator('input[type="checkbox"]').first
        await first_choice.click()
        await page.go_back()
        await delivery_checklist.wait_for(state="detached")
        check(delivery_box["height"] > 650 and await page.locator("[data-testid=print-screen]").count() == 1
              and int((await page.locator("[data-testid=print-scope-count]").inner_text()).split()[0]) == selected_count,
              "the delivery checklist is full-screen and browser Back discards its draft",
              f"{delivery_box['width']:.0f}×{delivery_box['height']:.0f}")
        await picker.click()
        await delivery_checklist.locator('input[type="checkbox"]').first.click()
        await page.locator("[data-testid=print-delivery-apply]").click()
        applied_count = int((await page.locator("[data-testid=print-scope-count]").inner_text()).split()[0])
        check(applied_count != selected_count, "Apply commits the delivery checklist selection",
              f"{selected_count} -> {applied_count}")
        await page.wait_for_timeout(450)
        await page.screenshot(path=str(OUT / "02-packing-stock-off-390.png"), animations="disabled")
        await page.locator("[data-testid=print-period-day]").click()
        scope_day = await page.locator("[data-testid=print-scope-day]").input_value()
        check(scope_day == batch_day, "the print scope follows the live next batch",
              f"{scope_day} expected {batch_day}")
        await page.screenshot(path=str(OUT / "02b-current-day-390.png"), animations="disabled")

        # ── FIVE NUMBERS, FIVE NOUNS ───────────────────────────────────────────────────────────
        run = page.locator("[data-testid=print-run]")
        counts = await run.evaluate(
            "node => ({ deliveries: Number(node.dataset.orders), documents: Number(node.dataset.documents),"
            " dividers: Number(node.dataset.dividers), copies: Number(node.dataset.copies),"
            " sheets: Number(node.dataset.sheets), trucks: Number(node.dataset.trucks) })")
        check(counts["sheets"] == counts["documents"] * counts["copies"] and counts["copies"] == 1
              and counts["documents"] >= counts["dividers"],
              "the run states deliveries, documents, dividers, copies and sheets", str(counts))
        await page.locator("[data-testid=print-screen-mode-edit]").click()
        await page.locator("[data-testid=template-copies-2]").click()
        await page.wait_for_timeout(300)
        doubled = await run.evaluate(
            "node => ({ deliveries: Number(node.dataset.orders), documents: Number(node.dataset.documents),"
            " copies: Number(node.dataset.copies), sheets: Number(node.dataset.sheets) })")
        check(doubled["copies"] == 2 and doubled["sheets"] == doubled["documents"] * 2
              and doubled["deliveries"] == counts["deliveries"],
              "two copies double the sheets and leave the deliveries alone",
              f"{counts['sheets']} -> {doubled['sheets']} sheets · {doubled['deliveries']} deliveries")
        await page.locator("[data-testid=print-screen-mode-preview]").click()
        await page.locator("[data-testid=print-run-close]").click()
        if await page.locator("[data-testid=print-screen-discard]").count():
            await page.locator("[data-testid=print-screen-discard]").click()
        await page.locator("[data-testid=print-screen]").wait_for(state="detached")
        await page.locator("[data-testid=export-batch-hub]").wait_for()
        await page.locator("[data-testid=export-close]").click()
        await page.locator("[data-testid=export-modal]").wait_for(state="detached")

        direct = page.locator(f'button[data-testid="day-albaranes-{today}"]')
        check(await direct.count() == 1, "today's Sales print control stands once", str(await direct.count()))
        await direct.scroll_into_view_if_needed()
        await direct.click()
        await page.locator("[data-testid=print-screen]").wait_for()
        check(await page.locator("[data-testid=print-scope]").count() == 1,
              "the direct day control opens the scoped preview")
        await page.go_back()
        await page.locator("[data-testid=print-screen]").wait_for(state="detached")
        check(await page.locator("[data-testid=river]").count() == 1,
              "browser Back closes exactly the direct print layer")
        await page.go_forward()
        await page.locator("[data-testid=print-screen]").wait_for()
        check(await page.locator("[data-testid=print-scope]").count() == 1,
              "browser Forward restores the direct print layer")

        await page.locator("[data-testid=print-period-range]").click()
        empty_day = (datetime.fromisoformat(today) + timedelta(days=45)).date().isoformat()
        await page.locator("[data-testid=print-scope-day]").fill(empty_day)
        await page.locator("[data-testid=print-scope-through]").fill(empty_day)
        await page.locator("[data-testid=print-scope-remaining]").click()
        await page.locator("[data-testid=print-scope-empty]").wait_for()
        check((await page.locator("[data-testid=print-scope-count]").inner_text()).startswith("0 "),
              "an empty range resolves Remaining to zero")
        empty_counts = await page.locator("[data-testid=print-run]").evaluate(
            "node => [node.dataset.orders, node.dataset.documents, node.dataset.sheets].join('/')")
        check(empty_counts == "0/0/0", "an empty scope prints nothing at all", empty_counts)
        empty_words = " ".join((await page.locator("[data-testid=print-scope-empty]").inner_text()).split())
        check(empty_words == "This scope is complete Choose All ready, another period, or selected deliveries.",
              "zero Remaining offers a meaningful next step", empty_words)
        check(await page.locator("[data-testid=print-run-albaranes]").is_disabled(),
              "zero Remaining keeps the print action at rest")
        await page.wait_for_timeout(450)
        await page.screenshot(path=str(OUT / "03-zero-remaining-390.png"), animations="disabled")

        await page.locator("[data-testid=print-scope-day]").fill(future)
        await page.locator("[data-testid=print-scope-through]").fill(future)
        await page.locator("[data-testid=print-scope-all]").click()
        run = page.locator("[data-testid=print-run]")
        source_ids = [value for value in (await run.get_attribute("data-sales") or "").split("|") if value]
        count = int((await page.locator("[data-testid=print-scope-count]").inner_text()).split()[0])
        check(count == len(source_ids) and count > 0,
              "the changed range resolves its current source ids", f"{count} · {source_ids[:3]}")
        many = await run.evaluate(
            "node => ({ deliveries: Number(node.dataset.orders), documents: Number(node.dataset.documents),"
            " dividers: Number(node.dataset.dividers), sheets: Number(node.dataset.sheets),"
            " trucks: Number(node.dataset.trucks) })")
        check(many["trucks"] > 1 and many["dividers"] == many["trucks"]
              and many["documents"] == many["deliveries"] + many["dividers"],
              "a run across several trucks counts its dividers as documents of their own", str(many))
        act = page.locator("[data-testid=print-run-albaranes]")
        check((await act.inner_text()).strip() == f"Print {count} deliveries",
              "the primary action counts the deliveries it is about", (await act.inner_text()).strip())
        await page.wait_for_timeout(450)
        await page.screenshot(path=str(OUT / "04-range-print-390.png"), animations="disabled")
        async with context.expect_page(timeout=20_000) as popup_info:
            await act.click()
        popup = await popup_info.value
        await popup.locator("#rocoto-print-document").wait_for()
        printed_ids = await popup.locator("[data-testid=albaran-paper-identity]").evaluate_all(
            "nodes => [...new Set(nodes.map(node => node.getAttribute('data-sale')).filter(Boolean))]"
        )
        check(sorted(printed_ids) == sorted(source_ids),
              "the print popup uses the current filtered ids",
              f"source {len(source_ids)} · printed {len(printed_ids)}")
        await popup.close()
        await page.wait_for_timeout(450)
        await page.screenshot(path=str(OUT / "05-print-requested-390.png"), animations="disabled")
        check(not errors, "the workflow raises zero page errors", errors[0][:160] if errors else "")
        await context.close()

        # ── THE DESK, AND THE NARROWEST PHONE ─────────────────────────────────────────────────
        for width, height, tag in ((1600, 900, "1600"), (320, 720, "320")):
            wide = await browser.new_context(viewport={"width": width, "height": height}, accept_downloads=True)
            await wide.add_init_script(BOOT)
            sheet = await wide.new_page()
            sheet.set_default_timeout(20_000)
            wide_errors: list[str] = []
            sheet.on("pageerror", lambda error, collected=wide_errors: collected.append(str(error)))
            await open_prep(sheet, url)
            await sheet.screenshot(path=str(OUT / f"07-batch-hub-{tag}.png"), animations="disabled")
            await map_and_scroll_checks(sheet, tag)
            await scroll_outer(sheet.locator("[data-testid=prep-active-card]"), 0)
            await sheet.wait_for_timeout(450)
            await typed_address_checks(sheet, tag)
            await scroll_outer(sheet.locator("[data-testid=prep-active-card]"), 0)
            await sheet.wait_for_timeout(450)
            if width >= 390:
                await download_checks(sheet, tag)
            if width >= 1024:
                # ── THE DESK PAGER NAMES WHAT IT COUNTS ──────────────────────────────────────
                # «2/113» beside «105 deliveries», «113 documents · 8 truck dividers» and a
                # document labelled «Truck 3 · 3 packing lists» was a bare ratio on a screen
                # carrying four counts, and the reader had to work out which one it belonged to.
                await sheet.locator("[data-testid=export-prepare-packing]").click()
                await sheet.locator("[data-testid=print-screen]").wait_for()
                await sheet.wait_for_timeout(700)
                place = " ".join((await sheet.locator("[data-testid=print-run-place]").inner_text()).split())
                check(bool(re.fullmatch(r"\d+ of \d+ documents?", place)),
                      f"{tag}: the desk pager names the documents it counts", place)
                await sheet.screenshot(path=str(OUT / f"18-print-pager-{tag}.png"), animations="disabled")
                await sheet.locator("[data-testid=print-run-close]").click()
                if await sheet.locator("[data-testid=print-screen-discard]").count():
                    await sheet.locator("[data-testid=print-screen-discard]").click()
                await sheet.locator("[data-testid=print-screen]").wait_for(state="detached")
                await sheet.locator("[data-testid=export-batch-hub]").wait_for()
            overflow = await sheet.evaluate(
                "() => document.documentElement.scrollWidth - document.documentElement.clientWidth")
            check(overflow <= 0, f"{tag}: the surface keeps its own width", str(overflow))
            check(not wide_errors, f"{tag}: Prep raises zero page errors",
                  wide_errors[0][:160] if wide_errors else "")
            await wide.close()

        # ── AND A WINDOW WHERE EVERY DOOR WAS TYPED ───────────────────────────────────────────
        for width, height, tag in ((390, 844, "typed-390"), (1600, 900, "typed-1600"), (320, 720, "typed-320")):
            await typed_only_checks(browser, url, width, height, tag)

        # ── THE GOOGLE GROUND HANDS BACK THE PICTURE ──────────────────────────────────────────
        maps = await browser.new_context(viewport={"width": 390, "height": 844}, accept_downloads=True)
        await maps.add_init_script(GOOGLE_BOOT)
        asked: list[str] = []

        async def refuse(route):
            asked.append(route.request.url)
            await route.abort()

        await maps.route("https://maps.googleapis.com/**", refuse)
        ground = await maps.new_page()
        ground.set_default_timeout(20_000)
        maps_errors = []
        ground.on("pageerror", lambda error: maps_errors.append(str(error)))
        await open_prep(ground, url)
        await ground.wait_for_timeout(1500)
        check(bool(asked), "a configured key asks Google for the ground", str(len(asked)))
        # ── ONE LOAD, AND THE METERED STILL PICTURE NOWHERE (FEED-IA §247) ────────────────────
        # Prep mounts one thumbnail per upcoming delivery. While those asked Google for a still
        # picture each, ONE screen open cost 129 Static Maps requests before anybody scrolled.
        api_js = [one for one in asked if "/maps/api/js" in one]
        static = [one for one in asked if "staticmap" in one]
        check(len(api_js) == 1 and not static,
              "one screen open costs one Maps JavaScript load and no Static Maps request",
              f"{len(api_js)} js · {len(static)} static · {len(asked)} in all")
        picture = ground.locator("[data-testid=prep-status] [data-testid=pin-map]")
        check(await picture.get_attribute("data-ground") == "tiles",
              "a refused Google ground falls back to the checked-in tiles",
              await picture.get_attribute("data-ground") or "")
        fallback_alone, fallback_members = await marks_in(ground, "[data-testid=prep-status]")
        fallback_pins = len(fallback_alone) + len(fallback_members)
        fallback_rows = await ground.locator("[data-testid=export-delivery-timeline] > [role=button]").count()
        fallback_typed = await ground.locator(
            '[data-testid=export-delivery-timeline] [data-testid^="prep-address-"]').count()
        check(fallback_pins + fallback_typed == fallback_rows and fallback_pins > 0,
              "the fallback keeps every delivery on the map",
              f"{fallback_pins} deliveries ({len(fallback_alone)} marks, {len(fallback_members)} in groups)"
              f" · {fallback_typed} typed addresses · {fallback_rows} rows")
        check(not maps_errors, "the fallback raises zero page errors",
              maps_errors[0][:160] if maps_errors else "")
        await ground.screenshot(path=str(OUT / "10-google-fallback-390.png"), animations="disabled")
        await maps.close()

        # ── AND A GROUND THAT ACTUALLY LOADS KEEPS OUR OWN CONTROLS ──────────────────────────
        # The published Maps API needs an account, so the proof answers the loader itself with the
        # slice `google-ground.ts` declares — a Map, and an OverlayView with a pane and a linear
        # projection. It proves OUR contract on that seam: the marks on Google's ground are the
        # same DOM controls, with the same sale ids, opening the same Delivery Note, outside the
        # tab order, and Google's own attribution stands in place of the files' credit.
        stubbed = await browser.new_context(viewport={"width": 390, "height": 844}, accept_downloads=True)
        await stubbed.add_init_script(GOOGLE_BOOT)

        async def answer(route):
            await route.fulfill(status=200, content_type="application/javascript", body=MAPS_STUB)

        # ⚠ PLAYWRIGHT MATCHES ROUTES IN REVERSE REGISTRATION ORDER, so the catch-all that keeps
        # every other Google road shut goes on FIRST and the answered loader goes on after it.
        await stubbed.route("https://maps.googleapis.com/**", lambda route: route.abort())
        await stubbed.route("https://maps.googleapis.com/maps/api/js*", answer)
        shown = await stubbed.new_page()
        shown.set_default_timeout(20_000)
        stub_errors = []
        shown.on("pageerror", lambda error: stub_errors.append(str(error)))
        await open_prep(shown, url)
        await shown.wait_for_timeout(1500)
        picture = shown.locator("[data-testid=prep-status] [data-testid=pin-map]")
        check(await picture.get_attribute("data-ground") == "google"
              and await shown.locator("[data-testid=map-google-ground]").count() == 1,
              "a Maps API that loads draws Google's ground",
              await picture.get_attribute("data-ground") or "")
        stub_rows = shown.locator("[data-testid=export-delivery-timeline] > [role=button]")
        stub_drawn = shown.locator('[data-testid=prep-status] [data-testid^="map-order-"],'
                                   f' [data-testid=prep-status] {GROUPS}')
        stub_row_ids = await stub_rows.evaluate_all(
            "nodes => nodes.map(node => node.getAttribute('data-testid').replace('prep-delivery-', ''))")
        # ⚠ RETARGETED 2026-09-13 (FEED-IA §247.8): the two grounds draw ONE picture, so the groups
        # are on Google's pane exactly as they are on the files, standing at the mean of their own
        # members' projected points.
        stub_alone, stub_members = await marks_in(shown, "[data-testid=prep-status]")
        stub_pin_ids = stub_alone + stub_members
        stub_typed_ids = await shown.locator(
            '[data-testid=export-delivery-timeline] [data-testid^="prep-address-"]').evaluate_all(
            "nodes => nodes.map(node => node.getAttribute('data-testid').replace('prep-address-', ''))")
        check(bool(stub_pin_ids) and sorted(stub_pin_ids + stub_typed_ids) == sorted(stub_row_ids),
              "and our own marks stand on it, carrying the listed sale ids",
              f"{len(stub_row_ids)} rows · {len(stub_alone)} marks · {len(stub_members)} in groups"
              f" · {len(stub_typed_ids)} typed addresses")
        check(await stub_drawn.evaluate_all("nodes => nodes.filter(node => node.tabIndex !== -1).length") == 0,
              "the marks on Google's ground keep the same keyboard posture")
        await cluster_checks(shown, "[data-testid=prep-status]", "google ground", shots="google",
                             avoid="[data-testid=prep-status] > div:last-of-type")
        check(await shown.locator("[data-testid=prep-status] [data-testid=map-tile-ground]").count() == 0
              and await shown.locator("[data-testid=prep-status] [data-testid=map-credit]").count() == 0,
              "Google's own attribution stands on Google's map")
        # AND THE THUMBNAILS STAY ON THE FILES, which is what keeps one screen open at one load.
        thumbs = shown.locator('[data-testid=export-delivery-timeline] [data-testid=pin-map]')
        grounds = await thumbs.evaluate_all("nodes => [...new Set(nodes.map(node => node.dataset.ground))]")
        check(grounds == ["tiles"] and await thumbs.count() > 1,
              "every row thumbnail draws the checked-in files even with a key",
              f"{await thumbs.count()} thumbnails · {grounds}")
        await shown.screenshot(path=str(OUT / "12-google-ground-390.png"), animations="disabled")
        # ⚠ RETARGETED 2026-09-14: the same walk as the checked-in ground's — a dense day can leave
        # Prep's small picture with every delivery inside a count, and its last group hands the
        # press to the delivery map screen, which is the picture with the room to open it.
        target = await first_mark(shown, "[data-testid=prep-status]")
        google_handed_on = target is None
        if google_handed_on:
            google_last = shown.locator(f'[data-testid=prep-status] {GROUPS}[data-opens="false"]')
            if await google_last.count():
                await google_last.first.click()
                await shown.wait_for_timeout(900)
            check(await shown.locator("[data-testid=prep-map-screen]").count() == 1,
                  "a group Google's picture has no room to open hands the press to the delivery map")
            target = await first_mark(shown, "[data-testid=prep-map-screen]")
        check(target is not None, "a mark stands alone on Google's ground, on its own or inside a group",
              "the delivery map screen" if google_handed_on else "Prep's own picture")
        target_id = await target.get_attribute("data-order-id") if target else ""
        if target:
            await target.click()
            await shown.locator("[data-testid=prep-delivery-detail]").wait_for()
        opened_id = await shown.locator("[data-testid=sale-detail]").get_attribute("data-sale")
        check(opened_id == target_id,
              "and a press on one opens that exact Delivery Note", f"{target_id} -> {opened_id}")

        # ── WHAT A SESSION COSTS, COUNTED (FEED-IA §247) ──────────────────────────────────────
        # The <script> is fetched once per page whatever the book holds, so a request counter can
        # never see this. `new api.Map` is the metered unit and each open picture builds its own:
        # Prep, a row's map screen, and a Delivery Note's own map are three open at once, and
        # closing the note gives one back. The stub counts the constructions; the live number is
        # the hosts still in the document.
        # ⚠ RETARGETED 2026-09-14. Before: the constructions were counted from the top of the
        # session against a fixed three, which held only while this walk opened three pictures in
        # its whole life. The §247.8 walk above now opens the delivery map screen first — a dense
        # Prep picture hands it the press — closes it, and opens it again here, so the session
        # builds four maps for four pictures opened. What the product promises is ONE LOAD PER
        # PICTURE OPENED, and that is what is measured now: a delta taken from the moment Prep
        # stands alone again, so the claim reads the same whichever way the walk above went.
        live = "() => document.querySelectorAll('[data-stub-map]').length"
        loads = "() => window.__ROCOTO_MAPS_BUILT"
        await shown.go_back()
        await shown.locator("[data-testid=prep-delivery-detail]").wait_for(state="detached")
        if google_handed_on:
            # close the picture that press was handed to, innermost layer first, so the count below
            # starts from Prep's one map exactly as it did before the walk
            google_way_out = shown.locator("[data-testid=prep-map-screen] [data-testid=map-cluster-back]")
            if await google_way_out.count():
                await google_way_out.click()
                await shown.wait_for_timeout(600)
            await shown.go_back()
            await shown.locator("[data-testid=prep-map-screen]").wait_for(state="detached")
        prep_way_out = shown.locator("[data-testid=prep-status] [data-testid=map-cluster-back]")
        if await prep_way_out.count():
            await prep_way_out.click()
            await shown.wait_for_timeout(600)
        await shown.wait_for_timeout(500)
        one_open = await shown.evaluate(live)
        one_built = await shown.evaluate(loads)
        await shown.locator('[data-testid=export-delivery-timeline] button[data-testid^="prep-map-"]').first.click()
        await shown.locator("[data-testid=prep-map-screen]").wait_for()
        await shown.wait_for_timeout(900)
        two_open = await shown.evaluate(live)
        two_built = await shown.evaluate(loads)
        # ⚠ RETARGETED 2026-09-13: a dense nested map can hold every delivery inside a group, so the
        # walk opens groups until a mark stands. Opening a group redraws the picture inside the one
        # map instance it already built, which is what keeps this count about map LOADS.
        nested_mark = await first_mark(shown, "[data-testid=prep-map-screen]")
        check(nested_mark is not None, "a mark stands alone on the nested map over Google's ground")
        await nested_mark.click()
        await shown.locator("[data-testid=prep-delivery-detail]").wait_for()
        await shown.locator("[data-testid=prep-delivery-detail] [data-testid=map-square]").click()
        await shown.locator("[data-testid=prep-delivery-detail] [data-testid=pin-map][data-fit=place]").last.wait_for()
        await shown.wait_for_timeout(900)
        three_open = await shown.evaluate(live)
        built = await shown.evaluate(loads)
        check(one_open == 1 and two_open == 2 and three_open == 3
              and two_built == one_built + 1 and built == one_built + 2,
              "one map load per picture a person opens, three pictures open at the most",
              f"Prep {one_open} · map screen {two_open} · Delivery Note {three_open}"
              f" · loads {one_built} -> {two_built} -> {built}")
        await shown.go_back()
        await shown.locator("[data-testid=prep-delivery-detail]").wait_for(state="detached")
        await shown.wait_for_timeout(600)
        after_note = await shown.evaluate(live)
        check(after_note == 2 and await shown.evaluate(loads) == built,
              "and closing the Delivery Note gives its load back", f"{three_open} -> {after_note}")
        # ── AND THE NESTED MAP GROUPS ITS MARKS ON GOOGLE'S PANE TOO (FEED-IA §247.8) ─────────
        # ⚠ ADDED 2026-09-14: this is the picture that has BOTH a drop and the room to narrow, and
        # it was the one picture the suite never asked. Measured on the build before this one, at
        # 320 over Google's ground, a group stood 9px from the delivery the screen is titled after
        # and took no press at all — the clearing was applied to the tile placements and thrown
        # away when Google's projection took the mean again. Google is the ground the published
        # build uses, so the two grounds are asked the same question on the same picture.
        await shown.wait_for_timeout(400)
        await cluster_checks(shown, "[data-testid=prep-map-screen]", "google map screen", shots="google-screen")
        check(await shown.locator("[data-testid=prep-map-screen]").count() == 1,
              "the nested map over Google's ground is still open after its own Back step")
        check(not stub_errors, "the Google ground raises zero page errors",
              stub_errors[0][:160] if stub_errors else "")
        await stubbed.close()

        # ── THE SAME MEASUREMENTS ON THE CASTELLANO ENTRY (FEED-IA §246) ──────────────────────
        # The card's own height is what decides whether the fit can clear it, and the Spanish card
        # says «Próximo reparto …» in words of its own length. The English build was the only one
        # ever driven, so one line of translated copy could have put the marks back under the card
        # with nothing going red. The build publishes `/cedar/es/` beside `/cedar/`; this walks it.
        spanish_root = url.rsplit("/", 1)[0] + "/cedar/es/"
        spanish_index = pathlib.Path(DIST).resolve() / "cedar" / "es" / "index.html" if DIST else None
        if spanish_index is None or spanish_index.exists():
            for width, height, tag in ((390, 844, "es-390"), (1600, 900, "es-1600")):
                castellano = await browser.new_context(viewport={"width": width, "height": height})
                await castellano.add_init_script(BOOT)
                es = await castellano.new_page()
                es.set_default_timeout(20_000)
                es_errors: list[str] = []
                es.on("pageerror", lambda error, collected=es_errors: collected.append(str(error)))
                await open_prep(es, spanish_root)
                await es.wait_for_timeout(500)
                await es.screenshot(path=str(OUT / f"16-prep-{tag}.png"), animations="disabled")
                # ⚠ RETARGETED 2026-09-13 (FEED-IA §247.8): the Castellano picture groups its dense
                # marks the same way, and both kinds of control have to keep out of the same card.
                es_pins = es.locator('[data-testid=prep-status] [data-testid^="map-order-"],'
                                     f' [data-testid=prep-status] {GROUPS}')
                es_clock = await es.locator("[data-testid=prep-status] > div").last.bounding_box()
                es_covered = await es_pins.evaluate_all(
                    "(nodes, card) => nodes.filter(node => { const r = node.getBoundingClientRect();"
                    " return r.left < card.x + card.width && r.right > card.x"
                    " && r.top < card.y + card.height && r.bottom > card.y; }).length", es_clock)
                check(es_covered == 0 and await es_pins.count() > 0,
                      f"{tag}: every mark stands clear of the Castellano clock card",
                      f"{es_covered} of {await es_pins.count()} under a {es_clock['width']:.0f}×{es_clock['height']:.0f} card")
                es_alone, es_members = await marks_in(es, "[data-testid=prep-status]")
                es_facts = await map_facts(es, "[data-testid=prep-status]")
                check(len(es_alone) + len(es_members) == es_facts["markers"] == es_facts["drawn"]
                      and es_facts["clusters"] > 0,
                      f"{tag}: and the Castellano picture groups its dense marks the same way",
                      f"{es_facts['clusters']} groups · {len(es_alone)} marks · {es_facts['markers']} deliveries")
                # ⚠ ADDED 2026-09-14: the Castellano card is the taller one, so it is the picture
                # with the least room for the marks — and the press is what a person does with
                # them. `elementFromPoint` at every control's centre, in the second language.
                es_lost, es_asked = await covered_controls(es, "[data-testid=prep-status]")
                check(not es_lost, f"{tag}: and every Castellano control takes its own press",
                      f"{len(es_lost)} of {es_asked} covered · {es_lost[:3]}")
                es_fit = await es.locator("[data-testid=prep-status] [data-testid=pin-map]").evaluate(
                    "node => ({ fitted: node.dataset.fitted, zoom: node.dataset.zoom, ground: node.dataset.ground })")
                check(es_fit["fitted"] == "true", f"{tag}: and the Castellano picture says it fitted", str(es_fit))
                es_words = " ".join((await es.locator("[data-testid=export-first-delivery]").inner_text()).split())
                check(es_words != "" and not es_words.startswith("Next batch"),
                      f"{tag}: the Castellano entry is serving Castellano", es_words)
                check(not es_errors, f"{tag}: the Castellano Prep raises zero page errors",
                      es_errors[0][:160] if es_errors else "")
                await castellano.close()
        else:
            check(False, "the build publishes a Castellano entry at /cedar/es/", str(spanish_index))

        await browser.close()

    for server in servers:
        server.shutdown()
    print(f"TOTAL {len(GREEN)} GREEN / {len(RED)} RED", flush=True)
    if RED:
        for name in RED:
            print("  RED " + name, flush=True)
        raise SystemExit(1)


asyncio.run(main())
