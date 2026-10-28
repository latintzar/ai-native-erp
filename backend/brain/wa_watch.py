"""Self-terminating WhatsApp-template-approval watcher + a tiny durable flag store.

The Rocoto "we message them first" landing flow needs a Twilio Content API WhatsApp
template (Marco's intro, ES + EN) to be APPROVED by Meta before business-initiated
outbound is allowed. Approval is a manual, multi-hour-to-multi-day external review.

Rather than polling forever or hardcoding a date, this module runs ONE background task
that polls Twilio for both templates every ~30 min. The moment BOTH are approved it:
  1. flips the durable `wa_message_enabled` flag in the system_flags table (survives restarts),
  2. best-effort pings Peter (WhatsApp + email), and
  3. BURNS ITSELF — breaks the loop and, on any later restart, returns immediately because the
     flag is already true. It never polls again once the flag is set.

Fully FAIL-SOFT (BUILD-CONTRACT: additive, never raises to the caller, never crashes the live
service). Every DB/network/Twilio error is logged and swallowed. Missing config (no account SID,
unset template SIDs) degrades to a harmless no-op / continued benign polling, never an exception.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Optional

import httpx

import config
import db

log = logging.getLogger("rocoto.wa_watch")

FLAG_KEY = "wa_message_enabled"
POLL_SECONDS = 1800  # ~30 min between polls; approval is a slow external process
_TWILIO_TIMEOUT = 30.0


# ─────────────────────────── the durable flag store ───────────────────────────

async def is_message_enabled() -> bool:
    """Read the wa_message_enabled flag from system_flags. False on ANY error (fail-soft).

    True only when the stored value is a truthy string ('true'). Empty/absent/anything else → False.
    """
    try:
        pool = db.get_pool()
        async with pool.acquire() as con:
            val = await con.fetchval(
                "select value from system_flags where key = $1", FLAG_KEY
            )
        return (val or "").strip().lower() == "true"
    except Exception as e:  # DB not ready, flag table missing, etc. — never raise
        log.debug("wa_watch is_message_enabled read failed (treating as disabled): %s", e)
        return False


async def _set_enabled() -> None:
    """Upsert wa_message_enabled = 'true' (insert … on conflict (key) do update). Fail-soft."""
    try:
        pool = db.get_pool()
        async with pool.acquire() as con:
            await con.execute(
                "insert into system_flags (key, value, updated_at) values ($1, 'true', now()) "
                "on conflict (key) do update set value = 'true', updated_at = now()",
                FLAG_KEY,
            )
        log.info("wa_watch: flag %s set true (WhatsApp intro templates approved)", FLAG_KEY)
    except Exception as e:
        log.warning("wa_watch _set_enabled upsert failed: %s", e)


# ─────────────────────────── the Twilio approval poll ───────────────────────────

async def _template_approved(sid: str) -> Optional[bool]:
    """Poll the Twilio Content API for one template's WhatsApp approval status.

    GET https://content.twilio.com/v1/Content/{SID}/ApprovalRequests with HTTP basic auth
    (account SID / auth token). A template is approved when whatsapp.status == 'approved'.

    Returns True (approved), False (not yet approved / pending / rejected), or None on a
    transient error we should tolerate (401/404/suspended-account/network) — the caller treats
    None as "unknown, keep polling" and never crashes.
    """
    if not sid:
        return False  # SID unset → definitively "not approved"; keep polling harmlessly
    url = f"https://content.twilio.com/v1/Content/{sid}/ApprovalRequests"
    try:
        auth = httpx.BasicAuth(*config.twilio_rest_auth())
        async with httpx.AsyncClient(timeout=_TWILIO_TIMEOUT, auth=auth) as cx:
            r = await cx.get(url)
        if r.status_code >= 300:
            # 401 (bad creds), 404 (SID not visible yet), 409/423 (suspended account), 5xx, etc.
            log.info("wa_watch: approval poll for %s returned %s — tolerating, will retry",
                     sid, r.status_code)
            return None
        data = r.json() or {}
        wa = data.get("whatsapp") or {}
        status = (wa.get("status") or "").strip().lower()
        return status == "approved"
    except Exception as e:
        # network error, JSON error, suspended-account transport error → unknown, keep polling
        log.info("wa_watch: approval poll for %s errored (%s) — tolerating, will retry", sid, e)
        return None


# ─────────────────────────── the best-effort founder ping ───────────────────────────

async def _ping_peter() -> None:
    """Best-effort notify Peter that the templates are live. WhatsApp + email, each isolated;
    a failure in either is swallowed. Never raises."""
    msg = ("Rocoto: WhatsApp intro templates are APPROVED — the \"we message them first\" flow is "
           "now live (wa_message_enabled = true).")
    # WhatsApp (best-effort, lazy import so a missing twilio dep can't break this module's import).
    phone = (getattr(config, "DEMO_NOTIFY_PHONE", "") or "").strip()
    if phone:
        try:
            import twilio_wa  # lazy — never import at module load
            await twilio_wa.send_whatsapp(phone, msg)
        except Exception as e:
            log.info("wa_watch: peter WhatsApp ping best-effort failed: %s", e)
    # Email via Resend (always-works lead channel).
    email = (getattr(config, "DEMO_NOTIFY_EMAIL", "") or "").strip()
    if getattr(config, "EGRESS_SANDBOX", False):
        # class-E floor (WP-2.5 rehearsal find): every raw Resend sender short-circuits under the sandbox.
        log.info("[EGRESS_SANDBOX] suppressed wa_watch email to %s", email)
        return
    if email and getattr(config, "RESEND_API_KEY", ""):
        try:
            async with httpx.AsyncClient(timeout=30) as cx:
                r = await cx.post(
                    "https://api.resend.com/emails",
                    headers={"Authorization": f"Bearer {config.RESEND_API_KEY}", "User-Agent": "rocoto-mailer/1.0"},
                    json={
                        "from": getattr(config, "ONBOARD_EMAIL_FROM",
                                        "Rocoto <hello@soyrocoto.com>"),
                        "to": [email],
                        "subject": "Rocoto: WhatsApp templates approved — flow live",
                        "html": (
                            "<div style=\"font-family:-apple-system,system-ui,sans-serif;"
                            "color:#1A1413\"><p>The Rocoto WhatsApp intro templates (ES + EN) are "
                            "now <b>approved</b> by Meta.</p><p>The \"we message them first\" landing "
                            "flow is live: <code>wa_message_enabled = true</code>. The approval "
                            "watcher has burned itself and will not poll again.</p></div>"
                        ),
                    },
                )
            if r.status_code >= 300:
                log.info("wa_watch: peter email ping non-2xx %s: %s", r.status_code, r.text[:160])
        except Exception as e:
            log.info("wa_watch: peter email ping best-effort failed: %s", e)


# ─────────────────────────── the background loop ───────────────────────────

async def watch_loop() -> None:
    """Background task: poll Twilio for template approval until BOTH are approved, then burn itself.

    On start: if the flag is already set → return immediately (already burned; NEVER poll again
    across restarts). Otherwise loop every ~POLL_SECONDS, polling BOTH template SIDs. When BOTH
    are approved → set the flag, ping Peter, break. Tolerates every transient error (logs + retries).
    Guard: if TWILIO_ACCOUNT_SID is unset there is nothing to poll → return.
    """
    # Already burned in a previous run — do not poll again, ever.
    try:
        if await is_message_enabled():
            log.info("wa_watch: %s already true — watcher will not run", FLAG_KEY)
            return
    except Exception as e:  # is_message_enabled is already fail-soft, but belt-and-braces
        log.debug("wa_watch: pre-flight flag check failed (%s) — continuing", e)

    # Nothing to poll without an account SID.
    if not getattr(config, "TWILIO_ACCOUNT_SID", ""):
        log.info("wa_watch: TWILIO_ACCOUNT_SID unset — approval watcher inert")
        return

    log.info("wa_watch: starting template-approval watcher (poll every %ss)", POLL_SECONDS)
    while True:
        try:
            es_sid = (getattr(config, "WA_TEMPLATE_INTRO_ES", "") or "").strip()
            en_sid = (getattr(config, "WA_TEMPLATE_INTRO_EN", "") or "").strip()

            if not (es_sid and en_sid):
                # SIDs not set yet (will be set later) — keep polling harmlessly.
                log.debug("wa_watch: template SID(s) unset (es=%s en=%s) — waiting",
                          bool(es_sid), bool(en_sid))
            else:
                es_ok = await _template_approved(es_sid)
                en_ok = await _template_approved(en_sid)
                if es_ok and en_ok:
                    await _set_enabled()
                    await _ping_peter()
                    log.info("wa_watch: both templates approved — flag set, watcher burning itself")
                    break  # burn: exit the loop for good (flag persists across restarts)
                else:
                    log.debug("wa_watch: not yet approved (es=%s en=%s) — will retry", es_ok, en_ok)
        except Exception as e:
            # Absolutely nothing in the loop body may crash the background task.
            log.warning("wa_watch: poll iteration errored (tolerating): %s", e)

        try:
            await asyncio.sleep(POLL_SECONDS)
        except asyncio.CancelledError:
            log.info("wa_watch: watcher cancelled (shutdown)")
            raise
