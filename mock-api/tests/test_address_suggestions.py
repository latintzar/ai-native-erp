"""Address suggestions use Google's wire contract; every provider response here is a fixture."""

import asyncio
import json

import httpx
import pytest

from app import config, places
from app.errors import RuntimeError_

ORIGIN = "http://127.0.0.1:8094"
TOKEN = "11111111-1111-4111-8111-111111111111"


@pytest.fixture(autouse=True)
def clean_budget(monkeypatch):
    from app.main import _ADDRESS_SPENT

    _ADDRESS_SPENT.clear()
    monkeypatch.setattr(config.settings, "places_key", "fixture-key")
    yield
    _ADDRESS_SPENT.clear()


def test_autocomplete_uses_server_key_country_restriction_and_bounded_fieldmask(monkeypatch):
    actual_client = httpx.AsyncClient

    def handler(request):
        assert str(request.url) == "https://places.googleapis.com/v1/places:autocomplete"
        assert request.headers["x-goog-api-key"] == "fixture-key"
        assert "placePrediction.placeId" in request.headers["x-goog-fieldmask"]
        assert json.loads(request.content) == {
            "input": "Avenida Larco 123",
            "sessionToken": TOKEN,
            "includedRegionCodes": ["pe"],
            "languageCode": "es",
        }
        return httpx.Response(
            200,
            json={
                "suggestions": [
                    {
                        "placePrediction": {
                            "placeId": "ChIJ-fixture",
                            "text": {"text": "Avenida Larco 123, Miraflores, Perú"},
                            "structuredFormat": {
                                "mainText": {"text": "Avenida Larco 123"},
                                "secondaryText": {"text": "Miraflores, Perú"},
                            },
                        }
                    }
                ]
            },
        )

    monkeypatch.setattr(
        places.httpx,
        "AsyncClient",
        lambda **kwargs: actual_client(transport=httpx.MockTransport(handler), **kwargs),
    )
    result = asyncio.run(places.address_suggestions("  Avenida Larco 123  ", TOKEN))
    assert result == {
        "provider": "google-places",
        "country": "PE",
        "suggestions": [
            {
                "placeId": "ChIJ-fixture",
                "text": "Avenida Larco 123, Miraflores, Perú",
                "mainText": "Avenida Larco 123",
                "secondaryText": "Miraflores, Perú",
            }
        ],
    }
    assert "fixture-key" not in json.dumps(result)


def test_spain_follows_the_workspace_country_toggle(monkeypatch):
    """§247.1 — the address search flips with the Peru/Spain toggle, never a separate setting."""
    actual_client = httpx.AsyncClient
    seen = {}

    def handler(request):
        seen.update(json.loads(request.content))
        return httpx.Response(200, json={"suggestions": [{"placePrediction": {
            "placeId": "ChIJ-es", "text": {"text": "Carrer de Balmes 1, Barcelona, España"},
            "structuredFormat": {"mainText": {"text": "Carrer de Balmes 1"},
                                 "secondaryText": {"text": "Barcelona, España"}}}}]})

    monkeypatch.setattr(
        places.httpx,
        "AsyncClient",
        lambda **kwargs: actual_client(transport=httpx.MockTransport(handler), **kwargs),
    )
    result = asyncio.run(places.address_suggestions("Balmes 1", TOKEN, "ES"))
    assert seen["includedRegionCodes"] == ["es"] and result["country"] == "ES"
    assert result["suggestions"][0]["mainText"] == "Carrer de Balmes 1"
    with pytest.raises(RuntimeError_) as error:
        asyncio.run(places.address_suggestions("Balmes 1", TOKEN, "FR"))
    assert error.value.code == "bad_address_country"


