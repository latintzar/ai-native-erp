"""Empty workspaces grant only their own private scope; provider privileges are separate."""

import hashlib
import sqlite3

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from app import cedar_access as access


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(access.settings, "state_dir", tmp_path)
    app = FastAPI()
    app.include_router(access.router)

    @app.get("/operator")
    def operator(request: Request):
        access.require_operator(request)
        return {"ok": True}

    with TestClient(app) as connection:
        yield connection


def create(client):
    response = client.post(
        "/api/cedar/access/workspaces", json={}, headers={"Origin": "https://demo.soyrocoto.com"}
    )
    assert response.status_code == 201
    return response.json()


def test_scope_cannot_be_selected_by_cast_or_another_workspace(client):
    first, second = create(client), create(client)
    assert first["workspace_id"] != second["workspace_id"]
    assert client.get("/api/cedar/access/workspace").status_code == 401
    response = client.get(
        "/api/cedar/access/workspace?workspace_id=" + second["workspace_id"],
        headers={"Authorization": "Bearer " + first["access_token"]},
    )
    assert response.json()["workspace_id"] == first["workspace_id"]
    assert client.post("/api/cedar/access/workspaces", json={"cast": "fish"}).status_code == 422
    assert access.workspace_exists(first["workspace_id"])
    assert not access.workspace_exists("fish")
    assert (
        client.get("/operator", headers={"Authorization": "Bearer " + first["access_token"]}).status_code
        == 403
    )
    assert response.headers["cache-control"] == "no-store"


def test_expiry_revoke_and_token_hash_survive_reconstruction(client, monkeypatch):
    first = create(client)
    token = first["access_token"]
    path = access._path()
    assert token.encode() not in path.read_bytes()
    assert path.stat().st_mode & 0o777 == 0o600
    with sqlite3.connect(path) as db:
        assert (
            db.execute("SELECT token_hash FROM workspaces").fetchone()[0]
            == hashlib.sha256(token.encode()).hexdigest()
        )
    header = {"Authorization": "Bearer " + token}
    assert client.get("/api/cedar/access/workspace", headers=header).status_code == 200
    with sqlite3.connect(path) as db:
        db.execute("UPDATE workspaces SET revoked=1")
    assert client.get("/api/cedar/access/workspace", headers=header).status_code == 401
    assert not access.workspace_exists(first["workspace_id"])
    second = create(client)
    monkeypatch.setattr(access.time, "time", lambda: second["expires_at"] + 1)
    assert (
        client.get(
            "/api/cedar/access/workspace", headers={"Authorization": "Bearer " + second["access_token"]}
        ).status_code
        == 401
    )


def test_development_origins_and_allocation_budget(client):
    for origin in (
        "https://staging.soyrocoto.com",
        "https://kit.soyrocoto.com",
        "https://demo.soyrocoto.com.evil.example",
        "null",
    ):
        assert (
            client.post("/api/cedar/access/workspaces", json={}, headers={"Origin": origin}).status_code
            == 403
        )
    first = create(client)
    for _ in range(19):
        create(client)
    assert client.post("/api/cedar/access/workspaces", json={}).status_code == 429
    assert (
        client.get(
            "/api/cedar/access/workspace", headers={"Authorization": "Bearer " + first["access_token"]}
        ).status_code
        == 200
    )


def test_operator_requires_explicit_bearer_and_connections_are_closed(client, monkeypatch):
    key = "fixture-operator-" + "x" * 32
    monkeypatch.setenv("CEDAR_CHANNEL_OPERATOR_KEY", key)
    assert client.get("/operator", headers={"Authorization": key}).status_code == 403
    assert client.get("/operator", headers={"Authorization": "Bearer " + key}).status_code == 200
    with access._db() as connection:
        assert connection.execute("SELECT 1").fetchone()[0] == 1
    with pytest.raises(sqlite3.ProgrammingError):
        connection.execute("SELECT 1")


def test_consumer_origin_follows_its_declared_development_base(client, monkeypatch):
    preview = "https://cedar-channels.soyrocoto.com"
    path = "/api/cedar/access/workspaces"
    monkeypatch.setattr(access.settings, "public_base", preview + "/")
    assert client.post(path, json={}, headers={"Origin": preview}).status_code == 201
    assert client.post(path, json={}, headers={"Origin": "https://demo.soyrocoto.com"}).status_code == 201
    for origin in (
        preview + ".evil.example",
        "http://cedar-channels.soyrocoto.com",
        "https://kit.soyrocoto.com",
    ):
        assert client.post(path, json={}, headers={"Origin": origin}).status_code == 403
    # A maintained host, a path, plain HTTP or an authenticated base never becomes an allowed origin.
    for base in (
        "https://kit.soyrocoto.com",
        "https://staging.soyrocoto.com",
        "https://soyrocoto.com",
        "http://cedar-channels.soyrocoto.com",
        "https://cedar-channels.soyrocoto.com/cedar",
        "https://user@cedar-channels.soyrocoto.com",
        "https://cedar-channels.soyrocoto.com:8443",
        "",
    ):
        monkeypatch.setattr(access.settings, "public_base", base)
        assert access.own_origin() == ""
        origin = base.rstrip("/") or preview
        assert client.post(path, json={}, headers={"Origin": origin}).status_code == 403
