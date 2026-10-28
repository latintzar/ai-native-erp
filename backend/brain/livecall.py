"""Live in-call order draft (Stage 7) — the same read→match→decide, throttled + cheap.

A per-active-call ~5s loop reads the transcript-so-far with a CHEAP model (Haiku) as if an
ever-growing voice note arrived, runs the same matcher + keep-in-mind bands, and upserts a live
order draft onto the calls row — only when the grounded order actually changes. Location is enriched
once. Heavy Sonnet synth/decision is deliberately NOT in this frequent loop.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict, List, Optional

import config
import db
from brain import enrich, keepinmind, llm, matcher, prompts

log = logging.getLogger("rocoto.brain.livecall")

_LIVE_PRIMING = (
    "SCALE: LIVE PHONE CALL (an ever-growing transcript). Read the order the CALLER is placing so "
    "far, in their own words — items, quantities, units. Apply in-speech self-corrections (last "
    "value wins: 'five, no, eight kilos' = 8). Ignore the operator's side and chit-chat. If no order "
    "has been stated yet, return is_order=false with no items."
)


def _transcript_text(lines: List[Dict[str, Any]]) -> str:
    out = []
    for l in lines or []:
        who = "us" if l.get("speaker") == 1 else "caller"
        t = (l.get("text") or "").strip()
        if t:
            out.append(f"{who}: {t}")
    return "\n".join(out)


async def _read(text: str) -> List[Dict[str, Any]]:
    user = f"{_LIVE_PRIMING}\n\nTRANSCRIPT SO FAR:\n{text}"
    out = await llm.call_tool(config.LIVECALL_MODEL, prompts.READER_SYSTEM, user,
                              prompts.READER_TOOL, "report_read", max_tokens=1024,
                              fallback=config.ORDER_EXTRACT_FALLBACK_MODEL)
    return (out or {}).get("items") or []


async def build_draft(call: Dict[str, Any], tenant: str) -> Optional[Dict[str, Any]]:
    text = _transcript_text(call.get("lines") or [])
    if len(text) < 12:
        return None
    items = await _read(text)
    if not items:
        return None
    phone = call.get("phone_number")
    grounded: List[Dict[str, Any]] = []
    for it in items:
        mention = (it.get("mention") or "").strip()
        if not mention:
            continue
        # WP-2.5 rehearsal find: thread the tenant (the BRAIN_TENANT default grounds wrong post-golive).
        m = await matcher.match(mention, phone=phone, tenant=tenant,
                                unit_hint=it.get("unit"), qty=it.get("qty"))
        pick = m.pick or {}
        flags = {"unit_ok": m.unit_ok, "unit_note": m.unit_note,
                 "variable_weight": pick.get("variable_weight")}
        attention, kim = keepinmind.decide_band(m.as_dict(), flags, None, pick.get("sku_id"))
        grounded.append({
            "mention": mention, "sku_id": pick.get("sku_id"),
            "code": pick.get("code"),   # the supplier's own article code (WP-3) — separate from sku_id
            "name": pick.get("name") or mention, "qty": it.get("qty"),
            "unit": it.get("unit") or pick.get("base_unit") or "",
            "price": pick.get("price"), "attention": attention, "keep_in_mind": kim,
        })
    if not grounded:
        return None
    return {"lines": grounded, "transcript_chars": len(text)}


def _key(draft: Dict[str, Any]) -> Any:
    return tuple((l.get("sku_id"), l.get("qty"), l.get("unit")) for l in (draft or {}).get("lines") or [])


async def tick(call: Dict[str, Any], tenant: str) -> None:
    cid = call.get("id")
    # location once
    loc = call.get("location") or {}
    if not loc.get("lat"):
        newloc = await enrich.enrich_location(call.get("phone_number"), tenant)
        if newloc.get("lat"):
            await db.call_update(cid, {"location": newloc})
            call["location"] = newloc
    # order draft only when the grounded order changed
    try:
        draft = await build_draft(call, tenant)
    except Exception:
        log.exception("livecall draft failed call=%s", cid)
        return
    if draft and _key(draft) != _key(call.get("order_draft") or {}):
        await db.call_update(cid, {"order_draft": draft})
        log.info("live draft updated call=%s lines=%d", cid, len(draft["lines"]))


_started = False


async def live_call_loop(poll_seconds: float = 5.0) -> None:
    global _started
    if _started:
        return
    _started = True
    log.info("live-call updater started (poll=%.1fs)", poll_seconds)
    while True:
        try:
            for call in await db.call_active():
                await tick(call, config.BRAIN_TENANT)
        except Exception:
            log.exception("live-call loop tick failed")
        await asyncio.sleep(poll_seconds)
