"""Rocoto onboarding / CRM spine.

The customer-acquisition loop: cold-call → signup + book-a-call (cal.com) → Peter calls → the call
note lands as Markdown in /home/founder/calls/*.md → a background scan attaches it to the lead →
Peter marks the lead done → the backend mints a tokenized personalized wizard link → the customer
fills the wizard → the backend joins them to the waitlist and emails their referral link.

ADDITIVE + isolated: touches only the ONBOARD_SCHEMA tables (leads, calls_onboard, transcript_facts,
onboarding_tokens, onboarding_progress, events) + brain.waitlist. Nothing here alters the live
WhatsApp service. All email is Rocoto-branded and sent via Resend directly (NOT the vitrina-branded
app._send_simple_email).

NOTE on table naming: the onboarding call table is `calls_onboard`, NOT `calls` — db.py already owns
a live `calls` table (voice-call lifecycle). Keeping them separate is what makes this additive.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import secrets
import uuid
from datetime import datetime, timezone
from pathlib import Path

import config
import db
from brain import llm as _llm
from brain import onboard_q
from brain import waitlist as _waitlist
from identity_phone import canon

log = logging.getLogger("rocoto.onboarding")

# Public site the emails/links point at (soyrocoto.com). Read from config's onboarding-specific key
# so we never touch the existing PUBLIC_BASE_URL (the sslip.io backend host Twilio signs against).
PUBLIC_BASE_URL = getattr(config, "ONBOARD_PUBLIC_BASE_URL", "https://soyrocoto.com").rstrip("/")

# Where Peter's call notes land (born there, or rsynced by founder-hermes-mirror.timer). Overridable
# for tests via CALLS_DIR env.
CALLS_DIR = Path(os.getenv("CALLS_DIR", "/home/founder/calls"))

# Lead statuses that a fresh call-ingest is allowed to advance to 'called' (don't clobber a lead
# already further along the funnel).
_INGEST_ADVANCEABLE = {"signed_up", "call_booked"}

_VALID_STATUS = {
    "signed_up", "call_booked", "called", "done", "wizard_sent", "waitlisted",
}


# ─────────────────────────── small helpers ───────────────────────────

def _ser(rec) -> dict:
    """asyncpg.Record → JSON-safe dict (datetimes → isoformat)."""
    from datetime import datetime
    d = dict(rec)
    for k, v in d.items():
        if isinstance(v, datetime):
            d[k] = v.isoformat()
    return d


def _new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:16]}"


# ─────────────────────────── leads / events ───────────────────────────

async def log_event(lead_id: str | None, type: str, payload: dict | None = None, actor: str = "",
                    is_test: bool = False) -> None:
    """Append an audit event for a lead. Never raises. `is_test` stamps whether this is a test-lifecycle
    event (inherited from the lead, so a test wipe removes it) — default false, so live flows and the
    owner-action audit trail (test_fill/test_wipe/owner_action, logged lead_id=None) stay live and survive."""
    pool = db.get_pool()
    try:
        async with pool.acquire() as con:
            await con.execute(
                "insert into events (lead_id, type, payload, actor, is_test) values ($1,$2,$3,$4,$5)",
                lead_id, type, payload or {}, actor or "", bool(is_test),
            )
    except Exception:  # pragma: no cover — an audit-log write must never break the caller
        log.exception("log_event failed (%s/%s)", lead_id, type)


async def create_lead(
    phone: str | None,
    name: str | None = None,
    business: str | None = None,
    email: str | None = None,
    ref: str | None = None,
    supabase_user_id: str | None = None,
) -> dict:
    """Create (or return the existing) lead, deduped on canonical E.164 phone. Idempotent: a repeat
    signup for the same phone updates the softer fields (name/business/email/ref if newly provided)
    and returns the same row.

    When `supabase_user_id` is provided (Google-prefill signup, where the user authenticated first),
    ADOPT the phoneless identity-lead that auth already minted for this user instead of inserting a
    duplicate: stamp the phone onto that row. This keeps the invariant of one human = one lead. Falls
    back to the phone-dedupe path (also stamping the uid, first-write-wins) if no identity-lead exists,
    or if that phone already belongs to a different lead."""
    cphone = canon(phone or "")
    if not cphone:
        raise ValueError("phone required")
    name = (name or "").strip()
    business = (business or "").strip()
    email = (email or "").strip()
    ref = (ref or "").strip()
    uid = (supabase_user_id or "").strip() or None

    pool = db.get_pool()
    async with pool.acquire() as con:
        # 1) Identity-lead (phoneless) already bound to this user → adopt it: set the phone now.
        if uid:
            ident = await con.fetchrow(
                "select * from leads where supabase_user_id = $1 and is_test = false "
                "order by updated_at desc limit 1", uid
            )
            if ident:
                # Guard: don't collide with a DIFFERENT lead that already owns this phone.
                other = await con.fetchrow(
                    "select id from leads where phone = $1 and id <> $2 and is_test = false",
                    cphone, ident["id"]
                )
                if not other:
                    await con.execute(
                        "update leads set phone = $2, "
                        "name = coalesce(nullif($3,''), name), "
                        "business = coalesce(nullif($4,''), business), "
                        "email = coalesce(nullif($5,''), email), "
                        "ref = coalesce(nullif($6,''), ref), "
                        "updated_at = now() where id = $1",
                        ident["id"], cphone, name, business, email, ref,
                    )
                    row = await con.fetchrow("select * from leads where id = $1", ident["id"])
                    await log_event(ident["id"], "signup_bound", {"ref": ref}, actor="public")
                    return _ser(row)
                # else: a phone-lead already exists → merge into IT below (stamping the uid).

        # 2) Existing phone-lead? Fill in newly provided softer fields; also stamp the uid if newly known.
        #    Live-only: a public signup never adopts a test lead (they carry supabase_user_id=NULL).
        existing = await con.fetchrow("select * from leads where phone = $1 and is_test = false", cphone)
        if existing:
            await con.execute(
                "update leads set "
                "name = coalesce(nullif($2,''), name), "
                "business = coalesce(nullif($3,''), business), "
                "email = coalesce(nullif($4,''), email), "
                "ref = coalesce(nullif($5,''), ref), "
                "supabase_user_id = coalesce(supabase_user_id, $6), "
                "updated_at = now() where id = $1",
                existing["id"], name, business, email, ref, uid,
            )
            row = await con.fetchrow("select * from leads where id = $1", existing["id"])
            await log_event(existing["id"], "signup_repeat", {"ref": ref}, actor="public")
            return _ser(row)

        # 3) Brand-new lead (unauthenticated signup, or authed with no identity-lead somehow).
        lead_id = _new_id("lead")
        await con.execute(
            "insert into leads (id, phone, name, business, email, status, ref, supabase_user_id) "
            "values ($1,$2,$3,$4,$5,'signed_up',$6,$7)",
            lead_id, cphone, name, business, email, ref, uid,
        )
        row = await con.fetchrow("select * from leads where id = $1", lead_id)
    await log_event(lead_id, "signed_up", {"ref": ref, "business": business}, actor="public")
    return _ser(row)


async def record_pricing_lead(name: str = "", business: str = "", email: str = "",
                              phone: str = "", ref: str = "", quiz: dict | None = None,
                              lead_id: str = "") -> dict | None:
    """The /precios calculator submission, stored on the SAME lead table everything else reads.

    Peter, 2026-08-14: «Email is the alert, not the record.» The alert is `brain/lead_notify.py`;
    this is the record, and it deliberately writes nowhere new — the CRM list, the call ingest, the
    wizard and the drip all read `leads`, and a pricing lead that lived in its own table would be a
    prospect none of them could see.

    IT APPENDS. IT DOES NOT ADOPT (rewritten 2026-08-15, review defect 4). This function used to
    look an existing lead up by ADDRESS and update it — name, business, ref — and then overwrite its
    `pricing_quiz` unconditionally. Its only caller is a public unauthenticated endpoint, so anybody
    who knew a prospect's email could rewrite that prospect's CRM row and replace the answers Peter
    reads before he rings them. The phone door was the same hole through `create_lead`, reachable by
    anybody who knew the number. A public write may create a row of its own; it may not reach into
    one it did not create.

    THE ONE EXCEPTION IS A CAPABILITY, NOT A LOOKUP. `lead_id` is the opaque `lead_<16 hex>` that
    `/api/signup` returns to the browser that just created that row — 64 bits of uuid4, held by that
    tab and nobody else, the same thing `/api/cal/book` already treats as proof. Presented, the quiz
    attaches to that lead and NOTHING ELSE on it is touched; the signup a second earlier is what
    wrote its name, business and number. That is what keeps the wired /precios flow one row per
    person instead of a duplicate beside every alta.

    WHAT AN APPEND COSTS, stated because it is a real trade: an anonymous submission from somebody
    who is already a lead now makes a second row rather than joining the first. `alert_account`
    still finds them — it joins on the address at read time (`lead_by_email`, newest first), which
    is a read and cannot be poisoned. A duplicate in a CRM is a nuisance; a stranger editing a
    prospect's row is not.

    THE PHONE IS KEPT ONLY WHEN IT IS FREE. `idx_leads_phone` is unique where phone is not null, so
    a number that already belongs to a lead makes the insert a no-op and the row is appended
    phoneless — the number still reaches Peter in the alert, which is the part he acts on. Writing
    it would mean adopting that other row, which is the defect this rewrite exists to close.
    """
    name, business = (name or "").strip(), (business or "").strip()
    email, ref = (email or "").strip(), (ref or "").strip()
    cphone = canon(phone or "")
    claim = (lead_id or "").strip()

    lead: dict | None = None
    pool = db.get_pool()

    if claim:
        async with pool.acquire() as con:
            row = await con.fetchrow(
                "select * from leads where id = $1 and is_test = false", claim)
        # An id that resolves to nothing falls through to the append rather than failing the submit:
        # a stale tab reposting after a test wipe is a lead, not an error.
        if row:
            lead = _ser(row)

    if lead is None:
        new_id = _new_id("lead")
        async with pool.acquire() as con:
            status = ""
            if cphone:
                status = await con.execute(
                    "insert into leads (id, phone, name, business, email, status, ref) "
                    "values ($1,$2,$3,$4,$5,'signed_up',$6) "
                    "on conflict (phone) where phone is not null do nothing",
                    new_id, cphone, name, business, email, ref)
            # No phone, or the number is already somebody's → the phoneless row. Same shape auth v2
            # already puts in this table (`brain/auth.py` mints phoneless identity-leads), so this
            # is not a new kind of row.
            if not str(status).endswith(" 1"):
                await con.execute(
                    "insert into leads (id, phone, name, business, email, status, ref) "
                    "values ($1, NULL, $2, $3, $4, 'signed_up', $5)",
                    new_id, name, business, email, ref)
            row = await con.fetchrow("select * from leads where id = $1", new_id)
        if not row:
            return None
        await log_event(new_id, "signed_up", {"ref": ref, "business": business, "via": "pricing"},
                        actor="public")
        lead = _ser(row)

    # The answers land LAST and in their own statement, so a jsonb the page shaped strangely can
    # never be what stops the lead itself from existing. By the time it runs, `lead` is either a row
    # this call just inserted or the row whose id the caller presented — the two cases where writing
    # to it is ours to do. It is no longer «the newest row with that address», which is what made
    # this line an unauthenticated edit of somebody else's prospect.
    if quiz is not None:
        try:
            async with pool.acquire() as con:
                await con.execute(
                    "update leads set pricing_quiz = $2, updated_at = now() where id = $1",
                    lead["id"], quiz)
            lead["pricing_quiz"] = quiz
        except Exception:  # pragma: no cover — the lead is worth more than the attachment
            log.exception("pricing_quiz write failed for %s", lead.get("id"))
        # The timeline gets the submission too, the same way every other lead action is recorded.
        await log_event(lead["id"], "pricing_quiz", {
            "band": (quiz or {}).get("band"),
            "orders": (quiz or {}).get("orders"),
            "modules": (quiz or {}).get("modules"),
            "total_cents": ((quiz or {}).get("chosen") or {}).get("total_cents"),
            "sales": (quiz or {}).get("sales"),
        }, actor="public")
    return lead


async def lead_by_email(email: str) -> dict | None:
    """The live lead behind an address, newest first — how the account alert finds out whether this
    person had already priced themselves on /precios. Read-only and fail-soft by construction."""
    e = (email or "").strip()
    if not e:
        return None
    pool = db.get_pool()
    async with pool.acquire() as con:
        row = await con.fetchrow(
            "select * from leads where lower(email) = lower($1) and is_test = false "
            "order by updated_at desc limit 1", e)
    return _ser(row) if row else None


async def get_lead(lead_id: str) -> dict | None:
    pool = db.get_pool()
    async with pool.acquire() as con:
        row = await con.fetchrow("select * from leads where id = $1", lead_id)
    return _ser(row) if row else None


async def list_leads(mode: bool = onboard_q.MODE_LIVE) -> list[dict]:
    """CRM list: newest first, each with a calls count + waitlist position (if the lead is on it).
    Scoped to `mode` (default LIVE) through the central chokepoint — an owner opts INTO test rows."""
    pool = db.get_pool()
    async with pool.acquire() as con:
        rows = await con.fetch(
            "select l.*, "
            "  (select count(*) from calls_onboard c where c.lead_id = l.id) as calls, "
            "  (select referral_code from waitlist w where w.lead_id = l.id limit 1) as referral_code "
            f"from leads l where {onboard_q.pred('leads', mode, 'l')} order by l.created_at desc"
        )
    out: list[dict] = []
    for r in rows:
        d = _ser(r)
        d["calls"] = int(d.get("calls") or 0)
        code = d.get("referral_code")
        if code:
            try:
                pos = await _waitlist.position(code)
                d["waitlist_position"] = pos.get("position") if pos else None
            except Exception:  # pragma: no cover
                d["waitlist_position"] = None
        else:
            d["waitlist_position"] = None
        out.append(d)
    return out


async def set_status(lead_id: str, status: str, actor: str = "peter") -> dict | None:
    """Set a lead's status and log the transition. Unknown statuses are rejected."""
    if status not in _VALID_STATUS:
        raise ValueError(f"invalid status: {status}")
    pool = db.get_pool()
    async with pool.acquire() as con:
        row = await con.fetchrow(
            "update leads set status = $2, updated_at = now() where id = $1 returning *",
            lead_id, status,
        )
    if not row:
        return None
    await log_event(lead_id, "status", {"status": status}, actor=actor)
    return _ser(row)


# ─────────────────────────── cal.com booking webhook ───────────────────────────

def _dig(d: dict, *keys):
    """Fetch the first present, truthy key from a dict (tolerant of webhook shape drift)."""
    for k in keys:
        v = d.get(k)
        if v:
            return v
    return None


