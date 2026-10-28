"""/api/health says what was handed to the process — no more, and never less."""
from __future__ import annotations

from app import config


def test_health_names_the_contract_s_providers(client):
    """RUN-02, and the whole key set as it stands at RELEASE-195: FOUR keys and TWO roads.

    ⚠ THE FOUR KEEP THEIR TWO WORDS. `providerState()` in the kit promises callers `configured` or
    `missing` for parsewise · deepgram · places · twilio, and neither of the roads below widens
    that: each is typed apart, and each has its own vocabulary because each has its own question.
    ARTWORK answers whether the road can spend (§200.2); COPILOT answers WHICH MIND is standing
    (§196.2 · §199.3), because Gemini and Claude are two different products to the person reading
    the reply.
    """
    body = client.get("/api/health").json()
    assert body["ok"] is True
    assert body["version"]
    assert set(body["providers"]) == {"parsewise", "deepgram", "places", "twilio", "artwork", "copilot"}
    four = {name: state for name, state in body["providers"].items()
            if name not in ("artwork", "copilot")}
    assert set(four.values()) <= {"configured", "missing"}
    assert body["providers"]["artwork"] in {"configured", "awaiting key"}
    assert body["providers"]["copilot"] in {"gemini", "anthropic", "awaiting key"}


def test_artwork_says_what_is_owed_in_its_own_words(client):
    """§200.2: the four keys report `missing`; the artwork road is built and says «awaiting key»."""
    providers = client.get("/api/health").json()["providers"]
    assert providers["artwork"] in {"configured", "awaiting key"}
    assert set(v for k, v in providers.items()
               if k not in ("artwork", "copilot")) <= {"configured", "missing"}


def test_a_provider_is_configured_by_presence_alone(monkeypatch):
    """Presence, not reachability. THE-RUNTIME-SPEC §RUN-03: the endpoints report what happened."""
    monkeypatch.setattr(config.settings, "parsewise_key", "", raising=False)
    assert config.settings.providers["parsewise"] == "missing"
    monkeypatch.setattr(config.settings, "parsewise_key", "a-key", raising=False)
    assert config.settings.providers["parsewise"] == "configured"


def test_twilio_needs_both_halves(monkeypatch):
    """An account SID with no auth token cannot verify a webhook, so it is not «configured»."""
    monkeypatch.setattr(config.settings, "public_base", "https://example-demo.soyrocoto.com")
    monkeypatch.setattr(config.settings, "twilio_account_sid", "AC0", raising=False)
    monkeypatch.setattr(config.settings, "twilio_auth_token", "", raising=False)
    assert config.settings.providers["twilio"] == "missing"
    monkeypatch.setattr(config.settings, "twilio_auth_token", "tok", raising=False)
    assert config.settings.providers["twilio"] == "configured"


def test_a_secret_never_survives_a_log_line(monkeypatch):
    """redact() is why an httpx URL carrying `key=…` reaches the journal as `key=[redacted]`."""
    monkeypatch.setattr(config.settings, "places_key", "AIzaSyTHIS_IS_A_SECRET_VALUE", raising=False)
    line = "GET https://maps.googleapis.com/maps/api/place/json?key=AIzaSyTHIS_IS_A_SECRET_VALUE"
    assert "AIzaSyTHIS_IS_A_SECRET_VALUE" not in config.redact(line)
    assert "[redacted]" in config.redact(line)
