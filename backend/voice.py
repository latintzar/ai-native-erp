"""Twilio Voice TwiML + the Deepgram live-transcription socket.

`incoming_twiml` is how every answered call reaches THE ONE MIND (B3, 2026-07-26): a bidirectional
`<Connect><Stream>` into the EL relay. The old "OFF / default path" — a Polly greeting plus a one-way
Deepgram fork, i.e. Rocoto's voice with nobody home — is deleted; see `incoming_twiml`.

`CallSession` below pipes a μ-law fork into a Deepgram streaming socket (nova-3, multi-lingual,
diarized) and appends each final result to a `call_transcript` message — the operator-spectating rig.

Two extra capabilities layer on without changing that behaviour:
  • a `calls` lifecycle row so the app can show "call in progress" + spectate;
  • a Hermes-style 2-channel post-call pass: Twilio also records the call dual-channel
    (caller = channel 0, Rocoto/operator = channel 1) and we re-transcribe it with
    Deepgram `multichannel=true` for a cleanly-separated final card (postcall.py).
"""
from __future__ import annotations

import asyncio
import json
import logging
import uuid
from typing import Optional

import config
import db as supa
import transcribe as tx
import twilio_wa as twa

log = logging.getLogger("rocoto.voice")

# `mip_opt_out=true` OPTS THIS STREAM OUT OF DEEPGRAM'S MODEL IMPROVEMENT PROGRAM, and it belongs on
# every call. Their ToS §3.2 otherwise takes an "irrevocable, perpetual" licence over the audio
# "including training and testing our Models", and §3.3 makes the opt-out per-request. The sentence it
# keeps true is published in four places: /terminos §17, /dpa §13, empresa.html and datos-seguridad.html.
DG_STREAM_URL = (
    "wss://api.deepgram.com/v1/listen"
    "?model=nova-3&language=multi&encoding=mulaw&sample_rate=8000&channels=1"
    "&punctuate=true&smart_format=true&diarize=true&interim_results=true&endpointing=300"
    "&mip_opt_out=true"
)


def listening_twiml(*, stream_wss_url: str, caller: str, recording_cb: str = "") -> str:
    """TwiML for the DEFAULT posture: Rocoto listens, and does not speak.

    THE BUG THIS EXISTS TO CLOSE (found 2026-08-18, live on prod). `behaviour["calls"]` has three
    positions — listen | after_hours | always — and «listen» is the default and means «a person
    answers; Rocoto only hears it». But nothing ever gated ANSWERING on that setting: the only
    reader of the posture chose whether to PREPEND the AI-disclosure sentence to the opener. So in
    the default posture Rocoto answered, spoke and held a conversation while omitting the one
    sentence that says it is a machine — worse than either state the switch offers, and an EU AI Act
    Art. 50(1) exposure on every call (Art. 99(4)(g): up to €15M or 3% of turnover).

    Answering silently is not an option either: under a call-forward there is nothing behind us, so
    a call we do not answer dies on a carrier tone. So «listen» answers the way an answering machine
    answers — a beep, then it records. A beep makes no statement about who or what is listening, and
    Art. 50(1) attaches to a system that INTERACTS with a person; a recorder does not. The
    distributor's own recorded greeting replaces the bare beep once per-tenant audio exists, which is
    strictly better and still not an AI speaking.

    The audio still reaches the mind — the one-way fork feeds Deepgram exactly as before, so Rocoto
    hears the order, remembers it and acts on it. It simply never opens its mouth."""
    rec_attrs = ""
    if recording_cb:
        rec_attrs = (
            f' recordingStatusCallback="{recording_cb}"'
            ' recordingStatusCallbackMethod="POST"'
            ' recordingStatusCallbackEvent="completed"'
        )
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        "<Response>"
        # The one-way fork: Rocoto hears everything. <Start> does not block the verbs after it.
        f'<Start><Stream url="{stream_wss_url}">'
        f'<Parameter name="from" value="{caller}"/>'
        "</Stream></Start>"
        # The beep IS the greeting until the tenant records their own. No synthetic voice.
        f'<Record maxLength="300" timeout="6" playBeep="true" trim="do-not-trim"{rec_attrs}/>'
        "</Response>"
    )