async def booking_created(payload: dict) -> dict:
    """Handle a cal.com booking webhook. Tolerant of payload shape: cal.com nests the booking under
    `payload`, with attendees carrying name/email and responses carrying phone. Match a lead by
    phone (preferred) or email, set status=call_booked, store the booking uid. Returns
    {matched: bool, lead_id?}."""
    body = payload or {}
    inner = body.get("payload") if isinstance(body.get("payload"), dict) else body

    uid = _dig(inner, "uid", "bookingUid", "id") or _dig(body, "uid", "id")
    responses = inner.get("responses") if isinstance(inner.get("responses"), dict) else {}
    attendees = inner.get("attendees") if isinstance(inner.get("attendees"), list) else []
    first_att = attendees[0] if attendees else {}

    # Phone can live in a few places depending on the event type's questions.
    phone_raw = None
    for src in (responses, inner, first_att):
        if isinstance(src, dict):
            cand = _dig(src, "phone", "attendeePhoneNumber", "smsReminderNumber", "location")
            # responses fields are sometimes {value: ...}
            if isinstance(cand, dict):
                cand = cand.get("value")
            if cand:
                phone_raw = cand
                break
    email = _dig(first_att, "email") or _dig(inner, "attendeeEmail")
    if isinstance(responses.get("email"), dict):
        email = email or responses["email"].get("value")
    name = _dig(first_att, "name") or _dig(inner, "attendeeName")

    cphone = canon(phone_raw or "") if phone_raw else ""
    # Booking start (ISO) — mirror it into leads.cal_booking_start so the booking-status modal can show
    # the real date without a round-trip to cal.com. Tolerant of shape drift (a booking made directly on
    # cal.com populates this too). None → the column is simply left null (softer "you have a call" copy).
    start = _dig(inner, "start", "startTime") or _dig(body, "start", "startTime")
    start = str(start).strip() if start else None

    pool = db.get_pool()
    async with pool.acquire() as con:
        row = None
        # Live-only: a real cal.com booking can only ever match a LIVE lead (never a test lead).
        if cphone:
            row = await con.fetchrow("select * from leads where phone = $1 and is_test = false", cphone)
        if not row and email:
            row = await con.fetchrow(
                "select * from leads where lower(email) = lower($1) and is_test = false", email)
        if not row:
            log.info("cal.com booking matched no lead (phone=%s email=%s)", cphone, email)
            return {"matched": False}
        await con.execute(
            "update leads set status = 'call_booked', cal_booking_ref = $2, "
            "cal_booking_start = $4::timestamptz, "
            "name = coalesce(nullif($3,''), name), updated_at = now() where id = $1",
            row["id"], str(uid or ""), (name or ""), start,
        )
    await log_event(row["id"], "call_booked", {"uid": uid, "email": email, "start": start}, actor="cal.com")
    # Instant drip stop: the lead booked the call = funnel end (belt-and-braces with the run-due
    # reconciler). Guarded + fail-soft; lazy import to avoid an import cycle.
    if config.DRIP_ENABLED:
        try:
            from brain import drip as _drip
            await _drip.mark_completed(row["id"])
        except Exception:  # pragma: no cover — completion must never break the booking path
            log.exception("drip mark_completed failed for %s", row["id"])
    return {"matched": True, "lead_id": row["id"]}


# ─────────────────────────── tokens + wizard ───────────────────────────

async def mint_token(lead_id: str, tenant_slug: str | None = None, is_test: bool = False) -> str:
    """Mint an opaque token gating the personalized wizard for this lead, and seed its progress row.
    `is_test` is carried onto BOTH the token and its progress row so the mode travels with the token
    (a test token can only ever belong to a test lead — the caller guarantees that pairing at mint)."""
    token = secrets.token_urlsafe(24)
    pool = db.get_pool()
    async with pool.acquire() as con:
        await con.execute(
            "insert into onboarding_tokens (token, lead_id, tenant_slug, status, is_test) "
            "values ($1,$2,$3,'active',$4)",
            token, lead_id, tenant_slug, bool(is_test),
        )
        await con.execute(
            "insert into onboarding_progress (token, wizard_state, step, version, is_test) "
            "values ($1, '{}'::jsonb, 0, 0, $2) on conflict (token) do nothing",
            token, bool(is_test),
        )
    await log_event(lead_id, "token_minted", {"token": token}, actor="peter", is_test=bool(is_test))
    # WP-6 intake: stage the call ficha into the fresh wizard token so the wizard opens with Peter's
    # captured ficha ready to confirm. Fire-and-forget + fail-soft — never blocks minting the link.
    asyncio.create_task(_ensure_ficha_staged_bg(lead_id, token))
    return token


async def _lead_for_token(con, token: str) -> dict | None:
    """Resolve an ACTIVE token to its lead row, or None. Non-leaking: any invalid/used token → None."""
    tok = await con.fetchrow("select * from onboarding_tokens where token = $1", token)
    if not tok or tok["status"] != "active":
        return None
    if not tok["lead_id"]:
        return None
    lead = await con.fetchrow("select * from leads where id = $1", tok["lead_id"])
    return dict(lead) if lead else None


async def get_wizard(token: str) -> dict | None:
    """Validate the token (must be active) and return {lead:{name,business,phone}, wizard_state, step}.
    Non-leaking: returns None for any invalid/unknown/used token (no distinguishable error)."""
    token = (token or "").strip()
    if not token:
        return None
    pool = db.get_pool()
    async with pool.acquire() as con:
        lead = await _lead_for_token(con, token)
        if not lead:
            return None
        prog = await con.fetchrow("select * from onboarding_progress where token = $1", token)
        # The token's mode, so the frontend can show the TEST MODE banner on real test data only
        # (and never falsely on a live token someone appended ?test=1 to).
        is_test = await con.fetchval("select is_test from onboarding_tokens where token = $1", token)
    return {
        "lead": {
            "name": lead.get("name") or "",
            "business": lead.get("business") or "",
            "phone": lead.get("phone") or "",
        },
        "wizard_state": (dict(prog["wizard_state"]) if prog and prog["wizard_state"] else {}),
        "step": int(prog["step"]) if prog else 0,
        "is_test": bool(is_test),
    }


async def save_wizard(token: str, step: int, wizard_state: dict) -> dict | None:
    """Persist the wizard state verbatim (jsonb), bump step + version + updated_at. Returns
    {step, version} or None if the token is invalid/used."""
    token = (token or "").strip()
    if not token:
        return None
    try:
        step = int(step)
    except (TypeError, ValueError):
        step = 0
    if not isinstance(wizard_state, dict):
        wizard_state = {}
    pool = db.get_pool()
    async with pool.acquire() as con:
        lead = await _lead_for_token(con, token)
        if not lead:
            return None
        # `skus` (the parsed catalogue) is backend-owned — the frontend hydrates it but must never
        # wipe it (its state can be empty if it loaded before the upload finished). Preserve the
        # stored list when the incoming save doesn't carry a non-empty one.
        if not (isinstance(wizard_state.get("skus"), list) and wizard_state.get("skus")):
            existing = await con.fetchval(
                "select wizard_state->'skus' from onboarding_progress where token = $1", token)
            if existing:
                try:
                    import json as _json
                    prev = existing if isinstance(existing, list) else _json.loads(existing)
                    if isinstance(prev, list) and prev:
                        wizard_state = {**wizard_state, "skus": prev}
                except Exception:  # pragma: no cover — never fail a save over a preserve
                    pass
        row = await con.fetchrow(
            "update onboarding_progress set wizard_state = $2, step = $3, version = version + 1, "
            "updated_at = now() where token = $1 returning step, version",
            token, wizard_state, step,
        )
        if not row:
            # progress row missing (token minted before this table existed) — create it.
            row = await con.fetchrow(
                "insert into onboarding_progress (token, wizard_state, step, version) "
                "values ($1,$2,$3,1) returning step, version",
                token, wizard_state, step,
            )
    return {"step": int(row["step"]), "version": int(row["version"])}


async def save_catalogue(token: str, filename: str, content_bytes: bytes) -> dict | None:
    """Store an uploaded catalogue file under MEDIA_DIR/onboarding/<token>/ and flag the wizard state
    catalogue_uploaded=true. Parsing is a later slice. Returns {stored, path} or None if token bad."""
    token = (token or "").strip()
    if not token:
        return None
    pool = db.get_pool()
    async with pool.acquire() as con:
        lead = await _lead_for_token(con, token)
        if not lead:
            return None

    # Sanitize the filename to a safe basename (never let it escape the token dir).
    safe = re.sub(r"[^A-Za-z0-9._-]", "_", os.path.basename(filename or "catalogue"))[:120] or "catalogue"
    dest_dir = Path(config.MEDIA_DIR) / "onboarding" / re.sub(r"[^A-Za-z0-9._-]", "_", token)
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / safe
    dest.write_bytes(content_bytes or b"")

    # Merge-flag the wizard state (don't clobber the rest of it).
    async with db.get_pool().acquire() as con:
        await con.execute(
            "update onboarding_progress set "
            "wizard_state = coalesce(wizard_state,'{}'::jsonb) "
            "  || jsonb_build_object('catalogue_uploaded', true, 'catalogue_filename', $2::text), "
            "version = version + 1, updated_at = now() where token = $1",
            token, safe,
        )
    await log_event(lead["id"], "catalogue_uploaded", {"filename": safe}, actor="customer")
    return {"stored": True, "path": str(dest)}


async def submit_wizard(token: str, send_confirm: bool = True, paid: bool = False) -> dict | None:
    """Finalize onboarding: mark the token used, set the lead status=waitlisted, join the waitlist,
    send the confirmation email. Returns the waitlist dict {referral_code, position, total,
    invited_count} or None if the token is invalid/used. Idempotent-ish: a re-submit on an already-
    used token returns None (get_wizard already 404s it).

    send_confirm=False when the paid setup-fee flow (brain/setupfee.py) owns the customer email — its
    branded invoice email replaces the plain waitlist confirm, so we don't double-mail. paid=True just
    tags the audit event."""
    token = (token or "").strip()
    if not token:
        return None
    pool = db.get_pool()
    async with pool.acquire() as con:
        lead = await _lead_for_token(con, token)
        if not lead:
            return None
        # Read the referred_by the wizard may have carried through its state.
        prog = await con.fetchrow("select wizard_state from onboarding_progress where token = $1", token)
        state = dict(prog["wizard_state"]) if prog and prog["wizard_state"] else {}
        # The token carries the mode: a test submit joins the TEST waitlist (isolated rank), never the live one.
        mode = bool(await con.fetchval(
            "select is_test from onboarding_tokens where token = $1", token) or False)

    lead_id = lead["id"]
    first_name = (lead.get("name") or "").split(" ")[0] if lead.get("name") else ""
    # Attribution: prefer the wizard state, else fall back to the ?ref the lead was created with
    # (SignupModal captures ?ref/?r → /api/signup stores it as leads.ref).
    referred_by = state.get("referred_by") or state.get("ref") or (lead.get("ref") or None)

    # Join the waitlist FIRST (idempotent on phone), THEN flip the token. Order matters: if the process
    # dies between the two, the token stays 'active' so the Stripe webhook backstop simply re-runs (the
    # join is a no-op the second time) — we never end up with a 'used' token that has NO waitlist row,
    # which would strand a paid customer on a spinning status screen.
    wl = await _waitlist.join(
        lead_id=lead_id,
        phone=lead.get("phone") or "",
        email=lead.get("email") or "",
        first_name=first_name,
        referred_by=referred_by,
        is_test=mode,
    )

    # Claim the one-time finalize (guards a concurrent redirect + webhook racing). The loser still has a
    # real waitlist row from the idempotent join above, so it returns that — only the winner runs the
    # one-shot side effects (status, audit, the plain confirm email).
    async with pool.acquire() as con:
        used = await con.fetchval(
            "update onboarding_tokens set status = 'used', used_at = now() "
            "where token = $1 and status = 'active' returning token", token)
    if not used:
        return wl

    await set_status(lead_id, "waitlisted", actor="customer")
    await log_event(lead_id, "wizard_submitted",
                    {"referral_code": wl.get("referral_code"), "paid": bool(paid)},
                    actor="customer", is_test=mode)

    if send_confirm:
        try:
            await send_waitlist_confirm(lead, wl)
        except Exception:  # pragma: no cover — email is best-effort, never fail the submit
            log.exception("waitlist confirm email failed for %s", lead_id)
    return wl


async def waitlist_for_token(token: str) -> dict | None:
    """Resolve the waitlist position dict for the lead behind a token — even AFTER the token is used
    (so a paid re-finalize / Stripe webhook can still return the customer's #position). The
    onboarding_tokens→waitlist join by lead_id is mode-isolated (a lead is wholly test or live).
    Returns {referral_code, position, total, invited_count, share_url} or None."""
    token = (token or "").strip()
    if not token:
        return None
    pool = db.get_pool()
    async with pool.acquire() as con:
        row = await con.fetchrow(
            "select w.referral_code from onboarding_tokens t "
            "join waitlist w on w.lead_id = t.lead_id where t.token = $1 "
            "order by w.created_at desc limit 1", token)
    code = row["referral_code"] if row else None
    if not code:
        return None
    return await _waitlist.position(code)


async def lead_public_by_token(token: str) -> dict:
    """Public lead fields {name,business,phone,email} for a token regardless of token status (used on
    the paid-return screen, where the token is already 'used'). Empty dict if unknown."""
    token = (token or "").strip()
    if not token:
        return {}
    pool = db.get_pool()
    async with pool.acquire() as con:
        row = await con.fetchrow(
            "select l.name, l.business, l.phone, l.email from onboarding_tokens t "
            "join leads l on l.id = t.lead_id where t.token = $1", token)
    if not row:
        return {}
    return {"name": row["name"] or "", "business": row["business"] or "",
            "phone": row["phone"] or "", "email": row["email"] or ""}


# ─────────────────────────── call ingestion ───────────────────────────

_PHONE_LINE_RE = re.compile(r"^\s*-?\s*\*\*Phone:\*\*\s*(.+?)\s*$", re.IGNORECASE | re.MULTILINE)
_DURATION_LINE_RE = re.compile(r"^\s*-?\s*\*\*Duration:\*\*\s*(.+?)\s*$", re.IGNORECASE | re.MULTILINE)
_KIND_LINE_RE = re.compile(r"^\s*-?\s*\*\*Kind:\*\*\s*([A-Za-z0-9_-]+)", re.IGNORECASE | re.MULTILINE)


