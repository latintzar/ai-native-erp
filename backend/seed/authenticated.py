"""Owned development proof through the normal identity, HTTP and product-service boundaries.

The IdP is an explicit offline transport fixture; user verification and session issuance use the
maintained implementation. This proves the application integration, not external OAuth commissioning.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from uuid import uuid4

import httpx
from fastapi import FastAPI
from fastapi.responses import JSONResponse

import config
import db
import sup_api
import sup_session
from brain import auth
from testdata_adapter import Refusal, read_private


def _require(condition: bool) -> None:
    if not condition:
        raise Refusal("authenticated synthetic account proof failed")


async def exercise(owner: dict, scenario: dict) -> dict:
    from seed.testdata import verify_database

    if (
        config.IS_PROD
        or not config.EGRESS_SANDBOX
        or getattr(config, "ENVIRONMENT", "development") != "development"
    ):
        raise Refusal("offline identity proof requires owned development and captured effects")
    async with db.get_pool().acquire() as con:
        await verify_database(con, owner)
    tenant = owner["tenant_slug"]
    oid = tenant + ":order:" + scenario["orders"][0]["id"]
    email = scenario["account"]["operator_email"]
    bearer = "synthetic-idp-" + uuid4().hex
    app = FastAPI()
    app.include_router(sup_api.router)

    @app.exception_handler(sup_api.SupApiError)
    async def api_error(_request, exc):
        return JSONResponse({"error": exc.error}, status_code=exc.status)

    @app.exception_handler(sup_api.SupAuthError)
    async def auth_error(_request, _exc):
        return JSONResponse({"error": "session_required"}, status_code=401)

    original_client = httpx.AsyncClient
    original_url = auth._AUTH_USER_URL
    old_provider, old_key = config.SUPABASE_URL, config.SUPABASE_ANON_KEY
    verification_requests: list[str] = []
    session_raw = ""
    client = original_client(transport=httpx.ASGITransport(app=app), base_url="https://owned.example.invalid")

    async def identity(request):
        if request.url != "https://identity.example.invalid/auth/v1/user":
            raise Refusal("offline identity transport received an unexpected endpoint")
        verification_requests.append("user-verification")
        if request.headers.get("authorization") != "Bearer " + bearer:
            return httpx.Response(401, json={"error": "invalid_fixture_token"})
        return httpx.Response(
            200,
            json={
                "id": owner["run_id"],
                "email": email,
                "identities": [
                    {"provider": "google", "identity_data": {"email": email, "email_verified": True}}
                ],
            },
        )

    try:
        config.SUPABASE_URL = "https://identity.example.invalid"
        config.SUPABASE_ANON_KEY = "synthetic-public-anon-key"
        auth._AUTH_USER_URL = config.SUPABASE_URL + "/auth/v1/user"
        transport = httpx.MockTransport(identity)
        # Scoped to this disposable lifecycle subprocess; credentials and real egress were already
        # removed by the owning adapter before importing product code.
        httpx.AsyncClient = lambda *args, **kwargs: original_client(*args, transport=transport, **kwargs)
        _require((await client.get("/api/sup/orders/" + oid)).status_code == 401)
        invalid = await client.post("/api/sup/session/login", json={"access_token": "wrong-fixture-token"})
        _require(invalid.status_code == 401)
        signed_in = await client.post("/api/sup/session/login", json={"access_token": bearer})
        _require(signed_in.status_code == 200)
        identity_result = signed_in.json()
        _require(identity_result["tenant_slug"] == tenant and identity_result["email"] == email)
        session_raw = client.cookies.get("sup_session", "")
        _require(session_raw and "HttpOnly" in signed_in.headers["set-cookie"])
        _require("Secure" in signed_in.headers["set-cookie"])
        own = await client.get("/api/sup/orders/" + oid)
        _require(own.status_code == 200 and own.json()["tenant_id"] == tenant)
        rejected = await client.post("/api/sup/orders/" + oid + "/finish", json={"weighed_kg": 2.5})
        _require(rejected.status_code == 403)
        changed = await client.post(
            "/api/sup/orders/" + oid + "/finish",
            json={"weighed_kg": 2.5},
            headers={"X-Sup-CSRF": identity_result["csrf"]},
        )
        _require(changed.status_code == 200 and changed.json()["weighed_kg"] == 2.5)
        async with db.get_pool().acquire() as con:
            _require(
                await con.fetchval("select weighed_kg from orders where id=$1 and tenant_id=$2", oid, tenant)
                == 2.5
            )
            audited = await con.fetchval(
                "select count(*) from sup_audit where tenant_slug=$1 "
                "and actor_email=$2 and target_id=$3 and action='order.finish' and result='ok'",
                tenant,
                email,
                oid,
            )
            _require(audited > 0)
            # A real foreign row in this owned database, restored immediately after the denial proof.
            foreign_id = tenant + ":auth-foreign-proof"
            await con.execute(
                "insert into orders(id,tenant_id,phone_number,seeded) "
                "values($1,$2,'+12025550199',true) on conflict(id) do nothing",
                foreign_id,
                tenant + "_foreign",
            )
        try:
            _require((await client.get("/api/sup/orders/" + foreign_id)).status_code == 404)
            foreign_write = await client.post(
                "/api/sup/orders/" + foreign_id + "/finish",
                json={"weighed_kg": 99},
                headers={"X-Sup-CSRF": identity_result["csrf"]},
            )
            _require(foreign_write.status_code == 404)
            async with db.get_pool().acquire() as con:
                _require(await con.fetchval("select weighed_kg from orders where id=$1", foreign_id) is None)
        finally:
            async with db.get_pool().acquire() as con:
                await con.execute(
                    "delete from orders where id=$1 and tenant_id=$2 and seeded=true",
                    foreign_id,
                    tenant + "_foreign",
                )
        await sup_session.revoke(session_raw)
        _require((await client.get("/api/sup/orders/" + oid)).status_code == 401)
        _require(verification_requests == ["user-verification", "user-verification"])
        proof = {
            "mode": "offline-identity-provider",
            "normal_identity_verification": True,
            "normal_session_issuance": True,
            "csrf_rejected": True,
            "session_revocation": True,
            "tenant_read_write_boundary": True,
            "business_operation": "order.finish",
            "persisted_weight_kg": 2.5,
            "audit_recorded": True,
            "external_identity_provider": "uncommissioned",
            "external_calls": 0,
        }
        async with db.get_pool().acquire() as con:
            await verify_database(con, owner)
            await con.execute(
                "create table if not exists testdata_lifecycle.proof "
                "(kind text primary key,result jsonb not null)"
            )
            await con.execute(
                "insert into testdata_lifecycle.proof values('authentication',$1) "
                "on conflict(kind) do update set result=excluded.result",
                proof,
            )
        return proof
    finally:
        httpx.AsyncClient = original_client
        auth._AUTH_USER_URL = original_url
        config.SUPABASE_URL, config.SUPABASE_ANON_KEY = old_provider, old_key
        await client.aclose()
        if session_raw:
            await sup_session.revoke(session_raw)


async def register(owner: dict, scenario: dict, phase: str) -> None:
    """Attach the company run's safe source provenance to this verified owned product account."""
    from seed.testdata import verify_database

    record = read_private(Path(owner["state_dir"]) / "run.json")
    if record.get("run_id") != owner["run_id"] or not isinstance(record.get("source_hashes"), dict):
        raise Refusal("company run provenance is required to register a synthetic receipt")
    digest = hashlib.sha256(json.dumps(record["source_hashes"], sort_keys=True).encode()).hexdigest()
    async with db.get_pool().acquire() as con, con.transaction():
        await verify_database(con, owner)
        await con.execute(
            "insert into operator_synthetic_run(run_id,tenant_slug,environment,scenario_id,"
            "source_sha256,phase,effects) values($1,$2,'development',$3,$4,$5,'capture') "
            "on conflict(run_id) do update set phase=excluded.phase,updated_at=now()",
            owner["run_id"],
            owner["tenant_slug"],
            scenario["id"],
            digest,
            phase,
        )
