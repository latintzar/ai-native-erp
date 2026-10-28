"""Hermes-style 2-channel post-call diarization.

The live Deepgram stream is single-mixed-channel diarized (good enough for live subtitles).
For the FINAL call-log card we want Hermes-grade clean speaker separation: Twilio records the
call dual-channel (`record="record-from-answer-dual"`), and we re-transcribe that stereo
recording with Deepgram `multichannel=true` — channel 0 = caller, channel 1 = Rocoto/operator —
so each speaker is cleanly separated regardless of overlap. Mirrors the proven recipe in
apps/call-recorder/product/backend/pipeline.py.

This runs AFTER the call ends, off the Twilio `recordingStatusCallback`. It is non-destructive:
the live transcript stays on the card until this polished one is ready, then replaces it.
"""
from __future__ import annotations

import logging
from typing import Any, Optional

import httpx

import config
import db as supa
import transcribe as tx

log = logging.getLogger("rocoto.postcall")

DG_URL = "https://api.deepgram.com/v1/listen"


def _deepgram_multichannel_sync(wav: bytes) -> dict[str, Any]:
    """Deepgram nova-3, multichannel=true (NOT diarize) — Twilio gives us channel 0 = caller,
    channel 1 = the Rocoto/operator side, so we get clean speaker identity for free."""
    params = {
        "model": "nova-3",
        "language": "multi",
        "punctuate": "true",
        "utterances": "true",
        "smart_format": "true",
        "paragraphs": "true",
        "multichannel": "true",
        # OPTED OUT OF DEEPGRAM'S MODEL IMPROVEMENT PROGRAM. Their ToS §3.2 (Last Updated
        # 2026-08-06) grants them an "irrevocable, perpetual" licence to use Your Content
        # "including training and testing our Models", and §3.3 makes the opt-out per-REQUEST:
        # "Add mip_opt_out=true as a query parameter of all API requests that you want to be
        # excluded". Without it on every call, «tus mensajes no entrenan ningún modelo, ni
        # nuestro ni de un proveedor» — published on /terminos §17, /dpa §13, empresa.html and
        # datos-seguridad.html — is false. Deepgram also retains an opted-out request "only for
        # the duration necessary to process" it.
        "mip_opt_out": "true",
    }
    headers = {
        "Authorization": f"Token {config.DEEPGRAM_API_KEY}",
        "Content-Type": "audio/wav",
    }
    with httpx.Client(timeout=180) as c:
        r = c.post(DG_URL, params=params, headers=headers, content=wav)
        r.raise_for_status()
        return r.json()


def _parse_multichannel(dg: dict) -> tuple[str, list[dict]]:
    """Parse multichannel Deepgram → (speaker-labelled raw text, utterances[]).
    In multichannel mode each utterance carries a `channel` field (0/1), not `speaker`."""
    utts: list[dict] = []
    for u in (dg.get("results", {}) or {}).get("utterances", []) or []:
        text = (u.get("transcript") or "").strip()
        if not text:
            continue
        utts.append({
            "speaker": int(u.get("channel", 0)),   # channel 0 = caller, 1 = Rocoto/operator
            "text": text,
            "start": float(u.get("start", 0.0)),
            "end": float(u.get("end", 0.0)),
        })
    utts.sort(key=lambda x: x["start"])            # interleave channels chronologically
    raw = "\n".join(f"Speaker {u['speaker']}: {u['text']}" for u in utts)
    return raw, utts


def _download_recording(url: str) -> bytes:
    """Fetch the Twilio dual-channel WAV with account Basic auth.

    Defense-in-depth (mirrors the hardened WhatsApp media path): the RecordingUrl arrives on a
    Twilio-signature-verified webhook, but we still refuse to attach Twilio account credentials
    to anything that isn't a twilio.com host — so a forged/redirected URL can't turn this into an
    SSRF proxy or leak the auth token. Redirects are followed (Twilio serves media off a CDN),
    and httpx drops the Authorization header on cross-origin redirects."""
    from urllib.parse import urlparse
    wav_url = url if url.endswith(".wav") else f"{url}.wav"
    host = (urlparse(wav_url).hostname or "").lower()
    if not (host == "api.twilio.com" or host.endswith(".twilio.com")):
        raise ValueError(f"refusing to fetch recording from non-Twilio host: {host!r}")
    with httpx.Client(timeout=120, follow_redirects=True,
                      auth=config.twilio_rest_auth()) as c:
        r = c.get(wav_url)
        r.raise_for_status()
        return r.content


