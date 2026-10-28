"""Supabase identity ↔ Rocoto lead bridge.

Supabase is the identity provider (email+password / Google). The lead row (in Rocoto's own Postgres)
is the app-side identity. The two are married by leads.supabase_user_id:

  • bind    — signing in INSIDE a tokenized onboarding link ties that lead to the authed Supabase user
  • resume  — signing in from the landing resolves the user back to their lead + furthest step

The caller's Supabase access token is verified against the Auth API (GET /auth/v1/user), so no shared
JWT secret needs to live here — the anon apikey + the user's bearer are enough to authenticate it.
Everything is fail-soft: an unverifiable token → None; an unknown token/user → not-found.
"""
from __future__ import annotations

import hashlib
import logging
import uuid

import httpx

import config
import db

log = logging.getLogger("rocoto.auth")

_AUTH_USER_URL = f"{config.SUPABASE_URL.rstrip('/')}/auth/v1/user"


def resolve_role(email: str | None, verified: bool) -> tuple[str, bool]:
    """Resolve a signed-in user's role from the allowlists. Returns (role, is_master_owner) with role
    in {customer, admin, owner}.

    SECURITY: `verified` here means "verified via a TRUSTED ELEVATION PROVIDER (Google/OAuth)" — callers
    pass has_oauth_identity(user), NOT is_email_verified(user). This enforces the Google-only-elevation
    decision (spec §6.2 / D4): with Supabase email-confirmation OFF, a plain password signup is
    AUTO-confirmed (email_confirmed_at is set), so a confirmed email is NOT proof of ownership — otherwise
    anyone who signs up an owner address with a password would self-elevate. Exact-match against the
    lowercased allowlists only — never a domain wildcard (a one-char domain bug is a full privilege
    escalation, spec §2.5). Master owner first."""
    e = (email or "").strip().lower()
    if not e or not verified:
        return ("customer", False)
    if e == config.MASTER_OWNER_EMAIL:
        return ("owner", True)
    if e in config.OWNER_EMAILS:
        return ("owner", False)
    if e in config.ADMIN_EMAILS:
        return ("admin", False)
    return ("customer", False)


def is_email_verified(user: dict) -> bool:
    """Whether Supabase considers this user's email verified — True for an OAuth identity OR a confirmed
    password signup. Used for the account-takeover guard on the email-ADOPT path (a user claiming a
    pre-existing lead by email). NOTE: this is NOT sufficient for role ELEVATION — with email-confirmation
    off a password signup is auto-confirmed, so use has_oauth_identity() for owner/admin elevation."""
    return bool(user.get("email_confirmed_at") or user.get("confirmed_at")) or has_oauth_identity(user)


def has_oauth_identity(user: dict) -> bool:
    """True iff the user authenticated via a trusted OAuth provider (e.g. Google) — a NON-'email'
    identity. This is the ELEVATION gate (owner/admin), STRICTER than is_email_verified: with Supabase
    email-confirmation OFF a password signup is auto-confirmed (email_confirmed_at set), so
    is_email_verified alone would let anyone who signs up an owner address self-elevate. Requiring a real
    OAuth identity enforces the Google-only-elevation decision (spec §6.2 / D4). Checks both the
    `identities` array and `app_metadata` (Supabase exposes the provider in either, depending on flow)."""
    for idp in (user.get("identities") or []):
        if isinstance(idp, dict) and (idp.get("provider") or "") not in ("", "email"):
            return True
    amd = user.get("app_metadata") or {}
    provs = amd.get("providers")
    if isinstance(provs, list) and any((p or "") not in ("", "email") for p in provs):
        return True
    if (amd.get("provider") or "") not in ("", "email"):
        return True
    return False


def has_matching_oauth(user: dict) -> bool:
    """STRICTER elevation gate than has_oauth_identity (used by the Control Room). True iff the user has a
    trusted OAuth (non-'email') identity whose OWN email matches the account email (lowercased) and is
    marked verified. Closes the linkIdentity escalation: a password signup of an owner address with an
    ATTACKER's Google identity linked passes has_oauth_identity ('some OAuth exists') but must NOT elevate,
    because the linked identity's email is not the owner address."""
    email = (user.get("email") or "").strip().lower()
    if not email:
        return False
    for idp in (user.get("identities") or []):
        if not isinstance(idp, dict):
            continue
        if (idp.get("provider") or "") in ("", "email"):
            continue
        idata = idp.get("identity_data") or {}
        iemail = (idata.get("email") or "").strip().lower()
        if iemail and iemail == email:
            ev = idata.get("email_verified")
            if ev is None or ev is True or str(ev).lower() == "true":
                return True
    return False


async def verify_token(access_token: str | None) -> dict | None:
    """Validate a Supabase access token → the user dict ({id, email, ...}) or None."""
    if not access_token or not config.SUPABASE_URL or not config.SUPABASE_ANON_KEY:
        return None
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.get(
                _AUTH_USER_URL,
                headers={
                    "apikey": config.SUPABASE_ANON_KEY,
                    "authorization": f"Bearer {access_token}",
                },
            )
        if r.status_code != 200:
            return None
        u = r.json()
        return u if u.get("id") else None
    except Exception:
        log.exception("supabase verify_token failed")
        return None


