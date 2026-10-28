"""Stage-5 gate (backend): submit history -> profile via deterministic stats + Sonnet; DNA data +
per-weekday typical order. Run on the box (1 LLM call)."""
from __future__ import annotations

import asyncio
import sys
from datetime import date, datetime, timedelta, timezone

import db
from brain import profile, seed

PHONE = "+34000000333"
FAILS = []


def check(name, cond, detail=""):
    print(("  ok   " if cond else "  FAIL ") + name + (f"  [{detail}]" if detail and not cond else ""))
    if not cond:
        FAILS.append(name)


CHOPS = {"sku_id": "sku-chops", "name": "Pork chops (loin)", "qty": 5, "unit": "kg", "price": 8.8, "line_total": 44.0}
RIBS = {"sku_id": "sku-ribs-spare", "name": "Pork ribs (spare)", "qty": 3, "unit": "kg", "price": 7.8, "line_total": 23.4}
BELLY = {"sku_id": "sku-belly-cured", "name": "Cured pork belly (panceta)", "qty": 2, "unit": "kg", "price": 10.5, "line_total": 21.0}


async def run():
    await db.init()
    pool = db.get_pool()
    async with pool.acquire() as con:
        if not await con.fetchval("select count(*) from catalogue_skus"):
            await seed.load_catalogue()
        await con.execute("delete from orders where phone_number=$1", PHONE)
        await con.execute("delete from customer_profiles where phone_number=$1", PHONE)
        await con.execute("insert into whatsapp_user_profiles (phone_number, display_name) values ($1,'Bar Test') on conflict (tenant_id, phone_number) do update set display_name='Bar Test'", PHONE)

        today = date.today()
        last_sat = today - timedelta(days=(today.weekday() - 5) % 7)
        for i in range(5):
            d = last_sat - timedelta(weeks=i)
            lines = [dict(CHOPS), dict(RIBS)] if i < 3 else [dict(CHOPS)]
            if i == 0:
                lines.append(dict(BELLY))
            ts = datetime(d.year, d.month, d.day, 12, 0, tzinfo=timezone.utc)
            await con.execute(
                """insert into orders (id, phone_number, customer_name, status, lines, delivery_date, created_at, seeded)
                   values ($1,$2,'Bar Test','approved',$3,$4,$5,false)""",
                f"test-prof-{i}", PHONE, lines, d.isoformat(), ts)

    prof = await profile.save_profile(PHONE)
    print("  stats:", prof["stats"], "cadence:", prof["cadence_days"], "streak:", prof["streak_weeks"])
    print("  typical_days:", prof["typical_days"], "top:", [p["name"] for p in prof["top_products"]])
    print("  narrative:", (prof["narrative"] or "")[:140])

    sat = str(5)
    check("order_count == 5", prof["stats"].get("order_count") == 5)
    check("cadence ~7 days", prof["cadence_days"] and 6 <= prof["cadence_days"] <= 8, str(prof["cadence_days"]))
    check("top_products has chops", any(p["sku_id"] == "sku-chops" for p in prof["top_products"]))
    check("typical_basket = chops+ribs (belly excluded <50%)",
          {b["sku_id"] for b in prof["typical_basket"]} == {"sku-chops", "sku-ribs-spare"},
          str([b["sku_id"] for b in prof["typical_basket"]]))
    check("typical_days includes Saturday(5)", 5 in prof["typical_days"], str(prof["typical_days"]))
    check("day-tap: Saturday card has a typical order with chops",
          sat in prof["days"] and any(b["sku_id"] == "sku-chops" for b in prof["days"][sat]["typical_order"]),
          str(prof["days"].get(sat)))
    check("streak >= 1", prof["streak_weeks"] >= 1)
    check("lifetime_value > 0", prof["stats"].get("lifetime_value", 0) > 0)
    check("Sonnet narrative written", bool((prof["narrative"] or "").strip()))

    # get_profile round-trips + autopilot toggle
    got = await profile.get_profile(PHONE)
    check("get_profile returns saved data", got and got["stats"].get("order_count") == 5)
    await profile.set_autopilot(PHONE, True)
    got2 = await profile.get_profile(PHONE)
    check("autopilot toggles", got2["autopilot"] is True)

    async with pool.acquire() as con:
        await con.execute("delete from orders where phone_number=$1", PHONE)
        await con.execute("delete from customer_profiles where phone_number=$1", PHONE)
        await con.execute("delete from whatsapp_user_profiles where phone_number=$1", PHONE)

    print("\nRESULT:", "PASS ✅" if not FAILS else f"FAIL ❌ {FAILS}")
    return 0 if not FAILS else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(run()))
