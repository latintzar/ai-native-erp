"""worker.py — THE TIMER WORKER, the runtime's only clock (SPEC §5.0 / §5.0.1 / §3.1).

This is what makes Rocoto CHASE people. Timers are the ONLY clock in the runtime (SPEC §3.1:
absence-only; there is no cron of business logic, no polling of the world — the world pushes events,
and the ONE thing that fires on the *absence* of an event is an armed timer coming due). When a timer
fires it means: "the thing I was waiting for did NOT happen in time — react." That reaction is a
pre-recorded branch decided at tab-open time by the mind (SPEC §3.1 contingencies), so firing is
cheap and deterministic: ONE cheap Haiku VERIFY that the pre-armed branch still applies, then send
the pre-written sentence through the same deterministic outbound gate every message crosses (§5).

THE FIRED-TIMER CASE (SPEC §5.0.1, action 2), step by step:
  1. VERIFY (T1): a single cheap Haiku call confirms the world since arming still fits the pre-armed
     branch. If it drifted OFF_SCRIPT → we do NOT act on a stale branch; we append an 'escalate.tab'
     event and stop. The mind wakes later on that escalation and reasons fully. Cheap-path stays cheap;
     the expensive path only opens when reality moved.
  2. GATE: the branch's ready-to-send sentence crosses gate.check_outbound(). A money/concession
     sentence NEVER auto-sends from a timer — it parks an action row (needs_human) for a person.
  3. SEND: otherwise the chase/nudge goes out over the live WhatsApp rail and we append 'msg.sent'.
  4. REARM (the ladder): if the fired branch carries a `rearm {after, branch_id}`, arm the NEXT rung
     so a dunning/chase ladder never dies after rung 1 (a debt chase that only pings once is useless).

Idempotency & safety (SPEC §3.1 / §5.0):
  * The scan is the ONLY scan the worker does (ix_timer_due: armed timers by fires_at). It reads
    candidates cross-scope on the OWNER pool, then does ALL work per-timer inside db.scoped_tx(scope)
    so the DATABASE (RLS) binds every read/write to the timer's own world — one fired timer can never
    touch another party's rows.
  * Inside the scoped tx we CLAIM the timer with FOR UPDATE SKIP LOCKED and re-assert state='armed':
    two workers (or a re-tick during a slow send) can't fire the same timer twice.
  * We re-check open_loop.status='open' at the SEND instant — a payment that resolved the tab between
    scan and act must make the chase a NO-OP (the whole point of not dunning someone who already paid).
  * mark timer state='fired', fired_at=now() exactly once; the rearm insert rides the arm-together DB
    trigger (the next rung's branch_id MUST already be a contingency on the tab, or the insert raises).

Deployment policy:
  The automatic loop starts paused. ROCOTO_WORKER_EFFECT_MODE=enabled is accepted only for an
  explicitly configured production environment. Nonproduction keeps queued work intact and
  reports a paused heartbeat; messaging capture alone cannot sandbox billing and Meta syncs.
  Scoped test harnesses call individual operations with their explicit database/provider seams.

Provides:
  * run_once(pool) -> int — timer operation for an explicitly governed caller or fixture harness.
  * run_forever(poll_seconds=20) — the deployment-policy-controlled automatic loop.
  * a __main__ that loads /opt/rocoto/.env (mirrors narrate.py), db.init()s, warms embeddings, and
    runs the forever loop.
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import TYPE_CHECKING, Any, Optional

import asyncpg

import config
import db
import gate
import spine
import twilio_wa
import worker_policy
from brain import llm

if TYPE_CHECKING:
    from worker_capture import TimerCapture

log = logging.getLogger("rocoto.worker")

# How many due timers one tick claims+processes (bounds a tick's work; the loop drains the rest on the
# next pass). Kept modest so a backlog spike can't monopolise the DB or the Anthropic/Twilio budget.
SCAN_LIMIT = 50


# ── T1 VERIFY: the ONE cheap Haiku call (SPEC §5.0.1) ────────────────────────────────────────
# Given the tab + notes + the pre-armed branch + what happened since arming, confirm the pre-recorded
# branch STILL applies (return it) or declare OFF_SCRIPT (reality moved — hand it to the full mind).
# Forced tool call = structured output; temperature 0 (llm.call_tool). Haiku-primary (config.VOICE_CHAT_MODEL).
_VERIFY_TOOL: dict[str, Any] = {
    "name": "verify_branch",
    "description": ("Confirma si la rama pre-decidida para este asunto TODAVÍA aplica dado lo que ha "
                    "pasado (o no ha pasado) desde que se armó el temporizador, o decláralo fuera de "
                    "guion si la realidad ha cambiado y esa frase ya no encaja."),
    "input_schema": {
        "type": "object",
        "properties": {
            "verdict": {
                "type": "string",
                "enum": ["CONFIRMED", "OFF_SCRIPT"],
                "description": ("CONFIRMED = la rama pre-decidida sigue siendo la reacción correcta al "
                                "silencio/ausencia. OFF_SCRIPT = algo cambió (ya respondió, ya pagó, el "
                                "contexto es otro) y no se debe enviar esa frase — que despierte la mente."),
            },
            "reason": {"type": "string", "description": "Motivo breve, en español."},
        },
        "required": ["verdict"],
    },
}

_VERIFY_SYSTEM = (
    "Eres el verificador de Rocoto. Un temporizador de AUSENCIA acaba de dispararse: alguien NO hizo "
    "algo a tiempo, y hay una reacción YA decidida de antemano (una rama con su frase lista). Tu único "
    "trabajo es comprobar si esa rama pre-decidida SIGUE siendo la reacción correcta ahora mismo, o si "
    "la realidad ha cambiado tanto que enviarla sería un error. Regla de oro: ante la duda, o si ves "
    "cualquier señal de que la situación ya se resolvió o cambió (respondió, pagó, canceló, otra cosa "
    "ocupa el asunto), responde OFF_SCRIPT. Nunca inventes hechos: sólo juzgas encaje, no rediseñas."
)


def _events_since_text(rows: list[asyncpg.Record]) -> str:
    """Compact, deterministic rendering of the events since the timer was armed (for the VERIFY call)."""
    if not rows:
        return "(nada — silencio total desde que se armó)"
    out = []
    for r in rows:
        payload = r["payload"] or {}
        if isinstance(payload, str):  # defensive: a codec-less row would hand back a JSON string
            try:
                payload = json.loads(payload)
            except Exception:
                payload = {}
        body = payload.get("text") or payload.get("body") or ""
        ts = r["ts"].isoformat() if r["ts"] is not None else ""
        line = f"[{ts}] {r['type']}"
        if body:
            line += f": {body}"
        out.append(line)
    return "\n".join(out)


async def _verify_branch(con: asyncpg.Connection, *, loop_text: str, notes: Any,
                         branch: dict, since_rows: list[asyncpg.Record]) -> bool:
    """The T1 VERIFY (SPEC §5.0.1). True → the pre-armed branch still applies; False → OFF_SCRIPT.

    Fail-CLOSED on the branch, fail-SAFE overall: if the model errors or returns nothing, we treat it
    as OFF_SCRIPT (do NOT auto-send a stale sentence — the mind wakes on the escalation instead). A
    chase we don't send is recoverable; a wrong chase we DO send is not."""
    if isinstance(notes, str):
        try:
            notes = json.loads(notes)
        except Exception:
            notes = []
    note_text = "\n".join(
        f"- {n.get('text', '')}" for n in (notes or []) if isinstance(n, dict) and n.get("text"))
    sentence = branch.get("action", {}).get("sentence") or branch.get("action_sentence") or ""
    payload_text = (
        f"ASUNTO ABIERTO:\n{loop_text or '(sin texto)'}\n\n"
        f"NOTAS DEL ASUNTO:\n{note_text or '(sin notas)'}\n\n"
        f"RAMA PRE-DECIDIDA (branch_id={branch.get('branch_id')}):\n"
        f"  disparador: {branch.get('trigger', '(ausencia)')}\n"
        f"  frase lista para enviar: {sentence or '(sin frase)'}\n\n"
        f"LO QUE HA PASADO DESDE QUE SE ARMÓ EL TEMPORIZADOR:\n{_events_since_text(since_rows)}\n\n"
        "¿Sigue aplicando esta rama (CONFIRMED) o está fuera de guion (OFF_SCRIPT)?"
    )
    try:
        out = await llm.call_tool(
            config.VOICE_CHAT_MODEL, _VERIFY_SYSTEM, payload_text, _VERIFY_TOOL, "verify_branch",
            max_tokens=256, fallback="claude-haiku-4-5-20251001")
    except Exception:
        log.exception("worker: T1 VERIFY call failed — treating as OFF_SCRIPT (fail-safe)")
        return False
    if not out:
        return False
    return out.get("verdict") == "CONFIRMED"


