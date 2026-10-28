"""Public derivative defaults preserve installation-owned authority and credentials."""
from __future__ import annotations

import asyncio
import base64
import json

import pytest

import app
import config
from brain import teams


@pytest.mark.parametrize("missing", ["FOUNDER_ID", "FOUNDER_EMAIL", "FOUNDER_NAME"])
def test_incomplete_founder_configuration_never_grants_membership(monkeypatch, missing):
    monkeypatch.setattr(teams, "FOUNDER_ID", "op_installation_owner")
    monkeypatch.setattr(teams, "FOUNDER_EMAIL", "owner@example.invalid")
    monkeypatch.setattr(teams, "FOUNDER_NAME", "Workspace owner")
    monkeypatch.setattr(teams, missing, "")
    monkeypatch.setattr(teams.db, "get_pool", lambda: pytest.fail("unconfigured founder touched authority storage"))
    asyncio.run(teams.ensure_seed())


@pytest.mark.parametrize("role", ["anon", "service_role", "admin"])
def test_public_identity_bootstrap_accepts_only_public_jwt_role(monkeypatch, role):
    payload = base64.urlsafe_b64encode(json.dumps({"role": role}).encode()).decode().rstrip("=")
    token = "header." + payload + ".signature"
    monkeypatch.setattr(config, "SUPABASE_URL", "https://identity.example.invalid")
    monkeypatch.setattr(config, "SUPABASE_ANON_KEY", token)
    result = app._public_identity_config()
    if role == "anon":
        assert result == {"supabaseUrl": config.SUPABASE_URL, "supabaseAnonKey": token}
    else:
        assert result == {"supabaseUrl": "", "supabaseAnonKey": ""}


@pytest.mark.parametrize("value", ["", "sb_secret_fixture", "header.W10.signature", "unrecognized-private-value"])
def test_public_identity_bootstrap_refuses_unrecognized_or_secret_keys(monkeypatch, value):
    monkeypatch.setattr(config, "SUPABASE_URL", "https://identity.example.invalid")
    monkeypatch.setattr(config, "SUPABASE_ANON_KEY", value)
    assert app._public_identity_config() == {"supabaseUrl": "", "supabaseAnonKey": ""}


def test_public_identity_bootstrap_accepts_publishable_key_namespace(monkeypatch):
    value = "sb_publishable_fixture"
    monkeypatch.setattr(config, "SUPABASE_URL", "https://identity.example.invalid")
    monkeypatch.setattr(config, "SUPABASE_ANON_KEY", value)
    assert app._public_identity_config()["supabaseAnonKey"] == value
