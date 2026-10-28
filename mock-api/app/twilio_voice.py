"""TWILIO, SELF-CONTAINED — the call, its recording, its transcript (FEED-IA §196.6).

Peter: «i don't want dependencies on the actual hermes caller as that's a packed thing, i want it
all self contained in here, same as twilio. that shit proved capability now we're doing it all for
real, every part of the process, nothing half assed. if i missed a step when explaining it, figure
that out.»

The steps he did not spell out, figured out and stated here rather than left implied:

  · **Who is called first.** A browser cannot hold a phone leg without the Voice SDK, so a click to
    call rings the OPERATOR's own phone and only then bridges to the customer. That order is also
    what makes the recording exact: channel 0 is us, channel 1 is them (`record-from-answer-dual`),
    which is the Hermes shape Deepgram's multichannel mode reads without heuristics.
  · **Which number the customer sees.** `ROCOTO_HOUSE_NUMBER`, and nothing else. VOICE-00 forbids
    claiming a caller ID that has not been proven, so an unset house number REFUSES the call.
  · **Which webhooks are believed.** Only Twilio's, proven by `X-Twilio-Signature` over the exact
    public URL and the exact form. An unsigned or wrongly-signed request is 403 — never processed
    «just in case», because these endpoints spend money and write customer records.
  · **When a recording is «ours».** When the bytes are on this disk. Twilio saying a recording
    exists makes the custody `provider`; downloading it makes it `ours` (store.py).
  · **What is never claimed.** «The call was recorded» before the recording callback; «the call was
    transcribed» before Deepgram returns bound to that recording (VOICE-00's forbidden claims).
"""
from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone
from xml.sax.saxutils import escape

import httpx
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, Response

from . import deepgram, places, retention, store
from .config import settings
from .errors import RuntimeError_, json_error

logger = logging.getLogger("rocoto.runtime.twilio")
router = APIRouter()

API = "https://api.twilio.com/2010-04-01"


def configured() -> bool:
    return bool(settings.twilio_account_sid and settings.twilio_auth_token)


def _auth() -> tuple[str, str]:
    # API key + secret when they exist (they can be rotated without touching the account), the
    # account's own token otherwise. Both are HTTP basic against the same REST API.
    if settings.twilio_api_key_sid and settings.twilio_api_key_secret:
        return settings.twilio_api_key_sid, settings.twilio_api_key_secret
    return settings.twilio_account_sid, settings.twilio_auth_token


def public_url(path: str) -> str:
    if not settings.public_base:
        raise RuntimeError_("runtime_origin_missing", "Set ROCOTO_RUNTIME_PUBLIC_BASE for this runtime.", 503)
    return f"{settings.public_base}{path}"


def twiml_dial(to: str) -> str:
    """The TwiML the operator's leg runs: dial the customer as the house, record both tracks."""
    if not to.startswith("+"):
        return "<Response><Say language=\"es-ES\">Número no válido.</Say></Response>"
    # NOTE, carried over from the Hermes caller because it costs a whole call to relearn: on <Dial>
    # the dual-channel recording is encoded in the `record` VALUE — `recordingChannels` belongs to
    # <Record> and is silently ignored here, producing a mono file where both legs are summed and
    # multichannel transcription is useless.
    return (
        "<Response>"
        f'<Dial callerId="{escape(settings.house_number)}"'
        ' record="record-from-answer-dual"'
        f' recordingStatusCallback="{escape(public_url("/api/twilio/recording"))}"'
        ' recordingStatusCallbackMethod="POST"'
        f' statusCallback="{escape(public_url("/api/twilio/status"))}"'
        ' statusCallbackMethod="POST"'
        ' statusCallbackEvent="completed"'
        ' timeout="30">'
        f"<Number>{escape(to)}</Number>"
        "</Dial>"
        "</Response>"
    )


def validate(url: str, form: dict[str, str], signature: str) -> bool:
    """Twilio's own HMAC, computed here so the runtime carries no trust it did not verify."""
    if not settings.twilio_auth_token or not signature:
        return False
    from twilio.request_validator import RequestValidator

    return RequestValidator(settings.twilio_auth_token).validate(url, form, signature)


