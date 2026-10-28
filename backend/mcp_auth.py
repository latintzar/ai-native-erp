"""§17.48c — THE MCP AUTHORISATION SERVER. OAuth 2.1, exactly the slice the contract needs.

The acceptance sentence this file exists for: a user pastes ONE url into Claude Code / Codex /
claude.ai, the client asks them to authenticate, they land on OUR authorise screen, approve,
and the tools appear. Nothing hand-registered, no key pasted into a config file.

What is deliberately IN: dynamic client registration (RFC 7591, public clients, no secret —
the piece that makes paste-one-url work at all) · authorization code + PKCE S256 mandatory ·
the `resource` binding (RFC 8707) · rotating refresh tokens · opaque tokens hashed at rest ·
revocation. What is deliberately OUT: implicit, password grant, client secrets, JWTs (an
opaque row can be revoked NOW; a signed token cannot be recalled).

The caps on a token are the INTERSECTION of the requested scopes with the granting user's own
membership (§17.34) — enforced HERE, not by the consent screen. A Repartidor cannot mint an
admin token by editing a query string.
"""
from __future__ import annotations

import base64
import hashlib
import json
import logging
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from urllib.parse import urlencode, urlparse

import db
import sup_session

log = logging.getLogger("rocoto.mcp_auth")

# ONE url for everyone (§17.48c) — overridable per box so the dev loop can test itself
RESOURCE_URL = os.environ.get("ROCOTO_MCP_RESOURCE", "https://api.soyrocoto.com/mcp")
AS_BASE = os.environ.get("ROCOTO_MCP_AS_BASE", "https://app.soyrocoto.com")

# scopes ↔ the §17.34 caps — the SAME three the panel session carries (one authorisation table)
SCOPES = {
    "rocoto.read": ("read", "leer el día: pedidos, chats, clientes, catálogo"),
    "rocoto.act": ("act", "actuar en el día: borradores de cambios, reclamar, ensayo"),
    "rocoto.admin": ("admin", "los ajustes: comportamiento, envíos, documentos, módulos"),
}
CODE_TTL_S = 300
ACCESS_TTL_S = 3600           # ≤1h, the spec's ceiling
REGISTRATION_IDLE_DAYS = 30   # unused registrations expire


def _h(v: str) -> str:
    return hashlib.sha256(v.encode()).hexdigest()


def _b64url_sha256(verifier: str) -> str:
    return base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()


def metadata_protected_resource() -> dict:
    """RFC 9728 — what hangs off the 401's resource_metadata pointer."""
    return {
        "resource": RESOURCE_URL,
        "authorization_servers": [AS_BASE],
        "scopes_supported": sorted(SCOPES),
        "bearer_methods_supported": ["header"],
    }


def metadata_authorization_server() -> dict:
    """RFC 8414 — the AS document the client walks to next."""
    return {
        "issuer": AS_BASE,
        "authorization_endpoint": f"{AS_BASE}/oauth/authorize",
        "token_endpoint": f"{AS_BASE}/oauth/token",
        "registration_endpoint": f"{AS_BASE}/oauth/register",
        "revocation_endpoint": f"{AS_BASE}/oauth/revoke",
        "response_types_supported": ["code"],
        "grant_types_supported": ["authorization_code", "refresh_token"],
        "code_challenge_methods_supported": ["S256"],
        "token_endpoint_auth_methods_supported": ["none"],
        "scopes_supported": sorted(SCOPES),
    }


# ── RFC 7591 · dynamic client registration ───────────────────────────────────────────────────
async def register_client(payload: dict, ip: str) -> dict:
    if not sup_session.rate_ok(f"mcpreg:{ip}", limit=10, window_s=3600):
        raise PermissionError("rate_limited")
    uris = [str(u) for u in (payload.get("redirect_uris") or []) if isinstance(u, str)]
    # loopback and https only — an http:// non-loopback redirect is a token exfil vector
    for u in uris:
        p = urlparse(u)
        if p.scheme == "https":
            continue
        if p.scheme == "http" and p.hostname in ("127.0.0.1", "localhost", "::1"):
            continue
        raise ValueError(f"redirect_uri must be https or loopback: {u}")
    if not uris:
        raise ValueError("redirect_uris required")
    client_id = f"mcp_{secrets.token_urlsafe(18)}"
    name = str(payload.get("client_name") or "")[:120]
    async with db.get_pool().acquire() as con:
        await con.execute(
            "insert into mcp_client(client_id, client_name, redirect_uris, created_ip) "
            "values($1,$2,$3,$4)", client_id, name, json.dumps(uris), ip)
        # housekeeping: registrations never used in REGISTRATION_IDLE_DAYS expire
        await con.execute(
            "delete from mcp_client where last_used_at is null "
            "and created_at < now() - make_interval(days => $1)", REGISTRATION_IDLE_DAYS)
    return {
        "client_id": client_id,
        "client_name": name,
        "redirect_uris": uris,
        "token_endpoint_auth_method": "none",
        "grant_types": ["authorization_code", "refresh_token"],
        "response_types": ["code"],
    }


