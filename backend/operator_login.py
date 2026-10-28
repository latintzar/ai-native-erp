"""Server-side Supabase Google PKCE exchange into the maintained sup_session identity flow.

Protocol: https://github.com/supabase/auth/blob/master/openapi.yaml (/authorize and /token).
The browser receives only host-only HTTP-only verifier/session cookies; provider tokens stay here.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
from urllib.parse import urlencode, urlsplit

import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse

import config
import db
import sup_session
from brain import auth

COOKIE = "__Host-operator-pkce"


def settings() -> tuple[str, str]:
    origin = config.PUBLIC_BASE_URL.rstrip("/")
    parsed = urlsplit(origin)
    supabase = config.SUPABASE_URL.rstrip("/")
    provider = urlsplit(supabase)
    if (
        parsed.scheme != "https"
        or not parsed.hostname
        or parsed.username
        or parsed.password
        or parsed.path
        or parsed.query
        or parsed.fragment
        or provider.scheme != "https"
        or not provider.hostname
        or provider.username
        or provider.password
        or provider.path
        or provider.query
        or provider.fragment
        or not config.SUPABASE_ANON_KEY
    ):
        raise ValueError("operator OAuth configuration required")
    return origin, supabase


def clear(response):
    response.delete_cookie(COOKIE, path="/", secure=True, httponly=True, samesite="lax")
    response.headers["Cache-Control"] = "no-store"
    response.headers["Referrer-Policy"] = "no-referrer"
    return response


def create_router(environment: str) -> APIRouter:
    router = APIRouter(prefix="/auth")

    @router.get("/config")
    async def configuration():
        try:
            settings()
            ready = True
        except ValueError:
            ready = False
        return JSONResponse(
            {"configured": ready, "login": "/api/operator/auth/login"}, headers={"Cache-Control": "no-store"}
        )

    @router.get("/login")
    async def login():
        try:
            origin, provider = settings()
        except ValueError as exc:
            raise HTTPException(503, "oauth_configuration_required") from exc
        if not sup_session.rate_ok("operator.oauth.start", 120, 60):
            raise HTTPException(429, "request_limit")
        verifier, nonce = secrets.token_urlsafe(48), secrets.token_urlsafe(32)
        challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip("=")
        callback = origin + "/api/operator/auth/callback?" + urlencode({"state": nonce})
        url = (
            provider
            + "/auth/v1/authorize?"
            + urlencode(
                {
                    "provider": "google",
                    "redirect_to": callback,
                    "code_challenge": challenge,
                    "code_challenge_method": "s256",
                }
            )
        )
        response = RedirectResponse(
            url,
            status_code=303,
            headers={
                "Cache-Control": "no-store",
                "Referrer-Policy": "no-referrer",
            },
        )
        response.set_cookie(
            COOKIE, nonce + "." + verifier, max_age=600, path="/", secure=True, httponly=True, samesite="lax"
        )
        return response

    @router.get("/callback")
    async def callback(request: Request):
        try:
            origin, provider = settings()
        except ValueError as exc:
            raise HTTPException(503, "oauth_configuration_required") from exc
        nonce, _, verifier = request.cookies.get(COOKIE, "").partition(".")
        state, code = request.query_params.get("state", ""), request.query_params.get("code", "")
        if (
            not nonce
            or not verifier
            or not hmac.compare_digest(nonce, state)
            or not 1 <= len(code) <= 4096
            or len(verifier) > 128
        ):
            return clear(JSONResponse({"error": "oauth_state_required"}, status_code=400))
        if not sup_session.rate_ok("operator.oauth.callback", 60, 60):
            return clear(JSONResponse({"error": "request_limit"}, status_code=429))
        try:
            async with httpx.AsyncClient(timeout=8, follow_redirects=False) as client:
                response = await client.post(
                    provider + "/auth/v1/token?grant_type=pkce",
                    headers={"apikey": config.SUPABASE_ANON_KEY},
                    json={"auth_code": code, "code_verifier": verifier},
                )
            if response.status_code != 200:
                return clear(JSONResponse({"error": "identity_exchange_failed"}, status_code=401))
            bearer = response.json().get("access_token")
            if not isinstance(bearer, str) or len(bearer) > 16384:
                return clear(JSONResponse({"error": "identity_exchange_failed"}, status_code=401))
            # The token endpoint is followed by the established independent user verification.
            user = await auth.verify_token(bearer)
        except (httpx.HTTPError, ValueError, TypeError):
            return clear(JSONResponse({"error": "identity_exchange_failed"}, status_code=401))
        if not user:
            return clear(JSONResponse({"error": "identity_verification_failed"}, status_code=401))
        peer = request.client.host if request.client else ""
        session = await sup_session.session_for_user(user, peer, request.headers.get("user-agent", ""))
        if session.get("error") == "forbidden" and auth.has_matching_oauth(user):
            # Internal personnel need no customer membership: use the same identity/session store
            # with an unknown customer role, which existing customer capability gates deny entirely.
            email = (user.get("email") or "").strip().lower()
            async with db.get_pool().acquire() as con:
                active = await con.fetchval(
                    "select 1 from operator_access a join operators o on o.id=a.operator_id "
                    "where lower(o.email)=$1 and a.environment=$2 and a.expires_at>now() limit 1",
                    email,
                    environment,
                )
            if active:
                session = {
                    "ok": True,
                    **await sup_session.mint(
                        email, "", "internal_operator", peer, request.headers.get("user-agent", "")
                    ),
                }
        if not session.get("ok"):
            await sup_session.audit(user.get("email", ""), "", peer, "operator.login", result="denied")
            return clear(JSONResponse({"error": "verified_membership_required"}, status_code=403))
        try:
            await sup_session.audit(
                session["email"], session["tenant_slug"], peer, "operator.login", result="ok"
            )
        except Exception:
            await sup_session.revoke(session["raw"])
            raise
        result = clear(RedirectResponse(origin + "/operator.html", status_code=303))
        result.set_cookie(
            "sup_session",
            session["raw"],
            max_age=session["ttl"],
            secure=True,
            httponly=True,
            samesite="lax",
            path="/",
        )
        return result

    return router