def _phone_from_note(text: str, note_path: Path) -> str:
    """Best-effort phone extraction, canonicalized to E.164. Prefers the `- **Phone:** ...` line;
    falls back to a run of digits in the filename (the note format is
    `YYYY-MM-DD_HHMM_<slug>.md`, so filename digits are usually a DATE, not a phone — only used as a
    last resort and still validated by canon())."""
    m = _PHONE_LINE_RE.search(text or "")
    if m:
        raw = m.group(1).strip()
        if raw and raw.lower() not in ("", "n/a", "none", "unknown"):
            c = canon(raw)
            if c.startswith("+"):
                return c
    # Filename fallback: a long-ish digit run that isn't the leading date stamp.
    stem = note_path.stem
    # Drop a leading YYYY-MM-DD_HHMM date stamp if present.
    stem = re.sub(r"^\d{4}-\d{2}-\d{2}_\d{3,4}_?", "", stem)
    digits = re.sub(r"\D", "", stem)
    if len(digits) >= 9:
        c = canon(digits)
        if c.startswith("+"):
            return c
    return ""


def _section(text: str, header: str) -> str:
    """Return the body of a `## <header>` section up to the next `## ` header (or EOF)."""
    pat = re.compile(rf"^##\s+{re.escape(header)}\s*$(.*?)(?=^##\s+|\Z)", re.IGNORECASE | re.MULTILINE | re.DOTALL)
    m = pat.search(text or "")
    if not m:
        return ""
    body = m.group(1).strip()
    # Strip a trailing horizontal rule the note format inserts between sections.
    body = re.sub(r"\n-{3,}\s*$", "", body).strip()
    return body


def _parse_note(text: str) -> dict:
    """Parse a call note into {transcript, raw_transcript, notes, duration_sec, kind}. Tolerant of
    missing sections: if neither ## Transcript nor ## Raw transcript exists, the whole body is the
    transcript. `notes` = Peter's own `## Notes` (or `## Notas`) section — the WP-6 intake reads it
    alongside the transcript so nothing he jotted down is lost."""
    transcript = _section(text, "Transcript")
    raw = _section(text, "Raw transcript")
    notes = _section(text, "Notes") or _section(text, "Notas")
    if not transcript and not raw:
        # No structured transcript sections → the whole body is the transcript, MINUS any notes
        # section (so Peter's notes stay attributable, not double-counted into the transcript).
        body = (text or "").strip()
        if notes and notes in body:
            body = body.replace(notes, "").strip()
        transcript = body
    kind_m = _KIND_LINE_RE.search(text or "")
    kind = kind_m.group(1).strip().lower() if kind_m else ""
    dur = None
    dm = _DURATION_LINE_RE.search(text or "")
    if dm:
        dur = _duration_to_sec(dm.group(1).strip())
    return {"transcript": transcript, "raw_transcript": raw, "notes": notes,
            "duration_sec": dur, "kind": kind}


def _duration_to_sec(s: str) -> int | None:
    """Parse '3:07' / '1:02:33' / '45s' / '2m 05s' → seconds. Best-effort."""
    s = (s or "").strip().lower()
    if not s:
        return None
    # H:MM:SS or M:SS
    if ":" in s:
        parts = [p for p in re.split(r":", s) if p != ""]
        try:
            nums = [int(re.sub(r"\D", "", p) or 0) for p in parts]
        except ValueError:
            return None
        sec = 0
        for n in nums:
            sec = sec * 60 + n
        return sec
    # '2m 05s' / '45s'
    total = 0
    mm = re.search(r"(\d+)\s*m", s)
    ss = re.search(r"(\d+)\s*s", s)
    if mm:
        total += int(mm.group(1)) * 60
    if ss:
        total += int(ss.group(1))
    return total or None


async def ingest_calls_once() -> int:
    """Scan CALLS_DIR for *.md notes not yet ingested; attach each to a lead by phone. Returns the
    number of new call rows written. Unmatched notes are skipped (never create a lead). Idempotent
    via the calls_onboard.note_path unique constraint."""
    if not CALLS_DIR.exists():
        return 0
    pool = db.get_pool()
    written = 0
    try:
        notes = sorted(CALLS_DIR.glob("*.md"))
    except Exception:  # pragma: no cover
        log.exception("ingest: glob failed")
        return 0

    for note in notes:
        note_path = str(note.resolve())
        try:
            async with pool.acquire() as con:
                seen = await con.fetchval(
                    "select 1 from calls_onboard where note_path = $1 limit 1", note_path
                )
            if seen:
                continue
            text = note.read_text(encoding="utf-8", errors="replace")
            phone = _phone_from_note(text, note)
            if not phone:
                continue  # can't attribute → skip (do NOT create a lead)
            async with pool.acquire() as con:
                lead = await con.fetchrow("select * from leads where phone = $1", phone)
            if not lead:
                continue  # unmatched → skip
            parsed = _parse_note(text)
            call_id = _new_id("call")
            async with pool.acquire() as con:
                inserted = await con.fetchval(
                    "insert into calls_onboard (id, lead_id, phone, note_path, transcript, "
                    "raw_transcript, notes, duration_sec, kind) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) "
                    "on conflict (note_path) do nothing returning id",
                    call_id, lead["id"], phone, note_path,
                    parsed["transcript"], parsed["raw_transcript"], parsed["notes"],
                    parsed["duration_sec"], parsed["kind"],
                )
            if not inserted:
                continue  # raced — another pass got it
            written += 1
            # Advance status to 'called' only from the earlier states.
            if (lead["status"] or "") in _INGEST_ADVANCEABLE:
                await set_status(lead["id"], "called", actor="ingest")
            await log_event(lead["id"], "call_ingested", {"note_path": note_path, "call_id": call_id}, actor="ingest")
            # WP-6 intake: extract the ficha from the transcript + Peter's notes. Fail-soft + fire-and-
            # forget — the extraction (Sonnet) must never stall or break the ingest scan. It writes
            # transcript_facts and, when the lead already has an active wizard token, STAGES a pending
            # ficha into wizard_state for Peter to confirm (never silently committed).
            asyncio.create_task(_extract_ficha_bg(call_id))
        except Exception:  # pragma: no cover — one bad note must never stop the scan
            log.exception("ingest: note failed %s", note_path)
            continue
    return written


async def ingest_loop() -> None:
    """Background poll: ingest new call notes every 60s. Self-healing (logs + continues)."""
    import asyncio
    while True:
        try:
            n = await ingest_calls_once()
            if n:
                log.info("onboarding: ingested %d new call note(s)", n)
        except Exception:  # pragma: no cover
            log.exception("onboarding ingest_loop iteration failed")
        await asyncio.sleep(60)


# ─────────────────────────── Sonnet P0 ficha extract (WP-6 intake) ───────────────────────────
# Peter's definition (2026-07-24): "transcript-based intake, WITH my own notes to ensure we capture
# it" — NOT auto-prefill. One Sonnet structured pass reads BOTH the call transcript AND Peter's own
# `## Notes` → a ficha {name, business, products mentioned, how orders arrive today, column-habit
# hints}, each field carrying its confidence + verbatim mentions (mirrors orders.record_order). The
# ficha is written to transcript_facts (the durable, per-field record the lead-detail surface shows)
# and STAGED into wizard_state under `ficha_staged` — a pending shape the wizard renders for Peter to
# CONFIRM. It is never silently committed (the real wizard fields — name/business/skus — are untouched).

# The five ficha fields. Scalars carry {value, confidence, mentions}; lists carry [{text, ...}].
_FICHA_SCALARS = ("name", "business", "how_orders_arrive_today")
_FICHA_LISTS = ("products_mentioned", "column_habit_hints")
_FICHA_FIELDS = _FICHA_SCALARS + _FICHA_LISTS

