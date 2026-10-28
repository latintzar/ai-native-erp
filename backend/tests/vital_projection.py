"""vital_projection.py — WP-9 P0: the OUTBOUND projector + zero-divergence reconciler (BUILD-PLAN §5 WP-9).

The worker's proactive chases were INVISIBLE in the SyP app (they never projected). Proves: a spine
msg.sent projects into whatsapp_messages, the reconciler reports ZERO divergence, and the projection is
idempotent on event_id (a replay writes no second row).
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
import config
import db
import projector
import runtime
import spine  # noqa: E402

PHONE = "+34999001313"
SCOPE = runtime.scope_of(PHONE)
R = []


def ck(name, ok, detail=""):
    R.append(bool(ok)); print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


async def _cleanup():
    import asyncpg
    con = await asyncpg.connect(config.DATABASE_URL)
    try:
        await con.execute("delete from whatsapp_messages where phone_number=$1", PHONE)
    finally:
        await con.close()
    async with db.scoped_tx(SCOPE) as con:
        await con.execute("delete from event where scope=$1::ltree", SCOPE)
        await con.execute("delete from scope_node where scope=$1::ltree", SCOPE)


async def main():
    await db.init()
    await _cleanup()
    async with db.scoped_tx(SCOPE) as con:
        await agent_reply._ensure_scope(con, SCOPE)
        eid, _ = await spine.append_event(con, SCOPE, "msg.sent", "wa", {"text": "¿pudiste ver lo del pedido?"})

    await projector.project_msg_sent(SCOPE, "¿pudiste ver lo del pedido?", "sid1", eid)
    rec = await projector.reconcile(SCOPE)
    ck("a proactive msg.sent PROJECTS into the app + reconciler shows ZERO divergence",
       rec["events"] >= 1 and rec["projected"] >= 1 and rec["divergence"] == 0, str(rec))

    # idempotent on event_id — a replay writes no second row
    await projector.project_msg_sent(SCOPE, "¿pudiste ver lo del pedido?", "sid1", eid)
    rec2 = await projector.reconcile(SCOPE)
    ck("the projection is idempotent on event_id (replay = no second row)",
       rec2["projected"] == rec["projected"] and rec2["divergence"] == 0, str(rec2))

    await _cleanup()
    passed = sum(R)
    print(f"\nPROJECTION: {passed}/{len(R)} passed — {'PROACTIVE SENDS ARE VISIBLE (zero divergence)' if passed == len(R) else 'BROKEN'}")
    return 0 if passed == len(R) else 1


raise SystemExit(asyncio.run(main()))
