"""Keep-in-mind bands (Register #16, #20, RUNTIME L4) — the three attention levels.

Computed DETERMINISTICALLY from hard signals (match band, margin, validators), never the model's
self-confidence. The decision agent's wording is folded in when present; otherwise we compose a
gentle, boss-tone note. Three levels:
  clean      — sure: fill, no note.
  note       — sensible-but-unusual / best-guess / a caveat: fill + a friendly yellow note.
  underline  — genuinely unsure / possible new SKU / validator fail: fill best + underline for edit.
"""
from __future__ import annotations

from typing import Any, Dict, Optional, Tuple

_RANK = {"clean": 0, "note": 1, "underline": 2}


def _bump(cur: str, to: str) -> str:
    return to if _RANK[to] > _RANK[cur] else cur


def decide_band(match: Dict[str, Any], flags: Dict[str, Any], llm_note: Optional[str],
                chosen_sku: Optional[str]) -> Tuple[str, str]:
    attention = "clean"
    notes = []

    band = match.get("band", "unsure")
    runner = match.get("runner_up") or {}

    if not chosen_sku or match.get("abstain") or band == "unsure":
        attention = _bump(attention, "underline")
        notes.append("not sure this is in the catalogue — possible new product, please check")
    elif band == "note":
        attention = _bump(attention, "note")

    if match.get("tight") and runner.get("name"):
        attention = _bump(attention, "note")
        notes.append(f"could also be {runner['name']} — went with the best match")

    if not flags.get("unit_ok") and flags.get("unit_note"):
        attention = _bump(attention, "note")
        notes.append(flags["unit_note"])
    elif flags.get("variable_weight"):
        notes.append("variable weight — exact kg confirmed at dispatch")  # informational, stays clean

    if flags.get("qty_off_norm") and flags.get("typical_qty"):
        attention = _bump(attention, "note")
        notes.append(f"unusual quantity — usually around {flags['typical_qty']}")

    # the decision agent's own wording leads if present
    final = []
    if llm_note:
        final.append(llm_note.strip())
    for n in notes:
        if n and n not in final:
            final.append(n)
    return attention, " · ".join(final)


def confidence_for(attention: str) -> str:
    return {"clean": "high", "note": "medium", "underline": "low"}.get(attention, "medium")