_RECORD_FICHA_TOOL = {
    "name": "record_ficha",
    "description": (
        "Record the onboarding FICHA for a small Spanish food producer-distributor, extracted from a "
        "discovery-call transcript AND the salesperson's own notes. Capture ONLY what is stated in "
        "either source — never invent a name, a product, or a habit. Leave a field empty/low-confidence "
        "when the sources don't support it. Both the transcript and the notes are authoritative; a fact "
        "stated in EITHER counts."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "name": {
                "type": "object",
                "description": "the contact person's name (the human on the call), if stated",
                "properties": {
                    "value": {"type": "string", "description": "the person's name, empty if not stated"},
                    "confidence": {"type": "string", "enum": ["low", "medium", "high"]},
                    "mentions": {"type": "array", "items": {"type": "string"},
                                 "description": "verbatim substrings from the sources that state it"},
                },
                "required": ["value", "confidence"],
            },
            "business": {
                "type": "object",
                "description": "the business / company name (e.g. 'Embutidos La Brújula'), if stated",
                "properties": {
                    "value": {"type": "string", "description": "the business name, empty if not stated"},
                    "confidence": {"type": "string", "enum": ["low", "medium", "high"]},
                    "mentions": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["value", "confidence"],
            },
            "how_orders_arrive_today": {
                "type": "object",
                "description": (
                    "how the supplier receives orders TODAY, in their words — e.g. 'WhatsApp y llamadas, "
                    "algún mensaje de voz'. Empty if not discussed."
                ),
                "properties": {
                    "value": {"type": "string", "description": "short description, empty if not stated"},
                    "confidence": {"type": "string", "enum": ["low", "medium", "high"]},
                    "mentions": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["value", "confidence"],
            },
            "products_mentioned": {
                "type": "array",
                "description": "each product/family the supplier said they sell or distribute (chorizo, salchichón, queso manchego, jamón…)",
                "items": {
                    "type": "object",
                    "properties": {
                        "text": {"type": "string", "description": "the product as stated"},
                        "confidence": {"type": "string", "enum": ["low", "medium", "high"]},
                    },
                    "required": ["text"],
                },
            },
            "column_habit_hints": {
                "type": "array",
                "description": (
                    "raw hints about how they run orders today that later shape THEIR Excel/columns — "
                    "cut-off time ('corte a las 10:30'), minimum order ('mínimo 60 €'), delivery days "
                    "('reparto lunes a viernes'), per-customer format habits, ERP/codes ('lo llevo en "
                    "Sage', 'código de cliente'). One hint per item, verbatim-ish."
                ),
                "items": {
                    "type": "object",
                    "properties": {
                        "text": {"type": "string", "description": "the hint as stated"},
                        "kind": {"type": "string", "description": "optional tag: corte | minimo | reparto | formato | erp | otro"},
                    },
                    "required": ["text"],
                },
            },
        },
        "required": ["name", "business", "products_mentioned", "how_orders_arrive_today", "column_habit_hints"],
    },
}

_FICHA_SYSTEM = (
    "You read a discovery call between a Rocoto salesperson (Peter) and a small Spanish family food "
    "producer-distributor (embutidos/charcutería, fruta-verdura, quesos, panadería), PLUS the "
    "salesperson's own shorthand notes. Your ONLY job is to fill the onboarding FICHA from what the "
    "two sources say — the contact's name, the business name, what products they sell, how orders "
    "reach them today, and any habits (cut-off, minimum, delivery days, codes/ERP) that will shape "
    "their daily order sheet. Read BOTH sources — a fact may appear only in the notes, or only in the "
    "transcript. NEVER invent anything; if the sources don't state a field, leave it empty and mark "
    "confidence low. Everything is in informal Spanish. A human confirms the ficha before it is used."
)


def _ficha_doc(transcript: str, notes: str) -> str:
    """The single user document handed to the model — BOTH sources, clearly labelled so the model
    (and the vital) can see that the transcript and Peter's notes each feed the extraction."""
    t = (transcript or "").strip()
    n = (notes or "").strip()
    return (
        "<transcript>\n" + (t or "(sin transcripción)") + "\n</transcript>\n\n"
        "<notas_del_comercial>\n" + (n or "(sin notas)") + "\n</notas_del_comercial>"
    )


def _ficha_sync(transcript: str, notes: str) -> dict | None:
    """Blocking Sonnet call (run in a thread). Returns the raw record_ficha tool input, or None."""
    if not config.ANTHROPIC_API_KEY:
        return None
    return _llm.call_tool_sync(
        config.FICHA_MODEL, _FICHA_SYSTEM, _ficha_doc(transcript, notes),
        _RECORD_FICHA_TOOL, "record_ficha", max_tokens=1500,
        fallback=getattr(config, "ORDER_EXTRACT_FALLBACK_MODEL", None) or None,
    )


async def _run_ficha_llm(transcript: str, notes: str) -> dict | None:
    """Async seam over the Sonnet extraction — the ONE place both sources reach the model. Overridden
    in tests to run the extraction deterministically."""
    return await asyncio.to_thread(_ficha_sync, transcript, notes)


def _normalize_ficha(raw: dict) -> dict:
    """Coerce the raw record_ficha tool output into the canonical `fields` shape, dropping anything
    the model didn't ground. Total + defensive (the model output is untrusted structure)."""
    raw = raw or {}
    fields: dict = {}
    for k in _FICHA_SCALARS:
        v = raw.get(k) or {}
        if not isinstance(v, dict):
            v = {}
        value = str(v.get("value") or "").strip()
        conf = str(v.get("confidence") or "").strip().lower()
        mentions = [str(m).strip() for m in (v.get("mentions") or []) if str(m).strip()]
        fields[k] = {"value": value, "confidence": conf if conf in ("low", "medium", "high") else "",
                     "mentions": mentions}
    for k in _FICHA_LISTS:
        items = []
        for it in (raw.get(k) or []):
            if isinstance(it, dict):
                text = str(it.get("text") or "").strip()
                if not text:
                    continue
                entry = {"text": text}
                conf = str(it.get("confidence") or "").strip().lower()
                if conf in ("low", "medium", "high"):
                    entry["confidence"] = conf
                kind = str(it.get("kind") or "").strip()
                if kind:
                    entry["kind"] = kind
                items.append(entry)
            elif isinstance(it, str) and it.strip():
                items.append({"text": it.strip()})
        fields[k] = items
    return fields


def _assemble_staged(fields: dict, call_id: str, from_transcript: bool, from_notes: bool) -> dict:
    """Wrap the normalized `fields` in the PENDING staged shape the wizard renders. `pending`/`confirmed`
    make it unambiguous this is a suggestion awaiting Peter's confirmation, never a committed value."""
    return {
        "pending": True,
        "confirmed": False,
        "source": {"call_id": call_id, "from_transcript": bool(from_transcript),
                   "from_notes": bool(from_notes)},
        "extracted_at": datetime.now(timezone.utc).isoformat(),
        **fields,
    }


async def _write_facts(con, call_id: str, lead_id: str, fields: dict, is_test: bool) -> None:
    """Idempotently persist the ficha as per-field transcript_facts rows (the lead-detail surface).
    Re-running for the same call replaces its ficha rows rather than piling up duplicates."""
    await con.execute(
        "delete from transcript_facts where call_id = $1 and field = any($2::text[])",
        call_id, list(_FICHA_FIELDS))
    for k in _FICHA_SCALARS:
        f = fields.get(k) or {}
        await con.execute(
            "insert into transcript_facts (id, call_id, lead_id, field, value, confidence, mentions, is_test) "
            "values ($1,$2,$3,$4,$5,$6,$7,$8)",
            _new_id("fact"), call_id, lead_id, k,
            {"value": f.get("value", "")}, f.get("confidence", ""),
            f.get("mentions", []), bool(is_test))
    for k in _FICHA_LISTS:
        items = fields.get(k) or []
        await con.execute(
            "insert into transcript_facts (id, call_id, lead_id, field, value, confidence, mentions, is_test) "
            "values ($1,$2,$3,$4,$5,$6,$7,$8)",
            _new_id("fact"), call_id, lead_id, k,
            {"items": items}, "", [], bool(is_test))


async def _active_token_for_lead(con, lead_id: str) -> str | None:
    """The lead's latest still-active wizard token (the one the customer is filling), or None."""
    return await con.fetchval(
        "select token from onboarding_tokens where lead_id = $1 and status = 'active' "
        "order by created_at desc limit 1", lead_id)


async def _merge_ficha_into_state(con, token: str, staged: dict) -> None:
    """Merge the staged ficha into wizard_state (jsonb || — never clobbers the wizard-owned blob)."""
    await con.execute(
        "update onboarding_progress set "
        "wizard_state = coalesce(wizard_state,'{}'::jsonb) || $2::jsonb, "
        "version = version + 1, updated_at = now() where token = $1",
        token, {"ficha_staged": staged})


async def extract_ficha(call_id: str) -> dict | None:
    """WP-6 intake: read a call's transcript + Peter's notes → one Sonnet extraction → the ficha, both
    persisted to transcript_facts AND staged (pending) into the lead's active wizard token for Peter to
    confirm. Returns the normalized `fields` dict, or None if there is nothing to extract / no signal.
    Total: never raises (callers fire it fire-and-forget)."""
    call_id = (call_id or "").strip()
    if not call_id:
        return None
    pool = db.get_pool()
    async with pool.acquire() as con:
        row = await con.fetchrow(
            "select lead_id, transcript, notes, is_test from calls_onboard where id = $1", call_id)
    if not row:
        return None
    transcript = row["transcript"] or ""
    notes = row["notes"] or ""
    if not transcript.strip() and not notes.strip():
        return None  # nothing to read
    lead_id = row["lead_id"]
    is_test = bool(row["is_test"])

    raw = await _run_ficha_llm(transcript, notes)
    if not raw:
        return None
    fields = _normalize_ficha(raw)
    staged = _assemble_staged(fields, call_id, bool(transcript.strip()), bool(notes.strip()))

    async with pool.acquire() as con:
        await _write_facts(con, call_id, lead_id, fields, is_test)
        token = await _active_token_for_lead(con, lead_id) if lead_id else None
        if token:
            await _merge_ficha_into_state(con, token, staged)
    if lead_id:
        await log_event(lead_id, "ficha_extracted",
                        {"call_id": call_id, "staged": bool(token), "from_notes": bool(notes.strip())},
                        actor="intake", is_test=is_test)
    return fields


async def _extract_ficha_bg(call_id: str) -> None:
    """Fail-soft background wrapper — an extraction failure must never break the ingest scan."""
    try:
        await extract_ficha(call_id)
    except Exception:  # pragma: no cover — total by contract
        log.exception("extract_ficha failed for %s", call_id)


async def stage_ficha_for_token(token: str) -> bool:
    """Rebuild the staged ficha from the token's lead's most-recent ficha facts and merge it into
    wizard_state. Used when a token is minted AFTER the call was already ingested (the facts exist but
    were never staged, because no token existed yet). No-op (False) when there are no ficha facts."""
    token = (token or "").strip()
    if not token:
        return False
    pool = db.get_pool()
    try:
        async with pool.acquire() as con:
            lead_id = await con.fetchval(
                "select lead_id from onboarding_tokens where token = $1 and status = 'active'", token)
            if not lead_id:
                return False
            frow = await con.fetchrow(
                "select call_id from transcript_facts where lead_id = $1 and field = any($2::text[]) "
                "order by created_at desc limit 1", lead_id, list(_FICHA_FIELDS))
            if not frow or not frow["call_id"]:
                return False
            call_id = frow["call_id"]
            rows = await con.fetch(
                "select field, value, confidence, mentions from transcript_facts "
                "where call_id = $1 and field = any($2::text[])", call_id, list(_FICHA_FIELDS))
            fields: dict = {}
            for r in rows:
                val = r["value"] if isinstance(r["value"], dict) else json.loads(r["value"] or "{}")
                if r["field"] in _FICHA_SCALARS:
                    mentions = r["mentions"] if isinstance(r["mentions"], list) else json.loads(r["mentions"] or "[]")
                    fields[r["field"]] = {"value": val.get("value", ""),
                                          "confidence": r["confidence"] or "", "mentions": mentions}
                else:
                    fields[r["field"]] = val.get("items", [])
            # Fill any missing field with an empty default so the staged shape is complete.
            for k in _FICHA_SCALARS:
                fields.setdefault(k, {"value": "", "confidence": "", "mentions": []})
            for k in _FICHA_LISTS:
                fields.setdefault(k, [])
            staged = _assemble_staged(fields, call_id, True, True)
            await _merge_ficha_into_state(con, token, staged)
        return True
    except Exception:  # pragma: no cover — total by contract
        log.exception("stage_ficha_for_token failed for %s", token)
        return False


async def _ensure_ficha_staged_bg(lead_id: str, token: str) -> None:
    """On token mint: stage the ficha into the fresh token. If the facts already exist (call ingested
    earlier) → stage them without a new LLM call; else if a call is attached but not yet extracted →
    extract it now (which stages). Fail-soft."""
    try:
        if await stage_ficha_for_token(token):
            return
        pool = db.get_pool()
        async with pool.acquire() as con:
            call_id = await con.fetchval(
                "select id from calls_onboard where lead_id = $1 order by created_at desc limit 1", lead_id)
        if call_id:
            await extract_ficha(call_id)
    except Exception:  # pragma: no cover — total by contract
        log.exception("_ensure_ficha_staged_bg failed for %s/%s", lead_id, token)


# ─────────────────────────── Rocoto-branded email (Resend direct) ───────────────────────────

# Rocoto palette (public/rocoto.css:6-31): terracotta / ink / cream.
_ROC_TERRACOTTA = "#C01B2C"
_ROC_INK = "#1A1413"
_ROC_CREAM = "#FAF7F3"
_ROC_STONE = "#6F665C"


# Rocoto's face — a blinking GIF, hosted so it works in email (theme-aware via prefers-color-scheme).
_ROC_FACE_LIGHT = "https://soyrocoto.com/brand/face-blink-light.gif"
_ROC_FACE_DARK = "https://soyrocoto.com/brand/face-blink-dark.gif"


def _shell(title: str, body_html: str, cta_text: str = "", cta_url: str = "") -> str:
    cta = (
        f'<a href="{cta_url}" style="display:inline-block;background:{_ROC_TERRACOTTA};color:#fff;'
        f'text-decoration:none;padding:15px 30px;border-radius:14px;font-weight:600;font-size:16px;'
        f'letter-spacing:.01em">{cta_text}</a>'
    ) if cta_text else ""
    # Theme-aware blinking face: the light GIF is the default <img>; a prefers-color-scheme:dark
    # media query swaps to the dark variant + flips the card/text colors for email dark mode.
    return (
        '<!--[if mso]><style>body,table,td{font-family:Arial,sans-serif !important}</style><![endif]-->'
        '<style>'
        '  @media (prefers-color-scheme: dark){'
        '    .roc-bg{background:#141010 !important}'
        '    .roc-card{background:#1F1917 !important;border-color:rgba(250,247,243,.12) !important}'
        '    .roc-title{color:#FAF7F3 !important}'
        '    .roc-body{color:#C9BFB4 !important}'
        '    .roc-body a{color:#F0857F !important}'
        '    .roc-foot{color:#8A7F72 !important}'
        '    .roc-face-light{display:none !important}'
        '    .roc-face-dark{display:inline-block !important}'
        '  }'
        '</style>'
        f'<div class="roc-bg" style="font-family:Inter,-apple-system,system-ui,\'Segoe UI\',sans-serif;'
        f'background:{_ROC_CREAM};padding:32px 20px;color:{_ROC_INK}">'
        f'<div class="roc-card" style="max-width:540px;margin:0 auto;background:#fff;'
        f'border:1px solid rgba(26,20,19,.10);border-radius:24px;overflow:hidden">'
        # Header — blinking face beside the wordmark, warm and human, not an admin banner.
        f'<div style="padding:30px 40px 8px 40px">'
        f'<img class="roc-face-light" src="{_ROC_FACE_LIGHT}" width="56" height="56" alt="Rocoto" '
        f'style="width:56px;height:56px;border-radius:50%;vertical-align:middle;display:inline-block">'
        f'<img class="roc-face-dark" src="{_ROC_FACE_DARK}" width="56" height="56" alt="Rocoto" '
        f'style="width:56px;height:56px;border-radius:50%;vertical-align:middle;display:none">'
        f'<span style="font-size:20px;font-weight:700;letter-spacing:-.01em;vertical-align:middle;'
        f'margin-left:12px;color:{_ROC_TERRACOTTA}">Rocoto</span>'
        f'</div>'
        # Body — generous type, comfortable line-height, real hierarchy.
        f'<div style="padding:8px 40px 40px 40px">'
        f'<h1 class="roc-title" style="font-size:28px;line-height:1.25;margin:16px 0 20px;'
        f'font-weight:700;letter-spacing:-.02em;color:{_ROC_INK}">{title}</h1>'
        f'<div class="roc-body" style="font-size:16px;line-height:1.6;color:{_ROC_STONE}">{body_html}</div>'
        f'<div style="margin-top:28px">{cta}</div>'
        f'</div>'
        f'</div>'
        f'<div class="roc-foot" style="text-align:center;color:#998F83;font-size:13px;'
        f'line-height:1.6;margin-top:20px">Rocoto · tu empleado de ventas</div>'
        f'</div>'
    )


async def _send(to: str, subject: str, html: str, attachments: list | None = None,
                headers: dict | None = None) -> dict:
    """Send a Rocoto-branded email via Resend directly. From = config.ONBOARD_EMAIL_FROM (display
    Rocoto, domain soyrocoto.com — Resend-verified). Optional `attachments` = Resend attachment dicts
    [{filename, content(base64)}] (e.g. the Stripe invoice PDF). Never raises.

    `headers` is ADDITIVE (§17.56c), and today carries exactly one thing: the RFC 8058
    List-Unsubscribe pair on MARKETING mail (brain/drip.py). This function does not decide which
    mail is marketing and must not — see the same note on actions.send_email."""
    to = (to or "").strip()
    if not to:
        return {"ok": False, "error": "no recipient"}
    if config.EGRESS_SANDBOX:
        # class-E floor (WP-2.5 rehearsal find): every raw Resend sender short-circuits under the sandbox.
        log.info("[EGRESS_SANDBOX] suppressed onboarding email to %s (subject=%r)", to, subject[:60])
        return {"ok": True, "id": "SANDBOX-email"}
    if not config.RESEND_API_KEY:
        log.info("RESEND_API_KEY unset — skipping onboarding email to %s", to)
        return {"ok": False, "error": "RESEND_API_KEY unset"}
    import httpx
    from_addr = getattr(config, "ONBOARD_EMAIL_FROM", "Rocoto <hello@soyrocoto.com>")
    reply_to = getattr(config, "ONBOARD_EMAIL_REPLY_TO", "") or ""
    payload = {"from": from_addr, "to": [to], "subject": subject, "html": html}
    if reply_to:
        payload["reply_to"] = reply_to
    if attachments:
        payload["attachments"] = attachments
    if headers:
        payload["headers"] = {str(k): str(v) for k, v in headers.items()}
    try:
        async with httpx.AsyncClient(timeout=30) as cx:
            r = await cx.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {config.RESEND_API_KEY}", "User-Agent": "rocoto-mailer/1.0"},
                json=payload,
            )
        return {"ok": r.status_code < 300, "error": "" if r.status_code < 300 else r.text[:200]}
    except Exception as e:  # pragma: no cover
        log.exception("onboarding email send error")
        return {"ok": False, "error": str(e)}


async def send_wizard_link(lead: dict, token: str) -> dict:
    """Email the customer their personalized wizard link (tu alta personalizada)."""
    to = (lead.get("email") or "").strip()
    if not to:
        return {"ok": False, "error": "lead has no email"}
    name = (lead.get("name") or "").split(" ")[0] if lead.get("name") else ""
    # Canonical wizard URL is /onboarding/<token>; /bienvenida/<token> stays a live alias (vercel).
    url = f"{PUBLIC_BASE_URL}/onboarding/{token}"
    greeting = f"Hola {name}," if name else "Hola,"
    body = (
        f'<p style="margin:0 0 16px">{greeting}</p>'
        '<p style="margin:0 0 16px">Soy Rocoto, tu nuevo empleado de ventas. Ya te tengo el '
        'alta preparada — solo necesito que me confirmes un par de cosas y me pongo a trabajar.</p>'
        '<p style="margin:0 0 16px">Dame dos minutos y estás dentro. Del resto me encargo yo.</p>'
        '<p style="margin:0">Nos vemos ahí,<br>Rocoto</p>'
    )
    return await _send(to, "Soy Rocoto — vamos a darte de alta", _shell("Te tengo el alta lista", body, "Empezar mi alta", url))


async def send_waitlist_confirm(lead: dict, wl: dict) -> dict:
    """Email the customer their waitlist position + their own referral link (/?r=<code>)."""
    to = (lead.get("email") or "").strip()
    if not to:
        return {"ok": False, "error": "lead has no email"}
    code = wl.get("referral_code") or ""
    pos = wl.get("position")
    ref_url = f"{PUBLIC_BASE_URL}/?r={code}" if code else PUBLIC_BASE_URL
    pos_line = (
        f'<p style="margin:0 0 16px">Ya te tengo apuntado — vas en el '
        f'<strong>puesto #{pos}</strong>.</p>' if pos else
        '<p style="margin:0 0 16px">Ya te tengo apuntado.</p>'
    )
    body = (
        f"{pos_line}"
        '<p style="margin:0 0 16px">En cuanto te toque, te aviso yo mismo y nos ponemos en marcha. '
        'No tienes que hacer nada más.</p>'
        '<p style="margin:0 0 16px">¿Con prisa? Cada colega que entre con tu enlace te sube puestos:</p>'
        f'<p style="margin:0 0 16px;word-break:break-all"><a href="{ref_url}" '
        f'style="color:{_ROC_TERRACOTTA};font-weight:600">{ref_url}</a></p>'
        '<p style="margin:0">Rocoto</p>'
    )
    return await _send(to, "Ya te tengo apuntado", _shell("Ya te tengo apuntado", body, "Ver mi puesto", ref_url))


