#!/usr/bin/env python3
"""build-map-tiles.py — the world, checked in (FEED-IA §25, §86.7).

«The location has to be a PIN. Real map. Not some custom made map» (§25), and then, on top of
it: «the map, can we not use mapbox or some shit? and ensure we have the quota, don't want a
bill because of some accidental operation» (§86.7).

═══ THE LAW THIS FILE EXISTS TO KEEP ═══════════════════════════════════════════════════════════
THE RUNTIME APP NEVER CALLS A METERED API. The ground under the pin is a grid of `<img>` served
from `public/map/`, so a person opening a document a hundred times costs nothing, reaches no tile
server, and cannot be made to. That guarantee is structural, not a setting somebody could change:

  · the tiles are BUILT ONCE, here, by hand, and committed
  · this tool is HARD-CAPPED — it refuses to run past MAX_TILES, so a coordinate typo in the cast
    can never turn into a country-sized crawl
  · it prints its request count, every run, so the cost of a run is a number on the terminal
  · THERE IS NO TOKEN. Not in the repo, not in the environment, not anywhere: the source below
    has no account, no key and no meter, so there is no bill to accidentally run up

═══ WHY THE GROUND IS RENDERED HERE RATHER THAN DOWNLOADED FROM A TILE SERVER ══════════════════
Every hosted tile service forbids exactly the thing the law above requires — pre-fetching tiles
and keeping them. Checked, honestly, before this was written:

  · OpenStreetMap's own Tile Usage Policy: «You must not: Bulk download ("scrape") tiles or offer
    prefetch features.» The tiles this file replaces were fetched against that sentence.
  · CARTO Basemaps T&C §9.c bans «downloading or extracting map content in bulk» and «proxying or
    caching the content on the server side», and caps any device cache at thirty days; their
    raster basemaps now also require an API key and are being retired.
  · Mapbox Product Terms (2026-06) §1.9: the customer «shall … (ii) not perform bulk or automated
    queries, (iii) not scrape or systematically download Licensed Map Content, … (v) not export,
    download, cache or store Licensed Map Content», and §2.8.1 forbids showing map content «by
    using a screenshot or other static image instead of accessing … directly from the Mapping
    APIs». A Mapbox token is not the missing piece; Mapbox forbids the architecture.

So the tiles are not taken from anybody's service. They are RENDERED, here, from openly licensed
parts, which is the one way to hold both halves of §86.7 at once:

  · the DATA is OpenStreetMap, ODbL — free to use, share and adapt, with attribution
  · the VECTOR TILES come from OpenFreeMap (https://openfreemap.org), which is open source end to
    end and states it plainly: «no registration, no user database, no API keys, and no cookies …
    there are no limits on the number of map views or requests», and publishes weekly full-planet
    downloads. It was built by Zsolt Ero for the reason §86.7 was dictated — so that nobody wakes
    up to «a $10,000 bill in a single day». There is nothing here to meter.
  · the STYLE is Positron, the light basemap OpenMapTiles/CARTO published open — pale ground,
    white roads, sparse grey labels. It is the austerity this app already has, drawn on a map.

The picture is REAL cartography off real OSM data, not a hand-drawn shape: §25 holds.

═══ WHAT IT DOES ═══════════════════════════════════════════════════════════════════════════════
MapLibre GL draws the style in a headless Chromium, one camera position per tile, and the centre
of each frame is written out as a slippy tile. Two details make the result stitch and stay sharp:

  · A BUFFER. The viewport is three tiles wide and the middle one is kept, so every label is
    placed with its neighbours present. Rendered tile by tile without that, a road name landing on
    a boundary is laid out twice against two different collision fields and the grid shows a seam.
  · TWO PIXELS FOR ONE. Each 256pt tile is written at 512px and drawn back at 256, so the map is
    as crisp on a retina screen as the type beside it. It costs bytes on disk, which is the right
    place to spend them: nothing is fetched at runtime either way.

Run:  python3 tools/build-map-tiles.py           (fills in what is missing)
      python3 tools/build-map-tiles.py --force   (redraws every tile — after a style change)

Writes: public/map/<z>/<x>/<y>.png — served at /map/... by vite, dev and dist alike.
Needs:  playwright (`python3 -m playwright install chromium` once) and, for this one run, the
        network — MapLibre, the style and the vector tiles are fetched by the browser. The APP
        never does; that is the whole point.
"""
import argparse
import asyncio
import io
import math
import re
import sys
from pathlib import Path

from PIL import Image
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'map'

