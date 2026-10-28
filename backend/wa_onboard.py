"""wa_onboard.py — CONNECT: a customer attaches their own WhatsApp number to Rocoto.

Peter, 2026-08-17: «they click Connect, and then it'll take them through a flow… and then after that
it would be add number.»

This is the server half of Embedded Signup. The browser half opens Meta's dialog with our
`config_id`; what comes back is a one-time `code` plus a session event. Everything after that
happens here, because every step needs the app secret or writes a credential.

    browser              this module                                Meta
    ───────              ───────────                                ────
    FB.login ──code──▶   finish()
                         ① code → business token                    GET /oauth/access_token
                         ② subscribe our app to their WABA          POST /{waba}/subscribed_apps
                         ③ resolve the phone numbers                GET  /{waba}/phone_numbers
                         ④ read is_on_biz_app per number            GET  /{phone_id}
                         ⑤ seal the token, store connection+numbers  (channels.py)

── THE FOUR THINGS THAT ARE EASY TO GET WRONG, AND WHY EACH IS HANDLED HERE ────────────────────

1. COEXISTENCE HANDS BACK ONLY A WABA ID. The ordinary Embedded Signup completion carries
   `phone_number_id`; the coexistence one (`FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING`) does not.
   Our entire inbound routing key IS `phone_number_id`, so step ③ is not optional enrichment — it
   is the difference between a connected account and one whose messages we cannot route.

2. DO NOT REGISTER A COEXISTENCE NUMBER. Meta's page is explicit: «skip the phone number
   registration step, as the number is already registered.» There is no PIN to set, because the
   WhatsApp Business app owns two-step verification on that number. Calling register here fails,
   and on a number the customer is actively using.

3. A 24-HOUR CLOCK STARTS AT ONBOARDING. Both history-sync calls must run inside it or the customer
   must be offboarded and redo the ENTIRE flow. So the deadline is persisted with the connection at
   the moment it is created, rather than living in a queue that a restart could lose.

4. THE TOKEN IS A CUSTOMER'S, NOT OURS. It is sealed by `channels.py` before it is stored and never
   returned to any surface. A failure anywhere after ① must still not leave it in a log.

WHAT THIS MODULE DELIBERATELY DOES NOT DO: it never calls Meta with OUR system-user token. Every
call below rides the customer's own business token, which is what the Tech Provider model actually
grants — our token's job ended when the app was reviewed.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import httpx

import channels
import config

log = logging.getLogger("rocoto.wa_onboard")

GRAPH = "https://graph.facebook.com/v21.0"

# Meta's own deadline for the coexistence history sync. Stored, not assumed.
COEXISTENCE_SYNC_HOURS = 24

# The session event that says «this was a coexistence onboarding», as opposed to a fresh number.
EVENT_COEXISTENCE = "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING"
EVENT_FRESH = "FINISH"


class OnboardError(RuntimeError):
    """A step failed in a way the customer must see. Carries a short, honest Spanish sentence —
    never a Graph error dump, which tells a distributor nothing and leaks our internals."""

    def __init__(self, human: str, detail: str = ""):
        super().__init__(detail or human)
        self.human = human
        self.detail = detail


def configured() -> bool:
    """Can this box run Connect at all? Checked BEFORE the button is drawn, so a missing secret is a
    greyed control with a reason rather than a customer stranded halfway through Meta's dialog."""
    return bool(config.WA_CLOUD_APP_ID and config.WA_CLOUD_APP_SECRET
                and config.WA_ES_CONFIG_ID and channels.key_configured())


def missing() -> list[str]:
    """Exactly what is absent, for the settings surface and /healthz. Names only — never values."""
    out = []
    if not config.WA_CLOUD_APP_ID:
        out.append("WA_CLOUD_APP_ID")
    if not config.WA_CLOUD_APP_SECRET:
        out.append("WA_CLOUD_APP_SECRET")
    if not config.WA_ES_CONFIG_ID:
        out.append("WA_ES_CONFIG_ID")
    if not channels.key_configured():
        out.append("ROCOTO_SECRET_KEY")
    return out


