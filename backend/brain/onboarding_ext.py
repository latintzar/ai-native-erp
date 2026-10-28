"""Rocoto onboarding — endpoint orchestration layer (brain/onboarding_ext.py).

The thin business logic behind the NEW onboarding endpoints, kept out of the 100KB app.py so the
wiring there stays a handful of thin handlers. ADDITIVE + FAIL-SOFT: every function is total and
returns a dict; nothing here raises to the caller or touches the live WhatsApp/order paths. All state
lives ONLY in onboarding_progress.wizard_state (merge-only via jsonb ||) + the isolated ONBOARD_SCHEMA
tables. Reuses brain.onboarding (leads/CRM/email), brain.skuparse (parse), brain.understand (Opus),
brain.calbook (cal.com), brain.wa_watch (WhatsApp flag).
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
import uuid

import anthropic

import config
import db
import transcribe
from brain import calbook, skuparse, wa_watch
from brain import onboarding as ob
from brain import understand as und
from identity_phone import canon

log = logging.getLogger("rocoto.onboarding_ext")


# ─────────────────────────── token + state helpers ───────────────────────────

async def _resolve(con, token: str):
    """(lead_id, wizard_state) for an ACTIVE token, else (None, {}). Non-leaking."""
    tok = await con.fetchrow("select lead_id, status from onboarding_tokens where token = $1", token)
    if not tok or tok["status"] != "active" or not tok["lead_id"]:
        return None, {}
    prog = await con.fetchrow("select wizard_state from onboarding_progress where token = $1", token)
    state = {}
    if prog and prog["wizard_state"]:
        ws = prog["wizard_state"]
        state = ws if isinstance(ws, dict) else (json.loads(ws) if isinstance(ws, str) else {})
    return tok["lead_id"], state


async def merge_state(token: str, patch: dict) -> bool:
    """Merge-only wizard_state update (jsonb ||). Never clobbers the blob the wizard owns. Fail-soft."""
    try:
        pool = db.get_pool()
        async with pool.acquire() as con:
            await con.execute(
                "update onboarding_progress set "
                "wizard_state = coalesce(wizard_state,'{}'::jsonb) || $2::jsonb, "
                "version = version + 1, updated_at = now() where token = $1",
                # dict, NOT json.dumps — asyncpg's jsonb codec encodes once (double-encode → LIST bug).
                token, patch,
            )
        return True
    except Exception:
        log.exception("merge_state failed")
        return False


# ─────────────────────────── catalogue: parse → legit → understand ───────────────────────────

_ASSESS_TOOL = {
    "name": "assess_catalogue",
    "description": "Decide whether these rows are a real food product catalogue / price list.",
    "input_schema": {
        "type": "object",
        "properties": {
            "is_catalogue": {"type": "boolean", "description": "true if these are real products a food distributor sells"},
            "reason": {"type": "string"},
        },
        "required": ["is_catalogue"],
    },
}


def _legit_check_sync(skus: list, filename: str) -> bool:
    """Fast Haiku legit-check. SOFT gate → FAIL-OPEN (True) on any error or when confident enough.
    A big list of named rows is self-evidently a catalogue; only ambiguous small ones hit the model."""
    names = [str((s or {}).get("name") or "").strip() for s in (skus or [])]
    names = [n for n in names if n]
    if not names:
        return False
    if len(names) >= 8:
        return True  # a real list of ≥8 named products — no need to spend a model call
    if not config.ANTHROPIC_API_KEY:
        return True  # soft gate: never block onboarding on a missing key
    try:
        client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY, max_retries=3, timeout=30.0)
        sample = "\n".join(f"- {n}" for n in names[:40])
        resp = client.messages.create(
            model=config.ONBOARD_GATE_MODEL,
            max_tokens=256,
            system=("You judge whether a list of rows is a real food producer-distributor's product "
                    "catalogue/price list (embutidos, charcutería, fruta-verdura, quesos, panadería) "
                    "vs. an unrelated file. Be lenient — partial or short lists of plausible products "
                    "still count."),
            tools=[_ASSESS_TOOL],
            tool_choice={"type": "tool", "name": "assess_catalogue"},
            messages=[{"role": "user", "content": f"Rows from '{filename}':\n{sample}\n\nIs this a product catalogue?"}],
        )
        for block in resp.content:
            if getattr(block, "type", None) == "tool_use" and block.name == "assess_catalogue":
                return bool(block.input.get("is_catalogue", True))
    except Exception:
        log.exception("legit_check failed; failing open (soft gate)")
    return True


async def process_catalogue(token: str, file_path: str, filename: str) -> dict:
    """Parse an uploaded catalogue → skus + count, run the soft Haiku legit-check, persist to
    wizard_state, and (only when legit) fire the heavy Opus understand pass in the background.
    Returns {"ok","count","legit","checking","error"}. Never raises."""
    parsed = await skuparse.parse_catalogue(file_path, filename)
    if not parsed.get("ok") or parsed.get("count", 0) == 0:
        await merge_state(token, {
            "catalogue_submitted": True, "catalogue_legit": False,
            "catalogue_checking": False, "catalogue_count": 0,
            "catalogue_filename": filename,
        })
        return {"ok": False, "count": 0, "legit": False, "checking": False,
                "error": parsed.get("error") or "No pudimos leer productos en el archivo."}

    skus = parsed["skus"]
    count = parsed["count"]
    legit = await asyncio.to_thread(_legit_check_sync, skus, filename)

    await merge_state(token, {
        "skus": skus,
        "catalogue_count": count,
        "catalogue_filename": filename,
        "catalogue_submitted": True,
        "catalogue_legit": legit,
        "catalogue_checking": False,
        "matching_status": "running" if legit else "idle",
    })
    if legit:
        # Heavy Opus pass in the background — the wizard's step-2 polls /matching.
        asyncio.create_task(_understand_bg(token))
    return {"ok": True, "count": count, "legit": legit, "checking": False, "error": ""}


async def _understand_bg(token: str) -> None:
    try:
        await und.understand(token)
    except Exception:
        log.exception("background understand failed for token")
        await merge_state(token, {"matching_status": "error"})


# ─────────────────────────── status + matching readers (wizard polls) ───────────────────────────

async def catalogue_status(token: str) -> dict | None:
    """{submitted, legit, checking} for the mobile→desktop poll. None for a bad token."""
    try:
        pool = db.get_pool()
        async with pool.acquire() as con:
            lead_id, state = await _resolve(con, token)
    except Exception:
        log.exception("catalogue_status failed")
        return {"submitted": False, "legit": None, "checking": False}
    if lead_id is None:
        return None
    return {
        "submitted": bool(state.get("catalogue_submitted")),
        "legit": state.get("catalogue_legit"),
        "checking": bool(state.get("catalogue_checking")),
        "count": int(state.get("catalogue_count") or 0),
    }


async def matching(token: str) -> dict | None:
    """{status, products, unmatched, auto_accept_rules, hold_rules} for step-2 polling. Self-heals: if
    a catalogue is parsed but no matching ran yet, kick understand in the background. None for bad token."""
    try:
        pool = db.get_pool()
        async with pool.acquire() as con:
            lead_id, state = await _resolve(con, token)
    except Exception:
        log.exception("matching read failed")
        return {"status": "error", "products": [], "unmatched": [], "auto_accept_rules": [], "hold_rules": []}
    if lead_id is None:
        return None

    status = state.get("matching_status") or "idle"
    products = state.get("products") if isinstance(state.get("products"), list) else []
    skus = state.get("skus") if isinstance(state.get("skus"), list) else []

    # Self-heal: catalogue present + legit but no products yet (never started, or a prior error/transient
    # LLM outage) → (re)kick the understand pass. Recovers automatically once the LLM is reachable again.
    if skus and state.get("catalogue_legit") and status in ("idle", None, "error") and not products:
        await merge_state(token, {"matching_status": "running"})
        asyncio.create_task(_understand_bg(token))
        status = "running"

    return {
        "status": status,
        "products": products,
        "skus": skus,   # the full parsed catalogue (code/name/family/unit/price) for the add-SKU screen
        "unmatched": state.get("unmatched") if isinstance(state.get("unmatched"), list) else [],
        "auto_accept_rules": state.get("auto_accept_rules") if isinstance(state.get("auto_accept_rules"), list) else [],
        "hold_rules": state.get("hold_rules") if isinstance(state.get("hold_rules"), list) else [],
    }


# ─────────────────────────── QR (desktop→mobile handoff) ───────────────────────────

def qr_svg(data: str) -> str:
    """SVG QR for the personalized link. Uses segno (pure-python) when available; falls back to a
    readable placeholder card so the endpoint never 500s."""
    data = (data or "").strip()
    try:
        import segno
        buf = __import__("io").BytesIO()
        segno.make(data, error="m").save(buf, kind="svg", scale=6, border=2, dark="#1A1413")
        return buf.getvalue().decode("utf-8")
    except Exception:
        log.info("qr_svg: segno unavailable — returning placeholder")
        safe = (data or "").replace("&", "&amp;").replace("<", "&lt;")
        return (
            '<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220" viewBox="0 0 220 220">'
            '<rect width="220" height="220" rx="16" fill="#F2ECE5"/>'
            '<text x="110" y="100" text-anchor="middle" font-family="Inter,sans-serif" font-size="13" '
            'fill="#6F665C">Abre este enlace</text>'
            f'<text x="110" y="124" text-anchor="middle" font-family="monospace" font-size="9" fill="#1A1413">'
            f'{safe[:34]}</text></svg>'
        )


# ─────────────────────────── voice-rule (real mic → Deepgram → Haiku) ───────────────────────────

def _extract_rule_sync(spoken: str, kind: str) -> str:
    """Haiku: turn spoken Spanish into ONE short accept/hold rule line. Returns the raw spoken text
    on any failure (so the customer's words are never lost)."""
    spoken = (spoken or "").strip()
    if not spoken:
        return ""
    if not config.ANTHROPIC_API_KEY:
        return spoken
    what = "aceptar un pedido automáticamente" if kind == "accept" else "dejar un pedido a confirmar"
    try:
        client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY, max_retries=3, timeout=30.0)
        resp = client.messages.create(
            model=config.ONBOARD_GATE_MODEL,
            max_tokens=120,
            system=(f"Conviertes lo que dice un distribuidor de alimentación en UNA regla corta y clara "
                    f"(en español, máx 12 palabras) sobre cuándo {what}. Devuelve SOLO la regla, sin comillas."),
            messages=[{"role": "user", "content": spoken}],
        )
        out = "".join(b.text for b in resp.content if getattr(b, "type", None) == "text").strip()
        return out or spoken
    except Exception:
        log.exception("voice-rule extraction failed; returning raw speech")
        return spoken


