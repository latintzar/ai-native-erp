"""reach.py — WP-6b THE PROACTIVE-REACH ENGINE (SPEC §3 channel law; a channel-reachability PERCEPTION,
not a situation — no `<situation>.py`). Before ANY self-started outbound, decide the DELIVERABLE path:

    window OPEN                      → freeform (a normal WhatsApp)
    window CLOSED + template fits    → template (an approved WhatsApp template)
    window CLOSED + higher-touch     → call (place_call — like a person who can't WhatsApp you, so calls)
    window CLOSED + async/documentary→ email
    nothing deliverable now          → HOLD + re-arm for when the window reopens

R4 restraint (the goodwill ledger) governs FREQUENCY elsewhere; this governs DELIVERABILITY — so the
employee never fires a doomed freeform into a closed window (a silent Twilio 63016) and never spams.
Deterministic + fail-soft: derived from the event spine + scope_state, no LLM.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

WA_WINDOW_HOURS = 24


async def reachability(con, scope: str) -> dict[str, Any]:
    """The (contact, WhatsApp) reachability state from the spine: the 24h session window + mute/opt-out."""
    last_in = await con.fetchval(
        "select max(ts) from event where scope=$1::ltree and lane='world' and type='message'", scope)
    # B6 (SPEC §5.5): `muted` is a VIEW of the one mode field — resolved through the app-wide default
    # → per-customer override chain, not a column read. The scope's own row is read on the caller's
    # connection; the app-wide row needs its own (RLS hides an ancestor from a descendant's scope).
    import gate
    muted = (await gate.effective_mode(scope, con))["mode"] == gate.SOMBRA
    opted_out = bool(await con.fetchval(
        "select true from fact where scope=$1::ltree and kind='CONSTRAINT' and invalid_at is null "
        "and (text ilike '%no contactar%' or text ilike '%opt-out%' or text ilike '%baja%') limit 1", scope) or False)
    window_open = last_in is not None and (datetime.now(timezone.utc) - last_in) < timedelta(hours=WA_WINDOW_HOURS)
    return {"last_inbound": last_in.isoformat() if last_in else None,
            "wa_window_open": bool(window_open), "muted": muted, "opted_out": opted_out}


async def choose_channel(con, scope: str, intent: str = "nudge",
                         template_available: bool = False, has_email: bool = False) -> dict[str, Any]:
    """The proactive-touch DECISION LADDER. Returns {channel ∈ freeform|template|call|email|hold, reason, …}."""
    r = await reachability(con, scope)
    if r["muted"] or r["opted_out"]:
        return {"channel": "hold", "reason": "muted/opted-out", **r}
    if r["wa_window_open"]:
        return {"channel": "freeform", "reason": "24h window open → freeform WhatsApp", **r}
    # window CLOSED — never a doomed freeform (63016); pick a deliverable hand instead
    if template_available:
        return {"channel": "template", "reason": "window closed → an approved template fits", **r}
    if intent in ("urgent", "call", "escalate", "money"):
        return {"channel": "call", "reason": "window closed + higher-touch → call", **r}
    if has_email:
        return {"channel": "email", "reason": "window closed → async email", **r}
    return {"channel": "hold", "reason": "window closed, nothing deliverable now → hold + re-arm", **r}


def fold_line(decision: dict) -> str:
    """A one-line fold input for the mind (SPEC §3 medium-awareness): tell it the channel reality so its
    narration is natural ('estás fuera de la ventana de 24h — usa plantilla o llámale')."""
    ch = decision.get("channel")
    if ch == "freeform":
        return ""
    hints = {
        "template": "Estás FUERA de la ventana de 24h de WhatsApp: un mensaje libre no llegaría — usa una plantilla aprobada.",
        "call": "Estás FUERA de la ventana de 24h: no puedes escribirle libre; si es importante, LLÁMALE.",
        "email": "Estás FUERA de la ventana de 24h: mándale un email en vez de WhatsApp.",
        "hold": "No hay canal disponible ahora (fuera de ventana, sin plantilla/email): ESPERA a que él escriba.",
    }
    return hints.get(ch, "")
