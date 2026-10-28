"""Owner fiscal authority and bank conservation use fixture evidence only."""

import asyncio
import json
import time
from pathlib import Path

import httpx
import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient

from runtime.cedar_service import create_app
from runtime.config import Settings


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return Settings(
        tmp_path,
        "https://collections.example",
        "operator-" + "x" * 40,
        Fernet.generate_key().decode(),
        allow_live=True,
    )


def owner(client: TestClient) -> tuple[str, dict[str, str]]:
    value = client.post("/api/cedar/workspaces", json={}).json()
    return value["id"], {"Authorization": "Bearer " + value["token"]}


def collection(**changes) -> dict:
    return {
        "invoice_id": "billing-draft-1",
        "document_id": "delivery-1",
        "seller_name": "Seller",
        "seller_ruc": "20123456789",
        "customer_name": "Buyer",
        "description": "Goods delivered",
        "amount_minor": 11800,
        "invoice_amount_minor": 11800,
        "currency": "PEN",
        "receiving_bank": "bbva",
        "account_label": "Receiving",
        "reference": "PAY-0001",
        "idempotency_key": "first",
        **changes,
    }


def bank_fixture(state: dict, request_id: str) -> None:
    state["providers"]["prometeo"] = {"environment": "live", "credentials": {"api_key": "fixture"}}
    state["bank"].update(
        status="logged_in",
        key="fixture-session",
        provider="bbva_pers_pe",
        receiving_account={
            "number": "123456789",
            "currency": "PEN",
            "bank": "bbva",
            "name": "Receiving",
            "balance_minor": 50000,
            "as_of": "2026-09-09T10:00:00Z",
        },
    )
    state["requests"][request_id].update(
        receiving_account_number="123456789", commissioned_at="2026-09-09T10:00:00Z"
    )


def movement(identity: str, amount: int, **changes) -> dict:
    return {
        "id": identity * 64,
        "provider": "bbva_pers_pe",
        "mode": "live",
        "allocated_to": None,
        "received_at": "2026-09-09T10:00:00Z",
        "movement": {
            "id": identity,
            "account_number": "123456789",
            "currency": "PEN",
            "reference": "PAY-0001",
            "detail": "Payment",
            "date": "2026-09-09",
            "debit_minor": 0,
            "credit_minor": amount,
            "extra_data": {"private": "omitted"},
            **changes,
        },
    }


def test_owner_bank_feed_partial_conservation_duplicate_and_isolation(settings: Settings) -> None:
    with TestClient(create_app(settings)) as client:
        wid, auth = owner(client)
        row = client.post("/api/cedar/requests", headers=auth, json=collection()).json()
        store = client.app.state.store

        def seed(state: dict) -> None:
            bank_fixture(state, row["id"])
            state["movements"] = {
                m["id"]: m
                for m in [movement("a", 4000), movement("b", 7800), movement("c", 9000, reference="OTHER")]
            }

        store.mutate(wid, seed)
        feed = client.get("/api/cedar/bank/movements", headers=auth)
        assert feed.status_code == 200
        assert (
            "123456789" not in feed.text and "private" not in feed.text and "fixture-session" not in feed.text
        )
        assert len(feed.json()["movements"]) == 3
        path = "/api/cedar/bank/match"
        body = {"movement_id": "a" * 64, "request_id": row["id"]}
        partial = client.post(path, headers=auth, json=body)
        assert partial.status_code == 200
        assert partial.json()["confirmed_minor"] == 4000 and partial.json()["balance_minor"] == 7800
        assert partial.json()["receipts"][0]["created_at"] == "2026-09-09T00:00:00-05:00"
        assert client.post(path, headers=auth, json=body).json()["confirmed_minor"] == 4000
        _, other = owner(client)
        assert client.get("/api/cedar/bank/movements", headers=other).json()["movements"] == []
        assert client.post(path, headers=other, json=body).status_code == 404
        final = client.post(path, headers=auth, json={**body, "movement_id": "b" * 64}).json()
        assert final["confirmed_minor"] == 11800 and final["balance_minor"] == 0
        feed = client.get("/api/cedar/bank/movements", headers=auth).json()["movements"]
        assert sum(m["allocated_minor"] for m in feed) == 11800
        assert all(m["allocated_minor"] + m["unallocated_minor"] == m["credit_minor"] for m in feed)


