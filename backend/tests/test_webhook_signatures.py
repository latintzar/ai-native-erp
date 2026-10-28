"""WP-E — every webhook door verifies its signature, always.

Each assertion shows a REFUSAL, not the absence of a crash: a body without a valid signature comes
back 403 (Meta, Twilio) or 401 (ElevenLabs), including — especially — when the secret that would
verify it is unset. The old shape was `if <secret>:`, so the day a secret went missing the door did
not fail; it started accepting whatever arrived, and no request ever said so.

Boundary-mocked and DB-free: the handlers here either return before touching Postgres (a `delivered`
status callback, an empty Meta payload) or have their one DB call monkeypatched.
"""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import os
import sys

import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("ROCOTO_MEDIA_DIR", "/tmp/rocoto-test-media")

import config  # noqa: E402


def run(coro):
    return asyncio.run(coro)


def _import_app():
    import app
    return app


# ─────────────────────────── the bypass is dev-only, by construction ───────────────────────────
def test_the_bypass_is_ignored_in_production(monkeypatch):
    monkeypatch.setattr(config, "ALLOW_UNSIGNED_WEBHOOKS", True)
    monkeypatch.setattr(config, "IS_PROD", False)
    assert config.allow_unsigned_webhooks() is True
    monkeypatch.setattr(config, "IS_PROD", True)
    assert config.allow_unsigned_webhooks() is False


# ─────────────────────────── the Meta rail ───────────────────────────
META_SECRET = "meta-app-secret"
META_BODY = json.dumps({"entry": []}).encode()      # verified, and nothing to do → 200


class _MetaRequest:
    def __init__(self, headers: dict | None = None, raw: bytes = META_BODY):
        self.headers = headers or {}
        self._raw = raw

    async def body(self):
        return self._raw


def _meta_signed(secret: str = META_SECRET, raw: bytes = META_BODY) -> _MetaRequest:
    mac = hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()
    return _MetaRequest({"X-Hub-Signature-256": f"sha256={mac}"}, raw)


def test_meta_accepts_a_signed_body(monkeypatch):
    app = _import_app()
    monkeypatch.setattr(config, "FB_APP_SECRET", META_SECRET)
    assert run(app.meta_wa_webhook(_meta_signed())).status_code == 200


def test_meta_refuses_an_unsigned_body(monkeypatch):
    app = _import_app()
    monkeypatch.setattr(config, "FB_APP_SECRET", META_SECRET)
    monkeypatch.setattr(config, "ALLOW_UNSIGNED_WEBHOOKS", False)
    with pytest.raises(HTTPException) as e:
        run(app.meta_wa_webhook(_MetaRequest()))
    assert e.value.status_code == 403


def test_meta_refuses_a_forged_signature(monkeypatch):
    app = _import_app()
    monkeypatch.setattr(config, "FB_APP_SECRET", META_SECRET)
    with pytest.raises(HTTPException) as e:
        run(app.meta_wa_webhook(_meta_signed("the-attackers-guess")))
    assert e.value.status_code == 403


def test_meta_with_no_secret_refuses_instead_of_accepting(monkeypatch):
    """THE HOLE THIS CLOSES: FB_APP_SECRET defaults to "" and the check used to be wrapped in
    `if config.FB_APP_SECRET:` — so the day it went missing, every forged body was accepted."""
    app = _import_app()
    monkeypatch.setattr(config, "FB_APP_SECRET", "")
    monkeypatch.setattr(config, "ALLOW_UNSIGNED_WEBHOOKS", False)
    with pytest.raises(HTTPException) as e:
        run(app.meta_wa_webhook(_MetaRequest()))
    assert e.value.status_code == 403


def test_meta_takes_the_bypass_only_off_production(monkeypatch):
    app = _import_app()
    monkeypatch.setattr(config, "FB_APP_SECRET", "")
    monkeypatch.setattr(config, "ALLOW_UNSIGNED_WEBHOOKS", True)
    monkeypatch.setattr(config, "IS_PROD", False)
    assert run(app.meta_wa_webhook(_MetaRequest())).status_code == 200
    monkeypatch.setattr(config, "IS_PROD", True)
    with pytest.raises(HTTPException) as e:
        run(app.meta_wa_webhook(_MetaRequest()))
    assert e.value.status_code == 403


# ─────────────────────────── the Twilio rail (/twilio/whatsapp/status) ───────────────────────────
TWILIO_TOKEN = "twilio-auth-token"
STATUS_PATH = "/twilio/whatsapp/status"
# `delivered` skips the failure branch, so this handler answers 204 without a database.
STATUS_FORM = {"MessageStatus": "delivered", "MessageSid": "SM1", "To": "whatsapp:+34600111222"}


class _Form(dict):
    """starlette's FormData, as much of it as the handler uses (dict(form) + .get)."""


