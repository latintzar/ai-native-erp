"""voice_toggle.py — THE ONE VOICE MIND: our runtime agent, or nothing.

B3 (Peter's order, 2026-07-26): **the ConvAI fallback is DELETED.** The 2026-07-26 incident proved the
harm — with the mind dead, calls still answered, using the landing DEMO agent's greeting, so a hard
crash arrived disguised as mediocre behaviour and nobody was told. A second mind is worse than no call.

What survives is the REGISTRAR (the module keeps its historical filename): it ensures the ONE agent we
own exists — a Custom-LLM ConvAI agent whose brain is `/api/voice/chat/completions`, i.e. the SAME
event-sourced cycle as WhatsApp (SPEC §7) — caches its id on disk, and hands that id (and ONLY that id)
to the bridge. There is no mode file, no toggle link, no demo-agent id, no second brain to fall to.

LAW: `runtime_agent_id()` raises `NoVoiceMind` when our agent is not available. Every caller must FAIL
LOUD on that (explicit error + `ops.record_alert`) — never dial something else."""
from __future__ import annotations

import logging
import os
import re as _re_marker
from pathlib import Path

import httpx

import config

log = logging.getLogger("rocoto.voice_toggle")

EL_BASE = "https://api.elevenlabs.io/v1"
_STATE_DIR = Path(os.environ.get("ROCOTO_STATE_DIR", "/opt/rocoto"))
_RUNTIME_AGENT_FILE = _STATE_DIR / ".voice_runtime_agent"
# Process-local verification is deliberately re-established at boot. A cached provider ID alone
# does not prove that this agent carries the caller and call-reference isolation markers.
_marker_agent = ""
_marker_ready: bool | None = None
# The public base EL reaches our Custom-LLM at; EL appends '/chat/completions'.
VOICE_PUBLIC_BASE = config._env("ROCOTO_VOICE_PUBLIC_BASE", config.PUBLIC_BASE_URL)


class NoVoiceMind(RuntimeError):
    """Our runtime voice agent is not available. NEVER caught into a different agent (B3)."""


def _headers() -> dict:
    return {"xi-api-key": config.ELEVENLABS_API_KEY, "content-type": "application/json"}


def cached_runtime_agent() -> str:
    try:
        return _RUNTIME_AGENT_FILE.read_text().strip()
    except Exception:
        return ""


def available() -> bool:
    """True when the ONE mind can be dialled right now (key + our cached agent). Read-only, fast."""
    return bool(config.ELEVENLABS_API_KEY and cached_runtime_agent())


def caller_marker_status() -> str:
    """Read-only readiness for the currently cached agent: unverified, ready or failed."""
    if not _marker_agent or _marker_agent != cached_runtime_agent() or _marker_ready is None:
        return "unverified"
    return "ready" if _marker_ready else "failed"


def healthy() -> bool:
    """Registration plus a successful marker check for this exact runtime agent."""
    return available() and caller_marker_status() == "ready"


def runtime_agent_id() -> str:
    """The agent the bridge dials — OURS, or nothing (B3). Fast + read-only (call-start hot path).

    Raises NoVoiceMind rather than degrading: boot-warm (`ensure_runtime_agent`) is what makes this
    available, and if boot-warm did not happen the honest outcome is a failed call plus an alert."""
    aid = cached_runtime_agent()
    if not aid:
        raise NoVoiceMind("no runtime voice agent cached (boot-warm did not run or the state dir is unwritable)")
    if not config.ELEVENLABS_API_KEY:
        raise NoVoiceMind("ELEVENLABS_API_KEY not set")
    return aid


RUNTIME_AGENT_NAME = "Rocoto — demo (runtime brain / custom-LLM)"


async def _find_agent_by_name(name: str) -> str:
    """List EL agents and return the id of the one named `name` (reuse over re-create → no duplicates)."""
    try:
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.get(f"{EL_BASE}/convai/agents?page_size=100", headers=_headers())
            r.raise_for_status()
            for a in (r.json().get("agents") or []):
                if (a.get("name") or "") == name:
                    return a.get("agent_id") or ""
    except Exception:
        log.debug("list agents failed", exc_info=True)
    return ""


