#!/usr/bin/env python3
"""THE QR DEGRADATION HARNESS — how much damage the packing mark survives, measured.

    «we're way past the dawn of the era of IoT and machine recognisable documents and QR codes…
     i expect this to be fully working when we wire everything… you can even test it by exporting
     and downresolutioning and even muddling or adding fake dirt to the image and then running it
     through scanning all programmatically without requiring me to print and test»
                                                             — Peter, 2026-09-04 (FEED-IA §198)

THE-QR-SPEC QR-08 already proves the mark decodes. This harness answers the harder question: **how
far down does it still decode**, on every axis a warehouse actually damages paper along, over a
BATCH of different locators rather than one lucky symbol — and it turns that into a FLOOR the spec
can carry as a number and a drive can re-assert.

═══ THE THREE THINGS THIS FILE HAS TO GET RIGHT ═══════════════════════════════════════════════

**1 · THE SYMBOL UNDER TEST IS THE APP'S OWN.** `--anchor` boots the built kit in headless
Chromium, walks to the packing sheet, and reads the real `PackingCaptureMark`: its locator, its
printed token, and its module matrix pulled out of the SVG path data. That is the truthful source
and nothing else is.

**2 · AND THE BATCH IS HONEST BECAUSE OF AN EQUIVALENCE PROOF, NOT BECAUSE IT LOOKS SIMILAR.**
A twenty-locator sweep cannot afford twenty Chromium boots. So the anchor's matrix is compared
BIT FOR BIT against `segno`'s matrix for the same payload at the same parameters read out of
`PACKING_QR`. Identical matrices mean the encoder in this file IS the encoder in the bundle for
this payload class, and the batch is then generated cheaply and honestly. **A mismatch is fatal
and the harness stops** — it will not silently measure a floor for a symbol the app never draws.

**3 · THE CAPTURE DENSITY IS STATED, BECAUSE A FLOOR WITHOUT ONE IS NOISE.** «0.5 resolution»
means nothing until you say 0.5 OF WHAT. The reference is the mark as PRINTED on A4 at 300 dpi:
76 CSS px at 96 dpi = 20.11 mm = 238 px, across 37 modules (29 + two 4-module quiet zones) =
**6.43 px per module**. That is also, to within a few per cent, what a 12 MP phone gets of an A4
sheet held to fill the frame — so the resolution axis reads directly as «how much further away, or
how much smaller a mark, before it stops».

WHAT A FLOOR IS. Per axis, the harshest step at which **every** locator in the batch decodes to
its exact payload. Not «most». A packing sheet that reads nine times in ten is a sheet somebody
stops trusting.

TWO DECODERS, and the difference between them is reported rather than hidden: **zxing-cpp** (the
same C++ core Android's ML Kit and most scanner apps carry) and the system **libzbar** through the
read-only ctypes binding `drive-198-parsing-qr.py` already uses. A floor is quoted on zxing-cpp
because that is the software in the phone; zbar's own column says whether the result is one
library's opinion or a property of the symbol.

RUN IT
    # the anchor, and then the full sweep (needs Chromium — hold the build lock)
    ROCOTO_DIST=/dev/shm/e193-w7-dist python3 tools/qr-harness.py --anchor --sweep

    # the sweep alone, offline, against a saved anchor
    python3 tools/qr-harness.py --sweep --anchor-file <out>/anchor.json

    # what a different geometry would buy (THE-QR-SPEC QR-02.1's fork, measured)
    python3 tools/qr-harness.py --geometry
"""
from __future__ import annotations

import argparse
import ctypes
import ctypes.util
import json
import os
import pathlib
import re
import sys
import time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

import numpy as np  # noqa: E402
import qrcodegen  # noqa: E402
from PIL import Image  # noqa: E402

from degrade import VARIANTS, Sheet, apply_variant, axes, variants_for  # noqa: E402

HERE = pathlib.Path(__file__).resolve().parent
SITUATIONS = HERE.parent
PACKING_TS = SITUATIONS / 'app' / 'src' / 'prototypes' / 'cedar' / 'packing-output.ts'

try:
    import zxingcpp
except ImportError:  # noqa: BLE001 — stated, never worked around
    zxingcpp = None


# ══ THE APP'S OWN NUMBERS, READ OUT OF THE APP ═════════════════════════════════════════════════
# Not retyped here. `PACKING_QR` in packing-output.ts is THE-QR-SPEC's arithmetic, and a harness
# that keeps its own copy of `ecc: 'M'` is a harness that goes green after somebody lowers it.

