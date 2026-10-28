"""Control Room HTTP authentication; existing cookies, roles and CSRF policy."""

from __future__ import annotations

from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException, Request, Response
from fastapi.responses import JSONResponse

import cr_session
from auth_headers import bearer_token as _bearer
from brain import auth as brain_auth

router = APIRouter()

CR_COOKIE = "cr_sid"
CR_COOKIE_PATH = "/api/crm"


def _client_ip(request: Request) -> str:
    """ONE derivation, in sup_api — this was a verbatim copy and the copy is how the 2026-08-09
    review's F7 (a client-writable `X-Forwarded-For` treated as the truth) survived in two places at
    once. Delegated rather than deleted because ~30 call sites in this file name it."""
    import sup_api as _sa

    return _sa._client_ip(request)


def _set_cr_cookie(response: Response, raw: str, max_age: int | None = None) -> None:
    response.set_cookie(
        CR_COOKIE,
        raw,
        max_age=(max_age if max_age and max_age > 0 else cr_session.SESSION_TTL_S),
        httponly=True,
        secure=True,
        samesite="strict",
        path=CR_COOKIE_PATH,
    )


class CRAuthError(Exception):
    """Raised by require_cr_session on an absent/expired/revoked session → 401 + a Set-Cookie that DELETES
    cr_sid (byte-identical attrs), so a dead/purged/restored-from-backup cookie can't wedge the SPA."""


async def _cr_auth_handler(request: Request, exc: Exception) -> JSONResponse:
    r = JSONResponse({"error": "control room session required"}, status_code=401)
    r.delete_cookie(CR_COOKIE, path=CR_COOKIE_PATH)
    return r


def _clear_cr_cookie(response: Response) -> None:
    response.delete_cookie(CR_COOKIE, path=CR_COOKIE_PATH)


async def require_cr_session(request: Request, response: Response) -> dict:
    """CR session gate. Verifies the cr_sid cookie -> actor ctx; slides rotation (resets the cookie on a
    fresh id); enforces CSRF (double-submit X-CSRF-Token) on every unsafe method. 401 when
    absent/expired/idle/revoked. This is the gate for the human CR — NOT the machine key."""
    _is_me = request.url.path.endswith("/crm/me")  # rotate ONLY on the navigational /me check
    ctx = await cr_session.verify(request.cookies.get(CR_COOKIE, ""), rotate=_is_me)
    if not ctx:
        raise CRAuthError()
    if ctx.get("fresh_raw"):
        _set_cr_cookie(response, ctx["fresh_raw"], max_age=ctx.get("remaining"))
    if request.method in ("POST", "PUT", "PATCH", "DELETE") and not cr_session.check_csrf(
        ctx, request.headers.get("x-csrf-token")
    ):
        raise HTTPException(403, "csrf token invalid")
    ctx["email"] = ctx.get("actor_email", "")
    ctx["via"] = "session"  # aliases for shared handlers
    return ctx


def require_cr_cap(cap: str):
    """Dependency factory: a valid CR session AND the given capability (read | act | admin)."""

    async def _dep(ctx: dict = Depends(require_cr_session)) -> dict:
        if not cr_session.can(ctx.get("role", ""), cap):
            raise HTTPException(403, f"capability required: {cap}")
        return ctx

    return _dep


@router.post("/api/crm/login")
async def api_cr_login(request: Request, response: Response, authorization: str = Header(default="")):
    """Exchange a verified Supabase bearer (Google-OAuth owner/admin) for a server-side CR session."""
    ip = _client_ip(request)
    audit_ip = (request.headers.get("x-forwarded-for") or ip)[:160]  # full chain for forensics
    if not cr_session.rate_ok(f"cr_login:{ip}", limit=12, window_s=300):
        raise HTTPException(429, "too many attempts")
    if not cr_session.rate_ok("cr_login:GLOBAL", limit=60, window_s=300):  # spoofed-IP flood still walls
        raise HTTPException(429, "too many attempts")
    user = await brain_auth.verify_token(_bearer(authorization))
    if not user:
        raise HTTPException(401, "unauthorized")
    s = await cr_session.session_for_user(user, ip, request.headers.get("user-agent", ""))
    if not s.get("ok"):
        await cr_session.audit((user.get("email") or ""), audit_ip, "login", result="forbidden")
        raise HTTPException(403, "owner or admin only")
    _set_cr_cookie(response, s["raw"])
    await cr_session.audit(s["email"], audit_ip, "login", result="ok")
    return {
        "ok": True,
        "email": s["email"],
        "role": s["role"],
        "csrf": s["csrf"],
        "caps": sorted(cr_session.ROLE_CAPS.get(s["role"], [])),
    }


@router.get("/api/crm/me")
async def api_cr_me(ctx: dict = Depends(require_cr_session)):
    """Who am I + my CSRF token + capabilities (the SPA calls this on load to gate the UI)."""
    return {
        "ok": True,
        "email": ctx["actor_email"],
        "role": ctx["role"],
        "csrf": ctx["csrf"],
        "caps": sorted(cr_session.ROLE_CAPS.get(ctx["role"], [])),
    }


@router.post("/api/crm/logout")
async def api_cr_logout(request: Request, response: Response):
    """Revoke this session (CSRF-checked so a forced-logout CSRF can't weaponise it) + clear the cookie."""
    raw = request.cookies.get(CR_COOKIE, "")
    if raw:
        ctx = await cr_session.verify(raw, rotate=False)
        if ctx and cr_session.check_csrf(ctx, request.headers.get("x-csrf-token")):
            await cr_session.revoke(raw)
            await cr_session.audit(ctx["actor_email"], _client_ip(request), "logout", result="ok")
    _clear_cr_cookie(response)
    return {"ok": True}


def install(application: FastAPI) -> None:
    application.add_exception_handler(CRAuthError, _cr_auth_handler)
    application.include_router(router)
