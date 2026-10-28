"""Gate: the FULL e-commerce chain end-to-end, NO phone/frontend (medusa-integration.md §12).

  1. storefront standard basket → instant_accept → order → outbox → Medusa (source=storefront)
  2. rogue custom → review → composer-capture → (wa.me/bsk_/widget UI) → supplier accept → Medusa
  3. overnight ASAP in-envelope → instant_accept; over-envelope → suggest_alt (the pushback)

Skips when Medusa is down. Extends sim_live's "prove the backend as a black box" tradition.

Rewritten 2026-07-27 against the CURRENT catalogue (seed/catalogue.json — Cárnicas Aldonza,
Mercamadrid). It still carried the English seed the rewrite deleted in 08a2d18bb: `sku-chorizo-sarta`
(the row is now `sku-chorizo-sarta-500`, a 500 g / 1 kg pair), `sku-loin-whole` and
`sku-chorizo-fresh` (gone; `sku-chorizo-fresco` is the live id), the families `sausages` /
`chops_ribs` (the catalogue's families are `embutido_curado` · `fresco` · `cocidos` · `iberico` ·
`casqueria` · `aves` · `quesos`), and two placeholder venues («Storefront Bar», «Custom Bar»)
outside the invented name set. The ASAP rule's `categories` had to move with the families or chain 3
would have gone green for the wrong reason — no rule can match a category no line carries, and a
basket with no matching ASAP rule falls to `suggest_alt` either way.
The three chains are unchanged in KIND. `tests/test_fixtures_grounded.py` asserts the ids below
against the catalogue with no DB and no Medusa, so the next rename fails loudly.
"""
import asyncio
import os
import sys
from datetime import datetime
from zoneinfo import ZoneInfo

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gatelib  # noqa: E402

gatelib.setup_env()
import db  # noqa: E402
from brain import accept, medusa_client, medusa_drain  # noqa: E402
from brain import events as ev

MADRID = ZoneInfo("Europe/Madrid")
PFX = "gsim_"


async def _drain(oid, tries=25):
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
        await con.execute("delete from medusa_sync")
        await con.execute("delete from accept_rules where created_from not in ('manual','seed')")
        await con.execute(
            """insert into accept_rules (id,tenant_id,kind,scope,pattern,enabled,created_from)
                 values ('acr_sim_asap','sancho','asap','tenant',$1,true,'sim')""",
            # `categories` are catalogue FAMILIES (seed/catalogue.json `family`). Chain 3's line is
            # `fresco`; `embutido_curado` is here so the same rule covers a cured-line ASAP too.
            {"max_qty_per_line": 200, "categories": ["embutido_curado", "fresco"],
             "no_customizations": True, "max_total_eur": 600})
    await gatelib.clean_test_orders(PFX)
    import uuid
    run = uuid.uuid4().hex[:6]  # fresh order ids per run → no stale-Medusa-order collision
    day = datetime(2026, 7, 1, 14, 0, tzinfo=MADRID)
    night = datetime(2026, 7, 1, 3, 0, tzinfo=MADRID)
    c = medusa_client.get_client()

    # ── 1. storefront standard → instant_accept → Medusa (source=storefront) ──
    basket = {"lines": [{"sku_id": "sku-chorizo-sarta-500", "item": "CHORIZO SARTA EXTRA 500 G",
                         "family": "embutido_curado", "qty": 24, "unit": "unit", "price": 4.2}],
              "asap": False, "phone": "+34611950001"}
    dec = await accept.evaluate(basket, now=day, phone=basket["phone"])
    assert dec["decision"] == "instant_accept", dec
    oid = PFX + "store1_" + run
    await ev.create_order({"id": oid, "phone_number": basket["phone"], "customer_name": "Taberna Ruano (tienda)",
                           "from_storefront": True, "lines": basket["lines"], "status": "needs_review"},
                          actor="storefront")
    await ev.submit_order(oid, actor="storefront")
    done = await _drain(oid)
    assert done and done["status"] == "done", ("chain1 drain", done)
    mo = await c.get_order(done["medusa_order_id"])
    assert (mo.get("metadata") or {}).get("source") == "storefront", mo.get("metadata")
    print("  chain 1 (storefront standard → Medusa, source=storefront) OK")

    # ── 2. rogue custom → review → composer capture → supplier accept → Medusa ──
    rbasket = {"lines": [{"sku_id": "sku-jamon-serrano-pieza", "item": "JAMÓN SERRANO RESERVA PIEZA",
                          "family": "iberico", "qty": 3, "unit": "kg", "price": 9.8,
                          "customization": "deshuesar y envasar al vacío en tacos de 500 g"}],
               "asap": False, "phone": "+34611950002"}
    dec = await accept.evaluate(rbasket, now=day, phone=rbasket["phone"])
    assert dec["decision"] == "review", ("rogue → review", dec)
    roid = PFX + "rogue1_" + run
    await ev.create_order({"id": roid, "phone_number": rbasket["phone"], "customer_name": "Freiduría Cascajo (tienda)",
                           "from_storefront": True, "lines": rbasket["lines"],
                           "note": "deshuesar y envasar al vacío en tacos", "status": "needs_review"}, actor="composer")
    await ev.submit_order(roid, actor="operator")   # the supplier approves in-app
    rdone = await _drain(roid)
    assert rdone and rdone["status"] == "done", ("chain2 drain", rdone)
    print("  chain 2 (rogue custom → composer → review → accept → Medusa) OK")

    # ── 3. overnight ASAP: in-envelope → instant; over-envelope → suggest_alt (pushback) ──
    fresco = {"sku_id": "sku-chorizo-fresco", "family": "fresco", "price": 6.4}
    dec = await accept.evaluate({"lines": [dict(fresco, qty=30)], "asap": True, "phone": "+34611950003"}, now=night)
    assert dec["decision"] == "instant_accept", ("overnight in-envelope", dec)
    dec = await accept.evaluate({"lines": [dict(fresco, qty=500)], "asap": True, "phone": "+34611950003"}, now=night)
    assert dec["decision"] == "suggest_alt", ("overnight over-envelope", dec)
    print("  chain 3 (overnight ASAP instant-accept + over-envelope pushback) OK")

    await c.aclose()
    async with pool.acquire() as con:
        await con.execute("delete from accept_rules where created_from='sim'")
    print("SIM_ECOMMERCE: FULL BACKEND CHAIN GREEN (no frontend)")


def test_sim_ecommerce():
    r = asyncio.run(main())
    if r == "skipped":
        import pytest
        pytest.skip("Medusa not reachable on :9000")


if __name__ == "__main__":
    asyncio.run(main())