async def voice_rule(token: str, audio_bytes: bytes, content_type: str, kind: str) -> dict:
    """Real voice-edit: Deepgram STT on the recorded clip → Haiku extracts one accept/hold rule.
    Returns {"ok","rule","transcript"}. Never raises."""
    kind = kind if kind in ("accept", "hold") else "accept"
    try:
        pool = db.get_pool()
        async with pool.acquire() as con:
            lead_id, _ = await _resolve(con, token)
        if lead_id is None:
            return {"ok": False, "rule": "", "transcript": "", "error": "not_found"}
    except Exception:
        log.exception("voice_rule token resolve failed")
        return {"ok": False, "rule": "", "transcript": "", "error": "error"}

    if not audio_bytes:
        return {"ok": False, "rule": "", "transcript": "", "error": "no_audio"}
    try:
        dg = await transcribe.deepgram_diarize(audio_bytes, content_type or "audio/webm")
        raw, _utts = transcribe.parse_utterances(dg)
    except Exception:
        log.exception("voice_rule deepgram failed")
        return {"ok": False, "rule": "", "transcript": "", "error": "stt_failed"}
    # strip 'Speaker N:' prefixes for the rule extractor
    spoken = re.sub(r"(?m)^Speaker \d+:\s*", "", raw or "").strip()
    if not spoken:
        return {"ok": False, "rule": "", "transcript": "", "error": "empty"}
    rule = await asyncio.to_thread(_extract_rule_sync, spoken, kind)
    return {"ok": True, "rule": rule, "transcript": spoken}