def packing_qr() -> dict:
    source = PACKING_TS.read_text()
    block = re.search(r'export const PACKING_QR = \{(.*?)\} as const;', source, re.S)
    if not block:
        raise SystemExit('PACKING_QR not found in ' + str(PACKING_TS))
    body = block.group(1)
    read = lambda key, pattern: re.search(key + r'\s*:\s*' + pattern, body)  # noqa: E731
    scheme = read('scheme', r"'([^']+)'")
    ecc = read('ecc', r"'([A-Za-z])'")
    quiet = read('quietModules', r'(\d+)')
    page = read('pagePx', r'(\d+)')
    floor = read('minModuleMm', r'([\d.]+)')
    if not all((scheme, ecc, quiet, page, floor)):
        raise SystemExit('PACKING_QR is missing a field this harness measures against')
    return {'scheme': scheme.group(1), 'ecc': ecc.group(1).lower(),
            'quietModules': int(quiet.group(1)), 'pagePx': int(page.group(1)),
            'minModuleMm': float(floor.group(1))}


# The app's own 53-bit fold, ported so the batch carries tokens the app's own function produces —
# same base-36 alphabet, same 10-to-11-character length, same payload budget. A batch of random
# strings would measure a symbol nobody prints.
def _imul(a: int, b: int) -> int:
    return (a * b) & 0xFFFFFFFF


def locator_token(source: str) -> str:
    length = len(source)
    a = 0xDEADBEEF ^ length
    b = 0x41C6CE57 ^ length
    for character in source:
        code = ord(character)
        a = _imul(a ^ code, 2654435761)
        b = _imul(b ^ code, 1597334677)
    a = _imul(a ^ (a >> 16), 2246822507) ^ _imul(b ^ (b >> 13), 3266489909)
    b = _imul(b ^ (b >> 16), 2246822507) ^ _imul(a ^ (a >> 13), 3266489909)
    value = 4294967296 * (2097151 & b) + a
    digits = '0123456789abcdefghijklmnopqrstuvwxyz'
    out = ''
    while value:
        out = digits[value % 36] + out
        value //= 36
    return out or '0'


def batch_locators(config: dict, count: int, anchor: str | None) -> list[str]:
    """≥ count different locators, the real one first where we have it."""
    out: list[str] = []
    if anchor:
        out.append(anchor)
    index = 0
    while len(out) < max(count, 20):
        token = locator_token('packing-v1|fish|2026-09-%02d|sale-%d|rev-%d' % (index % 28 + 1, index, index * 7 + 3))
        candidate = config['scheme'] + token
        if candidate not in out:
            out.append(candidate)
        index += 1
    return out


# ══ THE ENCODER, AT THE APP'S PARAMETERS ═══════════════════════════════════════════════════════

ECC = {'l': qrcodegen.QrCode.Ecc.LOW, 'm': qrcodegen.QrCode.Ecc.MEDIUM,
       'q': qrcodegen.QrCode.Ecc.QUARTILE, 'h': qrcodegen.QrCode.Ecc.HIGH}


def matrix_of(payload: str, config: dict, version: int | None = None) -> list[list[bool]]:
    """The symbol's modules INCLUDING its quiet zone — the same box the app's SVG viewBox is.

    ⚠ THE ENCODER IS NAYUKI'S `qrcodegen`, AND THAT IS NOT A PREFERENCE. `qrcode.react@4.2.0`,
    which `print-view.tsx` draws the mark with, bundles Nayuki's `qrcodegen` — the LICENSE and the
    lib text in `node_modules/qrcode.react` say so — with `boostEcl` on. The first version of this
    harness used `segno` and the equivalence proof went **MISMATCH · 138 modules differ**: two
    perfectly valid version-3-M symbols for the same 37-character payload, same mask, same format
    info, different data placement. Both scan. They are not the same symbol, and a floor measured
    on the wrong one would have been a number about a QR code Rocoto never prints.

    That is the entire reason QR-08.1's equivalence proof exists rather than a comment saying «we
    generate it the same way». It caught the thing it was written to catch, on the first run."""
    quiet = config['quietModules']
    lowest = version or 1
    code = qrcodegen.QrCode.encode_segments(
        qrcodegen.QrSegment.make_segments(payload), ECC[config['ecc']], lowest, 40, -1, True)
    side = code.get_size() + 2 * quiet
    grid = [[False] * side for _ in range(side)]
    for y in range(code.get_size()):
        for x in range(code.get_size()):
            grid[y + quiet][x + quiet] = code.get_module(x, y)
    return grid


