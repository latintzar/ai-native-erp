"""try_chat.py — «Prueba la IA» / "Try the AI" (SITE-V2-PLAN.md §6, WP-E).

The public "Try the AI" widget's backend: a REAL chat, not a prop. It runs the exact same
event-sourced cycle a live WhatsApp customer's message runs through (runtime.run_turn — ingest,
assemble, the mind, the §5 money gate, append), so what a visitor sees is genuinely how Rocoto takes
an order — not a scripted reply table (the old mockups/platform-landing.html `reply()` canned-response
function this replaces).

Four guardrails, all mandatory per the spec, and why each one is where it is:

  1. SCOPE ISOLATION — every session is pinned to `test.try.<session_id>`. That prefix does three
     things at once, for free, via existing kernel behaviour this module does not reimplement:
       · runtime.run_turn tags every write lineage=test (it checks `scope.startswith("test.")`).
       · agent_reply's tool gates run with egress_stub=True (see guardrail 4 below).
       · tenancy.tenant_of has a narrow, explicit "test.try." branch (added alongside this module)
         that resolves to config.TRY_CHAT_DEMO_TENANT — NEVER config.BRAIN_TENANT. Without that
         branch, every catalogue/order lookup for an unrecognised scope shape falls back to
         BRAIN_TENANT, which would ground a random internet visitor's "order" against Peter's REAL
         supplier catalogue and prices. That is the one bug this module cannot afford to have.
     The scope never collides with a real `t.<tenant>...`, `wa.<phone>` or `test.persona.*` scope,
     and RLS (db.scoped_tx sets `rocoto.scope` as a transaction-local GUC) enforces that at the
     database layer independent of anything above getting it right.

  2. RATE LIMITS — per-IP and per-session sliding windows (same shape as app.py's `_shop_rate_ok`
     for the public shop endpoints — no new dependency, one more instance of an existing pattern).

  3. TURN CAP — a hard per-session ceiling. Hitting it (or a session already closed) short-circuits
     BEFORE runtime.run_turn is ever called — no mind, no LLM spend — and returns a friendly close
     with a Get-started nudge, never a bare cutoff.

  4. THE JUNK GATE — brain.junkgate.is_junk() runs before the mind is invoked: a bare "hola" or
     "gracias" gets an instant, free, deterministic nudge back ("order like your restaurant would"),
     never burns a turn, and never reaches runtime.run_turn. (The per-IP/session rate limit above
     still counts a junk message against the visitor's window — that's an infra guard against
     request-volume abuse, independent of "is this worth the mind's attention"; the two checks
     protect different things and are ordered accordingly, see `chat()`.)

NO MONEY ACTIONS: `agent_reply`'s only take_order path calls `orders_tool.place_order(..., approved=False)`
unconditionally (SPEC §0/§5.0.1 — placing is gated agency, never autonomous from a chat turn) — it
always PARKS an action for human review, never writes to Medusa. That is existing runtime behaviour,
not something this module adds.

NO OUTBOUND ANYTHING: this module never calls the real dispatch functions itself (no WhatsApp/email/
SMS/voice send for `out["text"]` — the HTTP response IS the delivery, there is no second channel), and
egress_stub=True makes every TOOL the mind could call (send_email, escalate, react, ask_options,
send_image, place a call) return a "pretend it happened" sandbox result instead of touching a real
rail (agent_reply.py's `if egress_stub: ... else: <real send>` gates).
"""
from __future__ import annotations

import logging
import re
import secrets
import time
from typing import Any, Optional

import config
import db

log = logging.getLogger("rocoto.try_chat")

DEMO_TENANT = config.TRY_CHAT_DEMO_TENANT

# The fictional distributor already established across the landing (HeroPhone.tsx's "Cárnicas
# Aldonza" WhatsApp scene, mockups/platform-landing.html's canned reply() price list) — so the demo
# widget's product vocabulary and prices are CONTINUOUS with what a visitor has just been looking at
# on the page, not a second, unrelated fake business. Prices mirror the mockup's canned list where
# the same product appears (chorizo extra 8,90 €/kg, lomo embuchado 21,50 €/kg, alitas de pavo
# 6,40 €/kg) and extend it with the rest of HeroPhone's line-up at the same register.
DEMO_SKUS: list[dict[str, Any]] = [
    {"name": "Jamón ibérico de bellota", "family": "jamon", "price": 34.0},
    {"name": "Chorizo ibérico extra", "family": "embutido", "price": 8.9},
    {"name": "Lomo embuchado", "family": "embutido", "price": 21.5},
    {"name": "Panceta ibérica", "family": "carne", "price": 7.5},
    {"name": "Costillas de cerdo", "family": "carne", "price": 6.4},
    {"name": "Morcilla de Burgos", "family": "embutido", "price": 9.2},
    {"name": "Alitas de pavo", "family": "carne", "price": 6.4},
    {"name": "Solomillo ibérico", "family": "carne", "price": 18.5},
]

