#!/usr/bin/env python3
"""vital_entitlement — §17.2's entitlement row · §17.9's wall · §17.30k's component law (WP-A2).

The question this answers is not "does the table work" but «what does ON mean, and who decides?»

  · §17.30k — a product LIGHTS and DARKENS the surfaces that declare it. Cobros off means Orders
    has no payment column, not a greyed one. Every surface must therefore ask the SAME function.
  · §17.9  — a product is never live while the tenant is in test. That wall is enforced on WRITE
    *and* on READ, because a tenant can be moved back to test after a product was armed.
  · WP-A2 — the three legacy booleans are still what the RUNTIME reads (brain/stock gates on
    tenants.inventory_enabled this minute), so while a product has a legacy seat the OLD FLAG WINS
    and the new table mirrors it. That is what makes this table additive on a live box.

Run:  source deploy/harness/rehearsal_env.sh && python3 tests/vital_entitlement.py
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import db  # noqa: E402

PASS = FAIL = 0
T = "vitalent_a"
T_LIVE = "vitalent_live"


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
    from brain import entitlement as ent

    async with db.get_pool().acquire() as con:
        await con.execute("insert into tenants(slug,name,status,seeded) values($1,$1,'test',true) "
                          "on conflict (slug) do update set status='test'", T)
        await con.execute("insert into tenants(slug,name,status,seeded) values($1,$1,'live',true) "
                          "on conflict (slug) do update set status='live'", T_LIVE)

    print("\n-- (1) NADA ESTA ENCENDIDO POR DEFECTO (fallar cerrado, no conceder) --")
    ck("un inquilino nuevo no tiene ningun producto encendido",
       all(v == "off" for v in (await ent.all_states(T)).values()), str(await ent.all_states(T)))
    ck("un producto que no existe es 'off', nunca un permiso por accidente",
       await ent.state("inventado", T) == "off" and await ent.is_on("inventado", T) is False)

    print("\n-- (2) §17.9 · UN PRODUCTO NO ESTA EN DIRECTO SI LA EMPRESA NO LO ESTA --")
    got = await ent.set_state("cobros", "live", T, actor="vital")
    ck("pedir 'live' en una empresa EN PRUEBAS devuelve 'test' — el muro se aplica, no se avisa",
       got == "test", f"devolvio {got!r}")
    ck("…y is_live() dice que no, aunque is_on() diga que si",
       await ent.is_live("cobros", T) is False and await ent.is_on("cobros", T) is True)

    got = await ent.set_state("cobros", "live", T_LIVE, actor="vital")
    ck("en una empresa EN DIRECTO, 'live' es 'live'", got == "live")
    ck("is_live() lo confirma", await ent.is_live("cobros", T_LIVE) is True)

    async with db.get_pool().acquire() as con:
        await con.execute("update tenants set status='test' where slug=$1", T_LIVE)
    ck("si la empresa VUELVE a pruebas, el producto deja de estar en directo AL LEERLO "
       "(guardarlo no basta: la empresa puede moverse despues)",
       await ent.state("cobros", T_LIVE) == "test", await ent.state("cobros", T_LIVE))
    async with db.get_pool().acquire() as con:
        await con.execute("update tenants set status='live' where slug=$1", T_LIVE)

    print("\n-- (3) LOS BOOLEANOS VIEJOS SIGUEN MANDANDO (lo que hace aditiva esta tabla) --")
    async with db.get_pool().acquire() as con:
        await con.execute("update tenants set inventory_enabled=false where slug=$1", T_LIVE)
    ck("con el flag viejo APAGADO, inventario esta apagado — lo lea quien lo lea",
       await ent.is_on("inventario", T_LIVE) is False)
    async with db.get_pool().acquire() as con:
        await con.execute("update tenants set inventory_enabled=true where slug=$1", T_LIVE)
    ck("con el flag viejo ENCENDIDO, inventario esta encendido sin tocar la tabla nueva "
       "(el runtime lee ese booleano ahora mismo: brain/stock)",
       await ent.is_on("inventario", T_LIVE) is True)

    await ent.set_state("inventario", "off", T_LIVE, actor="vital")
    async with db.get_pool().acquire() as con:
        legacy = await con.fetchval("select inventory_enabled from tenants where slug=$1", T_LIVE)
    ck("apagarlo por la puerta nueva TAMBIEN apaga el booleano viejo — "
       "si no, el panel y el runtime discreparian del mismo interruptor", legacy is False)

    print("\n-- (4) UN CAMBIO INVENTADO SE RECHAZA EN VOZ ALTA --")
    rejected = 0
    for args in (("inventado", "live"), ("cobros", "a_medias")):
        try:
            await ent.set_state(args[0], args[1], T, actor="vital")
        except ValueError:
            rejected += 1
    ck("producto o estado desconocido -> ValueError, nunca un encendido silencioso", rejected == 2)

    async with db.get_pool().acquire() as con:
        await con.execute("delete from tenant_product where tenant_id = any($1::text[])", [T, T_LIVE])
        await con.execute("delete from tenants where slug = any($1::text[])", [T, T_LIVE])

    print(f"\n  {PASS}/{PASS + FAIL} PASS" + ("" if not FAIL else f"  [{FAIL} FAILED]"))
    return 1 if FAIL else 0


if __name__ == "__main__":
    print("-- vital_entitlement · §17.2 la fila de productos · §17.9 el muro --")
    sys.exit(asyncio.run(main()))
