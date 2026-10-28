"""Landing "See it live" demo call — places a REAL Twilio call to a website visitor, streams the
live transcript to their browser over SSE, lets them hang up, and follows up with a personalised
WhatsApp CTA. Also owns the WhatsApp-initiated Marco flow (we message them first via a template).

LANDS DARK: `configured()` is False until DEMO_CALL_ENABLED=true AND THE ONE MIND is available, so
every route below returns 503 until Peter flips the flag. Single-worker uvicorn is assumed — the
session registry, SSE fan-out and rate-limit counters are in-process (documented in DEPLOY notes).

The call itself rides the EXISTING Twilio → ElevenBridge relay (eleven.py), with an on_event hook that
fans EL transcript events straight to the browser — so the agent's line can reach the screen at or
before the caller hears it. Nothing here touches the live customer path.

B3 (2026-07-26): there is NO demo agent and NO demo greeting. A landing call rides the same runtime
mind as every other call, and its first line is the ring-time pin's tier ROLE-BLOCK opener (soul.py).
If that opener cannot be built the call FAILS LOUD — it does not fall back to a scripted line.
"""
from __future__ import annotations

import asyncio
import json
import logging
import secrets
import time
import uuid
from typing import Optional

import httpx

import config
import db as supa
import eleven as el_bridge
import twilio_wa as twa
from identity_phone import canon
from identity_phone import is_valid as _is_valid_phone

log = logging.getLogger("rocoto.demo")

try:
    from anthropic import Anthropic
    _anthropic = Anthropic(api_key=config.ANTHROPIC_API_KEY, timeout=45.0, max_retries=1) if config.ANTHROPIC_API_KEY else None
except Exception:  # pragma: no cover
    _anthropic = None

try:
    import phonenumbers
except Exception:  # pragma: no cover
    phonenumbers = None


def configured() -> bool:
    """The call demo is live only when the flag is on AND THE ONE MIND (runtime agent) is available."""
    return bool(config.DEMO_CALL_ENABLED and el_bridge.demo_configured())


def wa_configured() -> bool:
    """The WhatsApp-initiated flow needs the flag + at least the ES template approved."""
    return bool(config.DEMO_CALL_ENABLED and config.WA_TEMPLATE_INTRO_ES)


# ─────────────────────────── session registry (in-proc) ───────────────────────────
class Session:
    def __init__(self, token: str, phone: str, locale: str, name: str, channel: str = "call") -> None:
        self.token = token
        self.phone = phone
        self.locale = locale if locale in ("es", "en") else "es"
        self.name = name
        self.channel = channel
        self.origin = "website_demo"        # where the call was solicited from (§16.5): website_demo | whatsapp_request
        self.has_screen = True              # website callers watch a live transcript; outbound calls don't
        self.call_sid: str = ""
        self.bridge = None
        self.status = "requested"
        self.events: list[dict] = []          # id-tagged event buffer for SSE replay
        self.subs: list[asyncio.Queue] = []    # live subscriber queues
        self.postcall_started = False
        self.closed = False
        self.created = time.time()

    def push(self, kind: str, data: dict) -> None:
        """Append an event (id-tagged) and fan out to live subscribers. Sync + loop-safe."""
        ev = {"id": len(self.events) + 1, "kind": kind, "data": data, "t": time.time()}
        self.events.append(ev)
        for q in list(self.subs):
            try:
                q.put_nowait(ev)
            except Exception:
                pass


_SESSIONS: dict[str, Session] = {}


def get_session(token: str) -> Optional[Session]:
    return _SESSIONS.get(token)


def _gc() -> None:
    """Drop sessions older than 20 min so the registry can't grow unbounded."""
    if len(_SESSIONS) < 200:
        return
    cutoff = time.time() - 1200
    for t in [t for t, s in _SESSIONS.items() if s.created < cutoff]:
        _SESSIONS.pop(t, None)


# ─────────────────────────── rate limiting (XFF-aware) ───────────────────────────
_HITS: dict[str, list[float]] = {}