def render(matrix: list[list[bool]], across_px: int) -> Image.Image:
    """The matrix as pixels at a stated capture density. Nearest-neighbour from a 1-px-per-module
    array so no resampling softness is baked in before the degradation library gets there."""
    array = np.array([[0 if cell else 255 for cell in row] for row in matrix], dtype=np.uint8)
    return Image.fromarray(array, mode='L').resize((across_px, across_px), Image.Resampling.NEAREST).convert('RGB')


def on_paper(mark: Image.Image, margin: float) -> tuple[Image.Image, tuple[int, int, int, int]]:
    """The mark ON A SHEET, with `margin` mark-widths of white paper on every side — and the box
    the symbol occupies in it.

    ⚠ WHY THE PAGE IS PART OF THE MEASUREMENT, and not a nicety. Measured on this harness: the same
    symbol under the same 2 % sensor noise decoded 4/24 as a bare crop and 24/24 with one mark-width
    of paper round it. ZXing's detector wants clear ground outside the finder patterns before it
    will commit to a symbol, and a bare crop hands it none — so a bare-crop sweep measures the CROP,
    not the mark, and would have reported a catastrophic floor for a mark that is fine.

    It is also the honest picture: the mark is printed in a masthead on an A4 sheet, and there is
    white paper around it. The margin is a stated parameter for exactly that reason — how much
    clear ground the layout leaves is a design decision, and QR-03.1 now states it as a rule
    because this harness measured what it is worth."""
    pad = int(round(mark.width * margin))
    page = Image.new('RGB', (mark.width + 2 * pad, mark.height + 2 * pad), 'white')
    page.paste(mark, (pad, pad))
    return page, (pad, pad, pad + mark.width, pad + mark.height)


# ══ THE DECODERS ═══════════════════════════════════════════════════════════════════════════════

class Zbar:
    """The system libzbar, bound read-only through ctypes — the same binding drive-198 uses."""

    def __init__(self) -> None:
        found = ctypes.util.find_library('zbar')
        self.lib = ctypes.CDLL(found) if found else None
        if not self.lib:
            return
        lib = self.lib
        lib.zbar_image_scanner_create.restype = ctypes.c_void_p
        lib.zbar_image_create.restype = ctypes.c_void_p
        lib.zbar_image_first_symbol.argtypes = [ctypes.c_void_p]
        lib.zbar_image_first_symbol.restype = ctypes.c_void_p
        lib.zbar_symbol_get_data.argtypes = [ctypes.c_void_p]
        lib.zbar_symbol_get_data.restype = ctypes.c_char_p
        lib.zbar_symbol_next.argtypes = [ctypes.c_void_p]
        lib.zbar_symbol_next.restype = ctypes.c_void_p
        lib.zbar_image_scanner_set_config.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_int, ctypes.c_int]
        lib.zbar_image_set_format.argtypes = [ctypes.c_void_p, ctypes.c_ulong]
        lib.zbar_image_set_size.argtypes = [ctypes.c_void_p, ctypes.c_uint, ctypes.c_uint]
        lib.zbar_image_set_data.argtypes = [ctypes.c_void_p, ctypes.c_void_p, ctypes.c_ulong, ctypes.c_void_p]
        lib.zbar_scan_image.argtypes = [ctypes.c_void_p, ctypes.c_void_p]
        lib.zbar_scan_image.restype = ctypes.c_int
        lib.zbar_image_destroy.argtypes = [ctypes.c_void_p]
        lib.zbar_image_scanner_destroy.argtypes = [ctypes.c_void_p]

    @staticmethod
    def _fourcc(value: str) -> int:
        return ord(value[0]) | ord(value[1]) << 8 | ord(value[2]) << 16 | ord(value[3]) << 24

    def decode(self, image: Image.Image) -> list[str]:
        if not self.lib:
            return []
        grey = image.convert('L')
        raw = grey.tobytes()
        buffer = ctypes.create_string_buffer(raw)
        scanner = self.lib.zbar_image_scanner_create()
        item = self.lib.zbar_image_create()
        try:
            self.lib.zbar_image_scanner_set_config(scanner, 0, 0, 1)
            self.lib.zbar_image_set_format(item, self._fourcc('Y800'))
            self.lib.zbar_image_set_size(item, grey.width, grey.height)
            self.lib.zbar_image_set_data(item, ctypes.cast(buffer, ctypes.c_void_p), len(raw), None)
            self.lib.zbar_scan_image(scanner, item)
            symbol = self.lib.zbar_image_first_symbol(item)
            out = []
            while symbol:
                value = self.lib.zbar_symbol_get_data(symbol)
                if value:
                    out.append(value.decode('utf-8'))
                symbol = self.lib.zbar_symbol_next(symbol)
            return out
        finally:
            self.lib.zbar_image_destroy(item)
            self.lib.zbar_image_scanner_destroy(scanner)