# ── the fired-timer case (SPEC §5.0.1 action 2) ──────────────────────────────────────────────
def _find_contingency(contingencies: Any, branch_id: str) -> Optional[dict]:
    """Locate the pre-armed branch on the tab by branch_id (l.contingencies is a jsonb array)."""
    if isinstance(contingencies, str):
        try:
            contingencies = json.loads(contingencies)
        except Exception:
            return None
    for c in contingencies or []:
        if isinstance(c, dict) and c.get("branch_id") == branch_id:
            return c
    return None


async def _resolve_wa_addr(con: asyncpg.Connection, scope: str) -> Optional[str]:
    """The party's WhatsApp endpoint for this scope (SPEC §3 identity). None → we can't chase (no rail)."""
    return await con.fetchval(
        "select addr from endpoint e join contact c on c.id=e.contact_id "
        "where c.scope=$1::ltree and e.kind='wa' limit 1", scope)


async def _fire_one(con: asyncpg.Connection, timer: asyncpg.Record, *,
                    capture: Optional[TimerCapture] = None) -> bool:
    """Process ONE due timer inside its own scoped tx (SPEC §5.0.1). Returns True if it FIRED (was
    claimed and processed to a terminal state), False if it was a no-op (already claimed / tab resolved /
    branch vanished). The caller counts True's."""
    scope = timer["scope"]
    timer_id = timer["id"]
    if capture is not None:
        capture.check_scope(scope, timer_id)

    # CLAIM: re-read this timer FOR UPDATE SKIP LOCKED and re-assert it is still armed + due + its loop
    # open. Two workers racing the same due timer: only one gets the row lock; the other SKIPs → no
    # double-fire. A tab that resolved (payment) between scan and now makes this a clean no-op.
    row = await con.fetchrow(
        "select t.id, t.loop_id, t.branch_id, t.armed_by_event, "
        "       l.contingencies, l.text as loop_text, l.notes, l.status as loop_status "
        "from timer t join open_loop l on l.id=t.loop_id "
        "where t.id=$1 and t.state='armed' and l.status='open' "
        "for update of t skip locked",
        timer_id)
    if row is None:
        return False  # already claimed by a peer, or the tab is no longer open → nothing to do

    loop_id = row["loop_id"]
    branch_id = row["branch_id"]

    # A 'timer.fired' event on the world lane — the spine records that the clock spoke (SPEC §3.1).
    fired_eid, _ = await spine.append_event(
        con, scope, "timer.fired", "timer",
        {"timer_id": int(timer_id), "loop_id": int(loop_id), "branch_id": branch_id},
        caused_by=row["armed_by_event"], lane="world")

    # Locate the pre-armed branch on the tab (arm-together guarantees it exists, but a hand-edited tab
    # or a legacy row might not — treat a missing branch as OFF_SCRIPT rather than crashing the tick).
    branch = _find_contingency(row["contingencies"], branch_id)
    if capture is not None:
        capture.check_branch(branch)

    # The events since the timer was armed — the delta the VERIFY judges against (world lane only; the
    # timer.fired we just wrote is excluded by id < fired_eid).
    since_rows: list[asyncpg.Record] = []
    if row["armed_by_event"] is not None:
        since_rows = await con.fetch(
            "select type, payload, ts from event where scope=$1::ltree and lane='world' "
            "and id > $2 and id < $3 order by id", scope, row["armed_by_event"], fired_eid)

    # THE REVIEW RUNG IS DETERMINISTIC (BLOCK D · SPEC §5.8). A rung whose channel is `review` does not
    # speak to anybody — it PARKS the matter in front of the human. Its whole premise is that the tab is
    # still OPEN, and an answer resolves the tab + cancels this timer inside the same commit (the claim
    # above already re-asserted `l.status='open'`). So there is nothing for the T1 VERIFY to judge, and
    # asking a model would only invent a way for the timeout to silently NOT happen — the exact failure
    # the rule exists to prevent. The three-source queue must be as certain as the clock.
    is_review = branch is not None and (branch.get("channel") or "").lower() == "review"
    confirmed = False
    if is_review:
        confirmed = True
    elif capture is not None:
        confirmed = await capture.verify_branch(con, fired_eid)
    elif branch is not None:
        confirmed = await _verify_branch(
            con, loop_text=row["loop_text"], notes=row["notes"], branch=branch, since_rows=since_rows)

    if branch is None or not confirmed:
        # OFF_SCRIPT (SPEC §5.0.1): do NOT act on a stale branch. Escalate the tab; the mind wakes later
        # and reasons fully. Still mark the timer fired (idempotent) so we don't re-verify it forever.
        esc_eid, _ = await spine.append_event(
            con, scope, "escalate.tab", "timer",
            {"tab_id": int(loop_id), "reason": "off_script"},
            caused_by=fired_eid, lane="world")
        # WP-1: arm the wake so the wake-scan fires a fresh R1 (deduped per tab).
        await spine.arm_wake(con, scope, "escalate", {"tab_id": int(loop_id), "reason": "off_script"},
                             dedupe_key=f"tab:{int(loop_id)}", caused_by=esc_eid)
        await con.execute(
            "update timer set state='fired', fired_at=now() where id=$1", timer_id)
        return True

    # CONFIRMED → take the branch's action. The ready-to-send sentence (support both nestings).
    sentence = (branch.get("action") or {}).get("sentence") or branch.get("action_sentence") or ""

    if is_review:
        # THE REVIEW TRANSPORT (BLOCK D) — generic, a third sibling of the `boss` and email rails: the
        # rung's sentence is not spoken, it is the LINE THE QUEUE SHOWS. It goes through the one door
        # (review.hold_for_review), which refuses any source outside the closed three, so a manifest row
        # can widen the queue's reasons no more than it can exempt itself from the money gate.
        #
        # SOMBRA-EXEMPT, deliberately: §5.5 shuts the MOUTH and keeps surfacing to review — holding a
        # review park would silence the one channel sombra promises stays loud. Nothing here reaches a
        # customer, so the money invariant is untouched.
        import review as _review
        src = branch.get("review_source") or _review.FLAG
        if not _review.is_source(src):
            log.error("worker: timer %s carries review_source=%r, outside the rule — parking as %r",
                      timer_id, src, _review.FLAG)
            src = _review.FLAG
        await _review.hold_for_review(
            scope, src, text=sentence or row["loop_text"] or "", con=con,
            opened_by_event=fired_eid,
            detail={"loop_id": int(loop_id), "branch_id": branch_id, "origin": "timer",
                    "tab_text": row["loop_text"] or ""})
        rearmed = await _rearm_next(con, scope, loop_id, row["contingencies"], branch,
                                    fired_eid, timer_id)
        if not rearmed:
            # A parked matter is the human's now — the tab stops carrying a clock nobody will answer.
            await con.execute(
                "update open_loop set status='resolved', resolved_at=now(), resolution=$2 "
                "where id=$1 and status='open'",
                loop_id, {"branch_id": branch_id,
                          "note": f"parked for review ({src}) — the human resolves it"})
        await con.execute("update timer set state='fired', fired_at=now() where id=$1", timer_id)
        log.info("worker: timer %s branch=%s PARKED FOR REVIEW (%s)%s",
                 timer_id, branch_id, src, "" if rearmed else " — tab resolved")
        return True

    if sentence:
        # MODO SOMBRA (SPEC §5.5) — checked FIRST, ahead of the money gate and the pacing/reach
        # ladder: a proactive chase is the most "he spoke without me" thing the employee does, so
        # when the mouth is shut it stops here, the rung's sentence is recorded as a draft on the
        # review sheet, and the ladder still climbs (the tab keeps its clock; the boss can send it).
        # A `channel: 'boss'` rung is EXEMPT: it is a debrief FOR the boss, and §5.5 keeps nudging
        # the boss precisely so sombra is informative rather than silent.
        if (branch.get("channel") or "").lower() != "boss" and \
                await gate.hold_if_sombra(scope, "message", sentence, con=con,
                                          detail={"loop_id": int(loop_id), "branch_id": branch_id,
                                                  "origin": "timer"}):
            log.info("worker: timer %s branch=%s HELD by modo sombra — drafted, not sent", timer_id, branch_id)
            sentence = ""
    if sentence:
        # THE GATE (SPEC §5): every outbound sentence crosses it. A money/concession sentence NEVER
        # auto-sends from a timer — it PARKS for a human (needs_human) instead of going out.
        verdict = gate.check_outbound(sentence, await gate.standing_prices(con, scope))
        # BOSS CHANNEL (TRACK 3 · report_call): a rung tagged channel:'boss' is a debrief FOR PETER, not
        # an outbound to the party — route it to ops.record_alert (the Rocoto→Peter inbox) and stop.
        # Placed BEFORE pacing/park so a debrief is never held to human hours or reach-gated. The money
        # invariant is intact: the boss channel NEVER targets a customer (money only reaches a customer
        # via the unchanged wa/email branches, which still gate). Generic transport, like the email rung.
        if (branch.get("channel") or "").lower() == "boss":
            import ops
            receipt = await ops.record_alert("report", sentence, ref_scope=scope)
            if receipt.get("alert_id") is None:
                raise RuntimeError("operator inbox persistence failed; retry this timer")
            await spine.append_event(
                con, scope, "msg.sent", "boss",
                {"text": sentence, "loop_id": int(loop_id), "branch_id": branch_id,
                 "channel": "boss", "origin": "timer"},
                caused_by=fired_eid, lane="world")
            # LADDER OR DONE: a boss rung with a rearm climbs like any other; a one-shot debrief that
            # just DELIVERED is finished business — resolve its tab. Leaving it open (the old behavior)
            # leaked an open-forever tab with no armed clock for every 'callreport:' debrief.
            rearmed = await _rearm_next(con, scope, loop_id, row["contingencies"], branch,
                                        fired_eid, timer_id)
            if not rearmed:
                await con.execute(
                    "update open_loop set status='resolved', resolved_at=now(), resolution=$2 "
                    "where id=$1 and status='open'",
                    loop_id, {"branch_id": branch_id,
                              "note": "one-shot boss debrief delivered (auto-resolved by worker)"})
            await con.execute("update timer set state='fired', fired_at=now() where id=$1", timer_id)
            log.info("worker: timer %s branch=%s DEBRIEFED Peter (boss channel)%s",
                     timer_id, branch_id, "" if rearmed else " — tab resolved (one-shot)")
            return True
        # WP-8b R6 PACING: a proactive touch keeps human hours — hold a would-be SEND (not a park) to the
        # next reasonable window (never 3am / siesta). Reactive replies are instant; only timers are paced.
        # M1M2 WP-0: a branch carrying `pacing_deadline` is held ONLY if the hold still lands before
        # that deadline — a pre-cutoff review-nudge held past its cutoff is worthless (_pacing_hold_ok).
        if not verdict.get("needs_approval"):
            try:
                import presence
                if presence.quiet_now() and _pacing_hold_ok(branch):
                    _nxt = presence.next_ok_time()
                    await con.execute("update timer set fires_at=$2 where id=$1 and state='armed'", timer_id, _nxt)
                    await con.execute("update open_loop set due_at=$2 where id=$1", loop_id, _nxt)  # mirror the held clock
                    await spine.append_event(con, scope, "pacing.held", "timer",
                                             {"loop_id": int(loop_id), "branch_id": branch_id, "until": _nxt.isoformat()},
                                             caused_by=fired_eid, lane="reasoning")
                    log.info("worker: timer %s HELD by pacing until %s", timer_id, _nxt)
                    return True
            except Exception:
                pass
        if verdict.get("needs_approval"):
            await con.execute(
                "insert into action(scope,kind,payload,state,reason,needs_human,money,opened_by_event) "
                "values($1::ltree,'send_outbound',$2,'pending',$3,true,$4,$5)",
                scope,
                {"sentence": sentence, "loop_id": int(loop_id), "branch_id": branch_id,
                 "surface": "wa", "origin": "timer"},
                verdict.get("reason", "needs_approval"), bool(verdict.get("money")), fired_eid)
            log.info("worker: timer %s branch=%s PARKED (gate: %s)",
                     timer_id, branch_id, verdict.get("reason"))
        elif (branch.get("channel") or "").lower() == "email":
            # EMAIL RUNG (employment dunning r2 / SPEC §4.5): this branch opted into the email rail. Send
            # a formal reminder via actions.send_email to the scope's email endpoint. No email on file →
            # PARK (never a silent drop, SPEC §5). WhatsApp rungs are untouched (this branch is opt-in).
            import actions
            email_addr = await con.fetchval(
                "select e.addr from endpoint e join contact c on c.id=e.contact_id "
                "where c.scope=$1::ltree and e.kind='email' order by e.id desc limit 1", scope)
            sent = False
            if email_addr:
                subject = branch.get("email_subject") or "Aviso de Rocoto"
                html = branch.get("email_html") or f"<p>{sentence}</p>"
                if capture is not None:
                    sent = await capture.send_email(con, fired_eid, email_addr, subject, html)
                else:
                    sent = await actions.send_email(email_addr, subject, html)
            if sent and capture is not None:
                log.info("worker: timer %s captured email intent for scoped proof", timer_id)
            elif sent:
                _pe_em, _ = await spine.append_event(
                    con, scope, "msg.sent", "email",
                    {"text": sentence, "addr": email_addr, "loop_id": int(loop_id),
                     "branch_id": branch_id, "origin": "timer", "channel": "email"},
                    caused_by=fired_eid, lane="world")
                try:  # WP-9 P0: project the proactive email touch too
                    import projector
                    await projector.project_msg_sent(scope, sentence, None, _pe_em)
                except Exception:
                    pass
                log.info("worker: timer %s branch=%s SENT email to %s", timer_id, branch_id, email_addr)
            else:
                await con.execute(
                    "insert into action(scope,kind,payload,state,reason,needs_human,opened_by_event) "
                    "values($1::ltree,'send_outbound',$2,'pending',$3,true,$4)",
                    scope,
                    {"sentence": sentence, "loop_id": int(loop_id), "branch_id": branch_id,
                     "surface": "email", "origin": "timer"},
                    "email send failed / no email endpoint for scope", fired_eid)
                log.warning("worker: timer %s email rung could not send for %s — parked", timer_id, scope)
        else:
            # SEND: the real chase/nudge goes out over the live WhatsApp rail.
            addr = await _resolve_wa_addr(con, scope)
            if not addr:
                # No WhatsApp endpoint for this party → we can't chase. Park it so it's never a silent
                # drop (SPEC §5: nothing dies silently).
                await con.execute(
                    "insert into action(scope,kind,payload,state,reason,needs_human,opened_by_event) "
                    "values($1::ltree,'send_outbound',$2,'pending',$3,true,$4)",
                    scope,
                    {"sentence": sentence, "loop_id": int(loop_id), "branch_id": branch_id,
                     "surface": "wa", "origin": "timer"},
                    "no wa endpoint for scope", fired_eid)
                log.warning("worker: timer %s has no wa endpoint for %s — parked", timer_id, scope)
            else:
                # WP-6b PROACTIVE-REACH: before a self-started freeform WhatsApp, check the 24h window.
                # A closed window would eat the send silently (63016) — so HOLD + re-arm the chase for
                # later (when the window reopens on their next inbound) rather than fire into the void.
                # (Email/template/call branches route explicitly above; freeform is the reachable-now path.)
                try:
                    import reach
                    dec = await reach.choose_channel(con, scope, intent="nudge", has_email=False)
                except Exception:
                    dec = {"channel": "freeform"}
                if dec.get("channel") not in ("freeform",):
                    # not reachable by freeform now → re-arm this branch ~6h out; never a silent 63016.
                    await con.execute(
                        "update timer set fires_at = now() + interval '6 hours' where id=$1 and state='armed'", timer_id)
                    await con.execute(  # mirror the held clock on the tab's label
                        "update open_loop set due_at = now() + interval '6 hours' where id=$1", loop_id)
                    await spine.append_event(con, scope, "reach.held", "timer",
                                             {"loop_id": int(loop_id), "branch_id": branch_id,
                                              "channel": dec.get("channel"), "reason": dec.get("reason")},
                                             caused_by=fired_eid, lane="reasoning")
                    log.info("worker: timer %s HELD (reach=%s: %s) — re-armed", timer_id, dec.get("channel"), dec.get("reason"))
                    return True
                sid = await twilio_wa.send_whatsapp(addr, sentence)
                _pe, _ = await spine.append_event(
                    con, scope, "msg.sent", "wa",
                    {"text": sentence, "addr": addr, "loop_id": int(loop_id),
                     "branch_id": branch_id, "origin": "timer", "wa_message_id": sid},
                    caused_by=fired_eid, lane="world")
                try:  # WP-9 P0: project the proactive send so the SyP app SEES it
                    import projector
                    await projector.project_msg_sent(scope, sentence, sid, _pe)
                except Exception:
                    pass
                log.info("worker: timer %s branch=%s SENT chase to %s (sid=%s)",
                         timer_id, branch_id, addr, sid)

    # REARM THE LADDER (SPEC §5.0.1, action 2): if the fired branch carries a rearm, arm the next rung
    # so a dunning/chase ladder never dies after rung 1 (and keep the tab's due_at mirroring the newly
    # armed clock — _rearm_next).
    await _rearm_next(con, scope, loop_id, row["contingencies"], branch, fired_eid, timer_id)

    # IDEMPOTENT: mark this timer terminal exactly once.
    await con.execute("update timer set state='fired', fired_at=now() where id=$1", timer_id)
    return True


