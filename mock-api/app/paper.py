"""OUR OWN PAPER — the manifest the kit records, and the photograph read back against it (PAR-10).

Three endpoints, and they are one idea in two halves.

    POST /api/paper/manifest        the packing sheet, at PRINT time, says where every box it drew
                                    sits on the page. Kept by the QR's token, because the token is
                                    the only thing the paper itself carries.
    GET  /api/paper/manifest/<t>    what is kept.
    POST /api/paper/read            a photograph of that sheet. The marks locate the page, the
                                    manifest names every box on it, and the reader is asked only
                                    «what is written here».

⚠ WHY THIS IS NOT OCR, AND WHY THAT MATTERS. Reading a delivery note from a photograph normally
means finding the table, finding the rows and guessing which number belongs to which line — and a
guess about which line a weight belongs to is a wrong delivery, not a wrong pixel. Here the page was
ours: the geometry is recorded, so the answer is addressed by construction. `readings` names a
`(sale, line, cell)` because the box it came from was that sale's, that line's, that column's.

⚠ AND WITHOUT A MANIFEST THERE IS NO READ. A photograph whose code names no sheet this runtime holds
is answered 422 with a sentence that says what to do — never with rows read against nothing. The
kit's answer to that 422 is the road it already has: Parsewise, §196.5, which reads a document it
did not print. Two honest roads beat one road that pretends.
"""
from __future__ import annotations

import logging
import re
import time
from datetime import date
from typing import Any, Literal

import cv2
import numpy as np
from fastapi import APIRouter, File, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator, model_validator

from . import handwriting, register, store
from .config import settings
from .errors import RuntimeError_

logger = logging.getLogger("rocoto.runtime.paper")
router = APIRouter()

SCHEME = "rocoto:document/packing/v1/"
TOKEN_GRAMMAR = re.compile(r"^[a-z0-9]{1,13}$")
"""THE-QR-SPEC QR-01 · QR-05.4, the same grammar the kit's `parsePackingLocator` enforces. Both
halves of this system accept exactly the same strings, so a mark the paper carries and a mark the
runtime holds cannot mean two different things."""

PAPER_MM = {"A4": (210.0, 297.0), "A5": (148.0, 210.0)}
PAPER_TOLERANCE_MM = 5.0
"""How far the stated millimetres may sit from the named paper. Wide enough to forgive rounding and
a printer's own margin arithmetic; far narrower than the 87 mm that separates A4 from A5, which is
the mistake worth catching."""

CELL_NAMES = ("finalWeight", "qty", "unit")
CORNER_IDS = ("tl", "tr", "bl", "br")
"""All four, deliberately. The contract's own list names three — the corners the QR does not occupy
— and which three depends on where the QR sits, which THE-QR-SPEC puts at the top right. Accepting
the whole vocabulary and requiring exactly three of them reads either producer, and the geometry
comes from each mark's own millimetres rather than from its name."""


# ── THE CONTRACT, AS TYPES ──────────────────────────────────────────────────────────────────

class Cell(BaseModel):
    """One box on the page, in millimetres from the page's top-left corner."""
    x: float = Field(ge=0)
    y: float = Field(ge=0)
    w: float = Field(gt=0)
    h: float = Field(gt=0)


class Cells(BaseModel):
    """The three columns a packing line can be written in.

    `finalWeight` is required because it is the reason the paper goes out at all — the box printed
    empty for somebody to fill in. `qty` and `unit` are optional: a sheet that prints no unit column
    still has a final weight to read, and refusing that page would be refusing a real sheet.
    """
    finalWeight: Cell
    qty: Cell | None = None
    unit: Cell | None = None


class Printed(BaseModel):
    """What the paper already says in the printed boxes — the mask a written value is read against."""
    qty: float | int | str | None = None
    unit: str | None = None


