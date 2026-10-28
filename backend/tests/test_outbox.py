"""Gate: the transactional outbox → Medusa create EXACTLY-ONCE (medusa-integration.md §1/§12).

Runs against the live disposable Medusa (:9000). Skips cleanly if Medusa is down.
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gatelib  # noqa: E402

gatelib.setup_env()
import config  # noqa: E402
import db  # noqa: E402
from brain import events as ev  # noqa: E402
from brain import medusa_client, medusa_drain

PFX = "gobx_"


async def _drain_until_done(oid, tries=25):
    row = None
    for _ in range(tries):
        await medusa_drain.drain_once()
        async with db.get_pool().acquire() as con:
            row = await con.fetchrow(
                "select status, medusa_order_id from medusa_sync where sancho_order_id=$1 "
                "and op='create_order' order by id desc limit 1", oid)
        if row and row["status"] == "done":
            return row
        await asyncio.sleep(0.2)
    return row


async def main():
    if not gatelib.medusa_up():
        return "skipped"
    pool = await gatelib.prepare()
    await gatelib.seed_catalogue_minimal()
    async with pool.acquire() as con:
        await con.execute("delete from medusa_sync")  # clean outbox slate for a deterministic drain
    await gatelib.clean_test_orders(PFX)

    # ── create + submit a grounded order → outbox create row ──
    oid = PFX + "o1"
    await ev.create_order({"id": oid, "phone_number": "+34611777001", "customer_name": "Outbox Bar",
                           "seeded": True,
                           "lines": [{"sku_id": "sku-chorizo-sarta", "item": "Cured Chorizo Sarta",
                                      "qty": 5, "unit": "kg", "price": 12.0}],
                           "status": "needs_review"}, actor="system", seeded=True)
    async with pool.acquire() as con:
        assert await con.fetchval("select count(*) from medusa_sync where sancho_order_id=$1", oid) == 0, \
            "needs_review must NOT enqueue Medusa"
    await ev.submit_order(oid, actor="operator")
    async with pool.acquire() as con:
        row = await con.fetchrow("select op,status from medusa_sync where sancho_order_id=$1", oid)
    assert row and row["op"] == "create_order" and row["status"] == "pending", row

    done = await _drain_until_done(oid)
    assert done and done["status"] == "done" and done["medusa_order_id"], ("drain", done)
    mid = done["medusa_order_id"]

    # ── idempotency: a redelivered push returns the SAME Medusa order (no duplicate) ──
    c = medusa_client.get_client()
    async with pool.acquire() as con:
        payload = await con.fetchval(
            "select payload from medusa_sync where sancho_order_id=$1 and op='create_order'", oid)
    r2 = await c.create_order(payload)
    assert r2["id"] == mid and r2.get("created") is False, ("idempotent redelivery", r2)

    # projection correct: grounded variant line landed
    mo = await c.get_order(mid)
    assert (mo.get("metadata") or {}).get("sancho_order_id") == oid
    assert len(mo.get("items") or []) == 1, mo.get("items")

    # ── edit-after-approve → edit_order row enqueued ──
    await ev.edit_order(oid, lines=[{"sku_id": "sku-chorizo-sarta", "item": "Cured Chorizo Sarta",
                                     "qty": 9, "unit": "kg", "price": 12.0}], actor="operator")
    async with pool.acquire() as con:
        e = await con.fetchrow(
            "select op from medusa_sync where sancho_order_id=$1 and op='edit_order' order by id desc limit 1", oid)
    assert e is not None, "edit-after-approve did not enqueue edit_order"

    # ── MEDUSA_SYNC_ENABLED=false → outbox records, drainer NO-OPs ──
    config.MEDUSA_SYNC_ENABLED = False
    oid2 = PFX + "o2"
    await ev.create_order({"id": oid2, "phone_number": "+34611777002",
                           "lines": [{"sku_id": "sku-bacon", "item": "Bacon", "qty": 2, "price": 9.5}],
                           "status": "needs_review"}, actor="system")
    await ev.submit_order(oid2, actor="operator")
    assert await medusa_drain.drain_once() is None, "drain must no-op when sync disabled"
    async with pool.acquire() as con:
        st = await con.fetchval("select status from medusa_sync where sancho_order_id=$1", oid2)
    assert st == "pending", ("sync-disabled keeps intent pending", st)
    config.MEDUSA_SYNC_ENABLED = True

    await c.aclose()
    print("test_outbox: create exactly-once + idempotent + projection + edit + sync-flag GREEN")


def test_outbox():
    r = asyncio.run(main())
    if r == "skipped":
        import pytest
        pytest.skip("Medusa not reachable on :9000")


if __name__ == "__main__":
    asyncio.run(main())
