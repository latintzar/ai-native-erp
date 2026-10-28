"""REGISTRATION — turning a photograph of our own paper back into the page we printed (PAR-10).

FEED-IA §196.5 · §198 — «the qr code generation and reading is a spec in its own» · «i expect this
to be fully working when we wire everything… you can even test it by exporting and
downresolutioning and even muddling or adding fake dirt to the image and then running it through
scanning all programmatically».

⚠ THE IDEA THIS FILE EXISTS FOR. A photograph of a delivery note is normally an OCR problem: find
the table, find the rows, guess which number belongs to which line. **It is not one here, because we
printed the paper.** The packing sheet records, at print time, the millimetre rectangle of every box
it drew, and hands that record to the runtime (`/api/paper/manifest`). So a photo of that sheet only
has to answer one question — WHERE IS THE PAGE IN THIS PICTURE — and every cell then has an address
rather than a hypothesis. The reader is asked «what is written in this 18 × 6 mm box», never «find
the quantities».

That question is answered by four marks the paper carries:

    ┌─────────────────────────────────┐      · the QR at its spec'd corner (THE-QR-SPEC QR-03),
    │ ▓▓▓▓                        ■   │        which names the document AND anchors the geometry;
    │ ▓▓▓▓                            │      · three solid 6 mm squares at the three corners the QR
    │                                 │        does not occupy, 5 mm in from the edges.
    │                                 │
    │ ■                           ■   │      Four points on a plane are exactly what a homography
    └─────────────────────────────────┘      needs, and a homography is exactly what undoes a
                                             phone held at an angle over a crate.

The four correspondences are all mark CENTRES, deliberately: a centre is unbiased under blur, under
threshold choice and under the half-module ambiguity in where a decoder thinks a symbol's edge is.

With the three squares out of frame the page is still readable from the QR alone — its own four
corners are four points on the same plane — but a 20 mm square extrapolated across 297 mm of paper
carries its error with it: measured on the harness, 0.9 to 8.9 mm at the cells, which is more than a
row is tall. So that road reduces confidence to a fraction and says so in `check`. It is a fallback,
and a photo showing all four marks is the plan.

Nothing here retains anything: the photograph is a numpy array for the length of one request.
"""
from __future__ import annotations

import base64
import itertools
import logging
import math
import pathlib
from dataclasses import dataclass, field
from typing import Any, Iterable, Sequence

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

from .errors import RuntimeError_

logger = logging.getLogger("rocoto.runtime.register")

# ── THE NUMBERS, ALL IN ONE PLACE ───────────────────────────────────────────────────────────
# Every floor below is a measured or reasoned constant, and PAR-10 carries each one with its
# reason. Nothing in this file reads a magic number out of the middle of a function.

PX_PER_MM = 8.0
"""The canonical raster's density. 8 px/mm is 203 dpi — above the 150 dpi at which 2 mm pen strokes
start closing up, and a quarter of the memory of a 16 px/mm page for a reader that gains nothing
from it. A 20 × 6 mm final-weight box becomes 160 × 48 px, which is a legible crop on its own."""

QR_SYMBOL_MODULES = 29      # THE-QR-SPEC QR-02 — version 3
QR_QUIET_MODULES = 4        # drawn INSIDE the mark's own box
QR_BOX_MODULES = QR_SYMBOL_MODULES + 2 * QR_QUIET_MODULES   # 37

CROP_MARGIN_MM = 1.5
"""How much paper the reader sees around the box it is asked about. A pen leaves the box; 1.5 mm
brings back the tail of a 7 and the top of a 4 without dragging in the neighbouring row. For a
printed value the box in question is its row's SEAT (`_seat`), so the reader sees the amount, the
unit and the paper a hand would have used."""

INK_INSET_MM = 0.8
"""How far INSIDE the box the ink is measured. The box's own printed rule sits on its edge and
carries a compression halo; 0.8 mm clears both, so the measurement is about the pen alone.

⚠ ON A PRINTED VALUE IT IS APPLIED DOWN THE BOX ONLY. Sideways it would eat a 2.6 mm-wide printed
cell alive — see the warning in `observe`."""

INK_BLOCK_MM = 6.0          # adaptive-threshold window: wide enough to hold a whole glyph
INK_BIAS = 10               # grey levels below the local mean before a pixel counts as ink

FLOOR_ABSOLUTE_MIN = 0.006
"""No cell is ever called written on less ink than this. JPEG speckle on white paper lands here."""
FLOOR_ABSOLUTE_MAX = 0.030
"""And no cell ever has to carry MORE than 3 % ink to be called written — otherwise a page where
every box was filled in would learn its own handwriting as the baseline and report a blank sheet."""
FLOOR_STEP = 0.010          # absolute headroom over the page's own untouched baseline
FLOOR_FACTOR = 2.5          # …or a multiple of it, whichever asks for more
FLOOR_BASE = 0.004

PRINTED_BAND_DILATE_MM = 1.0
"""How far the rendered printed value is grown before ink outside it counts as handwriting.

It covers three things at once: the difference between the paper's typeface and this file's, the
alignment the manifest does not state, and — the one that decides the number — how far a printed
glyph SPREADS in a photograph that is out of focus.

MEASURED ON SIX SHEETS AT RELEASE-195, by moving this constant and counting the boxes that come
back wrong (`k3m9x2p7qa1 · f4y8s3n6wm1 · dl1bl2ur3mx · ii1jj2kk3ll · aa1bb2cc3dd · zz9yy8xx7ww`,
three hands each, at gaussian σ 1.3 · 1.8 · 2.0):

    ungrown (0.0 mm)   five wrong on every sheet at every blur
    0.25 mm            none at σ 1.3, ONE at σ 1.8 and at σ 2.0, on every sheet
    1.0 mm             none, on every sheet at every blur

⚠ AN EARLIER VERSION OF THIS DOCSTRING SAID «σ 1.8 calls one, σ 2.0 calls two, σ 2.1 calls three»
and «from 0.25 mm up every box is right». Neither reproduces here: the count is five, flat across
the blur, and a quarter-millimetre band still misses one box at σ 1.8. The old sequence was taken
on one sheet written by one hand, before the outside-ink belts were repaired. σ 2.1 is left out of
the table on purpose — two of these six sheets do not REGISTER at all at that blur, so a count
taken there is a count taken on a sheet that got lucky, and PAR-10.7's own floor is σ 2.0.

The constant stands at 1.0 mm, and it is bounded above by the second belt, which catches what a
band this wide gives up."""
PRINTED_EXCESS_RATIO = 1.6
PRINTED_BASELINE_CLAMP = (1.0, 3.5)
"""The second belt, and it is LEARNED FROM THE PAGE the same way the blank-cell floor is.

This file renders a printed value in ITS typeface at ITS guess of the size; the paper printed it in
the house's. So an untouched printed cell already holds more ink than the rendering does — measured
across the harness's six cells at gaussian σ 1.8, between 1.93 and 2.38 times. That multiple is a
property of the PAGE (its typeface, its exposure, its blur), not of any one cell, so the page states
it: the 40th percentile of every printed cell's own observed-over-rendered ratio. A cell whose ratio
exceeds that by `PRINTED_EXCESS_RATIO` has something in it the printing did not put there.

⚠ A FIXED MULTIPLE MISSED A REAL CORRECTION. At 3.2× absolute, a «5» written in a light hand over a
printed «4» came back untouched on a live end-to-end read — the writing sat inside the band, so the
band could not see it, and a thin stroke did not triple the ink. Against the page's own baseline the
same cell stands out plainly: at σ 1.8 the untouched cells span 1.93–2.38 against a baseline of 2.17
(0.89× to 1.10×) and the written one sits at 5.6 (2.6×). The clamps keep a page of almost-all-written
cells from learning its own handwriting as the baseline, which is the blank floor's failure exactly."""
MIN_INK_MM2 = 2.0
"""HOW MUCH INK IS A PEN, IN SQUARE MILLIMETRES — the floor's second half, and the one that does not
care how wide the box is.

⚠ A SHARE OF A BOX IS NOT A MEASURE OF A PEN. `page_floor` below asks «what fraction of this box is
ink», which is the right question for a page's exposure and the wrong one for a mark's size: the same
handwritten «2» is 12 % of a narrow box and 3 % of a 23 mm one. Measured on the harness: on a sheet
where every final-weight box was filled in — the case the ceiling exists for — the learned floor sat
at its 3 % ceiling and a thin «2» in a 23 × 5.3 mm box measured 2.95 %. It was reported UNTOUCHED, by
five parts in ten thousand, and the delivery would have gone out with no weight on that line.

Two square millimetres is one small digit's worth of stroke. JPEG speckle over that same 123 mm² box
measures 0.6 % — 0.7 mm² — so the two are a factor of three apart in a unit that does not move when
the column does. The floor a cell actually faces is therefore the page's learned share OR this area,
whichever asks for less, and never less than `FLOOR_ABSOLUTE_MIN`."""