async def send_setup_paid_email(lead: dict, wl: dict | None, invoice: dict | None,
                                amount_eur: str = "50", receipt_url: str = "") -> dict:
    """The branded 'alta confirmada' email sent once the €50 setup fee is paid. The ONE call to action
    is their status page (/waitlist) — their authoritative, logged-in home where they see their waitlist
    place AND the 'invite a friend' share button. We deliberately do NOT put the referral link in the
    email (that would just make them click their own link). The Stripe invoice PDF is attached; a plain
    'factura adjunta' line, no competing button. Best-effort; never raises."""
    to = (lead.get("email") or "").strip()
    if not to:
        return {"ok": False, "error": "lead has no email"}
    name = (lead.get("name") or "").split(" ")[0] if lead.get("name") else ""
    greeting = f"Hola {name}," if name else "Hola,"
    inv = invoice or {}
    pos = (wl or {}).get("position")
    status_url = f"{PUBLIC_BASE_URL}/waitlist"
    inv_number = inv.get("number") or ""
    has_pdf = bool(inv.get("pdf_url"))
    pos_line = (f'<p style="margin:0 0 16px">Ya te tengo apuntado — vas en el '
                f'<strong>puesto #{pos}</strong>.</p>' if pos else
                '<p style="margin:0 0 16px">Ya te tengo apuntado.</p>')
    fact_line = (
        f'<p style="margin:24px 0 0;color:#8A7F72;font-size:14px">'
        f'{"Tu factura" + (" nº " + inv_number if inv_number else "") + f" de {amount_eur}€ va adjunta en PDF." if has_pdf else f"Cuota única de alta: {amount_eur}€."}</p>'
    )
    body = (
        f'<p style="margin:0 0 16px">{greeting}</p>'
        f'<p style="margin:0 0 16px">¡Gracias! Tu alta con Rocoto está <strong>confirmada</strong> y '
        f'el pago de <strong>{amount_eur}€</strong> ha entrado correctamente.</p>'
        f'{pos_line}'
        '<p style="margin:0 0 16px">En cuanto podamos darte tu número, te aviso yo mismo y nos '
        'ponemos en marcha — no tienes que hacer nada más.</p>'
        '<p style="margin:0 0 16px">Entra a tu cuenta cuando quieras para ver tu puesto y, si tienes '
        'prisa, subir en la lista invitando a otros distribuidores.</p>'
        f'{fact_line}'
    )
    html = _shell("Tu alta está confirmada", body, "Ver mi puesto", status_url)
    attachments = None
    pdf_url = inv.get("pdf_url")
    if pdf_url:
        try:
            import base64

            import httpx
            async with httpx.AsyncClient(timeout=20) as cx:
                r = await cx.get(pdf_url)
            if r.status_code < 300 and r.content:
                fn = f"factura-rocoto{('-' + inv_number) if inv_number else ''}.pdf"
                attachments = [{"filename": fn,
                                "content": base64.b64encode(r.content).decode("ascii")}]
        except Exception:  # pragma: no cover — attachment is a nicety; the hosted link still ships
            log.exception("invoice pdf fetch failed")
    return await _send(to, "Tu alta con Rocoto está confirmada", html, attachments=attachments)


async def send_friend_joined(referrer_code: str) -> dict:
    """Optional: notify a referrer that a friend joined with their code (on bump). Best-effort — needs
    the referrer's email, which we look up from their waitlist row's lead."""
    code = (referrer_code or "").strip()
    if not code:
        return {"ok": False, "error": "no code"}
    pool = db.get_pool()
    async with pool.acquire() as con:
        row = await con.fetchrow(
            "select w.email as w_email, w.invited_count, l.email as l_email, l.name "
            "from waitlist w left join leads l on l.id = w.lead_id where w.referral_code = $1",
            code,
        )
    if not row:
        return {"ok": False, "error": "referrer not found"}
    to = (row["l_email"] or row["w_email"] or "").strip()
    if not to:
        return {"ok": False, "error": "referrer has no email"}
    count = int(row["invited_count"] or 0)
    body = (
        '<p style="margin:0 0 16px">Oye, buenas noticias — acaba de entrar un colega tuyo '
        'con tu enlace. Te acabo de subir puestos.</p>'
        f'<p style="margin:0 0 16px">Ya llevas <strong>{count}</strong> '
        f'{"invitación" if count == 1 else "invitaciones"} — sigue así y te toca antes.</p>'
        '<p style="margin:0">Rocoto</p>'
    )
    return await _send(to, "Se acaba de unir un colega tuyo", _shell("Te he subido puestos", body, "Ver mi puesto", f"{PUBLIC_BASE_URL}/?r={code}"))


# ══════════════════════════════════════════════════════════════════════════════════════════════════
# THE APP WIZARD — the same onboarding, driven by the Android app instead of the web page.
#
# It does NOT fork the state machine. The token is still the key, the state is still
# onboarding_progress.wizard_state, and get_wizard / save_wizard / save_catalogue / submit_wizard are
# still the only writers. What is new here is that the STEP LIST IS DATA: id · title · subtitle · kind
# · required · value. The app renders steps it was never compiled against, and adding or retiring one
# is a change in this list, not a release of the app.
#
# TWO THINGS THE PRODUCT DECIDED (spec D):
#  · There is NO phone-number step. We never issue a number and never promise a call as the product.
#  · The LAST step is WhatsApp: they connect the number their customers already write to. Meta has not
#    granted us Coexistence yet, so it ships as an HONEST placeholder — `state: "pending_capability"`
#    with a sentence that says exactly what it is waiting on. It is not a button that lies. The day
#    access lands, `settings_set('whatsapp_coexistence', {...})` flips it to "ready": a DATA change.
# ══════════════════════════════════════════════════════════════════════════════════════════════════

# Runtime setting that ungates the coexistence step (same agent_settings mechanism as the gate).
COEXISTENCE_SETTING = "whatsapp_coexistence"

_COEX_PENDING_NOTE = (
    "Estamos terminando el permiso con Meta para conectar tu número de siempre sin que pierdas ni un "
    "chat ni un contacto. Todavía no puedo hacerlo desde aquí, así que este paso se queda pendiente: "
    "guardo todo lo demás y te aviso yo el día que se abra. No tienes que hacer nada."
)
_COEX_READY_NOTE = (
    "Conecta el número que ya usan tus clientes. No cambias de número, no avisas a nadie y tus chats "
    "siguen donde están."
)

# ── the step list ───────────────────────────────────────────────────────────────────────────────────
# `keys` are the wizard_state keys the step OWNS — the only ones a save of that step may write. This
# is what keeps the app from clobbering state it knows nothing about (e.g. `skus`, which is
# backend-owned; save_wizard defends it a second time).
APP_STEPS: list[dict] = [
    {"id": "catalogue", "kind": "catalogue_upload", "required": True,
     "title": "Sube tu catálogo",
     "subtitle": "El Excel o el PDF que ya tienes. Da igual lo desordenado que esté.",
     "keys": ["catalogue_submitted", "catalogue_filename", "catalogue_count", "catalogue_legit",
              "catalogue_checking", "upload_mode", "program"]},
    {"id": "products", "kind": "product_ranges", "required": True,
     "title": "Entendiendo tu gama",
     "subtitle": "Cuánto se suele pedir de cada cosa. Así sé cuándo un pedido se sale de lo normal.",
     "keys": ["products", "unmatched", "matching_status"]},
    {"id": "radius", "kind": "delivery_radius", "required": True,
     "title": "¿Hasta dónde repartes?",
     "subtitle": "Un radio en kilómetros desde tu almacén. Con eso sé a quién puedo decirle que sí.",
     "keys": ["range_km", "depot_lat", "depot_lon", "depot_label"]},
    {"id": "excel", "kind": "time_of_day", "required": True,
     "title": "¿A qué hora te envío el Excel?",
     "subtitle": "El parte del día, en tu correo, a la hora que te venga bien.",
     "keys": ["excel_send_time"]},
    {"id": "accept", "kind": "rule_list", "required": False,
     "title": "Lo que acepto solo",
     "subtitle": "Lo que puedo dar por bueno sin molestarte.",
     "keys": ["auto_accept_rules"]},
    {"id": "hold", "kind": "rule_list", "required": False,
     "title": "Lo que te dejo a confirmar",
     "subtitle": "Lo que prefieres mirar tú antes de que salga.",
     "keys": ["hold_rules"]},
    {"id": "voice", "kind": "voice_pick", "required": False,
     "title": "Elige la voz de Rocoto",
     "subtitle": "Con esta voz hablo con tus clientes.",
     "keys": ["voice_id"]},
    {"id": "waking", "kind": "time_range", "required": True,
     "title": "¿Cuándo estás despierto?",
     "subtitle": "Fuera de esa franja no te escribo: contesto yo y te lo dejo hecho para la mañana.",
     "keys": ["waking_from", "waking_to"]},
    {"id": "whatsapp", "kind": "whatsapp_connect", "required": False,
     "title": "Conecta tu WhatsApp",
     "subtitle": "El número que ya usan tus clientes. Ni cambias de número ni avisas a nadie.",
     "keys": ["whatsapp_ack"]},
]

APP_STEP_IDS: tuple[str, ...] = tuple(s["id"] for s in APP_STEPS)

# ── the MIGRATION (a step list with LIVE TOKENS in flight is never a delete) ────────────────────────
# Two kinds of in-flight state can point at a step that no longer exists:
#   1. an id that was retired — the phone/number step, and the web wizard's zone-drawing `catchment`
#      step, which the radius decision (WP-4) replaced;
#   2. a bare NUMERIC step index saved by the web wizard, whose list is a different length.
# Both resolve, neither strands anyone:
_RETIRED_STEP_IDS = {
    # every wording the phone step ever had → it now lands on the WhatsApp step, which is the honest
    # successor: the question was always "what number do your customers write to?".
    "number": "whatsapp", "phone": "whatsapp", "numero": "whatsapp", "número": "whatsapp",
    "telefono": "whatsapp", "teléfono": "whatsapp", "phone_number": "whatsapp",
    "whatsapp_number": "whatsapp", "wa": "whatsapp",
    # the web wizard's zone step → the radius step (same question, locked answer shape)
    "catchment": "radius", "zonas": "radius", "zones": "radius", "area": "radius",
}
# The web wizard's own order, so a numeric step saved by the WEB resolves to the RIGHT app step rather
# than to whatever happens to sit at that index here. Kept verbatim from landing-react/src/Wizard.tsx.
_WEB_STEP_ORDER = ("catalogue", "products", "catchment", "excel", "accept", "hold", "voice", "waking")
# …and the reverse, because `onboarding_progress.step` is SHARED with the web wizard. The app's true
# pointer lives in wizard_state.app_step_id; the shared integer column is always written in the WEB's
# own vocabulary so a customer who starts in the app and opens the emailed link lands somewhere real.
# (Wizard.tsx clamps too — belt and braces, and it keeps the column honest.)
_APP_TO_WEB_STEP = {"catalogue": 0, "products": 1, "radius": 2, "excel": 3, "accept": 4,
                    "hold": 5, "voice": 6, "waking": 7, "whatsapp": 7}


def _web_step(step_id: str) -> int:
    return _APP_TO_WEB_STEP.get(step_id, 0)


def step_index(step_id: str) -> int:
    """Index of a step id in APP_STEPS, or -1."""
    try:
        return APP_STEP_IDS.index(step_id)
    except ValueError:
        return -1


def resolve_step_id(raw, state: dict | None = None) -> str:
    """ANY historical step pointer → a step id that EXISTS today. Never raises, never returns ''.

    Accepts: a current id · a retired id (mapped) · a numeric index saved by the web wizard (mapped
    through the web's own order first, then clamped) · None/garbage (→ the first step). This is the
    whole migration: an in-flight token that answered the phone step resolves onto the WhatsApp step,
    and an in-flight token sitting on the web's `catchment` step resolves onto `radius`."""
    if isinstance(raw, str):
        s = raw.strip().lower()
        if s in APP_STEP_IDS:
            return s
        if s in _RETIRED_STEP_IDS:
            return _RETIRED_STEP_IDS[s]
        if s.isdigit():
            raw = int(s)
        else:
            return APP_STEP_IDS[0]
    if isinstance(raw, bool):                    # bool is an int in Python — never a step
        return APP_STEP_IDS[0]
    if isinstance(raw, int):
        i = max(0, raw)
        if i < len(_WEB_STEP_ORDER):             # a web-wizard index: translate through ITS order
            return resolve_step_id(_WEB_STEP_ORDER[i])
        return APP_STEP_IDS[min(i, len(APP_STEP_IDS) - 1)]
    # nothing usable: an explicitly stored app step id wins if the state carries one
    if isinstance(state, dict):
        s = state.get("app_step_id")
        if isinstance(s, str) and s:
            return resolve_step_id(s)
    return APP_STEP_IDS[0]


def _coex_state(setting: dict | None) -> tuple[str, str]:
    """(state, note) for the WhatsApp step. 'ready' needs BOTH the runtime flag AND somewhere to send
    them — a flag with no signup URL is still pending, because a button with no destination lies."""
    s = setting or {}
    url = str(s.get("signup_url") or "").strip()
    if bool(s.get("enabled")) and url:
        return ("ready", _COEX_READY_NOTE)
    return ("pending_capability", _COEX_PENDING_NOTE)


async def coexistence_setting() -> dict:
    """Runtime state of the WhatsApp Coexistence capability. Fail-soft → pending."""
    try:
        return await db.settings_get(COEXISTENCE_SETTING) or {}
    except Exception:
        log.exception("coexistence setting read failed")
        return {}


def app_steps(state: dict | None, coex: dict | None = None) -> list[dict]:
    """THE STEP LIST AS DATA, with each step's current value read out of the wizard state. Pure — no
    IO, no clock — so the shape is provable without a database."""
    st = state if isinstance(state, dict) else {}
    coex_state, coex_note = _coex_state(coex)
    out: list[dict] = []
    for s in APP_STEPS:
        value = {k: st.get(k) for k in s["keys"] if st.get(k) is not None}
        step = {"id": s["id"], "kind": s["kind"], "title": s["title"], "subtitle": s["subtitle"],
                "required": bool(s["required"]), "keys": list(s["keys"]), "value": value,
                "done": _step_done(s["id"], st)}
        if s["id"] == "whatsapp":
            step["state"] = coex_state
            step["note"] = coex_note
            step["blocking"] = False       # a capability WE are waiting on never blocks the customer
            if coex_state == "ready":
                step["signup_url"] = str((coex or {}).get("signup_url") or "")
        out.append(step)
    return out


