"""Deterministic junk gate (Register #6, risk #7) — NO model.

Load-bearing rule: kill ONLY clearly zero-content messages (a sticker, a bare "thanks"). ANY doubt
→ let it through to the read (a buried order must never be dropped). Media always passes (a photo
or voice note can be the whole order). Urgency cues are detected here too (short-circuit debounce).
"""
from __future__ import annotations

import re
import unicodedata
from typing import Tuple

# Pure pleasantries / acks — only junk when the WHOLE message is one of these (no digits, short).
_PLEASANTRIES = {
    # English
    "thanks", "thank you", "thx", "ty", "ok", "okay", "okey", "k", "kk", "cool", "great", "perfect",
    "hi", "hello", "hey", "good morning", "good afternoon", "good evening", "yes", "no", "yep", "nope",
    "got it", "sure", "fine", "nice", "lol", "haha", "bye", "see you", "cheers", "morning",
    # Spanish (customers code-switch)
    "gracias", "muchas gracias", "vale", "ok gracias", "hola", "buenas", "buenos dias",
    "buenas tardes", "buenas noches", "si", "perfecto", "genial", "guay", "adios",
    "hasta luego", "de acuerdo", "muy bien", "bien", "claro",
}

# Order/urgency-relevant tokens that veto junk even inside a short message.
_ORDER_HINT = re.compile(
    r"\b(kg|kilo|kilos|caja|cajas|case|cases|pack|ud|uds|unit|units|pcs|"
    r"order|pedido|need|necesito|quiero|want|send|manda|envia|deliver|entrega|"
    r"chorizo|sausage|belly|ribs|chops|bacon|ears|trotters|crackling|loin|tenderloin|"
    r"morcilla|panceta|salchich|costilla|chuleta|lomo|solomillo|fuet|seasoning)\b",
    re.IGNORECASE,
)

_URGENT = re.compile(
    r"\b(asap|urgent|urgente|ya|ahora|ahora mismo|r+ush|rush|now|today|hoy|cuanto antes|"
    r"emergency|emergencia|right now|immediately|inmediato)\b",
    re.IGNORECASE,
)


def _norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "")
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", s.lower()).strip()


def is_urgent(text: str) -> bool:
    return bool(_URGENT.search(text or ""))


def is_junk(text: str, has_media: bool = False) -> Tuple[bool, str]:
    """Return (is_junk, reason). Conservative: only zero-content text with no media is junk."""
    if has_media:
        return False, ""
    raw = (text or "").strip()
    if not raw:
        return True, "empty"
    if _ORDER_HINT.search(raw):
        return False, ""
    n = _norm(raw)
    # strip trailing punctuation/emoji for the pleasantry check
    stripped = re.sub(r"[^a-z0-9 ]", "", n).strip()
    if not stripped:
        return True, "emoji/sticker only"
    if stripped in _PLEASANTRIES:
        return True, "pleasantry"
    # very short + no letters/digits of substance and no order hint → junk
    if len(stripped) <= 3 and not any(ch.isdigit() for ch in stripped):
        return True, "too short, no content"
    return False, ""