def zx_decode(image: Image.Image) -> list[str]:
    if zxingcpp is None:
        return []
    return [result.text for result in zxingcpp.read_barcodes(image) if result.valid]


# ══ THE PRINT GEOMETRY ═════════════════════════════════════════════════════════════════════════

def geometry(config: dict, across_modules: int, dpi: int = 300) -> dict:
    """The mark's own arithmetic, at a capture density. `across_modules` includes the quiet zone."""
    px_per_mm_screen = 96 / 25.4
    mark_mm = config['pagePx'] / px_per_mm_screen
    capture_px = round(mark_mm * dpi / 25.4)
    return {'mark_mm': mark_mm, 'module_mm': mark_mm / across_modules,
            'capture_px': capture_px, 'px_per_module': capture_px / across_modules, 'dpi': dpi}


# ══ THE SWEEP ══════════════════════════════════════════════════════════════════════════════════

def sweep(config: dict, locators: list[str], across_px: int, seed: int, out: pathlib.Path,
          keep_images: bool = False, variant_names: list[str] | None = None,
          margin: float = 1.0) -> dict:
    """Every variant against every locator, decoded twice. The pages are built ONCE per locator
    and reused across variants, because a floor is about the damage, not about the paper."""
    zbar = Zbar()
    names = variant_names or [variant.name for variant in variants_for('qr')]
    px_per_mm = across_px / (config['pagePx'] / (96 / 25.4))
    pages = [on_paper(render(matrix_of(payload, config), across_px), margin) for payload in locators]
    results: dict[str, dict] = {}
    for name in names:
        zx_hits, zb_hits, either_hits, wrong = 0, 0, 0, []
        for index, payload in enumerate(locators):
            page, box = pages[index]
            hurt = apply_variant(page, name, seed + index, Sheet(region=box, px_per_mm=px_per_mm))
            if keep_images and index == 0:
                (out / 'variants').mkdir(parents=True, exist_ok=True)
                hurt.save(out / 'variants' / (name + '.png'))
            zx = zx_decode(hurt)
            zb = zbar.decode(hurt)
            if payload in zx:
                zx_hits += 1
            elif zx:
                wrong.append({'expected': payload, 'read': zx[0]})
            if payload in zb:
                zb_hits += 1
            if payload in zx or payload in zb:
                either_hits += 1
        results[name] = {'axis': VARIANTS[name].axis, 'rank': VARIANTS[name].rank,
                         'label': VARIANTS[name].label, 'total': len(locators),
                         'zxing': zx_hits, 'zbar': zb_hits, 'either': either_hits,
                         'zxing_all': zx_hits == len(locators), 'zbar_all': zb_hits == len(locators),
                         'either_all': either_hits == len(locators), 'misread': wrong}
    return results


def clearspace_sweep(config: dict, locators: list[str], across_px: int, seed: int,
                     out: pathlib.Path, margins: tuple[float, ...] = (0.0, 0.12, 0.25, 0.5, 1.0),
                     names: tuple[str, ...] = ('sensor-2', 'dirt-05', 'combo-0540')) -> list[dict]:
    """HOW MUCH CLEAR PAPER THE MARK NEEDS — the measurement behind QR-03.1's clearspace rule.
    The 4-module quiet zone is the ISO minimum for a symbol in isolation; this asks what a symbol
    in a masthead, photographed with noise and dirt on the page, actually needs around it."""
    rows = []
    for margin in margins:
        result = sweep(config, locators, across_px, seed, out, margin=margin, variant_names=list(names))
        rows.append({'margin': margin,
                     'held': {name: result[name]['zxing'] for name in names},
                     'total': len(locators)})
    return rows


def floors(results: dict, key: str = 'zxing_all') -> dict:
    """Per axis, the harshest step EVERY locator survived — and the first step that broke.

    ⚠ THREE FLOORS ARE REPORTED, NEVER ONE. `zxing` is the conservative floor: the C++ core most
    scanner apps carry, at its library defaults, one shot at one still frame. `zbar` is a second
    opinion from a different algorithm — where the two disagree by a lot, the result is a library's
    property and not the symbol's, and saying so is the difference between a measurement and a
    scare. `either` is the practical floor, and it is the honest one to plan a warehouse around:
    a phone is not one decoder and one frame — the reading ladder in `qr-read.tsx` has a native
    road, a library road and a typed road, and a camera loop gets three frames a second."""
    out: dict[str, dict] = {}
    for axis, variants in axes('qr').items():
        held, broke = None, None
        for variant in variants:
            row = results.get(variant.name)
            if row is None:
                continue
            if row[key]:
                held = variant.name
            elif broke is None:
                broke = variant.name
        out[axis] = {'floor': held, 'first_failure': broke}
    return out


