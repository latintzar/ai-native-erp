"""Gate: the acceptability decision ladder + Madrid-tz sleeping-window (DST) + no-silent-charge."""
import asyncio
import os
import sys
from datetime import datetime
from zoneinfo import ZoneInfo

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gatelib  # noqa: E402

gatelib.setup_env()
from brain import accept  # noqa: E402

MADRID = ZoneInfo("Europe/Madrid")
UTC = ZoneInfo("UTC")


async def main():
    pool = await gatelib.prepare()
    async with pool.acquire() as con:
        await con.execute("delete from accept_rules where created_from not in ('manual','seed')")
        await con.execute(
            """insert into accept_rules (id,tenant_id,kind,scope,pattern,enabled,created_from)
                 values ('acr_t_asap','sancho','asap','tenant',$1,true,'test')""",
            {"max_qty_per_line": 200, "max_lines": 4, "categories": ["sausages"],
             "no_customizations": True, "max_total_eur": 600})
        await con.execute(
            """insert into accept_rules (id,tenant_id,kind,scope,pattern,enabled,created_from)
                 values ('acr_t_qty','sancho','qty','tenant',$1,true,'test')""",
            {"sku": "sku-chops", "instant_accept_max": 180, "soft_cap": 200, "review_above": 200})

    day = datetime(2026, 7, 1, 14, 0, tzinfo=MADRID)
    night = datetime(2026, 7, 1, 3, 0, tzinfo=MADRID)

    # ── the ladder ──
    r = await accept.evaluate({"lines": [{"sku_id": "sku-chorizo-fresh", "family": "sausages", "qty": 5, "price": 8.5}], "asap": False}, now=day)
    assert r["decision"] == "instant_accept", ("standard", r)
    r = await accept.evaluate({"lines": [{"sku_id": "sku-chorizo-fresh", "family": "sausages", "qty": 50, "price": 8.5}], "asap": True}, now=night)
    assert r["decision"] == "instant_accept" and r["rule_id"], ("asap-in-envelope", r)
    r = await accept.evaluate({"lines": [{"sku_id": "sku-chops", "item": "Chops", "family": "chops_ribs", "qty": 300, "price": 8.8}], "asap": False}, now=day)
    assert r["decision"] == "qty_pushback" and r["alt"]["instant_qty"] == 180, ("over-qty", r)
    r = await accept.evaluate({"lines": [{"sku_id": "sku-chorizo-fresh", "family": "sausages", "qty": 5, "price": 8.5, "customization": "gluten-free casing"}], "asap": True}, now=night)
    assert r["decision"] == "review", ("rogue-custom", r)
    r = await accept.evaluate({"lines": [{"sku_id": "sku-bacon", "family": "belly", "qty": 5, "price": 9.5}], "asap": True}, now=night)
    assert r["decision"] == "suggest_alt" and r["alt"]["asap"] is False, ("asap-outside", r)

    # ── no silent charge: an instant_accept decision never carries money fields ──
    r = await accept.evaluate({"lines": [{"sku_id": "sku-chorizo-fresh", "family": "sausages", "qty": 10, "price": 8.5}], "asap": True}, now=night)
    assert r["decision"] == "instant_accept"
    assert not any(k in r for k in ("charge", "payment", "amount_charged", "captured", "card")), r

    # ── sleeping window + DST (CET ↔ CEST) ──
    assert accept.in_sleeping_window(datetime(2026, 1, 15, 3, 0, tzinfo=MADRID)) is True   # winter 3am
    assert accept.in_sleeping_window(datetime(2026, 7, 15, 3, 0, tzinfo=MADRID)) is True   # summer 3am
    assert accept.in_sleeping_window(datetime(2026, 7, 15, 1, 0, tzinfo=UTC)) is True       # 03:00 CEST
    assert accept.in_sleeping_window(datetime(2026, 1, 15, 1, 0, tzinfo=UTC)) is True       # 02:00 CET
    assert accept.in_sleeping_window(datetime(2026, 7, 15, 14, 0, tzinfo=MADRID)) is False  # afternoon

    async with pool.acquire() as con:
        await con.execute("delete from accept_rules where created_from='test'")
    print("test_acceptability: ladder + sleeping-window/DST + no-silent-charge GREEN")


def test_acceptability():
    asyncio.run(main())


if __name__ == "__main__":
    asyncio.run(main())
