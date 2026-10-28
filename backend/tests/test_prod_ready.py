"""WP-E — production names what it must carry, and refuses to start without it.

`config.assert_prod_ready()` is a boot-time answer to a class of misconfiguration that has no
runtime symptom: an unset webhook secret does not break a request, it stops the door asking who sent
it. Every assertion here is about the REFUSAL and about the NAMES in it, because an operator reading
a crash loop needs the list to set.
"""
from __future__ import annotations

import asyncio
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("ROCOTO_MEDIA_DIR", "/tmp/rocoto-test-media")

import config  # noqa: E402


def run(coro):
    return asyncio.run(coro)


def _import_app():
    import app
    return app


# ─────────────────────────── config.assert_prod_ready ───────────────────────────
ALWAYS = ("ROCOTO_API_KEY", "ROCOTO_AGENT_TOOL_SECRET", "FB_APP_SECRET", "WA_CLOUD_VERIFY_TOKEN")
RAILS = (("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"),
         ("ELEVENLABS_API_KEY", "ELEVENLABS_WEBHOOK_SECRET"),
         ("STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"))


@pytest.fixture
def prod(monkeypatch):
    """A production process with every rail off and every secret unset — the empty box."""
    monkeypatch.setattr(config, "IS_PROD", True)
    for name in ALWAYS:
        monkeypatch.setattr(config, name, "")
    for rail, secret in RAILS:
        monkeypatch.setattr(config, rail, "")
        monkeypatch.setattr(config, secret, "")
    monkeypatch.setattr(config, "OWNER_EMAILS", frozenset())
    return monkeypatch


def test_prod_ready_names_every_missing_secret(prod):
    with pytest.raises(RuntimeError) as e:
        config.assert_prod_ready()
    msg = str(e.value)
    for name in ALWAYS + ("OWNER_EMAILS",):
        assert name in msg, f"the error must name {name}: {msg}"


def test_prod_ready_passes_when_the_box_is_furnished(prod):
    for name in ALWAYS:
        prod.setattr(config, name, "x" * 20)
    prod.setattr(config, "OWNER_EMAILS", frozenset({"someone@soyrocoto.com"}))
    config.assert_prod_ready()          # no raise
    assert config.missing_prod_secrets() == []


def test_a_rails_secret_is_required_only_once_that_rail_exists(prod):
    for name in ALWAYS:
        prod.setattr(config, name, "x" * 20)
    prod.setattr(config, "OWNER_EMAILS", frozenset({"someone@soyrocoto.com"}))
    config.assert_prod_ready()          # three rails unconfigured → three secrets not required
    for rail, secret in RAILS:
        prod.setattr(config, rail, "configured")
        assert config.missing_prod_secrets() == [secret], f"{rail} set must require {secret}"
        prod.setattr(config, secret, "x" * 20)
    config.assert_prod_ready()          # each rail now carries its secret


def test_outside_prod_it_asks_for_nothing(prod):
    prod.setattr(config, "IS_PROD", False)
    config.assert_prod_ready()          # a laptop boots with an empty environment


def test_startup_calls_it(monkeypatch):
    """The check only protects the box if the box runs it — assert the wiring, not just the function."""
    app = _import_app()
    called = []
    monkeypatch.setattr(config, "assert_prod_ready", lambda: called.append(True) or (_ for _ in ()).throw(
        RuntimeError("stop here — the rest of startup needs a database")))
    with pytest.raises(RuntimeError):
        run(app._startup())
    assert called == [True], "app startup must call config.assert_prod_ready() first"
