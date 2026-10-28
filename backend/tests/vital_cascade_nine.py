"""vital_cascade_nine.py — WP-6 cascade tab-actions (BUILD-PLAN §5 WP-6).

The reflex layer had 4 of the 9 tab actions (open, resolve, fire-nudge, escalate). This proves the
newly-added UPDATE-IN-PLACE and RESCHEDULE actions (the mind can amend an open tab instead of churning
a new one), each leaving a tab.updated event and moving the timer with the tab (arm-together kept).

(resolve / escalate / matched-money re-wake are covered by vital_cascade + vital_stripe_spine + vital_wake.)

Run on the RLS-ON clone:  PYTHONPATH=. venv/bin/python tests/vital_cascade_nine.py
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

PHONE = "+34999000666"
SCOPE = runtime.scope_of(PHONE)
R = []


def ck(name, ok, detail=""):
    R.append(bool(ok))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


async def _clean():
    async with db.scoped_tx(SCOPE) as con:
        for t in ("timer", "open_loop", "event", "card", "scope_state"):
            await con.execute(f"delete from {t} where scope=$1::ltree", SCOPE)
        await con.execute("delete from scope_node where scope=$1::ltree", SCOPE)


async def main():
    await db.init()
    await _clean()
    async with db.scoped_tx(SCOPE) as con:
        await agent_reply._ensure_scope(con, SCOPE)

    lid = await agent_reply._do_open_tab(PHONE, "pending", "mandar el presupuesto", 3.0, "¿pudiste verlo?", "free")
    ck("baseline: a tab is open with an armed timer", lid is not None)

    # update-in-place
    ok1 = await agent_reply._do_update_tab(PHONE, lid, new_text="mandar el presupuesto REVISADO con el 5% dto")
    async with db.control_pool().acquire() as con:
        txt = await con.fetchval("select text from open_loop where id=$1", int(lid))
        status = await con.fetchval("select status from open_loop where id=$1", int(lid))
        upd = await con.fetchval("select count(*) from event where scope=$1::ltree and type='tab.updated'", SCOPE)
    ck("update-in-place: tab text amended, tab stays open, tab.updated event",
       ok1 and "REVISADO" in (txt or "") and status == "open" and (upd or 0) >= 1, f"text={txt!r} status={status}")

    # reschedule (timer moves with the tab)
    async with db.control_pool().acquire() as con:
        due_before = await con.fetchval("select fires_at from timer where loop_id=$1 and state='armed'", int(lid))
    ok2 = await agent_reply._do_update_tab(PHONE, lid, follow_up_days=10.0)
    async with db.control_pool().acquire() as con:
        due_after = await con.fetchval("select fires_at from timer where loop_id=$1 and state='armed'", int(lid))
    ck("reschedule: the tab's chase timer moved (arm-together kept)",
       ok2 and due_after is not None and due_before is not None and due_after > due_before, f"moved={due_before}→{due_after}")

    await _clean()
    passed = sum(R)
    print(f"\nCASCADE NINE (update/reschedule): {passed}/{len(R)} passed — {'AMEND WORKS' if passed == len(R) else 'BROKEN'}")
    return 0 if passed == len(R) else 1


raise SystemExit(asyncio.run(main()))
