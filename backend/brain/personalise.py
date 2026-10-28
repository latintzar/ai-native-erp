"""Personalisation pass (Sonnet, Register #19) — the human touch, last.

Folds this customer's usual personalisations into a brief operator-facing order note (+ optional
per-line notes). Never changes products or quantities. No-ops gracefully on a thin/empty profile.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Tuple

import config
from brain import llm, prompts

log = logging.getLogger("rocoto.brain.personalise")


async def personalise(lines: List[Dict[str, Any]], order_note: str,
                      ctx: Dict[str, Any]) -> Tuple[str, List[Dict[str, Any]]]:
    prof = ctx.get("profile") or {}
    usual = prof.get("usual_personalisations") or []
    narrative = prof.get("narrative") or ""
    # nothing personal known yet -> keep what we have, don't spend a model call
    if not usual and not narrative:
        return order_note, lines

    summary = "\n".join(f"{ln.get('qty')}{ln.get('unit')} {ln.get('name')}" for ln in lines)
    user = "\n".join([
        f"ORDER:\n{summary}",
        "",
        f"CUSTOMER usual personalisations: {usual}",
        f"CUSTOMER notes: {narrative[:500]}",
        f"Existing order note: {order_note or '(none)'}",
    ])
    try:
        out = await llm.call_tool(
            config.PERSONALISE_MODEL, prompts.PERSONALISE_SYSTEM, user, prompts.PERSONALISE_TOOL,
            "personalise_order", max_tokens=512, fallback=config.ORDER_EXTRACT_FALLBACK_MODEL)
    except Exception:
        log.exception("personalise failed")
        out = None
    if not out:
        return order_note, lines

    new_note = out.get("order_note") or order_note
    for ln_note in out.get("line_notes") or []:
        i = ln_note.get("index")
        if isinstance(i, int) and 0 <= i < len(lines) and ln_note.get("note"):
            extra = ln_note["note"].strip()
            base = lines[i].get("note", "")
            lines[i]["note"] = (base + " · " + extra).strip(" ·") if base else extra
    return new_note, lines
