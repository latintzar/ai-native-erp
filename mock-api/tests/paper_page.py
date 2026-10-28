"""A PACKING SHEET, MADE FROM A MANIFEST — and then photographed badly on purpose (PAR-10.7).

FEED-IA §198: «you can even test it by exporting and downresolutioning and even muddling or adding
fake dirt to the image and then running it through scanning all programmatically without requiring
me to print and test».

This module is that instruction, for OUR paper. It draws a real page from a real manifest — the QR
at the spec'd size with the spec'd error correction, three solid corner squares, printed rows,
ruled boxes, and SEVERAL HANDS writing in some of the boxes — and then does to it what a warehouse
and a phone do: scatters dirt on it, holds it at an angle, gets the focus slightly wrong, stands
under one strip light, and saves a JPEG the messaging app compressed.

⚠ SEVERAL HANDS, DELIBERATELY. A sheet comes back written on by whoever was on the dock, so
`DEFAULT_HANDS` is three faces taken in rotation, differing in letterform, slant, stroke weight,
size and where in the box the writing starts. A harness that writes every box with one face proves
one thing about one face. The live legs add a fourth — Caveat, a real handwriting face — which they
fetch, since an offline suite should not wait on a network.

⚠ IT IS A GENERATOR, NOT AN ORACLE. Everything the tests assert against comes from the manifest and
from the dictionary of what was written — never from the reader's own answer. The perspective
matrix the photograph was made with is returned too, so «the homography is right to under 0.7 mm»
is a comparison against the truth rather than against a second guess.
"""
from __future__ import annotations

import math
import os
from dataclasses import dataclass
from typing import Any

import cv2
import numpy as np
import qrcodegen
from PIL import Image, ImageDraw, ImageFont

SCHEME = "rocoto:document/packing/v1/"

A4 = (210.0, 297.0)
QR_BOX_MM = 20.1            # THE-QR-SPEC QR-03 — 76 px at 96 dpi, on A4 and A5 alike
QR_QUIET_MODULES = 4
CORNER_MM = 6.0             # the contract: solid squares, 6 mm
CORNER_INSET_MM = 5.0       # …5 mm in from the edges
PAGE_MARGIN_MM = 5.0

# The fonts are vendored (tests/fonts, licences beside them): a sheet drawn from the machine's fonts
# renders differently per machine, and a missing hand font once fell back to a bitmap font on CI and
# read as «no pen». A missing file is an error here, never a fallback.
FONTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fonts")
SANS = os.path.join(FONTS, "DejaVuSans.ttf")
SANS_BOLD = os.path.join(FONTS, "DejaVuSans-Bold.ttf")


@dataclass(frozen=True)
class Hand:
    """ONE PERSON'S WRITING — a face, a slant, a pressure and where in the box they start.

    A packing sheet comes back from a warehouse written on by whoever was on the dock, so a harness
    that writes every cell with one face is proving one thing about one hand. `DEFAULT_HANDS` is
    three, and they differ on every axis the classifier could be leaning on: letterform, slant,
    stroke weight, size and where in the box the writing starts.
    """
    name: str
    face: str
    shear: float
    weight_mm: float
    size_mm: float
    start: float = 0.25


DEFAULT_HANDS = (
    Hand("prints", SANS_BOLD, 0.22, 0.25, 4.0, 0.25),
    Hand("leans", os.path.join(FONTS, "FreeSerifBoldItalic.ttf"), 0.06, 0.30, 4.6, 0.14),
    Hand("hurries", os.path.join(FONTS, "LiberationSans-BoldItalic.ttf"), 0.34, 0.18, 3.6, 0.30),
)
"""The hands the sheet is written by, in rotation, one per written box. Every face on this list is
installed on the box; a real handwriting face (Caveat) is fetched by the live legs, which pass it in
as a fourth hand rather than making an offline suite wait on a network."""


def caveat_hand(path: str) -> Hand:
    """A REAL HANDWRITING FACE as a hand, for a leg that has fetched Caveat (PAR-10.7)."""
    return Hand("caveat", path, 0.04, 0.22, 5.4, 0.16)

