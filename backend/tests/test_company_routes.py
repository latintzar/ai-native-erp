"""Existing backend routes select explicit company configuration without external calls."""
import asyncio
import json
import runpy
from pathlib import Path
from types import SimpleNamespace

import httpx
import pytest

import config


def test_simple_email_honours_configured_sender(monkeypatch):
    import app
    sent = []

    class Client:
        def __init__(self, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def post(self, url, **kwargs):
            sent.append(kwargs["json"])
            return SimpleNamespace(status_code=200, text="")

    monkeypatch.setattr(config, "EGRESS_SANDBOX", False)
    monkeypatch.setattr(config, "RESEND_API_KEY", "fixture-key")
    monkeypatch.setattr(config, "ONBOARD_EMAIL_FROM", "Rocoto <onboarding@soyrocoto.com>")
    monkeypatch.setattr(httpx, "AsyncClient", Client)
    assert asyncio.run(app._send_simple_email("customer@example.test", "Setup", "Link"))["ok"]
    assert sent[0]["from"] == config.ONBOARD_EMAIL_FROM


@pytest.mark.parametrize("missing", ["recipient", "sender"])
def test_unconfigured_email_does_not_call_provider(monkeypatch, missing):
    import app

    def forbidden(**kwargs):
        pytest.fail("unconfigured email reached the provider")

    monkeypatch.setattr(config, "EGRESS_SANDBOX", False)
    monkeypatch.setattr(config, "RESEND_API_KEY", "fixture-key")
    sender = "" if missing == "sender" else "Rocoto <hello@soyrocoto.com>"
    monkeypatch.setattr(config, "ONBOARD_EMAIL_FROM", sender)
    monkeypatch.setattr(httpx, "AsyncClient", forbidden)
    recipient = "" if missing == "recipient" else "customer@example.test"
    assert not asyncio.run(app._send_simple_email(recipient, "Setup", "Link"))["ok"]


def test_unconfigured_routes_have_local_or_explicit_company_defaults(monkeypatch):
    names = ["PUBLIC_BASE_URL", "STOREFRONT_URL", "DEMO_NOTIFY_EMAIL", "DISPATCH_DEFAULT_EMAIL",
             "DISPATCH_FROM_EMAIL", "ONBOARD_EMAIL_FROM"]
    for name in names:
        monkeypatch.delenv(name, raising=False)
    defaults = runpy.run_path(str(Path(config.__file__)))
    assert defaults["PUBLIC_BASE_URL"] == "http://127.0.0.1:8092"
    assert defaults["STOREFRONT_URL"] == ""
    assert defaults["DEMO_NOTIFY_EMAIL"] == ""
    assert defaults["DISPATCH_DEFAULT_EMAIL"] == ""
    assert defaults["DISPATCH_FROM_EMAIL"] == defaults["ONBOARD_EMAIL_FROM"]


@pytest.mark.parametrize("kind", ["email_onboarding", "inventory_link"])
def test_agent_email_link_uses_onboarding_site(monkeypatch, kind):
    import app
    sent = []

    async def fake_send(to, subject, html):
        sent.append(html)
        return {"ok": True}

    monkeypatch.setattr(config, "PUBLIC_BASE_URL", "")
    monkeypatch.setattr(config, "ONBOARD_PUBLIC_BASE_URL", "https://soyrocoto.com/setup-test")
    monkeypatch.setattr(app, "_send_simple_email", fake_send)
    response = asyncio.run(app.agent_action({"kind": kind}, ctx={}))
    assert json.loads(response.body)["ok"]
    assert 'href="https://soyrocoto.com/setup-test"' in sent[0]


def test_app_download_uses_preserved_company_file_host(monkeypatch, tmp_path):
    from brain import golive
    monkeypatch.setattr(config, "MEDIA_DIR", str(tmp_path))
    monkeypatch.delenv("ROCOTO_APK_URL", raising=False)
    assert golive._app_link() == "https://files.soyrocoto.com/Rocoto-arm64.apk"


def test_voice_callback_inherits_configured_backend_base(monkeypatch):
    monkeypatch.delenv("ROCOTO_VOICE_PUBLIC_BASE", raising=False)
    monkeypatch.setattr(config, "PUBLIC_BASE_URL", "https://api.soyrocoto.com")
    result = runpy.run_path(str(Path(config.__file__).with_name("voice_toggle.py")))
    assert result["VOICE_PUBLIC_BASE"] == config.PUBLIC_BASE_URL


@pytest.mark.parametrize("recipient", ["", "operations@soyrocoto.com"])
def test_narration_fallback_uses_configured_operator(monkeypatch, tmp_path, recipient):
    monkeypatch.setenv("ROCOTO_ENV_FILE", str(tmp_path / "absent.env"))
    monkeypatch.delenv("NARRATE_FALLBACK_EMAIL", raising=False)
    import actions
    import narrate

    sent = []

    async def no_whatsapp(*args, **kwargs):
        return None

    async def no_database(*args, **kwargs):
        pass

    async def capture_email(to, *args, **kwargs):
        sent.append(to)
        return bool(to)

    monkeypatch.setattr(config, "NOTIFY_EMAIL", recipient)
    monkeypatch.setattr(narrate.twilio_wa, "send_whatsapp", no_whatsapp)
    monkeypatch.setattr(narrate, "_log_to_db", no_database)
    monkeypatch.setattr(actions, "send_email", capture_email)
    asyncio.run(narrate.narrate("Fixture milestone", to_phone="+34000000000"))
    assert sent == [recipient]


@pytest.mark.parametrize("origin", ["", "  ", "/shop", "ftp://shop.example.test",
                                    "https://", "https://shop.example.test?redirect=x",
                                    "https://user:password@shop.example.test",
                                    "https://shop.example.test:bad", "https://shop.example.test/path",
                                    "https://shop.example.test#fragment", "https://[broken"])
def test_connect_onboarding_requires_origin_before_any_side_effect(monkeypatch, origin):
    from brain import stripe_connect

    def forbidden(*args, **kwargs):
        pytest.fail("unconfigured storefront reached database or Stripe")

    monkeypatch.setattr(config, "STRIPE_SECRET_KEY", "fixture-key")
    monkeypatch.setattr(stripe_connect, "_get_row", forbidden)
    monkeypatch.setattr(stripe_connect, "_ensure_account_sync", forbidden)
    monkeypatch.setattr(stripe_connect, "_save_status", forbidden)
    monkeypatch.setattr(stripe_connect, "_account_link_sync", forbidden)
    result = asyncio.run(stripe_connect.onboarding_link(origin))
    assert result == {"ok": False, "reason": "storefront_not_configured"}


def test_connect_onboarding_uses_configured_origin(monkeypatch):
    from brain import stripe_connect

    links = []
    saved = []

    async def existing_account(tenant):
        return {"stripe_account_id": "acct_fixture"}

    async def save(tenant, acct):
        saved.append(acct.id)

    def account_link(account_id, refresh, return_url):
        links.append((account_id, refresh, return_url))
        return "https://connect.stripe.com/fixture"

    monkeypatch.setattr(config, "STRIPE_SECRET_KEY", "fixture-key")
    monkeypatch.setattr(stripe_connect, "_get_row", existing_account)
    monkeypatch.setattr(stripe_connect, "_ensure_account_sync",
                        lambda account_id, email: SimpleNamespace(id=account_id))
    monkeypatch.setattr(stripe_connect, "_save_status", save)
    monkeypatch.setattr(stripe_connect, "_account_link_sync", account_link)
    result = asyncio.run(stripe_connect.onboarding_link("https://shop.example.test/"))
    assert result["ok"]
    assert saved == ["acct_fixture"]
    assert links == [("acct_fixture", "https://shop.example.test/connect/refresh",
                      "https://shop.example.test/connect/return")]