async def bind_lead(token: str, user: dict) -> bool:
    """Tie the authenticated Supabase user to the lead behind this onboarding token. First-write wins
    on supabase_user_id (a link already set to another user is left intact — the token is the source of
    truth for WHICH lead, so re-binding a different account is refused by keeping the original). Backfills
    lead.email when empty. Returns True when a valid, active token resolved to a lead."""
    uid = user.get("id")
    email = (user.get("email") or "").strip()
    if not uid or not token:
        return False
    pool = db.get_pool()
    async with pool.acquire() as con:
        tok = await con.fetchrow(
            "select lead_id, status from onboarding_tokens where token = $1", token
        )
        if not tok or tok["status"] != "active" or not tok["lead_id"]:
            return False
        await con.execute(
            "update leads set "
            "  supabase_user_id = coalesce(supabase_user_id, $1), "
            "  email = case when coalesce(email, '') = '' then $2 else email end, "
            "  updated_at = now() "
            "where id = $3",
            uid, email, tok["lead_id"],
        )
        return True


async def resume_for_user(user: dict) -> dict:
    """Resolve a signed-in user back to their onboarding: {found, token, step}. found=False when the
    user isn't linked to any lead (e.g. they signed in but were never sent a link)."""
    uid = user.get("id")
    if not uid:
        return {"found": False}
    pool = db.get_pool()
    async with pool.acquire() as con:
        lead = await con.fetchrow(
            "select id from leads where supabase_user_id = $1 and is_test = false "
            "order by updated_at desc limit 1", uid
        )
        if not lead:
            return {"found": False}
        tok = await con.fetchrow(
            "select token from onboarding_tokens where lead_id = $1 and status = 'active' "
            "order by created_at desc limit 1",
            lead["id"],
        )
        if not tok:
            return {"found": False}
        prog = await con.fetchrow(
            "select step from onboarding_progress where token = $1", tok["token"]
        )
        step = int(prog["step"]) if prog and prog["step"] is not None else 0
        return {"found": True, "token": tok["token"], "step": step}


async def resolve_lead(user: dict) -> dict | None:
    """Read-only: the lead bound to this Supabase user, or None. Unlike auth_state, NO side effects
    (no create / drip-enrol / event) — for read paths (e.g. reschedule) where minting a phantom
    'signed_up' lead as a side effect of a lookup would be wrong."""
    uid = user.get("id")
    if not uid:
        return None
    pool = db.get_pool()
    async with pool.acquire() as con:
        row = await con.fetchrow(
            "select * from leads where supabase_user_id = $1 and is_test = false order by updated_at desc limit 1", uid
        )
    return dict(row) if row else None


async def auth_state(user: dict) -> dict:
    """Resolve a signed-in Supabase user to everything the landing post-auth dispatcher needs, and
    CREATE + bind a lead the moment they authenticate if none exists yet (Peter's decision 2).

    Resolution order:
      1) lead already bound to this supabase_user_id → use it;
      2) else an unbound lead matching the user's email (they signed up / booked before auth) → adopt
         it (stamp supabase_user_id, first-write-wins);
      3) else mint a phoneless identity-lead (phone NULL, name from Google metadata, email from the
         token, status 'signed_up', bound to this user) + log_event.

    Returns:
      { lead: {id, name, email, phone, status} | null,
        token: str | null,                 # active onboarding token → send to the wizard
        booking: {ref, start} | null,       # a booked call → status/reschedule modal
        waitlist: {position, total, referral_code, share_url} | null }  # finished the wizard → waitlist
    Never raises to the caller (bad/empty user → all-null)."""
    uid = user.get("id")
    if not uid:
        return {"lead": None, "token": None, "booking": None, "waitlist": None,
                "role": "customer", "is_master_owner": False}
    email = (user.get("email") or "").strip()
    meta = user.get("user_metadata") or {}
    full_name = (meta.get("full_name") or meta.get("name") or "").strip()
    # Is this email VERIFIED? Google/OAuth users are; a password signup is only verified once confirmed.
    # SECURITY: with Supabase email-confirmation OFF, anyone can register victim@email and get an instant
    # session — so we must NOT let an UNVERIFIED email adopt a pre-existing lead (account-takeover guard),
    # and role elevation likewise requires it (see resolve_role).
    email_verified = is_email_verified(user)

    pool = db.get_pool()
    async with pool.acquire() as con:
        lead = await con.fetchrow(
            "select * from leads where supabase_user_id = $1 and is_test = false order by updated_at desc limit 1", uid
        )
        # Adopt a pre-existing, unbound lead matched by email — ONLY if the email is verified (Google/OAuth
        # or a confirmed password signup). An unverified password signup of someone else's email cannot
        # adopt their lead (see email_verified guard above).
        if not lead and email and email_verified:
            lead = await con.fetchrow(
                "select * from leads where lower(email) = lower($1) and supabase_user_id is null "
                "and is_test = false order by updated_at desc limit 1", email
            )
            if lead:
                await con.execute(
                    "update leads set supabase_user_id = $1, "
                    "  name = coalesce(nullif(name,''), nullif($2,'')), updated_at = now() where id = $3",
                    uid, full_name, lead["id"],
                )

    created = False
    if not lead:
        # No lead anywhere → mint a phoneless identity-lead bound to this user (the signup form fills
        # phone later; create_lead then ADOPTS this same row rather than duplicating it).
        lead_id = f"lead_{uuid.uuid4().hex[:16]}"
        async with pool.acquire() as con:
            # ATOMIC: ON CONFLICT guards the concurrent-double-sign-in race (two requests for the same
            # brand-new user both seeing lead=None). idx_leads_supabase_user_uq is the arbiter.
            row = await con.fetchrow(
                "insert into leads (id, phone, name, email, status, supabase_user_id) "
                "values ($1, NULL, $2, $3, 'signed_up', $4) "
                "on conflict (supabase_user_id) where supabase_user_id is not null do nothing "
                "returning *",
                lead_id, full_name, email, uid,
            )
            if row is None:
                # Lost the race → the other request already created it; take the winner.
                row = await con.fetchrow(
                    "select * from leads where supabase_user_id = $1 and is_test = false order by updated_at desc limit 1", uid
                )
            else:
                created = True
            lead = row

    if created:
        # audit (reuse onboarding.log_event; import lazily to avoid an import cycle)
        try:
            from brain import onboarding as _ob
            await _ob.log_event(lead["id"], "signed_up", {"via": "auth_state"}, actor="auth")
        except Exception:  # pragma: no cover — the audit write must never break auth
            log.exception("auth_state log_event failed")
        # Enrol into the re-engagement drip (guarded + fail-soft; lazy import avoids an import cycle).
        if config.DRIP_ENABLED:
            try:
                from brain import drip as _drip
                await _drip.enroll(lead["id"])
            except Exception:  # pragma: no cover — enrolment must never break auth
                log.exception("auth_state drip enroll failed")

    lead_id = lead["id"]

    # Owner/RBAC (spec §6): resolve the role from the allowlists and persist it onto the lead (so the
    # CRM/console can query it) + return it so the frontend reveals owner tools only for owners/admins.
    # ELEVATION requires a Google/OAuth identity (has_oauth_identity), NOT merely a confirmed email — with
    # email-confirmation off a password signup is auto-confirmed, so email_verified would over-elevate.
    role, is_master_owner = resolve_role(email, has_oauth_identity(user))
    async with pool.acquire() as con:
        await con.execute(
            "update leads set role = $2, is_master_owner = $3, updated_at = now() "
            "where id = $1 and (role is distinct from $2 or is_master_owner is distinct from $3)",
            lead_id, role, is_master_owner,
        )
        tok = await con.fetchrow(
            "select token from onboarding_tokens where lead_id = $1 and status = 'active' "
            "order by created_at desc limit 1", lead_id,
        )
    token = tok["token"] if tok else None

    booking = None
    if lead["cal_booking_ref"]:
        start = lead["cal_booking_start"]
        booking = {
            "ref": lead["cal_booking_ref"],
            "start": start.isoformat() if start else None,
        }

    # Waitlist membership (Peter's "furthest step" incl. the waitlist itself): a lead who finished the
    # wizard has a waitlist row (token 'used' → no active token). Resolve their live position/total/
    # share via the same path the wizard/submit_wizard uses so login lands them on their #N straight
    # away. Fail-soft: a lookup error → null (never break auth).
    waitlist = None
    try:
        from brain import waitlist as _waitlist
        async with pool.acquire() as con:
            wl = await con.fetchrow(
                "select referral_code from waitlist where lead_id = $1 limit 1", lead_id
            )
        code = wl["referral_code"] if wl else None
        if code:
            waitlist = await _waitlist.position(code)
    except Exception:  # pragma: no cover — a waitlist lookup must never break auth
        log.exception("auth_state waitlist lookup failed for %s", lead_id)

    return {
        "lead": {
            "id": lead_id,
            "name": lead["name"] or full_name,
            "email": lead["email"] or email,
            "phone": lead["phone"] or "",
            "status": lead["status"],
            "role": role,
        },
        "token": token,
        "booking": booking,
        "waitlist": waitlist,
        "role": role,
        "is_master_owner": is_master_owner,
    }


