"""Stage-4 smoke: the full 5-scale pipeline produces correct grounded orders via run_message.
(The comprehensive golden eval is Stage 6 — tests/test_golden.py.) Run on the box — makes several
LLM calls, so `deploy/harness/run_all_vitals.sh` does NOT run it.

es-ES against the REAL catalogue (seed/catalogue.json — Cárnicas Aldonza, Mercamadrid). Rewritten
2026-07-27: it still spoke English at an English catalogue (`sku-chops`, `sku-ribs-spare`,
"deliver Saturday please") that the seed rewrite deleted in 08a2d18bb — every id it asserted had
been gone for a day and nothing went red, because nothing runs this file automatically. The four
probes are unchanged in KIND; only the language and the rows are current:

  1. clean multi-line order + a delivery day     → grounded qty/unit, confident, date resolved
  2. a mention that is NOT the printed name      → retrieval lands it anyway
  3. something this house does not sell (`_gaps`) → never silently filled clean
  4. not an order at all                          → no order

`tests/test_fixtures_grounded.py` now asserts every sku id in this file against the catalogue with
no DB and no model, so the same rot fails loudly on the spot next time.
"""
from __future__ import annotations

import asyncio
import sys

import db
from brain import pipeline, seed, validators

FAILS = []
# Deliberately NOT a seeded contact (seed/contacts.json): the smoke wants a customer with no history,
# so nothing here can be answered out of a standing basket. Declared in test_fixtures_grounded.py.
PHONE = "+34000000555"


def check(name, cond, detail=""):
    print(("  ok   " if cond else "  FAIL ") + name + (f"  [{detail}]" if detail and not cond else ""))
    if not cond:
        FAILS.append(name)


def line_for(order, sku_id):
    for ln in (order or {}).get("lines", []):
        if ln.get("sku_id") == sku_id:
            return ln
    return None


async def run():
    await db.init()
    pool = db.get_pool()
    async with pool.acquire() as con:
        if not await con.fetchval("select count(*) from catalogue_skus"):
            await seed.load_catalogue()

    # 1) clean multi-item order with a delivery day
    o = await pipeline.run_message(
        "buenas, ponme 5 kg de secreto ibérico y 3 kg de presa, para el sábado", phone=PHONE)
    print("  ->", [(l.get("sku_id"), l.get("qty"), l.get("unit"), l.get("attention")) for l in (o or {}).get("lines", [])],
          "date:", (o or {}).get("delivery_date"))
    check("clean: order produced", o is not None and len(o.get("lines", [])) >= 2)
    sec = line_for(o, "sku-secreto-iberico"); pre = line_for(o, "sku-presa-iberica")
    check("clean: secreto grounded qty 5", sec is not None and sec.get("qty") == 5)
    check("clean: presa grounded qty 3", pre is not None and pre.get("qty") == 3)
    check("clean: both lines confident (clean/note)",
          sec and pre and sec.get("attention") in ("clean", "note") and pre.get("attention") in ("clean", "note"))
    check("clean: «el sábado» resolved to a valid ISO date",
          bool((o or {}).get("delivery_date")) and validators.date_ok(o["delivery_date"]),
          str((o or {}).get("delivery_date")))

    # 2) the customer's words, not the printed name: two loanwords inside an es-ES message against a
    #    catalogue row that prints BACON AHUMADO LONCHEADO 500 G. Retrieval has to land it.
    o2 = await pipeline.run_message("necesito 4 packs de bacon en lonchas", phone=PHONE)
    print("  ->", [(l.get("sku_id"), l.get("qty")) for l in (o2 or {}).get("lines", [])])
    check("mention: «packs de bacon en lonchas» -> bacon loncheado", line_for(o2, "sku-bacon-lon") is not None)

    # 3) a DECLARED gap (catalogue.json `_gaps`) -> flagged, never silently a charcutería SKU
    o3 = await pipeline.run_message("¿me puedes mandar 10 kg de langostinos cocidos?", phone=PHONE)
    print("  ->", [(l.get("sku_id"), l.get("attention"), l.get("keep_in_mind")) for l in (o3 or {}).get("lines", [])])
    ln3 = (o3 or {}).get("lines", [])
    check("gap: not silently filled clean",
          (not ln3) or all(l.get("attention") in ("underline", "note") for l in ln3),
          str([l.get("attention") for l in ln3]))

    # 4) non-order
    o4 = await pipeline.run_message("gracias majo, el reparto de ayer perfecto", phone=PHONE)
    check("non-order: no order produced", o4 is None or not o4.get("lines"))

    async with pool.acquire() as con:
        await con.execute("delete from order_events where order_id in (select id from orders where phone_number=$1)", PHONE)
        await con.execute("delete from orders where phone_number=$1", PHONE)

    print("\nRESULT:", "PASS ✅" if not FAILS else f"FAIL ❌ {FAILS}")
    return 0 if not FAILS else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(run()))