async def _rearm_next(con: asyncpg.Connection, scope: str, loop_id: int, contingencies: Any,
                      branch: dict, fired_eid: int, timer_id: int) -> bool:
    """Arm the NEXT rung named by the fired branch's `rearm {after, branch_id}` AND move the tab's
    due_at to the same instant — due_at is the 'absence horizon (mirrors the armed timer)' (schema
    §3.1); the two clocks are one expression here so they can never disagree again. The next rung's
    branch_id MUST already be a contingency on this tab (arm-together) — the DB trigger enforces it;
    a bad rung raises and rolls back this timer's whole tx (safer than a half-fired ladder). We guard
    here too for a clear log. Returns True iff a rung was armed."""
    rearm = branch.get("rearm") if isinstance(branch.get("rearm"), dict) else None
    if not (rearm and rearm.get("after") and rearm.get("branch_id")):
        return False
    next_branch = rearm["branch_id"]
    if _find_contingency(contingencies, next_branch) is None:
        log.warning("worker: timer %s rearm branch=%s not a contingency on loop %s — skipping rung",
                    timer_id, next_branch, loop_id)
        return False
    # A LADDER THAT NEVER ENDS IS A DEFECT, NOT A FEATURE. A tracker re-arms itself indefinitely by
    # design (a weekly watch should still be watching next year), so the guard cannot be "stop after N
    # days" — but a rung that has climbed REARM_MAX_RUNGS times says something is wrong with the ROW, not
    # with the world. Stop, and SAY SO: a runaway that is silently capped is still a defect nobody can
    # see. Counted from the timer trail itself, which is the only record that outlives a restart.
    climbed = int(await con.fetchval(
        "select count(*) from timer where loop_id=$1 and branch_id=$2 and state='fired'",
        loop_id, next_branch) or 0)
    if climbed >= REARM_MAX_RUNGS:
        log.error("worker: loop %s rung %s has fired %d times — REFUSING to re-arm. The row's cadence "
                  "is almost certainly wrong; the tab stays open so nothing is lost.",
                  loop_id, next_branch, climbed)
        try:
            import ops
            await ops.record_alert(
                "F", f"Una vigilancia se ha disparado {climbed} veces seguidas (loop {loop_id}, "
                     f"rung {next_branch}) y he dejado de re-armarla. La cadencia de esa regla está mal.")
        except Exception:
            log.debug("runaway surface fail-soft", exc_info=True)
        return False

    secs = str(_rearm_seconds(rearm["after"]))
    await con.execute(
        "insert into timer(scope,loop_id,fires_at,kind,branch_id,state,armed_by_event) "
        "values($1::ltree,$2, now() + ($3 || ' seconds')::interval, 'absence',$4,'armed',$5)",
        scope, loop_id, secs, next_branch, fired_eid)
    await con.execute(
        "update open_loop set due_at = now() + ($2 || ' seconds')::interval where id=$1", loop_id, secs)
    log.info("worker: timer %s REARMED next rung branch=%s after=%s (due_at follows)",
             timer_id, next_branch, rearm["after"])
    return True


