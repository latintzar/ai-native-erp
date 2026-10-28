"""Gate: the overnight auto-accept sweep — in-envelope → submit + outbox; outside → needs_review."""
import asyncio
import os
import sys
from datetime import datetime
from zoneinfo import ZoneInfo

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gatelib  # noqa: E402

gatelib.setup_env()
from brain import autoaccept
from brain import events as ev  # noqa: E402

MADRID = ZoneInfo("Europe/Madrid")
PFX = "gaa_"


async def main():
    pool = await gatelib.prepare()
    await gatelib.clean_test_orders(PFX)
    async with pool.acquire() as con:
        await con.execute("delete from accept_rules where created_from='test_aa'")
        await con.execute(
            """insert into accept_rules (id,tenant_id,kind,scope,pattern,enabled,created_from)
                 values ('acr_aa_asap','sancho','asap','tenant',$1,true,'test_aa')""",
            {"max_qty_per_line": 200, "categories": ["sausages"], "no_customizations": True,
             "max_total_eur": 600})

    night = datetime(2026, 7, 1, 3, 0, tzinfo=MADRID)
    await ev.create_order({"id": PFX + "in", "phone_number": "+34611800001",
                           "lines": [{"sku_id": "sku-chorizo-fresh", "item": "Fresh chorizo",
                                      "family": "sausages", "qty": 40, "price": 8.5}],
                           "status": "needs_review"}, actor="system")
    await ev.create_order({"id": PFX + "out", "phone_number": "+34611800002",
                           "lines": [{"sku_id": "sku-chorizo-fresh", "item": "Fresh chorizo",
                                      "family": "sausages", "qty": 500, "price": 8.5}],  # over the 200 ceiling
                           "status": "needs_review"}, actor="system")

    sweep = await autoaccept.run(now=night)
    assert (PFX + "in") in sweep["accepted"], sweep
    assert (PFX + "out") in sweep["left"], sweep
    async with pool.acquire() as con:
        sin = await con.fetchval("select status from orders where id=$1", PFX + "in")
        sout = await con.fetchval("select status from orders where id=$1", PFX + "out")
        nbox = await con.fetchval(
            "select count(*) from medusa_sync where sancho_order_id=$1 and op='create_order'", PFX + "in")
    assert sin == "approved" and sout == "needs_review" and nbox == 1, (sin, sout, nbox)

    async with pool.acquire() as con:
        await con.execute("delete from accept_rules where created_from='test_aa'")
    print("test_autoaccept: in-envelope→submit+outbox, outside→needs_review GREEN")


def test_autoaccept():
    asyncio.run(main())


if __name__ == "__main__":
    asyncio.run(main())
