"""vital_followup_fire.py — promised follow-ups actually FIRE (the 2026-07-25 due_at/label-lie fix).

The diagnosed defects, each behind an assertion here:
  A. duties._open wrote due_at=now() for every duty tab while the real clock (the first-rung timer)
     armed days out — the tab LOOKED overdue from birth while nothing was due. Now due_at and the
     armed timer are ONE expression: the tab's label IS its clock.
  B. worker's rearm armed the next rung but left due_at behind — _rearm_next now moves both together.
  C. the `follow_up` cadence was a single +2d rung — a call-promise (often an in-flight order!) waited
     two days for its first chase. It is now the cadet's ladder IN THE ROW (r1 4h → r2 1d → r3 2d),
     sentences value-forward, referencing the call, es-ES. Zero Python (§16.6: situations are data).
  D. a one-shot boss debrief ('callreport:' / report_call) left its tab open forever with no armed
     clock. The worker now resolves the tab once the debrief is delivered.
  S. THE SWEEPER: any open tab past due with ZERO fired rungs and NO armed timer will never fire —
     worker.run_stuck_scan surfaces it to Peter ONCE (ops.record_alert + a `tab.stuck` event),
     never re-alarms.

Also rehearses the DEPLOY BACKFILL (backfill_20260725_followup_fire.sql) at step 0 — the same file
prod runs once at deploy so the stranger's stranded follow-up fires post-deploy.

SAFETY: refuses the live `rocoto` DB. LLM verify / Twilio / ops egress are all monkeypatched — no
real sends. Usage:  REHEARSAL_DSN=postgresql://…/rocoto_rehearsal  python tests/vital_followup_fire.py
"""
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# point at the rehearsal clone (never the live rocoto). REHEARSAL_DSN fills any pool DSN not already
# exported — a caller can still supply real per-role rehearsal DSNs and have them win.
_DSN = os.environ.get("REHEARSAL_DSN")
if _DSN:
    for _k in ("DATABASE_URL", "RUNTIME_DATABASE_URL", "CONTROL_DATABASE_URL"):
        os.environ.setdefault(_k, _DSN)

try:
    for _l in Path("/opt/rocoto/.env").read_text().splitlines() if Path("/opt/rocoto/.env").exists() else []:
        _l = _l.strip()
        if _l and not _l.startswith("#") and "=" in _l:
            _k, _, _v = _l.partition("=")
            os.environ.setdefault(_k.strip(), _v.strip())
except PermissionError:
    pass  # running as a low-priv user with DSNs passed explicitly — fine

import db  # noqa: E402
import duties  # noqa: E402
import ops  # noqa: E402
import presence  # noqa: E402
import reach  # noqa: E402
import runtime  # noqa: E402
import spine  # noqa: E402
import twilio_wa  # noqa: E402
import worker  # noqa: E402