def _pacing_hold_ok(branch: dict) -> bool:
    """M1M2 WP-0 — the pacing WINDOW: a branch carrying `pacing_deadline` (an ISO datetime, slot-filled
    at tab-open time; the review-nudge writes its dispatch cutoff there) may be held by human-hours
    pacing ONLY if the hold would still land BEFORE that deadline. If the next OK window opens at or
    after the deadline, holding defeats the branch's whole purpose (the orders are already held by
    then) — so it sends NOW instead. No deadline, or an unparseable one → True (normal pacing; never
    wake a human over a malformed row)."""
    raw = branch.get("pacing_deadline")
    if not raw:
        return True
    try:
        from datetime import datetime as _dt

        import presence
        deadline = _dt.fromisoformat(str(raw))
        if deadline.tzinfo is None:
            deadline = deadline.replace(tzinfo=presence.TZ)
        ok = presence.next_ok_time() < deadline
        if not ok:
            log.info("worker: pacing EXEMPT — hold would overshoot pacing_deadline=%s, sending now", raw)
        return ok
    except Exception:
        log.warning("worker: unparseable pacing_deadline=%r — normal pacing applies", raw)
        return True


# THE DEFENSIVE FLOOR ON A RE-ARM (2026-07-27). A rung that names itself is the recurrence mechanism
# (duties.py), and for a TRACKER the cadence comes from a sentence a person said and a model parsed —
# «avísame cada segundo» is a plausible first-day joke. Without a floor that produces a self-re-arming
# rung firing every second, forever, on the live worker. `trackers.build_policy` clamps at the point of
# CREATION, which is where the boss can be told what he actually got; this floor exists because a duty
# ROW outlives the code that wrote it — a row already in the database, or one written by a future
# caller, must not be able to do it either. Belt and braces, deliberately.
# No shipped duty row uses `rearm` at all (only trackers create them), so this floor cannot shorten
# anything that exists today; it can only stop something absurd.
REARM_MIN_SEC = 60
# A runaway must eventually STOP AND SAY SO, not be quietly capped forever. If one rung has climbed
# this many times, something is wrong with the row rather than with the world.
REARM_MAX_RUNGS = 500