ROW_TOP_MM = 62.0
ROW_PITCH_MM = 11.0
ROW_HEIGHT_MM = 6.4
COL_QTY = (118.0, 18.0)
COL_UNIT = (139.0, 15.0)
COL_FINAL = (157.0, 26.0)

# ── THE COLUMNS THE KIT ACTUALLY PRINTS ────────────────────────────────────────────────────────
# Read off a recorded manifest from `tools/paper-harness.py` (`print-A4.json`, A4, 300 dpi): the kit
# reports a printed amount's rectangle as THE VALUE'S OWN INK — «22» is 5.48 mm wide and «kg» 4.89,
# with 1.14 mm of paper between them — because that is what lets a reader be asked about the number
# apart from the unit beside it. The columns above are boxes a house rules; these are glyphs.
#
# ⚠ THE TWO GEOMETRIES ARE NOT THE SAME TEST. A belt proven on an 18 mm quantity box with 21 mm of
# clear paper before the unit is proven on paper the printer never makes, and a correction written
# BESIDE a glyph-tight amount is the case that geometry cannot pose at all. Both are here.
TIGHT_QTY = (161.72, 5.48)
TIGHT_UNIT = (168.34, 4.89)
TIGHT_FINAL = (175.88, 23.27)
TIGHT_ROW_TOP_MM = 67.70
TIGHT_ROW_PITCH_MM = 10.05
TIGHT_ROW_HEIGHT_MM = 5.29

GLYPH_TIGHT_MM = 8.0
"""A cell this narrow IS the value's ink, so `render` sets the type to fill it and leaves it
unruled — the kit draws one hairline across the row and no box round the amount."""

BESIDE_MM = 13.0
"""Where a hand writes a corrected amount: in the paper to the LEFT of the printed one, which is
where `tools/paper-harness.py` puts it and where the packing sheet leaves room."""


def _font(path: str, px: int):
    if not os.path.exists(path):
        raise FileNotFoundError(f"paper_page font missing: {path} (vendored in tests/fonts)")
    return ImageFont.truetype(path, max(6, px))


