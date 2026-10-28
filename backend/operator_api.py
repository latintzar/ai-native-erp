"""Internal console HTTP boundary, mounted with the deployment's explicit environment."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse

import config
import operator_login
import operator_service as service
import sup_session


def create_router(environment: str) -> APIRouter:
    """Configure once at application composition; incoming requests cannot select environment."""
    if environment not in {"development", "staging", "production"}:
        raise ValueError("operator environment must be explicit")
    expected = getattr(config, "ENVIRONMENT", "production" if config.IS_PROD else "development")
    if environment != expected or (environment == "production") != config.IS_PROD:
        raise ValueError("production operator environment mismatch")
    router = APIRouter(prefix="/api/operator", tags=["operator"])

    async def authenticated(request: Request, response: Response) -> service.Actor:
        ctx = await sup_session.verify(request.cookies.get("sup_session", ""), rotate=False)
        if not ctx:
            raise HTTPException(401, "session_required")
        actor = service.Actor(ctx["actor_email"].strip().lower(), ctx["session_id"], environment)
        response.headers["Cache-Control"] = "no-store"
        if request.method not in {"GET", "HEAD", "OPTIONS"} and not sup_session.check_csrf(
            ctx, request.headers.get("x-sup-csrf")
        ):
            async with service.db.get_pool().acquire() as con:
                await service.audit(con, actor, "", "request.csrf", "", "denied", "")
            raise HTTPException(403, "csrf_required")
        if not sup_session.rate_ok("operator:" + actor.email, 120, 60):
            raise HTTPException(429, "request_limit")
        return actor

    @router.get("/session")
    async def session(request: Request, actor: service.Actor = Depends(authenticated)):
        ctx = await sup_session.verify(request.cookies.get("sup_session", ""), rotate=False)
        if not ctx:
            raise HTTPException(401, "session_required")
        return {"email": actor.email, "environment": environment, "csrf": ctx["csrf"]}

    @router.get("/accounts")
    async def accounts(
        after: str = Query("", max_length=120),
        limit: int = Query(50, ge=1, le=100),
        actor: service.Actor = Depends(authenticated),
    ):
        return await service.accounts(actor, after, limit)

    @router.get("/accounts/{tenant}")
    async def account(tenant: str, actor: service.Actor = Depends(authenticated)):
        status, body = await service.read_account(actor, tenant)
        return JSONResponse(jsonable_encoder(body), status_code=status, headers={"Cache-Control": "no-store"})

    @router.get("/accounts/{tenant}/audit")
    async def audit(
        tenant: str,
        before: int = Query(9223372036854775807, ge=1),
        actor: service.Actor = Depends(authenticated),
    ):
        status, body = await service.read_account(actor, tenant, audit_log=True, before=before)
        return JSONResponse(jsonable_encoder(body), status_code=status, headers={"Cache-Control": "no-store"})

    async def write(request: Request, actor: service.Actor, tenant: str, action: str):
        # Bound before parsing, including chunked bodies; neither headers nor JSON control the target.
        raw = bytearray()
        async for chunk in request.stream():
            raw.extend(chunk)
            if len(raw) > 8192:
                raise HTTPException(413, "request_too_large")
        import json

        try:
            body = json.loads(raw)
        except (ValueError, UnicodeError) as exc:
            raise HTTPException(422, "invalid_json") from exc
        if not isinstance(body, dict):
            raise HTTPException(422, "object_required")
        status, result = await service.mutate(
            actor, tenant, action, body, request.headers.get("idempotency-key", "")
        )
        return JSONResponse(
            jsonable_encoder(result), status_code=status, headers={"Cache-Control": "no-store"}
        )

    @router.patch("/accounts/{tenant}")
    async def edit(tenant: str, request: Request, actor: service.Actor = Depends(authenticated)):
        return await write(request, actor, tenant, "account.edit")

    @router.post("/accounts/{tenant}/sessions/revoke")
    async def revoke(tenant: str, request: Request, actor: service.Actor = Depends(authenticated)):
        return await write(request, actor, tenant, "sessions.revoke")

    router.include_router(operator_login.create_router(environment))
    return router
