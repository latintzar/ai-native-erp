"""vital_review_rule.py — THE REVIEW RULE (BLOCK D · SPEC §5.8/§5.7).

The comercial's queue is near-EMPTY by design, because THE CUSTOMER resolves ambiguity. Exactly THREE
things put a matter in front of him — low stock · an explicit flag · a ONE-HOUR timeout on an
unanswered customer question — and this file is the proof, not the paragraph.

THE WINDOW IS ONE HOUR (Peter, LOCKED 2026-07-26 — SPEC §5.8b): orders land 05:00–07:00 against a prep
cutoff, so two hours can consume the entire window in which the decision still matters; an hour keeps
the queue near-empty without ever being the reason a van leaves late. It is DATA — the `after` on the
`question_timeout` ROW — so this file asserts the ROW, never a constant.

THE LOAD-BEARING VITAL (Peter's own wording, 2026-07-26):
    an UNANSWERED disambiguation lands in review ONLY after the timeout;
    an ANSWERED one NEVER does.

  R1  THE CLOSED SET        — three sources, and the one door RAISES on a fourth.
  R2  THE CLOCK IS A TIMER  — `question.asked` opens a tab with an ARMED timer at +1h. Never a poll.
  R3  ANSWERED → GONE       — an inbound resolves the tab and CANCELS the timer in the same commit.
  R4  ANSWERED → NEVER      — a full worker tick after the answer parks NOTHING, ever.
  R5  TOO EARLY → NOTHING   — inside the window the queue stays empty (only the timeout promotes).
  R6  TIMED OUT → REVIEW    — the fired rung parks EXACTLY ONE action, source `timeout`.
  R7  NO MODEL IN THE LOOP  — the review rung never consults the T1 VERIFY: a raising _verify_branch
                              changes nothing. The clock is as certain as the clock.
  R8  THE BOSS IS EXEMPT    — a question to the boss opens no tab (the row's `when`, not an if).
  R9  THE CUTOFF FORCES IT  — `not_after` shrinks the armed window; it never grows one.
  R10 SOMBRA STAYS LOUD     — §5.5 shuts the MOUTH; the review park is not a mouth.
  R11 THE QUEUE EXPLAINS ITSELF — every review_list row carries one of the three sources + a why.

SAFETY: refuses the live `rocoto` DB (it deletes its test party's rows). LLM verify / Twilio / ops
egress are monkeypatched — nothing leaves.
Usage:  REHEARSAL_DSN=postgresql://…/rocoto_rehearsal  python tests/vital_review_rule.py
"""
import asyncio
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

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
    pass

import db  # noqa: E402
import duties  # noqa: E402
import gate  # noqa: E402
import ops  # noqa: E402
import presence  # noqa: E402
import reach  # noqa: E402
import review  # noqa: E402
import runtime  # noqa: E402
import spine  # noqa: E402
import twilio_wa  # noqa: E402
import worker  # noqa: E402

PHONE = "+34999444111"
SCOPE = runtime.scope_of(PHONE)
BOSS_PHONE = "+34999444222"
BOSS_SCOPE = runtime.scope_of(BOSS_PHONE)
R = []


def ck(name, ok, detail=""):
    R.append(bool(ok))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


def _js(v):
    return v if isinstance(v, (list, dict)) else json.loads(v or "null")


async def _wipe(*scopes):
    for sc in scopes:
        async with db.scoped_tx(sc) as con:
            for t in ("timer", "open_loop", "pending_turn", "action", "event"):
                await con.execute(f"delete from {t} where scope=$1::ltree", sc)


async def _tab(scope, entity_key=None):
    """The party's open question tab + its armed timer, if any."""
    async with db.control_pool().acquire() as con:
        return await con.fetchrow(
            "select l.id, l.status, l.text, l.entity_key, l.contingencies, "
            "  extract(epoch from (l.due_at - now())) as lead, "
            "  (select id from timer t where t.loop_id=l.id and t.state='armed') as timer_id, "
            "  (select count(*) from timer t where t.loop_id=l.id and t.state='armed') as armed, "
            "  (select count(*) from timer t where t.loop_id=l.id and t.state='cancelled') as cancelled "
            "from open_loop l where l.scope=$1::ltree and l.kind='question' "
            + ("and l.entity_key=$2 " if entity_key else "")
            + "order by l.id desc limit 1",
            *( (scope, entity_key) if entity_key else (scope,) ))


async def _parked(scope):
    async with db.control_pool().acquire() as con:
        return await con.fetch(
            "select id, kind, reason, payload from action "
            "where scope=$1::ltree and state='pending' and needs_human=true order by id", scope)