# ── the authorize → consent → code leg ───────────────────────────────────────────────────────
async def validate_authorize(client_id: str, redirect_uri: str, code_challenge: str,
                             method: str, scope: str, resource: str) -> dict:
    """Everything the consent screen needs verified BEFORE it renders — exact-match redirect,
    S256 only, known scopes. Raises ValueError with an operator-safe reason."""
    async with db.get_pool().acquire() as con:
        c = await con.fetchrow("select client_id, client_name, redirect_uris from mcp_client "
                               "where client_id = $1", client_id)
    if not c:
        raise ValueError("client_desconocido")
    uris = c["redirect_uris"]
    if isinstance(uris, str):
        uris = json.loads(uris or "[]")
    if redirect_uri not in uris:
        raise ValueError("redirect_uri_no_registrada")
    if method != "S256" or not code_challenge:
        raise ValueError("pkce_s256_obligatorio")
    asked = [s for s in (scope or "").split() if s]
    if not asked:
        asked = ["rocoto.read"]
    unknown = [s for s in asked if s not in SCOPES]
    if unknown:
        raise ValueError("scope_desconocido")
    return {"client_id": c["client_id"],
            "client_name": c["client_name"] or "un agente sin nombre",
            "scopes": asked, "resource": resource or ""}


async def issue_code(client_id: str, redirect_uri: str, code_challenge: str, scope: str,
                     resource: str, state: str, user_email: str, tenant_slug: str,
                     user_caps: list[str]) -> str:
    """Consent approved → the redirect URL with the one-shot code. The caps stored on the code
    are ALREADY the intersection — the token leg never widens."""
    asked = [s for s in (scope or "").split() if s] or ["rocoto.read"]
    granted_caps = sorted({SCOPES[s][0] for s in asked if s in SCOPES} & set(user_caps))
    if not granted_caps:
        raise PermissionError("tu asiento no tiene ninguno de esos permisos")
    code = secrets.token_urlsafe(32)
    async with db.get_pool().acquire() as con:
        await con.execute(
            "insert into mcp_code(code, client_id, redirect_uri, code_challenge, resource, "
            "scope, user_email, tenant_slug, caps) values($1,$2,$3,$4,$5,$6,$7,$8,$9)",
            code, client_id, redirect_uri, code_challenge, resource,
            " ".join(asked), user_email, tenant_slug, json.dumps(granted_caps))
        await con.execute("update mcp_client set last_used_at = now() where client_id = $1",
                          client_id)
    sep = "&" if "?" in redirect_uri else "?"
    return f"{redirect_uri}{sep}" + urlencode({"code": code, "state": state or ""})


# ── the token leg ────────────────────────────────────────────────────────────────────────────
def _wire_token(access: str, refresh: str, row: dict) -> dict:
    return {"access_token": access, "token_type": "Bearer", "expires_in": ACCESS_TTL_S,
            "refresh_token": refresh, "scope": row.get("scope") or ""}


async def exchange_code(client_id: str, code: str, verifier: str, redirect_uri: str,
                        resource: str) -> dict:
    async with db.get_pool().acquire() as con:
        r = await con.fetchrow("select * from mcp_code where code = $1", code)
        if (not r or r["client_id"] != client_id or r["used_at"] is not None
                or r["redirect_uri"] != redirect_uri
                or r["created_at"] < datetime.now(timezone.utc) - timedelta(seconds=CODE_TTL_S)):
            raise PermissionError("invalid_grant")
        if _b64url_sha256(verifier or "") != r["code_challenge"]:
            raise PermissionError("invalid_grant")
        # RFC 8707: the token is bound to OUR resource; a mismatched audience never mints
        if (r["resource"] or resource) and (resource or r["resource"]) not in ("", RESOURCE_URL):
            raise PermissionError("invalid_target")
        await con.execute("update mcp_code set used_at = now() where code = $1", code)
        access = secrets.token_urlsafe(32)
        refresh = secrets.token_urlsafe(32)
        caps = r["caps"]
        if isinstance(caps, str):
            caps = json.loads(caps or "[]")
        await con.execute(
            "insert into mcp_token(access_hash, refresh_hash, client_id, client_name, "
            "user_email, tenant_slug, caps, scope, resource, access_expires) "
            "select $1,$2,$3,coalesce(c.client_name,''),$4,$5,$6,$7,$8, now() + make_interval(secs => $9) "
            "from (select 1) x left join mcp_client c on c.client_id = $3",
            _h(access), _h(refresh), client_id, r["user_email"], r["tenant_slug"],
            json.dumps(caps), r["scope"], r["resource"] or RESOURCE_URL, ACCESS_TTL_S)
    return _wire_token(access, refresh, {"scope": r["scope"]})


