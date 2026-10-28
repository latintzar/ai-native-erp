"""Twilio Media Stream ↔ ElevenLabs Conversational AI bridge (the ON path).

Self-hosted relay (ElevenLabs' "custom" approach b2): Twilio answers an inbound call
with `<Connect><Stream url="wss://us/.../voice/eleven-stream">` (bidirectional), we open a
websocket to ElevenLabs' ConvAI endpoint and relay 8 kHz μ-law audio both ways. Both the
agent's ASR input and TTS output are configured as `ulaw_8000`, byte-compatible with Twilio
media frames, so we pass base64 payloads straight through with zero transcoding.

We additionally capture the live transcript from EL's `user_transcript` / `agent_response`
websocket events and persist it to the `call_transcript` message row + the `calls` lifecycle
row — so the operator sees live subtitles even on this path (Peter's requirement). On hangup
we run the same Sonnet post-pass the other transcript types use.

B3 (2026-07-26) — ONE MIND: this is the ONLY path a call takes, inbound or outbound, demo or customer,
and the agent it bridges to is always OUR runtime agent (`voice_toggle.runtime_agent_id()`). The
per-customer DB toggle and the Polly + Deepgram-live fallback no longer choose who answers: when our
mind is unavailable the call FAILS LOUD (app.py `_require_voice_mind`), it does not get a second voice.
"""
from __future__ import annotations

import asyncio
import base64
import json
import logging
import uuid
from typing import Optional

import httpx

try:
    import audioop  # stdlib in 3.12 (removed in 3.13); used to boost the agent's TTS volume
except Exception:  # pragma: no cover
    audioop = None

import config
import db as supa
import transcribe as tx

log = logging.getLogger("rocoto.eleven")


def _amplify_ulaw(payload: str) -> str:
    """Boost the agent's μ-law 8k TTS before it hits Twilio — ElevenLabs ConvAI output is quiet
    on a phone earpiece/speaker. Gain from config.DEMO_AUDIO_GAIN; audioop.mul clamps on overflow."""
    g = getattr(config, "DEMO_AUDIO_GAIN", 1.0) or 1.0
    if audioop is None or abs(g - 1.0) < 0.01:
        return payload
    try:
        pcm = audioop.ulaw2lin(base64.b64decode(payload), 2)
        pcm = audioop.mul(pcm, 2, g)
        return base64.b64encode(audioop.lin2ulaw(pcm, 2)).decode()
    except Exception:
        return payload

SIGNED_URL_ENDPOINT = "/v1/convai/conversation/get-signed-url"
DIRECT_WS = "/v1/convai/conversation"


def configured() -> bool:
    """True only when we can actually reach an agent (key present)."""
    return bool(config.ELEVENLABS_API_KEY and config.ELEVENLABS_AGENT_ID)


def demo_configured() -> bool:
    """True when a call can be placed AT ALL — i.e. THE ONE MIND (our runtime agent) is available.

    B3 (2026-07-26): there is no dedicated demo agent any more. A landing call and a customer call ride
    the SAME mind, so this gate is now honestly "is our mind alive?" — with it dead the demo reports
    itself OFF instead of answering in a second voice."""
    import voice_toggle
    return voice_toggle.available()


async def _signed_ws_url(agent_id: str) -> str:
    """Fetch a fresh signed wss URL for the agent (private-agent path). Falls back to the
    unsigned direct URL if the signed-url call fails (works for public agents).

    B3 (2026-07-26): `agent_id` is REQUIRED. It used to default to `config.ELEVENLABS_AGENT_ID` — a
    different, non-runtime agent — which is exactly the silent-second-mind shape the incident took."""
    aid = (agent_id or "").strip()
    if not aid:
        raise ValueError("no agent id for the EL socket — refusing to dial a non-runtime mind (B3)")
    base_http = config.ELEVENLABS_WS_BASE.replace("wss://", "https://").replace("ws://", "http://")
    direct = (
        f"{config.ELEVENLABS_WS_BASE}{DIRECT_WS}?agent_id={aid}"
    )
    if not config.ELEVENLABS_API_KEY:
        return direct
    try:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.get(
                f"{base_http}{SIGNED_URL_ENDPOINT}",
                params={"agent_id": aid},
                headers={"xi-api-key": config.ELEVENLABS_API_KEY},
            )
            r.raise_for_status()
            url = (r.json() or {}).get("signed_url") or ""
            return url or direct
    except Exception:
        log.exception("eleven: signed-url fetch failed; using direct url")
        return direct


