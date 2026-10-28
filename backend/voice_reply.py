"""WhatsApp auto-reply — two rails, one first-person soul.

Rocoto replies to inbound WhatsApp in the SAME physical form the prospect used:
  • VOICE rail: a prospect's **voice note** → Rocoto replies with a **voice note** in his cloned voice.
    Owns the audio I/O: reply-text generation → ElevenLabs TTS → OGG/Opus encode → host under
    `/wamedia/` → `twilio_wa.send_whatsapp(to, media_url)` → record the outbound row for the cockpit.
    Gated on `config.ROCOTO_VOICE_REPLY_ENABLED`.
  • TEXT rail: a prospect's **text** → Rocoto replies with a **text** message (the basic conversational
    sales line — NOT out of scope). Same soul + guard machinery, minus the TTS step. Gated on
    `config.ROCOTO_TEXT_REPLY_ENABLED`.
Both rails share the reply-generation call (`generate_reply_text`), the debounce/supersede/cliff guards,
the per-phone lock, and the global daily cap. Each rail is inert until its own flag is true on the box;
with a flag off, that inbound path is byte-identical to before.

The outbound-media retention sweep (`sweep_outbound_media`) runs on a daily timer INDEPENDENT of both
flags — it only reaps old temp media (operator-sent files too), harmless whether or not replies are on.

Every path is fail-soft + logged — a failure here NEVER touches the inbound webhook, the transcript
row, or the live service; it just means no reply went out (logged, move on).
"""
from __future__ import annotations

import asyncio
import logging
import os
import re
import shutil
import subprocess
import tempfile
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import httpx

import config
import db as supa
import soul
import transcribe as tx
import twilio_wa as twa

log = logging.getLogger("rocoto.voice_reply")

# Where outbound media lives (Twilio's CDN fetches it from the public /wamedia/ route app.py serves).
# Mirror app.py's OUTBOUND_DIR (MEDIA_DIR/out) WITHOUT importing app.py (circular: app.py imports us).
_OUTBOUND_DIR = Path(config.MEDIA_DIR) / "out"

# Per-phone concurrency state (in-process; the service is a single uvicorn process today).
# The lock closes the double-reply race — the newer-inbound check + send happen while holding the phone's
# lock, so two overlapping messages serialise and the second sees the first's outbound row.
# `_LAST_REPLY_AT` records the last successful-SEND time per phone; it only gates replies when the
# (default-OFF) per-phone cooldown knob is >0. It is set immediately AFTER a successful SEND (before the
# DB insert) so an insert failure can't cause a re-reply (review A9b). Evicted in the daily sweep (F6).
_PHONE_LOCKS: dict[str, asyncio.Lock] = {}
_LAST_REPLY_AT: dict[str, float] = {}

# ── Global daily reply cap (review F3) ──
# Process-level 24h rolling counter across BOTH rails. The per-phone cooldown only throttles a single
# sender; on a PUBLIC line, many distinct numbers can still drive unbounded Anthropic+ElevenLabs+Twilio
# spend. This is the real cost backstop (mirrors demo_call's DEMO_DAILY_CAP). We record the monotonic
# timestamp of each SENT reply; `_daily_cap_exceeded()` counts sends in the trailing 24h. Fail-soft.
_REPLY_SENT_AT: list[float] = []
_DAY_SEC = 24 * 3600


def _prune_reply_sends(now: Optional[float] = None) -> None:
    """Drop send-timestamps older than 24h (called before each cap check + on record). Cheap: the list
    is bounded by the daily cap itself under normal operation."""
    cutoff = (now if now is not None else time.monotonic()) - _DAY_SEC
    if _REPLY_SENT_AT and _REPLY_SENT_AT[0] < cutoff:
        keep = [t for t in _REPLY_SENT_AT if t >= cutoff]
        _REPLY_SENT_AT[:] = keep


def _daily_cap_exceeded() -> bool:
    """True if the global 24h reply cap is set (>0) and already reached. Checked on BOTH rails BEFORE
    the LLM call. Fail-soft — any error counts as NOT exceeded (never silence the feature on a bug)."""
    try:
        cap = int(getattr(config, "ROCOTO_REPLY_DAILY_CAP", 0) or 0)
        if cap <= 0:
            return False
        _prune_reply_sends()
        return len(_REPLY_SENT_AT) >= cap
    except Exception:
        return False


def _record_reply_sent() -> None:
    """Record a SUCCESSFUL send against the daily cap. Called immediately after a send (A9b ordering)."""
    try:
        now = time.monotonic()
        _REPLY_SENT_AT.append(now)
        _prune_reply_sends(now)
    except Exception:
        pass


def _mark_replied(phone: str) -> None:
    """Set the in-memory throttle/idempotency markers immediately AFTER a successful SEND, BEFORE the DB
    insert (review A9b) — so if the assistant-row insert fails, a later inbound still can't re-reply via
    the cooldown/cap path. Records the daily-cap send and (for the optional per-phone cooldown) the
    last-reply time. Fail-soft."""
    try:
        _LAST_REPLY_AT[phone] = time.monotonic()
    except Exception:
        pass
    _record_reply_sent()


# ── Debounce / in-flight cliff state (Workstream B) ──
# Each inbound message fires its own maybe_reply_* hook. Under debounce, every hook first sleeps a
# quiescence window (ROCOTO_REPLY_DEBOUNCE_SEC) and then re-checks the thread: if a NEWER inbound
# landed during the wait, this (older) hook drops — the newest inbound's own hook owns the reply. That
# collapses a burst of double/triple messages into ONE considered reply. To bound task pile-up, we cap
# how many hooks may be sleeping in the debounce window per phone at once; excess hooks bail immediately
# (a later/kept hook still covers the burst via the supersede re-check). The cap is config-driven
# (ROCOTO_MAX_DEBOUNCE_INFLIGHT, review F15).
_DEBOUNCE_INFLIGHT: dict[str, int] = {}


async def _debounce_wait(phone: str) -> bool:
    """Workstream B — sleep the quiescence window for `phone`, bounded per phone. Returns True if the
    caller should PROCEED to the supersede re-check + generation, False if it should bail now (too many
    hooks are already waiting for this phone). When debounce is disabled (window<=0) it proceeds
    immediately without parking — the caller still runs the supersede guards.

    Cheap + fully self-contained: the actual "did a newer message arrive?" decision stays with the
    existing supersede guards downstream — this only adds the WAIT and the pile-up cap. Never raises."""
    window = float(getattr(config, "ROCOTO_REPLY_DEBOUNCE_SEC", 0.0) or 0.0)
    if window <= 0:
        return True  # debounce off → proceed immediately (pre-B behaviour)
    cap = int(getattr(config, "ROCOTO_MAX_DEBOUNCE_INFLIGHT", 6) or 6)
    # Pile-up cap: if too many hooks for this phone are already parked in the window, don't add another.
    if _DEBOUNCE_INFLIGHT.get(phone, 0) >= cap:
        log.info("voice_reply: debounce pile-up cap hit for %s — bailing this hook", phone)
        return False
    _DEBOUNCE_INFLIGHT[phone] = _DEBOUNCE_INFLIGHT.get(phone, 0) + 1
    # try/finally (no except): the only thing sleep can raise is CancelledError, which is a
    # BaseException — an `except Exception` would never catch it. The finally always decrements the
    # in-flight counter (even on cancellation) so it can't leak and permanently wedge the pile-up cap.
    try:
        await asyncio.sleep(window)
    finally:
        n = _DEBOUNCE_INFLIGHT.get(phone, 1) - 1
        if n <= 0:
            _DEBOUNCE_INFLIGHT.pop(phone, None)
        else:
            _DEBOUNCE_INFLIGHT[phone] = n
    return True


