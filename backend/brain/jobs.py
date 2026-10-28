"""Background drainer for the durable ingest queue (Stage 3).

A single async loop claims one DUE PHONE's coalesced burst at a time and runs the pipeline. Failures
retry with backoff and dead-letter (queue.py); a crash mid-burst is recovered by reset_stuck() on
the next startup. Throughput: drains back-to-back while phones are due, sleeps only when idle.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict, Optional

from brain import pipeline, queue

log = logging.getLogger("rocoto.brain.jobs")
_started = False


async def drain_once() -> Optional[Dict[str, Any]]:
    """Process one due phone's burst. Returns a small result dict, or None if nothing was due.

    MULTI-TENANT SINCE 2026-07-27: the claim returns the row's OWN tenant and it is handed to the
    pipeline, so the burst is matched against the catalogue of the distributor the message was
    actually sent to. Before, both sides defaulted to BRAIN_TENANT and a second tenant's customer
    was grounded against the FIRST tenant's SKUs."""
    claim = await queue.claim_due_phone()
    if not claim:
        return None
    tenant, phone, ids = claim
    try:
        order = await pipeline.run_burst(phone, ids, tenant=tenant)
        if order is pipeline.REQUEUED:
            # paused on a transcription — the requeue handles retry; do NOT mark these done
            return {"tenant": tenant, "phone": phone, "requeued": True}
        await queue.mark_done(ids)
        return {"tenant": tenant, "phone": phone, "message_ids": ids,
                "order_id": (order or {}).get("id") if isinstance(order, dict) else None}
    except Exception as e:  # never silently drop — retry/backoff/dead-letter
        log.exception("burst failed tenant=%s phone=%s", tenant, phone)
        await queue.mark_failed(ids, str(e))
        return {"tenant": tenant, "phone": phone, "error": str(e)}


async def drainer_loop(poll_seconds: float = 3.0) -> None:
    global _started
    if _started:
        return
    _started = True
    log.info("order-brain drainer started (poll=%.1fs)", poll_seconds)
    while True:
        try:
            r = await drain_once()
            if r is None:
                await asyncio.sleep(poll_seconds)
        except Exception:
            log.exception("drainer tick failed")
            await asyncio.sleep(poll_seconds)
