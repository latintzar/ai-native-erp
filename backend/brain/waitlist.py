"""Rocoto referral-only waitlist.

Port of Vitrina's waitlist mechanics (api/routes/waitlist.py) stripped to REFERRALS ONLY — no
call/quiz/IG scoring. Position = row_number() over (invited_count desc, created_at asc), recomputed
on read. The invited_count bump is ATOMIC (a single UPDATE), fixing Vitrina's read-modify-write race.

Additive, isolated: reads/writes only the `waitlist` table (ONBOARD_SCHEMA). Writes come from our own
authenticated backend / the token-gated wizard, so there is no Supabase RPC/RLS here.
"""
from __future__ import annotations

import logging
import re
import secrets
import uuid

import config
import db

log = logging.getLogger("rocoto.waitlist")

# Slug: keep lowercase alphanumerics only. Union with the collision suffix / token fallback stays
# within `[a-z0-9-]`. Mirrors Vitrina's _REF_SLUG_RE.
_REF_SLUG_RE = re.compile(r"[^a-z0-9]+")
# Inbound referral code format (also the shape referral_code is minted in). Cap at 64.
_REF_INBOUND_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


def _slugify(name: str) -> str:
    base = (name or "").strip().lower()
    base = _REF_SLUG_RE.sub("", base)
    return base or "friend"


def _sanitize_referred_by(raw: str | None) -> str | None:
    """Trim + format-check a `referred_by` code coming from the frontend/query-string. Returns the
    cleaned code (lowercased) or None if invalid/empty. Defends against junk, oversized payloads,
    and copy-paste whitespace."""
    if not raw:
        return None
    candidate = str(raw).strip()
    if not candidate or not _REF_INBOUND_RE.match(candidate):
        return None
    return candidate.lower()


async def _generate_referral_code(first_name: str) -> str:
    """First-name-based with a numeric collision suffix, probed against waitlist.referral_code.

    'Pablo' → 'pablo'. If taken, 'pablo1', 'pablo2', … We stop at 50 and fall back to
    'pablo-<token_urlsafe(4)>' if we somehow have 50 Pablos (we won't, but never crash).
    """
    base = _slugify(first_name)
    candidate = base
    pool = db.get_pool()
    async with pool.acquire() as con:
        for n in range(0, 50):
            if n > 0:
                candidate = f"{base}{n}"
            try:
                taken = await con.fetchval(
                    "select 1 from waitlist where referral_code = $1 limit 1", candidate
                )
                if not taken:
                    return candidate
            except Exception:  # pragma: no cover
                log.exception("referral_code lookup failed for %s", candidate)
                break
    return f"{base}-{secrets.token_urlsafe(4).lower()}"


async def join(
    lead_id: str | None,
    phone: str | None,
    email: str | None,
    first_name: str | None,
    referred_by: str | None = None,
    is_test: bool = False,
) -> dict:
    """Join the waitlist. Idempotent on phone: if a row already exists for this phone, return it
    (never a second referral code). Otherwise insert a fresh code and, if `referred_by` is a valid
    OTHER code, ATOMICALLY bump that referrer's invited_count. Returns
    {referral_code, position, total, invited_count}.

    `is_test` isolates test signups: idempotency + the referrer bump are scoped to the SAME mode, so a
    test join never returns/mutates a live row, and `position()` (below) ranks each mode independently —
    a test signup can never shift a real customer's #N or inflate the displayed total."""
    phone = (phone or "").strip()
    email = (email or "").strip()
    first_name = (first_name or "").strip()
    referred_by = _sanitize_referred_by(referred_by)
    is_test = bool(is_test)

    pool = db.get_pool()
    async with pool.acquire() as con:
        # Idempotent on phone (scoped to mode — a test join never resolves to a live row or vice-versa).
        existing = None
        if phone:
            existing = await con.fetchval(
                "select referral_code from waitlist where phone = $1 and is_test = $2 limit 1",
                phone, is_test,
            )
        if existing:
            pos = await position(existing)
            return pos or {"referral_code": existing, "position": None, "total": None, "invited_count": 0}

        code = await _generate_referral_code(first_name)
        # Block self-referral (can't refer your own not-yet-existing code, but guard anyway).
        if referred_by and referred_by == code:
            referred_by = None

        wl_id = f"wl_{uuid.uuid4().hex[:16]}"
        await con.execute(
            "insert into waitlist (id, lead_id, phone, email, first_name, referral_code, referred_by, is_test) "
            "values ($1,$2,$3,$4,$5,$6,$7,$8) on conflict (id) do nothing",
            wl_id, lead_id, phone, email, first_name, code, referred_by, is_test,
        )

        # ATOMIC bump of the referrer (never read-modify-write). Only bumps a real, different code IN THE
        # SAME MODE — a test referral can never bump a live referrer's count (and vice-versa).
        if referred_by:
            try:
                await con.execute(
                    "update waitlist set invited_count = invited_count + 1, updated_at = now() "
                    "where referral_code = $1 and is_test = $2",
                    referred_by, is_test,
                )
            except Exception:  # pragma: no cover — a bad referrer must never fail the join
                log.exception("referral bump failed for %s", referred_by)

    pos = await position(code)
    return pos or {"referral_code": code, "position": None, "total": None, "invited_count": 0}


async def position(code: str | None) -> dict | None:
    """One round-trip position lookup. Returns {referral_code, position, total, invited_count} or
    None if the code isn't on the list.

    Auto-scoped by mode: a code ranks only WITHIN its own live/test cohort (the `target` CTE reads the
    code's own is_test and the ranking filters to it), so a test signup never shifts a real customer's
    #N and the displayed total never counts test rows. No caller change needed — the row carries its mode."""
    code = (code or "").strip()
    if not code:
        return None
    pool = db.get_pool()
    async with pool.acquire() as con:
        row = await con.fetchrow(
            "with target as (select is_test from waitlist where referral_code = $1),"
            "ranked as ("
            "  select id, referral_code, invited_count,"
            "         row_number() over (order by invited_count desc, created_at asc) as position,"
            "         count(*) over () as total"
            "  from waitlist"
            "  where is_test = (select is_test from target)"
            ") select referral_code, position, total, invited_count from ranked where referral_code = $1",
            code,
        )
    if not row:
        return None
    rc = row["referral_code"]
    return {
        "referral_code": rc,
        "position": int(row["position"]),
        "total": int(row["total"]),
        "invited_count": int(row["invited_count"] or 0),
        # The shareable referral link — points at the PUBLIC site (soyrocoto.com), not the sslip.io
        # backend, and uses ?r= to match the rest of onboarding. The landing captures ?r/?ref at signup
        # (SignupModal.readRef) → it becomes the new lead's referred_by. Without this the wizard fell
        # back to the bare origin with no code.
        "share_url": f"{getattr(config, 'ONBOARD_PUBLIC_BASE_URL', 'https://soyrocoto.com').rstrip('/')}/?r={rc}",
    }
