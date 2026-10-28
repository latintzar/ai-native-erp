"""Stage-4 CANCELLATION gate: «anúlame el pedido» actually stops an order.

WHY THIS FILE EXISTS. Until 2026-08-19 the word `cancelled` was in the status vocabulary and READ
in two places (brain/accept.py, brain/habits.py) — and written by nothing at all. A customer calling
off an order sent a message with no lines, `run_burst` dropped it as «no order», and the goods went
on tomorrow's van. The customer had said the words and watched them do nothing, which is worse than
a product that cannot take cancellations, because they stopped worrying.

So this test asserts the WRITE, not the setting: after the words, the order's status IS `cancelled`
and the trail says who did it. It also asserts the discriminator is not trigger-happy — dropping ONE
product is an amendment, and a cancellation that eats the whole order instead would be the same
class of harm in the other direction.

Run on the box — makes several LLM calls."""
from __future__ import annotations

import asyncio
import sys
import uuid

import db
from brain import events, pipeline, seed

PHONE = "+34000000558"   # fresh, no history — never a real customer
FAILS = []


def check(name, cond, detail=""):
    print(("  ok   " if cond else "  FAIL ") + name + (f"  [{detail}]" if detail and not cond else ""))
    if not cond:
        FAILS.append(name)


async def _noop_notify(order, **kw):
    return None


_SAID = []


async def _capture_cancelled(phone, order, tenant, **kw):
    _SAID.append(("cancelled", phone))


async def _capture_late(phone, order_id, tenant, **kw):
    _SAID.append(("too_late", phone))


async def _ingest(text: str):
    mid = uuid.uuid4().hex
    await db.insert_message({
        "id": mid, "phone_number": PHONE, "role": "user",
        "message_text": text, "message_type": "text", "transcript_status": "none",
    })
    await events.ensure_preparing(PHONE, "Test Venue")
    return await pipeline.run_burst(PHONE, [mid])


async def _status(con, oid):
    return await con.fetchval("select status from orders where id=$1", oid)


async def _cleanup(con):
    await con.execute(
        "delete from order_events where order_id in (select id from orders where phone_number=$1)", PHONE)
    await con.execute("delete from orders where phone_number=$1", PHONE)
    await con.execute("delete from whatsapp_messages where phone_number=$1", PHONE)


async def run():
    await db.init()
    pipeline._notify_order = _noop_notify
    # the mouth is stubbed: this gate is about the WRITE, and a test must never message anybody
    pipeline._say_cancelled = _capture_cancelled
    pipeline._say_too_late = _capture_late
    pool = db.get_pool()
    async with pool.acquire() as con:
        if not await con.fetchval("select count(*) from catalogue_skus"):
            await seed.load_catalogue()
        await _cleanup(con)

    # 1) place one
    o1 = await _ingest("Hola, ponme 5kg de costillas y 3kg de panceta para el viernes")
    check("placed: order created", o1 is not None and len(o1.get("lines", [])) >= 1)
    oid1 = o1["id"] if o1 else None

    # 2) call it off — the whole thing
    o2 = await _ingest("oye anúlame el pedido, al final no me hace falta")
    async with pool.acquire() as con:
        st = await _status(con, oid1) if oid1 else None
        evs = await events.get_events(oid1) if oid1 else []
    check("cancel: the SAME order, not a new card", o2 is not None and o2.get("id") == oid1,
          f"{oid1} vs {o2 and o2.get('id')}")
    check("cancel: status is cancelled", st == "cancelled", str(st))
    check("cancel: flagged as a cancellation", bool((o2 or {}).get("_was_cancellation")))
    check("cancel: the customer was told", ("cancelled", PHONE) in _SAID, str(_SAID))
    check("cancel: an amended event carries the trail",
          "amended" in [e["event_type"] for e in evs], str([e["event_type"] for e in evs]))

    # 3) NO extra order was filed by the call-off (the placeholder must not survive it)
    async with pool.acquire() as con:
        n = await con.fetchval(
            "select count(*) from orders where phone_number=$1 and status<>'preparing'", PHONE)
    check("cancel: still exactly one filed order", n == 1, f"count={n}")

    # 4) THE DISCRIMINATOR — dropping one product is an AMENDMENT, not a call-off. A cancellation
    #    that ate the whole order here would be the same harm in the other direction.
    async with pool.acquire() as con:
        await _cleanup(con)
    o3 = await _ingest("Ponme 5kg de costillas y 3kg de panceta para el viernes")
    oid3 = o3["id"] if o3 else None
    o4 = await _ingest("quítame la panceta, el resto igual")
    async with pool.acquire() as con:
        st3 = await _status(con, oid3) if oid3 else None
    check("one product removed: NOT cancelled", st3 != "cancelled", str(st3))
    check("one product removed: read as an amendment", bool((o4 or {}).get("_was_amendment")),
          str((o4 or {}).get("_was_cancellation")))

    async with pool.acquire() as con:
        await _cleanup(con)
    print("\nRESULT:", "PASS ✅" if not FAILS else f"FAIL ❌ {FAILS}")
    return 0 if not FAILS else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(run()))
