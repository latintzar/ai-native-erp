"""HTTP contract and authorization for the extracted maintained CRM router."""

from unittest.mock import AsyncMock

import httpx
import pytest
from fastapi import FastAPI
from fastapi.routing import APIRoute

import control_room
import cr_auth
import cr_control
import cr_session
import crm_api

ROUTES = {
    ("GET", "/api/crm/leads"),
    ("GET", "/api/crm/room"),
    ("GET", "/api/crm/room/asset/{fname:path}"),
    ("GET", "/api/crm/room/summary-sources"),
    ("GET", "/api/crm/room/account"),
    ("POST", "/api/crm/room/refund"),
    ("POST", "/api/crm/room/golive"),
    ("GET", "/api/crm/room/data/export"),
    ("POST", "/api/crm/room/data/erase"),
    ("POST", "/api/crm/room/data/anonymize"),
    ("GET", "/api/crm/room/board"),
    ("GET", "/api/crm/room/drill"),
    ("POST", "/api/crm/room/override"),
    ("GET", "/api/crm/hoy"),
    ("GET", "/api/crm/room/trackers"),
    ("POST", "/api/crm/room/persona"),
    ("GET", "/api/crm/room/tab"),
    ("POST", "/api/crm/room/clone"),
    ("POST", "/api/crm/room/test-world"),
    ("GET", "/api/crm/room/alerts"),
    ("POST", "/api/crm/room/alerts/resolve"),
    ("POST", "/api/crm/room/onboard"),
    ("POST", "/api/crm/room/call"),
    ("GET", "/api/crm/lead/{lead_id}"),
    ("POST", "/api/crm/lead/{lead_id}/attach-transcript"),
    ("POST", "/api/crm/lead/{lead_id}/mark-done"),
}


@pytest.fixture
def anyio_backend():
    return "asyncio"


def application():
    app = FastAPI()
    cr_auth.install(app)
    app.include_router(crm_api.router)
    return app


def test_full_factory_registers_existing_crm_routes_once():
    import app

    first = app.create_app()
    second = app.create_app()

    registered = [
        (method, route.path)
        for route in crm_api.router.routes
        if isinstance(route, APIRoute)
        for method in route.methods
    ]
    assert set(registered) == ROUTES
    assert len(registered) == len(ROUTES)
    # FastAPI resolves included routers lazily. Verify the public contract rather than
    # assuming application.routes is a flat list of APIRoute instances.
    expected = application().openapi()["paths"]
    schema_paths = {route.path: route.path_format for route in crm_api.router.routes}
    for method, path in ROUTES:
        schema_path = schema_paths[path]
        operation = expected[schema_path][method.lower()]
        assert first.openapi()["paths"][schema_path][method.lower()] == operation
        assert second.openapi()["paths"][schema_path][method.lower()] == operation
    assert all(not hasattr(app, route.endpoint.__name__) for route in crm_api.router.routes)


@pytest.mark.anyio
async def test_every_private_route_requires_the_existing_session(monkeypatch):
    monkeypatch.setattr(cr_session, "verify", AsyncMock(return_value=None))
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=application()), base_url="https://example.test"
    ) as client:
        for method, path in ROUTES:
            if path in {"/api/crm/room", "/api/crm/room/asset/{fname:path}"}:
                continue
            response = await client.request(
                method,
                path.replace("{lead_id}", "example"),
                params={"scope": "test.example", "id": 1, "tab_id": 1},
                json={} if method == "POST" else None,
                headers={"Authorization": "Bearer machine-key"},
            )
            assert response.status_code == 401, (method, path, response.text)
            assert "Max-Age=0" in response.headers["set-cookie"]


@pytest.mark.anyio
async def test_session_capabilities_and_csrf_reach_same_service(monkeypatch):
    actor = {"actor_email": "operator@example.test", "role": "viewer", "csrf": "csrf-token"}
    monkeypatch.setattr(cr_session, "verify", AsyncMock(return_value=actor))
    board = AsyncMock(return_value={"accounts": []})
    override = AsyncMock(return_value={"ok": True})
    erase = AsyncMock(return_value={"ok": True})
    monkeypatch.setattr(control_room, "board_data", board)
    monkeypatch.setattr(control_room, "override_send", override)
    monkeypatch.setattr(cr_control, "erase", erase)
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=application()), base_url="https://example.test"
    ) as client:
        assert (await client.get("/api/crm/room/board")).json() == {"accounts": []}
        body = {"scope": "test.example", "text": "review"}
        headers = {"X-CSRF-Token": "csrf-token"}
        assert (await client.post("/api/crm/room/override", json=body, headers=headers)).status_code == 403
        actor["role"] = "owner"
        assert (await client.post("/api/crm/room/override", json=body)).status_code == 403
        override.assert_not_awaited()
        assert (await client.post("/api/crm/room/override", json=body, headers=headers)).status_code == 200
        override.assert_awaited_once_with("test.example", "review")
        assert (await client.post("/api/crm/room/data/erase", json=body, headers=headers)).status_code == 400
        actor["role"] = "admin"
        assert (
            await client.post("/api/crm/room/data/erase", json={**body, "confirm": "ERASE"}, headers=headers)
        ).status_code == 403
        erase.assert_not_awaited()


@pytest.mark.anyio
async def test_public_shell_headers_and_static_allowlist():
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=application()), base_url="https://example.test"
    ) as client:
        shell = await client.get("/api/crm/room")
        assert shell.status_code == 200
        for name, value in crm_api._CR_SEC_HEADERS.items():
            assert shell.headers[name] == value
        for name, content_type in crm_api._CR_ASSETS.items():
            asset = await client.get("/api/crm/room/asset/" + name)
            assert asset.status_code == 200
            assert asset.headers["content-type"] == content_type
        for name in ("secrets.env", "vendor/other.js", "%2e%2e%2fapp.py"):
            assert (await client.get("/api/crm/room/asset/" + name)).status_code == 404


@pytest.mark.anyio
async def test_onboard_dispatches_the_moved_mark_done_handler(monkeypatch):
    actor = {"actor_email": "operator@example.test", "role": "owner", "csrf": "csrf-token"}
    monkeypatch.setattr(cr_session, "verify", AsyncMock(return_value=actor))
    lead = {"id": "selected"}
    monkeypatch.setattr(crm_api.brain_onboarding, "get_lead", AsyncMock(return_value=lead))
    status = AsyncMock()
    send = AsyncMock()
    monkeypatch.setattr(crm_api.brain_onboarding, "set_status", status)
    monkeypatch.setattr(crm_api.brain_onboarding, "mint_token", AsyncMock(return_value="fixture-token"))
    monkeypatch.setattr(crm_api.brain_onboarding, "send_wizard_link", send)
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=application()), base_url="https://example.test"
    ) as client:
        result = await client.post(
            "/api/crm/room/onboard", json={"lead_id": "selected"}, headers={"X-CSRF-Token": "csrf-token"}
        )
        assert result.status_code == 200
        assert result.json()["token"] == "fixture-token"
        send.assert_awaited_once_with(lead, "fixture-token")
        assert [c.args for c in status.await_args_list] == [("selected", "done"), ("selected", "wizard_sent")]