_SEED_LOCK_KEY = "rocoto:try_chat_demo_seed"
_seeded_ok = False  # in-proc fast path once seeding is confirmed — skips the count() query entirely


async def ensure_demo_catalogue() -> None:
    """Idempotent: seed TRY_CHAT_DEMO_TENANT's catalogue once (lazy, on first use — no separate
    provisioning step to forget). A pg_advisory_xact_lock makes concurrent first-requests (several
    visitors opening the widget the same minute the box restarts) seed exactly once, never a race of
    duplicate SKUs. Reuses brain.catalogue.create_sku — the SAME embedding + FTS + alias pipeline a
    real onboarding uses — so grounding works the same way it does for a paying tenant."""
    global _seeded_ok
    if _seeded_ok:
        return
    pool = db.get_pool()
    async with pool.acquire() as con:
        n = await con.fetchval("select count(*) from catalogue_skus where tenant_id=$1", DEMO_TENANT)
        if n and n > 0:
            _seeded_ok = True
            return
        async with con.transaction():
            await con.execute("select pg_advisory_xact_lock(hashtext($1))", _SEED_LOCK_KEY)
            # re-check under the lock: another worker may have won the race while we waited for it.
            n = await con.fetchval(
                "select count(*) from catalogue_skus where tenant_id=$1", DEMO_TENANT)
            if n and n > 0:
                _seeded_ok = True
                return
            await con.execute(
                "insert into tenants(slug,name,tagline,status,seeded,country) "
                "values($1,$2,$3,'test',true,'ES') on conflict (slug) do nothing",
                DEMO_TENANT, "Cárnicas Aldonza (demo)",
                "El catálogo de prueba de «Prueba la IA» — nunca un cliente real")
            from brain import catalogue as brain_catalogue
            for sku in DEMO_SKUS:
                try:
                    await brain_catalogue.create_sku(
                        con, DEMO_TENANT, name=sku["name"], family=sku["family"],
                        base_unit="kg", price=sku["price"], generate_code=True, in_assortment=True)
                except Exception:
                    log.exception("try_chat: seeding %r failed (fail-soft, continuing)", sku["name"])
    try:
        import directory
        await directory.build(DEMO_TENANT, force=True)
    except Exception:
        log.debug("try_chat: directory.build fail-soft", exc_info=True)
    _seeded_ok = True


# ── rate limiting — same shape as app.py's public-shop `_shop_rate_ok` ──────────────────────────────
_HITS: dict[str, list[float]] = {}


def _rate_ok(key: str, *, limit: int, window_s: float) -> bool:
    now = time.time()
    hits = [t for t in _HITS.get(key, ()) if now - t < window_s]
    if len(hits) >= limit:
        _HITS[key] = hits
        return False
    hits.append(now)
    _HITS[key] = hits
    if len(_HITS) > 5000:  # bound memory
        for k in list(_HITS)[:1000]:
            _HITS.pop(k, None)
    return True


# ── per-session state (turn cap) — in-proc, bounded, matches _HITS' housekeeping ────────────────────
_SESSIONS: dict[str, dict[str, Any]] = {}
_SESSION_ID_RE = re.compile(r"[^0-9a-f]")


def new_session_id() -> str:
    return secrets.token_hex(8)  # ltree-label-safe (hex only, no hyphens) — an ltree label rejects '-'


def _session(session_id: str) -> dict[str, Any]:
    s = _SESSIONS.get(session_id)
    if s is None:
        s = {"turns": 0, "created": time.time(), "closed": False}
        _SESSIONS[session_id] = s
        if len(_SESSIONS) > 5000:
            for k in list(_SESSIONS)[:1000]:
                _SESSIONS.pop(k, None)
    return s


_CLOSE = {
    "es": "Hasta aquí llega la demo — para verlo contra tu propio catálogo, dale a «Empezar» y lo montamos con tus productos de verdad.",
    "en": "That's the demo — to see it against your own catalogue, hit Get started and we'll set it up with your real products.",
}
_NUDGE = {
    "es": "Prueba a pedirme algo como lo haría uno de tus restaurantes — p. ej. «6 kg de chorizo y 4 de lomo para el viernes».",
    "en": 'Try ordering something the way one of your restaurants would — e.g. "6 kg of chorizo and 4 of loin for Friday".',
}


async def _stub_call(phone: str, lang: str = "es", name: str = "") -> dict:
    """Never dials a real number — the same sandbox stub control_room.persona_send uses."""
    return {"token": "test", "sid": "TEST-STUB", "status": "would_call"}