def _rate_ok(key: str, *, limit: int, window_s: float) -> bool:
    now = time.time()
    hits = [t for t in _HITS.get(key, ()) if now - t < window_s]
    if len(hits) >= limit:
        _HITS[key] = hits
        return False
    hits.append(now)
    _HITS[key] = hits
    if len(_HITS) > 5000:
        for k in list(_HITS)[:1000]:
            _HITS.pop(k, None)
    return True


def client_ip(request) -> str:
    """Behind Caddy, request.client.host is 127.0.0.1 for everyone. Trust X-Forwarded-For's first
    hop ONLY when the direct peer is loopback (Caddy); otherwise use the direct peer."""
    peer = getattr(getattr(request, "client", None), "host", "") or ""
    if peer in ("127.0.0.1", "::1"):
        xff = request.headers.get("x-forwarded-for", "")
        if xff:
            return xff.split(",")[0].strip()
    return peer or "unknown"


def _caller_id_for(phone_e164: str) -> str:
    """Region-matched caller ID — a UK handset only rings from a UK number, IT from IT, etc.
    Falls back to config.DEMO_CALLER_ID for regions with no dedicated number."""
    if phonenumbers is not None and config.DEMO_CALLER_IDS:
        try:
            region = (phonenumbers.region_code_for_number(phonenumbers.parse(phone_e164, None)) or "").upper()
            if region in config.DEMO_CALLER_IDS:
                return config.DEMO_CALLER_IDS[region]
        except Exception:
            pass
    return config.DEMO_CALLER_ID


def _region_allowed(phone_e164: str) -> bool:
    allowed = {c.strip().upper() for c in config.DEMO_ALLOWED_COUNTRIES.split(",") if c.strip()}
    if not allowed:
        return True
    if phonenumbers is None:
        return phone_e164.startswith("+34") if "ES" in allowed else True
    try:
        region = phonenumbers.region_code_for_number(phonenumbers.parse(phone_e164, None))
        return (region or "").upper() in allowed
    except Exception:
        return False


async def _guard(payload: dict, request, *, channel: str) -> tuple[str, str]:
    """Shared validation + rate limits for call/whatsapp. Returns (phone_e164, name).
    Raises ValueError(code) with a machine code the route maps to an HTTP status/message."""
    if (payload.get("website") or "").strip():        # honeypot
        raise ValueError("honeypot")
    if not payload.get("consent"):
        raise ValueError("consent")
    phone = canon(str(payload.get("phone", "")))
    if not _is_valid_phone(phone):
        raise ValueError("bad_phone")
    if not _region_allowed(phone):
        raise ValueError("region")
    # Can't call the number we call FROM (the caller ID) — Twilio rejects from==to. Tell them to use
    # a different number (this is the case when the founder tests with the verified-caller-ID line).
    if _digits(phone) == _digits(config.DEMO_CALLER_ID):
        raise ValueError("same_as_caller")
    # Founder / QA numbers skip the short-window + per-phone caps so we can test end-to-end freely.
    test_nums = {_digits(n) for n in (getattr(config, "DEMO_TEST_NUMBERS", "") or "").split(",") if _digits(n)}
    if _digits(phone) not in test_nums:
        ip = client_ip(request)
        # short-window guards: enough to stop double-taps / hammering, not a 10-minute lockout after one try.
        if not _rate_ok(f"ip10:{ip}", limit=3, window_s=600) or not _rate_ok(f"ipday:{ip}", limit=6, window_s=86400):
            raise ValueError("rate_ip")
        if not _rate_ok(f"ph:{phone}", limit=1, window_s=90):
            raise ValueError("cooldown")
        # durable per-phone cap (survives restarts)
        if await supa.demo_lead_count_for_phone(phone, 24) >= config.DEMO_PHONE_CAP:
            raise ValueError("phone_day")
    # global daily cost cap always applies
    if await supa.demo_leads_count_since(24) >= config.DEMO_DAILY_CAP:
        raise ValueError("daily_cap")
    return phone, (payload.get("name") or "").strip()[:60]


