"""Re-engagement drip — the abandoned-signup email ladder.

A lead is ENROLLED (idempotently) the moment they authenticate or hit /api/signup. A systemd timer
(`python -m brain.drip run-due`, every 15 min) walks a fixed ladder of touches and stops the instant
the lead books the call, unsubscribes, or ages past 7 days:

    +2h  (t2h) → "still here — 2 min to book"
    +1d  (d1)  → "pick a time this week"
    +3d  (d3)  → value reminder + WhatsApp-first nudge
    +7d  (d7)  → last email, WhatsApp-forward, then stop

LANDS DARK: with config.DRIP_ENABLED off, `run-due` is a no-op and every enrolment/completion hook is
guarded so nothing can perturb the live signup / booking / auth paths. Everything is fail-soft.

Additive + isolated: touches only the `drip_state` table (ONBOARD_SCHEMA) + reads `leads`. Reuses
onboarding._send (Resend) + onboarding._shell (branded email chrome). Auth link via the Supabase admin
generate_link endpoint (service_role key), with a plain deep-link fallback.
"""
from __future__ import annotations

import logging
import secrets
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import quote

import httpx

import config
import consent as _consent
import db
from brain import onboarding as _ob

log = logging.getLogger("rocoto.drip")

# ── §17.56c · THE MARKETING GATE (the one enforcement point, called from the one send path) ──────
# `DRIP_REQUIRE_CONSENT` exists so the gate can be OBSERVED before it bites: with it off the ladder
# behaves exactly as it did, and every refusal it WOULD have made is logged. It defaults ON, because
# the safe default for «may we mail this person marketing?» is no. Turning it off is a deliberate,
# temporary act with a paper trail, not a shrug.
DRIP_REQUIRE_CONSENT = (config._env("DRIP_REQUIRE_CONSENT", "1") or "1").strip() != "0"


async def _consent_ok(email: str) -> bool:
    """May this ladder mail this address? consent.may_send_marketing is the whole answer; it
    fail-CLOSES on any error, which is the correct asymmetry for a send."""
    ok = await _consent.may_send_marketing(email)
    if not ok and not DRIP_REQUIRE_CONSENT:
        log.warning("drip: %s has NO marketing consent — sending anyway "
                    "(DRIP_REQUIRE_CONSENT=0, observation mode)", email)
        return True
    return ok

# ── the ladder: (send_key, hours-from-enrolled_at). Data so it's tunable without code. ──
# Step 1 (t2h) reads config.DRIP_STEP1_HOURS at fire-time (default 2); the DB "is it due" math uses the
# same 2-hour offset (see the run-due query) — override in lockstep if you change the default.
DRIP_LADDER = [
    ("t2h", 2),        # step 1
    ("d1", 24),        # step 2
    ("d3", 72),        # step 3
    ("d7", 168),       # step 4 (final)
]
DRIP_STOP_AFTER_HOURS = 168  # hard stop: >7d since enrolment, regardless of step

# next_send_key after the given key (None after the final rung).
_NEXT_KEY = {"t2h": "d1", "d1": "d3", "d3": "d7", "d7": None}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _wa_url(number_digits: str, text: str) -> str:
    """wa.me deep link (copied verbatim from demo_call._wa_url to avoid importing that heavy module)."""
    digits = "".join(ch for ch in (number_digits or "") if ch.isdigit())
    base = f"https://wa.me/{digits}"
    return f"{base}?text={quote(text)}" if text else base


def _is_completed(lead: dict) -> bool:
    """Single source of truth for 'the lead reached the funnel end' (booked the call). Used by the
    reconciler + the enrol guard. Booked ⇒ cal_booking_ref set OR status advanced past signed_up."""
    return bool(lead.get("cal_booking_ref")) or lead.get("status") not in ("signed_up",)


# ─────────────────────────── enrolment / completion ───────────────────────────

