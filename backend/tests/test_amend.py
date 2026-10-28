"""Stage-4 amendment gate: a customer follow-up that CHANGES an order they already placed folds into
the SAME event-sourced order (new state + audit trail), not a confusing duplicate card. A genuinely
new order still files separately. Run on the box — makes several LLM calls."""
from __future__ import annotations

import asyncio
import sys
import uuid

import db
from brain import events, pipeline, seed

PHONE = "+34000000557"   # fresh, no history
FAILS = []


def check(name, cond, detail=""):
    print(("  ok   " if cond else "  FAIL ") + name + (f"  [{detail}]" if detail and not cond else ""))
    if not cond:
        FAILS.append(name)


async def _noop_notify(order):   # don't push to Peter's real device during the automated test
    return None


async def _ingest(text: str):
    """Mirror the live flow: a message lands -> a 'preparing' card drops -> the drainer runs the burst."""
    mid = uuid.uuid4().hex
    await db.insert_message({
        "id": mid, "phone_number": PHONE, "role": "user",
        "message_text": text, "message_type": "text", "transcript_status": "none",
    })
    await events.ensure_preparing(PHONE, "Test Venue")
    return await pipeline.run_burst(PHONE, [mid])


def qty_of(order, needle):
    for ln in (order or {}).get("lines", []):
        name = (ln.get("name") or ln.get("item") or ln.get("mention") or "").lower()
        if needle in name:
            return ln.get("qty")
    return None


async def _cleanup(con):
    await con.execute(
        "delete from order_events where order_id in (select id from orders where phone_number=$1)", PHONE)
    await con.execute("delete from orders where phone_number=$1", PHONE)
    await con.execute("delete from whatsapp_messages where phone_number=$1", PHONE)


async def run():
    await db.init()
    pipeline._notify_order = _noop_notify
    pool = db.get_pool()
    async with pool.acquire() as con:
        if not await con.fetchval("select count(*) from catalogue_skus"):
            await seed.load_catalogue()
        await _cleanup(con)

    # 1) place an order
    o1 = await _ingest("Hi, I need 5kg of spare ribs and 3kg of pork belly, deliver Friday")
    print("  order1 ->", o1 and o1["id"], [(l.get("sku_id"), l.get("qty")) for l in (o1 or {}).get("lines", [])])
    check("placed: order created with ribs + belly", o1 is not None and len(o1.get("lines", [])) >= 2)
    check("placed: ribs qty 5", qty_of(o1, "rib") == 5, str(qty_of(o1, "rib")))
    oid1 = o1["id"] if o1 else None

    # 2) follow-up CHANGE — should fold into the SAME order, not create a new one
    o2 = await _ingest("actually make the ribs 10kg please")
    print("  order2 ->", o2 and o2["id"],
          [(l.get("sku_id"), l.get("qty")) for l in (o2 or {}).get("lines", [])],
          "amend?", (o2 or {}).get("_was_amendment"))
    check("amend: SAME order id (no duplicate)", o2 is not None and o2.get("id") == oid1,
          f"{oid1} vs {o2 and o2.get('id')}")
    check("amend: flagged as amendment", bool((o2 or {}).get("_was_amendment")))
    check("amend: ribs now 10kg", qty_of(o2, "rib") == 10, str(qty_of(o2, "rib")))
    check("amend: belly still on the order (3kg)", qty_of(o2, "bell") == 3, str(qty_of(o2, "bell")))

    # 3) exactly ONE filed order + an `amended` event in the trail
    async with pool.acquire() as con:
        n = await con.fetchval(
            "select count(*) from orders where phone_number=$1 and status<>'preparing'", PHONE)
        evs = await events.get_events(oid1) if oid1 else []
    check("single filed order (no duplicate card)", n == 1, f"count={n}")
    check("amended event in the audit trail", "amended" in [e["event_type"] for e in evs],
          str([e["event_type"] for e in evs]))

    # 4) a genuinely NEW, unrelated order still files on its own (the discriminator isn't trigger-happy)
    o3 = await _ingest("Separate new order for next Monday: 4kg of chorizo")
    print("  order3 ->", o3 and o3["id"],
          [(l.get("sku_id"), l.get("qty")) for l in (o3 or {}).get("lines", [])],
          "amend?", (o3 or {}).get("_was_amendment"))
    check("new order: produced", o3 is not None and len(o3.get("lines", [])) >= 1)
    check("new order: NOT folded into the ribs order", not (o3 or {}).get("_was_amendment"))
    async with pool.acquire() as con:
        n2 = await con.fetchval(
            "select count(*) from orders where phone_number=$1 and status<>'preparing'", PHONE)
    check("two filed orders now (new one is separate)", n2 == 2, f"count={n2}")

    async with pool.acquire() as con:
        await _cleanup(con)
    print("\nRESULT:", "PASS ✅" if not FAILS else f"FAIL ❌ {FAILS}")
    return 0 if not FAILS else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(run()))