def incoming_twiml(caller: str, *, eleven_wss_url: str, recording_cb: str = "") -> str:
    """TwiML for a voice call we answer (inbound OR the outbound leg once the callee picks up).

    Bridges the call to THE ONE MIND — a bidirectional `<Connect><Stream>` into our EL-relay
    WebSocket, where `app.voice_eleven_stream` hands `ElevenBridge` our runtime agent id. We still
    record dual-channel so the final card gets the Hermes-style 2-channel treatment.

    B3 (2026-07-26): the `eleven=False` branch — a Polly «Hola, soy Rocoto. Dime tu pedido después del
    tono» greeting plus a one-way Deepgram fork — is **DELETED**. It answered in Rocoto's name with no
    mind behind it, which is the 2026-07-26 incident's disease one layer down: an outage that sounds
    merely mediocre. A call this box cannot serve with its own mind now fails loudly at the route
    (`app._VOICE_MIND_FAIL_TWIML`) instead of being greeted by a second voice. The live-transcription
    machinery below (`CallSession`, the `/twilio/voice/stream` socket) is retained for operator
    spectating; nothing points Twilio at it any more.
    """
    rec_attrs = ""
    if recording_cb:
        # Dual-channel call recording → Hermes-style post-call diarization.
        rec_attrs = (
            ' record="record-from-answer-dual"'
            f' recordingStatusCallback="{recording_cb}"'
            ' recordingStatusCallbackMethod="POST"'
            ' recordingStatusCallbackEvent="completed"'
        )
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        "<Response>"
        f"<Connect{rec_attrs}>"
        f'<Stream url="{eleven_wss_url}">'
        f'<Parameter name="from" value="{caller}"/>'
        "</Stream>"
        "</Connect>"
        "</Response>"
    )


