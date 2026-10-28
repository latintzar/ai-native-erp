"""THE HANDWRITING SEAM — what the pen wrote, and how sure we are (PAR-10.5).

Registration (register.py) answers WHERE every box is and WHETHER somebody wrote in it. This file
answers the last question, WHAT, and it is the only place in the runtime that shows a person's
handwriting to a model.

⚠ WHY A SEAM AND NOT A CALL. Two readers are implemented behind one function:

    gemini     · generativelanguage v1beta, `gemini-2.5-flash`. The default, because it is the one
                 proven answering from this box today.
    anthropic  · the messages API, `claude-fable-5-1`, image content blocks. Implemented in full and
                 unit-tested against a recorded answer — the key answers and holds no credit today,
                 so the suite proves the SHAPING (which is the half that breaks when someone edits
                 this repo) and the live half waits for credit rather than being pretended.

`HANDWRITING_READER` picks between them and the default is gemini. Neither name appears anywhere
else in the service.

TWO LOOKS, AND THEY ARE ASKED SEPARATELY. One request carries every crop on the page, each labelled
with its own id — a reader that sees the whole page's hand at once is a better reader of any one
cell on it. A second request carries the WHOLE rectified page and asks the same ids again, where the
row's product name and the printed quantity stand beside the box. Where the two agree the answer is
worth more than either; where they disagree the confidence drops and `check` says what was seen, in
both readings' own words. A number nobody can check is worse than a number that says it is unsure.

Nothing is retained. The crops exist for the length of one request, the prompt carries no customer
name beyond the row's own product word, and the journal records counts and milliseconds — never a
value, never an image.
"""
from __future__ import annotations

import asyncio
import base64
import json
import logging
import re
import time
import unicodedata
from typing import Any, Iterable, Sequence

import httpx

from .config import settings
from .errors import RuntimeError_

logger = logging.getLogger("rocoto.runtime.handwriting")

READERS = ("gemini", "anthropic")

MODEL_WORD = {"gemini": "gemini-2.5-flash", "anthropic": "claude"}
"""What `evidence.reader` says with the readers configured as they ship. The contract names these two
words and this is the only place they are minted, so the answer and the contract cannot drift apart."""


def reader_word(reader: str | None = None) -> str:
    """THE MODEL THAT ACTUALLY READ, named.

    `GEMINI_MODEL` exists so a box can be pointed at another model — a smaller one on a day the
    default's quota is spent, a newer one the week it lands. Evidence that kept saying
    «gemini-2.5-flash» while another model did the reading would be a false line in the one field a
    person consults to decide whether to trust a number, so the word follows the configuration. With
    the default model configured it is the contract's own word, exactly.
    """
    chosen = reader or selected_reader()
    if chosen == "gemini":
        return (settings.gemini_model or MODEL_WORD["gemini"]).strip()
    return MODEL_WORD["anthropic"]

NUMBER_CELLS = ("finalWeight", "qty")

# The trade's own starter words (product-creation.tsx `UNIT_OPTIONS`) — offered beside whatever the
# house already prints, never instead of it. The manifest's own printed units always lead.
STARTER_UNITS = ("kg", "g", "l", "ml", "caja", "pieza", "bandeja", "saco", "manojo", "bote", "ud", "unidad")

INSTRUCTION = (
    "You are reading handwriting on a printed delivery note. Each image is one small box from that "
    "note, labelled with an id. For each id, report exactly what is handwritten in that box.\n"
    "Rules:\n"
    "- Report the handwriting alone. Printed text that was already on the paper is context, not an answer.\n"
    "- A number keeps its digits exactly as written. Read a comma as a decimal point: 12,5 is 12.5.\n"
    "- Where a box holds two numbers and one of them has a line drawn through it, the answer is the "
    "number WITHOUT the line. A crossed-out number is the one the person decided against; report the "
    "one they wrote instead, and report it alone.\n"
    "- Report a value only when you can see it. Where the writing is unclear, give your best reading "
    "and a low confidence.\n"
    "- confidence is 0.0 to 1.0 and states how certain the reading is.\n"
    "Answer with JSON alone, in this shape: "
    '{"cells": {"<id>": {"value": "<what is written>", "confidence": 0.0}}}'
)