# ─────────────────────────── send catalogue-step email (mobile→desktop) ───────────────────────────

async def send_catalogue_step(token: str) -> dict:
    """Email the customer the deep-link to open the catalogue step on their computer. Never raises."""
    try:
        pool = db.get_pool()
        async with pool.acquire() as con:
            lead_id, _ = await _resolve(con, token)
            if lead_id is None:
                return {"ok": False, "error": "not_found"}
            lead = await con.fetchrow("select name, email from leads where id = $1", lead_id)
    except Exception:
        log.exception("send_catalogue_step resolve failed")
        return {"ok": False, "error": "error"}
    to = (lead["email"] if lead else "") or ""
    if not to:
        return {"ok": False, "error": "no_email"}
    name = ((lead["name"] or "").split(" ")[0]) if lead and lead["name"] else ""
    # ?up=1 → the recipient (a computer) lands straight on the dropzone. Keeps the hand-off solid.
    url = f"{ob.PUBLIC_BASE_URL}/onboarding/{token}?up=1"
    greeting = f"Hola {name}," if name else "Hola,"
    body = (
        f"<p>{greeting}</p>"
        "<p>Para subir tu catálogo necesitas tu <strong>ordenador</strong> (ahí tienes el Excel/CSV de tu programa). "
        "Abre este enlace en el ordenador y sigue justo donde lo dejaste — se guarda solo.</p>"
    )
    res = await ob._send(to, "Sube tu catálogo desde el ordenador · Rocoto",
                         ob._shell("Ábrelo en tu ordenador", body, "Abrir en el ordenador", url))
    return {"ok": bool(res.get("ok")), "error": res.get("error", "")}


