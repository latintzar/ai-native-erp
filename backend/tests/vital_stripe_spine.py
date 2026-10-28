"""vital_stripe_spine.py — WP-4 STRIPE→SPINE thin slice (BUILD-PLAN §5 WP-4).

The cascade's live emitter: a business webhook now runs the SAME tab cascade as the internal sense path.
Proves (via spine.ingest_webhook, scope resolved through entity_map):
  1. a payment matching a NON-money invoice tab RESOLVES it + cancels its timers;
  2. a payment touching a MONEY tab ESCALATES to R1 (never auto-fires) + arms the WP-1 wake;
  3. a REPLAYED webhook (same dedupe_key) writes 0 new rows (idempotent).

Run on the RLS-ON clone:  PYTHONPATH=. venv/bin/python tests/vital_stripe_spine.py
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
import spine  # noqa: E402

PHONE = "+34999000444"
SCOPE = runtime.scope_of(PHONE)
R = []


def ck(name, ok, detail=""):
    R.append(bool(ok))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


async def _clean():
    async with db.scoped_tx(SCOPE) as con:
        for t in ("wake", "timer", "open_loop", "event", "fact", "card", "scope_state"):
            await con.execute(f"delete from {t} where scope=$1::ltree", SCOPE)
        await con.execute("delete from entity_map where scope=$1::ltree", SCOPE)
        await con.execute("delete from scope_node where scope=$1::ltree", SCOPE)


async def main():
    await db.init()
    await _clean()
    async with db.scoped_tx(SCOPE) as con:
        await agent_reply._ensure_scope(con, SCOPE)
        # a NON-money invoice tab (+ armed timer) and a MONEY tab
        eid, _ = await spine.append_event(con, SCOPE, "tab.opened", "runtime", {"kind": "invoice"})
        conts = [{"branch_id": "si_silencio", "trigger": "silencio", "action": {"class": "nudge", "sentence": "¿la factura?"}}]
        lid = await con.fetchval(
            "insert into open_loop(scope,kind,text,entity_key,status,money,contingencies,opened_by_event) "
            "values($1::ltree,'invoice','esperando factura s1','inv:s1','open',false,$2,$3) returning id",
            SCOPE, conts, eid)
        await con.execute("insert into timer(scope,loop_id,fires_at,branch_id,state) "
                          "values($1::ltree,$2,now()+interval '1 day','si_silencio','armed')", SCOPE, int(lid))
        await con.execute("insert into open_loop(scope,kind,text,entity_key,status,money) "
                          "values($1::ltree,'issue','disputa s2','inv:s2','open',true)", SCOPE)
        # entity_map: the Stripe object ids → this party's scope + the invoice tab key (creation-time).
        await spine.record_entity_mapping(con, "stripe", "pi_s1", SCOPE, "inv:s1")
        await spine.record_entity_mapping(con, "stripe", "pi_s2", SCOPE, "inv:s2")

    # 1. non-money invoice payment → resolve + cancel timers (via ingest_webhook → cascade)
    async with db.scoped_tx(SCOPE) as con:
        r1 = await spine.ingest_webhook(con, "stripe", "stripe.payment", "pi_s1", {"amt": 100}, dedupe_key="pay-s1")
    async with db.control_pool().acquire() as con:
        t1 = await con.fetchval("select status from open_loop where scope=$1::ltree and entity_key='inv:s1'", SCOPE)
        armed = await con.fetchval("select count(*) from timer where scope=$1::ltree and state='armed'", SCOPE)
    ck("webhook resolves scope via entity_map + non-money tab RESOLVED + timers cancelled",
       r1.get("scope") == SCOPE and t1 == "resolved" and (armed or 0) == 0, f"scope={r1.get('scope')} status={t1} armed={armed}")

    # 2. money tab payment → escalate (never auto-fires) + WP-1 wake armed
    async with db.scoped_tx(SCOPE) as con:
        await spine.ingest_webhook(con, "stripe", "stripe.payment", "pi_s2", {"amt": 50}, dedupe_key="pay-s2")
    async with db.control_pool().acquire() as con:
        t2 = await con.fetchval("select status from open_loop where scope=$1::ltree and entity_key='inv:s2'", SCOPE)
        esc = await con.fetchval("select count(*) from event where scope=$1::ltree and type='escalate.tab'", SCOPE)
        wake = await con.fetchval("select count(*) from wake where scope=$1::ltree and reason='escalate' and state='armed'", SCOPE)
    ck("money tab ESCALATES (open) + escalate.tab event + WP-1 escalate wake armed",
       t2 == "open" and (esc or 0) >= 1 and (wake or 0) >= 1, f"status={t2} esc={esc} wake={wake}")

    # 3. replay idempotency: same dedupe_key → 0 new rows
    async with db.scoped_tx(SCOPE) as con:
        r3 = await spine.ingest_webhook(con, "stripe", "stripe.payment", "pi_s1", {"amt": 100}, dedupe_key="pay-s1")
    ck("replayed webhook (same dedupe_key) writes 0 new rows", r3.get("is_new_event") is False, f"is_new={r3.get('is_new_event')}")

    await _clean()
    passed = sum(R)
    print(f"\nSTRIPE→SPINE: {passed}/{len(R)} passed — {'THE CASCADE HAS A LIVE EMITTER' if passed == len(R) else 'BROKEN'}")
    return 0 if passed == len(R) else 1


raise SystemExit(asyncio.run(main()))
