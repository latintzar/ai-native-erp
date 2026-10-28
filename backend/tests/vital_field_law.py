#!/usr/bin/env python3
"""vital_field_law — §17.45 per-customer prices · §17.46 what Rocoto answers (Mercabarna field law).

Both come from a customer, in a market, in August 2026 — Dana at Escofruit asked for exactly two
things, and BACKLOG.md marks them NOW because they gate her trial:

  §17.45  per customer, per product: limit to his list, or limit + A FIXED PRICE. A fixed price
          beats the list price, for that customer alone, and different customers hold different
          fixed prices for the same article.
  §17.46  «solo pedidos»: a non-order message gets NO reply — it parks for a human, untouched.
          Orders still book themselves.

WHAT THIS GUARDS, beyond "the code runs":
  · THE DEFAULT IS THE OLD BEHAVIOUR. §17.46's own note says «additive, OFF-flavour default, no
    live tenant changes until flipped» — a tenant that has never touched a setting must behave
    exactly as it did before this shipped. That is what makes the feature safe to ship dark, so it
    is the first thing asserted.
  · a fixed price is per (tenant, customer, article). Two distributors serving one restaurant hold
    separate arrangements — the same law WP-A1 phase C wrote into `endpoint` and
    `customer_profiles`, and the reason this table is keyed the way it is.
  · «solo pedidos» narrows the MOUTH, not the ears: order work still happens on a silent turn.

Run:  source deploy/harness/rehearsal_env.sh && python3 tests/vital_field_law.py
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

BACKEND = str(Path(__file__).resolve().parent.parent)
sys.path.insert(0, BACKEND)

import db  # noqa: E402

PASS = FAIL = 0
PHONE = "+34600555101"
PHONE_B = "+34600555102"
SKU = "sku-vital-fieldlaw"
T_A = "vitalfl_a"
T_B = "vitalfl_b"


def ck(label, ok, detail=""):
    global PASS, FAIL
    if ok:
        PASS += 1
        print(f"  [PASS] {label}" + (f" — {detail}" if detail else ""))
    else:
        FAIL += 1
        print(f"  [FAIL] {label}" + (f" — {detail}" if detail else ""))


async def main() -> int:
    await db.init()
    import behaviour

    print("\n-- (1) EL DEFECTO ES LO DE ANTES (lo que hace seguro desplegarlo) --")
    ck("un inquilino sin ajustes responde a todo, como siempre",
       behaviour.DEFAULTS["scope"] == "all")
    # The August 16 correction preserves pre-existing audio replies (behaviour.py).
    ck("y sus otros ajustes tampoco cambian de sabor",
       behaviour.DEFAULTS["doubts"] == "ask" and behaviour.DEFAULTS["offsku"] == "review"
       and behaviour.DEFAULTS["voice"] == "mirror", str(behaviour.DEFAULTS))
    ck("un valor corrupto NO reinicia los demas, solo su propia clave",
       behaviour.coerce({"scope": "orders", "doubts": "basura"})
       == {**behaviour.DEFAULTS, "scope": "orders"})
    ck("una fila nula o ilegible cae en los defectos, nunca en un estado a medias",
       behaviour.coerce(None) == behaviour.DEFAULTS and behaviour.coerce("{{bad") == behaviour.DEFAULTS)

    print("\n-- (2) §17.46 · LA BOCA SE ESTRECHA, LAS OREJAS NO --")
    ck("un turno CON pedido habla, incluso en «solo pedidos»",
       behaviour.turn_produced_an_order([{"order.drafted": {}}]) is True)
    ck("un turno SIN pedido calla en «solo pedidos»",
       behaviour.turn_produced_an_order([{"responder": {}}, {"remember": {}}]) is False)
    ck("un verbo de pedido NUEVO entra solo (prefijo, no lista blanca) — una lista exacta es "
       "como este ajuste empezaria a silenciar pedidos de verdad",
       behaviour.turn_produced_an_order([{"order_lines": {}}]) is True
       and behaviour.turn_produced_an_order([{"booked_something": {}}]) is True)

    async with db.get_pool().acquire() as con:
        for slug in (T_A, T_B):
            await con.execute("insert into tenants(slug,name,status,seeded) values($1,$1,'test',true) "
                              "on conflict (slug) do nothing", slug)

    ck("«todo» nunca calla, haga lo que haga el turno",
       await behaviour.should_stay_silent(T_B, []) is False)

    _before, _after = await behaviour.set_keys(T_A, scope="orders")
    ck("con «solo pedidos», un turno sin pedido calla",
       await behaviour.should_stay_silent(T_A, [{"responder": {}}]) is True)
    ck("y el mismo turno con un pedido si habla (los pedidos se siguen registrando solos)",
       await behaviour.should_stay_silent(T_A, [{"order.placed": {}}]) is False)
    ck("el ajuste es POR EMPRESA: el vecino sigue respondiendo a todo",
       await behaviour.should_stay_silent(T_B, [{"responder": {}}]) is False)

    rejected = 0
    for kw in ({"scope": "a_veces"}, {"inventado": "x"}):
        try:
            await behaviour.set_keys(T_A, **kw)
        except ValueError:
            rejected += 1
    ck("un valor o una clave inventados se RECHAZAN en voz alta "
       "(un ajuste ignorado en silencio es un jefe que cree haber cambiado algo)", rejected == 2)

    print("\n-- (3) §17.45 · EL PRECIO ES DE ESE CLIENTE, CON ESE PROVEEDOR --")
    async with db.get_pool().acquire() as con:
        await con.execute("delete from customer_sku_prices where sku_id=$1", SKU)
        await con.execute(
            "insert into customer_sku_prices(tenant_id, phone_number, sku_id, price, only_his_list) "
            "values($1,$2,$3,$4,$5)", T_A, PHONE, SKU, 12.50, True)
        await con.execute(
            "insert into customer_sku_prices(tenant_id, phone_number, sku_id, price, only_his_list) "
            "values($1,$2,$3,$4,$5)", T_A, PHONE_B, SKU, 9.75, False)
        by_customer = {r["phone_number"]: float(r["price"]) for r in await con.fetch(
            "select phone_number, price from customer_sku_prices where tenant_id=$1 and sku_id=$2",
            T_A, SKU)}
        ck("dos clientes del MISMO proveedor: precios distintos para el mismo articulo",
           by_customer.get(PHONE) == 12.50 and by_customer.get(PHONE_B) == 9.75, str(by_customer))

        await con.execute(
            "insert into customer_sku_prices(tenant_id, phone_number, sku_id, price) values($1,$2,$3,$4)",
            T_B, PHONE, SKU, 30.00)
        by_supplier = {r["tenant_id"]: float(r["price"]) for r in await con.fetch(
            "select tenant_id, price from customer_sku_prices where phone_number=$1 and sku_id=$2",
            PHONE, SKU)}
        ck("dos PROVEEDORES tienen su propio acuerdo con el mismo cliente y articulo",
           by_supplier.get(T_A) == 12.50 and by_supplier.get(T_B) == 30.00, str(by_supplier))

        ck("«solo su lista» y «su precio» viven en la MISMA fila: son la misma idea (§17.45)",
           bool(await con.fetchval(
               "select only_his_list from customer_sku_prices "
               "where tenant_id=$1 and phone_number=$2 and sku_id=$3", T_A, PHONE, SKU)))

        price = await con.fetchval(
            "insert into customer_sku_prices(tenant_id, phone_number, sku_id, only_his_list) "
            "values($1,$2,$3,true) returning price", T_A, "+34600555199", SKU)
        ck("precio NULO = «su lista, a mis precios»: limitar no obliga a poner precio", price is None)

    print("\n-- (4) §17.45 · Y LLEGA A LA LINEA DEL PEDIDO (no solo a una tabla) --")
    # The table is worth nothing if the price never reaches the document. This drives the REAL line
    # builder (brain.tabular.build) — the same function the runtime uses — and checks the number
    # that would print on his albaran.
    from brain import tabular
    async with db.get_pool().acquire() as con:
        await con.execute(
            "insert into catalogue_skus(id, tenant_id, code, name, base_unit, price) "
            "values($1,$2,'FL1','CAJA NISPEROS','caja',$3) on conflict (id) do update set price=excluded.price",
            SKU, T_A, 20.00)

    decided = {"lines": [{"index": 0, "sku_id": SKU, "qty": 3, "unit": "caja"}]}
    synth = {"grounded_lines": [{"mention": "3 cajas de nisperos", "match": {}}]}

    lines = await tabular.build(decided, synth, [{}], {"phone": "+34600555901", "tenant": T_A})
    ck("sin acuerdo propio, la linea sale al precio de catalogo",
       lines and lines[0].get("price") == 20.00 and lines[0].get("line_total") == 60.00,
       str(lines[0].get("price")) if lines else "sin lineas")

    async with db.get_pool().acquire() as con:
        await con.execute(
            "insert into customer_sku_prices(tenant_id, phone_number, sku_id, price) values($1,$2,$3,$4) "
            "on conflict (tenant_id, phone_number, sku_id) do update set price=excluded.price",
            T_A, PHONE, SKU, 12.50)
    lines = await tabular.build(decided, synth, [{}], {"phone": PHONE, "tenant": T_A})
    ck("SU precio gana al de catalogo, y el total se recalcula con el suyo",
       lines and lines[0].get("price") == 12.50 and lines[0].get("line_total") == 37.50,
       (f"price={lines[0].get('price')} total={lines[0].get('line_total')}" if lines else "sin lineas"))

    async with db.get_pool().acquire() as con:
        await con.execute(
            "insert into customer_sku_prices(tenant_id, phone_number, sku_id, only_his_list) "
            "values($1,$2,$3,true) on conflict (tenant_id, phone_number, sku_id) do update set price=null",
            T_A, PHONE_B, SKU)
    lines = await tabular.build(decided, synth, [{}], {"phone": PHONE_B, "tenant": T_A})
    ck("«su lista, a mis precios» (precio NULO) NO rompe el precio de catalogo",
       lines and lines[0].get("price") == 20.00, str(lines[0].get("price")) if lines else "sin lineas")

    off = await tabular.build({"lines": [{"index": 0, "sku_id": "", "qty": 2}]},
                              {"grounded_lines": [{"mention": "2 cajas de algo raro", "match": {}}]},
                              [{}], {"phone": PHONE, "tenant": T_A})
    ck("una linea FUERA DE LISTA sigue sin precio, tenga el cliente acuerdo o no (§17.35)",
       off and off[0].get("price") is None, str(off[0].get("price")) if off else "sin lineas")

    async with db.get_pool().acquire() as con:
        await con.execute("delete from catalogue_skus where id=$1", SKU)
        await con.execute("delete from customer_sku_prices where sku_id=$1", SKU)
        await con.execute("delete from tenants where slug = any($1::text[])", [T_A, T_B])

    print(f"\n  {PASS}/{PASS + FAIL} PASS" + ("" if not FAIL else f"  [{FAIL} FAILED]"))
    return 1 if FAIL else 0


if __name__ == "__main__":
    print("-- vital_field_law · §17.45 precios por cliente · §17.46 que contesta Rocoto --")
    sys.exit(asyncio.run(main()))
