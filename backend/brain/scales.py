"""Five parallel Haiku scale-readers (Register #18/#23).

Each reads the SAME current message through its window + positive priming, concurrently. Their reads
feed the synthesiser. Cheap (Haiku) and concurrent, so the 5 reads add little wall-clock.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict, List

import config
from brain import llm, prompts

log = logging.getLogger("rocoto.brain.scales")

SCALES = ["today", "3day", "week", "month", "always"]


def _user_for(scale: str, ctx: Dict[str, Any]) -> str:
    today = ctx["today_text"]
    parts = [f"TODAY IS {ctx.get('today_date','')}.", prompts.SCALE_PRIMING[scale], "",
             f"CURRENT MESSAGE:\n{today}", ""]
    if scale == "today":
        pass
    elif scale in ("3day", "week", "month"):
        parts += [f"HISTORY ({scale}):\n{ctx['windows'].get(scale, '')}"]
    elif scale == "always":
        parts += [f"CUSTOMER PROFILE:\n{ctx['profile_text']}", "",
                  f"RECENT ORDERS:\n{ctx['recent_orders_text']}"]
    return "\n".join(parts)


async def _read(scale: str, ctx: Dict[str, Any]) -> Dict[str, Any]:
    try:
        out = await llm.call_tool(
            config.SCALE_READER_MODEL, prompts.READER_SYSTEM, _user_for(scale, ctx),
            prompts.READER_TOOL, "report_read", max_tokens=1024,
            fallback=config.ORDER_EXTRACT_FALLBACK_MODEL)
        out = out or {"is_order": False, "items": []}
    except Exception:
        log.exception("scale read failed: %s", scale)
        out = {"is_order": False, "items": [], "error": True}
    out["scale"] = scale
    return out


async def read_all(ctx: Dict[str, Any]) -> List[Dict[str, Any]]:
    return await asyncio.gather(*[_read(s, ctx) for s in SCALES])