# ══════════════════════════════════════════════════════════════════════════════════════════════════
# THE APP GATE (§ in-app onboarding) — the ONE call the Android app makes right after sign-in.
#
# Peter's frame: "like those dating apps that need verification and invites and don't let you in until
# you're ready". So there are exactly four doors, and the SERVER picks which one — the client decides
# NOTHING:
#     founder  — Peter. No gate, no wizard, straight into the app against the seeded world.
#     in       — their tenant is live: this is their app now.
#     invited  — they may walk the wizard (they hold a live token).
#     waiting  — they are on the list. Honest copy per case, never a rejection.
#
# The RULE is a pure function (`resolve_gate`) over a dict of facts, so it is provable without a
# database and can never drift between the app, the landing and the CR. `app_gate()` does the IO and
# calls it. Fail-soft on the write path, NEVER on the rule.
# ══════════════════════════════════════════════════════════════════════════════════════════════════

# WHERE THE GATE SETTING LIVES — decision, written down (spec C):
# `db.settings_get/settings_set` on the existing `agent_settings` table, key 'onboarding_gate'.
# Why this and not a manifest_duty row or a new column:
#   · agent_settings is ALREADY this codebase's runtime-config mechanism (demo_seed, location_seed,
#     orders dispatch cadence, storefront wizard) — one jsonb blob per key, upserted, no migration.
#   · a manifest_duty row is for BEHAVIOUR THE MIND REASONS OVER (the question_timeout window). Who is
#     allowed through the door is infrastructure policy, not a duty the employee performs.
#   · a column on `leads` would be per-lead; this is a global policy switch.
#   · flipping it is one write (POST /api/app/gate-mode, or a single settings_set) — NO code change,
#     NO deploy, NO migration. Which is the whole point: "in the future it'll be without a call".
GATE_SETTING = "onboarding_gate"
GATE_INVITE = "invite"          # default: only leads Peter has sent onboarding to get in
GATE_OPEN = "open"              # anyone who signs up walks straight into the wizard
_GATE_MODES = (GATE_INVITE, GATE_OPEN)

# The lead statuses that mean "Peter clicked «Enviar onboarding»" — i.e. a wizard token was minted for
# them. `done` is the transient status mark-done sets one line before `wizard_sent`; a lead that got
# stuck there still holds a real token, so it counts (onboarding.py::_VALID_STATUS is the full set).
INVITED_STATUSES = ("wizard_sent", "done")