async def enroll(lead_id: str) -> dict | None:
    """Idempotently enrol a lead into the drip. Sets next_send_key='t2h', enrolled_at=now(), mints an
    unsub_token. `on conflict do nothing` so a repeat enrol is a no-op. Fail-soft (never raises)."""
    lead_id = (lead_id or "").strip()
    if not lead_id:
        return None
    try:
        pool = db.get_pool()
        unsub = secrets.token_urlsafe(18)
        async with pool.acquire() as con:
            await con.execute(
                "insert into drip_state (lead_id, status, step, enrolled_at, next_send_key, unsub_token) "
                "values ($1, 'active', 0, now(), 't2h', $2) "
                "on conflict (lead_id) do nothing",
                lead_id, unsub,
            )
            row = await con.fetchrow("select lead_id, status, next_send_key from drip_state where lead_id = $1", lead_id)
        return dict(row) if row else None
    except Exception:  # pragma: no cover — enrolment must never break the signup/auth path
        log.exception("drip.enroll failed for %s", lead_id)
        return None


async def mark_completed(lead_id: str) -> None:
    """Flip a lead's drip to completed (they booked the call) — instant stop, not next-cron. Fail-soft."""
    lead_id = (lead_id or "").strip()
    if not lead_id:
        return
    try:
        pool = db.get_pool()
        async with pool.acquire() as con:
            await con.execute(
                "update drip_state set status = 'completed', completed_at = now(), "
                "next_send_key = null, updated_at = now() "
                "where lead_id = $1 and status = 'active'",
                lead_id,
            )
    except Exception:  # pragma: no cover — completion must never break the booking path
        log.exception("drip.mark_completed failed for %s", lead_id)


async def unsubscribe(token: str) -> bool:
    """One-click unsubscribe. Non-leaking: an unknown token returns False but the caller shows the same
    page. Sets status='unsubscribed'. Fail-soft."""
    token = (token or "").strip()
    if not token:
        return False
    try:
        pool = db.get_pool()
        async with pool.acquire() as con:
            row = await con.fetchrow(
                "update drip_state set status = 'unsubscribed', updated_at = now() "
                "where unsub_token = $1 returning lead_id",
                token,
            )
        return bool(row)
    except Exception:  # pragma: no cover
        log.exception("drip.unsubscribe failed")
        return False


async def reap() -> int:
    """Defensive: stop any still-active enrolment aged past DRIP_STOP_AFTER_HOURS (so stale rows don't
    linger 'active'). Returns the count stopped. Fail-soft."""
    try:
        pool = db.get_pool()
        async with pool.acquire() as con:
            rows = await con.fetch(
                "update drip_state set status = 'stopped', next_send_key = null, updated_at = now() "
                "where status = 'active' "
                f"and enrolled_at < (now() - interval '{DRIP_STOP_AFTER_HOURS} hours') "
                "returning lead_id",
            )
        n = len(rows)
        if n:
            log.info("drip.reap: stopped %d stale enrolment(s)", n)
        return n
    except Exception:  # pragma: no cover
        log.exception("drip.reap failed")
        return 0


# ─────────────────────────── the auth / deep link ───────────────────────────

async def _mint_auth_link(email: str) -> Optional[str]:
    """Supabase admin magic link → a URL that signs the user in and lands on the setup modal. Returns
    the action link, or None (caller falls back to a plain deep link)."""
    key = config.SUPABASE_SERVICE_ROLE_KEY
    email = (email or "").strip()
    if not key or not email or not config.SUPABASE_URL:
        return None
    base = config.ONBOARD_PUBLIC_BASE_URL.rstrip("/")
    redirect_to = f"{base}/auth/callback?intent=setup"
    url = f"{config.SUPABASE_URL.rstrip('/')}/auth/v1/admin/generate_link"
    try:
        async with httpx.AsyncClient(timeout=12) as cx:
            r = await cx.post(
                url,
                headers={
                    "apikey": key,
                    "authorization": f"Bearer {key}",
                    "content-type": "application/json",
                },
                json={
                    "type": "magiclink",
                    "email": email,
                    "options": {"redirect_to": redirect_to},
                },
            )
        if r.status_code >= 300:
            log.warning("drip generate_link failed %s: %s", r.status_code, r.text[:200])
            return None
        data = r.json()
        # supabase returns {action_link, ...}; some versions nest under "properties".
        return data.get("action_link") or (data.get("properties") or {}).get("action_link")
    except Exception:  # pragma: no cover
        log.exception("drip generate_link error")
        return None