def manifest(token: str = "k3m9x2p7qa1", day: str = "2026-09-04", *,
             lines: list[tuple[str, str, str, float, str]] | None = None,
             qr_corner: str = "tr", pages: int = 1, tight: bool = False) -> dict[str, Any]:
    """A manifest exactly as the kit will POST it.

    `qr_corner` says where the mark sits, and the three corner squares take the corners it leaves.
    THE-QR-SPEC puts the mark top right; the parameter exists so the runtime is proven to read a
    sheet marked either way, since which three ids appear is a consequence of that one choice.

    `tight` lays the quantity and the unit at THE KIT'S OWN measured widths (`TIGHT_QTY`) rather
    than at the wide ruled boxes this module lays out by default — the geometry the printer really
    makes, and the one a correction written beside the amount has to be found in.
    """
    rows = lines if lines is not None else [
        ("s-101", "Merluza grande", "MER-001", 12.0, "kg"),
        ("s-101", "Pulpo cocido", "PUL-004", 3.0, "caja"),
        ("s-101", "Gamba roja", "GAM-002", 8.5, "kg"),
        ("s-102", "Almeja fina", "ALM-007", 4.0, "caja"),
        ("s-102", "Rape limpio", "RAP-003", 6.25, "kg"),
        ("s-102", "Navaja gallega", "NAV-009", 2.0, "manojo"),
    ]

    wide, tall = A4
    qr_x = wide - PAGE_MARGIN_MM - QR_BOX_MM if qr_corner in ("tr", "br") else PAGE_MARGIN_MM
    qr_y = PAGE_MARGIN_MM if qr_corner in ("tr", "tl") else tall - PAGE_MARGIN_MM - QR_BOX_MM
    spots = {
        "tl": (CORNER_INSET_MM, CORNER_INSET_MM),
        "tr": (wide - CORNER_INSET_MM - CORNER_MM, CORNER_INSET_MM),
        "bl": (CORNER_INSET_MM, tall - CORNER_INSET_MM - CORNER_MM),
        "br": (wide - CORNER_INSET_MM - CORNER_MM, tall - CORNER_INSET_MM - CORNER_MM),
    }
    corners = [{"id": name, "x": x, "y": y, "size": CORNER_MM}
               for name, (x, y) in spots.items() if name != qr_corner]

    qty_col, unit_col, final_col = ((TIGHT_QTY, TIGHT_UNIT, TIGHT_FINAL) if tight
                                    else (COL_QTY, COL_UNIT, COL_FINAL))
    row_top = TIGHT_ROW_TOP_MM if tight else ROW_TOP_MM
    row_pitch = TIGHT_ROW_PITCH_MM if tight else ROW_PITCH_MM
    row_height = TIGHT_ROW_HEIGHT_MM if tight else ROW_HEIGHT_MM

    def page_of(index: int, batch: list[tuple[str, str, str, float, str]]) -> dict[str, Any]:
        blocks: dict[str, dict[str, Any]] = {}
        for seat, (sale, product, code, qty, unit) in enumerate(batch):
            y = row_top + seat * row_pitch
            block = blocks.setdefault(sale, {"sale": sale, "number": f"ALB-{sale[-3:]}",
                                             "customer": f"Customer {sale[-3:]}", "rows": []})
            block["rows"].append({
                "line": len(block["rows"]) + 1 + index * 100,
                "product": f"{code} {product}",
                "printed": {"qty": qty, "unit": unit},
                "cells": {
                    "qty": {"x": qty_col[0], "y": y, "w": qty_col[1], "h": row_height},
                    "unit": {"x": unit_col[0], "y": y, "w": unit_col[1], "h": row_height},
                    "finalWeight": {"x": final_col[0], "y": y, "w": final_col[1], "h": row_height},
                },
            })
        return {"index": index, "blocks": list(blocks.values())}

    per_page = max(1, len(rows) // max(1, pages))
    sheets = [page_of(i, rows[i * per_page:(i + 1) * per_page] or rows[-per_page:]) for i in range(pages)]

    return {
        "version": 1, "locator": SCHEME + token, "token": token, "day": day, "paper": "A4",
        "pageMm": {"w": wide, "h": tall},
        "marks": {"qr": {"x": qr_x, "y": qr_y, "size": QR_BOX_MM}, "corners": corners},
        "pages": sheets,
    }


def _draw_qr(draw: ImageDraw.ImageDraw, locator: str, x_mm: float, y_mm: float, px_per_mm: float) -> int:
    """The real symbol, at the real size. Returns the module count, so a test can assert QR-02's
    version-3 arithmetic rather than trusting it."""
    code = qrcodegen.QrCode.encode_text(locator, qrcodegen.QrCode.Ecc.MEDIUM)
    modules = code.get_size()
    box_px = QR_BOX_MM * px_per_mm
    module_px = box_px / (modules + 2 * QR_QUIET_MODULES)
    origin_x = x_mm * px_per_mm + QR_QUIET_MODULES * module_px
    origin_y = y_mm * px_per_mm + QR_QUIET_MODULES * module_px
    draw.rectangle([x_mm * px_per_mm, y_mm * px_per_mm,
                    x_mm * px_per_mm + box_px, y_mm * px_per_mm + box_px], fill=255)
    for row in range(modules):
        for col in range(modules):
            if code.get_module(col, row):
                draw.rectangle([round(origin_x + col * module_px), round(origin_y + row * module_px),
                                round(origin_x + (col + 1) * module_px) - 1,
                                round(origin_y + (row + 1) * module_px) - 1], fill=0)
    return modules


def render(book: dict[str, Any], written: dict[tuple[str, int, str], str] | None = None,
           *, page_index: int = 0, px_per_mm: float = 10.0, corners: bool = True,
           over: bool = False, beside: bool = False,
           hands: tuple[Hand, ...] = DEFAULT_HANDS,
           pen_mm: float | None = None, dirt: float = 0.0) -> tuple[np.ndarray, int]:
    """Draw one page of the manifest as the printer would, with a pen through the boxes named.

    `corners=False` prints the sheet WITHOUT its three squares while the manifest still promises
    them — a sheet from an older template, and the case that has to be refused rather than read off
    a page located from the code alone.

    `over=True` puts the pen ON the printed value rather than beside it, in a heavier stroke — a
    quantity corrected in place. Every stroke lands inside the printed value's own band, where the
    band test is blind by construction, so that page is the one that isolates the second belt.

    `beside=True` strikes the printed value through and writes the new amount in the paper to its
    LEFT (`BESIDE_MM`) — the shape a packer's hand actually makes, and the one the band test is for.

    `hands` are the people who wrote on it, taken in rotation one per written box — so a sheet
    carries several letterforms, slants and pressures the way a sheet off a dock does. Pass a single
    hand to isolate one.

    `pen_mm` sets the hand's stroke width in millimetres instead of taking the hand's own.

    `dirt` scatters specks over the finished sheet — FEED-IA §198's own word for it. Dirt lands in
    every box at once, which is what separates a floor read off the sheet in hand from a constant
    chosen on a clean one: measured, two mistakes against five.

    A cell narrower than `GLYPH_TIGHT_MM` is the value's own ink: the type is set to fill it and no
    box is ruled round it, because that is what the kit prints. The row keeps the kit's own hairline,
    in the kit's own grey (243 of 255, measured on `print-A4-p0.png`).
    """
    written = written or {}
    wide, tall = book["pageMm"]["w"], book["pageMm"]["h"]
    width, height = int(round(wide * px_per_mm)), int(round(tall * px_per_mm))
    sheet = Image.new("L", (width, height), 255)
    draw = ImageDraw.Draw(sheet)

    head = _font(SANS_BOLD, int(4.6 * px_per_mm))
    body = _font(SANS, int(3.0 * px_per_mm))
    small = _font(SANS, int(2.4 * px_per_mm))
    pens = list(hands) or list(DEFAULT_HANDS)
    written_so_far = 0

    draw.text((PAGE_MARGIN_MM * px_per_mm, 8 * px_per_mm), "Packing list", fill=0, font=head)
    draw.text((PAGE_MARGIN_MM * px_per_mm, 16 * px_per_mm), f"Day {book['day']}", fill=0, font=body)
    draw.text((PAGE_MARGIN_MM * px_per_mm, 21 * px_per_mm),
              book["token"], fill=0, font=small)          # QR-05.3 — the typed road's own line

    modules = _draw_qr(draw, book["locator"], book["marks"]["qr"]["x"], book["marks"]["qr"]["y"], px_per_mm)
    for corner in (book["marks"]["corners"] if corners else []):
        draw.rectangle([corner["x"] * px_per_mm, corner["y"] * px_per_mm,
                        (corner["x"] + corner["size"]) * px_per_mm - 1,
                        (corner["y"] + corner["size"]) * px_per_mm - 1], fill=0)

    page = next(p for p in book["pages"] if int(p["index"]) == page_index)
    draw.text((PAGE_MARGIN_MM * px_per_mm, (ROW_TOP_MM - 7) * px_per_mm),
              "Product", fill=0, font=small)
    for label, (x, _w) in (("Qty", COL_QTY), ("Unit", COL_UNIT), ("Final weight", COL_FINAL)):
        draw.text((x * px_per_mm, (ROW_TOP_MM - 7) * px_per_mm), label, fill=0, font=small)

    for block in page["blocks"]:
        for row in block["rows"]:
            cells = row["cells"]
            top = cells["finalWeight"]["y"]
            draw.text((PAGE_MARGIN_MM * px_per_mm, (top + 0.9) * px_per_mm), row["product"], fill=0, font=body)
            if min(float(cell["w"]) for cell in cells.values()) < GLYPH_TIGHT_MM:
                rule = (top + float(cells["finalWeight"]["h"]) + 1.7) * px_per_mm
                draw.line([PAGE_MARGIN_MM * px_per_mm, rule,
                           (book["pageMm"]["w"] - PAGE_MARGIN_MM) * px_per_mm, rule], fill=243, width=1)
            for name, cell in cells.items():
                printed = row.get("printed") or {}
                text = ""
                if name == "qty" and printed.get("qty") is not None:
                    value = printed["qty"]
                    text = str(int(value)) if float(value).is_integer() else str(value)
                elif name == "unit":
                    text = str(printed.get("unit") or "")

                tight = float(cell["w"]) < GLYPH_TIGHT_MM
                if not tight:
                    draw.rectangle([cell["x"] * px_per_mm, cell["y"] * px_per_mm,
                                    (cell["x"] + cell["w"]) * px_per_mm, (cell["y"] + cell["h"]) * px_per_mm],
                                   outline=0, width=max(1, int(px_per_mm * 0.12)))
                if text and tight:
                    _fill_cell(draw, text, cell, px_per_mm)
                elif text:
                    draw.text(((cell["x"] + 1.4) * px_per_mm, (cell["y"] + 1.0) * px_per_mm),
                              text, fill=0, font=body)

                said = written.get((block["sale"], int(row["line"]), name))
                if said:
                    hand = pens[written_so_far % len(pens)]
                    if beside and text:
                        _strike(draw, cell, px_per_mm)
                        _write_by_hand(sheet, said,
                                       {"x": float(cell["x"]) - BESIDE_MM, "y": float(cell["y"]),
                                        "w": BESIDE_MM - 1.0, "h": float(cell["h"])}, px_per_mm, hand,
                                       pen_mm=pen_mm)
                    else:
                        _write_by_hand(sheet, said, cell, px_per_mm, hand,
                                       across=over and bool(text), pen_mm=pen_mm)
                    written_so_far += 1

    drawn = cv2.cvtColor(np.array(sheet), cv2.COLOR_GRAY2BGR)
    if dirt:
        drawn = _speckle(drawn, dirt)
    return drawn, modules


def _fill_cell(draw: ImageDraw.ImageDraw, text: str, cell: dict[str, float], px_per_mm: float) -> None:
    """Set a printed value so ITS OWN INK fills the rectangle the manifest reports.

    The kit measures the glyphs and reports that measurement, so a fixture that draws the value at an
    inset inside its cell is drawing a different page from the one the printer makes."""
    want_w = max(2.0, float(cell["w"]) * px_per_mm)
    want_h = max(2.0, float(cell["h"]) * px_per_mm)
    size = max(6, int(want_h))
    for _ in range(8):
        font = _font(SANS, size)
        left, top_, right, bottom = draw.textbbox((0, 0), text, font=font)
        wide, tall = max(1, right - left), max(1, bottom - top_)
        if wide <= want_w and tall <= want_h:
            break
        size = max(6, int(size * min(want_w / wide, want_h / tall)))
    font = _font(SANS, size)
    left, top_, right, bottom = draw.textbbox((0, 0), text, font=font)
    draw.text((float(cell["x"]) * px_per_mm - left,
               float(cell["y"]) * px_per_mm - top_ + (want_h - (bottom - top_)) / 2),
              text, fill=0, font=font)


def _strike(draw: ImageDraw.ImageDraw, cell: dict[str, float], px_per_mm: float) -> None:
    """A line drawn through a printed amount by the hand that is replacing it — ink INSIDE the
    printed value's own band, where the band test is blind, so it earns the correction nothing."""
    y = (float(cell["y"]) + float(cell["h"]) * 0.52) * px_per_mm
    draw.line([(float(cell["x"]) - 0.4) * px_per_mm, y + 0.9 * px_per_mm,
               (float(cell["x"]) + float(cell["w"]) + 0.4) * px_per_mm, y - 0.9 * px_per_mm],
              fill=0, width=max(1, int(px_per_mm * 0.22)))


def stroke_width_px(mask: np.ndarray) -> float:
    """How wide the strokes in a drawn word are, in pixels — twice the 90th percentile of the ink's
    distance to the nearest paper. On a stroke of even width that distance runs uniformly up to half
    the width, so twice its 90th percentile lands just under the width itself: a number that moves
    with the pen and can be asserted, rather than a font size that stands in for one."""
    ink = (mask > 0).astype(np.uint8)
    if not ink.any():
        return 0.0
    apart = cv2.distanceTransform(ink, cv2.DIST_L2, 3)
    return 2.0 * float(np.percentile(apart[ink > 0], 90))


SUPER = 4
"""A THIN PEN IS DRAWN BIG AND THINNED THERE. Eroding a two-pixel stroke down to a two-pixel stroke
takes whole glyphs with it — the «1» goes first. At four times the size the same erosion is a
quarter as coarse, the word keeps its shape, and the downscale carries the thin strokes back."""

PEN_TYPE_MM = 4.0
"""How tall a hand writes by default, in millimetres — `Hand.size_mm` is what each one actually
uses, and `pen_mm` sets the stroke width apart from either."""


def _pen(stroke: np.ndarray, want_px: float) -> np.ndarray:
    """Thin or thicken a drawn word until its strokes are `want_px` across, measured each step.

    ⚠ A FONT SIZE DOES NOT GIVE A PEN WIDTH. A real biro lays about two tenths of a millimetre of
    ink; type set at 4 mm lays four times that, and a classifier proved on type has never met the
    hand it will actually be given. So the pen is a stated width here, and `stroke_width_px` says
    what it came out as."""
    kernel = np.ones((3, 3), np.uint8)
    for _ in range(12):
        got = stroke_width_px(stroke)
        if got <= 0.0 or abs(got - want_px) <= 1.0:
            break
        stroke = cv2.erode(stroke, kernel) if got > want_px else cv2.dilate(stroke, kernel)
    return stroke


def _speckle(page: np.ndarray, density: float, seed: int = 11) -> np.ndarray:
    """Fake dirt, scattered over the whole sheet: dust on the scanner glass, a thumb off a crate.

    It is deliberately EVEN — every box gets some — because that is the page where the floor read
    off the sheet and a constant chosen on a clean one part company: at 0.001 specks per pixel the
    page's own floor misreads two boxes and the constant misreads five. Neither reaches zero, which
    PAR-10.8 states as a limit rather than a win.
    """
    rng = np.random.default_rng(seed)
    out = page.copy()
    height, width = out.shape[:2]
    count = int(height * width * density)
    xs = rng.integers(0, width, count)
    ys = rng.integers(0, height, count)
    radii = rng.integers(1, 3, count)
    for x, y, radius in zip(xs, ys, radii):
        cv2.circle(out, (int(x), int(y)), int(radius), (40, 40, 40), -1)
    return out


def _hand_layer(said: str, width: int, height: int, font, across: bool,
                shear: float = 0.22, start: float = 0.25) -> np.ndarray:
    """The word itself: written on its own layer and sheared before it lands, so the strokes cross
    the box's rule the way a real hand does. The slant and the starting place come from the HAND,
    so two people writing the same value leave two different marks."""
    layer = Image.new("L", (width * 2, height * 2), 0)
    drawn = ImageDraw.Draw(layer)
    drawn.text((width * (0.06 if across else start), height * 0.15), said, fill=255, font=font)
    layer = layer.transform(layer.size, Image.AFFINE, (1, shear, -height * 0.2, 0, 1, 0),
                            resample=Image.BICUBIC)
    return np.array(layer.crop((0, 0, width, height)))


def _write_by_hand(sheet: Image.Image, said: str, cell: dict[str, float], px_per_mm: float,
                   hand: Hand, across: bool = False, pen_mm: float | None = None) -> None:
    """ONE HAND writing in one box: its face, its slant, its pressure, its place in the box.

    The writing is drawn on its own layer and sheared before it lands, so the strokes cross the
    box's rule the way a real hand does — which is exactly the ink the classifier has to tell from
    printing. `across` puts the pen ON the printed value in a heavier stroke: a correction in place.

    `pen_mm` sets the stroke to a stated width instead of the hand's own (see `_pen`).
    """
    width = int(cell["w"] * px_per_mm)
    height = int(cell["h"] * px_per_mm)
    if pen_mm is not None:
        big = _hand_layer(said, width * SUPER, height * SUPER,
                          _font(hand.face, int(hand.size_mm * px_per_mm * SUPER)), across,
                          hand.shear, hand.start)
        stroke = cv2.resize(_pen(big, pen_mm * px_per_mm * SUPER), (width, height),
                            interpolation=cv2.INTER_AREA)
        stroke = ((stroke > 96) * 255).astype(np.uint8)
    else:
        stroke = _hand_layer(said, width, height, _font(hand.face, int(hand.size_mm * px_per_mm)),
                             across, hand.shear, hand.start)
        weight = px_per_mm * (0.55 if across else hand.weight_mm)
        stroke = cv2.dilate(stroke, np.ones((max(1, int(weight)),) * 2, np.uint8))
    patch = np.array(sheet.crop((int(cell["x"] * px_per_mm), int(cell["y"] * px_per_mm),
                                 int(cell["x"] * px_per_mm) + width, int(cell["y"] * px_per_mm) + height)))
    patch = np.minimum(patch, 255 - stroke).astype(np.uint8)
    sheet.paste(Image.fromarray(patch), (int(cell["x"] * px_per_mm), int(cell["y"] * px_per_mm)))


def photograph(page: np.ndarray, px_per_mm: float, *, lean: float = 0.30, roll_deg: float = 7.0,
               blur: float = 1.3, darken: float = 0.80, jpeg: int = 45,
               pad: float = 0.10) -> tuple[bytes, np.ndarray]:
    """The same sheet as a photograph somebody took at 05:40, and the map that made it.

    Returned with the bytes is `T`, the true page-millimetre → photo-pixel matrix. That is what
    turns «the homography looks right» into «the homography is within 0.7 mm at every cell centre».
    """
    height, width = page.shape[:2]
    source = np.float32([[0, 0], [width, 0], [width, height], [0, height]])
    leaned = np.float32([[width * lean / 2, 0], [width * (1 - lean / 2), 0], [width, height], [0, height]])
    perspective = cv2.getPerspectiveTransform(source, leaned)

    angle = math.radians(roll_deg)
    roll = np.array([[math.cos(angle), -math.sin(angle), 0.0],
                     [math.sin(angle), math.cos(angle), 0.0],
                     [0.0, 0.0, 1.0]], dtype=np.float64)

    # THE WHOLE SHEET STAYS IN THE FRAME, and the canvas is measured rather than guessed: a corner
    # mark cropped off the edge is a harness bug that would read as a product failure.
    corners = cv2.perspectiveTransform(source.reshape(-1, 1, 2).astype(np.float64), roll @ perspective).reshape(-1, 2)
    low, high = corners.min(axis=0), corners.max(axis=0)
    pad_x, pad_y = (high[0] - low[0]) * pad, (high[1] - low[1]) * pad
    shift = np.array([[1.0, 0.0, pad_x - low[0]], [0.0, 1.0, pad_y - low[1]], [0.0, 0.0, 1.0]])
    matrix = shift @ roll @ perspective
    out_w = int(round(high[0] - low[0] + 2 * pad_x))
    out_h = int(round(high[1] - low[1] + 2 * pad_y))
    photo = cv2.warpPerspective(page, matrix, (out_w, out_h),
                                flags=cv2.INTER_AREA, borderValue=(118, 122, 126))

    if blur > 0:
        photo = cv2.GaussianBlur(photo, (0, 0), blur)
    if darken != 1.0:
        ramp = np.linspace(darken, min(1.0, darken + 0.35), out_w, dtype=np.float32)[None, :, None]
        photo = np.clip(photo.astype(np.float32) * ramp, 0, 255).astype(np.uint8)

    ok, buffer = cv2.imencode(".jpg", photo, [int(cv2.IMWRITE_JPEG_QUALITY), jpeg])
    assert ok, "the photograph would not encode"

    scale = np.array([[px_per_mm, 0.0, 0.0], [0.0, px_per_mm, 0.0], [0.0, 0.0, 1.0]])
    return buffer.tobytes(), matrix @ scale


def cell_centres_mm(page: dict[str, Any]) -> list[tuple[str, int, str, tuple[float, float]]]:
    out = []
    for block in page["blocks"]:
        for row in block["rows"]:
            for name, cell in row["cells"].items():
                out.append((block["sale"], int(row["line"]), name,
                            (cell["x"] + cell["w"] / 2, cell["y"] + cell["h"] / 2)))
    return out