async def gate_mode() -> str:
    """The onboarding gate policy: 'invite' (default) | 'open'. Fail-soft — an unreadable setting is
    the CLOSED door, never the open one (a gate that fails open is not a gate)."""
    try:
        s = await db.settings_get(GATE_SETTING) or {}
    except Exception:
        log.exception("gate_mode read failed — defaulting to invite (fail-closed)")
        return GATE_INVITE
    m = str(s.get("mode") or "").strip().lower()
    return m if m in _GATE_MODES else GATE_INVITE


async def set_gate_mode(mode: str) -> str:
    """Flip the gate. Raises ValueError on anything that is not one of the two modes — a typo must
    never silently open the door."""
    m = str(mode or "").strip().lower()
    if m not in _GATE_MODES:
        raise ValueError(f"onboarding_gate must be one of {_GATE_MODES}")
    await db.settings_set(GATE_SETTING, {"mode": m})
    return m


def is_founder(user: dict) -> bool:
    """Peter. Uses the STRICTEST elevation gate in the codebase (has_matching_oauth — the same one the
    Control Room uses), NOT has_oauth_identity: this identity skips the whole gate AND unlocks the
    seeded-world reset, so the linkIdentity escalation must be closed here too.

    ASSUMPTION, written down: Peter signs into the app with GOOGLE. A password-only sign-in of an owner
    address resolves to 'prospect' — deliberately, because with Supabase email-confirmation off a
    password signup is auto-confirmed and would otherwise be a self-elevation hole."""
    role, _ = resolve_role((user or {}).get("email"), has_matching_oauth(user or {}))
    return role == "owner"


# ─────────────────────────── the waiting copy (es-ES, Rocoto's register) ───────────────────────────
# This is the product. It must read like being ON A LIST, not like being turned away. It never
# mentions a status string, the Control Room, or anything about how this was built. It speaks to the
# distributor's evening — the hour spent passing orders by hand — because that is what they are
# waiting FOR. A `cta.action` travels with it so the app doesn't have to infer the next move:
#   book_call · reschedule · none
_WAITING = {
    # signed up, never spoke to us
    "no_call": {
        "headline": "Estás en la lista",
        "body": ("Vamos entrando almacén por almacén, y contigo todavía no hemos hablado. Son diez "
                 "minutos: qué vendes, cómo te entran los pedidos y a qué hora se te hace de noche "
                 "pasándolos a mano. Con eso te lo dejo montado y trabajando desde el primer día. "
                 "Coge el hueco cuando puedas — tu sitio en la lista ya es tuyo."),
        "cta": {"label": "Reservar la llamada", "action": "book_call"},
    },
    # the call is booked and hasn't happened yet
    "call_booked": {
        "headline": "Te tengo apuntado",
        "body": ("Tenemos la llamada reservada{when}. Diez minutos, sin presentación: me cuentas cómo "
                 "te llegan los pedidos y qué es lo que te come la tarde. Salgo de ahí con tu catálogo "
                 "y tus normas, y te abro la puerta. Hasta entonces no tienes que hacer nada."),
        "cta": {"label": "Cambiar la hora", "action": "reschedule"},
    },
    # we spoke; Peter hasn't opened the door yet
    "called": {
        "headline": "Ya casi",
        "body": ("Hablamos y tengo tus notas delante. Estoy dejando tu catálogo y tus normas a punto "
                 "para que cuando entres sea cuestión de minutos, no un proyecto. Te aviso yo en "
                 "cuanto esté — no hace falta que estés pendiente."),
        "cta": {"label": "", "action": "none"},
    },
    # they finished the wizard; their number isn't connected yet
    "waitlisted": {
        "headline": "Lo tengo todo",
        "body": ("Catálogo, gama, horarios y normas: guardado. Falta lo último, conectar tu WhatsApp "
                 "de siempre — el número que ya usan tus clientes, sin cambiarlo y sin avisar a nadie. "
                 "Lo estamos abriendo por orden de lista y te aviso yo en cuanto te toque. Ese día "
                 "dejas de pasar pedidos a mano."),
        "cta": {"label": "", "action": "none"},
    },
    # anything we can't name honestly — says only what is true
    "hold": {
        "headline": "Estás en la lista",
        "body": ("Vamos abriendo almacén por almacén para montarlo bien y no dejar a nadie a medias. "
                 "Estás dentro y te aviso yo en cuanto te toque — no tienes que estar pendiente."),
        "cta": {"label": "", "action": "none"},
    },
}


def _when_es(iso_or_dt) -> str:
    """' el martes a las 17:30' (Madrid) for the booked-call copy, or '' if we can't say it honestly."""
    if not iso_or_dt:
        return ""
    try:
        from datetime import datetime as _dt
        from zoneinfo import ZoneInfo
        d = iso_or_dt
        if isinstance(d, str):
            d = _dt.fromisoformat(d.replace("Z", "+00:00"))
        if d.tzinfo is None:
            from datetime import timezone as _tz
            d = d.replace(tzinfo=_tz.utc)
        d = d.astimezone(ZoneInfo("Europe/Madrid"))
        days = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
        return f" el {days[d.weekday()]} a las {d.strftime('%H:%M')}"
    except Exception:
        return ""


def waiting_copy(reason: str, when: object = None) -> dict:
    """{reason, headline, body, cta} — the es-ES block the app renders verbatim."""
    c = _WAITING.get(reason) or _WAITING["hold"]
    body = c["body"].replace("{when}", _when_es(when)) if "{when}" in c["body"] else c["body"]
    return {"reason": reason if reason in _WAITING else "hold",
            "headline": c["headline"], "body": body, "cta": dict(c["cta"])}