def _fallback_link(unsub_token: str, lead_id: str) -> str:
    """No auth injected; they sign in on the landing. Carries a drip attribution param."""
    base = config.ONBOARD_PUBLIC_BASE_URL.rstrip("/")
    frag = (unsub_token or lead_id or "")[:8]
    return f"{base}/?setup=1&utm_source=drip&d={frag}"


def _unsub_url(unsub_token: str) -> str:
    base = config.ONBOARD_PUBLIC_BASE_URL.rstrip("/")
    return f"{base}/api/drip/unsub/{quote(unsub_token or '')}"


# ─────────────────────────── copy builders (ES primary, EN variant) ───────────────────────────
#
# Each returns (subject, html). html is a full onboarding._shell(...) email. Every email carries the
# primary auth-link CTA (via _shell) + an inline WhatsApp line + the unsubscribe footer.

_WA_PREFILL_ES = "Hola Peter, quiero que Rocoto me dé de alta"
_WA_PREFILL_EN = "Hi Peter, I want Rocoto to get me set up"


def _wa_line(wa_url: str, locale: str) -> str:
    if locale == "en":
        return (f'<p style="margin:20px 0 0">Prefer to talk? '
                f'<a href="{wa_url}" style="color:#C4432B;font-weight:600">Message me on WhatsApp</a> '
                f"and we'll sort it in a minute.</p>")
    return (f'<p style="margin:20px 0 0">¿Prefieres que hablemos? '
            f'<a href="{wa_url}" style="color:#C4432B;font-weight:600">Escríbeme por WhatsApp</a> '
            f"y lo vemos en un minuto.</p>")


def _unsub_footer(unsub_url: str, locale: str) -> str:
    if locale == "en":
        return (f'<p style="margin:24px 0 0;font-size:13px;color:#998F83">'
                f"Don't want these? <a href=\"{unsub_url}\" style=\"color:#998F83\">Tell me here</a>.</p>")
    return (f'<p style="margin:24px 0 0;font-size:13px;color:#998F83">'
            f'Si no quieres más correos, <a href="{unsub_url}" style="color:#998F83">dímelo aquí</a>.</p>')


def _greeting(name: str, locale: str) -> str:
    first = (name or "").split(" ")[0] if name else ""
    if locale == "en":
        return f"Hi {first}," if first else "Hi,"
    return f"Hola {first}," if first else "Hola,"


def _email_t2h(name: str, link: str, wa_url: str, unsub_url: str, locale: str) -> tuple[str, str]:
    g = _greeting(name, locale)
    if locale == "en":
        subject = "Still in? Your setup is one click away"
        body = (
            f'<p style="margin:0 0 16px">{g}</p>'
            "<p style=\"margin:0 0 16px\">It's Rocoto. I saw you started setting things up — here's the "
            "link right back to where you left off.</p>"
            '<p style="margin:0 0 16px">Two minutes: pick a time and on the call I\'ll show you how I stop '
            "a single WhatsApp order slipping through.</p>"
            f"{_wa_line(wa_url, locale)}{_unsub_footer(unsub_url, locale)}"
        )
        return subject, _ob._shell("Your setup is one click away", body, "Finish my setup", link)
    subject = "¿Seguimos? Te dejo el alta a un clic"
    body = (
        f'<p style="margin:0 0 16px">{g}</p>'
        '<p style="margin:0 0 16px">Soy Rocoto. Vi que empezaste a darte de alta hace un rato — te dejo '
        "justo donde lo dejaste.</p>"
        '<p style="margin:0 0 16px">Son dos minutos: eliges un hueco y en tu llamada te enseño cómo hago '
        "que no se te escape ni un pedido de WhatsApp.</p>"
        f"{_wa_line(wa_url, locale)}{_unsub_footer(unsub_url, locale)}"
    )
    return subject, _ob._shell("Te dejo el alta a un clic", body, "Terminar mi alta", link)


