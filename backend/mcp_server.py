"""§17.48c — THE MCP ENDPOINT: Streamable HTTP, tools = the §17.48b registry ∩ the token's caps.

One router carries the whole outward face:
  POST /mcp        client→server JSON-RPC (initialize · tools/list · tools/call · ping)
  GET  /mcp        the server→client stream (SSE; held open, heartbeats)
  DELETE /mcp      end the session
  GET  /.well-known/oauth-protected-resource          (RFC 9728)
  GET  /.well-known/oauth-authorization-server        (RFC 8414 — also served here so the
                                                       api host answers it; app.soyrocoto.com
                                                       rewrites both well-knowns to us)
  POST /oauth/register · /oauth/token · /oauth/revoke (the AS's machine legs)
  GET/POST /api/sup/oauth/consent                     (the consent screen's wire — cookie-auth,
                                                       inside the panel session)

The structural walls, in code not prose:
  · An unauthenticated /mcp call gets the 401 + WWW-Authenticate resource_metadata pointer —
    that header IS the paste-one-url flow.
  · tools/list is the registry filtered by caps: a read-only token cannot SEE write verbs.
  · A write verb stages a config_draft and returns the draft object — never a silent mutation.
    The panel's copilot column is where drafts get decided (the §17.48b discipline).
  · Every call writes an append-only mcp_audit row BEFORE its effect.
  · The customer-facing mind cannot reach any of this: its tool list is agent_reply's, and no
    runtime credential can mint an MCP token (the only mint path walks OUR consent screen).
"""
from __future__ import annotations

import asyncio
import json
import logging
import uuid
from typing import Any, Optional

from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import JSONResponse, StreamingResponse

import mcp_auth
import sup_session
import sup_verbs

log = logging.getLogger("rocoto.mcp")

router = APIRouter()

PROTOCOL_VERSION = "2025-03-26"
SERVER_INFO = {"name": "rocoto", "version": "1.0.0"}


def _rpc_error(id_: Any, code: int, message: str) -> dict:
    return {"jsonrpc": "2.0", "id": id_, "error": {"code": code, "message": message}}


def _rpc_result(id_: Any, result: dict) -> dict:
    return {"jsonrpc": "2.0", "id": id_, "result": result}


def _www_authenticate() -> dict:
    meta = mcp_auth.RESOURCE_URL.rsplit("/mcp", 1)[0] + "/.well-known/oauth-protected-resource"
    return {"WWW-Authenticate": f'Bearer resource_metadata="{meta}"'}


async def _bearer(request: Request) -> Optional[dict]:
    h = request.headers.get("authorization") or ""
    if not h.lower().startswith("bearer "):
        return None
    return await mcp_auth.verify_bearer(h[7:].strip())


# ── discovery ────────────────────────────────────────────────────────────────────────────────
@router.get("/.well-known/oauth-protected-resource")
async def well_known_resource():
    return mcp_auth.metadata_protected_resource()


@router.get("/.well-known/oauth-authorization-server")
async def well_known_as():
    return mcp_auth.metadata_authorization_server()


# ── the AS's machine legs ────────────────────────────────────────────────────────────────────
@router.post("/oauth/register")
async def oauth_register(request: Request):
    try:
        payload = await request.json()
    except Exception:
        payload = {}
    try:
        out = await mcp_auth.register_client(payload or {}, request.client.host if request.client else "")
    except PermissionError:
        return JSONResponse({"error": "rate_limited"}, status_code=429)
    except ValueError as e:
        return JSONResponse({"error": "invalid_client_metadata", "error_description": str(e)},
                            status_code=400)
    return JSONResponse(out, status_code=201)


@router.post("/oauth/token")
async def oauth_token(request: Request):
    form = await request.form()
    grant = str(form.get("grant_type") or "")
    client_id = str(form.get("client_id") or "")
    try:
        if grant == "authorization_code":
            out = await mcp_auth.exchange_code(
                client_id, str(form.get("code") or ""), str(form.get("code_verifier") or ""),
                str(form.get("redirect_uri") or ""), str(form.get("resource") or ""))
        elif grant == "refresh_token":
            out = await mcp_auth.refresh_token(client_id, str(form.get("refresh_token") or ""))
        else:
            return JSONResponse({"error": "unsupported_grant_type"}, status_code=400)
    except PermissionError as e:
        return JSONResponse({"error": str(e) or "invalid_grant"}, status_code=400)
    return JSONResponse(out, headers={"Cache-Control": "no-store"})


@router.post("/oauth/revoke")
async def oauth_revoke(request: Request):
    form = await request.form()
    await mcp_auth.revoke(str(form.get("token") or ""))
    return Response(status_code=200)


