"""A new runtime never inherits the published reference's callback or asset origin."""

import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app import artwork, config, twilio_voice
from app.errors import RuntimeError_


def test_runtime_origin_requires_its_own_configuration(monkeypatch):
    monkeypatch.delenv("ROCOTO_RUNTIME_PUBLIC_BASE", raising=False)
    assert config.Settings().public_base == ""


def test_callback_requires_the_consuming_runtime_origin(monkeypatch):
    monkeypatch.setattr(config.settings, "public_base", "")
    with pytest.raises(RuntimeError_, match="ROCOTO_RUNTIME_PUBLIC_BASE"):
        twilio_voice.public_url("/api/twilio/status")
    monkeypatch.setattr(config.settings, "public_base", "https://example-demo.soyrocoto.com")
    assert twilio_voice.public_url("/api/twilio/status") == (
        "https://example-demo.soyrocoto.com/api/twilio/status"
    )


def test_calling_health_requires_origin_as_well_as_credentials():
    settings = config.Settings(
        twilio_account_sid="test-account", twilio_auth_token="test-token", public_base=""
    )
    assert settings.providers["twilio"] == "missing"
    settings.public_base = "https://example-demo.soyrocoto.com"
    assert settings.providers["twilio"] == "configured"


def test_implicit_artwork_origin_is_refused_before_any_fetch(monkeypatch):
    monkeypatch.setattr(config.settings, "public_base", "")
    client = AsyncMock()
    client.get.return_value = SimpleNamespace(status_code=200, content=b"fixture")
    with pytest.raises(RuntimeError_, match="ROCOTO_RUNTIME_PUBLIC_BASE"):
        asyncio.run(artwork._reference_bytes(client, "tomato", ""))
    client.get.assert_not_awaited()
