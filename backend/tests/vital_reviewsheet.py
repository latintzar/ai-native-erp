"""vital_reviewsheet.py — WP-2 REVIEW-SHEET v0 (BUILD-PLAN §5 WP-2). The money surface.

Proves the needs_human inbox round-trip:
  park → list → approve → resume(wake queued) → gone-from-inbox, plus the reject path and the
  double-approve/stale idempotency guard (approving an already-resolved action is a safe no-op).

Run on the RLS-ON clone:  PYTHONPATH=. venv/bin/python tests/vital_reviewsheet.py
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
import runtime  # noqa: E402

PHONE = "+34999000222"
SCOPE = runtime.scope_of(PHONE)
R = []


def ck(name, ok, detail=""):
    R.append(bool(ok))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


async def _clean():
    async with db.scoped_tx(SCOPE) as con:
        for t in ("wake", "action", "event", "card", "scope_state"):
            await con.execute(f"delete from {t} where scope=$1::ltree", SCOPE)
        await con.execute("delete from scope_node where scope=$1::ltree", SCOPE)


async def _park(reason, money=True):
    async with db.scoped_tx(SCOPE) as con:
        return await con.fetchval(
            "insert into action(scope,kind,payload,state,reason,needs_human,money) "
            "values($1::ltree,'concession','{\"draft\":\"te lo dejo a 2,10\"}'::jsonb,'pending',$2,true,$3) "
            "returning id", SCOPE, reason, money)


async def _state(aid):
    async with db.control_pool().acquire() as con:
        return await con.fetchval("select state from action where id=$1", int(aid))


async def _wakes():
    async with db.control_pool().acquire() as con:
        return await con.fetchval("select count(*) from wake where scope=$1::ltree and reason='approval' and state='armed'", SCOPE)


async def main():
    await db.init()
    await _clean()
    async with db.scoped_tx(SCOPE) as con:
        await agent_reply._ensure_scope(con, SCOPE)

    aid = await _park("descuento 10% en pedido grande")
    items = await runtime.review_list()
    mine = [i for i in items if i["id"] == aid]
    ck("park → list: the parked concession appears in the needs_human inbox (money-flagged)",
       len(mine) == 1 and mine[0]["money"], f"found={len(mine)}")

    out = await runtime.resolve_action(int(aid), "approved", "vale, dale")
    st = await _state(aid)
    wk = await _wakes()
    ck("approve: flips action→approved + arms the resume (approval) wake",
       out.get("decision") == "approved" and st == "approved" and wk >= 1, f"state={st} wakes={wk}")

    items2 = await runtime.review_list()
    ck("resolved action leaves the inbox", not any(i["id"] == aid for i in items2))

    out2 = await runtime.resolve_action(int(aid), "approved", "otra vez")
    wk2 = await _wakes()
    ck("double-approve/stale is idempotent (no second wake, no crash)",
       out2.get("already") == "approved" and wk2 == wk, f"already={out2.get('already')} wakes={wk2}")

    # reject path
    bid = await _park("crédito a 30 días", money=True)
    outr = await runtime.resolve_action(int(bid), "rejected", "no, que pague ya")
    ck("reject: flips action→rejected + arms the resume wake", outr.get("decision") == "rejected" and await _state(bid) == "rejected")

    await _clean()
    passed = sum(R)
    print(f"\nREVIEW SHEET: {passed}/{len(R)} passed — {'THE MONEY INBOX WORKS' if passed == len(R) else 'BROKEN'}")
    return 0 if passed == len(R) else 1


raise SystemExit(asyncio.run(main()))