# ── THE SHAPE OF THE JOB ────────────────────────────────────────────────────────────────────────
#: THE SHARPEST GROUND — streets and the coastline both legible. One place is always drawn here.
Z = 14
#: THE WIDER GROUNDS, AND WHY THEY EXIST (FEED-IA §246). «Make sure that for all the addresses you
#: actually come up with, they all show up on the map.» The house delivers across about 35 km,
#: which is roughly 3,700 px at z14 — so a picture that has to hold every pin at once asks for a
#: wider ground, and `print-measures.ts:mapFitOf` takes the sharpest one the box can hold. z9 is
#: the whole delivery world inside a 390 px phone, z8 is the headroom under it, and z13 is a
#: single run.
ZOOMS = (8, 9, 10, 11, 12, 13, 14)
#: a slippy tile is 256 points; it is written at twice that so a retina screen has pixels to use
TILE_PT = 256
SCALE = 2
#: tiles of context around the one being kept, so labels are placed against their neighbours
BUFFER = 1

#: THE CAP. The tool refuses to draw more than this, whatever the cast says. 425 tiles cover the
#: house's whole world today across all seven zooms; the ceiling is here so a mistyped coordinate —
#: a `4.19` where a `41.9` belonged — is a loud stop rather than a crawl across Europe.
#: RAISED FROM 400 ON 2026-09-11, after counting. The sharpest zoom drew a three-by-three strip per
#: place and NO whole-box fill, so a fitted picture that landed on z14 around an outlying anchor
#: asked for tiles nobody had drawn and showed the panel's own ground at its edges — measured at
#: 34 of the 187 tiles a z14 fit can put on screen. Two answers were measured: the whole-box fill
#: at z14 (558 tiles in all, 178 of them a fit can never ask for) and a FIVE-by-three strip per
#: place, which covers all 187 at 425. The strip is what this file draws.
MAX_TILES = 440
#: and the same ceiling on the wire: the browser's own fetches (style, fonts, sprites, vector
#: tiles) are counted, and a run that runs away is killed rather than left to keep going.
MAX_REQUESTS = 3000

STYLE = 'https://tiles.openfreemap.org/styles/positron'
MAPLIBRE = '5.24.0'

#: A LIGHT BASEMAP IS A FEW DOZEN FLAT COLOURS, so the frame is written with a palette instead of
#: a channel per pixel. It halves what the repo carries for a difference nobody can see — the only
#: places the two files disagree are the antialiased edges of type. Twice-size tiles are worth
#: their bytes; twice-size tiles stored as truecolour are not.
PALETTE = 256

# ── THE GROUND IS READ OFF THE CAST, NEVER RESTATED HERE (FEED-IA §31.1) ────────────────────────
# This file used to hold its own list of five coordinates «so the fetch and the seed can be
# eyeballed against each other». At five customers that was a comment; at three hundred it is two
# sources of truth, and the one that lost was the map — every generated customer's pin asked for a
# tile nobody had drawn and the panel 404'd under it.
#
# So the coordinates come out of `cast.ts` itself: the run anchors the book scatters its customers
# around (`RUN_GROUND`) and the founder's own five (`at: { lat, lng }`). It is read as text because
# that file is TypeScript and this is not — and it fails loudly if it finds nothing, because a tile
# set silently drawn for zero places is the defect it exists to prevent.
CAST = (ROOT / 'src' / 'scenarios' / 'data' / 'cast.ts').read_text(encoding='utf8')

PLACES = (
    [(float(a), float(b)) for a, b in re.findall(r'\[\s*(41\.\d+)\s*,\s*(2\.\d+)\s*\]', CAST)]
    + [(float(a), float(b)) for a, b in
       re.findall(r'at:\s*\{\s*lat:\s*(41\.\d+)\s*,\s*lng:\s*(2\.\d+)\s*\}', CAST)]
)

#: how far a generated customer scatters from its run's anchor — the same few hundred metres
#: `houseBook()` uses. Stated here because a pin that drifts over a tile boundary needs that tile's
#: own three-by-three, and a map that is right for the anchor and 404s for the shop next door is
#: the defect this whole file exists to prevent.
SCATTER_LAT = 0.004
SCATTER_LNG = 0.005


def lng_to_x(lng: float, z: int) -> float:
    return (lng + 180.0) / 360.0 * 2 ** z


def lat_to_y(lat: float, z: int) -> float:
    r = math.radians(lat)
    return (1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * 2 ** z


def tile_centre(x: int, y: int, z: int) -> tuple[float, float]:
    n = 2 ** z
    lng = (x + 0.5) / n * 360.0 - 180.0
    lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (y + 0.5) / n))))
    return lng, lat


