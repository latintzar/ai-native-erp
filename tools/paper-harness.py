#!/usr/bin/env python3
"""E196.50 · THE PAPER HARNESS — our own paper, handwritten on, photographed badly, read back.

    «if they're printing out a document and then they handwrite on it, and then they take a
     half-assed photo at a wrong angle with bad lighting, we need to automate it perfectly to the
     actual data that they handwrote»                          — Peter, 2026-09-04 (FEED-IA §199)

    «you can even test it by exporting and downresolutioning and even muddling or adding fake dirt
     to the image and then running it through scanning all programmatically without requiring me to
     print and test»                                                    — Peter, 2026-09-04 (§198)

WHAT THIS IS. The whole road, end to end, with no printer and no phone in it:

  1 · PRINT      the kit is opened in a real browser, a day's packing paper is put on the stage, the
                 fullest truck is chosen, the run is printed, and the printed sheet is captured at
                 300 dpi. The manifest the kit measured and POSTed at that moment is fetched back
                 FROM THE RUNTIME by its token — so the geometry under test is the geometry the two
                 halves actually exchanged, never a copy this file made.
  2 · HANDWRITE  a value goes into every final-weight box in three real handwriting faces, in blue
                 or black, at a pen width, leaning ±8°, sometimes struck through and written again,
                 sometimes reaching outside the box; one qty box in eight is corrected beside its
                 printed figure. The ground truth is what was written, kept per (sale, line, cell).
  3 · RUIN       the sheet is photographed the way a phone photographs it: held at an angle in two
                 axes, out of focus, under one strip light with a shadow across the paper, warm,
                 downsampled to 1600 px and sent as a JPEG.
  4 · READ       every ruined photograph is POSTed to a LIVE runtime — the real endpoint, the real
                 Gemini — and scored: the mark decoded, the marks found, the millimetres of
                 registration error at every cell centre, written-or-untouched exactly, and the
                 VALUE exactly, against the truth.
  5 · SAY IT     a table per degradation level and per face, and one floor line: the harshest level
                 at which every value comes back exact, and the accuracy at «half-assed».

THE FLOOR IS PINNED AND THIS FILE FAILS CLOSED. `FLOORS` below carries the numbers measured on this
box, each with the run that measured it. A run that misses one exits 1.

WHY THE GEOMETRY IS MEASURED IN-PROCESS AS WELL AS OVER THE WIRE. The endpoint answers with crops
and values, never with its homography, so «how many millimetres out was the registration» cannot be
read off the response. The same `app.register` the endpoint uses is therefore also called here, on
the same photograph, and its homography is compared against the projective matrix this file
photographed the page with. That is a millimetre, not an adjective — and it costs no model call, so
it can be swept over every level and face while the reader is asked only where the reader is the
question.

RUN IT

    cd docs/kit
    python3 tools/paper-harness.py                          # the whole sweep, A4, three faces
    python3 tools/paper-harness.py --levels half-assed      # one level
    python3 tools/paper-harness.py --papers A4,A5 --fonts caveat
    python3 tools/paper-harness.py --no-read                # geometry and classification only

It starts its own runtime (uvicorn, a free port, `GEMINI_API_KEY` from the environment) and stops it
again, unless `--runtime URL` names one that is already standing. Heavy steps take the build lock.
"""
from __future__ import annotations

import argparse
import asyncio
import base64
import contextlib
import functools
import http.server
import json
import math
import os
import pathlib
import random
import re
import shutil
import socket
import socketserver
import statistics
import subprocess
import sys
import threading
import time
from dataclasses import dataclass, field
from typing import Any

import numpy as np

HERE = pathlib.Path(__file__).resolve().parent
SITUATIONS = HERE.parent
RUNTIME_DIR = SITUATIONS / "runtime"
sys.path.insert(0, str(HERE))          # degrade.py — the shared damage library
sys.path.insert(0, str(RUNTIME_DIR))   # app.register — the same geometry the endpoint runs

import degrade  # noqa: E402  (the repo's own degradation library, reused rather than re-invented)

DAY = "2025-08-25"
"""The seeded demo morning every packing drive already walks."""

DPI = 300
CSS_DPI = 96.0

FONT_SOURCES = {
    # The raw faces from google/fonts. Fetched at run time and DELETED at the end (`--keep-fonts`
    # keeps them): a repository of a design kit has no business carrying three handwriting faces it
    # uses for one measurement.
    "caveat": "https://github.com/google/fonts/raw/main/ofl/caveat/Caveat%5Bwght%5D.ttf",
    "kalam": "https://github.com/google/fonts/raw/main/ofl/kalam/Kalam-Regular.ttf",
    "homemade": "https://github.com/google/fonts/raw/main/apache/homemadeapple/HomemadeApple-Regular.ttf",
}


# ══ THE DEGRADATION LEVELS ═════════════════════════════════════════════════════════════════════

@dataclass(frozen=True)
class Level:
    """One way of photographing a sheet badly. Every field is a number a person can picture."""
    name: str
    tilt: tuple[float, float]   # degrees about the page's own x and y axes — two axes, both used
    motion_px: float            # motion blur in FINAL photograph pixels, along the hand's own drift
    light: str                  # even · vignette · shadow (vignette plus a band across the paper)
    cast: float                 # warm colour cast, 0 none
    jpeg: int                   # the quality a phone and then a messaging app leave behind
    long_side: int              # the pixels a photo arrives with

    @property
    def words(self) -> str:
        return (f"{self.tilt[0]:g}°/{self.tilt[1]:g}° · blur {self.motion_px:g}px · {self.light} · "
                f"q{self.jpeg} · {self.long_side}px")


LEVELS: list[Level] = [
    Level("clean",      (0.0, 0.0),   0.0, "even",     0.00, 85, 1600),
    Level("mild",       (15.0, 15.0), 0.0, "vignette", 0.02, 85, 1600),
    Level("half-assed", (25.0, 25.0), 3.0, "shadow",   0.05, 60, 1600),
    Level("harsh",      (35.0, 35.0), 6.0, "shadow",   0.08, 45, 1600),
    Level("punishing",  (45.0, 45.0), 9.0, "shadow",   0.12, 35, 1600),
]
LEVEL_BY_NAME = {level.name: level for level in LEVELS}

HALF_ASSED = "half-assed"
"""§199.2's own words, as a level: «a half-assed photo at a wrong angle with bad lighting»."""