async def _fetch_drafted_order(scope: str) -> Optional[dict[str, Any]]:
    """The full grounded sheet {lines,total,currency} for the latest order this turn drafted — read
    back from the order.drafted event orders_tool.draft_order appends (agent_reply's `actions` list
    only carries {lines: n, unmatched: n} counts, not the priced lines a card needs to render)."""
    try:
        async with db.scoped_tx(scope) as con:
            row = await con.fetchrow(
                "select payload from event where scope=$1::ltree and type='order.drafted' "
                "order by id desc limit 1", scope)
        if not row or not row["payload"]:
            return None
        p = row["payload"]
        if isinstance(p, str):
            import json as _json
            p = _json.loads(p)
        lines = [l for l in (p.get("lines") or []) if l.get("name")]
        if not lines:
            return None
        return {"lines": lines, "total": p.get("total"), "currency": p.get("currency") or "eur"}
    except Exception:
        log.exception("try_chat: order fetch failed for scope %s", scope)
        return None


async def chat(*, session_id: Optional[str], text: str, ip: str, lang: str = "es") -> dict[str, Any]:
    """One turn of the public demo chat. Never raises — every failure mode returns a JSON-safe dict
    with `ok` set so the endpoint can always answer 200 (rate-limit/`ok:False` maps to 429 there)."""
    lang = "en" if lang == "en" else "es"
    text = (text or "").strip()[:1000]
    session_id = _SESSION_ID_RE.sub("", (session_id or "").strip())[:32] or new_session_id()
    sess = _session(session_id)

    # ── guardrail 2 (rate limits) — an infra guard against request VOLUME, independent of content;
    # runs before the junk gate on purpose so a flood of junk can still be throttled, not just nudged
    # forever for free. ────────────────────────────────────────────────────────────────────────────
    if not _rate_ok(f"ip:{ip}", limit=config.TRY_CHAT_IP_LIMIT, window_s=config.TRY_CHAT_IP_WINDOW_S):
        return {"ok": False, "error": "rate_limited", "session_id": session_id, "reply": "",
                "order": None, "turns_used": sess["turns"], "turns_left": 0, "closed": sess["closed"]}
    if not _rate_ok(f"sess:{session_id}", limit=config.TRY_CHAT_SESSION_LIMIT,
                    window_s=config.TRY_CHAT_SESSION_WINDOW_S):
        return {"ok": False, "error": "rate_limited", "session_id": session_id, "reply": "",
                "order": None, "turns_used": sess["turns"], "turns_left": 0, "closed": sess["closed"]}

    # ── guardrail 3 (turn cap) — before the mind is ever touched. ──────────────────────────────────
    turns_left = max(0, config.TRY_CHAT_MAX_TURNS - sess["turns"])
    if sess["closed"] or turns_left <= 0:
        sess["closed"] = True
        return {"ok": True, "session_id": session_id, "reply": _CLOSE[lang], "order": None,
                "turns_used": sess["turns"], "turns_left": 0, "closed": True}

    # ── guardrail 4 (junk gate) — before the mind is ever touched: no LLM call, no runtime write. ──
    from brain import junkgate
    junk, _reason = junkgate.is_junk(text, has_media=False)
    if junk:
        return {"ok": True, "session_id": session_id, "reply": _NUDGE[lang], "order": None,
                "turns_used": sess["turns"], "turns_left": turns_left, "closed": False}

    await ensure_demo_catalogue()

    # ── guardrail 1 (scope isolation) — see the module docstring. ───────────────────────────────────
    scope = f"test.try.{session_id}"
    fake_phone = "+000" + re.sub(r"[^0-9]", "", session_id)[:11].ljust(11, "0")

    try:
        async with db.scoped_tx(scope) as con:
            await con.execute(
                "insert into scope_node(scope,tier,tenant_slug,lineage) values($1::ltree,'customer',$2,'test') "
                "on conflict (scope) do nothing", scope, DEMO_TENANT)
            await con.execute(
                "insert into card(scope,body,version,lineage) values($1::ltree,'',0,'test') "
                "on conflict (scope) do nothing", scope)
    except Exception:
        log.exception("try_chat: scope bootstrap failed for %s", scope)

    import runtime
    try:
        out = await runtime.run_turn(
            fake_phone, text, place_call_fn=_stub_call, scope_override=scope,
            egress_stub=True, source="try_chat")
    except Exception:
        log.exception("try_chat: run_turn failed for scope %s", scope)
        return {"ok": False, "error": "runtime_error", "session_id": session_id, "reply": "",
                "order": None, "turns_used": sess["turns"], "turns_left": turns_left, "closed": False}

    sess["turns"] += 1
    reply = (out.get("text") or out.get("force_text") or "").strip()

    order = None
    if any(a.get("take_order") for a in (out.get("actions") or [])):
        order = await _fetch_drafted_order(scope)
        if not reply:
            reply = ("Recibido — déjame confirmarlo con tu proveedor y te digo enseguida."
                      if lang == "es" else "Got it — let me confirm that and I'll get right back to you.")

    turns_left = max(0, config.TRY_CHAT_MAX_TURNS - sess["turns"])
    closed = turns_left <= 0
    if closed:
        sess["closed"] = True
        reply = (reply + "\n\n" + _CLOSE[lang]).strip()

    return {"ok": True, "session_id": session_id, "reply": reply, "order": order,
            "turns_used": sess["turns"], "turns_left": turns_left, "closed": closed}
