"""presence_call.py — CHANNEL PRESENCE (§15 CHANNEL CONTINUITY): call lifecycle events + AHORA MISMO.

One runtime, many channels, each continuous (Peter, 2026-07-22). The spine already carries every
channel's events on the same scope — what was missing is LIVENESS: the mind seeing that a call is
happening RIGHT NOW (so a WhatsApp turn mid-call can address what was just said on the phone), and the
call seeing that the person just texted WHILE talking. This module owns exactly that, deterministically:

  · call_started / call_ended — the lifecycle events (world lane, dedupe on call_id) appended at bridge
    connect/disconnect. Also the proper cross-call boundary: call_ended fires the registered reset hooks
    so the voice pin's per-call state (pitch-once, repeat guard) re-arms for the NEXT call instead of
    bleeding through the 900s TTL.
  · live_call — is there a call in progress on this scope? (started without ended, recent).
  · ahora_block — the `### AHORA MISMO` fold block, rendered per consuming channel. Injected into BOTH
    folds (assemble for chat, _grounding_block for voice) so arbitration rides the fold: both minds SEE
    the overlap and address it — never two blind parallel voices.

Organ: ⑥ presence (liveness perception) feeding ③ assembly. Data, not a mode. Everything fail-soft —
a presence error must never touch a live call or a chat turn.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Callable, Optional

import spine
import tenancy

log = logging.getLogger("rocoto.presence_call")

# a call.started older than this with no call.ended is a stale orphan (crashed bridge), not a live call.
_LIVE_CALL_MAX_AGE_MIN = 120
# a WhatsApp message is surfaced to the live call only if it landed this recently (mid-call chatter).
_MIDCALL_MSG_WINDOW_MIN = 15

_RESET_HOOKS: list[Callable[[str], None]] = []


def scope_for(caller: str, call_id: str = "") -> str:
    """The ONE derivation of a call's party scope (app.api_voice_chat and both ring-time branches).

    WHY `call_id` IS NOT OPTIONAL IN PRACTICE. A caller who withholds their number arrives as
    `From="anonymous"` — no digits — and every digit-less caller used to answer `"voice.demo"`. That
    is ONE conversation shared by every anonymous caller in Spain AND by the landing page's demo
    calls: a real customer's order read back to the next stranger who rings, with nothing raised and
    nothing logged. CLIR is free and any caller can invoke it, and 3GPP TS 22.081 §1.4 has the
    network itself drop the identity whenever the signalling can't carry it — so this is an ordinary
    Tuesday, not an edge case.

    With a call id we key the scope on THE CALL (`anon.<sid>`), which cannot be shared. The
    conversation is real and fully recorded; it just starts empty and ends with the call, because an
    unidentified caller has no history we are entitled to hand them."""
    if tenancy.has_identity(caller):
        return tenancy.scope_of(caller)
    if call_id:
        return tenancy.party_scope(caller, fallback_key=call_id)
    log.warning("scope_for: anonymous caller with no call id — falling back to the SHARED "
                "voice.demo scope; this call may read another caller's history")
    return "voice.demo"   # WP-A1 — legacy last resort; every live site now passes a call id


def register_reset_hook(fn: Callable[[str], None]) -> None:
    """app.py registers the voice-pin per-call reset here (avoids the eleven→app circular import)."""
    _RESET_HOOKS.append(fn)


async def call_started(caller: str, call_id: str, source: str = "voice",
                       scope_key: str = "") -> None:
    """Append the call.started spine event (world lane, deduped on call_id). Fail-soft.

    `scope_key` is the TWILIO CALL SID and it is separate from `call_id` on purpose. `call_id` is
    this bridge's own uuid and keys the event dedupe; the SID is what the turn path keys an
    anonymous caller's scope on. Passing one where the other is meant splits such a call in two —
    its turns under one scope, its start/end under another."""
    if not call_id:
        return
    try:
        import db
        scope = scope_for(caller, scope_key or call_id)
        async with db.scoped_tx(scope) as con:
            await spine.append_event(
                con, scope, "call.started", "voice",
                {"call_id": call_id, "caller": caller, "channel": source},
                lane="world", dedupe_key=f"callstart:{call_id}")
    except Exception:
        log.warning("presence_call: call.started append failed (fail-soft)", exc_info=True)


async def call_ended(caller: str, call_id: str, extra: Optional[dict] = None,
                     scope_key: str = "") -> None:
    """Append call.ended, INVOKE THE GENERIC BINDER on it, + fire the per-call reset hooks (the
    cross-call boundary). Fail-soft.

    TRACK 3: call.ended is the canonical call-end spine event, and this is the ONLY place it is appended
    on the live path — so it is where the binder must be invoked for a call-end duty to fire with ZERO
    situation code. `extra` (from postcall.summarize) enriches the payload so report_call's
    {name}/{summary}/{next_step} slots fill; defaults keep the debrief composable even if summarization
    is skipped (never a literal '{summary}')."""
    if not call_id:
        return
    scope = scope_for(caller, scope_key or call_id)   # the SID decides the scope — see call_started
    payload = {"call_id": call_id, "caller": caller}
    payload.update({k: v for k, v in (extra or {}).items() if v not in (None, "")})
    payload.setdefault("name", "un contacto")
    payload.setdefault("summary", "(resumen en la ficha)")
    payload.setdefault("next_step", "lo reviso y te digo")
    try:
        import db
        import duties
        async with db.scoped_tx(scope) as con:
            eid, _ = await spine.append_event(
                con, scope, "call.ended", "voice", payload,
                lane="world", dedupe_key=f"callend:{call_id}")
            # THE BINDER (§16.6): open every duty whose opens_on matches call.ended (report_call, the boss
            # debrief) from its ROW alone — no <situation>.py, no if-branch. Idempotent (_open keys on
            # callreport:{call_id}). Fail-soft: a duty hiccup must never break the cross-call boundary.
            try:
                await duties.react_to_sense(con, scope, "call.ended", payload, opened_by_event=eid)
            except Exception:
                log.debug("presence_call: react_to_sense(call.ended) fail-soft", exc_info=True)
    except Exception:
        log.warning("presence_call: call.ended append failed (fail-soft)", exc_info=True)
    for fn in _RESET_HOOKS:
        try:
            fn(scope)
        except Exception:
            log.debug("presence_call: reset hook failed (fail-soft)", exc_info=True)


async def live_call(con, scope: str, now: Optional[datetime] = None) -> Optional[dict]:
    """The call in progress on this scope, or None. Deterministic: latest call.started (recent) with no
    matching call.ended. Returns {call_id, started_at}."""
    try:
        now = now or datetime.now(timezone.utc)
        row = await con.fetchrow(
            "select e.ts, e.payload->>'call_id' call_id from event e "
            "where e.scope=$1::ltree and e.type='call.started' and e.ts >= $2 "
            "and not exists (select 1 from event d where d.scope=e.scope and d.type='call.ended' "
            "  and d.payload->>'call_id' = e.payload->>'call_id') "
            "order by e.id desc limit 1",
            scope, now - timedelta(minutes=_LIVE_CALL_MAX_AGE_MIN))
        if not row or not row["call_id"]:
            return None
        return {"call_id": row["call_id"], "started_at": row["ts"]}
    except Exception:
        log.debug("presence_call: live_call read failed (fail-soft)", exc_info=True)
        return None


async def ahora_block(con, scope: str, channel: str, now: Optional[datetime] = None) -> str:
    """The AHORA MISMO block for a fold being assembled on `channel` ('chat' | 'voice').
    Deterministic from spine events + the pinned clock; '' when nothing is live. Fail-soft ''."""
    try:
        now = now or datetime.now(timezone.utc)
        lc = await live_call(con, scope, now)
        lines: list[str] = []
        if channel == "chat":
            if lc:
                hhmm = lc["started_at"].astimezone(timezone.utc).strftime("%H:%M")
                lines.append(
                    f"📞 AHORA MISMO estás EN LLAMADA con esta persona (desde las {hhmm} UTC). "
                    "Lo que se dice en la llamada aparece en la conversación como turnos de voz — es la "
                    "MISMA conversación: puedes referirte con naturalidad a lo que se acaba de decir por "
                    "teléfono, y no repitas lo que ya quedó dicho allí.")
        elif channel == "voice":
            # surface a WhatsApp text that landed DURING the call (mid-call chatter → mention it).
            since = lc["started_at"] if lc else now - timedelta(minutes=_MIDCALL_MSG_WINDOW_MIN)
            row = await con.fetchrow(
                "select ts, payload->>'text' txt from event where scope=$1::ltree and lane='world' "
                "and type='message' and ts >= $2 order by id desc limit 1", scope, since)
            if row and (row["txt"] or "").strip():
                lines.append(
                    "💬 AHORA MISMO, mientras habláis, esta persona te ha escrito por WhatsApp: "
                    f"«{row['txt'].strip()[:160]}» — es la misma conversación; puedes mencionarlo "
                    "con naturalidad si viene al caso.")
        return "\n".join(lines)
    except Exception:
        log.debug("presence_call: ahora_block failed (fail-soft)", exc_info=True)
        return ""
