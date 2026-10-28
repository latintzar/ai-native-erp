"""vital_liveness_mechanism.py — the DETERMINISTIC liveness gate (BUILD-PLAN §4.6 / eng-review #5).

vital_runtime_liveness calls the REAL Anthropic API — nondeterministic (can halt on a model coin-flip
AND pass while the mechanism is broken). THIS vital STUBS the mind with a canned tool-plan (open a tab,
then reply) and asserts the run_turn MECHANISM end-to-end with ZERO LLM:
  ① the inbound is a world event · ④ a reasoning-lane event · ⑤⑥ a msg.sent · a bootstrapped card ·
  identity (endpoint→contact) · a tab opened WITH an armed absence timer · xray reconstructs the chain.
This is the HARD halt gate; the live-LLM vital is the advisory smoke.

Run on the clone:  PYTHONPATH=. venv/bin/python tests/vital_liveness_mechanism.py
"""
import asyncio
import os
from pathlib import Path

for _line in Path("/opt/rocoto/.env").read_text().splitlines() if Path("/opt/rocoto/.env").exists() else []:
    _line = _line.strip()
    if _line and not _line.startswith("#") and "=" in _line:
        _k, _, _v = _line.partition("=")
        os.environ.setdefault(_k.strip(), _v.strip())

import agent_reply  # noqa: E402
import db  # noqa: E402
import runtime  # noqa: E402

PHONE = "+34999000456"
SCOPE = runtime.scope_of(PHONE)
CANNED_REASON = "canned mechanism stub (no LLM)"
R = []


def ck(name, ok, detail=""):
    R.append(bool(ok))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


async def _clean():
    async with db.scoped_tx(SCOPE) as con:
        for t in ("timer", "open_loop", "event", "fact", "summary", "card", "scope_state", "pending_turn"):
            await con.execute(f"delete from {t} where scope=$1::ltree", SCOPE)
        cid = await con.fetchval("select c.id from endpoint e join contact c on c.id=e.contact_id "
                                 "where e.kind='wa' and e.addr=$1", PHONE)
        if cid:
            await con.execute("delete from endpoint where contact_id=$1", int(cid))
            await con.execute("delete from contact_role where contact_id=$1", int(cid))
            await con.execute("delete from contact where id=$1", int(cid))
        await con.execute("delete from scope_node where scope=$1::ltree", SCOPE)


async def _stub_mind(phone, system, msgs, person, lang, place_call_fn=None, egress_stub=False, **kw):
    """The canned mind: deterministically open a tab (real machinery) + reply. No Anthropic call."""
    await agent_reply._do_open_tab(phone, "recordatorio", "mandar el catálogo mañana",
                                   1.0, "¿Pudiste ver el catálogo?", answer_shape="yesno")
    return {"text": "Vale, te lo guardo y mañana te aviso.", "actions": [{"open_tab": "recordatorio"}],
            "pending_facts": [], "reasoning": CANNED_REASON, "force_text": False}


async def main():
    await db.init()
    await _clean()

    real = agent_reply._run_mind
    agent_reply._run_mind = _stub_mind  # deterministic: no LLM this turn
    try:
        async def _stub_call(phone, lang, name=""):
            return {"sid": "stub-call"}
        out = await runtime.run_turn(PHONE, "Guárdame que me mandes el catálogo mañana.", place_call_fn=_stub_call)
    finally:
        agent_reply._run_mind = real

    ck("run_turn returns the canned reply", (out.get("text") or "").strip().startswith("Vale"), (out.get("text") or "")[:50])

    async with db.control_pool().acquire() as con:
        inbound = await con.fetchval(
            "select count(*) from event where scope=$1::ltree and type='message' and lane='world'", SCOPE)
        ck("① sensing: inbound is a world event", (inbound or 0) >= 1, f"n={inbound}")
        reason = await con.fetchval(
            "select payload->>'text' from event where scope=$1::ltree and lane='reasoning' order by id desc limit 1", SCOPE)
        ck("④ mind: reasoning event appended (from the stub — proves the mechanism, not the model)",
           reason == CANNED_REASON, (reason or "")[:40])
        sent = await con.fetchval(
            "select payload->>'text' from event where scope=$1::ltree and type='msg.sent' order by id desc limit 1", SCOPE)
        ck("⑤⑥ agency: reply appended as msg.sent", bool(sent), (sent or "")[:40])
        card = await con.fetchval("select 1 from card where scope=$1::ltree", SCOPE)
        ck("memory: a card row exists (bootstrap)", card is not None)
        ep = await con.fetchval("select addr from endpoint where kind='wa' and addr=$1", PHONE)
        ck("identity: endpoint→contact created", ep == PHONE)
        tab = await con.fetchrow("select id from open_loop where scope=$1::ltree and status='open' order by id desc limit 1", SCOPE)
        armed = await con.fetchval("select count(*) from timer where scope=$1::ltree and state='armed'", SCOPE)
        ck("agency: a tab was opened with an armed absence timer", tab is not None and (armed or 0) >= 1,
           f"tab={tab['id'] if tab else None} armed={armed}")

    xr = await agent_reply.xray(PHONE)
    ck("xray reconstructs the chain from the event log", "RAYOS X" in xr)

    await _clean()
    passed = sum(R)
    print(f"\nLIVENESS MECHANISM: {passed}/{len(R)} passed "
          f"— {'ALIVE (deterministic, no LLM)' if passed == len(R) else 'MECHANISM BROKEN'}")
    return 0 if passed == len(R) else 1


raise SystemExit(asyncio.run(main()))
