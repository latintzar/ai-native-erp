"""Auto-accept sweep (acceptability-engine.md §6 + medusa-integration.md §2).

Selects needs_review orders, evaluates each against the acceptability engine as an ASAP candidate,
and on `instant_accept` calls submit_order(actor="auto_accept") — which appends 'submitted' AND
enqueues the Medusa create in ONE txn. Outside the envelope → the order stays needs_review (the
owner's morning queue). Advisory-locked for the whole sweep so the systemd timer + a manual
"Run now" can't double-run. Madrid-tz aware via the engine.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict, Optional

import config
import db
from brain import accept
from brain import events as brain_events

log = logging.getLogger("rocoto.autoaccept")


async def _has_rogue_event(con, order_id: str) -> bool:
    return bool(await con.fetchval(
        "select 1 from order_events where order_id=$1 and event_type='rogue_customization' "
        "and not invalidated limit 1", order_id))


async def run(tenant: Optional[str] = None, *, now: Optional[datetime] = None,
              include_seeded: bool = True) -> Dict[str, Any]:
    tenant = tenant or config.BRAIN_TENANT
    pool = db.get_pool()
    accepted, left = [], []
    async with pool.acquire() as lock_con:
        got = await lock_con.fetchval(
            "select pg_try_advisory_lock(hashtext($1)::bigint)", f"autoaccept:{tenant}")
        if not got:
            return {"status": "skipped", "reason": "locked", "accepted": [], "left": []}
        try:
            seeded_clause = "" if include_seeded else " and not seeded"
            # TENANT-SCOPED (2026-07-27). This sweep does not read — it WRITES: every row it likes is
            # `submit_order`ed. Un-scoped it was a cross-tenant WRITE, auto-approving another
            # distributor's orders under this tenant's accept rules. The worst of the whole map.
            rows = await lock_con.fetch(
                "select id, phone_number, customer_name, lines, status, seeded, created_at, delivery_date "
                "from orders where status='needs_review' and tenant_id=$1" + seeded_clause, tenant)
            for r in rows:
                order = dict(r)
                if await _has_rogue_event(lock_con, order["id"]):
                    left.append(order["id"])
                    continue
                basket = accept.order_to_basket(order, asap=True)
                decision = await accept.evaluate(basket, now=now, phone=order.get("phone_number"))
                if decision["decision"] == "instant_accept":
                    try:
                        await brain_events.submit_order(order["id"], actor="auto_accept")
                        accepted.append(order["id"])
                    except Exception:
                        log.exception("auto-accept submit failed for %s", order["id"])
                        left.append(order["id"])
                else:
                    left.append(order["id"])
        finally:
            await lock_con.execute(
                "select pg_advisory_unlock(hashtext($1)::bigint)", f"autoaccept:{tenant}")
    log.info("autoaccept sweep: %d accepted, %d left for review", len(accepted), len(left))
    return {"status": "ok", "accepted": accepted, "left": left}


# ── CLI entrypoint (the sancho-autoaccept.timer calls this; medusa-integration.md §2) ──
if __name__ == "__main__":
    import asyncio as _asyncio

    import db as _db

    async def _cli() -> None:
        await _db.init()
        res = await run()
        log.info("autoaccept CLI: %s", res)

    _asyncio.run(_cli())