#: HOW WIDE THE STRIP AROUND ONE PLACE IS, AT THE SHARPEST ZOOM. A fitted picture can land on z14
#: around a tight pair of deliveries, and the widest box this app draws a map in is 1,080 px — four
#: and a bit tiles across and two down — so the strip that a z14 fit can ask for reaches two tiles
#: either side and one above and below. Measured: a 5×3 strip covers all 187 tiles the 434 possible
#: z14 fits can put on screen; the 3×3 this file drew before left 34 of them as quiet ground.
SHARP_REACH_X = 2
SHARP_REACH_Y = 1


def wanted_tiles(zoom: int) -> list[tuple[int, int]]:
    """What one zoom needs.

    THE STRIP AROUND EVERY PIN, at every corner of the box a customer can land in: three across and
    three down, which is wider than a single-place panel ever is — and FIVE across at the sharpest
    zoom, because that is the one a fitted picture can land on with a box wider than three tiles.

    AND, BELOW THE SHARPEST ZOOM, THE WHOLE BOX. A fitted viewport is centred on the bounds of a
    marker SET rather than on one customer, so its middle can be open water with no customer near
    it — and a tile nobody's strip asked for is the hole the fit would show. One ring of margin
    rides outside it so a box slightly larger than the bounds still lands on ground. At z14 the
    whole box is 340 tiles of open country the fit can never reach, so the strip is widened
    instead: same coverage, 178 fewer pictures.
    """
    wanted: set[tuple[int, int]] = set()
    reach_x = SHARP_REACH_X if zoom == Z else 1
    reach_y = SHARP_REACH_Y if zoom == Z else 1
    for lat, lng in PLACES:
        for dlat in (-SCATTER_LAT, 0.0, SCATTER_LAT):
            for dlng in (-SCATTER_LNG, 0.0, SCATTER_LNG):
                tx = math.floor(lng_to_x(lng + dlng, zoom))
                ty = math.floor(lat_to_y(lat + dlat, zoom))
                for dx in range(-reach_x, reach_x + 1):
                    for dy in range(-reach_y, reach_y + 1):
                        wanted.add((tx + dx, ty + dy))
    if zoom < Z:
        lats = [lat for lat, _ in PLACES]
        lngs = [lng for _, lng in PLACES]
        x0 = math.floor(lng_to_x(min(lngs) - SCATTER_LNG, zoom)) - 1
        x1 = math.floor(lng_to_x(max(lngs) + SCATTER_LNG, zoom)) + 1
        y0 = math.floor(lat_to_y(max(lats) + SCATTER_LAT, zoom)) - 1
        y1 = math.floor(lat_to_y(min(lats) - SCATTER_LAT, zoom)) + 1
        for x in range(x0, x1 + 1):
            for y in range(y0, y1 + 1):
                wanted.add((x, y))
    return sorted(wanted)


# ── THE PAGE THE BROWSER DRAWS ─────────────────────────────────────────────────────────────────
# `fadeDuration: 0` matters: MapLibre fades labels in, and a screenshot taken mid-fade writes a
# half-transparent street name into a PNG that will never fade the rest of the way.
PAGE = """<!doctype html><meta charset="utf-8">
<link href="https://unpkg.com/maplibre-gl@{v}/dist/maplibre-gl.css" rel="stylesheet">
<style>html,body{{margin:0;padding:0}}#m{{width:{side}px;height:{side}px}}</style>
<div id="m"></div>
<script src="https://unpkg.com/maplibre-gl@{v}/dist/maplibre-gl.js"></script>
<script>
window.__ready = false; window.__failed = null;
const map = new maplibregl.Map({{
  container: 'm', style: '{style}', center: [2.17, 41.39], zoom: 12,
  attributionControl: false, interactive: false, fadeDuration: 0, renderWorldCopies: false,
}});
map.on('load', () => {{ window.__ready = true; }});
map.on('error', (e) => {{ window.__failed = String((e && e.error && e.error.message) || e); }});
window.go = (lng, lat, zoom) => new Promise((resolve) => {{
  map.jumpTo({{ center: [lng, lat], zoom, bearing: 0, pitch: 0 }});
  const settled = () => {{
    map.off('idle', settled);
    requestAnimationFrame(() => requestAnimationFrame(() => resolve(true)));
  }};
  map.on('idle', settled);
}});
</script>"""