def table(results: dict, locators: list[str]) -> str:
    lines = ['| variant | axis | what it is | zxing-cpp | libzbar | either | all 24? |',
             '|---|---|---|---:|---:|---:|---|']
    for name, row in results.items():
        lines.append('| `%s` | %s | %s | %d | %d | %d | %s |' % (
            name, row['axis'], row['label'], row['zxing'], row['zbar'], row['either'],
            'yes' if row['either_all'] else ('zbar' if row['zbar_all'] else ('zxing' if row['zxing_all'] else 'NO'))))
    return '\n'.join(lines)


# ══ THE ANCHOR — THE APP'S OWN MARK, THROUGH HEADLESS CHROMIUM ═════════════════════════════════

async def anchor(dist: pathlib.Path, out: pathlib.Path) -> dict:
    import asyncio  # noqa: F401 — imported here so the offline sweep needs no playwright at all
    import functools
    import http.server
    import socketserver
    import threading

    from playwright.async_api import async_playwright

    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(dist))
    socketserver.TCPServer.allow_reuse_address = True
    server = socketserver.ThreadingTCPServer(('127.0.0.1', 0), handler)
    server.RequestHandlerClass.log_message = lambda *_: None
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = 'http://127.0.0.1:%d/app.html' % server.server_address[1]
    boot = """
    if (!sessionStorage.getItem('rocoto-qr-harness')) {
      sessionStorage.setItem('rocoto-qr-harness', '1');
      localStorage.clear();
      localStorage.setItem('rocoto-app-front-door', 'months');
      localStorage.setItem('rocoto-app-config', JSON.stringify({version: 1, sector: ['fish'], cast: 'fish'}));
    }
    """
    try:
        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch(
                headless=True, args=['--disable-dev-shm-usage', '--no-sandbox'])
            context = await browser.new_context(viewport={'width': 1366, 'height': 768})
            page = await context.new_page()
            page.set_default_timeout(30000)
            await page.add_init_script(boot)
            await page.goto(url + '#/sales', wait_until='networkidle')

            # ⚠ IS THE NATIVE ROAD REAL HERE? `qr-read.tsx`'s ladder puts `BarcodeDetector` first,
            # and THE-QR-SPEC says headless Chromium on Linux has none. That is a claim about a
            # browser, so it is ASKED rather than repeated.
            native = await page.evaluate("""async () => {
                const D = globalThis.BarcodeDetector;
                if (!D) return {present: false, formats: null, decoded: null};
                let formats = null;
                try { formats = await D.getSupportedFormats(); } catch (e) { formats = String(e); }
                return {present: true, formats, decoded: null};
            }""")

            paper = page.locator('[data-testid="day-packing-2025-08-25-paper"]')
            await paper.wait_for()
            await paper.click()
            mark = page.locator('[data-testid="packing-document-qr"]')
            await mark.wait_for()
            locator = await mark.get_attribute('data-document-locator') or ''
            # The printed token under the mark is QR-05.3's typed road, and drive-198 proves it in
            # the current bundle. This harness only NEEDS the symbol, so a build that predates that
            # line still anchors — and the absence is recorded rather than papered over.
            token_seat = page.locator('[data-testid="packing-document-code"]')
            printed = (await token_seat.inner_text()).strip() if await token_seat.count() else None
            svg = mark.locator('svg')
            shape = await svg.evaluate("""node => ({
                width: node.getAttribute('width'), height: node.getAttribute('height'),
                viewBox: node.getAttribute('viewBox'),
                paths: [...node.querySelectorAll('path')].map(p => p.getAttribute('d') || '')})""")
            outer = await svg.evaluate('node => node.outerHTML')

            # THE MARK AS PIXELS, at the densities the paper is actually read at.
            shots = {}
            for name, pixels in (('96dpi', 76), ('a5-300dpi', 168), ('a4-300dpi', 238), ('phone-12mp', 288)):
                shot = await context.new_page()
                await shot.set_content(
                    '<body style="margin:0;background:#fff"><div id="qr" style="width:%dpx;height:%dpx">%s</div>'
                    '<style>#qr svg{display:block;width:100%%;height:100%%}</style></body>'
                    % (pixels, pixels, outer))
                data = await shot.locator('#qr').screenshot()
                await shot.close()
                path = out / ('anchor-%s.png' % name)
                path.write_bytes(data)
                shots[name] = str(path)

            version = browser.version
            await browser.close()
    finally:
        server.shutdown()
        server.server_close()

    across = int((shape['viewBox'] or '0 0 0 0').split()[2])
    runs = re.findall(r'M(\d+)[,\s]+(\d+)\s*h(\d+)v1H\d+z', shape['paths'][1] if len(shape['paths']) > 1 else '')
    grid = [[False] * across for _ in range(across)]
    for left, top, width in runs:
        for column in range(int(left), int(left) + int(width)):
            grid[int(top)][column] = True
    # THE ANCHOR STATES WHICH BUNDLE IT CAME OUT OF, AND WHAT THAT BUNDLE DRAWS. A dist is a
    # build, and a build can be older than the source this harness reads its numbers from — so the
    # three parameters that decide the symbol are read back out of the bundle's own text and
    # recorded beside the matrix. If they ever disagree with PACKING_QR, the equivalence proof
    # below is what catches it, and this line is what explains the failure.
    drawn = []
    for script in sorted((dist / 'assets').glob('*.js')):
        found = re.findall(r'size:(\d+),level:[`\'"]([A-Z])[`\'"],marginSize:(\d+)', script.read_text(errors='ignore'))
        drawn.extend({'size': int(a), 'level': b, 'marginSize': int(c), 'in': script.name} for a, b, c in found)
    record = {
        'locator': locator, 'printed_token': printed, 'across': across, 'dist': str(dist),
        'bundle_draws': drawn,
        'svg_width': shape['width'], 'svg_height': shape['height'], 'viewBox': shape['viewBox'],
        'matrix': [''.join('1' if cell else '0' for cell in row) for row in grid],
        'chromium': version, 'barcode_detector': native, 'shots': shots,
        'at': time.strftime('%Y-%m-%dT%H:%M:%S'),
    }
    (out / 'anchor.json').write_text(json.dumps(record, indent=2))
    return record


