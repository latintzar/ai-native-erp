"""Anthropic tool-call helper for the brain agents (mirrors orders.extract_order_sync).

Forces a single tool call (structured output), with a 529/overload fallback model.
Sampling follows the pinned SDK/model defaults; the SDK has no temperature parameter.
Sync core (CPU/network bound) + async wrapper so the pipeline can fan out readers concurrently.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict, Optional

import anthropic

import config
import mindcheck as _mind

log = logging.getLogger("rocoto.brain.llm")

_RETRYABLE = {429, 500, 503, 529}


def _client() -> "anthropic.Anthropic":
    return anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY, max_retries=6, timeout=60.0)


def call_tool_sync(model: str, system: str, user: str, tool: Dict[str, Any], tool_name: str,
                   *, max_tokens: int = 2048, fallback: Optional[str] = None) -> Optional[Dict[str, Any]]:
    client = _client()

    def _try(m: str) -> Optional[Dict[str, Any]]:
        msg = client.messages.create(
            model=m, max_tokens=max_tokens, system=system,
            tools=[tool], tool_choice={"type": "tool", "name": tool_name},
            messages=[{"role": "user", "content": user}],
        )
        for block in msg.content:
            if getattr(block, "type", None) == "tool_use" and block.name == tool_name:
                return dict(block.input)
        return None

    # Every call reports its outcome to `mindcheck`, which is what lets /healthz answer "can the mind
    # actually think?" for free, off real traffic, instead of the box looking healthy while the one
    # faculty the product IS returns 400 on every call (the 2026-07-27 credit outage).
    try:
        out = _try(model)
        _mind.note_ok()
        return out
    except anthropic.APIStatusError as e:
        _mind.note_fail(e)
        if fallback and getattr(e, "status_code", None) in _RETRYABLE:
            log.warning("model %s -> %s on %s", model, fallback, getattr(e, "status_code", "?"))
            out = _try(fallback)
            _mind.note_ok()
            return out
        raise


async def call_tool(model: str, system: str, user: str, tool: Dict[str, Any], tool_name: str,
                    *, max_tokens: int = 2048, fallback: Optional[str] = None) -> Optional[Dict[str, Any]]:
    return await asyncio.to_thread(
        call_tool_sync, model, system, user, tool, tool_name, max_tokens=max_tokens, fallback=fallback)
