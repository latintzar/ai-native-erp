"""Stage-2 gate: event-sourced orders + edits + learn.

Asserts: create -> project; an operator SKU-correction writes a customer alias the matcher then
uses (the L5 flywheel, end-to-end); submit; undo reverts (invalidate-not-overwrite); audit trail
intact; build_excel still consumes the projected order unchanged. Run on the box."""
from __future__ import annotations

import asyncio
import sys

import db
import orders as orders_mod
from brain import events, matcher, seed

TEST_OID = "test-evt-stage2"
TEST_PHONE = "+34000000999"
FAILS = []


def check(name, cond):
    print(("  ok   " if cond else "  FAIL ") + name)
    if not cond:
        FAILS.append(name)


async def _cleanup(con):
    await con.execute("delete from order_events where order_id=$1", TEST_OID)
    await con.execute("delete from orders where id=$1", TEST_OID)
    await con.execute("delete from sku_aliases where phone_number=$1", TEST_PHONE)
    await con.execute("delete from learned_patterns where phone_number=$1", TEST_PHONE)


async def run():
    await db.init()
    pool = db.get_pool()
    async with pool.acquire() as con:
        if not await con.fetchval("select count(*) from catalogue_skus"):
            await seed.load_catalogue()
        await _cleanup(con)

    # 1) create a grounded order (line matched to Fresh chorizo, with the original mention kept)
    mention = "the spicy red one for the stew"
    o = await events.create_order({
        "id": TEST_OID, "phone_number": TEST_PHONE, "customer_name": "Test Bar",
        "lines": [{"raw_text": "5kg of the spicy red one", "mention": mention, "item": "chorizo",
                   "sku_id": "sku-chorizo-fresh", "name": "Fresh chorizo (cooking)",
                   "qty": 5, "unit": "kg", "price": 8.5, "confidence": "medium"}],
        "delivery_date": "2026-06-26",
    }, actor="system")
    check("create projects 1 line", len(o["lines"]) == 1 and o["status"] == "needs_review")

    # 2) operator corrects the SKU -> Cured chorizo sarta. Must write a customer alias.
    edited = await events.edit_order(TEST_OID, lines=[{
        "raw_text": "5kg of the spicy red one", "mention": mention, "item": "chorizo",
        "sku_id": "sku-chorizo-sarta", "name": "Cured chorizo sarta",
        "qty": 5, "unit": "kg", "price": 12.0, "confidence": "high"}], actor="operator")
    check("edit applied (sku corrected)", edited["lines"][0]["sku_id"] == "sku-chorizo-sarta")

    async with pool.acquire() as con:
        alias_row = await con.fetchrow(
            "select sku_id, source, phone_number from sku_aliases where phone_number=$1 and alias=$2",
            TEST_PHONE, matcher.normalize(mention))
    check("edit wrote a customer alias", alias_row is not None
          and alias_row["sku_id"] == "sku-chorizo-sarta" and alias_row["source"] == "edit")

    # 3) the learned alias now grounds the SAME phrase cleanly (flywheel, end-to-end)
    m = await matcher.match(mention, phone=TEST_PHONE)
    check("matcher uses learned alias", m.alias_hit and m.pick
          and m.pick["sku_id"] == "sku-chorizo-sarta")
    m_other = await matcher.match(mention, phone="+34111111111")
    check("alias is customer-scoped (other phone not affected)",
          not (m_other.alias_hit and m_other.pick and m_other.pick["sku_id"] == "sku-chorizo-sarta")
          or m_other.pick["sku_id"] != "sku-chorizo-sarta")

    # 4) hold-to-submit -> approved
    sub = await events.submit_order(TEST_OID, actor="operator")
    check("submit -> approved", sub["status"] == "approved")

    # 5) Excel still builds from the projected order (dispatch layer unchanged)
    xlsx = orders_mod.build_excel([sub])
    check("build_excel produces a workbook", isinstance(xlsx, (bytes, bytearray)) and len(xlsx) > 500)

    # 6) undo reverts the submit (invalidate-not-overwrite)
    u1 = await events.undo_order(TEST_OID, actor="operator")
    check("undo reverts submit -> needs_review", u1["status"] == "needs_review")
    check("undo kept the edited sku", u1["lines"][0]["sku_id"] == "sku-chorizo-sarta")

    # 7) a second undo reverts the line edit -> back to the original SKU
    u2 = await events.undo_order(TEST_OID, actor="operator")
    check("second undo reverts the edit -> original sku", u2["lines"][0]["sku_id"] == "sku-chorizo-fresh")

    # 8) audit trail intact + rebuildable
    evs = await events.get_events(TEST_OID)
    types = [e["event_type"] for e in evs]
    check("audit has created + line_set + submitted + undone",
          "created" in types and "line_set" in types and "submitted" in types and types.count("undone") == 2)
    check("invalidated events retained (not overwritten)",
          any(e["invalidated"] for e in evs))

    async with pool.acquire() as con:
        await _cleanup(con)

    print("\nRESULT:", "PASS ✅" if not FAILS else f"FAIL ❌ {FAILS}")
    return 0 if not FAILS else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(run()))