# ── Typing indicator (Workstream C) ──
def _inbound_sid(wa_message_id: Optional[str]) -> str:
    """The RAW Twilio inbound SID to hand the typing endpoint. Multi-media inbound rows store
    "{MessageSid}-{i}" for ALL items when NumMedia>1 (including i=0), and the bare SID when NumMedia==1
    (app.py); the typing API wants the bare SM…/MM… SID, so strip a trailing "-<digits>" suffix.
    Single-media / text rows already hold the raw SID."""
    sid = (wa_message_id or "").strip()
    if "-" in sid:
        head, _, tail = sid.rpartition("-")
        if head and tail.isdigit():
            return head
    return sid


async def _held_by_sombra(phone: str, kind: str, text: str = "") -> bool:
    """MODO SOMBRA (SPEC §5.5) — this rail's one line. True ⇒ the mouth is shut for this party: the
    would-be send is recorded as a draft on the review sheet (gate.hold) and nothing reaches
    WhatsApp. FAIL-CLOSED: an error resolving it HOLDS, because a held send is recoverable and a sent
    one is not."""
    try:
        import gate
        import runtime
        return await gate.hold_if_sombra(runtime.scope_of(phone), kind, text) is not None
    except Exception:
        log.exception("voice_reply: sombra resolution failed for %s — HOLDING the send (fail-closed)", phone)
        return True


async def _fire_typing(wa_message_id: Optional[str], phone: str = "") -> None:
    """Fire-and-forget WhatsApp typing bubble for an inbound id (flag-gated, fail-soft). Also marks
    the inbound READ (blue ticks) as a side effect; the bubble auto-clears on our reply or ~25s.

    RAIL DISPATCH (2026-07-25): the inbound id itself names its rail — a `wamid.*` came in on the
    Meta CLOUD rail (its indicator is whatsapp_cloud.send_typing_indicator; Twilio's Typing.json
    400s on wamids, which is exactly what the journal showed after the rail switch), anything else
    is a Twilio SM…/MM… SID (Twilio's beta endpoint, suffix-normalised). No suffix-strip ever runs
    on a wamid — base64url ids can legitimately end in '-<digits>'."""
    if not getattr(config, "ROCOTO_TYPING_INDICATOR_ENABLED", False):
        return
    raw = (wa_message_id or "").strip()
    if not raw:
        return
    # MODO SOMBRA (SPEC §5.5): typing + the blue ticks it sets are OUTBOUND — a "…escribiendo" bubble
    # from an employee who has been told not to speak is a promise he must not make. No draft is
    # recorded for a gesture (there is nothing to review), so this asks the mode, it does not hold.
    if phone:
        try:
            import gate
            import runtime
            if await gate.blocked(runtime.scope_of(phone), "typing"):
                return
        except Exception:
            log.exception("voice_reply: sombra resolution failed for %s — skipping typing (fail-closed)", phone)
            return
    try:
        if raw.startswith("wamid."):
            import whatsapp_cloud as _wc
            await _wc.send_typing_indicator(raw)
            return
        sid = _inbound_sid(raw)
        if sid:
            await twa.send_typing_indicator(sid)
    except Exception:
        log.debug("voice_reply: typing indicator raised (fail-soft)", exc_info=True)

def _max_note_age_sec() -> int:
    """Never auto-reply to an inbound older than this (config ROCOTO_MAX_NOTE_AGE_SEC, review F15).
    Bounds the startup pending-transcript sweep: a restart re-transcribes 'pending' rows and re-fires
    the reply hook, and replying to an hours-old message would drop a ghost reply into a conversation
    that has moved on."""
    return int(getattr(config, "ROCOTO_MAX_NOTE_AGE_SEC", 15 * 60) or 15 * 60)


def _phone_lock(phone: str) -> asyncio.Lock:
    lk = _PHONE_LOCKS.get(phone)
    if lk is None:
        lk = asyncio.Lock()
        _PHONE_LOCKS[phone] = lk
    return lk


def evict_phone_state() -> int:
    """Evict per-phone in-memory state that grows unbounded on a public line (review F6). Called from
    the daily wamedia sweep loop. Drops:
      • `_LAST_REPLY_AT` entries older than the (optional) per-phone cooldown window — once past the
        window they can never gate a reply, so they're dead weight;
      • `_PHONE_LOCKS` entries whose lock is currently UNLOCKED (a locked one is mid-reply — leave it;
        a fresh lock is cheaply recreated on the next inbound).
    Returns the count evicted. Never raises (best-effort housekeeping)."""
    removed = 0
    try:
        cooldown = int(getattr(config, "ROCOTO_VOICE_REPLY_COOLDOWN_SEC", 0) or 0)
        # With cooldown OFF, _LAST_REPLY_AT is only read by the daily cap? No — it's only the cooldown
        # gate that reads it. Keep a generous horizon so a re-enabled cooldown still sees recent sends.
        horizon = cooldown if cooldown > 0 else _DAY_SEC
        now = time.monotonic()
        for ph in [p for p, t in _LAST_REPLY_AT.items() if (now - t) > horizon]:
            _LAST_REPLY_AT.pop(ph, None)
            removed += 1
        for ph in [p for p, lk in _PHONE_LOCKS.items() if not lk.locked()]:
            _PHONE_LOCKS.pop(ph, None)
            removed += 1
    except Exception:
        log.debug("voice_reply: evict_phone_state raised (fail-soft)", exc_info=True)
    return removed


_TTS_ENDPOINT = "https://api.elevenlabs.io/v1/text-to-speech"
# ElevenLabs Opus output is Ogg-Opus (48 kHz). WhatsApp's native voice-note format is OGG/Opus, so we
# ask for it directly, then normalise to mono with ffmpeg for a clean playable-as-PTT voice note.
_OPUS_FORMAT = "opus_48000_64"
_MP3_FORMAT = "mp3_44100_128"

# ─────────────────────────── SOUL v0 — first-person freelancer (Workstream G) ───────────────────────────
# Acting notes, not a spec sheet. Rocoto is a PERSON pitching himself to a prospective client over
# WhatsApp — a freelancer who wants to get hired. Everything is "yo", never "nosotros/we do this".
# Booking the onboarding call with Peter (arrange a time or send the link) is how he closes the hire.
# He has other clients like any freelancer and can say so in passing, but he NEVER names a client or
# references any other conversation. Same character on the text rail and the voice-note rail — the only
# difference is the reply's PHYSICAL form (a spoken note vs. typed text), appended per-rail below.
# the base identity lives with the SOUL (kernel-boundary pass): soul.soul._SOUL

# Output length clamp (review F5): the reply is a cloned-voice/first-person message on a public line, so
# a hard char cap backstops the SOUL rule against a sender coaxing a long verbatim recitation (no extra
# LLM call — a pure length guard). WhatsApp replies are short anyway; this only bites pathological output.
_MAX_REPLY_CHARS = 600


def _clamp_reply(text: str) -> str:
    """Trim a reply to _MAX_REPLY_CHARS at a word boundary (best-effort). Pure/cheap; never raises."""
    t = (text or "").strip()
    if len(t) <= _MAX_REPLY_CHARS:
        return t
    cut = t[:_MAX_REPLY_CHARS]
    sp = cut.rfind(" ")
    if sp > _MAX_REPLY_CHARS * 0.6:  # only prefer the word boundary if it isn't chopping most of the text
        cut = cut[:sp]
    return cut.rstrip()

# Per-rail form note. The voice rail's reply is spoken aloud (TTS → voice note); the text rail's is typed.
_VOICE_FORM = (
    "\n\nESTA respuesta se convierte en una NOTA DE VOZ (texto-a-voz): escribe exactamente lo que dirías en "
    "voz alta, como si le mandaras un audio. No leas enlaces en voz alta (si quieres pasar el de reservar, "
    "dile que se lo mandas por escrito). 2-4 frases."
)
_TEXT_FORM = (
    "\n\nESTA respuesta es un MENSAJE DE TEXTO de WhatsApp: escríbelo tal cual lo mandarías escrito. Si "
    "propones reservar, puedes incluir el enlace (cal.com/leo-casa/rocoto-alta). Breve, 1-3 frases."
)


