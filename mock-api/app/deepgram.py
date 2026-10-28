"""DEEPGRAM NOVA-3, PORTED — audio becomes diarised Spanish (FEED-IA §196.6).

Peter: «and then the transcription too, with clear speaker diarisation. set to spanish of course.»

Ported from apps/call-recorder/product/backend/pipeline.py `_deepgram` and `_parse_deepgram`, with
one deliberate difference and it is Peter's line: Hermes defaults to `language=multi` because he
cold-calls in three languages; Rocoto's customers speak Spanish to their supplier, so **`es` is the
default here** and the kit's contract types it (`Transcript.language: 'es'`).

Three behaviours are kept exactly, because each one was learned the hard way in Hermes:

  · **ffmpeg → 16 kHz mono WAV first.** Deepgram accepts many containers; a browser's
    `MediaRecorder` webm/opus is one of them. Normalising anyway costs nothing and removes a whole
    class of «the provider read 0 seconds of audio» failures.
  · **Multichannel for a two-track call, diarize for one mixed track.** A Twilio dual recording
    gives channel 0 = us, channel 1 = them — perfect speaker identity for free, no heuristics. A
    phone's microphone gives one mixed track, and that is what `diarize=true` is for.
  · **Keyterms are best-effort and never fatal.** nova-3 keyterm prompting biases proper nouns
    (the business name from the Places lookup). If the provider rejects the parameter for a
    model/language pair, the call is retried WITHOUT it — «a call must never be lost over a
    transcription nicety».
"""
from __future__ import annotations

import asyncio
import logging
import shutil
import subprocess
import tempfile
import time
from pathlib import Path
from typing import Any

import httpx

from .config import settings
from .errors import RuntimeError_

logger = logging.getLogger("rocoto.runtime.deepgram")

TIMEOUT = 300.0


def to_wav(content: bytes, suffix: str = "") -> tuple[bytes, str]:
    """16 kHz mono PCM through ffmpeg. Returns the bytes and the content type to send."""
    if not shutil.which("ffmpeg"):
        return content, "application/octet-stream"
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / ("source" + (suffix or ""))
        out = Path(tmp) / "out.wav"
        src.write_bytes(content)
        result = subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-ar", "16000", "-ac", "1",
             "-c:a", "pcm_s16le", str(out)],
            capture_output=True,
        )
        if result.returncode != 0 or not out.exists() or out.stat().st_size < 44:
            logger.warning("ffmpeg could not normalise the audio; sending it as received")
            return content, "application/octet-stream"
        return out.read_bytes(), "audio/wav"


def to_wav_multichannel(content: bytes, suffix: str = "") -> tuple[bytes, str, bool]:
    """Keep TWO tracks when the source has two — a Twilio dual recording carries the speakers.

    Returns (bytes, content type, dual) so the caller knows which Deepgram mode to ask for.
    """
    if not shutil.which("ffmpeg"):
        return content, "application/octet-stream", False
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / ("source" + (suffix or ""))
        src.write_bytes(content)
        probe = subprocess.run(
            ["ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries", "stream=channels",
             "-of", "csv=p=0", str(src)], capture_output=True, text=True)
        channels = 0
        try:
            channels = int((probe.stdout or "0").strip().splitlines()[0])
        except Exception:
            channels = 0
        if channels < 2:
            wav, kind = to_wav(content, suffix)
            return wav, kind, False
        out = Path(tmp) / "out.wav"
        result = subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-ar", "16000", "-ac", "2",
             "-c:a", "pcm_s16le", str(out)], capture_output=True)
        if result.returncode != 0 or not out.exists():
            wav, kind = to_wav(content, suffix)
            return wav, kind, False
        return out.read_bytes(), "audio/wav", True


async def transcribe(content: bytes, *, language: str = "es", dual_channel: bool = False,
                     keyterms: list[str] | None = None, content_type: str = "audio/wav") -> dict[str, Any]:
    """One audio → the kit's `Transcript`."""
    if not settings.deepgram_key:
        raise RuntimeError_("deepgram_missing", "Deepgram is not configured on this runtime.", 503)
    if not content:
        raise RuntimeError_("empty_audio", "No audio was uploaded.", 400)

    params: list[tuple[str, str]] = [
        ("model", "nova-3"),
        ("language", language or "es"),
        ("punctuate", "true"),
        ("utterances", "true"),
        ("smart_format", "true"),
        ("paragraphs", "true"),
    ]
    params.append(("multichannel", "true") if dual_channel else ("diarize", "true"))
    extra = [("keyterm", k) for k in (keyterms or []) if k.strip()]

    headers = {"Authorization": f"Token {settings.deepgram_key}", "Content-Type": content_type}
    started = time.time()

    async def post(with_keyterms: list[tuple[str, str]]) -> httpx.Response:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            return await client.post(settings.deepgram_url, params=params + with_keyterms,
                                     headers=headers, content=content)

    response = await post(extra)
    if response.status_code >= 400 and extra:
        logger.warning("deepgram rejected the keyterms (%s) — retrying plain", response.status_code,
                       extra={"provider": "deepgram"})
        response = await post([])
    if response.status_code >= 400:
        raise RuntimeError_("deepgram_failed", f"Deepgram answered {response.status_code}.", 502)

    shaped = shape(response.json(), dual_channel=dual_channel, language=language or "es")
    logger.info("deepgram read", extra={"provider": "deepgram", "ms": int((time.time() - started) * 1000),
                                        "outcome": f"{len(shaped['utterances'])} utterances"})
    return shaped


async def transcribe_file(path: Path, **kwargs: Any) -> dict[str, Any]:
    content = await asyncio.to_thread(path.read_bytes)
    return await transcribe(content, **kwargs)


def shape(data: dict[str, Any], *, dual_channel: bool, language: str) -> dict[str, Any]:
    """pipeline.py `_parse_deepgram`, ported to the kit's `Transcript`.

    diarize mode → each utterance carries `speaker`; multichannel mode → it carries `channel`, and
    channel 0 is US (the leg the runtime dialled) while channel 1 is the counterpart. Sorting by
    start time makes an interleaved two-channel call read chronologically.
    """
    results = (data or {}).get("results", {}) or {}
    channels = results.get("channels") or []
    parts = []
    for channel in channels:
        text = ((channel.get("alternatives") or [{}])[0].get("transcript") or "").strip()
        if text:
            parts.append(text)
    full = " ".join(parts)

    utterances = []
    for utterance in results.get("utterances") or []:
        speaker = int(utterance.get("channel", 0) if dual_channel else utterance.get("speaker", 0))
        utterances.append({
            "speaker": speaker,
            "start": float(utterance.get("start", 0.0)),
            "end": float(utterance.get("end", 0.0)),
            "text": (utterance.get("transcript") or "").strip(),
        })
    utterances.sort(key=lambda u: u["start"])
    if not utterances and full:
        utterances = [{"speaker": 0, "start": 0.0, "end": 0.0, "text": full}]

    return {
        "transcript": full,
        "utterances": utterances,
        "language": language,
        "provider": "deepgram nova-3",
    }
