"""vital_hoy.py — WP-11 the «HOY» digest (BUILD-PLAN §5 WP-11): the boss's daily what-needs-me,
cross-scope. Proves the digest counts pending money approvals, open money tabs, and overdue chases.
(Voice warm-transfer/conference is class-D PARKED — it needs a real phone call with Peter.)
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
import runtime
import spine  # noqa: E402

PHONE = "+34999001414"
SCOPE = runtime.scope_of(PHONE)
R = []


def ck(name, ok, detail=""):
    R.append(bool(ok)); print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


async def _clean():
    async with db.scoped_tx(SCOPE) as con:
        for t in ("action", "timer", "open_loop", "event", "card", "scope_state"):
            await con.execute(f"delete from {t} where scope=$1::ltree", SCOPE)
        await con.execute("delete from scope_node where scope=$1::ltree", SCOPE)


async def main():
    await db.init()
    await _clean()
    base = await runtime.hoy_digest()
    async with db.scoped_tx(SCOPE) as con:
        await agent_reply._ensure_scope(con, SCOPE)
        await con.execute("insert into action(scope,kind,state,needs_human,money) "
                          "values($1::ltree,'concession','pending',true,true)", SCOPE)
        eid, _ = await spine.append_event(con, SCOPE, "tab.opened", "runtime", {"kind": "factura"})
        conts = [{"branch_id": "si_silencio", "trigger": "x", "action": {"class": "nudge", "sentence": "¿la factura?"}}]
        lid = await con.fetchval(
            "insert into open_loop(scope,kind,text,status,money,due_at,contingencies,opened_by_event) "
            "values($1::ltree,'factura','debe 200€','open',true, now() - interval '1 day',$2,$3) returning id",
            SCOPE, conts, eid)
        await con.execute("insert into timer(scope,loop_id,fires_at,branch_id,state) "
                          "values($1::ltree,$2, now()-interval '1 day','si_silencio','armed')", SCOPE, int(lid))

    d = await runtime.hoy_digest()
    ck("«HOY»: a pending money approval is counted", d["approvals_waiting"] >= base["approvals_waiting"] + 1, str(d))
    ck("«HOY»: an open money tab is counted", d["open_money_tabs"] >= base["open_money_tabs"] + 1)
    ck("«HOY»: an overdue chase is counted", d["overdue_chases"] >= base["overdue_chases"] + 1)

    await _clean()
    passed = sum(R)
    print(f"\nHOY DIGEST: {passed}/{len(R)} passed — {'THE BOSS SEES WHAT NEEDS HIM' if passed == len(R) else 'BROKEN'}")
    return 0 if passed == len(R) else 1


raise SystemExit(asyncio.run(main()))
