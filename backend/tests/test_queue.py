"""Stage-3 gate: durable queue + debounce + junk gate + identity.

Asserts: a burst coalesces to ONE order; a crash mid-process is recovered (reset_stuck requeues,
drain still produces the order) = survives a restart; junk is dropped (no order, no LLM call);
identity resolves known / owner-2-venues / staff-on-personal. Run on the box (makes 1 LLM call)."""
from __future__ import annotations

import asyncio
import sys

import config
import db
from brain import identity, jobs, junkgate, queue, seed

PHONE = "+34000000777"
JPHONE = "+34000000778"
OWNER = "+34000000700"
VENUE_PHONE = "+34000000701"
STAFF = "+34000000702"
FAILS = []


def check(name, cond):
    print(("  ok   " if cond else "  FAIL ") + name)
    if not cond:
        FAILS.append(name)


async def _ins_msg(con, mid, phone, text, mtype="text"):
    await con.execute(
        """insert into whatsapp_messages (id, phone_number, role, message_text, message_type, created_at)
           values ($1,$2,'user',$3,$4, now())""", mid, phone, text, mtype)


async def _cleanup(con):
    for p in (PHONE, JPHONE, OWNER, VENUE_PHONE, STAFF):
        await con.execute("delete from ingest_queue where phone_number=$1", p)
        await con.execute("delete from orders where phone_number=$1", p)
        await con.execute("delete from order_events where order_id in (select id from orders where phone_number=$1)", p)
        await con.execute("delete from whatsapp_messages where phone_number=$1", p)
        await con.execute("delete from customer_profiles where phone_number=$1", p)
        await con.execute("delete from whatsapp_user_profiles where phone_number=$1", p)


async def run():
    await db.init()
    pool = db.get_pool()
    async with pool.acquire() as con:
        if not await con.fetchval("select count(*) from catalogue_skus"):
            await seed.load_catalogue()
        await _cleanup(con)

    # --- junk gate (deterministic, no model) ---
    check("junk: 'gracias' is junk", junkgate.is_junk("gracias", False)[0])
    check("junk: order text is NOT junk", not junkgate.is_junk("5kg of pork chops", False)[0])
    check("junk: media always passes", not junkgate.is_junk("", True)[0])
    check("urgency detected", junkgate.is_urgent("need it asap") and not junkgate.is_urgent("whenever"))

    # --- burst -> ONE order, with crash recovery in the middle (survives a restart) ---
    ids = ["q-test-1", "q-test-2", "q-test-3"]
    async with pool.acquire() as con:
        await _ins_msg(con, ids[0], PHONE, "Hi, I need 5kg of pork chops")
        await _ins_msg(con, ids[1], PHONE, "and 3kg of spare ribs")
        await _ins_msg(con, ids[2], PHONE, "for Saturday please")
    for mid in ids:
        await queue.enqueue(mid, PHONE, debounce=0)
    check("burst coalesced (3 queued for phone)", await queue.pending_count(PHONE) == 3)

    # simulate a worker grabbing the burst then the process crashing
    claim = await queue.claim_due_phone()   # → (tenant, phone, ids) since the multi-tenant pass
    check("claim grabs the whole burst", claim is not None and set(claim[2]) == set(ids))
    check("the claim carries its own tenant", claim is not None and claim[0] == config.BRAIN_TENANT)
    recovered = await queue.reset_stuck(max_age_seconds=0)  # restart recovery
    check("crash recovery requeues the burst", recovered == 3)

    res = await jobs.drain_once()
    check("drain produced exactly one order", res is not None and res.get("order_id"))
    async with pool.acquire() as con:
        n_orders = await con.fetchval("select count(*) from orders where phone_number=$1", PHONE)
        order = await con.fetchrow("select * from orders where phone_number=$1", PHONE)
    check("exactly ONE order from the burst", n_orders == 1)
    check("order references all 3 burst messages",
          order and set(order["source_message_ids"]) == set(ids))
    check("order has grounded-or-extracted lines", order and len(order["lines"]) >= 1)

    # --- junk-only burst -> no order (and no LLM call) ---
    async with pool.acquire() as con:
        await _ins_msg(con, "q-junk-1", JPHONE, "gracias!!")
    await queue.enqueue("q-junk-1", JPHONE, debounce=0)
    jr = await jobs.drain_once()
    async with pool.acquire() as con:
        n_junk_orders = await con.fetchval("select count(*) from orders where phone_number=$1", JPHONE)
    check("junk burst created no order", n_junk_orders == 0)

    # --- identity ---
    async with pool.acquire() as con:
        await con.execute(
            """insert into customer_profiles (phone_number, tenant_id, display_name, stats, phone_numbers, seeded)
               values ($1,$2,'Grupo Peral', $3, $4, false)
               on conflict (tenant_id, phone_number) do update set
                 display_name=excluded.display_name, stats=excluded.stats, phone_numbers=excluded.phone_numbers""",
            OWNER, config.BRAIN_TENANT,
            {"venues": ["Mesón Peral", "Taberna Ruano"]}, [STAFF])
        await con.execute(
            "insert into whatsapp_user_profiles (phone_number, display_name) values ($1,'Café Sotillo') on conflict (tenant_id, phone_number) do update set display_name='Café Sotillo'",
            VENUE_PHONE)

    known = await identity.resolve(VENUE_PHONE)
    check("identity: known venue resolves", known["known"] and known["display_name"] == "Café Sotillo")
    twov = await identity.resolve(OWNER, text="please send the order for Taberna Ruano")
    check("identity: owner->2 venues picks the cued venue", twov["venue"] == "Taberna Ruano")
    staff = await identity.resolve(STAFF, text="hola this is Maria")
    check("identity: linked staff phone resolves to owner", staff["known"] and staff["display_name"] == "Grupo Peral")
    unknown = await identity.resolve("+34000099999", text="hi this is the new guy at Café Sotillo")
    check("identity: staff-on-personal proposes a link",
          unknown["proposed_link"] and unknown["proposed_link"]["venue"] == "Café Sotillo")

    async with pool.acquire() as con:
        await _cleanup(con)
        await con.execute("delete from customer_profiles where phone_number=$1", OWNER)

    print("\nRESULT:", "PASS ✅" if not FAILS else f"FAIL ❌ {FAILS}")
    return 0 if not FAILS else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(run()))