# ─────────────────────────── ConvAI voice-agent server tools ───────────────────────────

async def agent_lead(payload: dict) -> dict:
    """Server tool: upsert a lead from what the ConvAI agent learned mid-call → CRM write. Never raises."""
    p = payload or {}
    phone = str(p.get("phone") or "").strip()
    if not phone:
        return {"ok": False, "error": "phone required"}
    try:
        lead = await ob.create_lead(
            phone=phone,
            name=str(p.get("name") or ""),
            business=str(p.get("company") or p.get("business") or ""),
            email=str(p.get("email") or ""),
            ref="demo-voice",
        )
        notes = str(p.get("notes") or p.get("business_notes") or "").strip()
        if notes:
            await ob.log_event(lead["id"], "agent_note", {"notes": notes}, actor="convai")
        return {"ok": True, "lead_id": lead["id"], "status": lead["status"]}
    except ValueError as e:
        return {"ok": False, "error": str(e)}
    except Exception:
        log.exception("agent_lead failed")
        return {"ok": False, "error": "error"}


async def agent_slots(payload: dict) -> dict:
    """Server tool: Peter's next open cal.com slots so the agent can offer real times."""
    days = 7
    try:
        days = int((payload or {}).get("days") or 7)
    except (TypeError, ValueError):
        days = 7
    res = await calbook.list_slots(days=days)
    if not res.get("ok"):
        return {"ok": False, "slots": [], "error": res.get("error", "")}
    return {"ok": True, "slots": res.get("slots", [])}


async def agent_book(payload: dict) -> dict:
    """Server tool: book A CALL WITH PETER via cal.com, upsert+advance the lead. Never raises."""
    p = payload or {}
    phone = str(p.get("phone") or "").strip()
    start = str(p.get("start") or p.get("start_iso") or "").strip()
    name = str(p.get("name") or "")
    email = str(p.get("email") or "")
    if not start:
        return {"ok": False, "error": "start required"}
    booking = await calbook.create_booking(name=name, email=email, phone=phone, start_iso=start)
    if not booking.get("ok"):
        return {"ok": False, "error": booking.get("error", "booking_failed")}
    uid = booking.get("uid", "")
    # Upsert the lead + advance to call_booked (best-effort; the booking already succeeded).
    lead_id = None
    if phone:
        try:
            lead = await ob.create_lead(phone=phone, name=name, business=str(p.get("company") or p.get("business") or ""),
                                        email=email, ref="demo-voice")
            lead_id = lead["id"]
            poolc = db.get_pool()
            async with poolc.acquire() as con:
                await con.execute(
                    "update leads set status='call_booked', cal_booking_ref=$2, updated_at=now() "
                    "where id=$1 and status in ('signed_up','call_booked')",
                    lead_id, str(uid),
                )
            await ob.log_event(lead_id, "call_booked", {"uid": uid, "via": "convai"}, actor="convai")
        except Exception:
            log.exception("agent_book lead advance failed (booking still ok)")
    return {"ok": True, "uid": uid, "lead_id": lead_id}