# ── the consent screen's wire (cookie-auth: the panel session IS the identity) ───────────────
def wire_consent(require_sup):
    """The consent + accesos endpoints, bound at include time to sup_api's own session
    dependency — a consent is exactly as authenticated as the panel («the §17.41 door first»
    is the SPA's redirect when there is no session)."""

    @router.get("/api/sup/oauth/consent")
    async def consent_read(client_id: str = "", redirect_uri: str = "",
                           code_challenge: str = "", code_challenge_method: str = "",
                           scope: str = "", resource: str = "",
                           ctx: dict = Depends(require_sup)):
        try:
            v = await mcp_auth.validate_authorize(client_id, redirect_uri, code_challenge,
                                                  code_challenge_method, scope, resource)
        except ValueError as e:
            return JSONResponse({"error": str(e)}, status_code=400)
        caps = sorted(sup_session.ROLE_CAPS.get(ctx["role"], frozenset()))
        scopes = [{"scope": s, "sentence": mcp_auth.SCOPES[s][1],
                   "grantable": mcp_auth.SCOPES[s][0] in caps}
                  for s in v["scopes"]]
        return {"client_name": v["client_name"], "scopes": scopes,
                "tenant_slug": ctx["tenant_slug"], "email": ctx["actor_email"]}

    @router.post("/api/sup/oauth/consent")
    async def consent_approve(payload: dict, ctx: dict = Depends(require_sup)):
        p = payload or {}
        caps = sorted(sup_session.ROLE_CAPS.get(ctx["role"], frozenset()))
        try:
            await mcp_auth.validate_authorize(
                str(p.get("client_id") or ""), str(p.get("redirect_uri") or ""),
                str(p.get("code_challenge") or ""), str(p.get("code_challenge_method") or ""),
                str(p.get("scope") or ""), str(p.get("resource") or ""))
            url = await mcp_auth.issue_code(
                str(p.get("client_id") or ""), str(p.get("redirect_uri") or ""),
                str(p.get("code_challenge") or ""), str(p.get("scope") or ""),
                str(p.get("resource") or ""), str(p.get("state") or ""),
                ctx["actor_email"], ctx["tenant_slug"], caps)
        except (ValueError, PermissionError) as e:
            return JSONResponse({"error": str(e)}, status_code=400)
        await sup_session.audit(ctx["actor_email"], ctx["tenant_slug"], "", "mcp.consent",
                                target_id=str(p.get("client_id") or "")[:40],
                                detail={"scope": p.get("scope")})
        return {"redirect": url}

    @router.get("/api/sup/accesos")
    async def accesos_list(ctx: dict = Depends(require_sup)):
        return {"connectors": await mcp_auth.connectors_for(ctx["tenant_slug"])}

    @router.post("/api/sup/accesos/{token_id}/revoke")
    async def accesos_revoke(token_id: int, ctx: dict = Depends(require_sup)):
        ok = await mcp_auth.revoke_id(ctx["tenant_slug"], int(token_id))
        await sup_session.audit(ctx["actor_email"], ctx["tenant_slug"], "", "mcp.revoke",
                                target_id=str(token_id), detail={"ok": ok})
        return {"ok": ok}


# ── the MCP endpoint ─────────────────────────────────────────────────────────────────────────
def _tools_for(caps: list[str]) -> list[dict]:
    """The registry ∩ caps. A read-only token literally cannot see the write verbs."""
    out = []
    for name, v in sup_verbs.REGISTRY.items():
        need = "read" if v["kind"] == "read" else v["cap"]
        # the split caps map onto the coarse three the tokens carry (§17.34's own collapse)
        coarse = {"admin:rocoto": "admin", "admin:negocio": "admin", "admin": "admin",
                  "read": "read", "act": "act", "golive": "admin"}.get(need, "admin")
        if coarse not in caps and need not in caps:
            continue
        schema = dict(v["schema"])
        schema.setdefault("additionalProperties", False)
        desc = v["desc"] + ("" if v["kind"] == "read" else
                            " CAMBIO: queda como BORRADOR — nada se aplica hasta que el "
                            "operador lo acepta en el panel.")
        out.append({"name": name, "description": desc, "inputSchema": schema})
    return out


