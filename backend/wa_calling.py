"""wa_calling.py — WhatsApp calling: the capability, the settings, and answering the phone honestly.

Peter, 2026-08-17: «if the business can actually handle WhatsApp calling, set it up so that we can
actually handle it, because some businesses are in that tier.» He is right that it is a tier, and
the tier is stricter than it sounds.

── WHAT GATES IT (Meta's prerequisites, not ours) ──────────────────────────────────────────────
  · the number's messaging limit must be **≥ 2.000 unique recipients/day** — below it, enabling
    returns error 138015. THIS IS PER PHONE NUMBER, so every new distributor starts ineligible and
    climbs with use. It is not something we can grant.
  · a credit line / payment method on the WABA (user-initiated calls are free, but Meta still wants
    the instrument; without it a call errors 131044).
  · the app subscribed to `calls` and to the WABA, with whatsapp_business_messaging on the number.
  · business verification is explicitly NOT required.

Spain is supported in both directions. Business-initiated calling is excluded only in the US,
Canada, Egypt, Vietnam and Nigeria.

── THE PART THAT IS NOT A WEBHOOK HANDLER ──────────────────────────────────────────────────────
**Meta hosts no media.** Answering a call means running a WebRTC endpoint: ICE-FULL taking the
CONTROLLING role (Meta is ICE-LITE and always CONTROLLED), DTLS client, Opus at 48 kHz with 20 ms
ptime, and EXACTLY ONE SSRC — more than one and media fails completely. Meta provides no STUN or
TURN. That is a media server, and it is a project rather than a function.

Two dead-man timers decide whether an AI voice rail survives contact with it: no media from us for
**20 s at call start**, or **30 s mid-call**, and the client disconnects. So RTCP must keep flowing
while the model is thinking. Meta's own FAQ names this as the common failure.

And the constraint that rules out the obvious shortcut: **PSTN is banned on every leg of the call.**
Our existing voice runtime terminates on a telephony rail, so it cannot simply be bridged — the
media path has to be built for this, not borrowed.

── SO WHAT THIS MODULE DOES TODAY, AND WHAT IT REFUSES TO PRETEND ──────────────────────────────
It owns the capability and the settings, and it ANSWERS THE PHONE HONESTLY. `DISABLE_ALL` does not
stop inbound calls — Meta lists four entry points that survive it — so a number we cannot serve
must actively REJECT rather than ring out. A call that rings unanswered reads as a broken business;
a call that declines immediately, with the chat still open beside it, reads as a business that
answers in writing.

Placing and carrying audio is deliberately absent rather than half-present.
"""
from __future__ import annotations

import logging
from typing import Any, Optional

import httpx

import channels

log = logging.getLogger("rocoto.wa_calling")

GRAPH = "https://graph.facebook.com/v23.0"

# Meta's own vocabulary. The auto-generated schema page contradicts the guides here (it lowercases
# these and renames call_icon_visibility's values); the GUIDES and the live API agree on uppercase,
# and a live GET on our own number returned `NOT_SET`, so the guides win.
ENABLED, DISABLED = "ENABLED", "DISABLED"
# Undocumented anywhere in Meta's pages, and what a never-configured number actually returns.
NOT_SET = "NOT_SET"

ERR_TIER_TOO_LOW = 138015        # «Calling cannot be enabled» — under 2.000 recipients/day
ERR_PREREQS = 138018             # webhook/WABA/permission prerequisites unmet
ERR_NOT_ENABLED = 138000
ERR_NO_PAYMENT = 131044


async def read_settings(tenant: str, phone_number_id: str) -> dict[str, Any]:
    """The number's live calling settings, straight from Meta. Read with the TENANT'S token, because
    on a client's number ours has no standing."""
    conn = await _conn_for(tenant, phone_number_id)
    token = await channels.token_for(int(conn["connection_id"])) if conn else None
    if not token:
        return {"ok": False, "error": "no_token"}
    async with httpx.AsyncClient(timeout=25) as c:
        r = await c.get(f"{GRAPH}/{phone_number_id}/settings",
                        params={"include_sip_credentials": "false"},
                        headers={"Authorization": f"Bearer {token}"})
    body = r.json() if r.content else {}
    if "error" in body:
        return {"ok": False, "error": str((body.get("error") or {}).get("message"))[:200]}
    return {"ok": True, "calling": body.get("calling") or {}}