def _rearm_seconds(after: Any) -> int:
    """Coerce a rearm `after` (seconds int, or a '2d'/'48h'/'30m'/'90s' string) into seconds, never
    below REARM_MIN_SEC. Defaults to 1 day on anything unparseable (a chase should still re-arm rather
    than silently vanish)."""
    if isinstance(after, (int, float)):
        return max(int(after), REARM_MIN_SEC)
    s = str(after or "").strip().lower()
    if not s:
        return 86400
    try:
        if s.endswith("d"):
            return max(int(float(s[:-1]) * 86400), REARM_MIN_SEC)
        if s.endswith("h"):
            return max(int(float(s[:-1]) * 3600), REARM_MIN_SEC)
        if s.endswith("m"):
            return max(int(float(s[:-1]) * 60), REARM_MIN_SEC)
        if s.endswith("s"):
            return max(int(float(s[:-1])), REARM_MIN_SEC)
        return max(int(float(s)), REARM_MIN_SEC)  # a bare number = seconds
    except (TypeError, ValueError):
        log.warning("worker: unparseable rearm.after=%r — defaulting to 1 day", after)
        return 86400


# ── the tick + the loop (SPEC §5.0) ──────────────────────────────────────────────────────────
async def run_once(pool: asyncpg.Pool) -> int:
    """One tick (SPEC §5.0.1): scan due armed timers cross-scope on the OWNER pool, then process each
    inside its own db.scoped_tx(scope) so the DB (RLS) binds every read/write to the timer's world.
    Returns the number of timers FIRED (for a scheduled caller / vitals). Fail-soft per timer: one bad
    timer logs and is skipped; it never aborts the tick or the loop."""
    # The scan: candidate due timers (id + scope only). FOR UPDATE SKIP LOCKED on the timer keeps two
    # concurrent ticks from even listing the same rows (belt-and-braces with the per-timer claim). The
    # claim + all work happen in the scoped tx below, so this scan tx is short and releases fast.
    async with pool.acquire() as scan_con, scan_con.transaction():
        # A plain READ (tier-P rocoto_ctrl is SELECT-only cross-scope). The AUTHORITATIVE claim is
        # the FOR UPDATE SKIP LOCKED inside _fire_one's scoped tx (rocoto_rt), re-asserting state +
        # due-ness — so two ticks racing the same candidate is harmless (one claims, the other no-ops).
        candidates = await scan_con.fetch(
            "select t.id, t.scope::text as scope from timer t join open_loop l on l.id=t.loop_id "
            "where t.state='armed' and t.fires_at < now() and l.status='open' "
            "order by t.fires_at limit $1",
            SCAN_LIMIT)
            # We only needed the id/scope list; the row locks release at this tx's commit (below). The
            # authoritative claim is the FOR UPDATE inside _fire_one's scoped tx.

    fired = 0
    for cand in candidates:
        scope = cand["scope"]
        timer_id = int(cand["id"])
        try:
            async with db.scoped_tx(scope) as con:
                # Hand _fire_one a minimal record shape (it re-reads authoritatively under the RLS-bound
                # scoped connection). We pass id+scope; everything else is fetched inside the claim.
                did = await _fire_one(con, {"id": timer_id, "scope": scope})
                if did:
                    fired += 1
        except Exception:
            log.exception("worker: timer %s (scope=%s) failed — skipped, tick continues", timer_id, scope)
    if fired:
        log.info("worker: tick fired %d timer(s)", fired)
    return fired