def prove_equivalence(record: dict, config: dict) -> tuple[bool, str]:
    """The app's rendered matrix against the harness's, bit for bit — what licenses the batch."""
    mine = matrix_of(record['locator'], config)
    theirs = [[character == '1' for character in row] for row in record['matrix']]
    if len(mine) != len(theirs):
        return False, 'module count differs: app %d, harness %d' % (len(theirs), len(mine))
    differences = sum(1 for y in range(len(mine)) for x in range(len(mine)) if mine[y][x] != theirs[y][x])
    return differences == 0, ('identical across %d × %d modules' % (len(mine), len(mine))
                              if differences == 0 else '%d of %d modules differ' % (differences, len(mine) ** 2))


# ══ THE GEOMETRY FORK (THE-QR-SPEC QR-02.1), MEASURED RATHER THAN ARGUED ═══════════════════════

def geometry_fork(config: dict, locators: list[str], seed: int, out: pathlib.Path,
                  margin: float = 1.0) -> list[dict]:
    """What a different error-correction level or a bigger footprint would actually buy.

    ⚠ THIS IS THE TABLE THAT DECIDES THE SPEC. QR-02.1 argued M-at-0.54 mm against Q-at-0.49 mm
    from capacity arithmetic alone, and capacity arithmetic cannot see a drop of water. The sweep
    above found the mark strong on every optical axis and WEAK on occlusion — one 2 mm drop of
    fish water on the 20 mm mark took two locators in twenty-four out of the batch. So the fork is
    re-run on the axes that actually failed, and the answer stops being a preference.

    The two levers are different levers and the table separates them:
      · ERROR CORRECTION buys back damaged DATA modules, up to its budget, and buys nothing at all
        for a finder pattern — a decoder that cannot find the symbol never gets to correct it.
      · FOOTPRINT buys module SIZE, and module size is what decides how much of a finder pattern a
        three-millimetre drop covers. It is the lever that works on the failure we actually have.
    """
    forks = [
        {'ecc': 'm', 'pagePx': 76, 'note': 'the mark as shipped'},
        {'ecc': 'q', 'pagePx': 76, 'note': "Q at the same footprint (QR-02.1's cost)"},
        {'ecc': 'h', 'pagePx': 76, 'note': 'H at the same footprint'},
        {'ecc': 'm', 'pagePx': 96, 'note': 'the same M, a bigger mark'},
        {'ecc': 'q', 'pagePx': 96, 'note': 'Q at 96px — the spec\'s own production fork'},
        {'ecc': 'h', 'pagePx': 96, 'note': 'H at 96px'},
        {'ecc': 'm', 'pagePx': 120, 'note': 'M at 120px'},
        {'ecc': 'q', 'pagePx': 120, 'note': 'Q at 120px'},
        {'ecc': 'h', 'pagePx': 120, 'note': 'H at 120px'},
        {'ecc': 'l', 'pagePx': 76, 'note': 'L at 76px — the least protected control'},
    ]
    # The occlusion axes, plus the two optical steps nearest their own floors, so a fork cannot buy
    # occlusion tolerance by quietly spending resolution.
    watched = ['ink-1x3mm', 'ink-3x3mm', 'ink-3x5mm', 'stain-3x5mm', 'stain-6x5mm',
               'blot-05', 'blot-08', 'blot-15', 'ring-wide', 'dirt-05', 'dirt-15',
               'combo-0540', 'combo-0540-hard', 'res-0.25', 'res-0.20', 'blur-3.0']
    rows = []
    for fork in forks:
        local = dict(config, ecc=fork['ecc'], pagePx=fork['pagePx'])
        try:
            probe = matrix_of(locators[0], local)
        except Exception as error:  # noqa: BLE001 — a capacity refusal is a result, not a crash
            rows.append({**fork, 'error': type(error).__name__ + ': ' + str(error)[:80]})
            continue
        across = len(probe)
        geo = geometry(local, across)
        results = sweep(local, locators, geo['capture_px'], seed, out, keep_images=False,
                        margin=margin, variant_names=watched)
        rows.append({**fork, 'modules': across, 'module_mm': round(geo['module_mm'], 3),
                     'px_per_module': round(geo['px_per_module'], 2),
                     'per_variant': {name: results[name]['zxing'] for name in watched},
                     'held': sum(1 for name in watched if results[name]['zxing_all']),
                     'of': len(watched), 'total': len(locators)})
    return rows