PAGE_INSTRUCTION = (
    "You are reading handwriting on a printed delivery note. The image is the whole page. For each "
    "id below, the box is described by its row and the value printed in it; report what is "
    "HANDWRITTEN in that box.\n"
    "Rules:\n"
    "- Report the handwriting alone. The printed value is context, not an answer.\n"
    "- A number keeps its digits exactly as written. Read a comma as a decimal point: 12,5 is 12.5.\n"
    "- Where a box holds two numbers and one of them has a line drawn through it, the answer is the "
    "number WITHOUT the line. A crossed-out number is the one the person decided against; report the "
    "one they wrote instead, and report it alone.\n"
    "- confidence is 0.0 to 1.0 and states how certain the reading is.\n"
    "Answer with JSON alone, in this shape: "
    '{"cells": {"<id>": {"value": "<what is written>", "confidence": 0.0}}}'
)


# ── NORMALISING WHAT CAME BACK ──────────────────────────────────────────────────────────────

def _flat(text: str) -> str:
    stripped = unicodedata.normalize("NFKD", str(text or "").strip().lower())
    return "".join(c for c in stripped if not unicodedata.combining(c))


def normalise_number(said: str) -> str | None:
    """A written amount as a plain decimal, or nothing at all.

    A hand writes «12,5», «12.5», «12,5 kg» and «kg 12,5», and every one of them is twelve and a
    half. It also writes things that are not amounts, and those come back as nothing rather than as
    a guess — §PAR-03.4's rule, one field down.
    """
    text = str(said or "").strip().replace(" ", " ")
    if not text:
        return None
    match = re.search(r"-?\d{1,3}(?:[ .]\d{3})*(?:[.,]\d+)?|-?\d+(?:[.,]\d+)?", text)
    if not match:
        return None
    raw = match.group(0)
    if "," in raw:
        raw = raw.replace(".", "").replace(" ", "").replace(",", ".")
    else:
        raw = raw.replace(" ", "")
        if raw.count(".") > 1:
            head, _, tail = raw.rpartition(".")
            raw = head.replace(".", "") + "." + tail
    try:
        value = float(raw)
    except ValueError:
        return None
    if value.is_integer() and "." not in raw:
        return str(int(value))
    return ("%.4f" % value).rstrip("0").rstrip(".")


def normalise_unit(said: str, house_units: Sequence[str]) -> tuple[str | None, str | None]:
    """A written unit as one of the house's own words, and a note when it is a word the house is new to."""
    text = str(said or "").strip()
    if not text:
        return None, None
    flat = _flat(text)
    known = list(dict.fromkeys([*house_units, *STARTER_UNITS]))
    for unit in known:
        if _flat(unit) == flat:
            return unit, None
    for unit in known:                      # «cajas» for «caja», «kgs» for «kg»
        base = _flat(unit)
        if base and (flat.rstrip("s") == base.rstrip("s")):
            return unit, None
    return text, f"the hand wrote «{text}»; this sheet prints {' · '.join(known[:6])}"