def _waiting_reason(lead: dict | None, booking: dict | None) -> str:
    """Which honest waiting case this is. Order matters: the furthest-along truth wins."""
    st = ((lead or {}).get("status") or "").strip().lower()
    if st == "waitlisted":
        return "waitlisted"
    if st in ("called", "done"):
        return "called"
    if st == "call_booked" or (booking and booking.get("start")):
        return "call_booked"
    if st == "signed_up" or not lead:
        return "no_call"
    return "hold"


def resolve_gate(facts: dict) -> dict:
    """THE RULE — pure, no IO, no clock, no randomness. Returns
        {gate, role, waiting: {...}|None, mint: bool, reason: str}
    `mint` is the ONLY instruction it gives the write path: 'open' mode says this person is allowed
    in, so someone must mint them a token. The rule itself never writes.

    facts:
      role            'founder' | 'boss' | 'prospect'
      lead            {id,name,business,email,status} | None
      has_active_token bool
      tenant_live     bool
      gate_mode       'invite' | 'open'
      booking         {ref,start} | None
    """
    role = facts.get("role") or "prospect"
    lead = facts.get("lead") or None
    status = ((lead or {}).get("status") or "").strip().lower()
    tok = bool(facts.get("has_active_token"))
    live = bool(facts.get("tenant_live"))
    mode = facts.get("gate_mode") or GATE_INVITE
    booking = facts.get("booking") or None

    # 1 · Peter. Nothing gates him, whatever any lead row says.
    if role == "founder":
        return {"gate": "founder", "role": "founder", "waiting": None, "mint": False, "reason": "founder"}

    # 2 · already live/onboarded → this is their app.
    if live:
        return {"gate": "in", "role": "boss", "waiting": None, "mint": False, "reason": "live"}

    # 3 · Peter clicked «Enviar onboarding» AND the token is alive → they may walk the wizard.
    if status in INVITED_STATUSES and tok:
        return {"gate": "invited", "role": "prospect", "waiting": None, "mint": False, "reason": "invited"}

    # 4 · the gate is OPEN → anyone who signed up walks in; the write path mints them a token.
    #     A lead that already FINISHED the wizard is never re-invited by opening the gate.
    if mode == GATE_OPEN and status != "waitlisted":
        return {"gate": "invited", "role": "prospect", "waiting": None,
                "mint": not tok, "reason": "gate_open"}

    # 5 · on the list. Say which honest case it is.
    reason = _waiting_reason(lead, booking)
    return {"gate": "waiting", "role": "prospect", "waiting": waiting_copy(reason, (booking or {}).get("start")),
            "mint": False, "reason": reason}


# ─────────────────────────── the IO half ───────────────────────────

async def _tenant_for_lead(lead_id: str | None) -> dict | None:
    """The tenant behind a lead: the slug its latest onboarding token carries → the tenants row.
    {slug, name, live, seeded} or None. Read-only, fail-soft (a read error is 'no tenant', never a
    500 into the app's first screen)."""
    if not lead_id:
        return None
    try:
        pool = db.get_pool()
        async with pool.acquire() as con:
            slug = await con.fetchval(
                "select tenant_slug from onboarding_tokens where lead_id = $1 and tenant_slug is not null "
                "order by created_at desc limit 1", lead_id)
            if not slug:
                return None
            t = await con.fetchrow(
                "select slug, name, status, seeded, golive_at from tenants where slug = $1", slug)
        if not t:
            return {"slug": slug, "name": "", "live": False, "seeded": False}
        return {"slug": t["slug"], "name": t["name"] or "",
                "live": bool(t["golive_at"]) or (t["status"] == "live"),
                "seeded": bool(t["seeded"])}
    except Exception:
        log.exception("app gate: tenant read failed for %s", lead_id)
        return None


async def _founder_tenant() -> dict:
    """Peter's world = the brain tenant, which is where the demo seed lives. `seeded` is answered
    HONESTLY: it is true only if the seed is actually enabled/loaded — the app shows a 'reset the
    seeded world' control off the back of it, and that control must not appear over a world that
    isn't seeded.

    THE BINDING, written down because it is a decision and not a coincidence (2026-07-27):
    `config.BRAIN_TENANT` is the SAME slug as `brain/seed.DEMO_TENANT` (which is defined as
    `ROCOTO_DEMO_TENANT or config.BRAIN_TENANT`), and `brain/seed._seed_business` now writes the
    seeded business identity onto exactly this row. So signing in as the founder resolves to the
    tenant the seeded world lives on, in the LIVE database — no demo tenant, no demo mode, no second
    world to keep in sync. It also has to stay that way: BRAIN_TENANT is the tenant every inbound
    WhatsApp message on the live number resolves to (`brain/pipeline`, `brain/identity`), so pointing
    the founder at a different slug would give him an app that cannot see his own real traffic."""
    slug = config.BRAIN_TENANT
    out = {"slug": slug, "name": slug, "live": True, "seeded": False}
    try:
        pool = db.get_pool()
        async with pool.acquire() as con:
            t = await con.fetchrow("select slug, name, status, seeded, golive_at from tenants where slug=$1", slug)
        if t:
            out = {"slug": t["slug"], "name": t["name"] or slug,
                   "live": bool(t["golive_at"]) or (t["status"] == "live"),
                   "seeded": bool(t["seeded"])}
    except Exception:
        log.exception("app gate: founder tenant read failed")
    if not out["seeded"]:
        try:
            from brain import seed as _seed
            out["seeded"] = bool(await _seed.get_seed_enabled())
        except Exception:
            log.exception("app gate: seed-enabled read failed")
    return out