# ══ THE FLOOR, PINNED ══════════════════════════════════════════════════════════════════════════
# MEASURED ON THIS BOX, NOT CHOSEN. Every number below is a number a run produced, with a little
# headroom under it; a run that misses one exits 1, which is the whole point of pinning it.
#
#   2026-09-05, A4 and A5, three faces:
#
#     level        marks   registration        written/untouched   values exact
#     clean          4     0.16 A4 · 0.28 A5         100 %         100 % · 100 % · 79 %
#     mild           4     0.14 A4 · 0.31 A5         100 %         100 % ·  95 % · 74 %
#     half-assed     4     0.17 A4 · 0.33 A5         100 %         100 % · 100 % · 84 %
#     harsh          —     the mark refuses          —             —
#     punishing      —     the mark refuses          —             —
#
#   · The three faces are Caveat · Kalam · Homemade Apple, in that order.
#   · MARKS, REGISTRATION AND CLASSIFICATION ARE THIS REPOSITORY'S OWN WORK, and the 100 % in that
#     column is measured on the code as it stands: 72 sweeps — both papers × four seeds × three
#     faces × three levels, 2 916 cells — 0 missed and 0 phantom. It was NOT true of the code that
#     first wrote this table: eight of those same sweeps lost a real correction, all of them a
#     quantity corrected beside a glyph-tight printed amount on a SHARP photograph, and the erosion
#     that ate them is gone (`register.PRINTED_OUTSIDE_HALO_MM`).
#   · The «values exact» row at half-assed is gemini-3-flash-preview; clean and mild are the older
#     gemini-2.5-flash-lite sweep and are kept as history, not as a pin (see VALUE_FLOOR).
#   · WHAT A VALUE READS BACK AS IS THE MODEL'S, so it is pinned PER READER and only for readers
#     measured here. An unmeasured reader is a run that proved nothing about values, and it says so
#     rather than passing quietly.
#   · At «harsh» (35°/35°) the mark itself stops decoding at 1600 px and the endpoint answers 422
#     `paper_unknown`, naming the document reader as the other road. It refuses; it does not guess.

FLOORS: dict[str, Any] = {
    "level": "half-assed",         # the harshest level the pin is asserted at
    "written_share": 1.0,          # every box classified written-or-untouched exactly — measured 1.0
    "registration_mm": 0.45,       # worst cell centre, in millimetres — measured 0.33 (A5, half-assed)
    "marks": 4,                    # the code and all three squares
}

VALUE_FLOOR: dict[str, float] = {
    # reader → the share of values that must come back exactly right at the pinned level, with a
    # little headroom under the lowest face measured on it. A reader that is not in this table is a
    # reader nobody has measured here, and a run on one fails the pin rather than passing quietly.
    #
    #   gemini-3-flash-preview     Caveat 1.00 · Kalam 1.00 · Homemade Apple 0.84 at «half-assed»
    #                              (19 s to 225 s a page — it thinks, and it is exact for it).
    #                              Reproduced from a cold start by a second party on the same
    #                              recorded photograph: 19 of 19, 203.6 s a page.
    #
    # ⚠ ONE DRAW IS NOT A FLOOR, AND `gemini-2.5-flash-lite` IS WHY THIS TABLE SAYS SO. It was
    # pinned here at 0.85 on a single sweep that measured Caveat at 0.89. Re-run four hours later on
    # the SAME recorded print, the same hand and the same photograph — every pipeline column
    # identical, marks 4, registration 0.17 mm, 51 of 51 classified — it returned **9 of 19, 47 %**,
    # and three of the ten misses were plain unstruck «14»s that came back «7.4». The value column
    # is the model's, and this model's answer to the same crops moves by half. A floor is a number a
    # run has to beat; a number measured once and refuted on its second reading is a wish. It stays
    # out of this table until somebody measures it repeatedly and pins the LOW draw.
    #
    # ⚠ HOMEMADE APPLE IS THE FLOOR'S OWN FACE. Every reader loses the same kind of value on it — a
    # struck-through correction read as the value that was struck, and a «45,2» whose 4 the face
    # draws like a 1. It is in the sweep precisely because a floor measured on three easy hands
    # would be a floor about nothing.
    "gemini-3-flash-preview": 0.80,
}


# ══ SMALL MACHINERY ════════════════════════════════════════════════════════════════════════════

GREEN: list[str] = []
RED: list[str] = []


def check(ok: bool, label: str, detail: Any = "") -> bool:
    (GREEN if ok else RED).append(label)
    print(("GREEN " if ok else "RED ") + label + ((" · " + str(detail)) if detail != "" else ""), flush=True)
    return bool(ok)


def free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def normalise(said: str | None) -> str | None:
    """A written amount as a plain decimal — the same normalisation the runtime answers with, so
    «12,4» on the paper and «12.4» in the answer are one value and never a miss."""
    if said is None:
        return None
    text = str(said).strip()
    if not text:
        return None
    match = re.search(r"-?\d+(?:[.,]\d+)?", text)
    if not match:
        return text.lower()
    raw = match.group(0).replace(",", ".")
    try:
        value = float(raw)
    except ValueError:
        return text.lower()
    if value.is_integer() and "." not in raw:
        return str(int(value))
    return ("%.4f" % value).rstrip("0").rstrip(".")


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


@contextlib.contextmanager
def serving(directory: pathlib.Path):
    """The built kit, on an origin of its own — the runtime's CORS allows localhost by name."""
    handler = functools.partial(Quiet, directory=str(directory))
    with socketserver.TCPServer(("127.0.0.1", 0), handler) as server:
        port = server.server_address[1]
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            yield f"http://127.0.0.1:{port}/app.html"
        finally:
            server.shutdown()


@contextlib.contextmanager
def local_runtime(state_dir: pathlib.Path, log: pathlib.Path, model: str = ""):
    """SIT/backend under uvicorn on a free port, with the keys this process was started with.

    Never the deployed runtime: this harness POSTs manifests and photographs, and the box's own
    service is another workstream's to deploy."""
    port = free_port()
    state_dir.mkdir(parents=True, exist_ok=True)
    env = dict(os.environ)
    env["ROCOTO_RUNTIME_STATE_DIR"] = str(state_dir)
    env.setdefault("HANDWRITING_READER", "gemini")
    if model:
        env["GEMINI_MODEL"] = model
    with log.open("wb") as sink:
        process = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1",
             "--port", str(port), "--log-level", "warning"],
            cwd=str(RUNTIME_DIR), env=env, stdout=sink, stderr=subprocess.STDOUT)
        base = f"http://127.0.0.1:{port}"
        try:
            import httpx
            for _ in range(40):
                time.sleep(0.5)
                if process.poll() is not None:
                    raise RuntimeError(f"the runtime stopped before it answered; see {log}")
                try:
                    if httpx.get(base + "/api/health", timeout=2.0).status_code == 200:
                        break
                except Exception:  # noqa: BLE001 — still booting
                    continue
            else:
                raise RuntimeError(f"the runtime did not answer on {base}; see {log}")
            yield base
        finally:
            process.terminate()
            with contextlib.suppress(Exception):
                process.wait(timeout=10)


# ══ 1 · THE PRINT ══════════════════════════════════════════════════════════════════════════════