class Row(BaseModel):
    """One printed line of one order.

    ⚠ `line` IS THE KIT'S OWN ID AND IT TRAVELS UNCHANGED. The kit prints `l1 · l2 · l3` (its
    `ManifestRow.line` is a string, and `data-line` on the paper carries the same characters), so a
    runtime that parsed it into a number would answer about a line nobody could find. It arrives as
    it was printed and it comes back on every reading as it was printed — a number-shaped id stays a
    number, a letter-shaped id stays letters, and neither side has to translate. Found by the E196.5
    harness the first time both halves were put in one tree: the kit's manifest was refused whole
    with «line: Input should be a valid integer».
    """
    line: str | int
    product: str = ""
    printed: Printed = Field(default_factory=Printed)
    cells: Cells

    @field_validator("line")
    @classmethod
    def _named(cls, value: str | int) -> str | int:
        if isinstance(value, str) and not value.strip():
            raise ValueError("each row carries the line id the paper printed")
        return value.strip() if isinstance(value, str) else value


class Block(BaseModel):
    sale: str = Field(min_length=1)
    number: str = ""
    customer: str = ""
    rows: list[Row]


class Page(BaseModel):
    index: int = Field(ge=0)
    blocks: list[Block]


class PageMm(BaseModel):
    w: float = Field(gt=0)
    h: float = Field(gt=0)


class Mark(BaseModel):
    x: float = Field(ge=0)
    y: float = Field(ge=0)
    size: float = Field(gt=0)


class CornerMark(Mark):
    id: Literal["tl", "tr", "bl", "br"]


class Marks(BaseModel):
    qr: Mark
    corners: list[CornerMark]

    @field_validator("corners")
    @classmethod
    def three_distinct_corners(cls, corners: list[CornerMark]) -> list[CornerMark]:
        if len(corners) != 3:
            raise ValueError("names three corner marks, one at each corner the code leaves free")
        if len({c.id for c in corners}) != 3:
            raise ValueError("gives each corner mark its own corner")
        return corners


class Manifest(BaseModel):
    """The whole record, validated the way the read will use it.

    Extra fields are IGNORED rather than refused: `code` and `header` set the precedent
    (THE-RUNTIME-SPEC RUN-02) that a producer may state more than a consumer reads, and a manifest
    that carries one more fact should not fail to be stored over it.
    """
    version: Literal[1]
    locator: str
    token: str
    day: str
    paper: Literal["A4", "A5"]
    pageMm: PageMm
    marks: Marks
    pages: list[Page]

    @field_validator("token")
    @classmethod
    def token_grammar(cls, token: str) -> str:
        lowered = (token or "").strip().lower()
        if not TOKEN_GRAMMAR.match(lowered):
            raise ValueError("is one to thirteen lower-case letters and digits, as the paper prints it")
        return lowered

    @field_validator("day")
    @classmethod
    def day_is_a_day(cls, day: str) -> str:
        try:
            date.fromisoformat((day or "").strip())
        except ValueError as exc:
            raise ValueError("is a calendar day, written YYYY-MM-DD") from exc
        return day.strip()

    @model_validator(mode="after")
    def geometry_holds_together(self) -> "Manifest":
        if self.locator.strip().lower() != SCHEME + self.token:
            raise ValueError(f"the locator spells out its own token: «{SCHEME}{self.token}»")

        wide, tall = PAPER_MM[self.paper]
        if abs(self.pageMm.w - wide) > PAPER_TOLERANCE_MM or abs(self.pageMm.h - tall) > PAPER_TOLERANCE_MM:
            raise ValueError(f"{self.paper} measures {wide:g} × {tall:g} mm; this page states "
                             f"{self.pageMm.w:g} × {self.pageMm.h:g}")

        def inside(x: float, y: float, w: float, h: float, what: str) -> None:
            if x + w > self.pageMm.w + 0.5 or y + h > self.pageMm.h + 0.5:
                raise ValueError(f"{what} stands on the page it is measured against")

        inside(self.marks.qr.x, self.marks.qr.y, self.marks.qr.size, self.marks.qr.size, "every mark")
        for corner in self.marks.corners:
            inside(corner.x, corner.y, corner.size, corner.size, f"the {corner.id} mark")

        # (sale, line) IS THE ADDRESS A READING COMES BACK ON, so it has to name one box. Two rows
        # sharing it would make the answer ambiguous in the one place ambiguity costs a delivery.
        seen: set[tuple[str, int]] = set()
        for page in self.pages:
            for block in page.blocks:
                for row in block.rows:
                    key = (block.sale, row.line)
                    if key in seen:
                        raise ValueError(f"each line of a sale is named once; «{block.sale}» line {row.line} is named twice")
                    seen.add(key)
                    for name in CELL_NAMES:
                        cell = getattr(row.cells, name)
                        if cell is not None:
                            inside(cell.x, cell.y, cell.w, cell.h, f"every cell of «{block.sale}» line {row.line}")
        if not seen:
            raise ValueError("carries at least one line to read")
        return self


