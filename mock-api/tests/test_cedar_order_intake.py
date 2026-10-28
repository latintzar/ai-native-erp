"""Structured Cedar order reading uses synthetic provider answers and private workspaces only."""

import asyncio
import json

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import cedar_access, cedar_order_intake
from app.config import settings
from app.errors import RuntimeError_


def payload(**patch):
    value = {
        "text": "Please send 12 kg merluza tomorrow",
        "sourceEvent": "wamid.synthetic-1",
        "referenceDay": "2026-09-10",
        "customerId": "cansole",
        "products": [{"id": "merluza", "name": "Merluza", "unit": "kg"}],
    }
    value.update(patch)
    return value


def test_shape_rejects_invalid_calendar_and_collection_shapes():
    with pytest.raises(Exception) as invalid_day:
        cedar_order_intake.shape(payload(referenceDay="2026-99-99"))
    assert invalid_day.value.status_code == 400
    for products in ("merluza", {}, None):
        with pytest.raises(Exception) as invalid_products:
            cedar_order_intake.shape(payload(products=products))
        assert invalid_products.value.status_code == 400


def test_model_reading_keeps_exact_quotes_unknown_lines_and_requires_date_evidence(
    monkeypatch,
):
    answer = json.dumps({
        "isOrder": True,
        "needsReply": True,
        "deliveryDay": "2026-09-11",
        "deliveryRaw": "tomorrow",
        "lines": [
            {
                "rawText": "12 kg merluza",
                "item": "merluza",
                "qty": 12,
                "unit": "kg",
                "productId": "merluza",
                "confidence": "high",
            },
            {
                "rawText": "tomorrow",
                "item": "house special",
                "qty": None,
                "unit": "",
                "productId": {"invented": "sku"},
                "confidence": "medium",
            },
            {
                "rawText": "words the customer never sent",
                "item": "hallucination",
                "qty": 4,
                "unit": "kg",
                "productId": "merluza",
                "confidence": "high",
            },
        ],
    })

    async def provider(_client, _system, _turns):
        return answer, 37

    monkeypatch.setattr(settings, "copilot_model", "gemini")
    monkeypatch.setattr(settings, "gemini_key", "synthetic-key")
    monkeypatch.setitem(cedar_order_intake.copilot.PROVIDERS, "gemini", provider)
    result = asyncio.run(cedar_order_intake.parse(payload()))
    assert result["mode"] == "model"
    assert result["deliveryDay"] == "2026-09-11"
    assert result["evidence"]["tokens"] == 37
    assert result["lines"] == [
        {
            "rawText": "12 kg merluza",
            "item": "merluza",
            "qty": 12,
            "unit": "kg",
            "productId": "merluza",
            "confidence": "high",
        },
        {
            "rawText": "tomorrow",
            "item": "house special",
            "qty": None,
            "unit": "",
            "productId": None,
            "confidence": "medium",
        },
    ]

    missing_date_quote = answer.replace('"deliveryRaw": "tomorrow"', '"deliveryRaw": "Friday"')

    async def ungrounded_date(_client, _system, _turns):
        return missing_date_quote, 2

    monkeypatch.setitem(cedar_order_intake.copilot.PROVIDERS, "gemini", ungrounded_date)
    assert asyncio.run(cedar_order_intake.parse(payload()))["deliveryDay"] is None


def test_route_requires_workspace_and_charges_only_an_authorized_owner(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "state_dir", tmp_path)
    charges = []
    monkeypatch.setattr(cedar_order_intake.cedar_source_budget, "charge", charges.append)

    async def provider(_client, _system, _turns):
        return '{"isOrder":false,"needsReply":true,"deliveryDay":null,"deliveryRaw":null,"lines":[]}', 1

    monkeypatch.setattr(settings, "copilot_model", "gemini")
    monkeypatch.setattr(settings, "gemini_key", "synthetic-key")
    monkeypatch.setitem(cedar_order_intake.copilot.PROVIDERS, "gemini", provider)
    app = FastAPI()
    app.include_router(cedar_access.router)
    app.include_router(cedar_order_intake.router)
    with TestClient(app) as client:
        assert client.post("/api/cedar/orders/parse", json=payload()).status_code == 401
        workspace = client.post("/api/cedar/access/workspaces", json={}).json()
        response = client.post(
            "/api/cedar/orders/parse",
            json=payload(),
            headers={"Authorization": "Bearer " + workspace["access_token"]},
        )
    assert response.status_code == 200
    assert response.json()["needsReply"] is True
    assert charges == [workspace["workspace_id"]]


def test_missing_runtime_key_is_explicit(monkeypatch):
    monkeypatch.setattr(settings, "copilot_model", "gemini")
    monkeypatch.setattr(settings, "gemini_key", "")
    with pytest.raises(RuntimeError_) as error:
        asyncio.run(cedar_order_intake.parse(payload()))
    assert error.value.code == "order_intake_unconfigured"
    assert error.value.status == 503