async def _call_tool(auth: dict, name: str, args: dict) -> dict:
    verb = sup_verbs.REGISTRY.get(name)
    tenant = auth["tenant_slug"]
    if not verb:
        await mcp_auth.audit(auth["token_id"], tenant, name, args, "error:unknown_tool")
        return {"content": [{"type": "text", "text": "Ese verbo no existe."}], "isError": True}
    need = "read" if verb["kind"] == "read" else verb["cap"]
    coarse = {"admin:rocoto": "admin", "admin:negocio": "admin", "admin": "admin",
              "read": "read", "act": "act", "golive": "admin"}.get(need, "admin")
    if coarse not in auth["caps"] and need not in auth["caps"]:
        await mcp_auth.audit(auth["token_id"], tenant, name, args, "error:cap")
        return {"content": [{"type": "text", "text": "Tu token no tiene ese permiso."}],
                "isError": True}
    # write-ahead audit — the row exists before any effect (the cr_control discipline)
    await mcp_auth.audit(auth["token_id"], tenant, name, args, "called")
    try:
        if verb["kind"] == "read":
            r = await verb["read"](tenant, args)
            await mcp_auth.audit(auth["token_id"], tenant, name, args, "ok")
            return {"content": [{"type": "text",
                                 "text": json.dumps(r, ensure_ascii=False, default=str)}]}
        d = await sup_verbs.stage_draft(tenant, name, args,
                                       f"mcp:{auth['client_name'] or auth['email']}")
        await mcp_auth.audit(auth["token_id"], tenant, name, args, f"draft:{d['id']}")
        return {"content": [{"type": "text", "text": json.dumps({
            "draft_id": d["id"], "summary": d["summary"],
            "estado": "borrador — nada cambia hasta que el operador lo acepte en el panel",
            "se_decide_en": "app.soyrocoto.com (el copiloto enseña los borradores pendientes)",
        }, ensure_ascii=False)}]}
    except Exception as e:  # noqa: BLE001 — a tool error is a result, never a 500
        log.exception("mcp tool %s failed", name)
        await mcp_auth.audit(auth["token_id"], tenant, name, args, "error:exception")
        return {"content": [{"type": "text", "text": f"No se ha podido: {e}"}], "isError": True}


@router.post("/mcp")
async def mcp_post(request: Request):
    auth = await _bearer(request)
    if not auth:
        return JSONResponse({"error": "unauthorized"}, status_code=401,
                            headers=_www_authenticate())
    try:
        body = await request.json()
    except Exception:
        return JSONResponse(_rpc_error(None, -32700, "parse error"), status_code=400)
    msgs = body if isinstance(body, list) else [body]
    out = []
    session_id = request.headers.get("mcp-session-id") or f"mcps_{uuid.uuid4().hex[:16]}"
    for m in msgs:
        mid = m.get("id")
        method = str(m.get("method") or "")
        params = m.get("params") or {}
        if method == "initialize":
            out.append(_rpc_result(mid, {
                "protocolVersion": params.get("protocolVersion") or PROTOCOL_VERSION,
                "capabilities": {"tools": {"listChanged": False}},
                "serverInfo": SERVER_INFO,
                "instructions": ("Rocoto — el panel de tu distribuidora, por MCP. Los verbos de "
                                 "cambio dejan BORRADORES que el operador acepta en el panel."),
            }))
        elif method in ("notifications/initialized", "notifications/cancelled"):
            continue  # notifications get no response row
        elif method == "ping":
            out.append(_rpc_result(mid, {}))
        elif method == "tools/list":
            out.append(_rpc_result(mid, {"tools": _tools_for(auth["caps"])}))
        elif method == "tools/call":
            r = await _call_tool(auth, str(params.get("name") or ""),
                                 dict(params.get("arguments") or {}))
            out.append(_rpc_result(mid, r))
        else:
            if mid is not None:
                out.append(_rpc_error(mid, -32601, f"method not found: {method}"))
    if not out:
        return Response(status_code=202, headers={"Mcp-Session-Id": session_id})
    payload = out[0] if len(out) == 1 and not isinstance(body, list) else out
    return JSONResponse(payload, headers={"Mcp-Session-Id": session_id})


@router.get("/mcp")
async def mcp_stream(request: Request):
    auth = await _bearer(request)
    if not auth:
        return JSONResponse({"error": "unauthorized"}, status_code=401,
                            headers=_www_authenticate())

    async def gen():
        # the server→client stream: held open with heartbeats; server-initiated messages would
        # ride here (no verb streams progress yet — the shape is what the contract requires)
        yield ": rocoto mcp stream\n\n"
        try:
            while True:
                await asyncio.sleep(25)
                yield ": beat\n\n"
        except asyncio.CancelledError:
            return

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-store"})


@router.delete("/mcp")
async def mcp_end(request: Request):
    auth = await _bearer(request)
    if not auth:
        return JSONResponse({"error": "unauthorized"}, status_code=401,
                            headers=_www_authenticate())
    return Response(status_code=200)