async def run_wake_once(pool: asyncpg.Pool) -> int:
    """WP-1 THE WAKE SCAN (the worker's 2nd scan): fire a fresh R1 wake-turn for every scope with an armed
    (or stale-firing >10min) wake. Scan cross-scope on the ctrl pool; claim + finish per scope under a
    scoped_tx; the LLM call runs OUTSIDE the lock. Skips muted scopes (a human holds the thread)."""
    import runtime
    import spine
    async with pool.acquire() as scan_con:
        rows = await scan_con.fetch(
            "select distinct scope::text as scope from wake "
            "where state='armed' or (state='firing' and fired_at < now() - interval '10 minutes') limit $1",
            SCAN_LIMIT)
    fired = 0
    for r in rows:
        scope = r["scope"]
        try:
            if await runtime.is_muted(scope):
                continue
            async with db.scoped_tx(scope) as con:
                wakes = [dict(w) for w in await spine.claim_wakes(con, scope)]
            if not wakes:
                continue
            await runtime.run_wake_turn(scope, wakes)  # own txns; OUTSIDE the claim lock
            async with db.scoped_tx(scope) as con:
                await spine.finish_wakes(con, scope, [w["id"] for w in wakes], "fired")
            fired += 1
        except Exception:
            log.exception("worker: wake scan failed for scope=%s", scope)
    if fired:
        log.info("worker: wake scan fired %d scope(s)", fired)
    return fired


