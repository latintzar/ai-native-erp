"""vital_runtime_liveness.py — THE composed end-to-end liveness vital (SPEC §16.3 / BUILD-PLAN §0.5).

"Alive" is NOT "the process is up" — it is: an event has traversed sensing → mind → gate → agency and
left a tab + a card behind. This asserts that round-trip through `runtime.run_turn` (the ONE cycle),
proving the WhatsApp turn is truly EVENT-SOURCED (the defect this session fixed): the inbound is an
event, the mind decides from the assembled fold, and the reasoning + reply + actions are events.

Run on the box (needs ANTHROPIC key):  cd /opt/rocoto && set -a && . ./.env && set +a && \
    PYTHONPATH=. python tests/vital_runtime_liveness.py
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

PHONE = "+34999000123"          # a synthetic test party
SCOPE = runtime.scope_of(PHONE)  # wa.34999000123
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


async def main():
    await db.init()
    await _clean()

    async def _stub_call(phone, lang, name=""):
        return {"sid": "stub-call"}

    # ── the turn: a message that should make Rocoto answer AND leave a pending matter behind ──
    msg = ("Hola, tengo una distribuidora de embutidos en Madrid. Guárdame como pendiente que me tienes "
           "que mandar el catálogo mañana, y si no te escribo, recuérdamelo tú.")
    out = await runtime.run_turn(PHONE, msg, place_call_fn=_stub_call)
    ck("run_turn returns a reply", bool((out.get("text") or "").strip()), (out.get("text") or "")[:70])

    async with db.control_pool().acquire() as con:
        # SENSING → APPEND: the inbound is an EVENT on the scope (not a shadow written after).
        inbound = await con.fetchval(
            "select count(*) from event where scope=$1::ltree and type='message' and lane='world'", SCOPE)
        ck("① sensing: the inbound landed as a world event", (inbound or 0) >= 1, f"n={inbound}")
        # MIND: a reasoning-lane event exists (the mind's thought is in the log, §5.0.1 no private state).
        think = await con.fetchval(
            "select count(*) from event where scope=$1::ltree and lane='reasoning'", SCOPE)
        ck("④ mind: a reasoning-lane thought was appended", (think or 0) >= 1, f"n={think}")
        # AGENCY: the reply is an event (msg.sent) — the turn acted through the gate.
        sent = await con.fetchval(
            "select payload->>'text' from event where scope=$1::ltree and type='msg.sent' order by id desc limit 1", SCOPE)
        ck("⑤⑥ agency: the reply was appended as msg.sent", bool(sent), (sent or "")[:60])
        # MEMORY: the card row exists (bootstrapped at first contact — a first assembly never reads a hole).
        card = await con.fetchval("select 1 from card where scope=$1::ltree", SCOPE)
        ck("memory: a card row exists (bootstrap)", card is not None)
        # IDENTITY: contact + endpoint were created → the chase-worker can resolve the address.
        ep = await con.fetchval("select addr from endpoint where kind='wa' and addr=$1", PHONE)
        ck("identity: endpoint→contact created (worker can chase)", ep == PHONE)
        # TAB: the mind left an open matter behind with a pre-armed absence timer (the §16.3 'a tab').
        tab = await con.fetchrow("select id, due_at from open_loop where scope=$1::ltree and status='open' "
                                 "order by id desc limit 1", SCOPE)
        armed = await con.fetchval("select count(*) from timer where scope=$1::ltree and state='armed'", SCOPE)
        ck("agency: a tab was opened with an armed absence timer", tab is not None and (armed or 0) >= 1,
           f"tab={tab['id'] if tab else None} armed_timers={armed}")

    # INTROSPECTION: xray reconstructs the thought+action chain from the log (Peter's command).
    xr = await agent_reply.xray(PHONE)
    ck("xray reconstructs the chain from the event log", "RAYOS X" in xr and ("respondí" in xr or "pensé" in xr),
       xr.replace(chr(10), " | ")[:90])

    await _clean()
    passed = sum(R)
    print(f"\nRUNTIME LIVENESS: {passed}/{len(R)} passed "
          f"— {'ALIVE (event traversed sensing→mind→gate→agency, left a tab + a card)' if passed == len(R) else 'NOT YET'}")
    return 0 if passed == len(R) else 1


raise SystemExit(asyncio.run(main()))
