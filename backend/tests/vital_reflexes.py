"""vital_reflexes.py — TRACK 3: THE TWO CALL-END REFLEXES AS DATA (SPEC §16.6 LAW: situations are DATA).

The post-call BOSS DEBRIEF (`report_call`) and the promised-outcome FOLLOW-UP (`follow_up`) are not code
— each is a manifest_duty ROW bound by the ONE generic binder (duties.py). Zero situation module, zero
runtime if-branch. This proves, from the seeded rows alone:

  1. both rows seed as L0 defaults (creator scope 'peter'), under FORCE-RLS;
  2. a `call.ended` sense OPENS report_call — a tab keyed callreport:{call_id} whose first contingency
     rides the `boss` channel, with r1_debrief armed to fire at once (one-shot notify);
  3. a `call.promise` sense OPENS follow_up — a tab keyed followup:{promise_key} with r1_chase armed
     (default WhatsApp rail, +2d);
  4. WIRING 3 — firing the due r1_debrief routes the debrief to ops.record_alert on the BOSS
     channel (never to the party), marks the timer fired, and logs a boss `msg.sent` event.

SAFETY: refuses the live `rocoto` DB. Point it at rocoto_rehearsal with schema_runtime.sql applied.
Usage (per-role rehearsal DSNs exported by the caller, or a single REHEARSAL_DSN):
    RUNTIME_DATABASE_URL=… CONTROL_DATABASE_URL=… DATABASE_URL=… python tests/vital_reflexes.py
"""
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# point at the rehearsal clone (never the live rocoto). REHEARSAL_DSN fills any pool DSN not already
# exported — so a caller can still supply the real per-role (rt/ctrl) rehearsal DSNs and have them win.
_DSN = os.environ.get("REHEARSAL_DSN")
if _DSN:
    for _k in ("DATABASE_URL", "RUNTIME_DATABASE_URL", "CONTROL_DATABASE_URL"):
        os.environ.setdefault(_k, _DSN)

for _l in Path("/opt/rocoto/.env").read_text().splitlines() if Path("/opt/rocoto/.env").exists() else []:
    _l = _l.strip()
    if _l and not _l.startswith("#") and "=" in _l:
        _k, _, _v = _l.partition("=")
        os.environ.setdefault(_k.strip(), _v.strip())

import agent_reply  # noqa: E402
import db  # noqa: E402
import duties  # noqa: E402
import ops  # noqa: E402
import runtime  # noqa: E402
import spine  # noqa: E402
import worker  # noqa: E402

PHONE = "+34999111222"
SCOPE = runtime.scope_of(PHONE)
CALL_ID = "CALLREFLEX1"
R = []


def ck(name, ok, detail=""):
    R.append(bool(ok))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


def _js(v):
    import json
    return v if isinstance(v, (list, dict)) else json.loads(v or "null")


