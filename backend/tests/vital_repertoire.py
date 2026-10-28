"""vital_repertoire.py — WP-7b THE REPERTOIRE (BUILD-PLAN §5 WP-7b / SPEC §16.6).

Situations are DATA: each repertoire behavior is a manifest_duty ROW bound by the ONE generic binder —
zero Python per situation. Proves the three seeded L0 defaults (confirm_delivery, reorder_reminder,
chase_quote) each OPEN a tab with a pre-armed chase timer when their opens_on sense arrives.
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
import duties  # noqa: E402
import runtime  # noqa: E402
import spine  # noqa: E402

PHONE = "+34999000999"
SCOPE = runtime.scope_of(PHONE)
R = []

CASES = [
    ("confirm_delivery", "order.placed", {"order_id": "O1"}, "order:O1"),
    ("reorder_reminder", "reorder.due", {"customer": "BarPaco"}, "reorder:BarPaco"),
    ("chase_quote", "quote.sent", {"quote_id": "Q9"}, "quote:Q9"),
]


def ck(name, ok, detail=""):
    R.append(bool(ok))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


async def main():
    await db.init()
    duties.invalidate_cache()
    async with db.scoped_tx(SCOPE) as con:
        await agent_reply._ensure_scope(con, SCOPE)
        for t in ("timer", "open_loop", "event"):
            await con.execute(f"delete from {t} where scope=$1::ltree", SCOPE)

    async with db.control_pool().acquire() as con:
        seeded = await con.fetchval("select count(*) from manifest_duty where scope='peter' "
                                    "and name = any($1::text[]) and enabled",
                                    [c[0] for c in CASES])
    ck("the 3 repertoire situations are seeded as manifest_duty rows (L0 defaults)", seeded == 3, f"seeded={seeded}")

    for duty, event, payload, ekey in CASES:
        async with db.scoped_tx(SCOPE) as con:
            eid, _ = await spine.append_event(con, SCOPE, event, "test", payload)
            await duties.react_to_sense(con, SCOPE, event, payload)
        async with db.control_pool().acquire() as con:
            tab = await con.fetchrow("select id from open_loop where scope=$1::ltree and entity_key=$2 "
                                     "and status='open'", SCOPE, ekey)
            armed = await con.fetchval("select count(*) from timer t join open_loop l on l.id=t.loop_id "
                                       "where l.scope=$1::ltree and l.entity_key=$2 and t.state='armed'", SCOPE, ekey)
        ck(f"'{duty}' binds from its ROW alone: {event} -> tab ({ekey}) + a pre-armed chase",
           tab is not None and (armed or 0) >= 1, f"tab={tab['id'] if tab else None} armed={armed}")

    async with db.scoped_tx(SCOPE) as con:
        for t in ("timer", "open_loop", "event"):
            await con.execute(f"delete from {t} where scope=$1::ltree", SCOPE)
        await con.execute("delete from scope_node where scope=$1::ltree", SCOPE)

    passed = sum(R)
    print(f"\nREPERTOIRE: {passed}/{len(R)} passed — {'SITUATIONS ARE DATA' if passed == len(R) else 'BROKEN'}")
    return 0 if passed == len(R) else 1


raise SystemExit(asyncio.run(main()))
