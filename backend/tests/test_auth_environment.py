"""Environment authentication selects an explicit project before contacting a provider."""
import asyncio
import runpy
from pathlib import Path
from types import SimpleNamespace

import httpx
import pytest

import config


def test_unconfigured_auth_has_no_remote_project(monkeypatch):
    for name in ("SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"):
        monkeypatch.delenv(name, raising=False)
    defaults = runpy.run_path(str(Path(config.__file__)))
    for name in ("SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"):
        assert not bool(defaults[name]), f"{name} selected an implicit provider value"


@pytest.mark.parametrize("missing", ["SUPABASE_URL", "SUPABASE_ANON_KEY"])
def test_token_verification_without_auth_configuration_never_contacts_provider(monkeypatch, missing):
    from brain import auth

    def forbidden(*args, **kwargs):
        pytest.fail("incomplete auth configuration reached the provider")

    monkeypatch.setattr(config, "SUPABASE_URL", "https://auth.example.test")
    monkeypatch.setattr(config, "SUPABASE_ANON_KEY", "fixture-key")
    monkeypatch.setattr(config, missing, "")
    monkeypatch.setattr(httpx, "AsyncClient", forbidden)
    assert asyncio.run(auth.verify_token("fixture-user-token")) is None


@pytest.mark.parametrize("missing", ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"])
def test_drip_without_auth_configuration_never_contacts_provider(monkeypatch, missing):
    from brain import drip

    def forbidden(*args, **kwargs):
        pytest.fail("incomplete drip auth configuration reached the provider")

    monkeypatch.setattr(config, "SUPABASE_URL", "https://auth.example.test")
    monkeypatch.setattr(config, "SUPABASE_SERVICE_ROLE_KEY", "fixture-service-key")
    monkeypatch.setattr(config, missing, "")
    monkeypatch.setattr(httpx, "AsyncClient", forbidden)
    assert asyncio.run(drip._mint_auth_link("person@example.test")) is None


def test_drip_uses_selected_auth_project_and_environment_redirect(monkeypatch):
    from brain import drip
    requests = []

    class Client:
        def __init__(self, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def post(self, url, **kwargs):
            requests.append((url, kwargs))
            return SimpleNamespace(status_code=200, json=lambda: {"action_link": "fixture-link"})

    monkeypatch.setattr(config, "SUPABASE_URL", "https://auth.example.test")
    monkeypatch.setattr(config, "SUPABASE_SERVICE_ROLE_KEY", "fixture-service-key")
    monkeypatch.setattr(config, "ONBOARD_PUBLIC_BASE_URL", "https://staging.soyrocoto.com")
    monkeypatch.setattr(httpx, "AsyncClient", Client)
    assert asyncio.run(drip._mint_auth_link("person@example.test")) == "fixture-link"
    url, request = requests[0]
    assert url == "https://auth.example.test/auth/v1/admin/generate_link"
    assert request["json"]["options"]["redirect_to"] == (
        "https://staging.soyrocoto.com/auth/callback?intent=setup")
    assert request["headers"]["apikey"] == "fixture-service-key"


def test_token_verification_uses_only_selected_auth_project(monkeypatch):
    from brain import auth
    requests = []

    class Client:
        def __init__(self, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def get(self, url, **kwargs):
            requests.append((url, kwargs["headers"]))
            return SimpleNamespace(status_code=200, json=lambda: {"id": "fixture-user"})

    monkeypatch.setattr(config, "SUPABASE_URL", "https://auth.example.test")
    monkeypatch.setattr(config, "SUPABASE_ANON_KEY", "fixture-key")
    monkeypatch.setattr(httpx, "AsyncClient", Client)
    selected = runpy.run_path(auth.__file__)
    assert asyncio.run(selected["verify_token"]("fixture-token")) == {"id": "fixture-user"}
    assert requests == [("https://auth.example.test/auth/v1/user",
                         {"apikey": "fixture-key", "authorization": "Bearer fixture-token"})]