@pytest.mark.parametrize(
    "changes",
    [
        {"account_number": "other"},
        {"currency": "USD"},
        {"reference": "OTHER"},
        {"debit_minor": 1},
        {"credit_minor": 11801},
        {"credit_minor": 0},
    ],
)
def test_owner_bank_match_refuses_unsafe_evidence(settings: Settings, changes: dict) -> None:
    with TestClient(create_app(settings)) as client:
        wid, auth = owner(client)
        row = client.post("/api/cedar/requests", headers=auth, json=collection()).json()

        def seed(state: dict) -> None:
            bank_fixture(state, row["id"])
            evidence = movement("a", 4000, **changes)
            state["movements"][evidence["id"]] = evidence

        client.app.state.store.mutate(wid, seed)
        result = client.post(
            "/api/cedar/bank/match", headers=auth, json={"movement_id": "a" * 64, "request_id": row["id"]}
        )
        assert result.status_code == 409
        assert client.get(f"/api/cedar/requests/{row['id']}", headers=auth).json()["confirmed_minor"] == 0


def billing_draft(**changes) -> dict:
    return {
        "version": 1,
        "origin": "cedar-draft",
        "customer_id": "buyer-1",
        "customer_name": "Buyer",
        "customer_ruc": "20987654321",
        "customer_address": "Lima 123",
        "seller_name": "Seller",
        "seller_ruc": "20123456789",
        "series": "F001",
        "issued_date": "2026-09-09",
        "due_date": "2026-09-16",
        "currency": "PEN",
        "source_currency": "EUR",
        "source_total_minor": 2950,
        "fx_rate": "4",
        "tax_rate": 18,
        "net_minor": 10000,
        "tax_minor": 1800,
        "total_minor": 11800,
        "lines": [
            {"id": "line-1", "description": "Goods", "quantity": "2", "unit": "kg", "total_minor": 11800}
        ],
        **changes,
    }


def native_billing_draft(**changes) -> dict:
    values = {"version": 2, "source_currency": "PEN", "source_total_minor": 11800, "fx_rate": "1"}
    values.update(changes)
    return billing_draft(**values)


def test_native_pen_snapshot_and_legacy_eur_snapshot_both_retain_their_currency(settings: Settings) -> None:
    with TestClient(create_app(settings)) as client:
        _, auth = owner(client)
        current = client.post(
            "/api/cedar/requests",
            headers=auth,
            json=collection(billing_draft=native_billing_draft()),
        )
        assert current.status_code == 201
        assert current.json()["billing_draft"]["source_currency"] == "PEN"
        assert current.json()["billing_draft"]["fx_rate"] == "1"

        _, legacy_auth = owner(client)
        legacy = client.post(
            "/api/cedar/requests",
            headers=legacy_auth,
            json=collection(
                invoice_id="legacy-billing-draft",
                document_id="legacy-delivery",
                idempotency_key="legacy",
                billing_draft=billing_draft(),
            ),
        )
        assert legacy.status_code == 201
        assert legacy.json()["billing_draft"]["source_currency"] == "EUR"
        assert legacy.json()["billing_draft"]["fx_rate"] == "4"


def commission(client: TestClient, settings: Settings, wid: str) -> dict[str, str]:
    admin = {"Authorization": "Bearer " + settings.admin_token}
    base = f"/api/operator/workspaces/{wid}"
    result = client.post(
        base + "/providers",
        headers=admin,
        json={
            "provider": "nubefact",
            "environment": "live",
            "credentials": {
                "api_url": "https://api.nubefact.com/api/v1/fixture-route",
                "token": "fixture-token",
                "seller_ruc": "20123456789",
            },
        },
    )
    assert result.status_code == 200
    result = client.post(
        base + "/invoices/commission",
        headers=admin,
        json={
            "seller_ruc": "20123456789",
            "series": "F001",
            "next_number": 42,
            "unit_codes": {"kg": "KGM"},
            "seller_authorization_confirmed": True,
            "numbering_exclusive_confirmed": True,
        },
    )
    assert result.status_code == 200
    return admin


def approval(row: dict, **changes) -> dict:
    return {
        "draft_fingerprint": row["fiscal"].get("draft_fingerprint", "a" * 64),
        "real_document_confirmed": True,
        "seller_authorization_confirmed": True,
        "auto_issue_after_payment": False,
        **changes,
    }


