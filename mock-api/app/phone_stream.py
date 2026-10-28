"""Authenticated two-track Twilio audio to independently timestamped Deepgram streams."""

from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import json
from contextlib import AsyncExitStack, suppress
from urllib.parse import urlencode

from fastapi import WebSocket
from websockets.asyncio.client import connect as WebSocketConnect

from . import phone_runtime as phone
from . import twilio_voice
from .config import settings
from .phone_store import append_intake

_ACTIVE: set[tuple[str, str]] = set()


class connect(WebSocketConnect):
    def process_redirect(self, exc: Exception) -> Exception:
        return exc


class TrackClock:
    """Fill transport gaps with mu-law silence; overlapping retransmissions have one effect."""

    def __init__(self):
        self.cursor = 0

    def media(self, timestamp: int, payload: bytes) -> bytes:
        position = timestamp * 8
        if timestamp < 0 or timestamp > 1_800_000 or len(payload) > 8192:
            raise ValueError("media_bounds")
        if position > self.cursor + 240_000:
            raise ValueError("media_gap")
        overlap = max(0, self.cursor - position)
        if overlap >= len(payload):
            return b""
        result = b"\xff" * max(0, position - self.cursor) + payload[overlap:]
        self.cursor = max(self.cursor, position + len(payload))
        return result


def update_transcript(workspace: str, sid: str, track: str, event: dict) -> None:
    if event.get("type") != "Results":
        return
    alternatives = event.get("channel", {}).get("alternatives", [])
    if not alternatives:
        return
    text = alternatives[0].get("transcript", "").strip()
    if not text:
        return
    start, duration = float(event.get("start", 0)), float(event.get("duration", 0))
    if not 0 <= start <= 1800 or not 0 <= duration <= 1800 or len(text) > 12000:
        return
    key = hashlib.sha256(f"{track}:{start:.3f}".encode()).hexdigest()[:24]
    final = event.get("is_final") is True

    def update(state: dict) -> None:
        row = state["calls"][sid]
        if row.get("transcript") or row.get("deletedAt") or row.get("transcriptRemovedAt"):
            return
        utterances = row["liveTranscript"]["utterances"]
        existing = next((item for item in utterances if item["id"] == key), None)
        if existing and existing["final"]:
            return
        speaker = 0 if (track == "inbound") == (row["direction"] == "outbound") else 1
        utterances[:] = [
            item
            for item in utterances
            if item["id"] != key
            and not (
                final
                and not item["final"]
                and item["track"] == track
                and start <= item["start"] <= start + duration
            )
        ]
        utterances.append(
            {
                "id": key,
                "track": track,
                "speaker": speaker,
                "start": start,
                "end": start + duration,
                "text": text,
                "final": final,
            }
        )
        utterances.sort(key=lambda item: (item["start"], item["track"]))
        if len(utterances) > 2000:
            raise ValueError("transcript_capacity")
        if final:
            append_intake(row, "final_delta", [item for item in utterances if item["id"] == key])

    phone.db().change(workspace, update)


async def media(websocket: WebSocket) -> None:
    signature = websocket.headers.get("x-twilio-signature", "")
    url = phone.public("/twilio/media")
    if not any(
        twilio_voice.validate(candidate, {}, signature)
        for candidate in (url, url.replace("https://", "wss://", 1))
    ):
        await websocket.close(code=1008)
        return
    await websocket.accept()
    workspace, sid = "", ""
    claimed = False
    tasks = []
    try:
        start = None
        for _ in range(2):
            event = await asyncio.wait_for(websocket.receive_json(), timeout=10)
            if event.get("event") == "start":
                start = event["start"]
                break
        if not start or start.get("accountSid") != settings.twilio_account_sid:
            raise ValueError("stream_start")
        workspace = start.get("customParameters", {}).get("workspace", "")
        state = phone.db().read(workspace)
        sid = start.get("callSid", "")
        row = state["calls"].get(sid)
        supplied = start.get("customParameters", {}).get("token", "")
        if not row or not row.get("stream_token") or not hmac.compare_digest(supplied, row["stream_token"]):
            raise ValueError("stream_binding")
        line = phone.selected_line(state, row.get("lineId"))
        conn = phone.connection(state, line["id"])
        if (
            line["setup"]["recording"] != "notice"
            or not line["setup"]["live_transcription"]
            or not conn["recording_policy_approved"]
            or not settings.deepgram_key
        ):
            raise ValueError("stream_permission")
        if start.get("mediaFormat") != {"encoding": "audio/x-mulaw", "sampleRate": 8000, "channels": 1}:
            raise ValueError("stream_format")
        if (workspace, sid) in _ACTIVE or len(_ACTIVE) >= 3:
            raise ValueError("stream_capacity")
        _ACTIVE.add((workspace, sid))
        claimed = True
        params = urlencode(
            {
                "model": "nova-3",
                "language": "es",
                "encoding": "mulaw",
                "sample_rate": 8000,
                "interim_results": "true",
                "punctuate": "true",
                "mip_opt_out": "true",
            }
        )
        host = "api.eu.deepgram.com" if conn["deepgram_region"] == "eu" else "api.deepgram.com"
        async with AsyncExitStack() as stack:
            streams = {}
            for track in ("inbound", "outbound"):
                streams[track] = await stack.enter_async_context(
                    connect(
                        f"wss://{host}/v1/listen?{params}",
                        additional_headers={"Authorization": "Token " + settings.deepgram_key},
                        max_size=262144,
                        open_timeout=15,
                        close_timeout=3,
                    )
                )

                async def read(channel=track):
                    async for message in streams[channel]:
                        update_transcript(workspace, sid, channel, json.loads(message))

                tasks.append(asyncio.create_task(read()))
            clocks = {track: TrackClock() for track in streams}
            while True:
                event = await asyncio.wait_for(websocket.receive_json(), timeout=45)
                if event.get("event") == "stop":
                    break
                if event.get("event") != "media":
                    continue
                frame = event.get("media", {})
                track = frame.get("track")
                if track not in streams or event.get("streamSid") != start.get("streamSid"):
                    raise ValueError("stream_mismatch")
                payload = base64.b64decode(frame.get("payload", ""), validate=True)
                audio = clocks[track].media(int(frame.get("timestamp", -1)), payload)
                if audio:
                    await streams[track].send(audio)
            for stream in streams.values():
                await stream.send(json.dumps({"type": "Finalize"}))
            await asyncio.sleep(0.2)
            for stream in streams.values():
                await stream.send(json.dumps({"type": "CloseStream"}))
            with suppress(TimeoutError):
                await asyncio.wait_for(asyncio.gather(*tasks), timeout=3)
    except Exception:
        if claimed and phone.db().read(workspace)["calls"].get(sid):
            phone.db().change(
                workspace,
                lambda s: s["calls"][sid].update(
                    liveTranscriptError="Live transcript interrupted; saved transcript follows recording."
                ),
            )
    finally:
        if claimed:
            _ACTIVE.discard((workspace, sid))
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        with suppress(RuntimeError):
            await websocket.close()
