"""claim.py — THE CLAIM RAIL (THE-JOURNEY-CANON §2.1 · step 1 of the mono-account journey).

«Peter sends their link; they claim the account (real auth, email). "Super secure, all of it."»

THIS IS NOT A SECOND AUTH SYSTEM, AND THE CANON SAYS SO BY PATH.
THE-JOURNEY-CANON §2.1 property 3 names this repo's own file: «This exact discipline is already
implemented in production Rocoto: `product/backend/demo_auth.py` — `__Host-rk_magic` with a
plain-http fallback, `Sec-Fetch-Site` and `Origin` as the second wall, and the `demo_magic_links`
table recording user agent, consent and text version. **The claim rail is that rail with account
creation on the end of it.**»

So everything load-bearing here is BORROWED rather than rewritten:
  · the session is `sup_session.mint` → the same `sup_session` cookie, the same rotation, idle and
    absolute expiry, the same `require_sup` gate, the same 401-that-clears-the-cookie. A person who
    claims is signed in exactly as every other door signs somebody in.
  · the workspace is `provisioning.resume_or_provision` → one operator, one workspace, forever.
  · the cross-site wall is `demo_auth._same_site_post`, IMPORTED rather than copied. A security wall
    that exists twice gets hardened once; the second copy is the one that is still vulnerable.

WHAT IS THIS FILE'S OWN, AND WHY IT HAD TO BE:

  ① THE LINK IS MINTED BY PETER AND MAILED, so the nonce cannot bind to the browser that REQUESTED
     it — that browser is Peter's. Saying otherwise would be the one dishonest sentence in the rail.
     What the nonce binds here is the POST to the browser that LOADED THE CLAIM PAGE: the cookie is
     set on the GET that renders it and matched inside the consuming UPDATE. That kills login-CSRF
     (a cross-site page can neither read nor forge a `__Host-` cookie), which is the attack the
     nonce exists for. It does NOT stop somebody who intercepted the URL from opening it themselves
     — nothing in a mailed link can, which is why the link is short-lived, single-use, and every use
     is an audited row.

  ② THE HOUSE IS ON THE LINK. `demo_magic_links` carries an address and nothing else, because
     /entrar is a sign-in. A claim is Peter opening ONE account for ONE address at ONE house, and
     §2.1 property 5 is that «no field on the page can change which house is claimed» — so the house
     is a column, the page renders it, and the claim never reads a house from the request body.

  ③ THE PUBLIC MINT STAYS CLOSED. `demo_auth.sign_in`'s fence ① refuses any address with no
     workspace unless `config.DEMO_PROVISION_OPEN` (§21/§22, 2026-08-28: «the /entrar demo-mint door
     CLOSES»). A claim is the deliberate exception, and it must not reopen that door for anybody
     else: THE INVITE ROW IS THE AUTHORIZATION, an allowlist of exactly one address at exactly one
     house, minted by the founder. So this file provisions against the invite and never consults
     that flag — and `sign_in` is left untouched, which is why /entrar behaves today exactly as it
     did yesterday.

  ④ A CLAIMED WORLD IS NEVER REAPED. `tenants.provisioned_via` is read by exactly one consumer,
     `demo_flow.reap`, which may drop a `provisioned_via='demo'` world that never went live and may
     drop nothing else. A claim marks its own door, so a customer Peter invited can never be swept
     by the demo retention promise.

THE SEVEN PROPERTIES OF §2.1, each of which `tests/vital_journey.py` asserts:
  1. single use          — the consuming UPDATE, never a read-then-write
  2. short-lived         — an expiry, checked at the door
  3. nonce-bound         — inside the WHERE, so a mismatch cannot BURN the link either
  4. the token never becomes the session — claiming mints a session cookie; the token dies there
  5. the address is fixed by the link
  6. one person, one account, at claim time
  7. every claim an audited row — who, when, from what agent, against which invite
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, Request, Response

import config
import db
import demo_auth
import provisioning
import sup_api
import sup_session
from brain import journey
from sup_api import SupApiError, _client_ip, _set_cookie

log = logging.getLogger("rocoto.claim")

router = APIRouter(prefix="/api/claim")

# `/api/claim/journey/state` must be matched BEFORE `/api/claim/{token}`. FastAPI matches in
# REGISTRATION order, so a literal path declared after a path parameter is unreachable — the classic
# footgun. Its own router, included first in `mount`, makes the order structural rather than a
# convention the next person has to remember.
state_router = APIRouter(prefix="/api/claim")

# ── THE CLOCK ────────────────────────────────────────────────────────────────────────────────────
# SEVEN DAYS, and the number is `invitations.py`'s rather than `demo_auth`'s fifteen minutes. A
# magic link is requested and clicked in one sitting, so fifteen minutes is generous. A CLAIM link
# is mailed by Peter and read whenever the person opens their mail — a quarter of an hour would
# expire nearly every one of them before it was seen. §17.41 already chose seven days for the
# member invitation, which is the same shape of act, and two different expiry policies for two
# mailed links would be a thing to keep in step for no gain.
EXPIRY_DAYS = 7

# The requester binding (§2.1 property 3). Its own cookie NAME, deliberately: sharing `rk_magic`
# would let a pending /entrar sign-in's nonce satisfy a claim, which is one guard doing the work of
# two and neither doing it properly.
NONCE_COOKIE = "__Host-rk_claim"
NONCE_FALLBACK = "rk_claim"                  # a plain-http dev box cannot carry a __Host- cookie
NONCE_TTL_S = 60 * 60 * 6                    # a claim page left open over a long lunch still works

# The door this rail marks on `tenants.provisioned_via`. The vocabulary lives in `provisioning`
# (VIA_DEMO · VIA_ALTA); this is the third door and it is named here because it is this rail's own
# fact. Its ONE consumer is the reaper, and what it tells the reaper is: never.
VIA_CLAIM = "claim"


_schema_ready = False


async def ensure_schema() -> None:
    """Verify migration ownership; application requests never alter schema."""
    from schema_migrations import assert_current

    async with db.get_pool().acquire() as connection:
        await assert_current(connection)


def _hash(token: str) -> str:
    return hashlib.sha256((token or "").encode()).hexdigest()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def claim_base() -> str:
    """Where the claim PAGE lives — and it FAILS CLOSED when nobody has said.

    It is not `DEMO_PUBLIC_BASE_URL`. That is `app.soyrocoto.com`, the LIVE customer app, and the
    domain law is that it stays untouched until Peter's explicit go (§92: «the wired app takes
    app.soyrocoto.com, on Peter's explicit go»). Minting invitations into it would perform that
    cutover by side effect, one mailed link at a time. So the base is its own env key with NO
    default, and `mint` refuses rather than guessing a domain nobody chose."""
    return (config._env("ROCOTO_CLAIM_BASE_URL", "") or "").strip().rstrip("/")


# ═══ THE MINT — Peter's act ═══════════════════════════════════════════════════════════════════════

async def mint(address: str, house: str, *, minted_by: str = "") -> dict[str, Any]:
    """One address, one house, single use. Returns `{url, token, expires}`.

    Re-minting for a still-live address SUPERSEDES the previous link (the partial unique index makes
    that structural, exactly as `invitations.create` does): a resend must retire the link it
    replaces, or «revoke» becomes the only way to retire one and every resend multiplies them.
    """
    a = (address or "").strip().lower()
    if "@" not in a:
        raise ValueError("a claim link needs a real email address — it is the identity it binds to")
    h = provisioning.clean_company(house)
    if not h:
        raise ValueError("a claim link names the house it opens — the page's heading is that name")
    base = claim_base()
    if not base:
        raise RuntimeError(
            "ROCOTO_CLAIM_BASE_URL is unset — the claim page has no home yet, and this rail will "
            "not guess app.soyrocoto.com (the domain law: the cutover is Peter's explicit go)")

    token = secrets.token_urlsafe(32)
    expires = _now() + timedelta(days=EXPIRY_DAYS)
    await ensure_schema()
    async with db.get_pool().acquire() as con, con.transaction():
        await con.execute(
            "update account_claim set revoked_at = now() "
            "where lower(address) = $1 and consumed_at is null and revoked_at is null", a)
        await con.execute(
            "insert into account_claim(token_hash, address, house, minted_by, expires_at) "
            "values($1,$2,$3,$4,$5)",
            _hash(token), a, h, (minted_by or "").strip().lower(), expires)
    log.info("claim minted for %s at house %r (by %s)", a, h, minted_by or "founder")
    return {"url": f"{base}/claim/{token}", "token": token, "expires": expires.isoformat()}


async def revoke(token: str) -> bool:
    """Kill a link THIS INSTANT (§17.33's law, borrowed whole). Checked at the door on every use,
    never by a sweep — a sweep that lags leaves a live link past its promise."""
    await ensure_schema()
    async with db.get_pool().acquire() as con:
        r = await con.execute(
            "update account_claim set revoked_at = now() "
            "where token_hash = $1 and consumed_at is null and revoked_at is null", _hash(token))
    return r.endswith("1")


# ═══ THE PEEK — what the claim page renders ═══════════════════════════════════════════════════════

# Each refusal is a DISTINCT reason, never a shrug. That is `invitations.py`'s call for a link of
# exactly this kind (§17.41: an expired or revoked link «says so plainly and offers nothing»), and
# it is the opposite of `demo_auth`'s single non-leaking answer — deliberately, because /entrar's
# answer would tell a stranger whether an ADDRESS has an account, while this one can only tell
# somebody holding an unguessable token what happened to that token.
_GONE = "Este enlace ya se ha usado. Entra con tu correo."
_EXPIRED = "Este enlace ha caducado. Pídele a Peter uno nuevo para la misma dirección."
_DEAD = "Este enlace ya no sirve."
_WRONG_BROWSER = ("Abre el enlace en el mismo navegador en el que estás. Por seguridad, la cuenta "
                  "se abre donde se abrió la página.")


async def peek(token: str, *, mark_opened: bool = False) -> dict[str, Any]:
    """`{ok, house, address, invited_by, at}` or `{ok: False, error}`.

    `mark_opened` writes `opened_at` — the fact behind «sent 2 days ago · not opened yet» on Peter's
    own list. Honest caveat, written down because it will otherwise be discovered as a bug: a
    corporate mail scanner that fetches the page marks it opened. `opened_at` therefore means «the
    page was fetched», never «a person read it», and no decision may hang on it.
    """
    t = (token or "").strip()
    if not t or len(t) > 200:
        return {"ok": False, "error": "unknown", "message": _DEAD}
    await ensure_schema()
    async with db.get_pool().acquire() as con:
        row = await con.fetchrow(
            "select address, house, minted_by, created_at, expires_at, consumed_at, revoked_at, "
            "       tenant_slug from account_claim where token_hash = $1", _hash(t))
        if row is None:
            return {"ok": False, "error": "unknown", "message": _DEAD}
        if row["revoked_at"] is not None:
            return {"ok": False, "error": "revoked", "message": _DEAD}
        if row["consumed_at"] is not None:
            return {"ok": False, "error": "claimed", "message": _GONE,
                    "house": row["house"], "address": row["address"]}
        if row["expires_at"] <= _now():
            return {"ok": False, "error": "expired", "message": _EXPIRED,
                    "address": row["address"]}
        if mark_opened:
            await con.execute(
                "update account_claim set opened_at = coalesce(opened_at, now()) "
                "where token_hash = $1", _hash(t))
    return {"ok": True, "house": row["house"], "address": row["address"],
            "invited_by": row["minted_by"], "at": row["created_at"].isoformat()}


# ═══ THE CONSUME — single use, and it is the UPDATE ═══════════════════════════════════════════════

async def consume(token: str, nonce: str, *, ip: str = "", ua: str = "") -> Optional[dict[str, Any]]:
    """token (+ the page's nonce) → the row, consumed. None for every refusal alike.

    SINGLE USE IS THE UPDATE, not a check followed by a write — `demo_auth.consume_magic`'s reason,
    unchanged: two concurrent presses (the mail client's prefetch and the human's thumb) cannot both
    win, because exactly one gets a row back. A read-then-write hands a working session to both.

    THE NONCE IS IN THE `WHERE`, NOT IN AN `IF` AFTER IT. A mismatched nonce must not CONSUME the
    link: if it did, a cross-site form could burn somebody's pending claim without being able to use
    it — denial of service instead of takeover, which is still the attacker choosing what happens.

    Rows minted before a page was opened carry `nonce_hash IS NULL`, and those are accepted: the
    nonce is written on the GET that renders the page, so a null one means nobody has loaded it and
    there is nothing to bind to yet. The POST cannot arrive without that GET from a real browser.
    """
    t = (token or "").strip()
    if not t or len(t) > 200:
        return None
    th = _hash(t)
    nh = _hash(nonce) if (nonce or "").strip() else None
    await ensure_schema()
    async with db.get_pool().acquire() as con:
        row = await con.fetchrow(
            "update account_claim set consumed_at = now(), claimed_ip = $3, claimed_ua = $4 "
            "where token_hash = $1 and consumed_at is null and revoked_at is null "
            "  and expires_at > now() and (nonce_hash is null or nonce_hash = $2) "
            "returning token_hash, address, house, minted_by, created_at, nonce_hash",
            th, nh, (ip or "")[:80], (ua or "")[:400])
    if row is None:
        return None
    # Belt to the suspender: the WHERE matched by hash already, so this can only fail if the row we
    # got back is not the row we asked for. Constant-time anyway — it costs nothing and it keeps the
    # comparison in the file where a reader looks for it.
    if not hmac.compare_digest(row["token_hash"], th):
        return None
    if row["nonce_hash"] and not hmac.compare_digest(row["nonce_hash"], nh or ""):
        return None
    return dict(row)


# ═══ THE CLAIM — account creation on the end of the rail ══════════════════════════════════════════

async def claim(token: str, nonce: str, *, ip: str = "", ua: str = "") -> dict[str, Any]:
    """Consume → workspace → session → the journey's own two events. Raises `SupApiError` on refusal.

    ORDER MATTERS AND IT IS `sign_in`'s: the workspace is minted FIRST (a session for a tenant that
    does not exist resolves onto nothing), the session SECOND, the ledger LAST — because the ledger
    is the one part whose failure must not cost somebody their account. It is logged loudly instead,
    and the claim row carries `tenant_slug` regardless, so a re-open of the link tells them the
    truth rather than dying blank.
    """
    row = await consume(token, nonce, ip=ip, ua=ua)
    if row is None:
        # The peek says WHICH refusal, without a second consuming call.
        why = await peek(token)
        raise SupApiError(401, why.get("error", "link_dead"),
                          _WRONG_BROWSER if (why.get("ok") and not nonce)
                          else why.get("message", _DEAD))

    address, house = row["address"], row["house"]

    # ONE PERSON, ONE ACCOUNT, AT CLAIM TIME (§2.1 property 6). `resume_or_provision` is the act:
    # a returning address RESUMES the workspace it already has — never a second one — and a first
    # claim mints one named by the house on the link. The house name does NOT rename a workspace
    # somebody already named; that law lives in `resume_or_provision` and is not restated here.
    ws = await provisioning.resume_or_provision(address, company=house, via=VIA_CLAIM)
    session = await sup_session.mint(address, ws["slug"], ws["role"], ip, ua)

    async with db.get_pool().acquire() as con:
        await con.execute("update account_claim set tenant_slug = $2 where token_hash = $1",
                          row["token_hash"], ws["slug"])
    try:
        await sup_session.audit(address, ws["slug"], ip, "account.claim",
                                detail={"house": house, "minted_by": row["minted_by"],
                                        "provisioned": bool(ws.get("created")), "ua": (ua or "")[:200]})
    except Exception:
        # audit() re-raises by design on money/state actions; losing the trail must not lose the
        # account. The `account_claim` row IS the audited row §2.1 property 7 asks for, and it is
        # already written by the consuming UPDATE above — this is the second copy, not the first.
        log.exception("claim audit failed (fail-soft) for %s", address)

    # ── THE JOURNEY'S OWN LEDGER (canon §1.3) ────────────────────────────────────────────────────
    # The `invite` is MIRRORED onto the house's ledger carrying the hour Peter actually minted it.
    # It could not have been written then — the house did not exist — and stamping it «now» would
    # tell the fold that the invite and the claim happened in the same second, which is exactly the
    # fact the claim page displays («Invited by Peter Latintzar · 27 August»). Both appends carry a
    # dedupe key on the token, so a retry of this tail can never double the ledger.
    try:
        async with db.get_pool().acquire() as con:
            inv_id, _ = await journey.append(
                con, ws["slug"], "invite", by="founder", at=row["created_at"],
                actor=row["minted_by"] or "founder", source="claim",
                value=address, house=house,
                dedupe_key=f"claim:{row['token_hash']}:invite")
            await journey.append(
                con, ws["slug"], "claim", by="customer", actor=address, source="claim",
                caused_by=inv_id, dedupe_key=f"claim:{row['token_hash']}:claim")
    except Exception:
        log.exception("claim ledger append failed (fail-soft) for %s at %s", address, ws["slug"])

    return {"session": session, "workspace": ws, "address": address, "house": house}


# ═══ THE NONCE — this rail's own cookie ═══════════════════════════════════════════════════════════

def _secure() -> bool:
    """https only — a `__Host-` cookie is invalid without Secure, and a local http box must still be
    drivable. The claim base is the deployment that matters here, not the demo's."""
    return claim_base().startswith("https") or str(config.DEMO_PUBLIC_BASE_URL or "").startswith("https")


def _nonce_name() -> str:
    return NONCE_COOKIE if _secure() else NONCE_FALLBACK


def _read_nonce(request: Request) -> str:
    return (request.cookies.get(_nonce_name()) or "")[:120]


def _set_nonce(response: Response, nonce: str) -> None:
    """`__Host-` demands Secure + Path=/ + NO Domain, and the browser enforces all three — which is
    the point: this cookie cannot have been planted by a sibling subdomain or on a plain-http
    origin. httponly because no script needs it."""
    response.set_cookie(_nonce_name(), nonce, max_age=NONCE_TTL_S,
                        httponly=True, secure=_secure(), samesite="lax", path="/")


def _clear_nonce(response: Response) -> None:
    """SAME ATTRS AS `_set_nonce` — a `__Host-` cookie says so and the browser enforces it. Deleting
    it bare (no Secure) makes the whole Set-Cookie invalid and the nonce survives its own
    consumption, which is the bug `demo_auth._clear_nonce` documents having measured live."""
    response.delete_cookie(_nonce_name(), path="/",
                           httponly=True, secure=_secure(), samesite="lax")


async def _arm_nonce(response: Response, token: str) -> str:
    """Set the page's nonce and record its hash beside the link. Only ever for a LIVE link — arming
    a spent one would write a guard onto a row nothing can use.

    Returns the nonce so the vital can drive the REAL path rather than a copy of it. A test that
    mints its own nonce would prove that its own code agrees with itself."""
    nonce = secrets.token_urlsafe(24)
    async with db.get_pool().acquire() as con:
        await con.execute(
            "update account_claim set nonce_hash = $2 where token_hash = $1 "
            "and consumed_at is null and revoked_at is null and expires_at > now()",
            _hash(token), _hash(nonce))
    _set_nonce(response, nonce)
    return nonce


# ═══ THE FOUNDER GATE ═════════════════════════════════════════════════════════════════════════════

async def _require_founder(ctx: dict = Depends(sup_api.require_cap("admin"))) -> dict:
    """`invite` is Peter's act (canon §1.1), so the route says so rather than trusting its caller.

    The role comes off the SESSION, which `sup_session.mint` stamped from `operators.is_founder` —
    the same fact `resume_or_provision` reads. An owner of their own house is not a founder here:
    minting an account for a third party is the one act on this rail that creates a world."""
    if (ctx.get("role") or "") != "founder":
        raise SupApiError(403, "founder_only", "Sólo el fundador puede abrir una cuenta.")
    return ctx


# ═══ ROUTES ═══════════════════════════════════════════════════════════════════════════════════════

@router.post("/mint")
async def claim_mint(payload: dict, ctx: dict = Depends(_require_founder)):
    """`{address, house}` → `{url, expires}`. Peter's act, and the whole of `invite`'s authorization.

    The `invite` EVENT is not appended here. It cannot be: the house has no scope until the claim
    provisions it, and a journey event with nowhere to live would have to invent a store — which is
    the second ledger THE-WIRING-INDEX §7 exists to prevent. The `account_claim` row is the record
    until then, and the claim mirrors the invite onto the house's own ledger with its true hour.
    """
    address = str((payload or {}).get("address") or "").strip()
    house = str((payload or {}).get("house") or "").strip()
    try:
        out = await mint(address, house, minted_by=ctx.get("email") or "")
    except ValueError as e:
        raise SupApiError(400, "bad_claim", str(e))
    except RuntimeError as e:
        raise SupApiError(503, "claim_base_unset", str(e))
    return {"ok": True, **out}


@router.post("/revoke")
async def claim_revoke(payload: dict, _: dict = Depends(_require_founder)):
    """The link dies THIS INSTANT — not at the next sweep, including for a link already open in
    somebody's browser, because every use re-checks the column."""
    return {"ok": await revoke(str((payload or {}).get("token") or ""))}


@router.get("/{token}")
async def claim_peek(token: str, response: Response):
    """What the claim page renders, and where the requester binding is armed.

    IT DOES NOT CONSUME, and that is not fussiness: corporate mail scanners and link-preview bots
    GET every URL in an inbound mail before the human sees it. A GET that consumed a single-use
    token would hand the account to the scanner and a dead link to the person. Nothing issues a POST
    on your behalf, so the act belongs there — and GET stays idempotent, which is what the method
    means.
    """
    out = await peek(token, mark_opened=True)
    if out.get("ok"):
        await _arm_nonce(response, token)
    return out


@router.post("/{token}")
async def claim_post(token: str, request: Request, response: Response):
    """Claim the account → the panel's own session cookie.

    Two walls, and they fail differently on purpose. ① the `__Host-` nonce set when the page was
    rendered and matched inside the consuming UPDATE: a cross-site page can neither read nor forge
    it. ② `Sec-Fetch-Site` / `Origin`, which the browser writes and page script cannot. ② is
    `demo_auth._same_site_post` IMPORTED — one wall, one place it gets hardened.

    THE TOKEN NEVER BECOMES THE SESSION (§2.1 property 4): the cookie set here is `sup_api`'s own,
    byte-identical to the one `/api/sup/session/login` issues, and the URL token is dead the moment
    the UPDATE above returned a row.
    """
    if not demo_auth._same_site_post(request):
        log.warning("claim refused: cross-site POST (site=%r origin=%r)",
                    request.headers.get("sec-fetch-site"), request.headers.get("origin"))
        raise SupApiError(403, "bad_origin", _DEAD)
    out = await claim(token, _read_nonce(request), ip=_client_ip(request),
                      ua=request.headers.get("user-agent", ""))
    s, ws = out["session"], out["workspace"]
    _set_cookie(response, s["raw"])
    _clear_nonce(response)          # single use, like the token it guarded
    return {"ok": True, "email": s["email"], "tenant_slug": ws["slug"],
            "tenant_name": ws["name"], "house": out["house"], "role": s["role"],
            "caps": sorted(sup_session.ROLE_CAPS.get(s["role"], [])), "csrf": s["csrf"],
            "expires_in_s": int(s.get("ttl") or 0), "status": "claimed"}


# ═══ THE JOURNEY'S OWN READ ═══════════════════════════════════════════════════════════════════════

@state_router.get("/journey/state")
async def journey_state(ctx: dict = Depends(sup_api.require_cap("read"))):
    """`{status, step, steps[], events[]}` for the house the session is in.

    The two grants-fed steps (`organisation`, `month`) read not-done here until the plan's W4 moves
    the grants store off the browser. `steps_of` takes those counts rather than reaching for them,
    so the day that store lands this route passes them and no fold changes.
    """
    async with db.get_pool().acquire() as con:
        return await journey.state_of(con, ctx.get("tenant_slug") or "")


def mount(app) -> None:
    """ONE line in app.py, AFTER `sup_api.mount(...)`: this router binds sup_api's own session
    dependency and raises sup_api's own error types, so its handlers must already be registered.

    `state_router` goes FIRST — see its declaration for why."""
    app.include_router(state_router)
    app.include_router(router)