class ElevenBridge:
    """One ON-path call: owns the EL websocket, relays audio to/from Twilio, and keeps the
    live transcript. Twilio frames come in via `on_twilio_event`; outbound audio + control
    frames go back through the `send_twilio` callback set by app.py."""

    def __init__(self, send_twilio, *, agent_id: str, on_event=None,
                 mode: str = "eleven", dynamic_vars: Optional[dict] = None,
                 config_override: Optional[dict] = None) -> None:
        # B3 (2026-07-26): `agent_id` is a REQUIRED keyword and must be OURS. There is no default and no
        # empty-string fallback — a bridge that cannot name its mind must not be constructible at all.
        if not (agent_id or "").strip():
            raise ValueError("ElevenBridge requires an explicit agent_id (B3: one mind, no fallback)")
        self.caller: str = ""
        self.msg_id: str = ""
        self.call_sid: str = ""
        self.stream_sid: str = ""
        self.send_twilio = send_twilio          # async fn(dict) → write JSON frame to Twilio WS
        self.lines: list[dict] = []             # finalized transcript turns
        self.subtitle: str = ""                 # in-progress agent line
        # Additive: the landing demo call reuses this bridge with a different agent + an on_event
        # fan-out to the browser SSE stream. All default to the existing customer-call behaviour.
        self.agent_id = agent_id                # ALWAYS the runtime mind (voice_toggle.runtime_agent_id())
        self.on_event = on_event                # optional callable(kind:str, payload:dict) fire-and-forget
        self.mode = mode                        # calls.mode ('eleven' | 'demo')
        self.dynamic_vars = dynamic_vars or {}  # merged into conversation_initiation_client_data
        self.config_override = config_override or {}  # conversation_config_override (lang/first_message)
        self._el = None
        self._el_task: Optional[asyncio.Task] = None
        self._lock = asyncio.Lock()
        self._took_over = False                 # operator joined → stop relaying agent audio
        self._started = False
        self._finishing = False                 # finish() in progress → expected EL close
        self.el_dropped = False                  # EL socket died mid-call → app ends the Twilio leg

    def _emit(self, kind: str, payload: dict) -> None:
        """Fire the on_event hook without ever letting a browser-stream error touch the call."""
        if not self.on_event:
            return
        try:
            self.on_event(kind, payload)
        except Exception:
            log.debug("call %s: on_event(%s) failed", self.msg_id, kind)

    # ── lifecycle ──────────────────────────────────────────────────────────────
    async def start(self, caller: str, stream_sid: str, call_sid: str) -> None:
        self.caller = (caller or "").replace("whatsapp:", "").strip() or "unknown"
        self.stream_sid = stream_sid
        self.call_sid = call_sid
        self.msg_id = str(uuid.uuid4())
        await supa.insert_message({
            "id": self.msg_id, "phone_number": self.caller, "role": "user",
            "message_type": "call_transcript", "message_text": "",
            "transcript": "", "transcript_status": "pending",
            "transcript_meta": {"live": True, "utterances": [], "channel": "elevenlabs",
                                "call_sid": self.call_sid},
            "created_at": supa.now_iso(),
        })
        # ON-path calls are spectate-able (the operator listens in, then can take over).
        await supa.call_start(self.msg_id, self.caller, mode=self.mode,
                              spectatable=True, call_sid=call_sid)
        await self._open_eleven()
        self._started = True

    async def _open_eleven(self) -> None:
        try:
            import websockets
            url = await _signed_ws_url(self.agent_id)
            try:
                self._el = await websockets.connect(url, max_size=None, ping_interval=None)
            except TypeError:
                self._el = await websockets.connect(url, max_size=None)
            # Initiation message — audio formats live on the agent (both ulaw_8000) so we send
            # the bare init; dynamic_variables carry the caller for the agent's context. The demo
            # path adds a conversation_config_override (per-call language + first message).
            init = {
                "type": "conversation_initiation_client_data",
                "dynamic_variables": {"caller_number": self.caller, "call_ref": self.call_sid,
                                      **self.dynamic_vars},
            }
            if self.config_override:
                init["conversation_config_override"] = self.config_override
            await self._el.send(json.dumps(init))
            self._el_task = asyncio.create_task(self._read_eleven())
            log.info("call %s: elevenlabs socket open", self.msg_id)
        except Exception:
            log.exception("call %s: failed to open elevenlabs", self.msg_id)
            self._el = None

    # ── Twilio → EL ──────────────────────────────────────────────────────────────
    async def on_twilio_event(self, data: dict) -> None:
        event = data.get("event")
        if event == "media":
            payload = data.get("media", {}).get("payload")
            if payload and self._el is not None:
                try:
                    await self._el.send(json.dumps({"user_audio_chunk": payload}))
                except Exception:
                    log.debug("call %s: el send failed", self.msg_id)
        elif event == "mark":
            pass

    # ── EL → Twilio ──────────────────────────────────────────────────────────────
    async def _read_eleven(self) -> None:
        try:
            async for raw in self._el:
                try:
                    msg = json.loads(raw)
                except Exception:
                    continue
                await self._handle_el(msg)
        except Exception:
            log.info("call %s: elevenlabs read loop ended", self.msg_id)
        finally:
            # The socket is dead — clear it so on_twilio_event stops firing failing sends at
            # ~50/s. If this wasn't an expected close (takeover / finish), signal app.py to end
            # the Twilio leg so the caller isn't left in permanent dead air.
            self._el = None
            if not self._took_over and not self._finishing:
                self.el_dropped = True
                log.warning("call %s: elevenlabs socket dropped mid-call; ending Twilio leg", self.msg_id)

    async def _handle_el(self, msg: dict) -> None:
        t = msg.get("type")
        if t == "ping":
            ev = msg.get("ping_event", {}) or {}
            try:
                await self._el.send(json.dumps({"type": "pong", "event_id": ev.get("event_id")}))
            except Exception:
                pass
        elif t == "audio":
            # Forward agent TTS to Twilio — unless the operator has taken over (then the
            # human is the voice; we stop piping the bot's audio to the caller).
            if self._took_over:
                return
            b64 = (msg.get("audio_event", {}) or {}).get("audio_base_64")
            if b64:
                await self._safe_twilio({"event": "media", "streamSid": self.stream_sid,
                                         "media": {"payload": _amplify_ulaw(b64)}})
        elif t == "interruption":
            # Caller barged in — flush Twilio's buffered playback so the bot stops talking over them.
            await self._safe_twilio({"event": "clear", "streamSid": self.stream_sid})
        elif t == "user_transcript":
            text = ((msg.get("user_transcription_event", {}) or {}).get("user_transcript") or "").strip()
            if text:
                self.lines.append({"speaker": 0, "text": text, "start": None, "end": None})
                self.subtitle = ""
                self._emit("line", {"speaker": "you", "text": text})
                await self._persist_live()
        elif t == "agent_response":
            text = ((msg.get("agent_response_event", {}) or {}).get("agent_response") or "").strip()
            if text:
                self.lines.append({"speaker": 1, "text": text, "start": None, "end": None})
                self.subtitle = ""
                self._emit("line", {"speaker": "agent", "text": text})
                await self._persist_live()
        elif t == "internal_tentative_agent_response":
            # In-progress agent line → the live centred subtitle (the spectate caption), matching
            # the OFF path's Deepgram interim behaviour so listen-in shows a live "speaking" line.
            ev = msg.get("tentative_agent_response_internal_event", {}) or {}
            tentative = (ev.get("tentative_agent_response") or "").strip()
            if tentative:
                self.subtitle = tentative
                self._emit("subtitle", {"speaker": "agent", "text": tentative})
                await self._persist_subtitle()
        elif t == "agent_response_correction":
            # The agent's last line was truncated after a barge-in — correct it in place.
            ev = msg.get("agent_response_correction_event", {}) or {}
            corrected = (ev.get("corrected_agent_response") or "").strip()
            if corrected:
                for turn in reversed(self.lines):
                    if turn["speaker"] == 1:
                        turn["text"] = corrected
                        break
                self._emit("line", {"speaker": "agent", "text": corrected, "correction": True})
                await self._persist_live()

    async def _safe_twilio(self, frame: dict) -> None:
        try:
            await self.send_twilio(frame)
        except Exception:
            log.debug("call %s: twilio send failed", self.msg_id)

    # ── take-over ────────────────────────────────────────────────────────────────
    async def takeover(self) -> None:
        """Operator joined: drop the EL agent's voice. The agent stops being relayed to the
        caller; we close the EL socket so it stops generating speech. (Operator audio path
        is the app's own WebRTC/PSTN leg — out of scope here; we cleanly hand the line over.)"""
        self._took_over = True
        await self._safe_twilio({"event": "clear", "streamSid": self.stream_sid})
        if self._el is not None:
            try:
                await self._el.send(json.dumps({"type": "conversation_end"}))
            except Exception:
                pass
            try:
                await self._el.close()
            except Exception:
                pass
        log.info("call %s: operator took over (EL agent dropped)", self.msg_id)

    async def _persist_subtitle(self) -> None:
        try:
            await supa.call_set_lines(self.msg_id, self.lines, self.subtitle)
        except Exception:
            pass

    async def _persist_live(self) -> None:
        async with self._lock:
            lines_txt = "\n".join(
                f"Speaker {t['speaker']}: {t['text']}" for t in self.lines if t["text"]
            )
            await supa.update_message(self.msg_id, {
                "transcript": lines_txt,
                "transcript_meta": {"live": True, "utterances": self.lines,
                                    "channel": "elevenlabs",
                                    "num_speakers": len({t["speaker"] for t in self.lines})},
            })
            try:
                await supa.call_set_lines(self.msg_id, self.lines, self.subtitle)
            except Exception:
                pass

    async def finish(self) -> None:
        if not self._started:
            return
        self._finishing = True
        # Tell the demo session the call is over so it can run its post-call pipeline (a demo
        # cares about the *end* moment; the customer path ignores this hook).
        self._emit("ended", {"lines": list(self.lines)})
        if self._el is not None:
            try:
                await self._el.close()
            except Exception:
                pass
        if self._el_task:
            try:
                await asyncio.wait_for(self._el_task, timeout=3)
            except Exception:
                pass
        raw = "\n".join(f"Speaker {t['speaker']}: {t['text']}" for t in self.lines if t["text"])
        polished = await asyncio.to_thread(tx.polish_sync, raw) if raw else ""
        await supa.update_message(self.msg_id, {
            "transcript": polished or raw or "(no speech captured)",
            "transcript_status": "done",
            "transcript_meta": {"live": False, "utterances": self.lines, "raw": raw,
                                "channel": "elevenlabs",
                                "num_speakers": len({t["speaker"] for t in self.lines})},
        })
        try:
            await supa.call_end(self.msg_id)
        except Exception:
            pass
        log.info("call %s: elevenlabs call finalized (%d turns)", self.msg_id, len(self.lines))