# ─────────────────────────── the call flow ───────────────────────────
async def request_call(payload: dict, request) -> dict:
    _gc()
    phone, name = await _guard(payload, request, channel="call")
    token = secrets.token_urlsafe(16)
    locale = (payload.get("locale") or "es")
    sess = Session(token, phone, locale, name, channel="call")
    _SESSIONS[token] = sess
    await supa.demo_lead_insert({
        "id": str(uuid.uuid4()), "token": token, "channel": "call", "phone": phone,
        "locale": sess.locale, "ip": client_ip(request),
        "user_agent": request.headers.get("user-agent", "")[:300],
        "consent": True, "status": "requested",
    })
    base = config.PUBLIC_BASE_URL
    twiml_url = f"{base}/twilio/voice/demo-answer?token={token}"
    status_cb = f"{base}/twilio/voice/demo-status?token={token}"
    caller_from = _caller_id_for(phone)
    try:
        sid = await twa.start_outbound_call(
            phone, twiml_url, status_cb,
            from_override=caller_from,
            time_limit=config.DEMO_MAX_SECONDS,
        )
    except Exception:
        log.exception("demo: outbound call failed for %s (from=%s)", phone, caller_from)
        raise ValueError("call_failed")
    sess.call_sid = sid
    sess.status = "calling"
    sess.origin = "website_demo"           # from the web «Habla con Rocoto» — there IS a live-transcript screen
    sess.has_screen = True
    await supa.demo_lead_update(token, {"status": "calling", "call_sid": sid})
    sess.push("state", {"state": "calling"})
    await _emit_call_requested(sess, "website")
    log.info("demo call → %s (token=%s sid=%s)", phone, token, sid)
    return {"token": token, "status": "calling"}


def make_on_event(sess: Session):
    """Sync callback handed to the ElevenBridge. Runs on the event loop (the eleven-stream
    coroutine), so queue puts are safe and we can schedule the async post-call pipeline."""
    def _cb(kind: str, payload: dict) -> None:
        if kind in ("line", "subtitle"):
            sess.push(kind, payload)
        elif kind == "ended":
            if not sess.postcall_started:
                sess.postcall_started = True
                asyncio.create_task(run_postcall(sess, payload.get("lines") or []))
    return _cb


def _digits(s: str) -> str:
    """Digits-only canon (module-level — _emit_call_requested NameError'd on the old _guard-local lambda, killing every call.requested event since 2026-07-21)."""
    return "".join(c for c in (s or "") if c.isdigit())


async def _emit_call_requested(sess: Session, solicited_from: str) -> None:
    """A call is a SENSOR event (SPEC §16.5 call.requested) — record its ORIGIN on the person's scope so
    the voice mind knows WHERE it was solicited from and what the person can/can't see. Best-effort."""
    try:
        import runtime
        who = "creator" if _digits(sess.phone) in {_digits(n) for n in (
            config._env("ROCOTO_CREATOR_NUMBERS", "+12025550110")).split(",")} else "prospect"
        await runtime.emit_sense(phone=sess.phone, type="call.requested", source="runtime",
                                 payload={"origin": sess.origin, "has_screen": sess.has_screen,
                                          "solicited_from": solicited_from, "who": who,
                                          "text": f"Llamada solicitada desde {solicited_from} (pantalla={sess.has_screen})."},
                                 dedupe_key=f"callreq:{sess.token}")
    except Exception:
        log.warning("call.requested emit FAILED (call-context block will be empty)", exc_info=True)


def demo_config_override(sess: Session) -> dict:
    """Per-call ElevenLabs override: LANGUAGE ONLY.

    B3 (2026-07-26): the scripted demo/lead-qual first_message is DELETED. It was the line the 2026-07-26
    incident actually put on the wire when the mind was dead. The first thing a caller hears is now
    ALWAYS the ring-time pin's tier ROLE-BLOCK opener (`soul.voice_opener`), injected by
    voice_eleven_stream; if that cannot be built there is no call, not a different greeting."""
    return {"agent": {"language": sess.locale}}