def configured() -> bool:
    """True only when we can actually generate AND send a voice reply (all creds present)."""
    return bool(
        config.ROCOTO_VOICE_REPLY_ENABLED
        and config.ANTHROPIC_API_KEY
        and config.ELEVENLABS_API_KEY
        and config.ROCOTO_VOICE_ID
    )


async def voice_posture(phone: str) -> str:
    """This phone's tenant's `voice` setting — never | mirror | always. THE one read.

    WHY IT EXISTS (2026-08-16). `configured()` above is a BOX-level answer: creds plus one global
    env flag. It has been true on production for every tenant at once, so the voice rail answered a
    voice note with a voice note for everybody — while `tenants.behaviour.voice`, the switch the
    panel and /demo both write, was read by nothing. A supplier who chose «Solo texto» still had
    voice notes going out to their customers, and no surface said so.

    So the capability was never missing; the SWITCH was disconnected. This is the wire.
        never  → no spoken reply; the text rail answers instead
        mirror → audio for audio (what production already does — hence the default)
        always → prefer voice, including in answer to a text message

    Fail-soft to the module default: a settings read sits on the reply path and a database hiccup
    must never change how the employee sounds. And the default is `mirror`, so a hiccup keeps
    today's behaviour rather than silently muting a rail that has been live for weeks."""
    try:
        import behaviour as _behaviour
        import tenancy as _tenancy
        s = await _behaviour.get(_tenancy.tenant_of(_tenancy.scope_of(phone)))
        return str(s.get("voice") or _behaviour.DEFAULTS["voice"])
    except Exception:
        log.debug("voice_reply: posture read fail-soft for %s", phone, exc_info=True)
        try:
            import behaviour as _behaviour
            return _behaviour.DEFAULTS["voice"]
        except Exception:
            return "mirror"


# ─────────────────────────── media retention sweep ───────────────────────────
_INBOUND_DIR = Path(config.MEDIA_DIR)  # app.py writes inbound media here (MEDIA_DIR/{msg_id}.{ext})


def _sweep_dir(directory: Path, cutoff: float, *, skip: Optional[set] = None) -> int:
    """Delete top-level files in `directory` with st_mtime < cutoff. `skip` = child names to leave
    (e.g. the 'out' subdir when sweeping the inbound root). Only touches files, never recurses into
    subdirs. Returns the count deleted. Never raises — best-effort housekeeping."""
    if not directory.exists():
        return 0
    removed = 0
    skip = skip or set()
    try:
        for p in directory.iterdir():
            if p.name in skip:
                continue
            try:
                if p.is_file() and p.stat().st_mtime < cutoff:
                    p.unlink()
                    removed += 1
            except Exception:
                continue
    except Exception:
        log.exception("voice_reply: media sweep failed for %s", directory)
    return removed


def _sweep_outbound_media_sync(ttl_hours: int) -> int:
    """Delete /wamedia files older than `ttl_hours` across BOTH media dirs (review A9a):
      • OUTBOUND (MEDIA_DIR/out): voice-note replies + operator-sent media — Twilio's CDN fetches
        within seconds, so anything past the TTL is dead weight;
      • INBOUND (MEDIA_DIR root): downloaded inbound media (app.py) — previously never swept, so it
        grew unbounded on a public line. Same TTL; the 'out' subdir is skipped (swept separately).
    Synchronous — run off the loop. Returns the total count deleted. Never raises."""
    if ttl_hours <= 0:
        return 0
    cutoff = time.time() - ttl_hours * 3600
    removed = _sweep_dir(_OUTBOUND_DIR, cutoff)
    # Inbound root: skip the 'out' child (its own sweep above) so we don't double-handle it.
    removed += _sweep_dir(_INBOUND_DIR, cutoff, skip={_OUTBOUND_DIR.name})
    if removed:
        log.info("voice_reply: swept %d stale media file(s) (>%dh, inbound+outbound)", removed, ttl_hours)
    return removed


async def sweep_outbound_media(ttl_hours: Optional[int] = None) -> int:
    """Async wrapper for the retention sweep; fail-soft. Call once at startup and on a daily timer.
    Independent of the feature flags — it only reaps old temp media (inbound downloads + outbound
    replies + operator-sent /api/send-media files), harmless whether or not the reply rails are on.
    Also evicts stale per-phone in-memory state (review F6) so a public line can't leak it."""
    hrs = config.ROCOTO_WAMEDIA_TTL_HOURS if ttl_hours is None else ttl_hours
    total = 0
    try:
        total = await asyncio.to_thread(_sweep_outbound_media_sync, hrs)
    except Exception:
        log.exception("voice_reply: sweep_outbound_media raised")
    try:
        evict_phone_state()
    except Exception:
        log.debug("voice_reply: phone-state eviction raised (fail-soft)", exc_info=True)
    return total


# ─────────────────────────── (a) reply text ───────────────────────────
async def _recent_history(phone: str, limit: int = 10) -> list[dict]:
    """Last ~`limit` messages for this phone as [{role, content}], oldest-first, for LLM context.
    Uses text or transcript (voice/photo/doc) so a voice-only thread still carries context. BOUNDED
    fetch (review F2): db.recent_messages_for_phone selects only the needed columns with a LIMIT, so
    this never pulls the whole thread. Never raises — an empty history just means a cold-start reply."""
    try:
        rows = await supa.recent_messages_for_phone(phone, max(limit, 1))  # oldest→newest, bounded
    except Exception:
        log.exception("voice_reply: history fetch failed for %s", phone)
        return []
    hist: list[dict] = []
    for r in rows:
        role = "assistant" if (r.get("role") == "assistant") else "user"
        content = (r.get("message_text") or r.get("transcript") or "").strip()
        if content:
            hist.append({"role": role, "content": content})
    return hist


# Lead statuses that mean "this contact is already booked/past the onboarding-call step" — so the
# reply shouldn't push a booking at them. (leads.status walks signed_up → call_booked → called →
# done → wizard_sent; plus the later converted/live phases from the runtime plan.)
_BOOKED_STATUSES = {"call_booked", "called", "wizard_sent", "done", "converted", "live"}


async def _has_booked_call(phone: str) -> bool:
    """Best-effort read of the `leads` row for this phone: has this contact already booked/had an
    onboarding call? Queries the shared pool directly (there's no db helper for phone→lead yet) and is
    fully fail-soft — unknown ⇒ False, so the default gentle booking nudge applies, which is the safe
    direction for a top-of-funnel prospect. The `leads` table may be absent on a fresh/dev DB (the
    ONBOARD_SCHEMA is applied best-effort at boot) → the try/except covers that too."""
    cphone = (phone or "").strip()
    if not cphone:
        return False
    try:
        pool = supa.get_pool()
        async with pool.acquire() as con:
            status = await con.fetchval(
                "select status from leads where phone = $1 order by updated_at desc limit 1", cphone
            )
    except Exception:
        log.debug("voice_reply: booked-call lookup failed for %s", cphone)
        return False
    return (status or "").lower() in _BOOKED_STATUSES


# ── Shared Anthropic client (reviews F7 + F8) ──
# F7: prefer anthropic.AsyncAnthropic — the reply LLM call then does its (up to ~45s×retries) network
# wait natively on the event loop, holding NO shared-executor thread. That keeps a burst of webhooks
# from parking all executor workers on LLM long-polls behind which WhatsApp sends/pushes/writes queue.
# F8: reuse ONE client per process instead of constructing per call. Fallback: if AsyncAnthropic isn't
# in the installed SDK, we route the SYNC client through a DEDICATED single-purpose thread pool so short
# ops (send/push/write on the shared default executor) never queue behind these long LLM calls.
_async_anthropic = None            # anthropic.AsyncAnthropic | None
_sync_anthropic = None             # anthropic.Anthropic | None (fallback path)
_llm_executor = None               # concurrent.futures.ThreadPoolExecutor | None (fallback path)
_anthropic_mode = ""               # "async" | "sync" | "" (not yet resolved)