# ── POST /api/paper/manifest ────────────────────────────────────────────────────────────────

@router.post("/api/paper/manifest")
async def record_manifest(manifest: Manifest) -> JSONResponse:
    """The sheet, as printed. Recorded once, keyed by the token the paper carries."""
    body = manifest.model_dump()
    record = store.save_manifest(manifest.token, body)
    cells = sum(1 for page in manifest.pages for block in page.blocks for row in block.rows
                for name in CELL_NAMES if getattr(row.cells, name) is not None)
    logger.info("paper manifest recorded", extra={
        "provider": "paper", "kind": manifest.paper,
        "outcome": f"{len(manifest.pages)} pages · {cells} cells"})
    return JSONResponse({"ok": True, "token": manifest.token, "locator": SCHEME + manifest.token,
                         "pages": len(manifest.pages), "cells": cells, "storedAt": record["storedAt"]})


# ── GET /api/paper/manifest/<token> ─────────────────────────────────────────────────────────

@router.get("/api/paper/manifest/{token}")
async def read_manifest(token: str) -> JSONResponse:
    """What this runtime holds for that token — the manifest itself, as it was recorded."""
    stored = store.get_manifest((token or "").strip().lower())
    if stored is None:
        raise RuntimeError_("manifest_unknown",
                            "This runtime holds the packing sheets printed through it. Print the sheet "
                            "from the kit and its code reads back here.", 404)
    return JSONResponse(stored)


# ── POST /api/paper/read ────────────────────────────────────────────────────────────────────

def _locator_of(said: str) -> str | None:
    """QR-05.4's grammar, on this side of the wire: space and case forgiven, content never invented."""
    text = (said or "").strip()
    if not text:
        return None
    token = (text[len(SCHEME):] if text.lower().startswith(SCHEME) else text).strip().lower()
    return SCHEME + token if TOKEN_GRAMMAR.match(token) else None


async def _bytes(upload: UploadFile) -> bytes:
    content = await upload.read()
    if not content:
        raise RuntimeError_("empty_upload", "Send the page again and this reads it.", 400)
    if len(content) > settings.max_upload_bytes:
        raise RuntimeError_("too_large", "That photo is larger than this runtime accepts.", 413)
    return content


def _house_units(manifest: dict[str, Any]) -> list[str]:
    """The units this sheet itself prints. The house's own vocabulary, read off the house's own paper."""
    units: list[str] = []
    for page in manifest.get("pages", []):
        for block in page.get("blocks", []):
            for row in block.get("rows", []):
                unit = ((row.get("printed") or {}).get("unit") or "").strip()
                if unit and unit not in units:
                    units.append(unit)
    return units


