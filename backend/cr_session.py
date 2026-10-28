"""cr_session.py — Control Room real auth + server-side sessions (WP-9 cr-auth).

The security floor under the CR control surfaces, hardened against a 7-lens adversarial threat model.

A signed-in owner/admin (Supabase Google OAuth, verified by brain.auth — OAuth-only elevation bound to
the ELEVATING email) is exchanged for a SERVER-SIDE session. The cookie carries `session_id.secret`:
  • session_id — a STABLE opaque primary key that NEVER changes (so rotation can't race the PK),
  • secret     — a rotating credential; only its sha256 is stored (a leaked backup can't be replayed).
Rotation swaps the secret_hash atomically (winner re-sets the cookie; a short prev-secret grace covers
concurrent requests). Absolute 12h expiry + idle cap + CSRF double-submit (csrf STABLE across rotation)
+ per-actor/per-ip + absolute-global rate-limits + an append-only cr_audit trail for every mutating/
financial/data action.

This REPLACES the localStorage machine-key gate for the human CR. The shared ROCOTO_API_KEY stays valid
ONLY for the Android app's own runtime endpoints — NEVER for refunds / data-erase.

Both tables are OWNER-POOL globals (like `alert`): no ltree scope, no FORCE-RLS — accessed ONLY via
db.get_pool() (never control_pool / scoped_tx). The optional scoped audit MIRROR is an `override.<action>`
event written via db.scoped_tx (rocoto_rt) so the tier-P ctrl write-fence never rejects it.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import secrets
import time
from collections import deque

import db
import spine
from brain import auth as brain_auth

log = logging.getLogger("rocoto.cr_session")

# ── policy knobs ──────────────────────────────────────────────────────────────────────────────────
SESSION_TTL_S = 12 * 3600          # absolute lifetime — re-auth after 12h regardless of activity
ROTATE_AFTER_S = 30 * 60           # slide-rotate the secret after 30m of activity (navigational /me only)
ROTATE_GRACE_S = 30                # the just-rotated-out secret still resolves this long (kills the race)
IDLE_MAX_S = 4 * 3600             # a session untouched this long is dead even before absolute expiry

# least-privilege capabilities. read=view · act=refund/override/account-edit · admin=data-erase.
ROLE_CAPS = {
    "owner": frozenset({"read", "act", "admin"}),
    "admin": frozenset({"read", "act"}),
}

def can(role: str, cap: str) -> bool:
    return cap in ROLE_CAPS.get(role or "", frozenset())


def _hash(secret: str) -> str:
    """sha256 hex of a secret (the rotating cookie half). Only hashes are stored."""
    return hashlib.sha256((secret or "").encode()).hexdigest()


def _split(raw: str) -> tuple[str, str]:
    """Cookie value `session_id.secret` → (session_id, secret). Bad shapes → ('','')."""
    if not raw or "." not in raw:
        return ("", "")
    sid, _, secret = raw.partition(".")
    return (sid, secret) if sid and secret else ("", "")


# ── minting / login ────────────────────────────────────────────────────────────────────────────────
async def mint(actor_email: str, role: str, ip: str, ua: str) -> dict:
    session_id = secrets.token_urlsafe(24)
    secret = secrets.token_urlsafe(32)
    csrf = secrets.token_urlsafe(32)
    pool = db.get_pool()
    async with pool.acquire() as con:
        await con.execute(
            "insert into cr_session(session_id, secret_hash, actor_email, role, ip, ua, csrf_token, "
            "  created_at, expires_at, last_seen_at) "
            "values($1,$2,$3,$4,$5,$6,$7, now(), now() + ($8||' seconds')::interval, now())",
            session_id, _hash(secret), actor_email, role, (ip or "")[:80], (ua or "")[:400], csrf,
            str(SESSION_TTL_S))
    return {"raw": f"{session_id}.{secret}", "csrf": csrf, "role": role, "email": actor_email,
            "ttl": SESSION_TTL_S, "session_id": session_id}


async def session_for_user(user: dict, ip: str, ua: str) -> dict:
    """Resolve a VERIFIED Supabase user → a CR session, iff they are an owner/admin whose OAuth identity
    EMAIL matches the allowlisted email (has_matching_oauth — not merely 'some OAuth identity exists',
    which a linkIdentity attack could forge). The caller must have already verified the bearer against
    the Auth API. Returns {ok, raw, csrf, role, email} or {ok:False, error}."""
    email = (user.get("email") or "").strip().lower()
    if not email:
        return {"ok": False, "error": "no_email"}
    verified = brain_auth.has_matching_oauth(user)          # STRICT: matching-email OAuth identity
    role, _is_master = brain_auth.resolve_role(email, verified)
    if role not in ("owner", "admin"):
        return {"ok": False, "error": "forbidden", "role": role}
    m = await mint(email, role, ip, ua)
    return {"ok": True, **m}


# ── verification + sliding rotation (stable PK, rotating secret) ─────────────────────────────────────
async def verify(raw: str, *, rotate: bool = False) -> dict | None:
    """Resolve a raw cookie (`session_id.secret`) → actor ctx, or None (fail-closed on
    empty/expired/idle/revoked/wrong-secret). ctx = {session_id, actor_email, role, csrf, fresh_raw,
    remaining}. Rotation happens ONLY when `rotate` (the navigational /me check) AND the session is past
    the rotation window AND we matched the CURRENT secret (not the grace one): one atomic UPDATE swaps in
    a new secret; the winner gets ctx['fresh_raw'] (+ remaining absolute lifetime for the cookie Max-Age).
    Concurrent requests still resolve via the prev-secret grace, so a rotation race never drops a session.
    """
    sid, secret = _split(raw)
    if not sid or not secret:
        return None
    sh = _hash(secret)
    pool = db.get_pool()
    async with pool.acquire() as con:
        row = await con.fetchrow(
            "select session_id, secret_hash, prev_secret_hash, actor_email, role, csrf_token, "
            "  (prev_secret_until is not null and prev_secret_until > now()) as grace_live, "
            "  extract(epoch from (now() - last_seen_at)) as idle_s, "
            "  extract(epoch from (expires_at - now())) as remaining_s "
            "from cr_session "
            "where session_id = $1 and revoked_at is null and expires_at > now()", sid)
        if not row:
            return None
        if row["idle_s"] is not None and float(row["idle_s"]) > IDLE_MAX_S:
            return None
        cur_ok = hmac.compare_digest(row["secret_hash"] or "", sh)
        prev_ok = bool(row["grace_live"]) and hmac.compare_digest(row["prev_secret_hash"] or "", sh)
        if not (cur_ok or prev_ok):
            return None                                     # right session_id, wrong/rotated-out secret
        ctx = {"session_id": sid, "actor_email": row["actor_email"], "role": row["role"],
               "csrf": row["csrf_token"], "fresh_raw": None, "remaining": int(row["remaining_s"] or 0)}
        if rotate and cur_ok and row["idle_s"] is not None and float(row["idle_s"]) > ROTATE_AFTER_S:
            new_secret = secrets.token_urlsafe(32)
            won = await con.fetchval(
                "update cr_session set prev_secret_hash = secret_hash, "
                "  prev_secret_until = now() + ($3||' seconds')::interval, secret_hash = $2, "
                "  rotated_at = now(), last_seen_at = now() "
                "where session_id = $1 and secret_hash = $4 "
                "  and last_seen_at < now() - ($5||' seconds')::interval "
                "returning extract(epoch from (expires_at - now()))",
                sid, _hash(new_secret), str(ROTATE_GRACE_S), row["secret_hash"], str(ROTATE_AFTER_S))
            if won is not None:
                ctx["fresh_raw"] = f"{sid}.{new_secret}"; ctx["remaining"] = int(won or 0)
                return ctx
        # activity touch (keeps the idle clock honest even without rotation)
        await con.execute("update cr_session set last_seen_at = now() where session_id = $1", sid)
        return ctx


def check_csrf(ctx: dict | None, token: str | None) -> bool:
    """Constant-time compare of the request's X-CSRF-Token against the session csrf_token (stable across
    rotation)."""
    if not ctx or not ctx.get("csrf"):
        return False
    return hmac.compare_digest(str(ctx["csrf"]), str(token or ""))


async def revoke(raw: str) -> None:
    sid, _secret = _split(raw)
    if not sid:
        return
    pool = db.get_pool()
    async with pool.acquire() as con:
        await con.execute("update cr_session set revoked_at = now() where session_id = $1", sid)


async def revoke_all(actor_email: str) -> str:
    """Kill every live session for an actor (e.g. after a data-erase / lost device)."""
    pool = db.get_pool()
    async with pool.acquire() as con:
        return await con.execute("update cr_session set revoked_at = now() "
                                 "where actor_email = $1 and revoked_at is null", (actor_email or "").lower())


# ── rate limiting (in-memory sliding window; single-worker → process-local is correct) ──────────────
_RL: dict[str, deque] = {}

def rate_ok(bucket: str, limit: int, window_s: int) -> bool:
    """True iff this hit is within `limit` per `window_s` for `bucket`. Prefer an UNSPOOFABLE bucket
    (session actor_email) over client IP; pair a per-IP limit with an absolute-global ceiling so a
    spoofed-IP flood still hits a wall (X-Forwarded-For is spoofable behind the proxy)."""
    now = time.time()
    dq = _RL.get(bucket)
    if dq is None:
        dq = deque(); _RL[bucket] = dq
    cutoff = now - window_s
    while dq and dq[0] < cutoff:
        dq.popleft()
    if len(dq) >= limit:
        return False
    dq.append(now)
    return True


# ── audit spine ─────────────────────────────────────────────────────────────────────────────────────
async def audit(actor_email: str, ip: str, action: str, *, target_scope: str | None = None,
                target_id: str | None = None, detail: dict | None = None, result: str = "ok",
                scoped_event: bool = False) -> None:
    """Append-only audit of a CR actor action. cr_audit is the source of truth (append-only enforced by
    a DB trigger). detail must be NON-PII (scope ids / counts / amounts — never an erased email/phone).
    When scoped_event and a target_scope is given, ALSO mirror an `override.<action>` event onto that
    tenant's timeline via scoped_tx (rocoto_rt) — inside the override.* namespace so the tier-P ctrl
    write-fence never rejects it. Fail-soft on the mirror; the cr_audit write must always land."""
    pool = db.get_pool()
    try:
        async with pool.acquire() as con:
            await con.execute(
                "insert into cr_audit(ts, actor_email, ip, action, target_scope, target_id, detail, result) "
                "values(now(), $1,$2,$3,$4,$5,$6::jsonb,$7)",
                (actor_email or "").lower(), (ip or "")[:160], action, target_scope, target_id,
                json.dumps(detail or {}), result)
    except Exception:
        log.exception("cr_audit write failed action=%s target=%s", action, target_id)
        raise  # a lost audit on a financial/data action is not acceptable — surface it
    if scoped_event and target_scope:
        try:
            async with db.scoped_tx(target_scope) as con:
                await spine.append_event(con, target_scope, f"override.{action}", "control_room",
                                         {"actor": (actor_email or "").lower(), "detail": detail or {},
                                          "result": result, "text": f"{action} por {actor_email}"},
                                         lane="world")
        except Exception:
            log.exception("scoped audit mirror failed action=%s scope=%s", action, target_scope)