BOOT = """
if (location.origin && location.origin.indexOf('http') === 0) {
  if (!sessionStorage.getItem('rocoto-paper-harness')) {
    sessionStorage.setItem('rocoto-paper-harness', '1');
    localStorage.clear();
    localStorage.setItem('rocoto-app-front-door', 'months');
    localStorage.setItem('rocoto-app-config', JSON.stringify({version: 1, sector: ['fish'], cast: 'fish'}));
    localStorage.setItem('rocoto-app-print', JSON.stringify({version: 1, printer: 'E196 paper harness', paper: 'A4', copies: 1, set: true}));
  }
  /* ⚠ NEVER `location.origin` HERE. The print popup is an about:blank window written into: it
     shares this localStorage and its own origin is the string "null", so an origin-derived base
     pins the whole app at «null» the moment the paper prints (drive-196 found it). The runtime
     this harness started is named outright instead. */
  localStorage.setItem('rocoto-runtime-base', 'RUNTIME_BASE');
}
(() => {
  function probe() {
    const target = this && this.document ? this : window;
    const root = target.document && target.document.documentElement;
    if (root) root.dataset.nativePrintInvoked = String(Number(root.dataset.nativePrintInvoked || '0') + 1);
  }
  function install(target) {
    try { Object.defineProperty(target, 'print', { configurable: true, writable: true, value: probe }); }
    catch (_) { try { target.print = probe; } catch (_) {} }
  }
  install(window);
  const open = window.open.bind(window);
  window.open = function (...args) { const child = open(...args); if (child) install(child); return child; };
})();
"""

SHEETS_IN_POPUP = """
() => [...document.querySelectorAll('[data-paper-sheet]')].map((sheet, index) => {
  const qr = sheet.querySelector('[data-testid="packing-document-qr"]');
  return {
    index,
    page: sheet.getAttribute('data-paper-page'),
    locator: qr ? qr.getAttribute('data-document-locator') : null,
    marks: sheet.querySelectorAll('[data-paper-mark]').length,
    seats: sheet.querySelectorAll('[data-paper-cell="finalWeight"]').length,
    box: (() => { const r = sheet.getBoundingClientRect(); return { w: r.width, h: r.height }; })(),
  };
})
"""


async def print_the_paper(url: str, runtime_base: str, paper: str, out: pathlib.Path) -> dict[str, Any]:
    """Open the kit, put the fullest truck's paper on the stage, print it, keep the sheets at 300 dpi.

    Returns the manifest AS THE RUNTIME HOLDS IT plus one PNG per page of that document.
    """
    import httpx
    from playwright.async_api import async_playwright

    shots: list[dict[str, Any]] = []
    async with async_playwright() as engine:
        browser = await engine.chromium.launch(args=["--no-sandbox", "--font-render-hinting=none"])
        # A print sheet is life size at 96 dpi; a device scale of 300/96 makes every screenshot of
        # it a 300 dpi page, which is what a print looks like to a camera.
        context = await browser.new_context(viewport={"width": 1600, "height": 900},
                                            device_scale_factor=DPI / CSS_DPI)
        await context.add_init_script(BOOT.replace("RUNTIME_BASE", runtime_base))
        page = await context.new_page()
        page.set_default_timeout(40000)
        errors: list[str] = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)

        await page.goto(url + "#/sales", wait_until="networkidle")
        await page.locator("[data-testid=river]").wait_for()

        door = page.locator(f'[data-testid="day-packing-{DAY}-paper"]')
        await door.wait_for()
        await door.click()
        await page.locator('[data-testid="packing-document-qr"]').wait_for()
        if paper == "A5":
            await page.locator('[data-testid="print-packing-paper-a5"]').click()
            await page.locator('[data-testid="print-packing-paper"][data-paper="A5"]').wait_for()
            await page.wait_for_function(
                "() => { const s = document.querySelector('[data-paper-sheet]');"
                " return s && Math.abs(s.getBoundingClientRect().width / s.getBoundingClientRect().height"
                " - 559 / 794) < 0.0012; }")

        # THE FULLEST TRUCK, chosen rather than assumed — «there are multiple orders on the same
        # paper» is the case this whole road exists for.
        select = page.locator('[data-testid="print-run-document"]')
        options = await select.locator("option").count()
        best, most = 0, -1
        for at in range(options):
            await select.select_option(str(at))
            await page.wait_for_timeout(120)
            orders = await page.locator("[data-paper-order]").count()
            if orders > most:
                best, most = at, orders
        await select.select_option(str(best))
        await page.locator('[data-testid="packing-document-qr"]').wait_for()
        await page.wait_for_function(
            "() => (JSON.parse(localStorage.getItem('rocoto-packing-marks-v1') || '[]')).some(m => m.manifest)")
        locator = await page.locator('[data-testid="packing-document-qr"]').get_attribute("data-document-locator")
        token = (locator or "").rsplit("/", 1)[-1]

        run = page.locator('[data-testid="print-run"]')
        trucks = await run.get_attribute("data-trucks")
        orders_in_day = await run.get_attribute("data-orders")

        async with context.expect_page() as opened:
            await page.locator('[data-testid="print-packing"]').click()
        popup = await opened.value
        await popup.wait_for_load_state("domcontentloaded")
        await popup.locator("#rocoto-print-document").wait_for()
        await popup.locator('html[data-native-print-invoked="1"]').wait_for()

        # WHICH SHEETS ARE THIS DOCUMENT'S. The whole run prints — a divider before every truck and
        # every truck's paper after it — so the sheets are walked in order and each is attributed to
        # the last document code seen above it. A divider carries no marks and no code, so it
        # attributes to nothing; a page two of our document carries the marks and no code, which is
        # exactly the sheet we want.
        described = await popup.evaluate(SHEETS_IN_POPUP)
        mine: list[dict[str, Any]] = []
        current = None
        for row in described:
            if row["locator"]:
                current = row["locator"]
            if row["marks"] == 3 and current == locator:
                mine.append(row)

        handles = await popup.locator("[data-paper-sheet]").all()
        for at, row in enumerate(mine):
            shot = out / f"print-{paper}-p{at}.png"
            await handles[row["index"]].screenshot(path=str(shot))
            shots.append({"page": at, "png": str(shot), "seats": row["seats"], "cssBox": row["box"]})

        await context.close()
        await browser.close()

    held = httpx.get(f"{runtime_base}/api/paper/manifest/{token}", timeout=20.0)
    if held.status_code != 200:
        raise RuntimeError(f"the runtime holds no manifest for {token}: {held.status_code} {held.text[:200]}")
    manifest = held.json()

    record = {
        "paper": paper, "locator": locator, "token": token, "manifest": manifest,
        "pages": shots, "ordersOnThisPaper": most, "trucks": trucks, "ordersInDay": orders_in_day,
        "errors": errors[:6],
    }
    (out / f"print-{paper}.json").write_text(json.dumps(record, indent=1))
    return record


# ══ 2 · THE HAND ═══════════════════════════════════════════════════════════════════════════════

VALUE_SHAPES = ["12,4", "8", "3,75", "126", "27,5", "0,9", "14", "45,2", "6,25", "231", "18,6", "2"]
"""Decimals with a comma, one to four digits — the way a person writes a weight in a box."""