HAND_REACH_MM = 30.0
"""HOW MUCH PAPER A HAND USES, and why a printed cell is read in its seat rather than in its glyphs.

The kit measures a printed value's rectangle as the value's own ink — «8» is 2.6 mm wide — because
that is what lets a reader be asked about the number apart from the unit beside it. A hand correcting
that number does not write inside 2.6 mm: it writes 10 to 16 mm of digits across the seat the amount
was printed in. Measured on the harness at «half-assed», reading each printed glyph's own box got
BOTH directions wrong at once — two real corrections invisible (all their ink lay outside the box)
and three phantom ones on rows nobody touched (a 2.6 mm box is so nearly all ink that a fraction of a
millimetre of rendering mismatch reads as a pen).

So a printed cell is observed in the row's whole printed SEAT — every printed cell of that row,
joined, widened to a hand's reach, and stopped short of any other cell the manifest names, so a
weight written in the final-weight box is never read as a correction to the quantity. Thirty
millimetres is the joined amount plus a correction on either side of it, measured on the packing
sheet the kit prints: «8 kg» is 11.6 mm and «6,25» in the same hand is another 9.

⚠ WHAT THIS TRADES. The band masks the printed AMOUNT and nothing else, so any other printing that
falls inside the seat reads as a pen. On this sheet the product name ends 100 mm away and the reach
is bounded by the final-weight cell on the other side, so there is nothing to catch; on a denser
sheet a name could sit inside 15 mm of the amount and be read as a correction. The clean fix is for
the manifest to state the product's own rectangle too — then the seat stops at it, exactly, and no
constant has to stand in for a measurement. That is a change to both halves of the contract, so it
is written down (PAR-10.4) rather than taken here."""

BAND_SATURATED = 0.85
"""When one rendering of a printed value already covers this much of the value's own box, the box IS
the value's ink and there is no paper in it for a hand.

⚠ AND ON SUCH A BOX THE OVER-WRITING BELT MEASURES TYPEFACES, NOT PENS. The belt compares the ink in
a printed box against one rendering of the same value, so it depends on how closely this file's sans
matches the paper's type. On a wide box that mismatch is a small share of the box; on a box that is
the glyph itself it is the whole measurement. Measured on the kit's own packing sheet at «half-assed»:
untouched printed boxes ran from 3.5 to 6.5 times their rendering, and the two boxes a hand had
written straight over sat at 6.2 and 7.2 — inside the same range. No threshold separates those, and
one chosen anyway would have called twenty-three untouched rows corrected.

So on a saturated box the belt is not applied: the seat beside it (`_seat`) is the road, and a hand
that writes exactly over a printed figure with no mark beside it is a limit this file states rather
than guesses at (PAR-10.4). The clean fix is a manifest that gives a printed value its COLUMN rather
than its ink — then the box has paper in it and both belts work as they were written."""

SEAT_GAP_MM = 4.0
"""How wide a gap between two printed cells of one amount is still the amount's own space. «12 kg»
prints as two rectangles with a space between them; anything wider than four millimetres is paper a
hand can write in, and stays visible."""

NEIGHBOUR_GAP_MM = 0.5
"""How far a seat stops short of the next cell the manifest names. Half a millimetre of paper."""

PRINTED_OUTSIDE_HALO_MM = 0.25
"""How far past its own band a printed value's ink reaches — masked with the band, so the halo is
never measured as a pen.

A blurred printed «12» throws a halo a fraction of a millimetre past the band. That is a question of
DISTANCE FROM THE PRINTING, and it is answered here by widening the band by the halo's own reach
before the ink outside it is measured.

⚠ THE MASK IS A STATED MARGIN, AND THE CASE THAT MINTED IT IS HISTORY HELD ELSEWHERE TODAY. An
earlier docstring said a halo alone had read as a pen at gaussian σ 1.8. Re-measured on both
fixtures — the page written beside the printed value and the page written over it — at σ 1.3, 1.8
and 2.0 and at JPEG 45 and 85, a page NOBODY wrote on produces phantoms 0 of 18 under this mask,
under no mask at all, and under the erosion this replaced. Whatever σ 1.8 once did is covered now by
the furniture mask, the area floor (`MIN_INK_MM2`) and the saturated stand-down, and no test in this
suite goes red if `PRINTED_OUTSIDE_HALO_MM` is deleted. It is kept as the conservative direction —
a pen stroke survives a quarter-millimetre of distance and a compression halo does not — rather than
as a save anyone has watched happen.

⚠ IT WAS ONCE A QUESTION OF THICKNESS, AND THAT ERASED REAL CORRECTIONS. The first version eroded
the outside ink with a 3 × 3 kernel — «a pen stroke is half a millimetre wide at its thinnest and
survives this erosion; a halo does not». A pen is not half a millimetre wide. Measured on the
harness's own thin hand: a «126» written beside a printed «2 kg» lands about a quarter of a
millimetre across, two pixels at `PX_PER_MM`, and the erosion took 98 % of it — 4.33 mm² of real ink
down to 0.38 mm² against a 1.59 mm² floor, on a SHARP photograph. It survived only at «half-assed»,
where motion blur and JPEG had thickened the strokes: the better the photograph, the more likely the
correction disappeared, which is the wrong way round and it landed on the quantity column.
Thickness cannot tell a halo from a biro. Distance can, and it costs a real hand nothing."""

MARK_SIZE_TOLERANCE = (0.35, 3.20)
"""How far a found blob's side may be from the size the manifest says, before it is not a mark. The
size it is compared against is read off the QR, which sits at ONE corner — so on a leaning page the
far marks are genuinely smaller than the QR's scale suggests and the near ones genuinely bigger.
Measured on the harness's steepest sheet: the near corners came back 2.3× the QR-derived expectation."""
MARK_FILL_MIN = 0.72        # a solid square fills its own bounding rectangle
MARK_ASPECT = (0.40, 2.55)
"""…and stays roughly square. «Roughly» is doing real work: at 41° a 6 mm square photographs as a
59 × 109 px trapezoid, an aspect of 0.55, and a tighter bound threw away two true marks the first
time this ran. Squareness is a weak filter here; the size agreement scored below is the strong one."""
MARK_CANDIDATES_PER_CORNER = 6
"""How many blobs each corner offers to the search. The anchor RANKS candidates; it does not rule
any out, and that is deliberate. The anchor is a homography fitted to a 20 mm square and then asked
about a point 290 mm away, so a pixel of noise on the symbol's corner is fourteen pixels at the far
corner of the page — measured, 415 to 435 px out on the harness's own 05:40 sheet. Every distance
cut-off tried on that number threw away true marks somewhere else on the sweep. So the anchor
orders the candidates and the SCORE decides, which is a judgement made on evidence that is actually
about the fit. Six per corner is 216 combinations: exhaustive, and cheaper than sampling."""
MARK_MATCH_ACCEPT_MM = 1.5
"""How much disagreement a matched triple may carry before it is not a match at all.

⚠ THE GATE FAILS CLOSED, AND IT EXISTS BECAUSE THE FIRST VERSION DID NOT. Without it the search
returned the least-bad triple it could find, whatever that was: on a low-resolution sheet it picked
three blobs that were not the marks, reported «four marks found», and produced a homography
FIFTY-FOUR MILLIMETRES out — a confident answer, addressed to the wrong boxes, which is the one
failure mode a person cannot catch by looking. Measured on the harness, a true triple's disagreement
lands at 0.61–0.67 mm and a false one at 3.3–9.9 mm; the gate sits between them, and a triple that
misses it drops to the code-only road rather than being believed."""