def _step_done(step_id: str, st: dict) -> bool:
    """Has this step been answered? Used for the progress dots and to pick `next_step_id` — never to
    block: the customer can always go back."""
    if step_id == "catalogue":
        return bool(st.get("catalogue_submitted")) or bool(st.get("skus"))
    if step_id == "products":
        return bool(st.get("products"))
    if step_id == "radius":
        return st.get("range_km") is not None
    if step_id == "excel":
        return bool(st.get("excel_send_time"))
    if step_id == "accept":
        return bool(st.get("auto_accept_rules"))
    if step_id == "hold":
        return bool(st.get("hold_rules"))
    if step_id == "voice":
        return bool(st.get("voice_id"))
    if step_id == "waking":
        return bool(st.get("waking_from") and st.get("waking_to"))
    if step_id == "whatsapp":
        return bool(st.get("whatsapp_ack"))
    return False


def next_step_id(state: dict | None) -> str:
    """The furthest UNANSWERED step — where the app should drop them. Falls back to the last step when
    everything is answered (that is the WhatsApp step, which is where a finished wizard belongs)."""
    st = state if isinstance(state, dict) else {}
    for s in APP_STEPS:
        if not _step_done(s["id"], st):
            return s["id"]
    return APP_STEP_IDS[-1]


def can_submit(state: dict | None) -> tuple[bool, list[str]]:
    """(ok, missing[]) — every REQUIRED step answered. The WhatsApp step is deliberately not required:
    we are the ones who aren't ready, and the customer must never be held hostage to our permissions."""
    st = state if isinstance(state, dict) else {}
    missing = [s["id"] for s in APP_STEPS if s["required"] and not _step_done(s["id"], st)]
    return (not missing, missing)


async def app_wizard_head(token: str) -> dict | None:
    """The compact wizard block the gate carries: {token, step, total_steps, next_step_id}. None when
    the token is not usable (the gate then hands NOTHING back — a waiting customer gets no token)."""
    w = await get_wizard(token)
    if w is None:
        return None
    st = w.get("wizard_state") or {}
    nid = next_step_id(st)
    return {"token": token, "step": step_index(nid), "total_steps": len(APP_STEPS),
            "next_step_id": nid}


async def app_wizard(token: str) -> dict | None:
    """The full app wizard payload. None for an invalid/used/unknown token (non-leaking, same posture
    as get_wizard — the caller 404s)."""
    w = await get_wizard(token)
    if w is None:
        return None
    st = w.get("wizard_state") or {}
    coex = await coexistence_setting()
    nid = next_step_id(st)
    ok, missing = can_submit(st)
    return {
        "ok": True,
        "token": token,
        "is_test": bool(w.get("is_test")),
        "lead": {"name": (w.get("lead") or {}).get("name") or "",
                 "business": (w.get("lead") or {}).get("business") or ""},
        "steps": app_steps(st, coex),
        "step": step_index(nid),
        "next_step_id": nid,
        "total_steps": len(APP_STEPS),
        "can_submit": ok,
        "missing": missing,
        # the wizard's own stored pointer, resolved through the migration — so a token that predates
        # this step list still lands on a step that exists.
        "resume_step_id": resolve_step_id(st.get("app_step_id", w.get("step")), st),
        "catalogue_upload_url": f"/api/wizard/{token}/catalogue",
        "matching_url": f"/api/wizard/{token}/matching",
    }


_MAX_RULE_LEN = 240
_MAX_RULES = 24


def _sanitize(step_id: str, value: dict | None) -> dict:
    """Only the keys the step OWNS, coerced to the shape the rest of the system already expects. A save
    can never reach a key belonging to another step, and never wipes backend-owned state."""
    v = value if isinstance(value, dict) else {}
    spec = next((s for s in APP_STEPS if s["id"] == step_id), None)
    if not spec:
        return {}
    out: dict = {}
    for k in spec["keys"]:
        if k not in v:
            continue
        val = v[k]
        if k in ("auto_accept_rules", "hold_rules"):
            if isinstance(val, list):
                out[k] = [str(x)[:_MAX_RULE_LEN] for x in val[:_MAX_RULES] if str(x).strip()]
            continue
        if k in ("products", "unmatched"):
            out[k] = val if isinstance(val, list) else []
            continue
        if k in ("range_km", "depot_lat", "depot_lon"):
            try:
                out[k] = float(val) if val is not None else None
            except (TypeError, ValueError):
                pass
            continue
        if k == "catalogue_count":
            try:
                out[k] = int(val)
            except (TypeError, ValueError):
                pass
            continue
        if k in ("catalogue_submitted", "catalogue_legit", "catalogue_checking", "whatsapp_ack"):
            out[k] = bool(val)
            continue
        out[k] = ("" if val is None else str(val))[:200]
    return out


async def app_wizard_save(token: str, step_id: str, value: dict | None = None,
                          submit: bool = False) -> dict | None:
    """Persist ONE app wizard step (and optionally finalize). Reuses save_wizard/submit_wizard verbatim
    — this is the same wizard, driven from a different surface.

    Returns the full app_wizard payload with {saved:true}, or, on submit, {submitted:true, waitlist}.
    None for an invalid/used token. A submit with a required step still unanswered comes back
    {ok:false, error:'incomplete', missing:[...]} rather than half-finishing anyone."""
    token = (token or "").strip()
    if not token:
        return None
    w = await get_wizard(token)
    if w is None:
        return None
    st = dict(w.get("wizard_state") or {})
    sid = resolve_step_id(step_id, st)
    patch = _sanitize(sid, value)
    st.update(patch)
    if sid == "whatsapp":
        # We record that they SAW the honest placeholder. It is an acknowledgement, never a connection.
        coex_state, _ = _coex_state(await coexistence_setting())
        st["whatsapp_state"] = coex_state
    st["app_step_id"] = sid                       # the app's own resume pointer (survives reorders)

    if submit:
        ok, missing = can_submit(st)
        if not ok:
            await save_wizard(token, _web_step(sid), st)
            # the full payload FIRST, then the refusal on top — the refusal must win the merge.
            return {**((await app_wizard(token)) or {}),
                    "ok": False, "error": "incomplete", "missing": missing,
                    "message": "Todavía falta algo por contestar antes de terminar."}
        await save_wizard(token, _web_step(APP_STEP_IDS[-1]), st)
        wl = await submit_wizard(token)
        if wl is None:
            return None
        return {"ok": True, "submitted": True, "waitlist": wl,
                "total_steps": len(APP_STEPS)}

    nid = next_step_id(st)
    await save_wizard(token, _web_step(nid), st)
    out = await app_wizard(token)
    if out is None:
        return None
    out["saved"] = True
    out["saved_step_id"] = sid
    return out


# ══════════════════════════════════════════════════════════════════════════════════════════════════
#  §5.10.2 · THE CATALOGUE INTAKE — give it anything, SEE what was understood, correct it, commit
#  (Peter, 2026-07-27: "there should be an upload feature in the desktop app and the mobile app
#   where I can upload, I can paste, and it should use another limb to ingest it… it analyzes it so
#   that it's formatted and taken in well. So the order brain can use it.")
#
#  WHAT WAS ALREADY THERE, and is therefore not rebuilt here: the parser (`brain/skuparse`, real
#  Sonnet over CSV/Excel/PDF/photo, and — as of today — over a PASTE), the Haiku legitimacy gate
#  (`brain/onboarding_ext._legit_check_sync`), the writer (`brain/golive.seed_catalogue`), the
#  vocabulary pass and the embedding. WHAT WAS MISSING is everything BETWEEN a supplier having a
#  list and that list being trusted: a paste path, a preview, a correction step, and re-ingestion
#  semantics anybody can see. `POST /api/app/catalogue/upload` parsed and committed in ONE call —
#  nobody had ever laid eyes on what the model read before it became the grounding.
#
#  WHY A ROW AND NOT A REQUEST. An ingestion is a small DURABLE object because it must survive the
#  app being killed mid-parse, must be correctable on the desk after being pasted on the phone (the
#  wizard's desktop↔mobile handoff already proves people want exactly this), and must stay
#  answerable afterwards — «what did the model actually read, before I corrected it» is the question
#  that tunes the parser. Hence two columns: `parsed` is written ONCE and never mutated, `edits`
#  overlays it at read time. A corrected intake still tells us what the parser got wrong.
#
#  ONE ROAD INTO `catalogue_skus`. The commit goes through `golive.seed_catalogue` and nothing else.
#  This organ never writes a SKU row itself — it writes an intake, and asks that function to install
#  it. Its opinions (tenant-namespaced ids, in_assortment=false on removal, pack_factor and
#  variable_weight excluded from the update set, `source='golive'` aliases rebuilt while every other
#  source is untouched, refuse-on-zero) are the CONTRACT the preview RENDERS, not suggestions to
#  re-derive here (§5.10.4).
# ══════════════════════════════════════════════════════════════════════════════════════════════════


# How much of a tabular source the parse must account for before a commit stops being routine. A
# deterministic row count exists ONLY for tabular sources; a PDF or a photograph has none, so there
# is NO guard there and the preview says so rather than implying one. A guard he thinks he has and
# does not is worse than no guard at all.
INTAKE_COUNT_GUARD = float(os.getenv("ROCOTO_INTAKE_COUNT_GUARD", "0.60"))
INTAKE_TTL_DAYS = int(os.getenv("ROCOTO_INTAKE_TTL_DAYS", "7"))

_INTAKE_DIR = Path(config.MEDIA_DIR) / "intake"
_schema_ready = False


async def ensure_intake_schema(con=None) -> None:
    """Verify migration ownership; application requests never alter schema."""
    from schema_migrations import assert_current

    if con is not None:
        await assert_current(con)
        return
    async with db.get_pool().acquire() as connection:
        await assert_current(connection)


def _intake_id() -> str:
    return "ing_" + secrets.token_urlsafe(12)


def _safe_name(name: str) -> str:
    return (re.sub(r"[^A-Za-z0-9._-]", "_", os.path.basename(name or ""))[:120] or "catalogo")


# ── create + parse ────────────────────────────────────────────────────────────────────────────────

async def create_intake(tenant: str, created_by: str, *, source_kind: str, source_name: str,
                        raw_bytes: bytes | None = None, text: str | None = None) -> dict:
    """Mint the row and stash the bytes. Returns {id, state:'parsing'}. The PARSE is not done here —
    a real Excel takes tens of seconds and the phone must not hold a socket open for it."""
    await ensure_intake_schema()
    if source_kind not in ("file", "paste"):
        return {"ok": False, "reason": "bad_source"}
    iid = _intake_id()
    ref = ""
    try:
        d = _INTAKE_DIR / iid
        d.mkdir(parents=True, exist_ok=True)
        if source_kind == "file":
            dest = d / _safe_name(source_name)
            dest.write_bytes(raw_bytes or b"")
        else:
            dest = d / "pegado.txt"
            dest.write_text(text or "", encoding="utf-8")
        ref = str(dest)
    except Exception:
        log.exception("intake: could not store the source bytes for %s", iid)
        return {"ok": False, "reason": "store_failed"}
    async with db.get_pool().acquire() as con:
        await con.execute(
            "insert into catalogue_intake (id, tenant_id, created_by, source_kind, source_name, "
            "raw_ref, state, expires_at) values ($1,$2,$3,$4,$5,$6,'parsing', now() + ($7 || ' days')::interval)",
            iid, tenant, (created_by or "")[:200], source_kind,
            (source_name or ("pegado" if source_kind == "paste" else "catálogo"))[:200],
            ref, str(INTAKE_TTL_DAYS))
    log.info("intake %s minted for %s (%s · %s)", iid, tenant, source_kind, source_name)
    return {"ok": True, "id": iid, "state": "parsing"}


# HOW MANY PARSES MAY BE IN FLIGHT AT ONCE (2026-08-09 review, F5). Every door onto this function
# fired it through a bare `asyncio.create_task`, so the number of concurrent parses was the number
# of concurrent uploads — unbounded, on a box running ONE uvicorn worker that also answers paying
# customers' WhatsApp webhooks. Each parse is a worker thread plus up to `_MAX_CHUNKS` model calls;
# three at a time keeps a real onboarding responsive and makes a flood QUEUE instead of thrashing.
# The queue is bounded in turn by the per-tenant/per-IP/global upload limits at the demo door.
_INTAKE_CONCURRENCY = int(os.getenv("ROCOTO_INTAKE_CONCURRENCY", "3") or "3")
_intake_sem: asyncio.Semaphore | None = None


def _intake_gate() -> asyncio.Semaphore:
    """Created on first use, not at import: a Semaphore built at module scope binds to whatever loop
    happens to be current, and this module is imported by tooling that has none."""
    global _intake_sem
    if _intake_sem is None:
        _intake_sem = asyncio.Semaphore(_INTAKE_CONCURRENCY)
    return _intake_sem


async def run_intake(intake_id: str) -> dict:
    """Parse the stored source and land the result on the row. Runs in the background; NEVER raises.
    A failure is a `failed` STATE with a sentence, not a lost intake — the bytes are still there and
    the operator can see what happened.

    Serialised behind `_intake_gate()` — see the note above."""
    async with _intake_gate():
        return await _run_intake_inner(intake_id)


async def _run_intake_inner(intake_id: str) -> dict:
    await ensure_intake_schema()
    async with db.get_pool().acquire() as con:
        row = await con.fetchrow(
            "select id, tenant_id, source_kind, source_name, raw_ref, state "
            "from catalogue_intake where id=$1", intake_id)
    if row is None:
        return {"ok": False, "reason": "not_found"}
    if row["state"] != "parsing":
        return {"ok": True, "state": row["state"]}       # already settled — never re-parse
    from brain import skuparse as _skuparse
    try:
        if row["source_kind"] == "paste":
            text = Path(row["raw_ref"]).read_text(encoding="utf-8")
            parsed = await _skuparse.parse_paste(text, row["source_name"] or "pegado")
        else:
            parsed = await _skuparse.parse_catalogue(row["raw_ref"], row["source_name"] or "")
    except Exception:
        log.exception("intake %s: parse blew up", intake_id)
        parsed = {"ok": False, "skus": [], "count": 0,
                  "error": "No se pudo leer el archivo.", "warnings": []}

    warnings = list(parsed.get("warnings") or [])
    skus = list(parsed.get("skus") or [])
    if not parsed.get("ok") or not skus:
        async with db.get_pool().acquire() as con:
            await con.execute(
                "update catalogue_intake set state='failed', warnings=$2, "
                "parsed='[]'::jsonb where id=$1 and state='parsing'",
                intake_id, warnings + [{"code": "unreadable", "detail":
                                        parsed.get("error") or
                                        "No he encontrado ningún artículo aquí."}])
        return {"ok": False, "reason": "unreadable", "error": parsed.get("error") or ""}

    # THE LEGITIMACY GATE — the SAME soft Haiku check the wizard runs, reused rather than re-written.
    # It fails OPEN by construction, so it can only ever add a warning; it never blocks a commit.
    try:
        from brain import onboarding_ext as _ob_ext
        legit = await asyncio.to_thread(_ob_ext._legit_check_sync, skus, row["source_name"] or "")
        if not legit:
            warnings.append({"code": "not_a_catalogue", "detail":
                             "Esto no me parece un catálogo de productos. Míralo bien antes de "
                             "guardarlo."})
    except Exception:
        log.debug("intake %s: legit check unavailable (soft)", intake_id, exc_info=True)

    warnings.extend(_row_warnings(skus, parsed.get("source_rows")))
    async with db.get_pool().acquire() as con:
        await con.execute(
            "update catalogue_intake set state='ready', parsed=$2, warnings=$3, source_rows=$4, "
            "colmap=$5 where id=$1 and state='parsing'",
            intake_id, [_wire_row(i, s) for i, s in enumerate(skus)], warnings,
            parsed.get("source_rows"), parsed.get("colmap"))
    log.info("intake %s ready — %d rows, %d warnings", intake_id, len(skus), len(warnings))
    return {"ok": True, "state": "ready", "count": len(skus)}