async def ensure_runtime_agent() -> str:
    """Ensure the Custom-LLM ConvAI agent (runtime brain) exists; return its id. Reuses a cached id, then
    an existing agent of the same name, and only creates as a last resort — so a non-writable state dir
    can never spawn duplicates. Caches the id when the state dir is writable.

    B3: the create path clones its voice/prompt shape from `ELEVENLABS_AGENT_ID` (the demo-agent id is
    gone). Creating from scratch is a disaster-recovery event, so it is logged loudly — the new agent's
    VOICE must be re-checked by ear before it takes a real call."""
    aid = cached_runtime_agent()
    if aid:
        return aid
    if not config.ELEVENLABS_API_KEY:
        raise NoVoiceMind("ELEVENLABS_API_KEY not set")
    existing = await _find_agent_by_name(RUNTIME_AGENT_NAME)
    if existing:
        _cache_agent(existing)
        return existing
    src_id = config.ELEVENLABS_AGENT_ID
    if not src_id:
        raise NoVoiceMind("ELEVENLABS_AGENT_ID not set — no template to build the runtime agent from")
    log.error("no runtime voice agent found — CREATING one from template %s; re-check its VOICE by ear", src_id)
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.get(f"{EL_BASE}/convai/agents/{src_id}", headers=_headers())
        r.raise_for_status()
        src = r.json()
    cc = src.get("conversation_config") or {}
    tts_src = cc.get("tts") or {}
    agent_src = cc.get("agent") or {}
    prompt_src = (agent_src.get("prompt") or {})
    body = {
        "name": RUNTIME_AGENT_NAME,
        "conversation_config": {
            "tts": {
                "voice_id": tts_src.get("voice_id"),
                "model_id": tts_src.get("model_id", "eleven_turbo_v2"),
                "stability": tts_src.get("stability", 0.45),
                "similarity_boost": tts_src.get("similarity_boost", 0.8),
                "agent_output_audio_format": "ulaw_8000",
            },
            "asr": {"user_input_audio_format": "ulaw_8000"},
            "conversation": {"max_duration_seconds": int(config.DEMO_MAX_SECONDS)},
            "agent": {
                "first_message": agent_src.get("first_message", ""),
                "language": "es",
                "prompt": {
                    "prompt": prompt_src.get("prompt", "Eres Rocoto."),
                    # THE FLIP: the brain is our runtime, reached as an OpenAI-compatible custom LLM.
                    "llm": "custom-llm",
                    "custom_llm": {
                        "url": f"{VOICE_PUBLIC_BASE}/api/voice",   # EL calls {url}/chat/completions
                        "model_id": "rocoto-runtime",
                        "request_headers": {},
                    },
                    "tools": [{"type": "system", "name": "end_call"}],
                },
            },
        },
        "platform_settings": {
            "overrides": {
                "conversation_config_override": {"agent": {"language": True, "first_message": True}}
            }
        },
    }
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.post(f"{EL_BASE}/convai/agents/create", headers=_headers(), json=body)
        if r.status_code >= 300:
            log.error("runtime agent create failed: %s %s", r.status_code, r.text[:600])
            r.raise_for_status()
        aid = r.json()["agent_id"]
    _cache_agent(aid)
    return aid


def _cache_agent(aid: str) -> None:
    try:
        _STATE_DIR.mkdir(parents=True, exist_ok=True)
        _RUNTIME_AGENT_FILE.write_text(aid)
    except Exception:
        log.warning("could not cache runtime agent id (state dir not writable?): %s", _RUNTIME_AGENT_FILE)


_MARKER_LINE = r"\n*IDENTIDAD DE LA LLAMADA[^\n]*"


async def ensure_caller_marker() -> bool:
    """Verify/install isolation markers and publish both failure and successful recovery to health."""
    global _marker_agent, _marker_ready
    _marker_agent, _marker_ready = cached_runtime_agent(), None
    try:
        ready = await _install_caller_marker()
    except Exception:
        log.exception("caller marker verification failed")
        ready = False
    _marker_agent, _marker_ready = cached_runtime_agent(), ready
    return ready


async def _install_caller_marker() -> bool:
    """Make sure the runtime agent's prompt carries the two machine markers EL substitutes per call:

        [[CALLER:{{caller_number}}]]  WHO is on the line
        [[CALL:{{call_ref}}]]         WHICH call this is

    The bridge always sends both dynamic variables, and this is how /api/voice/chat resolves the
    right party scope mid-call. The second one is not redundant: a caller who withholds their number
    has no identity to key on, and without the call reference every one of them resolves to the same
    scope and reads each other's conversation (see presence_call.scope_for). Idempotent — and an
    agent warmed with only the first marker is REWRITTEN, not left alone."""
    aid = cached_runtime_agent()
    if not aid:
        try:
            aid = await ensure_runtime_agent()
        except Exception:
            return False
    if not aid:
        return False
    try:
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.get(f"{EL_BASE}/convai/agents/{aid}", headers=_headers())
            r.raise_for_status()
            pr = (((r.json().get("conversation_config") or {}).get("agent") or {}).get("prompt") or {})
            prompt = pr.get("prompt") or "Eres Rocoto."
            if "[[CALLER:" in prompt and "[[CALL:" in prompt:
                return True
            # An agent warmed before the call-reference marker existed carries [[CALLER:]] alone. It
            # must still be patched: without [[CALL:]] an anonymous caller's turns cannot name their
            # own call, and every one of them resolves to the same shared scope.
            marker = ("\n\nIDENTIDAD DE LA LLAMADA (no lo leas en voz alta): "
                      "[[CALLER:{{caller_number}}]] [[CALL:{{call_ref}}]]")
            if "[[CALLER:" in prompt:
                prompt = _re_marker.sub(_MARKER_LINE, "", prompt).rstrip()
            body = {"conversation_config": {"agent": {"prompt": {"prompt": prompt + marker}}}}
            p = await c.patch(f"{EL_BASE}/convai/agents/{aid}", headers=_headers(), json=body)
            p.raise_for_status()
        log.info("runtime agent %s: caller marker installed", aid)
        return True
    except Exception:
        log.exception("ensure_caller_marker failed")
        return False