VERIFY_DARK = 0.55
"""A mark counts as found in the flattened page when its box is darker than 55 % of the paper's own
brightness. Read on the rectified raster, so it is a statement about the paper, not the exposure."""
VERIFY_GOOD = 0.70
VERIFY_REFUSE = 0.45
"""AND THE FLATTENED PAGE IS CHECKED AGAINST ITSELF. The manifest says a solid 6 mm square sits at
each of three corners; after rectification, either those squares are there or the page was not
where the maths said. This needs no ground truth and it is the belt that catches every way the
registration can be wrong at once. Above `VERIFY_GOOD` the page stands. Between the two it is read
and SAYS it was read off a page that would not settle. Below `VERIFY_REFUSE` nothing is read, because
cells cropped from a page we could not locate would be numbers about the wrong boxes."""

SHARPEN = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]], dtype=np.float32)
"""The unsharp kernel the `sharpened` rung uses. A five-centre cross, which is the mildest one that
recovers a blurred module edge without minting edges that were never printed."""

SANS_CANDIDATES = (
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    "/usr/share/fonts/TTF/DejaVuSans.ttf",
)


# ── WHAT COMES BACK ─────────────────────────────────────────────────────────────────────────

@dataclass
class QrRead:
    """A decoded mark: what it said, where its symbol's four corners are, and how it was reached."""
    text: str
    corners: np.ndarray          # 4×2 float32, symbol order: top-left, top-right, bottom-right, bottom-left
    road: str                    # raw · contrast · binary · upscaled · tile


@dataclass
class Registration:
    """The page, found. `page` is the canonical raster; `homography` maps page-mm to photo pixels."""
    qr: QrRead
    homography: np.ndarray
    page: np.ndarray             # canonical BGR raster at PX_PER_MM
    page_gray: np.ndarray
    ink: np.ndarray              # uint8 0/1 ink mask over the canonical raster
    marks_found: int             # 1..4 — the QR counts as one
    corner_ids: list[str] = field(default_factory=list)
    quality: dict[str, float] = field(default_factory=dict)
    check: str | None = None
    confidence_scale: float = 1.0


@dataclass
class CellObservation:
    """One box on the page, looked at: is there a pen in it, and what does the box look like."""
    sale: str
    line: str | int
    cell: str
    written: bool
    confidence: float
    crop_png: bytes
    ink: float
    floor: float
    context: str
    check: str | None = None


# ── 1 · THE MARK ────────────────────────────────────────────────────────────────────────────

def _zxing():
    """The decoder, imported at the moment it is needed and REFUSED BY NAME when it is absent.

    An ImportError raised out of a request would reach the kit as «runtime_error», which is the one
    thing this service is not allowed to say — a failure with no name in it. `deploy.sh` asserts the
    wheel is on the box; this is what happens if it ever is not."""
    try:
        import zxingcpp
    except ImportError as exc:
        raise RuntimeError_("reader_missing", "The code reader ships in the runtime's requirements; "
                                              "install them into this process's environment and the "
                                              "read runs.", 503) from exc
    return zxingcpp


def _decode_attempt(image: np.ndarray, scale: float, offset: tuple[float, float], road: str) -> QrRead | None:
    zxingcpp = _zxing()
    try:
        results = zxingcpp.read_barcodes(image, formats=zxingcpp.BarcodeFormat.QRCode)
    except Exception:
        return None
    for result in results or []:
        text = (result.text or "").strip()
        if not text:
            continue
        position = result.position
        points = [(position.top_left.x, position.top_left.y), (position.top_right.x, position.top_right.y),
                  (position.bottom_right.x, position.bottom_right.y), (position.bottom_left.x, position.bottom_left.y)]
        corners = np.array([[(x / scale) + offset[0], (y / scale) + offset[1]] for x, y in points], dtype=np.float32)
        return QrRead(text=text, corners=corners, road=road)
    return None