def _resolve_anthropic():
    """Lazily build + cache the shared Anthropic client. Returns ("async", AsyncAnthropic) when the SDK
    supports it, else ("sync", Anthropic) with a dedicated executor. ("", None) if the SDK is absent or
    no key. Idempotent; safe to call on every reply."""
    global _async_anthropic, _sync_anthropic, _llm_executor, _anthropic_mode
    if _anthropic_mode:
        return _anthropic_mode, (_async_anthropic if _anthropic_mode == "async" else _sync_anthropic)
    if not config.ANTHROPIC_API_KEY:
        return "", None
    try:
        import anthropic
    except Exception:
        log.exception("voice_reply: anthropic sdk import failed")
        return "", None
    if hasattr(anthropic, "AsyncAnthropic"):
        try:
            _async_anthropic = anthropic.AsyncAnthropic(
                api_key=config.ANTHROPIC_API_KEY, max_retries=3, timeout=45.0)
            _anthropic_mode = "async"
            return "async", _async_anthropic
        except Exception:
            log.exception("voice_reply: AsyncAnthropic init failed — falling back to sync client")
    # Fallback: sync client on a dedicated executor (keeps LLM long-polls off the shared default pool).
    try:
        from concurrent.futures import ThreadPoolExecutor
        _sync_anthropic = anthropic.Anthropic(
            api_key=config.ANTHROPIC_API_KEY, max_retries=3, timeout=45.0)
        _llm_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="rocoto-llm")
        _anthropic_mode = "sync"
        return "sync", _sync_anthropic
    except Exception:
        log.exception("voice_reply: sync Anthropic init failed")
        return "", None


def aclose_llm_clients() -> None:
    """Shut the dedicated LLM executor (fallback path) on app shutdown. Fail-soft; no-op on async mode."""
    global _llm_executor
    ex = _llm_executor
    _llm_executor = None
    if ex is not None:
        try:
            ex.shutdown(wait=False)
        except Exception:
            pass


def _normalise_turns(turns: list[dict]) -> list[dict]:
    """Coerce a raw [{role, content}] list into a valid Anthropic Messages sequence: drop leading
    'assistant' turns (the first message must be 'user'), and merge any consecutive same-role turns
    (a voice-only thread can have runs of user or assistant messages) by joining their text."""
    out: list[dict] = []
    for t in turns:
        role, content = t["role"], t["content"]
        if not out:
            if role != "user":
                continue  # skip leading assistant turns
            out.append({"role": role, "content": content})
        elif out[-1]["role"] == role:
            out[-1]["content"] = f"{out[-1]['content']}\n{content}"
        else:
            out.append({"role": role, "content": content})
    return out


async def generate_reply_text(phone: str, transcript: str,
                              recent_history: Optional[list[dict]] = None,
                              form: str = "voice") -> str:
    """ONE focused Anthropic call: Rocoto (SOUL v0 — first-person freelancer) answers the inbound's
    content in the sender's language. `form` selects the physical-form note appended to the persona:
    'voice' → this reply becomes a spoken voice note (default, back-compatible), 'text' → a typed
    WhatsApp message. Pulls the last ~10 messages for context when `recent_history` isn't supplied.
    Returns '' on any failure (the caller then simply sends nothing — fail-soft)."""
    transcript = (transcript or "").strip()
    if not transcript or not config.ANTHROPIC_API_KEY:
        return ""
    mode, client = _resolve_anthropic()
    if not mode or client is None:
        return ""

    if recent_history is None:
        recent_history = await _recent_history(phone)
    try:
        booked = await _has_booked_call(phone)
    except Exception:
        booked = False

    system = soul._SOUL + (_TEXT_FORM if form == "text" else _VOICE_FORM)
    if booked:
        system += ("\n\n(Contexto: esta persona YA tiene una llamada de alta reservada o en marcha — "
                   "NO la empujes a reservar otra; sé útil y sigue la conversación.)")

    # Build the message list: prior turns for context, then the fresh voice note as the final user
    # turn. `recent_history` already ends with this inbound transcript (it's the newest row), so avoid
    # double-appending it. Then normalise for the Messages API, which requires the first turn to be
    # 'user' and rejects two consecutive same-role turns (a voice-only thread can have runs of either).
    raw = [{"role": m["role"], "content": m["content"].strip()}
           for m in (recent_history or []) if (m.get("content") or "").strip()]
    if not raw or raw[-1]["content"] != transcript:
        raw.append({"role": "user", "content": transcript})
    messages = _normalise_turns(raw)
    if not messages:
        messages = [{"role": "user", "content": transcript}]

    def _extract(resp) -> str:
        return "".join(b.text for b in resp.content if getattr(b, "type", None) == "text").strip()

    kwargs = dict(
        model=config.ROCOTO_VOICE_REPLY_MODEL,
        max_tokens=300,
        system=system,
        messages=messages,
    )
    try:
        if mode == "async":
            # Native async: no shared-executor thread is held during the network wait (F7).
            resp = await client.messages.create(**kwargs)
            out = _extract(resp)
        else:
            # Fallback: run the sync SDK on the DEDICATED executor so send/push/write on the shared
            # default pool never queue behind this long LLM call (F7).
            loop = asyncio.get_running_loop()
            out = await loop.run_in_executor(
                _llm_executor, lambda: _extract(client.messages.create(**kwargs)))
    except Exception:
        log.exception("voice_reply: reply-text generation failed for %s", phone)
        return ""
    # Output length clamp (F5) — hard char cap backstops the SOUL anti-oracle rule; cheap, no LLM call.
    return _clamp_reply(out)


# ── the MOUTH SANITIZER (Peter 2026-07-22: the agent SPOKE "Risa breve, natural" aloud) ──
# LLMs write theatrical cues — "(risa breve)", "*suspira*", "[pausa]". Flash/turbo read them LITERALLY;
# eleven_v3 only understands proper [tag] syntax. So at the mouth: a direction-ish cue is STRIPPED on
# non-v3, and MAPPED to a real v3 audio tag on v3. Ordinary parentheticals ("(2,50 €)") are untouched.
_DIRECTION = re.compile(r"(?:\(([^)]{1,60})\)|\[([^\]]{1,60})\]|\*([^*]{1,60})\*)")
# prefix-match (no trailing \b): "suspira", "sonríe", "riéndose" are all cues too
_DIRECTION_WORDS = re.compile(r"\b(risa|r[íi]e\b|riendo|sonr[íi]|suspir|pausa|susurr|tono|voz\b|carraspe|"
                              r"respir|resopl|tarare|canturre|guiñ|entre\s+risas|serio|dulce|alegre|natural)", re.I)
# the v3 performance map (official tag library, 2026 guide): a Spanish cue → the REAL rendered nonverbal
_V3_TAG = {"risa": "[laughs]", "ríe": "[laughs]", "rie": "[laughs]", "riendo": "[laughs]",
           "suspir": "[sighs]", "susurr": "[whispers]", "respir": "[exhales]", "resopl": "[exhales]",
           "carraspe": "[clears throat]", "tarare": "[hums]", "canturre": "[hums]"}


def sanitize_spoken(text: str, v3: bool = False) -> str:
    """Remove/convert stage directions so they are PERFORMED, never read aloud."""
    def _sub(m: "re.Match") -> str:
        inner = (m.group(1) or m.group(2) or m.group(3) or "").strip()
        if not _DIRECTION_WORDS.search(inner):
            return m.group(0)              # a real parenthetical (price, aside) — keep it
        if v3:
            low = inner.lower()
            for k, tag in _V3_TAG.items():
                if k in low:
                    return tag             # perform it: (risa breve) → [laughs]
        return ""                          # non-v3 (or unmapped): silence the cue
    out = _DIRECTION.sub(_sub, text or "")
    return re.sub(r"  +", " ", out).strip()