async def _graph(client: httpx.AsyncClient, method: str, path: str, *, token: str,
                 params: Optional[dict] = None, json_body: Optional[dict] = None) -> dict[str, Any]:
    """One Graph call, with the token in the HEADER rather than the query string.

    Deliberate: a token in a URL lands in access logs, proxy logs and error trackers. The header
    costs nothing and keeps a customer's credential out of every one of them."""
    r = await client.request(
        method, f"{GRAPH}/{path.lstrip('/')}",
        params=params or {}, json=json_body,
        headers={"Authorization": f"Bearer {token}"})
    try:
        body = r.json()
    except Exception:
        raise OnboardError("Meta ha contestado algo que no he sabido leer.",
                           f"{r.status_code} non-json")
    if r.status_code >= 400 or "error" in body:
        err = (body.get("error") or {})
        # Logged WITHOUT the token, and with Meta's own code so a support thread has something real.
        log.warning("wa_onboard: graph %s %s failed code=%s sub=%s msg=%s",
                    method, path, err.get("code"), err.get("error_subcode"),
                    str(err.get("message"))[:200])
        raise OnboardError("Meta no ha dejado completar la conexión.",
                           f"code={err.get('code')} {str(err.get('message'))[:200]}")
    return body


async def exchange_code(code: str) -> str:
    """① The one-time code → the customer's long-lived business token.

    THE APP SECRET NEVER LEAVES THIS FUNCTION, and the exchange is the only reason the box needs it.
    A leaked app secret is not one customer's WhatsApp, it is every customer's at once."""
    if not (config.WA_CLOUD_APP_ID and config.WA_CLOUD_APP_SECRET):
        raise OnboardError("Falta configurar la app de Meta en este servidor.",
                           "WA_CLOUD_APP_ID / WA_CLOUD_APP_SECRET missing")
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.get(f"{GRAPH}/oauth/access_token", params={
            "client_id": config.WA_CLOUD_APP_ID,
            "client_secret": config.WA_CLOUD_APP_SECRET,
            "code": code,
        })
    body = r.json() if r.content else {}
    tok = str(body.get("access_token") or "")
    if not tok:
        err = (body.get("error") or {})
        log.warning("wa_onboard: code exchange failed code=%s msg=%s",
                    err.get("code"), str(err.get("message"))[:200])
        raise OnboardError("No he podido terminar la conexión con Meta. Vuelve a intentarlo.",
                           f"code exchange: {str(err.get('message'))[:200]}")
    return tok