# ─────────────────────────── ConvAI post-call webhook ───────────────────────────

def _dig_phone(obj, depth: int = 0):
    """Recursively hunt a phone-like value in the ConvAI post-call payload. Best-effort."""
    if depth > 6 or obj is None:
        return None
    if isinstance(obj, str):
        s = obj.strip()
        if re.fullmatch(r"\+?\d[\d\s\-().]{6,}", s):
            c = canon(s)
            return c if c.startswith("+") else None
        return None
    if isinstance(obj, dict):
        for k in ("external_number", "caller_id", "from", "phone", "phone_number", "to_number", "from_number"):
            if k in obj:
                r = _dig_phone(obj[k], depth + 1)
                if r:
                    return r
        for v in obj.values():
            r = _dig_phone(v, depth + 1)
            if r:
                return r
    if isinstance(obj, (list, tuple)):
        for v in obj:
            r = _dig_phone(v, depth + 1)
            if r:
                return r
    return None


def _transcript_text(data: dict) -> str:
    """Flatten a ConvAI transcript array into 'Cliente:/Agente:' lines. Tolerant of shape drift."""
    turns = data.get("transcript")
    if not isinstance(turns, list):
        return ""
    lines = []
    for t in turns:
        if not isinstance(t, dict):
            continue
        role = str(t.get("role") or t.get("speaker") or "").lower()
        raw = t.get("message")
        if not isinstance(raw, str):
            raw = t.get("text") if isinstance(t.get("text"), str) else t.get("content")
        msg = raw.strip() if isinstance(raw, str) else ""
        if not msg:
            continue
        who = "Agente" if role in ("agent", "assistant", "ai") else "Cliente"
        lines.append(f"{who}: {msg}")
    return "\n".join(lines)


async def agent_postcall(payload: dict) -> dict:
    """ConvAI post-call webhook → attach the full transcript to the matching Rocoto lead. Never raises."""
    body = payload or {}
    data = body.get("data") if isinstance(body.get("data"), dict) else body
    conv_id = str(data.get("conversation_id") or data.get("conversationId") or body.get("conversation_id") or uuid.uuid4().hex)
    phone = _dig_phone(body)
    transcript = _transcript_text(data)
    if not phone:
        log.info("agent_postcall: no phone in payload conv=%s", conv_id)
        return {"ok": True, "matched": False}
    try:
        pool = db.get_pool()
        async with pool.acquire() as con:
            lead = await con.fetchrow("select id, status from leads where phone = $1", phone)
            if not lead:
                return {"ok": True, "matched": False}
            note_path = f"convai:{conv_id}"
            call_id = f"call_{uuid.uuid4().hex[:16]}"
            inserted = await con.fetchval(
                "insert into calls_onboard (id, lead_id, phone, note_path, transcript, raw_transcript, kind) "
                "values ($1,$2,$3,$4,$5,$6,'voice-agent') on conflict (note_path) do nothing returning id",
                call_id, lead["id"], phone, note_path, transcript, transcript,
            )
            if inserted and (lead["status"] or "") in ("signed_up", "call_booked"):
                await con.execute("update leads set status='called', updated_at=now() where id=$1", lead["id"])
        await ob.log_event(lead["id"], "convai_postcall", {"conversation_id": conv_id, "chars": len(transcript)}, actor="convai")
        return {"ok": True, "matched": True, "lead_id": lead["id"]}
    except Exception:
        log.exception("agent_postcall failed")
        return {"ok": True, "matched": False}


# ─────────────────────────── try-it-live config ───────────────────────────