INKS = {"blue": (28, 46, 122), "black": (26, 26, 32)}


@dataclass
class Written:
    """One thing a hand did to a box, and what it means."""
    sale: str
    line: str                   # the kit's own id — «l1», never a number this file invented
    cell: str
    truth: str                  # what the hand meant, normalised the way the runtime answers
    drawn: str                  # what it wrote, as it wrote it («12,4»)
    shape: str                  # plain · struck · outside
    ink: str
    pen: int
    lean: float


def _font(path: pathlib.Path, size: int):
    from PIL import ImageFont
    return ImageFont.truetype(str(path), max(8, int(size)))


def _stamp(canvas, text: str, box_px: tuple[float, float, float, float], face: pathlib.Path,
           ink: tuple[int, int, int], pen: int, lean: float, rng: random.Random,
           strike: bool = False, dx: float = 0.0, dy: float = 0.0, fill: float = 0.78):
    """Write one thing into (or slightly outside) one box, leaning.

    The text is drawn on its own transparent layer, rotated about its own centre and composited, so
    a lean does not smear the page under it — which is what a pen on paper does."""
    from PIL import Image, ImageDraw
    x0, y0, w, h = box_px
    size = max(10, int(h * fill))
    font = _font(face, size)
    layer = Image.new("RGBA", (int(w * 2.4) + 40, int(h * 2.4) + 40), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    left, top, right, bottom = draw.textbbox((0, 0), text, font=font, stroke_width=pen)
    tw, th = max(1, right - left), max(1, bottom - top)
    while tw > w * 1.25 and size > 10:
        size = int(size * 0.9)
        font = _font(face, size)
        left, top, right, bottom = draw.textbbox((0, 0), text, font=font, stroke_width=pen)
        tw, th = max(1, right - left), max(1, bottom - top)
    px = (layer.width - tw) / 2 - left
    py = (layer.height - th) / 2 - top
    draw.text((px, py), text, font=font, fill=(*ink, 255), stroke_width=pen, stroke_fill=(*ink, 255))
    if strike:
        # A struck value: one stroke through it, at the angle a hand strikes at.
        sy = py + top + th * 0.55
        draw.line([(px + left - tw * 0.08, sy + th * 0.10), (px + left + tw * 1.08, sy - th * 0.10)],
                  fill=(*ink, 255), width=max(2, pen + 3))
    layer = layer.rotate(lean, resample=Image.Resampling.BICUBIC, center=(layer.width / 2, layer.height / 2))
    cx = x0 + w / 2 + dx
    cy = y0 + h / 2 + dy
    canvas.alpha_composite(layer, (int(round(cx - layer.width / 2)), int(round(cy - layer.height / 2))))


def _strike(canvas, box_px: tuple[float, float, float, float], ink: tuple[int, int, int], pen: int) -> None:
    """One stroke through a printed figure — what a person does before writing the right one."""
    from PIL import Image, ImageDraw
    x0, y0, w, h = box_px
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).line([(x0 - w * 0.14, y0 + h * 0.62), (x0 + w * 1.14, y0 + h * 0.38)],
                               fill=(*ink, 255), width=max(2, pen + 3))
    canvas.alpha_composite(layer)


def handwrite(page_png: pathlib.Path, manifest: dict[str, Any], page_index: int, face: pathlib.Path,
              seed: int, out: pathlib.Path) -> tuple[pathlib.Path, list[Written], float]:
    """Fill in the paper. Returns the written page, the truth, and the page's pixels per millimetre."""
    from PIL import Image
    rng = random.Random(seed)
    sheet = Image.open(page_png).convert("RGBA")
    page = next(p for p in manifest["pages"] if int(p["index"]) == page_index)
    px_per_mm = sheet.width / float(manifest["pageMm"]["w"])

    truth: list[Written] = []
    qty_seen = 0
    for block in page.get("blocks", []):
        for row in block.get("rows", []):
            cells = row.get("cells") or {}
            seat = cells.get("finalWeight")
            if seat:
                drawn = rng.choice(VALUE_SHAPES)
                ink_name = rng.choice(["blue", "blue", "black"])
                pen = rng.choice([0, 1, 2])
                lean = rng.uniform(-8.0, 8.0)
                shape = "plain"
                roll = rng.random()
                dx = dy = 0.0
                if roll < 0.16:
                    # STRUCK THROUGH AND WRITTEN AGAIN. What the person means is the correction, so
                    # the correction is the truth — and the reader has to know that too.
                    shape = "struck"
                    first = rng.choice([v for v in VALUE_SHAPES if v != drawn])
                    _stamp(sheet, first, _box(seat, px_per_mm), face, INKS[ink_name], pen,
                           lean, rng, strike=True, dx=-seat["w"] * px_per_mm * 0.22, fill=0.62)
                    dx = seat["w"] * px_per_mm * 0.26
                elif roll < 0.36:
                    # SLIGHTLY OUTSIDE THE BOX — a hand does not respect a printed rule.
                    shape = "outside"
                    dx = rng.uniform(-1.8, 1.8) * px_per_mm
                    dy = rng.uniform(-1.4, 1.4) * px_per_mm
                _stamp(sheet, drawn, _box(seat, px_per_mm), face, INKS[ink_name], pen, lean, rng,
                       dx=dx, dy=dy, fill=0.66 if shape == "struck" else 0.78)
                truth.append(Written(sale=str(block["sale"]), line=str(row["line"]), cell="finalWeight",
                                     truth=normalise(drawn) or drawn, drawn=drawn, shape=shape,
                                     ink=ink_name, pen=pen, lean=round(lean, 1)))
            qty = cells.get("qty")
            if qty:
                qty_seen += 1
                if qty_seen % 8 == 3:
                    # ONE IN EIGHT, CORRECTED BESIDE THE PRINTED FIGURE — the printed-cell road.
                    # ⚠ BESIDE MEANS ON THE PAPER NEXT TO IT, not on top of it. The kit measures a
                    # printed value's rectangle as the value's own INK — «8» is 2.6 mm — so an
                    # offset scaled to that box lands the correction on the printed figure, which is
                    # the one arrangement no ink test can separate (the runtime's own PAR-10.4 owns
                    # that limit). A hand strikes the figure and writes in the free paper beside it,
                    # and on this sheet the free paper is to the left: the amount column's own
                    # padding, measured at over 100 mm before the product name begins.
                    drawn = rng.choice(VALUE_SHAPES)
                    ink_name = rng.choice(["blue", "black"])
                    pen = rng.choice([0, 1])
                    lean = rng.uniform(-8.0, 8.0)
                    _strike(sheet, _box(qty, px_per_mm), INKS[ink_name], pen)
                    # ⚠ AND IT IS WRITTEN AT A HAND'S OWN SIZE. `_stamp` shrinks a value to fit the
                    # box it is given, and the box the manifest gives for a printed «20» is 2.6 mm
                    # wide — a «126» stamped into it comes out 2 mm tall and grey, which is not a
                    # correction, it is a smudge. The correction is written in the free paper beside
                    # the figure, in a box the size a hand actually uses.
                    beside = (qty["x"] - 13.0) * px_per_mm, qty["y"] * px_per_mm, \
                        12.0 * px_per_mm, qty["h"] * px_per_mm
                    _stamp(sheet, drawn, beside, face, INKS[ink_name], pen, lean, rng, fill=0.86)
                    truth.append(Written(sale=str(block["sale"]), line=str(row["line"]), cell="qty",
                                         truth=normalise(drawn) or drawn, drawn=drawn, shape="beside",
                                         ink=ink_name, pen=pen, lean=round(lean, 1)))

    written = out / f"written-{page_png.stem}-{face.stem.lower()}.png"
    sheet.convert("RGB").save(written)
    return written, truth, px_per_mm