async def finish(tenant: str, *, code: str, waba_id: str, event: str = "",
                 connected_by: str = "") -> dict[str, Any]:
    """The whole server side of Connect. Idempotent: re-running it for the same WABA updates the
    connection and re-syncs the numbers rather than minting a second account.

    Returns what a surface may render — never the token."""
    if not waba_id:
        raise OnboardError("Meta no ha dicho a qué cuenta conectar.", "no waba_id in session")
    coexistence = (event or "").upper() == EVENT_COEXISTENCE

    token = await exchange_code(code)

    async with httpx.AsyncClient(timeout=30) as c:
        # ② Our app must be subscribed to THEIR WABA or no webhook ever arrives. Done before the
        #    numbers are read, so a failure here stops us storing a connection that cannot receive.
        await _graph(c, "POST", f"{waba_id}/subscribed_apps", token=token)

        waba = await _graph(c, "GET", waba_id, token=token,
                            params={"fields": "id,name"})
        # ③ THE STEP COEXISTENCE MAKES MANDATORY — the completion payload carried no phone_number_id.
        nums = await _graph(c, "GET", f"{waba_id}/phone_numbers", token=token,
                            params={"fields": "id,display_phone_number,verified_name,"
                                              "quality_rating,platform_type,code_verification_status"})

        rows = list(nums.get("data") or [])
        # ④ is_on_biz_app is the flag that says a number is ALSO answered by hand on someone's
        #    phone. It is per-number and not on the list edge, so it is one read each. Fail-soft:
        #    an unreadable flag falls back to what the session told us, never to a guess that the
        #    business is not there.
        for n in rows:
            try:
                extra = await _graph(c, "GET", str(n.get("id")), token=token,
                                     params={"fields": "is_on_biz_app,platform_type"})
                n["is_on_biz_app"] = bool(extra.get("is_on_biz_app"))
            except OnboardError:
                n["is_on_biz_app"] = coexistence

    conn = await channels.upsert_connection(
        tenant, kind=channels.WHATSAPP, provider=channels.META_CLOUD,
        external_id=str(waba.get("id") or waba_id),
        display_name=str(waba.get("name") or ""),
        coexistence=coexistence, connected_by=connected_by, token=token)

    stored = []
    for n in rows:
        on_app = bool(n.get("is_on_biz_app"))
        stored.append(await channels.upsert_number(
            tenant, int(conn["id"]),
            external_id=str(n.get("id") or ""),
            e164=str(n.get("display_phone_number") or ""),
            # A coexistence number is NOT registered by us (trap 2) and is live the moment Meta
            # lists it; a fresh number still has to be registered before it can send.
            mode=channels.MODE_COEXISTENCE if on_app else channels.MODE_CLOUD,
            status="live" if on_app else "pending",
            verified_name=str(n.get("verified_name") or ""),
            quality_rating=str(n.get("quality_rating") or "")))

    deadline = None
    if coexistence:
        deadline = datetime.now(timezone.utc) + timedelta(hours=COEXISTENCE_SYNC_HOURS)
        await _record_sync_deadline(int(conn["id"]), deadline)

    log.info("wa_onboard: %s connected WABA %s (%s) with %d number(s)",
             tenant, waba.get("id"), "coexistence" if coexistence else "cloud", len(stored))
    return {"ok": True, "connection_id": int(conn["id"]), "coexistence": coexistence,
            "numbers": stored, "sync_deadline": deadline.isoformat() if deadline else None}


async def _record_sync_deadline(connection_id: int, deadline: datetime) -> None:
    """Trap 3, made durable. The 24-hour window is Meta's, and missing it costs the customer the
    WHOLE Embedded Signup flow again — so it is written next to the connection at the moment it
    opens, not held in a scheduler that a restart would forget."""
    import db
    try:
        async with db.get_pool().acquire() as con:
            await con.execute(
                "update channel_connection set last_error='', updated_at=now() where id=$1",
                connection_id)
            await con.execute(
                """insert into channel_sync_deadline (connection_id, kind, due_at)
                   values ($1,'coexistence_history',$2)
                   on conflict (connection_id, kind) do update set due_at = excluded.due_at,
                                                                   done_at = null""",
                connection_id, deadline)
    except Exception:
        # Fail-soft on the WRITE, loud in the log: the connection itself is real and usable, and a
        # missing alarm row must not undo a successful onboarding. The sweep below re-reads state.
        log.exception("wa_onboard: could not record the coexistence sync deadline for %s",
                      connection_id)


async def pending_syncs() -> list[dict[str, Any]]:
    """Connections whose 24-hour history sync has not been done. Read by the worker so the deadline
    is something the box CHASES rather than something we hope somebody noticed."""
    import db
    async with db.get_pool().acquire() as con:
        rows = await con.fetch(
            "select d.connection_id, d.due_at, c.tenant_id, c.external_id "
            "from channel_sync_deadline d join channel_connection c on c.id = d.connection_id "
            "where d.done_at is null and c.revoked_at is null order by d.due_at")
    return [dict(r) for r in rows]
