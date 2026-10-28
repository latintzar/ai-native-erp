"""Twilio WhatsApp: media download (Basic auth) + outbound send."""
from __future__ import annotations

import asyncio
from typing import Optional
from urllib.parse import urlparse

import httpx

import config


def _client():
    from twilio.rest import Client
    # API key (SK/secret) needs the 3-arg form so URLs resolve to the right account.
    if config.TWILIO_API_KEY_SID and config.TWILIO_API_KEY_SECRET:
        return Client(config.TWILIO_API_KEY_SID, config.TWILIO_API_KEY_SECRET, config.TWILIO_ACCOUNT_SID)
    return Client(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN)


def _is_twilio_host(url: str) -> bool:
    host = (urlparse(url).hostname or "").lower()
    return host == "twilio.com" or host.endswith(".twilio.com")


async def download_media(url: str) -> tuple[bytes, str]:
    """Fetch a Twilio media URL (requires account Basic auth). Returns (bytes, content_type).

    SSRF guard: only the initial request to a *.twilio.com host carries the account
    Basic auth. httpx strips Authorization on cross-host redirects, so the follow to
    Twilio's media CDN is safe; a non-Twilio MediaUrl is refused outright.
    """
    if not _is_twilio_host(url):
        raise ValueError(f"refusing to fetch non-Twilio media host: {urlparse(url).hostname}")
    async with httpx.AsyncClient(
        timeout=60,
        follow_redirects=True,
        auth=config.twilio_rest_auth(),
    ) as c:
        r = await c.get(url)
        r.raise_for_status()
        return r.content, r.headers.get("content-type", "")


async def start_dual_recording(call_sid: str, status_callback: str = "") -> str:
    """Start a DUAL-channel recording on a live call via the Twilio REST API.

    The OFF (Polly auto-answer) path uses `<Start><Stream>`, which — unlike `<Dial>` /
    `<Connect>` — cannot carry a `record` attribute. So we kick the dual-channel recording
    here instead (RecordingChannels='dual' → caller = channel 0, our side = channel 1),
    feeding the Hermes-style 2-channel post-call pass. Returns the recording SID (or '')."""
    if not call_sid:
        return ""

    def _start() -> str:
        kwargs = {"recording_channels": "dual"}
        if status_callback:
            kwargs["recording_status_callback"] = status_callback
            kwargs["recording_status_callback_event"] = ["completed"]
        rec = _client().calls(call_sid).recordings.create(**kwargs)
        return getattr(rec, "sid", "") or ""

    try:
        return await asyncio.to_thread(_start)
    except Exception:
        import logging
        logging.getLogger("rocoto.twilio_wa").exception("start_dual_recording failed for %s", call_sid)
        return ""


async def start_outbound_call(
    to_phone: str,
    twiml_url: str,
    status_callback: str = "",
    *,
    from_override: str = "",
    time_limit: int = 0,
    machine_detection: str = "",
) -> str:
    """Place an OUTBOUND voice call from Rocoto's number (config.TWILIO_VOICE_FROM) to a customer.

    Twilio fetches `twiml_url` the moment the callee answers, so the answered leg runs the SAME
    bridge as an inbound call (Polly + Deepgram live, or the ElevenLabs agent when the customer's
    voice toggle is on). Returns the new call SID. to_phone is +E.164.

    Demo-call extras (all optional, off by default so the operator path is unchanged):
      from_override    — present a different caller ID (e.g. a verified +34 for ES demo pickups).
      time_limit       — hard cap on call seconds (Twilio ends the call at the limit).
      machine_detection— 'Enable'/'DetectMessageEnd' → answering-machine detection (voicemail guard).
    """
    if config.EGRESS_SANDBOX:
        import logging
        logging.getLogger("rocoto.twilio_wa").info("[EGRESS_SANDBOX] suppressed outbound call to %s", to_phone)
        return "SANDBOX-call"

    def _start() -> str:
        kwargs = {
            "to": to_phone,
            "from_": from_override or config.TWILIO_VOICE_FROM,
            "url": twiml_url,
            "method": "POST",
        }
        if status_callback:
            kwargs["status_callback"] = status_callback
            kwargs["status_callback_event"] = ["initiated", "ringing", "answered", "completed"]
            kwargs["status_callback_method"] = "POST"
        if time_limit:
            kwargs["time_limit"] = int(time_limit)
        if machine_detection:
            kwargs["machine_detection"] = machine_detection
        return _client().calls.create(**kwargs).sid

    return await asyncio.to_thread(_start)


async def end_call(call_sid: str) -> bool:
    """End a live Twilio call (the demo modal's red hang-up button). Idempotent-ish: a call that
    already completed just returns False. Never raises to the caller."""
    if not call_sid:
        return False

    def _end() -> bool:
        _client().calls(call_sid).update(status="completed")
        return True

    try:
        return await asyncio.to_thread(_end)
    except Exception:
        import logging
        logging.getLogger("rocoto.twilio_wa").warning("end_call failed for %s", call_sid)
        return False