async def place_call_to(phone: str, locale: str = "es", name: str = "") -> dict:
    """Agent-triggered outbound call (the WhatsApp AGENCY layer — Rocoto calls the person NOW via the
    same voice-agent bridge as the web demo). Skips the web form guard (the number is a known contact),
    reuses the demo TwiML + THE ONE runtime agent. Returns {token, sid, status}. Raises on a bad number /
    call failure so the caller (agent_reply) can report honestly.

    B3: no `greeting` argument. The opener is the ring-time pin's tier role block, always — a
    caller-supplied line was already overridden by it in the happy path and only ever surfaced when the
    pin had failed, i.e. exactly when speaking a scripted line was the wrong thing to do."""
    _gc()
    ph = canon(phone)
    if not _is_valid_phone(ph):
        raise ValueError("bad_phone")
    # MODO SOMBRA (SPEC §5.5): a call is the loudest thing the mouth does. It RAISES rather than
    # returning quietly, because the only caller is the mind's `place_call` hand — it must be TOLD
    # (the tool result becomes context) so it stops promising a call that will never ring.
    try:
        import gate
        import runtime
        held = await gate.hold_if_sombra(runtime.scope_of(ph), "call",
                                         f"(llamada a {ph})", detail={"origin": "place_call"})
    except Exception:
        log.exception("place_call_to: sombra resolution failed for %s — REFUSING the call (fail-closed)", ph)
        raise RuntimeError("sombra_unresolved")
    if held:
        raise RuntimeError("modo_sombra")
    token = secrets.token_urlsafe(16)
    loc = locale if locale in ("es", "en") else "es"
    sess = Session(token, ph, loc, name, channel="call")
    sess.origin = "whatsapp_request"      # Rocoto placed this call because they asked on WhatsApp
    sess.has_screen = False                # no browser here — never say "look at your screen"
    _SESSIONS[token] = sess
    await supa.demo_lead_insert({
        "id": str(uuid.uuid4()), "token": token, "channel": "call", "phone": ph,
        "locale": loc, "ip": "", "user_agent": "whatsapp-agent", "consent": True,
        "status": "requested",
    })
    base = config.PUBLIC_BASE_URL
    twiml_url = f"{base}/twilio/voice/demo-answer?token={token}"
    status_cb = f"{base}/twilio/voice/demo-status?token={token}"
    caller_from = _caller_id_for(ph)
    sid = await twa.start_outbound_call(ph, twiml_url, status_cb,
                                        from_override=caller_from, time_limit=config.DEMO_MAX_SECONDS)
    sess.call_sid = sid
    sess.status = "calling"
    await supa.demo_lead_update(token, {"status": "calling", "call_sid": sid})
    await _emit_call_requested(sess, "whatsapp")
    log.info("agent call → %s (token=%s sid=%s)", ph, token, sid)
    return {"token": token, "sid": sid, "status": "calling"}


