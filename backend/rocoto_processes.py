"""rocoto_processes.py — APP-side fabric registrations (kernel-boundary pass, 2026-07-22).

The KERNEL owns the fabric CATEGORY (voice_fabric.register); the APP registers its instances here —
order_brain is Rocoto's commerce reflex, so its trigger/run (which import the commerce stack) live on
the app side of the boundary. Imported once at app startup. Adding an app process = one register().
"""
import logging
from typing import Optional

import voice_fabric

log = logging.getLogger("rocoto.processes")

import triggers as _triggers

_ORDERISH = _triggers.ORDERISH


def _order_trigger(scope: str, utterance: str, ctx: dict) -> bool:
    lc = ctx.get("lifecycle") or {}
    return bool(lc.get("has_catalogue")) and bool(_ORDERISH.search(utterance or "")) and len(utterance or "") > 15


async def _order_run(scope: str, utterance: str, ctx: dict, **kw) -> Optional[dict]:
    """Order-brain as a fabric process: grounded draft in the background; the say carries the LINE
    PLAYBACK + unmatched — NEVER a figure (totals stay data for the gated place step, so the rejoin
    gate stays clean and no money is voiced from a draft)."""
    import orders_tool
    sheet = await orders_tool.draft_order(scope, utterance)
    lines = sheet.get("lines") or []
    unmatched = sheet.get("unmatched") or []
    if not lines and not unmatched:
        return None
    parts = []
    if lines:
        parts.append("te confirmo el pedido: " + ", ".join(
            f"{l.get('qty')} {l.get('unit') or ''} de {l.get('name')}".strip() for l in lines[:6]))
    for u in unmatched[:3]:
        parts.append(f"«{u.get('mention')}» no lo encuentro en tu lista — ¿cómo lo llamáis exactamente?")
    # THE LEARNING LOOP ON LIVE CALLS (learn.py, Peter 2026-07-22): clear-but-unfamiliar mentions open
    # the «aprender» tabs so reconcile() can close the loop when the order is confirmed — same
    # categorisation as the voice-note path. (Live-call ASR is EL's — no word-confidence signal — but
    # opening a learning tab + asking is safe; ACTING on money stays boss-gated regardless.)
    if unmatched:
        try:
            import re as _re

            import learn as _learn
            digits = _re.sub(r"[^0-9]", "", scope)
            if digits:
                await _learn.gate_audio_order(f"+{digits}", utterance,
                                              {"review": False},
                                              [str(u.get("mention") or "") for u in unmatched if u.get("mention")])
        except Exception:
            log.debug("voice_fabric: learning-tab open fail-soft", exc_info=True)
    return {"say": "; ".join(parts), "fold": {"order_draft": {"n_lines": len(lines),
                                                              "n_unmatched": len(unmatched),
                                                              "total": sheet.get("total")}},
            "money": True}   # belt: the rejoin gate re-checks the say even though it carries no figure

voice_fabric.register("order_brain", trigger=_order_trigger, run=_order_run, expected_ms=4000, stall="hum")