# ─────────────────────────── (b) TTS → OGG/Opus ───────────────────────────
async def _el_tts(text: str, output_format: str, accept: str) -> bytes:
    """One ElevenLabs TTS REST call (the plain text-to-speech endpoint — NOT the ConvAI bridge).
    Returns the raw audio bytes; raises on transport/HTTP error (caller decides the fallback)."""
    voice = config.ROCOTO_VOICE_ID
    _model = config._env("ROCOTO_TTS_MODEL", "eleven_v3")
    text = sanitize_spoken(text, v3=_model.startswith("eleven_v3"))
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.post(
            f"{_TTS_ENDPOINT}/{voice}",
            headers={"xi-api-key": config.ELEVENLABS_API_KEY, "accept": accept,
                     "content-type": "application/json"},
            params={"output_format": output_format},
            json={
                "text": text,
                # EMOTIVE (Peter 2026-07-22): a voice note is ASYNC — no latency constraint — so use the
                # most expressive model (eleven_v3: breaths, ums, emotional range). Configurable knob;
                # a failed v3 call falls back to flash below (never a silent voice-note drop).
                "model_id": config._env("ROCOTO_TTS_MODEL", "eleven_v3"),
                "voice_settings": {"stability": 0.5, "similarity_boost": 0.8},
            },
        )
        if r.status_code >= 400 and config._env("ROCOTO_TTS_MODEL", "eleven_v3") != "eleven_flash_v2_5":
            r = await c.post(
                f"{_TTS_ENDPOINT}/{voice}",
                headers={"xi-api-key": config.ELEVENLABS_API_KEY, "accept": accept,
                         "content-type": "application/json"},
                params={"output_format": output_format},
                json={"text": text, "model_id": "eleven_flash_v2_5",
                      "voice_settings": {"stability": 0.45, "similarity_boost": 0.8}})
        r.raise_for_status()
        return r.content


def _ffmpeg_to_ogg_opus(src: bytes, src_ext: str) -> Optional[bytes]:
    """Transcode arbitrary input bytes to WhatsApp-friendly OGG/Opus (mono, 48 kHz) via ffmpeg.
    Returns None if ffmpeg is absent or the transcode fails (caller falls back). Synchronous — run it
    off the event loop with asyncio.to_thread."""
    if not shutil.which("ffmpeg"):
        return None
    in_path = out_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=f".{src_ext}", delete=False) as f_in:
            f_in.write(src)
            in_path = f_in.name
        out_path = in_path + ".ogg"
        proc = subprocess.run(
            ["ffmpeg", "-y", "-i", in_path,
             "-ac", "1", "-ar", "48000",
             "-c:a", "libopus", "-b:a", "48k",
             "-f", "ogg", out_path],
            stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, timeout=60,
        )
        if proc.returncode != 0 or not os.path.exists(out_path):
            log.warning("voice_reply: ffmpeg transcode failed (rc=%s): %s",
                        proc.returncode, (proc.stderr or b"")[-300:].decode("utf-8", "replace"))
            return None
        return Path(out_path).read_bytes()
    except Exception:
        log.exception("voice_reply: ffmpeg transcode raised")
        return None
    finally:
        for p in (in_path, out_path):
            if p:
                try:
                    os.unlink(p)
                except Exception:
                    pass


async def tts_ogg(text: str) -> tuple[bytes, str, str, dict]:
    """Render `text` to speech and return (audio_bytes, ext, content_type, meta).

    Format strategy (best → acceptable fallback):
      1. Ask ElevenLabs for opus_48000_64 (Ogg-Opus) → ffmpeg-normalise to mono OGG/Opus → a proper
         WhatsApp PTT voice note.  meta.format='ogg_opus'.
      2. If ffmpeg is present but the opus request failed, get mp3 → ffmpeg-transcode to OGG/Opus.
      3. If ffmpeg is absent, serve the ElevenLabs opus bytes as-is (already Ogg-Opus). meta.format='ogg_opus_raw'.
      4. Last resort: mp3 as-is. WhatsApp renders it as a playable AUDIO FILE (not a PTT voice note) —
         acceptable per spec, flagged in meta.format='mp3_fallback' + logged.

    Raises only if EVEN the mp3 fallback fails (nothing to send). Caller wraps this in try/except."""
    text = (text or "").strip()
    if not text:
        raise ValueError("empty tts text")

    # 1/3: try Opus (Ogg-Opus) first.
    opus_bytes: Optional[bytes] = None
    try:
        opus_bytes = await _el_tts(text, _OPUS_FORMAT, accept="audio/ogg")
    except Exception:
        log.warning("voice_reply: ElevenLabs opus TTS failed; will try mp3 path")

    if opus_bytes:
        ogg = await asyncio.to_thread(_ffmpeg_to_ogg_opus, opus_bytes, "ogg")
        if ogg:
            return ogg, "ogg", "audio/ogg", {"format": "ogg_opus", "voice_id": config.ROCOTO_VOICE_ID}
        # ffmpeg missing/failed → serve the raw EL Ogg-Opus (already a valid OGG/Opus stream).
        log.info("voice_reply: serving raw ElevenLabs Ogg-Opus (ffmpeg unavailable/failed)")
        return opus_bytes, "ogg", "audio/ogg", {"format": "ogg_opus_raw", "voice_id": config.ROCOTO_VOICE_ID}

    # 2/4: mp3 path — transcode to ogg if we can, else send mp3 (WhatsApp = audio file, not PTT).
    mp3_bytes = await _el_tts(text, _MP3_FORMAT, accept="audio/mpeg")  # raise here ⇒ genuinely nothing to send
    ogg = await asyncio.to_thread(_ffmpeg_to_ogg_opus, mp3_bytes, "mp3")
    if ogg:
        return ogg, "ogg", "audio/ogg", {"format": "ogg_opus", "src": "mp3->ffmpeg",
                                         "voice_id": config.ROCOTO_VOICE_ID}
    log.warning("voice_reply: falling back to mp3 (no ffmpeg) — WhatsApp will render an audio file, not a PTT note")
    return mp3_bytes, "mp3", "audio/mpeg", {"format": "mp3_fallback", "voice_id": config.ROCOTO_VOICE_ID}


# ─────────────────────────── (c) send + record ───────────────────────────
async def send_voice_reply(phone: str, text: str,
                           still_current=None) -> Optional[dict]:
    """Generate speech for `text`, host it under /wamedia/, send it as a WhatsApp voice note, and
    record the outbound row (role='assistant', message_type='audio', media_urls=[url], message_text=
    the intended spoken text so the cockpit shows the transcript). Returns the inserted row dict, or
    None on failure. Fully fail-soft — never raises to the caller.

    `still_current`: an optional async predicate re-checked RIGHT BEFORE the Twilio send — AFTER TTS
    (review F10). TTS takes seconds; if a newer inbound landed meanwhile the caller's closure returns
    False and we DROP the reply here, so the "no stale reply ever ships" claim actually holds (the
    hook's pre-generation check couldn't cover the TTS window). Returns None when dropped."""
    text = (text or "").strip()
    if not text:
        return None
    # MODO SOMBRA (SPEC §5.5) — checked BEFORE TTS: a held voice note should not cost an ElevenLabs
    # generation, and the draft the boss reviews is the TEXT anyway.
    if await _held_by_sombra(phone, "voice", text):
        log.info("voice_reply: SOMBRA for %s — voice note drafted, not sent", phone)
        return None
    try:
        audio, ext, ctype, meta = await tts_ogg(text)
    except Exception:
        log.exception("voice_reply: TTS failed for %s", phone)
        return None

    # F10 — final supersede re-check AFTER TTS, immediately before the send. The hook's earlier check
    # ran before generation+TTS; this closes the TTS window so a stale voice note can't ship.
    if still_current is not None:
        try:
            if not await still_current():
                log.info("voice_reply: superseded after TTS for %s — dropping reply (F10)", phone)
                return None
        except Exception:
            log.debug("voice_reply: still_current check raised — proceeding (fail-soft)", exc_info=True)

    mid = str(uuid.uuid4())
    fname = f"{mid}.{ext}"

    def _write() -> None:
        _OUTBOUND_DIR.mkdir(parents=True, exist_ok=True)
        (_OUTBOUND_DIR / fname).write_bytes(audio)

    try:
        # Off the event loop (this runs on the shared loop that ACKs the Twilio webhook).
        await asyncio.to_thread(_write)
    except Exception:
        log.exception("voice_reply: could not write outbound media for %s", phone)
        return None

    # Public URL built the SAME way app.py's /api/send-media builds it (PUBLIC_BASE_URL + /wamedia/).
    public = f"{config.PUBLIC_BASE_URL}/wamedia/{fname}"

    try:
        sid = await twa.send_whatsapp(phone, "", media_url=public)
    except Exception:
        log.exception("voice_reply: WhatsApp send failed for %s", phone)
        return None

    # A9b — the message is OUT. Set the in-memory idempotency/throttle markers NOW, before the DB
    # insert, so an insert failure below can't let a later inbound re-reply via the cooldown/cap path.
    _mark_replied(phone)

    row = {
        "id": mid, "phone_number": phone, "role": "assistant",
        "message_type": "audio",
        # The intended spoken text doubles as message_text AND transcript so the cockpit/app show it
        # immediately (transcript_status='done' → no separate transcription pass needed).
        "message_text": text,
        "media_urls": [public], "media_types": [ctype],
        "wa_message_id": sid,
        "transcript": text, "transcript_status": "done",
        "transcript_meta": {"src": "rocoto_voice_reply", **meta},
        "created_at": supa.now_iso(),
    }
    try:
        return await supa.insert_message(row)
    except Exception:
        log.exception("voice_reply: outbound row insert failed for %s (message was sent, sid=%s)", phone, sid)
        return None


