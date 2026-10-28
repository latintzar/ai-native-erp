"""vital_person.py — WP-8b person-layer core (BUILD-PLAN §5 WP-8b): R6 pacing + R8 relationship stage.

R6: a self-started touch keeps human hours — quiet in the night + siesta, and holds to the next window.
R8: the dyad's relationship_stage grows new→courting→settled with the interaction count. Deterministic.
"""
import asyncio
import os
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

for _l in Path("/opt/rocoto/.env").read_text().splitlines() if Path("/opt/rocoto/.env").exists() else []:
    _l = _l.strip()
    if _l and not _l.startswith("#") and "=" in _l:
        _k, _, _v = _l.partition("=")
        os.environ.setdefault(_k.strip(), _v.strip())

import agent_reply
import db
import presence
import runtime
import spine  # noqa: E402

TZ = ZoneInfo("Europe/Madrid")
PHONE = "+34999001212"
SCOPE = runtime.scope_of(PHONE)
R = []


def ck(name, ok, detail=""):
    R.append(bool(ok)); print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


async def main():
    await db.init()

    # R6 pacing (deterministic clock)
    night = datetime(2026, 7, 22, 3, 0, tzinfo=TZ)
    midday = datetime(2026, 7, 22, 12, 0, tzinfo=TZ)
    siesta = datetime(2026, 7, 22, 16, 0, tzinfo=TZ)
    ck("R6: quiet at 03:00 (night)", presence.quiet_now(night) is True)
    ck("R6: NOT quiet at 12:00 (working hours)", presence.quiet_now(midday) is False)
    ck("R6: quiet at 16:00 (siesta)", presence.quiet_now(siesta) is True)
    nxt = presence.next_ok_time(night)
    ck("R6: a night touch is held to the next reasonable window (not quiet)", presence.quiet_now(nxt) is False, nxt.isoformat())

    # R8 relationship stage from interaction count
    async with db.scoped_tx(SCOPE) as con:
        await agent_reply._ensure_scope(con, SCOPE)
        await con.execute("delete from event where scope=$1::ltree", SCOPE)
        st0 = await presence.relationship_stage(con, SCOPE)
        for _ in range(8):
            await spine.append_event(con, SCOPE, "message", "wa", {"text": "hola"})
        st1 = await presence.relationship_stage(con, SCOPE)
        await con.execute("delete from event where scope=$1::ltree", SCOPE)
        await con.execute("delete from scope_node where scope=$1::ltree", SCOPE)
    ck("R8: relationship_stage grows with interaction (new → courting)", st0 == "new" and st1 == "courting", f"{st0}->{st1}")

    passed = sum(R)
    print(f"\nPERSON LAYER: {passed}/{len(R)} passed — {'KEEPS HUMAN HOURS' if passed == len(R) else 'BROKEN'}")
    return 0 if passed == len(R) else 1


raise SystemExit(asyncio.run(main()))
