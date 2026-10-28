"""THE CONTRACT THE KIT ALREADY READS — app/src/prototypes/cedar/runtime-client.ts, endpoint for endpoint.

Nothing here calls a provider: the keys are cleared, which is exactly the posture that proves the
service REFUSES by name instead of inventing an answer.
"""
from __future__ import annotations

import pytest

from app import config

KIT = "https://kit.soyrocoto.com"


@pytest.fixture(autouse=True)
def no_keys(monkeypatch):
    for name in ("parsewise_key", "deepgram_key", "places_key", "twilio_account_sid", "twilio_auth_token"):
        monkeypatch.setattr(config.settings, name, "", raising=False)


def test_every_endpoint_the_contract_names_answers(client):
    assert client.get("/api/health").status_code == 200
    assert client.get("/api/calls?number=%2B34935563000").json() == []
    for response in (
        client.post("/api/parse", files={"file": ("a.png", b"x", "image/png")}, data={"kind": "albaran"}),
        client.get("/api/identity?number=%2B34935563000"),
        client.post("/api/transcribe", files={"audio": ("a.wav", b"x", "audio/wav")}, data={"language": "es"}),
        client.post("/api/calls", json={"to": "+34935563000"}),
    ):
        assert response.status_code == 503, response.text
        assert response.json()["error"]["code"].endswith("_missing"), response.text


def test_an_error_is_always_json_never_a_page(client):
    for response in (client.get("/api/nothing-here"),
                     client.get("/api/identity"),
                     client.post("/api/calls", json={})):
        assert response.headers["content-type"].startswith("application/json")
        assert "error" in response.json()
        assert set(response.json()["error"]) == {"code", "message"}


def test_the_kit_s_origin_is_allowed_and_every_other_origin_is_not(client):
    allowed = client.get("/api/health", headers={"Origin": KIT})
    assert allowed.headers.get("access-control-allow-origin") == KIT
    local = client.get("/api/health", headers={"Origin": "http://localhost:5173"})
    assert local.headers.get("access-control-allow-origin") == "http://localhost:5173"
    for origin in ("https://evil.example.com", "https://kit.soyrocoto.com.evil.io",
                   "http://kit.soyrocoto.com", "https://app.soyrocoto.com"):
        blocked = client.get("/api/health", headers={"Origin": origin})
        assert "access-control-allow-origin" not in blocked.headers, origin


def test_the_preflight_answers_only_for_the_kit(client):
    ok = client.options("/api/parse", headers={"Origin": KIT,
                                               "Access-Control-Request-Method": "POST"})
    assert ok.headers.get("access-control-allow-origin") == KIT
    no = client.options("/api/parse", headers={"Origin": "https://evil.example.com",
                                               "Access-Control-Request-Method": "POST"})
    assert "access-control-allow-origin" not in no.headers


def test_an_empty_upload_is_refused_before_a_provider_is_ever_called(client, monkeypatch):
    monkeypatch.setattr(config.settings, "parsewise_key", "a-key", raising=False)
    response = client.post("/api/parse", files={"file": ("a.png", b"", "image/png")}, data={"kind": "albaran"})
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "empty_upload"


def test_an_unknown_kind_never_reaches_the_provider(client, monkeypatch):
    monkeypatch.setattr(config.settings, "parsewise_key", "a-key", raising=False)
    response = client.post("/api/parse", files={"file": ("a.png", b"x", "image/png")},
                           data={"kind": "invoice"})
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "bad_kind"


def test_an_oversized_upload_is_refused(client, monkeypatch):
    monkeypatch.setattr(config.settings, "parsewise_key", "a-key", raising=False)
    monkeypatch.setattr(config.settings, "max_upload_bytes", 8, raising=False)
    response = client.post("/api/parse", files={"file": ("a.png", b"0123456789", "image/png")},
                           data={"kind": "albaran"})
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "too_large"


def test_every_answer_carries_a_request_id(client):
    assert client.get("/api/health").headers.get("X-Request-Id")


def test_the_service_publishes_no_schema_door(client):
    """No /docs, no /openapi.json: this service is a private seam, not a public API surface."""
    for path in ("/docs", "/redoc", "/openapi.json"):
        assert client.get(path).status_code == 404