def _wire_row(i: int, s: dict) -> dict:
    """One parsed row on the wire. `n` is a STABLE handle for an edit — the operator's correction has
    to survive a re-read, and a name is not a handle (renaming a row is one of the edits)."""
    return {"n": i, "code": s.get("code") or "", "name": s.get("name") or "",
            "family": s.get("family") or "", "unit": s.get("unit") or "", "price": s.get("price")}


def _row_warnings(skus: list, source_rows) -> list[dict]:
    """The assumptions this parse already makes, said out loud. Every one of them is something the
    code does today, invisibly; silence about an assumption is the failure mode."""
    out: list[dict] = []
    no_price = [s["name"] for s in skus if s.get("price") is None]
    no_unit = [s["name"] for s in skus if not (s.get("unit") or "").strip()]
    no_family = [s["name"] for s in skus if not (s.get("family") or "").strip()]
    # es-ES AGREES IN NUMBER. «1 artículos no dicen en qué se venden» is the kind of small wrongness
    # that makes a screen feel machine-written — and this screen is asking a supplier to trust it
    # with the catalogue every order stands on.
    def _n(n: int, one: str, many: str) -> str:
        return f"{n} {one}" if n == 1 else f"{n} {many}"

    # ⚠️ EVERY ONE OF THESE IS SAID POSITIVELY (2026-08-09, Peter: «NEVER GIVE NEGATIVES»). They used
    # to be built out of absences — «vienen SIN precio», «NO dicen en qué se venden», «porque NO
    # traen familia» — which spends the one line the supplier reads on the thing that is missing and
    # never on what he does next. Same counts, same facts, said as what IS.
    if no_price:
        n = len(no_price)
        # THE WHOLE-CATALOGUE CASE IS ITS OWN SENTENCE. A tarifa that states a price nowhere
        # (Solobuey's real one lists article, weight and format) is a normal catalogue, and «751
        # artículos llevan el precio pendiente» reads like 751 mistakes. It is one fact about the
        # file, so it is one sentence about the file.
        whole = n == len(skus) and n > 1
        out.append({"code": "no_price", "n": n, "sample": no_price[:6], "detail":
                    ("Tu catálogo trae los artículos y el formato, y el precio lo pones tú. "
                     "Escríbelos aquí, o mándame la tarifa y los cruzo."
                     if whole else
                     f"{_n(n, 'artículo lleva', 'artículos llevan')} el precio pendiente. En un "
                     f"pedido {'saldrá' if n == 1 else 'saldrán'} como «a confirmar»; "
                     f"{'puedes escribirlo' if n == 1 else 'puedes escribirlos'} aquí.")})
    if no_unit:
        n = len(no_unit)
        out.append({"code": "no_unit", "n": n, "sample": no_unit[:6], "detail":
                    (f"{_n(n, 'artículo se queda', 'artículos se quedan')} en kilos, que es lo que "
                     f"tomo cuando la lista deja la unidad abierta. "
                     f"Si {'va' if n == 1 else 'alguno va'} por unidad, cámbialo aquí.")})
    if no_family:
        n = len(no_family)
        out.append({"code": "no_family", "n": n, "sample": no_family[:6], "detail":
                    (f"{_n(n, 'artículo entra', 'artículos entran')} en «otros», que es donde van "
                     f"los que llegan con la familia abierta.")})
    # MERGED DUPLICATES — `golive._normalize_skus` is last-row-wins, and a messy sheet repeats lines.
    # Say WHICH ones were merged, not just how many: «6 duplicados» is not something anyone can act on.
    try:
        from brain import golive as _golive
        seen: dict[str, int] = {}
        merged: list[str] = []
        idents: dict[str, str] = {}
        for s in skus:
            row = _golive.normalize_skus([s])
            if not row:
                continue
            ident = row[0]["ident"]
            seen[ident] = seen.get(ident, 0) + 1
            if seen[ident] == 2:
                merged.append(idents.get(ident) or s.get("name") or "")
            idents.setdefault(ident, s.get("name") or "")
        if merged:
            n = len(merged)
            out.append({"code": "merged", "n": n, "sample": merged[:6], "detail":
                        (f"{_n(n, 'artículo aparece', 'artículos aparecen')} más de una vez en la "
                         f"lista; me quedo con la última línea de cada uno.")})
    except Exception:
        log.debug("intake: duplicate accounting unavailable (soft)", exc_info=True)
    # THE COUNT GUARD — tabular sources only. `source_rows` is None for PDF and photo, and there the
    # preview shows the number and asks him to LOOK, because there is nothing to compare against.
    if source_rows:
        ratio = len(skus) / float(source_rows)
        if ratio < INTAKE_COUNT_GUARD:
            out.append({"code": "count_guard", "n": len(skus), "of": int(source_rows),
                        "detail": f"El archivo tiene {int(source_rows)} líneas de producto y sólo he "
                                  f"sabido leer {len(skus)}. Falta demasiado: míralo antes de guardar."})
    else:
        out.append({"code": "no_count", "detail":
                    "Esto viene en texto corrido, así que el número de abajo es lo que he leído. "
                    "Compáralo con tu lista."})
    return out


# ── read (parsed ⊕ edits, with the diff computed at READ time) ─────────────────────────────────────

def _apply_edits(parsed: list, edits: dict) -> list:
    """`parsed` ⊕ `edits` → the rows as they stand now. `edits` is keyed by the row handle `n`:
    a field map overrides fields, and `{"drop": true}` removes the row entirely."""
    out = []
    for r in parsed or []:
        e = (edits or {}).get(str(r.get("n"))) or (edits or {}).get(r.get("n")) or {}
        if isinstance(e, dict) and e.get("drop"):
            continue
        merged = dict(r)
        if isinstance(e, dict):
            for k in ("code", "name", "family", "unit", "price"):
                if k in e:
                    merged[k] = e[k]
            merged["edited"] = sorted(k for k in e if k in ("code", "name", "family", "unit", "price"))
        out.append(merged)
    return out


async def get_intake(intake_id: str, tenant: str, *, with_diff: bool = True) -> dict | None:
    """The intake as it stands: rows (parsed ⊕ edits), warnings, and — when it is ready — the DIFF
    against the destination, computed NOW so it can never be stale. None when it is not this
    tenant's (a wrong tenant is indistinguishable from a wrong id, on purpose)."""
    await ensure_intake_schema()
    async with db.get_pool().acquire() as con:
        row = await con.fetchrow(
            "select * from catalogue_intake where id=$1 and tenant_id=$2", intake_id, tenant)
    if row is None:
        return None
    d = dict(row)
    parsed = list(d.get("parsed") or [])
    edits = dict(d.get("edits") or {})
    rows = _apply_edits(parsed, edits)
    out = {"id": d["id"], "state": d["state"], "source_kind": d["source_kind"],
           "source_name": d["source_name"], "source_rows": d["source_rows"],
           "warnings": list(d.get("warnings") or []), "rows": rows, "count": len(rows),
           "parsed_count": len(parsed), "edited": bool(edits),
           # §17.56 — the column-confirmation payload (None for non-tabular / headerless sources);
           # the confirm screen renders it as editable header dropdowns over the sample rows.
           "colmap": d.get("colmap"),
           "created_at": _iso(d.get("created_at")), "expires_at": _iso(d.get("expires_at")),
           "committed_at": _iso(d.get("committed_at")), "result": d.get("result"),
           "destination": d.get("destination")}
    if with_diff and d["state"] in ("ready",) and rows:
        try:
            from brain import golive as _golive
            out["diff"] = await _golive.plan(tenant, [_parse_shape(r) for r in rows])
        except Exception:
            log.exception("intake %s: diff failed", intake_id)
            out["diff"] = {"ok": False, "reason": "diff_failed"}
    return out


def _iso(v) -> str | None:
    try:
        return v.isoformat() if v else None
    except Exception:
        return None


def _parse_shape(r: dict) -> dict:
    """A wire row back into the {code,name,family,unit,price} shape golive/skuparse both speak."""
    return {"code": r.get("code") or "", "name": r.get("name") or "",
            "family": r.get("family") or "", "unit": r.get("unit") or "", "price": r.get("price")}


# ── correct ───────────────────────────────────────────────────────────────────────────────────────

async def patch_intake(intake_id: str, tenant: str, ops: dict) -> dict | None:
    """The correction step — THE feature. `ops` is `{"<n>": {"name": …, "price": …} | {"drop": true}}`
    merged over whatever is already there, and `{"<n>": null}` undoes a correction on that row.

    `parsed` is never touched. That is the whole reason both columns exist: after a human has fixed
    it we can still see, exactly, what the parser got wrong.

    ONE exception to «parsed is never touched», and it is not an edit: `ops={"remap": {"cols": …}}`
    (§17.56) re-DERIVES parsed from the stored raw bytes with an explicit column assignment — the
    human is correcting which columns the parse read, not which cells it read wrong, so the rows
    themselves are re-extracted and the per-row edits (made against the OLD columns) are reset.
    Routed to `remap_intake` below, which owns that argument in full."""
    await ensure_intake_schema()
    if isinstance((ops or {}).get("remap"), dict):
        return await remap_intake(intake_id, tenant, (ops or {})["remap"].get("cols") or {})
    clean: dict = {}
    for k, v in (ops or {}).items():
        key = str(k)
        if not key.lstrip("-").isdigit():
            continue
        if v is None:
            clean[key] = None
            continue
        if not isinstance(v, dict):
            continue
        e: dict = {}
        if v.get("drop"):
            e["drop"] = True
        for f in ("code", "name", "family", "unit"):
            if f in v:
                e[f] = str(v[f] or "").strip()[:200]
        if "price" in v:
            p = v["price"]
            if p in (None, "", "null"):
                e["price"] = None
            else:
                try:
                    e["price"] = float(str(p).replace("€", "").replace(",", ".").strip())
                except (TypeError, ValueError):
                    return {"ok": False, "reason": "bad_price"}
        if e:
            clean[key] = e
    if not clean:
        return {"ok": False, "reason": "no_ops"}
    async with db.get_pool().acquire() as con:
        row = await con.fetchrow(
            "select state, edits from catalogue_intake where id=$1 and tenant_id=$2",
            intake_id, tenant)
        if row is None:
            return None
        if row["state"] != "ready":
            return {"ok": False, "reason": "not_ready", "state": row["state"]}
        edits = dict(row["edits"] or {})
        for k, v in clean.items():
            if v is None:
                edits.pop(k, None)
            else:
                edits[k] = {**(edits.get(k) or {}), **v}
        await con.execute("update catalogue_intake set edits=$2 where id=$1", intake_id, edits)
    return await get_intake(intake_id, tenant)


async def remap_intake(intake_id: str, tenant: str, cols: dict) -> dict | None:
    """§17.56 — the operator overruled the column guess. Re-derive `parsed` DETERMINISTICALLY from
    the stored raw bytes with the explicit assignment (`skuparse.remap_rows`, no second LLM pass),
    REPLACE the rows, reset the edits (they were keyed to rows that no longer exist in that shape),
    and store the corrected colmap so the screen shows what is now in force.

    Refuses in Spanish when the source has no columns (PDF / photo / a typed list — there is
    nothing to remap and shredding prose into cells would fabricate products), when the intake
    never carried a colmap (no header was found, so there is no header row to remap against), or
    when no name column is assigned (a catalogue of nameless rows is not one).

    The bytes are re-read from `raw_ref` (under `_INTAKE_DIR`) through `skuparse.extract_rows`,
    which cleans the matrix EXACTLY as the original parse did — that identity is what makes the
    stored `header_row` index still point at the same row."""
    await ensure_intake_schema()
    async with db.get_pool().acquire() as con:
        row = await con.fetchrow(
            "select state, source_kind, source_name, source_rows, raw_ref, colmap "
            "from catalogue_intake where id=$1 and tenant_id=$2", intake_id, tenant)
    if row is None:
        return None
    if row["state"] != "ready":
        return {"ok": False, "reason": "not_ready", "state": row["state"]}
    old_colmap = row["colmap"] if isinstance(row["colmap"], dict) else None
    if not old_colmap:
        return {"ok": False, "reason": "not_tabular",
                "error": "Esto no trae columnas que recolocar — corrige las líneas una a una."}

    from brain import skuparse as _skuparse
    try:
        data = Path(row["raw_ref"]).read_bytes()
    except Exception:
        log.exception("intake %s: raw bytes unreadable for remap", intake_id)
        return {"ok": False, "reason": "source_gone",
                "error": "Ya no tengo el archivo original — súbelo otra vez."}
    rows = _skuparse.extract_rows(data, row["source_name"] or "")
    if not rows:
        return {"ok": False, "reason": "not_tabular",
                "error": "Esto no trae columnas que recolocar — corrige las líneas una a una."}

    clean_cols: dict = {}
    for f in _skuparse._COLMAP_FIELDS:
        v = (cols or {}).get(f)
        try:
            clean_cols[f] = int(v) if v is not None else None
        except (TypeError, ValueError):
            clean_cols[f] = None
    if clean_cols.get("name") is None:
        return {"ok": False, "reason": "no_name_col",
                "error": "Dime qué columna es el nombre del artículo — sin eso no hay lista."}

    header_row = int(old_colmap.get("header_row") or 0)
    skus = _skuparse.remap_rows(rows, header_row, clean_cols)
    if not skus:
        return {"ok": False, "reason": "no_skus",
                "error": "Con esas columnas no sale ningún artículo. Revisa la asignación."}

    # the same accounting the first parse ran, over the re-derived rows — the warnings must
    # describe THESE rows, not the ones the guess produced.
    warnings = _row_warnings(skus, row["source_rows"])
    new_colmap = {**old_colmap, "cols": clean_cols, "remapped": True}
    async with db.get_pool().acquire() as con:
        await con.execute(
            "update catalogue_intake set parsed=$2, edits='{}'::jsonb, warnings=$3, colmap=$4 "
            "where id=$1 and state='ready'",
            intake_id, [_wire_row(i, s) for i, s in enumerate(skus)], warnings, new_colmap)
    log.info("intake %s remapped for %s: %d rows (cols=%s)", intake_id, tenant, len(skus), clean_cols)
    return await get_intake(intake_id, tenant)


