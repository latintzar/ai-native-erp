"""sup_session.py — supplier web-app auth + server-side sessions (Wave-3 sup-auth, ONE kernel organ).

The SECOND session world (wave3 design §4: two session worlds, one IdP). Mirrors cr_session.py's
hardened mechanics VERBATIM — stable session_id PK + rotating secret (only sha256 stored) + prev-secret
grace + CSRF double-submit + idle/absolute expiry + rate limits + an append-only audit — but the claims
are TENANT-SCOPED:

  Supabase Google sign-in (verified server-side via brain.auth.verify_token) → the ELEVATION gate is
  brain_auth.has_matching_oauth (a password signup NEVER elevates into a tenant; the linkIdentity
  forgery is blocked) → membership resolves from operators.email → team_members → tenants: the session
  is minted FOR exactly one tenant_slug, and every /api/sup/* route filters by it server-side. The
  client never sends a tenant id — the session IS the tenant scope (RLS-consistent: the same absolute
  wall schema_rls.sql enforces on the scope-keyed tables).

ISOLATION FROM THE CR WORLD: own table (sup_session), own cookie (sup_session), own CSRF header
(X-Sup-CSRF), own caps — zero shared secret material. A supplier cookie can never resolve on a CR
route (different table) and vice versa. The machine key (ROCOTO_API_KEY) is NEVER valid on /api/sup/*.

Both tables are OWNER-POOL globals (like cr_session/alert): no ltree scope, no FORCE-RLS — accessed
ONLY via db.get_pool().
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import secrets
import time
from collections import deque

import config
import db
from brain import auth as brain_auth

log = logging.getLogger("rocoto.sup_session")

# ── policy knobs (same floor as the CR; a market-morning session must survive the shift) ──────────
SESSION_TTL_S = 12 * 3600          # absolute lifetime — re-auth after 12h regardless of activity
ROTATE_AFTER_S = 30 * 60           # slide-rotate the secret after 30m of activity (navigational /me only)
ROTATE_GRACE_S = 30                # the just-rotated-out secret still resolves this long (kills the race)
IDLE_MAX_S = 4 * 3600              # a session untouched this long is dead even before absolute expiry

# least-privilege capabilities (contract.ts §caps):
#   read    = view everything in the tenant scope
#   act     = approve/edit/print orders, send-as-Rocoto, route ops
#   admin   = Ajustes: billing, team, dispatch config, e-commerce toggle
#   deliver = §5.11 · the stop-level verbs a van driver needs, and NOTHING else
#
# WHY `deliver` IS A CAP AND NOT A ROLE CHECK (SPEC §5.11.3). `read` is one bit covering every
# customer, conversation, order and price in the tenant; `act` covers approving orders and sending
# WhatsApp AS Rocoto. A driver needs neither. Because `repartidor` holds ONLY `deliver`, every one of
# the ~45 existing routes — all of which ask for read/act/admin — refuses him without a single
# handler being touched. Least privilege falls out of the cap set instead of being maintained as an
# allowlist somebody has to remember to update.
#
# The senior roles all CARRY `deliver` on purpose (Peter, 2026-07-27: "the higher-order users can see
# all that stuff too… it might be the same person to begin with"). The overwhelmingly common day-one
# case is the boss driving his own van, and he must not need a second account or a mode switch.
# ── §17.34 · THE `admin` BIT SPLITS IN THREE (WP-A3) ─────────────────────────────────────────────
# The buyer context that forces this: a €50M distributor's panel is driven by an OFFICE OPERATOR —
# competent, busy, non-technical, probably the person who runs Sage — not by the owner. One `admin`
# bit cannot express that, because the office must edit the catalogue and the documents while never
# touching the IBAN, the subscription, or the arming switch.
#
#   admin:rocoto   the EMPLOYEE's own settings — catalogue, documents, sends, behaviour, alerts.
#                  Office-editable: this is the operator's actual job.
#   admin:negocio  the BUSINESS — fiscal block, IBAN, subscription, zones, people, invitations.
#                  Owner only. §17.34: IBAN/fiscal is owner-edit + masked-view for office.
#   golive         arming and disarming a channel. Owner only, and separate from admin:negocio on
#                  purpose — it is the one act with an outside consequence (§17.34.3: closing a
#                  channel is as heavy as opening one).
#
# `admin` SURVIVES AS A LEGACY ALIAS for one release. All 29 existing `require_cap("admin")` sites
# keep meaning exactly what they mean today — owner/founder only — so this change GRANTS nothing by
# itself. Each site is then retargeted at the finer cap deliberately, one at a time. Doing it the
# other way round (retarget first, alias later) is how a role split becomes a privilege escalation
# nobody reviewed.
ROLE_CAPS = {
    "owner":      frozenset({"read", "act", "deliver", "admin", "admin:rocoto", "admin:negocio", "golive"}),
    "founder":    frozenset({"read", "act", "deliver", "admin", "admin:rocoto", "admin:negocio", "golive"}),
    # THE OFFICE GAINS `admin:rocoto` AND NOTHING ELSE. It deliberately does NOT gain `admin`, so no
    # endpoint that exists today changes who can reach it.
    "staff":      frozenset({"read", "act", "deliver", "admin:rocoto"}),
    "repartidor": frozenset({"deliver"}),
}

# An unrecognised role is DENIED EVERYTHING. It used to fall back to 'staff', which carries read+act
# — so a typo in a role string, or any future role added to the DB before it was added here, silently
# minted a full operator account. That made adding the `repartidor` string a privilege GRANT rather
# than a restriction, which is exactly backwards.
DENY_ALL: frozenset = frozenset()


def can(role: str, cap: str) -> bool:
    return cap in ROLE_CAPS.get(role or "", DENY_ALL)


def _hash(secret: str) -> str:
    """sha256 hex of a secret (the rotating cookie half). Only hashes are stored."""
    return hashlib.sha256((secret or "").encode()).hexdigest()


def _split(raw: str) -> tuple[str, str]:
    """Cookie value `session_id.secret` → (session_id, secret). Bad shapes → ('','')."""
    if not raw or "." not in raw:
        return ("", "")
    sid, _, secret = raw.partition(".")
    return (sid, secret) if sid and secret else ("", "")


# ── membership: verified email → (tenant_slug, tenant_name, role) ─────────────────────────────────
async def resolve_membership(email: str) -> dict | None:
    """The tenancy claim, resolved SERVER-SIDE from the membership tables (operators.email →
    team_members → tenants). Returns {tenant_slug, tenant_name, role} or None (no membership → no
    session; fail-closed). When an operator belongs to several teams, operators.active_tenant wins;
    otherwise the earliest membership (deterministic). Role: operators.is_founder → 'founder', else
    team_members.role (unknown values collapse to 'staff' — least privilege)."""
    e = (email or "").strip().lower()
    if not e:
        return None
    pool = db.get_pool()
    async with pool.acquire() as con:
        rows = await con.fetch(
            "select tm.tenant_slug, tm.role, o.is_founder, o.active_tenant, t.name as tenant_name "
            "from operators o "
            "join team_members tm on tm.operator_id = o.id "
            "join tenants t on t.slug = tm.tenant_slug "
            "where lower(o.email) = $1 "
            "order by (tm.tenant_slug = o.active_tenant) desc nulls last, tm.created_at asc", e)
    if not rows:
        return None
    r = rows[0]
    role = "founder" if r["is_founder"] else (r["role"] or "staff")
    if role not in ROLE_CAPS:
        # DENY, don't demote. See the ROLE_CAPS note: coercing the unknown to 'staff' handed out
        # read+act, so every future role was a privilege grant until somebody remembered to restrict
        # it. An unrecognised role now reaches nothing and says so loudly at the route.
        role = "desconocido"
    return {"tenant_slug": r["tenant_slug"], "tenant_name": r["tenant_name"], "role": role}


# ── minting / login ────────────────────────────────────────────────────────────────────────────────
async def mint(actor_email: str, tenant_slug: str, role: str, ip: str, ua: str) -> dict:
    session_id = secrets.token_urlsafe(24)
    secret = secrets.token_urlsafe(32)
    csrf = secrets.token_urlsafe(32)
    pool = db.get_pool()
    async with pool.acquire() as con:
        await con.execute(
            "insert into sup_session(session_id, secret_hash, actor_email, tenant_slug, role, ip, ua, "
            "  csrf_token, created_at, expires_at, last_seen_at) "
            "values($1,$2,$3,$4,$5,$6,$7,$8, now(), now() + ($9||' seconds')::interval, now())",
            session_id, _hash(secret), actor_email, tenant_slug, role, (ip or "")[:80],
            (ua or "")[:400], csrf, str(SESSION_TTL_S))
    return {"raw": f"{session_id}.{secret}", "csrf": csrf, "role": role, "email": actor_email,
            "tenant_slug": tenant_slug, "ttl": SESSION_TTL_S, "session_id": session_id}


async def session_for_user(user: dict, ip: str, ua: str) -> dict:
    """Resolve a VERIFIED Supabase user → a tenant-scoped supplier session. Two gates, both
    fail-closed: (1) has_matching_oauth — a trusted OAuth identity whose OWN email matches the
    account email (Google-only elevation; a password signup of a member's address never enters,
    the linkIdentity forgery never enters); (2) a real membership row (resolve_membership).
    The caller must have already verified the bearer against the Supabase Auth API.
    Returns {ok, raw, csrf, role, email, tenant_slug, tenant_name} or {ok:False, error}."""
    email = (user.get("email") or "").strip().lower()
    if not email:
        return {"ok": False, "error": "no_email"}
    if not brain_auth.has_matching_oauth(user):        # STRICT: matching-email OAuth identity only
        return {"ok": False, "error": "oauth_required"}
    m = await resolve_membership(email)
    if not m:
        return {"ok": False, "error": "forbidden"}
    s = await mint(email, m["tenant_slug"], m["role"], ip, ua)
    return {"ok": True, "tenant_name": m["tenant_name"], **s}


# ── verification + sliding rotation (cr_session.verify, on the sup table) ─────────────────────────
async def verify(raw: str, *, rotate: bool = False) -> dict | None:
    """Resolve a raw cookie (`session_id.secret`) → session ctx, or None (fail-closed on
    empty/expired/idle/revoked/wrong-secret). ctx = {session_id, actor_email, tenant_slug, role,
    csrf, fresh_raw, remaining}. Rotation only when `rotate` (the navigational /me check) AND past
    the rotation window AND the CURRENT secret matched — one atomic UPDATE swaps the secret; the
    winner gets fresh_raw; concurrent requests ride the prev-secret grace."""
    sid, secret = _split(raw)
    if not sid or not secret:
        return None
    sh = _hash(secret)
    pool = db.get_pool()
    async with pool.acquire() as con:
        row = await con.fetchrow(
            "select session_id, secret_hash, prev_secret_hash, actor_email, tenant_slug, role, csrf_token, "
            "  (prev_secret_until is not null and prev_secret_until > now()) as grace_live, "
            "  extract(epoch from (now() - last_seen_at)) as idle_s, "
            "  extract(epoch from (expires_at - now())) as remaining_s "
            "from sup_session "
            "where session_id = $1 and revoked_at is null and expires_at > now()", sid)
        if not row:
            return None
        if row["idle_s"] is not None and float(row["idle_s"]) > IDLE_MAX_S:
            return None
        cur_ok = hmac.compare_digest(row["secret_hash"] or "", sh)
        prev_ok = bool(row["grace_live"]) and hmac.compare_digest(row["prev_secret_hash"] or "", sh)
        if not (cur_ok or prev_ok):
            return None                                 # right session_id, wrong/rotated-out secret
        ctx = {"session_id": sid, "actor_email": row["actor_email"], "tenant_slug": row["tenant_slug"],
               "role": row["role"], "csrf": row["csrf_token"], "fresh_raw": None,
               "remaining": int(row["remaining_s"] or 0)}
        if rotate and cur_ok and row["idle_s"] is not None and float(row["idle_s"]) > ROTATE_AFTER_S:
            new_secret = secrets.token_urlsafe(32)
            won = await con.fetchval(
                "update sup_session set prev_secret_hash = secret_hash, "
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
        await con.execute("update sup_session set last_seen_at = now() where session_id = $1", sid)
        return ctx


def check_csrf(ctx: dict | None, token: str | None) -> bool:
    """Constant-time compare of the request's X-Sup-CSRF against the session csrf_token (stable
    across rotation)."""
    if not ctx or not ctx.get("csrf"):
        return False
    return hmac.compare_digest(str(ctx["csrf"]), str(token or ""))


async def revoke(raw: str) -> None:
    sid, _secret = _split(raw)
    if not sid:
        return
    pool = db.get_pool()
    async with pool.acquire() as con:
        await con.execute("update sup_session set revoked_at = now() where session_id = $1", sid)


async def revoke_all(actor_email: str) -> str:
    """Kill every live session for an actor (lost device / team removal)."""
    pool = db.get_pool()
    async with pool.acquire() as con:
        return await con.execute("update sup_session set revoked_at = now() "
                                 "where actor_email = $1 and revoked_at is null",
                                 (actor_email or "").lower())


# ── rate limiting (in-memory sliding window; single-worker → process-local is correct) ──────────
_RL: dict[str, deque] = {}

# THE STORE IS BOUNDED (2026-08-09 review, F10). It was not, and the key space is attacker-chosen:
# `demo_auth.issue_magic` evaluates `demomagic:email:{addr}` on an address anybody can put in a
# form, and `rate_ok` ALLOCATES the bucket before it compares against the limit — so a flood of
# distinct addresses left a dict entry plus a deque each (~250–350 bytes), permanently, in a
# single-worker process, with nothing in the logs but throttle lines. `try_chat._HITS` was already
# bounded at 5000 for exactly this reason; this is the same discipline, plus a staleness pass so
# eviction prefers buckets nobody has touched over buckets in active use.
_RL_MAX = 5000
_RL_STALE_S = 3600          # the longest window any caller uses (MAGIC_IP_WINDOW_S)


def _prune_rl(now: float) -> None:
    """Drop empty and stale buckets; if still at the cap, evict the least-recently-touched quarter.
    Called only when the store is full, so the ordinary path stays a dict lookup."""
    for k in [k for k, d in _RL.items() if not d or (now - d[-1]) > _RL_STALE_S]:
        _RL.pop(k, None)
    if len(_RL) >= _RL_MAX:
        oldest = sorted(_RL.items(), key=lambda kv: kv[1][-1] if kv[1] else 0.0)
        for k, _d in oldest[: max(1, _RL_MAX // 4)]:
            _RL.pop(k, None)
        log.warning("sup_session: rate-limit store hit %d buckets — evicted to %d. A flood on an "
                    "attacker-chosen key (an email in a form) looks exactly like this.",
                    _RL_MAX, len(_RL))


def rate_ok(bucket: str, limit: int, window_s: int) -> bool:
    """True iff this hit is within `limit` per `window_s` for `bucket`. Prefer an UNSPOOFABLE bucket
    (session actor_email) over client IP; pair a per-IP limit with an absolute-global ceiling so a
    spoofed-IP flood still hits a wall. Callers that key on untrusted input should evaluate their
    global and IP buckets FIRST, so a refusal short-circuits before a new key is allocated."""
    now = time.time()
    dq = _RL.get(bucket)
    if dq is None:
        if len(_RL) >= _RL_MAX:
            _prune_rl(now)
        dq = deque(); _RL[bucket] = dq
    cutoff = now - window_s
    while dq and dq[0] < cutoff:
        dq.popleft()
    if len(dq) >= limit:
        return False
    dq.append(now)
    return True


# ── audit spine (append-only; the CR pattern for supplier money/state actions) ──────────────────
async def audit(actor_email: str, tenant_slug: str, ip: str, action: str, *,
                target_id: str | None = None, detail: dict | None = None, result: str = "ok") -> None:
    """Append-only audit of a supplier actor action (approve, line edit, send-as-Rocoto,
    dispatch-now, settings, the e-commerce toggle). sup_audit is append-only at the DB level
    (trigger). detail must be NON-PII (ids / counts / amounts).

    `detail` is passed to the jsonb parameter as a NATIVE DICT, never json.dumps'd: every pool
    registers `set_type_codec("jsonb", encoder=json.dumps)` in db._init_conn, so handing it a string
    encodes a second time and stores a JSON *string* where an object belongs. Verified on the clone
    (`jsonb_typeof` → 'string' for the dumps'd value, 'object' for the native one) — the row still
    lands, so nothing ever failed loudly; the audit trail was simply un-queryable. Same defect class
    WP-3/4 found in brain/stock.py."""
    pool = db.get_pool()
    try:
        async with pool.acquire() as con:
            await con.execute(
                "insert into sup_audit(ts, actor_email, tenant_slug, ip, action, target_id, detail, result) "
                "values(now(), $1,$2,$3,$4,$5,$6::jsonb,$7)",
                (actor_email or "").lower(), tenant_slug or "", (ip or "")[:160], action, target_id,
                (detail or {}), result)
    except Exception:
        log.exception("sup_audit write failed action=%s tenant=%s target=%s", action, tenant_slug, target_id)
        raise  # a lost audit on a money/state action is not acceptable — surface it


# ── the runtime-tenant fence ─────────────────────────────────────────────────────────────────────
def owns_runtime(tenant_slug: str) -> bool:
    """The legacy runtime tables (orders, whatsapp_messages, wa.* scopes) belong to the ONE tenant
    this deployment's runtime serves (config.BRAIN_TENANT). A session for any OTHER tenant must be
    refused LOUDLY on those surfaces — never served another tenant's rows, never served silence that
    looks like data. Tables that carry tenant_id (customer_profiles, catalogue_skus, tenants,
    team_members, employee_subscriptions) are filtered by the session's tenant_slug instead."""
    return (tenant_slug or "") == config.BRAIN_TENANT
