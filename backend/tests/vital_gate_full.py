"""vital_gate_full.py — WP-8 the MONEY GATE, adversarially (BUILD-PLAN §5 WP-8 / §4.6 ④).

The one layer whose failure we refuse: money never moves itself. Fuzzes Spanish price/credit phrasings
AND — the eng-review HIGH fix — BARE numeric off-book quotes vs a seeded standing price (which only gate
now that standing_price is threaded). Every concession/credit/off-book sentence must PARK; clean sales
talk and an on-book quote must PASS. Plus the standing_prices() lookup parses a real COMMERCIAL fact.

Run on the RLS-ON clone:  PYTHONPATH=. venv/bin/python tests/vital_gate_full.py
"""
import asyncio
import os
from pathlib import Path

for _l in Path("/opt/rocoto/.env").read_text().splitlines() if Path("/opt/rocoto/.env").exists() else []:
    _l = _l.strip()
    if _l and not _l.startswith("#") and "=" in _l:
        _k, _, _v = _l.partition("=")
        os.environ.setdefault(_k.strip(), _v.strip())

import agent_reply  # noqa: E402
import db  # noqa: E402
import gate  # noqa: E402
import memory  # noqa: E402
import runtime  # noqa: E402

PHONE = "+34999000888"
SCOPE = runtime.scope_of(PHONE)
STANDING = [2.00]
R = []

# every one of these MUST park (ok == False)
MUST_PARK = [
    "te lo dejo a 1,80 €", "te hago un descuento del 10%", "te lo pongo a mitad", "va gratis",
    "sin cargo esta vez", "precio especial para ti", "te lo fío", "a crédito lo que quieras",
    "págame la semana que viene", "cuando puedas me pagas, sin problema", "déjalo a deber",
    # bare OFF-BOOK numeric quotes (no concession verb) — only park because standing is threaded:
    "son 2,10 € el bote", "te sale a 2,50 €/kg", "1,90 € cada uno",
]
# every one of these MUST pass (ok == True) — clean sales talk + an ON-BOOK quote
MUST_PASS = [
    "¿cuántas cajas quieres?", "te llamo mañana a primera hora", "12 kg entonces, perfecto",
    "el pedido va para el martes", "son 2,00 € el bote",  # matches the book
]
R_ = []


def ck(name, ok, detail=""):
    R.append(bool(ok))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


async def main():
    await db.init()

    leaked = [s for s in MUST_PARK if gate.check_outbound(s, STANDING).get("ok") is not False]
    ck(f"every concession/credit/off-book sentence PARKS ({len(MUST_PARK)} adversarial)",
       not leaked, ("LEAKED: " + " | ".join(leaked)) if leaked else "all parked")

    overparked = [s for s in MUST_PASS if gate.check_outbound(s, STANDING).get("ok") is not True]
    ck(f"clean sales talk + on-book quote PASSES ({len(MUST_PASS)})",
       not overparked, ("OVER-PARKED: " + " | ".join(overparked)) if overparked else "all clean")

    # the eng-review HIGH point, isolated: a bare off-book quote only parks BECAUSE standing is threaded
    ck("bare off-book quote passes with NO standing (can't judge) but PARKS with standing (the HIGH fix)",
       gate.check_outbound("son 2,10 € el bote").get("ok") is True
       and gate.check_outbound("son 2,10 € el bote", STANDING).get("ok") is False)

    # standing_prices() parses the real COMMERCIAL fact
    async with db.scoped_tx(SCOPE) as con:
        await agent_reply._ensure_scope(con, SCOPE)
        await con.execute("delete from fact where scope=$1::ltree", SCOPE)
        await memory.write_fact(con, SCOPE, "COMMERCIAL", "precio rocoto 2,00 €/bote", key="price:rocoto")
        sp = await gate.standing_prices(con, SCOPE)
        await con.execute("delete from fact where scope=$1::ltree", SCOPE)
        await con.execute("delete from scope_node where scope=$1::ltree", SCOPE)
    ck("standing_prices() extracts the keyed price from a COMMERCIAL fact", 2.0 in sp, str(sp))

    passed = sum(R)
    print(f"\nGATE (adversarial): {passed}/{len(R)} passed — {'MONEY NEVER MOVES ITSELF' if passed == len(R) else 'A LEAK'}")
    return 0 if passed == len(R) else 1


raise SystemExit(asyncio.run(main()))
