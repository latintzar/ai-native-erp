"""vital_tab_dossier.py — WP-9 the Sherlock dossier: open a tab (scenarios + opening event + entity_key),
add a related case event, resolve it — the dossier returns tab · scenarios · opened_by · closed_by ·
timers · case tree. Deterministic, no LLM."""
import asyncio
import json
import os
from pathlib import Path

for _l in Path("/opt/rocoto/.env").read_text().splitlines() if Path("/opt/rocoto/.env").exists() else []:
    _l=_l.strip()
    if _l and not _l.startswith("#") and "=" in _l:
        k,_,v=_l.partition("="); os.environ.setdefault(k.strip(),v.strip())
import control_room  # noqa: E402
import db
import spine

SCOPE="wa.34977000222"; R=[]
def ck(n,ok,d=""):
    R.append(bool(ok)); print(f"  [{'PASS' if ok else 'FAIL'}] {n}"+(f" — {d}" if d else ""))
async def _clean():
    async with db.scoped_tx(SCOPE) as con:
        for t in ("timer","open_loop","event"):
            await con.execute(f"delete from {t} where scope=$1::ltree", SCOPE)
async def main():
    await db.init(); await _clean()
    async with db.scoped_tx(SCOPE) as con:
        oe,_=await spine.append_event(con, SCOPE, "message","twilio_wa",
            {"text":"¿cuándo llega mi pedido?","entity_key":"order:555"}, lane="world", actor="human")
        conts=[{"branch_id":"delivered","trigger":"webhook delivery.dispatched","action":"avisar","prediction":"sale hoy","gated":False}]
        tid=await con.fetchval(
            "insert into open_loop(scope,kind,text,status,entity_key,contingencies,answer_shape,opened_at,opened_by_event,money) "
            "values($1::ltree,'seguimiento','¿dónde está el pedido 555?','open','order:555',$2::jsonb,'date',now(),$3,false) returning id",
            SCOPE, json.dumps(conts), oe)
        await spine.append_event(con, SCOPE, "delivery.dispatched","medusa",
            {"entity_key":"order:555","text":"pedido despachado"}, lane="world")
        await spine.append_event(con, SCOPE, "tab.resolved","runtime", {"loop_id":tid}, lane="reasoning")
        await con.execute("update open_loop set status='resolved',resolved_at=now(),resolution=$1::jsonb where id=$2", json.dumps("entregado"), tid)
    d=await control_room.tab_dossier(SCOPE, tid)
    ck("dossier ok + tab", d.get("ok") and d["tab"]["entity_key"]=="order:555", str(d.get("error")))
    ck("scenarios (contingencies) present", len(d.get("scenarios",[]))==1 and d["scenarios"][0]["branch_id"]=="delivered")
    ck("opened_by = the triggering message", d.get("opened_by") and "cuándo llega" in (d["opened_by"].get("text") or ""))
    ck("closed_by = tab.resolved", d.get("closed_by") and d["closed_by"]["type"]=="tab.resolved")
    ck("case tree links the dispatch by entity_key", any(e["type"]=="delivery.dispatched" for e in d.get("case",[])))
    await _clean()
    print(f"\nvital_tab_dossier: {sum(R)}/{len(R)} green")
    if not all(R): raise SystemExit(1)
if __name__=="__main__": asyncio.run(main())
