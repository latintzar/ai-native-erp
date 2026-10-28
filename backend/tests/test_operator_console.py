"""Real HTTP, sessions and Postgres proofs for the internal operator boundary."""

from __future__ import annotations

import asyncio
from pathlib import Path
from types import SimpleNamespace
from urllib.parse import parse_qs, urlsplit
from uuid import uuid4

import httpx
import pytest
from fastapi import FastAPI
from fastapi.responses import JSONResponse

import db
import operator_access
import operator_api
import operator_login
import operator_service as service
import sup_api
import sup_session


async def scenario(case: str) -> None:
    await db.init()
    pool = db.get_pool()
    slug = "operator-test-" + uuid4().hex[:12]
    other = slug + "-other"
    email = slug + "@example.invalid"
    operator = "op-" + slug
    actor = service.Actor(email, "test", "development")
    async with pool.acquire() as con:
        if not await con.fetchval("select to_regclass('operator_access')"):
            await con.execute((Path(__file__).parents[1] / "operator_schema.sql").read_text())
        await con.execute(
            "insert into tenants(slug,name,status) values($1,'Original','test'),($2,'Other','test')",
            slug,
            other,
        )
        await con.execute(
            "insert into operators(id,email,name,is_founder) values($1,$2,$3,true)",
            operator,
            email,
            "Support tester",
        )
        await con.execute(
            "insert into team_members(operator_id,tenant_slug,role) values($1,$2,'owner')", operator, slug
        )
    minted = await sup_session.mint(email, slug, "founder", "127.0.0.1", "operator-test")
    cookie = minted["raw"]
    actor = service.Actor(email, minted["session_id"], "development")
    app = FastAPI()
    app.include_router(operator_api.create_router("development"))
    app.include_router(sup_api.router)

    @app.exception_handler(sup_api.SupApiError)
    async def customer_error(request, exc):
        return JSONResponse({"error": exc.error}, status_code=exc.status)

    async def grant(capability, environment="development", tenant=slug):
        async with pool.acquire() as con:
            await con.execute(
                "insert into operator_access(operator_id,environment,tenant_slug,capability,granted_by,"
                "reason,expires_at) values($1,$2,$3,$4,'test','boundary proof',now()+interval '1 hour')",
                operator,
                environment,
                tenant,
                capability,
            )

    async def revision():
        async with pool.acquire() as con:
            return (await con.fetchval("select updated_at from tenants where slug=$1", slug)).isoformat()

    async def edit_body():
        return {"changes": {"name": "Updated"}, "revision": await revision(), "reason": "Support correction"}

    try:
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="https://test"
        ) as client:
            if case == "anonymous":
                for method, path in [
                    ("GET", "/session"),
                    ("GET", "/accounts"),
                    ("GET", "/accounts/" + slug),
                    ("GET", "/accounts/" + slug + "/audit"),
                    ("PATCH", "/accounts/" + slug),
                    ("POST", "/accounts/" + slug + "/sessions/revoke"),
                ]:
                    response = await client.request(method, "/api/operator" + path)
                    assert response.status_code == 401
                return
            client.cookies.set("sup_session", cookie)
            session = await client.get("/api/operator/session")
            assert session.status_code == 200 and session.headers["cache-control"] == "no-store"
            headers = {"X-Sup-CSRF": minted["csrf"], "Idempotency-Key": str(uuid4())}
            if case == "founder_denied":
                assert (await client.get("/api/operator/accounts")).json()["accounts"] == []
                assert (await client.get("/api/operator/accounts/" + slug)).status_code == 403
                assert (
                    await client.patch(
                        "/api/operator/accounts/" + slug, json=await edit_body(), headers=headers
                    )
                ).status_code == 403
                async with pool.acquire() as con:
                    assert (
                        await con.fetchval(
                            "select count(*) from operator_audit where tenant_slug=$1 and outcome='denied'",
                            slug,
                        )
                        == 2
                    )
            elif case == "environment":
                await grant("accounts.read", "staging")
                assert (await client.get("/api/operator/accounts/" + slug)).status_code == 403
            elif case == "bounded_reads":
                await grant("accounts.read")
                listing = (await client.get("/api/operator/accounts")).json()
                assert [a["slug"] for a in listing["accounts"]] == [slug]
                row = (await client.get("/api/operator/accounts/" + slug)).json()
                assert row["account"]["slug"] == slug and row["members"][0]["id"] == operator
                assert row["capabilities"] == ["accounts.read"]
                assert row["lifecycle"]["web_execution"] is False
                assert (await client.get("/api/operator/accounts/" + other)).status_code == 403
                assert (await client.get("/api/operator/accounts/" + slug + "/audit")).status_code == 403
                assert (
                    await client.patch(
                        "/api/operator/accounts/" + slug, json=await edit_body(), headers=headers
                    )
                ).status_code == 403
            elif case == "csrf":
                await grant("accounts.edit")
                response = await client.patch("/api/operator/accounts/" + slug, json=await edit_body())
                assert response.status_code == 403
            elif case == "replay":
                await grant("accounts.edit")
                body = await edit_body()
                first = await client.patch("/api/operator/accounts/" + slug, json=body, headers=headers)
                second = await client.patch("/api/operator/accounts/" + slug, json=body, headers=headers)
                assert first.status_code == second.status_code == 200
                assert first.json() == second.json()
                body["changes"]["name"] = "Changed payload"
                assert (
                    await client.patch("/api/operator/accounts/" + slug, json=body, headers=headers)
                ).status_code == 409
                async with pool.acquire() as con:
                    assert (
                        await con.fetchval("select count(*) from operator_request where tenant_slug=$1", slug)
                        == 1
                    )
                    assert (
                        await con.fetchval(
                            "select count(*) from operator_audit where tenant_slug=$1 and outcome='ok'", slug
                        )
                        == 1
                    )
            elif case == "concurrent_and_revision":
                await grant("accounts.edit")
                body = await edit_body()
                responses = await asyncio.gather(
                    *[
                        client.patch("/api/operator/accounts/" + slug, json=body, headers=headers)
                        for _ in range(3)
                    ]
                )
                assert all(r.status_code == 200 for r in responses)
                assert len({r.text for r in responses}) == 1
                headers["Idempotency-Key"] = str(uuid4())
                stale = await client.patch("/api/operator/accounts/" + slug, json=body, headers=headers)
                assert stale.status_code == 409 and stale.json()["error"] == "revision_conflict"
            elif case == "revocation":
                await grant("accounts.edit")
                async with pool.acquire() as con:
                    await con.execute(
                        "update operator_access set expires_at=now() where operator_id=$1", operator
                    )
                assert (
                    await client.patch(
                        "/api/operator/accounts/" + slug, json=await edit_body(), headers=headers
                    )
                ).status_code == 403
            elif case == "scoped_sessions":
                await grant("sessions.revoke")
                foreign = await sup_session.mint(email, other, "staff", "", "")
                result = await client.post(
                    "/api/operator/accounts/" + slug + "/sessions/revoke",
                    json={"operator_id": operator, "reason": "Lost device"},
                    headers=headers,
                )
                assert result.status_code == 200 and result.json()["revoked"] == 1
                assert await sup_session.verify(cookie) is None
                assert await sup_session.verify(foreign["raw"]) is not None
            elif case == "invalid_fields":
                await grant("accounts.edit")
                body = await edit_body()
                body["changes"] = {"status": "live", "wa_phone_number_id": "secret"}
                assert (
                    await client.patch("/api/operator/accounts/" + slug, json=body, headers=headers)
                ).status_code == 422
                async with pool.acquire() as con:
                    assert await con.fetchval("select status from tenants where slug=$1", slug) == "test"
            elif case == "invalid_target_type":
                await grant("sessions.revoke")
                response = await client.post(
                    "/api/operator/accounts/" + slug + "/sessions/revoke",
                    json={"operator_id": {"unexpected": "object"}, "reason": "Invalid target proof"},
                    headers=headers,
                )
                assert response.status_code == 422
                async with pool.acquire() as con:
                    row = await con.fetchrow(
                        "select target_id,outcome from operator_audit "
                        "where tenant_slug=$1 order by id desc limit 1",
                        slug,
                    )
                    assert row["target_id"] == slug and row["outcome"] == "invalid_operation"
            elif case == "audit_immutable":
                await grant("accounts.read")
                await grant("audit.read")
                await client.get("/api/operator/accounts/" + slug)
                rows = (await client.get("/api/operator/accounts/" + slug + "/audit")).json()["audit"]
                assert rows[0]["actor_email"] == email and rows[0]["action"] == "account.read"
                async with pool.acquire() as con:
                    with pytest.raises(Exception, match="append-only"):
                        await con.execute("delete from operator_audit where tenant_slug=$1", slug)
            elif case == "access_cli":
                args = SimpleNamespace(
                    environment="development",
                    email=email,
                    tenant=slug,
                    capability="accounts.read",
                    reason="Support assignment",
                    hours=8,
                    operation="grant",
                    apply=False,
                )
                assert (await operator_access.manage(args))["applied"] is False
                assert (await service.accounts(actor))["accounts"] == []
                args.environment = "staging"
                with pytest.raises(ValueError, match="environment mismatch"):
                    await operator_access.manage(args)
                args.environment = "development"
                args.apply = True
                assert (await operator_access.manage(args))["applied"] is True
                assert [a["slug"] for a in (await service.accounts(actor))["accounts"]] == [slug]
                args.operation = "revoke"
                assert (await operator_access.manage(args))["applied"] is True
                assert (await service.accounts(actor))["accounts"] == []
            elif case in {
                "oauth_success",
                "oauth_forged_identity",
                "oauth_state",
                "oauth_missing_config",
                "oauth_internal",
            }:
                saved = {
                    key: getattr(operator_login.config, key)
                    for key in ["SUPABASE_URL", "SUPABASE_ANON_KEY", "PUBLIC_BASE_URL"]
                }
                saved_url = operator_login.auth._AUTH_USER_URL
                original_client = httpx.AsyncClient
                calls = []
                try:
                    operator_login.config.PUBLIC_BASE_URL = "https://test"
                    operator_login.config.SUPABASE_URL = "https://identity.example.invalid"
                    operator_login.config.SUPABASE_ANON_KEY = "public-test-anon"
                    operator_login.auth._AUTH_USER_URL = "https://identity.example.invalid/auth/v1/user"
                    client.cookies.clear()
                    if case == "oauth_internal":
                        await grant("accounts.read")
                        async with pool.acquire() as con:
                            await con.execute("delete from team_members where operator_id=$1", operator)
                    if case == "oauth_missing_config":
                        operator_login.config.SUPABASE_ANON_KEY = ""
                        assert (await client.get("/api/operator/auth/config")).json()["configured"] is False
                        assert (await client.get("/api/operator/auth/login")).status_code == 503
                        return
                    login = await client.get("/api/operator/auth/login")
                    assert login.status_code == 303
                    query = parse_qs(urlsplit(login.headers["location"]).query)
                    assert query["code_challenge_method"] == ["s256"]
                    callback = query["redirect_to"][0]
                    assert "HttpOnly" in login.headers["set-cookie"]
                    assert "Secure" in login.headers["set-cookie"]

                    async def provider(request):
                        calls.append(request.url.path)
                        if request.url.path.endswith("/token"):
                            return httpx.Response(200, json={"access_token": "owned-access-token"})
                        assert request.headers["authorization"] == "Bearer owned-access-token"
                        own_email = "forged@example.invalid" if case == "oauth_forged_identity" else email
                        return httpx.Response(
                            200,
                            json={
                                "id": "synthetic-idp-id",
                                "email": email,
                                "identities": [
                                    {
                                        "provider": "google",
                                        "identity_data": {"email": own_email, "email_verified": True},
                                    }
                                ],
                            },
                        )

                    mock = httpx.MockTransport(provider)
                    httpx.AsyncClient = lambda *a, **kw: original_client(*a, transport=mock, **kw)
                    if case == "oauth_state":
                        callback = "https://test/api/operator/auth/callback?state=forged"
                    response = await client.get(callback + "&code=one-use-code")
                    if case == "oauth_state":
                        assert response.status_code == 400 and calls == []
                    elif case == "oauth_forged_identity":
                        assert response.status_code == 403
                        assert "sup_session=" not in response.headers.get("set-cookie", "")
                    else:
                        assert response.status_code == 303
                        assert response.headers["location"] == "https://test/operator.html"
                        assert "owned-access-token" not in response.text
                        assert "owned-access-token" not in response.headers["set-cookie"]
                        identity = await client.get("/api/operator/session")
                        assert identity.status_code == 200 and identity.json()["email"] == email
                        if case == "oauth_internal":
                            current = await sup_session.verify(client.cookies.get("sup_session"))
                            assert current is not None
                            assert current["tenant_slug"] == ""
                            assert not sup_session.can(current["role"], "read")
                            assert not sup_session.can(current["role"], "admin")
                            assert (await client.get("/api/operator/accounts/" + slug)).status_code == 200
                            for path in [
                                "/api/sup/orders",
                                "/api/sup/customers",
                                "/api/sup/company",
                                "/api/sup/session/me",
                            ]:
                                denied = await client.get(path)
                                assert denied.status_code == 403
                                assert denied.json()["error"] == "customer_scope_required"
                    if case != "oauth_state":
                        assert calls == ["/auth/v1/token", "/auth/v1/user"]
                finally:
                    httpx.AsyncClient = original_client
                    operator_login.auth._AUTH_USER_URL = saved_url
                    for key, value in saved.items():
                        setattr(operator_login.config, key, value)
            elif case == "audit_atomic":
                await grant("accounts.edit")
                original = service.audit

                async def fail(*args, **kwargs):
                    raise RuntimeError("audit storage unavailable")

                service.audit = fail
                try:
                    with pytest.raises(RuntimeError, match="audit storage"):
                        await service.mutate(actor, slug, "account.edit", await edit_body(), str(uuid4()))
                finally:
                    service.audit = original
                async with pool.acquire() as con:
                    assert await con.fetchval("select name from tenants where slug=$1", slug) == "Original"
                    assert (
                        await con.fetchval("select count(*) from operator_request where tenant_slug=$1", slug)
                        == 0
                    )
    finally:
        for candidate in {db._pool, db._rt_pool, db._ctrl_pool} - {None}:
            if candidate is not None:
                await candidate.close()
        db._pool = db._rt_pool = db._ctrl_pool = None


@pytest.mark.parametrize(
    "case",
    [
        "anonymous",
        "founder_denied",
        "environment",
        "bounded_reads",
        "csrf",
        "replay",
        "concurrent_and_revision",
        "revocation",
        "scoped_sessions",
        "invalid_fields",
        "invalid_target_type",
        "audit_immutable",
        "audit_atomic",
        "access_cli",
        "oauth_success",
        "oauth_forged_identity",
        "oauth_state",
        "oauth_missing_config",
        "oauth_internal",
    ],
)
def test_operator_boundary(case):
    asyncio.run(scenario(case))


def test_environment_is_explicit(monkeypatch):
    with pytest.raises(ValueError):
        operator_api.create_router("demo")
    with pytest.raises(ValueError):
        operator_api.create_router("production")
    with pytest.raises(ValueError):
        operator_api.create_router("staging")
    monkeypatch.setattr(operator_api.config, "IS_PROD", True)
    with pytest.raises(ValueError):
        operator_api.create_router("development")