def test_fiscal_draft_immutable_and_old_samples_cannot_gain_live_issuance(settings: Settings) -> None:
    with TestClient(create_app(settings)) as client:
        wid, auth = owner(client)
        row = client.post("/api/cedar/requests", headers=auth, json=collection()).json()
        assert row["fiscal"]["phase"] == "unprepared"
        assert "draft_fingerprint" not in row["fiscal"] and "issue_date_policy" not in row["fiscal"]
        admin = commission(client, settings, wid)
        assert (
            client.post(
                f"/api/operator/workspaces/{wid}/requests/{row['id']}/invoice/authorize",
                headers=admin,
                json=approval(row, draft_fingerprint="a" * 64),
            ).status_code
            == 409
        )
        assert (
            client.post(
                "/api/cedar/requests",
                headers=auth,
                json=collection(idempotency_key="refresh", billing_draft=billing_draft()),
            ).status_code
            == 409
        )
        assert "fiscal" not in client.get(row["buyer_url"] + "/status").json()
        assert (
            client.post(f"/api/cedar/requests/{row['id']}/invoice", headers=auth, json={}).status_code == 409
        )


@pytest.mark.parametrize(
    "draft",
    [
        billing_draft(version=2),
        native_billing_draft(fx_rate="1.01"),
        billing_draft(total_minor=11799),
        billing_draft(tax_minor=1700),
        billing_draft(seller_ruc="20000000000"),
        billing_draft(customer_name="Different"),
        billing_draft(
            lines=[{"id": "x", "description": "Goods", "quantity": "0", "unit": "kg", "total_minor": 11800}]
        ),
    ],
)
def test_fiscal_snapshot_rejects_unconserved_or_wrong_party_data(settings: Settings, draft: dict) -> None:
    with TestClient(create_app(settings)) as client:
        _, auth = owner(client)
        result = client.post("/api/cedar/requests", headers=auth, json=collection(billing_draft=draft))
        assert result.status_code in {409, 422}