def _email_d1(name: str, link: str, wa_url: str, unsub_url: str, locale: str) -> tuple[str, str]:
    g = _greeting(name, locale)
    if locale == "en":
        subject = "I'll hold a slot for you this week"
        body = (
            f'<p style="margin:0 0 16px">{g}</p>'
            '<p style="margin:0 0 16px">Still here. The only thing left to get going is picking a time for '
            "your call — short, no strings.</p>"
            "<p style=\"margin:0 0 16px\">I'll show you how Rocoto reads your customers' orders, drops them "
            "into your spreadsheet and flags what matters, while you keep doing your thing.</p>"
            f"{_wa_line(wa_url, locale)}{_unsub_footer(unsub_url, locale)}"
        )
        return subject, _ob._shell("I'll hold a slot for you", body, "Pick my slot", link)
    subject = "Te guardo un hueco esta semana"
    body = (
        f'<p style="margin:0 0 16px">{g}</p>'
        '<p style="margin:0 0 16px">Sigo por aquí. Lo único que falta para arrancar es elegir un hueco '
        "para tu llamada — corta, sin compromiso.</p>"
        '<p style="margin:0 0 16px">Ahí te cuento cómo Rocoto lee los pedidos de tus clientes, los mete '
        "en tu Excel y te avisa de lo importante. Tú sigues a lo tuyo.</p>"
        f"{_wa_line(wa_url, locale)}{_unsub_footer(unsub_url, locale)}"
    )
    return subject, _ob._shell("Te guardo un hueco", body, "Elegir mi hueco", link)


def _email_d3(name: str, link: str, wa_url: str, unsub_url: str, locale: str) -> tuple[str, str]:
    g = _greeting(name, locale)
    if locale == "en":
        subject = "One missed order a week already covers it"
        body = (
            f'<p style="margin:0 0 16px">{g}</p>'
            '<p style="margin:0 0 16px">No pressure — just a thought. Most suppliers lose the odd order '
            "between WhatsApps, voice notes and late calls. Rocoto catches them all, without you having to "
            "watch.</p>"
            "<p style=\"margin:0 0 16px\">Whenever you like, grab a slot and I'll show you with your own "
            "orders.</p>"
            f"{_wa_line(wa_url, locale)}{_unsub_footer(unsub_url, locale)}"
        )
        return subject, _ob._shell("It already pays for itself", body, "See a slot", link)
    subject = "Un pedido perdido a la semana ya lo paga"
    body = (
        f'<p style="margin:0 0 16px">{g}</p>'
        '<p style="margin:0 0 16px">Sin agobiar — solo una idea. La mayoría de proveedores pierden algún '
        "pedido al mes entre WhatsApps, notas de voz y llamadas a deshora. Rocoto los recoge todos, sin que "
        "tengas que estar pendiente.</p>"
        '<p style="margin:0 0 16px">Cuando quieras, elige un hueco y te lo enseño con tus propios pedidos.</p>'
        f"{_wa_line(wa_url, locale)}{_unsub_footer(unsub_url, locale)}"
    )
    return subject, _ob._shell("Ya se paga solo", body, "Ver un hueco", link)


def _email_d7(name: str, link: str, wa_url: str, unsub_url: str, locale: str) -> tuple[str, str]:
    g = _greeting(name, locale)
    if locale == "en":
        subject = "Last one from me — here's my WhatsApp"
        body = (
            f'<p style="margin:0 0 16px">{g}</p>'
            "<p style=\"margin:0 0 16px\">I won't clutter your inbox, so this is the last one from me.</p>"
            "<p style=\"margin:0 0 16px\">Whenever you'd like Rocoto to handle your orders, your setup's "
            "ready here — or just message me on WhatsApp.</p>"
            '<p style="margin:0 0 16px">Good talking to you. I\'m around whenever.</p>'
            f"{_wa_line(wa_url, locale)}{_unsub_footer(unsub_url, locale)}"
        )
        return subject, _ob._shell("Here's my WhatsApp", body, "Get me set up", link)
    subject = "Última que te mando — te dejo mi WhatsApp"
    body = (
        f'<p style="margin:0 0 16px">{g}</p>'
        '<p style="margin:0 0 16px">No quiero llenarte el correo, así que esta es la última que te mando.</p>'
        '<p style="margin:0 0 16px">Si en algún momento quieres que Rocoto se encargue de tus pedidos, aquí '
        "tienes el alta lista — o me escribes por WhatsApp y ya está.</p>"
        '<p style="margin:0 0 16px">Encantado de haber hablado contigo. Cuando quieras, aquí estoy.</p>'
        f"{_wa_line(wa_url, locale)}{_unsub_footer(unsub_url, locale)}"
    )
    return subject, _ob._shell("Te dejo mi WhatsApp", body, "Darme de alta", link)