async def run_pending_backstop(pool: asyncpg.Pool) -> int:
    """WP-1 the DOUBLE-FIRE-SAFE durability backstop: re-run a turn ONLY for pending_turn rows still
    'armed' past a MARGIN beyond the debounce AND with NO msg.sent since the deadline — i.e. a turn the
    live handler never answered (a process crash after ingest). A normally-answered turn was retired to
    'fired', so this NEVER re-fires it (the naive 'fire all overdue armed rows' would double-text)."""
    import runtime
    margin = int(getattr(config, "ROCOTO_PENDING_BACKSTOP_MARGIN_SEC", 120))
    async with pool.acquire() as scan_con:
        rows = await scan_con.fetch(
            "select p.scope::text as scope from pending_turn p "
            "where p.state='armed' and p.deadline < now() - ($1 || ' seconds')::interval "
            "and not exists (select 1 from event e where e.scope=p.scope and e.type='msg.sent' "
            "                and e.ts > p.deadline) limit $2", str(margin), SCAN_LIMIT)
    fired = 0
    for r in rows:
        scope = r["scope"]
        try:
            if await runtime.is_muted(scope):
                continue
            async with db.scoped_tx(scope) as con:
                claimed = await con.fetchval("update pending_turn set state='fired', updated_at=now() "
                                             "where scope=$1::ltree and state='armed' returning 1", scope)
                last = await con.fetchval(
                    "select payload->>'text' from event where scope=$1::ltree and lane='world' "
                    "and type='message' order by id desc limit 1", scope) if claimed else None
            if claimed and last:
                phone = await runtime._phone_for_scope(scope)
                if phone:
                    await runtime.run_turn(phone, last, ingest=False, scope_override=scope)
                    fired += 1
        except Exception:
            log.exception("worker: pending backstop failed for scope=%s", scope)
    if fired:
        log.info("worker: pending backstop fired %d scope(s)", fired)
    return fired


_stuck_last_scan: float = 0.0


async def run_stuck_scan(pool: asyncpg.Pool) -> int:
    """THE STUCK-TAB SWEEP (the worker's liveness assertion on its own clock): any OPEN tab past its
    due_at where NO rung ever fired and NO timer is armed will never fire on its own — the clock it
    was promised is gone (a hand-edited row, a cancelled ladder, a config hole). Nothing dies silently
    (SPEC §5): surface each such tab to Peter ONCE via ops.record_alert, marked by a `tab.stuck`
    event so a later pass never re-alarms the same tab. Tabs with an ARMED timer are the timer scan's
    business (they will fire); tabs whose rungs DID fire are chased business, not rot. Throttled to one
    pass per ROCOTO_STUCK_SCAN_SEC (default 10 min) with a 10-min due grace so it never races a tick.
    Fail-soft: never raises into the loop. Returns the number of tabs surfaced."""
    global _stuck_last_scan
    import time as _time
    interval = int(getattr(config, "ROCOTO_STUCK_SCAN_SEC", 600))
    now = _time.monotonic()
    if _stuck_last_scan and now - _stuck_last_scan < max(interval, 1):
        return 0
    _stuck_last_scan = now
    try:
        async with pool.acquire() as scan_con:
            rows = await scan_con.fetch(
                "select l.id, l.scope::text as scope, l.text, l.due_at from open_loop l "
                "where l.status='open' and l.due_at < now() - interval '10 minutes' "
                "and not exists (select 1 from timer t where t.loop_id=l.id and t.state in ('armed','fired')) "
                "and not exists (select 1 from event e where e.scope=l.scope and e.type='tab.stuck' "
                "                and (e.payload->>'tab_id')::bigint = l.id) "
                "order by l.due_at limit 20")
    except Exception:
        log.exception("worker: stuck-tab scan failed — next scan retries")
        return 0
    surfaced = 0
    for r in rows:
        scope, tab_id = r["scope"], int(r["id"])
        try:
            import ops
            due_txt = r["due_at"].strftime("%d/%m %H:%M") if r["due_at"] else "?"
            receipt = await ops.record_alert(
                "report",
                f"Asunto atascado sin reloj: «{(r['text'] or '')[:160]}» (tab {tab_id}, vencía {due_txt}). "
                "No llegó a salir ningún aviso y no hay ningún temporizador armado — "
                "revísalo o resuélvelo en el Control Room.",
                ref_scope=scope)
            if receipt.get("alert_id") is None:
                continue  # Leave the tab eligible for the next scan.
            async with db.scoped_tx(scope) as con:
                await spine.append_event(
                    con, scope, "tab.stuck", "worker",
                    {"tab_id": tab_id, "due_at": r["due_at"].isoformat() if r["due_at"] else None,
                     "reason": "past due, zero fired rungs, no armed timer"},
                    lane="world")
            surfaced += 1
        except Exception:
            log.exception("worker: stuck-tab surface failed for tab %s (scope=%s)", tab_id, scope)
    if surfaced:
        log.info("worker: stuck-tab scan surfaced %d tab(s)", surfaced)
    return surfaced


_billing_last_scan: float = 0.0


async def run_billing_once(pool: asyncpg.Pool) -> int:
    """M1M2 WP-4 — THE BILLING SCAN (the worker's 4th scan, precedent run_wake_once): drive every
    live tenant's fully-elapsed Europe/Madrid months through the durable billing_run state machine
    (brain/billing.py: computed → debited → invoiced; credit first, remainder auto-charged on the
    saved card). Durable rows, not a HH:MM timer — a box down on the 1st catches up on the next
    scan. Throttled to one pass per ROCOTO_BILLING_SCAN_SEC (default 10 min): the scan is a cheap
    no-op between month ends, but there is no reason to walk the tenant list every 20s tick.
    Fail-soft: never raises into the loop. Returns the number of runs processed."""
    global _billing_last_scan
    import time as _time
    interval = int(getattr(config, "ROCOTO_BILLING_SCAN_SEC", 600))
    now = _time.monotonic()
    if _billing_last_scan and now - _billing_last_scan < max(interval, 1):
        return 0
    _billing_last_scan = now
    try:
        from brain import billing
        res = await billing.run_meter_once()
        return len(res.get("processed") or [])
    except Exception:
        log.exception("worker: billing scan failed — next scan retries (durable billing_run rows)")
        return 0