async def run_postcall(sess: Session, lines: list[dict]) -> None:
    """On call end: extract a summary + personalised CTA with Claude, persist, push to the browser,
    notify Peter. Idempotent, best-effort — never raises into the bridge."""
    try:
        sess.push("state", {"state": "ended"})
        # TRACK 3: no if-creator early-return here. The post-call boss debrief is now `report_call` (a
        # manifest_duty ROW opened by the generic binder on call.ended), and creator-vs-prospect framing
        # is a TIER concern carried by the SOUL — never an if-branch in run_postcall.
        transcript = "\n".join(
            f"{'Cliente' if t.get('speaker') == 0 else 'Agente'}: {t.get('text','')}"
            for t in lines if t.get("text")
        )
        info = _extract(transcript, sess.locale, sess.name)
        wa_url = _wa_url(sess.phone if False else config.DEMO_WA_NUMBER, info.get("wa_prefill", ""))
        await supa.demo_lead_update(sess.token, {
            "status": "completed",
            "name": info.get("name", sess.name) or sess.name,
            "business": info.get("business", ""),
            "summary": info.get("summary", ""),
            "answers": info,
            "cta_text": info.get("cta_message", ""),
            "wa_text": info.get("wa_prefill", ""),
            "lines": lines,
            "ended_at": supa.now_iso(),
        })
        sess.push("post_call", {"message": info.get("cta_message", ""), "wa_url": wa_url})
        # THE RUNTIME DECIDES the follow-up (SPEC agency) — not an unconditional CTA. A live WhatsApp
        # session → a freeform runtime note; a cold web prospect → the approved intro template, only if
        # Rocoto judges it worth it.
        try:
            import runtime
            await runtime.post_call_followup(sess.phone, info.get("summary", ""), transcript,
                                             origin=getattr(sess, "origin", "website_demo"),
                                             name=info.get("name", sess.name))
        except Exception:
            log.debug("post-call followup fail-soft (token=%s)", sess.token, exc_info=True)
        await _notify_peter(sess, info, transcript)
        # A SENSE into the runtime spine (SPEC §7 LIVE CALL / §16.5): the caller becomes a real party
        # the runtime knows — the call transcript + summary land as events on their wa.<digits> scope,
        # so the next WhatsApp turn already remembers the call. Best-effort, never breaks post-call.
        try:
            import runtime
            await runtime.emit_sense(phone=sess.phone, type="call.transcript", source="voice",
                                     payload={"text": info.get("summary", "") or transcript[:1500],
                                              "business": info.get("business", ""), "name": info.get("name", ""),
                                              "channel": "demo_call"},
                                     dedupe_key=f"demo:{sess.token}")
            for f in (info.get("summary", ""),):
                if f:
                    async with runtime.db.scoped_tx(runtime.scope_of(sess.phone)) as _con:
                        import memory as _mem
                        await _mem.write_fact(_con, runtime.scope_of(sess.phone), "RELATION",
                                              f"Habló con Rocoto por teléfono: {f}")
        except Exception:
            log.debug("demo: spine emit fail-soft (token=%s)", sess.token, exc_info=True)
    except Exception:
        log.exception("demo: post-call pipeline failed (token=%s)", sess.token)
        sess.push("post_call", {"message": _fallback_cta(sess.locale), "wa_url": _wa_url(config.DEMO_WA_NUMBER, "")})
    finally:
        sess.closed = True


def _fallback_cta(locale: str) -> str:
    return ("Gracias por la llamada. Escríbenos por WhatsApp y te contamos cómo empezar."
            if locale == "es" else
            "Thanks for the call. Message us on WhatsApp and we'll show you how to start.")


def _extract(transcript: str, locale: str, name: str) -> dict:
    """Claude JSON extraction of {name, business, location, pains, goals, summary, cta_message,
    wa_prefill} in the call's language. Returns a safe fallback on any failure."""
    fb = {"name": name, "business": "", "summary": "",
          "cta_message": _fallback_cta(locale),
          "wa_prefill": ("Hola Rocoto, acabo de probar la demo y quiero empezar."
                         if locale == "es" else
                         "Hi Rocoto, I just tried the demo and want to get started.")}
    if not transcript.strip() or not _anthropic:
        return fb
    lang = "español" if locale == "es" else "English"
    sys = (
        "You read a short discovery call between a Rocoto sales agent and a small food distributor. "
        f"Extract facts and write a warm, personal follow-up in {lang}. Reply with ONLY a JSON object, "
        "keys: name, business, location, hours_per_day, pains (array), goals, summary, cta_message, wa_prefill. "
        "cta_message is 1-2 sentences to show on screen ('Genial, gracias {name}, me encantó conocer {business}...'). "
        "wa_prefill is the first WhatsApp message the visitor would send us. Never invent facts not in the call; "
        "leave a field empty if unknown."
    )
    try:
        msg = _anthropic.messages.create(
            model=config.POLISH_MODEL, max_tokens=800,
            system=sys,
            messages=[{"role": "user", "content": f"Transcript:\n\n{transcript}\n\nReturn the JSON."}],
        )
        out = "".join(b.text for b in msg.content if getattr(b, "type", None) == "text").strip()
        out = out[out.find("{"): out.rfind("}") + 1]
        data = json.loads(out)
        # never render empty placeholders
        if not (data.get("cta_message") or "").strip():
            data["cta_message"] = fb["cta_message"]
        if not (data.get("wa_prefill") or "").strip():
            data["wa_prefill"] = fb["wa_prefill"]
        if not data.get("name"):
            data["name"] = name
        return data
    except Exception:
        log.exception("demo: extraction failed")
        return fb