def _box(cell: dict[str, float], px_per_mm: float) -> tuple[float, float, float, float]:
    return (float(cell["x"]) * px_per_mm, float(cell["y"]) * px_per_mm,
            float(cell["w"]) * px_per_mm, float(cell["h"]) * px_per_mm)


# ══ 3 · THE PHOTOGRAPH, RUINED ═════════════════════════════════════════════════════════════════

PAD_MM = 14.0
SURFACE = (198, 196, 190)
"""The steel table the sheet is lying on. Paper never fills a phone frame."""


def photograph(written_png: pathlib.Path, level: Level, seed: int, out: pathlib.Path,
               px_per_mm: float) -> tuple[pathlib.Path, np.ndarray]:
    """Photograph the sheet badly, and return the projective matrix it was photographed with.

    The matrix is the ground truth every millimetre in this file is measured against: page
    millimetres go through it to land exactly where they land in the photograph.
    """
    import cv2
    from PIL import Image

    sheet = Image.open(written_png).convert("RGB")
    pad = int(round(PAD_MM * px_per_mm))
    table = Image.new("RGB", (sheet.width + 2 * pad, sheet.height + 2 * pad), SURFACE)
    table.paste(sheet, (pad, pad))

    # ── the phone, held at an angle in two axes ────────────────────────────────────────────────
    source = np.array([[pad, pad], [pad + sheet.width, pad], [pad + sheet.width, pad + sheet.height],
                       [pad, pad + sheet.height]], dtype=np.float32)
    target = _tilted(sheet.width, sheet.height, level.tilt)
    target[:, 0] += pad
    target[:, 1] += pad
    shift_x = float(min(0.0, target[:, 0].min()))
    shift_y = float(min(0.0, target[:, 1].min()))
    target[:, 0] -= shift_x
    target[:, 1] -= shift_y
    width = int(math.ceil(max(target[:, 0].max(), table.width - shift_x)))
    height = int(math.ceil(max(target[:, 1].max(), table.height - shift_y)))
    matrix = cv2.getPerspectiveTransform(source, target.astype(np.float32))
    frame = cv2.warpPerspective(np.array(table)[:, :, ::-1], matrix, (width, height),
                                flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_CONSTANT,
                                borderValue=SURFACE[::-1])

    # ── the phone's own resolution ─────────────────────────────────────────────────────────────
    scale = level.long_side / max(frame.shape[0], frame.shape[1])
    if scale < 1.0:
        frame = cv2.resize(frame, (max(1, int(round(frame.shape[1] * scale))),
                                   max(1, int(round(frame.shape[0] * scale)))),
                           interpolation=cv2.INTER_AREA)
    else:
        scale = 1.0

    picture = Image.fromarray(frame[:, :, ::-1])
    if level.light != "even":
        # THE ROOM'S OWN RAMP comes from the shared library, so this harness and the QR sweep damage
        # a page the same way and their two floors are comparable numbers (degrade.py's own reason
        # for existing). The vignette and the shadow band are laid over it here, because a strip
        # light with somebody standing under it is not a ramp.
        picture = degrade.uneven_light(picture, contrast=0.8, gradient=0.22, seed=seed)
    picture = _lit(picture, level, seed)
    if level.motion_px > 0:
        picture = _moved(picture, level.motion_px, seed)
    # TWO COMPRESSIONS, because that is how a photograph reaches anybody: the camera writes a JPEG
    # and the app that carries it writes another. `degrade.jpeg_cycle` is the first.
    picture = degrade.jpeg_cycle(picture, quality=min(92, level.jpeg + 25), seed=seed)
    photo = out / f"photo-{written_png.stem}-{level.name}.jpg"
    picture.save(photo, format="JPEG", quality=level.jpeg, subsampling=2)

    # page-mm → photograph pixels, as one matrix: the sheet's own scale, then the tilt, then the
    # phone's resolution.
    to_sheet = np.array([[px_per_mm, 0.0, pad], [0.0, px_per_mm, pad], [0.0, 0.0, 1.0]])
    down = np.array([[scale, 0.0, 0.0], [0.0, scale, 0.0], [0.0, 0.0, 1.0]])
    return photo, down @ matrix @ to_sheet


def _tilted(width: int, height: int, tilt: tuple[float, float]) -> np.ndarray:
    """Where the four corners of a sheet land when it is held at an angle, through a real lens.

    A pinhole camera at 2.2 sheet-lengths, the page turned about its own horizontal and vertical
    axes. Not a shear: a shear keeps every horizontal line the same length, and the whole difficulty
    of a photographed page is that the far edge is SHORTER than the near one."""
    alpha, beta = math.radians(tilt[0]), math.radians(tilt[1])
    distance = 2.2 * max(width, height)
    rx = np.array([[1, 0, 0], [0, math.cos(alpha), -math.sin(alpha)], [0, math.sin(alpha), math.cos(alpha)]])
    ry = np.array([[math.cos(beta), 0, math.sin(beta)], [0, 1, 0], [-math.sin(beta), 0, math.cos(beta)]])
    rotation = ry @ rx
    corners = np.array([[-width / 2, -height / 2, 0], [width / 2, -height / 2, 0],
                        [width / 2, height / 2, 0], [-width / 2, height / 2, 0]], dtype=float)
    turned = corners @ rotation.T
    turned[:, 2] += distance
    projected = np.stack([distance * turned[:, 0] / turned[:, 2] + width / 2,
                          distance * turned[:, 1] / turned[:, 2] + height / 2], axis=1)
    return projected.astype(np.float64)