async def run_pin_probe_once(pool: asyncpg.Pool) -> int:
    """THE PIN CAPABILITY PROBE (2026-07-26) — the worker's cheapest scan, and the only one whose job
    is to notice the WORLD changing rather than our own rows going stale.

    WhatsApp message pinning is a capability Meta's API *knows* (the shape validates) and our WABA
    will not execute (131000). We want to learn the day that flips WITHOUT anyone remembering to check
    — so brain/pin_watch knocks once a week on our own founder thread, and on the day it answers it
    sets a durable flag and tells Peter. The mind gains nothing automatically: its hand stays the
    DISABLED manifest_tool row 'pin_message', which only Peter enables.

    INERT BY DEFAULT: with ROCOTO_WA_PIN_ENABLED off (the default) this returns on pin_watch's first
    line having done ZERO DB work and ZERO I/O — it costs a function call per tick. The weekly gate
    itself lives in the DB (a system_flags timestamp), not in a process global, so a crash-looping
    worker can never turn the probe into a spammer. Fail-soft: never raises into the loop. Returns 1
    if a probe was actually attempted this tick, else 0."""
    try:
        from brain import pin_watch
        return await pin_watch.run_probe_once()
    except Exception:
        log.exception("worker: pin capability probe failed — next tick retries (nothing was sent)")
        return 0


async def run_forever(poll_seconds: int = 20) -> None:
    """The long-running clock (SPEC §3.1 — timers are the only clock). Ticks every `poll_seconds`;
    a tick that finds work drains up to SCAN_LIMIT and the next tick picks up any backlog. Fail-soft:
    a tick-level error logs and the loop sleeps and continues (the clock must never stop)."""
    policy = worker_policy.state()
    log.info("worker: run_forever started (mode=%s, poll=%ss, scan_limit=%d)",
             policy["mode"], poll_seconds, SCAN_LIMIT)
    while True:
        policy = worker_policy.state()
        if not policy["processing_enabled"]:
            # Preserve every queued timer, invoice and one-shot provider attempt. This reports
            # process liveness and its paused policy; it never records an operation as processed.
            import ops
            await ops.stamp("worker", dict(policy))
            await asyncio.sleep(max(int(poll_seconds), 1))
            continue
        pool = db.control_pool()  # cross-scope scan; individual jobs keep their scoped transactions
        try:
            await run_once(pool)          # timers (the only clock)
            await run_wake_once(pool)     # WP-1 the wake scan (escalate/approval/takeover_end)
            await run_pending_backstop(pool)  # WP-1 double-fire-safe debounce backstop
            await run_billing_once(pool)  # M1M2 WP-4 the 0.3% meter (durable billing_run scan)
            await run_stuck_scan(pool)    # the stuck-tab sweep (a due tab with no clock never rots silently)
            await run_pin_probe_once(pool)  # the weekly WhatsApp-pin capability knock (inert by default)
            # COEXISTENCE'S 24-HOUR CLOCK. Meta gives us one day from onboarding to pull the
            # customer's contacts and history off their handset, and each call may be made EXACTLY
            # ONCE — a miss is not a retry, it is the customer redoing the whole Embedded Signup
            # flow with the taps on their phone. So the box chases it rather than hoping the
            # onboarding request finished cleanly; a deploy mid-onboarding must not cost anyone that.
            # THE HISTORY REPLAY. `wa_history_chunk` has been filling since coexistence shipped
            # with nothing reading it — the index `ix_wa_history_unprocessed` guarded a queue that
            # had no consumer. This is that consumer. It runs under sombra per party, writes only
            # conversation events, and advances the sweep watermark past itself, so the nightly
            # 12:00 distil never sees a two-year-old day as «EVENTOS DE HOY».
            try:
                import backfill as _backfill
                bo = await _backfill.run_pending_chunks()
                if bo.get("chunks") or bo.get("failed"):
                    log.info("worker: history replay chunks=%s parties=%s failed=%s",
                             bo.get("chunks"), bo.get("parties"), bo.get("failed"))
            except Exception:
                log.exception("worker: history replay sweep failed (fail-soft)")
            try:
                import wa_coexistence as _coex
                out = await _coex.run_due_syncs()
                if out.get("fired") or out.get("expired"):
                    log.info("worker: coexistence syncs fired=%s expired=%s",
                             out.get("fired"), out.get("expired"))
            except Exception:
                log.exception("worker: coexistence sync sweep failed (fail-soft)")
        except Exception:
            log.exception("worker: tick failed at the top level — sleeping and continuing")
        try:  # WP-0.5 heartbeat: /healthz catches a silently-dead worker
            import ops
            await ops.stamp("worker", dict(policy))
        except Exception:
            pass
        await asyncio.sleep(max(int(poll_seconds), 1))


# ── standalone entrypoint (mirrors narrate.py's env loader) ──────────────────────────────────
def _main() -> None:
    import os
    from pathlib import Path

    env_file = os.environ.get("ROCOTO_ENV_FILE", "/opt/rocoto/.env")
    p = Path(env_file)
    if p.exists():
        for raw in p.read_text().splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            key, val = key.strip(), val.strip()
            if len(val) >= 2 and val[0] == val[-1] and val[0] in "\"'":
                val = val[1:-1]
            if key and key not in os.environ:
                os.environ[key] = val

    import logging_setup
    # The worker reads customers' messages all day, so it logs through the SAME redacting formatter
    # the backend does — a second process with its own logging is a second place PII can escape.
    logging_setup.configure()

    async def _run() -> None:
        await db.init()
        # The worker does NOT embed (its T1 verify is an LLM call, not a vector op), so it loads no
        # embedding model — keeps its memory footprint tiny under the service's cgroup cap.
        await run_forever()

    asyncio.run(_run())


if __name__ == "__main__":
    _main()