async def find_message_by_call_sid(call_sid: str) -> Optional[dict]:
    """Locate the call_transcript message row for a given Twilio CallSid.

    The sid is stashed in transcript_meta.call_sid at call start (or in the calls row)."""
    if not call_sid:
        return None
    # O(1) lookup via the calls table (calls.id == the message id), with a meta fallback —
    # no longer bounded by "the 200 most recent messages", so a busy WhatsApp+voice number
    # can't age the row out of the window before the recording callback lands.
    return await supa.find_call_transcript_by_sid(call_sid)


async def process_recording(call_sid: str, recording_url: str, recording_sid: str = "") -> None:
    """Download the dual-channel recording, re-transcribe with multichannel, polish with
    Sonnet, and replace the call's transcript non-destructively. Best-effort: on any failure
    we leave the live transcript in place and mark it done so the card never gets stuck."""
    import asyncio
    msg = await find_message_by_call_sid(call_sid)
    if not msg:
        log.warning("postcall: no call_transcript row for call_sid=%s", call_sid)
        return
    msg_id = msg["id"]
    try:
        wav = await asyncio.to_thread(_download_recording, recording_url)
        dg = await asyncio.to_thread(_deepgram_multichannel_sync, wav)
        raw, utts = _parse_multichannel(dg)
        if not raw:
            # Nothing cleaner than the live pass — just mark done, keep what we have.
            await supa.update_message(msg_id, {"transcript_status": "done"})
            log.info("postcall %s: empty multichannel result; kept live transcript", msg_id)
            return
        polished = await asyncio.to_thread(tx.polish_sync, raw)
        await supa.update_message(msg_id, {
            "transcript": polished or raw,
            "transcript_status": "done",
            "transcript_meta": {
                "live": False, "utterances": utts, "raw": raw,
                "channel": "dual", "diarization": "multichannel",
                "call_sid": call_sid, "recording_sid": recording_sid,
                "num_speakers": len({u["speaker"] for u in utts}),
            },
        })
        try:
            await supa.call_update(msg_id, {"recording_sid": recording_sid or None,
                                            "recording_url": recording_url})
        except Exception:
            pass
        log.info("postcall %s: 2-channel diarization done (%d turns)", msg_id, len(utts))
    except Exception:
        log.exception("postcall %s: failed; keeping live transcript", msg_id)
        try:
            await supa.update_message(msg_id, {"transcript_status": "done"})
        except Exception:
            pass


# ── TRACK 3: the post-call PERCEPTION reflex — call turns → DATA the call-end duties consume ──────
# A call ended. `summarize` reads the call's LIVE transcript events off the spine (the polished
# recording above does not exist yet at hangup) and distils them into {name, summary, next_step,
# promise?}. It is PERCEPTION producing DATA (SPEC §3.2 reflex), not a situation module: report_call
# fills its {name}/{summary}/{next_step} slots from the enriched call.ended payload, and when a concrete
# commitment is detected the call-end path emits `call.promise` so the follow_up duty chases it
# UNCONDITIONALLY. The "is there a promise?" judgment lives HERE (a data event) — the deterministic
# replacement for the LLM discretionarily electing open_tab in chat (the actual "0 tabs" fix).
# Fail-soft is the whole contract: ANY gap → safe NON-EMPTY defaults, so the debrief always composes
# (Peter never reads a literal '{summary}').
_DEF_NAME = "un contacto"
_DEF_SUMMARY = "(resumen en la ficha)"
_DEF_NEXT = "lo reviso y te digo"
_SUM_WINDOW_MIN = 180
_SUM_MAX_TURNS = 40


async def _summ_party_name(con, scope: str) -> str:
    """A human name for the party, best-effort: the scope_node label, else a contact display name."""
    try:
        for q in (
            "select nullif(btrim(label),'') from scope_node where scope=$1::ltree limit 1",
            "select nullif(btrim(display_name),'') from contact where scope=$1::ltree "
            "order by id desc limit 1",
        ):
            v = await con.fetchval(q, scope)
            if v:
                return str(v)[:80]
    except Exception:
        pass
    return _DEF_NAME


