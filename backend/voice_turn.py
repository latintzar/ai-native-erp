"""Native voice mode — one low-latency spoken turn.

The Android app records a short utterance and POSTs it here; we run mic → **Deepgram STT** → **fast LLM
turn** (Haiku) → **ElevenLabs TTS** and return the user's text, the agent's reply + chips, and the reply
as mp3 (base64) to play. This is the written chat, spoken — same agent, same history — so closing voice
leaves the whole exchange already in the chat (Peter's native low-latency idea).
"""
from __future__ import annotations

import base64

import httpx

import agent_chat
import config
import transcribe


async def tts_mp3(text: str) -> bytes:
    """ElevenLabs TTS → mp3 bytes, using the low-latency flash model."""
    voice = config.ELEVENLABS_TTS_VOICE
    async with httpx.AsyncClient(timeout=40) as c:
        r = await c.post(
            f"https://api.elevenlabs.io/v1/text-to-speech/{voice}",
            headers={"xi-api-key": config.ELEVENLABS_API_KEY, "accept": "audio/mpeg", "content-type": "application/json"},
            params={"output_format": "mp3_44100_128"},
            json={
                "text": text,
                "model_id": "eleven_flash_v2_5",
                "voice_settings": {"stability": 0.4, "similarity_boost": 0.75},
            },
        )
        r.raise_for_status()
        return r.content


async def turn(agent: str, audio: bytes, content_type: str, history: list[dict]) -> dict:
    """One spoken turn. Returns {user_text, reply, chips, audio_b64}."""
    if not config.ELEVENLABS_API_KEY:
        return {"user_text": "", "reply": "", "chips": [], "audio_b64": "", "error": "voice not configured"}
    # STT.
    try:
        dg = await transcribe.deepgram_diarize(audio, content_type or "audio/mp4")
        user_text, _ = transcribe.parse_utterances(dg)
        user_text = (user_text or "").strip()
    except Exception:
        user_text = ""
    if not user_text:
        return {"user_text": "", "reply": "", "chips": [], "audio_b64": ""}

    # Fast LLM turn (shares the chat's history + agent brief).
    msgs = list(history) + [{"role": "user", "content": user_text}]
    out = await agent_chat.chat(agent, msgs, model=config.VOICE_CHAT_MODEL, voice=True)
    reply = (out.get("reply") or "").strip()

    # TTS the reply.
    audio_b64 = ""
    if reply:
        try:
            audio_b64 = base64.b64encode(await tts_mp3(reply)).decode()
        except Exception:
            audio_b64 = ""
    return {"user_text": user_text, "reply": reply, "chips": out.get("chips", []), "audio_b64": audio_b64}
