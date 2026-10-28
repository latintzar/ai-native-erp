"""Stage-8 live-flow simulation — proves the end-to-end demo paths WITHOUT a real phone:
  1. Photo (handwritten order, as OCR'd) + a voice-note correction from Bar Lumbre (…644),
     coalesced into ONE burst -> one grounded order card with the correction applied.
  2. A live call: an unknown caller speaks an order -> the ~5s livecall loop builds a live order
     draft + a location on the call row.
Cleans up after itself (reset clears post-seed live rows). The FINAL real-world send/call is Peter's.
Run on the box — makes LLM calls, so `deploy/harness/run_all_vitals.sh` does NOT run it.

Rewritten 2026-07-27, two rots in one file:
  · it spoke ENGLISH at the English catalogue the seed replaced in 08a2d18bb — `sku-chops`,
    `sku-ribs-spare`, `sku-tenderloin`, `sku-belly-fresh`, `sku-bacon` are all deleted rows, so
    every check in the burst asserted against ids that cannot exist;
  · the …644 number was labelled «Peter's Bistro», a name outside the invented set and a person's
    at that. In the seeded world (seed/contacts.json) that number is **Bar Lumbre**, and the photo
    and voice note below are now that venue's own — the ones seeded on its thread.
The two probes are unchanged in KIND: a burst must coalesce into ONE order with the later message
winning, and a live call must build a draft plus an enriched location.
"""
from __future__ import annotations

import asyncio
import sys
import uuid

import db
from brain import jobs, livecall, queue, seed

LUMBRE = "+12025550110"  # Bar Lumbre — seed/contacts.json, orders Thursdays
CALLER = "+34655123987"   # unknown caller for the live-call demo (not in contacts.json, on purpose)
FAILS = []


def check(name, cond, detail=""):
    print(("  ok   " if cond else "  FAIL ") + name + (f"  [{detail}]" if detail and not cond else ""))
    if not cond:
        FAILS.append(name)


async def run():
    await db.init()
    pool = db.get_pool()
    async with pool.acquire() as con:
        if not await con.fetchval("select count(*) from orders where seeded"):
            await seed.refresh_seed()

    # ---------- 1) WhatsApp: photo + voice correction -> one grounded order ----------
    photo_id, voice_id = f"sim-photo-{uuid.uuid4().hex[:6]}", f"sim-voice-{uuid.uuid4().hex[:6]}"
    async with pool.acquire() as con:
        await con.execute(
            """insert into whatsapp_messages (id, phone_number, role, message_type, transcript, transcript_status, created_at, seeded)
               values ($1,$2,'user','image',$3,'done', now(), false)""",
            photo_id, LUMBRE,
            # exactly how Bar Lumbre's order paper reads (seed/contacts.json → `photo`)
            "JUEVES — Serrano lonchas 40 / Cular lonchas 30 / Cuña manchego 12 / Morcilla Burgos 24")
        await con.execute(
            """insert into whatsapp_messages (id, phone_number, role, message_type, transcript, transcript_status, created_at, seeded)
               values ($1,$2,'user','audio',$3,'done', now(), false)""",
            voice_id, LUMBRE,
            "oye, la morcilla de burgos ponme 36 mejor, y añádeme 8 bandejas de pavo en lonchas, gracias")
    await queue.enqueue(photo_id, LUMBRE, debounce=0)
    await queue.enqueue(voice_id, LUMBRE, debounce=0)
    res = await jobs.drain_once()
    oid = (res or {}).get("order_id")
    check("burst -> one order produced", bool(oid))
    order = None
    if oid:
        async with pool.acquire() as con:
            order = await con.fetchrow("select * from orders where id=$1", oid)
    lines = (order["lines"] if order else []) or []
    by = {l.get("sku_id"): l for l in lines}
    print("  order lines:", [(l.get("sku_id"), l.get("qty"), l.get("attention")) for l in lines])
    check("photo: serrano loncheado grounded", "sku-jamon-serrano-lon" in by)
    check("photo: cular loncheado grounded", "sku-chorizo-cular-lon" in by)
    check("photo: cuña de manchego grounded", "sku-manchego-cuna" in by)
    check("voice correction applied: morcilla de Burgos = 36", by.get("sku-morcilla-burgos", {}).get("qty") == 36)
    check("voice correction applied: pavo loncheado added (8)", by.get("sku-pechuga-pavo-lon", {}).get("qty") == 8)
    check("references both messages", order and set(order["source_message_ids"]) >= {photo_id, voice_id})

    # ---------- 2) Live call: transcript -> live order draft + location ----------
    call_id = f"sim-call-{uuid.uuid4().hex[:6]}"
    await db.call_start(call_id, CALLER, "live", False, "")
    await db.call_set_lines(call_id, [
        {"speaker": 0, "text": "hola buenas, ¿me puedes poner cuatro kilos de secreto?"},
        {"speaker": 1, "text": "claro, ¿algo más?"},
        {"speaker": 0, "text": "y seis kilos de presa para el sábado, gracias"},
    ], "")
    call = await db.call_get(call_id)
    await livecall.tick(call, "sancho")
    call2 = await db.call_get(call_id)
    draft = (call2.get("order_draft") or {}).get("lines") or []
    loc = call2.get("location") or {}
    print("  live draft:", [(l.get("sku_id"), l.get("qty")) for l in draft], "loc:", loc.get("business"))
    dby = {l.get("sku_id") for l in draft}
    check("live call: secreto in draft", "sku-secreto-iberico" in dby)
    check("live call: presa in draft", "sku-presa-iberica" in dby)
    check("live call: location enriched (lat present)", bool(loc.get("lat")))

    # cleanup
    async with pool.acquire() as con:
        await con.execute("delete from calls where id=$1", call_id)
        await con.execute("delete from order_events where order_id=$1", oid or "")
        await con.execute("delete from orders where id=$1", oid or "")
        await con.execute("delete from whatsapp_messages where id = any($1::text[])", [photo_id, voice_id])
        await con.execute("delete from ingest_queue where message_id = any($1::text[])", [photo_id, voice_id])

    print("\nRESULT:", "PASS ✅" if not FAILS else f"FAIL ❌ {FAILS}")
    return 0 if not FAILS else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(run()))