def _age_sec(created) -> float:
    """Age in seconds of a `created_at` value (datetime or ISO string). Fail-soft: an unparseable or
    absent timestamp returns 0.0 (counts as fresh), so a serialisation quirk never silences a rail.
    Shared by both rails (review F14)."""
    try:
        c = created if isinstance(created, datetime) else \
            datetime.fromisoformat(str(created).replace("Z", "+00:00"))
        if c.tzinfo is None:
            c = c.replace(tzinfo=timezone.utc)
        return (datetime.now(timezone.utc) - c).total_seconds()
    except Exception:
        return 0.0


def _cooldown_active(phone: str) -> bool:
    """True if the (default-OFF) per-phone cooldown is set (>0) and a reply went out within the window.
    With the knob at its default 0 this is always False — conversation flows freely (review A1). Shared
    by both rails (review F14)."""
    cooldown = max(0, int(getattr(config, "ROCOTO_VOICE_REPLY_COOLDOWN_SEC", 0) or 0))
    if not cooldown:
        return False
    last = _LAST_REPLY_AT.get(phone, 0.0)
    return bool(last and (time.monotonic() - last) < cooldown)


async def _newer_msgs(phone: str, created, msg_id: str) -> list[dict]:
    """Messages strictly newer than the anchor (created_at, msg_id) for the supersede guards. FAIL-OPEN
    on a bad anchor (review F4): a falsy or unparseable `created` returns [] — treated as "no newer
    messages, proceed" — instead of get_messages(after=None) which would return the ENTIRE thread and
    permanently mute the rail (every historical assistant row would look like a supersede). A DB error
    also returns [] (fail-soft). Uses the (created_at, id) tuple tiebreak (review A7) so two rows sharing
    an identical microsecond timestamp don't each exclude the other. Shared by both rails (review F14)."""
    if not created:
        return []  # fail-open: no usable anchor → don't fetch the whole thread, just proceed
    try:
        # Validate parseability the same way db.get_messages does; unparseable → fail-open (proceed).
        datetime.fromisoformat(str(created))
    except Exception:
        return []
    try:
        return await supa.get_messages(phone, after=str(created), after_id=msg_id)
    except Exception:
        return []


def _superseded(newer: list[dict], msg_id: str) -> bool:
    """Should we skip replying to `msg_id`? True if, among messages strictly newer than it, there is
    either (a) another inbound VOICE NOTE — a later hook handles the latest note (burst guard, restricted
    to audio so a follow-up TEXT never silently suppresses the reply; the newer text is still folded into
    the reply because generate_reply_text re-pulls the whole thread), or (b) an assistant row — we (or a
    racing task, or a Twilio webhook retry) already replied (idempotency)."""
    for m in newer:
        if m.get("id") == msg_id:
            continue
        role = (m.get("role") or "")
        if role == "assistant":
            return True  # already answered on this thread
        if role == "user" and (m.get("message_type") or "") == "audio":
            return True  # a newer voice note exists → its own hook is the one that answers
    return False