async def _summ_transcript(con, scope: str) -> str:
    """The call's turns from the spine (world lane), oldest→newest, speaker-attributed. Capped."""
    import json as _json
    rows = await con.fetch(
        "select ts, type, payload from event where scope=$1::ltree and lane='world' "
        "and type in ('utterance','message','msg.sent') "
        "and ts >= now() - ($2 || ' minutes')::interval order by ts desc limit $3",
        scope, str(_SUM_WINDOW_MIN), _SUM_MAX_TURNS)
    lines: list[str] = []
    for r in reversed(rows):
        pld = r["payload"] or {}
        if isinstance(pld, str):
            try:
                pld = _json.loads(pld)
            except Exception:
                pld = {}
        txt = (pld.get("text") or "").strip()
        if not txt:
            continue
        who = "Cliente" if r["type"] in ("utterance", "message") else "Yo"
        lines.append(f"{who}: {txt[:240]}")
    return "\n".join(lines)


async def call_transcript(scope: str, *, inbound_only: bool = True) -> str:
    """The just-ended call as text, for the ORDER EXTRACTOR.

    `inbound_only` defaults True and is the load-bearing part. `_summ_transcript` is
    speaker-attributed and includes `msg.sent` — Rocoto's own turns. A summariser wants both sides;
    an order extractor must never see Rocoto's, or the assistant reading a draft back («entonces
    cuatro cajas de tomate rama…») becomes a fresh order line on the next pass, and a call where
    Rocoto merely repeated the customer produces double quantities.

    Fail-soft to "" — a call that cannot be read is a call that files no order, never a crash on the
    hangup path."""
    try:
        async with supa.scoped_tx(scope) as con:
            rows = await con.fetch(
                "select ts, type, payload from event where scope=$1::ltree and lane='world' "
                "and type in ('utterance','message'" + ("" if inbound_only else ",'msg.sent'") + ") "
                "and ts >= now() - ($2 || ' minutes')::interval order by ts desc limit $3",
                scope, str(_SUM_WINDOW_MIN), _SUM_MAX_TURNS)
    except Exception:
        log.debug("postcall.call_transcript read fail-soft for %s", scope, exc_info=True)
        return ""
    import json as _json
    out: list[str] = []
    for r in reversed(rows):
        pld = r["payload"] or {}
        if isinstance(pld, str):
            try:
                pld = _json.loads(pld)
            except Exception:
                pld = {}
        txt = (pld.get("text") or pld.get("utterance") or "").strip()
        if txt:
            out.append(txt)
    return "\n".join(out).strip()


async def summarize(scope: str) -> dict:
    """Distil the just-ended call into {name, summary, next_step, promise?}. Always returns non-empty
    name/summary/next_step (defaults on any gap). `promise` is present ONLY when perception judged a
    concrete follow-up commitment was made — its presence is what makes the call-end path emit
    call.promise (→ the follow_up duty). Fail-soft throughout."""
    import json as _json
    out = {"name": _DEF_NAME, "summary": _DEF_SUMMARY, "next_step": _DEF_NEXT}
    try:
        async with supa.scoped_tx(scope) as con:
            out["name"] = await _summ_party_name(con, scope)
            transcript = await _summ_transcript(con, scope)
    except Exception:
        log.debug("postcall.summarize read fail-soft for %s", scope, exc_info=True)
        return out

    if not transcript or not getattr(config, "ANTHROPIC_API_KEY", ""):
        return out
    try:
        import anthropic
        client = anthropic.AsyncAnthropic(api_key=config.ANTHROPIC_API_KEY, max_retries=1, timeout=20.0)
        sysp = (
            "Acabas de COLGAR una llamada (tú eres 'Yo', el empleado). A partir de la transcripción, "
            "produce un PARTE breve para el jefe. Responde SOLO JSON: "
            '{"summary": "qué ha pasado, 1 frase", "next_step": "qué harás a continuación, 1 frase", '
            '"promise": "SOLO si quedaste en hacer algo concreto de seguimiento (mandar catálogo, '
            'confirmar precio, llamar mañana…) en pocas palabras; si no hay, OMITE la clave"}')
        resp = await client.messages.create(
            model=config.VOICE_CHAT_MODEL, max_tokens=260, system=sysp,
            messages=[{"role": "user", "content": transcript[:4000]}])
        txt = "".join(getattr(b, "text", "") for b in resp.content if getattr(b, "type", None) == "text")
        await client.close()
        d = _json.loads(txt[txt.find("{"):txt.rfind("}") + 1])
        if (d.get("summary") or "").strip():
            out["summary"] = d["summary"].strip()
        if (d.get("next_step") or "").strip():
            out["next_step"] = d["next_step"].strip()
        promise = (d.get("promise") or "").strip()
        if promise:
            out["promise"] = promise
    except Exception:
        log.debug("postcall.summarize LLM fail-soft for %s", scope, exc_info=True)
    return out