class CallSession:
    """One live call: owns the Deepgram socket, the growing transcript, and the DB row."""

    def __init__(self) -> None:
        self.caller: str = ""
        self.msg_id: str = ""
        self.call_sid: str = ""
        self.utterances: list[dict] = []
        self.lines: list[str] = []
        self.subtitle: str = ""
        self._dg = None
        self._dg_task: Optional[asyncio.Task] = None
        self._lock = asyncio.Lock()

    async def start(self, caller: str, call_sid: str = "") -> None:
        self.caller = (caller or "").replace("whatsapp:", "").strip() or "unknown"
        self.call_sid = (call_sid or "").strip()
        self.msg_id = str(uuid.uuid4())
        await supa.insert_message({
            "id": self.msg_id, "phone_number": self.caller, "role": "user",
            "message_type": "call_transcript", "message_text": "",
            "transcript": "", "transcript_status": "pending",
            # Stash the call sid so the dual-channel recording webhook can find this row.
            "transcript_meta": {"live": True, "utterances": [], "channel": "live",
                                "call_sid": self.call_sid},
            "created_at": supa.now_iso(),
        })
        # Live (default) calls are not spectate-able as an EL stream, but the app still
        # shows them as "call in progress" via the calls lifecycle row.
        try:
            await supa.call_start(self.msg_id, self.caller, mode="live",
                                  spectatable=False, call_sid=self.call_sid)
        except Exception:
            log.exception("call %s: call_start failed (non-fatal)", self.msg_id)
        # Hermes-style 2-channel post-call pass: <Start><Stream> can't carry `record`, so
        # kick a dual-channel REST recording on this call. Best-effort — failure just means
        # the final card keeps the live (single-channel diarized) transcript.
        if config.VOICE_POSTCALL_DIARIZE and self.call_sid:
            cb = f"{config.PUBLIC_BASE_URL}/twilio/voice/recording"
            try:
                rec_sid = await twa.start_dual_recording(self.call_sid, status_callback=cb)
                if rec_sid:
                    await supa.call_update(self.msg_id, {"recording_sid": rec_sid})
                    log.info("call %s: dual-channel recording started (%s)", self.msg_id, rec_sid)
            except Exception:
                log.exception("call %s: start dual recording failed (non-fatal)", self.msg_id)
        await self._open_deepgram()

    async def _open_deepgram(self) -> None:
        try:
            import websockets
            self._dg = await websockets.connect(
                DG_STREAM_URL,
                additional_headers={"Authorization": f"Token {config.DEEPGRAM_API_KEY}"},
                max_size=None,
                ping_interval=5,
            )
            self._dg_task = asyncio.create_task(self._read_deepgram())
            log.info("call %s: deepgram socket open", self.msg_id)
        except TypeError:
            # Older websockets uses extra_headers=.
            import websockets
            self._dg = await websockets.connect(
                DG_STREAM_URL,
                extra_headers={"Authorization": f"Token {config.DEEPGRAM_API_KEY}"},
                max_size=None,
                ping_interval=5,
            )
            self._dg_task = asyncio.create_task(self._read_deepgram())
        except Exception:
            log.exception("call %s: failed to open deepgram", self.msg_id)
            self._dg = None

    async def feed(self, mulaw_bytes: bytes) -> None:
        if self._dg is not None:
            try:
                await self._dg.send(mulaw_bytes)
            except Exception:
                log.exception("call %s: deepgram send failed", self.msg_id)

    async def _read_deepgram(self) -> None:
        try:
            async for raw in self._dg:
                try:
                    data = json.loads(raw)
                except Exception:
                    continue
                if data.get("type") != "Results":
                    continue
                alt = (data.get("channel", {}).get("alternatives") or [{}])[0]
                text = (alt.get("transcript") or "").strip()
                if not text:
                    continue
                if not data.get("is_final"):
                    # Interim → live subtitle (the line currently being spoken).
                    self.subtitle = text
                    await self._persist_subtitle()
                    continue
                words = alt.get("words") or []
                speaker = int(words[0].get("speaker", 0)) if words else 0
                start = words[0].get("start") if words else None
                end = words[-1].get("end") if words else None
                self.utterances.append({"speaker": speaker, "text": text, "start": start, "end": end})
                self.lines.append(f"Speaker {speaker}: {text}")
                self.subtitle = ""
                await self._persist_live()
        except Exception:
            log.info("call %s: deepgram read loop ended", self.msg_id)

    async def _persist_subtitle(self) -> None:
        try:
            await supa.call_set_lines(self.msg_id, self.utterances, self.subtitle)
        except Exception:
            pass

    async def _persist_live(self) -> None:
        async with self._lock:
            await supa.update_message(self.msg_id, {
                "transcript": "\n".join(self.lines),
                "transcript_meta": {"live": True, "utterances": self.utterances, "channel": "live",
                                    "call_sid": self.call_sid,
                                    "num_speakers": len({u["speaker"] for u in self.utterances})},
            })
            try:
                await supa.call_set_lines(self.msg_id, self.utterances, self.subtitle)
            except Exception:
                pass

    async def finish(self) -> None:
        # Close Deepgram and let the read loop drain.
        if self._dg is not None:
            try:
                await self._dg.send(json.dumps({"type": "CloseStream"}))
            except Exception:
                pass
            try:
                await asyncio.wait_for(self._dg_task, timeout=4) if self._dg_task else None
            except Exception:
                pass
            try:
                await self._dg.close()
            except Exception:
                pass
        raw = "\n".join(self.lines)
        # If the 2-channel post-call pass already landed (rare race: recording callback beat the
        # websocket 'stop'), it produced the strictly-better card — don't clobber it. Just close
        # the lifecycle row.
        try:
            cur = await supa.get_message(self.msg_id)
        except Exception:
            cur = None
        if cur and (cur.get("transcript_meta") or {}).get("channel") == "dual":
            try:
                await supa.call_end(self.msg_id)
            except Exception:
                pass
            log.info("call %s: 2-channel card already present; finish kept it", self.msg_id)
            return
        polished = await asyncio.to_thread(tx.polish_sync, raw) if raw else ""
        # Always finalize to 'done' with the live (single-channel diarized) transcript so the
        # card never spins forever. If a dual-channel recording is in flight, postcall.py will
        # UPGRADE this transcript non-destructively when it arrives (status stays 'done').
        awaiting_postcall = bool(config.VOICE_POSTCALL_DIARIZE and self.call_sid)
        await supa.update_message(self.msg_id, {
            "transcript": polished or raw or "(no speech captured)",
            "transcript_status": "done",
            "transcript_meta": {"live": False, "utterances": self.utterances, "channel": "live",
                                "call_sid": self.call_sid,
                                "awaiting_postcall": awaiting_postcall,
                                "raw": raw, "num_speakers": len({u["speaker"] for u in self.utterances})},
        })
        try:
            await supa.call_end(self.msg_id)
        except Exception:
            pass
        log.info("call %s: finalized done (%d turns)%s", self.msg_id, len(self.utterances),
                 " — 2-channel upgrade may follow" if awaiting_postcall else "")