async def trylive_config() -> dict:
    """Public: whether the WhatsApp 'Get a message' path is live yet (flag + template gated)."""
    try:
        enabled = await wa_watch.is_message_enabled()
    except Exception:
        enabled = False
    has_template = bool((getattr(config, "WA_TEMPLATE_INTRO_ES", "") or "").strip())
    return {"get_a_message_enabled": bool(enabled and has_template)}


# ─────────────────────────── native cal booking (design-controlled signup modal) ───────────────────────────

async def public_slots(days: int = 7) -> dict:
    """Public: Peter's open cal.com slots for the native booker in the signup modal. Never raises."""
    try:
        d = int(days)
    except (TypeError, ValueError):
        d = 7
    return await calbook.list_slots(days=max(1, min(d, 21)))


async def public_book(lead_id: str, start: str) -> dict:
    """Public: book a call for a signed-up lead at `start` (from public_slots). Idempotent — a lead
    that already booked isn't rebooked. Never raises. Returns {ok, uid?, start?, already?, error?}."""
    lead_id = (lead_id or "").strip()
    start = (start or "").strip()
    if not lead_id or not start:
        return {"ok": False, "error": "missing lead_id or start"}
    try:
        lead = await ob.get_lead(lead_id)
    except Exception:
        log.exception("public_book get_lead failed")
        return {"ok": False, "error": "error"}
    if not lead:
        return {"ok": False, "error": "not_found"}
    # idempotent: don't rebook a lead that's already booked / further along.
    if lead.get("cal_booking_ref") or (lead.get("status") or "") not in ("signed_up", "call_booked"):
        return {"ok": True, "already": True, "start": start}
    booking = await calbook.create_booking(
        name=lead.get("name", ""), email=lead.get("email", ""),
        phone=lead.get("phone", ""), start_iso=start,
    )
    if not booking.get("ok"):
        return {"ok": False, "error": booking.get("error", "booking_failed")}
    uid = booking.get("uid", "")
    try:
        pool = db.get_pool()
        async with pool.acquire() as con:
            await con.execute(
                "update leads set status='call_booked', cal_booking_ref=$2, "
                "cal_booking_start=$3::timestamptz, updated_at=now() "
                "where id=$1 and status in ('signed_up','call_booked')",
                lead_id, str(uid), start,
            )
        await ob.log_event(lead_id, "call_booked", {"uid": uid, "via": "signup-modal", "start": start}, actor="public")
    except Exception:
        log.exception("public_book lead advance failed (booking succeeded)")
    return {"ok": True, "uid": uid, "start": start}


async def public_reschedule(lead_id: str, start: str) -> dict:
    """Public: move a lead's existing booking to a new slot. If the lead never booked, falls through
    to a fresh booking (public_book). Otherwise calls cal.com's native reschedule, then mirrors the
    (possibly new) uid + start into leads. Never raises. Returns {ok, uid?, start?, error?}."""
    lead_id = (lead_id or "").strip()
    start = (start or "").strip()
    if not lead_id or not start:
        return {"ok": False, "error": "missing lead_id or start"}
    try:
        lead = await ob.get_lead(lead_id)
    except Exception:
        log.exception("public_reschedule get_lead failed")
        return {"ok": False, "error": "error"}
    if not lead:
        return {"ok": False, "error": "not_found"}
    uid = (lead.get("cal_booking_ref") or "").strip()
    if not uid:
        # never booked → book fresh instead of rescheduling a nonexistent booking
        return await public_book(lead_id, start)
    res = await calbook.reschedule_booking(uid, start)
    if not res.get("ok"):
        return {"ok": False, "error": res.get("error", "reschedule_failed")}
    new_uid = res.get("uid", uid)
    try:
        pool = db.get_pool()
        async with pool.acquire() as con:
            await con.execute(
                "update leads set cal_booking_ref=$2, cal_booking_start=$3::timestamptz, "
                "updated_at=now() where id=$1",
                lead_id, str(new_uid), start,
            )
        await ob.log_event(lead_id, "call_rescheduled", {"uid": new_uid, "start": start}, actor="public")
    except Exception:
        log.exception("public_reschedule lead update failed (reschedule succeeded)")
    return {"ok": True, "uid": new_uid, "start": start}