async def refresh_token(client_id: str, refresh: str) -> dict:
    """Rotation: the presented refresh dies, a new pair mints — a replayed old refresh after
    rotation means theft, and the row is revoked outright (OAuth 2.1's reuse rule)."""
    async with db.get_pool().acquire() as con:
        r = await con.fetchrow(
            "select * from mcp_token where refresh_hash = $1 and revoked_at is null", _h(refresh))
        if not r or r["client_id"] != client_id:
            # reuse of a rotated refresh? kill the family it belonged to
            await con.execute(
                "update mcp_token set revoked_at = now() where refresh_hash = $1", _h(refresh))
            raise PermissionError("invalid_grant")
        access = secrets.token_urlsafe(32)
        new_refresh = secrets.token_urlsafe(32)
        await con.execute(
            "update mcp_token set access_hash = $2, refresh_hash = $3, "
            "access_expires = now() + make_interval(secs => $4), last_used_at = now() "
            "where id = $1", r["id"], _h(access), _h(new_refresh), ACCESS_TTL_S)
    return _wire_token(access, new_refresh, dict(r))


async def revoke(token: str) -> None:
    """RFC 7009 shape: revoking either half kills the pair. Always 200 — a revocation endpoint
    must not be an oracle for token validity."""
    async with db.get_pool().acquire() as con:
        await con.execute(
            "update mcp_token set revoked_at = now() "
            "where access_hash = $1 or refresh_hash = $1", _h(token))


async def verify_bearer(token: str) -> Optional[dict]:
    """The MCP endpoint's gate: the opaque access token → {token_id, tenant, email, caps} or None."""
    if not token:
        return None
    async with db.get_pool().acquire() as con:
        r = await con.fetchrow(
            "select id, user_email, tenant_slug, caps, client_name from mcp_token "
            "where access_hash = $1 and revoked_at is null and access_expires > now()", _h(token))
        if not r:
            return None
        await con.execute("update mcp_token set last_used_at = now() where id = $1", r["id"])
    caps = r["caps"]
    if isinstance(caps, str):
        caps = json.loads(caps or "[]")
    return {"token_id": int(r["id"]), "email": r["user_email"],
            "tenant_slug": r["tenant_slug"], "caps": list(caps),
            "client_name": r["client_name"] or ""}


# ── the Accesos surface's reads ──────────────────────────────────────────────────────────────
async def connectors_for(tenant: str) -> list[dict]:
    async with db.get_pool().acquire() as con:
        rows = await con.fetch(
            "select id, client_name, user_email, scope, created_at, last_used_at "
            "from mcp_token where tenant_slug = $1 and revoked_at is null "
            "order by created_at desc", tenant)
    return [{"id": int(r["id"]), "client_name": r["client_name"] or "agente sin nombre",
             "user_email": r["user_email"], "scope": r["scope"],
             "created_at": r["created_at"].isoformat(),
             "last_used_at": r["last_used_at"].isoformat() if r["last_used_at"] else None}
            for r in rows]


async def revoke_id(tenant: str, token_id: int) -> bool:
    async with db.get_pool().acquire() as con:
        n = await con.execute(
            "update mcp_token set revoked_at = now() "
            "where id = $2 and tenant_slug = $1 and revoked_at is null", tenant, token_id)
    return n.endswith("1")


async def audit(token_id: Optional[int], tenant: str, verb: str, args: dict, outcome: str) -> None:
    """Append-only, write-ahead where it matters (the caller invokes BEFORE external effects)."""
    try:
        async with db.get_pool().acquire() as con:
            await con.execute(
                "insert into mcp_audit(token_id, tenant_slug, verb, args_hash, outcome) "
                "values($1,$2,$3,$4,$5)",
                token_id, tenant, verb,
                _h(json.dumps(args, sort_keys=True, ensure_ascii=False, default=str)), outcome)
    except Exception:
        log.exception("mcp audit write failed")