class _TwilioRequest:
    def __init__(self, form: dict, headers: dict | None = None):
        self._form = _Form(form)
        self.headers = headers or {}

    async def form(self):
        return self._form


def _twilio_signed(token: str = TWILIO_TOKEN, form: dict = STATUS_FORM) -> _TwilioRequest:
    from twilio.request_validator import RequestValidator
    sig = RequestValidator(token).compute_signature(
        f"{config.PUBLIC_BASE_URL}{STATUS_PATH}", dict(form))
    return _TwilioRequest(form, {"X-Twilio-Signature": sig})


def test_twilio_accepts_a_signed_callback(monkeypatch):
    app = _import_app()
    monkeypatch.setattr(config, "TWILIO_AUTH_TOKEN", TWILIO_TOKEN)
    assert run(app.twilio_wa_status(_twilio_signed())).status_code == 204


def test_twilio_refuses_an_unsigned_callback(monkeypatch):
    app = _import_app()
    monkeypatch.setattr(config, "TWILIO_AUTH_TOKEN", TWILIO_TOKEN)
    monkeypatch.setattr(config, "ALLOW_UNSIGNED_WEBHOOKS", False)
    with pytest.raises(HTTPException) as e:
        run(app.twilio_wa_status(_TwilioRequest(STATUS_FORM)))
    assert e.value.status_code == 403


def test_twilio_refuses_a_signature_for_another_body(monkeypatch):
    """The signature covers the parameters, so a replay with a changed field is a forgery."""
    app = _import_app()
    monkeypatch.setattr(config, "TWILIO_AUTH_TOKEN", TWILIO_TOKEN)
    req = _twilio_signed()
    req._form["MessageStatus"] = "failed"
    with pytest.raises(HTTPException) as e:
        run(app.twilio_wa_status(req))
    assert e.value.status_code == 403


def test_twilio_with_no_token_refuses_instead_of_accepting(monkeypatch):
    """THE HOLE THIS CLOSES: `if config.VALIDATE_TWILIO and config.TWILIO_AUTH_TOKEN:` — unset either
    and every forged callback passed. VALIDATE_TWILIO is not read on this path any more."""
    app = _import_app()
    monkeypatch.setattr(config, "TWILIO_AUTH_TOKEN", "")
    monkeypatch.setattr(config, "VALIDATE_TWILIO", False)
    monkeypatch.setattr(config, "ALLOW_UNSIGNED_WEBHOOKS", False)
    with pytest.raises(HTTPException) as e:
        run(app.twilio_wa_status(_TwilioRequest(STATUS_FORM)))
    assert e.value.status_code == 403


def test_twilio_takes_the_bypass_only_off_production(monkeypatch):
    app = _import_app()
    monkeypatch.setattr(config, "TWILIO_AUTH_TOKEN", "")
    monkeypatch.setattr(config, "ALLOW_UNSIGNED_WEBHOOKS", True)
    monkeypatch.setattr(config, "IS_PROD", False)
    assert run(app.twilio_wa_status(_TwilioRequest(STATUS_FORM))).status_code == 204
    monkeypatch.setattr(config, "IS_PROD", True)
    with pytest.raises(HTTPException) as e:
        run(app.twilio_wa_status(_TwilioRequest(STATUS_FORM)))
    assert e.value.status_code == 403


# ─────────────────────────── the ElevenLabs post-call webhook ───────────────────────────
def test_elevenlabs_postcall_with_no_secret_refuses(monkeypatch):
    """This body is a whole call in a stranger's words; unset wsec used to mean 'attach anything'."""
    app = _import_app()
    monkeypatch.setattr(config, "ELEVENLABS_WEBHOOK_SECRET", "")
    monkeypatch.setattr(config, "ALLOW_UNSIGNED_WEBHOOKS", False)
    with pytest.raises(HTTPException) as e:
        run(app.api_agent_postcall(_MetaRequest(raw=b"{}")))
    assert e.value.status_code == 401


def test_elevenlabs_postcall_accepts_a_signed_body(monkeypatch):
    import time
    app = _import_app()
    secret, raw = "el-wsec", b'{"type":"post_call_transcription"}'
    monkeypatch.setattr(config, "ELEVENLABS_WEBHOOK_SECRET", secret)

    async def fake_postcall(payload):
        return {"ok": True, "matched": False}

    monkeypatch.setattr(app.brain_ob_ext, "agent_postcall", fake_postcall)
    t = str(int(time.time()))
    mac = hmac.new(secret.encode(), f"{t}.".encode() + raw, hashlib.sha256).hexdigest()
    req = _MetaRequest({"elevenlabs-signature": f"t={t},v0={mac}"}, raw)
    assert run(app.api_agent_postcall(req)).status_code == 200
