"""vital_measure.py — WP-13 MEASUREMENT instruments (BUILD-PLAN §5 WP-13 / §4.6 threshold rule).

The plan splits "harness BUILT + CI-wired" (one-shottable now) from "numbers PASS" (traffic-gated, §6).
This is the RECALL instrument, CI-wired: seed a golden once-said set, query each with a paraphrase, and
MEASURE recall@k. The assertion is that the instrument RUNS and produces a valid number (a baseline) —
NOT that the number clears a bar (that needs real traffic). The number is reported for the record.
"""
import asyncio
import os
from pathlib import Path

for _l in Path("/opt/rocoto/.env").read_text().splitlines() if Path("/opt/rocoto/.env").exists() else []:
    _l = _l.strip()
    if _l and not _l.startswith("#") and "=" in _l:
        _k, _, _v = _l.partition("=")
        os.environ.setdefault(_k.strip(), _v.strip())

import agent_reply
import db
import memory
import rt_embed
import runtime  # noqa: E402

PHONE = "+34999001515"
SCOPE = runtime.scope_of(PHONE)
R = []

# a small golden once-said set: (stored fact, a paraphrased query that should recall it)
GOLDEN = [
    ("El cliente prefiere las entregas los martes por la mañana temprano.", "¿qué día quiere que le lleve el pedido?"),
    ("Es alérgico a los frutos secos, cuidado con eso en los productos.", "¿tiene alguna alergia que deba tener en cuenta?"),
    ("Su restaurante se llama La Tasca del Puerto y está en Cádiz.", "¿cómo se llamaba su restaurante?"),
    ("Suele pedir 200 botes de rocoto para las fiestas de diciembre.", "¿cuánto rocoto pidió para navidad?"),
    ("Paga siempre por transferencia, nunca en efectivo.", "¿cómo suele pagar este cliente?"),
    ("Le gusta que le avise el día antes de la entrega.", "¿quiere que le confirme antes de llevarlo?"),
    ("Tiene otro local nuevo en Sevilla desde el mes pasado.", "¿tiene más de un restaurante?"),
    ("Prefiere hablar por WhatsApp, no le gustan las llamadas.", "¿le llamo o mejor le escribo?"),
    ("Cerró en agosto por vacaciones el año pasado.", "¿cuándo cierra por vacaciones?"),
    ("Su cocinero jefe se llama Manolo y decide los pedidos.", "¿con quién hablo de los pedidos?"),
]


def ck(name, ok, detail=""):
    R.append(bool(ok)); print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


async def main():
    await db.init()
    async with db.scoped_tx(SCOPE) as con:
        await agent_reply._ensure_scope(con, SCOPE)
        await con.execute("delete from fact where scope=$1::ltree", SCOPE)
        for text, _q in GOLDEN:
            await memory.write_fact(con, SCOPE, "RELATION", text)

    hits = 0
    async with db.scoped_tx(SCOPE) as con:
        for text, q in GOLDEN:
            qv = await rt_embed.aembed(q)
            got = await memory.search(con, SCOPE, q, k=8, qv=qv)
            if any((h.get("text") or "") == text for h in got):
                hits += 1
        await con.execute("delete from fact where scope=$1::ltree", SCOPE)
        await con.execute("delete from scope_node where scope=$1::ltree", SCOPE)

    recall = hits / len(GOLDEN)
    # instrument assertion: the harness RAN and produced a valid measurement (a baseline, not a bar).
    ck("recall instrument runs + produces a valid number (BASELINE, traffic-gated bar deferred §6)",
       0.0 <= recall <= 1.0 and hits > 0, f"recall@8 = {recall:.0%} ({hits}/{len(GOLDEN)} golden once-said facts recalled)")
    passed = sum(R)
    print(f"\nMEASUREMENT: {passed}/{len(R)} passed — instrument CI-wired · recall@8 baseline = {recall:.0%}")
    return 0 if passed == len(R) else 1


raise SystemExit(asyncio.run(main()))