def decode_locator(bgr: np.ndarray) -> QrRead | None:
    """Read the packing mark off a photograph, trying harder each time it fails.

    The ladder is deliberately ordered by cost, and every rung maps its answer BACK into the
    original photograph's pixels — a mark found in a 2× upscaled tile is still four points on the
    photo, which is what the homography needs.

      raw       · the photograph as it arrived. Nearly always enough (QR-10.1: the mark clears a
                  fifth of print density and σ 3 blur).
      contrast  · CLAHE on the luminance. This is the cold-room case: a sheet under one strip light
                  with the near half in shadow.
      binary    · Otsu. A flat, hard threshold reads a washed-out phone photo that local averaging
                  smears.
      sharpened · an unsharp kernel. Focus is the axis a phone in a cold room actually fails on, and
                  this rung alone brings back a mark under gaussian σ 2.0 that every rung above it
                  missed — measured on the harness, and the reason it exists.
      upscaled  · 2× the whole frame, for a sheet photographed from far enough away that a module
                  falls near one pixel.
      sharp 3×  · sharpened and tripled, for a small frame. It reads down to 1.9 px per module where
                  everything above it stops at 2.3 — measured. Guarded by frame size, because
                  tripling a 12-megapixel photograph would cost more memory than the answer is worth.
      tile      · 2× each of five overlapping regions. A wide shot of a whole crate with the sheet
                  in one corner is this rung, and it is the reason a person does not have to frame
                  the paper carefully.
    """
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)

    found = _decode_attempt(bgr, 1.0, (0.0, 0.0), "raw")
    if found:
        return found

    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8)).apply(gray)
    found = _decode_attempt(clahe, 1.0, (0.0, 0.0), "contrast")
    if found:
        return found

    _, binary = cv2.threshold(clahe, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    found = _decode_attempt(binary, 1.0, (0.0, 0.0), "binary")
    if found:
        return found

    sharp = cv2.filter2D(clahe, -1, SHARPEN)
    found = _decode_attempt(sharp, 1.0, (0.0, 0.0), "sharpened")
    if found:
        return found

    height, width = gray.shape[:2]
    if max(height, width) <= 4000:
        big = cv2.resize(clahe, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)
        found = _decode_attempt(big, 2.0, (0.0, 0.0), "upscaled")
        if found:
            return found

    if max(height, width) <= 2600:
        bigger = cv2.resize(sharp, None, fx=3.0, fy=3.0, interpolation=cv2.INTER_CUBIC)
        found = _decode_attempt(bigger, 3.0, (0.0, 0.0), "sharp-upscaled")
        if found:
            return found

    half_h, half_w = height // 2, width // 2
    boxes = [(0, 0), (half_w, 0), (0, half_h), (half_w, half_h), (half_w // 2, half_h // 2)]
    for left, top in boxes:
        tile = clahe[top:top + half_h, left:left + half_w]
        if tile.size == 0:
            continue
        big = cv2.resize(tile, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)
        found = _decode_attempt(big, 2.0, (float(left), float(top)), "tile")
        if found:
            return found
    return None


# ── 2 · THE THREE SQUARES ───────────────────────────────────────────────────────────────────

def _qr_symbol_square(mark: dict[str, float], convention: str) -> np.ndarray:
    """The QR SYMBOL's own square in page millimetres, under one of the two honest readings of
    `marks.qr.size`.

    THE-QR-SPEC QR-02 draws the quiet zone INSIDE the mark's box, so a `size` of 20.1 mm is 37
    modules and the symbol is the middle 29 of them. A producer that reported the symbol alone
    would be equally defensible. Rather than guess, both are tried and the one that finds three
    corner marks is the one that was meant — the QR's CENTRE is the same point either way, which is
    why the final homography (which uses centres) is immune to the question entirely.
    """
    x, y, size = float(mark["x"]), float(mark["y"]), float(mark["size"])
    if convention == "drawn":
        inset = size * QR_QUIET_MODULES / QR_BOX_MODULES
        x, y, size = x + inset, y + inset, size * QR_SYMBOL_MODULES / QR_BOX_MODULES
    return np.array([[x, y], [x + size, y], [x + size, y + size], [x, y + size]], dtype=np.float32)


def _square_candidates(gray: np.ndarray, expected_px: float) -> list[tuple[np.ndarray, float]]:
    """Every near-square solid blob in the photograph, with its centre and its side in pixels.

    Grayscale → adaptive threshold (a page under uneven light has no single right threshold) →
    contours → the shape filters. A corner mark is a solid square, so it fills its own bounding
    rectangle; printed text, a table rule and a staple hole all fail that on their own.
    """
    block = int(max(15, min(151, round(expected_px * 3))) // 2 * 2 + 1)
    binary = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, block, 10)
    binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    contours, _ = cv2.findContours(binary, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

    low, high = MARK_SIZE_TOLERANCE
    out: list[tuple[np.ndarray, float]] = []
    for contour in contours:
        area = cv2.contourArea(contour)
        if area < (expected_px * low) ** 2 or area > (expected_px * high) ** 2:
            continue
        (cx, cy), (rw, rh), _ = cv2.minAreaRect(contour)
        if rw <= 1 or rh <= 1:
            continue
        aspect = rw / rh
        if not (MARK_ASPECT[0] <= aspect <= MARK_ASPECT[1]):
            continue
        if area / (rw * rh) < MARK_FILL_MIN:
            continue
        hull = cv2.contourArea(cv2.convexHull(contour))
        if hull > 0 and area / hull < 0.85:
            continue
        out.append((np.array([cx, cy], dtype=np.float32), float((rw + rh) / 2)))
    return out


def _project(homography: np.ndarray, points: np.ndarray) -> np.ndarray:
    pts = np.array(points, dtype=np.float64).reshape(-1, 1, 2)
    return cv2.perspectiveTransform(pts, homography).reshape(-1, 2)


def _fit(page_points: Sequence[Sequence[float]], photo_points: Sequence[Sequence[float]]) -> np.ndarray | None:
    page = np.array(page_points, dtype=np.float32)
    photo = np.array(photo_points, dtype=np.float32)
    try:
        if len(page) == 4:
            return cv2.getPerspectiveTransform(page, photo)
        homography, _ = cv2.findHomography(page, photo, 0)
        return homography
    except cv2.error:
        return None


def _guess(page_points: Sequence[Sequence[float]], photo_points: Sequence[Sequence[float]]) -> np.ndarray | None:
    """WHERE TO LOOK FOR THE CORNER MARKS — a turn, a scale and a shift, and no perspective at all.

    ⚠ THIS USED TO BE THE PROJECTIVE FIT ABOVE, AND THAT WAS THE BUG. The QR is one small square:
    on a 1600 px photograph of an A4 sheet its symbol measures 77 px, and the decoder reports corner
    positions rounded to whole pixels. Fitting a full projective transform to four points of a 77 px
    square turns ONE pixel of rounding into a perspective term, and a perspective term extrapolated
    1 400 px down the page is not a small error. Measured on this harness's flat, undamaged A4 sheet:
    the projective anchor predicts the three marks 24, 28 and 55 mm out; this similarity predicts them
    3, 5 and 4 mm out.

    ⚠ AND THE SHORTLIST DID NOT LOSE THE TRUE MARK — A WRONG BLOB OUTRANKED IT. Under the projective
    anchor the search still returns three blobs and the 1.5 mm match gate still passes them, at
    0.83 mm; the one it ranks first for the bottom-left corner stands 93 px (19 mm) from the real
    mark. The page that homography flattens is refused by `_verify` at 0.152 against a 0.45 floor.
    Under this similarity all three land within 1 px of the truth, disagree by 0.21 mm and verify at
    0.974. So the cost of a bad anchor is a REFUSED clean page rather than a misread one, and the
    knob that caught it is the page self-check, not the search radius.

    A similarity has four degrees of freedom instead of eight and cannot invent perspective, so the
    worst it can do over a page is the QR's own scale error — about one per cent, 3 mm at the far
    corner, well inside the search radius. It is only ever used to SAY WHERE TO LOOK; the homography
    that rectifies the page is still fitted from the four mark centres, spread across the sheet,
    where a projective fit is conditioned properly.
    """
    page = np.array(page_points, dtype=np.float32).reshape(-1, 1, 2)
    photo = np.array(photo_points, dtype=np.float32).reshape(-1, 1, 2)
    try:
        matrix, _ = cv2.estimateAffinePartial2D(page, photo, method=cv2.LMEDS)
    except cv2.error:
        return None
    if matrix is None:
        return None
    return np.vstack([matrix, np.array([0.0, 0.0, 1.0])])


def _match_corners(gray: np.ndarray, marks: dict[str, Any], qr: QrRead,
                   convention: str) -> tuple[dict[str, np.ndarray], np.ndarray | None, float]:
    """Find which blob is which corner mark, anchored on the QR, and say how well it all agrees.

    The search is the brief's RANSAC, made small enough to be exhaustive rather than random: the QR
    gives a first homography, that homography PREDICTS where each named corner should be, each
    prediction takes its nearest few candidates, and every combination of those is fitted and scored
    by how well it re-explains the QR's own four corners. Enumerating ≤ 216 combinations is cheaper
    than sampling, and it cannot miss the right one.
    """
    corners = marks.get("corners") or []
    # The QR says where to LOOK (`_guess`, a similarity — see the warning in that function); the
    # marks it leads to say where the page IS.
    anchor = _guess(_qr_symbol_square(marks["qr"], convention), qr.corners)
    if anchor is None or not corners:
        return {}, anchor, math.inf

    qr_side_px = float(np.mean([
        np.linalg.norm(qr.corners[0] - qr.corners[1]), np.linalg.norm(qr.corners[1] - qr.corners[2]),
        np.linalg.norm(qr.corners[2] - qr.corners[3]), np.linalg.norm(qr.corners[3] - qr.corners[0]),
    ]))
    qr_side_mm = float(_qr_symbol_square(marks["qr"], convention)[1][0] - _qr_symbol_square(marks["qr"], convention)[0][0])
    px_per_mm = qr_side_px / max(qr_side_mm, 0.1)
    expected_px = float(np.mean([float(c["size"]) for c in corners])) * px_per_mm

    candidates = _square_candidates(gray, expected_px)
    if len(candidates) < len(corners):
        return {}, anchor, math.inf

    qr_centre_mm = _qr_symbol_square(marks["qr"], convention).mean(axis=0)
    shortlist: list[list[tuple[np.ndarray, float]]] = []
    centres_mm: list[np.ndarray] = []
    for corner in corners:
        centre_mm = np.array([float(corner["x"]) + float(corner["size"]) / 2,
                              float(corner["y"]) + float(corner["size"]) / 2], dtype=np.float32)
        centres_mm.append(centre_mm)
        predicted = _project(anchor, centre_mm.reshape(1, 2))[0]
        near = sorted(candidates, key=lambda c: float(np.linalg.norm(c[0] - predicted)))
        shortlist.append(near[:MARK_CANDIDATES_PER_CORNER])
    if any(not near for near in shortlist):
        return {}, anchor, math.inf

    qr_centre_px = qr.corners.mean(axis=0)

    best_error = math.inf
    best: dict[str, np.ndarray] = {}
    for combination in itertools.product(*shortlist):
        picked = [c[0] for c in combination]
        sizes = [c[1] for c in combination]
        if len({(round(float(p[0]), 1), round(float(p[1]), 1)) for p in picked}) != len(picked):
            continue  # two corners cannot be the same blob
        page_points = [*centres_mm, qr_centre_mm]
        photo_points = [*picked, qr_centre_px]
        homography = _fit(page_points, photo_points)
        if homography is None:
            continue
        try:
            reprojected = _project(homography, _qr_symbol_square(marks["qr"], convention))
        except cv2.error:
            continue
        # TWO THINGS HAVE TO AGREE, and together they are what makes this a fit rather than a
        # coincidence. First, the homography built from these three blobs has to put the QR's own
        # four corners back where the decoder found them. Second, each blob has to be the SIZE a
        # 6 mm square would be at that spot under that same homography — which is the constraint
        # that separates a real corner mark from a bit of printing that happens to lie near one.
        error = _shape_disagreement(reprojected, qr.corners) / max(px_per_mm, 0.001)
        error += _size_disagreement(homography, corners, sizes)
        if error < best_error:
            best_error = error
            best = {str(corner["id"]): point for corner, point in zip(corners, picked)}
    return best, anchor, best_error


def _shape_disagreement(reprojected: np.ndarray, observed: np.ndarray) -> float:
    """How differently SHAPED the reprojected QR is from the one the decoder found, in pixels.

    ⚠ SHAPE, NOT SIZE, AND THE DIFFERENCE MATTERS. `marks.qr.size` has two honest readings — the
    drawn box or the symbol inside it — and they differ by 37 : 29. Comparing sizes therefore
    measured which reading was tried, at about 2.2 mm a corner, and drowned the thing actually being
    asked: a true triple scored 3.9 and a false one 2.5, so the score was ranking the wrong way
    round. Scaling the reprojection about its own centre onto the observed one removes the reading
    from the question and leaves the perspective foreshortening, which is what a wrong triple gets
    wrong. (The centres already coincide — the QR's centre is one of the four points fitted.)
    """
    reprojected_centre, observed_centre = reprojected.mean(axis=0), observed.mean(axis=0)
    def side(points: np.ndarray) -> float:
        return float(np.mean([np.linalg.norm(points[i] - points[(i + 1) % 4]) for i in range(4)]))
    reprojected_side, observed_side = side(reprojected), side(observed)
    if reprojected_side <= 1.0:
        return math.inf
    aligned = (reprojected - reprojected_centre) * (observed_side / reprojected_side) + observed_centre
    return float(np.mean(np.linalg.norm(aligned - observed, axis=1)))


def _size_disagreement(homography: np.ndarray, corners: list[dict[str, Any]], sizes: list[float]) -> float:
    """How far each blob's measured side is from the side that homography predicts, in millimetres."""
    total = 0.0
    for corner, observed in zip(corners, sizes):
        x, y, side = float(corner["x"]), float(corner["y"]), float(corner["size"])
        square = np.array([[x, y], [x + side, y], [x + side, y + side], [x, y + side]], dtype=np.float32)
        try:
            projected = _project(homography, square)
        except cv2.error:
            return math.inf
        predicted = float(np.mean([np.linalg.norm(projected[i] - projected[(i + 1) % 4]) for i in range(4)]))
        if predicted <= 1.0:
            return math.inf
        total += abs(observed - predicted) / predicted * side
    return total / max(len(corners), 1)


# ── 3 · THE PAGE, MADE FLAT ─────────────────────────────────────────────────────────────────

def _tilt_degrees(homography: np.ndarray, shape: tuple[int, ...], page_mm: tuple[float, float]) -> float:
    """How far off square the camera was, in degrees — an ESTIMATE, and named as one.

    A homography plus an assumed focal length gives the page's normal in camera coordinates, and the
    angle between that normal and the lens axis is the tilt. The focal length is assumed (a phone
    does not send one), so the number is honest about magnitude and not about the third decimal.
    """
    height, width = shape[0], shape[1]
    focal = float(max(height, width))
    K = np.array([[focal, 0.0, width / 2.0], [0.0, focal, height / 2.0], [0.0, 0.0, 1.0]])
    try:
        _, _, _, normals = cv2.decomposeHomographyMat(homography, K)
        angles = [math.degrees(math.acos(min(1.0, abs(float(np.asarray(n).ravel()[2]))))) for n in normals]
        if angles:
            return round(min(angles), 1)
    except cv2.error:
        pass
    # Fallback: opposite edges of a tilted rectangle differ in length, and the ratio is a tilt.
    w_mm, h_mm = page_mm
    quad = _project(homography, np.array([[0, 0], [w_mm, 0], [w_mm, h_mm], [0, h_mm]], dtype=np.float32))
    top, bottom = np.linalg.norm(quad[1] - quad[0]), np.linalg.norm(quad[2] - quad[3])
    left, right = np.linalg.norm(quad[3] - quad[0]), np.linalg.norm(quad[2] - quad[1])
    ratios = [min(top, bottom) / max(top, bottom, 1e-6), min(left, right) / max(left, right, 1e-6)]
    return round(math.degrees(math.acos(min(1.0, min(ratios)))), 1)


def _ink_mask(page_gray: np.ndarray) -> np.ndarray:
    block = int(max(15, round(INK_BLOCK_MM * PX_PER_MM)) // 2 * 2 + 1)
    mask = cv2.adaptiveThreshold(page_gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                 cv2.THRESH_BINARY_INV, block, INK_BIAS)
    return (mask > 0).astype(np.uint8)


def register(bgr: np.ndarray, manifest: dict[str, Any], qr: QrRead | None = None) -> Registration | None:
    """Find the page in the photograph and lay it flat. Returns nothing when the mark went unread.

    `qr` is passed in by the endpoint, which had to read the mark first to know WHICH manifest to
    register against. Decoding it a second time here would be the same work twice on the slowest
    step in the request.
    """
    qr = qr or decode_locator(bgr)
    if qr is None:
        return None

    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    marks = manifest.get("marks") or {}
    page_mm = (float(manifest["pageMm"]["w"]), float(manifest["pageMm"]["h"]))

    matched: dict[str, np.ndarray] = {}
    homography: np.ndarray | None = None
    check: str | None = None
    confidence_scale = 1.0

    best_error = math.inf
    for convention in ("drawn", "symbol"):
        found, anchor, error = _match_corners(gray, marks, qr, convention)
        if len(found) >= 3 and error <= MARK_MATCH_ACCEPT_MM and error < best_error:
            corners_mm = [np.array([float(c["x"]) + float(c["size"]) / 2, float(c["y"]) + float(c["size"]) / 2])
                          for c in marks["corners"] if str(c["id"]) in found]
            photo = [found[str(c["id"])] for c in marks["corners"] if str(c["id"]) in found]
            qr_square = _qr_symbol_square(marks["qr"], convention)
            fitted = _fit([*corners_mm, qr_square.mean(axis=0)], [*photo, qr.corners.mean(axis=0)]) \
                if len(corners_mm) == 3 else _fit(corners_mm, photo)
            if fitted is not None:
                homography, matched, best_error = fitted, found, error
        if homography is not None and best_error < 0.5:
            break

    if homography is None:
        # ⚠ THE QR-ONLY ROAD. Four points on a 20 mm square, extrapolated across a whole page: the
        # geometry is real but its lever arm is fourteen to one, so a millimetre of error at the
        # symbol is more than a centimetre at the far corner. It still reads a page — and it says
        # what it did, because a crop taken from a shaky rectification is a crop a person should
        # look at twice.
        homography = _fit(_qr_symbol_square(marks["qr"], "drawn"), qr.corners)
        if homography is None:
            return None
        check = ("read from the code alone; a photo showing all four marks places every box exactly")
        confidence_scale = 0.4

    scale = np.array([[PX_PER_MM, 0.0, 0.0], [0.0, PX_PER_MM, 0.0], [0.0, 0.0, 1.0]])
    try:
        to_canonical = scale @ np.linalg.inv(homography)
    except np.linalg.LinAlgError:
        return None
    size = (int(round(page_mm[0] * PX_PER_MM)), int(round(page_mm[1] * PX_PER_MM)))
    page = cv2.warpPerspective(bgr, to_canonical, size, flags=cv2.INTER_CUBIC, borderValue=(255, 255, 255))
    page_gray = cv2.cvtColor(page, cv2.COLOR_BGR2GRAY)

    settled, checked = _verify(page_gray, homography, bgr.shape, marks)
    if checked and settled < VERIFY_REFUSE:
        return None
    if checked and settled < VERIFY_GOOD:
        check = "read off a page that lay at an angle; check each crop against the paper"
        confidence_scale = min(confidence_scale, 0.45)

    quality = {
        "tiltDeg": _tilt_degrees(homography, bgr.shape, page_mm),
        "blurScore": round(float(cv2.Laplacian(page_gray, cv2.CV_64F).var()), 1),
        "lightScore": round(float(np.percentile(page_gray, 95) - np.percentile(page_gray, 5)) / 255.0, 3),
    }
    return Registration(qr=qr, homography=homography, page=page, page_gray=page_gray,
                        ink=_ink_mask(page_gray), marks_found=1 + len(matched),
                        corner_ids=sorted(matched), quality=quality,
                        check=check, confidence_scale=confidence_scale)


def _verify(page_gray: np.ndarray, homography: np.ndarray, photo_shape: tuple[int, ...],
            marks: dict[str, Any]) -> tuple[float, int]:
    """DID THE PAGE LAND WHERE THE MATHS SAID? Asked of the flattened page, with no ground truth.

    The manifest promises a solid 6 mm square at each of three corners. After rectification either
    those squares are in those places or the registration is wrong — and this one measurement catches
    every route to being wrong at once: a mis-decoded mark, a blob that was not a mark, a homography
    fitted to the right blobs in the wrong order.

    ⚠ A MARK THAT IS OUTSIDE THE PHOTOGRAPH IS NOT A FAILED MARK. Somebody who photographs the top
    half of a sheet has cropped the bottom corners away, and rectification fills that region with
    white paper. Reading that as «the marks are missing, refuse» would refuse a photograph that is
    merely partial, so each mark is only asked about when the homography puts it inside the frame.
    Returned with the score is HOW MANY were asked, and a page where none could be asked is a page
    this check has nothing to say about — which is exactly the code-only road, standing on its own.
    """
    paper = float(np.percentile(page_gray, 90)) or 255.0
    limit = paper * VERIFY_DARK
    height, width = photo_shape[0], photo_shape[1]
    canonical_h, canonical_w = page_gray.shape[:2]

    scores: list[float] = []
    for corner in marks.get("corners", []):
        x, y, side = float(corner["x"]), float(corner["y"]), float(corner["size"])
        centre = np.array([[x + side / 2, y + side / 2]], dtype=np.float32)
        where = _project(homography, centre)[0]
        if not (0 <= where[0] < width and 0 <= where[1] < height):
            continue
        x0, y0 = int(round(x * PX_PER_MM)), int(round(y * PX_PER_MM))
        x1, y1 = int(round((x + side) * PX_PER_MM)), int(round((y + side) * PX_PER_MM))
        x0, y0 = max(0, x0), max(0, y0)
        x1, y1 = min(canonical_w, x1), min(canonical_h, y1)
        if x1 <= x0 or y1 <= y0:
            continue
        scores.append(float((page_gray[y0:y1, x0:x1] < limit).mean()))
    return (min(scores) if scores else 1.0), len(scores)


# ── 4 · WHAT IS IN EACH BOX ─────────────────────────────────────────────────────────────────

def _font(size_px: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in SANS_CANDIDATES:
        if pathlib.Path(path).exists():
            try:
                return ImageFont.truetype(path, max(6, size_px))
            except OSError:
                continue
    return ImageFont.load_default()


def _printed_band(text: str, width_px: int, height_px: int) -> tuple[np.ndarray, float]:
    """The printed value, rendered as a BAND, and how much of the cell one rendering of it fills.

    The manifest states the box and the value inside it. It does not state where in the box the
    house set that value — left, right or centre; high or low — so the mask covers the uncertainty
    rather than guessing at it:

    · **Across** the box, the mask is the union of the three horizontal alignments. A short value in
      a wide box therefore leaves real gaps, which is the common case worth catching: a hand writing
      «14» beside a printed «12» writes in one of those gaps.
    · **Down** the box, the mask is full height. Vertical placement is exactly the thing the
      manifest does not say, and a one-millimetre difference between where the paper set the value
      and where this file renders it read as handwriting the first time this ran.

    A long value in a narrow box unions to nearly the whole width, and there the band can no longer
    tell anything — which is what the coarse second belt is for, and why it compares an AMOUNT of
    ink against the amount one centred rendering makes.
    """
    blank = np.zeros((height_px, width_px), dtype=np.uint8)
    if not text or width_px < 4 or height_px < 4:
        return blank, 0.0

    size = max(6, int(height_px * 0.62))
    font = _font(size)
    image = Image.new("L", (width_px, height_px), 0)
    draw = ImageDraw.Draw(image)
    left, top, right, bottom = draw.textbbox((0, 0), text, font=font)
    text_w, text_h = max(1, right - left), max(1, bottom - top)
    if text_w > width_px * 0.92:
        size = max(6, int(size * width_px * 0.92 / text_w))
        font = _font(size)
        left, top, right, bottom = draw.textbbox((0, 0), text, font=font)
        text_w, text_h = max(1, right - left), max(1, bottom - top)

    y = (height_px - text_h) / 2 - top
    centred = Image.new("L", (width_px, height_px), 0)
    ImageDraw.Draw(centred).text(((width_px - text_w) / 2 - left, y), text, fill=255, font=font)
    centred_mask = (np.array(centred) > 64).astype(np.uint8)

    union = np.zeros((height_px, width_px), dtype=np.uint8)
    for x in (max(0.0, 0.02 * width_px) - left, (width_px - text_w) / 2 - left,
              width_px - text_w - max(0.0, 0.02 * width_px) - left):
        layer = Image.new("L", (width_px, height_px), 0)
        ImageDraw.Draw(layer).text((x, y), text, fill=255, font=font)
        union |= (np.array(layer) > 64).astype(np.uint8)

    columns = np.tile(union.any(axis=0).astype(np.uint8), (height_px, 1))
    grow = int(round(PRINTED_BAND_DILATE_MM * PX_PER_MM)) | 1
    band = cv2.dilate(columns, np.ones((1, grow), np.uint8))
    return band, float(centred_mask.mean())


def _clip(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _seat(row: dict[str, Any], name: str) -> tuple[dict[str, float], list[tuple[dict[str, float], str]]]:
    """THE PAPER THIS CELL IS ACTUALLY READ IN, and the printed values standing in it.

    A box printed EMPTY is read in itself: the final-weight seat is already a column, and a hand
    writing in it writes inside it.

    A box printed with a value in it is read in its row's whole printed seat — see `HAND_REACH_MM`.
    The seat is every printed cell of the row joined, widened towards a hand's reach, and stopped
    half a millimetre short of any other cell the manifest names. The printed values come back with
    it, each with its own rectangle, so the band that masks them is drawn where the paper drew them
    rather than smeared across the seat.
    """
    cells: dict[str, Any] = row.get("cells") or {}
    printed = [(cells.get(other), _printed_text(row.get("printed") or {}, other))
               for other in ("qty", "unit")]
    printed = [(cell, text) for cell, text in printed if cell and text]
    mine = cells.get(name)
    # A box with nothing printed in it is read in itself, whatever column it is: the final-weight
    # seat, and a quantity column this row happened to print nothing in.
    if not mine or not printed or not _printed_text(row.get("printed") or {}, name):
        return mine or {}, []

    x0 = min(float(cell["x"]) for cell, _ in printed)
    x1 = max(float(cell["x"]) + float(cell["w"]) for cell, _ in printed)
    y0 = min(float(cell["y"]) for cell, _ in printed)
    y1 = max(float(cell["y"]) + float(cell["h"]) for cell, _ in printed)
    reach = max(0.0, HAND_REACH_MM - (x1 - x0)) / 2

    left, right = 0.0, 1e6
    for other, cell in cells.items():
        if not cell or any(cell is one for one, _ in printed):
            continue
        if float(cell["x"]) >= x1:
            right = min(right, float(cell["x"]) - NEIGHBOUR_GAP_MM)
        elif float(cell["x"]) + float(cell["w"]) <= x0:
            left = max(left, float(cell["x"]) + float(cell["w"]) + NEIGHBOUR_GAP_MM)
    seat_x0 = max(left, x0 - reach)
    seat_x1 = min(right, x1 + reach)
    # WHAT ONE SIDE CANNOT GIVE, THE OTHER MAY. A printed amount with a cell hard against its right
    # has all its room on the left, and that is where the hand goes.
    spare = 2 * reach - (x0 - seat_x0) - (seat_x1 - x1)
    if spare > 0:
        room_left = seat_x0 - left
        seat_x0 = max(left, seat_x0 - spare)
        spare -= min(spare, room_left)
        seat_x1 = min(right, seat_x1 + spare)
    if seat_x1 - seat_x0 < x1 - x0:                       # a row with no room stays as it was drawn
        seat_x0, seat_x1 = x0, x1
    return {"x": seat_x0, "y": y0, "w": seat_x1 - seat_x0, "h": y1 - y0}, printed


def _seat_band(seat: dict[str, float], printed: list[tuple[dict[str, float], str]],
               width_px: int, height_px: int) -> tuple[np.ndarray, float]:
    """The printed values, masked WHERE THE PAPER PUT THEM inside the seat, and how much of the seat
    one rendering of them fills."""
    band = np.zeros((height_px, width_px), dtype=np.uint8)
    covered = 0.0
    for cell, text in printed:
        sub_w = max(4, int(round(float(cell["w"]) * PX_PER_MM)))
        sub_h = max(4, int(round(float(cell["h"]) * PX_PER_MM)))
        sub, fill = _printed_band(text, sub_w, sub_h)
        ox = int(round((float(cell["x"]) - seat["x"]) * PX_PER_MM))
        oy = int(round((float(cell["y"]) - seat["y"]) * PX_PER_MM))
        x0, y0 = max(0, ox), max(0, oy)
        x1, y1 = min(width_px, ox + sub_w), min(height_px, oy + sub_h)
        if x1 > x0 and y1 > y0:
            band[y0:y1, x0:x1] |= sub[y0 - oy:y1 - oy, x0 - ox:x1 - ox]
        covered += fill * sub_w * sub_h

    def columns(from_mm: float, to_mm: float) -> None:
        a = max(0, int(round((from_mm - float(seat["x"])) * PX_PER_MM)))
        b = min(width_px, int(round((to_mm - float(seat["x"])) * PX_PER_MM)))
        if b > a:
            band[:, a:b] = 1

    # A CELL'S OWN EDGE IS PRINTED TOO. A house that rules its boxes draws a hairline on the very
    # line the manifest reports, and that hairline is ink no rendering of the value accounts for: on
    # the runtime's own fixture it left a one-pixel column standing in the middle of the seat and
    # called an untouched quantity corrected. The edges, and the narrow gaps between two printed
    # cells of one amount, are the paper's own furniture -- masked with it.
    for cell, _text in printed:
        columns(float(cell["x"]) - PRINTED_BAND_DILATE_MM, float(cell["x"]) + PRINTED_BAND_DILATE_MM)
        right = float(cell["x"]) + float(cell["w"])
        columns(right - PRINTED_BAND_DILATE_MM, right + PRINTED_BAND_DILATE_MM)
    ordered = sorted((cell for cell, _ in printed), key=lambda c: float(c["x"]))
    for before, after in zip(ordered, ordered[1:]):
        gap = float(after["x"]) - (float(before["x"]) + float(before["w"]))
        # A wide gap is real paper and a hand may use it; a narrow one is the space inside «12 kg».
        if 0 < gap <= SEAT_GAP_MM:
            columns(float(before["x"]) + float(before["w"]), float(after["x"]))
    return band, covered / float(max(1, width_px * height_px))


def _looked_at(reg: "Registration", row: dict[str, Any], name: str
               ) -> tuple[dict[str, float], np.ndarray, np.ndarray | None, float,
                          list[tuple[dict[str, float], str]]]:
    """One cell, as this file sees it: the paper it is read in, the ink in that paper, the band the
    printing accounts for, and how much of the seat that printing fills.

    ONE function, used by the observation, by the page's own printed baseline and by the choice of
    page, so all three measure the same thing in the same units and a threshold learnt by one holds
    for the others."""
    seat, printed = _seat(row, name)
    if not seat:
        return {}, np.zeros((0, 0), dtype=np.uint8), None, 0.0, []
    x0, y0, x1, y1 = _rect_px(seat, -INK_INSET_MM if not printed else 0.0, reg.ink.shape,
                              margin_y_mm=-INK_INSET_MM)
    patch = reg.ink[y0:y1, x0:x1]
    if not patch.size or not printed:
        return seat, patch, None, 0.0, []
    band, expected = _seat_band(seat, printed, patch.shape[1], patch.shape[0])
    return seat, patch, band, expected, printed


def _belongs(seat: dict[str, float], printed: list[tuple[dict[str, float], str]],
             cell: dict[str, float], beyond: np.ndarray) -> bool:
    """WHOSE CORRECTION IS IT — the printed value it stands nearest, and only that one.

    A seat holds the amount and the unit that denominates it, so a «6,25» written beside «20 kg» is
    ink outside the band for BOTH of them. One correction is one answer: the mark is attributed to
    the printed value nearest its own centre of ink, and the other cell keeps its «untouched». Found
    by the harness — every corrected quantity produced a phantom correction to its unit."""
    if len(printed) < 2:
        return True
    columns = beyond.sum(axis=0).astype(float)
    if columns.sum() <= 0:
        return False
    xs = np.arange(beyond.shape[1], dtype=float)
    centre = float(seat["x"]) + float((columns * xs).sum() / columns.sum()) / PX_PER_MM

    def apart(one: dict[str, float]) -> float:
        left, right = float(one["x"]), float(one["x"]) + float(one["w"])
        return 0.0 if left <= centre <= right else min(abs(centre - left), abs(centre - right))

    nearest = min((one for one, _ in printed), key=apart)
    return abs(float(nearest["x"]) - float(cell["x"])) < 0.001


def _rect_px(cell: dict[str, float], margin_mm: float, shape: tuple[int, ...],
             margin_y_mm: float | None = None) -> tuple[int, int, int, int]:
    """A rectangle in millimetres, as pixels of the canonical page. The vertical margin can differ
    from the horizontal one: a seat reaches sideways for a hand and stays inside its own row."""
    height, width = shape[0], shape[1]
    margin_y = margin_mm if margin_y_mm is None else margin_y_mm
    x0 = int(round((float(cell["x"]) - margin_mm) * PX_PER_MM))
    y0 = int(round((float(cell["y"]) - margin_y) * PX_PER_MM))
    x1 = int(round((float(cell["x"]) + float(cell["w"]) + margin_mm) * PX_PER_MM))
    y1 = int(round((float(cell["y"]) + float(cell["h"]) + margin_y) * PX_PER_MM))
    x0, y0 = max(0, x0), max(0, y0)
    x1, y1 = min(width, max(x0 + 1, x1)), min(height, max(y0 + 1, y1))
    return x0, y0, x1, y1


def encode_png(image: np.ndarray) -> bytes:
    ok, buffer = cv2.imencode(".png", image)
    return buffer.tobytes() if ok else b""


def data_uri(png: bytes) -> str:
    return "data:image/png;base64," + base64.b64encode(png).decode("ascii")


def _printed_text(printed: dict[str, Any] | None, cell: str) -> str:
    if not printed:
        return ""
    if cell == "qty":
        value = printed.get("qty")
        if value is None:
            return ""
        if isinstance(value, float) and value.is_integer():
            return str(int(value))
        return str(value)
    if cell == "unit":
        return str(printed.get("unit") or "")
    return ""


def printed_baseline(reg: Registration, page: dict[str, Any]) -> float:
    """How much more ink this page's printing lays down than this file's rendering of the same value.

    Read off the page in hand, for the reason PAR-10.4 gives: the multiple belongs to the typeface
    and the exposure, so a page can state its own. The 40th percentile rather than the median,
    because a written-over cell is an outlier ABOVE and should not pull the baseline up after it.
    """
    ratios: list[float] = []
    for block in page.get("blocks", []):
        for row in block.get("rows", []):
            for name in ("qty", "unit"):
                cell = (row.get("cells") or {}).get(name)
                text = _printed_text(row.get("printed") or {}, name)
                if not cell or not text:
                    continue
                # THE BELT'S OWN BOX — and it has to be the box `observe` measures the belt on, or
                # the threshold is in one unit and the measurement in another.
                x0, y0, x1, y1 = _rect_px(cell, 0.0, reg.ink.shape, margin_y_mm=-INK_INSET_MM)
                patch = reg.ink[y0:y1, x0:x1]
                if not patch.size:
                    continue
                band, expected = _printed_band(text, patch.shape[1], patch.shape[0])
                # A saturated box is one the belt will never be applied to, so it has no business
                # setting the belt's baseline either.
                if expected <= 0.0005 or float(band.mean()) >= BAND_SATURATED:
                    continue
                ratios.append(float(patch.mean()) / expected)
    if not ratios:
        return PRINTED_BASELINE_CLAMP[0]
    return _clip(float(np.percentile(ratios, 40)), *PRINTED_BASELINE_CLAMP)


def page_floor(reg: Registration, page: dict[str, Any]) -> float:
    """The ink floor, READ OFF THIS PAGE'S OWN FINAL-WEIGHT BOXES (PAR-10.4).

    The twentieth percentile of what this sheet's own final-weight boxes contain is what an
    untouched box looks like TODAY, and the floor stands a margin above it, clamped to
    `[FLOOR_ABSOLUTE_MIN, FLOOR_ABSOLUTE_MAX]`.

    ⚠ WHAT THE LEARNING BUYS, MEASURED — because the honest answer is «less than it sounds». On
    every clean, blurred, darkened and JPEG-crushed page this harness makes, a bare constant of
    0.010 classifies IDENTICALLY to the learned floor; the learning is not what makes those pages
    read. Two pages separate them, and both are in the suite:

    · **A sheet somebody filled in completely.** The percentile is then a HANDWRITTEN box, so the
      floor climbs — and `FLOOR_ABSOLUTE_MAX` is what stops it climbing above the writing and
      reporting a page with a pen through every box as a blank one. That is the failure that would
      matter most, because a blank answer looks exactly like a sheet nobody has walked yet.
    · **A dirty sheet.** Specks lift every box at once; the page asks for the top of its range and
      makes fewer than half the mistakes a constant chosen on a clean page makes — two against five,
      measured. It still makes two, which PAR-10.8 states rather than hides.

    So the floor is read off the page as a POSTURE for photographs this harness has not produced —
    paper, exposure and compression do move what a blank box measures — and it is bounded at both
    ends so that it can never do worse than the constants it sits between.
    """
    inks: list[float] = []
    for block in page.get("blocks", []):
        for row in block.get("rows", []):
            cell = (row.get("cells") or {}).get("finalWeight")
            if not cell:
                continue
            x0, y0, x1, y1 = _rect_px(cell, -INK_INSET_MM, reg.ink.shape)
            patch = reg.ink[y0:y1, x0:x1]
            if patch.size:
                inks.append(float(patch.mean()))
    if not inks:
        return FLOOR_ABSOLUTE_MIN
    base = float(np.percentile(inks, 20))
    floor = max(base + FLOOR_STEP, base * FLOOR_FACTOR + FLOOR_BASE)
    return round(_clip(floor, FLOOR_ABSOLUTE_MIN, FLOOR_ABSOLUTE_MAX), 5)


def observe(reg: Registration, page: dict[str, Any], floor: float) -> list[CellObservation]:
    """Look at every box the manifest names, and say whether somebody wrote in it.

    Two rules, because there are two kinds of box:

    · **A box printed empty** — the final weight — is written when it holds more ink than the floor
      it faces: the page's own learned share, or two square millimetres of ink, whichever asks for
      less (`MIN_INK_MM2`). The paper left the box blank, so any real mark in it is a pen.

    · **A box printed with a value in it** — the quantity, the unit — already holds ink, and it is
      read in its row's printed SEAT (`_seat`) rather than in its own glyphs. The printed values are
      rendered where the paper drew them and grown into a band, the paper's own rules and the narrow
      gaps inside one amount are masked with them, and ink outside all of that is a pen — attributed
      to the printed value it stands nearest, so one correction is one answer. A second belt catches
      what the band cannot see, a hand writing straight OVER the value, by comparing that value's own
      rectangle against one rendering of it and the page's own baseline for that ratio; on a box the
      rendering already saturates, the belt stands down rather than measure typefaces (PAR-10.4a).

    Every threshold here is asked of the page in hand rather than chosen somewhere else.
    """
    out: list[CellObservation] = []
    baseline = printed_baseline(reg, page)
    for block in page.get("blocks", []):
        sale = str(block.get("sale") or "")
        for row in block.get("rows", []):
            # THE KIT'S OWN LINE ID, CARRIED WHOLE (paper.py `Row.line`): «l1» is not a number and
            # a reading that came back as 0 would name no line on the paper.
            line = row.get("line")
            printed = row.get("printed") or {}
            product = str(row.get("product") or "")
            for name in ("finalWeight", "qty", "unit"):
                cell = (row.get("cells") or {}).get(name)
                if not cell:
                    continue
                seat, patch, band, expected, printed_here = _looked_at(reg, row, name)
                cx0, cy0, cx1, cy1 = _rect_px(seat or cell, CROP_MARGIN_MM, reg.page.shape)
                crop = reg.page[cy0:cy1, cx0:cx1]
                ink = float(patch.mean()) if patch.size else 0.0

                # THE FLOOR THIS BOX FACES. The page's learned share, or two square millimetres of
                # ink, whichever asks for less — see MIN_INK_MM2. A wide box is where the two part
                # company, and a wide box is where a single digit gets lost.
                area_mm2 = max(1.0, float((seat or cell)["w"]) * float((seat or cell)["h"]))
                here = max(FLOOR_ABSOLUTE_MIN, min(floor, MIN_INK_MM2 / area_mm2))

                text = _printed_text(printed, name)
                if band is not None and patch.size:
                    # ONE · A MARK IN THE SEAT, BESIDE THE PRINTING. Ink outside the band — the
                    # band widened by the halo a printed value throws, so blur cannot read as a pen
                    # and a thin one is still all there — attributed to the printed value it stands
                    # nearest, because one correction is one answer.
                    halo = max(1, int(round(PRINTED_OUTSIDE_HALO_MM * PX_PER_MM))) | 1
                    around = cv2.dilate(band, np.ones((1, halo), np.uint8))
                    beyond = patch & (1 - around)
                    outside = float(beyond.mean()) if _belongs(seat, printed_here, cell, beyond) else 0.0
                    # TWO · A MARK STRAIGHT OVER THE PRINTING, which leaves nothing outside the band
                    # to attribute. The signal is how much more ink this value's OWN rectangle holds
                    # than one rendering of it, against the page's own baseline for that same ratio
                    # (`printed_baseline`) — which is measured on this same box, in these same units.
                    # ⚠ AND WITH NO SIDEWAYS INSET. The inset clears a printed rule on a cell's edge;
                    # on a 2.6 mm box it also removes two thirds of the box, the value renders into
                    # eight pixels, `expected` collapses and the belt fires on every untouched row.
                    # Measured on the harness: eleven phantom corrections on one page. The vertical
                    # inset stays — that is the one clearing the row's own hairline.
                    ox0, oy0, ox1, oy1 = _rect_px(cell, 0.0, reg.ink.shape, margin_y_mm=-INK_INSET_MM)
                    own = reg.ink[oy0:oy1, ox0:ox1]
                    over = False
                    if own.size:
                        own_band, own_expected = _printed_band(text, own.shape[1], own.shape[0])
                        ink = float(own.mean())
                        if float(own_band.mean()) < BAND_SATURATED and own_expected > 0.0005:
                            over = ink > own_expected * baseline * PRINTED_EXCESS_RATIO
                    written = outside > here or over
                    measured, against = outside, here
                else:
                    written = ink > here
                    measured, against = ink, here

                margin = abs(measured - against) / max(against, 0.001)
                confidence = round(_clip(0.5 + 0.5 * min(1.0, margin), 0.5, 1.0) * reg.confidence_scale, 3)
                context = f"{product} · line {line}"
                if text:
                    context += f" · printed «{text}»"
                out.append(CellObservation(sale=sale, line=line, cell=name, written=written,
                                           confidence=confidence, crop_png=encode_png(crop), ink=round(ink, 5),
                                           floor=round(here, 5), context=context, check=reg.check))
    return out


def choose_page(reg: Registration, pages: Iterable[dict[str, Any]]) -> tuple[dict[str, Any] | None, float, float]:
    """WHICH page of the document is in this photograph.

    One token is printed on every page of a run, so the mark names the DOCUMENT and cannot name the
    sheet. The printed values can: each page prints different quantities in different boxes, so the
    page whose rendered printed values best explain the ink actually found is the page in the hand.
    A single-page document skips the question. The margin between the best page and the next is
    returned with it, because a thin margin is a fact a person should be told.
    """
    pages = list(pages)
    if not pages:
        return None, 0.0, 0.0
    if len(pages) == 1:
        return pages[0], 1.0, 1.0

    scores: list[float] = []
    for page in pages:
        hits, total = 0.0, 0.0
        for block in page.get("blocks", []):
            for row in block.get("rows", []):
                for name in ("qty", "unit"):
                    cell = (row.get("cells") or {}).get(name)
                    text = _printed_text(row.get("printed") or {}, name)
                    if not cell or not text:
                        continue
                    x0, y0, x1, y1 = _rect_px(cell, 0.0, reg.ink.shape, margin_y_mm=-INK_INSET_MM)
                    patch = reg.ink[y0:y1, x0:x1]
                    if not patch.size:
                        continue
                    band, _ = _printed_band(text, patch.shape[1], patch.shape[0])
                    ink = float(patch.sum())
                    total += 1.0
                    hits += (float((patch & band).sum()) / ink) if ink > 0 else 0.0
        scores.append(hits / total if total else 0.0)

    order = sorted(range(len(pages)), key=lambda i: scores[i], reverse=True)
    best, second = order[0], order[1]
    return pages[best], round(scores[best], 3), round(scores[best] - scores[second], 3)