def _wa_url(number_digits: str, text: str) -> str:
    from urllib.parse import quote
    digits = "".join(ch for ch in (number_digits or "") if ch.isdigit())
    base = f"https://wa.me/{digits}"
    return f"{base}?text={quote(text)}" if text else base


async def _send_visitor_whatsapp(sess: Session) -> None:
    """After the demo call, ACTUALLY open a WhatsApp thread with the VISITOR (Peter's ask). The call
    gives no 24h window, so this is a business-initiated APPROVED template (WA_TEMPLATE_INTRO_ES/EN).
    Best-effort + fail-soft — the on-screen wa.me button remains the fallback; a template hiccup never
    breaks the post-call pipeline. Once the visitor replies, ROCOTO_TEXT_REPLY_ENABLED handles the chat."""
    tmpl = config.WA_TEMPLATE_INTRO_EN if sess.locale == "en" else config.WA_TEMPLATE_INTRO_ES
    if not tmpl or not sess.phone:
        return
    try:
        sid = await twa.send_template(sess.phone, tmpl)
        log.info("demo: intro template sent to visitor %s (sid=%s)", sess.phone, sid)
    except Exception:
        log.exception("demo: visitor whatsapp template send failed (phone=%s)", sess.phone)


async def _notify_peter(sess: Session, info: dict, transcript: str) -> None:
    """Best-effort WhatsApp ping + always-works Resend email so a lead never goes unseen."""
    name = info.get("name") or sess.name or "—"
    biz = info.get("business") or "—"
    summary = info.get("summary") or "(no summary)"
    reply = _wa_url("".join(ch for ch in sess.phone if ch.isdigit()),
                    f"Hola {name}, soy Peter de Rocoto.")
    body = (f"🌶️ Nuevo lead de la demo\nNombre: {name}\nNegocio: {biz}\nTeléfono: {sess.phone}\n"
            f"Resumen: {summary}\nResponder: {reply}")
    if config.DEMO_NOTIFY_PHONE:
        try:
            await twa.send_whatsapp(config.DEMO_NOTIFY_PHONE, body)
        except Exception:
            log.debug("demo: whatsapp notify failed (24h window?)")
    if config.EGRESS_SANDBOX:
        # class-E floor (WP-2.5 rehearsal find): the raw Resend lead-notify must not fire in a rehearsal.
        log.info("[EGRESS_SANDBOX] suppressed demo lead email to %s", config.DEMO_NOTIFY_EMAIL)
        return
    if config.RESEND_API_KEY and config.DEMO_NOTIFY_EMAIL:
        try:
            async with httpx.AsyncClient(timeout=20) as c:
                await c.post("https://api.resend.com/emails",
                             headers={"Authorization": f"Bearer {config.RESEND_API_KEY}", "User-Agent": "rocoto-mailer/1.0"},
                             json={"from": config.DISPATCH_FROM_EMAIL,
                                   "to": [config.DEMO_NOTIFY_EMAIL],
                                   "subject": f"Rocoto demo lead: {name} · {biz}",
                                   "text": body + f"\n\n---\nTranscripción:\n{transcript}"})
        except Exception:
            log.debug("demo: email notify failed")


# ─────────────────────────── SSE ───────────────────────────
async def sse(token: str, last_event_id: int = 0):
    """Server-sent-events generator for the browser. Replays buffered events (id > last_event_id)
    then streams live ones. Closes shortly after post_call / a terminal failure."""
    sess = get_session(token)
    if not sess:
        yield "event: state\ndata: {\"state\":\"failed\"}\n\n"
        return
    q: asyncio.Queue = asyncio.Queue()
    sess.subs.append(q)
    try:
        for ev in list(sess.events):
            if ev["id"] > last_event_id:
                yield _fmt(ev)
        done = False
        while not done:
            try:
                ev = await asyncio.wait_for(q.get(), timeout=15)
                yield _fmt(ev)
                if ev["kind"] == "post_call":
                    done = True
                if ev["kind"] == "state" and ev["data"].get("state") in ("failed", "no_answer", "voicemail"):
                    done = True
            except asyncio.TimeoutError:
                yield ": ping\n\n"
                if sess.closed:
                    done = True
    finally:
        try:
            sess.subs.remove(q)
        except ValueError:
            pass