def signed_url(request: Request) -> str:
    """The URL TWILIO SIGNED — path AND query, on the public host.

    ⚠ The query string is part of the signature, and dropping it is a silent, total failure: the
    outbound call's TwiML URL carries `?to=+34…`, so a validator built on the path alone rejects
    every voice webhook the runtime itself asked for. `drive-199-runtime.py` caught exactly that,
    which is why the check exists at all. The host must be the PUBLIC one because Caddy proxies to
    127.0.0.1 and Twilio signed what it dialled, not what uvicorn received.
    """
    query = request.url.query
    return public_url(request.url.path) + (f"?{query}" if query else "")


async def _require_twilio(request: Request) -> dict[str, str]:
    form = {k: str(v) for k, v in (await request.form()).items()}
    url = signed_url(request)
    if not validate(url, form, request.headers.get("X-Twilio-Signature", "")):
        logger.warning("rejected an unsigned webhook", extra={"route": request.url.path, "outcome": "unsigned"})
        raise RuntimeError_("bad_signature", "That request did not come from Twilio.", 403)
    return form


async def place_call(to: str) -> dict[str, str]:
    """Ring the operator, bridge to the customer, record from answer. Refuses on a missing fact."""
    if not configured():
        raise RuntimeError_("twilio_missing", "Twilio is not configured on this runtime.", 503)
    if not settings.house_number:
        raise RuntimeError_("house_number_missing",
                            "This runtime has no house number, so it will not place a call.", 503)
    if not settings.operator_number:
        raise RuntimeError_("operator_missing",
                            "Set the operator's phone before dialling, so somebody is on the line.", 503)
    if not to.startswith("+"):
        raise RuntimeError_("bad_number", "A call needs an E.164 number, starting with +.", 400)

    body = {
        "From": settings.house_number,
        "To": settings.operator_number,
        "Url": public_url(f"/api/twilio/voice?to={to}"),
        "Method": "POST",
        "StatusCallback": public_url("/api/twilio/status"),
        "StatusCallbackMethod": "POST",
        "StatusCallbackEvent": "completed",
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(f"{API}/Accounts/{settings.twilio_account_sid}/Calls.json",
                                     data=body, auth=_auth())
    if response.status_code >= 400:
        detail = ""
        try:
            detail = str(response.json().get("message") or "")
        except Exception:
            detail = ""
        raise RuntimeError_("twilio_failed", f"Twilio answered {response.status_code}. {detail}".strip(), 502)

    sid = response.json().get("sid") or ""
    store.save({
        "sid": sid, "direction": "outbound", "from": settings.house_number, "to": to,
        "startedAt": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "recordingCustody": "none", "operator": settings.operator_number,
    })
    logger.info("call placed", extra={"provider": "twilio", "call_sid": sid, "outcome": "queued"})
    return {"sid": sid}


@router.post("/api/twilio/voice")
async def voice(request: Request) -> Response:
    """The TwiML for a leg. `to` rides the URL the REST creation signed into the call."""
    form = await _require_twilio(request)
    to = (request.query_params.get("to") or form.get("To") or "").strip()
    call_sid = (form.get("CallSid") or "").strip()
    if call_sid:
        store.save({"sid": call_sid, "to": to, "from": settings.house_number, "direction": "outbound",
                    "startedAt": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
                    "recordingCustody": "none"})
    logger.info("twiml served", extra={"provider": "twilio", "call_sid": call_sid, "route": "voice"})
    return Response(content=twiml_dial(to), media_type="application/xml")


@router.post("/api/twilio/status")
async def status(request: Request) -> JSONResponse:
    form = await _require_twilio(request)
    call_sid = (form.get("CallSid") or "").strip()
    call_status = (form.get("CallStatus") or "").strip()
    duration = form.get("CallDuration") or form.get("DialCallDuration") or ""
    patch = {"sid": call_sid, "status": call_status}
    if duration.isdigit():
        patch["durationSeconds"] = int(duration)
    if call_sid:
        store.save(patch)
    logger.info("call status", extra={"provider": "twilio", "call_sid": call_sid, "outcome": call_status})
    return JSONResponse({"ok": True})


@router.post("/api/twilio/recording")
async def recording(request: Request) -> JSONResponse:
    """Custody: fetch the bytes with auth, keep them here, transcribe, attach. Then say so."""
    form = await _require_twilio(request)
    url = (form.get("RecordingUrl") or "").strip()
    call_sid = (form.get("CallSid") or "").strip()
    recording_sid = (form.get("RecordingSid") or "").strip()
    duration = (form.get("RecordingDuration") or "0").strip()
    if not url:
        return json_error("no_recording_url", "The recording callback carried no RecordingUrl.", 400)

    patch = {"sid": call_sid, "recordingCustody": "provider", "recordingSid": recording_sid}
    if duration.isdigit():
        patch["durationSeconds"] = int(duration)
    store.save(patch)
    # The transcription runs after the response: Twilio retries a slow webhook, and a retry would
    # transcribe the same recording twice — at the provider's price, into the same record.
    asyncio.create_task(take_custody(call_sid, recording_sid, url))
    logger.info("recording announced", extra={"provider": "twilio", "call_sid": call_sid, "outcome": "provider"})
    return JSONResponse({"ok": True})


async def take_custody(call_sid: str, recording_sid: str, url: str) -> None:
    """Download → keep → transcribe → attach. Every step is recorded, and none is assumed."""
    started = time.time()
    try:
        async with httpx.AsyncClient(timeout=120.0, follow_redirects=True) as client:
            response = await client.get(url if url.endswith(".wav") else url + ".wav", auth=_auth())
        if response.status_code >= 400:
            logger.warning("recording could not be fetched (%s)", response.status_code,
                           extra={"provider": "twilio", "call_sid": call_sid, "outcome": "fetch_failed"})
            return
        path = store.recording_path(recording_sid or call_sid)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(response.content)
        store.save({"sid": call_sid, "recordingCustody": "ours", "recordingPath": str(path)})
        logger.info("recording in custody", extra={"provider": "twilio", "call_sid": call_sid, "outcome": "ours"})

        call = store.get(call_sid) or {}
        terms: list[str] = []
        counterpart = call.get("to") or ""
        if counterpart and settings.places_key:
            try:
                # Hermes's own ordering: identity BEFORE transcription, so the business name can
                # bias nova-3's spelling of it (places.keyterms).
                terms = places.keyterms(await places.identity(counterpart))
            except Exception as exc:
                logger.info("identity unavailable for keyterms: %s", exc, extra={"call_sid": call_sid})
        audio, content_type, dual = await asyncio.to_thread(deepgram.to_wav_multichannel, response.content, ".wav")
        transcript = await deepgram.transcribe(audio, language=settings.transcribe_language,
                                               dual_channel=dual, keyterms=terms, content_type=content_type)
        store.save({"sid": call_sid, "transcript": transcript})
        logger.info("transcript attached", extra={"provider": "deepgram", "call_sid": call_sid,
                                                  "ms": int((time.time() - started) * 1000)})
        # VOICE-21 · VOICE-09B — «Provider audio: deleted as soon as the transcript is ready», and
        # «Raw recording audio: no Rocoto blob/file». The bytes existed on this disk for one reason
        # and that reason has just been served, so they go HERE rather than a day later: the daily
        # sweep (app/retention.py) is the net under this line, never the road. Custody falls back
        # to `provider`, which is the honest word once the copy is gone.
        if retention.has_words(transcript):
            retention.forget_audio(call_sid, recording_sid)
    except Exception as exc:
        logger.warning("custody failed: %s", exc, extra={"call_sid": call_sid, "outcome": "custody_failed"})


async def account_state() -> dict[str, object]:
    """What the Twilio ACCOUNT actually says — presence in the env is not an account that works."""
    if not configured():
        return {"reachable": False, "why": "not configured"}
    async with httpx.AsyncClient(timeout=20.0) as client:
        try:
            response = await client.get(f"{API}/Accounts/{settings.twilio_account_sid}.json", auth=_auth())
        except Exception as exc:
            return {"reachable": False, "why": type(exc).__name__}
    if response.status_code >= 400:
        message = ""
        try:
            message = str(response.json().get("message") or "")
        except Exception:
            message = ""
        return {"reachable": False, "status": response.status_code, "why": message}
    body = response.json()
    return {"reachable": True, "status": 200, "accountStatus": body.get("status"), "type": body.get("type")}