_BUILDERS = {
    "t2h": _email_t2h,
    "d1": _email_d1,
    "d3": _email_d3,
    "d7": _email_d7,
}


def _locale_for(lead: dict) -> str:
    """Default ES (the market is Spain). Flip to EN only on an explicit 'en' attribution signal."""
    ref = (lead.get("ref") or "").lower()
    if "en" in ref.split("-") or ref.startswith("en") or "lang=en" in ref:
        return "en"
    return "es"


# ─────────────────────────── the run-due sweep ───────────────────────────

async def _reconcile_completed(con) -> int:
    """Flip any active enrolment whose lead has since booked → completed. Cheap belt-and-braces with the
    booking_created hook (in case that fired before enrolment, or the flag was off then)."""
    rows = await con.fetch(
        "update drip_state d set status = 'completed', completed_at = now(), "
        "next_send_key = null, updated_at = now() "
        "from leads l where l.id = d.lead_id and d.status = 'active' "
        "and (l.cal_booking_ref is not null or l.status <> 'signed_up') "
        "returning d.lead_id",
    )
    return len(rows)


async def run_due(source: str = "timer") -> dict:
    """One drip sweep. Reconcile completed leads, then select active enrolments whose next rung is due
    (FOR UPDATE SKIP LOCKED, race-safe), and for each: mint the auth link → build ES/EN copy → send →
    advance the rung. All best-effort per-row: a send failure records {ok:false} and does NOT advance
    the step (so it retries next tick), never blocking the other rows. Returns a summary dict."""
    limit = int(getattr(config, "DRIP_BATCH_LIMIT", 200) or 200)
    step1_hours = float(getattr(config, "DRIP_STEP1_HOURS", 2) or 2)
    wa_number = getattr(config, "DRIP_WA_NUMBER", "12025550111")
    reconciled = sent = stopped = failed = skipped = 0

    pool = db.get_pool()
    async with pool.acquire() as con:
        async with con.transaction():
            reconciled = await _reconcile_completed(con)
            rows = await con.fetch(
                """
                select d.lead_id, d.step, d.next_send_key, d.enrolled_at, d.unsub_token,
                       l.name, l.email, l.supabase_user_id
                from drip_state d
                join leads l on l.id = d.lead_id
                where d.status = 'active'
                  and d.next_send_key is not null
                  and coalesce(l.email, '') <> ''
                  and l.cal_booking_ref is null
                  and l.status = 'signed_up'
                  and l.is_test = false
                  and d.enrolled_at > ($1::timestamptz - ($2 || ' hours')::interval)
                  and $1::timestamptz >= d.enrolled_at + (
                        case d.next_send_key
                          when 't2h' then ($3 || ' hours')::interval
                          when 'd1'  then interval '24 hours'
                          when 'd3'  then interval '72 hours'
                          when 'd7'  then interval '168 hours'
                        end)
                order by d.enrolled_at asc
                limit $4
                for update skip locked
                """,
                _now(), str(DRIP_STOP_AFTER_HOURS), str(step1_hours), limit,
            )

            for r in rows:
                lead = dict(r)
                key = lead["next_send_key"]
                builder = _BUILDERS.get(key)
                to = (lead.get("email") or "").strip()
                if not builder or not to:
                    continue
                locale = _locale_for(lead)
                unsub_tok = lead.get("unsub_token") or ""
                # ── §17.56c · THE CONSENT GATE. This ladder is MARKETING (re-engagement copy to
                # somebody who has not booked), so it runs on consent, not on the contract basis.
                # Refused → the rung is CONSUMED, not retried: `next_send_key` advances exactly as a
                # successful send does, because an unconsented address must fall off the ladder
                # rather than be re-attempted every 15 minutes forever. Recorded in `sends` as
                # `skipped` so «why did they get nothing?» is answerable from the row.
                #
                # Fail-CLOSED by construction: `may_send_marketing` answers False on any read error.
                if not await _consent_ok(to):
                    nxt = _NEXT_KEY.get(key)
                    await con.execute(
                        "update drip_state set step = step + 1, next_send_key = $2, "
                        "status = case when $2::text is null then 'stopped' else 'active' end, "
                        "sends = sends || $3::jsonb, updated_at = now() where lead_id = $1",
                        lead["lead_id"], nxt,
                        {"key": key, "at": _now().isoformat(), "ok": False,
                         "skipped": "no_marketing_consent"})
                    skipped += 1
                    continue
                try:
                    link = await _mint_auth_link(to)
                    if not link:
                        link = _fallback_link(unsub_tok, lead["lead_id"])
                    wa_prefill = _WA_PREFILL_EN if locale == "en" else _WA_PREFILL_ES
                    wa_url = _wa_url(wa_number, wa_prefill)
                    unsub_url = _unsub_url(unsub_tok)
                    subject, html = builder(lead.get("name") or "", link, wa_url, unsub_url, locale)
                    # RFC 8058 one-click, on top of the visible footer link the builders already
                    # write. Two routes to the same withdrawal: the drip's own per-lead token (the
                    # footer, which stops THIS ladder) and the consent signature (the header, which
                    # withdraws the marketing permission itself). Both are honoured; the header one
                    # is what mailbox providers surface, so it must be the stronger of the two.
                    res = await _ob._send(to, subject, html,
                                          headers=_consent.list_unsubscribe_headers(to))
                    ok = bool(res.get("ok"))
                except Exception:  # pragma: no cover — one bad row must never block the others
                    log.exception("drip: send failed for %s (%s)", lead["lead_id"], key)
                    ok = False
                    res = {"ok": False, "error": "exception"}

                # NATIVE DICT into the `$n::jsonb` params below, never json.dumps: the pool registers
                # `set_type_codec("jsonb", encoder=json.dumps)`, so a string is encoded a second time
                # and appends a JSON *string* element to `sends` instead of an object (proved on the
                # clone: jsonb_typeof → 'string'). Silent — the row lands, the trail is unreadable.
                audit = {"key": key, "at": _now().isoformat(), "ok": ok}
                if not ok and res.get("error"):
                    audit["error"] = str(res.get("error"))[:200]

                if ok:
                    nxt = _NEXT_KEY.get(key)
                    new_status = "stopped" if nxt is None else "active"
                    await con.execute(
                        "update drip_state set step = step + 1, last_sent_at = now(), "
                        "next_send_key = $2, "
                        "status = case when $2::text is null then 'stopped' else 'active' end, "
                        "sends = sends || $3::jsonb, updated_at = now() where lead_id = $1",
                        lead["lead_id"], nxt, audit,
                    )
                    sent += 1
                    if new_status == "stopped":
                        stopped += 1
                    await _ob.log_event(lead["lead_id"], "drip_sent", {"key": key, "locale": locale}, actor="drip")
                else:
                    # Record the failure WITHOUT advancing the rung, so it retries next tick.
                    await con.execute(
                        "update drip_state set sends = sends || $2::jsonb, updated_at = now() "
                        "where lead_id = $1",
                        lead["lead_id"], audit,
                    )
                    failed += 1

    res = {"reconciled": reconciled, "sent": sent, "stopped": stopped, "failed": failed,
           "skipped_no_consent": skipped, "source": source}
    log.info("drip run-due: reconciled=%d sent=%d stopped=%d failed=%d no_consent=%d",
             reconciled, sent, stopped, failed, skipped)
    return res


# ─────────────────────────── CLI (systemd timer entrypoint; mirrors tasks.py) ───────────────────────────
if __name__ == "__main__":
    import asyncio as _asyncio
    import sys

    import db as _db

    async def _cli() -> None:
        await _db.init()
        argv = sys.argv[1:]
        cmd = argv[0] if argv else "run-due"
        if cmd == "run-due":
            if not config.DRIP_ENABLED:
                log.info("drip: DRIP_ENABLED off — no-op")
                return
            res = await run_due(source="timer")
            log.info("drip run-due: reconciled=%d sent=%d stopped=%d",
                     res["reconciled"], res["sent"], res["stopped"])
        elif cmd == "reap":
            n = await reap()
            print(f"reaped {n}")
        elif cmd == "enroll" and "--lead" in argv:
            print(await enroll(argv[argv.index("--lead") + 1]))
        else:
            print("commands: run-due | reap | enroll --lead <id>")

    _asyncio.run(_cli())
