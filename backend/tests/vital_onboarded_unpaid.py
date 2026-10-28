"""vital_onboarded_unpaid.py — WP-8 the embedded-call lifecycle stage. Deterministic, no LLM.
Catalogue loaded + wizard row with paid_at NULL + prospect tier → stage 'onboarded_unpaid' with the
'already embedded, ask for the fee once' notes; paying flips it to 'onboarded'.
"""
import asyncio
import os
from pathlib import Path

for _l in Path("/opt/rocoto/.env").read_text().splitlines() if Path("/opt/rocoto/.env").exists() else []:
    _l=_l.strip()
    if _l and not _l.startswith("#") and "=" in _l:
        k,_,v=_l.partition("="); os.environ.setdefault(k.strip(),v.strip())
import config  # noqa: E402
import db
import lifecycle

PH="+34988000111"; SCOPE="wa.34988000111"; TEN=config.BRAIN_TENANT; R=[]
def ck(n,ok,d=""):
    R.append(bool(ok)); print(f"  [{'PASS' if ok else 'FAIL'}] {n}"+(f" — {d}" if d else ""))
async def _clean():
    pool=db.get_pool()
    async with pool.acquire() as con:
        await con.execute("delete from catalogue_skus where id='vou:1'")
        await con.execute("delete from onboarding_progress where token='vou-tok'")
        await con.execute("delete from onboarding_tokens where token='vou-tok'")
        await con.execute("delete from leads where phone=$1", PH)
async def main():
    await db.init(); await _clean()
    pool=db.get_pool()
    async with pool.acquire() as con:
        await con.execute("insert into catalogue_skus(id,tenant_id,name,base_unit,price) values('vou:1',$1,'Tomate','kg',2.0)", TEN)
        lid=await con.fetchval("insert into leads(id,phone,name,business) values(gen_random_uuid()::text,$1,'Ana','Bar Ana') returning id", PH)
        await con.execute("insert into onboarding_tokens(token,lead_id) values('vou-tok',$1)", lid)
        await con.execute("insert into onboarding_progress(token,step,paid_at) values('vou-tok',5,null)")
    st=await lifecycle.status(SCOPE,"prospect")
    ck("catalogue+unpaid+prospect → onboarded_unpaid", st["stage"]=="onboarded_unpaid", st["stage"])
    ck("notes carry the founding offer (credit against commission)", "500" in lifecycle.notes(st) and "comisi" in lifecycle.notes(st))
    async with pool.acquire() as con:
        await con.execute("update onboarding_progress set paid_at=now() where token='vou-tok'")
    st2=await lifecycle.status(SCOPE,"prospect")
    ck("paying flips to onboarded", st2["stage"]=="onboarded", st2["stage"])
    await _clean()
    print(f"\nvital_onboarded_unpaid: {sum(R)}/{len(R)} green")
    if not all(R): raise SystemExit(1)
if __name__=="__main__": asyncio.run(main())