async def _backfill_profile(lead_id: str, profile: dict | None) -> None:
    """The one thing Supabase sign-up cannot carry: the business name. Written ONLY into empty fields —
    a later call can never overwrite what the customer or Peter already put there. Fail-soft."""
    p = profile or {}
    name = str(p.get("name") or "").strip()[:160]
    business = str(p.get("business") or "").strip()[:160]
    ref = str(p.get("ref") or "").strip()[:64]
    if not (name or business or ref):
        return
    try:
        pool = db.get_pool()
        async with pool.acquire() as con:
            await con.execute(
                "update leads set "
                "  name     = case when coalesce(name,'')     = '' then nullif($2,'') else name end, "
                "  business = case when coalesce(business,'') = '' then nullif($3,'') else business end, "
                "  ref      = case when coalesce(ref,'')      = '' then nullif($4,'') else ref end, "
                "  updated_at = now() where id = $1",
                lead_id, name, business, ref)
    except Exception:
        log.exception("app gate: profile backfill failed for %s", lead_id)


async def app_gate(user: dict, profile: dict | None = None) -> dict:
    """THE app's post-sign-in call. Idempotent: it binds the signed-in Supabase user to their lead
    (creating a phoneless identity-lead on first sight, exactly as the landing does — auth_state), then
    resolves the door.

    Returns EXACTLY what the app needs to pick a screen, and nothing it has to interpret:
      {role, gate, lead, wizard, tenant, seeded, waiting, gate_mode}

    Raises RuntimeError only when the door SAYS 'invited' but the token write failed — the caller maps
    that to a 503. We never hand back 'invited' with no token, and never downgrade a real invitation to
    'waiting' because a write hiccuped: fail-soft on the write path, never on the rule."""
    founder = is_founder(user)

    if founder:
        tenant = await _founder_tenant()
        # Peter still gets his lead row resolved (read-only) so the CR/e-mail identity stays one thing,
        # but nothing about it can gate him.
        lead_row = None
        try:
            lead_row = await resolve_lead(user)
        except Exception:
            log.exception("app gate: founder lead read failed")
        return {
            "role": "founder",
            "gate": "founder",
            "lead": ({"id": lead_row["id"], "name": lead_row.get("name") or "",
                      "business": lead_row.get("business") or "", "email": lead_row.get("email") or "",
                      "status": lead_row.get("status") or ""} if lead_row else None),
            "wizard": None,
            "tenant": {"slug": tenant["slug"], "name": tenant["name"], "live": bool(tenant["live"])},
            "seeded": bool(tenant["seeded"]),
            "waiting": None,
            "gate_mode": await gate_mode(),
        }

    st = await auth_state(user)                      # creates + binds the lead (idempotent)
    lead = st.get("lead") or None
    if lead and profile:
        await _backfill_profile(lead["id"], profile)
        # re-read the two fields we may have just filled so the first response is already right
        try:
            pool = db.get_pool()
            async with pool.acquire() as con:
                r = await con.fetchrow("select name, business from leads where id=$1", lead["id"])
            if r:
                lead = {**lead, "name": r["name"] or lead.get("name") or "",
                        "business": r["business"] or ""}
        except Exception:
            log.exception("app gate: profile re-read failed")

    if lead and "business" not in lead:
        try:
            pool = db.get_pool()
            async with pool.acquire() as con:
                lead = {**lead, "business": (await con.fetchval(
                    "select business from leads where id=$1", lead["id"])) or ""}
        except Exception:
            lead = {**lead, "business": ""}

    token = st.get("token")
    tenant = await _tenant_for_lead(lead["id"] if lead else None)
    mode = await gate_mode()

    verdict = resolve_gate({
        "role": "prospect",
        "lead": lead,
        "has_active_token": bool(token),
        "tenant_live": bool(tenant and tenant.get("live")),
        "gate_mode": mode,
        "booking": st.get("booking"),
    })

    # The write the rule asked for: open gate, no token yet → mint one and record that the door was
    # opened by POLICY, not by Peter (actor='gate_open' in the audit — the CR can tell them apart).
    if verdict.get("mint") and lead:
        try:
            from brain import onboarding as _ob
            token = await _ob.mint_token(lead["id"], tenant_slug=None)
            await _ob.set_status(lead["id"], "wizard_sent", actor="gate_open")
            lead = {**lead, "status": "wizard_sent"}
        except Exception:
            log.exception("app gate: open-gate token mint failed for %s", lead["id"])
            raise RuntimeError("gate_open_mint_failed")

    gate = verdict["gate"]
    wizard = None
    if gate == "invited" and token:
        try:
            from brain import onboarding as _ob
            wizard = await _ob.app_wizard_head(token)
        except Exception:
            log.exception("app gate: wizard head read failed")
            wizard = {"token": token, "step": 0, "total_steps": _ob_total(), "next_step_id": None}
        if wizard is None:
            # The token died between auth_state's read and this one (used/revoked mid-flight). Never
            # hand back an invitation with a dead key: fall back to the honest waiting answer.
            log.warning("app gate: token went dead mid-request for %s", (lead or {}).get("id"))
            gate, token = "waiting", None
            verdict = {**verdict, "gate": "waiting",
                       "waiting": waiting_copy(_waiting_reason(lead, st.get("booking")),
                                               (st.get("booking") or {}).get("start"))}
    elif gate == "invited" and not token:
        # The rule said invited but there is no token to hand over — refuse loudly rather than ship a
        # door with no handle.
        raise RuntimeError("gate_invited_without_token")

    out = {
        "role": "boss" if gate == "in" else "prospect",
        "gate": gate,
        "lead": ({"id": lead["id"], "name": lead.get("name") or "", "business": lead.get("business") or "",
                  "email": lead.get("email") or "", "status": lead.get("status") or ""} if lead else None),
        "wizard": wizard,
        "tenant": ({"slug": tenant["slug"], "name": tenant["name"], "live": bool(tenant["live"])}
                   if tenant else None),
        "seeded": bool(tenant and tenant.get("seeded")),
        "waiting": verdict.get("waiting"),
        "gate_mode": mode,
    }
    return out


