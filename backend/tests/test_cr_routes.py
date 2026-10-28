"""HTTP authorization remains enforced after extracting the existing CRM routes."""
from unittest.mock import AsyncMock

import httpx
import pytest
from fastapi import FastAPI

import cr_auth
import cr_session
import playbook
import playbook_api


@pytest.fixture
def anyio_backend():
    return "asyncio"


def application():
    app = FastAPI()
    cr_auth.install(app)
    app.include_router(playbook_api.router)
    return app


@pytest.mark.anyio
async def test_anonymous_and_machine_credentials_cannot_read_private_assets(monkeypatch):
    monkeypatch.setattr(cr_session, "verify", AsyncMock(return_value=None))
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=application()),
                                 base_url="https://example.test") as client:
        for path in ("/api/crm/me", "/api/crm/playbook/asset/pb.js", "/api/crm/playbook/accounts"):
            response = await client.get(path, headers={"Authorization": "Bearer machine-key"})
            assert response.status_code == 401
            assert "Max-Age=0" in response.headers["set-cookie"]


@pytest.mark.anyio
async def test_session_csrf_and_capability_guard_mutations(monkeypatch):
    actor = {"actor_email": "support@example.test", "role": "viewer", "csrf": "csrf-token"}
    monkeypatch.setattr(cr_session, "verify", AsyncMock(return_value=actor))
    mutation = AsyncMock(return_value={"id": 1})
    monkeypatch.setattr(playbook, "create_account", mutation)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=application()),
                                 base_url="https://example.test") as client:
        response = await client.post("/api/crm/playbook/accounts", json={"name": "Example"})
        assert response.status_code == 403
        response = await client.post("/api/crm/playbook/accounts", json={"name": "Example"},
                                     headers={"X-CSRF-Token": "csrf-token"})
        assert response.status_code == 403
        mutation.assert_not_awaited()
        actor["role"] = "owner"
        response = await client.post("/api/crm/playbook/accounts", json={"name": "Example"},
                                     headers={"X-CSRF-Token": "csrf-token"})
        assert response.status_code == 200
        mutation.assert_awaited_once_with("Example", "", "")


@pytest.mark.anyio
async def test_rotated_cookie_and_asset_path_boundary(monkeypatch):
    actor = {"actor_email": "owner@example.test", "role": "owner", "csrf": "csrf-token",
             "fresh_raw": "rotated.secret", "remaining": 100}
    monkeypatch.setattr(cr_session, "verify", AsyncMock(return_value=actor))
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=application()),
                                 base_url="https://example.test") as client:
        response = await client.get("/api/crm/me")
        cookie = response.headers["set-cookie"]
        assert all(part in cookie for part in ("HttpOnly", "Secure", "SameSite=strict", "Path=/api/crm"))
        response = await client.get("/api/crm/playbook/asset/secrets.env")
        assert response.status_code == 404


def test_independent_applications_register_the_same_routes_once():
    def paths(app):
        return [(path, method) for path, methods in app.openapi()["paths"].items() for method in methods]
    first, second = application(), application()
    assert paths(first) == paths(second)
    assert len(paths(first)) == len(set(paths(first)))