async def maybe_reply_to_voice_note(msg_id: str) -> None:
    """Entry point for the app.py inbound-audio hook. Fires the voice reply for the voice note `msg_id`
    (the phone is read off the row), with burst + safety guards. Fully fail-soft — hard try/except
    around everything so a failure here can never crash the webhook or the media pipeline.

    Guards:
      - feature must be configured (flag + creds);
      - the source row must still be a user-authored 'audio' message (never reply to our own / non-audio);
      - age guard: skip a note older than ROCOTO_MAX_NOTE_AGE_SEC (startup-sweep ghost guard);
      - debounce (Workstream B): wait a quiescence window before generating so a burst of voice notes
        collapses into ONE reply (older hooks drop via the supersede check; the newest survives);
      - GLOBAL daily cap (F3): skip before the LLM call once the 24h reply budget is spent;
      - burst guard (audio-only): if a NEWER inbound VOICE NOTE from the same phone exists, skip — a later
        hook answers the latest note (a follow-up TEXT does NOT suppress the reply; it's folded into context);
      - idempotency: if a newer assistant row already exists, skip (a racing task / Twilio retry replied);
      - per-phone cooldown: OFF by default (knob, review A1) — never drops a genuine new inbound;
      - typing indicator (Workstream C): once committed to generate, show the WhatsApp typing bubble;
      - in-flight cliff (Workstream B + F10): re-check after generation AND once more after TTS (inside
        send_voice_reply) — DROP the draft if a newer note landed, so no stale reply ever ships;
      - per-phone lock: the newer-inbound re-check + send happen under a per-phone lock so two overlapping
        voice notes serialise (the second sees the first's outbound row) — closes the double-reply race."""
    # Initialised before the try so the catch-all handler can log it even on an early failure (e.g. a
    # DB hiccup in get_message) without raising a NameError of its own.
    phone = ""
    try:
        if not configured():
            return
        row = await supa.get_message(msg_id)
        if not row:
            return
        if (row.get("role") or "") != "user" or (row.get("message_type") or "") != "audio":
            return  # only user-sent voice notes; never our own messages / other types
        phone = (row.get("phone_number") or "").strip()
        if not phone:
            return
        # THE TENANT'S OWN SWITCH (2026-08-16) — checked here, before any spend, because until now
        # `configured()` was the only gate and it is box-wide. A supplier on «Solo texto» gets the
        # text rail's answer instead: app.py's inbound-audio branch already routes the transcript to
        # the mind when the voice rail declines, so declining here is a change of VOICE, never of
        # silence. `mirror` and `always` both speak to a voice note — they differ only on text.
        if await voice_posture(phone) == "never":
            log.info("voice_reply: tenant posture is 'never' for %s — text rail answers %s",
                     phone, msg_id)
            return
        transcript = (row.get("transcript") or "").strip()
        if not transcript:
            log.info("voice_reply: no transcript for %s — skipping voice reply", msg_id)
            return

        created = row.get("created_at")

        # Age guard — skip stale notes (see _max_note_age_sec()). Fail-soft: an unparseable/absent
        # timestamp counts as fresh (age 0.0), so a serialisation quirk can never silence the feature.
        if _age_sec(created) > _max_note_age_sec():
            log.info("voice_reply: note %s is stale (>%ds) — skipping (startup-sweep guard)",
                     msg_id, _max_note_age_sec())
            return

        # Workstream B — debounce: wait a quiescence window BEFORE the lock so a burst of voice notes
        # sleep concurrently, then only the newest survives the supersede check below (the others drop).
        # Bailing (pile-up cap) is safe — a kept hook still covers the burst.
        if not await _debounce_wait(phone):
            return

        # Serialise per phone: the supersede re-check + send run under the lock so two near-simultaneous
        # voice notes can't both pass the guard and both send (the loser sees the winner's assistant row).
        async with _phone_lock(phone):
            # Per-phone cooldown — default OFF (review A1); only bites if the knob is set >0.
            if _cooldown_active(phone):
                log.info("voice_reply: cooldown active for %s — skipping", phone)
                return

            # GLOBAL daily cap (F3) — the real cost backstop on a public line. Checked before the LLM.
            if _daily_cap_exceeded():
                log.info("voice_reply: global daily reply cap reached — skipping %s", phone)
                return

            # Burst/idempotency guard — reply only to the newest inbound voice note, and never twice.
            # _newer_msgs is fail-open (F4): a bad anchor returns [] → proceed, never fetches the whole
            # thread; it uses the (created_at, id) tuple tiebreak (A7).
            if _superseded(await _newer_msgs(phone, created, msg_id), msg_id):
                log.info("voice_reply: superseded for %s — skipping (burst/idempotency guard)", phone)
                return

            # Workstream C — this hook is now committed to generate → show the typing bubble. Fire it
            # AFTER the debounce closed + supersede passed. Honest caveat (F11): if generation returns
            # empty below, the blue-tick/bubble is already set with no reply — the bubble simply
            # auto-clears (~25s). Fire-and-forget: fail-soft inside, must never delay generation.
            asyncio.create_task(_fire_typing(row.get("wa_message_id"), phone))

            # AGENTIC reply — Rocoto with HANDS. A link / action confirmation (force_text) is sent as
            # TEXT, never a voice note dictating a link (Peter's exact bug). Fail-soft to a plain voice reply.
            text = ""
            force_text = False
            link_suffix = ""
            try:
                import agent_reply  # lazy: breaks the import cycle
                hist = await _recent_history(phone, limit=8)
                # PERCEPTION (Peter 2026-07-22): the transcript's confidence — classified AT THE SENSE
                # (app.py) — feeds the fold BEFORE the mind reasons. Dirty audio: the mind is told not to
                # trust heard quantities + an order-ish note parks for human review (learn.gate_audio_order).
                _pnote = None
                try:
                    import json as _json

                    import confidence as _conf
                    _meta = row.get("transcript_meta") or {}
                    if isinstance(_meta, str):
                        _meta = _json.loads(_meta or "{}")
                    _cf = (_meta or {}).get("confidence") or {}
                    _pnote = _conf.perception_note(_cf) or None
                    if _cf.get("review") and re.search(r"\b(pedido|quiero|ponme|mándame|manda|kilo|kg|cajas?|unidades?|botes?)\b",
                                                       transcript.lower()):
                        import learn as _learn
                        await _learn.gate_audio_order(phone, transcript, _cf, [])
                except Exception:
                    log.debug("voice-note perception fail-soft", exc_info=True)
                out = await agent_reply.agentic_reply(phone, transcript, hist, perception_note=_pnote)
                text = (out.get("text") or "").strip()
                force_text = bool(out.get("force_text"))
                for a in out.get("actions", []):
                    for k in ("send_booking_link", "send_signup_link"):
                        if a.get(k) and a[k] not in text:
                            link_suffix = (link_suffix + "\n" + a[k]).strip()
            except Exception:
                log.exception("voice_reply: runtime turn failed")
                text = ""
            # NO legacy fallback — the runtime is the only brain (a voice note is a message; it went
            # through run_turn via agentic_reply). Empty → stay silent, don't drop to a one-shot generator.
            if not text and not link_suffix:
                return

            # In-flight cliff: re-check after generation.
            if _superseded(await _newer_msgs(phone, created, msg_id), msg_id):
                log.info("voice_reply: superseded during generation for %s — dropping reply", phone)
                return

            if force_text or link_suffix:
                body = (text + ("\n" + link_suffix if link_suffix else "")).strip()
                sent = await send_text_reply(phone, body)
                if sent:
                    log.info("voice_reply: replied to %s in TEXT (link/action, not a voice note) (%s)", phone, sent.get("id"))
            else:
                async def _still_current() -> bool:
                    return not _superseded(await _newer_msgs(phone, created, msg_id), msg_id)
                sent = await send_voice_reply(phone, text, still_current=_still_current)
                if sent:
                    log.info("voice_reply: replied to %s with a voice note (%s)", phone, sent.get("id"))
    except Exception:
        log.exception("voice_reply: maybe_reply_to_voice_note failed for %s/%s", phone, msg_id)


# ─────────────────────────── text rail (text-in → text-out) ───────────────────────────
def text_configured() -> bool:
    """Text auto-reply needs the flag + Anthropic + Twilio — NOT ElevenLabs (no TTS on this path)."""
    return bool(getattr(config, "ROCOTO_TEXT_REPLY_ENABLED", False)
                and config.ANTHROPIC_API_KEY
                and config.TWILIO_ACCOUNT_SID and config.TWILIO_AUTH_TOKEN)


async def send_text_reply(phone: str, text: str) -> Optional[dict]:
    """Send `text` as a plain WhatsApp message and store the assistant row. Fail-soft."""
    text = (text or "").strip()
    if not phone or not text:
        return None
    # MODO SOMBRA (SPEC §5.5). This is the LAST door on the text rail — runtime.run_turn already
    # holds the mind's reply, but `xray`/`why`/`send_text_reply` callers reach the rail directly, and
    # in sombra Rocoto sends the customer nothing at all.
    if await _held_by_sombra(phone, "message", text):
        log.info("text_reply: SOMBRA for %s — reply drafted, not sent", phone)
        return None
    try:
        sid = await twa.send_whatsapp(phone, text)
    except Exception:
        log.exception("text_reply: send failed for %s", phone)
        return None
    # A9b — the message is OUT. Mark idempotency/throttle NOW, before the DB insert, so an insert
    # failure below can't let a later inbound re-reply via the cooldown/cap path.
    _mark_replied(phone)
    row = {
        "id": str(uuid.uuid4()), "phone_number": phone, "role": "assistant",
        "message_type": "text", "message_text": text,
        "wa_message_id": sid or "",
        "transcript_meta": {"src": "rocoto_text_reply"},
        "created_at": supa.now_iso(),
    }
    try:
        return await supa.insert_message(row)
    except Exception:
        log.exception("text_reply: outbound row insert failed for %s (sent, sid=%s)", phone, sid)
        return None


def _text_superseded(newer: list[dict], msg_id: str) -> bool:
    """Text-rail supersede: skip if, among messages strictly newer than `msg_id`, there is ANY newer
    inbound USER message (the latest message's own hook answers — if the latest is audio, the voice
    rail owns it) OR an assistant row (already answered / racing task / retry). Stricter than the voice
    rail's `_superseded` (which ignores newer TEXT) because the text hook must yield to a newer text."""
    for r in newer:
        if (r.get("id") or "") == msg_id:
            continue
        role = r.get("role") or ""
        if role in ("user", "assistant"):
            return True
    return False


