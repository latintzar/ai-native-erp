"""vital_directory.py — THE SUPPLIER-CARD PRODUCT DIRECTORY vital (WP-4, §6).
  1. BUILD — seeded SKUs distill into a budget-bounded directory (verbatim path).
  2. IDEMPOTENT — an unchanged SKU set never re-distills (sku_hash).
  3. TIER-0 IN VOICE — «¿tenéis tomates cherry?» answered INLINE; the grounding carries CATALOGUE
     (zero catalogue lookup on the reply path — the knowledge is pinned).
  4. CHAT FOLD — assemble carries ### CATALOGUE (spliced by the §6 skus_uploaded box).
  5. GRACEFUL COMPACTION — 300 SKUs stay bounded by dropping a tier (the §5.10.1 ladder itself,
     with its brackets and its honesty invariants, is tests/vital_directory_tiers.py).
Run on the clone: PYTHONPATH=. venv/bin/python tests/vital_directory.py
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
import assemble as assemble_mod  # noqa: E402
import config
import db
import directory
import voice_protocol

PHONE, DIGITS = "+34999000786", "34999000786"
SCOPE = f"wa.{DIGITS}"
TEN = config.BRAIN_TENANT
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

SKUS = [("vitaldir:1","Tomate cherry rama","verdura","kg",3.4), ("vitaldir:2","Burrata 125g","lácteo","unit",2.1),
        ("vitaldir:3","Jamón ibérico","charcutería","kg",28.0), ("vitaldir:4","Queso manchego","lácteo","kg",14.5)]

async def _seed(rows):
    pool = db.get_pool()
    async with pool.acquire() as con:
        await directory.ensure_schema(con)
        for i, n, f, u, p in rows:
            await con.execute(
                "insert into catalogue_skus(id,tenant_id,name,family,base_unit,price) values($1,$2,$3,$4,$5,$6) "
                "on conflict (id) do update set name=excluded.name, price=excluded.price", i, TEN, n, f, u, p)

async def _cleanup():
    pool = db.get_pool()
    async with pool.acquire() as con:
        await con.execute("delete from catalogue_skus where id like 'vitaldir:%'")
        await con.execute("delete from catalogue_directory where tenant_id=$1", TEN)
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
    await _cleanup()
    # 1. build
    await _seed(SKUS)
    r = await directory.build(TEN)
    ck("build distills seeded SKUs", r.get("built") and r.get("n_skus") == 4, str(r))
    pool = db.get_pool()
    async with pool.acquire() as con:
        body = await con.fetchval("select body from catalogue_directory where tenant_id=$1", TEN) or ""
    ck("body verbatim within budget", "Tomate cherry rama" in body and len(body.encode()) <= directory.CEILING,
       f"bytes={len(body.encode())}")
    # 2. idempotent
    r2 = await directory.build(TEN)
    ck("unchanged SKU set never re-distills", (not r2.get("built")) and r2.get("reason") == "unchanged", str(r2))
    # 3. Tier-0 in voice — inline answer, grounding carries the catalogue
    fake = FakeR1(["¡Sí! Tomate cherry en rama tenemos, a diario."])
    voice_protocol._anthropic = lambda: fake
    reply = await _drive("¿tenéis tomates cherry?")
    ck("catalogue question answered INLINE (no deferral)", "cherry" in reply.lower() and "déjame" not in reply.lower(), reply[:70])
    saw = any("CATALOGUE" in str(c) and "cherry" in str(c).lower() for c in fake.calls)
    ck("grounding carried the pinned CATALOGUE block", saw)
    # 4. chat fold
    async with db.scoped_tx(SCOPE) as con:
        fold = await assemble_mod.assemble(con, SCOPE, "hola")
    ck("chat fold carries ### CATALOGUE", "### CATALOGUE" in fold.get("rendered", ""))
    # 5. graceful compaction at 300 SKUs — §5.10.1 replaced the single "over budget → family rollup"
    # step with the four-tier ladder, so this asserts the CONTRACT (bounded, compacted, and every
    # family still named) rather than the old body's wording. The ladder itself is
    # tests/vital_directory_tiers.py.
    big = [(f"vitaldir:b{i}", f"Producto {i:03d}", f"fam{i % 7}", "kg", 1.0 + i % 9) for i in range(300)]
    await _seed(big)
    r3 = await directory.build(TEN)
    async with pool.acquire() as con:
        body3 = await con.fetchval("select body from catalogue_directory where tenant_id=$1", TEN) or ""
    ck("300-SKU catalogue stays bounded and compacts a tier",
       r3.get("built") and len(body3.encode()) <= directory.CEILING and r3.get("tier") in ("B", "C", "D")
       and all(f"FAM{i}" in body3 for i in range(7)),
       f"tier={r3.get('tier')} bytes={len(body3.encode())}/{directory.CEILING}")
    await _cleanup()
    print(f"\nvital_directory: {sum(R)}/{len(R)} green")
    if not all(R): raise SystemExit(1)

if __name__ == "__main__":
    asyncio.run(main())