async def send_whatsapp(to_phone: str, text: str, media_url: Optional[str] = None) -> str:
    """Send a WhatsApp message via Twilio. to_phone is +E.164. Returns the message SID.

    A SID only means Twilio ACCEPTED the message — delivery failures land ASYNC (e.g. 63112, the
    2026-07-21 sender outage that silently ate every send). Every send therefore registers the
    status callback (→ /twilio/whatsapp/status), which turns a failed delivery into an
    ops.wa_send_failed event + a parked alert. Callers that must KNOW (narrate) poll
    get_message_status after sending.

    THE RAIL SWITCH (2026-07-21): with ROCOTO_WA_RAIL=cloud, the send rides Meta Cloud API direct
    (whatsapp_cloud.py — our own WABA, no BSP) and returns a wamid.* id; cloud delivery statuses
    arrive on /meta/whatsapp/webhook instead of the Twilio callback. All 13 call sites unchanged."""
    if config.EGRESS_SANDBOX:
        import logging
        logging.getLogger("rocoto.twilio_wa").info("[EGRESS_SANDBOX] suppressed WhatsApp to %s (%d chars)", to_phone, len(text or ""))
        return "SANDBOX-wa"
    # WHATSAPP = META CLOUD ONLY (Peter, 2026-07-23): the Twilio WhatsApp rail is retired. Telephony
    # (voice calls / the ElevenLabs bridge) still rides Twilio — that is a separate path, untouched.
    import whatsapp_cloud
    if media_url:
        return await whatsapp_cloud.send_media(to_phone, media_url, caption=text or "")
    return await whatsapp_cloud.send_text(to_phone, text or "")


async def get_message_status(sid: str) -> dict:
    """The CURRENT delivery status of a sent message: {status, error_code}. `status` is Twilio's
    lifecycle (queued→sent→delivered/read | failed/undelivered); error_code is set on failure.
    Cloud-rail ids (wamid.*) have no pollable status — their failures arrive on the Meta webhook
    (statuses[]) — so they report 'sent' here (accepted by Meta at the API call).
    Fail-soft: on any API hiccup returns {'status': 'unknown'} — never raises."""
    if (sid or "").startswith("wamid"):
        return {"status": "sent", "error_code": None}
    def _fetch() -> dict:
        m = _client().messages(sid).fetch()
        return {"status": m.status, "error_code": m.error_code}
    try:
        return await asyncio.to_thread(_fetch)
    except Exception:
        return {"status": "unknown", "error_code": None}


_TYPING_ENDPOINT = "https://messaging.twilio.com/v3/Indicators/Typing.json"

# Module-level shared httpx client for the typing beta (review F8): the indicator can fire on every
# inbound, so a per-call AsyncClient (new connection pool each time) is wasteful. Lazily created on the
# running loop; closed on shutdown via aclose_shared_client(). Fail-soft everywhere.
_typing_client: Optional[httpx.AsyncClient] = None


def _get_typing_client() -> httpx.AsyncClient:
    global _typing_client
    c = _typing_client
    if c is None or c.is_closed:
        c = httpx.AsyncClient(timeout=10)
        _typing_client = c
    return c


async def aclose_shared_client() -> None:
    """Close the shared typing httpx client (app shutdown hook). Fail-soft; safe to call when unused."""
    global _typing_client
    c = _typing_client
    _typing_client = None
    if c is not None and not c.is_closed:
        try:
            await c.aclose()
        except Exception:
            pass


async def send_typing_indicator(inbound_message_sid: str) -> bool:
    """Show WhatsApp's "typing…" bubble to the sender of `inbound_message_sid` (Workstream C).

    Twilio v3 Indicators endpoint (Public Beta on our account, empirically confirmed 2026-07-10):
    POST Typing.json, Basic auth, JSON body {"channel":"WHATSAPP","messageId":<inbound SM…/MM… SID>}.
    Side effects: also marks that inbound message READ (blue ticks); the bubble clears when our reply
    is delivered OR after ~25s, whichever first. Re-POST to extend during a long generation.

    The SDK has no helper for this beta endpoint, so we call it with httpx directly (same auth form
    as download_media). FULLY fail-soft: a bad SID, a beta hiccup, or a network error just returns
    False — the typing bubble is a nicety and must NEVER block, delay, or crash the reply path.

    IMPORTANT: pass the RAW Twilio message SID. Multi-media inbound rows store "{SID}-{i}" for ALL
    items when NumMedia>1 (including i=0), and the bare SID when NumMedia==1 (app.py) — strip that
    "-<digits>" suffix before calling; the caller (voice_reply._inbound_sid) owns that normalisation.
    """
    sid = (inbound_message_sid or "").strip()
    if not sid:
        return False
    if config.EGRESS_SANDBOX:
        import logging
        logging.getLogger("rocoto.twilio_wa").info(
            "[EGRESS_SANDBOX] suppressed WhatsApp typing indicator for %s", sid)
        return True

    async def _post() -> bool:
        c = _get_typing_client()
        r = await c.post(
            _TYPING_ENDPOINT,
            auth=config.twilio_rest_auth(),
            json={"channel": "WHATSAPP", "messageId": sid},
        )
        r.raise_for_status()
        return True

    try:
        return await _post()
    except Exception:
        import logging
        logging.getLogger("rocoto.twilio_wa").debug(
            "send_typing_indicator failed for %s (beta, fail-soft)", sid, exc_info=True
        )
        return False


async def send_template(to_phone: str, content_sid: str,
                        variables: Optional[dict] = None) -> str:
    """Send an APPROVED WhatsApp template (business-initiated) via the Twilio Content API.
    Used to open a conversation with a lead who hasn't messaged us (the 24h-window rule). to_phone
    is +E.164; content_sid is the approved HX… template. Returns the message SID."""
    if config.EGRESS_SANDBOX:
        import logging
        logging.getLogger("rocoto.twilio_wa").info(
            "[EGRESS_SANDBOX] suppressed WhatsApp template to %s", to_phone)
        return "SANDBOX-wa"

    import json as _json

    def _send() -> str:
        kwargs = {
            "from_": config.ROCOTO_WHATSAPP_FROM,
            "to": f"whatsapp:{to_phone}",
            "content_sid": content_sid,
        }
        if variables:
            kwargs["content_variables"] = _json.dumps(variables)
        return _client().messages.create(**kwargs).sid

    return await asyncio.to_thread(_send)
