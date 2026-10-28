import asyncio
import os
from pathlib import Path

# guarded like every sibling vital: off the box there is no /opt/rocoto/.env, and an unguarded read
# turned this file into a FileNotFoundError before its first assertion — the env is the box's, the
# proof is not.
for line in (Path("/opt/rocoto/.env").read_text().splitlines()
             if Path("/opt/rocoto/.env").exists() else []):
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, _, v = line.partition("="); os.environ.setdefault(k.strip(), v.strip())
import db
import runtime
import spine

SC = "wa.34690001112"

async def main():
    await db.init()
    async with db.scoped_tx(SC) as con:
        for t in ("timer", "open_loop", "event", "card", "scope_node", "fact"):
            await con.execute(f"delete from {t} where scope=$1::ltree", SC)
        await con.execute("insert into scope_node(scope,tier) values($1::ltree,'customer') on conflict do nothing", SC)
        await con.execute("insert into card(scope,body,version) values($1::ltree,'',0) on conflict do nothing", SC)
        eid, _ = await spine.append_event(con, SC, "tab.opened", "runtime", {"kind": "expect"})
        conts = [{"branch_id": "si_silencio", "trigger": "si silencio", "action": {"class": "nudge", "sentence": "¿todo bien?"}}]
        lid = await con.fetchval(
            "insert into open_loop(scope,kind,text,entity_key,status,money,contingencies,opened_by_event) "
            "values($1::ltree,'expect','esperando factura t1','invoice:t1','open',false,$2,$3) returning id", SC, conts, eid)
        await con.execute("insert into timer(scope,loop_id,fires_at,branch_id,state) "
                          "values($1::ltree,$2,now()+interval '1 day','si_silencio','armed')", SC, int(lid))
        await con.execute("insert into open_loop(scope,kind,text,entity_key,status,money) "
                          "values($1::ltree,'issue','disputa de precio t2','invoice:t2','open',true)", SC)
    await runtime.emit_sense(scope=SC, type="stripe.payment", source="stripe", payload={"amt": 100}, entity_key="invoice:t1", dedupe_key="pay-t1")
    await runtime.emit_sense(scope=SC, type="stripe.payment", source="stripe", payload={"amt": 50}, entity_key="invoice:t2", dedupe_key="pay-t2")
    async with db.control_pool().acquire() as con:
        t1 = await con.fetchval("select status from open_loop where scope=$1::ltree and entity_key='invoice:t1'", SC)
        armed = await con.fetchval("select count(*) from timer where scope=$1::ltree and state='armed'", SC)
        t2 = await con.fetchval("select status from open_loop where scope=$1::ltree and entity_key='invoice:t2'", SC)
        esc = await con.fetchval("select count(*) from event where scope=$1::ltree and type='escalate.tab'", SC)
    ok1 = (t1 == "resolved" and (armed or 0) == 0)
    ok2 = (t2 == "open" and (esc or 0) >= 1)
    print(f"[{'PASS' if ok1 else 'FAIL'}] non-money tab resolved by payment + timers cancelled: status={t1} armed={armed}")
    print(f"[{'PASS' if ok2 else 'FAIL'}] money tab escalates (never auto-fires): status={t2} escalate.tab={esc}")
    async with db.scoped_tx(SC) as con:
        for t in ("timer", "open_loop", "event", "card", "scope_node", "fact"):
            await con.execute(f"delete from {t} where scope=$1::ltree", SC)
    print("CASCADE:", "PASS" if (ok1 and ok2) else "FAIL")

asyncio.run(main())