def _ob_total() -> int:
    try:
        from brain import onboarding as _ob
        return len(_ob.APP_STEPS)
    except Exception:
        return 0


# ══════════════════════════════════════════════════════════════════════════════════════════════════
# THE APP'S DATA SCOPE — identity → tenant, resolved SERVER-SIDE, never from anything the client sends.
#
# WHY THIS EXISTS (2026-07-27, app-auth pass): the Android app's whole `/api/*` data rail
# authenticated with ONE shared machine key (`ROCOTO_API_KEY`), stamped on every request by
# `ApiClient`'s OkHttp interceptor and baked into the APK as a string literal (`build.gradle`
# buildConfigField → `classes3.dex`). R8 does not help — string literals survive minification. So
# anyone holding a copy of the APK held the key, and the key was the whole authority on the rail:
# every order, every customer, every message. Peter is handing that APK to real distributors this
# week. A per-user identity already exists (`verify_token` above), so the rail moves onto it.
#
# THE RULE IS THE DESK'S RULE. `sup_session.resolve_membership` (operators.email → team_members →
# tenants) is the tenancy claim the supplier web app already resolves server-side. We reuse it
# VERBATIM rather than inventing a second one — one rule, two CARRIERS (a cookie for the browser, a
# bearer for the phone, because that is what each client can actually hold). If the two ever
# disagreed about who belongs to which tenant, that disagreement would BE the vulnerability.
#
# THE ELEVATION GATE IS `has_matching_oauth` — the same one the desk and the Control Room use, and
# for the same reason: Supabase email-confirmation is OFF on this project, so a password signup is
# AUTO-confirmed and `email_confirmed_at` proves nothing. If a password identity could resolve a
# membership, anyone could sign up `boss@sudistribuidora.com` and walk into that tenant's orders.
# ASSUMPTION, written down: bosses sign into the app with GOOGLE. The refusal is loud and typed
# (`oauth_required`) so the app can say «entra con Google» rather than «no autorizado».
#
# THE FALLBACK IS THE LEAD BINDING, NOT A CLIENT HINT. A freshly onboarded distributor has no
# `operators`/`team_members` row yet — nothing in onboarding writes one (only `brain/teams.ensure_seed`
# does, for the founder). So we fall back to the SAME resolution `app_gate` already trusts to decide
# `gate: in`: leads.supabase_user_id = this user → their latest onboarding token's `tenant_slug` →
# the tenants row, and only when that tenant is LIVE. Both hops are server-side and were written by
# Peter's Control Room; the client contributes nothing but its bearer.
# ══════════════════════════════════════════════════════════════════════════════════════════════════

# Least-privilege caps, mirroring sup_session.ROLE_CAPS EXACTLY (read < act < admin, plus the
# orthogonal `deliver` — see the long note there for why the driver's cap is not a role check).
# These two dicts are one rule with two carriers and must be edited together; if they ever disagreed
# about what a role may do, that disagreement would BE the vulnerability.
# MIRRORS sup_session.ROLE_CAPS, and must keep mirroring it: «a staff account means the same thing
# on the phone as on the desk» (app.py's require_app_runtime_cap note), the same reason
# owns_runtime is byte-identical in both modules. The §17.34 three-way split of `admin` is carried
# here too — `admin` stays as the one-release legacy alias so no existing phone route changes who
# can reach it. vital_caps_split asserts the two tables agree, so a future edit to one is caught
# rather than discovered.
APP_ROLE_CAPS = {
    "founder":    frozenset({"read", "act", "deliver", "admin", "admin:rocoto", "admin:negocio", "golive"}),
    "owner":      frozenset({"read", "act", "deliver", "admin", "admin:rocoto", "admin:negocio", "golive"}),
    "staff":      frozenset({"read", "act", "deliver", "admin:rocoto"}),
    "repartidor": frozenset({"deliver"}),
}


def app_can(role: str, cap: str) -> bool:
    return cap in APP_ROLE_CAPS.get(role or "", frozenset())


class AppScopeError(Exception):
    """Typed refusal from app_scope(). `code` is machine-readable (the app renders copy off it);
    `status` is the HTTP status the caller should return. Never carries data."""

    def __init__(self, status: int, code: str, detail: str = ""):
        super().__init__(code)
        self.status, self.code, self.detail = status, code, detail


async def _tenant_from_lead_binding(user: dict) -> dict | None:
    """The onboarded-distributor path: this Supabase user → their bound lead → the tenant that lead's
    latest onboarding token names → {tenant_slug, tenant_name, role} — but ONLY if that tenant is
    LIVE. A prospect mid-wizard has no data rail to reach, so 'not live' is 'no scope', not 'empty'.
    Read-only and fail-soft to None (an unreadable row is never an open door)."""
    try:
        lead = await resolve_lead(user)
    except Exception:
        log.exception("app scope: lead resolve failed")
        return None
    if not lead:
        return None
    t = await _tenant_for_lead(lead.get("id"))
    if not t or not t.get("live") or not t.get("slug"):
        return None
    # They are the boss of their own shop — the same claim `app_gate` makes when it answers role='boss'.
    return {"tenant_slug": t["slug"], "tenant_name": t.get("name") or t["slug"], "role": "owner"}


