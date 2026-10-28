"""vital_wake.py — WP-1 THE WAKE SPINE (BUILD-PLAN §5 WP-1). Deterministic (stubbed mind).

Proves the missing nerve end-to-end:
  1. PRODUCER   — a matched-money event appends escalate.tab AND arms an escalate wake.
  2. DEDUPE     — N producers on the same tab collapse to EXACTLY one armed wake.
  3. CONSUMER   — the worker's wake scan fires a fresh R1 wake-turn (SILENCE allowed) → wake 'fired'.
  4. ABSORB     — a live chat turn subsumes a party's pending wakes (one party, one voice).
  5. APPROVAL   — resolve_action flips the action + appends action.approved + arms an approval wake.
  6. TAKEOVER   — set_takeover mutes/unmutes (first writers) + handback arms a takeover_end wake.
  7. DOUBLE-FIRE— a RETIRED pending_turn is never re-fired; a genuinely-unanswered one IS.

Run on the RLS-ON clone:  PYTHONPATH=. venv/bin/python tests/vital_wake.py
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
import cascade  # noqa: E402
import db  # noqa: E402
import runtime  # noqa: E402
import spine  # noqa: E402
import worker  # noqa: E402

PHONE = "+34999000789"
SCOPE = runtime.scope_of(PHONE)
R = []


def ck(name, ok, detail=""):
    R.append(bool(ok))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


async def _stub_mind(phone, system, msgs, person, lang, place_call_fn=None, egress_stub=False, **kw):
    return {"text": "", "actions": [], "pending_facts": [], "reasoning": "wake-stub: nada que hacer", "force_text": False}


async def _clean():
    async with db.scoped_tx(SCOPE) as con:
        for t in ("wake", "timer", "open_loop", "event", "fact", "summary", "card", "scope_state",
                  "pending_turn", "action"):
            await con.execute(f"delete from {t} where scope=$1::ltree", SCOPE)
        cid = await con.fetchval("select c.id from endpoint e join contact c on c.id=e.contact_id "
                                 "where e.kind='wa' and e.addr=$1", PHONE)
        if cid:
            await con.execute("delete from endpoint where contact_id=$1", int(cid))
            await con.execute("delete from contact_role where contact_id=$1", int(cid))
            await con.execute("delete from contact where id=$1", int(cid))
        await con.execute("delete from scope_node where scope=$1::ltree", SCOPE)


async def _count(sql):
    async with db.control_pool().acquire() as con:
        return await con.fetchval(sql, SCOPE)


async def main():
    await db.init()
    await _clean()
    async with db.scoped_tx(SCOPE) as con:
        await agent_reply._ensure_scope(con, SCOPE)

    # 1 + 2. producer + dedupe
    await agent_reply._do_open_tab(PHONE, "factura", "Factura #A1 pendiente 200€", 3.0, "¿Pagaste la #A1?", "money")
    async with db.scoped_tx(SCOPE) as con:
        await con.execute("update open_loop set entity_key='inv:A1', money=true where scope=$1::ltree and status='open'", SCOPE)
        e1, _ = await spine.append_event(con, SCOPE, "message", "test", {"text": "pago inv:A1"})
        await cascade.on_nonmessage_event(con, SCOPE, e1, "payment", "inv:A1", {})
    armed1 = await _count("select count(*) from wake where scope=$1::ltree and reason='escalate' and state='armed'")
    ck("producer: matched-money appends escalate.tab AND arms an escalate wake", armed1 == 1, f"armed={armed1}")

    async with db.scoped_tx(SCOPE) as con:
        e2, _ = await spine.append_event(con, SCOPE, "message", "test", {"text": "pago inv:A1 otra vez"})
        await cascade.on_nonmessage_event(con, SCOPE, e2, "payment", "inv:A1", {})
    armed2 = await _count("select count(*) from wake where scope=$1::ltree and reason='escalate' and state='armed'")
    ck("dedupe: N producers collapse to EXACTLY one armed wake", armed2 == 1, f"armed={armed2}")

    # 3. consumer (stub the mind for determinism)
    real_mind = agent_reply._run_mind
    agent_reply._run_mind = _stub_mind
    try:
        await worker.run_wake_once(db.control_pool())
        fired = await _count("select count(*) from wake where scope=$1::ltree and state='fired'")
        wturn = await _count("select count(*) from event where scope=$1::ltree and lane='reasoning' and payload->>'text' like 'wake-stub%'")
        ck("consumer: wake scan fires a wake-turn → wake 'fired' + a wake-turn reasoning event",
           fired >= 1 and wturn >= 1, f"fired={fired} wake_turn_events={wturn}")

        # 4. absorb
        async with db.scoped_tx(SCOPE) as con:
            await spine.arm_wake(con, SCOPE, "escalate", {}, dedupe_key="tab:absorb")
        await runtime.run_turn(PHONE, "hola, una pregunta rápida")
        absorbed = await _count("select count(*) from wake where scope=$1::ltree and state='absorbed'")
        ck("absorb: a live chat turn subsumes pending wakes", absorbed >= 1, f"absorbed={absorbed}")

        # 5. approval
        async with db.scoped_tx(SCOPE) as con:
            aid = await con.fetchval("insert into action(scope,kind,state,needs_human,money) "
                                     "values($1::ltree,'concession','pending',true,true) returning id", SCOPE)
        await runtime.resolve_action(int(aid), "approved", "dale")
        appr_evt = await _count("select count(*) from event where scope=$1::ltree and type='action.approved'")
        appr_wake = await _count("select count(*) from wake where scope=$1::ltree and reason='approval' and state='armed'")
        async with db.control_pool().acquire() as con:
            st = await con.fetchval("select state from action where id=$1", int(aid))
        ck("approval: resolve_action flips the action + approved event + approval wake",
           appr_evt >= 1 and appr_wake >= 1 and st == "approved", f"evt={appr_evt} wake={appr_wake} state={st}")

        # 6. takeover
        await runtime.set_takeover(SCOPE, True)
        muted_on = await runtime.is_muted(SCOPE)
        await runtime.set_takeover(SCOPE, False)
        muted_off = await runtime.is_muted(SCOPE)
        to_wake = await _count("select count(*) from wake where scope=$1::ltree and reason='takeover_end'")
        ck("takeover: mute on/off (first writers) + handback arms a takeover_end wake",
           muted_on and not muted_off and to_wake >= 1, f"on={muted_on} off={muted_off} wake={to_wake}")

        # 7a. double-fire fix: a RETIRED pending_turn is NOT re-fired
        async with db.scoped_tx(SCOPE) as con:
            await con.execute("delete from pending_turn where scope=$1::ltree", SCOPE)
            await con.execute("delete from event where scope=$1::ltree and type='msg.sent'", SCOPE)
            await spine.upsert_pending_turn(con, SCOPE, -300)   # armed, 300s overdue
            await spine.retire_pending_turn(con, SCOPE)          # the live handler retired it → 'fired'
        fired_bs = await worker.run_pending_backstop(db.control_pool())
        ck("double-fire fix: a RETIRED pending_turn is NOT re-fired by the backstop", fired_bs == 0, f"fired={fired_bs}")

        # 7b. the backstop DOES fire a genuinely-unanswered overdue turn
        async with db.scoped_tx(SCOPE) as con:
            await con.execute("delete from pending_turn where scope=$1::ltree", SCOPE)
            await con.execute("delete from event where scope=$1::ltree and type='msg.sent'", SCOPE)
            await spine.append_event(con, SCOPE, "message", "test", {"text": "¿me lees? sigo esperando"})
            await spine.upsert_pending_turn(con, SCOPE, -300)   # armed, overdue, unanswered
        fired_bs2 = await worker.run_pending_backstop(db.control_pool())
        ck("backstop DOES fire a genuinely-unanswered overdue turn", fired_bs2 >= 1, f"fired={fired_bs2}")
    finally:
        agent_reply._run_mind = real_mind

    await _clean()
    passed = sum(R)
    print(f"\nWAKE SPINE: {passed}/{len(R)} passed — {'THE NERVE IS WIRED' if passed == len(R) else 'BROKEN'}")
    return 0 if passed == len(R) else 1


raise SystemExit(asyncio.run(main()))
