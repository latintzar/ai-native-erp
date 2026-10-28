"""Rocoto backend — FastAPI.

Twilio WhatsApp webhook (messaging) + best-in-class transcription (Deepgram nova-3 →
Claude Sonnet 4.6) + OCR, persisted to Supabase and served to the native Android app.
Listens on 127.0.0.1:8092 — Caddy fronts it for HTTPS at the public sslip.io host.

NO auto-reply: inbound is stored + transcribed only; the operator sends from the app.
"""
from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import json
import logging
import os
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

import asyncpg
from fastapi import (
    APIRouter,
    Depends,
    FastAPI,
    File,
    Form,
    Header,
    HTTPException,
    Request,
    UploadFile,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response, StreamingResponse
from twilio.request_validator import RequestValidator

import agent_chat
import config
import crm_api
import db as supa
import demo_call
import el_convai
import eleven as el_bridge
import fcm
import logging_setup
import orders as orders_mod
import pedidos_meter
import postcall
import rocoto_processes  # noqa: F401 — APP-side fabric registrations (order_brain)
import transcribe as tx
import try_chat
import twilio_wa as twa
import voice as voice_bridge
import voice_reply
import voice_turn
import widget_build
from brain import auth as brain_auth
from brain import autoaccept as brain_autoaccept
from brain import baskets as brain_baskets
from brain import catalogue as brain_catalogue
from brain import drip as brain_drip
from brain import embed as brain_embed
from brain import enrich as brain_enrich
from brain import events as brain_events
from brain import jobs as brain_jobs
from brain import junkgate, medusa_client, medusa_map
from brain import lead_notify as brain_lead_notify
from brain import livecall as brain_livecall
from brain import medusa_drain as brain_medusa_drain
from brain import metrics as brain_metrics
from brain import onboarding as brain_onboarding
from brain import onboarding_ext as brain_ob_ext
from brain import otp as brain_otp
from brain import pedidos_billing as brain_pedidos_billing
from brain import pipeline as brain_pipeline
from brain import pricing_quote as brain_pricing_quote
from brain import profile as brain_profile
from brain import queue as brain_queue
from brain import rerank as brain_rerank
from brain import route as brain_route
from brain import seed as brain_seed
from brain import setupfee as brain_setupfee
from brain import skuparse as brain_skuparse  # noqa: F401 (used via onboarding_ext; import-gated here)
from brain import stripe_connect as brain_stripe
from brain import stripe_subs as brain_subs
from brain import tasks as brain_tasks
from brain import teams as brain_teams
from brain import tenants as brain_tenants
from brain import testdata as brain_testdata
from brain import theme as brain_theme
from brain import wa_watch as brain_wa_watch
from brain import waitlist as brain_waitlist
from http_serialization import json_safe as _jsonsafe
from identity_phone import canon
from identity_phone import is_valid as _is_valid_phone

# One JSON line per record on stdout, every line through the redacting formatter (logging_setup.py).
# This replaces logging.basicConfig, and it runs at import so nothing this module does can log before
# the redaction is installed — a formatter that arrives second has already missed the lines it exists
# to clean. `%(asctime)s %(levelname)s | %(message)s` is now the `ts`/`level`/`msg` of that object.
logging_setup.configure(os.environ.get("ROCOTO_LOG_LEVEL", "INFO"))
log = logging.getLogger("rocoto")

MEDIA_DIR = Path(config.MEDIA_DIR)
MEDIA_DIR.mkdir(parents=True, exist_ok=True)
# Outbound media the operator sends from the app. Twilio must fetch these itself, so they
# live behind an UNauthenticated route (filenames are random uuids → unguessable).
OUTBOUND_DIR = MEDIA_DIR / "out"
OUTBOUND_DIR.mkdir(parents=True, exist_ok=True)
import re as _re

import tenancy

_SAFE_FNAME = _re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$")

router = APIRouter()

# CORS for the landing demo (/api/demo/*) — the static site calls the backend directly (SSE can't
# ride the Vercel edge proxy without buffering). Restricted to the landing origins + Vercel previews.
_demo_origins = [o.strip() for o in config.DEMO_ALLOWED_ORIGINS.split(",") if o.strip()]
# The Vercel PREVIEW origins. Every `*.vercel.app` deployment on earth matches this pattern, which is
# why it is scoped below to the routes that need it (a preview of the landing driving the demo) and
# not handed to the whole backend — /api/* here serves orders, transcripts and money.
_PREVIEW_ORIGIN_RE = r"https://.*\.vercel\.app"
_PREVIEW_PATHS = ("/api/demo/",)
_CORS_KW = dict(
    allow_origins=_demo_origins,
    # PATCH joined for §17.56 (/demo's column-remap + row corrections ride PATCH
    # /api/demo/session/{token}/catalog/{id}); the panel itself reaches this backend same-origin
    # through its Vercel /api/* rewrite, but the preview deployments and the landing do not.
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["Content-Type"],
    max_age=600,
)


class PathScopedCORS:
    """CORS with two doors: the landing origins for the whole backend, and — for the demo routes
    alone — the Vercel preview origins as well.

    Two CORSMiddleware instances over the same app, chosen per request by path. A single instance
    cannot do this: `allow_origin_regex` is fixed at construction and the origin check never sees the
    path, so the preview pattern it was given applied to every route on the backend."""

    def __init__(self, app, *, preview_regex: str, preview_paths: tuple[str, ...], **kw) -> None:
        self._paths = preview_paths
        self._base = CORSMiddleware(app, **kw)
        self._preview = CORSMiddleware(app, allow_origin_regex=preview_regex, **kw)

    async def __call__(self, scope, receive, send) -> None:
        preview = scope.get("type") == "http" and str(scope.get("path", "")).startswith(self._paths)
        await (self._preview if preview else self._base)(scope, receive, send)




# Bound concurrent transcription work so a burst can't exhaust the DB pool / thread executor.
_SEM = asyncio.Semaphore(4)


# ── B3 (2026-07-26): ONE MIND, OR THE CALL FAILS ────────────────────────────────────────────────────
# The ConvAI fallback is deleted. Peter's order + the 2026-07-26 incident: with the mind dead the box
# still answered — in the landing demo agent's voice, with its greeting — so a hard crash arrived
# disguised as mediocre behaviour and nobody was told. From here on, an unbuildable pin/persona/opener
# or a missing runtime agent is a LOUD failure: an explicit error, a surfaced alert, no second mind.
# MODO SOMBRA (SPEC §5.5): Rocoto does not answer, and does not say anything in Rocoto's name — the
# call is simply not picked up, so the line's own voicemail/forwarding takes it and the human decides.
_SOMBRA_NO_ANSWER_TWIML = (
    '<?xml version="1.0" encoding="UTF-8"?>'
    '<Response><Reject reason="busy"/></Response>'
)
_VOICE_MIND_FAIL_TWIML = (
    '<?xml version="1.0" encoding="UTF-8"?>'
    "<Response>"
    '<Say language="es-ES" voice="Polly.Lucia">Lo siento, ahora mismo no puedo atenderte por un fallo '
    "tecnico. Escribeme por WhatsApp y te contesto.</Say>"
    "<Hangup/></Response>"
)


# Strong refs to in-flight alert tasks: asyncio only weakly references a running task, so a bare
# create_task can be garbage-collected mid-await. An alert that vanishes is the failure mode B3 exists
# to kill, so these are held until they finish.
_VOICE_MIND_ALERTS: set = set()


def _voice_mind_alert(detail: str, ref_scope: str | None = None) -> None:
    """Record the voice-mind fault (kind F). SYNC + fire-and-forget:
    the durable alert write runs off the call hot path. Monitoring owns external paging.
    Fail-soft ONLY in the sense that alerting can't crash the caller — the caller still fails loud."""
    async def _go() -> None:
        try:
            import ops
            await ops.record_alert("F", f"VOICE MIND UNAVAILABLE — {detail}", ref_scope)
        except Exception:
            log.exception("voice-mind alert could not be surfaced")
    try:
        t = asyncio.get_running_loop().create_task(_go())
        _VOICE_MIND_ALERTS.add(t)
        t.add_done_callback(_VOICE_MIND_ALERTS.discard)
    except Exception:
        log.exception("voice-mind alert could not be scheduled")


class VoiceMindUnavailable(RuntimeError):
    """The call cannot be served by OUR mind. Never rescued into a different agent or a canned line."""


def _require_voice_mind(scope: str) -> str:
    """The agent id for a call that is ABOUT to start — ours, or the call dies here (B3)."""
    import voice_toggle
    try:
        return voice_toggle.runtime_agent_id()
    except voice_toggle.NoVoiceMind as e:
        log.error("VOICE MIND UNAVAILABLE (%s) — refusing the call on %s", e, scope)
        _voice_mind_alert(f"no runtime agent for {scope}: {e}", scope)
        raise VoiceMindUnavailable(str(e)) from e


async def _ring_pin_or_fail(caller: str, scope: str, lang: str) -> dict:
    """Ring-time assembly, B3 contract: the pin AND its role-block opener must exist, or the call fails.

    This is the exact seam the 2026-07-26 incident walked through: the pin build was fail-soft and the
    opener fell back to a scripted greeting, so a dead mind sounded like a mediocre one."""
    try:
        pin = await _build_voice_pin(caller, scope, lang)
    except Exception as e:  # noqa: BLE001
        log.error("VOICE MIND UNAVAILABLE — ring-time pin build failed for %s: %s", scope, e, exc_info=True)
        _voice_mind_alert(f"ring-time pin build failed for {scope}: {e}", scope)
        raise VoiceMindUnavailable(f"pin build failed for {scope}: {e}") from e
    if not (pin.get("opener") or "").strip():
        log.error("VOICE MIND UNAVAILABLE — no role-block opener for %s", scope)
        _voice_mind_alert(f"no role-block opener for {scope} (persona/tier unresolved)", scope)
        raise VoiceMindUnavailable(f"no opener for {scope}")
    return pin


_STARTUP_TASKS: set[asyncio.Task] = set()


def _spawn_background(coroutine) -> asyncio.Task:
    task = asyncio.create_task(coroutine)
    _STARTUP_TASKS.add(task)
    task.add_done_callback(_STARTUP_TASKS.discard)
    return task


async def _startup() -> None:
    # FIRST, before a pool is opened or a single request can arrive: production refuses to start with
    # a hole where a secret belongs. Deliberately NOT caught — a boot loop with the missing NAMES in
    # the journal is the loud failure; the alternative is a box that serves traffic through doors that
    # verify nothing, which is what this replaces. Outside IS_PROD it is a no-op.
    config.assert_prod_ready()
    await supa.init()
    # Tenant registry: ensure Rocoto exists as a row (the directory + per-vendor scoping read it).
    # Non-fatal — the storefront degrades gracefully if the registry is briefly unavailable.
    try:
        await brain_tenants.ensure_seed()
        await brain_teams.ensure_seed()
    except Exception:
        log.exception("startup tenant/team-seed failed")
    # …then COMPLETE that row: the founder's own distributor identity, its delivery rule, the number
    # bound and the go-live claim once the catalogue is really there (SPEC §6 — the boxes read state,
    # so the state has to exist). Idempotent, hole-filling only, and never touches a non-seeded row.
    # Deliberately AFTER ensure_seed, which is what creates the row this completes.
    try:
        await _ensure_founder_tenant()
    except Exception:
        log.exception("startup founder-tenant provisioning failed (non-fatal)")
    # Defense-in-depth: require_key falls open when ROCOTO_API_KEY is unset (dev convenience).
    # In prod that would expose customer data + live call transcripts unauthenticated, so make
    # the misconfiguration loud rather than silent.
    if not config.ROCOTO_API_KEY:
        log.warning("ROCOTO_API_KEY is UNSET — /api/* and /media are OPEN (no auth). Dev only; "
                    "set ROCOTO_API_KEY in prod.")
    # Retry transcriptions stranded by a restart mid-process.
    try:
        for row in await supa.get_pending():
            meta = row.get("transcript_meta") or {}
            src = meta.get("src")
            if not src:
                continue
            ctype = (row.get("media_types") or [""])[0]
            _spawn_background(_process_media(
                row["id"], src, ctype, row.get("message_type", ""), row.get("message_text", "")
            ))
    except Exception:
        log.exception("startup pending-sweep failed")
    # A restart mid-call would leave a ghost 'active' call row → clear stale ones.
    try:
        swept = await supa.call_sweep_orphans()
        if swept:
            log.info("startup: swept %d orphaned active call(s)", swept)
    except Exception:
        log.exception("startup call-sweep failed")
    # Outbound /wamedia retention sweep — reap voice-note/operator media past its TTL so MEDIA_DIR/out
    # doesn't grow unbounded (the voice-reply rail scales this with inbound traffic once enabled). Runs
    # regardless of the voice-reply flag; fully fail-soft. Once at boot, then daily.
    # Warm the embedding model at boot (SPEC §7 latency contract): fastembed lazy-loads on first use —
    # a cold model on the first voice utterance after a restart = seconds of load = EL times out = the
    # silent-call bug. Warm it off the event loop so boot isn't blocked either.
    async def _warm_embed() -> None:
        try:
            import rt_embed
            await asyncio.to_thread(rt_embed.embed, "hola")
            log.info("embed model warm")
        except Exception:
            log.debug("embed warmup fail-soft", exc_info=True)
    _spawn_background(_warm_embed())
    _spawn_background(_wamedia_sweep_loop())
    # Pedidos orders meter (PEDIDOS-PRICING-BUILD.md §3) — the safety-net sweep. record_order() is
    # called directly at this file's own status-change routes (zero-latency); this catches every
    # OTHER path that can flip an order to approved/sent (sup_api.py, brain/autoaccept.py,
    # brain/pipeline.py, portal.py — none of which this module may edit). Fully fail-soft.
    _spawn_background(pedidos_meter.reconcile_loop())
    # …and the half that turns a counted order into a BILLED one (STRIPE-V2-PLAN.md §3c). The meter
    # above has always counted correctly and reported nothing: every seat-band tenant would have paid
    # their seat fee and zero for their orders. Self-gating — a no-op under ROCOTO_EGRESS_SANDBOX or
    # PEDIDOS_USAGE_REPORT_ENABLED=0, and the meter keeps counting either way, so nothing is lost
    # while it is off. Imported here rather than at module scope to keep boot's import graph flat.
    from brain import pedidos_usage_report as brain_pedidos_usage
    _spawn_background(brain_pedidos_usage.report_loop())
    # Phase-A: scheduled Excel dispatch loop (cadence='scheduled').
    _spawn_background(_dispatch_scheduler())
    # Medusa outbox drainer — always on; self-gates to a no-op when MEDUSA_SYNC_ENABLED is false.
    _spawn_background(brain_medusa_drain.drainer_loop())
    # Rocoto onboarding: scan /home/founder/calls/*.md and attach call notes to leads (self-gates to
    # a no-op when the calls dir is absent). Fail-soft loop — never crashes boot of the live service.
    _spawn_background(brain_onboarding.ingest_loop())
    # Rocoto WhatsApp "we message them first" template-approval watcher — self-terminating: returns
    # immediately if already enabled, else polls Twilio until both intro templates approve, then burns
    # itself. Fully fail-soft (tolerates the currently-suspended Twilio account by continued benign polling).
    _spawn_background(brain_wa_watch.watch_loop())
    # Order-brain: recover any burst a crash left mid-process, warm the ONNX models off the event
    # loop (so the first order isn't slow), and start the durable-queue drainer.
    if config.ORDER_BRAIN_ENABLED:
        try:
            n = await brain_queue.reset_stuck()
            if n:
                log.info("order-brain: recovered %d stuck queue item(s)", n)
        except Exception:
            log.exception("order-brain queue recovery failed")
        _spawn_background(asyncio.to_thread(brain_embed.warm))
        _spawn_background(asyncio.to_thread(brain_rerank.warm))
        _spawn_background(brain_jobs.drainer_loop())
        # Live in-call order draft + location (per-active-call ~5s loop, cheap Haiku).
        _spawn_background(brain_livecall.live_call_loop())

    # Boot-warm (Seam-1, 2026-07-23; B3 2026-07-26): make sure THE ONE voice agent exists + carries the
    # caller marker BEFORE the first call. There is nothing to degrade to any more, so a failure here is
    # not "fail-soft" — it means the box cannot take a call, and Peter is told (ops.record_alert).
    async def _warm_voice_runtime() -> None:
        try:
            import voice_toggle
            if el_bridge.configured():
                await voice_toggle.ensure_runtime_agent()
                # the caller marker is how a live call resolves WHO is on the line; without it every
                # caller collapses to the anonymous scope, so its failure is surfaced too, not shrugged.
                if not await voice_toggle.ensure_caller_marker():
                    log.error("voice runtime agent warmed but the [[CALLER]] marker could NOT be installed")
                    _voice_mind_alert("runtime agent has no [[CALLER]] marker — callers cannot be resolved")
                else:
                    log.info("voice runtime agent warmed (boot-warm)")
        except Exception as e:  # noqa: BLE001
            log.error("VOICE MIND UNAVAILABLE: boot-warm failed (%s) — calls will FAIL, not degrade", e,
                      exc_info=True)
            _voice_mind_alert(f"boot-warm could not ensure the runtime voice agent: {e}")
    _spawn_background(_warm_voice_runtime())


async def _shutdown() -> None:
    """Release the process-lifetime shared clients (review F8): the typing httpx client and the
    fallback LLM executor. Fail-soft — a failure here must never block a clean shutdown."""
    tasks = list(_STARTUP_TASKS | _VOICE_MIND_ALERTS)
    for task in tasks:
        task.cancel()
    if tasks:
        done, pending = await asyncio.wait(tasks, timeout=10)
        for task in done:
            if not task.cancelled():
                task.exception()  # retrieve failures before releasing the final process reference
        if pending:
            log.warning("shutdown: %s background task(s) still cancelling", len(pending))
    _STARTUP_TASKS.clear()
    _VOICE_MIND_ALERTS.clear()
    try:
        await twa.aclose_shared_client()
    except Exception:
        log.debug("shutdown: twilio_wa shared client close raised", exc_info=True)
    try:
        voice_reply.aclose_llm_clients()
    except Exception:
        log.debug("shutdown: voice_reply LLM client close raised", exc_info=True)
    await supa.close()


async def _wamedia_sweep_loop() -> None:
    """Periodic retention sweep for the media dirs — OUTBOUND_DIR (/wamedia) AND the inbound MEDIA_DIR
    root (review A9a) — plus per-phone in-memory state eviction (review F6). Fail-soft; the file sweep
    is a no-op when the TTL is 0."""
    while True:
        try:
            await voice_reply.sweep_outbound_media()
        except Exception:
            log.exception("wamedia sweep loop iteration failed")
        await asyncio.sleep(24 * 3600)


EXT = {
    "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/amr": "amr",
    "audio/wav": "wav", "audio/x-wav": "wav", "image/jpeg": "jpg", "image/png": "png",
    "image/webp": "webp", "image/gif": "gif", "application/pdf": "pdf", "video/mp4": "mp4",
}
PREVIEW = {"audio": "🎤 Nota de voz", "image": "📷 Foto", "document": "📄 Documento", "video": "🎬 Vídeo"}


def _norm(phone: str) -> str:
    # Canonical E.164 identity (region ES) — the dedupe key across WhatsApp/voice/storefront/Medusa
    # (medusa-integration.md §5). Already-E.164 inputs are unchanged; only local forms get fixed.
    return canon(phone)


def require_key(authorization: str = Header(default="")) -> None:
    """MACHINE-TO-MACHINE ONLY. `ROCOTO_API_KEY` is a shared secret held by processes we run: the
    Medusa storefront's server routes, the Medusa subscriber, deploy/ops scripts, the smoke harness.

    It is NOT an identity and it must never again be the authority on a phone's data rail — see the
    note above `require_app_user`. Every route the Android app calls has moved to that dependency;
    what is left on this one is either genuinely machine-side or explicitly dual (and says so)."""
    if not config.ROCOTO_API_KEY:
        if config.IS_PROD:                       # fail-CLOSED in prod — commerce data flows here now
            raise HTTPException(503, "server misconfigured: API key unset")
        return  # dev only
    if not hmac.compare_digest(authorization, f"Bearer {config.ROCOTO_API_KEY}"):
        raise HTTPException(401, "bad api key")


# ══════════════════════════════════════════════════════════════════════════════════════════════════
# WEBHOOK SIGNATURES — verified, never "verified when we happen to hold the secret".
#
# Every one of these doors used to read `if <secret>:` before checking anything, so the secret going
# missing did not break a request: it turned the door into one that accepts whatever arrives. A rail
# that is public by design (Meta and Twilio POST to us from the open internet) and authenticated only
# by a signature has exactly one failure mode, and it is silent. So the check is unconditional, an
# absent secret is a REFUSAL rather than a skip, and the only bypass is
# `config.allow_unsigned_webhooks()` — dev-only by construction (prod ignores the flag).
# ══════════════════════════════════════════════════════════════════════════════════════════════════
def _require_twilio_signature(request: Request, url: str, form) -> None:
    """Prove this request came from Twilio, or raise 403. `url` is the EXACT public URL Twilio signed
    (query string included) and `form` the parsed body — both are part of the signature."""
    if config.allow_unsigned_webhooks():
        return
    token = config.TWILIO_AUTH_TOKEN
    if not token:
        # No secret is not "no check": with nothing to verify against, nothing can be trusted.
        log.error("refused Twilio webhook: TWILIO_AUTH_TOKEN unset, so no request can be verified")
        raise HTTPException(403, "invalid twilio signature")
    sig = request.headers.get("X-Twilio-Signature", "")
    if not RequestValidator(token).validate(url, dict(form), sig):
        log.warning("rejected unsigned/forged Twilio webhook")
        raise HTTPException(403, "invalid twilio signature")


def _has_machine_key(authorization: str) -> bool:
    """Constant-time 'is this the machine key' — for the DUAL routes only. Never a fall-open: an
    unset key is False here (unlike require_key's dev convenience), because the dual routes always
    have a per-user path that works."""
    return bool(config.ROCOTO_API_KEY) and hmac.compare_digest(
        authorization or "", f"Bearer {config.ROCOTO_API_KEY}")


# ══════════════════════════════════════════════════════════════════════════════════════════════════
# THE APP RAIL'S IDENTITY (2026-07-27) — per-user bearer, tenant resolved SERVER-SIDE.
#
# THE HOLE THIS CLOSES: `/api/*` used to authenticate with `ROCOTO_API_KEY` alone, and that key ships
# as a STRING LITERAL inside the APK (`android/app/build.gradle` buildConfigField → `classes3.dex`,
# grep-confirmed; R8 does not remove string literals). The value in the release build is the LIVE prod
# key. So a copy of the APK — a file that gets forwarded — was read/write authority over every order,
# customer, conversation and Stripe Connect account on the box.
#
# THE SHAPE, and why THIS one: the phone carries a **Supabase bearer** (AuthClient already holds one,
# with a refresh mutex), the desk carries a **cookie session** (sup_session). Different carriers,
# because that is what each client can actually hold — a native app has no cookie jar worth trusting,
# a browser cannot safely hold a long-lived bearer. But there is exactly ONE TENANCY RULE underneath
# both: `brain_auth.app_scope` calls `sup_session.resolve_membership`, the desk's own resolver. The
# alternative (a second membership rule for the phone) is how two doors end up disagreeing about who
# belongs to which tenant, and that disagreement is the vulnerability.
#
# THE CLIENT NEVER NAMES ITS TENANT. Not in a header, not in a query param, not in a body field. A
# client-supplied tenant id is the same hole wearing a different hat. `ctx["tenant_slug"]` is the only
# tenant a handler may use, and `_app_runtime_fence` refuses LOUDLY (403) rather than serving another
# tenant's rows or an empty 200 that looks like data.
# ══════════════════════════════════════════════════════════════════════════════════════════════════

async def _app_ctx(authorization: str) -> dict:
    user = await brain_auth.verify_token_cached(_bearer(authorization))
    if not user:
        raise HTTPException(401, "unauthorized")
    try:
        return await brain_auth.app_scope(user)
    except brain_auth.AppScopeError as e:
        raise HTTPException(e.status, e.code)


async def require_app_user(authorization: str = Header(default="")) -> dict:
    """THE app data-rail gate. A verified Supabase bearer → {email, tenant_slug, tenant_name, role,
    caps, via, is_founder}. The machine key is NOT accepted here — that is the entire point."""
    return await _app_ctx(authorization)


def require_app_cap(cap: str):
    """Dependency factory: a valid app user AND the capability (read | act | admin). Mirrors
    sup_api.require_cap so a staff account means the same thing on the phone as on the desk."""
    async def _dep(ctx: dict = Depends(require_app_user)) -> dict:
        if not brain_auth.app_can(ctx.get("role", ""), cap):
            raise HTTPException(403, f"cap_required:{cap}")
        return ctx
    return _dep


def _app_runtime_fence(ctx: dict) -> dict:
    """The fence for the legacy runtime tables (orders, whatsapp_messages, calls — no tenant_id
    column, one tenant per deployment). A scope for any other tenant is refused LOUD, never served."""
    if not brain_auth.owns_runtime(ctx.get("tenant_slug", "")):
        raise HTTPException(403, "tenant_scope_unavailable")
    return ctx


async def require_app_runtime(ctx: dict = Depends(require_app_user)) -> dict:
    """require_app_user + the runtime fence. This is the guard on everything that reads or writes the
    non-tenant_id runtime tables: orders, conversations, messages, calls, reparto, agent surfaces."""
    return _app_runtime_fence(ctx)


def require_app_runtime_cap(cap: str):
    async def _dep(ctx: dict = Depends(require_app_cap(cap))) -> dict:
        return _app_runtime_fence(ctx)
    return _dep


async def require_media_auth(authorization: str = Header(default="")) -> dict:
    """PER-USER ONLY, as of 2026-07-27. `/media/{fname}` serves customers' photos, voice notes and
    documents — it is the app's data rail wearing a different content type, and it is now gated by the
    same identity as the rest of it.

    IT WAS DUAL FOR EXACTLY ONE DAY, and this is the history because the shape of the mistake matters:
    `/media` is fetched by Coil (`Bubbles.kt`, `ImageViewer.kt`, `ChatSettingsScreen.kt`,
    `RocotoNav.kt`) and by ExoPlayer (`VoicePlayback.kt`) — five call sites that build their own
    requests and never reach `ApiClient`'s interceptor. When `ApiClient` moved to the Supabase bearer,
    those five were still stamping `ROCOTO_API_KEY`, so the key was accepted here to keep images and
    voice notes from going blank, and the docstring promised it would come out the day they moved.
    They moved (`ApiClient.mediaAuthHeader`), the `buildConfigField` is deleted from
    `android/app/build.gradle`, and the key has been rotated on prod. Nothing on the app surface is
    reachable with a leaked APK key any more.

    Do not put the machine key back. `_has_machine_key` still exists for genuine server-to-server
    callers (`GET /api/shop/connect/status`, called by the Medusa storefront's `lib/tenant.ts`) — this
    route has no such caller: every fetch of `/media` comes from a human's phone or desk."""
    return await _app_ctx(authorization)


# ─────────────────────────── Owner / RBAC deps (TEST-MODE-AND-ACCESS spec §6) ───────────────────────────
# A signed-in human's identity is a Supabase bearer, not the shared machine key. These deps verify the
# bearer, resolve the role from the VERIFIED email allowlist (brain_auth.resolve_role), and return a
# context dict the endpoint uses (owner email → owner_actor, etc). Owner-only endpoints require 'owner';
# admin endpoints allow 'owner'|'admin'. A customer (or anon) is refused regardless of the UI.
async def _owner_ctx(authorization: str) -> dict:
    user = await brain_auth.verify_token(_bearer(authorization))
    if not user:
        raise HTTPException(401, "unauthorized")
    email = (user.get("email") or "").strip()
    role, is_master = brain_auth.resolve_role(email, brain_auth.has_oauth_identity(user))
    return {"user": user, "email": email, "role": role, "is_master_owner": is_master}


async def require_owner(authorization: str = Header(default="")) -> dict:
    ctx = await _owner_ctx(authorization)
    if ctx["role"] != "owner":
        raise HTTPException(403, "owner only")
    return ctx


async def require_admin(authorization: str = Header(default="")) -> dict:
    ctx = await _owner_ctx(authorization)
    if ctx["role"] not in ("owner", "admin"):
        raise HTTPException(403, "admin or owner only")
    return ctx


async def require_owner_or_key(authorization: str = Header(default="")) -> dict:
    """DEPRECATED, UNUSED — do not reach for this on a new route (2026-07-27).

    It accepts the shared machine key, and that key ships inside the APK as a string literal, so a
    route wearing this dependency is a route any APK holder can call. The CRM moved to
    `require_cr_session`; the app rail moved to `require_app_user`. It is left in place only because
    another agent may be mid-flight against it; delete it once nothing imports it.

    CRM dual-auth: the shared machine key (the Android app) OR a signed-in owner/admin bearer.
    The machine-key compare runs FIRST and is constant-time + independent of Supabase reachability, so
    the live app is never locked out and never pays a Supabase round-trip. Only human requests (no key)
    fall through to bearer→role. Returns a context dict (via='key'|'bearer'|'dev')."""
    if config.ROCOTO_API_KEY and hmac.compare_digest(authorization, f"Bearer {config.ROCOTO_API_KEY}"):
        return {"via": "key", "role": "owner", "email": "", "user": None, "is_master_owner": False}
    user = await brain_auth.verify_token(_bearer(authorization))
    if user:
        email = (user.get("email") or "").strip()
        role, is_master = brain_auth.resolve_role(email, brain_auth.has_oauth_identity(user))
        if role in ("owner", "admin"):
            return {"via": "bearer", "role": role, "email": email, "user": user,
                    "is_master_owner": is_master}
        raise HTTPException(403, "owner or admin only")
    # Dev fall-open only when NO key is configured and not prod (mirrors require_key's posture).
    if not config.ROCOTO_API_KEY and not config.IS_PROD:
        return {"via": "dev", "role": "owner", "email": "", "user": None, "is_master_owner": False}
    raise HTTPException(401, "unauthorized")


# ─────────────── Control Room human SESSIONS (WP-9 cr-auth) ───────────────
# Real login for the CR: an OAuth-elevated owner/admin (brain.auth) is exchanged for a SERVER-SIDE
# session (cr_session) carried on an httpOnly+Secure+SameSite=Strict cookie. This REPLACES the
# localStorage machine-key gate for the human CR. The shared ROCOTO_API_KEY stays valid ONLY for the
# Android app's own runtime endpoints (require_owner_or_key) — NEVER for refunds / data-erase.
import cr_auth  # noqa: E402
from cr_auth import _client_ip, require_cr_cap, require_cr_session  # noqa: E402


def _require_test_mode() -> None:
    """Gate the /api/test/* seeder endpoints behind the land-dark TEST_MODE_ENABLED flag (owner-gated
    on top of this). Mirrors _require_seed()."""
    if not config.TEST_MODE_ENABLED:
        raise HTTPException(403, "test mode disabled (TEST_MODE_ENABLED=false)")


def _require_subscriber(x_medusa_subscriber_token: str = Header(default="")) -> None:
    """Guard the localhost-only /internal/catalogue/* endpoints the Medusa product subscriber calls."""
    if not hmac.compare_digest(x_medusa_subscriber_token or "", config.MEDUSA_SUBSCRIBER_TOKEN or ""):
        raise HTTPException(403, "bad subscriber token")

@router.get("/healthz")
async def healthz() -> JSONResponse:
    """Thickened liveness (WP-0.5): process + DB reachability + background-unit heartbeats. Returns HTTP
    200 unless the DB itself is unreachable (503); background-unit STALENESS is surfaced in the body
    (a `degraded` list), never a 503 — so a watchdog polling this can't restart-loop the service on a
    slow sweep, while a silently-dead worker/sweep is still visible (the agentmemory-died-6-days mode)."""
    import worker_policy
    out = {"ok": True, "ts": int(time.time()), "degraded": [],
           "release_commit": config._env("ROCOTO_RELEASE_COMMIT"),
           "release_product_sha256": config._env("ROCOTO_RELEASE_PRODUCT_SHA256"),
           "worker_policy": worker_policy.state()}
    try:
        async with supa.get_pool().acquire() as con:
            await con.fetchval("select 1")
        out["db"] = "ok"
    except Exception as e:
        out["ok"] = False
        out["db"] = f"down: {e.__class__.__name__}"
        return JSONResponse(out, status_code=503)
    # IS THE DATABASE'S OWN WALL UP? (WP-E). The runtime pool connecting as the OWNER means FORCE ROW
    # LEVEL SECURITY binds nothing and tenant isolation is app-code-only — a posture that used to
    # exist only as one line of boot chatter, unreadable from outside the box. It is a fact about the
    # process, so it belongs where the other facts about the process are: `forced` false is the
    # answer to "is one house's data one bug away from another's". Never a 503 on its own (a box with
    # the wall down still serves; a watchdog restarting it would not raise the wall).
    try:
        out["rls"] = await supa.rls_status()
        if not out["rls"].get("forced"):
            out["degraded"].append("rls-owner-pool")
    except Exception as e:
        out["rls"] = f"err: {e.__class__.__name__}"
    try:
        import ops
        hb = await ops.heartbeats()
        out["heartbeat"] = hb
        if hb.get("worker", 10**9) > int(os.environ.get("HB_WORKER_MAX_SEC", "300")):
            out["degraded"].append("worker-stale")
        if "sweep" in hb and hb["sweep"] > int(os.environ.get("HB_SWEEP_MAX_SEC", "108000")):  # 30h
            out["degraded"].append("sweep-stale")
    except Exception as e:
        out["heartbeat"] = f"err: {e.__class__.__name__}"
    # B3 (2026-07-26): with the ConvAI fallback deleted, "our mind is missing" means CALLS FAIL — so it
    # must be visible standing, not only at the moment someone dials. This is the signal that would have
    # caught the 2026-07-26 incident before a caller did.
    try:
        import voice_toggle
        out["voice_mind"] = bool(el_bridge.configured() and voice_toggle.healthy())
        out["voice_caller_marker"] = voice_toggle.caller_marker_status()
        if not out["voice_mind"]:
            out["degraded"].append("voice-mind-down")
    except Exception as e:
        out["voice_mind"] = f"err: {e.__class__.__name__}"
        out["degraded"].append("voice-mind-down")
    # CAN THE MIND ACTUALLY THINK? (2026-07-27). On 2026-07-27 the model key ran out of credit on prod
    # and this endpoint went on answering {"ok":true,"degraded":[]} — it watched the process, the DB and
    # the background heartbeats, and had no opinion about the one faculty the product IS. A dead mind
    # read as a healthy box. `mindcheck` answers off REAL traffic first and falls back to a hard-cached
    # one-token probe only when nothing recent has been observed (this trade is bursty: orders land
    # 05:00-07:00, so a key that dies at midnight would otherwise be found by a restaurant, not by us).
    # Still a 200: a watchdog that restart-loops the box because a model PROVIDER is down would turn a
    # billing problem into an outage. Same contract as heartbeat staleness — visible, never fatal.
    try:
        import mindcheck
        _m = await mindcheck.status()
        out["mind"] = _m["state"] if not _m.get("detail") else f"{_m['state']}: {_m['detail']}"
        if _m["state"] == "down":
            out["degraded"].append("mind-down")
            await mindcheck.report_if_down(_m)   # records ONCE per outage; re-armed on recovery
        elif _m["state"] == "unknown":
            out["degraded"].append("mind-unknown")
    except Exception as e:
        out["mind"] = f"err: {e.__class__.__name__}"
    return JSONResponse(out, status_code=200)


def _public_identity_config() -> dict:
    """Only an explicitly public IdP identifier may enter browser bootstrap."""
    import base64
    public_key = config.SUPABASE_ANON_KEY
    permitted = public_key.startswith("sb_publishable_")
    if not permitted and len(public_key) <= 8192:
        try:
            part = public_key.split(".")[1]
            claims = json.loads(base64.urlsafe_b64decode(part + "=" * (-len(part) % 4)))
            permitted = isinstance(claims, dict) and claims.get("role") == "anon"
        except (ValueError, IndexError, TypeError):
            permitted = False
    return {"supabaseUrl": config.SUPABASE_URL if permitted else "",
            "supabaseAnonKey": public_key if permitted else ""}


@router.get("/api/config")
def api_config() -> JSONResponse:
    """Public client bootstrap: the browser-safe config the static landing/wizard fetches on mount.
    The catchment map is a FREE keyless stack (Leaflet + CARTO tiles + Photon geocoding) and covered
    neighbourhoods are simple map pins, so no client token is needed and this returns an empty object.
    Kept (all but empty) so any old bootstrap fetch is harmless. Only PUBLIC values ever go here;
    never a secret.

    §17.56c — `consent` is the CANONICAL checkbox wording plus its version, served from the same
    constant the stored `text_shown` is written from (consent.py). It rides here rather than being
    duplicated in the SPA because a sentence typed twice is a sentence that drifts, and the drift is
    only discovered when somebody asks us to evidence what they agreed to. It is public by nature:
    it is the text we are about to show a stranger, before any session exists."""
    import consent as _consent
    return JSONResponse({"consent": _consent.wording(), "identity": _public_identity_config()},
                        headers={"Cache-Control": "public, max-age=300"})


# ──────────────────────────── Twilio inbound webhook ────────────────────────────
@router.get("/meta/whatsapp/webhook")
async def meta_wa_verify(request: Request) -> Response:
    """Meta Cloud API webhook VERIFY handshake (the cloud rail, whatsapp_cloud.py): echo
    hub.challenge iff hub.verify_token matches. Configured in the Vitrina app's webhook settings."""
    q = request.query_params
    if q.get("hub.mode") == "subscribe" and config.WA_CLOUD_VERIFY_TOKEN \
            and q.get("hub.verify_token") == config.WA_CLOUD_VERIFY_TOKEN:
        return Response(content=q.get("hub.challenge", ""), media_type="text/plain")
    raise HTTPException(403, "verify token mismatch")


@router.post("/meta/whatsapp/webhook")
async def meta_wa_webhook(request: Request) -> Response:
    """Meta Cloud API inbound (the cloud rail): messages[] ride the SAME pipeline as the Twilio
    route (store → spine ingest → debounced turn → notify); statuses[] failed/undelivered go to
    _meta_status_failed — the ordinary alerting contract (ops.wa_send_failed + parked action) for a
    message, the reaction-specific one (ops.reaction_failed + projection rollback) for a reaction.
    Signature: X-Hub-Signature-256 (HMAC-SHA256, FB_APP_SECRET) — always enforced; an unset secret
    refuses every request rather than accepting every request.
    Always 200 for a VERIFIED body (Meta retries on non-2xx; our dedupe keys make retries no-ops)."""
    import hashlib
    import hmac as _hmac
    raw = await request.body()
    if not config.allow_unsigned_webhooks():
        secret = config.FB_APP_SECRET
        if not secret:
            log.error("refused Meta webhook: FB_APP_SECRET unset, so no request can be verified")
            raise HTTPException(403, "invalid meta signature")
        sig = (request.headers.get("X-Hub-Signature-256", "") or "").removeprefix("sha256=")
        want = _hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()
        if not _hmac.compare_digest(sig, want):
            log.warning("rejected unsigned/forged Meta webhook")
            raise HTTPException(403, "invalid meta signature")
    try:
        payload = json.loads(raw or b"{}")
    except Exception:
        return Response(status_code=200)
    for entry in payload.get("entry") or []:
        for change in entry.get("changes") or []:
            value = change.get("value") or {}
            # ── ⓪ WHOSE NUMBER DID THIS ARRIVE ON? (2026-07-27, the multi-tenancy pass) ──────────
            # `value.metadata.phone_number_id` has ridden every Meta webhook since day one and was
            # read by NOTHING: the whole inbound path defaulted to `config.BRAIN_TENANT`, so a second
            # distributor's customer would have been matched against the FIRST distributor's
            # catalogue, filed on his order book, and shown on his review sheet. It is the business
            # line the customer wrote TO, which is exactly the distributor — the only tenant key that
            # exists before any scope does. Resolved ONCE per change and threaded from here to the
            # queue, the drainer, the pipeline and the order row.
            # UNKNOWN NUMBER → BRAIN_TENANT + LOUD (ops log + dead_letter, once per number), never a
            # drop and never a guess: `tenants.wa_phone_number_id` may still be unbound on a live box,
            # and a fail-closed resolver there is a silent outage on Peter's own line.
            import tenancy as _tenancy
            _wa_tenant, _wa_tenant_known = await _tenancy.tenant_for_wa_number_id(
                (value.get("metadata") or {}).get("phone_number_id") or "")
            # ── ⓪b COEXISTENCE ARRIVES AS A DIFFERENT FIELD, NOT AS `messages` (2026-08-17) ────
            # A coexistence number is answered by two clients: the owner's thumb in the WhatsApp
            # Business app, and us. Meta carries that in three fields whose payload arrays are named
            # `history[]`, `state_sync[]` and `message_echoes[]` — so the `value["messages"]` reader
            # below is structurally blind to all three, and we would have subscribed to them and
            # dropped every one on the floor.
            #
            # The echo is the one that matters every day: without it the owner answers a restaurant
            # on his phone, we never see it, and Rocoto answers the same question again an hour
            # later — in front of his customer, in a way he cannot explain.
            #
            # Dispatched AFTER the tenant is resolved above, because every coexistence field carries
            # the same `value.metadata.phone_number_id` and the router already answers whose it is.
            _field = str(change.get("field") or "").strip().lower()
            if _field == "calls":
                # WhatsApp calling. Handled even though we cannot carry audio yet, and BECAUSE we
                # cannot: `call_icon_visibility: DISABLE_ALL` does not stop inbound calls (Meta
                # lists four surviving entry points), so a number we do not serve WILL ring. A call
                # that rings out reads as a business that has gone under; one that declines at once
                # with a message landing in the chat reads as a business that answers in writing.
                try:
                    import wa_calling as _calling
                    await _calling.handle(value, _wa_tenant)
                except Exception:
                    log.exception("calls webhook failed (fail-soft)")
                continue
            if _field in ("history", "smb_app_state_sync", "smb_message_echoes"):
                try:
                    import wa_coexistence as _coex
                    await _coex.handle(_field, value, _wa_tenant)
                except Exception:
                    log.exception("coexistence webhook %s failed (fail-soft)", _field)
                continue

            contacts = {c.get("wa_id"): (c.get("profile") or {}).get("name", "")
                        for c in value.get("contacts") or []}
            for m in value.get("messages") or []:
                frm = _norm("+" + (m.get("from") or ""))
                mid_wa = m.get("id") or ""
                profile = contacts.get(m.get("from"), "")
                body = ""
                if m.get("type") == "text":
                    body = ((m.get("text") or {}).get("body") or "").strip()
                elif m.get("type") == "button":
                    body = ((m.get("button") or {}).get("text") or "").strip()
                mt_raw = m.get("type") or ""
                # ── ONE-TAP ANSWER (2026-07-26): the reply to an ask_options question. A tap is a
                # REAL answer, not presence: it rides the SAME text path below (row → ingest → wake)
                # so an open loop closes exactly as if they had typed it. The chosen TITLE is the
                # body (the thread reads naturally); the chosen option ID + the wamid we ASKED with
                # (context.id) ride the spine payload, so the mind knows precisely which question
                # was answered and with which option.
                opt_id = ""
                asked_wamid = ""
                if mt_raw == "interactive":
                    _ia = m.get("interactive") or {}
                    _pick = _ia.get(_ia.get("type") or "") or {}
                    body = (_pick.get("title") or "").strip()
                    opt_id = (_pick.get("id") or "").strip()
                    asked_wamid = ((m.get("context") or {}).get("id") or "").strip()
                if frm and not body and mt_raw in ("audio", "voice", "image", "document"):
                    asyncio.create_task(_meta_inbound_media(m, frm, mid_wa, profile, mt_raw,
                                                            tenant=_wa_tenant))
                    continue  # voice note / photo / document — full control like a person
                if frm and mt_raw == "reaction":
                    # a 👍 on a message is PRESENCE, not a turn — sensed + projected, never dropped
                    # (previously fell through `not (frm and body)` and vanished).
                    asyncio.create_task(_meta_inbound_reaction(m, frm, mid_wa, profile))
                    continue
                if not (frm and body):
                    # THE DOOR TELLS THE TRUTH (2026-07-26): anything we don't explicitly handle used
                    # to vanish here with no trace — a pin, a poll vote, a location, a sticker, an
                    # 'unsupported' notice. We could not even answer "did Meta send it?". Now every
                    # unhandled inbound type is logged + dead-lettered ONCE so the sensing door is
                    # never a black hole. (Not a turn: it must never wake the mind.)
                    if frm and mt_raw:
                        _det = {k: v for k, v in m.items() if k not in ("from", "id", "timestamp")}
                        log.warning("meta inbound UNHANDLED type=%s from=%s payload=%s",
                                    mt_raw, frm, json.dumps(_det)[:600])
                        try:
                            async with supa.get_pool().acquire() as _dc:
                                await _dc.execute(
                                    "insert into dead_letter(source,reason,raw,problem) values($1,$2,$3,$4)",
                                    "meta", f"unhandled_type:{mt_raw}", json.dumps(m)[:4000],
                                    f"inbound {mt_raw} reached the door but nothing handles it")
                        except Exception:
                            log.debug("unhandled-type dead_letter fail-soft", exc_info=True)
                    continue
                # WHAT, not WHAT WAS SAID: a length and an id place the message in the journal
                # without publishing a customer's sentence to it. The message itself is already
                # stored, encrypted, on the row this line is about — the journal is not a second
                # copy of the conversation with weaker custody than the first.
                log.info("meta inbound from=%s chars=%d wamid=%s%s", frm, len(body), mid_wa[:24],
                         f" [tap {opt_id} on {asked_wamid[:24]}]" if opt_id else "")
                mid = str(uuid.uuid4())
                _row = {
                    "id": mid, "phone_number": frm, "role": "user",
                    "message_text": body, "message_type": "text",
                    "wa_message_id": mid_wa, "created_at": supa.now_iso(),
                    "tenant_id": _wa_tenant,
                }
                if asked_wamid:
                    # quote the message we asked with — the thread shows the tap under our question.
                    _row["reply_to_wa_id"] = asked_wamid
                try:
                    await supa.upsert_profile(frm, profile)
                    await supa.insert_message(_row)
                except asyncpg.UniqueViolationError:
                    continue  # Meta re-delivery — already stored
                except Exception:
                    log.exception("meta inbound store failed")
                try:
                    import runtime
                    _extra = ({"interactive": {"option_id": opt_id, "option_title": body,
                                               "asked_wamid": asked_wamid,
                                               "reply_type": (m.get("interactive") or {}).get("type", "")}}
                              if opt_id else None)
                    await runtime.ingest_inbound(frm, body, dedupe_key=mid_wa, profile=profile,
                                                 extra=_extra, tenant=_wa_tenant)
                except Exception:
                    log.debug("meta inbound spine ingest fail-soft", exc_info=True)
                if opt_id:
                    # ⑤ THE TAP CLOSES THE LOOP (SPEC §5.7, gap named by WP-2 and closed here).
                    # A one-tap answer to a disambiguation question is the whole point of §5.7: it
                    # becomes an `sku_aliases` row and that word is never asked about again. On the
                    # CLOUD rail that never happened — this branch does not call `_maybe_extract_order`,
                    # so the tap never entered the order-brain queue and never reached
                    # `pipeline._resolve_taps`. Only the Twilio rail and the media path closed it.
                    # `resolve_doubt_tap` is public and takes exactly the three values already in hand,
                    # so the fix is this call and nothing else. Fire-and-forget + fail-soft inside: a
                    # learning write must never delay (or fail) the webhook we have to 200.
                    # A tap answers exactly ONE open question, and the two resolvers below each only
                    # act on the kind of question THEY asked (`doubt.asked` vs
                    # `order_confirm.asked` — 2026-07-27) — a tap answering a doubt question is a
                    # structural no-op to the order-confirm resolver and vice versa, so trying both
                    # is correct rather than a guess at which one applies.
                    async def _tap(_p=frm, _oid=opt_id, _t=body, _w=asked_wamid) -> None:
                        try:
                            from brain import pipeline as _pl
                            await _pl.resolve_doubt_tap(_p, asked_wamid=_w, option_id=_oid,
                                                        option_title=_t)
                        except Exception:
                            log.debug("meta tap resolution fail-soft", exc_info=True)
                        try:
                            from brain import pipeline as _pl
                            await _pl.resolve_order_confirm_tap(_p, asked_wamid=_w, option_id=_oid,
                                                                option_title=_t)
                        except Exception:
                            log.debug("meta order-confirm tap resolution fail-soft", exc_info=True)
                    asyncio.create_task(_tap())
                if config.ROCOTO_TEXT_REPLY_ENABLED and not _re.search(r"\bbsk_[A-Za-z0-9]{6,}\b", body):
                    asyncio.create_task(voice_reply.maybe_reply_to_text(mid))
                asyncio.create_task(_notify(frm, profile, body))
                # ⑥ THE ORDER BRAIN RUNS ON THIS RAIL TOO (2026-07-27). Until now a plain TEXT order on
                # the CLOUD rail never reached the order brain — only the mind's gated `take_order` saw
                # it, which grounds through the matcher but skips the 5-scale pipeline, the
                # deterministic validators, the DOUBT faculty (§5.7a) and therefore every §5.8a review
                # reason (stock · range · too-big · ungrounded). Media (voice notes, photos) already
                # arrived through `_do_process_media`, shared by both rails — so the gap was text only,
                # and text is exactly what «ponme 10 kg de chorizo» is. Twilio has run the mind AND the
                # brain side by side on the same message since day one (see the identical pair below in
                # the Twilio branch), so the coexistence is proven rather than assumed; `enqueue` is
                # idempotent on the message id and the ~2-min burst window coalesces, so a duplicate
                # order is not a new risk. Same `bsk_` short-circuit: a storefront hand-off already
                # carries its own draft basket and re-extracting it would mint a second order.
                if not _re.search(r"\bbsk_[A-Za-z0-9]{6,}\b", body):
                    asyncio.create_task(_maybe_extract_order(mid, frm, profile, body,
                                                             tenant=_wa_tenant))
            for st in value.get("statuses") or []:
                if (st.get("status") or "").lower() in ("failed", "undelivered"):
                    await _meta_status_failed(st)
    return Response(status_code=200)


async def _meta_status_failed(st: dict) -> None:
    """ONE failed/undelivered delivery status off the cloud rail — the ONLY place that learns a send
    we already answered 200 for did not actually happen (WhatsApp accepts first, refuses later).

    TWO SHAPES, because they mean different things:

    · a REACTION wamid (2026-07-26) — a reaction to a >30-day-old / deleted / non-reactable message
      is accepted with a wamid and then refused ASYNCHRONOUSLY with error 131009. We had already
      evented msg.sent kind=reaction AND projected it, so the app showed a gesture the customer never
      saw. Now: the projection is ROLLED BACK (projector.unproject — the spine is append-only, so the
      msg.sent stays and this event corrects it via caused_by) and the failure is evented as
      `ops.reaction_failed`. No human is paged for a 131009: the target was invalid, the mouth is
      fine. Any OTHER error code on a reaction still parks the needs_human action — that one smells
      like a dead mouth.

    · anything else — the WP-0 contract, unchanged: `ops.wa_send_failed` + a parked needs_human
      action (the 63112 outage: a whole day of sends died while the logs said 'sent').

    Fail-soft (the webhook always answers 200; Meta retries and our dedupe keys make retries no-ops)."""
    status = (st.get("status") or "").lower()
    sid = st.get("id") or ""
    to = _norm("+" + (st.get("recipient_id") or ""))
    codes = [str(e.get("code")) for e in st.get("errors") or []]
    errs = ";".join(codes)
    log.error("META WA DELIVERY FAILED to=%s wamid=%s errors=%s", to, sid, errs)
    try:
        import db as _db
        import runtime as _rt
        import spine as _spine
        import whatsapp_cloud as _wc
        scope = _rt.scope_of(to)
        async with _db.scoped_tx(scope) as con:
            reacted = await con.fetchrow(
                "select id, payload from event where scope=$1::ltree and type='msg.sent' "
                "and payload->>'kind'='reaction' and payload->>'sid'=$2 order by id desc limit 1",
                scope, sid) if sid else None
            if reacted is not None:
                p = reacted["payload"] or {}
                msg_eid = int(reacted["id"])
                import projector as _proj
                rolled = await _proj.unproject(msg_eid)   # kill the phantom BEFORE we record why
                eid, is_new = await _spine.append_event(
                    con, scope, "ops.reaction_failed", "meta",
                    {"sid": sid, "error_code": errs, "to": to, "status": status,
                     "target_wamid": p.get("target_wamid", ""), "emoji": p.get("emoji", ""),
                     "msg_event_id": msg_eid, "rolled_back": rolled},
                    lane="reasoning", dedupe_key=f"reactfail:{sid}", caused_by=msg_eid)
                log.warning("reaction %s to %s FAILED async (errors=%s) — projection %s",
                            p.get("emoji", ""), (p.get("target_wamid") or "")[:40], errs,
                            "rolled back" if rolled else "already absent")
                # 131009 = the TARGET was invalid, not the mouth: evented, never paged.
                target_only = bool(codes) and set(codes) <= {_wc.ERR_REACTION_TARGET}
                if is_new and not target_only:
                    await con.execute(
                        "insert into action(scope,kind,payload,state,reason,needs_human,opened_by_event) "
                        "values($1::ltree,'wa_delivery_failed',$2,'pending',$3,true,$4)",
                        scope, {"sid": sid, "error_code": errs, "to": to, "kind": "reaction"},
                        f"WhatsApp (cloud) reaction failed ({errs}) — not a target error, the mouth may be down",
                        eid)
                return
            eid, is_new = await _spine.append_event(
                con, scope, "ops.wa_send_failed", "meta",
                {"sid": sid, "error_code": errs, "to": to, "status": st.get("status")},
                lane="reasoning", dedupe_key=f"wafail:{sid}")
            if is_new:
                await con.execute(
                    "insert into action(scope,kind,payload,state,reason,needs_human,opened_by_event) "
                    "values($1::ltree,'wa_delivery_failed',$2,'pending',$3,true,$4)",
                    scope, {"sid": sid, "error_code": errs, "to": to},
                    f"WhatsApp (cloud) delivery failed ({errs})", eid)
    except Exception:
        log.debug("meta status processing fail-soft", exc_info=True)


@router.post("/twilio/whatsapp/status")
async def twilio_wa_status(request: Request) -> Response:
    """Delivery-status callback for every outbound WhatsApp send (registered per-message by
    twilio_wa.send_whatsapp). THE POINT (2026-07-21): a SID is only 'accepted' — failures land
    HERE, async (the 63112 sender outage ate every send for a whole day while the logs said
    'sent'). A failed/undelivered status becomes an `ops.wa_send_failed` EVENT on the recipient's
    scope (visible in xray + the CR drill) AND a parked needs_human action (the review-sheet/alert
    surface) — a dead mouth pages a human, never dies silently. Fail-soft; always 204."""
    form = await request.form()
    _require_twilio_signature(request, f"{config.PUBLIC_BASE_URL}/twilio/whatsapp/status", form)
    status = (form.get("MessageStatus", "") or "").lower()
    if status in ("failed", "undelivered"):
        sid = form.get("MessageSid", "") or ""
        to = _norm(form.get("To", ""))
        err = form.get("ErrorCode", "") or ""
        log.error("WA DELIVERY FAILED to=%s sid=%s error=%s", to, sid, err)
        try:
            import db as _db
            import runtime as _rt
            import spine as _spine
            scope = _rt.scope_of(to)
            async with _db.scoped_tx(scope) as con:
                eid, is_new = await _spine.append_event(
                    con, scope, "ops.wa_send_failed", "twilio",
                    {"sid": sid, "error_code": err, "to": to, "status": status},
                    lane="reasoning", dedupe_key=f"wafail:{sid}")
                if is_new:
                    await con.execute(
                        "insert into action(scope,kind,payload,state,reason,needs_human,opened_by_event) "
                        "values($1::ltree,'wa_delivery_failed',$2,'pending',$3,true,$4)",
                        scope, {"sid": sid, "error_code": err, "to": to},
                        f"WhatsApp delivery failed (error {err}) — the mouth may be down", eid)
        except Exception:
            log.debug("wa status-callback processing fail-soft", exc_info=True)
    return Response(status_code=204)


@router.post("/twilio/whatsapp/incoming")
async def twilio_incoming(request: Request) -> Response:
    form = await request.form()
    # Reject forged/unsigned requests — this is a public endpoint.
    _require_twilio_signature(request, f"{config.PUBLIC_BASE_URL}/twilio/whatsapp/incoming", form)
    frm = _norm(form.get("From", ""))
    body = (form.get("Body", "") or "").strip()
    profile = form.get("ProfileName", "") or ""
    msg_sid = form.get("MessageSid", "") or ""
    num_media = int(form.get("NumMedia", "0") or "0")
    # the retired rail gets the same routing rule, keyed on the line it was sent TO (Twilio's `To`,
    # `whatsapp:+34…`). Unknown → BRAIN_TENANT + loud, exactly as on the cloud rail.
    import tenancy as _tenancy
    _wa_tenant, _ = await _tenancy.tenant_for_wa_number(_norm(form.get("To", "")))
    log.info("inbound from=%s media=%d chars=%d sid=%s", frm, num_media, len(body), msg_sid)

    if frm:
        await supa.upsert_profile(frm, profile)

    if num_media == 0:
        mid = str(uuid.uuid4())
        try:
            await supa.insert_message({
                "id": mid, "phone_number": frm, "role": "user",
                "message_text": body, "message_type": "text",
                "wa_message_id": msg_sid, "created_at": supa.now_iso(),
                "tenant_id": _wa_tenant,
            })
        except asyncpg.UniqueViolationError:
            # Twilio re-delivered a webhook we already stored (idx_wamsg_wa_message_id) — ack + drop.
            log.info("dup webhook (MessageSid=%s) — already stored, skipping", msg_sid)
            return Response(content="<Response></Response>", media_type="application/xml")
        # ① SENSE — append the inbound as an EVENT on the spine NOW, so EVERY message (even a
        # burst-superseded one) is in the log and the debounced turn assembles over the full burst
        # (SPEC §4.5 ① / §4.6). Idempotent on the Twilio MessageSid. Fail-soft.
        if body:
            try:
                import runtime
                await runtime.ingest_inbound(frm, body, dedupe_key=msg_sid, profile=profile,
                                             tenant=_wa_tenant)
            except Exception:
                log.debug("inbound spine ingest fail-soft", exc_info=True)
        if config.ROCOTO_TEXT_REPLY_ENABLED and body and not _re.search(r"\bbsk_[A-Za-z0-9]{6,}\b", body):
            # Basic conversational text reply (sales line) — storefront bsk_ handoffs excluded.
            asyncio.create_task(voice_reply.maybe_reply_to_text(mid))
        asyncio.create_task(_notify(frm, profile, body or "Mensaje nuevo"))
        # A custom-order handoff from the storefront carries a bsk_ reference. Short-circuit the order
        # extractor — the draft basket already drives the in-chat BasketRequestCard (via conversationBaskets);
        # re-extracting the prefilled text would create a duplicate order (medusa-integration.md §7).
        if not _re.search(r"\bbsk_[A-Za-z0-9]{6,}\b", body):
            asyncio.create_task(_maybe_extract_order(mid, frm, profile, body, tenant=_wa_tenant))
        return Response(content="<Response></Response>", media_type="application/xml")

    for i in range(num_media):
        url = form.get(f"MediaUrl{i}", "")
        ctype = (form.get(f"MediaContentType{i}", "") or "").split(";")[0].strip()
        mtype = (
            "image" if ctype.startswith("image/")
            else "audio" if ctype.startswith("audio/")
            else "document" if ctype == "application/pdf"
            else "video" if ctype.startswith("video/")
            else "file"
        )
        row = {
            "id": str(uuid.uuid4()), "phone_number": frm, "role": "user",
            "message_text": body if i == 0 else "", "message_type": mtype,
            "media_urls": [], "media_types": [ctype],
            "wa_message_id": f"{msg_sid}-{i}" if num_media > 1 else msg_sid,
            "transcript_status": "pending" if mtype in ("audio", "image", "document") else "none",
            # Stash the Twilio source URL so a restart can retry transcription (startup sweep).
            "transcript_meta": {"src": url} if mtype in ("audio", "image", "document") else {},
            "created_at": supa.now_iso(), "tenant_id": _wa_tenant,
        }
        try:
            rec = await supa.insert_message(row)
        except asyncpg.UniqueViolationError:
            # This SPECIFIC item ({MessageSid}-{i}) was already stored — but a partial multi-media
            # delivery + a Twilio retry means OTHER items in this batch may still be missing. CONTINUE
            # (skip just this one, keep inserting the rest) instead of returning, so the un-stored items
            # aren't permanently dropped (review F1). Each item has its own unique wa_message_id.
            log.info("dup webhook item (MessageSid=%s, media %d) — already stored, skipping this item",
                     msg_sid, i)
            continue
        asyncio.create_task(_process_media(rec.get("id") or row["id"], url, ctype, mtype, body))
        if i == 0:
            asyncio.create_task(_notify(frm, profile, body or PREVIEW.get(mtype, "Mensaje nuevo")))

    return Response(content="<Response></Response>", media_type="application/xml")


async def _notify(phone: str, profile: str, preview: str) -> None:
    """Fire an FCM push for an inbound message (buzzes the app even when closed). The notification
    reads like the inbox: title = the saved BUSINESS name (not the sender's personal WhatsApp name),
    body = the message preview."""
    try:
        tokens = await supa.get_tokens()
        if not tokens:
            return
        # Prefer the saved business name (seeded/operator-set); fall back to the WhatsApp ProfileName.
        saved = ""
        try:
            st = await supa.get_customer_settings(phone)
            saved = (st or {}).get("display_name", "") or ""
        except Exception:
            pass
        title = saved or profile or phone
        dead = await asyncio.to_thread(fcm.push_to_all, tokens, title, preview,
                                       {"phone": phone, "name": title})
        for tok in dead:
            await supa.delete_token(tok)
    except Exception:
        log.exception("notify failed")


async def _process_media(msg_id: str, url: str, ctype: str, mtype: str, caption: str) -> None:
    async with _SEM:
        await _do_process_media(msg_id, url, ctype, mtype, caption)


async def _transcribe_outgoing(msg_id: str, data: bytes, ctype: str) -> None:
    """Transcribe an operator-sent voice note (we already have the bytes in memory). Outbound, so we
    skip order extraction — this is purely so the chat shows what WE said."""
    async with _SEM:
        try:
            ct = (ctype or "audio/ogg").split(";")[0].strip()
            dg = await tx.deepgram_diarize(data, ct)
            raw, utts = tx.parse_utterances(dg)
            polished = await asyncio.to_thread(tx.polish_sync, raw)
            dur = (dg.get("metadata") or {}).get("duration")
            await supa.update_message(msg_id, {
                "transcript": polished, "transcript_status": "done",
                "transcript_meta": {
                    "utterances": utts, "raw": raw,
                    "num_speakers": len({u["speaker"] for u in utts}),
                    "duration_sec": (float(dur) if dur else None),
                },
            })
            log.info("transcribed outgoing voice note %s", msg_id)
        except Exception:
            log.exception("outgoing transcription failed for %s", msg_id)
            try:
                await supa.update_message(msg_id, {"transcript_status": "error"})
            except Exception:
                pass


async def _meta_inbound_media(m: dict, frm: str, mid_wa: str, profile: str, mt_raw: str,
                              tenant: str | None = None) -> None:
    """Cloud-rail inbound VOICE NOTE / photo / document: store the message, fetch the Meta media with
    the token, and ride the SAME _do_process_media pipeline as Twilio (transcribe/OCR -> ingest -> reply)."""
    media = m.get(mt_raw) or m.get("audio") or m.get("voice") or {}
    media_id = media.get("id")
    ctype = media.get("mime_type", "")
    cap = (media.get("caption") or "").strip()
    mtype = "audio" if mt_raw in ("audio", "voice") else ("image" if mt_raw == "image" else "document")
    if not media_id:
        return
    mid = str(uuid.uuid4())
    try:
        await supa.upsert_profile(frm, profile)
        await supa.insert_message({
            "id": mid, "phone_number": frm, "role": "user", "message_text": cap,
            "message_type": mtype, "transcript_status": "pending",
            "wa_message_id": mid_wa, "created_at": supa.now_iso(),
            # the tenant is STORED here because `_do_process_media` → `_extract_for_msg` runs on a
            # detached task that carries only the message id; it re-reads the tenant from this row
            # rather than defaulting (which is how the media rail would have gone single-tenant
            # again even after the text rail was fixed).
            "tenant_id": tenant or config.BRAIN_TENANT})
    except asyncpg.UniqueViolationError:
        return  # Meta re-delivery
    except Exception:
        log.exception("meta inbound media store failed"); return
    try:
        import whatsapp_cloud as _wc
        data, real_ct = await _wc.download_media(media_id)
        await _do_process_media(mid, None, ctype, mtype, cap, data=data, real_ct=real_ct)
    except Exception:
        log.exception("meta media download/process failed for %s", mid)
    asyncio.create_task(_notify(frm, profile, f"[{mtype}]"))


async def _meta_inbound_reaction(m: dict, frm: str, mid_wa: str, profile: str) -> None:
    """Cloud-rail inbound REACTION (presence suite, 2026-07-25): someone 👍s/❤️s one of our messages.
    Lands as (a) ONE whatsapp_messages projection row — message_type='reaction', message_text=the
    emoji, reply_to_wa_id=the reacted wamid — so the app/CR SEE the gesture in the thread, and
    (b) ONE spine event `msg.reaction` on the party's scope via runtime.emit_sense — a SENSE, not a
    turn (SPEC §5.0): an emoji never wakes the mind; the next turn just knows. An EMPTY emoji is
    Meta's 'reaction removed' (payload.removed=true, row text=''). Idempotent on the reaction's own
    wamid (the whatsapp_messages unique index + the event dedupe key make redeliveries no-ops)."""
    r = m.get("reaction") or {}
    emoji = (r.get("emoji") or "").strip()
    target = (r.get("message_id") or "").strip()
    if not target:
        return  # a reaction always points at a message; without it there is nothing to sense
    log.info("meta inbound reaction from=%s emoji=%r target=%s", frm, emoji, target[:40])
    mid = str(uuid.uuid4())
    try:
        await supa.upsert_profile(frm, profile)
        await supa.insert_message({
            "id": mid, "phone_number": frm, "role": "user",
            "message_text": emoji, "message_type": "reaction",
            "wa_message_id": mid_wa, "reply_to_wa_id": target,
            "created_at": supa.now_iso(),
        })
    except asyncpg.UniqueViolationError:
        return  # Meta re-delivery — already stored (and the event already appended)
    except Exception:
        log.exception("meta inbound reaction store failed")
    try:
        import runtime
        await runtime.emit_sense(
            phone=frm, type="msg.reaction", source="meta",
            payload={"emoji": emoji, "target_wamid": target, "wamid": mid_wa,
                     "removed": not emoji},
            dedupe_key=f"react:{mid_wa}")
    except Exception:
        log.debug("meta reaction spine ingest fail-soft", exc_info=True)


async def _do_process_media(msg_id: str, url: str, ctype: str, mtype: str, caption: str,
                            data: "bytes | None" = None, real_ct: "str | None" = None,
                            tenant: "str | None" = None) -> None:
    try:
        if data is None:
            data, real_ct = await twa.download_media(url)   # Twilio rail (auth in twa)
        ctype2 = (real_ct or ctype).split(";")[0].strip()
        ext = EXT.get(ctype2, "bin")
        (MEDIA_DIR / f"{msg_id}.{ext}").write_bytes(data)
        public = f"{config.PUBLIC_BASE_URL}/media/{msg_id}.{ext}"
        patch: dict = {"media_urls": [public]}

        if mtype == "audio":
            # THE CUSTOMER'S VOICE NOTE — the live rail, biased by this supplier's own article names
            # (Carlos, 2026-08-19: a harder note «no lo ha transcrito bien»). Same organ, same
            # fail-soft: no catalogue, no keyterms, still a transcription.
            _kt = await tx.catalogue_keyterms(tenant or config.BRAIN_TENANT)
            dg = await tx.deepgram_diarize(data, ctype2, keyterms=_kt)
            raw, utts = tx.parse_utterances(dg)
            polished = await asyncio.to_thread(tx.polish_sync, raw)
            dur = (dg.get("metadata") or {}).get("duration")  # real audio length (seconds)
            # PERCEPTION (organ ② sensing, Peter 2026-07-22): classify transcription confidence AT THE
            # SENSE, before any reasoning ever sees this text (confidence.py — dirty audio → review).
            try:
                import confidence as _conf
                conf = _conf.classify(utts)
            except Exception:
                conf = {"level": "shaky", "review": True, "reason": "confidence classify failed — review"}
            patch.update({
                "transcript": polished, "transcript_status": "done",
                "transcript_meta": {
                    "utterances": utts, "raw": raw,
                    "num_speakers": len({u["speaker"] for u in utts}),
                    "duration_sec": (float(dur) if dur else None),
                    "confidence": conf,
                },
            })
        elif mtype == "image":
            text = await asyncio.to_thread(tx.ocr_image_sync, data, ctype2, caption)
            patch.update({"transcript": text, "transcript_status": "done"})
        elif mtype == "document":
            raw = await asyncio.to_thread(tx.extract_pdf_text, data)
            if raw:
                polished = await asyncio.to_thread(tx.polish_document_sync, raw)
                patch.update({"transcript": polished, "transcript_status": "done"})
            else:
                # No selectable text (scanned PDF) — fall back to nothing rather than a wrong claim.
                patch.update({
                    "transcript": "(No selectable text in this document.)",
                    "transcript_status": "done",
                })

        await supa.update_message(msg_id, patch)
        log.info("processed media %s (%s)", msg_id, mtype)
        # SENSE — a photo/doc is a message on the spine (SPEC §4.5①), even though no reply rail fires for
        # it. (Audio ingests via the voice-note reply → run_turn, so scope this to image/document to avoid
        # a double append.) Idempotent on the media id.
        if mtype in ("image", "document"):
            _tr = (patch.get("transcript") or caption or "").strip()
            if _tr and patch.get("transcript_status") == "done":
                try:
                    import runtime
                    _m = await supa.get_message(msg_id)
                    _ph = (_m or {}).get("phone_number") or ""
                    if _ph:
                        await runtime.ingest_inbound(_ph, _tr, dedupe_key=f"media:{msg_id}", source="wa")
                except Exception:
                    log.debug("media spine ingest fail-soft", exc_info=True)
        # Phase-A: extract an order from the transcript (voice/photo/doc), best-effort.
        extract_text = (patch.get("transcript") or caption or "").strip()
        if extract_text and patch.get("transcript_status") == "done":
            asyncio.create_task(_extract_for_msg(msg_id, extract_text))
        # Workstream C — voice-note ↔ voice-note reply. Only when the transcript is DONE and this is
        # an inbound VOICE NOTE: fire Rocoto's spoken reply async (guards + fail-soft live inside the
        # module; the maybe_reply_to_voice_note re-checks role/type + burst before doing anything).
        # LANDS DARK: no-op until config.ROCOTO_VOICE_REPLY_ENABLED is flipped on the box.
        if mtype == "audio" and patch.get("transcript_status") == "done":
            # THE TENANT'S OWN SWITCH IS DECIDED HERE, NOT INSIDE THE RAIL (2026-08-16), because the
            # `else` below is the thing that keeps a customer from being IGNORED: it routes the
            # transcript to the mind so Rocoto still answers, in text. `configured()` is box-wide
            # (creds + one env flag) and has been true for every tenant at once, so until now
            # `tenants.behaviour.voice` — the switch /demo and the panel both write — changed
            # nothing. Deciding inside `maybe_reply_to_voice_note` would have skipped this fallback
            # and turned «Solo texto» into silence, which is a worse product than the bug.
            _m = await supa.get_message(msg_id)
            _ph = ((_m or {}).get("phone_number") or "").strip()
            _speak = bool(voice_reply.configured() and config.ROCOTO_VOICE_REPLY_ENABLED and _ph)
            if _speak:
                try:
                    _speak = (await voice_reply.voice_posture(_ph)) != "never"
                except Exception:
                    log.debug("voice posture read fail-soft for %s", _ph, exc_info=True)
            if _speak:
                asyncio.create_task(voice_reply.maybe_reply_to_voice_note(msg_id))
            else:
                # voice-note reply dark (box flag off, or this tenant chose «Solo texto») -> still
                # route the transcript to the mind so Rocoto hears the voice note like a person and
                # replies (text/actions). Idempotent on the media id.
                _tr = (patch.get("transcript") or "").strip()
                if _tr and _ph:
                    try:
                        import runtime as _rt
                        await _rt.ingest_inbound(_ph, _tr, dedupe_key=f"media:{msg_id}", source="wa")
                    except Exception:
                        log.debug("audio spine ingest fail-soft", exc_info=True)
    except Exception:
        log.exception("media processing failed for %s", msg_id)
        try:
            await supa.update_message(msg_id, {"transcript_status": "error"})
        except Exception:
            pass


# ──────────────────────────── Twilio Voice (live call) ──────────────────────────
# ── VERIFICATION-CALL CAPTURE (2026-07-22, temporary — WhatsApp is down; Meta/other verification
# robocalls to our +1 numbers must be AUTO-ANSWERED, recorded, and transcribed so Peter gets the
# spoken code). Gated to +1 callers, active until VERIF_CAPTURE_UNTIL. Answers, plays nothing, records
# up to 90s; the recording callback below Deepgram-transcribes and EMAILS Peter (WhatsApp being down
# is the whole reason this exists). Set the number's Voice URL to /twilio/voice/verify-capture. ──
@router.api_route("/twilio/voice/verify-capture", methods=["GET", "POST"])
async def voice_verify_capture(request: Request) -> Response:
    import urllib.parse as _url

    from twilio.twiml.voice_response import VoiceResponse
    form = dict(await request.form()) if request.method == "POST" else dict(request.query_params)
    caller = _norm(form.get("From", "") or "")
    cb = f"{config.PUBLIC_BASE_URL}/twilio/voice/verify-recording?caller={_url.quote(caller)}"
    vr = VoiceResponse()
    # Answer silently and record the whole announcement (verification bots read the code immediately,
    # sometimes twice). transcribe=false — we run Deepgram ourselves in the callback (far better).
    vr.record(max_length=90, timeout=8, play_beep=False, trim="do-not-trim",
              recording_status_callback=cb, recording_status_callback_event="completed")
    log.info("verify-capture: answering call from %s", caller)
    return Response(content=str(vr), media_type="application/xml")


@router.post("/twilio/voice/verify-recording")
async def voice_verify_recording(request: Request) -> Response:
    """Recording done → download → Deepgram → EMAIL Peter the transcript (+ any digit runs pulled
    out). WhatsApp is down, so email is the rail. Fail-soft; always 204."""
    form = await request.form()
    rec_url = form.get("RecordingUrl", "") or ""
    caller = request.query_params.get("caller", "") or _norm(form.get("From", "") or "")
    if not rec_url:
        return Response(status_code=204)
    try:
        import httpx as _httpx  # BUGFIX 2026-07-22: was NameError — the OTP auto-email never fired
        sid = config.TWILIO_ACCOUNT_SID
        tok = config.TWILIO_AUTH_TOKEN
        async with _httpx.AsyncClient(timeout=40) as c:
            audio = (await c.get(f"{rec_url}.mp3", auth=(sid, tok))).content
        if len(audio or b"") < 2000:   # a duplicate/empty ring (dur=-1) — Deepgram 400s on empty; skip quietly
            log.info("verify-capture: empty recording from %s (%d bytes) — skipped", caller, len(audio or b""))
            return Response(status_code=204)
        import transcribe as _tx
        dg = await _tx.deepgram_diarize(audio, "audio/mpeg")
        text, _ = _tx.parse_utterances(dg)
        digits = _re.findall(r"\b\d(?:[\s-]?\d){3,7}\b", text)  # 4–8 digit runs = likely codes
        body = (f"<b>Llamada de verificación capturada</b><br>De: {caller}<br><br>"
                f"<b>Código(s) probable(s):</b> {', '.join(d.strip() for d in digits) or '(ninguno obvio — mira la transcripción)'}"
                f"<br><br><b>Transcripción:</b><br>{(text or '(vacío)').replace(chr(10), '<br>')}")
        # The transcript and the codes go to the operator by email, which is where they belong.
        # This line says a capture happened and how big it was; the journal is not the delivery.
        log.error("VERIFY-CAPTURE from %s: transcript chars=%d, %d candidate code(s)",
                  caller, len(text or ""), len(digits))
        import actions as _act
        await _act.send_email(config._env("NARRATE_FALLBACK_EMAIL", config.NOTIFY_EMAIL),
                              "🔑 Rocoto — código de verificación (llamada capturada)", body)
    except Exception:
        log.exception("verify-recording processing failed")
    return Response(status_code=204)


@router.post("/twilio/voice/incoming")
async def voice_incoming(request: Request) -> Response:
    form = await request.form()
    _require_twilio_signature(request, f"{config.PUBLIC_BASE_URL}/twilio/voice/incoming", form)
    caller = _norm(form.get("From", "") or "")
    wss = config.PUBLIC_BASE_URL.replace("https://", "wss://").replace("http://", "ws://")

    # Inbound calls reach the RUNTIME voice (SPEC §7 / §16.5: a call is just a sense — someone dialing the
    # number gets Rocoto, the same event-sourced employee). B3 (2026-07-26): there is no other mind and no
    # toggle. If ours is not available the call FAILS LOUD — it does NOT fall through to the canned Polly
    # line, which says "soy Rocoto" while nobody is home (the incident's shape, one layer down).
    import voice_toggle
    if not (el_bridge.configured() and voice_toggle.available()):
        log.error("VOICE MIND UNAVAILABLE — refusing inbound call from %s (no fallback exists)", caller)
        _voice_mind_alert(f"inbound call from {caller} refused: EL configured="
                                f"{el_bridge.configured()} runtime_agent={bool(voice_toggle.cached_runtime_agent())}")
        return Response(content=_VOICE_MIND_FAIL_TWIML, media_type="application/xml")

    # ── MODO SOMBRA (SPEC §5.5): "the voice answer decision" ──────────────────────────────────
    # Answering IS speaking, so in sombra Rocoto does not pick up. He is not silent about it: the
    # missed call is recorded (gate.hold → a `sombra.held` event + a review-sheet row), which is the
    # whole point of the mode — he follows everything, he just doesn't talk. The caller gets a plain
    # busy so the number's own voicemail/forwarding takes over, NOT the technical-fault line (nothing
    # is broken here) and NOT a line spoken in Rocoto's name.
    if caller:
        try:
            import gate as _gate
            import runtime as _rt
            _sc = _rt.scope_of(caller)
            if (_v := await _gate.blocked(_sc, "call")):
                await _gate.hold(_sc, "call", f"(llamada entrante de {caller} — sin atender)",
                                 detail={"origin": "inbound_call"}, verdict=_v)
                log.info("SOMBRA: not answering the inbound call from %s (source=%s)", caller, _v["source"])
                return Response(content=_SOMBRA_NO_ANSWER_TWIML, media_type="application/xml")
        except Exception:
            # gate.blocked() already fails CLOSED on a DB fault (it answers 'sombra'), so reaching
            # here means the check itself could not run at all — an import/wiring fault, not a mode
            # answer. Log it and let the call through: refusing on a broken checker would make the
            # switch's own bug look like the boss's instruction.
            log.exception("voice_incoming: the sombra check could not run for %s — answering", caller)

    recording_cb = ""
    if config.VOICE_POSTCALL_DIARIZE:
        recording_cb = f"{config.PUBLIC_BASE_URL}/twilio/voice/recording"

    # ── THE POSTURE GATE (Art. 50 + Peter, 2026-08-17: «we're not answering with the rocoto voice
    # for now… that should be a setting, and only work when it's answering out of hours and they set
    # it to run, otherwise it just listens») ──────────────────────────────────────────────────────
    # `call_posture` has always answered this correctly; nothing ever ASKED it. Its one reader chose
    # the wording of a greeting, so «listen» — the default — still answered and conversed, minus the
    # sentence saying it was a machine. The switch now decides whether the mouth exists at all: in a
    # listening posture the ElevenLabs bridge is never constructed, so Rocoto speaking is impossible
    # by construction rather than by configuration.
    try:
        import ai_disclosure as _disc
        import channels as _channels
        import presence_call as _presence_scope
        # WHICH DISTRIBUTOR WAS CALLED. The number DIALLED is the key — never the diverting number,
        # which TS 22.082 §1.3.8 makes a subscription option and which Twilio drops inconsistently
        # (see channels.tenant_of_did). Unknown → the deployment tenant, exactly as the WhatsApp
        # rail's resolver falls back, so a single-tenant box behaves precisely as it does today.
        _called = _norm(form.get("To", "") or "")
        _voice_tenant, _known_did = await _channels.tenant_of_did(_called)
        if not _voice_tenant:
            _voice_tenant = config.BRAIN_TENANT
        # `_rt` above is bound only inside the sombra branch, and scope_of("") is the shared `wa.`
        # bucket — so resolve the scope the safe way, off the call Twilio just named.
        _scope_for_posture = _presence_scope.scope_for(caller, form.get("CallSid", ""))
        _posture = await _disc.call_posture(_voice_tenant)
        log.info("inbound call to %s → tenant %s (known=%s)", _called or "-", _voice_tenant, _known_did)
    except Exception:
        # Fail-soft to LISTENING, the same direction ai_disclosure fails in: the wrong side of this
        # error is a machine talking to somebody's customer without the supplier having chosen it.
        log.exception("voice_incoming: posture could not be resolved for %s — listening", caller)
        _posture = {"speaking": False, "mode": "listen", "reason": "posture resolver failed"}

    if not _posture["speaking"]:
        log.info("voice call from %s → LISTENING (%s)", caller, _posture["reason"])
        wss_listen = f"{wss}/twilio/voice/stream"
        return Response(
            content=voice_bridge.listening_twiml(stream_wss_url=wss_listen, caller=caller,
                                                 recording_cb=recording_cb),
            media_type="application/xml")

    twiml = voice_bridge.incoming_twiml(          # B3: the ONE mind, or we never got here
        caller,
        eleven_wss_url=f"{wss}/twilio/voice/eleven-stream",
        recording_cb=recording_cb,
    )
    log.info("voice call from %s → runtime mind", caller)
    return Response(content=twiml, media_type="application/xml")


@router.websocket("/twilio/voice/stream")
async def voice_stream(ws: WebSocket) -> None:
    """OFF (default) path: one-way audio fork → Deepgram live subtitles."""
    await ws.accept()
    session = voice_bridge.CallSession()
    started = False
    try:
        while True:
            msg = await ws.receive_text()
            data = json.loads(msg)
            event = data.get("event")
            if event == "start":
                start = data.get("start", {}) or {}
                params = start.get("customParameters", {}) or {}
                await session.start(params.get("from", ""), call_sid=start.get("callSid", ""))
                started = True
                _vs_caller, _vs_callid = params.get("from", ""), start.get("callSid", "")
                import presence_call as _presence
                await _presence.call_started(_vs_caller, _vs_callid, source="live")
            elif event == "media":
                payload = data.get("media", {}).get("payload")
                if payload and started:
                    await session.feed(base64.b64decode(payload))
            elif event == "stop":
                break
    except WebSocketDisconnect:
        pass
    except Exception:
        log.exception("voice stream error")
    finally:
        if started:
            await session.finish()
            try:
                import presence_call as _presence
                await _presence.call_ended(_vs_caller, _vs_callid)
            except Exception:
                log.debug("call.ended presence fail-soft (live path)", exc_info=True)
        try:
            await ws.close()
        except Exception:
            pass


@router.websocket("/twilio/voice/eleven-stream")
async def voice_eleven_stream(ws: WebSocket) -> None:
    """ON path: bidirectional bridge to the ElevenLabs ConvAI agent. Relays μ-law both ways
    and captures the live transcript from EL's user_transcript / agent_response events."""
    await ws.accept()

    async def _send_twilio(frame: dict) -> None:
        await ws.send_text(json.dumps(frame))

    bridge = None
    started = False
    try:
        while True:
            msg = await ws.receive_text()
            data = json.loads(msg)
            event = data.get("event")
            if event == "start":
                start = data.get("start", {}) or {}
                params = start.get("customParameters", {}) or {}
                # Demo branch: a landing "See it live" call carries a demo_token param → use the
                # demo agent + fan transcript events to that browser session. Otherwise the normal
                # per-customer bridge (the Luis agent).
                demo_token = params.get("demo_token", "")
                sess = demo_call.get_session(demo_token) if demo_token else None
                # B3 (2026-07-26): ONE mind. Whatever the branch, the agent dialled is OURS
                # (voice_toggle.runtime_agent_id() raises rather than returning something else) and the
                # first line is the ring-time pin's tier ROLE-BLOCK opener. A pin/opener that cannot be
                # built ends the call with an alert — never a scripted greeting from a second brain.
                import presence_call as _presence_scope
                if sess is not None:
                    # TRACK 1 (dial-tone assembly, IN-CALL-RUNTIME-DESIGN §1.2): build the runtime pin NOW,
                    # at ring time, under the EXACT wa.<digits> scope api_voice_chat will resolve from
                    # [[CALLER]] — so turn 1 speaks the tier ROLE-BLOCK opener AND turn 2 rides this same
                    # pin (no rebuild, opener's call_state carried).
                    _dfrom = params.get("from", "") or sess.phone
                    _dscope = _presence_scope.scope_for(_dfrom, start.get("callSid", ""))
                    _dlang = "en" if getattr(sess, "locale", "es") == "en" else "es"
                    _dagent = _require_voice_mind(_dscope)
                    _dpin = await _ring_pin_or_fail(_dfrom, _dscope, _dlang)
                    _VOICE_PINS[_dscope] = _dpin
                    _dcfg = demo_call.demo_config_override(sess)      # language only (B3)
                    _dcfg = {"agent": {**(_dcfg.get("agent") or {}), "first_message": _dpin["opener"]}}
                    bridge = el_bridge.ElevenBridge(
                        _send_twilio,
                        agent_id=_dagent,                             # OURS — the only mind there is
                        on_event=demo_call.make_on_event(sess),
                        mode="demo",
                        dynamic_vars={"source": "landing_demo", "visitor_name": sess.name},
                        config_override=_dcfg,
                    )
                    sess.bridge = bridge
                else:
                    import runtime as _rt
                    _from = params.get("from", "")
                    # INBOUND to the RUNTIME voice (SPEC §7/§16.5): someone dialed the number → they get
                    # Rocoto, the SAME event-sourced employee, resolving THEIR scope by caller id. A call
                    # is a SENSE — record its origin FIRST (no screen) so the ring-time pin's call_context
                    # is right, THEN build the pin, THEN greet with the tier opener.
                    _ilang = "en" if str(_from).startswith("+1") else "es"
                    _iscope = _presence_scope.scope_for(_from, start.get("callSid", ""))
                    _iagent = _require_voice_mind(_iscope)
                    try:
                        await _rt.emit_sense(
                            phone=_from, type="call.requested", source="runtime",
                            payload={"origin": "inbound_pstn", "has_screen": False,
                                     "solicited_from": "inbound", "who": "prospect",
                                     "text": "Llamada entrante al número (sin pantalla)."},
                            dedupe_key=f"callreq:in:{start.get('callSid','')}")
                    except Exception:
                        log.debug("inbound call.requested emit fail-soft", exc_info=True)
                    _ipin = await _ring_pin_or_fail(_from, _iscope, _ilang)
                    _VOICE_PINS[_iscope] = _ipin
                    bridge = el_bridge.ElevenBridge(
                        _send_twilio, agent_id=_iagent,
                        mode="inbound_runtime", dynamic_vars={"source": "inbound_call"},
                        config_override={"agent": {"first_message": _ipin["opener"]}})
                await bridge.start(
                    params.get("from", ""),
                    stream_sid=start.get("streamSid", "") or data.get("streamSid", ""),
                    call_sid=start.get("callSid", ""),
                )
                started = True
                _LIVE_ELEVEN[bridge.msg_id] = bridge
                # §15 CHANNEL CONTINUITY: the call is now LIVE on the spine (world lane) — chat turns
                # assembling mid-call see it and can address it. Fail-soft, never touches the call.
                import presence_call as _presence
                await _presence.call_started(params.get("from", ""), bridge.msg_id, source=bridge.mode,
                                             scope_key=bridge.call_sid)
            elif event in ("media", "mark"):
                if started:
                    await bridge.on_twilio_event(data)
                    # EL socket died mid-call → end the Twilio leg now rather than leave the
                    # caller in silent dead air (finish() runs in the finally below).
                    if bridge.el_dropped and not bridge._took_over:
                        break
            elif event == "stop":
                break
    except WebSocketDisconnect:
        pass
    except VoiceMindUnavailable as e:
        # B3: the call is over before it began, on purpose. Already logged + surfaced at the seam.
        log.error("eleven stream: call refused — %s", e)
    except Exception:
        log.exception("eleven stream error")
    finally:
        if started:
            _LIVE_ELEVEN.pop(bridge.msg_id, None)
            await bridge.finish()
            # §15 + TRACK 3: the call is over — perception distils the call into DATA, then call.ended
            # is appended + the binder fires (report_call boss debrief) + per-call reset hooks run.
            try:
                import postcall as _postcall
                import presence_call as _presence
                _scope = _presence.scope_for(bridge.caller, bridge.call_sid)
                # perception → DATA: the call's turns → {name, summary, next_step, promise?} (fail-soft
                # defaults) so report_call's boss-debrief slots fill from the enriched call.ended payload.
                _summ = await _postcall.summarize(_scope)
                # ── A CALL MUST BECOME AN ORDER (2026-08-18) ─────────────────────────────────────
                # `orders_tool.place_order` had exactly ONE caller — agent_reply, the WhatsApp mind —
                # and `_maybe_extract_order` fired from three message rails, none of them voice. So a
                # phone call produced a transcript, a summary, memory and a review row, and never an
                # order. On a product whose whole promise is «cada llamada acaba en un pedido escrito»
                # that is the gap, and it is not a telephony problem.
                # The extractor sees the CALLER's turns only (`inbound_only`) — feeding it Rocoto's
                # side would turn a draft read back down the phone into a second order.
                try:
                    _call_txt = await _postcall.call_transcript(_scope)
                    if _call_txt:
                        asyncio.create_task(_maybe_extract_order(
                            bridge.msg_id, bridge.caller, _summ.get("name") or "", _call_txt,
                            tenant=tenancy.tenant_of(_scope)))
                        log.info("call %s → order intake (%d chars)", bridge.call_sid, len(_call_txt))
                except Exception:
                    log.exception("call→order intake failed for %s (call still ends cleanly)", _scope)
                await _presence.call_ended(bridge.caller, bridge.msg_id, extra=_summ,
                                           scope_key=bridge.call_sid)
                # a concrete commitment on the call → emit call.promise so the follow_up duty chases it
                # UNCONDITIONALLY (the deterministic replacement for the LLM electing open_tab; 0-tabs fix).
                if _summ.get("promise"):
                    import runtime as _runtime
                    await _runtime.on_duty_sense(
                        _scope, "call.promise",
                        {"promise_key": bridge.msg_id, "promise": _summ["promise"],
                         "name": _summ.get("name", "")},
                        dedupe_key=f"promise:{bridge.msg_id}", source="voice")
            except Exception:
                log.debug("call.ended presence fail-soft", exc_info=True)
        try:
            await ws.close()
        except Exception:
            pass


# Live ElevenLabs bridges keyed by msg_id, so a take-over request can reach the right one.
_LIVE_ELEVEN: dict[str, "el_bridge.ElevenBridge"] = {}


@router.post("/api/try/chat")
async def try_chat_endpoint(payload: dict, request: Request) -> JSONResponse:
    """«Prueba la IA» / "Try the AI" (SITE-V2-PLAN.md §6, WP-E) — the landing's real chat widget.
    PUBLIC, unauthenticated. All the isolation/rate-limit/turn-cap/junk-gate/egress-sandbox logic
    lives in try_chat.py; this route is just the HTTP shape. Always 200 with `ok` set — a rate-limit
    hit maps to 429 (no reply body to render), everything else is a normal chat turn."""
    if not config.TRY_CHAT_ENABLED:
        raise HTTPException(503, "try-chat disabled")
    payload = payload or {}
    text = str(payload.get("text") or "")
    session_id = str(payload.get("session_id") or "")
    lang = "en" if str(payload.get("lang") or "es").lower().startswith("en") else "es"
    ip = (request.client.host if request.client else "") or "unknown"
    out = await try_chat.chat(session_id=session_id, text=text, ip=ip, lang=lang)
    if not out.get("ok") and out.get("error") == "rate_limited":
        raise HTTPException(429, "too many requests")
    return JSONResponse(out)


@router.api_route("/twilio/voice/demo-answer", methods=["GET", "POST"])
async def voice_demo_answer(request: Request) -> Response:
    """TwiML Twilio fetches when the visitor answers the demo call: bridge to the ONE runtime mind
    (B3 — there is no demo agent), carrying the demo_token so the eleven-stream fans the transcript to
    the right browser. The mind is selected (and its absence made fatal) in `voice_eleven_stream`."""
    import urllib.parse as _url
    token = request.query_params.get("token", "") or ""
    form = await request.form()
    _require_twilio_signature(
        request, f"{config.PUBLIC_BASE_URL}/twilio/voice/demo-answer?token={_url.quote(token)}", form)
    sess = demo_call.get_session(token)
    if sess is None:
        return Response(content="<Response><Hangup/></Response>", media_type="application/xml")
    wss = config.PUBLIC_BASE_URL.replace("https://", "wss://").replace("http://", "ws://")
    twiml = (
        "<Response><Connect>"
        f'<Stream url="{wss}/twilio/voice/eleven-stream">'
        f'<Parameter name="from" value="{sess.phone}"/>'
        f'<Parameter name="demo_token" value="{token}"/>'
        "</Stream></Connect></Response>"
    )
    return Response(content=twiml, media_type="application/xml")


@router.post("/twilio/voice/demo-status")
async def voice_demo_status(request: Request) -> Response:
    """Twilio call-status callback for a demo call → SSE state (ringing/answered/ended/voicemail)."""
    import urllib.parse as _url
    token = request.query_params.get("token", "") or ""
    form = await request.form()
    _require_twilio_signature(
        request, f"{config.PUBLIC_BASE_URL}/twilio/voice/demo-status?token={_url.quote(token)}", form)
    await demo_call.on_call_status(
        token, (form.get("CallStatus", "") or "").lower(), form.get("AnsweredBy", "") or ""
    )
    return Response(content="", media_type="application/xml")


# ──────────────────────────── Rocoto onboarding / CRM / waitlist ────────────────────────────
# The customer-acquisition spine (brain/onboarding.py + brain/waitlist.py). All ADDITIVE + fail-soft;
# nothing here touches the live WhatsApp/order paths. Public endpoints validate input and return
# clean 400/404s (never 500-leak). The CRM endpoints are gated by a Control-Room SESSION
# (Depends(require_cr_session) / require_cr_cap) — NOT the machine key. That comment said
# `require_key` until 2026-07-27 and was already stale when WP-9 landed real CR login.

@router.post("/api/signup")
async def api_signup(payload: dict, request: Request, authorization: str = Header(default="")) -> JSONResponse:
    """Public: a prospect signs up (company/name/phone/email/ref) → create/dedupe a lead. If a valid
    Supabase bearer is present (Google-prefill flow), bind the lead to that user id + adopt the
    phoneless identity-lead created at auth time. The bearer is OPTIONAL — an unauthenticated public
    signup still works exactly as before. Rate-limited (per-IP + per-phone) — it's a public write path."""
    phone = str((payload or {}).get("phone") or "").strip()
    if not phone:
        raise HTTPException(400, "phone required")
    _ip = (request.headers.get("x-forwarded-for", "").split(",")[0].strip()
           or (request.client.host if request.client else "") or "unknown")
    if not _shop_rate_ok(f"signup-ip:{_ip}", limit=12, window_s=300):
        raise HTTPException(429, "too many requests")
    if not _shop_rate_ok(f"signup-phone:{phone}", limit=5, window_s=3600):
        raise HTTPException(429, "too many requests for this number")

    # Best-effort: resolve the signed-in user (bearer is optional here). A bad/absent token → no uid.
    supabase_uid = None
    tok = _bearer(authorization)
    if tok:
        user = await brain_auth.verify_token(tok)
        if user:
            supabase_uid = user.get("id")

    try:
        lead = await brain_onboarding.create_lead(
            phone=phone,
            name=str((payload or {}).get("name") or ""),
            business=str((payload or {}).get("company") or (payload or {}).get("business") or ""),
            email=str((payload or {}).get("email") or ""),
            ref=str((payload or {}).get("ref") or ""),
            supabase_user_id=supabase_uid,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception:
        log.exception("signup failed")
        raise HTTPException(500, "signup unavailable")
    # Re-engagement drip: enrol the lead (idempotent). Guarded + fail-soft so it can never perturb
    # the signup response when the flag is off or on error.
    if config.DRIP_ENABLED:
        try:
            await brain_drip.enroll(lead["id"])
        except Exception:  # pragma: no cover — enrolment is best-effort
            log.exception("drip enroll failed for %s", lead.get("id"))
    # IDENTITY (§6): bind the email to the SAME phone-party scope so this person is ONE identity across
    # WhatsApp / voice / email — behavior is never mis-associated to the wrong account.
    _email = str((payload or {}).get("email") or "").strip()
    if _email:
        try:
            import runtime
            await runtime.link_email(phone, _email, source="signup")
        except Exception:
            log.debug("signup email link fail-soft", exc_info=True)
    return JSONResponse({"ok": True, "lead_id": lead["id"], "status": lead["status"]})


# ── the /precios calculator (2026-08-14) ─────────────────────────────────────────────────────────
# Peter: «Email is the alert, not the record.» So this route does two things in that order — writes
# the lead, then fires an email — and only the first one is allowed to fail the request.
_PRICING_LEAD_MAX_BYTES = 32 * 1024   # ~40 capped answers plus context; anything larger is not a quiz
# `pricing_quote` keeps 40; this refuses the absurd before the parse, so a million-entry list is a
# 400 rather than a million trips through `clean_answers`.
_PRICING_LEAD_MAX_ANSWERS = 60
# The opaque id `/api/signup` hands back — `lead_<16 hex>` from onboarding._new_id. Matched STRICTLY,
# because presenting one is what tells this endpoint the caller created that row seconds ago.
_LEAD_ID_RE = _re.compile(r"^lead_[0-9a-f]{16}$")


def _has_ctl(s: str) -> bool:
    """Whether a visitor-typed field carries a control character.

    THE MAIL HEADER IS THE REASON (2026-08-15 review, defect 3). «a@b.com\\r\\nBcc: victim@x.com»
    passed the old shape check — it has an «@» and a dot after it — and went out as the alert's
    `reply_to`, which is a header value: one CRLF and the visitor chooses who else receives Peter's
    lead alerts. Nothing a human types into a pricing form contains a control character, so this
    REFUSES rather than strips; a stripped value is a value somebody typed and we silently changed.
    """
    return any(ord(ch) < 32 or ord(ch) == 127 for ch in s)


def _one_line(v, cap: int) -> str:
    """One line of visitor text, capped — control characters folded to spaces and collapsed.

    Context strings (page, referrer, ref, utm) never reach a header, so unlike the contact fields
    they are cleaned rather than refused: losing a lead over a stray tab in a `utm_content` would be
    a worse outcome than the tab.
    """
    return " ".join(str(v if v is not None else "").split())[:cap]


async def _read_capped(request: Request, cap: int) -> bytes:
    """The request body, refused the moment it passes `cap` rather than after it has all arrived.

    `content-length` is the CLIENT'S claim about the client's own body, so a cap checked against the
    header alone is a cap the sender sets. `request.body()` then buffers whatever actually turns up.
    Reading the stream and stopping is what makes the limit real: this process holds at most `cap`
    bytes of somebody else's JSON, however large they said it was or actually sent.
    """
    buf = bytearray()
    async for chunk in request.stream():
        buf += chunk
        if len(buf) > cap:
            raise HTTPException(413, "payload too large")
    return bytes(buf)


def _pricing_lead_context(request: Request, payload: dict) -> dict:
    """Locale, page, referrer and UTM — Peter's own list of what an alert has to carry.

    The REFERER HEADER IS THE FALLBACK, NOT THE SOURCE. The page knows which URL the visitor landed
    on (that is where the utm_* came from); the header only knows the last hop, and on a same-page
    fetch that is /precios itself, which tells us nothing. So the body wins and the header fills in.
    """
    utm = payload.get("utm") if isinstance(payload.get("utm"), dict) else {}
    # The KEYS are capped and cleaned too: they are printed as row labels in the alert, and a key is
    # as much visitor-supplied text as its value. Only the first dozen survive — a UTM set is five
    # parameters, and anything past that is somebody filling Peter's email with rows.
    utm = {_one_line(k, 60): _one_line(v, 200)
           for k, v in list(utm.items())[:12] if v and _one_line(k, 60)}
    for k in ("utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid"):
        if payload.get(k) and k not in utm:
            utm[k] = _one_line(payload[k], 200)
    return {
        "lang": _one_line(payload.get("locale") or payload.get("lang") or "es", 8),
        "page": _one_line(payload.get("page") or payload.get("url") or "", 400),
        "referrer": _one_line(payload.get("referrer") or payload.get("referer")
                              or request.headers.get("referer") or "", 400),
        "ref": _one_line(payload.get("ref") or "", 120),
        "utm": utm,
    }


@router.post("/api/leads/pricing")
async def api_leads_pricing(request: Request) -> JSONResponse:
    """PUBLIC: the /precios calculator was completed → store the lead, then alert Peter.

    THE PRICE IN THE BODY IS NOT USED. `brain/pricing_quote.build` recomputes everything from
    `pedidos_billing.BANDS`, because the report on /precios does its arithmetic in the browser and
    the alert email is what Peter quotes back on the phone. The visitor's own total rides along and
    is printed next to ours only when the two disagree.

    FOUR WALLS, all of them because this is an unauthenticated write reachable from the open web:
    a byte cap enforced on the STREAM (not on the sender's Content-Length claim), a per-IP rate
    limit keyed on an address the client cannot write, a per-address one, and a required payload.
    `pricing_quote` caps the answer count and the length of every field it keeps, so what reaches
    the database and the template is bounded even inside a legal request.

    A SUBMISSION WITH NO CONTACTABLE ADDRESS IS REFUSED (2026-08-15 review, defect 2 — REVERSING the
    earlier «answer it anyway»). `POST {}` used to return 200 and mail Peter, so the route was an
    open cannon into his inbox whose only cost control was a bucket keyed on the LEFTMOST
    `X-Forwarded-For` entry — a header the sender writes, so the limit was lifted by rotating a
    string. Verified live before this change, not theorised. Both halves are now required, because
    either alone is landfill: an address with no answers says nothing Peter can act on, and ten
    answers nobody can be called about are not a lead. The page that posts here always has both —
    it posts on the back of the signup that just collected them.

    `lead_id` IS A CAPABILITY, NOT AN ARGUMENT. It is the opaque id `/api/signup` hands back to the
    browser that just created that row, and presenting it is the only way this public route may
    write onto a lead it did not itself insert (see `record_pricing_lead`). Absent or malformed, the
    submission APPENDS. Same shape `/api/cal/book` already relies on.
    """
    try:
        declared = int(request.headers.get("content-length") or 0)
    except ValueError:
        declared = 0
    if declared > _PRICING_LEAD_MAX_BYTES:
        raise HTTPException(413, "payload too large")
    raw = await _read_capped(request, _PRICING_LEAD_MAX_BYTES)
    try:
        payload = json.loads(raw or b"{}")
    except Exception:
        raise HTTPException(400, "bad json")
    if not isinstance(payload, dict):
        raise HTTPException(400, "bad payload")

    # THE ONE DERIVATION, so this bucket cannot be lifted by a header. `_client_ip` trusts a
    # forwarding header only from a hop in ROCOTO_TRUSTED_PROXY_IPS and reads the RIGHTMOST entry —
    # everything to its left is written by the sender. Its own docstring carries the measurement.
    _ip = _client_ip(request) or "unknown"
    if not _shop_rate_ok(f"pricing-lead-ip:{_ip}", limit=10, window_s=600):
        raise HTTPException(429, "too many requests")

    c = payload.get("contact") if isinstance(payload.get("contact"), dict) else payload
    if not isinstance(c, dict):
        raise HTTPException(400, "bad payload")
    name = str(c.get("name") or "").strip()[:200]
    company = str(c.get("company") or c.get("business") or c.get("empresa") or "").strip()[:200]
    phone = str(c.get("phone") or c.get("telefono") or c.get("tel") or "").strip()[:40]
    email = str(c.get("email") or c.get("correo") or "").strip().lower()[:200]
    # Refused, not scrubbed: `reply_to` is a mail header and the CRM row is read by a human.
    if any(_has_ctl(v) for v in (name, company, phone, email)):
        raise HTTPException(400, "bad contact")
    # Shape-only beyond that, deliberately: an address is verified by writing to it, and refusing a
    # typo would lose the ten answers attached to it.
    if not ("@" in email and "." in email.rsplit("@", 1)[-1] and " " not in email):
        email = ""
    # A number we could actually ring. Seven digits is the shortest real national subscriber number;
    # `identity_phone.canon` does the E.164 work later, and this only rejects what could never be a
    # phone at all.
    reachable_phone = len([ch for ch in phone if ch.isdigit()]) >= 7
    if not (email or reachable_phone):
        raise HTTPException(400, "a contactable email or phone is required")
    if email and not _shop_rate_ok(f"pricing-lead-email:{email}", limit=5, window_s=3600):
        raise HTTPException(429, "too many requests for this address")

    # …AND A CONFIGURATION. `pricing_quote.build` is fail-soft by design and would happily quote the
    # smallest band off an empty body, which is exactly how `{}` used to become an email.
    answers = payload.get("answers")
    if answers is not None and not isinstance(answers, (list, tuple, dict)):
        raise HTTPException(400, "bad answers")
    if answers is not None and len(answers) > _PRICING_LEAD_MAX_ANSWERS:
        raise HTTPException(400, "too many answers")
    sel = payload.get("selection")
    if sel is not None and not isinstance(sel, dict):
        raise HTTPException(400, "bad selection")
    configured = bool(answers) or bool(
        sel and any(k in sel for k in ("band", "plan", "orders", "pedidos", "modules")))
    if not configured:
        raise HTTPException(400, "a configuration is required")

    claim = str(payload.get("lead_id") or "").strip()
    if claim and not _LEAD_ID_RE.match(claim):
        claim = ""

    ctx = _pricing_lead_context(request, payload)
    quote = brain_pricing_quote.build(payload, lang=ctx["lang"])
    contact = {"name": name, "company": company, "email": email, "phone": phone}

    lead = None
    try:
        lead = await brain_onboarding.record_pricing_lead(
            name=name, business=company, email=email, phone=phone,
            ref=ctx.get("ref") or (ctx.get("utm") or {}).get("utm_source") or "", quiz=quote,
            lead_id=claim)
    except Exception:
        # The record is the half that matters, so a failure here is logged LOUDLY — but it still must
        # not swallow the alert: an email carrying the answers is a far better outcome than a 500 the
        # visitor reads as «no funciona» after answering ten questions.
        log.exception("pricing lead not stored (alert still sent)")

    # FIRE AND FORGET. Detached on purpose: Resend's timeout is 30s and this is a form submit.
    brain_lead_notify.spawn(brain_lead_notify.notify_pricing_lead(contact, quote, ctx))

    return JSONResponse({"ok": True, "lead_id": (lead or {}).get("id"), "stored": bool(lead),
                         "band": quote.get("band"),
                         "total_cents": (quote.get("chosen") or {}).get("total_cents"),
                         "sales": bool(quote.get("sales"))})


@router.get("/api/drip/unsub/{token}")
async def api_drip_unsub(token: str) -> Response:
    """Public one-click unsubscribe from the re-engagement drip. Non-leaking: unknown token shows the
    same tiny confirmation page. Never leaks whether the token existed."""
    try:
        await brain_drip.unsubscribe(token)
    except Exception:  # pragma: no cover — always show the friendly page
        log.exception("drip unsub failed")
    html = (
        '<!doctype html><html lang="es"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        '<title>Rocoto</title><style>'
        'body{margin:0;font-family:-apple-system,system-ui,"Segoe UI",sans-serif;'
        'background:#FAF7F3;color:#1A1413;display:flex;min-height:100vh;align-items:center;'
        'justify-content:center;padding:24px}'
        '.card{max-width:420px;text-align:center;background:#fff;border:1px solid rgba(26,20,19,.10);'
        'border-radius:24px;padding:40px 32px}'
        'h1{font-size:24px;margin:0 0 12px;color:#C01B2C}p{font-size:16px;line-height:1.6;color:#6F665C;margin:0}'
        '</style></head><body><div class="card">'
        '<h1>Listo, no te escribo más</h1>'
        '<p>Te he quitado de los correos. Si algún día quieres que Rocoto se encargue de tus pedidos, '
        'aquí estoy.</p>'
        '</div></body></html>'
    )
    return Response(content=html, media_type="text/html", headers={"Cache-Control": "no-store"})


@router.post("/api/cal/webhook")
async def api_cal_webhook(request: Request) -> JSONResponse:
    """Authenticate Cal's exact raw payload before booking or runtime effects."""
    import cal_webhook
    payload = await cal_webhook.authenticated_payload(request)
    try:
        res = await brain_onboarding.booking_created(payload or {})
    except Exception:
        log.exception("cal webhook failed")
        return JSONResponse({"ok": True, "matched": False})
    # A SENSE into the spine (SPEC §7): the person booked the alta call with Peter → the runtime knows.
    try:
        import runtime
        p = (payload or {}).get("payload", payload) or {}
        att = (p.get("attendees") or [{}])[0]
        resp = p.get("responses") or {}
        phone = (res.get("phone") or att.get("phoneNumber") or resp.get("phone", {}).get("value")
                 or resp.get("attendeePhoneNumber", {}).get("value") or "")
        if phone:
            when = p.get("startTime") or p.get("start") or ""
            await runtime.emit_sense(phone=str(phone), type="cal.booked", source="cal",
                                     payload={"text": f"Agendó la llamada de alta con Peter ({when}).", "when": when},
                                     dedupe_key=f"cal:{p.get('uid') or p.get('bookingId') or when}")
            _cemail = att.get("email") or (resp.get("email", {}) or {}).get("value") or ""
            if _cemail:
                await runtime.link_email(str(phone), str(_cemail), source="cal")
    except Exception:
        log.debug("cal spine emit fail-soft", exc_info=True)
    return JSONResponse({"ok": True, **res})


@router.get("/api/wizard/{token}")
async def api_wizard_get(token: str) -> JSONResponse:
    """Public: fetch the wizard state for a token. 404 (non-leaking) for any invalid/used token."""
    data = await brain_onboarding.get_wizard(token)
    if data is None:
        raise HTTPException(404, "not found")
    return JSONResponse(data)


@router.post("/api/wizard/{token}")
async def api_wizard_save(token: str, payload: dict) -> JSONResponse:
    """Public: persist wizard state (body {step, wizard_state, submit?}). When submit is truthy,
    finalize → waitlist. 404 for an invalid/used token."""
    body = payload or {}
    step = body.get("step", 0)
    state = body.get("wizard_state") or {}
    if not isinstance(state, dict):
        raise HTTPException(400, "wizard_state must be an object")
    if body.get("submit"):
        # Save first, then submit (so the final answers are persisted before we lock the token).
        await brain_onboarding.save_wizard(token, step, state)
        # Money-first: if this token is payable, the plain submit must NOT finalize it — only the paid
        # path (POST /checkout → Stripe → /payment-complete or the webhook) may. Non-payable tokens
        # (payment not configured for their mode) still finalize here (direct waitlist join).
        if await brain_setupfee.token_is_payable(token):
            raise HTTPException(402, "payment_required")
        wl = await brain_onboarding.submit_wizard(token)
        if wl is None:
            raise HTTPException(404, "not found")
        return JSONResponse({"ok": True, "submitted": True, "waitlist": wl})
    saved = await brain_onboarding.save_wizard(token, step, state)
    if saved is None:
        raise HTTPException(404, "not found")
    return JSONResponse({"ok": True, **saved})


from auth_headers import bearer_token as _bearer  # noqa: E402


@router.post("/api/auth/bind")
async def api_auth_bind(payload: dict, authorization: str = Header(default="")) -> JSONResponse:
    """Public (Supabase-authenticated): bind the signed-in user to the lead behind body {token}. The
    Supabase access token comes as a Bearer header; we verify it against the Auth API. Idempotent."""
    user = await brain_auth.verify_token(_bearer(authorization))
    if not user:
        raise HTTPException(401, "unauthorized")
    ok = await brain_auth.bind_lead((payload or {}).get("token") or "", user)
    return JSONResponse({"ok": bool(ok)})


@router.post("/api/auth/resume")
async def api_auth_resume(authorization: str = Header(default="")) -> JSONResponse:
    """Public (Supabase-authenticated): resolve the signed-in user back to their onboarding link +
    furthest step, so the landing sign-in can jump them straight back in. {found:false} if unlinked."""
    user = await brain_auth.verify_token(_bearer(authorization))
    if not user:
        raise HTTPException(401, "unauthorized")
    return JSONResponse(await brain_auth.resume_for_user(user))


@router.post("/api/auth/state")
async def api_auth_state(request: Request, authorization: str = Header(default="")) -> JSONResponse:
    """Public (Supabase-authenticated): resolve the signed-in user → {lead, token, booking}, CREATING
    + binding a phoneless lead from Google metadata if none exists (Peter's decision 2). Drives the
    landing post-auth routing (wizard vs booking-status modal vs signup form). Rate-limited per-IP —
    it mints a lead per new user, so it must not be floodable (amplifies Supabase verify too)."""
    _ip = (request.headers.get("x-forwarded-for", "").split(",")[0].strip()
           or (request.client.host if request.client else "") or "unknown")
    if not _shop_rate_ok(f"authstate-ip:{_ip}", limit=40, window_s=300):
        raise HTTPException(429, "too many requests")
    user = await brain_auth.verify_token(_bearer(authorization))
    if not user:
        raise HTTPException(401, "unauthorized")
    return JSONResponse(await brain_auth.auth_state(user))


# ══════════════════════════════════════════════════════════════════════════════════════════════════
# THE APP SURFACE — sign up / sign in / be let in, from inside the Android app.
#
# Identity is SUPABASE and it already exists (brain/auth.py). The app signs the person in against
# Supabase directly and hands us the bearer; there is no second identity system, no app-specific
# login, and no /api/app/signup — see the note on api_app_gate for why.
#
# One call decides the screen: /api/app/gate. The client decides NOTHING.
# ══════════════════════════════════════════════════════════════════════════════════════════════════

async def require_app_founder(authorization: str = Header(default="")) -> dict:
    """Peter, and only Peter — a verified Supabase bearer whose Google identity's OWN email matches an
    owner address (brain_auth.is_founder → has_matching_oauth). Deliberately NOT `require_key`: the
    shared machine key ships inside every copy of the Android app, so a key-gated reset would be
    reachable by every customer holding the APK. Fails CLOSED in dev too — there is no fall-open."""
    user = await brain_auth.verify_token(_bearer(authorization))
    if not user:
        raise HTTPException(401, "unauthorized")
    if not brain_auth.is_founder(user):
        raise HTTPException(403, "founder only")
    return {"user": user, "email": (user.get("email") or "").strip()}


@router.get("/api/app/gate")
@router.post("/api/app/gate")
async def api_app_gate(request: Request, authorization: str = Header(default="")) -> JSONResponse:
    """THE app's post-sign-in call. Supabase bearer in the Authorization header.

    Returns {role, gate, lead, wizard, tenant, seeded, waiting, gate_mode} — everything the app needs
    to pick a screen, already decided. gate ∈ founder | in | invited | waiting.

    WHY THERE IS NO /api/app/signup (decision, written down): sign-up and sign-in happen against
    Supabase DIRECTLY from the app. Proxying them through us would mean this backend handling
    passwords and holding a service-role key, for zero gain — Supabase already owns email+password,
    Google, confirmation and refresh. Everything a signup needs on OUR side (create + bind the lead,
    adopt a pre-existing lead by verified email, resolve the role) is what this call already does, and
    it is idempotent, so calling it is the signup. The one thing Supabase cannot carry is the BUSINESS
    NAME, so POST accepts an optional {name, business, ref} body which is written into EMPTY fields
    only — it can never overwrite what the customer or Peter already put there. The phone number is
    NOT collected: telephony is out, and the number question is now the last wizard step (their own
    WhatsApp), not a signup field.

    GET and POST are the same call. It is idempotent and it binds the signed-in user to their lead on
    first sight, exactly as the landing's /api/auth/state does."""
    _ip = (request.headers.get("x-forwarded-for", "").split(",")[0].strip()
           or (request.client.host if request.client else "") or "unknown")
    if not _shop_rate_ok(f"appgate-ip:{_ip}", limit=60, window_s=300):
        raise HTTPException(429, "too many requests")
    user = await brain_auth.verify_token(_bearer(authorization))
    if not user:
        raise HTTPException(401, "unauthorized")
    profile = None
    if request.method == "POST":
        try:
            body = await request.json()
            if isinstance(body, dict):
                profile = body
        except Exception:
            profile = None            # an empty/!json POST body is fine — it is an optional extra
    try:
        return JSONResponse(await brain_auth.app_gate(user, profile))
    except RuntimeError as e:
        # The rule said "let them in" and the token write failed. We refuse to answer 'waiting' (that
        # would be a lie about the rule) and refuse to answer 'invited' with no token (a door with no
        # handle). 503 + an honest sentence; the app retries.
        log.exception("app gate write path failed: %s", e)
        raise HTTPException(503, "no he podido abrirte la puerta ahora mismo — inténtalo en un momento")


@router.get("/api/app/gate-mode")
async def api_app_gate_mode_get(_: dict = Depends(require_app_founder)) -> JSONResponse:
    """Founder: read the onboarding gate policy — 'invite' (only leads Peter sent onboarding to) or
    'open' (anyone who signs up walks in)."""
    return JSONResponse({"mode": await brain_auth.gate_mode(),
                         "modes": [brain_auth.GATE_INVITE, brain_auth.GATE_OPEN]})


@router.post("/api/app/gate-mode")
async def api_app_gate_mode_set(payload: dict, _: dict = Depends(require_app_founder)) -> JSONResponse:
    """Founder: flip the gate. `{mode: 'invite'|'open'}`. This is the whole of "in the future it'll be
    without a call" — a settings row, no code change, no deploy, no migration."""
    try:
        mode = await brain_auth.set_gate_mode((payload or {}).get("mode"))
    except ValueError as e:
        raise HTTPException(400, str(e))
    return JSONResponse({"ok": True, "mode": mode})


@router.get("/api/app/wizard")
async def api_app_wizard(token: str) -> JSONResponse:
    """The wizard, as DATA, for the app: {steps[], step, next_step_id, total_steps, can_submit,
    missing, resume_step_id, lead, is_test}. Each step carries id · kind · title · subtitle · required
    · value, so the app renders steps it was never compiled against.

    The token is the key, exactly as on the web. 404 for any invalid/used/unknown token (non-leaking).
    Catalogue upload still goes to the existing multipart POST /api/wizard/{token}/catalogue and the
    match poll to GET /api/wizard/{token}/matching — both are returned in the payload; this endpoint
    does not fork them."""
    out = await brain_onboarding.app_wizard((token or "").strip())
    if out is None:
        raise HTTPException(404, "not found")
    return JSONResponse(out)


@router.post("/api/app/wizard/step")
async def api_app_wizard_step(payload: dict) -> JSONResponse:
    """Save ONE step: `{token, step_id, value:{...}, submit?:bool}`. Reuses save_wizard / submit_wizard
    verbatim — the state machine is not forked. `step_id` accepts any historical pointer (a retired
    phone step, the web wizard's `catchment`, or a bare numeric index) and resolves it onto a step that
    exists today. A submit with a required step unanswered comes back {ok:false, error:'incomplete',
    missing:[...]} rather than half-finishing anyone.

    MONEY-FIRST, exactly as on the web (POST /api/wizard/{token}): a payable token is NEVER finalized
    by a plain submit — only the paid path may. The app must not become a way around the setup fee, so
    the answers are saved and the submit comes back 402."""
    p = payload or {}
    token = str(p.get("token") or "").strip()
    if not token:
        raise HTTPException(400, "token required")
    step_id = str(p.get("step_id") or "")

    if not p.get("submit"):
        out = await brain_onboarding.app_wizard_save(token, step_id, p.get("value"))
        if out is None:
            raise HTTPException(404, "not found")
        return JSONResponse(out)

    # Save the final answers FIRST, so nothing the customer typed is lost to a 402 or an 'incomplete'.
    saved = await brain_onboarding.app_wizard_save(token, step_id, p.get("value"))
    if saved is None:
        raise HTTPException(404, "not found")
    if not saved.get("can_submit"):
        return JSONResponse({**saved, "ok": False, "error": "incomplete",
                             "missing": saved.get("missing") or [],
                             "message": "Todavía falta algo por contestar antes de terminar."})
    if await brain_setupfee.token_is_payable(token):
        raise HTTPException(402, "payment_required")
    out = await brain_onboarding.app_wizard_save(token, step_id, None, submit=True)
    if out is None:
        raise HTTPException(404, "not found")
    return JSONResponse(out)


# ── the SEEDED WORLD, exposed (FOUNDER ONLY — a tenant must never be able to reset a world) ─────────
def _seed_module():
    """brain.seed, resolved lazily BY NAME so this code lands even while the seed is being rebuilt."""
    from brain import seed as _seed
    return _seed


async def _seed_counts() -> dict:
    """Read-only counts of the seeded world. Every count is independently fail-soft: a table that does
    not exist on this box reports 0 rather than 500-ing the founder's home screen.

    `live_*` counts the OTHER side of the same tables — the rows that are NOT seeded. On a box where
    the demo world and real customers share a schema, «how much of this is real» is the first question
    a founder asks before he shows anybody the screen, and it must be answerable from the same call."""
    tenant = config.BRAIN_TENANT
    counts: dict[str, int] = {}
    probes = [
        ("catalogue", "select count(*) from catalogue_skus where tenant_id=$1 and seeded", (tenant,)),
        ("customers", "select count(*) from customer_profiles where tenant_id=$1 and seeded", (tenant,)),
        # orders are tenant-keyed since 2026-07-27; this screen is labelled BRAIN_TENANT's, so it
        # must count BRAIN_TENANT's — a global count would have started lying the day a second
        # distributor filed an order.
        ("orders", "select count(*) from orders where seeded and tenant_id=$1", (tenant,)),
        ("messages", "select count(*) from whatsapp_messages where seeded", ()),
        ("calls", "select count(*) from calls where seeded", ()),
        # the real side of the same tables — never mixed into the seeded numbers
        ("live_orders", "select count(*) from orders where not seeded and tenant_id=$1", (tenant,)),
        ("live_messages", "select count(*) from whatsapp_messages where not seeded", ()),
        ("live_customers",
         "select count(*) from customer_profiles where tenant_id=$1 and not seeded", (tenant,)),
    ]
    pool = supa.get_pool()
    for name, sql, args in probes:
        try:
            async with pool.acquire() as con:
                counts[name] = int(await con.fetchval(sql, *args) or 0)
        except Exception:
            counts[name] = 0
    try:
        import runtime as _rt
        counts["review"] = len(await _rt.review_list())
    except Exception:
        counts["review"] = 0
    return counts


@router.get("/api/app/seed")
async def api_app_seed(_: dict = Depends(require_app_founder)) -> JSONResponse:
    """Founder: is this the demo world, when was it loaded, and what is in it?
    → {seeded, loaded_at, tenant, counts:{catalogue, customers, orders, messages, calls, review,
       live_orders, live_messages, live_customers}, collisions:[…]}

    `collisions` is what the last load DECLINED to touch because the row was not seeded (a real
    contact name, a real profile, a real card, a real delivery rule). It is read off the seed meta —
    the same ledger `brain/seed` wrote — so the founder can see, on his own screen, exactly where his
    live world and the test world met and who won."""
    seed = _seed_module()
    loaded_at, enabled, collisions = None, False, []
    try:
        enabled = bool(await seed.get_seed_enabled())
    except Exception:
        log.exception("app seed: enabled read failed")
    try:
        meta = await supa.settings_get(getattr(seed, "SEED_META_AGENT", "seed_meta")) or {}
        loaded_at = meta.get("loaded_at")
        collisions = list(meta.get("collisions") or [])
    except Exception:
        log.exception("app seed: meta read failed")
    counts = await _seed_counts()
    # `seeded` must mean "the TEST world is here", never "this database has rows in it" — so the
    # live_* probes are deliberately excluded from the sum.
    seeded_rows = sum(v for k, v in counts.items() if not k.startswith("live_"))
    return JSONResponse({"seeded": bool(enabled or loaded_at or seeded_rows),
                         "enabled": enabled, "loaded_at": loaded_at,
                         "tenant": config.BRAIN_TENANT, "counts": counts,
                         "collisions": collisions})


@router.post("/api/app/seed/reset")
async def api_app_seed_reset(ctx: dict = Depends(require_app_founder)) -> JSONResponse:
    """Founder: put the demo world back exactly as it was. Calls brain.seed.reset_demo_seed(), which is
    idempotent and can only ever delete rows it marked as seeded.

    Resolved LAZILY BY NAME: while that function is still in flight this endpoint answers a clean,
    honest 503 — never a stack trace, and never a silent fall-back onto a DIFFERENT reset (a button
    that does something other than what it says is worse than a button that says it can't yet)."""
    seed = _seed_module()
    fn = getattr(seed, "reset_demo_seed", None)
    if not callable(fn):
        raise HTTPException(503, "el mundo de prueba todavía no se puede reiniciar desde aquí")
    try:
        import inspect
        params = inspect.signature(fn).parameters
        res = await fn(config.BRAIN_TENANT) if params else await fn()
    except HTTPException:
        raise
    except (RuntimeError, ValueError) as e:
        # The two REFUSALS, and they are the safety story, not a failure: a row wearing a seed mark
        # this seeder could not have minted (`_audit_foreign`), or a tenant that is not the demo
        # tenant. Both mean the reset stopped BEFORE deleting anything. Say so — a founder who sees
        # «no se pudo» assumes a bug and presses again; he needs to read the reason and look.
        log.warning("app seed reset REFUSED: %s", e)
        raise HTTPException(409, f"el reinicio se ha parado sin borrar nada: {e}")
    except Exception:
        log.exception("app seed reset failed")
        raise HTTPException(500, "no se pudo reiniciar el mundo de prueba")
    log.info("seed reset by founder %s", ctx.get("email"))
    # Peter, 2026-07-28: "when i hit reset seeded state it should literally clear the orders i made
    # live etc, and the messages, they should clear from the event log etc". `reset_demo_seed` above
    # only ever deletes rows IT marked (the safety story `reset_to_seeded`'s own docstring used to cite
    # as the reason to never wire it here) — but he is the only person on this box, so every live row
    # under the demo tenant right now is his own testing, not a real customer's. Fail-soft: a live-
    # traffic wipe hiccup must not undo the seed rebuild that already succeeded above.
    live_wipe = None
    try:
        live_wipe = await seed.reset_to_seeded(config.BRAIN_TENANT)
    except Exception:
        log.exception("post-reset live-traffic wipe failed (seed rebuild already stands)")
    # `brain/seed.py` writes several of its orders with raw `insert into orders (...)` and is owned
    # elsewhere; those rows carry no tenant, and a row with `tenant_id IS NULL` is invisible to every
    # tenant-filtered read — i.e. the demo's Pedidos tab would come back EMPTY from a reset. Heal the
    # holes here, where the reset is triggered, rather than leaving them until the next restart.
    try:
        await supa.heal_order_tenants()
    except Exception:
        log.debug("post-seed tenant heal fail-soft", exc_info=True)
    return JSONResponse(_jsonsafe({"ok": True, "result": res if isinstance(res, dict) else {"result": res},
                                   "live_wipe": live_wipe,
                                   "counts": await _seed_counts(),
                                   "tenant": await _after_seed_provision()}))


# ══════════════════════════════════════════════════════════════════════════════════════════════════
# THE FOUNDER'S OWN TENANT — a distributor who has FINISHED ONBOARDING (SPEC §6, 2026-07-27)
# ══════════════════════════════════════════════════════════════════════════════════════════════════
# §6's lifecycle is a CHECKBOX SET DERIVED FROM REAL STATE — `call_done · skus_uploaded · flow_done ·
# interview_done · fee_paid · number_bound · live` (lifecycle.boxes_of). Nothing may ever ASSERT a
# box; the whole value of the set is that the mind can trust an unticked box to mean "this does not
# exist yet, do not look for it". So making the founder's world look onboarded means giving it the
# STATE the boxes read, and leaving alone the ones that have no honest state behind them.
#
# WHAT THIS FUNCTION SUPPLIES, box by box:
#   skus_uploaded / flow_done  the 68-SKU catalogue IS the uploaded catalogue — nothing to do here;
#                              the rows exist (brain/seed.load_catalogue) and the box reads them.
#   number_bound               `tenants.number` — bound below to the line inbound actually arrives on.
#   live                       `tenants.golive_at` — claimed below, ATOMICALLY, once catalogue AND
#                              number are both real. Derived from state, never a flag.
#   fee_paid                   already true for tier creator/boss by lifecycle's own rule (the founder
#                              does not invoice himself). Not touched here.
#   call_done                  true once a real call/utterance event exists on the scope. Not forged.
#   interview_done             CANNOT honestly be true: it counts `transcript_facts` for a LEAD, and
#                              the founder has no lead row (he never went through the wizard). Left
#                              FALSE on purpose — a lifecycle that lies is worse than one that is
#                              incomplete.
#
# `status` STAYS 'test'. `brain/billing.run_meter_once` scans `status='live' and golive_at is not
# null` — flipping the founder's own tenant to 'live' would enrol Peter's demo world in the 0.3%
# commission meter and start generating Stripe invoices to himself. golive_at records the activation;
# status records whether we bill it. They are allowed to disagree, and here they must.
_FOUNDER_TENANT_SPEC = os.path.join(os.path.dirname(os.path.abspath(__file__)), "seed", "contacts.json")


def _founder_business() -> dict:
    """The founder distributor's own identity, read from the seeded world's `business` block (the ONE
    place it is written — brain/seed.py owns that file; this only reads it). Fail-soft to {}: a box
    without the seed file still gets a coherent tenant row, just without the address/depot detail."""
    try:
        with open(_FOUNDER_TENANT_SPEC, "r", encoding="utf-8") as fh:
            return dict((json.load(fh) or {}).get("business") or {})
    except Exception:
        log.debug("founder tenant: seed business spec unreadable", exc_info=True)
        return {}


def _founder_number() -> str:
    """The WhatsApp line this deployment actually receives on, E.164. The cloud rail is the only WA
    rail (config.ROCOTO_WA_RAIL='cloud'); ROCOTO_WHATSAPP_FROM carries it in `whatsapp:+…` form."""
    return "+" + config.phone_digits(config.ROCOTO_WHATSAPP_FROM)


async def _ensure_founder_tenant() -> dict:
    """Make the founder's tenant row TRUE, idempotently. Returns a report dict (never raises).

    Ordering note: this runs AFTER `brain_tenants.ensure_seed()`, which already creates the row at
    `config.BRAIN_TENANT` on every boot (named "Sancho", from before the rebrand). So this is not
    minting a duplicate — it is completing the row that boot already guarantees exists.

    THREE GUARDS, because this writes to a table a REAL distributor will one day own:
      · it only ever renames/relocates a row carrying `seeded=true`. A live tenant's identity is
        never overwritten by a demo provisioner.
      · the number bind is skipped when another tenant already holds that number (the partial unique
        index would reject it anyway; a friendly skip beats an exception at boot).
      · the golive claim is `where golive_at is null` — the same atomic one-shot brain/golive.activate
        uses, so the two can never fight and a second boot is a no-op.

    IT DOES NOT OWN THE ROW'S CONTENT. `brain/seed._seed_business` writes the founder distributor's
    identity on this same slug, so everything here is HOLE-FILLING: a name that is still the
    pre-rebrand default, a delivery rule that is not yet evaluable, a dispatch key that is absent. The
    only fields this function is the sole writer of are `number` and `golive_at` — the two the §6
    boxes read and that nothing else on a founder's box (no lead, no wizard, no payment → no
    `brain/golive.activate`) could ever set."""
    tenant = config.BRAIN_TENANT
    b = _founder_business()
    number = _founder_number()
    out: dict = {"tenant": tenant, "number": number, "identity": False, "number_bound": False,
                 "golive": False, "range": False, "orphan_tenant_row": None, "skus": 0}
    pool = supa.get_pool()
    try:
        async with pool.acquire() as con:
            # An ORPHAN check, not a copy: brain/seed now writes its row on the founder's own slug
            # (2026-07-27), so a SEEDED row still sitting at the contacts.json slug is a leftover from
            # before that fix. Report it loudly; do not touch it — it is another module's row and its
            # own teardown will take it.
            spec_slug = str(b.get("slug") or "").strip()
            if spec_slug and spec_slug != tenant:
                stray = await con.fetchval(
                    "select slug from tenants where slug=$1 and seeded", spec_slug)
                if stray:
                    out["orphan_tenant_row"] = stray
                    log.warning(
                        "founder tenant: a SEEDED `tenants` row still exists at slug %r while every "
                        "commerce table is keyed by BRAIN_TENANT %r — that row is an orphan nothing "
                        "reads (brain/stock.inventory_on, assemble's business name and the §6 boxes "
                        "all read %r). Left in place; it belongs to brain/seed's teardown.",
                        spec_slug, tenant, tenant)
            out["skus"] = int(await con.fetchval(
                "select count(*) from catalogue_skus where tenant_id=$1 and in_assortment",
                tenant) or 0)
            # IDENTITY: fill HOLES only, and only once the world it describes actually EXISTS. The
            # name comes from the seeded world's own `business` block, so claiming it on a box with no
            # catalogue would be the same species of lie as ticking a box — a tenant row that says
            # «Cárnicas Aldonza» over an empty catalogue. brain/seed._seed_business owns this row's
            # content and writes it on this same slug, so this never fights it: it only repairs a row
            # that is still blank or still carries the PRE-REBRAND default name ('Sancho', written by
            # brain/tenants.ensure_seed on every boot). And only ever on a `seeded` row — a real
            # distributor's identity is untouchable by a demo provisioner.
            if b and out["skus"] > 0:
                filled = await con.fetchval(
                    """update tenants set
                          name    = case when coalesce(nullif(name,''),'Sancho')='Sancho' then $2 else name end,
                          tagline = coalesce(nullif(tagline,''), $3),
                          address = coalesce(nullif(address,''), $4),
                          city    = coalesce(nullif(city,''),    $5),
                          region  = coalesce(nullif(region,''),  $6),
                          country = coalesce(nullif(country,''), $7),
                          lat = coalesce(lat, $8), lng = coalesce(lng, $9), updated_at = now()
                        where slug=$1 and seeded returning name""",
                    tenant, b.get("name") or "Cárnicas Aldonza", b.get("tagline") or "",
                    b.get("address") or "", b.get("city") or "", b.get("region") or "",
                    b.get("country") or "ES", b.get("depot_lat"), b.get("depot_lon"))
                out["identity"] = filled if filled else False
            # ── number_bound ──────────────────────────────────────────────────────────────────
            # Honest scope: `tenants.number` RECORDS which line is this tenant's. It does not route
            # today — inbound is single-tenant through BRAIN_TENANT — but it is what §6's box reads
            # and what a second tenant would resolve against, and the unique index makes two tenants
            # sharing a line structurally impossible.
            if number and len(number) > 3:
                holder = await con.fetchval("select slug from tenants where number=$1", number)
                if holder in (None, tenant):
                    await con.execute(
                        "update tenants set number=$2, updated_at=now() "
                        "where slug=$1 and number is distinct from $2", tenant, number)
                    out["number_bound"] = True
                else:
                    out["number_note"] = f"number already bound to tenant {holder!r} — left alone"
                    log.warning("founder tenant: %s already holds %s — not rebinding", holder, number)
            # ── live ──────────────────────────────────────────────────────────────────────────
            # DERIVED: only claim it when the catalogue and the number are both really there. A
            # tenant with no SKUs is not live, whatever a flag says.
            if out["skus"] > 0 and out["number_bound"]:
                claimed = await con.fetchval(
                    "update tenants set golive_at=now(), updated_at=now() "
                    "where slug=$1 and golive_at is null returning golive_at", tenant)
                out["golive"] = claimed is not None
                out["already_live"] = claimed is None
    except Exception:
        log.exception("founder tenant: provisioning failed (fail-soft — boot continues)")
        out["error"] = True
        return out
    # ── the delivery RULE, through the module that owns it (never a second writer) ────────────
    try:
        from brain import range as _range
        async with pool.acquire() as con:
            existing = await _range.get_range(con, tenant)
            # `set` = the rule is EVALUABLE (a radius AND a depot to measure from). Only fill a rule
            # that is not yet evaluable — a boss who has set his own radius keeps it.
            if not existing.get("set") and b.get("range_km"):
                await _range.set_range(con, tenant, range_km=b.get("range_km"),
                                       depot_lat=b.get("depot_lat"), depot_lon=b.get("depot_lon"),
                                       depot_label=b.get("depot_label", ""))
                out["range"] = True
    except Exception:
        log.debug("founder tenant: delivery range ensure fail-soft", exc_info=True)
    # ── the prep cutoff / dispatch settings: FILL HOLES ONLY ──────────────────────────────────
    # A live settings row is the boss's own configuration. The seeded world's `prep_cutoff` is only
    # written when the key is genuinely absent — a provisioner that overwrites a boss's dispatch time
    # at every boot is a bug, not a convenience.
    try:
        st = dict(await supa.settings_get(ORDERS_AGENT_ID) or {})
        cutoff = str(b.get("prep_cutoff") or "").strip()
        if cutoff and not str(st.get("schedule_time") or "").strip():
            st["schedule_time"] = cutoff
            await supa.settings_set(ORDERS_AGENT_ID, {**_DEFAULT_DISPATCH, **st})
            out["prep_cutoff"] = cutoff
    except Exception:
        log.debug("founder tenant: dispatch settings ensure fail-soft", exc_info=True)
    log.info("founder tenant ensured: %s", out)
    return out


async def _after_seed_provision() -> dict:
    """Re-run the founder-tenant provisioning after any operation that LOADS or WIPES the seeded
    world. Without this there is a sequencing trap that is very easy to walk into and hard to see:
    the seed creates the catalogue, but `golive_at` is only claimed when a catalogue already exists —
    so a box seeded AFTER boot would sit with `live` unticked until the next restart, and «why is it
    not live?» would have no visible answer. Fail-soft: a provisioning hiccup never fails the seed
    call that just succeeded."""
    try:
        return await _ensure_founder_tenant()
    except Exception:
        log.exception("post-seed founder-tenant provisioning failed (the seed itself is unaffected)")
        return {"error": True}


async def _founder_tenant_state(tenant: str = "") -> dict:
    """Everything the Settings screen needs about the tenant, in ONE read: the row, the §6 checkbox
    set, the catalogue count (real vs seeded), the delivery rule and the prep cutoff. The boxes come
    from `lifecycle`, computed on the founder's own scope — the same derivation the mind reads, so
    the screen can never disagree with the employee.

    `tenant` comes from the CALLER'S SESSION (`ctx["tenant_slug"]`), never from the client — the
    2026-07-27 app-rail rule. It defaults to BRAIN_TENANT for the boot-time / founder callers."""
    tenant = tenant or config.BRAIN_TENANT
    out: dict = {"tenant": tenant}
    pool = supa.get_pool()
    try:
        async with pool.acquire() as con:
            row = await con.fetchrow(
                "select slug, name, tagline, status, seeded, address, city, region, country, lat, lng,"
                "       number, golive_at, inventory_enabled from tenants where slug=$1", tenant)
            out["row"] = {k: (v.isoformat() if hasattr(v, "isoformat") else v)
                          for k, v in dict(row).items()} if row else None
            out["catalogue"] = {
                "total": int(await con.fetchval(
                    "select count(*) from catalogue_skus where tenant_id=$1", tenant) or 0),
                "in_assortment": int(await con.fetchval(
                    "select count(*) from catalogue_skus where tenant_id=$1 and in_assortment",
                    tenant) or 0),
                "seeded": int(await con.fetchval(
                    "select count(*) from catalogue_skus where tenant_id=$1 and seeded", tenant) or 0),
            }
    except Exception:
        log.exception("founder tenant state: tenant/catalogue read failed")
    try:
        import lifecycle as _lifecycle
        import runtime as _rt
        creator = "+" + next(iter(sorted(config.CREATOR_DIGITS)), "")
        scope = _rt.scope_of(creator)
        ctx = await _lifecycle.onboarding_ctx(scope)
        boxes = _lifecycle.boxes_of(ctx, tier="creator", is_founder=True)
        out["scope"] = scope
        out["boxes"] = boxes
        out["next_box"] = _lifecycle.next_box(boxes)
        out["box_labels"] = _lifecycle.BOX_LABEL
        out["tenant_resolved"] = ctx.get("tenant_resolved")
    except Exception:
        log.exception("founder tenant state: lifecycle read failed")
    try:
        from brain import range as _range
        async with pool.acquire() as con:
            out["range"] = await _range.get_range(con, tenant)
    except Exception:
        log.debug("founder tenant state: range read fail-soft", exc_info=True)
    try:
        out["dispatch"] = await _dispatch_settings()
    except Exception:
        log.debug("founder tenant state: dispatch read fail-soft", exc_info=True)
    return out


@router.get("/api/app/tenant")
async def api_app_tenant(ctx: dict = Depends(require_app_cap('read'))) -> JSONResponse:
    """Settings: WHO THIS DISTRIBUTOR IS and how far through onboarding they really are.
    → {tenant, row, catalogue:{total,in_assortment,seeded}, boxes, next_box, range, dispatch}.
    Every field is a read of real state — the same derivation the employee's own fold carries.
    The tenant comes from the SESSION (`ctx["tenant_slug"]`), never from the client."""
    return JSONResponse(_jsonsafe(await _founder_tenant_state(ctx.get("tenant_slug", ""))))


@router.post("/api/app/tenant/provision")
async def api_app_tenant_provision(ctx: dict = Depends(require_app_founder)) -> JSONResponse:
    """Founder: re-run the founder-tenant provisioning by hand (it also runs at boot). Idempotent —
    binds the number, claims go-live once the catalogue is really there, and fills only holes."""
    res = await _ensure_founder_tenant()
    log.info("founder tenant provisioned by %s: %s", ctx.get("email"), res)
    return JSONResponse(_jsonsafe({"ok": not res.get("error"), "result": res,
                                   "state": await _founder_tenant_state()}))


# ── THE CATALOGUE, VISIBLE AND RE-UPLOADABLE FROM THE APP (Peter: "they can re-upload it") ───────
@router.get("/api/app/catalogue")
async def api_app_catalogue(limit: int = 500, ctx: dict = Depends(require_app_cap('read'))) -> JSONResponse:
    """The tenant's REAL catalogue: counts + the rows themselves.
    → {tenant, count, in_assortment, seeded, skus:[{id,code,name,family,base_unit,price,
       in_assortment,seeded,source}]}.

    `seeded` and `source` ride EVERY row on purpose (§3: a seeded row must be distinguishable from a
    real one wherever it is read). `/api/ecom/catalogue` — the other read of this same table — does
    NOT carry them today (brain/catalogue.company_catalogue omits the column), which is why this read
    exists rather than reusing it. `source`: 'seed' (demo world) · 'upload' (this tenant's own
    namespace, `{tenant}:<hash>` ids from brain/golive.seed_catalogue) · 'medusa' · 'other'.

    The tenant is the SESSION'S (`ctx["tenant_slug"]`) — the client never names it (2026-07-27 rail)."""
    tenant = ctx.get("tenant_slug") or config.BRAIN_TENANT
    lim = max(1, min(int(limit or 500), 5000))
    pool = supa.get_pool()
    async with pool.acquire() as con:
        rows = await con.fetch(
            """select id, code, name, family, base_unit, variable_weight, price::float8 as price,
                      in_assortment, seeded, medusa_variant_id
                 from catalogue_skus where tenant_id=$1
                order by (family is null), family, name limit $2""", tenant, lim)
        total = int(await con.fetchval(
            "select count(*) from catalogue_skus where tenant_id=$1", tenant) or 0)
        live = int(await con.fetchval(
            "select count(*) from catalogue_skus where tenant_id=$1 and in_assortment", tenant) or 0)
        seeded = int(await con.fetchval(
            "select count(*) from catalogue_skus where tenant_id=$1 and seeded", tenant) or 0)

    def _source(r: dict) -> str:
        if r.get("seeded"):
            return "seed"
        if str(r.get("id") or "").startswith(f"{tenant}:"):
            return "upload"
        if r.get("medusa_variant_id"):
            return "medusa"
        return "other"

    skus = [{**{k: v for k, v in dict(r).items() if k != "medusa_variant_id"},
             "source": _source(dict(r))} for r in rows]
    return JSONResponse(_jsonsafe({"tenant": tenant, "count": total, "in_assortment": live,
                                   "seeded": seeded, "returned": len(skus), "skus": skus}))


@router.post("/api/app/catalogue/upload")
async def api_app_catalogue_upload(file: UploadFile = File(...),
                                   ctx: dict = Depends(require_app_cap('admin'))) -> JSONResponse:
    """Settings → «volver a subir el catálogo». A real file (xlsx/csv/pdf/photo) → the tenant's
    grounding catalogue.

    DELIBERATELY NOT A FORK. It composes the two modules that already own the two halves:
      · `brain/skuparse.parse_catalogue` — the exact parser the onboarding wizard uses (Excel/CSV
        columns, PDF text, OCR of a photographed price sheet, forced-tool extraction + heuristic
        fallback). Same parser ⇒ the same rows the wizard would have produced.
      · `brain/golive.seed_catalogue` — the ONE catalogue writer, whose own docstring names this
        caller: "the WP-2 golive endpoint, a re-upload and a repair run all call the same function".
        Tenant-namespaced ids, no re-embedding of unchanged rows, and it REFUSES an empty set so a
        bad upload can never wipe a live grounding catalogue.

    WHAT IT DOES AND DOES NOT REPLACE (say it plainly, because it is surprising): `seed_catalogue`
    retires rows in ITS OWN id namespace (`{tenant}:…`) that the new file omits. Rows that came from
    somewhere else — the SEEDED demo catalogue's `sku-…` ids, Medusa's `mv-…` — are outside that
    namespace and are LEFT ALONE. So on a seeded box this ADDS to the world rather than replacing it,
    and the demo catalogue is removed by the demo reset, never by an upload. That is the safe
    direction: an upload can never silently delete rows it did not create."""
    try:
        content = await file.read()
    except Exception:
        raise HTTPException(400, "no se pudo leer el archivo")
    if not content:
        raise HTTPException(400, "el archivo está vacío")
    filename = file.filename or "catalogo"
    import tempfile

    from brain import golive as brain_golive
    from brain import skuparse as brain_skuparse
    suffix = os.path.splitext(filename)[1][:12]
    tmp = ""
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as fh:
            fh.write(content)
            tmp = fh.name
        parsed = await brain_skuparse.parse_catalogue(tmp, filename)
    finally:
        if tmp:
            try:
                os.unlink(tmp)
            except OSError:
                pass
    if not parsed.get("ok") or not parsed.get("skus"):
        return JSONResponse({"ok": False, "count": 0,
                             "error": parsed.get("error") or "No se han encontrado artículos en el archivo."},
                            status_code=422)
    tenant = ctx.get("tenant_slug") or config.BRAIN_TENANT
    res = await brain_golive.seed_catalogue(tenant, parsed["skus"])
    if not res.get("ok"):
        log.warning("app catalogue upload refused for %s: %s", tenant, res.get("reason"))
        return JSONResponse({"ok": False, "count": 0, "reason": res.get("reason"),
                             "error": "No se pudo guardar el catálogo."}, status_code=422)
    log.info("app catalogue upload by %s: %s → %s parsed, %s",
             ctx.get("email") or "?", filename, parsed.get("count"), res)
    return JSONResponse(_jsonsafe({"ok": True, "parsed": parsed.get("count", 0), **res,
                                   "state": await _founder_tenant_state(tenant)}))


# ══════════════════════════════════════════════════════════════════════════════════════════════════
#  §5.10.2 · THE CATALOGUE INTAKE — paste or upload, any day, from either app, SEEN before it lands
#  (Peter, 2026-07-27. The whole feature is the MIDDLE step: give it anything → see what was
#   understood → correct it → commit. An importer that silently commits its own guesses is exactly
#   the thing this product refuses everywhere else.)
#
#  ONE ROAD, TWO DOORS. The phone signs in with a Supabase BEARER; the desk exchanged its bearer for
#  a `sup_session` COOKIE the moment it signed in and no longer holds a token. Two credentials, one
#  set of routes: `_intake_gate` accepts either and resolves both to the same {tenant, actor}. The
#  alternative — a second route family under /api/sup — would have meant two handlers that must be
#  kept saying the same thing about the same table, which is how a desk and a phone start disagreeing
#  about what an upload does. The cookie door still carries its OWN discipline: `sup_api.require_sup`
#  performs the X-Sup-CSRF double-submit check on every unsafe method, so nothing is relaxed to get
#  the desk in — and the tenant is ALWAYS the session's, never the body's.
#
#  `POST /api/app/catalogue/upload` above survives untouched as the parse-and-commit-in-one shim,
#  because clients that call it already exist. It does not grow a second writer; neither does this.
# ══════════════════════════════════════════════════════════════════════════════════════════════════

async def _intake_gate(request: Request, response: Response,
                       authorization: str = Header(default="")) -> dict:
    """A verified app bearer OR a verified supplier cookie session, with `admin` required on both.
    → {tenant, actor, door}. Refuses LOUD; there is no fall-open on either side."""
    if _bearer(authorization):
        ctx = await require_app_user(authorization=authorization)
        if not brain_auth.app_can(ctx.get("role", ""), "admin"):
            raise HTTPException(403, "cap_required:admin")
        return {"tenant": ctx.get("tenant_slug") or config.BRAIN_TENANT,
                "actor": ctx.get("email") or "", "door": "app"}
    import sup_api
    ctx = await sup_api.require_sup(request, response)     # verifies the cookie AND the CSRF token
    if not sup_api.sup_session.can(ctx.get("role", ""), "admin"):
        raise HTTPException(403, "cap_required:admin")
    return {"tenant": ctx.get("tenant_slug") or config.BRAIN_TENANT,
            "actor": ctx.get("actor_email") or ctx.get("email") or "", "door": "desk"}


@router.post("/api/app/catalogue/intake")
async def api_catalogue_intake_create(request: Request, response: Response,
                                      gate: dict = Depends(_intake_gate)) -> JSONResponse:
    """Start an ingestion. `multipart` with a `file`, OR JSON `{"text": "…"}` for a PASTE.
    → {ok, id, state:'parsing'}. The parse runs in the BACKGROUND: a real Excel takes tens of
    seconds and a phone must not hold a socket open for it — poll the GET below.

    The body is read by CONTENT TYPE rather than declared as a `File(...)` parameter, because a
    route that declares one cannot also accept a JSON body — and «paste OR upload» is the whole
    point of this route existing."""
    text: str | None = None
    raw: bytes | None = None
    name = ""
    if (request.headers.get("content-type") or "").lower().startswith("multipart/form-data"):
        form = await request.form()
        up = form.get("file")
        if up is None or not hasattr(up, "read"):
            raise HTTPException(400, "falta el archivo")
        try:
            raw = await up.read()
        except Exception:
            raise HTTPException(400, "no se pudo leer el archivo")
        if not raw:
            raise HTTPException(400, "el archivo está vacío")
        name = getattr(up, "filename", "") or "catálogo"
        kind = "file"
    else:
        try:
            body = await request.json()
        except Exception:
            body = {}
        text = str((body or {}).get("text") or "")
        if not text.strip():
            raise HTTPException(400, "no hay nada que leer")
        # REFUSE an over-long paste rather than keeping the first N characters. A silently-clipped
        # paste is a catalogue with a hole in it that nobody can see.
        if len(text) > brain_skuparse._MAX_TEXT_CHARS:
            raise HTTPException(413, (
                f"El texto es demasiado largo ({len(text)} caracteres, el máximo es "
                f"{brain_skuparse._MAX_TEXT_CHARS}). Súbelo como archivo y lo leo entero."))
        name = str((body or {}).get("name") or "pegado")[:200]
        kind = "paste"
    res = await brain_onboarding.create_intake(
        gate["tenant"], gate["actor"], source_kind=kind, source_name=name,
        raw_bytes=raw, text=text)
    if not res.get("ok"):
        raise HTTPException(500, res.get("reason") or "no se pudo iniciar la lectura")
    asyncio.create_task(brain_onboarding.run_intake(res["id"]))
    return JSONResponse(_jsonsafe(res))


@router.get("/api/app/catalogue/intake")
async def api_catalogue_intake_list(limit: int = 20,
                                    gate: dict = Depends(_intake_gate)) -> JSONResponse:
    """This tenant's recent ingestions, newest first — «what did I upload, and what happened to it»."""
    return JSONResponse(_jsonsafe({"intakes": await brain_onboarding.list_intakes(
        gate["tenant"], limit)}))


@router.get("/api/app/catalogue/intake/{intake_id}")
async def api_catalogue_intake_get(intake_id: str,
                                   gate: dict = Depends(_intake_gate)) -> JSONResponse:
    """The preview. → {id, state, rows (parsed ⊕ edits), warnings, diff:{nuevos, cambian, iguales,
    salen, renames}}. The DIFF is computed against the destination at READ time, so it is never a
    promise made against a catalogue that has moved on since."""
    out = await brain_onboarding.get_intake(intake_id, gate["tenant"])
    if out is None:
        raise HTTPException(404, "no encontrado")
    return JSONResponse(_jsonsafe(out))


# `patch_intake` refuses with a MACHINE TAG (`brain/onboarding.py` — bad_price / no_ops / not_ready),
# and this route used to hand that tag straight to `detail`. The Android side renders `detail`
# VERBATIM by design — `ui/importflow/CatalogueIntakeClient.detailOf()`, whose own comment reads "the
# backend writes its refusals for the boss, in es-ES; render them, never a status code" — so a
# distributor who mistyped a price while fixing his catalogue was shown the word «bad_price». The tag
# is right for the log; the sentence is what the boss gets. Every reason the function can return is
# named here, and the fallback is a sentence rather than the tag, so a NEW reason degrades to
# «no he podido» instead of leaking a fresh identifier onto the phone.
_PATCH_INTAKE_ES = {
    "bad_price": "Ese precio no me cuadra. Escríbelo en euros, por ejemplo 12,50.",
    "no_ops": "No me has cambiado nada, así que no hay nada que guardar.",
    "not_ready": "La lista todavía se está leyendo. Dame un segundo y vuelve a probar.",
}


@router.patch("/api/app/catalogue/intake/{intake_id}")
async def api_catalogue_intake_patch(intake_id: str, request: Request,
                                     gate: dict = Depends(_intake_gate)) -> JSONResponse:
    """The corrections: `{"ops": {"<row>": {"name": …, "price": …} | {"drop": true} | null}}`.
    `parsed` is never mutated — the edits overlay it — so after a human has fixed a list we can
    still see exactly what the parser got wrong, which is what tunes it."""
    try:
        body = await request.json()
    except Exception:
        body = {}
    ops = (body or {}).get("ops")
    if not isinstance(ops, dict):
        raise HTTPException(400, "faltan las correcciones")
    out = await brain_onboarding.patch_intake(intake_id, gate["tenant"], ops)
    if out is None:
        raise HTTPException(404, "no encontrado")
    if out.get("ok") is False:
        raise HTTPException(409 if out.get("reason") == "not_ready" else 400,
                            _PATCH_INTAKE_ES.get(out.get("reason") or "",
                                                 "No he podido guardar la corrección."))
    return JSONResponse(_jsonsafe(out))


@router.post("/api/app/catalogue/intake/{intake_id}/commit")
async def api_catalogue_intake_commit(intake_id: str, request: Request,
                                      gate: dict = Depends(_intake_gate)) -> JSONResponse:
    """Install it, through `brain/golive.seed_catalogue` and nothing else.

    Body (all optional): `{"carry_over": [{"from": <sku id>, "to": <sku id>}], "override": bool}`.
    `carry_over` is the accepted RENAMES — re-point what a customer taught us about the old article
    at the new one. `override` is the explicit «guárdalo igual» when the count guard fired.

    IDEMPOTENT ON THE INTAKE ID: a retry after a lost response returns the first commit's stored
    result rather than seeding twice."""
    try:
        body = await request.json()
    except Exception:
        body = {}
    carry = [c for c in ((body or {}).get("carry_over") or []) if isinstance(c, dict)]
    out = await brain_onboarding.commit_intake(
        intake_id, gate["tenant"], carry_over=carry,
        override_guard=bool((body or {}).get("override")))
    if out is None:
        raise HTTPException(404, "no encontrado")
    if out.get("ok") is False:
        code = 409 if out.get("reason") in ("count_guard", "not_ready") else 422
        return JSONResponse(_jsonsafe(out), status_code=code)
    log.info("catalogue intake %s committed by %s (%s door)", intake_id, gate["actor"], gate["door"])
    return JSONResponse(_jsonsafe(out))


@router.post("/api/app/catalogue/intake/{intake_id}/discard")
async def api_catalogue_intake_discard(intake_id: str,
                                       gate: dict = Depends(_intake_gate)) -> JSONResponse:
    """Throw it away. The row survives as the record that somebody looked and said no; the bytes go."""
    out = await brain_onboarding.discard_intake(intake_id, gate["tenant"])
    if out is None:
        raise HTTPException(404, "no encontrado")
    if out.get("ok") is False:
        # Same rule as the PATCH above: the tag goes to the log, a sentence goes to the boss.
        log.info("intake %s discard refused: %s", intake_id, out.get("reason") or "?")
        raise HTTPException(409, "No he podido descartar esta lista.")
    return JSONResponse(_jsonsafe(out))
# ══ end of the §5.10.2 intake block ═══════════════════════════════════════════════════════════════


@router.post("/api/wizard/{token}/catalogue")
async def api_wizard_catalogue(token: str, file: UploadFile = File(...)) -> JSONResponse:
    """Public: multipart catalogue upload → store, parse to real SKU rows (skuparse), soft Haiku
    legit-check, and (when legit) fire the heavy Opus understand pass in the background. Returns the
    REAL parsed count + legit flag (kills the '248' mock). 404 for an invalid/used token."""
    try:
        content = await file.read()
    except Exception:
        raise HTTPException(400, "bad upload")
    filename = file.filename or "catalogue"
    saved = await brain_onboarding.save_catalogue(token, filename, content)
    if saved is None:
        raise HTTPException(404, "not found")
    try:
        res = await brain_ob_ext.process_catalogue(token, saved.get("path", ""), filename)
    except Exception:
        log.exception("catalogue processing failed")
        return JSONResponse({"ok": False, "count": 0, "legit": False, "checking": False,
                             "error": "No pudimos procesar el catálogo."})
    return JSONResponse(res)


@router.get("/api/wizard/{token}/catalogue-status")
async def api_wizard_catalogue_status(token: str) -> JSONResponse:
    """Public: the mobile→desktop poll — {submitted, legit, checking, count}. 404 for a bad token."""
    res = await brain_ob_ext.catalogue_status(token)
    if res is None:
        raise HTTPException(404, "not found")
    return JSONResponse(res)


@router.get("/api/wizard/{token}/matching")
async def api_wizard_matching(token: str) -> JSONResponse:
    """Public: step-2 poll — {status, products, unmatched, auto_accept_rules, hold_rules}. Self-heals
    (kicks the Opus pass if a legit catalogue exists but matching never ran). 404 for a bad token."""
    res = await brain_ob_ext.matching(token)
    if res is None:
        raise HTTPException(404, "not found")
    return JSONResponse(res)


@router.post("/api/wizard/{token}/send-catalogue-step")
async def api_wizard_send_catalogue_step(token: str) -> JSONResponse:
    """Public: email the deep-link to open the catalogue step on the customer's computer."""
    res = await brain_ob_ext.send_catalogue_step(token)
    if res.get("error") == "not_found":
        raise HTTPException(404, "not found")
    return JSONResponse(res)


@router.get("/api/wizard/{token}/qr")
async def api_wizard_qr(token: str) -> Response:
    """Public: an SVG QR of the personalized wizard link (desktop→mobile handoff). Always 200 SVG."""
    # ?up=1 → the phone that scans lands straight on the dropzone to snap/upload the catalogue.
    url = f"{brain_onboarding.PUBLIC_BASE_URL}/onboarding/{token}?up=1"
    svg = brain_ob_ext.qr_svg(url)
    return Response(content=svg, media_type="image/svg+xml", headers={"Cache-Control": "no-store"})


@router.post("/api/wizard/{token}/voice-rule")
async def api_wizard_voice_rule(token: str, audio: UploadFile = File(...), kind: str = Form("accept")) -> JSONResponse:
    """Public: real voice-edit — a recorded clip → Deepgram STT → Haiku extracts one accept/hold rule."""
    try:
        content = await audio.read()
    except Exception:
        raise HTTPException(400, "bad upload")
    res = await brain_ob_ext.voice_rule(token, content, audio.content_type or "audio/webm", kind)
    if res.get("error") == "not_found":
        raise HTTPException(404, "not found")
    return JSONResponse(res)


# ──────────────────────────── Setup fee (€50 alta) — Stripe Checkout gate ────────────────────────────
@router.post("/api/wizard/{token}/call-me")
async def api_wizard_call_me(token: str) -> JSONResponse:
    """WP-8 THE EMBEDDED CALL: at the end of onboarding (catalogue loaded, fee NOT yet paid), Rocoto
    calls the founder NOW. Their lifecycle is onboarded_unpaid + their product DIRECTORY is already
    pinned, so he opens the call already embedded (knows their products) and closes the setup fee once."""
    import demo_call
    if not demo_call.configured():
        return JSONResponse({"ok": False, "reason": "call_not_configured"})
    try:
        pool = supa.get_pool()
        async with pool.acquire() as con:
            row = await con.fetchrow(
                "select l.phone, l.name from onboarding_tokens t join leads l on l.id=t.lead_id "
                "where t.token=$1", token)
        if not row or not row["phone"]:
            raise HTTPException(404, "not found")
        # B3: no scripted greeting. The opener is the ring-time pin's tier role block — which, at this
        # point in onboarding, is the onboarded_unpaid brief with their DIRECTORY already pinned.
        res = await demo_call.place_call_to(row["phone"], locale="es", name=row["name"] or "")
        return JSONResponse({"ok": True, "sid": res.get("sid"), "status": res.get("status")})
    except HTTPException:
        raise
    except Exception:
        log.exception("wizard call-me failed")
        return JSONResponse({"ok": False, "reason": "call_failed"})


@router.post("/api/wizard/{token}/checkout")
async def api_wizard_checkout(token: str) -> JSONResponse:
    """Public: create the Stripe Checkout Session for the €50 alta and return its hosted URL. The
    frontend saves the final wizard state first, then redirects to {url}. When payment isn't configured
    for this (test) token, returns {error:'not_configured'} so the frontend can fall back to a direct
    unpaid waitlist join."""
    res = await brain_setupfee.create_checkout(token)
    if res.get("error") == "not_found":
        raise HTTPException(404, "not found")
    return JSONResponse(res)


@router.post("/api/wizard/{token}/payment-complete")
async def api_wizard_payment_complete(token: str, payload: dict) -> JSONResponse:
    """Public: the browser-return fast path. Verifies the Checkout session (body {sid}) with Stripe,
    finalizes onboarding (join waitlist) and sends the branded invoice email — all idempotent with the
    webhook. Returns {ok, paid, waitlist, lead}."""
    sid = (payload or {}).get("sid") or (payload or {}).get("session_id") or ""
    res = await brain_setupfee.complete_from_session(sid, token)
    if res.get("error") == "not_found":
        raise HTTPException(404, "not found")
    return JSONResponse(res)


@router.post("/api/stripe/webhook")
async def api_stripe_webhook(request: Request) -> JSONResponse:
    """Stripe webhook (checkout.session.completed / invoice.paid). Signature-verified inside
    handle_webhook against the live+test signing secrets. Authoritative backstop so a closed tab still
    finalizes onboarding and still gets the invoice email."""
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    res = await brain_setupfee.handle_webhook(payload, sig)
    if res.get("error") == "bad_signature":
        raise HTTPException(400, "bad signature")
    if res.get("error") == "handler_error":
        # a retryable failure (finalize/email/Stripe blip) → 5xx so Stripe redelivers the event.
        raise HTTPException(500, "handler error")
    # WP-4: a CUSTOMER payment attributable to a party (an invoice tab registered in entity_map at
    # creation) ALSO lands on the spine so the runtime knows + the cascade resolves the invoice tab.
    # setupfee onboarding stays a projection (unknown id → skipped). Duties-vs-cascade precedence: the
    # metered SALARY invoice fires employment.* via /api/employment/event (the duty binder); a customer
    # invoice payment fires the tab cascade here — different scopes + event types, so no collision.
    try:
        import json as _json

        import runtime as _rt
        evt = _json.loads(payload or b"{}")
        if (evt.get("type") or "") in ("invoice.paid", "invoice.payment_succeeded", "payment_intent.succeeded"):
            obj = (evt.get("data") or {}).get("object") or {}
            oid = obj.get("id") or ""
            if oid:
                await _rt.ingest_payment_webhook("stripe", oid, "stripe.payment", {"stripe_event": evt.get("type")})
    except Exception:
        log.debug("stripe→spine emit fail-soft", exc_info=True)
    # §5.11.6 · THE DRIVER'S CARD COBRO SETTLES HERE, and this is the ONLY place it can. A Checkout
    # session minted by `reparto_api._mint_link` carries our own metadata (the order ids + tenant);
    # `record_checkout_paid` turns a paid session into ledger rows and closes the money aviso. It is
    # deliberately NOT optimistic upstream: the driver's screen flips to PAGADO because Stripe said
    # so, never because a link was opened. Idempotent on the session id, because Stripe redelivers.
    # NOTE the direction of the guard: reparto_api refuses to MINT a link until this call exists
    # (`settling_is_wired`, registered at import below), so the state "customer paid, ledger never
    # heard" cannot be produced by landing one half of this change.
    try:
        import reparto_api as _reparto
        evt2 = __import__("json").loads(payload or b"{}")
        if (evt2.get("type") or "") == "checkout.session.completed":
            await _reparto.record_checkout_paid((evt2.get("data") or {}).get("object") or {})
    except Exception:
        # Fail-soft on the RESPONSE, never on the record: a raise here would 500 and Stripe would
        # redeliver, which is the correct backstop, but it must not take down the setupfee path that
        # already succeeded above. record_checkout_paid logs its own failures loudly.
        log.exception("reparto: checkout.session.completed did not settle")
    # brain/order_payment.py — the customer portal's «Paga con tarjeta» button. Same convention as
    # every other Stripe consumer on this one endpoint: routed by `metadata.kind`, so an event that
    # isn't ours (`CHECKOUT_KIND` mismatch) is a no-op inside `on_webhook`, never a raise here.
    try:
        import json as _json2

        from brain import order_payment as _order_payment
        evt3 = _json2.loads(payload or b"{}")
        if (evt3.get("type") or "") == "checkout.session.completed":
            await _order_payment.on_webhook((evt3.get("data") or {}).get("object") or {}, evt3["type"])
    except Exception:
        log.exception("order_payment: checkout.session.completed did not settle")
    # brain/pedidos_billing.py — Rocoto Pedidos' S/M/L/XL band subscriptions (spec §5). Same
    # convention as the three consumers above: one Stripe endpoint, one signing secret; it verifies
    # the signature itself and no-ops loudly on any event whose metadata.kind isn't 'rocoto_pedidos'
    # (or that doesn't match a stripe_subscription_id it knows), so it never fights the others for an
    # event. Its own bad_signature is non-fatal here (the setupfee handler above already verified this
    # SAME payload+sig against the SAME secrets) — only a genuine handler failure 5xxs so Stripe retries.
    try:
        pres = await brain_pedidos_billing.handle_webhook(payload, sig)
        if pres.get("error") == "handler_error":
            raise HTTPException(500, "pedidos webhook handler error")
        # THE OTHER HALF OF THE ALTA ALERT (2026-08-14). Peter asked the account email to say
        # «whether payment completed or they stopped at checkout», and one email cannot: on this
        # product the account always exists BEFORE Checkout, because /plan sits behind the sign-in
        # gate. So the alta alert fires at sign-up reading «pendiente», and this fires when the money
        # lands. It hangs off `handle_webhook`'s own RETURN VALUE rather than living inside
        # pedidos_billing, so the money module gains no knowledge of, and no exposure to, a mailer.
        if pres.get("handled") == "checkout.session.completed" and pres.get("tenant_slug"):
            brain_lead_notify.spawn(brain_lead_notify.alert_paid(
                pres["tenant_slug"], pres.get("band") or ""))
    except HTTPException:
        raise
    except Exception:
        log.exception("pedidos_billing: webhook handling failed")
    return JSONResponse({"ok": True, **res})


# The salary sense adapter: it translates its provider vocabulary (Stripe metered-invoice `kind`) into
# the canonical duty events the `chase_salary` manifest row reacts to. The adapter is the ONLY place
# that knows this mapping — the runtime past it is fully generic (runtime.on_duty_sense → the binder).
_SALARY_KIND_EVENT = {
    "payment_failed": "employment.salary_failed", "overdue": "employment.salary_failed",
    "payment_ok": "employment.invoice_paid", "invoice_paid": "employment.invoice_paid",
}


@router.post("/api/employment/event")
async def api_employment_event(payload: dict, ctx: dict = Depends(require_owner)) -> JSONResponse:
    """The salary sense (SPEC §16.4 / §16.6) — a metered-GMV invoice charge on a tenant's own scope.
    kind ∈ payment_failed|payment_ok|overdue|invoice_paid is mapped to a canonical duty event and fed
    to the GENERIC binder (which the `chase_salary` manifest row drives). Owner-gated; the real Stripe
    metered-invoice webhook calls this once a tenant is billing. Alternatively pass `event` directly to
    fire any duty sense. Ready now (no paying tenant yet)."""
    import runtime
    scope = (payload or {}).get("tenant_scope", "")
    invoice_key = (payload or {}).get("invoice_key", "")
    kind = (payload or {}).get("kind", "")
    event = (payload or {}).get("event", "") or _SALARY_KIND_EVENT.get(kind, "")
    if not (scope and invoice_key and event):
        raise HTTPException(400, "need tenant_scope, invoice_key, and (kind|event)")
    sense_payload = {"invoice_key": invoice_key, "amount": float((payload or {}).get("amount", 0) or 0)}
    res = await runtime.on_duty_sense(scope, event, sense_payload,
                                      dedupe_key=f"emp:{invoice_key}:{kind or event}")
    return JSONResponse({"ok": True, **res})


# ── ConvAI voice-agent on-ramp: server tools (bearer=ROCOTO_AGENT_TOOL_SECRET) + post-call webhook ──
def require_agent_secret(authorization: str = Header(default="")) -> None:
    """Guard the /api/agent/* server tools. In prod a matching bearer is REQUIRED; in dev (secret
    unset) it falls open for local testing — mirrors require_key's posture."""
    secret = getattr(config, "ROCOTO_AGENT_TOOL_SECRET", "") or ""
    if not secret:
        if config.IS_PROD:
            raise HTTPException(503, "agent tools misconfigured: secret unset")
        return
    if not hmac.compare_digest(authorization, f"Bearer {secret}"):
        raise HTTPException(401, "bad agent secret")


@router.post("/api/agent/lead")
async def api_agent_lead(payload: dict, _: None = Depends(require_agent_secret)) -> JSONResponse:
    """ConvAI server tool: upsert a lead from what the agent learned mid-call (CRM write)."""
    return JSONResponse(await brain_ob_ext.agent_lead(payload or {}))


@router.post("/api/agent/slots")
async def api_agent_slots(payload: dict, _: None = Depends(require_agent_secret)) -> JSONResponse:
    """ConvAI server tool: Peter's next open cal.com slots so the agent offers real times."""
    return JSONResponse(await brain_ob_ext.agent_slots(payload or {}))


@router.post("/api/agent/book")
async def api_agent_book(payload: dict, _: None = Depends(require_agent_secret)) -> JSONResponse:
    """ConvAI server tool: book A CALL WITH PETER (cal.com) + advance the lead."""
    return JSONResponse(await brain_ob_ext.agent_book(payload or {}))


def _verify_eleven_sig(raw: bytes, header: str, secret: str) -> bool:
    """Verify an ElevenLabs post-call webhook HMAC. Header: 't=<ts>,v0=<hex>'; hash = HMAC-SHA256
    of '<ts>.<raw-body>' with the wsec. Never raises."""
    try:
        parts = dict(p.split("=", 1) for p in (header or "").split(",") if "=" in p)
        t, v0 = parts.get("t", ""), parts.get("v0", "")
        if not t or not v0:
            return False
        mac = hmac.new(secret.encode(), f"{t}.".encode() + raw, hashlib.sha256).hexdigest()
        return hmac.compare_digest(mac, v0)
    except Exception:
        return False


@router.post("/api/agent/postcall")
async def api_agent_postcall(request: Request) -> JSONResponse:
    """ConvAI post-call webhook: verify the ElevenLabs-Signature HMAC, then attach the full transcript
    to the matching lead (CRM). This body is a whole call in a stranger's words, so it is verified
    ALWAYS — an unset wsec refuses every delivery. Always 200 to the sender on match/no-match;
    401 on a bad, absent or unverifiable signature."""
    raw = await request.body()
    if not config.allow_unsigned_webhooks():
        secret = getattr(config, "ELEVENLABS_WEBHOOK_SECRET", "") or ""
        if not secret:
            log.error("refused ConvAI post-call webhook: ELEVENLABS_WEBHOOK_SECRET unset, so no "
                      "delivery can be verified")
            raise HTTPException(401, "bad signature")
        sig = request.headers.get("elevenlabs-signature", "")
        if not _verify_eleven_sig(raw, sig, secret):
            log.warning("rejected ConvAI post-call webhook: bad/absent ElevenLabs-Signature")
            raise HTTPException(401, "bad signature")
    try:
        payload = json.loads(raw.decode("utf-8") or "{}")
    except Exception:
        payload = {}
    return JSONResponse(await brain_ob_ext.agent_postcall(payload if isinstance(payload, dict) else {}))


@router.get("/api/trylive/config")
async def api_trylive_config() -> JSONResponse:
    """Public: whether the WhatsApp 'Get a message' path is live yet (flag + template gated)."""
    return JSONResponse(await brain_ob_ext.trylive_config())


@router.get("/api/cal/slots")
async def api_cal_slots(days: int = 7) -> JSONResponse:
    """Public: Peter's open cal.com slots for the native booker in the signup modal."""
    return JSONResponse(await brain_ob_ext.public_slots(days))


@router.post("/api/cal/book")
async def api_cal_book(payload: dict) -> JSONResponse:
    """Public: book a call for a signed-up lead (native booker). Idempotent per lead."""
    b = payload or {}
    return JSONResponse(await brain_ob_ext.public_book(str(b.get("lead_id") or ""), str(b.get("start") or "")))


@router.post("/api/cal/reschedule")
async def api_cal_reschedule(payload: dict, authorization: str = Header(default="")) -> JSONResponse:
    """Bearer-gated: move the SIGNED-IN user's existing booking to a new slot. The lead_id is resolved
    server-side from the authenticated user (via auth_state) — a client-supplied lead_id is never
    trusted, which closes the IDOR (nobody can move a stranger's call with a guessed lead_id)."""
    user = await brain_auth.verify_token(_bearer(authorization))
    if not user:
        raise HTTPException(401, "unauthorized")
    lead = await brain_auth.resolve_lead(user)  # read-only — no phantom-lead side effect on a read path
    lead_id = str((lead or {}).get("id") or "")
    if not lead_id:
        raise HTTPException(404, "no lead")
    start = str((payload or {}).get("start") or "")
    return JSONResponse(await brain_ob_ext.public_reschedule(lead_id, start))


@router.get("/api/waitlist/{code}")
async def api_waitlist_position(code: str) -> JSONResponse:
    """Public: a referral code's current waitlist position. 404 if the code isn't on the list."""
    pos = await brain_waitlist.position(code)
    if pos is None:
        raise HTTPException(404, "not found")
    return JSONResponse(pos)


import playbook_api  # noqa: E402


@router.get("/api/review/list")
async def api_review_list(ctx: dict = Depends(require_cr_session)) -> JSONResponse:
    """WP-2 the needs_human inbox: every parked action awaiting a human's approve/reject (cross-scope).

    Every row also says whether it is TEST DATA. The seeded world lives in the live schema now, so the
    sheet mixes a real first customer's order with the demo's three review reasons — and «is this
    real?» must be answerable at a glance, not by recognising a customer's name. The mark is the same
    one the teardown keys on (`payload.seed_world`), read here rather than re-derived: an unmarked row
    is REAL, which is the safe direction to fail in."""
    import runtime
    from brain import seed as _seed
    items = await runtime.review_list()
    for it in items:
        p = it.get("payload") or {}
        it["seeded"] = bool(isinstance(p, dict) and p.get("seed_world") == _seed.SEED_WORLD)
    return JSONResponse({"items": items})


@router.get("/api/app/review")
async def api_app_review(ctx: dict = Depends(require_app_cap("read"))) -> JSONResponse:
    """«LO QUE TE TOCA» — the comercial's queue, on the PHONE, reading the table the reasons live in.

    THE DEFECT THIS CLOSES (2026-07-27). The app was reading `/api/orders?status=needs_review` — the
    ORDERS table — and rendering `why`. But `orders` has no `why` and no `review_source` column, and
    never did: every park from the doubt faculty, the 1-hour question timeout, the low-stock hold, the
    delivery-radius flag and the order-value flag goes through `review.hold_for_review` into the
    control-plane `action` table. So the screen the whole review rule was built for showed a customer
    name and nothing else, while `orders.status='needs_review'` (the DEFAULT at extraction) made every
    unapproved order look like a review item. The rendered frames only looked right because the render
    fake supplied a field production could never populate.

    WHY NOT JUST OPEN `/api/review/list`: that one is tier-P and CROSS-SCOPE by design — it is the
    Control Room's view, where Peter watches every tenant at once. Handing that to a tenant's phone
    would be the isolation hole we closed this morning wearing a different hat. So this route runs the
    same rule, annotated the same way, filtered to the CALLER'S OWN TENANT, resolved server-side from
    the bearer (never a tenant in the request).

    Shape, per row — designed so the app can render the sentence AND act on it:
        {id, why, review_source, why_kind, money, created_at, seeded,
         party: {scope, phone, name},            # the business, never a bare number when we know it
         order: {id, lines, total, delivery_date} | null}
    `why` is the writer's own es-ES sentence and there is exactly ONE (§5.8a's tone law); the app must
    render it verbatim and must never compose its own from `review_source`.
    """
    slug = (ctx.get("tenant_slug") or "").strip()
    if not slug:
        raise HTTPException(403, "no_tenant")
    return JSONResponse({"items": await review_sheet_for_tenant(slug)})


async def review_sheet_for_tenant(slug: str) -> list[dict]:
    """The tenant's whole «lo que te toca» queue — parks + driver avisos, one sorted list.

    EXTRACTED from `api_app_review` (WP-D1) so the DESK's Home can serve the same rows without
    duplicating 130 lines of hard-won attribution logic: the order rung that survives a shared
    customer, the lenient jsonb reader, the datetime that 500'd JSONResponse, the seeded mark.
    Every comment below is that history and travels with the code. ONE implementation means the
    phone's sheet and the desk's dockets can never tell two different stories.
    """
    import review as _review

    # THE SHEET WAS EMPTY ON PROD (2026-07-27). Two defects behind one symptom, both closed here:
    #   (a) `scope_node.tenant_slug` was never written on the live rail (every WhatsApp party was
    #       created with NULL), so `n.tenant_slug = $1` matched nothing. Fixed at the source —
    #       `runtime.bind_scope_tenant`, called on every inbound, which also heals existing parties.
    #   (b) an INNER JOIN dropped every park whose scope has no `scope_node` row at all.
    #       `review.hold_for_review` writes the `action` row without ensuring one, and 4 of the 6
    #       pending reasons on prod had none — so those rows were invisible REGARDLESS of tenant.
    #
    # WHOSE MATTER IS THIS? — three rungs, most specific first:
    #   1. the ORDER the park is about (`payload.order_id` → `orders.tenant_id`). This is the rung
    #      that survives a SHARED CUSTOMER: a restaurant buying from two distributors has ONE
    #      `wa.<digits>` scope (customer scopes are flat — SPEC §1745), so `scope_node.tenant_slug`
    #      can physically hold only one of the two. The order can't be ambiguous; the scope can.
    #   2. `scope_node.tenant_slug` — the party's own tenant, for parks with no order.
    #   3. `tenancy.tenant_of(scope)` — the tenant in the path, else the single-tenant fallback.
    # An unattributed park therefore lands on the box's own tenant (Peter, tenant #1) and can never
    # surface on a stranger's sheet. TWO QUERIES, on purpose: `orders` is a legacy table with no
    # grant to `rocoto_ctrl`, so the join is done in Python rather than by widening tier-P's reach.
    import tenancy as _tenancy
    from brain import seed as _seed
    _tenant_expr = _tenancy.tenant_of_sql("a.scope", "$1")
    async with supa.control_pool().acquire() as con:
        cand = await con.fetch(
            "select a.id, a.scope::text as scope, a.kind, a.reason, a.payload, a.money, a.created_at, "
            "  coalesce(c.body,'') as party, "
            f"  coalesce(n.tenant_slug, {_tenant_expr}) as scope_tenant "
            "from action a "
            "left join scope_node n on n.scope = a.scope "
            "left join card c on c.scope = a.scope "
            "where a.state='pending' and a.needs_human=true and a.lineage='live' "
            "order by a.created_at asc limit 400", config.BRAIN_TENANT)
    def _pay(v) -> dict:
        # asyncpg gives jsonb back as a dict via the pool codec, but rows written before that codec
        # (and anything double-encoded) come back as a STRING. `review.annotate` has always been
        # lenient here; this must be too, or the order rung silently disappears and every park falls
        # through to its scope's tenant — which is exactly the ambiguity the order rung exists for.
        if isinstance(v, dict):
            return v
        if isinstance(v, str):
            try:
                d = json.loads(v or "{}")
                return d if isinstance(d, dict) else {}
            except ValueError:
                return {}
        return {}

    _oids = sorted({str(_pay(r["payload"]).get("order_id") or "") for r in cand} - {""})
    _order_tenant: dict[str, str] = {}
    if _oids:
        async with supa.get_pool().acquire() as ocon:
            for orow in await ocon.fetch(
                    "select id, tenant_id from orders where id = any($1::text[])", _oids):
                if orow["tenant_id"]:
                    _order_tenant[orow["id"]] = orow["tenant_id"]
    rows = []
    for r in cand:
        p_ = _pay(r["payload"])
        owner = _order_tenant.get(str(p_.get("order_id") or "")) or r["scope_tenant"]
        if owner == slug:
            rows.append(r)
        if len(rows) >= 100:
            break
    items: list[dict] = []
    for r in rows:
        # `created_at` comes back from asyncpg as a datetime and this route builds its own dict
        # (runtime.review_list isoformats its own). Left raw it made JSONResponse raise — so the
        # route 500'd the moment it had a row to show, which nobody saw because the tenant filter
        # kept it empty. Found by vital_multitenant, 2026-07-27.
        _created = r["created_at"]
        it = _review.annotate({"id": r["id"], "scope": r["scope"], "kind": r["kind"],
                               "reason": r["reason"], "payload": r["payload"], "money": r["money"],
                               "created_at": _created.isoformat() if hasattr(_created, "isoformat")
                               else _created, "party": r["party"]})
        p = it.get("payload") or {}
        p = p if isinstance(p, dict) else {}
        # TEST DATA MUST BE VISIBLE AS SUCH. The seeded world lives in the live schema, so this sheet
        # can mix the demo's reasons with a real first customer's order — and «is this real?» has to be
        # answerable at a glance rather than by recognising a name. An UNMARKED row reads as REAL,
        # which is the safe direction to fail in.
        it["seeded"] = bool(p.get("seed_world") == _seed.SEED_WORLD)
        it["order_id"] = p.get("order_id") or ""
        items.append({k: it.get(k) for k in
                      ("id", "why", "why_kind", "review_source", "review_act", "act_call",
                       "money", "created_at", "scope", "party", "seeded", "order_id")})
    # ── §5.11.5 · THE OTHER HALF OF THE SHEET: EL REPARTO ────────────────────────────────────────
    # A driver answered a note at somebody's door, and the counter-aviso carrying HIS OWN WORDS is
    # addressed to the boss. That is a matter waiting for a human decision by every definition this
    # screen uses, and until this line it waited in a table with no reader: `avisos.list_for_jefe`
    # had no caller outside its own vital, so the loop that is the whole feature — driver answers →
    # boss is briefed → boss writes back → it lands at that customer's next stop — terminated at the
    # first rung with nobody to receive it.
    #
    # IT IS NOT A PARKED ACTION AND DOES NOT PRETEND TO BE ONE. Nothing here went through
    # `review.hold_for_review`, so it claims none of the three `review.SOURCES` (low_stock · flag ·
    # timeout): `review_source` is «aviso», and `why_kind` is its own category line, because the
    # surface GROUPS by that field and this belongs in its own group. Borrowing `flag` would have
    # been the tidier wire and a small lie about where the row came from.
    #
    # `why` IS THE DRIVER'S OWN SENTENCE, verbatim, exactly as tier 1 of `review.annotate` intends —
    # nothing composed, nothing summarised. `money` stays False rather than being guessed at from the
    # words, `seeded` stays False because an aviso carries no seed mark and UNMARKED READS AS REAL
    # (the safe direction), and `order_id` is "" because A NOTA BELONGS TO THE CUSTOMER, NOT TO AN
    # ORDER — the app already opens the general brief on a blank one, and the row it should really
    # open is the questionnaire behind `aviso_id`.
    #
    # `id` CARRIES THE AVISO'S ID AND `aviso_id` CARRIES IT AGAIN, on purpose: `action` and `avisos`
    # are two different sequences, so a client keying rows on `id` alone can collide. Branch on
    # `aviso_id` — its presence is what makes this row an aviso.
    #
    # Fail-soft, like the module underneath it: an unreadable `avisos` table costs the delivery half
    # of the sheet and never the review half. The boss still sees what was already there.
    try:
        import avisos as _avisos
        import sup_api as _sup_api  # the desk's own bound, so «tu cola» is ONE set
        async with supa.get_pool().acquire() as acon:
            _queue = await _avisos.list_for_jefe(acon, slug, limit=_sup_api.JEFE_QUEUE_MAX)
    except Exception:
        log.debug("app review: the reparto half of the sheet is unreadable (fail-soft)",
                  exc_info=True)
        _queue = []
    for a in _queue:
        _digits = "".join(c for c in (a.get("phone_number") or "") if c.isdigit())
        _at = a.get("created_at")
        items.append({
            "id": a["id"], "aviso_id": a["id"],
            "why": a["body"],
            "why_kind": "lo que te ha contestado tu repartidor en la puerta del cliente",
            "review_source": "aviso",
            # STATED, NOT DERIVED — this row bypasses `review.annotate` entirely (it is not an
            # `action`), so the second axis has to be written here or the sheet gets a row with no
            # act at all. A driver's counter-aviso is words waiting for words: the boss writes back
            # and it lands at that customer's next stop.
            "review_act": _review.ANSWER, "act_call": _review.ACT_CALL[_review.ANSWER],
            "money": False,
            "created_at": _at.isoformat() if hasattr(_at, "isoformat") else _at,
            "scope": tenancy.scope_of(_digits) if _digits else "",   # WP-A1
            "party": a.get("customer") or "", "seeded": False, "order_id": "",
        })
    # ONE QUEUE, IN THE ORDER THINGS ARRIVED — the parks are already oldest-first and the avisos are
    # too, so this is a stable merge of two sorted lists and not a re-ordering of either. A boss
    # reading his morning does not care which table a matter came out of; he cares which has been
    # waiting longest.
    items.sort(key=lambda x: str(x.get("created_at") or ""))
    return items


@router.post("/api/review/approve")
async def api_review_approve(payload: dict, ctx: dict = Depends(require_cr_cap("act"))) -> JSONResponse:
    """WP-1 review verb: approve a parked action → flip it, arm an `approval` wake so the mind resumes."""
    import runtime
    aid = payload.get("action_id")
    if not aid:
        raise HTTPException(400, "action_id required")
    return JSONResponse(await runtime.resolve_action(int(aid), "approved", (payload.get("note") or "").strip()))


@router.post("/api/review/reject")
async def api_review_reject(payload: dict, ctx: dict = Depends(require_cr_cap("act"))) -> JSONResponse:
    """WP-1 review verb: reject a parked action → flip it, arm an `approval` wake (the mind re-reasons)."""
    import runtime
    aid = payload.get("action_id")
    if not aid:
        raise HTTPException(400, "action_id required")
    return JSONResponse(await runtime.resolve_action(int(aid), "rejected", (payload.get("note") or "").strip()))


@router.post("/api/takeover")
async def api_takeover(payload: dict, ctx: dict = Depends(require_cr_cap("act"))) -> JSONResponse:
    """WP-1 takeover verb: a human takes over a thread (Rocoto goes to SOMBRA for it) or hands it
    back (the override is cleared → the scope falls back to the app-wide default, and a
    `takeover_end` wake makes the mind re-reason).

    B6 (SPEC §5.5): takeover is a WRITER of the one mode field, not a flag of its own —
    `takeover_active` is now simply "this scope's own override is sombra"."""
    import gate
    import runtime
    scope = (payload.get("scope") or "").strip()
    if not scope:
        raise HTTPException(400, "scope required")
    active = bool(payload.get("active", True))
    await runtime.set_takeover(scope, active)
    v = await gate.effective_mode(scope)
    return JSONResponse({"ok": True, "scope": scope, "takeover_active": v["own"] == gate.SOMBRA, **v})


# ──────────────────────── MODO SOMBRA — the one mouth switch (SPEC §5.5) ────────────────────────
def _mode_scope(payload: dict, ctx: dict | None = None) -> str:
    """`scope` verbatim, or `phone` resolved to its party scope. The two surfaces (CR speaks scopes,
    the app speaks phone numbers) reach the same field.

    SECURITY (2026-07-27): a runtime scope is `t.<tenant>.c.<id>` — i.e. a CLIENT-SUPPLIED scope names
    a tenant. When a per-user ctx is present we verify the named tenant IS the caller's own and refuse
    LOUDLY otherwise; a caller can never reach into another tenant's mouth switch by spelling out its
    scope. `tenancy.tenant_of` is the same parser the kernel uses, so there is one reading of a scope."""
    import runtime
    import tenancy
    scope = (payload.get("scope") or "").strip()
    if scope:
        if ctx is not None and tenancy.tenant_of(scope) != (ctx.get("tenant_slug") or ""):
            raise HTTPException(403, "tenant_scope_unavailable")
        return scope
    phone = _norm(payload.get("phone", "") or "")
    if not phone:
        raise HTTPException(400, "scope or phone required")
    return runtime.scope_of(phone)


# The mouth switch is an OPERATOR surface (the app's «Rocoto responde» toggle + the CR). It was
# key-gated and took a client-supplied `scope`, which named a tenant — the leaked-key hole wearing the
# scope's hat. It now needs a per-user bearer and the scope is checked against the caller's tenant.
@router.get("/api/mode")
async def api_mode_read(scope: str = "", phone: str = "",
                        ctx: dict = Depends(require_app_runtime_cap('read'))) -> JSONResponse:
    """THE read the app and the CR need: {mode, source, own, app, app_scope} for one party — or, with
    neither argument, the app-wide default alone. `source` says WHO decided ('customer' | 'app' |
    'default'), so a surface can show "en sombra por ajuste general" vs "…por este cliente"."""
    import gate
    if not scope and not phone:
        aps = gate.app_scope("")
        return JSONResponse({"scope": aps, "app_wide": True, **(await gate.effective_mode(aps))})
    sc = _mode_scope({"scope": scope, "phone": phone}, ctx)
    return JSONResponse({"scope": sc, "app_wide": False, **(await gate.effective_mode(sc))})


@router.post("/api/mode")
async def api_mode_set(payload: dict, ctx: dict = Depends(require_app_runtime_cap('act'))) -> JSONResponse:
    """Set ONE party's override: {scope|phone, mode: 'auto'|'sombra'|null}. `null`/'' CLEARS it, so
    the party goes back to inheriting the app-wide default — which is a different state from pinning
    it to 'auto', and the only way to un-pin a customer."""
    import gate
    sc = _mode_scope(payload, ctx)
    try:
        mode = gate.normalize_mode(payload.get("mode"))
    except ValueError as e:
        raise HTTPException(400, str(e))
    return JSONResponse({"ok": True, "scope": sc, "app_wide": False, **(await gate.set_mode(sc, mode))})


@router.post("/api/mode/app")
async def api_mode_set_app(payload: dict,
                           ctx: dict = Depends(require_app_runtime_cap('admin'))) -> JSONResponse:
    """The app-wide switch ("Rocoto responde"): {mode: 'auto'|'sombra'}. Per-customer overrides still
    win over it — clearing a customer's override is how you hand it back to this switch."""
    import gate
    try:
        mode = gate.normalize_mode(payload.get("mode"))
    except ValueError as e:
        raise HTTPException(400, str(e))
    like = (payload.get("scope") or "").strip()
    if like:
        _mode_scope({"scope": like}, ctx)          # same tenant check as the per-party switch
    v = await gate.set_app_mode(mode, like_scope=like)
    return JSONResponse({"ok": True, "app_wide": True, "scope": v["app_scope"], **v})


# ──────────────────── TRACKERS / VIGILANCIAS — the registry API (BLOCK C, SPEC §5.6) ────────────────
# ONE registry, both windows: the app's Trackers screen and the CR's Vigilancias pane read the SAME
# function. Every verb is an API verb first and the button calls it (§15 CLI-parity law).
@router.get("/api/trackers")
async def api_trackers_list(scope: str = "", phone: str = "",
                            ctx: dict = Depends(require_app_runtime_cap('read'))) -> JSONResponse:
    """The registry: {mine, rocoto, hidden, session}. `mine` = the boss's own watches (visible from
    birth); `rocoto` = only the ones Rocoto started that have reached something DECIDABLE, each with
    its suggestion + action verbs; `hidden` = how many of his are still just running."""
    import trackers
    return JSONResponse(await trackers.registry(_mode_scope({"scope": scope, "phone": phone}, ctx)))


@router.get("/api/trackers/draft")
async def api_trackers_draft(scope: str = "", phone: str = "",
                             ctx: dict = Depends(require_app_runtime_cap('read'))) -> JSONResponse:
    """The DRAFT-STATE read for the co-presence widget card (§5.6): the open creation session's goal,
    current draft, playback and what it still needs — or null when no session is open."""
    import trackers
    return JSONResponse({"session": await trackers.session(_mode_scope({"scope": scope, "phone": phone}, ctx))})


@router.post("/api/trackers/session")
async def api_trackers_session(payload: dict, ctx: dict = Depends(require_app_runtime_cap('act'))) -> JSONResponse:
    """«+ Nuevo» and «Editar» — both open a creation TAB. Editing passes `edit` (the tracker name) and
    `parent_loop_id` (the session being reopened), which is exactly the ticket reopen chain."""
    import trackers
    sc = _mode_scope(payload, ctx)
    parent = payload.get("parent_loop_id")
    return JSONResponse(await trackers.open_session(
        sc, (payload.get("goal") or "").strip(), draft=payload.get("draft") or {},
        duty_name=(payload.get("edit") or "").strip(),
        parent_loop_id=int(parent) if parent else None))


@router.post("/api/trackers")
async def api_trackers_create(payload: dict, ctx: dict = Depends(require_app_runtime_cap('act'))) -> JSONResponse:
    """Create a tracker from a draft (the surface path; the conversational path is the mind's
    create_tracker tool, and both land on the same row + close the same session)."""
    import trackers
    sc = _mode_scope(payload, ctx)
    r = await trackers.create(sc, payload.get("draft") or payload,
                              source=(payload.get("source") or "user"))
    return JSONResponse(r, status_code=200 if r.get("ok") else 400)


@router.post("/api/trackers/enable")
async def api_trackers_enable(payload: dict, ctx: dict = Depends(require_app_runtime_cap('act'))) -> JSONResponse:
    """Pause / enable one tracker: {scope|phone, name, enabled}. Pausing disarms its clock through the
    ordinary binder (the disarm event resolves its tab); enabling re-arms a cadence watch."""
    import trackers
    sc = _mode_scope(payload, ctx)
    name = (payload.get("name") or "").strip()
    if not name:
        raise HTTPException(400, "name required")
    r = await trackers.set_enabled(sc, name, bool(payload.get("enabled", True)))
    return JSONResponse(r, status_code=200 if r.get("ok") else 404)


# ── §5.8a ON THE APP RAIL — the delivery radius · the stock levels · the delivery LIST ────────────
# The Android app authenticates with the MACHINE KEY against `/api/*`; the supplier web app
# authenticates with a `sup_session` cookie against `/api/sup/*`. Two doors, and these routes are the
# app's. They are deliberately THIN: every rule they serve lives in `brain/range.py` and
# `brain/stock.py`, which `sup_api.py` calls too — one rule, two doors, so a radius or a shortfall can
# never mean one thing on the phone and another on the desk.
#
# TENANT (rewritten 2026-07-27): `ctx["tenant_slug"]`, resolved SERVER-SIDE from the caller's Supabase
# bearer (brain_auth.app_scope) — exactly as `/api/sup/*` resolves it from the cookie session. The
# phone still never sends a tenant id; the difference is that it no longer needs to be TRUSTED not to,
# because the shared machine key is no longer accepted here. These tables (`tenant_range`,
# `stock_levels`, `stock_captures`) all carry tenant_id, so scoping them is a real fence, not a fence
# that only holds while there is one tenant.
@router.get("/api/tenant/range")
async def api_tenant_range(ctx: dict = Depends(require_app_cap('read'))) -> JSONResponse:
    """The tenant's delivery rule → {set, range_kind, range_km, depot_lat, depot_lon, depot_label,
    zones}. `set=false` means nobody has ever answered the question — which is NOT a radius of zero,
    and the Settings screen must say so. Never 404s: "not configured" is a state, not an error."""
    from brain import range as brain_range
    async with supa.get_pool().acquire() as con:
        return JSONResponse(await brain_range.get_range(con, ctx["tenant_slug"]))


@router.put("/api/tenant/range")
async def api_tenant_range_set(payload: dict, ctx: dict = Depends(require_app_cap('admin'))) -> JSONResponse:
    """Save the radius + depot: {range_km, depot_lat, depot_lon, depot_label} → the row, read back.

    PUT because the row is an idempotent replace, not an append. A bad radius comes back 400 with the
    es-ES sentence `brain/range.set_range` raised — safe to show the boss verbatim, and RAISING is the
    point: a silently-swallowed radius would hold real orders for a reason nobody could explain."""
    from brain import range as brain_range
    p = payload or {}
    async with supa.get_pool().acquire() as con:
        try:
            out = await brain_range.set_range(
                con, ctx["tenant_slug"], range_km=p.get("range_km"),
                depot_lat=p.get("depot_lat"), depot_lon=p.get("depot_lon"),
                depot_label=p.get("depot_label") or "")
        except ValueError as e:
            return JSONResponse({"error": "bad_range", "detail": str(e)}, status_code=400)
    return JSONResponse(out)


@router.get("/api/stock/levels")
async def api_stock_levels(ctx: dict = Depends(require_app_cap('read'))) -> JSONResponse:
    """«Inventario» → {inventory_enabled, levels:[{sku_id,name,qty,unit,low_at,low,source,
    captured_at,note}], low:[…]}. A SKU with no row here has NEVER been counted and therefore can
    never make an order short — absence is the honest state, not zero (§5.8a)."""
    from brain import stock as brain_stock
    tenant = ctx["tenant_slug"]
    async with supa.get_pool().acquire() as con:
        on = await brain_stock.inventory_on(con, tenant)
        levels = await brain_stock.get_levels(con, tenant)
        low = await brain_stock.low_levels(con, tenant)
    import sup_api
    return JSONResponse({
        "inventory_enabled": bool(on),
        "levels": sorted((sup_api._stock_wire(v) for v in levels.values()),
                         key=lambda d: (d["name"] or d["sku_id"]).lower()),
        "low": [sup_api._stock_wire(v) for v in low]})


@router.post("/api/stock/capture")
async def api_stock_capture(request: Request, ctx: dict = Depends(require_app_cap('act'))) -> JSONResponse:
    """A capture → {capture_id, read:[…], unmatched:[…], note, read_source, applied:false}.
    THIS MOVES NO LEVEL, on purpose: it records WHAT ROCOTO READ so the boss can correct it by
    talking, and only `/apply` writes the levels.

    **ROCOTO NOW ACTUALLY READS IT (2026-07-27).** Until today this route took `read` as an INPUT and
    the server never looked at the photograph or listened to the note — the screen's «lo que Rocoto ha
    leído» sat above a list the client had supplied. `brain/stock.read_capture` is the reading, and it
    lives in `brain/stock.py` because `/api/sup/stock/capture` calls the same function: two doors, one
    reading, and neither door may mean something different from the other.

    THREE LISTS COME BACK (2026-07-27, second pass): `read` (MATCHED — countable), `ambiguous` (the
    catalogue holds it, we cannot say which row — the operator picks, and these are deliberately NOT
    in `read`, so /apply cannot write a level from one) and `unmatched` (not there at all — each line
    carries `can_create` and the `suggested_code` we would mint). `POST /api/stock/match` re-grounds a
    name he corrects; `POST /api/stock/sku` creates the row when he answers the code question.

    THE CONTRACT, and the one thing to be careful about:
      · `read` ABSENT or EMPTY  → Rocoto reads the photo and the note itself (`read_source:"rocoto"`).
      · `read` NON-EMPTY        → honoured VERBATIM, no model call (`read_source:"client"`). That is
        the CORRECTION path: the app posts the corrected list back, and a server that re-read it would
        be arguing with the man holding the pallet.
    The shipped Android client always sends `read` and always sends it EMPTY (`ApiClient.stockCapture`
    defaults it to `emptyList()`), which is why empty is treated as absent — anything else would have
    left the phone with the same silence it had yesterday.

    TWO BODY SHAPES, because the phone holds BYTES and the desk holds a URL (the Compose client named
    this assumption and it is the right one): JSON `{image_url, transcript, read}`, or MULTIPART
    `file` + `transcript` + `read` — the same multipart shape `/api/send-media` already accepts. The
    uploaded file is stored under MEDIA_DIR and its served URL becomes `image_url`, so a capture taken
    at six in the morning next to a lorry keeps its photograph. A capture with no image at all is
    legitimate: the operator can simply say what came off the lorry."""
    from brain import stock as brain_stock
    ctype = (request.headers.get("content-type") or "").lower()
    image_url, transcript, read = "", "", []
    image_bytes, mime = b"", ""
    if ctype.startswith("multipart/"):
        form = await request.form()
        transcript = str(form.get("transcript") or "")
        try:
            read = json.loads(str(form.get("read") or "[]"))
        except Exception:
            read = []
        up = form.get("file")
        if up is not None and hasattr(up, "filename"):
            ext = Path(str(up.filename or "")).suffix.lower()[:8] or ".jpg"
            fname = f"stock-{uuid.uuid4().hex}{ext}"
            image_bytes = await up.read()
            (MEDIA_DIR / fname).write_bytes(image_bytes)
            mime = str(getattr(up, "content_type", "") or "") or "image/jpeg"
            image_url = f"{config.PUBLIC_BASE_URL.rstrip('/')}/media/{fname}"
    else:
        p = await request.json() if (await request.body()) else {}
        p = p if isinstance(p, dict) else {}
        image_url = str(p.get("image_url") or "")
        transcript = str(p.get("transcript") or "")
        read = p.get("read") if isinstance(p.get("read"), list) else []
        image_bytes, mime = brain_stock.media_bytes(image_url)
    if not isinstance(read, list):
        read = []
    ambiguous, unmatched, note, source = [], [], "", "client"
    async with supa.get_pool().acquire() as con:
        needs_qty: list = []
        if not brain_stock.client_supplied(read):
            source = "rocoto"
            out = await brain_stock.read_capture(con, ctx["tenant_slug"], image_bytes=image_bytes,
                                                 mime=mime, transcript=transcript)
            read, ambiguous = out["read"], out["ambiguous"]
            unmatched, note = out["unmatched"], out["note"]
            needs_qty = out.get("needs_qty") or []
        cid = await brain_stock.record_capture(con, ctx["tenant_slug"], image_url=image_url,
                                               transcript=transcript, read_json=read)
    # `ambiguous`, `unmatched` and `needs_qty` are NOT recorded in `read_json` on purpose: that column
    # is the reading a level can be written from, and none of these three is one yet. They travel to
    # the screen, the operator resolves them (pick · override · create · answer the quantity), and
    # they come back inside `read` on /apply — as MATCHED lines, which is the only shape a level has
    # ever been written from.
    return JSONResponse({"capture_id": cid, "read": read, "ambiguous": ambiguous,
                         "unmatched": unmatched, "needs_qty": needs_qty, "note": note,
                         "read_source": source, "applied": False, "image_url": image_url})


@router.post("/api/stock/capture/{capture_id}/apply")
async def api_stock_capture_apply(capture_id: int, payload: dict | None = None,
                                  ctx: dict = Depends(require_app_cap('act'))) -> JSONResponse:
    """Apply a capture — the moment the reading becomes state.
    {read:[…] as the boss left it} → {capture_id, written, skipped, corrected, already_applied}.

    `written` is the count the screen must report on (0 = nothing moved, which is not success).
    `corrected` is the product signal: it says the boss had to fix the read, and it is the only
    measure we have of whether the reading is any good — which is why the loop asks before it writes
    (§5.8b: the correction loop IS the feature)."""
    from brain import stock as brain_stock
    read = (payload or {}).get("read")
    async with supa.get_pool().acquire() as con:
        try:
            out = await brain_stock.apply_capture(con, ctx["tenant_slug"], int(capture_id),
                                                  read_json=read if isinstance(read, list) else None)
        except ValueError:
            return JSONResponse({"error": "no_such_capture"}, status_code=404)
    return JSONResponse(out)


@router.post("/api/stock/match")
async def api_stock_match(payload: dict, ctx: dict = Depends(require_app_cap('read'))) -> JSONResponse:
    """THE OVERRIDE. `{q, unit?, qty?}` → the SAME three-way the reading produces:
    `{state:"matched"|"ambiguous"|"unmatched", sku_id, name, confidence, candidates, alternatives,
      unit_note, n_close, heard, can_create, suggested_code, why}`.

    «Corregir hablando» is the feature, and a correction that can only choose between the two rows we
    already offered is not a correction. This grounds whatever he says through `brain/matcher` — the
    same machinery, the same bands — so the operator can always overrule the match. A stock count is
    silent (nobody reads it back to anyone), which is exactly why a wrong SKU counted here is worse
    than an uncounted line, and why this route exists.

    'read' cap, not 'act': it writes nothing. When it comes back UNMATCHED it carries the code we
    would mint, which is how a correction becomes a creation without starting the capture again."""
    from brain import stock as brain_stock
    p = payload or {}
    try:
        qty = float(p["qty"]) if p.get("qty") is not None else None
    except (TypeError, ValueError):
        qty = None
    async with supa.get_pool().acquire() as con:
        out = await brain_stock.match_one(con, ctx["tenant_slug"], str(p.get("q") or ""),
                                          unit=str(p.get("unit") or ""), qty=qty)
    return JSONResponse(out)


@router.post("/api/stock/sku")
async def api_stock_sku_create(payload: dict, ctx: dict = Depends(require_app_cap('act'))) -> JSONResponse:
    """UNMATCHED ⇒ CREATE THE CATALOGUE ROW — Peter's «¿tienes código para esto, o te lo genero yo?»,
    answered.

        body {"name": "SALSA BRAVA GARRAFA",       // required — his words, or the read's
              "code": "35T",                        //   … his own code, OR
              "generate_code": true,                //   … we mint ROC-SAL-001
              "family": "salsas", "unit": "barquetas",
              "price": null, "pack_factor": 1, "variable_weight": false,
              "capture_id": 41, "image_url": "…/media/stock-ab12.jpg", "heard": "salsa brava"}
          → 200 {"ok":true, "sku":{…}, "code":"ROC-SAL-001", "code_generated":true,
                 "embedded":true, "aliases":2, "note":""}
          → 409 {"ok":false, "reason":"code_taken"|"name_taken", "detail":"…", "sku":{…}}
          → 400 {"ok":false, "reason":"no_name"|"no_code", "detail":"…"}

    NEITHER A CODE NOR `generate_code` IS A 400, NOT A GUESS. A code is an identity, and inventing one
    without being asked is the same species of lie as inventing a SKU — §5.7a one layer down. The
    refusal's `detail` is the es-ES sentence to show him: «Dime el código que le das tú, o te lo
    genero yo.»

    409 CARRIES THE ROW THAT IS IN THE WAY, because "you already have this" is not an error — it is
    the match he was looking for, and the screen can point the line at it with one tap. It is also the
    last defence against the matcher having simply failed to find something that was there all along.

    'act', NOT 'admin' — and this is a deliberate call worth flagging. `/api/app/catalogue/upload`
    REPLACES the assortment and is rightly admin. This adds ONE row for a product the operator is
    physically holding, it is provenance-stamped with the capture and the photograph, and its price is
    NULL until somebody sets one (a NULL price can never be sold as zero). Gating it at admin would
    mean the person doing the count cannot finish it — the count stops, and the feature dies at the
    first pallet. One-word change if Peter wants it the other way."""
    from brain import catalogue as brain_catalogue
    from brain import skuparse as brain_skuparse
    p = payload or {}
    # ONE normaliser for a row from a file and a row from a pallet (brain/skuparse.sku_from_line).
    row = brain_skuparse.sku_from_line(p.get("line"), name=str(p.get("name") or ""),
                                       code=str(p.get("code") or ""),
                                       family=str(p.get("family") or ""),
                                       unit=str(p.get("unit") or ""), price=p.get("price"))
    prov = {k: p.get(k) for k in ("capture_id", "image_url", "heard", "said", "transcript")
            if p.get(k) not in (None, "")}
    prov["by"] = ctx.get("email") or ctx.get("actor_email") or ctx.get("user_id") or "app"
    async with supa.get_pool().acquire() as con:
        out = await brain_catalogue.create_sku(
            con, ctx["tenant_slug"], name=row["name"], code=row["code"],
            generate_code=bool(p.get("generate_code")), family=row["family"], unit=row["unit"],
            pack_factor=p.get("pack_factor"), variable_weight=p.get("variable_weight"),
            price=row["price"], created_from=prov)
    if out.get("ok"):
        return JSONResponse(out)
    code = 409 if out.get("reason") in ("code_taken", "name_taken") else 400
    return JSONResponse(out, status_code=code)


@router.get("/api/stock/sku/code")
async def api_stock_sku_code(name: str = "", family: str = "",
                             ctx: dict = Depends(require_app_cap('read'))) -> JSONResponse:
    """The code we WOULD mint → `{"suggested_code": "ROC-SAL-001"}`. So «te lo genero yo» can show the
    actual string before he agrees to it — a person should never accept an identifier sight-unseen.
    Reserves nothing; `create_sku` claims the number under a lock at the moment he says yes."""
    from brain import catalogue as brain_catalogue
    async with supa.get_pool().acquire() as con:
        try:
            c = await brain_catalogue.suggest_code(con, ctx["tenant_slug"], name=name, family=family)
        except Exception:
            c = ""
    return JSONResponse({"suggested_code": c})


@router.get("/api/reparto")
async def api_reparto(day: str = "", ctx: dict = Depends(require_app_runtime_cap('read'))) -> JSONResponse:
    """The delivery LIST for one day → {stops:[…], depot:{…}}. **ROUTE OPTIMISATION IS OUT OF SCOPE**
    (§5.8a): this returns a DAY, never a route — no sequence, no ETA, no leg. Ordering stops properly
    is the VROOM organ behind `/api/sup/routes/optimize`, and this must never grow into it.

    A stop is one approved/sent order for `day`, its customer, and where that customer is. The
    delivery point comes from `customer_profiles.address/lat/lon` first (§5.8a made them first-class)
    and the legacy `stats.location` blob second, through `brain/range._profile_geo` — so exactly one
    module knows the two places a delivery point can hide.

    THE DELIVERY WINDOW IS REAL NOW (2026-07-27). It used to ship blank on every stop forever with an
    honest comment saying a fabricated window is a promise nobody made — right instinct, but it left
    a headline element of two surfaces reading «sin franja» for ever. It is no longer fabricated and
    no longer blank: it is STORED (`brain/window.py`) and it travels WITH ITS PROVENANCE —
    `window_source` ∈ said · set · habit · '' — because a window a van driver acts on must be
    traceable to WHO PROMISED IT. Per stop the ORDER's override (today's exception) beats the
    CUSTOMER's standing receiving hours; `window_scope` says which won.

    **ABSENT IS STILL A REAL STATE and must stay one**: a customer nobody ever asked keeps every
    window field "" and both surfaces keep reading «sin franja». Nothing here defaults, infers or
    rounds a window into existence.

    The day is returned SORTED BY THE STATED WINDOW, then by name — which is the ordering the desk
    was already doing nominally, now done once on the server so the phone and the desk agree. **That
    is a SORT, NOT A ROUTE** (§5.8a / WP-5): no sequence number, no ETA, no leg, no travel time, no
    arrival. `vroom.py` behind `/api/sup/routes/optimize` remains the only thing in this product
    allowed to order stops, and this route must never grow into it.

    HONEST BLANKS, not invented ones: an unlocated stop keeps `lat`/`lon` null and STAYS IN THE DAY;
    the screen shows «sin dirección» inline rather than the driver losing a customer."""
    import datetime as _dt

    from brain import range as brain_range
    from brain import window as brain_window
    # THE BACKEND OWNS "TODAY", and today is the DEPOT's day, not UTC's and not the phone's: a driver
    # opening the app at 00:30 in another timezone must still see the round he is about to drive.
    if not (day or "").strip():
        try:
            import zoneinfo
            _tz = zoneinfo.ZoneInfo("Europe/Madrid")
        except Exception:
            _tz = _dt.timezone.utc
        day = _dt.datetime.now(_tz).strftime("%Y-%m-%d")
    day = day.strip()
    tenant = ctx["tenant_slug"]        # session-resolved; the runtime fence already proved it owns these rows
    async with supa.get_pool().acquire() as con:
        rng = await brain_range.get_range(con, tenant)
        orders = await con.fetch(
            "select id, phone_number, customer_name, note, "
            "       window_from, window_to, window_source, window_said from orders "
            "where status in ('approved','sent') and delivery_date = $1 and tenant_id = $2 "
            "order by customer_name, created_at", day, tenant)
        phones = sorted({r["phone_number"] for r in orders})
        profs = {}
        if phones:
            profs = {r["phone_number"]: dict(r) for r in await con.fetch(
                "select phone_number, display_name, address, lat, lon, stats, "
                "       delivery_window_from, delivery_window_to, delivery_window_source, "
                "       delivery_window_said "
                "from customer_profiles where tenant_id = $1 and phone_number = any($2::text[])",
                tenant, phones)}
        # §5.11.1 · the weekday exceptions for THIS day only. The phone and the desk must agree about
        # what a customer was promised (§5.8a "two doors, one rule"), so this read mirrors
        # sup_api._day_stops exactly — including narrowing to the one weekday.
        _dow = brain_window.dow_of(day)
        dows = await brain_window.dows_for(con, tenant, phones, _dow)
    stops = []
    for o in orders:
        prof = profs.get(o["phone_number"]) or {}
        here = brain_range._profile_geo(prof) if prof else None
        # The window that actually applies to THIS delivery: today's exception over the weekday
        # exception over their standing hours. `resolve` is pure and is the same rule the vital
        # asserts with no DB in sight.
        win = brain_window.resolve(brain_window._cust(prof), brain_window._order(o),
                                   (dows.get(o["phone_number"]) or {}).get(_dow))
        stops.append({
            "id": o["id"], "order_id": o["id"],
            "customer_name": o["customer_name"] or prof.get("display_name") or o["phone_number"],
            "phone_number": o["phone_number"],
            "address": prof.get("address") or "",
            **brain_window.wire(win),
            "lat": here[0] if here else None, "lon": here[1] if here else None,
            "note": o["note"] or "",
            "_k": (brain_window.sort_key(win),
                   (o["customer_name"] or prof.get("display_name") or "").lower()),
        })
    # Sorted by the window the CUSTOMER stated, then by name — a schedule they already agreed to,
    # never a computed driving order. Stops nobody timed sort last (sort_key returns past-midnight)
    # so the list opens with the ones somebody actually committed to.
    stops.sort(key=lambda s: s.pop("_k"))
    return JSONResponse({"day": day, "stops": stops,
                         "depot": {"lat": rng["depot_lat"], "lon": rng["depot_lon"],
                                   "label": rng["depot_label"]}})


# ── the delivery window's CAPTURE doors, app side (machine key). These sit beside /api/reparto on
# purpose: the window is only ever read from there, and a reader who wonders where a franja comes
# from finds both answers in one place. The desk's twins live in sup_api.py behind the session
# cookie — same module underneath, so a franja cannot mean one thing on the phone and another on
# the desk (§5.8a "two doors, one rule").
@router.api_route("/api/customer/{phone}/window", methods=["PUT", "POST"])
async def api_customer_window(phone: str, payload: dict, ctx: dict = Depends(require_app_runtime_cap('act'))) -> JSONResponse:
    """THE COMERCIAL SETS THE CUSTOMER'S RECEIVING HOURS — their standing window, which is where a
    window belongs (it is a fact about them, not about one delivery).
    {window_from?, window_to?, said?} → the stored window + its label. EVERYTHING EMPTY CLEARS IT,
    and clearing is a real operation: the surfaces go back to «sin franja» rather than to a default.
    A window that is not a window (13:00→09:00, «25:00») is REFUSED in es-ES — fail-soft on the read
    path, never on the write."""
    from brain import window as brain_window
    p = _norm(phone)
    try:
        async with supa.get_pool().acquire() as con:
            w = await brain_window.set_customer(
                con, ctx["tenant_slug"], p,
                window_from=payload.get("window_from"), window_to=payload.get("window_to"),
                said=str(payload.get("said") or ""), source=brain_window.SET)
    except LookupError:
        return JSONResponse({"error": "no_such_customer"}, status_code=404)
    except ValueError as e:
        return JSONResponse({"error": "bad_window", "detail": str(e)}, status_code=400)
    await brain_window.mirror_fact(tenancy.scope_of(p), w)   # WP-A1
    return JSONResponse({"phone_number": p, **brain_window.wire(w),
                         "label": brain_window.label(w)})


@router.api_route("/api/order/{order_id}/window", methods=["PUT", "POST"])
async def api_order_window(order_id: str, payload: dict, ctx: dict = Depends(require_app_runtime_cap('act'))) -> JSONResponse:
    """TODAY'S EXCEPTION — the per-order override, which beats the customer's default for this
    delivery only. Clearing it restores the default (which may itself be absent); it never writes
    the default down onto the order, because then a later change to their hours would silently not
    reach an order that had merely inherited them."""
    from brain import window as brain_window
    try:
        async with supa.get_pool().acquire() as con:
            w = await brain_window.set_order(
                con, order_id,
                window_from=payload.get("window_from"), window_to=payload.get("window_to"),
                said=str(payload.get("said") or ""), source=brain_window.SET)
    except LookupError:
        return JSONResponse({"error": "no_such_order"}, status_code=404)
    except ValueError as e:
        return JSONResponse({"error": "bad_window", "detail": str(e)}, status_code=400)
    return JSONResponse({"order_id": order_id, **brain_window.wire(w),
                         "label": brain_window.label(w)})


def _voice_call_context(cr_payload) -> str:
    """Render the call's ORIGIN into a line the voice mind answers with awareness of (SPEC §16.5)."""
    if not cr_payload:
        return ""
    p = cr_payload
    if isinstance(p, str):
        try:
            p = json.loads(p)
        except Exception:
            return ""
    has_screen = bool(p.get("has_screen"))
    who = p.get("who", "")
    parts = []
    if has_screen:
        parts.append("La persona pidió esta llamada DESDE LA WEB (soyrocoto.com) y está viendo la "
                     "transcripción EN DIRECTO en su pantalla — puedes referirte a la pantalla.")
    else:
        parts.append("TÚ estás llamando a esta persona porque te lo pidió por WhatsApp. NO hay ninguna "
                     "pantalla ni transcripción que mire — es una llamada normal de teléfono. NUNCA digas "
                     "«mira tu pantalla» ni des por hecho que ve nada.")
    if who == "creator":
        parts.append("Hablas con Peter, tu creador y jefe: háblale con naturalidad, sin venderle nada.")
    return " ".join(parts)


# ── SPEC §7 session pins: per-caller call context assembled ONCE (per-utterance reassembly forbidden —
# the ~1s voice budget). TTL'd in-proc; refreshed in the background after each turn so mid-call events
# still land as deltas by the NEXT utterance (the id-watermark semantics, cheap form).
# ⚠ SINGLE-WORKER INVARIANT (review H2): pins + call_state are process-local. A multi-worker uvicorn
# breaks turn continuity silently — guarded at import below; a shared store (by call_id) is the
# documented prerequisite for any horizontal scale.
_VOICE_PINS: dict[str, dict] = {}
_VOICE_PIN_TTL = 900.0          # a pin survives a whole call; a new call >15min later re-pins
_VOICE_TURN_BUDGET = float(config._env("ROCOTO_VOICE_TURN_BUDGET", "6.0") or "6.0")
# per-scope turn serialization (review M4): barge-in / EL retries can overlap two turns on one scope —
# unlocked, the check-then-set guards (pitch-once, last_reply) race. Bounded dict, lock per scope.
_VOICE_LOCKS: dict[str, asyncio.Lock] = {}
if (os.environ.get("WEB_CONCURRENCY") or "1") not in ("", "1"):
    log.critical("voice runtime requires a SINGLE worker (WEB_CONCURRENCY=%s) — pins/call_state are "
                 "process-local; refusing would break boot, but calls WILL misbehave. Fix the unit file.",
                 os.environ.get("WEB_CONCURRENCY"))


def _voice_pin_call_reset(scope: str) -> None:
    """§15 cross-call boundary (review H1): call.ended re-arms the per-call guards for the next call."""
    p = _VOICE_PINS.get(scope)
    if p:
        p["call_state"] = {}
        p["call_id"] = None


try:
    import presence_call as _presence_mod
    _presence_mod.register_reset_hook(_voice_pin_call_reset)
except Exception:
    log.debug("presence reset-hook registration fail-soft", exc_info=True)


async def _build_voice_pin(caller: str, scope: str, lang: str) -> dict:
    """The ring-time assembly (SPEC §7): fold + persona + call-origin, built ONCE per call. ~1-2s worst
    case (embed warm); every utterance after rides it for free.

    B3 CONTRACT (2026-07-26): this RAISES when the fold/persona or the role-block opener cannot be built.
    It used to swallow both and hand back an empty pin with a scripted hello — which is how a dead mind
    took live calls sounding merely mediocre. Callers must fail the call and alert; there is no second
    mind to fall to. (Sub-blocks that are genuinely optional — AHORA MISMO, the fabric fold-in — keep
    their own narrow fail-soft: a missing optional block is not an unbuildable pin.)"""
    import agent_reply
    import assemble as _assemble
    import presence_call as _presence
    import runtime as _rt
    import soul as _soul
    import voice_protocol as _vp
    card, tabs, call_context, persona = "", [], "", ""
    lifecycle_st, lc_notes, ahora, call_id, dir_block = None, "", "", None, ""
    # the §4.1.1 component blocks (B1) — built ONCE here, from the SAME assemble builders the chat
    # fold uses, so the two mouths carry the identical checklist.
    standing, supplier_card, order_state, frame_block, lifecycle_block, checkboxes = "", "", "", "", "", {}
    tier, person, opener = "prospect", {}, ""   # Track 1: tier captured once, drives persona + opener
    # ── B2 · OBSERVE THE LIFECYCLE **BEFORE** THE PIN IS BUILT ───────────────────────────────────
    # Ring time is the voice mouth's assembly moment: `pinned_tabs` below reads the tabs ONCE for the
    # whole call, so a transition must resolve the old pursuit and open the new one FIRST or the call
    # runs on the previous stage's pursuit start to finish. The person lookup is hoisted here (it was
    # done a few lines below anyway) so this costs one small read, not a duplicate lookup.
    try:
        person = await agent_reply._lookup_person(caller)
    except Exception:
        person = {}
    try:
        import lifecycle as _lc_obs
        async with supa.scoped_tx(scope) as _c0:
            _rt_tier0 = await _c0.fetchval(
                "select tier from scope_node where scope=$1::ltree", scope) or ""
        await _lc_obs.observe(scope, _rt._tier_for(caller, person, _rt_tier0))
    except Exception:
        log.debug("voice pin: lifecycle observe fail-soft", exc_info=True)
    try:
        async with supa.scoped_tx(scope) as con:
            a = await _assemble.assemble(con, scope, "")
            card = a.get("card", "")
            # STRUCTURED tabs (dicts: id/kind/text/entity_key) — assemble returns RENDERED strings, but the
            # voice fold (_grounding_block, _pinned_keys money-reads) reads fields; strings crash → holding line.
            tabs = await _vp.pinned_tabs(con, scope)
            cr = await con.fetchval("select payload from event where scope=$1::ltree "
                                    "and type='call.requested' order by id desc limit 1", scope)
            call_context = _voice_call_context(cr)
            rt_tier = await con.fetchval("select tier from scope_node where scope=$1::ltree", scope) or ""
            # §4.1.1 ⑤ THE SUPPLIER CARD (both cases) + the CATALOGUE sub-block, SPLICED by the §6
            # `skus_uploaded` box: pre-upload there is no catalogue block at all and the LIFECYCLE
            # slot says so in words — known-state, never missing-data (SPEC §6).
            supplier_card, dir_block = await _assemble.supplier_block(con, scope)
            standing = await _assemble.standing_block(con, scope)
            order_state = await _assemble.order_state_block(con, scope)
            # §15 AHORA MISMO (voice side): a WhatsApp text that lands mid-call reaches the fold at the
            # refresh; the block makes the mind KNOW it's the same live conversation.
            ahora = await _presence.ahora_block(con, scope, channel="voice")
            lc = await _presence.live_call(con, scope)
            call_id = (lc or {}).get("call_id")
        # (person was resolved above, before the B2 lifecycle observation)
        # Track 1 (Seam 2): the resolved tier drives BOTH the persona and the turn-1 opener — one tier,
        # one mind (no divergence between who the fold thinks it's talking to and who it greets).
        tier = _rt._tier_for(caller, person, rt_tier)
        # WP-5: the house VOZ (vibe/house_style) rides the pin — fetched once at ring-time via the
        # turn-assembly cache (runtime.house_style), so a call speaks with the same style as chat.
        # BLOCK C (SPEC §5.6): the creation-session splice rides it too — a routine he started building
        # in chat is still being built if he rings mid-session. A mode that exists on one mouth only is
        # the drift the both-mouths law forbids. Fail-soft: a missing splice is not an unbuildable pin.
        _splice = ""
        if tier in ("boss", "creator", "colleague"):
            try:
                import trackers as _trackers
                _splice = await _trackers.splice_line(scope)
            except Exception:
                log.debug("voice pin: tracker splice fail-soft", exc_info=True)
        persona = _soul.voice_persona(tier, person, lang, style=await _rt.house_style(),
                                      splice=_splice)
        # LIFECYCLE PINNED AT RING-TIME (review H3): computed once here, read per-turn from ctx — kills
        # the two extra DB round-trips lifecycle.status() cost on EVERY utterance's hot path. Keyed to
        # the SAME resolved tier the persona/opener use (2026-07-25: rt_tier alone missed creator/customer
        # promotions _tier_for knows, so the founder could get the cadete JOB BRIEF on a call).
        try:
            import lifecycle as _lifecycle
            lifecycle_st = await _lifecycle.status(scope, tier or "prospect")
            lc_notes = _lifecycle.notes(lifecycle_st)
            checkboxes = lifecycle_st.get("boxes") or {}
            lifecycle_block = (f"fase={lifecycle_st.get('stage')} · relación={lifecycle_st.get('tier')} "
                               "(derivado, comprobado — no supuesto)\n"
                               + _lifecycle.checkbox_block(checkboxes))
        except Exception:
            lifecycle_st, lc_notes = None, ""
        try:
            frame_block = _soul.frame_block(tier, "voz", compact=True)
        except Exception:
            frame_block = ""
    except Exception as e:  # noqa: BLE001
        # B3 (2026-07-26): NO fail-soft here. A pin whose fold/persona could not be built is a mind that
        # does not know who it is talking to; the old `log.debug(...)` let that call proceed sounding
        # merely mediocre. It raises now — the ring-time caller turns it into a failed call + an alert.
        log.error("voice pin build FAILED for %s (%s) — the call must fail, not degrade", scope, e,
                  exc_info=True)
        raise
    # Track 1 (Seam 2): the ROLE-BLOCK opener for turn 1, from the SAME resolved tier. B3: NO neutral
    # fallback line — `soul.voice_opener` covers every tier, so an empty/raising opener means the SOUL
    # itself is broken and the honest outcome is a failed call, not a scripted hello.
    import soul as _soul_o
    opener = (_soul_o.voice_opener(tier, person, lifecycle_st, lang) or "").strip()
    if not opener:
        raise RuntimeError(f"soul.voice_opener returned nothing for tier={tier!r} lang={lang!r}")
    # ── EU AI ACT ART. 50 — THE FIRST THING A CALLER HEARS (2026-08-17) ──────────────────────────
    # In force since 2 August 2026. The caller must be told they are speaking to an AI «at the
    # latest at the time of the first interaction», in an explicit SPOKEN statement — the
    # Commission's guidelines reject audio cues alone, T&C-only disclosure, and «generic references
    # to "assistant"». It goes BEFORE the role-block opener because Art. 50(5) says first, and
    # because a person who has just learned they are talking to a machine hears the next sentence
    # differently. The duty is the PROVIDER's, which is us — it cannot be pushed to a distributor's
    # terms of service.
    try:
        import ai_disclosure as _disc
        _biz = (person or {}).get("business_name") or config.BRAND_NAME
        _posture = await _disc.call_posture(tenancy.tenant_of(scope))
        _notice = _disc.opening(_biz, privacy_url=config.PRIVACY_URL,
                                speaking=_posture["speaking"],
                                recording=_posture["recording"], lang=lang)
        log.info("call posture for %s: %s", scope, _posture["reason"])
        opener = (_notice + " " + opener).strip() if _notice else opener
    except Exception:
        # FAIL-LOUD, unlike almost everything else on this path: a call that cannot state what it
        # is must not happen. Art. 99(4)(g) prices this at up to €15M or 3% of turnover, and the
        # honest outcome of a broken disclosure is a failed call, exactly as with a broken soul.
        log.exception("AI disclosure could not be built for %s — refusing the call", scope)
        raise
    # PRE-CALL ASSEMBLY v2 (IN-CALL-RUNTIME-DESIGN §1.1): the tab-extended RECENCY window + at-start
    # recall join the pinned fold — built once, during ring time.
    window, recall_lines = "", []
    try:
        import voice_fabric as _vf
        async with supa.scoped_tx(scope) as con:
            window = await _vp.pinned_window(con, scope)
            recall_lines = await _vp.recall_at_start(con, scope, tabs)
            # THE FABRIC FOLD-IN (§9.1): completed processes' context enrichment, read from the SPINE
            # (the pin is a read-through cache — the rebuild is the SOLE merger).
            fr = await _vf.fold_results(con, scope)
            for t in fr.get("recall_lines", []):
                if t not in recall_lines:
                    recall_lines.append(t)
            recall_lines = recall_lines[:6]
    except Exception:
        log.debug("pin v2 fold fail-soft", exc_info=True)
    return {"t": time.time(), "card": card, "tabs": tabs,
            "call_context": call_context, "persona": persona,
            "window": window, "recall_lines": recall_lines,
            "recall_inflight": False, "call_state": {},
            "lifecycle": lifecycle_st, "lc_notes": lc_notes,
            "ahora": ahora, "call_id": call_id, "directory": dir_block,
            "tier": tier, "opener": opener,
            # the §4.1.1 components (B1) — one checklist, both mouths
            "frame": frame_block, "lifecycle_block": lifecycle_block, "checkboxes": checkboxes,
            "standing": standing, "supplier_card": supplier_card, "order_state": order_state}


def _sse_completion(reply: str) -> StreamingResponse:
    """OpenAI-compatible STREAMING response (EL custom-LLM sends stream:true and expects SSE — a plain
    JSON body to a stream request is dead air, the exact silent-call bug)."""
    def gen():
        chunk = {"id": "rocoto-voice", "object": "chat.completion.chunk",
                 "choices": [{"index": 0, "delta": {"role": "assistant", "content": reply},
                              "finish_reason": None}]}
        done = {"id": "rocoto-voice", "object": "chat.completion.chunk",
                "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}]}
        yield f"data: {json.dumps(chunk)}\n\n"
        yield f"data: {json.dumps(done)}\n\n"
        yield "data: [DONE]\n\n"
    return StreamingResponse(gen(), media_type="text/event-stream")


@router.post("/api/voice/chat")
@router.post("/api/voice/chat/completions")
async def api_voice_chat(payload: dict):
    """OpenAI-compatible Custom-LLM endpoint for the ElevenLabs voice agent (SPEC §2/§7): EL is
    ears+mouth, OUR runtime is the brain. EL calls {server_url}/chat/completions (hence the alias).

    THE §7 LATENCY CONTRACT (2026-07-21 — closes the silent-call bug):
      · context is PINNED once per call (_VOICE_PINS), never re-assembled per utterance;
      · ingest/telemetry are BACKGROUND tasks — the reply path never blocks on the DB;
      · the turn runs under a HARD BUDGET; on overrun a holding line ships (never dead air);
      · stream:true → SSE chunks (EL expects SSE; plain JSON to a stream request = silence);
      · every turn appends ops.voice_turn telemetry (stage timings) for live debugging."""
    import re as _re

    import runtime
    import voice_protocol
    t0 = time.time()
    msgs = payload.get("messages") or []
    utterance = ""
    for m in reversed(msgs):
        if m.get("role") == "user":
            utterance = m.get("content") or ""
            break
    caller = (payload.get("caller") or payload.get("user_id") or "").strip()
    # The caller rides the agent prompt as a marker EL substitutes from the bridge's caller_number
    # dynamic variable — parse it so a live call resolves the RIGHT party scope.
    if not caller:
        for _m in msgs:
            if _m.get("role") == "system":
                _mm = _re.search(r"\[\[CALLER:([^\]]+)\]\]", _m.get("content") or "")
                if _mm and _mm.group(1).strip() and _mm.group(1).strip() != "unknown":
                    caller = _mm.group(1).strip()
                    break
    # The call reference rides the same marker line as the caller. It is what lets an ANONYMOUS
    # call's turns resolve the per-call scope ring time already built, instead of every unidentified
    # caller sharing one conversation (see presence_call.scope_for).
    call_ref = (payload.get("call_ref") or "").strip()
    if not call_ref:
        for _m in msgs:
            if _m.get("role") == "system":
                _cm = _re.search(r"\[\[CALL:([^\]]+)\]\]", _m.get("content") or "")
                if _cm and _cm.group(1).strip() and _cm.group(1).strip() != "unknown":
                    call_ref = _cm.group(1).strip()
                    break
    import presence_call as _presence_scope
    scope = _presence_scope.scope_for(caller, call_ref)
    # «Do we know WHO is on the line?» — the gate that used to be spelled `digits`, unchanged in
    # meaning. It stays separate from `scope`: an anonymous call now HAS a real, unshared scope, but
    # it still has no phone number, so anything keyed on one (emit_sense, the sense fabric) must not
    # fire for it.
    identified = tenancy.has_identity(caller)
    lang = payload.get("lang", "es")
    stream = bool(payload.get("stream"))

    # SESSION PIN (SPEC §7) — assembled once; later utterances ride it.
    pin = _VOICE_PINS.get(scope)
    pinned = bool(pin and (time.time() - pin.get("t", 0)) < _VOICE_PIN_TTL)
    if not pinned:
        # B3: mid-call the pin may have aged out. If it cannot be rebuilt the mind has no grounding —
        # answer with an explicit error (EL drops the leg) + an alert, never an ungrounded improvisation.
        try:
            pin = await _build_voice_pin(caller, scope, lang)
        except Exception as e:  # noqa: BLE001
            log.error("VOICE MIND UNAVAILABLE — mid-call pin rebuild failed for %s: %s", scope, e,
                      exc_info=True)
            _voice_mind_alert(f"mid-call pin rebuild failed for {scope}: {e}", scope)
            raise HTTPException(503, "voice mind unavailable") from e
        _VOICE_PINS[scope] = pin
        if len(_VOICE_PINS) > 300:   # bounded memory
            for k in sorted(_VOICE_PINS, key=lambda k: _VOICE_PINS[k].get("t", 0))[:100]:
                _VOICE_PINS.pop(k, None)
    # tabs must be STRUCTURED dicts (review L1): a request-body `tabs` of rendered strings would crash
    # _grounding_block/_pinned_keys into the holding line — filter to dicts whatever the source.
    _tabs_raw = payload.get("tabs") or pin.get("tabs", []) or []
    ctx = {"card": payload.get("card", "") or pin.get("card", ""),
           "tabs": [t for t in _tabs_raw if isinstance(t, dict)],
           "lang": lang, "call_context": pin.get("call_context", ""),
           "persona": pin.get("persona", ""),
           "window": pin.get("window", ""), "recall": pin.get("recall_lines") or [],
           "recall_inflight": bool(pin.get("recall_inflight")),
           "call_state": pin.setdefault("call_state", {}),
           "lifecycle": pin.get("lifecycle"), "lc_notes": pin.get("lc_notes", ""),
           "frame": pin.get("frame", ""), "lifecycle_block": pin.get("lifecycle_block", ""),
           "standing": pin.get("standing", ""), "supplier_card": pin.get("supplier_card", ""),
           "order_state": pin.get("order_state", ""),
           "ahora": pin.get("ahora", ""), "call_id": pin.get("call_id"),
           "directory": pin.get("directory", "")}

    # DECISION-TRACE TELEMETRY (review H4): initialized BEFORE the try so a timed-out/broken turn still
    # writes a self-contained record — no more undebuggable calls.
    _cs = pin["call_state"]
    _cs["turn_seq"] = int(_cs.get("turn_seq") or 0) + 1
    tele: dict = {"call_id": pin.get("call_id"), "turn_seq": _cs["turn_seq"],
                  "stage": (pin.get("lifecycle") or {}).get("stage"),
                  "has_catalogue": (pin.get("lifecycle") or {}).get("has_catalogue"),
                  "call_state_present": bool(_cs.get("last_reply") or _cs.get("nc_pitch_done")),
                  "pin_age_ms": int((time.time() - pin.get("t", time.time())) * 1000)}

    # THE TURN — hard budget; a slow turn ships a holding line, never dead air. in_call_turn itself
    # appends the utterance event (the §7 eventization) + does the keyed reads + the gate.
    # Serialized per scope (review M4) so overlapping turns can't race the call_state guards.
    _lock = _VOICE_LOCKS.setdefault(scope, asyncio.Lock())
    if len(_VOICE_LOCKS) > 300:
        for k in list(_VOICE_LOCKS)[:100]:
            if k != scope and not _VOICE_LOCKS[k].locked():
                _VOICE_LOCKS.pop(k, None)
    timeout = False
    try:
        async with _lock:
            out = await asyncio.wait_for(voice_protocol.in_call_turn(scope, utterance, ctx),
                                         timeout=_VOICE_TURN_BUDGET)
        tele.update(out.get("trace") or {})
        # MOUTH SANITIZER (Peter 2026-07-22): a stage direction ("(risa breve)") must be PERFORMED or
        # DROPPED, never read aloud. The live agent runs eleven_v3_conversational (Expressive Mode,
        # 2026-07-22) → v3=True: a slipped cue becomes a REAL performed tag ([laughs]), never spoken text.
        reply = voice_reply.sanitize_spoken(out.get("reply", ""), v3=True)
    except asyncio.TimeoutError:
        timeout = True
        reply = ("Perdona, me quedé comprobando una cosa — sigo contigo, ¿me lo repites?"
                 if lang == "es" else "Sorry, I was double-checking something — say that again?")
    except Exception:
        log.exception("voice/chat failed")
        reply = "Perdona, se me cruzó un cable — ¿me lo repites?"

    # ⑥ OFF-PATH (background — never blocks the voice): the spoken reply as msg.sent + ops telemetry +
    # a pin refresh so mid-call events (asides, tabs) land as deltas by the next utterance.
    total_ms = int((time.time() - t0) * 1000)

    # RECALL-AHEAD (IN-CALL-RUNTIME-DESIGN §1.2, Peter's speculative recall): while Rocoto speaks and
    # the human thinks, recall runs on what was JUST said — folded into the pin before the next turn.
    # RECALL-AHEAD now rides THE FABRIC (§9.1, review C3/#8): the result is a process.completed
    # spine event; the pin REBUILD merges it (voice_fabric.fold_results) — no in-proc mutation.
    if identified and (utterance or "").strip():
        import voice_fabric as _vf
        _vf.fire_named("recall_refresh", scope, utterance, ctx)
    async def _offpath():
        try:
            if identified and reply:
                await runtime.emit_sense(phone=caller, type="msg.sent", source="voice",
                                         payload={"text": reply})
            if identified:
                import spine as _spine
                async with supa.scoped_tx(scope) as con:
                    await _spine.append_event(con, scope, "ops.voice_turn", "voice",
                                              {"total_ms": total_ms, "pinned": pinned,
                                               "timeout": timeout, "stream": stream,
                                               "reply_len": len(reply or ""),
                                               "reply_head": (reply or "")[:120],
                                               **tele}, lane="reasoning")
                # PIN REFRESH — CARRY-FORWARD, never wholesale-replace (review C1, 2026-07-22: a bare
                # rebuild resets call_state:{} and wipes the pitch-once + repeat guards between turns on
                # every wa.<digits> call — the parrot loop reborn one layer up. The rebuild refreshes the
                # FOLD (card/tabs/window/persona); the call's living state and any speculative recall
                # lines _recall_ahead already merged must survive it.)
                fresh = await _build_voice_pin(caller, scope, lang)
                cur = _VOICE_PINS.get(scope)
                # CALL-STATE SURVIVES EVERY REBUILD (Peter 2026-07-23, the founder-call parrot): the
                # per-call guards (nc_pitch_done, last_reply, turn_seq) must NEVER be clobbered by a pin
                # swap. The old `if cur is pin` path installed a FRESH EMPTY call_state whenever two
                # off-path rebuilds interleaved (cur is not pin) — resetting the guards → verbatim repeats.
                # Carry the SAME live call_state object forward, unconditionally.
                fresh["call_state"] = (cur or pin).get("call_state") or pin.get("call_state") or {}
                if cur is pin:   # same call — also merge any speculative recall lines
                    merged, seen = [], set()
                    for t_ in (pin.get("recall_lines") or []) + (fresh.get("recall_lines") or []):
                        if t_ and t_ not in seen:
                            merged.append(t_); seen.add(t_)
                    fresh["recall_lines"] = merged[:6]
                    fresh["recall_inflight"] = bool(pin.get("recall_inflight"))
                _VOICE_PINS[scope] = fresh
        except Exception:
            # telemetry/refresh loss must be VISIBLE (review H4) — a silent drop makes calls undebuggable.
            log.warning("voice offpath failed (telemetry/pin-refresh lost for this turn)", exc_info=True)
    asyncio.create_task(_offpath())

    if stream:
        return _sse_completion(reply)
    return JSONResponse({"id": "rocoto-voice", "object": "chat.completion",
                         "choices": [{"index": 0, "message": {"role": "assistant", "content": reply},
                                      "finish_reason": "stop"}]})


@router.get("/api/voice/mind")
async def api_voice_mind() -> JSONResponse:
    """Is THE ONE voice mind alive? (public status — no secret.)

    B3 (2026-07-26): replaces `/api/voice/mode` and the `/api/voice/toggle` link. There are no modes to
    report and nothing to switch to — the only honest question left is whether our runtime agent is
    dialable, and `available:false` now means calls FAIL rather than answering in another voice."""
    import voice_toggle
    return JSONResponse({"mind": "runtime",
                         "available": voice_toggle.available(),
                         "runtime_agent_cached": bool(voice_toggle.cached_runtime_agent()),
                         "el_configured": el_bridge.configured()})


@router.post("/twilio/voice/recording")
async def voice_recording(request: Request) -> Response:
    """Twilio dual-channel recording-status callback → Hermes-style 2-channel post-pass."""
    form = await request.form()
    _require_twilio_signature(request, f"{config.PUBLIC_BASE_URL}/twilio/voice/recording", form)
    status = (form.get("RecordingStatus", "") or "").strip()
    call_sid = (form.get("CallSid", "") or "").strip()
    rec_url = (form.get("RecordingUrl", "") or "").strip()
    rec_sid = (form.get("RecordingSid", "") or "").strip()
    log.info("voice recording cb call=%s status=%s", call_sid, status)
    if status == "completed" and rec_url and call_sid:
        asyncio.create_task(postcall.process_recording(call_sid, rec_url, rec_sid))
    return Response(content="", media_type="application/xml")


@router.get("/media/{fname}")
def media(fname: str, ctx: dict = Depends(require_media_auth)) -> FileResponse:
    if "/" in fname or ".." in fname:
        raise HTTPException(404)
    p = MEDIA_DIR / fname
    if not p.exists():
        raise HTTPException(404)
    return FileResponse(p)


@router.get("/wamedia/{fname}")
def wamedia(fname: str) -> FileResponse:
    """Public (no-auth) route for outbound media so Twilio's CDN can fetch it."""
    if not _SAFE_FNAME.match(fname):
        raise HTTPException(404)
    p = OUTBOUND_DIR / fname
    if not p.exists():
        raise HTTPException(404)
    return FileResponse(p)


# ──────────────────────────────── App API ───────────────────────────────────────
@router.get("/api/conversations")
async def conversations(ctx: dict = Depends(require_app_runtime_cap('read'))) -> JSONResponse:
    rows = await supa.recent_messages(400)
    names = await supa.profiles_map()
    convos: dict[str, dict] = {}
    for m in rows:  # desc by created_at → first seen per phone is the latest
        ph = m["phone_number"]
        if ph in convos:
            continue
        convos[ph] = {
            "phone_number": ph,
            "name": names.get(ph, ""),
            # Raw text (no emoji); the client renders an icon for media types from last_type below.
            "last_text": (m.get("message_text") or "").strip(),
            "last_type": (m.get("message_type") or "text"),
            "last_at": m["created_at"],
            "last_role": m["role"],
        }
    return JSONResponse({"conversations": list(convos.values())})


def _preview(m: dict) -> str:
    t = (m.get("message_text") or "").strip()
    return t or PREVIEW.get(m.get("message_type", ""), "")


@router.get("/api/messages/{phone}")
async def messages(phone: str, after: str | None = None, ctx: dict = Depends(require_app_runtime_cap('read'))) -> JSONResponse:
    return JSONResponse({"messages": await supa.get_messages(_norm(phone), after)})


@router.get("/api/search")
async def search(q: str = "", ctx: dict = Depends(require_app_runtime_cap('read'))) -> JSONResponse:
    q = (q or "").strip()
    if len(q) < 2:
        return JSONResponse({"conversations": [], "messages": []})
    return JSONResponse(await supa.search(q))


# ──────────────────────────── Call lifecycle API ────────────────────────────
@router.get("/api/calls/active")
async def calls_active(ctx: dict = Depends(require_app_runtime_cap('read'))) -> JSONResponse:
    """Lightweight poll for the 'call in progress' banner + spectate live subtitles.
    Returns each active call's mode, who's handling it, whether it's spectate-able, and
    the running transcript lines + current subtitle."""
    rows = await supa.call_active()
    out = []
    for r in rows:
        out.append({
            "id": r["id"],
            "phone_number": r["phone_number"],
            "active": r.get("status") == "active",
            "mode": r.get("mode"),
            "operator_state": r.get("operator_state"),
            "spectatable": bool(r.get("spectatable")),
            "started_at": r.get("started_at"),
            "lines": r.get("lines") or [],
            "subtitle": r.get("subtitle") or "",
            "order_draft": r.get("order_draft") or {},
            "location": r.get("location") or {},
        })
    return JSONResponse({"calls": out})


@router.get("/api/calls/{call_id}")
async def call_detail(call_id: str, ctx: dict = Depends(require_app_runtime_cap('read'))) -> JSONResponse:
    r = await supa.call_get(call_id)
    if not r:
        raise HTTPException(404, "no such call")
    return JSONResponse({
        "id": r["id"], "phone_number": r["phone_number"],
        "active": r.get("status") == "active", "mode": r.get("mode"),
        "operator_state": r.get("operator_state"),
        "spectatable": bool(r.get("spectatable")),
        "started_at": r.get("started_at"), "ended_at": r.get("ended_at"),
        "lines": r.get("lines") or [], "subtitle": r.get("subtitle") or "",
        "order_draft": r.get("order_draft") or {},
        "location": r.get("location") or {},
    })


@router.post("/api/calls/{call_id}/takeover")
async def call_takeover(call_id: str, ctx: dict = Depends(require_app_runtime_cap('act'))) -> JSONResponse:
    """Operator joins the call. On the EL path this drops the agent so the human takes the
    line; on the live path it just records the state transition (operator picks up via WA)."""
    row = await supa.call_takeover(call_id)
    if not row:
        raise HTTPException(404, "call not active")
    bridge = _LIVE_ELEVEN.get(call_id)
    if bridge is not None:
        try:
            await bridge.takeover()
        except Exception:
            log.exception("takeover: bridge handoff failed for %s", call_id)
    return JSONResponse({"ok": True, "operator_state": "takeover"})


@router.post("/api/calls/start")
async def call_start(payload: dict, ctx: dict = Depends(require_app_runtime_cap('act'))) -> JSONResponse:
    """Operator taps **Call** → Rocoto places an OUTBOUND call from the business number to the
    customer (not the operator's personal line). Twilio answers it with the same bridge as
    inbound — Polly + Deepgram live subtitles, or the EL agent when the customer's voice toggle
    is on. Returns the new call SID so the app can open its live-call screen."""
    to = _norm(str(payload.get("to", "")))
    if not to.startswith("+") or len(to) < 8:
        raise HTTPException(400, "to must be +E.164")
    if not config.TWILIO_VOICE_FROM:
        raise HTTPException(503, "outbound voice number not configured (TWILIO_VOICE_FROM)")
    import urllib.parse as _url
    twiml_url = f"{config.PUBLIC_BASE_URL}/twilio/voice/outgoing?to={_url.quote(to)}"
    try:
        sid = await twa.start_outbound_call(to, twiml_url)
    except Exception:
        log.exception("calls/start failed for %s", to)
        raise HTTPException(502, "could not place call")
    log.info("outbound voice call → %s (sid=%s)", to, sid)
    return JSONResponse({"ok": True, "call_sid": sid, "to": to})


@router.api_route("/twilio/voice/outgoing", methods=["GET", "POST"])
async def voice_outgoing(request: Request) -> Response:
    """TwiML for an OUTBOUND call we placed — Twilio fetches this when the customer answers.
    Mirrors /twilio/voice/incoming, with the callee as the 'from' the bridge session tracks."""
    import urllib.parse as _url
    to = _norm(request.query_params.get("to", "") or "")
    form = await request.form()
    _require_twilio_signature(
        request, f"{config.PUBLIC_BASE_URL}/twilio/voice/outgoing?to={_url.quote(to)}", form)
    wss = config.PUBLIC_BASE_URL.replace("https://", "wss://").replace("http://", "ws://")
    # B3 (2026-07-26): the twin of the inbound seam. This used to consult the per-customer
    # `elevenlabs_autoreply_enabled` toggle and degrade to the Polly "Hola, soy Rocoto" line — a call
    # answered in Rocoto's name with no mind behind it, the incident's disease one layer down. ONE mind
    # now: ours answers, or the call says so and hangs up.
    import voice_toggle
    if not (el_bridge.configured() and voice_toggle.available()):
        log.error("VOICE MIND UNAVAILABLE — refusing the outbound call to %s (no fallback exists)", to)
        _voice_mind_alert(f"outbound call to {to} refused: EL configured="
                          f"{el_bridge.configured()} runtime_agent={bool(voice_toggle.cached_runtime_agent())}")
        return Response(content=_VOICE_MIND_FAIL_TWIML, media_type="application/xml")
    recording_cb = ""
    if config.VOICE_POSTCALL_DIARIZE:
        recording_cb = f"{config.PUBLIC_BASE_URL}/twilio/voice/recording"
    twiml = voice_bridge.incoming_twiml(
        to,
        eleven_wss_url=f"{wss}/twilio/voice/eleven-stream",
        recording_cb=recording_cb,
    )
    log.info("outbound voice answered → %s → runtime mind", to)
    return Response(content=twiml, media_type="application/xml")


# ──────────────────────────── Customer settings API ────────────────────────────
@router.get("/api/customer/{phone}")
async def customer_settings(phone: str, ctx: dict = Depends(require_app_runtime_cap('read'))) -> JSONResponse:
    return JSONResponse(await supa.get_customer_settings(_norm(phone)))


@router.post("/api/customer/{phone}/voice")
async def set_voice_toggle(phone: str, payload: dict, ctx: dict = Depends(require_app_runtime_cap('act'))) -> JSONResponse:
    """The per-customer "Rocoto responde" switch as the app already draws it.

    B6 (SPEC §5.5): this used to flip `elevenlabs_autoreply_enabled`, a flag that after B3 decided
    NOTHING (it no longer chooses who answers a call). It is now a VIEW of the one mode field —
    enabled ⇒ auto, disabled ⇒ sombra for this customer — so the switch the supplier has always had
    finally does the thing its label promises, and there is no fifth flag behind it."""
    import gate
    import runtime
    enabled = bool(payload.get("enabled", False))
    sc = runtime.scope_of(_norm(phone))
    v = await gate.set_mode(sc, gate.AUTO if enabled else gate.SOMBRA)
    return JSONResponse({"ok": True, "phone_number": _norm(phone), "scope": sc,
                         "elevenlabs_autoreply_enabled": v["mode"] == gate.AUTO,
                         "el_configured": el_bridge.configured(), **v})


@router.post("/api/customer/{phone}/windows")
async def set_auto_windows(phone: str, payload: dict, ctx: dict = Depends(require_app_runtime_cap('act'))) -> JSONResponse:
    """Set when Rocoto auto-answers this customer's calls: a list of
    {days:[0..6 Mon..Sun], start:minute, end:minute}. Empty = always (when the voice toggle is on)."""
    windows = payload.get("windows")
    if not isinstance(windows, list):
        raise HTTPException(400, "windows must be a list")
    saved = await supa.set_auto_windows(_norm(phone), windows)
    return JSONResponse({"ok": True, "phone_number": _norm(phone), "auto_windows": saved})


@router.post("/api/send")
async def send(payload: dict, ctx: dict = Depends(require_app_runtime_cap('act'))) -> JSONResponse:
    """Operator-composed WhatsApp send (the app's own chat composer — a human typing, not the mind
    replying). Was calling `twilio_wa.send_whatsapp` — a DIFFERENT rail from the one every real
    message on this product actually travels (Meta Cloud API via `actions.send_whatsapp_as_rocoto`),
    so a founder's own typed message never reached the real WhatsApp thread while the automated
    replies, on the correct rail, worked the whole time (Peter, 2026-07-28: "messages i send from
    the app dont arrive in whatsapp"). `override=True` is the §15.4 rail exactly for this: a human
    speaking through Rocoto passes MODO SOMBRA (sombra shuts ROCOTO's own mouth, never the boss's)."""
    phone = _norm(payload.get("phone", ""))
    text = (payload.get("text", "") or "").strip()
    if not phone or not text:
        raise HTTPException(400, "phone and text required")
    import actions
    import runtime
    sid = await actions.send_whatsapp_as_rocoto(runtime.scope_of(phone), text, override=True)
    await supa.insert_message({
        "id": str(uuid.uuid4()), "phone_number": phone, "role": "assistant",
        "message_text": text, "message_type": "text",
        "wa_message_id": sid, "created_at": supa.now_iso(),
    })
    return JSONResponse({"ok": True, "sid": sid})


@router.post("/api/send-media")
async def send_media(
    phone: str = Form(...),
    kind: str = Form("document"),
    caption: str = Form(""),
    file: UploadFile = File(...),
    ctx: dict = Depends(require_app_runtime_cap('act')),
) -> JSONResponse:
    """Operator-sent media (voice note / photo / file). Saves it, hands Twilio a public URL,
    sends via WhatsApp, and records the outgoing message so the app shows it immediately."""
    phone = _norm(phone)
    if not phone:
        raise HTTPException(400, "phone required")
    data = await file.read()
    if not data:
        raise HTTPException(400, "empty file")
    if len(data) > 16 * 1024 * 1024:  # WhatsApp media ceiling
        raise HTTPException(413, "file too large (16MB max)")

    ctype = (file.content_type or "application/octet-stream").split(";")[0].strip()
    ext = EXT.get(ctype) or (Path(file.filename or "").suffix.lstrip(".").lower()) or "bin"
    mid = str(uuid.uuid4())
    fname = f"{mid}.{ext}"
    # 16MB write off the event loop (review F9 — mirrors voice_reply's threaded _write); a big blocking
    # write on the shared loop would stall every other in-flight request.
    await asyncio.to_thread((OUTBOUND_DIR / fname).write_bytes, data)
    public = f"{config.PUBLIC_BASE_URL}/wamedia/{fname}"

    mtype = (
        "audio" if ctype.startswith("audio/")
        else "image" if ctype.startswith("image/")
        else "video" if ctype.startswith("video/")
        else "document"
    )
    import actions
    import runtime
    sid = await actions.send_whatsapp_as_rocoto(runtime.scope_of(phone), caption, media_url=public,
                                                override=True)
    row = {
        "id": mid, "phone_number": phone, "role": "assistant",
        "message_text": caption, "message_type": mtype,
        "media_urls": [public], "media_types": [ctype],
        "wa_message_id": sid, "created_at": supa.now_iso(),
        # Transcribe our OWN voice notes too, so the chat shows what we said (Peter).
        "transcript_status": "pending" if mtype == "audio" else "none",
    }
    await supa.insert_message(row)
    if mtype == "audio":
        asyncio.create_task(_transcribe_outgoing(mid, data, ctype))
    return JSONResponse({"ok": True, "sid": sid, "media_url": public, "id": mid})


@router.post("/api/voice/transcribe")
async def voice_transcribe(
    request: Request,
    file: UploadFile | None = File(default=None),
    ctx: dict = Depends(require_app_runtime_cap('act')),
) -> JSONResponse:
    """Voice → text: audio (multipart 'file' OR raw request body) → Deepgram → quick Haiku tidy.
    Never 500s on empty input — returns {"text": ""}."""
    if file is not None:
        data = await file.read()
        ctype = (file.content_type or "audio/ogg").split(";")[0].strip()
    else:
        data = await request.body()
        ctype = (request.headers.get("content-type") or "audio/ogg").split(";")[0].strip()
    if not data:
        return JSONResponse({"text": "", "raw": ""})
    try:
        dg = await tx.deepgram_diarize(data, ctype)
        raw, _utts = tx.parse_utterances(dg)
        text = await asyncio.to_thread(tx.haiku_tidy, raw)
    except Exception:
        log.exception("voice transcribe failed")
        return JSONResponse({"text": ""})
    return JSONResponse({"text": text or "", "raw": raw or ""})


@router.post("/api/register-device")
async def register_device(payload: dict, ctx: dict = Depends(require_app_runtime_cap('act'))) -> JSONResponse:
    token = (payload.get("token", "") or "").strip()
    if not token:
        raise HTTPException(400, "token required")
    await supa.register_token(token, payload.get("platform", "android"))
    return JSONResponse({"ok": True, "push_enabled": fcm.available()})


# MACHINE: the deploy/ops health read (version.json written at install). Genuinely machine-to-machine
# and carries no tenant data — it stays on the key.
@router.get("/api/version")
def version(_: None = Depends(require_key)) -> JSONResponse:
    vf = MEDIA_DIR / "version.json"
    if vf.exists():
        import json
        return JSONResponse(json.loads(vf.read_text()))
    return JSONResponse({"version_code": 1, "version_name": "1.0", "apk_url": f"{config.PUBLIC_BASE_URL}/media/sancho.apk"})


# ──────────────────────────── Phase-A orders → Excel ────────────────────────────
ORDERS_AGENT_ID = "orders"
# Store-builder wizard durable state (per-tenant resumable wizard). Reuses the agent_settings
# jsonb store under a dedicated key so the wizard survives app restarts (Stage-6 durable persist).
STOREFRONT_WIZARD_AGENT_ID = "storefront.wizard_state"
_DEFAULT_DISPATCH = {
    "mode": "scheduled",                       # each_order | every_n | scheduled | manual_only
    "n": 10,
    "schedule_time": config.DISPATCH_DEFAULT_TIME,
    "recipient_email": config.DISPATCH_DEFAULT_EMAIL,
    "excel_format": "standard",                # any orders.EXCEL_FORMATS id (fallback when no column map)
    # MVP per-customer Excel (2026-07-23, mirrors the app's DispatchSettingsDto — the same landing as
    # the DTO change, so settings never silently drop): a column layout every export uses, plus
    # per-customer overrides (phone → their bookkeeper's column habit). Empty = the built-in layouts.
    "default_columns": [],                     # [{header, field, order}] · fields: fecha|cliente|producto|codigo|codigo_cliente|cantidad|unidad|precio|importe|nota|pedido
    "per_customer_columns": {},                # {phone: [{header, field, order}]}
    # How Rocoto TALKS — behaviour/vibe (persisted here; read into the soul's VOZ frame line each
    # turn via runtime.house_style — M1M2 WP-5).
    "vibe": "",                                # warm | brief | formal | playful | custom | ""
    "house_style": "",                         # free-text house-style note
}
_VALID_MODES = ("each_order", "every_n", "scheduled", "manual_only")
_VALID_EXCEL_FORMATS = orders_mod.EXCEL_FORMATS  # derived, per shared contract 4 — never a second list
_COLUMN_FIELDS = ("fecha", "cliente", "producto", "codigo", "codigo_cliente", "cantidad", "unidad", "precio", "importe", "nota", "pedido")


def _clean_columns(cols) -> list[dict]:
    """Sanitize a column layout: keep only {header,field,order} dicts with a known field, sorted."""
    out = []
    for c in (cols or []):
        if not isinstance(c, dict):
            continue
        f = str(c.get("field") or "").strip().lower()
        if f not in _COLUMN_FIELDS:
            continue
        out.append({"header": str(c.get("header") or f.title())[:40], "field": f,
                    "order": int(c.get("order") or 0)})
    return sorted(out, key=lambda c: c["order"])


async def _dispatch_settings() -> dict:
    return {**_DEFAULT_DISPATCH, **(await supa.settings_get(ORDERS_AGENT_ID) or {})}


async def _run_dispatch(reason: str) -> dict:
    """Compile approved-unsent orders → Excel → email; mark them sent on success.
    M1M2 WP-0 — the unreviewed-at-cutoff POLICY (explicit, eng F9): unreviewed orders are HELD (only
    approved ever dispatches — unchanged) and the held count is FLAGGED in the daily email; a
    scheduled send that finds NOTHING approved but a held set still emails the flag (a day where
    everything sat unreviewed must never be a silent day).
    M1M2 WP-3 — `codigo_cliente` resolves HERE (the customer's own client code in the supplier's
    ERP, customer_profiles.erp_client_code → the order dict → the column-map renderer).
    Dispatch robustness (eng F11): a failed/crashed dispatch routes into the WP-0 nudge chain
    (_dispatch_failure_nudge) — never just a silent log.warning; the next success resolves the tab."""
    orders = await supa.orders_for_dispatch()
    held = await supa.orders_pending_review_count()   # both default to BRAIN_TENANT (§the one box)
    if not orders:
        if held and reason == "scheduled":
            st = await _dispatch_settings()
            res = await orders_mod.send_held_notice(st.get("recipient_email"), held)
            res.update({"count": 0, "held": held, "note": "held-only notice"})
            if not res.get("ok"):
                log.warning("held-only notice failed [%s]: %s", reason, res.get("error"))
                await _dispatch_failure_nudge(reason, res.get("error") or "held-notice failed")
            return res
        return {"ok": True, "count": 0, "held": held, "note": "nothing to dispatch"}
    st = await _dispatch_settings()
    try:
        # WP-3: attach each customer's ERP client code (fail-soft — a resolve hiccup ships the
        # Excel without codigo_cliente rather than shipping nothing).
        codes = await supa.erp_codes_for([str(o.get("phone_number") or "") for o in orders])
        for o in orders:
            o["erp_client_code"] = codes.get(str(o.get("phone_number") or ""))
    except Exception:
        log.exception("erp-code resolve failed [%s] (dispatch continues without codigo_cliente)", reason)
    try:
        res = await orders_mod.dispatch_async(orders, st.get("recipient_email"), st.get("excel_format") or "standard",
                                              columns=st.get("default_columns") or None,
                                              per_customer=st.get("per_customer_columns") or None,
                                              held_count=held)
    except Exception as e:
        # eng F11: an exception mid-compile (a bad column map, a workbook error) must not die as a
        # log line while approved orders silently stop flowing — it becomes the boss nudge below.
        log.exception("dispatch crashed [%s]", reason)
        res = {"ok": False, "error": f"exception:{type(e).__name__}", "count": len(orders)}
    res["held"] = held
    if res.get("ok"):
        # M1M2 WP-4 (eng F1, critical): freeze each order's VALUE SNAPSHOT at the dispatch instant
        # (line.price → tenant catalogue price → flag unpriced). The 0.3% meter sums ONLY these
        # snapshots — a later price edit can never rewrite billed history. Set-once per row;
        # fail-soft per order (a hole surfaces as billing_run.unsnapshotted, never a silent guess).
        try:
            from brain import billing as brain_billing
            await brain_billing.snapshot_dispatch_values(orders)
        except Exception:
            log.exception("value snapshot failed [%s] (dispatch continues; the meter will show "
                          "the unsnapshotted hole)", reason)
        await brain_events.mark_dispatched([o["id"] for o in orders])
        # Pedidos orders meter (spec §3): dispatch is the direct 'sent' transition on this path —
        # count it right here rather than waiting for pedidos_meter.reconcile_loop()'s next tick.
        # Fail-soft: a meter hiccup must never block a dispatch that already succeeded.
        try:
            for o in orders:
                await pedidos_meter.record_order(o.get("tenant_id") or config.BRAIN_TENANT, o["id"], "sent")
        except Exception:
            log.exception("pedidos_meter record failed for dispatched batch [%s] "
                          "(reconcile_loop will catch it up)", reason)
        log.info("dispatched %d order(s) [%s] → %s (%d held unreviewed)",
                 len(orders), reason, st.get("recipient_email"), held)
        await _dispatch_ok_clear()
    else:
        log.warning("dispatch failed [%s]: %s", reason, res.get("error"))
        await _dispatch_failure_nudge(reason, res.get("error") or "")
    return res


async def _creator_order_route(phone: str, *, tenant: str = "") -> dict:
    """Does an inbound from THIS number reach the order brain? → {as_customer, why, identity}.

    THE RULE (unchanged, and it is right): the CREATOR line is a BOSS channel. Peter's own messages
    are instructions — "llámame", "prueba esto", "cámbiame el tono" — and minting a food order out of
    one of those is worse than minting none. `runtime`'s gated `take_order` owns any real order the
    boss genuinely dictates on his own line.

    THE EXCEPTION (new, 2026-07-27, and the reason this function exists): the same number is also the
    one Peter uses to run his own acceptance test — WhatsApp Rocoto pretending to be Bar Lumbre and
    watch the order brain take the order. Before this, that message hit the guard and returned
    SILENTLY: no order, no log, no event, nothing to read. "Why did nothing happen?" had no answer
    anywhere in the system, which is exactly what made the blocker invisible for as long as it was.

    Two ways to earn the exception, both scoped and reversible (config.py documents the pair in full):
      · STATE — this tenant's identity holds a **seeded** customer profile for the number. A real row,
        tenant-keyed, `customer_profiles.seeded=true`, deleted by the demo teardown. It is the
        preferred mechanism because it appears and disappears WITH the demo world; a live
        distributor's tenant has no seeded rows, so the exception cannot follow us into production.
      · ALLOWLIST — `ROCOTO_TEST_CUSTOMER_NUMBERS`, empty by default, for a box with no seeded world.

    NOT the tier ladder: `runtime.ingest_inbound` pins `tier_override='creator'` for these numbers, so
    `scope_node.tier` answers "creator" BY CONSTRUCTION and could never say "customer". The identity
    signal that carries real information here is the seeded customer profile, so that is the one used;
    the tier is still read and carried on the verdict for the record. (Identity is two systems on this
    codebase — the runtime tier ladder and `customer_profiles` — and this function is explicit about
    which of the two it is asking, rather than pretending they are one.)"""
    if not config.is_creator_number(phone):
        return {"as_customer": True, "why": "not_creator", "identity": None}
    ident = None
    try:
        from brain import identity as _identity
        ident = await _identity.customer_role(phone, tenant=tenant or None)
    except Exception:
        log.debug("creator-route identity read fail-soft for %s", phone, exc_info=True)
    if ident and ident.get("known") and ident.get("seeded"):
        return {"as_customer": True, "why": "seeded_customer_profile", "identity": ident}
    if config.is_test_customer_number(phone):
        # Explicit operator decision: honour it even when identity does NOT know the number, and say
        # so on the trace. Requiring identity to agree would reintroduce the exact failure this is
        # here to kill — a test that silently does nothing because a row was missing.
        return {"as_customer": True, "why": "test_customer_allowlist", "identity": ident}
    return {"as_customer": False, "why": "creator_line", "identity": ident}


async def _trace_creator_route(msg_id: str, phone: str, text: str, route: dict) -> None:
    """Leave a READABLE trace for every message the creator guard touched — held or let through.

    A log line at minimum, plus an `ops.*` spine event on the sender's own scope (the idiom this
    codebase already uses for ops.wa_send_failed / ops.reaction_refused), so the answer to "why did
    nothing happen?" lives next to the message it is about, in the flight recorder, forever. Deduped
    on the message id: a redelivered webhook writes one event, not two. Fail-soft in every direction —
    a trace must never be able to take down the intake it is describing."""
    ident = route.get("identity") or {}
    who = ident.get("display_name") or "—"
    if route["as_customer"]:
        log.info("creator line %s ROUTED AS CUSTOMER (%s; identity=%s tier=%s) msg=%s",
                 phone, route["why"], who, ident.get("tier") or "—", msg_id)
        etype, detail = "ops.order_intake_as_customer", (
            f"Mensaje de la línea del creador tratado como CLIENTE ({route['why']})")
    else:
        log.info("creator line %s NOT routed to the order brain (%s; identity=%s) msg=%s — "
                 "set ROCOTO_TEST_CUSTOMER_NUMBERS or load the seeded world to test as a customer",
                 phone, route["why"], who, msg_id)
        etype, detail = "ops.order_intake_skipped", (
            "Mensaje de la línea del creador: NO va al cerebro de pedidos (es canal de jefe). "
            "Para probar como cliente: mundo sembrado o ROCOTO_TEST_CUSTOMER_NUMBERS.")
    try:
        import runtime as _rt
        import spine as _spine
        scope = _rt.scope_of(phone)
        async with supa.scoped_tx(scope) as con:
            await _spine.append_event(
                con, scope, etype, "intake",
                {"text": detail, "why": route["why"], "msg_id": msg_id,
                 "preview": (text or "")[:120],
                 "identity_known": bool(ident.get("known")),
                 "identity_seeded": bool(ident.get("seeded")),
                 "identity_name": who, "tier": ident.get("tier") or ""},
                lane="reasoning", dedupe_key=f"intakeroute:{msg_id or phone}")
    except Exception:
        log.debug("creator-route trace fail-soft", exc_info=True)


async def _maybe_extract_order(msg_id: str, phone: str, name: str, text: str,
                               tenant: str | None = None) -> None:
    """Route an inbound message to order intake. With the order-brain ON, enqueue it on the durable
    queue (write-before-process; ~2-min debounce coalesces a burst into one order; urgency short-
    circuits). With it OFF, fall back to immediate Phase-A extraction (unchanged).

    `tenant` is the distributor the message arrived FOR (resolved at the door from Meta's
    `phone_number_id`). It is the value `brain/queue.enqueue` has always accepted and this call site
    has always omitted — which is precisely why every inbound on every rail was processed as
    BRAIN_TENANT. Omitted here → BRAIN_TENANT, so a single-tenant box is unchanged."""
    tenant = tenant or config.BRAIN_TENANT
    if config.is_creator_number(phone):
        route = await _creator_order_route(phone)
        await _trace_creator_route(msg_id, phone, text, route)
        if not route["as_customer"]:
            return
    if config.ORDER_BRAIN_ENABLED:
        try:
            await brain_queue.enqueue(msg_id, phone, urgent=junkgate.is_urgent(text or ""),
                                      tenant=tenant)
            # Drop a 'preparing' order card the instant a likely-order message lands, so the operator
            # immediately sees Rocoto taking the order; the drainer fills this same card in.
            if not junkgate.is_junk(text or "", has_media=False)[0]:
                await brain_events.ensure_preparing(phone, name or "", tenant=tenant)
        except Exception:
            log.exception("enqueue failed for msg %s", msg_id)
        return
    if not config.ORDER_EXTRACTION_ENABLED or not (text or "").strip():
        return
    try:
        order = await asyncio.to_thread(
            orders_mod.extract_order_sync, text, phone, name, [msg_id] if msg_id else [])
        if not order:
            return
        saved = await supa.order_insert({**order, "tenant_id": tenant})
        log.info("order %s extracted from msg %s (%d lines)", saved["id"], msg_id, len(order["lines"]))
        if msg_id:
            await _attach_entities(msg_id, order)
        try:
            tokens = await supa.get_tokens()
            if tokens:
                title = order.get("customer_name") or name or phone or "Nuevo pedido"
                await asyncio.to_thread(fcm.push_to_all, tokens, "New order", title,
                                        {"order_id": saved["id"], "phone": phone, "name": title})
        except Exception:
            log.exception("order push failed")
    except Exception:
        log.exception("order extraction failed for msg %s", msg_id)


async def _attach_entities(msg_id: str, order: dict) -> None:
    """Merge category-tagged transcript entities onto the source message so the app's
    transcript view can highlight extracted keywords inline (Part 5). Additive — preserves
    the existing transcript_meta (utterances, etc.)."""
    try:
        m = await supa.get_message(msg_id)
        if not m:
            return
        entities: list[dict] = []
        for li, line in enumerate(order.get("lines", [])):
            for men in (line.get("mentions") or []):
                txt = (men.get("text") or "").strip()
                if txt:
                    entities.append({"text": txt, "category": men.get("category", "producto"),
                                     "order_line_index": li})
        if not entities:
            return
        tm = dict(m.get("transcript_meta") or {})
        tm["entities"] = entities
        await supa.update_message(msg_id, {"transcript_meta": tm})
    except Exception:
        log.exception("attach entities failed %s", msg_id)


async def _extract_for_msg(msg_id: str, text: str) -> None:
    """Media path: look up the message's phone/name/TENANT, then extract.

    The tenant is re-read off the stored row rather than passed in: this runs on a detached task that
    only ever knew the message id, so a default here would have quietly put every voice note and
    photo back on the single-tenant rail after the text rail was fixed."""
    try:
        m = await supa.get_message(msg_id)
        if not m:
            return
        phone = m.get("phone_number", "")
        st = await supa.get_customer_settings(phone)
        await _maybe_extract_order(msg_id, phone, st.get("display_name", ""), text,
                                   tenant=m.get("tenant_id") or config.BRAIN_TENANT)
    except Exception:
        log.exception("extract-for-msg failed %s", msg_id)


# ── M1M2 WP-0 · the review-nudge REFLEX (perception, manifest-registered — SPEC §3.2/§16.6) ──
# The SITUATION is the `review_nudge` manifest_duty ROW (schema_runtime.sql: count-free sentence,
# slots resolve at open time) bound by the generic binder. This is its ONE manifest-legal emitter —
# registered as the manifest_reflex row ('boss','review_nudge'), the same rows+wired-code shape as
# the order-brain; it refuses to run without that row enabled. Each scan tick it senses unreviewed
# orders APPROACHING the daily cutoff and emits `orders.review_pending` onto the boss scope with a
# per-cutoff dedupe_key — so the whole chain (sense → tab → armed rung → worker → gate → WhatsApp)
# fires AT MOST ONCE per cutoff; when the review queue is EMPTY it emits `orders.review_clear` so an
# open nudge tab resolves. The SEND itself stays on the worker's standard spine outbound path
# (gate.check_outbound on the sentence as always; the rung's pacing_deadline keeps human-hours
# pacing from holding the nudge past its cutoff — worker._pacing_hold_ok).

async def _reflex_cfg(organ: str, scope_tier: str = "boss") -> dict | None:
    """The reflex's manifest registration (§3.2). None → not registered / disabled → the emitter
    must not run. Fail-soft to None (a config-read hiccup silences the reflex, never crashes a tick)."""
    try:
        async with supa.control_pool().acquire() as con:
            row = await con.fetchrow(
                "select config, enabled from manifest_reflex where organ=$1 and scope_tier=$2 "
                "order by id desc limit 1", organ, scope_tier)
        if row and row["enabled"]:
            cfg = row["config"]
            if isinstance(cfg, str):
                cfg = json.loads(cfg or "{}")
            return cfg if isinstance(cfg, dict) else {}
    except Exception:
        log.debug("reflex registration read fail-soft (%s/%s)", scope_tier, organ, exc_info=True)
    return None


def _cutoff_today(st: dict, now):
    """Today's dispatch-cutoff instant in `now`'s timezone (Europe/Madrid on the live path), or None
    when it already passed (the next window belongs to tomorrow's scan) or the HH:MM is unparseable."""
    raw = str(st.get("schedule_time") or "03:50").strip()
    try:
        hh, mm = raw.split(":", 1)
        cutoff = now.replace(hour=int(hh), minute=int(mm), second=0, microsecond=0)
    except (ValueError, TypeError):
        return None
    return cutoff if now < cutoff else None


async def _nudge_boss_scope(cfg: dict) -> str | None:
    """The boss scope the nudge sense lands on. Deterministic order: the reflex row's `boss_phone`
    pin → the newest tier='boss' scope_node (setupfee conversion / golive writes it) → the creator
    line (single-tenant v1: the creator operates the boss surface). None → no rail, the reflex no-ops."""
    import runtime
    phone = str((cfg or {}).get("boss_phone") or "").strip()
    if phone:
        return runtime.scope_of(phone)
    try:
        async with supa.control_pool().acquire() as con:
            sc = await con.fetchval(
                "select scope::text from scope_node where tier='boss' and lineage='live' "
                "order by created_at desc limit 1")
        if sc:
            return str(sc)
    except Exception:
        log.debug("review-nudge: boss scope_node read fail-soft", exc_info=True)
    first = (config._env("ROCOTO_CREATOR_NUMBERS", "").split(",") or [""])[0].strip()
    return runtime.scope_of(first) if first else None


async def _review_nudge_scan(st: dict | None = None, now=None) -> dict:
    """One reflex tick (called from the dispatch scheduler loop; `now` injectable for the vital).
    Returns {emitted, cleared} for observability. Fail-soft: a hiccup logs and returns inert — the
    scheduler loop must never die on the nudge."""
    out = {"emitted": False, "cleared": 0}
    try:
        cfg = await _reflex_cfg("review_nudge")
        if cfg is None:
            return out
        st = st or await _dispatch_settings()
        if st.get("mode") != "scheduled":
            return out                                # no daily cutoff → no pre-cutoff nudge
        import datetime as _dt

        import runtime
        # BOX-LOCAL clock, tz-AWARE: _dispatch_scheduler compares schedule_time against the box-local
        # HH:MM, so the cutoff must live on the same clock — .astimezone() keeps it absolute so the
        # worker's pacing comparison (Europe/Madrid-aware) stays correct whatever TZ the box runs.
        now = now or _dt.datetime.now().astimezone()
        scope = await _nudge_boss_scope(cfg)
        if not scope:
            return out
        held = await supa.orders_pending_review_count()
        if held == 0:
            # queue is clear → resolve any open nudge tab (the duty's resolves_on); else pure silence.
            try:
                async with supa.control_pool().acquire() as con:
                    keys = [r["entity_key"] for r in await con.fetch(
                        "select entity_key from open_loop where scope=$1::ltree and status='open' "
                        "and entity_key like 'revnudge:%'", scope)]
            except Exception:
                keys = []
            for k in keys:
                ck = k.split(":", 1)[1]
                await runtime.on_duty_sense(scope, "orders.review_clear", {"cutoff_key": ck},
                                            dedupe_key=f"revclear:{ck}", source="dispatch")
                out["cleared"] += 1
            return out
        cutoff = _cutoff_today(st, now)
        if cutoff is None:
            return out
        try:
            lead_min = int(cfg.get("lead_minutes") or 45)
        except (TypeError, ValueError):
            lead_min = 45
        if not (cutoff - _dt.timedelta(minutes=lead_min) <= now < cutoff):
            return out                                # not approaching yet (or misconfigured lead)
        ck = cutoff.strftime("%Y%m%d-%H%M")
        r = await runtime.on_duty_sense(
            scope, "orders.review_pending",
            {"cutoff": cutoff.strftime("%H:%M"), "cutoff_key": ck,
             "cutoff_iso": cutoff.isoformat(), "count": held},
            dedupe_key=f"revnudge:{ck}", source="dispatch")
        out["emitted"] = bool(r.get("ok")) and not r.get("dedup")
        if out["emitted"]:
            log.info("review-nudge: emitted orders.review_pending onto %s (cutoff %s, %d unreviewed)",
                     scope, ck, held)
    except Exception:
        log.exception("review-nudge scan failed (fail-soft)")
    return out


# ── M1M2 WP-3 · dispatch-failure → the boss nudge (eng F11; SITUATIONS ARE DATA, same shape as
# WP-0). The SITUATION is the `dispatch_failed` manifest_duty ROW (schema_runtime.sql) bound by the
# generic binder; this is its ONE manifest-legal emitter (manifest_reflex row ('boss',
# 'dispatch_failed'); wired code = the dispatch organ's failure path in _run_dispatch). A failed
# daily send emits `orders.dispatch_failed` onto the boss scope with a per-day dedupe_key (at most
# ONE WhatsApp per day however many cadence retries fail); the next SUCCESSFUL dispatch emits
# `orders.dispatch_ok` so the tab resolves. The send rides the worker's standard spine outbound
# path — gate.check_outbound on the sentence as always.

async def _dispatch_failure_nudge(reason: str, error: str) -> None:
    """Route a failed dispatch into the WP-0 nudge chain (never a silent log.warning). Fail-soft:
    the nudge is the messenger — it must never mask or replace the dispatch result."""
    try:
        cfg = await _reflex_cfg("dispatch_failed")
        if cfg is None:
            return                                     # not manifest-registered → the emitter must not run
        scope = await _nudge_boss_scope(cfg)
        if not scope:
            return
        import datetime as _dt

        import runtime
        day = _dt.datetime.now().astimezone().strftime("%Y%m%d")
        r = await runtime.on_duty_sense(
            scope, "orders.dispatch_failed",
            {"day_key": day, "reason": reason, "error": (error or "")[:200]},
            dedupe_key=f"dispfail:{day}", source="dispatch")
        if r.get("ok") and not r.get("dedup"):
            log.info("dispatch-failure nudge: emitted orders.dispatch_failed onto %s (reason=%s)",
                     scope, reason)
    except Exception:
        log.exception("dispatch-failure nudge failed (fail-soft)")


async def _dispatch_ok_clear() -> None:
    """A successful dispatch resolves any open dispatch-failed tab (the duty's resolves_on) —
    silence when none is open. Fail-soft."""
    try:
        cfg = await _reflex_cfg("dispatch_failed")
        if cfg is None:
            return
        scope = await _nudge_boss_scope(cfg)
        if not scope:
            return
        try:
            async with supa.control_pool().acquire() as con:
                keys = [r["entity_key"] for r in await con.fetch(
                    "select entity_key from open_loop where scope=$1::ltree and status='open' "
                    "and entity_key like 'dispfail:%'", scope)]
        except Exception:
            keys = []
        import runtime
        for k in keys:
            day = k.split(":", 1)[1]
            await runtime.on_duty_sense(scope, "orders.dispatch_ok", {"day_key": day},
                                        dedupe_key=f"dispok:{day}", source="dispatch")
    except Exception:
        log.exception("dispatch-ok clear failed (fail-soft)")


async def _dispatch_scheduler() -> None:
    """Once a minute: if cadence='scheduled' and it's the configured HH:MM, dispatch (once/day)."""
    import datetime as _dt
    last_fire_day = None
    while True:
        try:
            st = await _dispatch_settings()
            await _review_nudge_scan(st)   # WP-0: the pre-cutoff review-nudge reflex (fail-soft inside)
            if st.get("mode") == "scheduled":
                now = _dt.datetime.now()
                if now.strftime("%H:%M") == (st.get("schedule_time") or "03:50") \
                        and last_fire_day != now.date():
                    last_fire_day = now.date()
                    await _run_dispatch("scheduled")
            # §17.4c/§17.36: the NAMED schedules ride the same tick. They only SEND — the legacy
            # branch above stays the one thing that marks dispatched_at (a partner send never
            # consumes the day sheet's duty). Fail-soft per row inside.
            import dispatch_sched
            await dispatch_sched.run_due()
        except Exception:
            log.exception("dispatch scheduler tick failed")
        await asyncio.sleep(30)


async def _enrich_with_medusa(orders: list[dict]) -> list[dict]:
    """Two-source READ join (medusa-integration.md §4): for orders already projected to Medusa,
    serve the Medusa order merged with Rocoto-only fields. No-op (returns Rocoto projection) when
    sync is disabled or Medusa is unreachable — never a hard error on a read."""
    if not medusa_client.enabled() or not orders:
        return orders
    ids = [o.get("id") for o in orders if o.get("id")]
    try:
        pool = supa.get_pool()
        async with pool.acquire() as con:
            rows = await con.fetch(
                """select sancho_order_id, medusa_order_id from medusa_sync
                     where sancho_order_id = any($1::text[]) and op='create_order'
                       and status='done' and medusa_order_id is not null""", ids)
        mmap = {r["sancho_order_id"]: r["medusa_order_id"] for r in rows}
    except Exception:
        return orders
    if not mmap:
        return orders
    client = medusa_client.get_client()
    out: list[dict] = []
    for o in orders:
        mid = mmap.get(o.get("id"))
        if not mid:
            out.append(o)
            continue
        try:
            mo = await client.get_order(mid)
            out.append(medusa_map.medusa_order_to_dto(mo, o))
        except Exception:
            o2 = dict(o); o2["medusa_stale"] = True; out.append(o2)  # sync-lag state
    return out


@router.get("/api/orders")
async def api_list_orders(status: str | None = None, ctx: dict = Depends(require_app_runtime_cap('read'))) -> JSONResponse:
    # tenant from the SESSION, never from the request (§the same rule /api/app/review follows).
    orders = await supa.order_list(status, tenant=ctx["tenant_slug"])
    orders = await _enrich_with_medusa(orders)
    return JSONResponse({"orders": orders})


@router.get("/api/orders/{order_id}")
async def api_get_order(order_id: str, ctx: dict = Depends(require_app_runtime_cap('read'))) -> JSONResponse:
    o = await supa.order_get(order_id, tenant=ctx["tenant_slug"])
    if not o:
        raise HTTPException(404, "no such order")
    (o,) = await _enrich_with_medusa([o])
    return JSONResponse(o)


@router.post("/internal/catalogue/upsert")
async def internal_catalogue_upsert(payload: dict, _: None = Depends(_require_subscriber)) -> JSONResponse:
    """Medusa product subscriber → upsert the derived catalogue_skus read-model (§3). Maps by
    sancho_sku_id when present (the seeded case → set the medusa ids); else inserts a Medusa-first row.
    Localhost-only + subscriber-token guarded."""
    sku_id = (payload.get("sancho_sku_id") or "").strip()
    vid = payload.get("medusa_variant_id")
    pid = payload.get("medusa_product_id")
    name = (payload.get("name") or "").strip()
    aliases = payload.get("aliases") or []
    code = payload.get("code")
    family = payload.get("family") or ""
    base_unit = payload.get("base_unit") or "kg"
    pack_factor = payload.get("pack_factor") or 1
    var = bool(payload.get("variable_weight", False))
    tenant = config.BRAIN_TENANT
    search_blob = " ".join([name] + [str(a) for a in aliases]).strip()
    import directory as _dir
    _dir.schedule_rebuild(tenant)   # debounced: the LAST upsert wins; distill runs once ingest settles (§6/H7)
    pool = supa.get_pool()
    async with pool.acquire() as con:
        if sku_id:
            row = await con.fetchrow(
                """update catalogue_skus set medusa_variant_id=$2, medusa_product_id=$3,
                       name=coalesce(nullif($4,''), name), family=coalesce(nullif($5,''), family),
                       search_text=to_tsvector('simple', $6)
                     where id=$1 and tenant_id=$7 returning id""",
                sku_id, vid, pid, name, family, search_blob, tenant)
            if row:
                return JSONResponse({"ok": True, "matched": "sku_id", "id": row["id"]})
        if vid:  # Medusa-first / unmatched → insert (embedding backfilled by a later refresh_seed)
            new_id = sku_id or f"mv-{vid}"
            await con.execute(
                """insert into catalogue_skus (id, tenant_id, code, name, family, base_unit, pack_factor,
                       variable_weight, in_assortment, medusa_variant_id, medusa_product_id, search_text, seeded)
                   values ($1,$2,$3,$4,$5,$6,$7,$8,true,$9,$10, to_tsvector('simple',$11), $12)
                   on conflict (id) do update set medusa_variant_id=excluded.medusa_variant_id,
                       medusa_product_id=excluded.medusa_product_id, name=excluded.name,
                       search_text=excluded.search_text""",
                new_id, tenant, code, name or new_id, family, base_unit, pack_factor, var,
                vid, pid, search_blob, bool(payload.get("seeded", False)))
            return JSONResponse({"ok": True, "matched": "inserted", "id": new_id})
    return JSONResponse({"ok": False, "reason": "no sku_id or variant_id"})


@router.post("/internal/catalogue/delete")
async def internal_catalogue_delete(payload: dict, _: None = Depends(_require_subscriber)) -> JSONResponse:
    vid = payload.get("medusa_variant_id")
    pid = payload.get("medusa_product_id")
    pool = supa.get_pool()
    async with pool.acquire() as con:
        if vid:
            await con.execute("update catalogue_skus set live_on_ecom=false, medusa_variant_id=null "
                              "where medusa_variant_id=$1", vid)
        elif pid:
            await con.execute("update catalogue_skus set live_on_ecom=false, medusa_variant_id=null "
                              "where medusa_product_id=$1", pid)
    return JSONResponse({"ok": True})


# ──────────────────────────── E-commerce catalogue + products (medusa-integration.md §3/§4) ────────────
# The REAL seeded read-model (catalogue_skus). No mocks: the same rows WhatsApp grounding matches against.
@router.get("/api/ecom/catalogue")
async def api_ecom_catalogue(ctx: dict = Depends(require_app_cap('read'))) -> JSONResponse:
    """The COMPANY-WIDE SKU master — every catalogue_skus row for the tenant (live or not). Shared by
    both WhatsApp grounding AND the e-commerce store-builder. id/code/name/family/base_unit/price/
    live_on_ecom/image_url/customizations/medusa_variant_id."""
    skus = await brain_catalogue.company_catalogue(tenant=ctx["tenant_slug"])
    return JSONResponse({"skus": _jsonsafe(skus)})


@router.get("/api/ecom/products")
async def api_ecom_products(ctx: dict = Depends(require_app_cap('read'))) -> JSONResponse:
    """The live storefront products (catalogue_skus where live_on_ecom=true) with image_url +
    customizations + the asap/out-of-hours envelope."""
    products = await brain_catalogue.ecom_products(tenant=ctx["tenant_slug"])
    return JSONResponse({"products": _jsonsafe(products)})


@router.post("/api/ecom/product/{sku_id}")
async def api_ecom_product_edit(sku_id: str, payload: dict,
                                ctx: dict = Depends(require_app_cap('act'))) -> JSONResponse:
    """Edit an e-commerce product: set any of live_on_ecom / image_url / customizations[] / asap_envelope.
    Persists to the real catalogue_skus row, flips seeded=false (operator edit survives a re-seed — the
    ProfileName rule), and writes through to Medusa product metadata via the outbox proxy (§3). Only keys
    present in the body are touched (partial update)."""
    payload = payload or {}
    allowed = ("live_on_ecom", "image_url", "customizations", "asap_envelope")
    patch = {k: payload[k] for k in allowed if k in payload}
    if not patch:
        raise HTTPException(400, f"nothing to update — supply one of {allowed}")
    if "customizations" in patch and not isinstance(patch["customizations"], list):
        raise HTTPException(400, "customizations must be a list")
    if "asap_envelope" in patch and not isinstance(patch["asap_envelope"], dict):
        raise HTTPException(400, "asap_envelope must be an object")
    updated = await brain_catalogue.edit_product(sku_id, patch, tenant=ctx["tenant_slug"])
    if updated is None:
        raise HTTPException(404, "no such sku")
    return JSONResponse(_jsonsafe(updated))


@router.get("/api/ecom/orders")
async def api_ecom_orders(status: str | None = None,
                          ctx: dict = Depends(require_app_runtime_cap('read'))) -> JSONResponse:
    """E-commerce-source orders — the storefront channel (basket → submit → outbox). Enriched with the
    Medusa order (two-source join, §4) once projected; the pre-approve ones served straight from the
    Rocoto projection. Never a hard error on a read."""
    orders = await supa.orders_storefront(status, tenant=ctx["tenant_slug"])
    orders = await _enrich_with_medusa(orders)
    return JSONResponse({"orders": _jsonsafe(orders)})


async def _maybe_dispatch_on_approve() -> None:
    """Cadence: a freshly-approved order can trigger an immediate / batched Excel send."""
    st = await _dispatch_settings()
    if st.get("mode") == "each_order":
        asyncio.create_task(_run_dispatch("each_order"))
    elif st.get("mode") == "every_n" \
            and await supa.order_count_since_dispatch() >= int(st.get("n") or 10):
        asyncio.create_task(_run_dispatch("every_n"))


@router.post("/api/orders/{order_id}/lines")
async def api_set_order_lines(order_id: str, payload: dict, ctx: dict = Depends(require_app_runtime_cap('act'))) -> JSONResponse:
    """Operator line edit — event-sourced (appends line_set, learns aliases/habits, re-projects)."""
    lines = payload.get("lines")
    if not isinstance(lines, list):
        raise HTTPException(400, "lines must be a list")
    o = await brain_events.edit_order(order_id, lines=lines, actor="operator")
    if not o:
        raise HTTPException(404, "no such order")
    return JSONResponse(o)


@router.post("/api/orders/{order_id}/edit")
async def api_edit_order(order_id: str, payload: dict, ctx: dict = Depends(require_app_runtime_cap('act'))) -> JSONResponse:
    """Rich operator edit: any of {lines, note, delivery_date, customer_name}. Event-sourced + learns."""
    lines = payload.get("lines")
    if lines is not None and not isinstance(lines, list):
        raise HTTPException(400, "lines must be a list")
    o = await brain_events.edit_order(
        order_id, lines=lines, note=payload.get("note"),
        delivery_date=payload.get("delivery_date"), customer_name=payload.get("customer_name"),
        actor=payload.get("actor", "operator"))
    if not o:
        raise HTTPException(404, "no such order")
    return JSONResponse(o)


@router.post("/api/orders/{order_id}/submit")
async def api_submit_order(order_id: str, payload: dict | None = None,
                           ctx: dict = Depends(require_app_runtime_cap('act'))) -> JSONResponse:
    """Hold-to-submit (Register #21): a deliberate commit -> status approved -> cadence dispatch.
    Every submit also triggers a profile-save job (the "always" scale / Customer DNA source)."""
    o = await brain_events.submit_order(order_id, actor=(payload or {}).get("actor", "operator"))
    if not o:
        raise HTTPException(404, "no such order")
    # Pedidos orders meter (spec §3): submit is the direct 'approved' transition on this path.
    try:
        await pedidos_meter.record_order(o.get("tenant_id") or ctx.get("tenant_slug") or config.BRAIN_TENANT,
                                         o["id"], o.get("status") or "approved")
    except Exception:
        log.exception("pedidos_meter record failed for submitted order %s (reconcile_loop will catch it up)",
                     order_id)
    await _maybe_dispatch_on_approve()
    _profile_after_submit(o)
    return JSONResponse(o)


def _profile_after_submit(order: dict) -> None:
    """On every order submit, refresh the customer profile (deterministic stats + Sonnet) in the
    background (Stage 5). The "always" scale + Customer DNA both read this."""
    if config.ORDER_BRAIN_ENABLED and order and order.get("phone_number"):
        asyncio.create_task(brain_profile.save_profile(order["phone_number"]))


@router.post("/api/orders/{order_id}/undo")
async def api_undo_order(order_id: str, payload: dict | None = None,
                         ctx: dict = Depends(require_app_runtime_cap('act'))) -> JSONResponse:
    """Undo window — revert the last operator action (invalidate-not-overwrite)."""
    o = await brain_events.undo_order(order_id, actor=(payload or {}).get("actor", "operator"))
    if not o:
        raise HTTPException(404, "no such order")
    return JSONResponse(o)


@router.get("/api/orders/{order_id}/events")
async def api_order_events(order_id: str, ctx: dict = Depends(require_app_runtime_cap('read'))) -> JSONResponse:
    """The audit trail (bi-temporal, invalidate-not-overwrite)."""
    return JSONResponse({"events": await brain_events.get_events(order_id)})


# FOUNDER-ONLY (2026-07-27): a debug surface that runs the real grounded pipeline against a real
# phone's history. Nothing we ship calls it; it was one leaked key away from being an oracle over
# any customer's conversation.
@router.post("/api/brain/run")
async def api_brain_run(payload: dict, _: dict = Depends(require_app_founder)) -> JSONResponse:
    """Run a message through the full grounded pipeline (5-scale read → synth+match → decision →
    keep-in-mind → tabular → personalise). The Stage-4/6 eval hook + a debug surface. persist=false
    by default (compute without saving); pass a seeded/real phone to use its history for context."""
    text = (payload.get("text") or "").strip()
    if not text:
        raise HTTPException(400, "text required")
    order = await brain_pipeline.run_message(
        text, phone=_norm(payload.get("phone", "") or "") or None,
        persist=bool(payload.get("persist", False)))
    return JSONResponse({"is_order": bool(order), "order": order})


@router.get("/api/customer/{phone}/profile")
async def api_customer_profile(phone: str, refresh: int = 0,
                              ctx: dict = Depends(require_app_runtime_cap('read'))) -> JSONResponse:
    """Customer DNA: the precomputed profile (stats + Sonnet narrative + per-day typical orders).
    Pass refresh=1 to recompute now (otherwise it's refreshed on every order submit)."""
    p = _norm(phone)
    if refresh:
        prof = await brain_profile.save_profile(p)
    else:
        prof = await brain_profile.get_profile(p)
        if prof is None:
            prof = await brain_profile.save_profile(p)  # first read computes it
    prof = prof or {}
    # the restaurant's location for the profile's light-mode map (reverse-phone enrichment; the
    # founder-hermes way). Empty {} when unknown — the app hides the map then.
    try:
        prof["location"] = await brain_enrich.enrich_location(p)
    except Exception:
        prof["location"] = {}
    return JSONResponse(prof)


@router.post("/api/customer/{phone}/autopilot")
async def api_customer_autopilot(phone: str, payload: dict, ctx: dict = Depends(require_app_runtime_cap('act'))) -> JSONResponse:
    """The per-customer autopilot switch — B6 (SPEC §5.5): a VIEW of the one mode field, not a
    `customer_profiles.autopilot` boolean of its own. Autopilot ON = auto, OFF = sombra. The profile
    column is kept in step so the profile read stays honest, but the MOUTH obeys `mode` alone."""
    import gate
    import runtime
    on = bool(payload.get("autopilot", payload.get("enabled", False)))
    sc = runtime.scope_of(_norm(phone))
    v = await gate.set_mode(sc, gate.AUTO if on else gate.SOMBRA)
    try:
        await brain_profile.set_autopilot(_norm(phone), on)   # the profile projection, not the truth
    except Exception:
        log.debug("autopilot profile mirror fail-soft", exc_info=True)
    return JSONResponse({"phone_number": _norm(phone), "scope": sc,
                         "autopilot": v["mode"] == gate.AUTO, **v})


@router.get("/api/customer/{phone}/orders")
async def api_customer_orders(phone: str, ctx: dict = Depends(require_app_runtime_cap('read'))) -> JSONResponse:
    """All of a customer's orders, split upcoming vs past — drives the profile's order history
    (and the per-customer calendar). Upcoming = future delivery or still in review/approved/preparing;
    past = delivered/sent or past delivery."""
    import datetime as _dt
    p = _norm(phone)
    pool = supa.get_pool()
    async with pool.acquire() as con:
        rows = await con.fetch(
            """select id, customer_name, status, lines, note, delivery_date, created_at,
                      dispatched_at, recurring, recurring_label
                 from orders where phone_number=$1 and tenant_id=$2 and status <> 'rejected'
                 order by coalesce(delivery_date, to_char(created_at,'YYYY-MM-DD')) desc, created_at desc
                 limit 200""", p, ctx["tenant_slug"])
    today = _dt.date.today().isoformat()
    upcoming, past = [], []
    for r in rows:
        o = dict(r)
        for k, v in list(o.items()):
            if hasattr(v, "isoformat"):
                o[k] = v.isoformat()
        dd = o.get("delivery_date")
        is_up = o["status"] in ("needs_review", "approved", "preparing") or (dd and dd >= today)
        (upcoming if is_up else past).append(o)
    return JSONResponse({"upcoming": upcoming, "past": past})


@router.post("/api/customer/{phone}/erp-code")
async def api_customer_erp_code(phone: str, payload: dict, ctx: dict = Depends(require_app_runtime_cap('act'))) -> JSONResponse:
    """WP-3 (their codes, dx F7): set/clear the customer's CLIENT code in the supplier's ERP —
    the `codigo_cliente` column of the daily Excel (resolved at dispatch). L2-style data: captured
    conversationally or on the app customer card, never a wizard step. Empty/absent code clears."""
    code = str(payload.get("erp_client_code", payload.get("code", "")) or "").strip()[:40]
    # the code is THIS supplier's filing of the customer, so it is written under their tenant
    saved = await supa.erp_code_set(_norm(phone), code or None, tenant=ctx.get("tenant_slug"))
    return JSONResponse({"phone_number": _norm(phone), "erp_client_code": saved})


# ── A SECOND NUMBER FOR AN EXISTING CUSTOMER (SPEC §6, the binding in trust order) ───────────────
# §6: "(a) the boss declares it in chat → the EMPLOYEE writes the binding itself as an identity-write
# action (L2 boss-authority) — logged, reversible; the primary path. (b) pre-seeded from the
# onboarding customer-list import. (c) the customer claims it → VERIFY via the recognition challenge.
# (d) ambiguous → ask the boss. Never auto-merge on a weak signal."
#
# These two endpoints are the SAME write the conversational path (a) uses — `brain/identity.link_phone`
# — reached from the app's customer card instead of from chat. There is exactly one writer, so a
# binding made by talking and a binding made by tapping are indistinguishable afterwards, and both
# leave the same `identity.phone_linked` event on the customer's own scope.
#
# `declared_by` records WHICH rung of the trust order authorised it, because the ladder is only worth
# anything if the answer survives: 'boss' (tapped it here / said it in chat), 'seed' (imported),
# 'challenge' (the customer claimed it and the recognition challenge passed). It is a claim ABOUT the
# authorisation, so the app may not choose 'challenge' — a challenge that did not run cannot have
# passed, and the only caller allowed to say so is the flow that ran it.
_LINK_REFUSAL_ES = {
    "bad_args": "Falta el número o el cliente.",
    "same_number": "Ese ya es el número principal de este cliente.",
    "no_owner": "Ese cliente no existe todavía en tu lista.",
    "owns_profile": "Ese número ya es un cliente por su cuenta — unir dos clientes es una decisión "
                    "tuya, no la hacemos solos.",
    "linked_elsewhere": "Ese número ya está vinculado a otro cliente.",
}


@router.get("/api/customer/{phone}/numbers")
async def api_customer_numbers(phone: str, ctx: dict = Depends(require_app_runtime_cap('read'))) -> JSONResponse:
    """Every number that reaches THIS customer: the primary + the linked ones (staff, a second site).
    Reads exactly what `brain/identity.resolve` reads, so the screen and the employee agree."""
    from brain import identity as brain_identity
    p, tenant = _norm(phone), (ctx.get("tenant_slug") or config.BRAIN_TENANT)
    role = await brain_identity.customer_role(p, tenant=tenant)
    resolved = await brain_identity.resolve(p, tenant=tenant)
    return JSONResponse({"phone_number": p, "display_name": role.get("display_name") or "",
                         "known": bool(role.get("known")), "seeded": bool(role.get("seeded")),
                         "primary": role.get("owner_phone") or p,
                         "linked": resolved.get("linked_phones") or [], "tier": role.get("tier") or ""})


@router.post("/api/customer/{phone}/numbers")
async def api_customer_numbers_add(phone: str, payload: dict,
                                   ctx: dict = Depends(require_app_runtime_cap('act'))) -> JSONResponse:
    """The boss declares a second number for this customer → the identity write (rung (a)/(b)).
    409 + an es-ES reason on every refusal; a merge is never done silently."""
    from brain import identity as brain_identity
    number = str(payload.get("number") or payload.get("phone") or "").strip()
    if not number:
        raise HTTPException(400, "falta el número")
    declared = str(payload.get("declared_by") or "boss").strip().lower()
    if declared not in ("boss", "seed"):
        declared = "boss"
    res = await brain_identity.link_phone(_norm(phone), _norm(number),
                                          tenant=(ctx.get("tenant_slug") or config.BRAIN_TENANT),
                                          declared_by=declared, source="app")
    if not res.get("ok"):
        return JSONResponse({**res, "message": _LINK_REFUSAL_ES.get(res.get("reason", ""),
                                                                    "No se pudo vincular el número.")},
                            status_code=409)
    return JSONResponse(res)


@router.delete("/api/customer/{phone}/numbers/{number}")
async def api_customer_numbers_remove(phone: str, number: str,
                                      ctx: dict = Depends(require_app_runtime_cap('act'))) -> JSONResponse:
    """Undo a binding — the reversibility §6 requires of the boss-declares path."""
    from brain import identity as brain_identity
    res = await brain_identity.unlink_phone(_norm(phone), _norm(number),
                                            tenant=(ctx.get("tenant_slug") or config.BRAIN_TENANT),
                                            source="app")
    if not res.get("ok"):
        return JSONResponse({**res, "message": _LINK_REFUSAL_ES.get(res.get("reason", ""),
                                                                    "No se pudo desvincular el número.")},
                            status_code=409)
    return JSONResponse(res)


@router.get("/api/customer/{phone}/dossier")
async def api_customer_dossier(phone: str, ctx: dict = Depends(require_app_runtime_cap('read'))) -> JSONResponse:
    """Track 4b — the APP's customer profile CARD: the kernel's ficha CARD + bi-temporal FACTS + open
    TABS for this customer's scope (NO event summaries — MVP-DEFINITION). A leaner, Bearer-authed sibling
    of the desktop Control Room drill. Reuses runtime.scope_of (wa.<digits>) as the phone→scope bridge."""
    import control_room
    import runtime
    card = await control_room.customer_card(runtime.scope_of(phone))
    # WP-3 (dx F7): the dossier carries the customer's ERP client code so the app card can show/edit it.
    try:
        card["erp_client_code"] = await supa.erp_code_get(_norm(phone), tenant=ctx.get("tenant_slug"))
    except Exception:
        card["erp_client_code"] = None
    return JSONResponse(card)


# ──────────────────── Scheduled tasks + recommendations (employee goal-layer) ────────────────────


# The Android app uses the roster employee id ("storefront"); the backend task registry + metrics use
# the short employee id ("ecom"). Bridge the two conventions at the agent endpoints.
_AGENT_ALIAS = {"storefront": "ecom"}


def _agent(agent: str) -> str:
    return _AGENT_ALIAS.get(agent, agent)


@router.get("/api/agent/{agent}/tasks")
async def api_agent_tasks(agent: str, ctx: dict = Depends(require_app_runtime_cap('read'))) -> JSONResponse:
    return JSONResponse({"tasks": _jsonsafe(await brain_tasks.get_tasks(_agent(agent)))})


@router.post("/api/agent/{agent}/tasks")
async def api_agent_tasks_set(agent: str, payload: dict, ctx: dict = Depends(require_app_runtime_cap('act'))) -> JSONResponse:
    tk = payload.get("task_key")
    if not tk:
        raise HTTPException(400, "task_key required")
    row = await brain_tasks.set_task(tk, enabled=payload.get("enabled"), cadence=payload.get("cadence"))
    if not row:
        raise HTTPException(404, "no such task")
    return JSONResponse(_jsonsafe(row))


@router.post("/api/agent/{agent}/task/{task_key}/run")
async def api_agent_task_run(agent: str, task_key: str, ctx: dict = Depends(require_app_runtime_cap('act'))) -> JSONResponse:
    return JSONResponse(_jsonsafe(await brain_tasks.run_task(task_key, force=True, source="manual")))


@router.get("/api/agent/{agent}/recommendations")
async def api_agent_recommendations(agent: str, status: str = "open",
                                    ctx: dict = Depends(require_app_runtime_cap('read'))) -> JSONResponse:
    return JSONResponse({"recommendations": _jsonsafe(await brain_tasks.list_recommendations(_agent(agent), status=status))})


@router.post("/api/agent/recommendation/{rec_id}/accept")
async def api_rec_accept(rec_id: str, ctx: dict = Depends(require_app_runtime_cap('act'))) -> JSONResponse:
    r = await brain_tasks.accept_recommendation(rec_id)
    if not r:
        raise HTTPException(404, "no such recommendation")
    return JSONResponse(_jsonsafe(r))


@router.post("/api/agent/recommendation/{rec_id}/dismiss")
async def api_rec_dismiss(rec_id: str, ctx: dict = Depends(require_app_runtime_cap('act'))) -> JSONResponse:
    r = await brain_tasks.dismiss_recommendation(rec_id)
    if not r:
        raise HTTPException(404, "no such recommendation or already decided")
    return JSONResponse(_jsonsafe(r))


@router.post("/api/admin/autoaccept/run")
async def api_autoaccept_run(ctx: dict = Depends(require_app_founder)) -> JSONResponse:
    """Run the auto-accept sweep on demand (the systemd timer runs it on a Madrid-tz schedule)."""
    return JSONResponse(_jsonsafe(await brain_autoaccept.run()))


@router.get("/api/agent/{agent}/metrics")
async def api_agent_metrics(agent: str, ctx: dict = Depends(require_app_runtime_cap('read'))) -> JSONResponse:
    """The console goal hero + ops band (employee-goals.md) — real recommendation/rule counts +
    the demo business's seeded baseline figures, computed defensively (never a 500)."""
    return JSONResponse(_jsonsafe(await brain_metrics.agent_metrics(agent)))


@router.get("/api/agent/deliveries/route")
async def api_deliveries_route(ctx: dict = Depends(require_app_runtime_cap('read'))) -> JSONResponse:
    """The optimized delivery round (deliveries.md) — sequence + km/time + the saving vs the naive
    order. Pure-Python NN+2-opt (deterministic); VROOM+OSRM is the optional flagged upgrade."""
    return JSONResponse(brain_route.optimize())


@router.get("/api/conversation/{phone}/baskets")
async def api_conversation_baskets(phone: str, ctx: dict = Depends(require_app_runtime_cap('read'))) -> JSONResponse:
    """Pending custom-order baskets for a conversation — drives the in-chat BasketRequestCard."""
    return JSONResponse({"baskets": _jsonsafe(await brain_baskets.list_for_phone(_norm(phone)))})


# Lightweight in-memory rate limiter for the public shop endpoints (no slowapi dep). Per-key sliding
# window; keys are the client IP and the canonical phone. Caps abuse + thread-spoof amplification.
_SHOP_HITS: dict[str, list[float]] = {}


def _shop_rate_ok(key: str, *, limit: int, window_s: float) -> bool:
    now = time.time()
    hits = [t for t in _SHOP_HITS.get(key, ()) if now - t < window_s]
    if len(hits) >= limit:
        _SHOP_HITS[key] = hits
        return False
    hits.append(now)
    _SHOP_HITS[key] = hits
    if len(_SHOP_HITS) > 5000:  # bound memory
        for k in list(_SHOP_HITS)[:1000]:
            _SHOP_HITS.pop(k, None)
    return True


@router.post("/api/shop/basket")
async def api_shop_basket_create(payload: dict, request: Request) -> JSONResponse:
    """PUBLIC (customer-facing) — the storefront custom-order submit creates a draft basket that lands in
    the supplier's WhatsApp conversation. No operator key (it's the shop), so it is rate-limited + the
    phone MUST be a valid E.164 (no raw fallback) so a basket can't be spoofed into a victim's thread."""
    if not config.SHOP_ENABLED:
        raise HTTPException(503, "shop disabled")
    payload = payload or {}
    ip = (request.client.host if request.client else "") or "unknown"
    if not _shop_rate_ok(f"ip:{ip}", limit=20, window_s=300):
        raise HTTPException(429, "too many requests")
    raw_phone = (payload.get("phone") or "").strip()
    if not raw_phone:
        raise HTTPException(400, "phone required")
    # require a VALID, fully-parsed E.164 — reject canon()'s raw fallback so an attacker can't drop a
    # basket onto an arbitrary number's conversation thread with attacker-controlled name/note.
    if not _is_valid_phone(raw_phone):
        raise HTTPException(400, "a valid phone number is required")
    phone = canon(raw_phone)
    if not _shop_rate_ok(f"phone:{phone}", limit=5, window_s=3600):
        raise HTTPException(429, "too many requests for this number")
    # OTP gate: when Twilio Verify is configured, the customer must prove they own this number (closes
    # the thread-spoofing hole). If OTP is not configured, the E.164 + rate-limit are the guard.
    # phone_verified is True ONLY when a real OTP check passed — it gates outbound paid SMS (notify.py).
    phone_verified = False
    if brain_otp.configured():
        code = (payload.get("code") or "").strip()
        if not code or not await brain_otp.check(phone, code):
            raise HTTPException(401, "phone not verified — request a code first")
        phone_verified = True
    lines = payload.get("lines") or []
    if not isinstance(lines, list) or any(not isinstance(line, dict) for line in lines):
        raise HTTPException(400, "lines must be a list of objects")
    note = (payload.get("custom_note") or "").strip()
    if not note and not lines:
        raise HTTPException(400, "an order or a custom note is required")
    b = await brain_baskets.create(
        phone=phone, customer_name=(payload.get("customer_name") or "").strip(),
        lines=lines, custom_note=note, total=payload.get("total"),
        phone_verified=phone_verified)
    return JSONResponse(_jsonsafe(b))


@router.post("/api/shop/otp/send")
async def api_shop_otp_send(payload: dict, request: Request) -> JSONResponse:
    """PUBLIC — start a Twilio Verify code to the customer's phone (the storefront 2-step capture)."""
    if not config.SHOP_ENABLED:
        raise HTTPException(503, "shop disabled")
    payload = payload or {}
    ip = (request.client.host if request.client else "") or "unknown"
    if not _shop_rate_ok(f"otp-ip:{ip}", limit=15, window_s=600):
        raise HTTPException(429, "too many requests")
    raw_phone = (payload.get("phone") or "").strip()
    if not _is_valid_phone(raw_phone):
        raise HTTPException(400, "a valid phone number is required")
    phone = canon(raw_phone)
    if not _shop_rate_ok(f"otp-phone:{phone}", limit=5, window_s=3600):
        raise HTTPException(429, "too many code requests for this number")
    if not brain_otp.configured():
        return JSONResponse({"sent": False, "otp_required": False})  # OTP off → composer skips the step
    res = await brain_otp.send(phone, channel=(payload.get("channel") or "sms"))
    return JSONResponse({"sent": bool(res.get("sent")), "otp_required": True})


# ── Tenant directory (PUBLIC — the customer-facing marketplace home reads these) ──
@router.get("/api/shop/directory")
async def api_shop_directory() -> JSONResponse:
    """The store directory: every real test/live supplier shop (name, location, hours, sales channel,
    `accepting`). No secrets, no key — it's the public marketplace home."""
    if not config.SHOP_ENABLED:
        raise HTTPException(503, "shop disabled")
    return JSONResponse(_jsonsafe({"tenants": await brain_tenants.list_public()}))


# Provisioning (operator/admin): write a tenant row into the registry. The onboard-tenant path calls
# this with the Medusa ids it just minted. Column whitelist guards the dynamic upsert.
_TENANT_COLS = {
    "name", "tagline", "status", "seeded", "address", "city", "region", "country", "lat", "lng",
    "hours_open", "hours_close", "hero_image", "medusa_publishable_key", "medusa_sales_channel_id",
    "medusa_region_id", "medusa_stock_location_id", "currency_code", "plan",
    "about", "allergens", "delivery_info",
}


# FOUNDER-ONLY (2026-07-27): this writes ANY tenant's registry row by client-supplied slug —
# identity, Medusa scoping ids, plan. Key-gated it meant an APK holder could rewrite another
# distributor's shop. No shipped caller; the CR is where a tenant is edited.
@router.post("/api/shop/admin/tenant")
async def api_admin_tenant(payload: dict, _: dict = Depends(require_app_founder)) -> JSONResponse:
    payload = payload or {}
    slug = (payload.get("slug") or "").strip()
    if not slug:
        raise HTTPException(400, "slug required")
    fields = {k: v for k, v in payload.items() if k in _TENANT_COLS and v is not None}
    await brain_tenants.upsert(slug, **fields)
    return JSONResponse({"ok": True, "slug": slug, "wrote": sorted(fields.keys())})


@router.get("/api/shop/tenant/{slug}")
async def api_shop_tenant(slug: str) -> JSONResponse:
    """One shop's public storefront scoping config (Medusa publishable key + region + sales channel, all
    public by nature). The storefront resolves a vendor route → this → scopes its catalogue/cart."""
    if not config.SHOP_ENABLED:
        raise HTTPException(503, "shop disabled")
    cfg = await brain_tenants.get_public_config(slug)
    if not cfg:
        raise HTTPException(404, "no such shop")
    return JSONResponse(_jsonsafe(cfg))


# ── Operator teams (founder settings: which team am I operating as) ──
async def _operator_id_for(ctx: dict) -> str:
    """The CALLER'S operator row id, resolved from the verified email — never `brain_teams.FOUNDER_ID`.
    Both routes below used to act as `op_peter` whoever asked (harmless while the key was the only
    caller and Peter the only holder; a team-list leak and an act-as-founder write the moment the rail
    became per-user). Falls back to the founder id ONLY for the founder himself."""
    email = (ctx.get("email") or "").strip().lower()
    if email:
        async with supa.get_pool().acquire() as con:
            oid = await con.fetchval("select id from operators where lower(email) = $1", email)
        if oid:
            return oid
    if ctx.get("is_founder"):
        return brain_teams.FOUNDER_ID
    raise HTTPException(403, "no_operator_row")


@router.get("/api/teams")
async def api_teams(ctx: dict = Depends(require_app_runtime_cap('read'))) -> JSONResponse:
    """The teams THIS operator can switch between + the active one — their own memberships, never the
    whole tenant registry."""
    return JSONResponse(_jsonsafe(await brain_teams.list_for(await _operator_id_for(ctx))))


@router.post("/api/teams/active")
async def api_teams_active(payload: dict, ctx: dict = Depends(require_app_runtime_cap('admin'))) -> JSONResponse:
    """Switch THIS operator's active team. `set_active` already refuses a team they are not a member
    of; the fix here is that "they" is now the caller and not, unconditionally, the founder."""
    slug = ((payload or {}).get("slug") or "").strip()
    if not slug:
        raise HTTPException(400, "slug required")
    r = await brain_teams.set_active(await _operator_id_for(ctx), slug)
    if not r.get("ok"):
        raise HTTPException(400, r.get("reason") or "could_not_switch")
    return JSONResponse(_jsonsafe(r))


# ── Stripe Connect onboarding (operator-side; surfaced in the Android E-commerce tab, redoable) ──
# THE ONE DUAL ROUTE OUTSIDE /media, and it says so: `GET /api/shop/connect/status` is called by the
# phone (ApiClient.connectStatus) AND, server-side, by the Medusa storefront's `lib/tenant.ts`, which
# legitimately asks about a shop that is not "its own" (it renders a directory). So:
#   · a per-user BEARER is the default path — `tenant` is taken from the SESSION and any `?tenant=`
#     the client spelled out is IGNORED, because a client-named tenant is the hole wearing a hat;
#   · the machine KEY still works, and only there does `?tenant=` mean anything — that is a server we
#     run talking to a server we run, with no user behind it.
# `POST /connect/onboard` (mints a payout-onboarding link) and `POST /connect/session` are NOT dual:
# onboard is bearer-only and self-tenant; session is machine-only (the storefront's embedded flow).
@router.get("/api/shop/connect/status")
async def api_connect_status(tenant: str | None = None,
                             authorization: str = Header(default="")) -> JSONResponse:
    if _has_machine_key(authorization):
        return JSONResponse(_jsonsafe(await brain_stripe.status(tenant=tenant)))
    ctx = await _app_ctx(authorization)
    if not brain_auth.app_can(ctx.get("role", ""), "read"):
        raise HTTPException(403, "cap_required:read")
    return JSONResponse(_jsonsafe(await brain_stripe.status(tenant=ctx["tenant_slug"])))


@router.post("/api/shop/connect/onboard")
async def api_connect_onboard(payload: dict | None = None, ctx: dict = Depends(require_app_cap('admin'))) -> JSONResponse:
    """Mint a (redoable) Stripe Connect onboarding link for the supplier's payout account.
    TENANT COMES FROM THE SESSION. A `tenant` in the body is ignored: minting an onboarding link for
    somebody else's payout account is the worst thing on this rail, and it used to be one key away."""
    payload = payload or {}
    r = await brain_stripe.onboarding_link(
        base_url=config.STOREFRONT_URL, email=(payload.get("email") or ""), tenant=ctx["tenant_slug"])
    if not r.get("ok"):
        raise HTTPException(503, f"stripe connect unavailable: {r.get('reason')}")
    return JSONResponse(_jsonsafe(r))


@router.post("/api/shop/connect/session")
async def api_connect_session(payload: dict | None = None, _: None = Depends(require_key)) -> JSONResponse:
    """Mint a Stripe Account Session for the EMBEDDED onboarding components — the supplier onboards/manages
    their payout account fully inside our app (the /connect page in an Android Custom Tab), in Spanish.

    MACHINE-ONLY, deliberately: the only caller is the storefront's own server route
    (`medusa/storefront/app/api/connect-session/route.ts`), which holds the key server-side and never
    exposes it to a browser. No phone calls this — the phone calls /connect/onboard."""
    payload = payload or {}
    r = await brain_stripe.account_session(email=(payload.get("email") or ""), tenant=payload.get("tenant"))
    if not r.get("ok"):
        raise HTTPException(503, f"stripe connect unavailable: {r.get('reason')}")
    return JSONResponse(_jsonsafe(r))


# NOTE: the storefront card charge is minted by the custom MEDUSA provider (pp_stripe-connect_stripe-connect),
# native to the cart→payment-session→complete flow — NOT here. The old /api/shop/pay/intent (a parallel
# FastAPI mint with a charge-to-platform fallback and no Medusa order behind it) was removed to keep ONE
# payment path. brain_stripe now owns onboarding/status only.


# ── Stripe SUBSCRIPTIONS (OUR SaaS billing of the supplier for their AI employees; brain/stripe_subs.py) ──
# DISTINCT from the Connect routes above: those onboard the supplier's payout account; these bill the
# supplier a monthly/annual subscription per employee (Marco tiered, Hugo €99/€49, Carmen = a 0.3% enable).
# TEST MODE: brain_subs reads STRIPE_SUBS_SECRET_KEY (the *_TEST key). Keys stay server-side.
# TENANT COMES FROM THE SESSION (2026-07-27). These routes used to take a client-supplied `tenant`
# behind the shared machine key — i.e. an APK holder could read, checkout, portal-manage or flip the
# 0,3% enable on ANY tenant's billing. Nothing we ship calls them machine-side, so they are now
# bearer-only and self-tenant; a `tenant` in the body/query is ignored, never honoured.
@router.get("/api/subs/status")
async def api_subs_status(ctx: dict = Depends(require_app_cap('read'))) -> JSONResponse:
    """Which employees the supplier is currently subscribed to (live read of Stripe subscriptions) +
    Carmen's 0.3% enabled flag. Always returns a per-employee roster the app renders directly."""
    return JSONResponse(_jsonsafe(await brain_subs.subscription_status(tenant=ctx["tenant_slug"])))


@router.post("/api/subs/checkout")
async def api_subs_checkout(payload: dict, ctx: dict = Depends(require_app_cap('admin'))) -> JSONResponse:
    """Mint a Stripe Checkout Session (subscription mode) for {price_key} → returns the hosted url."""
    price_key = (payload or {}).get("price_key") or ""
    if not price_key:
        raise HTTPException(400, "price_key required")
    r = await brain_subs.create_checkout_session(ctx["tenant_slug"], price_key)
    if not r.get("ok"):
        raise HTTPException(503, f"subs checkout unavailable: {r.get('reason')}")
    return JSONResponse(_jsonsafe(r))


@router.post("/api/subs/portal")
async def api_subs_portal(payload: dict | None = None, ctx: dict = Depends(require_app_cap('admin'))) -> JSONResponse:
    """Mint a Stripe Billing Portal session (manage/upgrade/cancel) → returns the url."""
    r = await brain_subs.create_billing_portal(tenant=ctx["tenant_slug"])
    if not r.get("ok"):
        raise HTTPException(503, f"subs portal unavailable: {r.get('reason')}")
    return JSONResponse(_jsonsafe(r))


@router.post("/api/subs/ecommerce")
async def api_subs_ecommerce(payload: dict, ctx: dict = Depends(require_app_cap('admin'))) -> JSONResponse:
    """Toggle Carmen's (storefront) 0.3% application-fee enable — a persisted flag with a one-month
    lock-in, NOT a Stripe subscription. {enabled: bool}."""
    enabled = bool((payload or {}).get("enabled"))
    r = await brain_subs.set_ecommerce_enabled(ctx["tenant_slug"], enabled)
    return JSONResponse(_jsonsafe(r))


@router.post("/api/subs/webhook")
async def api_subs_webhook(request: Request) -> JSONResponse:
    """Stripe webhook for subscription lifecycle. Verifies the signature with STRIPE_SUBS_WEBHOOK_SECRET
    (the *_TEST secret in test mode). On subscription created/updated/deleted we no-op-sync — the live
    status route reads subscriptions straight from Stripe, so there's nothing to persist; we just ack 200
    so Stripe stops retrying. The raw body + signature are required for verification (never trust unsigned)."""
    raw = await request.body()
    sig = request.headers.get("Stripe-Signature", "")
    secret = getattr(config, "STRIPE_SUBS_WEBHOOK_SECRET", "")
    if not secret:
        # No secret configured → refuse to process unsigned events (never act on an unverifiable webhook).
        raise HTTPException(503, "subs webhook secret unset")
    try:
        import stripe
        event = stripe.Webhook.construct_event(raw, sig, secret)
    except Exception as e:  # ValueError (bad payload) or SignatureVerificationError
        log.warning("subs webhook signature verify failed: %s", e)
        raise HTTPException(400, "bad signature")
    etype = event.get("type", "")
    if etype.startswith("customer.subscription.") or etype.startswith("checkout.session."):
        # no-op-sync: status route reads live. Log for observability.
        log.info("subs webhook: %s", etype)
    return JSONResponse({"ok": True, "received": etype})


# ── Rocoto PEDIDOS billing (PEDIDOS-PRICING-BUILD.md §2/§3/§5) — the S/M/L/XL band subscriptions,
# distinct from BOTH the blocks above: setupfee is the €50/500€ onboarding alta (BRAIN_TENANT only);
# stripe_subs bills Sancho's per-employee add-ons (BRAIN_TENANT only); THIS is Pedidos' whole-plan
# subscription and is genuinely MULTI-TENANT — tenant comes from the session (ctx["tenant_slug"]),
# never a client-supplied field, same rule the subs block above documents.
#
# AUTH (shared contract 1, PEDIDOS-PRICING-BUILD.md): the demo wall and the /billing screen both
# authenticate with the desk's `sup_session` COOKIE, never the app rail's Supabase bearer — so gating
# these three routes on `require_app_cap('admin')` alone left the Checkout button with no caller that
# could ever reach it. Same two-door shape as `_intake_gate` above (ONE road, TWO doors, reusing
# `sup_api.require_sup`'s own CSRF discipline rather than minting a third auth mechanism).
#
# ⚠️ THE COOKIE DOOR CHECKS THE `admin` CAP, NOT THE LITERAL STRING 'owner' (fixed 2026-08-12).
# It used to read `if (ctx.get("role") or "") != "owner": 403 owner_required`, with a comment
# arguing that billing should be "the named owner's call, not any admin-capable staff account's".
# The intent was right and the implementation did something else: `founder` is a REAL role in
# `sup_session.ROLE_CAPS`, carries the identical capability set to `owner`, and is what
# `provisioning.resume_or_provision` hands back for any operator flagged `is_founder` — so the one
# account most likely to click Empezar got a 403 on `/api/pedidos/checkout` and no screen could
# explain why (Peter, 2026-08-12: «also got an issue: /api/pedidos/checkout:1 Failed to load
# resource: the server responded with a status of 403»).
#
# A raw string compare against one role is exactly the bug the capability table exists to prevent:
# it has to be re-audited every time a role is added, and it was not. `sup_session.can(role,
# 'admin')` keeps the intent — owner and founder in, `staff` and `repartidor` out, unknown roles
# denied everything by DENY_ALL — and it cannot silently miss the next role somebody adds.
# The tenant is ALWAYS the resolved session's; a client-supplied tenant is never read on either door.
async def _pedidos_billing_gate(request: Request, response: Response,
                                authorization: str = Header(default="")) -> dict:
    if _bearer(authorization):
        ctx = await require_app_user(authorization=authorization)
        if not brain_auth.app_can(ctx.get("role", ""), "admin"):
            raise HTTPException(403, "cap_required:admin")
        return {"tenant_slug": ctx.get("tenant_slug") or config.BRAIN_TENANT,
                "email": ctx.get("email") or ""}
    import sup_api
    import sup_session
    ctx = await sup_api.require_sup(request, response)      # verifies the cookie AND the CSRF token
    if not sup_session.can(ctx.get("role") or "", "admin"):
        raise HTTPException(403, "owner_required")
    return {"tenant_slug": ctx.get("tenant_slug") or config.BRAIN_TENANT,
            "email": ctx.get("actor_email") or ctx.get("email") or ""}


# `GET /api/pedidos/usage` is a READ (shared contract 1, PEDIDOS-PRICING-BUILD.md): any signed-in
# session of the tenant — staff included, not just 'owner'/'admin' — may call it. It is the SAME
# two-door shape as `_pedidos_billing_gate` above (bearer OR sup_session cookie, tenant always
# resolved from the session, never client-supplied) with the role/cap check dropped, because a cap
# check is exactly what turned this read into a 403 for every non-owner caller of the webapp's usage
# hook. GET carries no CSRF token by construction, and `sup_api.require_sup` only enforces the
# double-submit check on unsafe methods (POST/PUT/PATCH/DELETE) — so this stays safe without one.
async def _pedidos_usage_gate(request: Request, response: Response,
                              authorization: str = Header(default="")) -> dict:
    if _bearer(authorization):
        ctx = await require_app_user(authorization=authorization)
        return {"tenant_slug": ctx.get("tenant_slug") or config.BRAIN_TENANT,
                "email": ctx.get("email") or ""}
    import sup_api
    ctx = await sup_api.require_sup(request, response)      # verifies the cookie; no role gate
    return {"tenant_slug": ctx.get("tenant_slug") or config.BRAIN_TENANT,
            "email": ctx.get("actor_email") or ctx.get("email") or ""}


async def _pedidos_plan_for(tenant_slug: str) -> str | None:
    """Shared contract 3's `plan` ('pedidos' | 'empresa' | null). Empresa has no Stripe subscription
    of its own (spec §4: price is *Hablemos.*, never a number — it's a quoted contract), so it cannot
    be read off `pedidos_subscription` (that table is the S/M/L/XL band checkout, one row per tenant,
    and an Empresa tenant may never appear there). The signal is `tenants.plan` — a column that
    already existed as db.py's own "forward hook for per-team pricing", now given its first real use
    (schema_runtime.sql, tenants_plan_chk). An operator sets it by hand (SQL below; no Control Room
    action exists yet — flag that if one is wanted): `update tenants set plan='empresa' where
    slug=$1`. Checked FIRST because it's the stronger, explicitly-set signal; falls back to the
    S/M/L/XL active-subscription check for 'pedidos'; null when neither applies."""
    async with supa.get_pool().acquire() as con:
        row = await con.fetchrow(
            "select t.plan as tenant_plan, ps.status as sub_status "
            "from tenants t left join pedidos_subscription ps on ps.tenant_id = t.slug "
            "where t.slug = $1", tenant_slug)
    if row and row["tenant_plan"] == "empresa":
        return "empresa"
    if row and row["sub_status"] == "active":
        return "pedidos"
    return None


@router.post("/api/pedidos/checkout")
async def api_pedidos_checkout(payload: dict, ctx: dict = Depends(_pedidos_billing_gate)) -> JSONResponse:
    """Mint a Checkout Session for the whole configuration → {ok, url}.

    The body is {band, cadence, modules, vans, bundle} — the same five answers /precios and /plan
    put on screen, so what Stripe charges is what the summary totalled. band ∈ peq|med|gra
    (case-insensitive; the retired s|m|l|xl still resolve for a tenant already on one), cadence is
    `mensual`, `modules` is the Compras/Reparto/Radar selection, `vans` the number of furgonetas,
    and `bundle` the prepaid bolsa in pedidos. The signed-in operator's email is the default
    `operator_email` (the account the 80%/ceiling usage emails go to) unless the body overrides
    it."""
    band = (payload or {}).get("band") or ""
    cadence = (payload or {}).get("cadence") or "mensual"
    operator_email = (payload or {}).get("operator_email") or ctx.get("email") or ""
    # The Compras/Reparto/Radar selection, forwarded onto the subscription's Stripe metadata.
    # `_on_invoice_created` reads `radar` off that subscription to decide whether this month's
    # invoice carries the 15 %, and it has no other way to know: the handler is given a Stripe object
    # and nothing else. Unknown ids are dropped by `module_metadata`, so this stays a closed list.
    modules = (payload or {}).get("modules")
    # HOW MANY FURGONETAS, because Reparto is the one module priced per unit. Clamped here rather
    # than trusted: this is a number from a browser, and it becomes a Stripe line-item quantity.
    try:
        vans = max(0, min(int((payload or {}).get("vans") or 0), 500))
    except (TypeError, ValueError):
        vans = 0
    # THE PREPAID BOLSA, IN PEDIDOS — the bag /precios quoted and sent here in `?bundle=`. It is a
    # one-off line on the same Checkout, so it has to travel with it: quoted and never charged is
    # what this endpoint did until 2026-08-16. Read as an integer and nothing more; the SIZE is
    # validated against `BUNDLE_SIZES` in the billing module, which is where the catalogue's own
    # sizes live and where a miss can fail closed next to every other price.
    try:
        bundle = max(0, int((payload or {}).get("bundle") or 0))
    except (TypeError, ValueError):
        bundle = 0
    r = await brain_pedidos_billing.create_checkout_session(ctx["tenant_slug"], band, cadence,
                                                            operator_email, modules, vans, bundle)
    if not r.get("ok"):
        # `reparto_needs_vans` is the visitor's mistake, not ours — they ticked Reparto without
        # saying how many vans — so it answers 400 with the rest of the bad-input family rather
        # than 503, which would read as «our fault, try later» for something only they can fix.
        # `bad_bundle` joins it (a bolsa size nobody sells), and so does `anual_not_sellable`: a
        # seat band is sold by the month, so an annual request is an ask we do not serve rather
        # than a service that is down.
        raise HTTPException(400 if r.get("reason") in ("bad_band", "bad_cadence", "already_subscribed",
                                                        "reparto_needs_vans", "bad_bundle",
                                                        "anual_not_sellable")
                            else 503, f"pedidos checkout unavailable: {r.get('reason')}")
    return JSONResponse(_jsonsafe(r))


@router.post("/api/pedidos/portal")
async def api_pedidos_portal(ctx: dict = Depends(_pedidos_billing_gate)) -> JSONResponse:
    """Mint a Stripe Billing Portal session (cards + cancellation, price-switching OFF) → {ok, url}."""
    r = await brain_pedidos_billing.billing_portal_url(ctx["tenant_slug"])
    if not r.get("ok"):
        raise HTTPException(503, f"pedidos portal unavailable: {r.get('reason')}")
    return JSONResponse(_jsonsafe(r))


@router.get("/api/pedidos/usage")
async def api_pedidos_usage(ctx: dict = Depends(_pedidos_usage_gate)) -> JSONResponse:
    """This tenant's current-month orders meter (spec §3) — {tenant_id, period, band, used, ceiling,
    pct, warn, over, plan}. `warn` flips at 80% of the ceiling, `over` past it (never auto-charged —
    spec §5). `plan` is 'pedidos' | 'empresa' | null (shared contract 3) — see `_pedidos_plan_for`.
    The `/billing` screen's usage bar and every upgrade prompt read this. READ-only (shared contract
    1): gated by `_pedidos_usage_gate`, not `_pedidos_billing_gate` — any signed-in session of the
    tenant, staff included, not owner-only."""
    usage = await pedidos_meter.usage_for(ctx["tenant_slug"])
    usage["plan"] = await _pedidos_plan_for(ctx["tenant_slug"])
    return JSONResponse(_jsonsafe(usage))


@router.post("/api/shop/basket/{basket_id}/accept")
async def api_basket_accept(basket_id: str, payload: dict = None,
                            ctx: dict = Depends(require_app_runtime_cap('act'))) -> JSONResponse:
    """Accept a basket → converts the draft to a placed order (outbox/submit) + returns the warm pay-link.

    The client sends `expected_version` (the version it rendered): if a mid-chat edit bumped the basket
    since, accept returns 409 with the FRESH basket so the operator re-confirms the new total (the
    "card updates as they chat" money-bug guard)."""
    expected_version = (payload or {}).get("expected_version")
    try:
        expected_version = int(expected_version) if expected_version is not None else None
    except (TypeError, ValueError):
        expected_version = None
    r = await brain_baskets.accept(basket_id, expected_version=expected_version)
    if not r:
        raise HTTPException(404, "no such basket or already decided")
    if isinstance(r, dict) and r.get("conflict"):
        # the basket changed under the operator — 409 + the fresh row to re-render
        return JSONResponse(_jsonsafe(r), status_code=409)
    return JSONResponse(_jsonsafe(r))


@router.get("/api/shop/basket/{basket_id}/view")
async def api_basket_view(basket_id: str, request: Request) -> JSONResponse:
    """PUBLIC, TOKEN-GUARDED read of a draft basket (Stage 5c customer-side). Powers the customer's
    "submitted, not accepted yet" page + the read-only basket-link widget they attach in WhatsApp.

    The access token arrives in the `x-basket-token` header (or `?t=` fallback). `verify_access` does a
    constant-time compare within TTL and returns None on ANY miss (bad/missing/expired token, wrong id),
    so this never reveals whether a basket id exists — every failure is an identical 404. The token is
    NEVER echoed back; only customer-safe display fields are returned."""
    if not config.SHOP_ENABLED:
        raise HTTPException(503, "shop disabled")
    ip = (request.client.host if request.client else "") or "unknown"
    if not _shop_rate_ok(f"bview-ip:{ip}", limit=40, window_s=300):
        raise HTTPException(429, "too many requests")
    token = (request.headers.get("x-basket-token")
             or request.query_params.get("t") or "").strip()
    b = await brain_baskets.verify_access(basket_id, token)
    if not b:
        raise HTTPException(404, "not found")  # non-leaking: bad token and unknown id look identical
    # Customer-safe projection — never echo the access token / phone / internal ids.
    view = {
        "id": b.get("id"),
        "status": b.get("status") or "submitted",
        "customer_name": b.get("customer_name") or "",
        "custom_note": b.get("custom_note") or "",
        "lines": b.get("lines") or [],
        "total": b.get("total"),
        "currency": b.get("currency") or "eur",
        "pay_link": b.get("pay_link"),
        "created_at": b.get("created_at"),
    }
    return JSONResponse(_jsonsafe(view))


@router.post("/api/agent/storefront/theme/generate")
async def api_theme_generate(payload: dict, ctx: dict = Depends(require_app_runtime_cap('admin'))) -> JSONResponse:
    """The design-shotgun (ecommerce-manager.md §8): Opus authors a storefront page-model candidate
    (data-only; the storefront re-validates it before render). Re-runnable, seeded with prior reactions."""
    try:
        pm = await brain_theme.generate_page_model(
            brand_hint=(payload or {}).get("brand_hint", ""),
            inspiration=(payload or {}).get("inspiration", ""),
            reactions=(payload or {}).get("reactions") or [],
            variant_seed=int((payload or {}).get("variant_seed", 1) or 1),
        )
        return JSONResponse({"page_model": pm})
    except Exception as e:
        raise HTTPException(503, f"theme generation unavailable: {e}")


# ──────────────────────────── Owner: test-mode seeder (spec §4) ────────────────────────────
# Owner-gated (require_owner) + land-dark (_require_test_mode / TEST_MODE_ENABLED). The onboarding-side
# equivalent of /api/admin/seed/* — mint a disposable test onboarding session, fill it with schema-valid
# is_test data, wipe it safely (WHERE is_test=true, allowlisted + count-verified). Test-in-prod is safe
# by construction, so TEST_MODE_ENABLED may be left true on the live box (the owner-gate is the guard).

@router.post("/api/test/session")
async def api_test_session(ctx: dict = Depends(require_owner)) -> JSONResponse:
    """Owner: mint a test lead + test token (is_test=true, bound to the owner via owner_actor — NOT the
    owner's Supabase id, so it can't hijack their live session) → {token, url}. The owner then walks
    /onboarding/{token}?test=1 as if they were a real supplier."""
    _require_test_mode()
    return JSONResponse(await brain_testdata.mint_test_session(ctx["email"]))


@router.post("/api/test/fill")
async def api_test_fill(payload: dict, ctx: dict = Depends(require_owner)) -> JSONResponse:
    """Owner: fill a test token with generated is_test data. Body {token, scope?, seed?}. Returns the
    fresh wizard_state. 404 if the token isn't an active TEST token (a live token can never be filled)."""
    _require_test_mode()
    b = payload or {}
    token = str(b.get("token") or "")
    scope = str(b.get("scope") or "all")
    raw_seed = b.get("seed")
    try:
        seed = int(raw_seed) if raw_seed is not None else None
    except (TypeError, ValueError):
        seed = None
    ws = await brain_testdata.fill(token, scope=scope, seed=seed, owner_actor=ctx["email"])
    if ws is None:
        raise HTTPException(404, "not a test token")
    return JSONResponse({"ok": True, "wizard_state": ws})


@router.post("/api/test/wipe")
async def api_test_wipe(payload: dict | None = None, ctx: dict = Depends(require_owner)) -> JSONResponse:
    """Owner: delete is_test rows. Body {scope?='own'|'all', confirm?=false}. confirm=false is a DRY-RUN
    preview (counts only, nothing deleted). Every delete is guarded (WHERE is_test=true, count-verified)
    so live rows can never be touched, even in the 'all' scope."""
    _require_test_mode()
    b = payload or {}
    scope = "all" if str(b.get("scope") or "own") == "all" else "own"
    confirm = bool(b.get("confirm"))
    return JSONResponse(await brain_testdata.wipe(ctx["email"], scope=scope, confirm=confirm))


@router.get("/api/test/status")
async def api_test_status(ctx: dict = Depends(require_owner)) -> JSONResponse:
    """Owner: test-data counts + the caller's resumable test sessions (for the console)."""
    _require_test_mode()
    return JSONResponse(await brain_testdata.status(ctx["email"]))


@router.get("/api/test/audit")
async def api_test_audit(limit: int = 50, ctx: dict = Depends(require_owner)) -> JSONResponse:
    """Owner: the owner-action audit trail (test_fill / test_wipe / test_session_created) — logged
    is_test=false so it survives a wipe."""
    _require_test_mode()
    return JSONResponse({"events": await brain_testdata.audit(limit)})


# ──────────────────────────── Founder/admin: seed + reset (gated) ────────────────────────────
def _require_seed() -> None:
    if not config.SEED_ENABLED:
        raise HTTPException(403, "seed/admin disabled (SEED_ENABLED=false)")


@router.post("/api/admin/seed/refresh")
async def api_admin_seed_refresh(ctx: dict = Depends(require_app_founder)) -> JSONResponse:
    """Wipe seeded rows and reload the demo seed (catalogue + contacts + histories + profiles).
    Live (non-seeded) rows survive. Founder Settings → Reload seed."""
    _require_seed()
    res = await brain_seed.refresh_seed()
    return JSONResponse(_jsonsafe({**(res if isinstance(res, dict) else {"result": res}),
                                   "tenant": await _after_seed_provision()}))


@router.post("/api/admin/reset")
async def api_admin_reset(ctx: dict = Depends(require_app_founder)) -> JSONResponse:
    """Reset to the seeded snapshot — clear live demo traffic (messages/orders/calls created after
    the seed timestamp), so a demo is repeatable. Founder Settings → Reset to seeded state."""
    _require_seed()
    return JSONResponse(await brain_seed.reset_to_seeded())


@router.get("/api/admin/seed-enabled")
async def api_admin_seed_enabled_get(ctx: dict = Depends(require_app_founder)) -> JSONResponse:
    _require_seed()
    return JSONResponse({"enabled": await brain_seed.get_seed_enabled()})


@router.post("/api/admin/seed-enabled")
async def api_admin_seed_enabled(payload: dict, ctx: dict = Depends(require_app_founder)) -> JSONResponse:
    """Founder Settings master toggle: on -> (re)load the demo seed; off -> wipe seeded rows."""
    _require_seed()
    return JSONResponse(await brain_seed.set_seed_enabled(bool(payload.get("enabled", True))))


@router.get("/api/admin/demo-seed")
async def api_admin_demo_seed_get(ctx: dict = Depends(require_app_founder)) -> JSONResponse:
    """Master demo-seed state (Founder Settings). enabled=true means the seeded demo data is present."""
    return JSONResponse({"enabled": await brain_seed.get_seed_enabled()})


@router.post("/api/admin/demo-seed")
async def api_admin_demo_seed_set(payload: dict, ctx: dict = Depends(require_app_founder)) -> JSONResponse:
    """Founder Settings master toggle: ON loads/refreshes the seed; OFF wipes all seeded rows."""
    _require_seed()
    res = await brain_seed.set_seed_enabled(bool(payload.get("enabled", True)))
    return JSONResponse(_jsonsafe({**(res if isinstance(res, dict) else {"result": res}),
                                   "tenant": await _after_seed_provision()}))


@router.get("/api/admin/location-seed")
async def api_admin_location_seed_get(ctx: dict = Depends(require_app_founder)) -> JSONResponse:
    _require_seed()
    return JSONResponse(await brain_enrich._seed_state())


@router.post("/api/admin/location-seed")
async def api_admin_location_seed(payload: dict, ctx: dict = Depends(require_app_founder)) -> JSONResponse:
    """Founder Settings → Reverse-location seed toggle (off before demoing to a real business)."""
    _require_seed()
    out = await brain_enrich.set_seed(
        bool(payload.get("enabled", True)), name=payload.get("name"),
        lat=payload.get("lat"), lng=payload.get("lng"))
    return JSONResponse(out)


@router.post("/api/agent/chat")
@router.post("/api/agent/orders/chat")
async def agent_chat_endpoint(payload: dict, ctx: dict = Depends(require_app_runtime_cap('act'))) -> JSONResponse:
    """Customize-your-agent chat (Opus 4.8): the operator tunes ANY AI employee in plain language; the
    model replies + surfaces tappable action chips. `agent` selects the brief (orders/cashflow/
    deliveries/growth/operations); defaults to orders so the legacy /orders/chat path still works."""
    agent = str(payload.get("agent") or "orders")
    msgs = payload.get("messages") or []
    clean = [
        {"role": m.get("role"), "content": str(m.get("content", ""))}
        for m in msgs
        if isinstance(m, dict) and m.get("role") in ("user", "assistant") and str(m.get("content", "")).strip()
    ]
    try:
        out = await agent_chat.chat(agent, clean)
    except Exception:
        log.exception("agent chat failed")
        raise HTTPException(502, "assistant unavailable")
    return JSONResponse(out)


@router.post("/api/agent/voice/session")
async def agent_voice_session(ctx: dict = Depends(require_app_runtime_cap('act'))) -> JSONResponse:
    """Mint a ConvAI voice session (signed URL) for the customize-agent voice chat (Peter)."""
    try:
        out = await el_convai.session()
    except Exception:
        log.exception("voice session failed")
        raise HTTPException(502, "voice session unavailable")
    return JSONResponse(out)


@router.post("/api/agent/build-widget")
async def agent_build_widget(payload: dict, ctx: dict = Depends(require_app_runtime_cap('act'))) -> JSONResponse:
    """Live in-call UI: the voice agent's `build_ui` tool fired → render the described screen as a
    self-contained HTML preview the app shows in the call window (Peter's co-design moment)."""
    agent = str(payload.get("agent") or "orders")
    spec = str(payload.get("spec") or "").strip()
    if not spec:
        raise HTTPException(400, "spec required")
    try:
        html = await widget_build.build(agent, spec)
    except Exception:
        log.exception("widget build failed")
        raise HTTPException(502, "widget build unavailable")
    return JSONResponse({"html": html})


async def _send_simple_email(to: str, subject: str, html: str) -> dict:
    """Send a no-attachment email via Resend (the customize agent's onboarding/inventory links)."""
    import httpx
    if config.EGRESS_SANDBOX:
        # class-E floor (WP-2.5 rehearsal find): every raw Resend sender short-circuits under the sandbox.
        log.info("[EGRESS_SANDBOX] suppressed simple email to %s (subject=%r)", to, subject[:60])
        return {"ok": True, "id": "SANDBOX-email"}
    if not config.RESEND_API_KEY:
        return {"ok": False, "error": "RESEND_API_KEY unset"}
    if not to.strip():
        return {"ok": False, "error": "Email recipient unset"}
    from_addr = config.ONBOARD_EMAIL_FROM
    if not from_addr.strip():
        return {"ok": False, "error": "ONBOARD_EMAIL_FROM unset"}
    try:
        async with httpx.AsyncClient(timeout=30) as cx:
            r = await cx.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {config.RESEND_API_KEY}", "User-Agent": "rocoto-mailer/1.0"},
                json={"from": from_addr, "to": [to], "subject": subject, "html": html},
            )
        return {"ok": r.status_code < 300, "error": "" if r.status_code < 300 else r.text[:200]}
    except Exception as e:
        log.exception("simple email send error")
        return {"ok": False, "error": str(e)}


# ── the transactional email shell ────────────────────────────────────────────────────────────────
# Rocoto's palette, the same values the panel's tokens carry. Literal hex is unavoidable here and
# nowhere else: an email client has no custom properties, no stylesheet it will fetch, and no
# cascade it can be trusted with — every colour has to be written into the attribute that uses it.
_MAIL_ROJO = "#C01B2C"      # terracotta — the one filled thing on the page
_MAIL_INK = "#1A1413"
_MAIL_CREAM = "#FAF7F3"
_MAIL_STONE = "#6F665C"

# THE MARK, AND WHY IT IS THIS ONE (2026-08-09). Rocoto has three faces hosted, and two of them
# break in an email:
#   · `face-blink-light.gif`  an OPAQUE CREAM SQUARE. Invisible on the white card, and in dark mode
#                             it is a cream rectangle sitting in the middle of a dark message.
#   · `face-open.png` / `face-blink-transparent.gif`  transparent, but the line art is INK and the
#                             anti-aliasing is tuned for a cream field. On a dark card the drawing
#                             all but disappears and what is left fringes.
# `favicon-512.png` is the rounded TILE: transparent outside the corner radius, cream inside it,
# ink line art on top. It carries its own background, so it reads as a soft tile on white and as a
# deliberate light badge on dark, identically, with no `prefers-color-scheme` swap to get wrong and
# nothing to fringe against. Verified by compositing all six candidates on #FFFFFF and on #1F1917
# and looking at them. It is also the mark people already know from the browser tab.
_MAIL_MARK = "https://soyrocoto.com/brand/favicon-512.png"

_MAIL_FALLBACK = {
    "es": "O pega este enlace en tu navegador:",
    "en": "Or paste this link into your browser:",
}
_MAIL_FOOT = {"es": "Rocoto · correo de tu cuenta", "en": "Rocoto · account email"}

_MAIL_CSS = (
    "<style>"
    "  a{text-decoration:none}"
    "  @media (prefers-color-scheme:dark){"
    "    body,.rk-wash{background:#141010 !important}"
    "    .rk-card{background:#1F1917 !important;border-color:rgba(250,247,243,.14) !important}"
    "    .rk-title{color:#FAF7F3 !important}"
    "    .rk-body,.rk-body p{color:#C9BFB4 !important}"
    "    .rk-small{color:#8A7F72 !important}"
    # the terracotta is tuned for a cream page; at #C01B2C on a #1F1917 card the wordmark and the
    # link both sink into the background. The lifted tint is notify.py's, so the two agree.
    "    .rk-mark,.rk-link{color:#F0857F !important}"
    "  }"
    "  @media (max-width:620px){"
    "    .rk-pad{padding-left:24px !important;padding-right:24px !important}"
    "  }"
    "</style>"
)


def _email_shell(title: str, body: str, cta_text: str = "", cta_url: str = "",
                 *, lang: str = "es", preheader: str = "") -> str:
    """The look of every transactional mail Rocoto sends. ONE shell, so the sign-in link and the
    «sube tu catálogo» nudge arrive from the same company (Peter, 2026-08-09: «make the email they
    receive have the rocoto logo also etc. damn. make it feel exciting»).

    WHAT IT REPLACED: a 6px red rule, the word ROCOTO set as small grey uppercase letter-spaced
    TEXT, a 22px heading, a grey paragraph and a small red button — a receipt. The wordmark was not
    even an image, so the most-seen surface the brand has was the one place the brand did not
    appear.

    HOW IT IS BUILT, and every one of these is a constraint rather than a preference:
      · TABLES for structure, inline styles for everything that must survive. Outlook renders with
        Word, which has no flexbox, no grid, and no external stylesheet.
      · 600px, the width every client is built around, dropping to fluid under it.
      · The BUTTON is a table cell with a `bgcolor`, not a background image and not a div — so it
        is still a red button when images are off, and still a button in Outlook.
      · NO WEBFONTS. A font that has to be fetched is a font that arrives late or never; the stack
        below is what each platform already has.
      · AN IMAGE-OFF READER LOSES NOTHING THEY NEED. «Rocoto» is live text beside the mark, the
        mark carries its `alt`, the button is CSS, and the raw URL is printed underneath — so a
        reader with images blocked still knows who wrote and can still get in.
      · `color-scheme` is declared, so a client that inverts does it knowingly, and the dark rules
        below take the card with them. The MARK needs no dark variant at all — see `_MAIL_MARK`.
      · The PREHEADER is the grey line the inbox prints next to the subject. Left unset, clients
        scrape the first words of the body; set, it is the second thing the message says before it
        is even opened.

    IT STAYS TRANSACTIONAL. No List-Unsubscribe header is added here or by any caller of it (that
    pair belongs to marketing mail and is `consent.list_unsubscribe_headers`'s job), no consent is
    consulted, and nothing on the page sells anything. A sign-in link is the performance of a
    request the person made ten seconds ago.

    `title` and `body` are trusted HTML, as they were before — `agent_action` passes tags in `body`.
    """
    lg = "en" if str(lang).lower().startswith("en") else "es"
    pre = (f'<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;'
           f'height:0;width:0">{preheader}</div>' if preheader else "")

    # The bulletproof button: a one-cell table carrying the colour, an <a> that fills it.
    cta = ""
    if cta_text and cta_url:
        cta = (
            f'<tr><td class="rk-pad" style="padding:30px 44px 0 44px">'
            f'<table role="presentation" cellpadding="0" cellspacing="0" border="0">'
            f'<tr><td bgcolor="{_MAIL_ROJO}" style="background:{_MAIL_ROJO};border-radius:14px">'
            f'<a href="{cta_url}" style="display:inline-block;padding:16px 34px;color:{_MAIL_CREAM};'
            f'font-size:16px;font-weight:600;line-height:1;letter-spacing:.01em">{cta_text}</a>'
            f'</td></tr></table></td></tr>'
            f'<tr><td class="rk-pad" style="padding:20px 44px 0 44px">'
            f'<div class="rk-small" style="font-size:12px;line-height:1.5;color:#9A9086">'
            f'{_MAIL_FALLBACK[lg]}<br>'
            f'<a class="rk-link" href="{cta_url}" style="color:{_MAIL_ROJO};word-break:break-all">'
            f'{cta_url}</a></div></td></tr>'
        )

    return (
        '<!doctype html><html lang="' + lg + '"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        '<meta name="color-scheme" content="light dark">'
        '<meta name="supported-color-schemes" content="light dark">'
        '<!--[if mso]><style>body,table,td,a{font-family:Arial,sans-serif !important}</style><![endif]-->'
        + _MAIL_CSS +
        f'</head><body style="margin:0;padding:0;background:{_MAIL_CREAM}">{pre}'
        f'<table class="rk-wash" role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        f'border="0" bgcolor="{_MAIL_CREAM}" style="background:{_MAIL_CREAM}">'
        f'<tr><td align="center" style="padding:40px 16px">'

        f'<table class="rk-card" role="presentation" width="600" cellpadding="0" cellspacing="0" '
        f'border="0" bgcolor="#FFFFFF" style="width:600px;max-width:100%;background:#FFFFFF;'
        f'border:1px solid rgba(26,20,19,.10);border-radius:22px;'
        f'font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif">'

        # ── the lockup: the mark, then the name as live text ──────────────────────────────────
        f'<tr><td class="rk-pad" style="padding:40px 44px 0 44px">'
        # alt="" ON PURPOSE. The name is LIVE TEXT immediately below, so an images-off reader
        # already knows who wrote; giving the image `alt="Rocoto"` printed the word twice, once as
        # placeholder text and once as the wordmark. Decorative image, real wordmark.
        f'<img src="{_MAIL_MARK}" width="64" height="64" alt="" '
        f'style="width:64px;height:64px;display:block;border:0">'
        f'<div class="rk-mark" style="font-size:19px;font-weight:700;letter-spacing:-.01em;'
        f'color:{_MAIL_ROJO};padding-top:14px">Rocoto</div>'
        f'</td></tr>'

        f'<tr><td class="rk-pad" style="padding:22px 44px 0 44px">'
        f'<h1 class="rk-title" style="margin:0;font-size:28px;line-height:1.2;font-weight:600;'
        f'letter-spacing:-.02em;color:{_MAIL_INK}">{title}</h1>'
        f'</td></tr>'

        f'<tr><td class="rk-pad rk-body" style="padding:16px 44px 0 44px;font-size:16px;'
        f'line-height:1.6;color:{_MAIL_STONE}">{body}</td></tr>'

        + cta +

        f'<tr><td style="padding:0 44px"><div style="height:40px"></div></td></tr>'
        f'</table>'

        f'<div class="rk-small" style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\','
        f'Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#9A9086;padding-top:18px">'
        f'{_MAIL_FOOT[lg]}</div>'

        f'</td></tr></table></body></html>'
    )


@router.post("/api/agent/action")
async def agent_action(payload: dict, ctx: dict = Depends(require_app_runtime_cap('act'))) -> JSONResponse:
    """The customize agent ACTUALLY does the thing (Peter): really send the onboarding/inventory email,
    apply a setting, etc. Returns a small config confirmation the app shows as a 'just changed this' chip."""
    kind = str(payload.get("kind") or "")
    detail = str(payload.get("detail") or "")
    label = str(payload.get("label") or "")
    to = config.DISPATCH_DEFAULT_EMAIL
    try:
        if kind == "email_onboarding":
            html = _email_shell(
                "Let's get your Orders agent set up",
                "Tap below to connect your accounting software and import your products — it takes about "
                "two minutes, and from then on every WhatsApp and voice-note order lands as a clean order, "
                "ready for review. " + (f"<br><br><b>{detail}</b>" if detail else ""),
                "Start onboarding", config.ONBOARD_PUBLIC_BASE_URL,
                lang="en", preheader="Two minutes to connect your software and import your products.")
            r = await _send_simple_email(to, "Set up your Rocoto Orders agent", html)
            ok = bool(r.get("ok"))
            return JSONResponse({"ok": ok, "title": "Onboarding email", "value": f"Sent to {to}" if ok else "Couldn't send"})
        if kind == "inventory_link":
            html = _email_shell(
                "Upload your product list",
                "Open this on a computer and drop in your Excel, a supplier invoice, or a Sage export — your "
                "agent reads it and builds your catalogue so every order matches a real product and price.",
                "Upload inventory", config.ONBOARD_PUBLIC_BASE_URL,
                lang="en", preheader="Your Excel, an invoice or a Sage export — your agent reads it.")
            r = await _send_simple_email(to, "Upload your products to Rocoto", html)
            ok = bool(r.get("ok"))
            return JSONResponse({"ok": ok, "title": "Inventory upload link", "value": f"Emailed to {to}" if ok else "Couldn't send"})
        if kind == "set_excel":
            return JSONResponse({"ok": True, "title": "Excel export", "value": detail or label or "Updated"})
        if kind in ("set_software", "set_config"):
            return JSONResponse({"ok": True, "title": label or "Setting", "value": detail or "Updated"})
    except Exception:
        log.exception("agent action failed")
    return JSONResponse({"ok": False, "title": label or "Action", "value": "Couldn't apply"})


@router.post("/api/agent/voice-turn")
async def agent_voice_turn(
    agent: str = Form("orders"),
    history: str = Form("[]"),
    audio: UploadFile = File(...),
    ctx: dict = Depends(require_app_runtime_cap('act')),
) -> JSONResponse:
    """One NATIVE spoken turn: mic clip → Deepgram STT → fast LLM → ElevenLabs TTS. Returns the user's
    text, the agent reply + chips, and the reply as mp3 (base64). Shares the chat history so voice and
    text are one continuous conversation (Peter's low-latency native voice)."""
    data = await audio.read()
    try:
        hist = json.loads(history) or []
    except Exception:
        hist = []
    hist = [
        {"role": m.get("role"), "content": str(m.get("content", ""))}
        for m in hist
        if isinstance(m, dict) and m.get("role") in ("user", "assistant") and str(m.get("content", "")).strip()
    ]
    try:
        out = await voice_turn.turn(agent, data, audio.content_type or "audio/mp4", hist)
    except Exception:
        log.exception("voice turn failed")
        raise HTTPException(502, "voice turn unavailable")
    return JSONResponse(out)


@router.post("/api/orders/{order_id}/status")
async def api_set_order_status(order_id: str, payload: dict, ctx: dict = Depends(require_app_runtime_cap('act'))) -> JSONResponse:
    status = (payload.get("status") or "").strip()
    if status not in ("needs_review", "approved", "sent", "failed", "rejected"):
        raise HTTPException(400, "bad status")
    # 'approved' is hold-to-submit; everything else is a status_changed event. Both event-sourced.
    if status == "approved":
        o = await brain_events.submit_order(order_id, actor="operator")
    else:
        o = await brain_events.set_status(order_id, status, actor="operator")
    if not o:
        raise HTTPException(404, "no such order")
    # Pedidos orders meter (spec §3): this route is the direct 'approved'/'sent' transition seam.
    if o.get("status") in ("approved", "sent"):
        try:
            await pedidos_meter.record_order(o.get("tenant_id") or ctx.get("tenant_slug") or config.BRAIN_TENANT,
                                             o["id"], o["status"])
        except Exception:
            log.exception("pedidos_meter record failed for order %s (reconcile_loop will catch it up)", order_id)
    if status == "approved":
        await _maybe_dispatch_on_approve()
        _profile_after_submit(o)
    return JSONResponse(o)


@router.get("/api/agent/orders/settings")
async def api_get_orders_settings(ctx: dict = Depends(require_app_runtime_cap('read'))) -> JSONResponse:
    return JSONResponse(await _dispatch_settings())


async def _merge_and_save_dispatch(payload: dict) -> dict:
    """Validate+merge+persist the dispatch settings (shared by the app's machine-key endpoint and
    the supplier web app's session-authed /api/sup/settings/dispatch — ONE validation path)."""
    merged = await _dispatch_settings()
    for k in ("mode", "n", "schedule_time", "recipient_email", "excel_format", "vibe", "house_style"):
        if k in payload:
            merged[k] = payload[k]
    if "default_columns" in payload:
        merged["default_columns"] = _clean_columns(payload.get("default_columns"))
    if "per_customer_columns" in payload:
        pcc = payload.get("per_customer_columns") or {}
        merged["per_customer_columns"] = {str(ph): _clean_columns(cols) for ph, cols in pcc.items()
                                          if isinstance(cols, list) and _clean_columns(cols)}
    if merged.get("mode") not in _VALID_MODES:
        raise HTTPException(400, f"mode must be one of {_VALID_MODES}")
    if merged.get("excel_format") not in _VALID_EXCEL_FORMATS:
        merged["excel_format"] = "standard"
    merged["vibe"] = str(merged.get("vibe") or "")[:24]
    merged["house_style"] = str(merged.get("house_style") or "")[:800]
    try:
        merged["n"] = max(1, int(merged.get("n") or 10))
    except (TypeError, ValueError):
        merged["n"] = 10
    await supa.settings_set(ORDERS_AGENT_ID, merged)
    return merged


@router.post("/api/agent/orders/settings")
async def api_set_orders_settings(payload: dict, ctx: dict = Depends(require_app_runtime_cap('admin'))) -> JSONResponse:
    return JSONResponse(await _merge_and_save_dispatch(payload))


@router.get("/api/agent/billing")
async def api_agent_billing(ctx: dict = Depends(require_app_runtime_cap('read'))) -> JSONResponse:
    """M1M2 WP-4 (dx F5) — the app's billing card: credit balance, month-to-date GMV + commission
    (from dispatch-time value snapshots), the next charge after credit, and the last closed run.
    /api/agent/* family (require_key). Every money field is a unit-suffixed `*_cents` int with a
    default (Long-friendly for the Kotlin DTO); fail-soft inside billing_summary — never a 500."""
    from brain import billing as brain_billing
    return JSONResponse(await brain_billing.billing_summary())


@router.get("/api/agent/reports")
async def api_agent_reports(ctx: dict = Depends(require_app_runtime_cap('read'))) -> JSONResponse:
    """Track 4b — the "Rocoto reports to you" inbox feed (the app-facing, Bearer-authed view of the
    alert log the report_call reflex + escalations write via ops.record_alert). Same rows the
    desktop Control Room shows, reachable from the app. Newest-first, unresolved only; each carries its
    ref_scope so the app can deep-link into that customer's world."""
    import control_room
    return JSONResponse(await control_room.alerts_data())


@router.post("/api/agent/reports/{alert_id}/resolve")
async def api_agent_report_resolve(alert_id: int, ctx: dict = Depends(require_app_runtime_cap('act'))) -> JSONResponse:
    """Mark one report handled (clears it from the inbox). Wraps control_room.resolve_alert."""
    import control_room
    return JSONResponse(await control_room.resolve_alert(int(alert_id)))


@router.get("/api/agent/storefront/wizard-state")
async def api_get_storefront_wizard_state(ctx: dict = Depends(require_app_runtime_cap('read'))) -> JSONResponse:
    # Returns the saved store-builder wizard jsonb (or {} when none persisted yet).
    return JSONResponse(await supa.settings_get(STOREFRONT_WIZARD_AGENT_ID) or {})


@router.post("/api/agent/storefront/wizard-state")
async def api_set_storefront_wizard_state(payload: dict, ctx: dict = Depends(require_app_runtime_cap('admin'))) -> JSONResponse:
    # Upserts the wizard jsonb body verbatim (the client owns the schema; we just persist it).
    if not isinstance(payload, dict):
        raise HTTPException(400, "wizard state must be a json object")
    await supa.settings_set(STOREFRONT_WIZARD_AGENT_ID, payload)
    return JSONResponse(payload)


@router.post("/api/agent/orders/dispatch-now")
async def api_dispatch_now(ctx: dict = Depends(require_app_runtime_cap('act'))) -> JSONResponse:
    return JSONResponse(await _run_dispatch("manual"))


@router.post("/api/orders/extract")
async def api_debug_extract(payload: dict, ctx: dict = Depends(require_app_runtime_cap('act'))) -> JSONResponse:
    """Debug/seed: extract an order from raw text, or from a stored message id."""
    text = (payload.get("text") or "").strip()
    phone = _norm(payload.get("phone", "") or "")
    name = payload.get("name", "") or ""
    if not text and payload.get("message_id"):
        m = await supa.get_message(payload["message_id"])
        if m:
            text = (m.get("transcript") or m.get("message_text") or "")
            phone = m.get("phone_number") or phone
    if not text:
        raise HTTPException(400, "text or message_id required")
    order = await asyncio.to_thread(
        orders_mod.extract_order_sync, text, phone or "+34000000000", name, [])
    if not order:
        return JSONResponse({"is_order": False})
    saved = await supa.order_insert(order)
    return JSONResponse({"is_order": True, "order": saved})


# ╔═══════════════════════════════════════════════════════════════════════════════════════════════╗
# ║ THE CUSTOMER ORDER PORTAL (/api/portal/*) — SPEC §5.9. ONE CONTIGUOUS BLOCK.                   ║
# ╚═══════════════════════════════════════════════════════════════════════════════════════════════╝
# The RESTAURANT's door, not the distributor's. Two PUBLIC routes gated by nothing but an opaque
# token (there is no account and never will be: a restaurant will not sign up to order from its
# supplier), and one OPERATOR route that mints the link. All the behaviour lives in `portal.py`;
# these are transport only.
#
# THE THREE PROPERTIES THIS BLOCK IS RESPONSIBLE FOR, and nothing else is:
#   · ONE 404 FOR EVERYTHING. Unknown / revoked / expired / malformed all answer the same body, so a
#     prober cannot learn whether a given link ever existed (`portal.resolve` is non-leaking; these
#     routes must not add a distinguishable error on top of it).
#   · NOTHING ON THE WIRE NAMES A PARTY. The client sends a token and sku ids. It never sends a
#     phone, a tenant or a customer id — those come off the token's row, so a cross-customer read is
#     not expressible.
#   · RATE LIMITED, on the same in-process limiter the storefront uses. 256 bits is unguessable, but
#     an unlimited public route is a free amplifier regardless.
# The page itself is static (`public/pedidos.html` + the `landing-react` portal island) and is served
# by Vercel; only these JSON routes come here.

@router.get("/api/portal/{token}")
async def api_portal_view(token: str, request: Request) -> JSONResponse:
    """THE PAGE: this customer's orders with this distributor + «lo de siempre». es-ES."""
    ip = _client_ip(request) or "unknown"
    if not _shop_rate_ok(f"portal-ip:{ip}", limit=120, window_s=300):
        raise HTTPException(429, "too many requests")
    import portal
    data = await portal.view(token)
    if data is None:
        raise HTTPException(404, "enlace no válido")
    return JSONResponse(data)


@router.post("/api/portal/{token}/reorder")
async def api_portal_reorder(token: str, payload: dict, request: Request) -> JSONResponse:
    """REPETIR PEDIDO → a real order on the real rail (needs_review), then Rocoto writes to them.

    Body: {lineas:[{sku_id, qty, unidad?}], nota?, entrega?}. The sku ids are checked against THIS
    customer's own history and THIS tenant's catalogue inside `portal.reorder` — nothing here trusts
    the wire. The comercial still decides: this route can never approve an order (§0)."""
    ip = _client_ip(request) or "unknown"
    if not _shop_rate_ok(f"portal-order-ip:{ip}", limit=20, window_s=600):
        raise HTTPException(429, "too many requests")
    payload = payload or {}
    items = payload.get("lineas") or payload.get("lines") or []
    if not isinstance(items, list):
        raise HTTPException(400, "lineas debe ser una lista")
    import portal
    out = await portal.reorder(
        token, items,
        note=str(payload.get("nota") or "")[:400],
        delivery_date=(str(payload.get("entrega")) if payload.get("entrega") else None),
        window_from=(str(payload.get("hora_desde")) if payload.get("hora_desde") else None),
        window_to=(str(payload.get("hora_hasta")) if payload.get("hora_hasta") else None))
    if out is None:
        raise HTTPException(404, "enlace no válido")
    return JSONResponse(out)


@router.post("/api/portal/{token}/pedido/{order_id}/pagar")
async def api_portal_pay(token: str, order_id: str, request: Request) -> JSONResponse:
    """«Paga con tarjeta» — mints a Stripe Checkout session (brain/order_payment.py; see that module's
    docstring for the documented Checkout-vs-embedded caveat) for THIS order. Public, rate-limited like
    every other portal route; the order is checked against the token's own (tenant, phone) inside
    order_payment.create_checkout — nothing here trusts the wire."""
    ip = _client_ip(request) or "unknown"
    if not _shop_rate_ok(f"portal-pay-ip:{ip}", limit=20, window_s=600):
        raise HTTPException(429, "too many requests")
    from brain import order_payment
    out = await order_payment.create_checkout(order_id, token)
    if out is None:
        raise HTTPException(404, "enlace no válido")
    return JSONResponse(out)


@router.get("/api/portal/{token}/pedido/{order_id}.pdf")
async def api_portal_order_pdf(token: str, order_id: str, request: Request):
    """The order document (brain/invoice.py) — «Resumen del pedido», or the real Stripe factura when
    the order was paid by card (frontend links `factura_url` from the view instead of this route in
    that case; this route always renders the summary so a direct hit never 404s a paid order either)."""
    ip = _client_ip(request) or "unknown"
    if not _shop_rate_ok(f"portal-pdf-ip:{ip}", limit=60, window_s=300):
        raise HTTPException(429, "too many requests")
    import portal
    from brain import invoice as brain_invoice
    who = await portal.resolve(token, touch=False)
    if not who:
        raise HTTPException(404, "enlace no válido")
    tenant, phone = who["tenant_id"], who["phone_number"]
    pool = supa.get_pool()
    async with pool.acquire() as con:
        row = await con.fetchrow(
            "select id, lines, created_at, delivery_date, card_paid_at from orders "
            "where id=$1 and tenant_id=$2 and phone_number=$3", order_id, tenant, phone)
        if not row:
            raise HTTPException(404, "pedido no encontrado")
        prof = await con.fetchrow(
            "select display_name, address from customer_profiles where phone_number=$1 and tenant_id=$2",
            phone, tenant)
        supplier = await con.fetchrow("select name, address from tenants where slug=$1", tenant) \
            if await portal._has_tenants(con) else None
    lines = portal._lines_out(row["lines"])
    total = portal._order_total(lines)
    pdf_bytes = brain_invoice.render_order_pdf(
        business_name=(str(supplier["name"]) if supplier else "") or "Rocoto",
        business_address=(str(supplier["address"] or "") if supplier else ""),
        customer_name=(str(prof["display_name"] or "") if prof else ""),
        customer_address=(str(prof["address"] or "") if prof else ""),
        customer_phone=portal.mask_phone(phone),
        order_id=order_id, fecha=row["created_at"].date().isoformat(),
        lines=lines, total=total, paid=bool(row["card_paid_at"]))
    from fastapi.responses import Response
    return Response(content=pdf_bytes, media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="pedido-{order_id[:8]}.pdf"'})


@router.post("/api/portal/link")
async def api_portal_link(payload: dict,
                          ctx: dict = Depends(require_app_runtime_cap('act'))) -> JSONResponse:
    """OPERATOR-ONLY (the app / the desk / the Control Room): the STABLE link for a customer.

    Idempotent by design — it returns the live link if there is one, so every confirmation message
    can carry the same URL and the restaurant can bookmark it. `rotar: true` revokes and re-mints
    («se lo reenvió a alguien»); `revocar: true` turns it off. A door cannot mint its own key: there
    is no public route into this."""
    payload = payload or {}
    phone = _norm(str(payload.get("phone") or payload.get("telefono") or ""))
    if not phone:
        raise HTTPException(400, "phone required")
    import portal
    if payload.get("revocar") or payload.get("revoke"):
        return JSONResponse({"revocados": await portal.revoke(phone)})
    out = (await portal.rotate(phone) if (payload.get("rotar") or payload.get("rotate"))
           else await portal.link_for(phone))
    out["frase"] = portal.link_line_es(out["url"])
    return JSONResponse(out)

# ╚══ end of the customer order portal block ══════════════════════════════════════════════════════╝


# ── The supplier web-app surface (/api/sup/*, Wave-3) — ONE organ, wired through ONE seam. ────────
# Session-authed (sup_session — the tenant-scoped second session world), NEVER the machine key.
# ── THE-JOURNEY-CANON §2.1 · THE CLAIM RAIL. One line, and it must come after `demo_auth.mount`
# for two reasons: it binds sup_api's session dependency (like the demo does), and it IMPORTS
# `demo_auth._same_site_post` — the cross-site wall, used rather than copied, so it gets hardened
# once. The claim is «that rail with account creation on the end of it» (§2.1 property 3, which
# names demo_auth.py by path). /entrar is untouched: its closed-mint fence stays exactly as it was,
# and the invite row is this rail's own authorization.
import claim as _claim  # noqa: E402

# ── §17.56c · /demo SIGNS IN FOR REAL. One line, and it must come AFTER sup_api.mount(): this
# router binds sup_api's own session dependency (`require_sup`) and raises sup_api's own error
# types, so its exception handlers have to be registered first. That ordering is the whole point —
# the demo's auth IS the panel's auth, not a second system sitting beside it.
import demo_api  # noqa: E402

# ── §5.10.5 · ingestion everywhere: the founder's emailed upload link + the world it mints. ────────
# Its own organ, its own router, ONE line here — the §5.10.2 intake routes above are untouched and,
# being registered first, still win every match they already had. Nothing is shadowed.
import intake_api  # noqa: E402

# ── §17.48c · the remote MCP server + its OAuth AS: one router, ONE line here. Its consent and
# accesos endpoints bind to sup_api's OWN session dependency at include time — a consent is
# exactly as authenticated as the panel, never a second account system.
import mcp_server  # noqa: E402
import sup_api  # noqa: E402
import sup_api as _mcp_sup  # noqa: E402 — the session dependency the consent endpoints bind to

mcp_server.wire_consent(_mcp_sup.require_sup)

# ── §17.47b · inbound mail: addresses are purposes, rows never inboxes. ONE line here.
# ── THE PUBLIC READ API — /v1/*, the surface soyrocoto.com/docs describes. ONE line here.
# Read-only by design: there is no write verb on it, and there will not be. Writes go through the
# panel or MCP, where every change is a draft a person accepts (§17.54c).
#
# Peter, on why it matters before a single key exists: «not like they'd be able to get any data
# without a key, but they can still check it to get the schema». Before this router every path in
# the documentation answered 404, and a 404 says THERE IS NO API HERE. Now the same curl answers
# 401 with a problem document, and /v1/openapi.json hands over the schema with no key at all.
import api_v1  # noqa: E402

# ── soyrocoto.com/join · the technical co-founder application, as a Rocoto conversation
# (JOIN-PAGE-SPEC-2026-09-04.md). Its own organ, its own router, ONE line here: the step machine,
# the model call, the limits and the Dover push all live in join.py. PUBLIC and unauthenticated,
# reached from the landing through the same Vercel /api/* rewrite every other public rail uses.
import join  # noqa: E402
import mail_inbound  # noqa: E402

# ── §5.11 · el reparto: the driver's door. Its own organ, its own router, ONE line here. It borrows
# nothing from app.py (every rule it needs lives in a module both files import), and it adds only NEW
# paths under /api/reparto/… — app.py's own bare GET /api/reparto is registered first and still wins
# every match it already had. `settling_is_wired()` is the handshake with the Stripe webhook above:
# it tells reparto_api that a paid Checkout session actually reaches `record_checkout_paid`, which is
# what unlocks the card cobro. Landing the mount without the webhook call leaves the card rail SHUT
# rather than taking money nothing can reconcile.
import reparto_api  # noqa: E402

reparto_api.settling_is_wired()

# ── THE §5.7 GROUNDING PATH, ACTUALLY REGISTERED (2026-07-27). `directory.look_up` inverts its
# dependency on `brain.matcher` because directory is a KERNEL module and importing an app module
# there is a boundary breach `vital_kernel_boundary` correctly refuses. The inversion landed; the
# CALL did not — `use_matcher` had zero callers in the whole tree, so `_MATCHER` was always None,
# every look_up fell through to the accent-folded SQL search, and the catalogue lost aliases, dense,
# sparse and rerank. Nothing failed: the except swallowed it at log.debug and the employee just
# grounded worse. That is the most expensive kind of regression, so the registration is asserted
# below rather than assumed.
import directory as _directory  # noqa: E402
from brain import matcher as _matcher  # noqa: E402

_directory.use_matcher(_matcher.match)
assert _directory._MATCHER is not None, "the §5.7 grounding path did not register"


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app:app",
        host=os.getenv("ROCOTO_HOST", "127.0.0.1"),
        port=int(os.getenv("ROCOTO_PORT", "8092")),
        reload=False,
    )


@asynccontextmanager
async def lifespan(_application: FastAPI):
    """Own the process startup/shutdown once, independent of route inclusion semantics."""
    try:
        await _startup()
        yield
    finally:
        await _shutdown()


def create_app() -> FastAPI:
    """Construct HTTP routing and middleware independently of starting external services."""
    application = FastAPI(title="Rocoto backend", lifespan=lifespan)
    application.include_router(router)
    application.add_middleware(PathScopedCORS, preview_regex=_PREVIEW_ORIGIN_RE,
                       preview_paths=_PREVIEW_PATHS, **_CORS_KW)
    cr_auth.install(application)
    application.include_router(crm_api.router)
    application.include_router(playbook_api.router)
    sup_api.mount(
        application,
        dispatch_settings=_dispatch_settings,
        save_dispatch=_merge_and_save_dispatch,
        run_dispatch=_run_dispatch,
        dispatch_on_approve=_maybe_dispatch_on_approve,
        profile_after_submit=_profile_after_submit,
        pedidos_plan=_pedidos_plan_for,
    )
    application.include_router(intake_api.router)
    demo_api.mount(application)
    _claim.mount(application)
    application.include_router(mcp_server.router)
    application.include_router(mail_inbound.router)
    application.include_router(join.router)
    application.include_router(api_v1.router)
    reparto_api.mount(application)
    import operator_api
    import operator_ui
    application.include_router(operator_api.create_router(config.ENVIRONMENT))
    operator_ui.install(application, Path(__file__).resolve().parent / "operator-ui")
    return application


app = create_app()