async def app_scope(user: dict) -> dict:
    """VERIFIED Supabase user → the app's data scope:
        {email, tenant_slug, tenant_name, role, caps, via}
    Raises AppScopeError on every refusal — there is no anonymous and no partial answer.

    Resolution order (each hop server-side, none of it client-supplied):
      1 · membership   — sup_session.resolve_membership(email); the desk's rule, verbatim.
      2 · lead binding — an onboarded boss with no membership row yet (see the module note).
      3 · founder      — Peter, if he somehow has neither (teams.ensure_seed normally gives him both);
                         a founder who cannot reach his own runtime is a worse failure than the gap.
    """
    email = (user or {}).get("email") or ""
    email = email.strip().lower()
    if not email:
        raise AppScopeError(401, "no_email", "Tu cuenta no tiene email.")
    if not has_matching_oauth(user):
        raise AppScopeError(403, "oauth_required", "Entra con Google para usar la app.")

    m = None
    try:
        from sup_session import resolve_membership as _membership
        m = await _membership(email)
    except Exception:
        log.exception("app scope: membership read failed for %s", email)
        m = None
    via = "membership"
    if not m:
        m = await _tenant_from_lead_binding(user)
        via = "lead"
    if not m and is_founder(user):
        m = {"tenant_slug": config.BRAIN_TENANT, "tenant_name": config.BRAIN_TENANT, "role": "founder"}
        via = "founder"
    if not m:
        raise AppScopeError(403, "no_tenant", "Tu cuenta no pertenece a ninguna empresa todavía.")

    role = m.get("role") or "staff"
    if role not in APP_ROLE_CAPS:
        role = "desconocido"                 # DENY, don't demote — 'staff' carries read+act
    return {"email": email, "tenant_slug": m["tenant_slug"],
            "tenant_name": m.get("tenant_name") or m["tenant_slug"],
            "role": role, "caps": sorted(APP_ROLE_CAPS.get(role, frozenset())), "via": via,
            "is_founder": is_founder(user)}


def owns_runtime(tenant_slug: str) -> bool:
    """The legacy runtime tables (orders, whatsapp_messages, calls, the wa.* scopes) carry NO
    tenant_id column — they belong to the ONE tenant this deployment's runtime serves
    (config.BRAIN_TENANT). A scope for any OTHER tenant is refused LOUDLY on those surfaces, never
    served another tenant's rows and never served silence dressed as data. Byte-identical to
    sup_session.owns_runtime, deliberately: the phone and the desk must agree on the fence."""
    return (tenant_slug or "") == config.BRAIN_TENANT


# ── the app rail's token cache ─────────────────────────────────────────────────────────────────────
# The phone polls (conversations, orders, the live-call banner). One Supabase /auth/v1/user round-trip
# per poll would add latency to every screen and would eventually meet Supabase's own rate limits, so
# a VERIFIED token is remembered briefly, keyed by its sha256 (never the token itself — this dict is
# in-process, but a token in memory under its own name is a token in a heap dump).
#
# The TTL is the FLOOR of a fixed 60s and the token's own remaining life read from the unverified JWT
# `exp` claim, so a cache entry can never outlive the token it stands for. The claim is used ONLY to
# SHORTEN the cache (and to reject an already-expired token without a network call) — it is never
# trusted to authenticate anything; Supabase remains the only authority on that. Failures are never
# cached: a Supabase blip must not become a minute of 401s, and a forged token must not become a
# minute of anything.
_TOK_TTL_S = 60
_tok_cache: dict[str, tuple[float, dict]] = {}


def _jwt_exp(token: str) -> float | None:
    """The `exp` claim off an UNVERIFIED JWT, or None. Signature is NOT checked and MUST NOT be
    trusted for auth — this only bounds the cache and short-circuits an obviously dead token."""
    try:
        import base64 as _b64
        import json as _json
        payload = token.split(".")[1]
        payload += "=" * (-len(payload) % 4)
        exp = _json.loads(_b64.urlsafe_b64decode(payload.encode())).get("exp")
        return float(exp) if exp is not None else None
    except Exception:
        return None


async def verify_token_cached(access_token: str | None) -> dict | None:
    """verify_token() with a short positive-only cache. Same contract: the user dict or None."""
    import time as _time
    tok = (access_token or "").strip()
    if not tok:
        return None
    now = _time.time()
    exp = _jwt_exp(tok)
    if exp is not None and exp <= now:
        return None                                  # expired on its face — no network call needed
    key = hashlib.sha256(tok.encode()).hexdigest()
    hit = _tok_cache.get(key)
    if hit and hit[0] > now:
        return hit[1]
    user = await verify_token(tok)
    if not user:
        _tok_cache.pop(key, None)
        return None                                  # failures are NEVER cached
    ttl = _TOK_TTL_S if exp is None else min(_TOK_TTL_S, max(0.0, exp - now))
    if ttl > 0:
        if len(_tok_cache) > 512:                    # bounded; a device fleet is not a memory leak
            for k, (until, _u) in list(_tok_cache.items()):
                if until <= now:
                    _tok_cache.pop(k, None)
            if len(_tok_cache) > 512:
                _tok_cache.clear()
        _tok_cache[key] = (now + ttl, user)
    return user