PHONE = "+34999666555"
SCOPE = runtime.scope_of(PHONE)
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

    # ── 0) DEPLOY-BACKFILL REHEARSAL: run the one-shot backfill exactly as prod will (idempotent).
    # Prod runs it as the DB SUPERUSER (`psql -1 -f …` bypasses FORCE RLS). Mirror that literally:
    # default = `sudo -u postgres psql` over the unix socket (works on both the no-RLS and FORCE-RLS
    # clones — the owner DSN is FENCED on a FORCE-RLS clone and would read back nothing); an explicit
    # BACKFILL_DSN (e.g. local dev without sudo/postgres) wins and uses asyncpg instead. ──
    backfill = Path(__file__).resolve().parent.parent / "backfill_20260725_followup_fire.sql"
    _q_pre = ("select count(*) from open_loop l join timer t on t.loop_id=l.id "
              "where l.status='open' and l.entity_key like 'followup:%' and t.state='armed' "
              "and t.fires_at > now()")
    _q_row = "select gate_policy from manifest_duty where scope='peter'::ltree and name='follow_up'"
    _q_leaked = ("select count(*) from open_loop l where l.status='open' and l.entity_key like 'callreport:%' "
                 "and exists (select 1 from timer t where t.loop_id=l.id and t.state='fired') "
                 "and not exists (select 1 from timer t where t.loop_id=l.id and t.state='armed')")
    _q_due = ("select count(*) from open_loop l join timer t on t.loop_id=l.id "
              "where l.status='open' and l.entity_key like 'followup:%' and t.state='armed' "
              "and t.fires_at <= now()")
    if os.environ.get("BACKFILL_DSN"):
        import asyncpg
        bcon = await asyncpg.connect(os.environ["BACKFILL_DSN"])
        try:
            if await bcon.fetchval("select current_database()") == "rocoto":
                raise SystemExit("REFUSING: BACKFILL_DSN points at the LIVE 'rocoto' DB")
            pre_stranded = await bcon.fetchval(_q_pre) or 0
            await bcon.execute(backfill.read_text())
            row = _js(await bcon.fetchval(_q_row))
            leaked = await bcon.fetchval(_q_leaked) or 0
            now_due = await bcon.fetchval(_q_due) or 0
        finally:
            await bcon.close()
    else:
        import subprocess

        def _psql(sql: str, file_input: str | None = None):
            argv = ["sudo", "-u", "postgres", "psql", "-d", dbname, "-tA", "-v", "ON_ERROR_STOP=1"]
            argv += ["-1", "-f", "-"] if file_input is not None else ["-c", sql]
            r = subprocess.run(argv, input=(file_input if file_input is not None else None),
                               capture_output=True, text=True)
            if r.returncode != 0:
                raise SystemExit(f"backfill psql failed: {r.stderr.strip()[:400]}")
            return r.stdout.strip()

        if dbname == "rocoto":  # belt over the guard above — never the live DB
            raise SystemExit("REFUSING: backfill rehearsal against the LIVE 'rocoto' DB")
        pre_stranded = int(_psql(_q_pre) or 0)
        _psql("", file_input=backfill.read_text())  # exactly prod: psql -1 -f, superuser
        row = _js(_psql(_q_row) or None)
        leaked = int(_psql(_q_leaked) or 0)
        now_due = int(_psql(_q_due) or 0)
    duties.invalidate_cache()
    rungs = (row or {}).get("rungs") or []
    afters = [r.get("after") for r in rungs]
    ck("backfill installs the cadet's ladder IN THE ROW (r1 4h → r2 1d → r3 2d)",
       len(rungs) == 3 and afters == ["4h", "1d", "2d"], f"afters={afters}")
    ck("ladder sentences are the cadet's voice: reference the call, {promise}-slotted, es-ES",
       len(rungs) == 3 and all("llamada" in (r.get("sentence") or "")
                               and "{promise}" in (r.get("sentence") or "") for r in rungs))
    ck("backfill leaves ZERO leaked one-shot debrief tabs (callreport rot cleared)",
       leaked == 0, f"leaked={leaked}")
    ck("backfill pulls every stranded follow-up chase to NOW (the stranger's tab will fire this tick)",
       now_due >= pre_stranded, f"stranded_before={pre_stranded} due_now={now_due}")

    # ── setup: a clean customer party with a WhatsApp endpoint ──
    async with db.scoped_tx(SCOPE) as con:
        for t in ("timer", "open_loop", "pending_turn", "event"):
            await con.execute(f"delete from {t} where scope=$1::ltree", SCOPE)
        await spine.resolve_chat_scope(con, None, "wa", PHONE, display_name="Restaurante Vital",
                                       scope_override=SCOPE)

    # ── 1) FIX A — the tab's label IS its clock: due_at mirrors the armed first rung (+4h), not now(). ─
    payload = {"promise_key": "vitalfollow-1", "name": "Restaurante Vital",
               "promise": "pasarte mañana el pedido cerrado con los precios"}
    async with db.scoped_tx(SCOPE) as con:
        eid, _ = await spine.append_event(con, SCOPE, "call.promise", "postcall", payload)
        await duties.react_to_sense(con, SCOPE, "call.promise", payload, opened_by_event=eid)
    async with db.control_pool().acquire() as con:
        tab = await con.fetchrow(
            "select l.id, l.contingencies, l.due_at, t.id as timer_id, t.fires_at, "
            "  abs(extract(epoch from (l.due_at - t.fires_at))) as skew, "
            "  extract(epoch from (l.due_at - now())) as lead "
            "from open_loop l join timer t on t.loop_id=l.id and t.state='armed' "
            "where l.scope=$1::ltree and l.entity_key='followup:vitalfollow-1' and l.status='open'",
            SCOPE)
    cont = _js(tab["contingencies"]) if tab else []
    by = {c.get("branch_id"): c for c in cont}
    ck("FIX A: due_at == the armed first-rung clock (skew < 2s; never a lie written at open)",
       tab is not None and float(tab["skew"]) < 2.0, f"skew={float(tab['skew']) if tab else '-'}s")
    ck("first chase is SAME-DAY (+4h), not +2d (the cadence bug)",
       tab is not None and 3.9 * 3600 < float(tab["lead"]) < 4.1 * 3600,
       f"lead={float(tab['lead']) / 3600 if tab else '-'}h")
    ck("rearm chain derives from the row (r1→r2 after 1d, r2→r3 after 2d, r3 ends); slots filled",
       by.get("r1_chase", {}).get("rearm", {}).get("branch_id") == "r2_chase"
       and by.get("r1_chase", {}).get("rearm", {}).get("after") == "1d"
       and by.get("r2_chase", {}).get("rearm", {}).get("after") == "2d"
       and "rearm" not in by.get("r3_chase", {})
       and "{promise}" not in (by.get("r1_chase", {}).get("action", {}).get("sentence") or ""))

    # ── 2) THE VITAL: a due follow_up tab FIRES within one worker tick (run_once), ladder climbs. ──
    _sends, _surfaced = [], []

    async def _fake_verify(con, **kw):
        return True

    async def _fake_send(addr, text, **kw):
        _sends.append((addr, text))
        return "SM_vitalfollow"

    async def _fake_reach(con, scope, intent="nudge", has_email=False):
        return {"channel": "freeform"}

    async def _fake_surface(cls, detail, ref_scope=None):
        _surfaced.append((cls, detail, ref_scope))
        return {"class": cls, "via": "vital", "alert_id": 1}

    _orig = (worker._verify_branch, twilio_wa.send_whatsapp, reach.choose_channel,
             presence.quiet_now, ops.record_alert)
    worker._verify_branch = _fake_verify
    twilio_wa.send_whatsapp = _fake_send
    reach.choose_channel = _fake_reach
    presence.quiet_now = lambda now=None: False
    ops.record_alert = _fake_surface

    async with db.scoped_tx(SCOPE) as con:
        await con.execute("update timer set fires_at = now() - interval '1 second' "
                          "where id=$1 and state='armed'", tab["timer_id"])
    fired = await worker.run_once(db.control_pool())
    my_sends = [s for s in _sends if s[0] == PHONE]
    async with db.control_pool().acquire() as con:
        t1 = await con.fetchval("select state from timer where id=$1", tab["timer_id"])
        nxt = await con.fetchrow(
            "select t.branch_id, abs(extract(epoch from (l.due_at - t.fires_at))) as skew, "
            "  extract(epoch from (t.fires_at - now())) as lead "
            "from timer t join open_loop l on l.id=t.loop_id "
            "where t.loop_id=$1 and t.state='armed'", tab["id"])
        n_msg = await con.fetchval(
            "select count(*) from event where scope=$1::ltree and type='msg.sent'", SCOPE) or 0
    ck("⚑ a due follow_up tab FIRES within ONE worker tick (chase sent over the gated rail)",
       fired >= 1 and len(my_sends) == 1 and n_msg == 1 and t1 == "fired",
       f"tick_fired={fired} my_sends={len(my_sends)} timer={t1}")
    ck("the chase reads like the cadet's follow-up (references the call, carries the promise)",
       my_sends and "llamada" in my_sends[0][1] and payload["promise"] in my_sends[0][1],
       (my_sends[0][1][:90] if my_sends else ""))
    ck("FIX B: the ladder climbs AND due_at follows the new clock (r2 armed +1d, skew < 2s)",
       nxt is not None and nxt["branch_id"] == "r2_chase" and float(nxt["skew"]) < 2.0
       and 0.9 * 86400 < float(nxt["lead"]) < 1.1 * 86400,
       f"next={nxt['branch_id'] if nxt else None} skew={float(nxt['skew']) if nxt else '-'}s")

    # ── 3) FIX D — a delivered one-shot boss debrief RESOLVES its tab (the callreport leak is dead). ─
    cpayload = {"call_id": "vitalcall-1", "name": "Restaurante Vital",
                "summary": "hemos repasado el pedido semanal", "next_step": "pasarle el resumen"}
    async with db.scoped_tx(SCOPE) as con:
        ceid, _ = await spine.append_event(con, SCOPE, "call.ended", "voice", cpayload)
        await duties.react_to_sense(con, SCOPE, "call.ended", cpayload, opened_by_event=ceid)
    async with db.control_pool().acquire() as con:
        ctid = await con.fetchval(
            "select t.id from timer t join open_loop l on l.id=t.loop_id "
            "where l.scope=$1::ltree and l.entity_key='callreport:vitalcall-1' and t.state='armed'", SCOPE)
    did = False
    if ctid is not None:
        async with db.scoped_tx(SCOPE) as con:
            did = await worker._fire_one(con, {"id": int(ctid), "scope": SCOPE})
    async with db.control_pool().acquire() as con:
        crow = await con.fetchrow(
            "select status, (select count(*) from timer t where t.loop_id=open_loop.id "
            " and t.state='armed') as armed from open_loop "
            "where scope=$1::ltree and entity_key='callreport:vitalcall-1'", SCOPE)
    boss_notes = [s for s in _surfaced if s[0] == "report" and "Restaurante Vital" in s[1]]
    ck("FIX D: the one-shot boss debrief delivers AND resolves its tab (no open-forever rot)",
       did and boss_notes and crow is not None and crow["status"] == "resolved"
       and int(crow["armed"]) == 0,
       f"fired={did} surfaced={len(boss_notes)} status={crow['status'] if crow else None}")

    # ── 4) THE SWEEPER — a rungless stuck tab (past due, zero fired rungs, no clock) SURFACES once. ──
    async with db.scoped_tx(SCOPE) as con:
        stuck_id = await con.fetchval(
            "insert into open_loop(scope,kind,text,status,entity_key,due_at) "
            "values($1::ltree,'pending','Seguimiento huérfano de prueba','open','vitalstuck:1', "
            "now() - interval '20 minutes') returning id", SCOPE)
    _surfaced.clear()
    worker._stuck_last_scan = 0.0
    n1 = await worker.run_stuck_scan(db.control_pool())
    stuck_hits = [s for s in _surfaced if f"tab {stuck_id}" in s[1]]
    async with db.control_pool().acquire() as con:
        n_evt = await con.fetchval(
            "select count(*) from event where scope=$1::ltree and type='tab.stuck' "
            "and (payload->>'tab_id')::bigint=$2", SCOPE, stuck_id) or 0
    ck("⚑ SWEEPER: a stuck tab (past due, zero fired rungs, no armed timer) surfaces to Peter",
       n1 >= 1 and len(stuck_hits) == 1 and n_evt == 1,
       f"surfaced={n1} mine={len(stuck_hits)} tab.stuck={n_evt}")
    worker._stuck_last_scan = 0.0
    await worker.run_stuck_scan(db.control_pool())
    stuck_hits2 = [s for s in _surfaced if f"tab {stuck_id}" in s[1]]
    ck("SWEEPER never re-alarms: the second pass is silent for the same tab (tab.stuck dedupe)",
       len(stuck_hits2) == 1, f"total_mine={len(stuck_hits2)}")

    # ── cleanup: restore patches + drop the test party's rows ──
    (worker._verify_branch, twilio_wa.send_whatsapp, reach.choose_channel,
     presence.quiet_now, ops.record_alert) = _orig
    async with db.scoped_tx(SCOPE) as con:
        for t in ("timer", "open_loop", "event"):
            await con.execute(f"delete from {t} where scope=$1::ltree", SCOPE)
        await con.execute("delete from scope_node where scope=$1::ltree", SCOPE)

    passed = sum(R)
    print(f"\nFOLLOW-UP FIRE: {passed}/{len(R)} passed — "
          f"{'PROMISED FOLLOW-UPS FIRE, NOTHING ROTS SILENTLY' if passed == len(R) else 'BROKEN'}")
    return 0 if passed == len(R) else 1


raise SystemExit(asyncio.run(main()))