async def main():
    await db.init()
    duties.invalidate_cache()

    async with db.get_pool().acquire() as con:
        dbname = await con.fetchval("select current_database()")
    if dbname == "rocoto":
        raise SystemExit("REFUSING to run vitals against the LIVE 'rocoto' DB — use rocoto_rehearsal")
    print(f"  (db={dbname})")

    # The row must be installed (schema_runtime.sql seed). Without it there IS no rule.
    async with db.control_pool().acquire() as con:
        pol = _js(await con.fetchval(
            "select gate_policy from manifest_duty where scope='peter'::ltree "
            "and name='question_timeout' and enabled"))
    rung = ((pol or {}).get("rungs") or [{}])[0]
    ck("the timeout is a manifest_duty ROW, not code: `question_timeout` seeded at the creator scope "
       "(1h · channel=review · source=timeout · cutoff-clamped)",
       bool(pol) and rung.get("after") == "1h" and rung.get("channel") == "review"
       and rung.get("review_source") == review.TIMEOUT and rung.get("not_after") == "{cutoff_iso}"
       and (pol.get("tab") or {}).get("kind") == "question",
       f"rung={ {k: rung.get(k) for k in ('after', 'channel', 'review_source')} }")

    # ── R1 · THE CLOSED SET ──────────────────────────────────────────────────────────────────────
    ck("R1 exactly THREE sources, named: low_stock · flag · timeout",
       review.SOURCES == ("low_stock", "flag", "timeout"), str(review.SOURCES))
    raised = False
    try:
        await review.hold_for_review(SCOPE, "porque_si")
    except ValueError:
        raised = True
    ck("R1 the ONE door REFUSES a fourth reason (a queue that can grow reasons is the defect)", raised)
    ck("R1 every source carries a boss-facing es-ES «why» (the queue explains itself, never a kind)",
       all(review.WHY.get(s) for s in review.SOURCES))

    # ── setup: a customer party and a boss party ─────────────────────────────────────────────────
    await _wipe(SCOPE, BOSS_SCOPE)
    async with db.scoped_tx(SCOPE) as con:
        await spine.resolve_chat_scope(con, None, "wa", PHONE, display_name="Bar Vital Review",
                                       scope_override=SCOPE)
    async with db.scoped_tx(BOSS_SCOPE) as con:
        await spine.resolve_chat_scope(con, None, "wa", BOSS_PHONE, display_name="Jefe Vital",
                                       scope_override=BOSS_SCOPE)

    Q = "A ver que no la líe — cuando dices «manzana golden», ¿qué calibre te pongo?"

    # ── R2 · THE CLOCK IS A TIMER ────────────────────────────────────────────────────────────────
    await review.on_question_asked(SCOPE, Q, "ask-vital-1", tier="customer")
    t = await _tab(SCOPE, "question:ask-vital-1")
    ck("R2 a question that WENT OUT opens the tab AND arms a real timer row (never a poll, never a scan)",
       t is not None and t["status"] == "open" and int(t["armed"]) == 1 and t["timer_id"] is not None,
       f"armed={int(t['armed']) if t else '-'}")
    ck("R2 the window is the row's ONE HOUR — the tab's label IS its clock",
       t is not None and 0.9 * 3600 < float(t["lead"]) < 1.1 * 3600,
       f"lead={round(float(t['lead']) / 3600, 2) if t else '-'}h")
    ck("R2 the tab says what was asked, in the supplier's own careful voice (nothing is 'apuntado' yet)",
       t is not None and "manzana golden" in (t["text"] or "").lower(), (t["text"] or "")[:70] if t else "")

    # ── R8 · THE BOSS IS EXEMPT (the row's `when`, not a runtime if) ─────────────────────────────
    await review.on_question_asked(BOSS_SCOPE, "¿te paso el resumen ahora?", "ask-vital-boss", tier="boss")
    bt = await _tab(BOSS_SCOPE)
    ck("R8 a question to the BOSS opens NO tab — a conversation is not a queue item (row `when`)",
       bt is None, f"tab={bt['id'] if bt else None}")

    # ── R9 · THE CUTOFF FORCES IT ────────────────────────────────────────────────────────────────
    from datetime import datetime, timedelta, timezone
    soon = (datetime.now(timezone.utc) + timedelta(minutes=25)).isoformat()
    far = (datetime.now(timezone.utc) + timedelta(hours=9)).isoformat()
    async with db.scoped_tx(SCOPE) as con:
        p = {"ask_key": "ask-vital-cut", "question": Q, "tier": "customer", "cutoff_iso": soon}
        eid, _ = await spine.append_event(con, SCOPE, review.ASKED, "review", p)
        await duties.react_to_sense(con, SCOPE, review.ASKED, p, opened_by_event=eid)
    tc = await _tab(SCOPE, "question:ask-vital-cut")
    ck("R9 the PREP CUTOFF shrinks the window: a 1h rung clamps to a cutoff 25min out",
       tc is not None and 20 * 60 < float(tc["lead"]) < 26 * 60,
       f"lead={round(float(tc['lead']) / 60) if tc else '-'}min")
    # 3600 is the row's OWN window read as seconds (§5.8b: one hour). The clamp is what the cutoff does
    # to it: 25min out shrinks it to ~1500s; 9h out is beyond the horizon and must leave the hour alone.
    ck("R9 `not_after` never GROWS a window: a cutoff 9h out leaves the row's own ONE HOUR",
       duties._clamp_secs(3600, far) == 3600 and duties._clamp_secs(3600, soon) < 1800
       and duties._clamp_secs(3600, "not-a-date") == 3600
       and duties._clamp_secs(3600, (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()) == 0)

    # ── R3 · ANSWERED → THE TAB IS GONE AND SO IS ITS CLOCK ─────────────────────────────────────
    res = await review.on_answer(SCOPE)
    t2 = await _tab(SCOPE, "question:ask-vital-1")
    ck("R3 the customer writes back → the question tab RESOLVES and its armed rung is CANCELLED",
       t2 is not None and t2["status"] == "resolved" and int(t2["armed"]) == 0
       and int(t2["cancelled"]) >= 1,
       f"status={t2['status'] if t2 else None} armed={int(t2['armed']) if t2 else '-'}")
    async with db.control_pool().acquire() as con:
        still_open = await con.fetchval(
            "select count(*) from open_loop where scope=$1::ltree and kind='question' "
            "and status='open'", SCOPE) or 0
        live_clocks = await con.fetchval(
            "select count(*) from timer t join open_loop l on l.id=t.loop_id "
            "where l.scope=$1::ltree and l.kind='question' and t.state='armed'", SCOPE) or 0
    ck("R3 ONE reply ends the silence for EVERY open question (two were outstanding — both closed, "
       "zero clocks left running against a customer who plainly wrote back)",
       int(still_open) == 0 and int(live_clocks) == 0,
       f"open={int(still_open)} armed={int(live_clocks)}")
    ck("R3 no open question → `question.answered` is not even written (no lies in the world lane)",
       (await review.on_answer(BOSS_SCOPE)).get("noop") is True and res.get("ok") is True)

    # ── the worker, fully stubbed: nothing may leave, and the model may not be consulted ─────────
    _sends, _surfaced = [], []

    async def _verify_must_not_run(con, **kw):
        raise AssertionError("the review rung consulted the T1 VERIFY — it must be deterministic")

    async def _fake_send(addr, text, **kw):
        _sends.append((addr, text))
        return "SM_vitalreview"

    async def _fake_reach(con, scope, intent="nudge", has_email=False):
        return {"channel": "freeform"}

    async def _fake_surface(cls, detail, ref_scope=None):
        _surfaced.append((cls, detail, ref_scope))
        return {"class": cls, "via": "vital", "alert_id": 1}

    _orig = (worker._verify_branch, twilio_wa.send_whatsapp, reach.choose_channel,
             presence.quiet_now, ops.record_alert)
    worker._verify_branch = _verify_must_not_run     # R7: firing must never reach a model
    twilio_wa.send_whatsapp = _fake_send
    reach.choose_channel = _fake_reach
    presence.quiet_now = lambda now=None: False
    ops.record_alert = _fake_surface
    try:
        # ── R5 · TOO EARLY → NOTHING. Nothing on this scope is due yet — the hour rung and the cut
        # tab's ~25min clamp are both still ahead. A full tick must park neither.
        await worker.run_once(db.control_pool())
        ck("R5 INSIDE the window the queue stays EMPTY — only the timeout promotes anything",
           len(await _parked(SCOPE)) == 0, f"parked={len(await _parked(SCOPE))}")

        # ── R4 · ANSWERED → NEVER. Pull EVERY clock the answered tab could still own to the past.
        async with db.scoped_tx(SCOPE) as con:
            await con.execute(
                "update timer set fires_at = now() - interval '1 second' "
                "where loop_id=$1", t["id"])
        await worker.run_once(db.control_pool())
        parked = await _parked(SCOPE)
        ck("⚑ R4 AN ANSWERED QUESTION NEVER REACHES THE HUMAN — its clock is cancelled, so a tick "
           "over a past-due timer parks nothing",
           len(parked) == 0, f"parked={[dict(p)['kind'] for p in parked]}")

        # ── R6 · TIMED OUT → REVIEW. A fresh unanswered question, its hour pulled back into the past.
        await review.on_question_asked(SCOPE, Q, "ask-vital-2", tier="customer")
        t3 = await _tab(SCOPE, "question:ask-vital-2")
        async with db.scoped_tx(SCOPE) as con:
            await con.execute("update timer set fires_at = now() - interval '1 second' "
                              "where id=$1 and state='armed'", t3["timer_id"])
        fired = await worker.run_once(db.control_pool())
        parked = [dict(p) for p in await _parked(SCOPE)]
        mine = [p for p in parked if (p["payload"] or {}).get("loop_id") == int(t3["id"])]
        t3b = await _tab(SCOPE, "question:ask-vital-2")
        ck("⚑ R6 AN UNANSWERED QUESTION LANDS IN REVIEW — after the window, exactly ONE parked item",
           fired >= 1 and len(mine) == 1, f"tick={fired} mine={len(mine)} all={len(parked)}")
        ck("R6 it carries source `timeout` and the queue's own «why» — never a raw action kind",
           mine and (mine[0]["payload"] or {}).get("review_source") == review.TIMEOUT
           and review.WHY[review.TIMEOUT] in (mine[0]["reason"] or ""),
           (mine[0]["reason"] if mine else "")[:70])
        ck("R6 the review rung SPEAKS TO NOBODY: zero outbound, and the tab stops carrying a dead clock",
           not [s for s in _sends if s[0] == PHONE] and t3b is not None
           and t3b["status"] == "resolved" and int(t3b["armed"]) == 0,
           f"sends={len(_sends)} tab={t3b['status'] if t3b else None}")
        ck("R7 NO MODEL IN THE LOOP — the park happened with a _verify_branch that RAISES on contact",
           len(mine) == 1)

        # ── R10 · SOMBRA SHUTS THE MOUTH, NOT THE QUEUE ─────────────────────────────────────────
        await gate.set_mode(SCOPE, gate.SOMBRA)
        await review.on_question_asked(SCOPE, Q, "ask-vital-3", tier="customer")
        t4 = await _tab(SCOPE, "question:ask-vital-3")
        async with db.scoped_tx(SCOPE) as con:
            await con.execute("update timer set fires_at = now() - interval '1 second' "
                              "where id=$1 and state='armed'", t4["timer_id"])
        await worker.run_once(db.control_pool())
        parked2 = [dict(p) for p in await _parked(SCOPE)]
        mine2 = [p for p in parked2 if (p["payload"] or {}).get("loop_id") == int(t4["id"])]
        ck("⚑ R10 MODO SOMBRA silences the MOUTH, never the QUEUE — the timeout still parks (§5.5)",
           len(mine2) == 1 and (mine2[0]["payload"] or {}).get("review_source") == review.TIMEOUT,
           f"mine={len(mine2)}")
        ck("R10 …and it is a REVIEW park, not a sombra draft (the two sources stay distinguishable)",
           mine2 and mine2[0]["kind"] == "review")
        await gate.set_mode(SCOPE, None)

        # ── R11 · THE QUEUE EXPLAINS ITSELF ─────────────────────────────────────────────────────
        async with db.scoped_tx(SCOPE) as con:
            await con.execute(
                "insert into action(scope,kind,payload,state,reason,needs_human,money) "
                "values($1::ltree,'place_order','{}'::jsonb,'pending','precio fuera de tarifa',true,true)",
                SCOPE)
        items = [i for i in await runtime.review_list(200) if i["scope"] == SCOPE]
        ck("R11 EVERY row on the sheet reports exactly one of the three sources + its why",
           len(items) >= 3 and all(i.get("review_source") in review.SOURCES and i.get("why")
                                   for i in items),
           f"n={len(items)} srcs={sorted({i.get('review_source') for i in items})}")
        ck("R11 a money park reads as a FLAG, a timed-out question as a TIMEOUT — the rule, on the read",
           {i["review_source"] for i in items if i["kind"] == "place_order"} == {review.FLAG}
           and {i["review_source"] for i in items if i["kind"] == "review"} == {review.TIMEOUT})
    finally:
        (worker._verify_branch, twilio_wa.send_whatsapp, reach.choose_channel,
         presence.quiet_now, ops.record_alert) = _orig
        await _wipe(SCOPE, BOSS_SCOPE)
        async with db.scoped_tx(SCOPE) as con:
            await con.execute("delete from scope_state where scope=$1::ltree", SCOPE)
            await con.execute("delete from scope_node where scope=$1::ltree", SCOPE)
        async with db.scoped_tx(BOSS_SCOPE) as con:
            await con.execute("delete from scope_node where scope=$1::ltree", BOSS_SCOPE)

    passed = sum(R)
    print(f"\nREVIEW RULE: {passed}/{len(R)} passed — "
          f"{'THREE SOURCES, AND THE CUSTOMER ANSWERS FIRST' if passed == len(R) else 'BROKEN'}")
    return 0 if passed == len(R) else 1


raise SystemExit(asyncio.run(main()))