async def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--force', action='store_true', help='redraw tiles that already exist')
    args = ap.parse_args()

    if len(PLACES) < 20:
        print(f'cast.ts gave {len(PLACES)} coordinates — the reader is broken, not the map.',
              file=sys.stderr)
        return 1

    plan = {zoom: wanted_tiles(zoom) for zoom in ZOOMS}
    tiles = [(zoom, x, y) for zoom in ZOOMS for x, y in plan[zoom]]

    # ── THE CAP, STATED AND ENFORCED ───────────────────────────────────────────────────────────
    for zoom in ZOOMS:
        print(f'  z{zoom} · {len(plan[zoom])} tiles')
    print(f'the cap · {len(PLACES)} places across {len(ZOOMS)} zooms → {len(tiles)} distinct tiles '
          f'(ceiling {MAX_TILES})')
    if len(tiles) > MAX_TILES:
        print(f'REFUSING: {len(tiles)} tiles is past the {MAX_TILES} ceiling. Either the cast grew '
              f'a world, or a coordinate is wrong. Look before raising the cap.', file=sys.stderr)
        return 1

    todo = [(zoom, x, y) for zoom, x, y in tiles
            if args.force or not (OUT / str(zoom) / str(x) / f'{y}.png').exists()]
    if not todo:
        print('every tile is already drawn — nothing to do (pass --force to redraw).')
        return 0

    side = TILE_PT * (2 * BUFFER + 1)
    keep = TILE_PT * SCALE                      # the written tile, in device pixels
    requests = 0
    failures: list[str] = []

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(args=['--no-sandbox', '--disable-dev-shm-usage'])
        page = await browser.new_page(viewport={'width': side, 'height': side},
                                      device_scale_factor=SCALE)

        def on_request(_req):
            nonlocal requests
            requests += 1

        def on_response(res):
            if res.status >= 400:
                failures.append(f'{res.status} {res.url}')

        page.on('request', on_request)
        page.on('response', on_response)

        await page.set_content(PAGE.format(v=MAPLIBRE, side=side, style=STYLE))
        try:
            await page.wait_for_function('window.__ready === true', timeout=90_000)
        except Exception:
            why = await page.evaluate('window.__failed')
            print(f'the style never loaded ({why or "timeout"}) — nothing was written.',
                  file=sys.stderr)
            await browser.close()
            return 1

        drawn = 0
        for zoom, x, y in todo:
            if requests > MAX_REQUESTS:
                print(f'REFUSING to continue: {requests} requests is past the {MAX_REQUESTS} '
                      f'ceiling.', file=sys.stderr)
                await browser.close()
                return 1
            lng, lat = tile_centre(x, y, zoom)
            # MapLibre counts zoom against a 512px tile, the slippy grid against a 256px one, so
            # the same ground scale is one zoom step lower here. The viewport is BUFFER tiles wider
            # on each side; the middle square is the tile.
            await page.evaluate(f'window.go({lng}, {lat}, {zoom - 1})')
            # the clip is in CSS points; the page runs at SCALE device pixels to the point, so the
            # file that lands on disk is TILE_PT × SCALE square.
            shot = await page.screenshot(type='png', clip={
                'x': TILE_PT * BUFFER, 'y': TILE_PT * BUFFER,
                'width': TILE_PT, 'height': TILE_PT,
            })
            plate = Image.open(io.BytesIO(shot)).convert('RGB')
            if plate.size != (keep, keep):
                print(f'{zoom}/{x}/{y} came back {plate.size}, not {keep}×{keep} — the clip and the '
                      f'device scale disagree; nothing further written.', file=sys.stderr)
                await browser.close()
                return 1
            small = io.BytesIO()
            plate.quantize(colors=PALETTE, method=Image.MEDIANCUT, dither=Image.NONE).save(
                small, 'PNG', optimize=True)
            path = OUT / str(zoom) / str(x) / f'{y}.png'
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(small.getvalue())
            drawn += 1
            if drawn % 25 == 0:
                print(f'  … {drawn}/{len(todo)} drawn, {requests} requests so far')

        await browser.close()

    on_disk = sum(p.stat().st_size for p in OUT.rglob('*.png'))
    count = sum(1 for _ in OUT.rglob('*.png'))
    print(f'tiles: {len(tiles)} wanted · {drawn} drawn at {keep}×{keep}px · '
          f'{count} on disk · {on_disk / 1024 / 1024:.1f} MB')
    for zoom in ZOOMS:
        print(f'  z{zoom} · {sum(1 for _ in (OUT / str(zoom)).rglob("*.png"))} on disk')
    print(f'requests spent: {requests} (style, fonts, sprites and vector tiles — '
          f'no key, no meter, no bill)')
    if failures:
        print(f'  {len(failures)} request(s) failed:', file=sys.stderr)
        for f in failures[:10]:
            print(f'    {f}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(asyncio.run(main()))