def _lit(picture, level: Level, seed: int):
    """One strip light overhead, the room's own corners falling away, and a shadow across the paper."""
    from PIL import Image
    if level.light == "even" and level.cast <= 0:
        return picture
    array = np.array(picture, dtype=np.float32)
    height, width = array.shape[:2]
    ys = np.linspace(-1.0, 1.0, height, dtype=np.float32)[:, None]
    xs = np.linspace(-1.0, 1.0, width, dtype=np.float32)[None, :]
    lamp = np.ones((height, width), dtype=np.float32)
    if level.light in ("vignette", "shadow"):
        lamp *= 1.0 - 0.42 * np.clip((xs ** 2 + ys ** 2) / 2.0, 0.0, 1.0)
        lamp *= 1.0 - 0.16 * (ys + 1.0) / 2.0
    if level.light == "shadow":
        # SOMEBODY'S ARM. A band across the sheet, soft at its edges, at the angle a person stands.
        rng = np.random.default_rng((seed * 7919) & 0xFFFFFFFF)
        centre = float(rng.uniform(-0.35, 0.35))
        band = np.exp(-((0.72 * ys + 0.69 * xs - centre) ** 2) / (2 * 0.19 ** 2))
        lamp *= 1.0 - 0.38 * band
    array *= lamp[:, :, None]
    if level.cast > 0:
        array[:, :, 0] *= 1.0 + level.cast          # tungsten: warm, and the blue end goes first
        array[:, :, 2] *= 1.0 - level.cast * 1.6
    return Image.fromarray(np.clip(array, 0, 255).astype(np.uint8))