async def main():
    await db.init()
    duties.invalidate_cache()

    # SAFETY GUARD — never the live rocoto DB.
    async with db.get_pool().acquire() as con:
        dbname = await con.fetchval("select current_database()")
    if dbname == "rocoto":
        raise SystemExit("REFUSING to run vitals against the LIVE 'rocoto' DB — use rocoto_rehearsal")
    print(f"  (db={dbname})")

    async with db.scoped_tx(SCOPE) as con:
        await agent_reply._ensure_scope(con, SCOPE)
        for t in ("timer", "open_loop", "event"):
            await con.execute(f"delete from {t} where scope=$1::ltree", SCOPE)

    # 1) both reflex rows seeded as L0 defaults.
    async with db.control_pool().acquire() as con:
        seeded = await con.fetchval(
            "select count(*) from manifest_duty where scope='peter' "
            "and name = any($1::text[]) and enabled", ["report_call", "follow_up"])
    ck("report_call + follow_up seed as manifest_duty ROWS (L0 defaults)", seeded == 2, f"seeded={seeded}")

    # 2) call.ended OPENS report_call — boss-channel contingency + armed r1_debrief.
    ended_payload = {"call_id": CALL_ID, "name": "Bar Pepe",
                     "summary": "pidio dos cajas de tomate", "next_step": "confirmo stock y le digo"}
    async with db.scoped_tx(SCOPE) as con:
        eid, _ = await spine.append_event(con, SCOPE, "call.ended", "voice", ended_payload)
        await duties.react_to_sense(con, SCOPE, "call.ended", ended_payload, opened_by_event=eid)
    async with db.control_pool().acquire() as con:
        tab = await con.fetchrow(
            "select id, contingencies, text from open_loop where scope=$1::ltree "
            "and entity_key=$2 and status='open'", SCOPE, f"callreport:{CALL_ID}")
        armed = await con.fetchval(
            "select branch_id from timer t join open_loop l on l.id=t.loop_id "
            "where l.scope=$1::ltree and l.entity_key=$2 and t.state='armed' limit 1",
            SCOPE, f"callreport:{CALL_ID}")
    cont0 = (_js(tab["contingencies"])[0] if tab else {}) or {}
    sent0 = (cont0.get("action", {}) or {}).get("sentence") or ""
    ck("call.ended -> report_call tab opens (keyed callreport:{call_id})", tab is not None,
       f"tab={tab['id'] if tab else None}")
    ck("report_call first contingency rides the BOSS channel", cont0.get("channel") == "boss",
       f"channel={cont0.get('channel')}")
    ck("report_call arms r1_debrief (one-shot debrief timer)", armed == "r1_debrief", f"armed={armed}")
    ck("report_call debrief sentence has slots filled (no literal {summary})",
       ("Bar Pepe" in sent0) and ("{summary}" not in sent0), sent0[:80])

    # 3) call.promise OPENS follow_up — armed r1_chase, default (WhatsApp) rail.
    promise_payload = {"promise_key": CALL_ID, "promise": "mandar el catalogo", "name": "Bar Pepe"}
    async with db.scoped_tx(SCOPE) as con:
        peid, _ = await spine.append_event(con, SCOPE, "call.promise", "voice", promise_payload)
        await duties.react_to_sense(con, SCOPE, "call.promise", promise_payload, opened_by_event=peid)
    async with db.control_pool().acquire() as con:
        ftab = await con.fetchrow(
            "select id, contingencies from open_loop where scope=$1::ltree "
            "and entity_key=$2 and status='open'", SCOPE, f"followup:{CALL_ID}")
        farmed = await con.fetchval(
            "select branch_id from timer t join open_loop l on l.id=t.loop_id "
            "where l.scope=$1::ltree and l.entity_key=$2 and t.state='armed' limit 1",
            SCOPE, f"followup:{CALL_ID}")
    fcont0 = (_js(ftab["contingencies"])[0] if ftab else {}) or {}
    ck("call.promise -> follow_up tab opens (keyed followup:{promise_key})", ftab is not None,
       f"tab={ftab['id'] if ftab else None}")
    ck("follow_up arms r1_chase on the DEFAULT rail (no boss channel)",
       farmed == "r1_chase" and not fcont0.get("channel"), f"armed={farmed} channel={fcont0.get('channel')}")

    # 4) WIRING 3 — fire the due r1_debrief; it must route to ops.record_alert on the boss channel.
    #    Surgical: fire ONLY our timer via _fire_one (never a cross-scope run_once tick in a shared clone).
    #    Monkeypatch: force CONFIRMED (no LLM cost/nondeterminism) + STUB the surfacer (no real send).
    _calls = []

    async def _fake_verify(con, **kw):
        return True

    async def _fake_surface(cls, detail, ref_scope=None):
        _calls.append((cls, detail, ref_scope))
        return {"class": cls, "via": "test", "alert_id": 1}

    worker._verify_branch = _fake_verify
    ops.record_alert = _fake_surface

    async with db.control_pool().acquire() as con:
        tid = await con.fetchval(
            "select t.id from timer t join open_loop l on l.id=t.loop_id "
            "where l.scope=$1::ltree and l.entity_key=$2 and t.branch_id='r1_debrief' and t.state='armed'",
            SCOPE, f"callreport:{CALL_ID}")
    # An inbox write failure must roll back the timer transaction so the debrief can retry.
    async def _failed_inbox(*args, **kwargs):
        return {"alert_id": None, "via": "log"}

    ops.record_alert = _failed_inbox
    rejected = False
    if tid is not None:
        try:
            async with db.scoped_tx(SCOPE) as con:
                await worker._fire_one(con, {"id": int(tid), "scope": SCOPE})
        except RuntimeError:
            rejected = True
    async with db.control_pool().acquire() as con:
        retry_state = await con.fetchval("select state from timer where id=$1", tid)
    ck("inbox failure leaves debrief armed for retry", rejected and retry_state == "armed")
    ops.record_alert = _fake_surface
    did = False
    if tid is not None:
        async with db.scoped_tx(SCOPE) as con:
            did = await worker._fire_one(con, {"id": int(tid), "scope": SCOPE})

    async with db.control_pool().acquire() as con:
        boss_evt = await con.fetchval(
            "select count(*) from event where scope=$1::ltree and type='msg.sent' "
            "and payload->>'channel'='boss'", SCOPE)
        debrief_timer_state = await con.fetchval(
            "select t.state from timer t join open_loop l on l.id=t.loop_id "
            "where l.scope=$1::ltree and l.entity_key=$2 and t.branch_id='r1_debrief'",
            SCOPE, f"callreport:{CALL_ID}")
    ck("firing r1_debrief routes to ops.record_alert with class 'report'",
       len(_calls) == 1 and _calls[0][0] == "report", f"calls={[c[0] for c in _calls]}")
    ck("boss branch logs a boss msg.sent + marks the timer fired",
       did and (boss_evt or 0) == 1 and debrief_timer_state == "fired",
       f"did={did} boss_evt={boss_evt} timer={debrief_timer_state}")

    # cleanup
    async with db.scoped_tx(SCOPE) as con:
        for t in ("timer", "open_loop", "event"):
            await con.execute(f"delete from {t} where scope=$1::ltree", SCOPE)
        await con.execute("delete from scope_node where scope=$1::ltree", SCOPE)

    passed = sum(R)
    print(f"\nREFLEXES: {passed}/{len(R)} passed — "
          f"{'CALL-END REFLEXES ARE DATA' if passed == len(R) else 'BROKEN'}")
    return 0 if passed == len(R) else 1


raise SystemExit(asyncio.run(main()))