def fork_table(rows: list[dict]) -> str:
    watched = next((list(row['per_variant']) for row in rows if 'per_variant' in row), [])
    head = ['| ecc | px | mm/module | ' + ' | '.join(name.replace('splash-', '').replace('combo-', '') for name in watched) + ' | held |',
            '|---|---:|---:|' + '---:|' * (len(watched) + 1)]
    for row in rows:
        if 'error' in row:
            head.append('| %s | %d | — | %s |' % (row['ecc'].upper(), row['pagePx'], row['error']))
            continue
        head.append('| %s | %d | %.3f | ' % (row['ecc'].upper(), row['pagePx'], row['module_mm'])
                    + ' | '.join(str(row['per_variant'][name]) for name in watched)
                    + ' | %d/%d |' % (row['held'], row['of']))
    return '\n'.join(head)


# ══ MAIN ═══════════════════════════════════════════════════════════════════════════════════════

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--anchor', action='store_true', help='boot the built kit and read its own mark (needs Chromium)')
    parser.add_argument('--sweep', action='store_true', help='run the degradation sweep over the batch')
    parser.add_argument('--geometry', action='store_true', help='measure what other ECC/footprint choices buy')
    parser.add_argument('--dist', default=os.environ.get('ROCOTO_DIST', 'app/dist'))
    parser.add_argument('--out', default=os.environ.get('ROCOTO_SHOTS', '/dev/shm/rocoto-e193-qr-harness'))
    parser.add_argument('--anchor-file', default=None)
    parser.add_argument('--batch', type=int, default=24)
    parser.add_argument('--seed', type=int, default=7)
    parser.add_argument('--dpi', type=int, default=300, help='the capture density the floor is quoted at')
    parser.add_argument('--margin', type=float, default=1.0,
                        help='mark-widths of clear paper around the mark in the simulated capture')
    parser.add_argument('--clearspace', action='store_true', help='measure how much clear paper the mark needs')
    parser.add_argument('--json', default=None, help='write the whole result as JSON here')
    args = parser.parse_args()
    if not (args.anchor or args.sweep or args.geometry):
        args.anchor = args.sweep = True

    out = pathlib.Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    config = packing_qr()
    print('PACKING_QR (read from %s)' % PACKING_TS.relative_to(SITUATIONS))
    print('  ' + json.dumps(config))
    if zxingcpp is None:
        print('\n⚠ zxing-cpp is not importable. Install it (tools/requirements-harness.txt) — the '
              'floor is quoted on it and this harness will not guess one without it.')
        return 2

    record: dict | None = None
    if args.anchor:
        import asyncio
        dist = pathlib.Path(args.dist).resolve()
        if not (dist / 'app.html').exists():
            raise SystemExit('no built kit at ' + str(dist) + ' — set --dist or ROCOTO_DIST')
        print('\n── THE ANCHOR · the app\'s own mark, out of %s ──' % dist)
        record = asyncio.run(anchor(dist, out))
        print('  locator        ' + record['locator'])
        print('  printed token  ' + (record['printed_token'] or
              '(absent in this bundle — QR-05.3 is proven by drive-198 on the current build)'))
        print('  bundle draws   ' + json.dumps(record['bundle_draws']))
        print('  svg            %s × %s, viewBox %s → %d modules across'
              % (record['svg_width'], record['svg_height'], record['viewBox'], record['across']))
        print('  chromium       ' + record['chromium'])
        print('  BarcodeDetector ' + ('PRESENT · formats ' + json.dumps(record['barcode_detector']['formats'])
                                      if record['barcode_detector']['present'] else 'ABSENT'))
    elif args.anchor_file:
        record = json.loads(pathlib.Path(args.anchor_file).read_text())
    elif (out / 'anchor.json').exists():
        record = json.loads((out / 'anchor.json').read_text())

    if record:
        same, detail = prove_equivalence(record, config)
        print('\n── THE EQUIVALENCE PROOF · the app\'s SVG matrix vs the harness\'s own ──')
        print('  ' + ('IDENTICAL · ' if same else 'MISMATCH · ') + detail)
        if not same:
            raise SystemExit('the batch would measure a symbol the app does not draw — stopping')
        print('  the batch below is therefore the app\'s own symbol, %d times over.' % args.batch)

    payload = {'config': config, 'seed': args.seed, 'batch': args.batch,
               'anchor': {k: record[k] for k in ('locator', 'printed_token', 'across', 'chromium', 'barcode_detector')} if record else None}

    if args.sweep or args.geometry:
        locators = batch_locators(config, args.batch, record['locator'] if record else None)
        across = len(matrix_of(locators[0], config))
        geo = geometry(config, across, args.dpi)
        payload['geometry'] = {**geo, 'modules_across': across}
        print('\n── THE CAPTURE DENSITY THE FLOOR IS QUOTED AT ──')
        print('  mark %.2f mm across %d modules → %.3f mm per module' % (geo['mark_mm'], across, geo['module_mm']))
        print('  at %d dpi that is %d px → %.2f px per module' % (geo['dpi'], geo['capture_px'], geo['px_per_module']))
        print('  batch: %d locators, seed %d, %.2f mark-widths of clear paper around the mark'
              % (len(locators), args.seed, args.margin))

    if args.sweep:
        started = time.time()
        results = sweep(config, locators, geo['capture_px'], args.seed, out, keep_images=True,
                        margin=args.margin)
        held = {key: floors(results, key + '_all') for key in ('zxing', 'zbar', 'either')}
        payload['results'] = results
        payload['floors'] = held
        print('\n── THE SWEEP · every cell is how many of the %d locators decoded ──' % len(locators))
        print(table(results, locators))
        print('\n── THE FLOOR · the harshest step ALL %d locators survived ──' % len(locators))
        print('  %-11s %-16s %-16s %-16s' % ('axis', 'zxing-cpp', 'libzbar', 'either'))
        for axis in held['either']:
            print('  %-11s %-16s %-16s %-16s' % (
                axis, held['zxing'][axis]['floor'] or 'NONE',
                held['zbar'][axis]['floor'] or 'NONE', held['either'][axis]['floor'] or 'NONE'))
        print('\n  %d of %d variants decoded on every one of %d locators (either decoder) · %.1f s'
              % (sum(1 for row in results.values() if row['either_all']), len(results), len(locators), time.time() - started))
        misread = [name for name, row in results.items() if row['misread']]
        print('  a wrong payload was never returned' if not misread
              else '  ⚠ MISREADS on: ' + ', '.join(misread))

    if args.clearspace:
        print('\n── THE CLEARSPACE MEASUREMENT · how much white paper the mark needs around it ──')
        rows = clearspace_sweep(config, locators, geo['capture_px'], args.seed, out)
        payload['clearspace'] = rows
        heads = list(rows[0]['held'])
        print('| clear paper each side | ' + ' | '.join(heads) + ' |')
        print('|---|' + '---:|' * len(heads))
        for row in rows:
            print('| %.2f × the mark | ' % row['margin']
                  + ' | '.join('%d/%d' % (row['held'][name], row['total']) for name in heads) + ' |')

    if args.geometry:
        print('\n── THE GEOMETRY FORK · what another choice would buy, measured ──')
        rows = geometry_fork(config, locators, args.seed, out, margin=args.margin)
        payload['geometry_fork'] = rows
        print('  every cell is how many of the %d locators decoded on zxing-cpp.' % args.batch)
        print(fork_table(rows))

    if args.json:
        pathlib.Path(args.json).write_text(json.dumps(payload, indent=2))
        print('\nJSON → ' + args.json)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