def _moved(picture, pixels: float, seed: int):
    """A hand that moved while the shutter was open: a line kernel, at a hand's own angle."""
    import cv2
    rng = np.random.default_rng((seed * 104729) & 0xFFFFFFFF)
    angle = float(rng.uniform(-35.0, 35.0))
    length = max(2, int(round(pixels)))
    kernel = np.zeros((length, length), dtype=np.float32)
    kernel[length // 2, :] = 1.0
    rotation = cv2.getRotationMatrix2D((length / 2 - 0.5, length / 2 - 0.5), angle, 1.0)
    kernel = cv2.warpAffine(kernel, rotation, (length, length))
    total = kernel.sum()
    kernel = kernel / total if total > 0 else kernel
    from PIL import Image
    moved = cv2.filter2D(np.array(picture), -1, kernel)
    return Image.fromarray(moved)


# ══ 4 · THE READ, AND THE SCORE ════════════════════════════════════════════════════════════════

@dataclass
class Score:
    paper: str
    face: str
    level: str
    qr: bool = False
    marks: int = 0
    registration_mm: float | None = None
    written_right: int = 0
    written_total: int = 0
    false_writes: int = 0
    value_right: int = 0
    value_total: int = 0
    ms: int = 0
    reader: str = ""
    tilt: float = 0.0
    blur: float = 0.0
    light: float = 0.0
    misses: list[str] = field(default_factory=list)
    said: str = ""

    @property
    def written_share(self) -> float:
        return self.written_right / self.written_total if self.written_total else 0.0

    @property
    def value_share(self) -> float:
        return self.value_right / self.value_total if self.value_total else 0.0


def registration_error(photo: pathlib.Path, manifest: dict[str, Any], page_index: int,
                       ground_truth: np.ndarray) -> tuple[float | None, int]:
    """How many millimetres out the runtime's own registration is, at every cell centre.

    The endpoint never returns its homography, so the same module the endpoint runs is called here
    on the same photograph. Every cell centre is projected with the runtime's homography and then
    brought BACK to page millimetres through the matrix the photograph was actually made with; the
    distance between where it started and where it comes back is the error, in millimetres, on the
    page — which is the unit a crop margin is written in.
    """
    import cv2

    from app import register as reg

    frame = cv2.imread(str(photo), cv2.IMREAD_COLOR)
    if frame is None:
        return None, 0
    registration = reg.register(frame, manifest)
    if registration is None:
        return None, 0
    page = next((p for p in manifest["pages"] if int(p["index"]) == page_index), None)
    centres = [[float(cell["x"]) + float(cell["w"]) / 2, float(cell["y"]) + float(cell["h"]) / 2]
               for block in (page or {}).get("blocks", []) for row in block.get("rows", [])
               for cell in [(row.get("cells") or {}).get("finalWeight")] if cell]
    if not centres:
        return None, registration.marks_found
    points = np.array(centres, dtype=np.float32)
    landed = reg._project(registration.homography, points)          # noqa: SLF001 — the geometry itself
    back = cv2.perspectiveTransform(landed.reshape(-1, 1, 2).astype(np.float32),
                                    np.linalg.inv(ground_truth)).reshape(-1, 2)
    return float(np.max(np.linalg.norm(back - points, axis=1))), registration.marks_found


class QuotaSpent(RuntimeError):
    """The reader has nothing left today. A harness cannot measure a floor without a reader, and it
    says so rather than filling the table with zeros that look like failures of the pipeline."""


def read_back(photo: pathlib.Path, runtime_base: str, timeout: float = 420.0,
              waits: tuple[int, ...] = (20, 45, 90)) -> tuple[dict[str, Any], int]:
    """POST the photograph to the LIVE endpoint. A busy reader waits and is asked again — never a fake."""
    import httpx
    for attempt in range(len(waits) + 1):
        started = time.time()
        with photo.open("rb") as handle:
            answer = httpx.post(runtime_base + "/api/paper/read",
                                files={"file": (photo.name, handle, "image/jpeg")}, timeout=timeout)
        ms = int((time.time() - started) * 1000)
        if answer.status_code == 200:
            return answer.json(), ms
        body = answer.text[:400]
        busy = "429" in body or answer.status_code in (502, 503)
        if busy and attempt < len(waits):
            print(f"   … the reader is busy ({answer.status_code}); waiting {waits[attempt]}s and asking again",
                  flush=True)
            time.sleep(waits[attempt])
            continue
        if busy:
            raise QuotaSpent("the reader answered 429 four times over three minutes: "
                             "its quota is spent, and a floor measured without a reader is not a floor")
        return {"httpStatus": answer.status_code, "body": body}, ms
    return {"httpStatus": 429, "body": "the reader stayed busy"}, 0


def score_one(paper: str, face: str, level: Level, photo: pathlib.Path, manifest: dict[str, Any],
              page_index: int, truth: list[Written], ground_truth: np.ndarray,
              runtime_base: str, ask: bool, crops_to: pathlib.Path | None = None) -> Score:
    score = Score(paper=paper, face=face, level=level.name)
    score.registration_mm, marks_in_process = registration_error(photo, manifest, page_index, ground_truth)
    score.marks = marks_in_process
    if not ask:
        return score

    answer, ms = read_back(photo, runtime_base)
    score.ms = ms
    if "httpStatus" in answer:
        score.said = f"http {answer['httpStatus']} {answer['body'][:90]}"
        return score
    score.qr = bool(answer.get("token"))
    score.marks = int((answer.get("evidence") or {}).get("marksFound") or score.marks)
    score.ms = int((answer.get("evidence") or {}).get("ms") or ms)
    score.reader = str((answer.get("evidence") or {}).get("reader") or "")
    pages = answer.get("pages") or []
    if not pages:
        score.said = "the page would not lie flat"
        return score
    # WHICH PAGE DID IT THINK IT WAS LOOKING AT? A run that reads the right values off the wrong
    # page is the one failure this whole road exists to prevent, so it is named rather than left to
    # show up as nineteen misses.
    chosen = int(pages[0].get("index") or 0)
    if chosen != page_index:
        score.said = f"read against page {chosen}; this is page {page_index}"
    quality = pages[0].get("quality") or {}
    score.tilt = float(quality.get("tiltDeg") or 0.0)
    score.blur = float(quality.get("blurScore") or 0.0)
    score.light = float(quality.get("lightScore") or 0.0)

    readings = {(r["sale"], str(r["line"]), r["cell"]): r for r in pages[0].get("readings") or []}
    wanted = {(w.sale, w.line, w.cell): w for w in truth}
    for key, reading in readings.items():
        want = wanted.get(key)
        score.written_total += 1
        if bool(reading.get("written")) == (want is not None):
            score.written_right += 1
        elif want is None:
            score.false_writes += 1
    for key, want in wanted.items():
        score.value_total += 1
        reading = readings.get(key)
        said = normalise(reading.get("value")) if reading else None
        if said is not None and said == want.truth:
            score.value_right += 1
        else:
            score.misses.append(f"{key[0]} {key[1]} {key[2]} ({want.shape}, {want.ink}, pen {want.pen}, "
                                f"{want.lean:+.0f}°): wrote «{want.drawn}», read «{said}»")
            if crops_to is not None and reading and reading.get("crop"):
                # LOOK AT WHAT THE READER WAS SHOWN. A miss is either a bad crop or a bad reading,
                # and the only way to tell them apart is to open the crop.
                crops_to.mkdir(parents=True, exist_ok=True)
                name = f"{level.name}-{face}-{key[0]}-{key[1]}-{key[2]}-wrote-{want.drawn.replace(',', 'c')}.png"
                (crops_to / name).write_bytes(base64.b64decode(str(reading["crop"]).split(",", 1)[-1]))
    return score


# ══ 5 · THE TABLE, AND THE FLOOR ═══════════════════════════════════════════════════════════════

def table(scores: list[Score]) -> None:
    readers = sorted({s.reader for s in scores if s.reader})
    print("")
    if readers:
        print("  read by " + " · ".join(readers))
    print("  " + "─" * 104)
    print("  %-4s %-9s %-11s %5s %5s %7s %10s %10s %6s %7s" %
          ("PAP", "FACE", "LEVEL", "QR", "MARKS", "REG mm", "WRITTEN", "VALUE", "FALSE", "ms"))
    print("  " + "─" * 104)
    for score in scores:
        print("  %-4s %-9s %-11s %5s %5d %7s %9s%% %9s%% %6d %7d" % (
            score.paper, score.face, score.level,
            "yes" if score.qr else "no", score.marks,
            ("%.2f" % score.registration_mm) if score.registration_mm is not None else "—",
            "%.0f" % (100 * score.written_share), "%.0f" % (100 * score.value_share),
            score.false_writes, score.ms))
    print("  " + "─" * 104)


def floor_line(scores: list[Score]) -> dict[str, Any]:
    """The one sentence a person wants: how badly can you photograph it and still be exactly right."""
    by_level: dict[str, list[Score]] = {}
    for score in scores:
        by_level.setdefault(score.level, []).append(score)
    exact = None
    for level in LEVELS:
        rows = by_level.get(level.name)
        if not rows:
            continue
        if all(row.value_total and row.value_share >= 1.0 for row in rows):
            exact = level.name
    half = by_level.get(HALF_ASSED) or []
    measured = {
        "reader": " · ".join(sorted({row.reader for row in scores if row.reader})),
        "exact_level": exact,
        "exact_share": min((row.value_share for row in by_level.get(exact or "", [])), default=0.0),
        "half_assed_written": min((row.written_share for row in half), default=0.0),
        "half_assed_value": min((row.value_share for row in half), default=0.0),
        "registration_mm": max((row.registration_mm or 99.0) for row in half) if half else None,
        "marks": min((row.marks for row in half), default=0),
        "half_assed_ms": int(statistics.mean([row.ms for row in half])) if half else 0,
    }
    print("")
    print("  THE FLOOR" + (("  ·  read by " + measured["reader"]) if measured["reader"] else ""))
    print("  Every value exact, at the harshest level that holds it: %s" % (measured["exact_level"] or "none"))
    if half:
        print("  Half-assed (%s): %.0f%% of values exact, %.0f%% of boxes classified exactly, "
              "%d marks, %.2f mm at the cell centres, %d ms a page." % (
                  LEVEL_BY_NAME[HALF_ASSED].words, 100 * measured["half_assed_value"],
                  100 * measured["half_assed_written"], measured["marks"],
                  measured["registration_mm"] or 0.0, measured["half_assed_ms"]))
    return measured


def hold_the_floor(scores: list[Score], measured: dict[str, Any]) -> None:
    """FAIL CLOSED. The pinned floor is a measurement, and a run that misses it exits 1.

    A run holds only the levels it actually photographed — the drive runs one — so the pin is
    asserted level by level over what is present, and a run that photographed nothing at or inside
    the pinned level is a run that proved nothing and says so."""
    order = [level.name for level in LEVELS]
    limit = order.index(FLOORS["level"])
    inside = [row for row in scores if order.index(row.level) <= limit and row.value_total]
    check(bool(inside), "PAR-10.7 · the run photographed a level the floor is pinned at",
          " · ".join(sorted({row.level for row in scores})) or "none")
    for row in inside:
        pinned = VALUE_FLOOR.get(row.reader)
        check(pinned is not None,
              "PAR-10.7 · the reader that answered has a floor measured on this box (%s)" % row.face,
              row.reader or "none")
        check(row.value_share >= (pinned or 1.0) - 1e-9,
              "PAR-10.7 · values exact at «%s» (%s, %s)" % (row.level, row.face, row.reader),
              "%d of %d (floor %.0f%%)" % (row.value_right, row.value_total, 100 * (pinned or 1.0)))
        check(row.written_share >= FLOORS["written_share"] - 1e-9,
              "PAR-10.7 · every box written-or-untouched exactly at «%s» (%s)" % (row.level, row.face),
              "%d of %d" % (row.written_right, row.written_total))
        check((row.registration_mm or 99.0) <= FLOORS["registration_mm"] + 1e-9,
              "PAR-10.7 · registration at «%s» (%s), in millimetres" % (row.level, row.face),
              "%.2f mm (floor %.2f)" % (row.registration_mm or 99.0, FLOORS["registration_mm"]))
        check(row.marks >= FLOORS["marks"],
              "PAR-10.7 · marks found at «%s» (%s)" % (row.level, row.face),
              "%d (floor %d)" % (row.marks, FLOORS["marks"]))


# ══ THE RUN ════════════════════════════════════════════════════════════════════════════════════

def fetch_fonts(names: list[str], where: pathlib.Path) -> dict[str, pathlib.Path]:
    import httpx
    where.mkdir(parents=True, exist_ok=True)
    faces: dict[str, pathlib.Path] = {}
    for name in names:
        face = where / f"{name}.ttf"
        if not face.exists():
            face.write_bytes(httpx.get(FONT_SOURCES[name], follow_redirects=True, timeout=90.0).content)
        faces[name] = face
    return faces


def main() -> int:
    parser = argparse.ArgumentParser(description="print · handwrite · ruin · read back")
    parser.add_argument("--out", default=os.environ.get("ROCOTO_HARNESS_OUT", "/tmp/rocoto-paper-harness"))
    parser.add_argument("--dist", default=os.environ.get("ROCOTO_DIST", "app/dist-export-review"))
    parser.add_argument("--runtime", default=os.environ.get("ROCOTO_RUNTIME", ""))
    parser.add_argument("--papers", default="A4")
    parser.add_argument("--fonts", default="caveat,kalam,homemade")
    parser.add_argument("--levels", default=",".join(level.name for level in LEVELS))
    parser.add_argument("--seed", type=int, default=196)
    parser.add_argument("--model", default=os.environ.get("GEMINI_MODEL", ""),
                        help="the reader to measure with; empty means the runtime's own default")
    parser.add_argument("--reuse-print", action="store_true", help="keep the printed sheets from a previous run")
    parser.add_argument("--no-read", action="store_true", help="geometry and classification only; no model")
    parser.add_argument("--keep-fonts", action="store_true")
    parser.add_argument("--keep-photos", action="store_true", help="leave the ruined photographs on disk")
    parser.add_argument("--dump-crops", action="store_true", help="write the crop of every missed cell")
    parser.add_argument("--label", default="", help="a name for this run's own scores file")
    parser.add_argument("--no-floor", action="store_true", help="measure and print, without holding the pin")
    args = parser.parse_args()

    out = pathlib.Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    dist = pathlib.Path(args.dist).resolve()
    papers = [p.strip().upper() for p in args.papers.split(",") if p.strip()]
    faces_wanted = [f.strip().lower() for f in args.fonts.split(",") if f.strip()]
    unknown = [n.strip() for n in args.levels.split(",") if n.strip() and n.strip() not in LEVEL_BY_NAME]
    unknown += [f for f in faces_wanted if f not in FONT_SOURCES]
    unknown += [p for p in papers if p not in ("A4", "A5")]
    if unknown:
        print("RED this run asks for something the harness does not have: " + " · ".join(unknown))
        print("    papers A4 · A5   faces " + " · ".join(FONT_SOURCES)
              + "   levels " + " · ".join(level.name for level in LEVELS))
        return 1
    levels = [LEVEL_BY_NAME[n.strip()] for n in args.levels.split(",") if n.strip()]
    if not (dist / "app.html").is_file():
        print(f"RED the built kit is not at {dist} — run `npm run build:app-en` first")
        return 1

    faces = fetch_fonts(faces_wanted, out / "fonts")
    scores: list[Score] = []
    spent: str = ""
    try:
        with contextlib.ExitStack() as stack:
            base = args.runtime or stack.enter_context(
                local_runtime(out / "state", out / "runtime.log", args.model))
            print(f"the runtime answers on {base}", flush=True)

            for paper in papers:
                cached = out / f"print-{paper}.json"
                if args.reuse_print and cached.exists():
                    record = json.loads(cached.read_text())
                    import httpx
                    held = httpx.post(base + "/api/paper/manifest", json=record["manifest"], timeout=30.0)
                    check(held.status_code == 200, f"{paper}: the kept manifest is handed back to the runtime",
                          held.status_code)
                else:
                    with serving(dist) as url:
                        record = asyncio.run(print_the_paper(url, base, paper, out))
                manifest = record["manifest"]
                check(bool(manifest.get("pages")), f"{paper}: the runtime holds the layout the print recorded",
                      "%s · %d page(s) · %s orders on this paper" % (record["token"], len(manifest["pages"]),
                                                                     record["ordersOnThisPaper"]))
                page_index = max(range(len(record["pages"])),
                                 key=lambda i: record["pages"][i]["seats"])
                sheet_png = pathlib.Path(record["pages"][page_index]["png"])

                # THE HAND FIRST, THE CAMERA AFTER. One written page per face, then every level
                # across all three — so a run that loses its reader half way still holds whole rows
                # of the table rather than one face's worth of everything.
                hands: dict[str, tuple[pathlib.Path, list[Written], float]] = {}
                for face_name, face in faces.items():
                    written, truth, px_per_mm = handwrite(sheet_png, manifest, page_index, face,
                                                          args.seed, out)
                    hands[face_name] = (written, truth, px_per_mm)
                    check(len(truth) > 0, f"{paper} {face_name}: the hand filled the paper in",
                          "%d boxes · %d struck · %d beside · %d outside the box" % (
                              len(truth), sum(1 for t in truth if t.shape == "struck"),
                              sum(1 for t in truth if t.shape == "beside"),
                              sum(1 for t in truth if t.shape == "outside")))
                    (out / f"truth-{paper}-{face_name}.json").write_text(
                        json.dumps([t.__dict__ for t in truth], indent=1))

                for level in levels:
                    for face_name, (written, truth, px_per_mm) in hands.items():
                        photo, ground_truth = photograph(written, level, args.seed, out, px_per_mm)
                        score = score_one(paper, face_name, level, photo, manifest, page_index,
                                          truth, ground_truth, base, ask=not args.no_read,
                                          crops_to=(out / "misses") if args.dump_crops else None)
                        scores.append(score)
                        print("  %-4s %-9s %-11s marks %d · reg %s mm · written %.0f%% · value %.0f%% %s" % (
                            paper, face_name, level.name, score.marks,
                            ("%.2f" % score.registration_mm) if score.registration_mm is not None else "—",
                            100 * score.written_share, 100 * score.value_share,
                            ("· " + score.said) if score.said else ""), flush=True)
                        for miss in score.misses[:4]:
                            print("      miss " + miss, flush=True)
                        if not args.keep_photos:
                            photo.unlink(missing_ok=True)
                if not args.keep_photos:
                    for written, _truth, _ppm in hands.values():
                        written.unlink(missing_ok=True)
    except QuotaSpent as exhausted:
        spent = str(exhausted)
        print("RED the reader stopped answering · " + spent, flush=True)
        RED.append("the reader answered every photograph it was given")
    finally:
        if not args.keep_fonts:
            shutil.rmtree(out / "fonts", ignore_errors=True)

    table(scores)
    measured = floor_line(scores)
    (out / ("scores%s.json" % (("-" + args.label) if args.label else ""))).write_text(json.dumps(
        {"measured": measured, "scores": [s.__dict__ for s in scores]}, indent=1, default=str))
    if not args.no_read and not args.no_floor:
        hold_the_floor(scores, measured)
    print("")
    print("TOTAL %d GREEN / %d RED" % (len(GREEN), len(RED)), flush=True)
    return 1 if RED else 0


if __name__ == "__main__":
    sys.exit(main())
