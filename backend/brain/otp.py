"""Phone OTP for the PUBLIC shop endpoints — Twilio Verify (the supplier's own Twilio account).

A storefront customer must prove they own the WhatsApp number before a basket is created in the
supplier's conversation thread (closes the thread-spoofing hole from the ship review). We use Twilio
Verify (Twilio owns code generation, expiry, attempt-throttling, channel delivery) rather than rolling
our own codes. Channel = SMS by default; whatsapp where the number is WhatsApp-reachable.

No Twilio creds / no Verify service → falls back to disabled (the endpoint returns 503), never crashes.
"""
from __future__ import annotations

import logging

import httpx

import config

log = logging.getLogger("rocoto.otp")

_BASE = "https://verify.twilio.com/v2"


def configured() -> bool:
    return bool(config.TWILIO_ACCOUNT_SID and config.TWILIO_AUTH_TOKEN and config.TWILIO_VERIFY_SERVICE_SID)


async def send(phone: str, channel: str = "sms") -> dict:
    """Start a verification — Twilio sends a code to `phone`. Returns {sent, status}."""
    if not configured():
        return {"sent": False, "reason": "otp_not_configured"}
    url = f"{_BASE}/Services/{config.TWILIO_VERIFY_SERVICE_SID}/Verifications"
    async with httpx.AsyncClient(timeout=15) as cx:
        r = await cx.post(url, auth=config.twilio_rest_auth(),
                          data={"To": phone, "Channel": channel if channel in ("sms", "whatsapp", "call") else "sms"})
    if r.status_code >= 400:
        log.warning("otp send failed %s: %s", r.status_code, r.text[:200])
        return {"sent": False, "reason": "send_failed", "status": r.status_code}
    return {"sent": True, "status": r.json().get("status", "pending")}


async def check(phone: str, code: str) -> bool:
    """Verify a code. True only if Twilio reports status='approved'."""
    if not configured() or not code:
        return False
    url = f"{_BASE}/Services/{config.TWILIO_VERIFY_SERVICE_SID}/VerificationCheck"
    try:
        async with httpx.AsyncClient(timeout=15) as cx:
            r = await cx.post(url, auth=config.twilio_rest_auth(),
                              data={"To": phone, "Code": str(code).strip()})
    except httpx.HTTPError as e:
        log.warning("otp check network error: %s", e)
        return False
    if r.status_code >= 400:
        # Twilio returns 404 once a code is consumed/expired — treat as not-approved, never crash.
        return False
    return r.json().get("status") == "approved"
