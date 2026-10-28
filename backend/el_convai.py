"""ElevenLabs ConvAI — the VOICE side of "customize your agent".

A real voice conversation: the app opens a ConvAI session (mic in, agent voice out) with a dedicated
**customize agent** we create once via the ElevenLabs API and cache. The Android WebView runs the
ConvAI client SDK + our orb, pulsing the orb off the live audio. This module mints the session: it
ensures the agent exists and returns a short-lived **signed URL** the client connects with.
"""
from __future__ import annotations

import asyncio
import os

import httpx

import config

EL_BASE = "https://api.elevenlabs.io/v1"
_AGENT_CACHE_FILE = os.path.join(os.path.dirname(config.MEDIA_DIR) or "/opt/sancho", "customize_agent_id.txt")
_agent_id: str | None = None
_lock = asyncio.Lock()

FIRST_MESSAGE = "Hey — can you hear me okay? Tell me what you'd like this agent to do for your business, and I'll set it up."

PROMPT = (
    "You are the VOICE setup assistant for Rocoto — an app of AI employees for a small Spanish "
    "food producer-distributor (orders, cash flow, deliveries, growth, operations). The owner is on a "
    "quick phone-style call to tell you how they want one of these employees set up. Talk like a sharp, "
    "warm colleague — short, concrete sentences; a little Spanish is welcome. "
    "YOUR JOB is to quickly UNDERSTAND THEIR BUSINESS — their products, their team and who does what, their "
    "customers and how they order — and tailor yourself and the screens you build to fit THEM specifically. "
    "Ask at most a couple of sharp questions. "
    "AS SOON AS you can picture a concrete screen they'd want, CALL THE `build_ui` TOOL with a one-line "
    "spec of it, and SAY out loud 'Let me show you what that looks like…' — a live preview appears in "
    "front of them while you keep talking, so react to it together and refine it by voice (call build_ui "
    "again with an updated spec if they want changes). "
    "When they're happy, read the final setup back in ONE sentence, then say almost exactly: 'Perfect — "
    "I've got it. Close this and I'll set it all up for you.' Keep the call SNAPPY. Don't promise "
    "integrations that don't exist. After the wrap-up line, stop; the app takes it from there."
)


def _headers() -> dict:
    return {"xi-api-key": config.ELEVENLABS_API_KEY}


# The agent can call this on the device → the app builds a live HTML preview (Opus) and shows it in
# the call window while the conversation continues (Peter's live co-design moment).
BUILD_UI_TOOL = {
    "type": "client",
    "name": "build_ui",
    "description": "Show the owner a LIVE in-call preview of the screen/feature they're describing. "
                   "Call this as soon as you can picture a concrete UI; call it again to refine.",
    "expects_response": False,
    "parameters": {
        "type": "object",
        "properties": {
            "spec": {
                "type": "string",
                "description": "One concrete sentence describing the screen to build, e.g. 'a weekly "
                               "cash forecast with the payroll date flagged' or 'a cleaning rota for 5 areas'.",
            },
        },
        "required": ["spec"],
    },
}


async def _create_agent() -> str:
    body = {
        "name": "Rocoto — customize agent (voice)",
        "conversation_config": {
            # The SAME voice as the Rocoto auto-answer call line (Peter) — match its TTS settings too.
            "tts": {"voice_id": "GojDwihhnL1f7RrBuXsJ", "model_id": "eleven_turbo_v2", "stability": 0.45, "similarity_boost": 0.8},
            "agent": {
                "first_message": FIRST_MESSAGE,
                "language": "en",
                "prompt": {"prompt": PROMPT, "tools": [BUILD_UI_TOOL]},
            },
        },
    }
    async with httpx.AsyncClient(timeout=40) as c:
        r = await c.post(f"{EL_BASE}/convai/agents/create", headers=_headers(), json=body)
        r.raise_for_status()
        return r.json()["agent_id"]


async def token(agent_id: str) -> str:
    """Mint a short-lived conversation token (for the native Android SDK)."""
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.get(
            f"{EL_BASE}/convai/conversation/token",
            params={"agent_id": agent_id}, headers=_headers(),
        )
        r.raise_for_status()
        return r.json()["token"]


async def ensure_agent() -> str:
    """Get-or-create the customize ConvAI agent; cache the id to disk so we only create it once."""
    global _agent_id
    if _agent_id:
        return _agent_id
    async with _lock:
        if _agent_id:
            return _agent_id
        try:
            if os.path.exists(_AGENT_CACHE_FILE):
                cached = open(_AGENT_CACHE_FILE).read().strip()
                if cached:
                    _agent_id = cached
                    return _agent_id
        except Exception:
            pass
        _agent_id = await _create_agent()
        try:
            os.makedirs(os.path.dirname(_AGENT_CACHE_FILE), exist_ok=True)
            with open(_AGENT_CACHE_FILE, "w") as f:
                f.write(_agent_id)
        except Exception:
            pass
        return _agent_id


async def signed_url(agent_id: str) -> str:
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.get(
            f"{EL_BASE}/convai/conversation/get-signed-url",
            params={"agent_id": agent_id}, headers=_headers(),
        )
        r.raise_for_status()
        return r.json()["signed_url"]


async def session() -> dict:
    """Returns {signed_url, token, agent_id} for a fresh voice session (or {error} if EL isn't set up).
    `token` feeds the native Android SDK; `signed_url` is kept for the JS path."""
    if not config.ELEVENLABS_API_KEY:
        return {"error": "ElevenLabs API key not configured on the server."}
    aid = await ensure_agent()
    out = {"agent_id": aid}
    try:
        out["token"] = await token(aid)
    except Exception:
        pass
    try:
        out["signed_url"] = await signed_url(aid)
    except Exception:
        pass
    if not out.get("token") and not out.get("signed_url"):
        return {"error": "Couldn't mint a voice session right now."}
    return out
