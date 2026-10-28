"""vital_memory_turn.py — WP-3 THE MEMORY TURN on the live path (BUILD-PLAN §5 WP-3).

The central claim ('como el año pasado') could not fire on a TEXT turn — recall never ran. Proves:
  1. RECALL INJECTION — assemble runs §4.4 recall and injects a ### RECALL slot with the memory.
  2. BYTE-REPLAY     — assemble(assembled_at, qv) is byte-reproducible (the why-hash invariant).
  3. LIVE PATH       — run_turn persists an assembly_snapshot (rendered + why_hash + qv), and `why`
                       replays it verbatim.
  4. R9 COLUMNS      — fact.told_by_this_contact / source_channel exist (additive, for R5 disclosure).

Run on the RLS-ON clone:  PYTHONPATH=. venv/bin/python tests/vital_memory_turn.py
"""
import asyncio
import os
from datetime import datetime, timezone
from pathlib import Path

for _l in Path("/opt/rocoto/.env").read_text().splitlines() if Path("/opt/rocoto/.env").exists() else []:
    _l = _l.strip()
    if _l and not _l.startswith("#") and "=" in _l:
        _k, _, _v = _l.partition("=")
        os.environ.setdefault(_k.strip(), _v.strip())

import agent_reply  # noqa: E402
import assemble as assemble_mod  # noqa: E402
import db  # noqa: E402
import memory  # noqa: E402
import rt_embed  # noqa: E402
import runtime  # noqa: E402

PHONE = "+34999000333"
SCOPE = runtime.scope_of(PHONE)
R = []


def ck(name, ok, detail=""):
    R.append(bool(ok))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


async def _clean():
    async with db.scoped_tx(SCOPE) as con:
        # CHILDREN OF `event` FIRST (timer.armed_by_event · open_loop.opened_by_event ·
        # action.opened_by_event), then `event` itself. Order used to be luck: a run_turn on this
        # scope left no tab behind, so deleting events first happened to work. Since BLOCK B2 every
        # relationship carries a pursuit tab that REFERENCES the transition event that opened it, so
        # the old order trips the foreign key. Children-first is the order that is correct regardless.
        for t in ("assembly_snapshot", "timer", "open_loop", "action", "fact", "summary",
                  "event", "card", "scope_state"):
            await con.execute(f"delete from {t} where scope=$1::ltree", SCOPE)
        await con.execute("delete from scope_node where scope=$1::ltree", SCOPE)


async def _stub_mind(phone, system, msgs, person, lang, place_call_fn=None, egress_stub=False, **kw):
    return {"text": "", "actions": [], "pending_facts": [], "reasoning": "mem-stub", "force_text": False}


async def main():
    await db.init()
    await _clean()
    async with db.scoped_tx(SCOPE) as con:
        await agent_reply._ensure_scope(con, SCOPE)
        # a memory only RECALL can surface (a summary is not on the card).
        await memory.write_summary(con, SCOPE, "En diciembre del año pasado Manolo pidió 200 botes de rocoto para las fiestas.")
        await memory.write_fact(con, SCOPE, "PREFERENCE", "Le gusta el rocoto bien picante.")

    burst = "oye, ¿cuántos botes de rocoto pedí el año pasado para las fiestas?"
    qv = await rt_embed.aembed(burst)

    # 1. recall injection
    async with db.scoped_tx(SCOPE) as con:
        a = await assemble_mod.assemble(con, SCOPE, burst, qv=qv)
    ck("recall injection: assemble emits a ### RECALL slot with the recalled memory",
       "### RECALL" in a["rendered"] and "200 botes" in a["rendered"], a["rendered"][-160:].replace(chr(10), " | "))

    # 2. byte-replay determinism
    T = datetime.now(timezone.utc)
    async with db.scoped_tx(SCOPE) as con:
        b1 = await assemble_mod.assemble(con, SCOPE, burst, assembled_at=T, qv=qv)
        b2 = await assemble_mod.assemble(con, SCOPE, burst, assembled_at=T, qv=qv)
    ck("byte-replay: assemble(assembled_at, qv) is byte-identical (the why-hash invariant)",
       b1["rendered"] == b2["rendered"] and b1["why_hash"] == b2["why_hash"], b1["why_hash"][:12])

    # 3. live path: run_turn persists a snapshot; `why` replays it
    real = agent_reply._run_mind
    agent_reply._run_mind = _stub_mind
    try:
        await runtime.run_turn(PHONE, burst)
    finally:
        agent_reply._run_mind = real
    async with db.control_pool().acquire() as con:
        snap = await con.fetchrow("select rendered, why_hash, qv from assembly_snapshot where scope=$1::ltree "
                                  "order by event_id desc limit 1", SCOPE)
    ck("live path: run_turn persisted an assembly_snapshot (rendered + why_hash + qv)",
       snap is not None and snap["rendered"] and snap["why_hash"] and snap["qv"] is not None,
       (snap["why_hash"][:12] if snap else "none"))
    wtxt = await agent_reply.why(PHONE)
    ck("`why` replays the fold verbatim (RECALL present)", "POR QUÉ" in wtxt and "### RECALL" in wtxt)

    # 4. R9 columns exist
    async with db.control_pool().acquire() as con:
        cols = set(r["column_name"] for r in await con.fetch(
            "select column_name from information_schema.columns where table_name='fact' and table_schema='public'"))
    ck("R9: fact.told_by_this_contact + source_channel columns exist (additive)",
       {"told_by_this_contact", "source_channel"} <= cols)

    await _clean()
    passed = sum(R)
    print(f"\nMEMORY TURN: {passed}/{len(R)} passed — {'RECALL FIRES ON TEXT + REPLAYABLE' if passed == len(R) else 'BROKEN'}")
    return 0 if passed == len(R) else 1


raise SystemExit(asyncio.run(main()))
