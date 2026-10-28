"""Customer comms loop for the storefront custom/ASAP flow (medusa-integration.md §1-2, plan Stage 5a).

A custom or ASAP order is captured as a draft basket (brain/baskets.py); the supplier accepts it inside
the WhatsApp chat or the daily brief. At three lifecycle transitions the CUSTOMER is notified:

  - submitted  → "we've got it, the supplier is confirming your customization / short-notice request"
  - accepted   → "accepted! here's your payment link — or go back to your tab to pay"
  - questions   → "the supplier has a question about your order — reply here / on WhatsApp"

**SMS + email are the SOURCE OF TRUTH; WhatsApp is best-effort.** The WhatsApp 24h care-window means a
business-initiated freeform message outside the window is REJECTED by Twilio, and Rocoto is not on the
tier that allows unrestricted business-initiated outbound — so WhatsApp can only be relied on as the
optional fast path. SMS (Twilio) and email (Resend) are what we trust to reach the customer.

Hard rules baked in here:
  - **Flag-gated:** every send is behind config.NOTIFY_ENABLED (default OFF). Flag off ⇒ a clean no-op
    that records the intended channels but sends nothing — so the accept/submit paths are safe before the
    providers (Twilio Messaging Service, an approved WhatsApp template) are fully wired.
  - **Toll-fraud guard:** outbound *paid* SMS fires ONLY to an OTP-verified phone. An un-verified basket
    gets email (+ best-effort WhatsApp) but never a paid SMS.
  - **Never raises:** a provider error is caught, logged, and reported in the result — a notify failure
    must never break an accept/submit.

This module is import-safe with the providers unconfigured: missing Twilio/Resend creds degrade to a
recorded {"ok": False, "skipped": "..."} per channel, never an exception.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict, Optional

import httpx

import config

log = logging.getLogger("rocoto.notify")

KINDS = ("submitted", "accepted", "questions")

# ── copy (SMS is plain-text + short; email is the same message, nicely shelled) ──
# ASAP/overnight reuses these paths with the "short-notice" framing toggled by `asap`.

def _texts(kind: str, basket: Dict[str, Any], *, pay_link: str = "", asap: bool = False) -> Dict[str, str]:
    name = (basket.get("customer_name") or "").strip()
    hi = f"Hola {name}, " if name else "Hola, "
    what = "pedido urgente" if asap else "pedido a medida"
    if kind == "submitted":
        sms = (f"{hi}soy Rocoto. Ya tengo tu {what} y se lo he pasado al proveedor para que lo "
               "confirme. En cuanto me diga algo te aviso por aquí y por email. Yo me encargo.")
        subject = "Ya tengo tu pedido — lo estoy confirmando"
        title = "Ya tengo tu pedido"
        body = (f"Soy Rocoto. Ya tengo tu {what} y se lo he pasado al proveedor para que confirme "
                f"que {'puede con esa urgencia' if asap else 'puede hacértelo a medida'}. "
                "En cuanto lo acepte, haya que pagar, o me surja alguna duda, te aviso al momento "
                "por SMS y por email. Si prefieres hablar directo, me escribes por WhatsApp cuando quieras.")
        cta_text, cta_url = "", ""
    elif kind == "accepted":
        sms = (f"{hi}buenas noticias — tu {what} está aceptado. Págalo aquí para confirmarlo: {pay_link}"
               if pay_link else f"{hi}buenas noticias — tu {what} está aceptado. Entra en tu cuenta y págalo cuando quieras.")
        subject = "Aceptado — ya puedes pagar"
        title = "Tu pedido está aceptado"
        body = ("Buenas noticias — el proveedor ha aceptado tu pedido. Échale un ojo y págalo para "
                "confirmarlo; si tienes tu cuenta abierta, la verás actualizada lista para pagar.")
        cta_text, cta_url = ("Pagar ahora", pay_link) if pay_link else ("", "")
    elif kind == "questions":
        sms = (f"{hi}el proveedor tiene una duda con tu {what}. Respóndeme por aquí, o me escribes por "
               "WhatsApp y lo resolvemos en un momento.")
        subject = "Una dudilla con tu pedido"
        title = "Tengo una dudilla con tu pedido"
        body = ("El proveedor tiene una duda con tu pedido antes de poder confirmarlo. Respóndeme por "
                "aquí, o me escribes por WhatsApp y lo resolvemos en un momento.")
        cta_text, cta_url = "", ""
    else:  # defensive — unknown kind never reaches a provider with empty copy
        raise ValueError(f"notify: unknown kind {kind!r} (want one of {KINDS})")
    return {"sms": sms, "subject": subject, "title": title, "body": body,
            "cta_text": cta_text, "cta_url": cta_url}


# Rocoto palette + face (matches brain/onboarding.py _shell). Face is a blinking GIF, theme-aware.
_ROC_TERRACOTTA = "#C01B2C"
_ROC_INK = "#1A1413"
_ROC_CREAM = "#FAF7F3"
_ROC_STONE = "#6F665C"
_ROC_FACE_LIGHT = "https://soyrocoto.com/brand/face-blink-light.gif"
_ROC_FACE_DARK = "https://soyrocoto.com/brand/face-blink-dark.gif"


def _email_shell(title: str, body: str, cta_text: str = "", cta_url: str = "") -> str:
    """Branded transactional email in Rocoto's voice + look.

    IT IS NOW `app._email_shell` (2026-08-09). There were two shells — this one and app.py's — so
    «Rocoto» meant two different-looking companies depending on which module happened to send. The
    app one was rebuilt around the real mark, a bulletproof table skeleton and an image-off
    fallback; this delegates to it rather than being a second thing to keep correct. Same signature,
    so every caller here is untouched.

    The import is LAZY and the fallback below is the old body, deliberately: `brain.notify` is
    imported by app.py, so importing app at module level would be a cycle, and a notification that
    fails to render is a notification that does not go out. If the delegation ever cannot resolve,
    the mail still leaves looking like Rocoto."""
    try:
        import app as _app
        return _app._email_shell(title, f'<p style="margin:0">{body}</p>', cta_text, cta_url,
                                 lang="es")
    except Exception:
        log.debug("notify: shared email shell unavailable, using the local one", exc_info=True)
    cta = (f'<a href="{cta_url}" style="display:inline-block;background:{_ROC_TERRACOTTA};color:#fff;'
           f'text-decoration:none;padding:15px 30px;border-radius:14px;font-weight:600;font-size:16px;'
           f'letter-spacing:.01em">{cta_text}</a>') if (cta_text and cta_url) else ""
    body_html = f'<p style="margin:0 0 16px">{body}</p><p style="margin:0">Rocoto</p>'
    # Theme-aware blinking face: light GIF by default; prefers-color-scheme:dark swaps to the dark
    # variant and flips the card/text colors for email dark mode.
    return (
        '<!--[if mso]><style>body,table,td{font-family:Arial,sans-serif !important}</style><![endif]-->'
        '<style>'
        '  @media (prefers-color-scheme: dark){'
        '    .roc-bg{background:#141010 !important}'
        '    .roc-card{background:#1F1917 !important;border-color:rgba(250,247,243,.12) !important}'
        '    .roc-title{color:#FAF7F3 !important}'
        '    .roc-body{color:#C9BFB4 !important}'
        '    .roc-body a{color:#F0857F !important}'
        '    .roc-foot{color:#8A7F72 !important}'
        '    .roc-face-light{display:none !important}'
        '    .roc-face-dark{display:inline-block !important}'
        '  }'
        '</style>'
        f'<div class="roc-bg" style="font-family:Inter,-apple-system,system-ui,\'Segoe UI\',sans-serif;'
        f'background:{_ROC_CREAM};padding:32px 20px;color:{_ROC_INK}">'
        f'<div class="roc-card" style="max-width:540px;margin:0 auto;background:#fff;'
        f'border:1px solid rgba(26,20,19,.10);border-radius:24px;overflow:hidden">'
        f'<div style="padding:30px 40px 8px 40px">'
        f'<img class="roc-face-light" src="{_ROC_FACE_LIGHT}" width="56" height="56" alt="Rocoto" '
        f'style="width:56px;height:56px;border-radius:50%;vertical-align:middle;display:inline-block">'
        f'<img class="roc-face-dark" src="{_ROC_FACE_DARK}" width="56" height="56" alt="Rocoto" '
        f'style="width:56px;height:56px;border-radius:50%;vertical-align:middle;display:none">'
        f'<span style="font-size:20px;font-weight:700;letter-spacing:-.01em;vertical-align:middle;'
        f'margin-left:12px;color:{_ROC_TERRACOTTA}">Rocoto</span>'
        f'</div>'
        f'<div style="padding:8px 40px 40px 40px">'
        f'<h1 class="roc-title" style="font-size:28px;line-height:1.25;margin:16px 0 20px;'
        f'font-weight:700;letter-spacing:-.02em;color:{_ROC_INK}">{title}</h1>'
        f'<div class="roc-body" style="font-size:16px;line-height:1.6;color:{_ROC_STONE}">{body_html}</div>'
        f'<div style="margin-top:28px">{cta}</div>'
        f'</div>'
        f'</div>'
        f'<div class="roc-foot" style="text-align:center;color:#998F83;font-size:13px;'
        f'line-height:1.6;margin-top:20px">Rocoto · tu empleado de ventas</div>'
        f'</div>')


# ── providers (each isolated, never raises, returns a small {ok,...} dict) ──

async def _send_sms(to_phone: str, body: str) -> Dict[str, Any]:
    """Twilio SMS via the shared twilio_wa client/creds. Source-of-truth channel for the customer."""
    if config.EGRESS_SANDBOX:
        log.info("[EGRESS_SANDBOX] suppressed notify SMS to %s", to_phone)
        return {"ok": True, "sid": "SANDBOX-sms"}
    if not (config.TWILIO_ACCOUNT_SID and config.TWILIO_AUTH_TOKEN):
        return {"ok": False, "skipped": "twilio_unconfigured"}
    if not (config.TWILIO_MESSAGING_SERVICE_SID or config.TWILIO_SMS_FROM):
        return {"ok": False, "skipped": "no_sms_sender"}

    def _send() -> str:
        from twilio_wa import _client  # reuse the SAME Client/creds the WhatsApp sender uses
        kwargs: Dict[str, Any] = {"to": to_phone, "body": body}
        if config.TWILIO_MESSAGING_SERVICE_SID:
            kwargs["messaging_service_sid"] = config.TWILIO_MESSAGING_SERVICE_SID
        else:
            kwargs["from_"] = config.TWILIO_SMS_FROM
        return _client().messages.create(**kwargs).sid

    try:
        sid = await asyncio.to_thread(_send)
        return {"ok": True, "sid": sid}
    except Exception as e:
        log.warning("notify sms failed to %s: %s", to_phone, e)
        return {"ok": False, "error": str(e)[:200]}


async def _send_email(to_email: str, subject: str, html: str) -> Dict[str, Any]:
    """No-attachment Resend send (reuses RESEND_API_KEY). Source-of-truth channel for the customer."""
    if config.EGRESS_SANDBOX:
        # class-E floor (WP-2.5 rehearsal find): every raw Resend sender short-circuits under the sandbox.
        log.info("[EGRESS_SANDBOX] suppressed notify email to %s (subject=%r)", to_email, subject[:60])
        return {"ok": True, "id": "SANDBOX-email"}
    if not config.RESEND_API_KEY:
        return {"ok": False, "skipped": "resend_unconfigured"}
    try:
        async with httpx.AsyncClient(timeout=30) as cx:
            r = await cx.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {config.RESEND_API_KEY}", "User-Agent": "rocoto-mailer/1.0"},
                json={"from": config.NOTIFY_FROM_EMAIL, "to": [to_email],
                      "subject": subject, "html": html},
            )
        if r.status_code >= 300:
            log.warning("notify email failed %s: %s", r.status_code, r.text[:200])
            return {"ok": False, "error": f"{r.status_code}: {r.text[:160]}"}
        return {"ok": True, "id": (r.json() or {}).get("id", "")}
    except Exception as e:
        log.warning("notify email error to %s: %s", to_email, e)
        return {"ok": False, "error": str(e)[:200]}


async def _send_whatsapp(to_phone: str, body: str) -> Dict[str, Any]:
    """Best-effort WhatsApp. Outside the 24h care window Twilio REJECTS a freeform body — so this is the
    optional fast path only, NEVER the source of truth (the SMS+email above are). A reject is swallowed.

    TODO(stage-5a-prereq): an APPROVED WhatsApp message template is a multi-day external dependency. Until
    one is registered + approved, business-initiated outbound outside the window will fail here and we rely
    on SMS+email. When the template lands, route this through twilio_wa with the template SID + variables.
    """
    if not (config.TWILIO_ACCOUNT_SID and config.TWILIO_AUTH_TOKEN):
        return {"ok": False, "skipped": "twilio_unconfigured"}
    try:
        from twilio_wa import send_whatsapp
        sid = await send_whatsapp(to_phone, body)
        return {"ok": True, "sid": sid}
    except Exception as e:
        # outside-window reject / not on the business-initiated tier → expected; never propagate
        log.info("notify whatsapp best-effort skipped to %s: %s", to_phone, e)
        return {"ok": False, "error": str(e)[:200], "best_effort": True}


# ── the public entry point ──

async def notify_customer(kind: str, basket: Dict[str, Any], *,
                          email: Optional[str] = None,
                          phone: Optional[str] = None,
                          pay_link: Optional[str] = None,
                          phone_verified: Optional[bool] = None,
                          asap: bool = False) -> Dict[str, Any]:
    """Notify the customer on a basket transition. `kind` ∈ {submitted, accepted, questions}.

    SMS + email are the source of truth; WhatsApp is best-effort. Paid SMS fires ONLY when the phone is
    OTP-verified (toll-fraud guard). Everything is gated behind config.NOTIFY_ENABLED (default OFF) — flag
    off ⇒ a no-op result that records WHAT WOULD have been sent, sends nothing. Never raises.

    Returns {ok, enabled, kind, channels:{sms,email,whatsapp}} where each channel is its provider result
    or a {"skipped": reason} (e.g. "notify_disabled", "no_phone", "phone_unverified", "no_email").
    """
    if kind not in KINDS:
        return {"ok": False, "error": f"unknown kind {kind!r}", "kind": kind}

    basket = basket or {}
    phone = (phone or basket.get("phone_number") or "").strip()
    email = (email or basket.get("email") or "").strip()
    pay_link = pay_link or basket.get("pay_link") or ""
    if phone_verified is None:
        phone_verified = bool(basket.get("phone_verified"))

    try:
        copy = _texts(kind, basket, pay_link=pay_link, asap=asap)
    except ValueError as e:
        return {"ok": False, "error": str(e), "kind": kind}

    result: Dict[str, Any] = {"ok": True, "enabled": bool(config.NOTIFY_ENABLED), "kind": kind,
                              "channels": {}}

    # Flag OFF → record intent, send nothing (land-dark contract).
    if not config.NOTIFY_ENABLED:
        result["channels"] = {
            "sms": {"ok": False, "skipped": "notify_disabled",
                    "would_send": bool(phone and phone_verified)},
            "email": {"ok": False, "skipped": "notify_disabled", "would_send": bool(email)},
            "whatsapp": {"ok": False, "skipped": "notify_disabled", "would_send": bool(phone)},
        }
        return result

    # SMS — source of truth, but ONLY to an OTP-verified phone (toll-fraud guard).
    if not phone:
        result["channels"]["sms"] = {"ok": False, "skipped": "no_phone"}
    elif not phone_verified:
        result["channels"]["sms"] = {"ok": False, "skipped": "phone_unverified"}
    else:
        result["channels"]["sms"] = await _send_sms(phone, copy["sms"])

    # Email — source of truth.
    if not email:
        result["channels"]["email"] = {"ok": False, "skipped": "no_email"}
    else:
        html = _email_shell(copy["title"], copy["body"], copy["cta_text"], copy["cta_url"])
        result["channels"]["email"] = await _send_email(email, copy["subject"], html)

    # WhatsApp — best-effort fast path only (24h-window aware; a reject is non-fatal).
    if not phone:
        result["channels"]["whatsapp"] = {"ok": False, "skipped": "no_phone"}
    else:
        result["channels"]["whatsapp"] = await _send_whatsapp(phone, copy["sms"])

    # `ok` reflects whether at least one source-of-truth channel landed (or had nothing to do).
    sot = (result["channels"]["sms"], result["channels"]["email"])
    result["ok"] = any(c.get("ok") for c in sot) or all(c.get("skipped") for c in sot)
    return result