@router.post("/api/paper/read")
async def read_paper(file: UploadFile = File(...)) -> JSONResponse:
    """A photograph of one of our sheets, read back against the geometry we recorded for it."""
    started = time.time()
    content = await _bytes(file)

    photo = cv2.imdecode(np.frombuffer(content, dtype=np.uint8), cv2.IMREAD_COLOR)
    if photo is None:
        raise RuntimeError_("bad_image", "Send the page as a JPEG or a PNG and this reads it.", 400)

    qr = register.decode_locator(photo)
    locator = _locator_of(qr.text) if qr else None
    if locator is None:
        raise RuntimeError_("paper_unknown",
                            "The code on the packing sheet names the page this reads. Photograph the "
                            "sheet with its code in the frame, or send the page to the document reader.",
                            422)
    token = locator[len(SCHEME):]

    manifest = store.get_manifest(token)
    if manifest is None:
        raise RuntimeError_("manifest_unknown",
                            "This runtime holds the packing sheets printed through it. Print the sheet "
                            "from the kit and its code reads back here.", 422)

    registration = register.register(photo, manifest, qr=qr)
    reader_word = handwriting.reader_word()
    if registration is None:
        # The mark said which sheet this is; the page itself would not lie flat. That is a real
        # answer — the document is identified and nothing was read — and it is what `matched: null`
        # is for. Nothing is invented to fill the gap.
        return JSONResponse({
            "locator": locator, "token": token, "matched": None, "pages": [],
            # ⚠ `marksFound` IS THE MARK ALONE ON THIS BRANCH, AND THAT IS STATED (E196.2's
            # verifier). Registration refused, so there is no count of corner squares to report —
            # the QR is the one mark that was certainly found, because it is what named this sheet.
            # It is honest for the page under test, which is printed without its squares; a page
            # refused by its own self-check AFTER three squares matched would under-report against
            # a contract that types marksFound as 0..4. What is owed is `register()` handing back
            # its count on the refusing path too, and THE-PAPER-SPEC PAP-09 carries that.
            "evidence": {"reader": reader_word, "ms": int((time.time() - started) * 1000), "marksFound": 1},
        })

    page, score, margin = register.choose_page(registration, manifest.get("pages", []))
    if page is None:
        return JSONResponse({
            "locator": locator, "token": token, "matched": None, "pages": [],
            "evidence": {"reader": reader_word, "ms": int((time.time() - started) * 1000),
                         "marksFound": registration.marks_found},
        })

    floor = register.page_floor(registration, page)
    observations = register.observe(registration, page, floor)

    thin_page = len(manifest.get("pages", [])) > 1 and margin < 0.05
    crops = [{"id": f"{o.sale}·{o.line}·{o.cell}", "png": o.crop_png, "context": o.context, "cell": o.cell}
             for o in observations if o.written]
    values: dict[str, dict[str, Any]] = {}
    if crops:
        page_png = register.encode_png(registration.page)
        values = await handwriting.read_cells(page_png, crops, house_units=_house_units(manifest))

    readings = []
    for observation in observations:
        answer = values.get(f"{observation.sale}·{observation.line}·{observation.cell}") or {}
        checks = [c for c in (observation.check, answer.get("check")) if c]
        if thin_page:
            checks.append("the page was identified from its printed values and a second page scored close")
        confidence = observation.confidence if not observation.written else float(answer.get("confidence") or 0.0)
        if observation.written:
            confidence *= registration.confidence_scale
        if thin_page:
            confidence *= 0.85
        readings.append({
            "sale": observation.sale, "line": observation.line, "cell": observation.cell,
            "written": observation.written,
            "value": answer.get("value") if observation.written else None,
            "confidence": round(max(0.0, min(1.0, confidence)), 3),
            "crop": register.data_uri(observation.crop_png),
            "check": " · ".join(checks) if checks else None,
        })

    sales = list(dict.fromkeys(block.get("sale") for block in page.get("blocks", []) if block.get("sale")))
    body: dict[str, Any] = {
        "locator": locator, "token": token,
        "matched": {"day": manifest.get("day"), "sales": sales},
        "pages": [{"index": int(page.get("index") or 0), "quality": registration.quality, "readings": readings}],
        "evidence": {"reader": reader_word, "ms": int((time.time() - started) * 1000),
                     "marksFound": registration.marks_found},
    }
    if len(manifest.get("pages", [])) > 1:
        # Additive, and named here so it is not mistaken for drift (the move RUN-02 already makes
        # for `code` and `header`): with several pages under one token, WHICH page was read is a
        # fact the answer has to carry, along with how clear the choice was.
        body["evidence"]["page"] = {"index": int(page.get("index") or 0), "score": score, "margin": margin}

    logger.info("paper read", extra={
        "provider": handwriting.selected_reader(), "route": "/api/paper/read",
        "ms": int((time.time() - started) * 1000),
        "outcome": (f"{registration.marks_found} marks · {len(readings)} cells · "
                    f"{sum(1 for r in readings if r['written'])} written · road {registration.qr.road}")})
    return JSONResponse(body)
