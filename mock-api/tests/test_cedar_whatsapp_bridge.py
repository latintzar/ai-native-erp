"""Full Cedar reuses the existing private service without migrating its account/callback."""

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import cedar_whatsapp as bridge


@pytest.fixture
def client(monkeypatch):
    app = FastAPI()
    app.include_router(bridge.router)
    monkeypatch.setenv("CEDAR_WHATSAPP_BRIDGE_ENABLED", "true")
    with TestClient(app, base_url="https://demo.soyrocoto.com") as connection:
        yield connection


def test_fixed_upstream_origin_and_host_cookie(client, monkeypatch):
    original = httpx.AsyncClient
    seen = []

    def upstream(request):
        seen.append(request)
        return httpx.Response(
            200,
            json={"ok": True},
            headers={
                "Set-Cookie": "__Host-cedar_session="
                + "s" * 43
                + "; Path=/; Secure; HttpOnly; SameSite=Strict"
            },
        )

    monkeypatch.setattr(
        bridge.httpx, "AsyncClient", lambda **kw: original(transport=httpx.MockTransport(upstream))
    )
    response = client.post(
        "/api/proof/session",
        json={},
        headers={"Origin": "https://demo.soyrocoto.com", "X-Forwarded-Host": "evil.example"},
    )
    assert response.status_code == 200
    assert str(seen[0].url) == "http://127.0.0.1:8793/api/proof/session"
    assert seen[0].headers["origin"] == "https://cedar-demo.soyrocoto.com"
    assert "x-forwarded-host" not in seen[0].headers
    assert "Domain" not in response.headers["set-cookie"]
    assert "HttpOnly" in response.headers["set-cookie"]
    assert response.headers["cache-control"] == "no-store"


def test_refuses_foreign_origins_and_undocumented_routes(client, monkeypatch):
    assert client.post("/api/proof/session", json={}).status_code == 403
    assert (
        client.post("/api/proof/session", json={}, headers={"Origin": "https://evil.example"}).status_code
        == 403
    )
    assert client.get("/api/proof/operator").status_code == 404
    assert client.post("/api/proof/webhooks/whatsapp", json={}).status_code == 404
    monkeypatch.setenv("CEDAR_WHATSAPP_BRIDGE_ENABLED", "false")
    assert (
        client.post(
            "/api/proof/session", json={}, headers={"Origin": "https://demo.soyrocoto.com"}
        ).status_code
        == 503
    )


def test_forwards_only_the_live_connection_verification_action(client, monkeypatch):
    original = httpx.AsyncClient
    seen = []

    def upstream(request):
        seen.append(request)
        return httpx.Response(200, json={"connection": {"phoneId": "provider-phone"}})

    monkeypatch.setattr(
        bridge.httpx, "AsyncClient", lambda **kw: original(transport=httpx.MockTransport(upstream))
    )
    response = client.post(
        "/api/proof/whatsapp/verify",
        json={},
        headers={"Origin": "https://demo.soyrocoto.com"},
    )
    assert response.status_code == 200
    assert response.json() == {"connection": {"phoneId": "provider-phone"}}
    assert str(seen[0].url) == "http://127.0.0.1:8793/api/proof/whatsapp/verify"
    assert seen[0].headers["origin"] == "https://cedar-demo.soyrocoto.com"


def test_actual_conversation_identifier_and_host_cookie_survive_proxy(client, monkeypatch):
    original = httpx.AsyncClient
    seen = []
    token = "s" * 43
    conversation = "a" * 64  # PR81 storage.Store.key returns an HMAC SHA256 hex identifier.

    def upstream(request):
        seen.append(request)
        if request.url.path.endswith("/session"):
            return httpx.Response(
                200,
                json={"ok": True},
                headers={
                    "Set-Cookie": f"__Host-cedar_session={token}; Path=/; Secure; HttpOnly; SameSite=Strict",
                },
            )
        assert request.headers["cookie"] == f"__Host-cedar_session={token}"
        assert dict(request.url.params) == {"before": "opaque-cursor", "limit": "100"}
        return httpx.Response(200, json={"messages": [{"id": "provider-message", "text": "Owned history"}]})

    monkeypatch.setattr(
        bridge.httpx, "AsyncClient", lambda **kw: original(transport=httpx.MockTransport(upstream))
    )
    assert (
        client.post(
            "/api/proof/session", json={}, headers={"Origin": "https://demo.soyrocoto.com"}
        ).status_code
        == 200
    )
    client.cookies.set("unrelated", "other-service-private")
    response = client.get(
        f"/api/proof/conversations/{conversation}/messages?before=opaque-cursor&limit=100&url=https://evil.example"
    )
    assert response.status_code == 200 and response.json()["messages"][0]["text"] == "Owned history"
    assert str(seen[-1].url).startswith(
        f"http://127.0.0.1:8793/api/proof/conversations/{conversation}/messages?"
    )


def test_intake_forwards_only_its_documented_cursor(client, monkeypatch):
    original = httpx.AsyncClient
    seen = []

    def upstream(request):
        seen.append(request)
        return httpx.Response(200, json={"messages": [], "nextCursor": "next"})

    monkeypatch.setattr(
        bridge.httpx, "AsyncClient", lambda **kw: original(transport=httpx.MockTransport(upstream))
    )
    response = client.get("/api/proof/intake?after=opaque&limit=50&url=https://evil.example")
    assert response.status_code == 200
    assert str(seen[0].url) == "http://127.0.0.1:8793/api/proof/intake?after=opaque&limit=50"