# ── commit / discard ──────────────────────────────────────────────────────────────────────────────

async def commit_intake(intake_id: str, tenant: str, *, carry_over: list | None = None,
                        override_guard: bool = False) -> dict | None:
    """Install the corrected rows through `golive.seed_catalogue` — the ONE writer.

    IDEMPOTENT ON THE INTAKE ID: a second commit returns the FIRST commit's stored result rather
    than seeding again. A phone that lost signal between the write and the response is the normal
    case, not the exotic one, and the retry must not be a second upload.

    `carry_over` carries the renames the operator accepted on the preview: `[{"from","to"}]`.
    `override_guard` is the explicit «sí, guárdalo igual» when the count guard fired — it is a
    separate argument precisely so it cannot be given by accident."""
    await ensure_intake_schema()
    async with db.get_pool().acquire() as con:
        row = await con.fetchrow(
            "select * from catalogue_intake where id=$1 and tenant_id=$2", intake_id, tenant)
    if row is None:
        return None
    if row["state"] == "committed":
        return {"ok": True, "already": True, "result": dict(row["result"] or {}),
                "committed_at": _iso(row["committed_at"])}
    if row["state"] != "ready":
        return {"ok": False, "reason": "not_ready", "state": row["state"]}

    rows = _apply_edits(list(row["parsed"] or []), dict(row["edits"] or {}))
    if not rows:
        return {"ok": False, "reason": "no_skus"}
    guard = next((w for w in (row["warnings"] or []) if w.get("code") == "count_guard"), None)
    if guard and not override_guard:
        return {"ok": False, "reason": "count_guard", "warning": guard}

    from brain import golive as _golive
    res = await _golive.seed_catalogue(tenant, [_parse_shape(r) for r in rows],
                                       carry_over=carry_over or [])
    if not res.get("ok"):
        return {"ok": False, "reason": res.get("reason") or "seed_failed"}
    async with db.get_pool().acquire() as con:
        await con.execute(
            "update catalogue_intake set state='committed', committed_at=now(), "
            "destination='catalogue', result=$2 where id=$1 and state='ready'",
            intake_id, res)
    log.info("intake %s committed for %s: %s", intake_id, tenant, res)
    return {"ok": True, "already": False, "result": res}


async def discard_intake(intake_id: str, tenant: str) -> dict | None:
    """State → discarded and the bytes go. The row survives (it is the record that an operator
    looked at a list and said no), the source does not."""
    await ensure_intake_schema()
    async with db.get_pool().acquire() as con:
        row = await con.fetchrow(
            "select raw_ref, state from catalogue_intake where id=$1 and tenant_id=$2",
            intake_id, tenant)
        if row is None:
            return None
        if row["state"] == "committed":
            return {"ok": False, "reason": "already_committed"}
        await con.execute(
            "update catalogue_intake set state='discarded', parsed='[]'::jsonb, raw_ref=null "
            "where id=$1", intake_id)
    try:
        ref = row["raw_ref"]
        if ref:
            p = Path(ref)
            p.unlink(missing_ok=True)
            if p.parent.name.startswith("ing_"):
                p.parent.rmdir()
    except Exception:
        log.debug("intake %s: source cleanup fail-soft", intake_id, exc_info=True)
    return {"ok": True, "state": "discarded"}


async def list_intakes(tenant: str, limit: int = 20) -> list[dict]:
    """The tenant's recent intakes, newest first — «what did I upload, and what happened to it»."""
    await ensure_intake_schema()
    async with db.get_pool().acquire() as con:
        rows = await con.fetch(
            "select id, state, source_kind, source_name, source_rows, "
            "jsonb_array_length(parsed) as n, created_at, committed_at "
            "from catalogue_intake where tenant_id=$1 order by created_at desc limit $2",
            tenant, max(1, min(int(limit or 20), 100)))
    return [{"id": r["id"], "state": r["state"], "source_kind": r["source_kind"],
             "source_name": r["source_name"], "source_rows": r["source_rows"],
             "count": int(r["n"] or 0), "created_at": _iso(r["created_at"]),
             "committed_at": _iso(r["committed_at"])} for r in rows]


# ══════════════════════════════════════════════════════════════════════════════════════════════════
#  §5.10.5 · THE EMAILED UPLOAD LINK — the same ingestion, with no app and no login
#  (Peter, 2026-07-27: *"if I ask to send me an ingestion link to my email, it has to, just like the
#   onboarding ingestion… it's basically that, so we can upload as many SKUs as we want to. Only
#   difference is that with me, it changes the whole seeded state."*)
#
#  WHY A LINK AT ALL, when both apps already ingest. Because the catalogue is never on the device the
#  app is on. It is a 4 MB Excel a prospect mailed him an hour before the meeting, on the laptop, or
#  a PDF on a phone that is not signed in. «Forward it to yourself, open the app, find the file» is
#  four moves through two devices; a link in his inbox is one. The link is therefore a DOOR, not a
#  second feature: it lands on `create_intake` / `get_intake` / `patch_intake` / `commit_intake` —
#  the very functions above — and knows nothing about parsing, diffing or committing that they do not.
#
#  WHY IT IS FOUNDER-ONLY AND SHORT-LIVED. What comes through it can become the seeded world (§5.10.3
#  `create_profile_from_intake`), and activating a world DESTROYS the one currently in the tables. So:
#    · MINTABLE ONLY BY A VERIFIED FOUNDER (`intake_api` demands `brain/auth.is_founder`; there is no
#      key-gated door, because the machine key ships inside every APK).
#    · A FIXED EXPIRY, NOT A SLIDING ONE. `portal.py` slides deliberately — a restaurant bookmarks
#      its order page and must keep it forever. This link is a one-errand link for one meeting, so
#      copying the sliding rule would have been cargo-culting the idiom rather than reading it: a
#      link that renews itself every time it is opened never dies, and this one must.
#    · ONE ACTIVE LINK AT A TIME (a partial unique index enforces it). That is what makes «mándame el
#      enlace» idempotent — asking twice hands back the SAME url, so an older mail in the thread
#      still works — and what makes revocation mean something: there is exactly one thing to revoke.
#    · REVOCATION IS A STATUS, NEVER A DELETE, and `resolve_intake_link` answers None identically for
#      unknown / revoked / expired, so a probe cannot learn that a link ever existed.
#
#  WHAT THE LINK CANNOT DO, by construction: it cannot mint another link, it cannot read or touch an
#  intake that did not come through IT (`link_owns_intake`), and it names no tenant on the wire — the
#  tenant is read off the row, like the portal's.
# ══════════════════════════════════════════════════════════════════════════════════════════════════


INTAKE_LINK_TTL_DAYS = int(os.getenv("ROCOTO_INTAKE_LINK_TTL_DAYS", "7"))

_link_schema_ready = False


async def ensure_intake_link_schema(con=None) -> None:
    """Verify migration ownership; application requests never alter schema."""
    from schema_migrations import assert_current

    if con is not None:
        await assert_current(con)
        return
    async with db.get_pool().acquire() as connection:
        await assert_current(connection)


def intake_link_url(token: str) -> str:
    return f"{PUBLIC_BASE_URL}/subir/{token}"


async def mint_intake_link(tenant: str, minted_by: str, *, label: str = "",
                           sent_to: str = "", ttl_days: int | None = None) -> dict:
    """Issue a FRESH link, revoking the founder's active one in the same commit.

    `minted_by` is the founder's verified email and is the row's identity — it is never read off the
    wire by any route, so a second person's link is not expressible, merely refused."""
    await ensure_intake_link_schema()
    minted_by = (minted_by or "").strip().lower()
    if not minted_by:
        return {"ok": False, "reason": "no_minter"}
    token = secrets.token_urlsafe(32)
    days = int(ttl_days or INTAKE_LINK_TTL_DAYS)
    async with db.get_pool().acquire() as con, con.transaction():
        await con.execute(
            "update intake_links set status='revoked' "
            "where tenant_id=$1 and minted_by=$2 and status='active'", tenant, minted_by)
        row = await con.fetchrow(
            "insert into intake_links (token, tenant_id, minted_by, label, sent_to, expires_at) "
            "values ($1,$2,$3,$4,$5, now() + ($6 || ' days')::interval) returning *",
            token, tenant, minted_by, (label or "")[:120], (sent_to or "")[:200], str(days))
    log.info("intake link minted for %s (tenant=%s, %s days)", minted_by, tenant, days)
    return {"ok": True, "token": token, "url": intake_link_url(token), "minted": True,
            "label": row["label"], "expires_at": _iso(row["expires_at"])}


async def intake_link_for(tenant: str, minted_by: str, *, label: str = "") -> dict:
    """THE STABLE LINK — the live one if there is one, a fresh one otherwise.

    Idempotent on purpose: «mándame el enlace» twice in a morning must not invalidate the mail he
    already has open, or he learns the link cannot be trusted."""
    await ensure_intake_link_schema()
    minted_by = (minted_by or "").strip().lower()
    if not minted_by:
        return {"ok": False, "reason": "no_minter"}
    async with db.get_pool().acquire() as con:
        row = await con.fetchrow(
            "select * from intake_links where tenant_id=$1 and minted_by=$2 "
            "and status='active' and expires_at > now()", tenant, minted_by)
    if row:
        return {"ok": True, "token": row["token"], "url": intake_link_url(row["token"]),
                "minted": False, "label": row["label"], "expires_at": _iso(row["expires_at"])}
    return await mint_intake_link(tenant, minted_by, label=label)


async def revoke_intake_link(tenant: str, minted_by: str) -> int:
    """Turn the founder's link off. Returns how many rows were revoked (0 or 1)."""
    await ensure_intake_link_schema()
    async with db.get_pool().acquire() as con:
        n = await con.execute(
            "update intake_links set status='revoked' "
            "where tenant_id=$1 and minted_by=$2 and status='active'",
            tenant, (minted_by or "").strip().lower())
    try:
        return int(str(n).rsplit(" ", 1)[-1])
    except ValueError:
        return 0


async def resolve_intake_link(token: str, *, touch: bool = True) -> dict | None:
    """token → {tenant_id, minted_by, label, expires_at, intakes} or None.

    NON-LEAKING BY CONSTRUCTION: unknown, revoked and expired all answer None and every caller
    returns the SAME 404, so a probe cannot tell «no such link» from «that one is dead». `touch`
    counts the use — it deliberately does NOT extend the expiry (see the block comment)."""
    token = (token or "").strip()
    if not re.fullmatch(r"[A-Za-z0-9_-]{16,128}", token or ""):
        return None
    await ensure_intake_link_schema()
    async with db.get_pool().acquire() as con:
        row = await con.fetchrow(
            "select * from intake_links where token=$1 and status='active' and expires_at > now()",
            token)
        if row is None:
            return None
        if touch:
            await con.execute(
                "update intake_links set last_used_at=now(), uses=uses+1 where token=$1", token)
    return {"tenant_id": row["tenant_id"], "minted_by": row["minted_by"],
            "label": row["label"] or "", "expires_at": _iso(row["expires_at"]),
            "intakes": list(row["intakes"] or []), "uses": int(row["uses"] or 0)}


async def note_intake_on_link(token: str, intake_id: str) -> None:
    """Record that THIS intake came through THIS link. It is the whole of the link's authority: the
    token may read and correct what it uploaded and nothing else in the tenant.

    ⚠️ `to_jsonb($2::text)`, NOT a `json.dumps([...])` parameter. The pool installs a jsonb codec, so
    handing it an already-serialised string gets it serialised AGAIN: the array grew by the JSON
    STRING `"[\"ing_x\"]"` instead of by the element `"ing_x"`, `link_owns_intake` then answered
    False for the very intake the link had just created, and every read of it 404'd. Caught by
    `tests/vital_intake_link.py` on the first run, which is exactly the check that must keep existing:
    a fence that silently fences everything looks identical to a fence that works."""
    await ensure_intake_link_schema()
    async with db.get_pool().acquire() as con:
        await con.execute(
            "update intake_links set intakes = intakes || to_jsonb($2::text) "
            "where token=$1 and status='active' and not (intakes @> to_jsonb($2::text))",
            token, intake_id)


def link_owns_intake(link: dict, intake_id: str) -> bool:
    """A link's reach, asked as a question rather than assumed. The tenant is NOT enough — that would
    hand a mailed link every catalogue the tenant ever uploaded from the app."""
    return bool(intake_id) and intake_id in list((link or {}).get("intakes") or [])


async def send_intake_link(to: str, url: str, *, label: str = "", expires_at: str = "") -> dict:
    """Mail the link, on the SAME Rocoto-branded rail as every other onboarding mail (`_shell` +
    `_send`) — one look, one sender, one place the sandbox short-circuits."""
    to = (to or "").strip()
    if not to:
        return {"ok": False, "error": "no recipient"}
    dias = ""
    if expires_at:
        dias = (f'<p style="margin:0 0 16px">El enlace caduca el '
                f'{_es_date(expires_at)}. Si lo necesitas más tarde, pídeme otro.</p>')
    quien = (f' para <strong>{label}</strong>' if label else "")
    body = (
        f'<p style="margin:0 0 16px">Aquí tienes el enlace para subir un catálogo{quien}.</p>'
        '<p style="margin:0 0 16px">Ábrelo donde tengas la lista — en el móvil o en el ordenador, '
        'da igual. Puedes subir el Excel, el CSV, el PDF, una foto de la tarifa, o pegar la lista '
        'tal cual. Te enseño qué he entendido antes de guardar nada.</p>'
        f'{dias}'
        '<p style="margin:0">Rocoto</p>'
    )
    return await _send(to, "Tu enlace para subir un catálogo",
                       _shell("Sube el catálogo desde aquí", body, "Subir el catálogo", url))


_ES_MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
              "septiembre", "octubre", "noviembre", "diciembre"]


def _es_date(iso: str) -> str:
    """«3 de agosto» — a date a Spaniard reads, not an ISO string in a customer-facing mail."""
    try:
        d = datetime.fromisoformat(str(iso).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return ""
    return f"{d.day} de {_ES_MONTHS[d.month - 1]}"
