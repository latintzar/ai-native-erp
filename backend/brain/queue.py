"""Durable ingest queue — "always follow the queue" (Register #76, Stage 3).

webhook → write message (already done) → enqueue (idempotent on WhatsApp msg-id) → debounce
(~2 min, coalesces a burst into one order) → drainer claims a DUE PHONE's whole burst (FOR UPDATE
SKIP LOCKED) → pipeline → mark done. Retry w/ backoff; dead-letter after MAX_ATTEMPTS. Survives a
restart: rows persist; reset_stuck() requeues anything left 'processing' by a crash.
"""
from __future__ import annotations

from typing import List, Optional, Tuple

import config
import db

MAX_ATTEMPTS = 5
BACKOFF_SECONDS = 30


async def enqueue(message_id: str, phone: str, *, urgent: bool = False,
                  debounce: Optional[int] = None, tenant: Optional[str] = None) -> None:
    """Enqueue a message and (re)align the whole phone's pending burst to fire after the LAST
    message. Idempotent on message_id. Urgency short-circuits the debounce."""
    tenant = tenant or config.BRAIN_TENANT
    secs = 0 if urgent else (config.BRAIN_DEBOUNCE_SECONDS if debounce is None else debounce)
    pool = db.get_pool()
    async with pool.acquire() as con, con.transaction():
        await con.execute(
            """insert into ingest_queue (tenant_id, message_id, phone_number, status, not_before, urgent)
                   values ($1,$2,$3,'queued', now() + make_interval(secs => $4), $5)
                   on conflict (message_id) do nothing""",
            tenant, message_id, phone, secs, urgent,
        )
        # coalesce: all still-queued items for this phone become due together (after the last msg)
        await con.execute(
            """update ingest_queue
                     set not_before = now() + make_interval(secs => $2),
                         urgent = (urgent or $3), updated_at = now()
                   where tenant_id=$4 and phone_number=$1 and status='queued'""",
            phone, secs, urgent, tenant,
        )


async def claim_due_phone(tenant: Optional[str] = None) -> Optional[Tuple[str, str, List[str]]]:
    """Atomically claim one due (tenant, phone) burst → (tenant, phone, [message_id]).

    THE DRAINER USED TO BE SINGLE-TENANT (closed 2026-07-27). `tenant or BRAIN_TENANT` meant
    `brain/jobs.drain_once`, which passes nothing, could only ever claim BRAIN_TENANT's rows — so a
    second distributor's messages would sit `queued` forever while their customer waited. With
    `tenant=None` the drainer now claims the OLDEST DUE ROW WHATEVER ITS TENANT and RETURNS that
    tenant, so the pipeline runs against the right catalogue. Passing a tenant explicitly keeps the
    old, pinned behaviour (a per-tenant drainer, the tests, a targeted replay).

    The claim stays keyed on (tenant_id, phone_number): two tenants sharing a customer's phone number
    are two different bursts and must never be claimed as one.
    """
    pool = db.get_pool()
    async with pool.acquire() as con, con.transaction():
        if tenant:
            row = await con.fetchrow(
                """select tenant_id, phone_number from ingest_queue
                         where tenant_id=$1 and status='queued' and not_before <= now()
                         order by not_before asc limit 1 for update skip locked""",
                tenant,
            )
        else:
            row = await con.fetchrow(
                """select tenant_id, phone_number from ingest_queue
                         where status='queued' and not_before <= now()
                         order by not_before asc limit 1 for update skip locked""",
            )
        if not row:
            return None
        t, phone = row["tenant_id"], row["phone_number"]
        claimed = await con.fetch(
            """update ingest_queue set status='processing', updated_at=now()
                     where tenant_id=$1 and phone_number=$2 and status='queued'
                     returning message_id""",
            t, phone,
        )
        return t, phone, [r["message_id"] for r in claimed]


async def requeue(message_ids: List[str], delay: int = 5) -> None:
    """Put claimed (processing) messages back on the queue after `delay`s — used to PAUSE intake while
    a voice note is still transcribing, without losing it from the burst."""
    if not message_ids:
        return
    pool = db.get_pool()
    async with pool.acquire() as con:
        await con.execute(
            "update ingest_queue set status='queued', not_before=now() + make_interval(secs => $2), "
            "updated_at=now() where message_id = any($1::text[])",
            message_ids, delay)


async def mark_done(message_ids: List[str]) -> None:
    if not message_ids:
        return
    pool = db.get_pool()
    async with pool.acquire() as con:
        await con.execute(
            "update ingest_queue set status='done', updated_at=now() where message_id = any($1::text[])",
            message_ids,
        )


async def mark_failed(message_ids: List[str], error: str) -> None:
    """Retry with backoff; dead-letter after MAX_ATTEMPTS (never silently dropped)."""
    if not message_ids:
        return
    pool = db.get_pool()
    async with pool.acquire() as con:
        await con.execute(
            f"""update ingest_queue set
                  attempts = attempts + 1,
                  last_error = $2,
                  status = case when attempts + 1 >= {MAX_ATTEMPTS} then 'dead' else 'queued' end,
                  not_before = now() + make_interval(secs => {BACKOFF_SECONDS}),
                  updated_at = now()
                where message_id = any($1::text[])""",
            message_ids, (error or "")[:500],
        )


async def reset_stuck(max_age_seconds: int = 300, tenant: Optional[str] = None) -> int:
    """On startup: requeue anything a crash left 'processing'. The durability guarantee.
    Returns how many bursts were recovered.

    ACROSS TENANTS by default (2026-07-27), for the same reason `claim_due_phone` is: this is the
    crash-recovery sweep, and recovering only BRAIN_TENANT's rows would strand a second
    distributor's burst as 'processing' forever — the exact failure the durable queue exists to
    prevent. Pass a tenant to pin it."""
    pool = db.get_pool()
    async with pool.acquire() as con:
        if tenant:
            rows = await con.fetch(
                """update ingest_queue set status='queued', updated_at=now()
                     where tenant_id=$1 and status='processing'
                       and updated_at < now() - make_interval(secs => $2)
                   returning message_id""",
                tenant, max_age_seconds,
            )
        else:
            rows = await con.fetch(
                """update ingest_queue set status='queued', updated_at=now()
                     where status='processing'
                       and updated_at < now() - make_interval(secs => $1)
                   returning message_id""",
                max_age_seconds,
            )
    return len(rows)


async def pending_count(phone: Optional[str] = None, tenant: Optional[str] = None) -> int:
    tenant = tenant or config.BRAIN_TENANT
    pool = db.get_pool()
    async with pool.acquire() as con:
        if phone:
            return int(await con.fetchval(
                "select count(*) from ingest_queue where tenant_id=$1 and phone_number=$2 and status in ('queued','processing')",
                tenant, phone) or 0)
        return int(await con.fetchval(
            "select count(*) from ingest_queue where tenant_id=$1 and status in ('queued','processing')",
            tenant) or 0)
