"""vital_fabric.py — THE PROCESS FABRIC vital (WP-3): the one background→mouth/fold contract.
  1. REGISTRY ROUND-TRIP — a fake process registers (one call), fires on its trigger, its result
     rides process.completed, and its `say` reaches the NEXT turn's mouth.
  2. FABRIC MONEY PARKS — a fabric say carrying an off-book price is gated: never voiced.
  3. FOLD-IN — a fold-enrichment result (recall lines) reaches the pin rebuild from the SPINE.
  4. STALL AS DATA — the stall hint derives from the slowest fired process's expected_ms.
Run on the clone: PYTHONPATH=. venv/bin/python tests/vital_fabric.py
"""
import asyncio
import json
import os
from pathlib import Path

for _l in Path("/opt/rocoto/.env").read_text().splitlines() if Path("/opt/rocoto/.env").exists() else []:
    _l = _l.strip()
    if _l and not _l.startswith("#") and "=" in _l:
        k, _, v = _l.partition("="); os.environ.setdefault(k.strip(), v.strip())
import app as app_mod
import db
import spine
import voice_fabric  # noqa: E402
import voice_protocol

PHONE, DIGITS = "+34999000787", "34999000787"
SCOPE = f"wa.{DIGITS}"
R = []
def ck(n, ok, d=""):
    R.append(bool(ok)); print(f"  [{'PASS' if ok else 'FAIL'}] {n}" + (f" — {d}" if d else ""))

class FakeR1:
    def __init__(s, script): s.script=list(script); s.calls=[]
    @property
    def messages(s):
        class M:
            def __init__(m, o): m.o=o
            async def create(m, **kw):
                m.o.calls.append(kw)
                class B: type="text"
                b=B(); b.text = m.o.script.pop(0) if m.o.script else "Vale."
                class Rp: content=[b]
                return Rp()
        return M(s)

async def _clean():
    async with db.scoped_tx(SCOPE) as con:
        for t in ("action","timer","wake","pending_turn","open_loop","event","fact","summary","card","scope_state"):
            await con.execute(f"delete from {t} where scope=$1::ltree", SCOPE)
    app_mod._VOICE_PINS.pop(SCOPE, None); app_mod._VOICE_LOCKS.pop(SCOPE, None)

async def _drive(u):
    before = set(asyncio.all_tasks())
    resp = await app_mod.api_voice_chat({"messages":[{"role":"user","content":u}], "caller": PHONE, "stream": False})
    pend = [t for t in (asyncio.all_tasks()-before) if t is not asyncio.current_task() and not t.done()]
    if pend: await asyncio.gather(*pend, return_exceptions=True)
    return json.loads(bytes(resp.body))["choices"][0]["message"]["content"]

async def main():
    await db.init()
    # 1. registry round-trip: a fake process = ONE register() call
    await _clean()
    async def fake_run(scope, utt, ctx, **kw):
        return {"say": "por cierto, el reparto del jueves queda confirmado", "money": False}
    voice_fabric.register("fake_check", trigger=lambda s,u,c: "jueves" in (u or ""),
                          run=fake_run, expected_ms=2000, stall="filler")
    fake = FakeR1(["Claro, dime.", "Perfecto."])
    voice_protocol._anthropic = lambda: fake
    await _drive("¿qué pasa con el jueves entonces?")     # turn N fires fake_check
    r2 = await _drive("vale, ¿algo más?")                  # turn N+1 speaks the result
    ck("fake process fires + its say reaches turn N+1", "jueves queda confirmado" in r2.lower(), r2[:80])
    async with db.scoped_tx(SCOPE) as con:
        nc = await con.fetchval("select count(*) from event where scope=$1::ltree and type='process.completed'", SCOPE)
        nd = await con.fetchval("select count(*) from event where scope=$1::ltree and type='process.delivered'", SCOPE)
    ck("envelope + delivery markers on the spine", (nc or 0) >= 1 and (nd or 0) >= 1, f"completed={nc} delivered={nd}")
    voice_fabric._REGISTRY.pop("fake_check", None)

    # 2. fabric money parks
    await _clean()
    async def money_run(scope, utt, ctx, **kw):
        return {"say": "te lo dejo a 4,80 € el kilo", "money": True}
    voice_fabric.register("money_check", trigger=lambda s,u,c: "oferta" in (u or ""),
                          run=money_run, expected_ms=1000, stall="filler")
    fake = FakeR1(["Voy mirándolo.", "Dime."])
    voice_protocol._anthropic = lambda: fake
    await _drive("¿tienes alguna oferta esta semana?")
    r2 = await _drive("¿y bien?")
    ck("fabric money say PARKS (no figure voiced)", "4,80" not in r2, r2[:80])
    voice_fabric._REGISTRY.pop("money_check", None)

    # 3. fold-in from the spine (recall_refresh rides the rebuild)
    await _clean()
    async with db.scoped_tx(SCOPE) as con:
        await spine.append_event(con, SCOPE, "process.completed", "voice",
                                 {"process":"recall_refresh","say":None,
                                  "fold":{"recall_lines":["— siempre pide burrata los viernes"]},
                                  "money":False}, lane="reasoning")
    fake = FakeR1(["Hola.", "Sí."])
    voice_protocol._anthropic = lambda: fake
    await _drive("hola")                                   # builds pin; offpath rebuild merges fold
    await _drive("¿qué me recomiendas?")
    saw = any("burrata los viernes" in str(c) for c in fake.calls)
    ck("fold enrichment reaches the grounding via the REBUILD (spine, not in-proc)", saw)

    # 4. stall as data
    h_slow = voice_fabric.stall_hint(["order_brain"]); h_fast = voice_fabric.stall_hint(["recall_refresh"])
    ck("stall derives from expected_ms (hum vs micro)", ("mmm" in h_slow or "voz alta" in h_slow) and "veeer" in h_fast)

    await _clean()
    print(f"\nvital_fabric: {sum(R)}/{len(R)} green")
    if not all(R): raise SystemExit(1)

if __name__ == "__main__":
    asyncio.run(main())