def test_paid_draft_issuance_once_unknown_outcome_query_and_restart(settings: Settings) -> None:
    operations: list[dict] = []
    accepted = [False]

    def transport(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        operations.append(body)
        assert request.url.host == "api.nubefact.com" and request.headers["authorization"] == "fixture-token"
        assert body["numero"] == 42 and body["serie"] == "F001"
        if body["operacion"] == "generar_comprobante":
            assert body["cliente_numero_de_documento"] == "20987654321"
            assert body["items"][0]["unidad_de_medida"] == "KGM"
            assert body["enviar_automaticamente_al_cliente"] is False
            raise httpx.ReadTimeout("fixture private timeout", request=request)
        return httpx.Response(
            200,
            json={"tipo_de_comprobante": 1, "serie": "F001", "numero": 42, "aceptada_por_sunat": accepted[0]},
        )

    provider = httpx.AsyncClient(transport=httpx.MockTransport(transport))
    try:
        with TestClient(create_app(settings, http_client=provider)) as client:
            wid, auth = owner(client)
            row = client.post(
                "/api/cedar/requests", headers=auth, json=collection(billing_draft=billing_draft())
            ).json()
            assert row["fiscal"]["phase"] == "awaiting-authorization"
            admin = commission(client, settings, wid)

            def seed(state: dict) -> None:
                bank_fixture(state, row["id"])
                state["movements"] = {m["id"]: m for m in [movement("a", 4000), movement("b", 7800)]}

            client.app.state.store.mutate(wid, seed)
            authorize = f"/api/operator/workspaces/{wid}/requests/{row['id']}/invoice/authorize"
            assert client.post(authorize, headers=auth, json=approval(row)).status_code == 401
            assert (
                client.post(
                    authorize, headers=admin, json=approval(row, draft_fingerprint="b" * 64)
                ).status_code
                == 409
            )
            authorized = client.post(authorize, headers=admin, json=approval(row)).json()
            assert authorized["fiscal"]["number"] == 42 and not authorized["fiscal"]["can_issue"]
            assert client.post(authorize, headers=admin, json=approval(row)).json()["fiscal"]["number"] == 42
            path = f"/api/cedar/requests/{row['id']}/invoice"
            assert client.post(path, headers=auth, json={}).status_code == 409 and operations == []
            for identity in ("a", "b"):
                assert (
                    client.post(
                        "/api/cedar/bank/match",
                        headers=auth,
                        json={"movement_id": identity * 64, "request_id": row["id"]},
                    ).status_code
                    == 200
                )
            paid = client.get(f"/api/cedar/requests/{row['id']}", headers=auth).json()
            assert paid["fiscal"]["can_issue"] and paid["confirmed_minor"] == 11800
            result = client.post(path, headers=auth, json={}).json()
            assert result["fiscal"]["phase"] == "query-required"
            assert client.post(path, headers=auth, json={}).json()["fiscal"]["phase"] == "query-required"
            assert len(operations) == 1
            assert "fixture-token" not in json.dumps(result) and "payload" not in result["fiscal"]
            _, other = owner(client)
            assert client.post(path + "/query", headers=other, json={}).status_code == 404
        with TestClient(create_app(settings, http_client=provider)) as restarted:
            assert restarted.post(path, headers=auth, json={}).json()["fiscal"]["phase"] == "query-required"
            assert len(operations) == 1
            result = restarted.post(path + "/query", headers=auth, json={}).json()
            assert result["fiscal"]["phase"] == "pending"
            accepted[0] = True
            result = restarted.post(path + "/query", headers=auth, json={}).json()
            assert result["fiscal"]["phase"] == "accepted" and result["fiscal"]["mode"] == "live"
            assert result["confirmed_minor"] == 11800
            accepted[0] = False
            assert restarted.post(path + "/query", headers=auth, json={}).status_code == 409
    finally:
        asyncio.run(provider.aclose())


def test_owner_paid_claim_cannot_issue_and_seller_series_has_one_workspace(settings: Settings) -> None:
    operations: list[str] = []

    def transport(request: httpx.Request) -> httpx.Response:
        operations.append(request.url.path)
        raise AssertionError("This workflow must stay local")

    provider = httpx.AsyncClient(transport=httpx.MockTransport(transport))
    try:
        with TestClient(create_app(settings, http_client=provider)) as client:
            wid, auth = owner(client)
            row = client.post(
                "/api/cedar/requests", headers=auth, json=collection(billing_draft=billing_draft())
            ).json()
            admin = commission(client, settings, wid)
            client.app.state.store.mutate(wid, lambda state: bank_fixture(state, row["id"]))
            path = f"/api/operator/workspaces/{wid}/requests/{row['id']}/invoice/authorize"
            assert client.post(path, headers=admin, json=approval(row)).status_code == 200
            paid = client.post(
                f"/api/cedar/requests/{row['id']}/receipts",
                headers=auth,
                json={
                    "amount_minor": 11800,
                    "currency": "PEN",
                    "reference": "owner-claim",
                    "source": "manual",
                    "method": "cash",
                },
            ).json()
            assert (
                paid["balance_minor"] == 0
                and paid["confirmed_minor"] == 0
                and not paid["fiscal"]["can_issue"]
            )
            issue = f"/api/cedar/requests/{row['id']}/invoice"
            assert client.post(issue, headers=auth, json={}).status_code == 409
            assert (
                client.post(
                    issue, headers=auth, json={"accepted": True, "confirmed_minor": 11800}
                ).status_code
                == 422
            )
            wid2, _ = owner(client)
            otherbase = f"/api/operator/workspaces/{wid2}"
            client.post(
                otherbase + "/providers",
                headers=admin,
                json={
                    "provider": "nubefact",
                    "environment": "live",
                    "credentials": {
                        "api_url": "https://api.nubefact.com/api/v1/fixture-other",
                        "token": "other-token",
                        "seller_ruc": "20123456789",
                    },
                },
            )
            result = client.post(
                otherbase + "/invoices/commission",
                headers=admin,
                json={
                    "seller_ruc": "20123456789",
                    "series": "F001",
                    "next_number": 42,
                    "unit_codes": {"kg": "KGM"},
                    "seller_authorization_confirmed": True,
                    "numbering_exclusive_confirmed": True,
                },
            )
            assert result.status_code == 409 and result.json()["error"] == "invoice_series_already_bound"
            assert client.app.state.store.read(wid2).get("fiscal_series", {}) == {}
            assert operations == []
    finally:
        asyncio.run(provider.aclose())


@pytest.mark.parametrize(
    "code,phase", [(None, "accepted"), (20, "rejected"), (22, "rejected"), (23, "query-required")]
)
def test_auto_issue_waits_for_full_authoritative_payment_and_preserves_rejection(
    settings: Settings, code: int | None, phase: str
) -> None:
    operations: list[dict] = []

    def transport(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        operations.append(body)
        if code:
            return httpx.Response(200, json={"errors": "private provider detail", "codigo": code})
        return httpx.Response(
            200, json={"tipo_de_comprobante": 1, "serie": "F001", "numero": 42, "aceptada_por_sunat": True}
        )

    provider = httpx.AsyncClient(transport=httpx.MockTransport(transport))
    try:
        with TestClient(create_app(settings, http_client=provider)) as client:
            wid, auth = owner(client)
            row = client.post(
                "/api/cedar/requests",
                headers=auth,
                json=collection(billing_draft=billing_draft(issued_date="2025-08-22")),
            ).json()
            admin = commission(client, settings, wid)

            def seed(state: dict) -> None:
                bank_fixture(state, row["id"])
                state["movements"] = {m["id"]: m for m in [movement("a", 4000), movement("b", 7800)]}

            client.app.state.store.mutate(wid, seed)
            assert (
                client.post(
                    f"/api/operator/workspaces/{wid}/requests/{row['id']}/invoice/authorize",
                    headers=admin,
                    json=approval(row, auto_issue_after_payment=True),
                ).status_code
                == 200
            )
            first = client.post(
                "/api/cedar/bank/match", headers=auth, json={"request_id": row["id"], "movement_id": "a" * 64}
            ).json()
            assert first["balance_minor"] == 7800 and operations == []
            result = client.post(
                "/api/cedar/bank/match", headers=auth, json={"request_id": row["id"], "movement_id": "b" * 64}
            ).json()
            assert result["fiscal"]["phase"] == phase
            assert operations[0]["fecha_de_emision"] != "22-08-2025"
            assert result["fiscal"]["issue_date"] and len(operations) == 1
            assert "private provider detail" not in json.dumps(result)
            client.post(
                "/api/cedar/bank/match", headers=auth, json={"request_id": row["id"], "movement_id": "b" * 64}
            )
            client.post(f"/api/cedar/requests/{row['id']}/invoice", headers=auth, json={})
            assert len(operations) == 1
            if code:
                assert not result["fiscal"]["can_query"]
                assert (
                    client.post(
                        f"/api/cedar/requests/{row['id']}/invoice/query", headers=auth, json={}
                    ).status_code
                    == 409
                )
                assert len(operations) == 1
    finally:
        asyncio.run(provider.aclose())


def test_bank_keys_and_account_alone_do_not_promote_unpaid_example(settings: Settings) -> None:
    with TestClient(create_app(settings)) as client:
        wid, auth = owner(client)
        row = client.post("/api/cedar/requests", headers=auth, json=collection()).json()

        def seed(state: dict) -> None:
            bank_fixture(state, row["id"])
            state["requests"][row["id"]].pop("commissioned_at")
            state["movements"]["a" * 64] = movement("a", 11800)

        client.app.state.store.mutate(wid, seed)
        assert (
            client.post(
                "/api/cedar/bank/match", headers=auth, json={"request_id": row["id"], "movement_id": "a" * 64}
            ).status_code
            == 409
        )
        result = client.get(f"/api/cedar/requests/{row['id']}", headers=auth).json()
        assert result["confirmed_minor"] == 0 and result["balance_minor"] == 11800


def test_durable_auto_issue_recovers_paid_transaction_before_http_claim(settings: Settings) -> None:
    operations: list[str] = []

    def transport(request: httpx.Request) -> httpx.Response:
        operations.append(json.loads(request.content)["operacion"])
        return httpx.Response(
            200, json={"tipo_de_comprobante": 1, "serie": "F001", "numero": 42, "aceptada_por_sunat": True}
        )

    provider = httpx.AsyncClient(transport=httpx.MockTransport(transport))
    try:
        with TestClient(create_app(settings, http_client=provider)) as client:
            wid, auth = owner(client)
            row = client.post(
                "/api/cedar/requests", headers=auth, json=collection(billing_draft=billing_draft())
            ).json()
            admin = commission(client, settings, wid)
            store = client.app.state.store
            store.mutate(wid, lambda state: bank_fixture(state, row["id"]))
            client.post(
                f"/api/operator/workspaces/{wid}/requests/{row['id']}/invoice/authorize",
                headers=admin,
                json=approval(row, auto_issue_after_payment=True),
            )

            def persist_payment_before_worker(state: dict) -> None:
                store.add_receipt(
                    state,
                    state["requests"][row["id"]],
                    {
                        "amount_minor": 11800,
                        "currency": "PEN",
                        "reference": "fixture-bank-evidence",
                        "source": "prometeo",
                        "method": "transfer",
                        "verification": "prometeo-live",
                        "created_at": "2026-09-09T10:00:00Z",
                    },
                )

            store.mutate(wid, persist_payment_before_worker)
            assert store.due_fiscal(time.time()) == [wid] and operations == []
        with TestClient(create_app(settings, http_client=provider)) as restarted:
            restarted.portal.call(restarted.app.state.run_fiscal_pending)
            result = restarted.get(f"/api/cedar/requests/{row['id']}", headers=auth).json()
            assert result["fiscal"]["phase"] == "accepted"
            assert operations == ["generar_comprobante"]
            assert restarted.app.state.store.due_fiscal(time.time()) == []
    finally:
        asyncio.run(provider.aclose())