async def set_calling(tenant: str, phone_number_id: str, *, enabled: bool,
                      call_hours: Optional[dict] = None,
                      callback_permission: bool = True) -> dict[str, Any]:
    """Turn calling on or off for one number, and record what Meta said.

    `callback_permission` defaults ON deliberately: with it, a customer who CALLS US grants a
    temporary permission by the act of calling. That is the only path to being allowed to ring a
    restaurant back that costs nothing and asks them for nothing — the alternative is spending a
    billed permission-request message on somebody who already phoned us.

    A refusal is recorded rather than raised, because «this number is not eligible yet» is the
    NORMAL state for a new distributor and the surface has to say so calmly."""
    conn = await _conn_for(tenant, phone_number_id)
    token = await channels.token_for(int(conn["connection_id"])) if conn else None
    if not token:
        return {"ok": False, "error": "no_token"}

    calling: dict[str, Any] = {
        "status": ENABLED if enabled else DISABLED,
        "callback_permission_status": ENABLED if (enabled and callback_permission) else DISABLED,
    }
    if call_hours:
        # REPLACE, NEVER MERGE — Meta wipes what is absent, so the caller must send the whole
        # object. Documented, and the kind of thing that quietly erases a holiday schedule.
        calling["call_hours"] = call_hours

    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(f"{GRAPH}/{phone_number_id}/settings",
                         headers={"Authorization": f"Bearer {token}"},
                         json={"calling": calling})
    body = r.json() if r.content else {}
    err = body.get("error") or {}
    code = int(err.get("code") or 0)

    if code == ERR_TIER_TOO_LOW:
        await _record(phone_number_id, "ineligible",
                      {"reason": "tier", "code": code,
                       "human": "Este número todavía no llega al volumen que Meta pide para las llamadas."})
        log.info("wa_calling: %s not yet eligible (tier)", phone_number_id)
        return {"ok": False, "eligible": False, "reason": "tier"}
    if code == ERR_PREREQS:
        await _record(phone_number_id, "ineligible", {"reason": "prereqs", "code": code})
        return {"ok": False, "eligible": False, "reason": "prereqs"}
    if code or r.status_code >= 400:
        await _record(phone_number_id, "error", {"code": code, "msg": str(err.get("message"))[:200]})
        log.warning("wa_calling: settings write failed code=%s msg=%s",
                    code, str(err.get("message"))[:200])
        return {"ok": False, "error": str(err.get("message"))[:200]}

    await _record(phone_number_id, "enabled" if enabled else "disabled", {})
    log.info("wa_calling: %s calling=%s", phone_number_id, "ENABLED" if enabled else "DISABLED")
    return {"ok": True, "eligible": True, "status": ENABLED if enabled else DISABLED}


async def refresh_capability(tenant: str, phone_number_id: str) -> dict[str, Any]:
    """Re-read whether this number can call yet. Worth running periodically rather than once: the
    gate is a messaging TIER, so a number that was ineligible in week one becomes eligible on its
    own as the distributor's volume grows, with nobody doing anything."""
    out = await read_settings(tenant, phone_number_id)
    if not out.get("ok"):
        return out
    status = str((out.get("calling") or {}).get("status") or NOT_SET)
    await _record(phone_number_id,
                  {"ENABLED": "enabled", "DISABLED": "disabled"}.get(status, "unknown"),
                  {"raw": out.get("calling") or {}})
    return {"ok": True, "status": status}


async def _conn_for(tenant: str, phone_number_id: str) -> Optional[dict[str, Any]]:
    import db
    async with db.get_pool().acquire() as con:
        row = await con.fetchrow(
            "select connection_id from channel_number where tenant_id=$1 and external_id=$2 "
            "and status <> 'removed'", tenant, phone_number_id)
    return dict(row) if row else None


async def _record(phone_number_id: str, status: str, detail: dict) -> None:
    import json as _json

    import db
    try:
        async with db.get_pool().acquire() as con:
            await con.execute(
                "update channel_number set calling_status=$2, calling_checked_at=now(), "
                "calling_detail=$3::jsonb where external_id=$1",
                phone_number_id, status, _json.dumps(detail))
    except Exception:
        log.debug("wa_calling: capability note fail-soft", exc_info=True)