def _parse_json(body: str) -> dict[str, Any]:
    """The model's answer, read strictly — and read anyway when it wrapped the JSON in a fence."""
    text = (body or "").strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\s*|\s*```$", "", text).strip()
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        start, end = text.find("{"), text.rfind("}")
        if start < 0 or end <= start:
            return {}
        try:
            parsed = json.loads(text[start:end + 1])
        except json.JSONDecodeError:
            return {}
    cells = parsed.get("cells") if isinstance(parsed, dict) else None
    return cells if isinstance(cells, dict) else {}


def _reading(entry: Any) -> tuple[str | None, float]:
    if isinstance(entry, dict):
        value = entry.get("value")
        try:
            confidence = float(entry.get("confidence", 0.5))
        except (TypeError, ValueError):
            confidence = 0.5
        return (None if value in (None, "") else str(value)), max(0.0, min(1.0, confidence))
    if entry in (None, ""):
        return None, 0.0
    return str(entry), 0.5


# ── THE TWO PROVIDERS ───────────────────────────────────────────────────────────────────────

def selected_reader() -> str:
    reader = settings.handwriting_reader
    return reader if reader in READERS else "gemini"


def _key(reader: str) -> str:
    key = settings.gemini_key if reader == "gemini" else settings.anthropic_key
    if not key:
        raise RuntimeError_("handwriting_missing",
                            f"The handwriting reader ({reader}) runs on a key this process is started "
                            f"with; set it in the service environment and the read completes.", 503)
    return key


async def _ask_gemini(prompt: str, images: list[tuple[str, bytes]]) -> dict[str, Any]:
    parts: list[dict[str, Any]] = [{"text": prompt}]
    for label, png in images:
        parts.append({"text": label})
        parts.append({"inline_data": {"mime_type": "image/png", "data": base64.b64encode(png).decode("ascii")}})
    url = f"{settings.gemini_url}/{settings.gemini_model}:generateContent"
    body = {"contents": [{"role": "user", "parts": parts}],
            "generationConfig": {"temperature": 0, "responseMimeType": "application/json"}}
    async with httpx.AsyncClient(timeout=httpx.Timeout(30.0, read=settings.handwriting_timeout_seconds)) as client:
        response = await client.post(url, headers={"x-goog-api-key": _key("gemini"),
                                                   "Content-Type": "application/json"}, json=body)
    if response.status_code >= 400:
        raise RuntimeError_("handwriting_failed", f"The handwriting reader answered {response.status_code}.", 502)
    payload = response.json()
    candidates = payload.get("candidates") or []
    if not candidates:
        raise RuntimeError_("handwriting_failed",
                            "The handwriting reader answered with an empty body; ask again and this reads.",
                            502)
    chunks = [p.get("text", "") for p in (candidates[0].get("content", {}).get("parts") or []) if isinstance(p, dict)]
    return _parse_json("".join(chunks))


async def _ask_anthropic(prompt: str, images: list[tuple[str, bytes]]) -> dict[str, Any]:
    content: list[dict[str, Any]] = [{"type": "text", "text": prompt}]
    for label, png in images:
        content.append({"type": "text", "text": label})
        content.append({"type": "image", "source": {"type": "base64", "media_type": "image/png",
                                                    "data": base64.b64encode(png).decode("ascii")}})
    body = {"model": settings.anthropic_model, "max_tokens": 4096, "temperature": 0,
            "messages": [{"role": "user", "content": content}]}
    async with httpx.AsyncClient(timeout=httpx.Timeout(30.0, read=settings.handwriting_timeout_seconds)) as client:
        response = await client.post(settings.anthropic_url,
                                     headers={"x-api-key": _key("anthropic"), "anthropic-version": "2023-06-01",
                                              "Content-Type": "application/json"}, json=body)
    if response.status_code >= 400:
        raise RuntimeError_("handwriting_failed", f"The handwriting reader answered {response.status_code}.", 502)
    payload = response.json()
    blocks = payload.get("content") or []
    text = "".join(b.get("text", "") for b in blocks if isinstance(b, dict) and b.get("type") == "text")
    if not text:
        raise RuntimeError_("handwriting_failed",
                            "The handwriting reader answered with an empty body; ask again and this reads.",
                            502)
    return _parse_json(text)


RETRY_STATUSES = (429, 500, 502, 503, 504)
RETRY_BACKOFF_SECONDS = 4.0


async def _ask(reader: str, prompt: str, images: list[tuple[str, bytes]]) -> dict[str, Any]:
    """Ask once, and ask a second time when the answer was «ask again».

    A rate limit is transient by definition — measured live on this box, a per-minute quota turned a
    complete read into a 502 one second in — and so are the 5xx a hosted model occasionally returns.
    ONE retry, after a pause, because a read that fails twice four seconds apart has failed. Every
    other status stands as it came: a wrong key or a spent balance is an answer, not a hiccup, and
    hammering it would only spend the wait.
    """
    try:
        return await (_ask_gemini(prompt, images) if reader == "gemini" else _ask_anthropic(prompt, images))
    except RuntimeError_ as first:
        if first.code != "handwriting_failed" or not any(str(s) in first.message for s in RETRY_STATUSES):
            raise
        logger.info("handwriting retry", extra={"provider": reader, "outcome": "asked again"})
        await asyncio.sleep(RETRY_BACKOFF_SECONDS)
        return await (_ask_gemini(prompt, images) if reader == "gemini" else _ask_anthropic(prompt, images))


# ── THE SEAM ────────────────────────────────────────────────────────────────────────────────

async def read_cells(page_png: bytes, crops: Sequence[dict[str, Any]], *,
                     house_units: Iterable[str] = ()) -> dict[str, dict[str, Any]]:
    """Read every crop on one page, cross-check it against the whole page, and say how sure it is.

    `crops` is `[{id, png, context, cell}]` — `context` is the row in words (its product and the
    value printed in the box) and `cell` says which column it is, so a number cell comes back a
    number and a unit cell comes back one of the house's units.

    The answer is `{id: {value, confidence, check}}`. `check` is additive to the contract's `{value,
    confidence}` and it is the point of the cross-check: it names a disagreement in both readings'
    own words, so the person deciding sees what the machine saw.
    """
    if not crops:
        return {}
    reader = selected_reader()
    started = time.time()

    labelled = [(f"id: {c['id']} — {c.get('context', '')}", c["png"]) for c in crops]
    crop_answer = await _ask(reader, INSTRUCTION, labelled)
    if not any(str(c["id"]) in crop_answer for c in crops):
        # ⚠ AN ANSWER THAT NAMES NONE OF THE BOXES IS A FAILED READ, NOT NINETEEN BLANK BOXES.
        # Measured on the E196.5 harness: one model answered 200 twice with no JSON in it at all —
        # thinking had spent the response — and every cell came back «written, value null», which
        # reads on the surface as «the pen was illegible» nineteen times over. That is the worst
        # kind of wrong answer, because it looks like an answer. The read says its own name instead.
        raise RuntimeError_("handwriting_failed",
                            "The handwriting reader's answer arrived unusable. Send the photo again "
                            "and this reads it.", 502)

    lines = "\n".join(f"- {c['id']}: {c.get('context', '')}" for c in crops)
    page_answer: dict[str, Any] = {}
    if page_png:
        try:
            page_answer = await _ask(reader, f"{PAGE_INSTRUCTION}\n\nThe boxes:\n{lines}",
                                     [("the whole page", page_png)])
        except RuntimeError_ as exc:
            # THE CROSS-CHECK IS A SECOND OPINION, NOT A GATE. A page read that fails leaves the
            # crop read standing, with less confidence and a check that says the second look is
            # missing — losing the whole answer because the belt broke would be the worse trade.
            logger.warning("page cross-check unavailable: %s", exc.message,
                           extra={"provider": reader, "outcome": exc.code})

    units = [u for u in house_units if u]
    out: dict[str, dict[str, Any]] = {}
    agreed = disagreed = 0
    for crop in crops:
        cid = str(crop["id"])
        cell = str(crop.get("cell") or "")
        crop_value, crop_confidence = _reading(crop_answer.get(cid))
        page_value, page_confidence = _reading(page_answer.get(cid)) if page_answer else (None, 0.0)

        note: str | None = None
        if cell in NUMBER_CELLS:
            said = normalise_number(crop_value) if crop_value is not None else None
            other = normalise_number(page_value) if page_value is not None else None
            if crop_value is not None and said is None:
                note = f"the reader saw «{crop_value}»; this box takes an amount"
        else:
            said, unit_note = normalise_unit(crop_value, units) if crop_value is not None else (None, None)
            other, _ = normalise_unit(page_value, units) if page_value is not None else (None, None)
            note = unit_note

        if said is None:
            confidence = round(crop_confidence * 0.5, 3)
        elif not page_answer:
            confidence = round(crop_confidence * 0.85, 3)
            note = note or "read from the box alone; a second look at the whole page would confirm it"
        elif other is None:
            confidence = round(crop_confidence * 0.8, 3)
            note = note or "read from the box; the whole-page look answered for the other boxes"
        elif said == other:
            agreed += 1
            confidence = round(min(1.0, (crop_confidence + page_confidence) / 2 + 0.15), 3)
        else:
            disagreed += 1
            confidence = round(min(crop_confidence, page_confidence) * 0.5, 3)
            note = f"the box reads «{said}» and the whole page reads «{other}»"

        out[cid] = {"value": said, "confidence": confidence, "check": note}

    logger.info("handwriting read", extra={"provider": reader, "ms": int((time.time() - started) * 1000),
                                           "outcome": f"{len(crops)} cells · {agreed} agreed · {disagreed} disagreed"})
    return out