def test_endpoint_passes_the_workspace_country_to_the_adapter(client, monkeypatch):
    seen = []

    async def lookup(query, session, country="PE"):
        seen.append(country)
        return {"provider": "google-places", "country": country, "suggestions": []}

    monkeypatch.setattr(places, "address_suggestions", lookup)
    body = {"query": "Balmes 1", "sessionToken": TOKEN, "country": "ES"}
    response = client.post("/api/address-suggestions", json=body, headers={"Origin": ORIGIN})
    assert response.status_code == 200 and response.json()["country"] == "ES"
    peru = {"query": "Larco", "sessionToken": TOKEN}
    response = client.post("/api/address-suggestions", json=peru, headers={"Origin": ORIGIN})
    assert response.status_code == 200 and seen == ["ES", "PE"]


def test_missing_key_and_provider_failure_return_named_errors(monkeypatch):
    monkeypatch.setattr(config.settings, "places_key", "")
    with pytest.raises(RuntimeError_) as error:
        asyncio.run(places.address_suggestions("Larco", TOKEN))
    assert error.value.code == "places_missing"
    monkeypatch.setattr(config.settings, "places_key", "fixture-key")
    actual_client = httpx.AsyncClient
    monkeypatch.setattr(
        places.httpx,
        "AsyncClient",
        lambda **kwargs: actual_client(
            transport=httpx.MockTransport(
                lambda request: httpx.Response(403, json={"error": {"message": "fixture-key"}})
            ),
            **kwargs,
        ),
    )
    with pytest.raises(RuntimeError_) as failure:
        asyncio.run(places.address_suggestions("Larco", TOKEN))
    assert failure.value.code == "places_unavailable" and "fixture-key" not in str(failure.value)


@pytest.mark.parametrize(
    "body",
    [
        {"query": "a", "sessionToken": TOKEN},
        {"query": "a" * 201, "sessionToken": TOKEN},
        {"query": "Larco", "sessionToken": "bad token"},
        {"query": "Larco", "sessionToken": "x" * 37},
        {"query": "Larco", "sessionToken": TOKEN, "country": "FR"},
        {"query": "Larco", "sessionToken": TOKEN, "country": "es"},
    ],
)
def test_bad_input_is_rejected_before_lookup(client, monkeypatch, body):
    async def forbidden(*args):
        pytest.fail("invalid address input reached provider")

    monkeypatch.setattr(places, "address_suggestions", forbidden)
    assert client.post("/api/address-suggestions", json=body, headers={"Origin": ORIGIN}).status_code == 422


def test_endpoint_checks_origin_before_provider_and_limits_requests(client, monkeypatch):
    calls = []

    async def lookup(query, session, country="PE"):
        calls.append(query)
        return {"provider": "google-places", "country": "PE", "suggestions": []}

    monkeypatch.setattr(places, "address_suggestions", lookup)
    body = {"query": "Larco", "sessionToken": TOKEN}
    for headers in (
        {},
        {"Origin": "https://evil.example"},
        {"Origin": "https://kit.soyrocoto.com.evil.example"},
    ):
        assert client.post("/api/address-suggestions", json=body, headers=headers).status_code == 403
    assert calls == []
    for _ in range(30):
        response = client.post("/api/address-suggestions", json=body, headers={"Origin": ORIGIN})
        assert response.status_code == 200 and response.headers["cache-control"] == "no-store"
    response = client.post("/api/address-suggestions", json=body, headers={"Origin": ORIGIN})
    assert response.status_code == 429 and len(calls) == 30


def test_configured_runtime_origin_can_search_its_own_addresses(client, monkeypatch):
    monkeypatch.setattr(config.settings, "public_base", "https://demo.soyrocoto.com")

    async def lookup(query, session, country="PE"):
        return {"provider": "google-places", "country": "PE", "suggestions": []}

    monkeypatch.setattr(places, "address_suggestions", lookup)
    assert (
        client.post(
            "/api/address-suggestions",
            json={"query": "Larco", "sessionToken": TOKEN},
            headers={"Origin": "https://demo.soyrocoto.com"},
        ).status_code
        == 200
    )
