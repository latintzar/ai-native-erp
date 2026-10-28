"""vital_testworld.py — THE LAB (WP-8/§13): create_test_world builds a fake tenant WITH PRODUCTS + a
distilled directory + restaurant customers; clone_anonymize produces a safe anonymized test subject.
LLM stubbed → deterministic."""
import asyncio
import os
from pathlib import Path

for _l in Path("/opt/rocoto/.env").read_text().splitlines() if Path("/opt/rocoto/.env").exists() else []:
    _l=_l.strip()
    if _l and not _l.startswith("#") and "=" in _l:
        k,_,v=_l.partition("="); os.environ.setdefault(k.strip(),v.strip())
import control_room
import db

R=[]
def ck(n,ok,d=""):
    R.append(bool(ok)); print(f"  [{'PASS' if ok else 'FAIL'}] {n}"+(f" — {d}" if d else ""))
class Stub:
    def __init__(s,payload): s._p=payload
    def __call__(s,*a,**k): return s
    @property
    def messages(s):
        outer=s
        class M:
            async def create(m,**kw):
                class B: type="text"
                b=B(); b.text=outer._p
                class Rp: content=[b]
                return Rp()
        return M()
async def main():
    await db.init()
    import anthropic
    # 1. test world with products
    anthropic.AsyncAnthropic = Stub('{"boss":{"name":"Ana","business":"Verduras Ana"},"products":[{"name":"Tomate rama","family":"verdura","unit":"kg","price":2.4},{"name":"Lechuga","family":"verdura","unit":"unit","price":0.9}],"customers":[{"name":"Bar Pepe","business":"Bar","fact":"pide los lunes"},{"name":"Rest Sol","business":"Restaurante","fact":"debe 120e"}]}')
    w=await control_room.create_test_world("un mayorista de verduras en Valencia")
    ck("test-world created (tenant+products+customers)", w.get("ok") and w.get("products")==2 and w.get("customers")==2, str(w))
    pool=db.get_pool()
    async with pool.acquire() as con:
        nsk=await con.fetchval("select count(*) from catalogue_skus where tenant_id=$1", w.get("tenant"))
        dirbody=await con.fetchval("select body from catalogue_directory where tenant_id=$1", w.get("tenant"))
    ck("products landed in the fake tenant's catalogue", (nsk or 0)==2, f"skus={nsk}")
    ck("directory distilled for the fake tenant", dirbody and "Tomate rama" in dirbody)
    # 2. clone-anonymize
    anthropic.AsyncAnthropic = Stub('{"name":"Cliente X","business":"Negocio X","facts":[{"kind":"COMMERCIAL","text":"debe 90e"},{"kind":"RHYTHM","text":"pide los martes"}]}')
    async with db.scoped_tx(w["scope"]+".c.1") as con: pass
    cl=await control_room.clone_anonymize(w["scope"]+".c.1")
    ck("clone produced an anonymized test scope", cl.get("ok") and cl.get("facts")==2 and cl["scope"].startswith("test.clone."), str(cl))
    # cleanup
    async with pool.acquire() as con:
        await con.execute("delete from catalogue_skus where tenant_id=$1", w.get("tenant"))
        await con.execute("delete from catalogue_directory where tenant_id=$1", w.get("tenant"))
    print(f"\nvital_testworld: {sum(R)}/{len(R)} green")
    if not all(R): raise SystemExit(1)
if __name__=="__main__": asyncio.run(main())