async def maybe_reply_to_text(msg_id: str) -> None:
    """Entry point for the app.py inbound-TEXT hook — the basic conversational reply rail.
    Mirrors maybe_reply_to_voice_note's guards; replies in TEXT (voice notes keep the voice path).
    Fully fail-soft.

    Guards: flag+creds · row is a user 'text' · age guard · debounce (Workstream B) · per-phone lock ·
    per-phone cooldown (default OFF, review A1) · GLOBAL daily cap (F3) · supersede: ANY newer inbound
    user message skips (the latest message's own hook answers — if the latest is audio, the voice rail
    owns the reply) · idempotency: a newer assistant row skips · in-flight cliff: re-check AFTER
    generation and DROP the draft if a newer inbound landed mid-thinking (the newer message's own hook
    owns the reply). Typing indicator (Workstream C) fires once this hook commits to generate.
    Shared guard helpers (_age_sec / _cooldown_active / _newer_msgs) are used by both rails (F14)."""
    phone = ""
    try:
        if not text_configured():
            return
        row = await supa.get_message(msg_id)
        if not row:
            return
        if (row.get("role") or "") != "user" or (row.get("message_type") or "") != "text":
            return
        phone = (row.get("phone_number") or "").strip()
        body = (row.get("message_text") or "").strip()
        if not phone or not body:
            return

        created = row.get("created_at")
        # Age guard — fail-soft: an unparseable/absent timestamp counts as fresh (age 0.0).
        if _age_sec(created) > _max_note_age_sec():
            log.info("text_reply: message %s is stale (>%ds) — skipping", msg_id, _max_note_age_sec())
            return

        # Workstream B — debounce: wait a quiescence window BEFORE the lock so a burst of texts sleep
        # concurrently; only the newest survives the supersede check below (the older hooks drop).
        if not await _debounce_wait(phone):
            return

        async with _phone_lock(phone):
            # Per-phone cooldown — default OFF (A1); only bites if the knob is set >0.
            if _cooldown_active(phone):
                log.info("text_reply: cooldown active for %s — skipping", phone)
                return

            # GLOBAL daily cap (F3) — checked before the LLM call.
            if _daily_cap_exceeded():
                log.info("text_reply: global daily reply cap reached — skipping %s", phone)
                return

            # Supersede — _newer_msgs is fail-open (F4: bad anchor → [] → proceed) and uses the
            # (created_at, id) tuple tiebreak (A7).
            if _text_superseded(await _newer_msgs(phone, created, msg_id), msg_id):
                log.info("text_reply: superseded for %s — skipping (burst/idempotency guard)", phone)
                return

            # Workstream C — committed to generate → show the typing bubble (fail-soft, non-blocking).
            # Honest caveat (F11): an empty generation below leaves the bubble/blue-tick with no reply;
            # it simply auto-clears (~25s).
            asyncio.create_task(_fire_typing(row.get("wa_message_id"), phone))

            # XRAY — a pure READ of the runtime's thought+action chain (introspection, not a reply turn).
            if body.strip().lower() in ("xray", "x-ray", "rayos x", "rayosx", "radiografía", "radiografia"):
                import agent_reply as _ar
                await send_text_reply(phone, await _ar.xray(phone))
                log.info("xray served to %s", phone)
                return
            # WHY — a pure READ: the byte-reproducible fold the mind saw last turn (WP-3, introspection).
            if body.strip().lower() in ("why", "por que", "por qué", "porque", "porqué"):
                import agent_reply as _ar
                await send_text_reply(phone, await _ar.why(phone))
                log.info("why served to %s", phone)
                return

            # THE EVENT-SOURCED TURN — Rocoto with HANDS, deciding from the assembled FOLD (SPEC §4.5).
            # runtime.run_turn appends the inbound event, assembles, minds, gates, and appends every
            # action + the reply as events. Idempotent on the Twilio MessageSid. Fail-soft to plain text.
            reply = None
            try:
                import runtime  # lazy: breaks the import cycle
                out = await runtime.run_turn(phone, body, dedupe_key=row.get("wa_message_id"),
                                             profile=row.get("profile_name") or "")
                if out.get("suppressed"):
                    log.info("text_reply: scope muted for %s — reply suppressed (takeover)", phone)
                    return
                reply = (out.get("text") or "").strip()
                for a in out.get("actions", []):
                    link = a.get("send_booking_link")
                    if link and link not in reply:
                        reply = (reply + "\n" + link).strip()
            except Exception:
                log.exception("text_reply: runtime turn failed")
                reply = None
            # NO legacy fallback: the runtime is the ONLY brain (Peter, 2026-07-21 — no makeshift/one-shot
            # generator competing with it). If the runtime produced nothing, stay silent rather than send a
            # dumber reply from a different system.
            if not reply:
                log.info("text_reply: runtime produced no reply for %s — nothing sent", phone)
                return

            # Workstream B — in-flight cliff: generation took a beat; if a newer inbound (or a racing
            # reply) landed meanwhile, DROP this draft — the newer message's own hook owns the reply.
            if _text_superseded(await _newer_msgs(phone, created, msg_id), msg_id):
                log.info("text_reply: superseded during generation for %s — dropping reply", phone)
                return

            rec = await send_text_reply(phone, reply)
            if rec:
                # _mark_replied already ran inside send_text_reply right after the send (A9b).
                log.info("text_reply: replied to %s (msg %s)", phone, msg_id)
    except Exception:
        log.exception("text_reply: unexpected failure (phone=%s, msg=%s) — swallowed (fail-soft)", phone, msg_id)


# ─────────────────────────── round-trip verification harness ───────────────────────────
async def _selftest() -> int:
    """Build-time round-trip check (needs real ANTHROPIC + ELEVENLABS + DEEPGRAM keys from the box
    env / .env). Generates a reply for a fixed Spanish transcript, runs TTS, transcribes the result
    back with the existing Deepgram helper, and asserts >80% token overlap with the intended text.

    Run on the box where /opt/rocoto/.env exists:
        cd /opt/rocoto && set -a && . ./.env && set +a && python -m voice_reply
    Returns a process exit code (0 = pass). Prints a human summary. Never a hard dependency of the
    service — it's a manual/deploy-phase gate."""
    import re as _re

    def _tokens(s: str) -> set[str]:
        return {t for t in _re.findall(r"\w+", (s or "").lower()) if len(t) > 2}

    checks = (("ANTHROPIC_API_KEY", config.ANTHROPIC_API_KEY),
              ("ELEVENLABS_API_KEY", config.ELEVENLABS_API_KEY),
              ("DEEPGRAM_API_KEY", config.DEEPGRAM_API_KEY),
              ("ROCOTO_VOICE_ID", config.ROCOTO_VOICE_ID))
    missing = [n for n, v in checks if not v]
    if missing:
        print(f"[voice_reply selftest] SKIPPED — missing keys: {', '.join(missing)}. "
              f"Run on the box with /opt/rocoto/.env sourced.")
        return 2

    transcript = ("Hola Rocoto, tengo una distribuidora de embutidos en Madrid y recibo los pedidos "
                  "por WhatsApp. ¿Cómo me puedes ayudar con eso?")
    print(f"[voice_reply selftest] inbound transcript:\n  {transcript}\n")

    text = await generate_reply_text("+34600000000", transcript, recent_history=[
        {"role": "user", "content": transcript},
    ])
    if not text:
        print("[voice_reply selftest] FAIL — no reply text generated")
        return 1
    print(f"[voice_reply selftest] reply text:\n  {text}\n")

    try:
        audio, ext, ctype, meta = await tts_ogg(text)
    except Exception as e:
        print(f"[voice_reply selftest] FAIL — TTS raised: {e}")
        return 1
    print(f"[voice_reply selftest] TTS ok: {len(audio)} bytes, ext={ext}, ct={ctype}, meta={meta}")

    try:
        dg = await tx.deepgram_diarize(audio, ctype)
        heard, _ = tx.parse_utterances(dg)
    except Exception as e:
        print(f"[voice_reply selftest] FAIL — Deepgram round-trip raised: {e}")
        return 1
    print(f"[voice_reply selftest] transcribed back:\n  {heard}\n")

    want, got = _tokens(text), _tokens(heard)
    if not want:
        print("[voice_reply selftest] FAIL — reply had no comparable tokens")
        return 1
    overlap = len(want & got) / len(want)
    ok = overlap > 0.80
    print(f"[voice_reply selftest] token overlap = {overlap:.0%}  →  {'PASS' if ok else 'FAIL'} "
          f"(threshold 80%)")
    return 0 if ok else 1


if __name__ == "__main__":
    import sys
    sys.exit(asyncio.run(_selftest()))