def _fmt(ev: dict) -> str:
    return f"id: {ev['id']}\nevent: {ev['kind']}\ndata: {json.dumps(ev['data'], ensure_ascii=False)}\n\n"


# ─────────────────────────── hangup / result / status ───────────────────────────
async def hangup(token: str) -> dict:
    sess = get_session(token)
    if not sess:
        return {"ok": False}
    if sess.call_sid:
        await twa.end_call(sess.call_sid)
    sess.push("state", {"state": "ended"})
    return {"ok": True}


async def result(token: str) -> dict:
    row = await supa.demo_lead_get(token)
    sess = get_session(token)
    if not row and not sess:
        return {"status": "unknown"}
    if row and row.get("status") == "completed":
        return {"status": "completed", "message": row.get("cta_text", ""),
                "wa_url": _wa_url(config.DEMO_WA_NUMBER, row.get("wa_text", "")),
                "lines": row.get("lines", [])}
    return {"status": (row or {}).get("status") or (sess.status if sess else "unknown")}


async def on_call_status(token: str, call_status: str, answered_by: str = "") -> None:
    """Twilio status callback → map to SSE state. Voicemail (machine) ends the call early."""
    sess = get_session(token)
    status_map = {"ringing": "ringing", "in-progress": "answered", "answered": "answered",
                  "completed": "ended", "busy": "no_answer", "no-answer": "no_answer",
                  "failed": "failed", "canceled": "failed"}
    st = status_map.get(call_status, call_status)
    if answered_by and answered_by.startswith("machine"):
        st = "voicemail"
        if sess and sess.call_sid:
            await twa.end_call(sess.call_sid)
    if sess:
        sess.status = st
        sess.push("state", {"state": st})
    await supa.demo_lead_update(token, {"status": st})


# ─────────────────────────── WhatsApp-initiated flow ───────────────────────────
async def request_whatsapp(payload: dict, request) -> dict:
    """We message THEM first with the approved intro template, then the browser shows delivery
    status + an Open-WhatsApp button. Degrades to a plain wa.me link if the template isn't set."""
    _gc()
    phone, name = await _guard(payload, request, channel="whatsapp")
    token = secrets.token_urlsafe(16)
    locale = (payload.get("locale") or "es")
    content_sid = config.WA_TEMPLATE_INTRO_EN if locale == "en" else config.WA_TEMPLATE_INTRO_ES
    sess = Session(token, phone, locale, name, channel="whatsapp")
    _SESSIONS[token] = sess
    await supa.demo_lead_insert({
        "id": str(uuid.uuid4()), "token": token, "channel": "whatsapp", "phone": phone,
        "locale": sess.locale, "ip": client_ip(request),
        "user_agent": request.headers.get("user-agent", "")[:300], "consent": True, "status": "requested",
    })
    wa_open = _wa_url(config.DEMO_WA_NUMBER,
                      "Hola Rocoto, vengo de la web y quiero probarte." if locale == "es"
                      else "Hi Rocoto, I came from the site and want to try you out.")
    if not content_sid:
        return {"token": token, "wa_url": wa_open, "sent": False}
    try:
        await twa.send_template(phone, content_sid)
        await supa.demo_lead_update(token, {"status": "sent"})
        sess.status = "sent"
        sess.push("state", {"state": "delivered"})   # optimistic; a status webhook could refine
    except Exception:
        log.exception("demo: template send failed for %s", phone)
    return {"token": token, "wa_url": wa_open, "sent": bool(content_sid)}


def http_status_for(code: str) -> tuple[int, str]:
    """Map a _guard/request ValueError code to (http_status, public message key)."""
    return {
        "honeypot": (200, "ok"),           # silent success for bots
        "consent": (400, "consent_required"),
        "bad_phone": (400, "bad_phone"),
        "region": (400, "region_not_supported"),
        "rate_ip": (429, "too_many"),
        "cooldown": (429, "cooldown"),
        "same_as_caller": (400, "use_a_different_number"),
        "phone_day": (429, "phone_daily"),
        "daily_cap": (429, "busy_today"),
        "call_failed": (502, "call_failed"),
    }.get(code, (400, "error"))