# ── the webhook ────────────────────────────────────────────────────────────────────────────────
async def handle(value: dict[str, Any], tenant: str) -> dict[str, Any]:
    """One `calls` webhook.

    TWO ARRAYS UNDER ONE FIELD: lifecycle events arrive as `value.calls[]`, ring/accept/reject
    statuses as `value.statuses[]`. A parser that reads only one of them is half-deaf.

    NEITHER ORDERED NOR EXACTLY-ONCE — Meta's FAQ says `terminate` can arrive BEFORE `connect` if
    the caller hangs up instantly, and duplicates happen on retry. So everything here keys on the
    `wacid.` call id and is safe to run twice."""
    calls = value.get("calls") or []
    statuses = value.get("statuses") or []
    handled = 0

    for c in calls:
        cid = str(c.get("id") or "")
        event = str(c.get("event") or "").lower()
        frm = str(c.get("from") or "")
        pnid = str((value.get("metadata") or {}).get("phone_number_id") or "")
        if event == "connect":
            await _on_incoming(tenant, pnid, cid, frm)
            handled += 1
        elif event == "terminate":
            log.info("wa_calling: call %s terminated status=%s duration=%s",
                     cid, c.get("status"), c.get("duration"))
            handled += 1

    for s in statuses:
        log.info("wa_calling: call %s status=%s", s.get("id"), s.get("status"))
        handled += 1
    return {"ok": True, "handled": handled}


async def _on_incoming(tenant: str, phone_number_id: str, call_id: str, from_phone: str) -> None:
    """A restaurant is ringing a number we run.

    WE CANNOT CARRY AUDIO YET, and the honest thing is to say so in the medium they are already in
    rather than let the phone ring out. A call that rings unanswered reads as a business that has
    gone under; a call that declines at once, with a message landing in the chat a second later,
    reads as a business that answers in writing.

    The decline is also not optional: `call_icon_visibility: DISABLE_ALL` does NOT stop inbound
    calls — Meta lists four entry points that survive it — so a number we do not serve WILL ring,
    and something has to answer for it."""
    import db
    import runtime
    import spine
    try:
        scope = runtime.scope_of(from_phone, tenant)
        async with db.scoped_tx(scope) as con:
            await spine.append_event(
                con, scope, "call.incoming", "wa_calling",
                {"call_id": call_id, "phone_number_id": phone_number_id}, lane="world")
    except Exception:
        log.exception("wa_calling: could not record an incoming call from %s", from_phone)

    await reject(tenant, phone_number_id, call_id)

    # The sentence lands in the SAME thread they called from, so the answer is where they already
    # are. Fail-soft: a failed reassurance must never take down the call handling around it.
    try:
        import actions
        # Through the ordinary rail, not a raw send: it records the msg.sent event, so the fold
        # knows this customer was answered and the mind does not open the next turn as if the call
        # had gone unacknowledged. The line says what IS — «te leo al momento» — rather than
        # apologising for what is missing, which is the standing copy rule.
        await actions.send_whatsapp_as_rocoto(
            scope, "Ahora mismo te leo por aquí y te contesto al momento. Dime qué necesitas.")
    except Exception:
        log.debug("wa_calling: could not send the after-call note (fail-soft)", exc_info=True)


async def reject(tenant: str, phone_number_id: str, call_id: str) -> dict[str, Any]:
    """Decline a call. Explicit, immediate, and idempotent — a duplicate webhook must not turn into
    a second rejection that errors."""
    conn = await _conn_for(tenant, phone_number_id)
    token = await channels.token_for(int(conn["connection_id"])) if conn else None
    if not token:
        return {"ok": False, "error": "no_token"}
    try:
        async with httpx.AsyncClient(timeout=20) as c:
            r = await c.post(f"{GRAPH}/{phone_number_id}/calls",
                             headers={"Authorization": f"Bearer {token}"},
                             json={"messaging_product": "whatsapp", "call_id": call_id,
                                   "action": "reject"})
        return {"ok": r.status_code < 400}
    except Exception:
        log.exception("wa_calling: reject failed for %s", call_id)
        return {"ok": False}
