"""The Medusa outbox drainer (medusa-integration.md §1).

A single async loop (one process: sancho.service — do NOT run two). It claims one pending
`medusa_sync` row at a time with FOR UPDATE SKIP LOCKED, pushes it to Medusa via the localhost
Admin API (idempotent find-then-create on the Medusa side), and marks it done / backs off /
dead-letters. Mirrors brain/jobs.py + brain/queue.py exactly.

Land-dark: when MEDUSA_SYNC_ENABLED is false the loop no-ops (the outbox keeps recording intents;
nothing is pushed) so we can deploy then flip the flag during the live walk.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict, Optional

import config
import db
from brain import medusa_client
from brain.medusa_client import MedusaPermanent, MedusaTransient

log = logging.getLogger("rocoto.medusa_drain")

MAX_ATTEMPTS = 10
_started = False


async def _claim_one() -> Optional[Dict[str, Any]]:
    """Atomically claim one due outbox row → mark in_flight. None if nothing is due."""
    pool = db.get_pool()
    async with pool.acquire() as con, con.transaction():
        row = await con.fetchrow(
            """select id, sancho_order_id, sancho_seq, op, payload, attempts, medusa_order_id
                     from medusa_sync
                    where status in ('pending','in_flight') and not_before <= now()
                    order by id asc limit 1 for update skip locked""")
        if not row:
            return None
        await con.execute(
            "update medusa_sync set status='in_flight', updated_at=now() where id=$1", row["id"])
        return dict(row)


async def _mark_done(row: Dict[str, Any], medusa_order_id: Optional[str]) -> None:
    pool = db.get_pool()
    async with pool.acquire() as con:
        await con.execute(
            """update medusa_sync set status='done', medusa_order_id=coalesce($2, medusa_order_id),
                 last_error=null, updated_at=now() where id=$1""",
            row["id"], medusa_order_id)


async def _backoff(row: Dict[str, Any], err: Exception) -> None:
    attempts = int(row.get("attempts") or 0) + 1
    delay = min(2 ** attempts, 300)
    pool = db.get_pool()
    async with pool.acquire() as con:
        if attempts >= MAX_ATTEMPTS:
            await con.execute(
                "update medusa_sync set status='dead', attempts=$2, last_error=$3, updated_at=now() where id=$1",
                row["id"], attempts, str(err)[:500])
            log.error("medusa outbox DEAD-LETTER id=%s op=%s after %d attempts: %s",
                      row["id"], row["op"], attempts, str(err)[:200])
        else:
            await con.execute(
                """update medusa_sync set status='pending', attempts=$2, last_error=$3,
                     not_before = now() + make_interval(secs => $4), updated_at=now() where id=$1""",
                row["id"], attempts, str(err)[:500], delay)


async def _dead_letter(row: Dict[str, Any], err: Exception) -> None:
    pool = db.get_pool()
    async with pool.acquire() as con:
        await con.execute(
            "update medusa_sync set status='dead', last_error=$2, updated_at=now() where id=$1",
            row["id"], str(err)[:500])
    log.error("medusa outbox DEAD-LETTER (permanent) id=%s op=%s: %s",
              row["id"], row["op"], str(err)[:200])


async def _push(row: Dict[str, Any]) -> Optional[str]:
    """Do the actual Medusa Admin call. Returns the medusa_order_id (for create)."""
    client = medusa_client.get_client()
    op = row["op"]
    payload = row["payload"] or {}
    if op == "create_order":
        res = await client.create_order(payload)   # idempotent find-then-create on the Medusa side
        return res.get("id")
    if op == "edit_order":
        await client.edit_order(payload)
        return payload.get("medusa_order_id") or row.get("medusa_order_id")
    if op == "update_product":
        # e-commerce editor → write product metadata through to Medusa (§3). No order id to return.
        await client.update_product(payload)
        return row.get("medusa_order_id")
    # unknown op → permanent (won't fix itself)
    raise MedusaPermanent(f"unknown outbox op: {op}")


async def drain_once() -> Optional[Dict[str, Any]]:
    if not medusa_client.enabled():
        return None  # land-dark: outbox accumulates, nothing pushed
    row = await _claim_one()
    if not row:
        return None
    try:
        medusa_order_id = await _push(row)
        await _mark_done(row, medusa_order_id)
        return {"id": row["id"], "op": row["op"], "medusa_order_id": medusa_order_id}
    except MedusaTransient as e:
        await _backoff(row, e)
        return {"id": row["id"], "transient": str(e)}
    except MedusaPermanent as e:
        await _dead_letter(row, e)
        return {"id": row["id"], "permanent": str(e)}
    except Exception as e:  # unexpected → treat as transient (retry), never lose the row
        log.exception("medusa drain unexpected error id=%s", row["id"])
        await _backoff(row, e)
        return {"id": row["id"], "error": str(e)}


async def drainer_loop(poll_seconds: float = 2.0) -> None:
    global _started
    if _started:
        return
    _started = True
    log.info("medusa outbox drainer started (poll=%.1fs, sync_enabled=%s)",
             poll_seconds, config.MEDUSA_SYNC_ENABLED)
    while True:
        try:
            r = await drain_once()
            if r is None:
                await asyncio.sleep(poll_seconds)
        except Exception:
            log.exception("medusa drainer tick failed")
            await asyncio.sleep(poll_seconds)
