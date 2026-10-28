import base64
import json
import re
from dataclasses import replace
from datetime import datetime, timedelta, timezone
from io import BytesIO
from pathlib import Path

import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
from PIL import Image

from runtime.cedar_service import create_app
from runtime.config import Settings
from runtime.providers import sample_bank


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return Settings(
        tmp_path,
        "https://collections.example",
        "operator-" + "x" * 40,
        Fernet.generate_key().decode(),
        cedar_allowed_origins=("http://127.0.0.1:8094",),
    )


def owner(client: TestClient) -> tuple[str, dict[str, str]]:
    value = client.post("/api/cedar/workspaces", json={}).json()
    return value["id"], {"Authorization": "Bearer " + value["token"]}


def request_data(**changes) -> dict:
    return {
        "invoice_id": "invoice-1",
        "document_id": "note-1",
        "seller_name": "Sample seller",
        "description": "Invoice F001-1",
        "customer_name": "Sample buyer",
        "amount_minor": 10000,
        "invoice_amount_minor": 10000,
        "currency": "PEN",
        "receiving_bank": "bbva",
        "account_label": "Receiving account",
        "reference": "F001-1",
        "idempotency_key": "first",
        "sample_clock": "2025-08-22T10:00:00Z",
        **changes,
    }


def receipt(**changes) -> dict:
    return {
        "amount_minor": 4000,
        "currency": "PEN",
        "reference": "sample-1",
        "method": "yape",
        "source": "sample",
        **changes,
    }


def test_destination_is_operator_owned_raster_bound_to_real_account(settings: Settings) -> None:
    app = create_app(replace(settings, allow_live=True))
    buffer = BytesIO()
    Image.new("RGB", (128, 128)).save(buffer, "PNG")
    image = base64.b64encode(buffer.getvalue()).decode()
    admin = {"Authorization": "Bearer " + settings.admin_token}
    with TestClient(app) as client:
        wid, auth = owner(client)
        row = client.post("/api/cedar/requests", headers=auth, json=request_data()).json()
        path = f"/api/operator/workspaces/{wid}/destination"
        data = {
            "method": "yape",
            "account_number": "123456789",
            "currency": "PEN",
            "qr_base64": image,
            "phone": "987654321",
            "account_ownership_confirmed": True,
            "request_ids": [row["id"]],
            "real_documents_confirmed": True,
        }
        assert client.post(path, headers=auth, json=data).status_code == 401
        assert client.post(path, headers=admin, json=data).status_code == 409

        def commissioned(state: dict) -> None:
            state["providers"]["prometeo"] = {"environment": "live", "credentials": {"api_key": "fixture"}}
            state["bank"]["receiving_account"] = {
                "bank": "bbva",
                "number": "123456789",
                "currency": "PEN",
                "name": "Receiving account",
            }
            state["requests"][row["id"]]["receiving_account_number"] = "123456789"

        app.state.store.mutate(wid, commissioned)
        sample = client.post(
            "/api/cedar/requests",
            headers=auth,
            json=request_data(
                invoice_id="sample-unpaid", reference="F001-2", idempotency_key="sample-unpaid"
            ),
        ).json()
        assert client.post(path, headers=admin, json={**data, "account_number": "987"}).status_code == 409
        svg = base64.b64encode(
            b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
        ).decode()
        assert client.post(path, headers=admin, json={**data, "qr_base64": svg}).status_code == 422
        configured = client.post(path, headers=admin, json=data)
        assert configured.status_code == 200
        assert "qr_base64" not in configured.text and "123456789" not in configured.text
        public = client.get(row["buyer_url"] + "/status").json()
        assert public["destination"]["method"] == "yape" and public["destination"]["mode"] == "live"
        assert public["destination"]["account_mask"].endswith("6789")
        assert client.get(sample["buyer_url"] + "/status").json()["destination"] is None
        future = client.post(
            "/api/cedar/requests",
            headers=auth,
            json=request_data(
                invoice_id="sample-future", reference="F001-3", idempotency_key="sample-future"
            ),
        ).json()
        assert future["destination"] is None
        qr = client.get(row["buyer_url"] + "/qr")
        assert qr.status_code == 200 and qr.headers["content-type"] == "image/png"
        assert qr.content.startswith(b"\x89PNG")
        assert client.get(row["buyer_url"].rsplit("/", 1)[0] + "/wrong/qr").status_code == 404
        assert client.post(path, headers=admin, json={**data, "phone": "912345678"}).status_code == 409
        assert client.post(path, headers=admin, json=data).status_code == 200
        assert (
            client.post(f"/api/cedar/requests/{row['id']}/receipts", headers=auth, json=receipt()).status_code
            == 409
        )


def test_isolation_partial_duplicate_refresh_and_restart(settings: Settings) -> None:
    app = create_app(settings)
    with TestClient(app) as client:
        _, auth = owner(client)
        _, outsider = owner(client)
        created = client.post("/api/cedar/requests", json=request_data(), headers=auth)
        assert created.status_code == 201
        request = created.json()
        url = request["buyer_url"]
        rid = request["id"]
        path = f"/api/cedar/requests/{rid}"
        assert client.get(path, headers=outsider).status_code == 404
        assert client.get(path).status_code == 401
        paid = client.post(path + "/receipts", headers=auth, json=receipt()).json()
        assert paid["balance_minor"] == 6000 and paid["sample_minor"] == 4000 and paid["confirmed_minor"] == 0
        assert paid["receipts"][0]["created_at"].startswith("2025-08-22")
        assert client.post(path + "/receipts", headers=auth, json=receipt()).json() == paid
        updated = client.post(
            "/api/cedar/requests",
            headers=auth,
            json=request_data(amount_minor=6000, idempotency_key="refresh"),
        ).json()
        assert updated["id"] == rid and updated["buyer_url"] == url
        assert client.get(url + "/status").json()["balance_minor"] == 6000
        client.post(
            path + "/receipts",
            headers=auth,
            json=receipt(amount_minor=6000, reference="second", source="manual"),
        )
        over = client.post(
            path + "/receipts", headers=auth, json=receipt(reference="over", amount_minor=10000)
        ).json()
        assert over["status"] == "paid" and over["balance_minor"] == 0
        assert over["receipts"][-1]["status"] == "review"
        assert over["confirmed_minor"] == 0 and over["manual_minor"] == 6000
    with TestClient(create_app(settings)) as restarted:
        result = restarted.get(url + "/status").json()
        assert result["status"] == "paid" and result["sample_minor"] == 4000
        assert restarted.get(path, headers=auth).json()["balance_minor"] == 0


def test_initial_receipts_atomic_immutable_and_cross_invoice_reference(settings: Settings) -> None:
    with TestClient(create_app(settings)) as client:
        _, auth = owner(client)
        partial = request_data(
            amount_minor=6000, initial_receipts=[receipt(created_at="2025-08-21T10:00:00Z")]
        )
        first = client.post("/api/cedar/requests", headers=auth, json=partial)
        assert first.status_code == 201
        assert client.post("/api/cedar/requests", headers=auth, json=partial).json() == first.json()
        assert (
            client.post(
                "/api/cedar/requests", headers=auth, json={**partial, "amount_minor": 5000}
            ).status_code
            == 409
        )
        bad = request_data(
            invoice_id="invoice-2",
            reference="F001-2",
            idempotency_key="second",
            amount_minor=6000,
            initial_receipts=[receipt()],
        )
        assert client.post("/api/cedar/requests", headers=auth, json=bad).status_code == 409
        assert len(client.get("/api/cedar/requests", headers=auth).json()) == 1
        bad["initial_receipts"] = [receipt(reference="distinct")]
        assert client.post("/api/cedar/requests", headers=auth, json=bad).status_code == 201


def test_bank_spoof_and_legacy_gateways_unavailable(settings: Settings) -> None:
    with TestClient(create_app(settings)) as client:
        wid, auth = owner(client)
        row = client.post("/api/cedar/requests", headers=auth, json=request_data()).json()
        path = f"/api/cedar/requests/{row['id']}/receipts"
        assert client.post(path, headers=auth, json=receipt(source="prometeo")).status_code == 422
        assert (
            client.post(
                f"/api/operator/workspaces/{wid}/bank/match",
                headers=auth,
                json={"movement_id": "fake", "request_id": row["id"]},
            ).status_code
            == 401
        )
        assert client.post(row["buyer_url"], json=receipt()).status_code == 405
        for path in ("/api/sellers", "/api/requests", "/api/oauth/mercadopago/start"):
            assert client.post(path, headers=auth, json={}).status_code == 404
        op = {"Authorization": "Bearer " + settings.admin_token}
        assert client.get("/api/config", headers=op).json()["providers"] == ["prometeo", "nubefact"]
        assert "Mercado" not in client.get("/").text


def test_cors_secret_redaction_and_currency_review(settings: Settings) -> None:
    with TestClient(create_app(settings)) as client:
        wid, auth = owner(client)
        allowed = {
            "Origin": "https://demo.soyrocoto.com",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,content-type",
        }
        assert (
            client.options("/api/cedar/requests", headers=allowed).headers["access-control-allow-origin"]
            == allowed["Origin"]
        )
        assert (
            client.post(
                "/api/cedar/workspaces", json={}, headers={"Origin": "https://elsewhere.example"}
            ).status_code
            == 403
        )
        result = client.post(
            f"/api/operator/workspaces/{wid}/providers",
            headers={"Authorization": "Bearer " + settings.admin_token},
            json={"provider": "other", "credentials": {"api_key": "private-test-only"}},
        )
        assert result.status_code == 422 and "private-test-only" not in result.text
        row = client.post("/api/cedar/requests", headers=auth, json=request_data()).json()
        result = client.post(
            f"/api/cedar/requests/{row['id']}/receipts", headers=auth, json=receipt(currency="USD")
        ).json()
        assert result["receipts"][0]["status"] == "review" and result["balance_minor"] == 10000


def test_bank_reference_requires_commissioned_receiving_account(settings: Settings) -> None:
    with TestClient(create_app(settings)) as client:
        wid, auth = owner(client)
        row = client.post("/api/cedar/requests", headers=auth, json=request_data()).json()
        evidence = {
            "id": "a" * 64,
            "provider": "bbva_pers_pe",
            "allocated_to": None,
            "movement": {
                "account_number": "different-account",
                "currency": "PEN",
                "debit_minor": 0,
                "credit_minor": 10000,
                "reference": "F001-1",
                "date": "2026-09-09",
            },
        }
        client.app.state.store.mutate(wid, lambda state: state["movements"].update({"a" * 64: evidence}))
        result = client.post(
            f"/api/operator/workspaces/{wid}/bank/match",
            headers={"Authorization": "Bearer " + settings.admin_token},
            json={"movement_id": "a" * 64, "request_id": row["id"]},
        )
        assert result.status_code == 409
        assert client.get(f"/api/cedar/requests/{row['id']}", headers=auth).json()["confirmed_minor"] == 0


def test_authenticated_bank_read_auto_matches_bound_reference_and_separates_sandbox(
    settings: Settings,
) -> None:
    import asyncio

    import httpx

    def transport(request: httpx.Request) -> httpx.Response:
        assert request.url.host == "test.prometeo.qualia.uy"
        if request.url.path == "/login/":
            return httpx.Response(200, json={"status": "logged_in", "key": "fixture-session"})
        if request.url.path == "/account/":
            return httpx.Response(
                200,
                json={
                    "status": "success",
                    "accounts": [
                        {
                            "id": "a",
                            "number": "00123",
                            "name": "Receiving",
                            "currency": "PEN",
                            "balance": "120.00",
                        }
                    ],
                },
            )
        assert request.url.path == "/movement/"
        return httpx.Response(
            200,
            json={
                "status": "success",
                "movements": [
                    {
                        "id": "m1",
                        "reference": "F001-1",
                        "date": "22/08/2025",
                        "detail": "Transfer",
                        "credit": "100.00",
                        "debit": "0.00",
                    }
                ],
            },
        )

    provider = httpx.AsyncClient(transport=httpx.MockTransport(transport))
    try:
        with TestClient(create_app(settings, http_client=provider)) as client:
            wid, auth = owner(client)
            request = client.post("/api/cedar/requests", headers=auth, json=request_data()).json()
            admin = {"Authorization": "Bearer " + settings.admin_token}
            base = f"/api/operator/workspaces/{wid}"
            assert (
                client.post(
                    base + "/providers",
                    headers=admin,
                    json={
                        "provider": "prometeo",
                        "environment": "sandbox",
                        "credentials": {"api_key": "fixture-key"},
                    },
                ).status_code
                == 200
            )
            login = client.post(
                base + "/bank/login",
                headers=admin,
                json={"provider": "bbva_pers_pe", "username": "fixture", "password": "fixture-password"},
            )
            assert login.status_code == 200 and "fixture-session" not in login.text
            assert client.get("/api/cedar/bank", headers=auth).json()["ready"] is False
            result = client.post(
                base + "/bank/select-account",
                headers=admin,
                json={"account_number": "00123", "currency": "PEN"},
            )
            assert result.json()["balance_minor"] == 12000
            assert result.json()["account_mask"] == "•••• 0123"
            read = {
                "account_number": "00123",
                "currency": "PEN",
                "date_start": "2025-08-22",
                "date_end": "2025-08-22",
            }
            assert client.post(base + "/bank/movements", headers=admin, json=read).status_code == 200
            assert client.post(base + "/bank/movements", headers=admin, json=read).status_code == 200
            state = client.get(f"/api/cedar/requests/{request['id']}", headers=auth).json()
            assert state["status"] == "paid" and len(state["receipts"]) == 1
            assert state["sample_minor"] == 10000 and state["confirmed_minor"] == 0
            assert "fixture-password" not in repr(client.app.state.store.read(wid))
    finally:
        asyncio.run(provider.aclose())


def test_monitor_requires_commissioning_and_automatically_matches_with_backoff(settings: Settings) -> None:
    import asyncio
    from datetime import datetime, timezone

    import httpx

    clock = [datetime(2025, 8, 22, tzinfo=timezone.utc).timestamp()]
    calls: list[str] = []
    unavailable = [False]

    def transport(request: httpx.Request) -> httpx.Response:
        calls.append(request.url.path)
        assert request.url.host == "prometeo.qualia.uy"
        if unavailable[0]:
            return httpx.Response(503)
        if request.url.path == "/account/":
            return httpx.Response(
                200,
                json={
                    "status": "success",
                    "accounts": [
                        {
                            "id": "a",
                            "number": "00123",
                            "name": "Receiving",
                            "currency": "PEN",
                            "balance": "345.67",
                        }
                    ],
                },
            )
        assert request.url.path == "/movement/"
        return httpx.Response(
            200,
            json={
                "status": "success",
                "movements": [
                    {
                        "id": "auto-1",
                        "reference": "F001-1",
                        "date": "22/08/2025",
                        "detail": "Transfer",
                        "credit": "100.00",
                        "debit": "0.00",
                    }
                ],
            },
        )

    provider = httpx.AsyncClient(transport=httpx.MockTransport(transport))
    app = create_app(replace(settings, allow_live=True), http_client=provider, clock=lambda: clock[0])
    try:
        with TestClient(app) as client:
            wid, auth = owner(client)
            item = client.post("/api/cedar/requests", headers=auth, json=request_data()).json()
            base = f"/api/operator/workspaces/{wid}/bank/monitor"
            admin = {"Authorization": "Bearer " + settings.admin_token}
            assert client.post(base, headers=auth, json={"enabled": True}).status_code == 401
            assert client.post(base, headers=admin, json={"enabled": True}).status_code == 409

            def commission(state: dict) -> None:
                state["providers"]["prometeo"] = {
                    "environment": "live",
                    "credentials": {"api_key": "fixture"},
                }
                state["bank"].update(
                    status="logged_in",
                    key="fixture-session",
                    provider="bbva_pers_pe",
                    receiving_account={
                        "bank": "bbva",
                        "number": "00123",
                        "currency": "PEN",
                        "name": "Receiving",
                        "balance_minor": 0,
                        "as_of": "2025-08-22T00:00:00Z",
                    },
                )
                state["requests"][item["id"]]["receiving_account_number"] = "00123"
                state["requests"][item["id"]]["commissioned_at"] = "2025-08-22T00:00:00Z"

            app.state.store.mutate(wid, commission)
            assert calls == []
            assert client.post(base, headers=admin, json={"enabled": True}).status_code == 200
            client.portal.call(app.state.run_bank_monitors)
            actual = client.get(f"/api/cedar/requests/{item['id']}", headers=auth).json()
            assert actual["confirmed_minor"] == 10000 and actual["sample_minor"] == 0
            snapshot = client.get("/api/cedar/bank", headers=auth).json()
            assert snapshot["balance_minor"] == 34567 and snapshot["monitor"]["status"] == "scheduled"
            assert snapshot["monitor"]["last_success"]
            assert calls == ["/account/", "/movement/"]
            client.portal.call(app.state.run_bank_monitors)
            assert len(calls) == 2
            clock[0] += 301
            unavailable[0] = True
            client.portal.call(app.state.run_bank_monitors)
            monitor = client.get("/api/cedar/bank", headers=auth).json()["monitor"]
            assert monitor["status"] == "retrying" and monitor["last_error"] == "prometeo_unavailable"
            assert monitor["next_due"] >= clock[0] + 600
            assert client.post(base, headers=admin, json={"enabled": False}).status_code == 200
            clock[0] += 3601
            client.portal.call(app.state.run_bank_monitors)
            assert len(calls) == 3
            assert client.post(base, headers=admin, json={"enabled": True}).status_code == 200
        unavailable[0] = False
        restarted = create_app(
            replace(settings, allow_live=True), http_client=provider, clock=lambda: clock[0]
        )
        with TestClient(restarted) as client:
            # The lifespan worker discovers the persisted due job, without a manual bank-read request.
            client.portal.call(asyncio.sleep, 0.1)
            assert len(calls) == 5
            restored = client.get(f"/api/cedar/requests/{item['id']}", headers=auth).json()
            assert len(restored["receipts"]) == 1 and restored["confirmed_minor"] == 10000
        clock[0] += 301
        with TestClient(create_app(settings, http_client=provider, clock=lambda: clock[0])) as disabled:
            disabled.portal.call(asyncio.sleep, 0.1)
            assert len(calls) == 5
            paused = disabled.get("/api/cedar/bank", headers=auth).json()["monitor"]
            assert paused["enabled"] is False and paused["last_error"] == "live_activation_required"
    finally:
        asyncio.run(provider.aclose())


def test_nubefact_reserves_identity_once_and_queries_after_timeout(settings: Settings) -> None:
    import asyncio
    import json

    import httpx

    operations: list[str] = []

    def transport(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        operations.append(body["operacion"])
        if body["operacion"] == "generar_comprobante":
            raise httpx.ReadTimeout("fixture timeout")
        return httpx.Response(
            200, json={"tipo_de_comprobante": 1, "serie": "F001", "numero": 1, "aceptada_por_sunat": True}
        )

    provider = httpx.AsyncClient(transport=httpx.MockTransport(transport))
    try:
        with TestClient(create_app(settings, http_client=provider)) as client:
            wid, auth = owner(client)
            row = client.post(
                "/api/cedar/requests", headers=auth, json=request_data(seller_ruc="20123456789")
            ).json()
            admin = {"Authorization": "Bearer " + settings.admin_token}
            base = f"/api/operator/workspaces/{wid}"
            configured = client.post(
                base + "/providers",
                headers=admin,
                json={
                    "provider": "nubefact",
                    "credentials": {
                        "api_url": "https://api.nubefact.com/api/v1/fixture-route",
                        "token": "fixture-secret",
                        "seller_ruc": "20123456789",
                    },
                },
            )
            assert configured.status_code == 200 and "fixture-secret" not in configured.text
            body = {
                "request_id": row["id"],
                "payload": {
                    "tipo_de_comprobante": 1,
                    "serie": "F001",
                    "numero": 1,
                    "moneda": 1,
                    "total": "100.00",
                    "items": [],
                },
            }
            assert client.post(base + "/invoices", headers=auth, json=body).status_code == 401
            first = client.post(base + "/invoices", headers=admin, json=body).json()
            assert first["phase"] == "query-required"
            assert (
                client.post(base + "/invoices", headers=admin, json=body).json()["phase"] == "query-required"
            )
            assert operations == ["generar_comprobante"]
            result = client.post(base + f"/invoices/{first['id']}/query", headers=admin).json()
            assert result["phase"] == "accepted"
            fiscal = client.get(f"/api/cedar/requests/{row['id']}", headers=auth).json()["fiscal"]
            assert "draft_fingerprint" not in fiscal and "issue_date_policy" not in fiscal
            assert fiscal["mode"] == "sandbox" and fiscal["number"] == 1
            assert client.get(row["buyer_url"] + "/status").json()["balance_minor"] == 10000
            assert operations == ["generar_comprobante", "consultar_comprobante"]
            body["payload"]["total"] = "99.00"
            assert client.post(base + "/invoices", headers=admin, json=body).status_code == 409
    finally:
        asyncio.run(provider.aclose())


# ── THE HYBRID DEMO: THE SEEDED BANK, WHERE A COMMISSIONED ACCOUNT HAS YET TO STAND (§251) ──────
#
# «it should be with mock data cos we still dont have rela prometeo but people dont need to know
#  that. this is still admeo after all. a hybrid real.fake demo»            — Peter, 14 September
#
# `CEDAR_SAMPLE_BANK=1` makes a workspace with no Prometeo account read its bank from Cedar's own
# seed. The switch is OFF by default, so the unconnected posture these tests open with is exactly
# the posture the rest of this file and `drive-cedar-money.py`'s `run_unconnected` block prove.


def sample_book(now: datetime | None = None) -> dict:
    data = json.loads(
        (Path(__file__).resolve().parents[1] / "runtime/sample_bank_v1.json").read_text()
    )["fixture"]["collections"]
    return {
        "accounts": {row["scope"]: row for row in data["accounts"]},
        "receipts": data["receiptsByWeekday"][str(datetime.fromisoformat(sample_bank.today(now)).weekday())],
    }


def sample_settings(settings: Settings) -> Settings:
    return replace(settings, sample_bank=True)


def test_sample_mode_is_off_by_default_and_keeps_the_unconnected_posture(settings: Settings) -> None:
    with TestClient(create_app(settings)) as client:
        _, auth = owner(client)
        assert client.get("/api/cedar/bank", headers=auth).json() == {"ready": False, "mode": "sample"}
        readiness = client.get("/api/cedar/setup", headers=auth).json()["readiness"]
        assert readiness["prometeo"]["configured"] is False and readiness["prometeo"]["mode"] is None
        assert readiness["nubefact"]["configured"] is False and readiness["nubefact"]["mode"] is None
        assert client.get("/api/cedar/bank/movements", headers=auth).json()["movements"] == []


@pytest.mark.parametrize("weekday", range(7))
def test_sample_bank_keeps_ninety_days_of_varied_receipts_for_every_peru_weekday(weekday: int) -> None:
    now = datetime(2025, 8, 18, 15, tzinfo=timezone.utc) + timedelta(days=weekday)
    for scope in sample_bank.houses():
        state = {"id": "history-test", "scope": scope}
        rows = sample_bank.receipts(state, now)
        dates = sorted({row["at"][:10] for row in rows})
        assert len(dates) > 70, f"{scope}: ninety days of trading leave receipts on more than seventy dates"
        assert (datetime.fromisoformat(dates[-1]) - datetime.fromisoformat(dates[0])).days >= 89
        daily = {day: sum(row["amountMinor"] for row in rows if row["at"][:10] == day) for day in dates}
        assert len(set(list(daily.values())[-14:])) >= 10, "the last fortnight retains the book's varying takings"
        assert all(row["method"] in {"yape", "plin", "transfer"} for row in rows)
        snapshot = sample_bank.snapshot(state, now)
        opening = sample_bank.book()["accounts"][scope]["openingBalanceMinor"]
        assert snapshot["balance_minor"] == opening + sum(row["amountMinor"] for row in rows)
        expected = [row for row in sample_book(now)["receipts"] if row["scope"] == scope]
        assert {(row["reference"], row["amountMinor"], row["documentId"]) for row in rows} == {
            (row["reference"], row["amountMinor"], row["documentId"]) for row in expected
        }, "the selected variant is the browser's ledger for this calendar weekday"


@pytest.mark.parametrize("hour,minute,weekday", [(4, 59, 0), (5, 0, 1)])
def test_sample_bank_switches_weekday_at_peru_midnight(hour: int, minute: int, weekday: int) -> None:
    now = datetime(2025, 8, 19, hour, minute, tzinfo=timezone.utc)
    state = {"id": "midnight-test", "scope": "fish"}
    expected = sample_bank.book()["receiptsByWeekday"][weekday]["fish"]
    rows = sample_bank.receipts(state, now)
    assert {(row["reference"], row["amountMinor"], row["documentId"]) for row in rows} == {
        (row["reference"], row["amountMinor"], row["documentId"]) for row in expected
    }


def test_sample_bank_anchor_preserves_an_authored_ledger_across_calendar_days() -> None:
    state = {"id": "retained-ledger", "scope": "fish", "fixture_day": "2025-08-18"}
    monday = datetime(2025, 8, 18, 19, tzinfo=timezone.utc)
    tuesday = monday + timedelta(days=1)
    assert sample_bank.snapshot(state, monday) == sample_bank.snapshot(state, tuesday)
    assert sample_bank.receipts(state, monday) == sample_bank.receipts(state, tuesday)
    rolled = {**state, "fixture_day": "2025-08-19"}
    assert sample_bank.snapshot(rolled, tuesday)["as_of"].startswith("2025-08-19T")
    assert sample_bank.snapshot(rolled, tuesday)["balance_minor"] != sample_bank.snapshot(state, tuesday)["balance_minor"]


def test_legacy_authored_bank_keeps_the_previous_build_on_every_weekday() -> None:
    for weekday in range(7):
        anchor = datetime(2025, 8, 18, 19, tzinfo=timezone.utc) + timedelta(days=weekday)
        for scope in ["fish", "meat", "fruit"]:
            state = {"id": "legacy-authored", "scope": scope, "fixture_day": anchor.date().isoformat(), "fixture_revision": 1}
            rows = sample_bank.receipts(state, anchor + timedelta(days=30))
            assert len(rows) == 18, "the authored legacy book keeps its original eighteen receipts"
            fixture = json.loads(sample_bank.DATA.read_text())["fixture"]["legacy"]
            expected = [row for row in fixture["collections"]["receiptsByWeekday"][str(weekday)] if row["scope"] == scope]
            assert sorted(({key: value for key, value in row.items() if key != "at"} for row in rows), key=lambda row: row["reference"]) == sorted(expected, key=lambda row: row["reference"])
            for row in rows:
                day = (anchor + timedelta(days=row["dayOffset"])).date().isoformat()
                assert row["at"] == day + "T" + row["time"]
            account = next(row for row in fixture["collections"]["accounts"] if row["scope"] == scope)
            assert sample_bank.snapshot(state, anchor)["balance_minor"] == account["openingBalanceMinor"] + sum(row["amountMinor"] for row in expected)
            assert {row["method"] for row in rows} == {"yape", "plin", "transfer"}


def test_owner_bank_reads_select_the_legacy_revision(settings: Settings) -> None:
    with TestClient(create_app(sample_settings(settings))) as client:
        created = client.post("/api/cedar/workspaces", json={"scope": "fish"}).json()
        auth = {"Authorization": "Bearer " + created["token"]}
        query = "?fixture_day=2025-08-18&fixture_revision=1"
        bank = client.get("/api/cedar/bank" + query, headers=auth).json()
        activity = client.get("/api/cedar/bank/movements" + query, headers=auth).json()
        assert len(activity["movements"]) == 18
        assert bank["balance_minor"] == 500000 + sum(row["credit_minor"] for row in activity["movements"])
        assert bank["as_of"] == activity["as_of"]
        for path in ["/api/cedar/bank", "/api/cedar/bank/movements"]:
            assert client.get(path + query).status_code == 401
            for invalid in ["0", "3", "invalid", "1.5"]:
                assert client.get(path + "?fixture_revision=" + invalid, headers=auth).status_code == 422


def test_owner_bank_reads_select_the_saved_fixture_day_with_an_authenticated_query(settings: Settings) -> None:
    with TestClient(create_app(sample_settings(settings))) as client:
        created = client.post("/api/cedar/workspaces", json={"scope": "fish"}).json()
        auth = {"Authorization": "Bearer " + created["token"]}
        for fixture_day in ["2025-08-18", "2025-08-19"]:
            bank = client.get(f"/api/cedar/bank?fixture_day={fixture_day}", headers=auth).json()
            activity = client.get(f"/api/cedar/bank/movements?fixture_day={fixture_day}", headers=auth).json()
            expected = sample_bank.snapshot({"id": created["id"], "scope": "fish"},
                datetime.fromisoformat(fixture_day + "T19:00:00+00:00"))
            assert bank["as_of"].startswith(fixture_day + "T")
            assert bank["balance_minor"] == expected["balance_minor"]
            assert activity["as_of"] == bank["as_of"]
            assert max(row["date"] for row in activity["movements"]) == fixture_day
            opening = sample_bank.book()["accounts"]["fish"]["openingBalanceMinor"]
            assert opening + sum(row["credit_minor"] for row in activity["movements"]) == bank["balance_minor"]
        for path in ["/api/cedar/bank", "/api/cedar/bank/movements"]:
            assert client.get(path + "?fixture_day=2025-08-18").status_code == 401
            for invalid in ["2025-02-30", "20250818", "1999-12-31", "2100-01-01", "invalid"]:
                assert client.get(path + "?fixture_day=" + invalid, headers=auth).status_code == 422


@pytest.mark.parametrize("fixture_revision", [1, 2])
def test_sample_bank_includes_runtime_bank_receipts_once_on_their_actual_arrival(fixture_revision: int) -> None:
    now = datetime(2025, 8, 19, 19, 2, tzinfo=timezone.utc)
    state = {"id": "receipt-test", "scope": "fish", "fixture_day": "2025-08-18", "fixture_revision": fixture_revision, "requests": {}}
    baseline = sample_bank.receipts(state, now)
    opening = sample_bank.snapshot(state, now)["balance_minor"]
    prior = baseline[0]
    payment = {"id": "paid-one", "reference": "YAPE-PAID-ONE", "amount_minor": 1234,
               "currency": "PEN", "method": "yape", "source": "sample", "status": "matched",
               "created_at": "2025-07-01T14:45:01+00:00", "received_at": "2025-08-19T19:00:00+00:00"}
    state["requests"]["request-live"] = {"id": "request-live", "invoice_id": "invoice-live",
        "document_id": "document-live", "customer_name": "Buyer", "receipts": [
            payment,
            {**payment, "id": "paid-two", "reference": "PLIN-PAID-TWO", "amount_minor": 8766,
             "method": "plin", "received_at": "2025-08-19T19:01:00+00:00"},
            {**payment, "id": "opening", "reference": prior["reference"], "amount_minor": prior["amountMinor"]},
            {**payment, "id": "cash", "reference": "CASH", "method": "cash"},
            {**payment, "id": "manual", "reference": "MANUAL", "source": "manual", "method": "transfer"},
            {**payment, "id": "review", "reference": "REVIEW", "status": "review"},
            {**payment, "id": "foreign", "reference": "FOREIGN", "currency": "EUR"},
            {**payment, "id": "future", "reference": "FUTURE", "received_at": "2025-08-20T19:00:00+00:00"},
        ]}
    rows = sample_bank.receipts(state, now)
    assert len(rows) == len(baseline) + 2
    assert sample_bank.snapshot(state, now)["balance_minor"] == opening + 10000
    assert datetime.fromisoformat(sample_bank.clock(state, now)) == datetime(2025, 8, 19, 19, 1, tzinfo=timezone.utc)
    action = next(row for row in rows if row["reference"] == payment["reference"])
    assert action["at"] == payment["received_at"]
    assert (action["requestId"], action["invoiceId"], action["documentId"]) == (
        "request-live", "invoice-live", "document-live")
    movements = sample_bank.movements(state, lambda values: ":".join(values), now)
    assert sum(row["credit_minor"] for row in movements) == sum(row["amountMinor"] for row in baseline) + 10000
    assert len({row["id"] for row in movements}) == len(movements)
    assert sample_bank.snapshot(state, now)["balance_minor"] == opening + 10000, "a repeat read keeps one allocation"


def test_sample_bank_answers_each_house_with_its_own_seeded_ledger(settings: Settings) -> None:
    book = sample_book()
    with TestClient(create_app(sample_settings(settings))) as client:
        for scope, account in book["accounts"].items():
            created = client.post("/api/cedar/workspaces", json={"scope": scope}).json()
            auth = {"Authorization": "Bearer " + created["token"]}
            bank = client.get("/api/cedar/bank", headers=auth).json()
            receipts = [row for row in book["receipts"] if row["scope"] == scope]
            assert bank["ready"] is True
            assert bank["bank"] == account["bank"]
            assert bank["account_label"] == account["houseName"]
            assert bank["account_mask"] == "•••• " + account["accountNumber"][-4:]
            assert bank["currency"] == account["currency"] == "PEN"
            assert bank["mode"] == "sample" and bank["source"] == "sample"
            assert bank["wallets"] == {"yape": True, "plin": True}
            assert bank["monitor"] == {"enabled": False, "status": "off"}
            # Every figure is the fixture's: the opening balance plus the seeded receipts, exactly
            # the arithmetic `money-projections.ts` does in the browser.
            assert bank["balance_minor"] == account["openingBalanceMinor"] + sum(
                row["amountMinor"] for row in receipts
            )
            assert bank["as_of"].endswith(account["referenceTime"])
            # The monitor stays off in sample mode, and the ring's bank milestone reads ready.
            setup = client.get("/api/cedar/setup", headers=auth).json()["readiness"]
            assert setup["prometeo"] == {
                "configured": True,
                "bank_authorized": True,
                "last_read": None,
                "mode": "sample",
                "monitor": {"enabled": False, "status": "off"},
            }
            assert setup["nubefact"] == {"configured": True, "mode": "sample", "documents": 0}


def test_sample_movements_are_the_seeded_receipts_matched_to_their_own_requests(
    settings: Settings,
) -> None:
    book = sample_book()
    seeded = [row for row in book["receipts"] if row["scope"] == "fish"]
    with TestClient(create_app(sample_settings(settings))) as client:
        created = client.post("/api/cedar/workspaces", json={"scope": "fish"}).json()
        auth = {"Authorization": "Bearer " + created["token"]}
        activity = client.get("/api/cedar/bank/movements", headers=auth).json()
        assert activity["ready"] is True and activity["mode"] == "sample"
        assert activity["as_of"] == client.get("/api/cedar/bank", headers=auth).json()["as_of"]
        rows = activity["movements"]
        assert len(rows) == len(seeded)
        assert {row["reference"] for row in rows} == {row["reference"] for row in seeded}
        assert len({row["id"] for row in rows}) == len(rows)
        assert [row["date"] for row in rows] == sorted((row["date"] for row in rows), reverse=True)
        for row in rows:
            assert re.fullmatch(r"[a-f0-9]{64}", row["id"])
            assert row["source"] == "sample" and row["mode"] == "sample"
            assert row["status"] == "matched" and row["reason"] == ""
            assert row["debit_minor"] == 0 and row["credit_minor"] > 0
            assert row["allocated_minor"] + row["unallocated_minor"] == row["credit_minor"]
            assert row["request_id"] and row["invoice_id"] and row["document_id"]
            assert re.fullmatch(r"•••• [a-zA-Z0-9]{1,4}", row["account_mask"])
        total = sum(row["credit_minor"] for row in rows)
        opening = book["accounts"]["fish"]["openingBalanceMinor"]
        assert client.get("/api/cedar/bank", headers=auth).json()["balance_minor"] == opening + total


def test_sample_bank_reads_the_house_from_the_seller_name_and_defaults_to_the_first_book(
    settings: Settings,
) -> None:
    book = sample_book()
    with TestClient(create_app(sample_settings(settings))) as client:
        _, auth = owner(client)
        # A workspace created before the scope existed still reads a house: the first of the book.
        assert client.get("/api/cedar/bank", headers=auth).json()["account_label"] == (
            book["accounts"]["fish"]["houseName"]
        )
        client.post(
            "/api/cedar/setup",
            headers=auth,
            json={"seller_name": book["accounts"]["meat"]["houseName"]},
        )
        bank = client.get("/api/cedar/bank", headers=auth).json()
        assert bank["account_label"] == book["accounts"]["meat"]["houseName"]
        assert bank["bank"] == book["accounts"]["meat"]["bank"]


def test_a_commissioned_account_replaces_the_sample_answer_through_the_same_doors(
    settings: Settings,
) -> None:
    with TestClient(create_app(sample_settings(settings))) as client:
        created = client.post("/api/cedar/workspaces", json={"scope": "fish"}).json()
        auth = {"Authorization": "Bearer " + created["token"]}
        admin = {"Authorization": "Bearer " + settings.admin_token}
        assert client.get("/api/cedar/bank", headers=auth).json()["mode"] == "sample"
        assert (
            client.post(
                f"/api/operator/workspaces/{created['id']}/providers",
                headers=admin,
                json={
                    "provider": "prometeo",
                    "environment": "sandbox",
                    "credentials": {"api_key": "fixture-key"},
                },
            ).status_code
            == 200
        )
        # The commissioned provider owns the answer from here: no authorized account yet, so the
        # bank door reads its own setup posture again rather than the seed.
        assert client.get("/api/cedar/bank", headers=auth).json() == {"ready": False, "mode": "sample"}
        readiness = client.get("/api/cedar/setup", headers=auth).json()["readiness"]
        assert readiness["prometeo"]["mode"] == "sandbox"
        assert readiness["prometeo"]["bank_authorized"] is False
        # NubeFact is still uncommissioned, so invoicing keeps the seeded answer.
        assert readiness["nubefact"]["mode"] == "sample"
        assert client.get("/api/cedar/bank/movements", headers=auth).json()["movements"] == []
        for path in ["/api/cedar/bank", "/api/cedar/bank/movements"]:
            for revision in [1, 2]:
                assert client.get(path + f"?fixture_day=2025-08-18&fixture_revision={revision}", headers=auth).json() == client.get(path, headers=auth).json()


def test_sample_mode_leaves_requests_receipts_and_the_operator_boundary_where_they_are(
    settings: Settings,
) -> None:
    with TestClient(create_app(sample_settings(settings))) as client:
        created = client.post("/api/cedar/workspaces", json={"scope": "fish"}).json()
        auth = {"Authorization": "Bearer " + created["token"]}
        opening = client.get("/api/cedar/bank", headers=auth).json()["balance_minor"]
        row = client.post("/api/cedar/requests", headers=auth, json=request_data()).json()
        assert row["status"] == "pending" and row["balance_minor"] == 10000
        paid = client.post(
            f"/api/cedar/requests/{row['id']}/receipts", headers=auth, json=receipt()
        ).json()
        assert paid["sample_minor"] == 4000 and paid["confirmed_minor"] == 0
        assert client.get("/api/cedar/bank", headers=auth).json()["balance_minor"] == opening + 4000
        movements = client.get("/api/cedar/bank/movements", headers=auth).json()["movements"]
        movement = next(item for item in movements if item["reference"] == receipt()["reference"])
        assert movement["credit_minor"] == 4000 and movement["invoice_id"] == row["invoice_id"]
        assert movement["request_id"] == row["id"] and movement["document_id"] == row["document_id"]
        client.post(f"/api/cedar/requests/{row['id']}/receipts", headers=auth, json=receipt())
        assert client.get("/api/cedar/bank", headers=auth).json()["balance_minor"] == opening + 4000
        cash = client.post(f"/api/cedar/requests/{row['id']}/receipts", headers=auth,
            json=receipt(reference="cash-settlement", amount_minor=6000, source="manual", method="cash")).json()
        assert cash["status"] == "paid" and cash["manual_minor"] == 6000
        assert client.get("/api/cedar/bank", headers=auth).json()["balance_minor"] == opening + 4000
        assert client.post("/api/cedar/bank/match", headers=auth, json={
            "movement_id": "m" * 64, "request_id": row["id"]}).status_code == 409
        assert client.post("/api/cedar/workspaces", json={"scope": "Fish!"}).status_code == 422


# ── THE BUYER'S APPROVAL-CODE CHECKOUT (FEED-IA §252) ───────────────────────────────────────────
#
# «can we just clone that and serve the links in our own demo domain as a new tab that goes through
#  the motions? would make this all super more real»            — Peter, 14 September 2026
#
# The buyer page is the one surface a person outside Cedar meets, and `/approve` is the one public
# write. These hold both: the page states what it asks for, and the write answers only where the
# workspace's bank is Cedar's own seed.


def test_buyer_page_is_the_yape_approval_code_checkout(settings: Settings) -> None:
    with TestClient(create_app(sample_settings(settings))) as client:
        _, auth = owner(client)
        row = client.post("/api/cedar/requests", headers=auth, json=request_data()).json()
        path = row["buyer_url"].removeprefix(settings.public_origin)
        page = client.get(path).text
        for phrase in (
            "Código de aprobación",
            "Ingresa tu celular Yape",
            "Encuéntralo en el menú de Yape.",
            "Yapear",
            "Pagar con QR",
            "/assets/yape.png",
            ">+51<",
        ):
            assert phrase in page, phrase
        assert page.count('class="box"') == 6
        assert 'id="copy-reference"' not in page
        assert page.count('src="/assets/rocoto-mark.svg"') == 1
        mark = client.get("/assets/rocoto-mark.svg")
        assert mark.status_code == 200 and mark.headers["content-type"].startswith("image/svg+xml")
        canonical_mark = Path(__file__).resolve().parents[4] / "public/brand/rocoto-mark.svg"
        assert mark.content == canonical_mark.read_bytes()
        # The buyer reads the payment and the seller, and nothing about how the workspace answers.
        assert not any(word in page.lower() for word in ("demo", "ejemplo", "prueba", "sample"))
        status = client.get(path + "/status").json()
        assert status["approval_code"] is True
        assert status["reference"] == request_data()["reference"]
        assert "receipts" not in status and "public_token" not in status


def test_approval_records_one_payment_and_stays_idempotent(settings: Settings) -> None:
    with TestClient(create_app(sample_settings(settings))) as client:
        _, auth = owner(client)
        row = client.post("/api/cedar/requests", headers=auth, json=request_data()).json()
        path = row["buyer_url"].removeprefix(settings.public_origin)
        approval = {"phone": "987654321", "code": "150304", "quote_id": row["quote_id"]}
        first = client.post(path + "/approve", json=approval)
        assert first.status_code == 200
        assert first.json()["status"] == "paid" and first.json()["balance_minor"] == 0
        again = client.post(path + "/approve", json=approval)
        assert again.status_code == 200 and again.json()["status"] == "paid"
        stored = client.get(f"/api/cedar/requests/{row['id']}", headers=auth).json()
        assert len(stored["receipts"]) == 1
        recorded = stored["receipts"][0]
        assert recorded["source"] == "sample" and recorded["method"] == "yape"
        assert recorded["reference"] == request_data()["reference"]
        assert recorded["amount_minor"] == 10000
        # The buyer's own snapshot carries the payment and keeps the private fields private.
        public = client.get(path + "/status").json()
        assert public["sample_minor"] == 10000 and public["confirmed_minor"] == 0
        assert all(set(entry) <= {"amount_minor", "currency", "method", "source", "status",
                                  "created_at", "effective_at"} for entry in public["timeline"])
        assert public["timeline"][0]["effective_at"] == recorded["received_at"]


def test_approval_on_a_part_paid_order_takes_the_number_plus_a_two_digit_suffix(
    settings: Settings,
) -> None:
    with TestClient(create_app(sample_settings(settings))) as client:
        _, auth = owner(client)
        row = client.post("/api/cedar/requests", headers=auth, json=request_data(
            amount_minor=6000, initial_receipts=[receipt(reference=request_data()["reference"])],
        )).json()
        path = row["buyer_url"].removeprefix(settings.public_origin)
        done = client.post(path + "/approve", json={"phone": "987654321", "code": "246813", "quote_id": row["quote_id"]})
        assert done.status_code == 200 and done.json()["balance_minor"] == 0
        stored = client.get(f"/api/cedar/requests/{row['id']}", headers=auth).json()
        assert [entry["reference"] for entry in stored["receipts"]] == ["F001-1", "F001-1-02"]
        assert [entry["amount_minor"] for entry in stored["receipts"]] == [4000, 6000]


def test_approval_needs_the_seeded_bank_a_valid_capability_and_a_whole_code(settings: Settings) -> None:
    # A workspace with its own commissioned account leaves the payment to the buyer's Yape app.
    with TestClient(create_app(settings)) as client:
        _, auth = owner(client)
        row = client.post("/api/cedar/requests", headers=auth, json=request_data()).json()
        path = row["buyer_url"].removeprefix(settings.public_origin)
        assert client.get(path + "/status").json()["approval_code"] is False
        refused = client.post(path + "/approve", json={"phone": "987654321", "code": "150304"})
        assert refused.status_code == 409
        assert refused.json()["detail"] == "wallet_app_completes_payment"
        assert client.get(f"/api/cedar/requests/{row['id']}", headers=auth).json()["receipts"] == []

    with TestClient(create_app(sample_settings(settings))) as client:
        _, auth = owner(client)
        row = client.post("/api/cedar/requests", headers=auth, json=request_data()).json()
        path = row["buyer_url"].removeprefix(settings.public_origin)
        head = path.rsplit("/", 1)[0]
        assert client.post(head + "/invalid-token/approve",
                           json={"phone": "987654321", "code": "150304"}).status_code == 404
        for invalid in ({"phone": "12345678", "code": "150304"}, {"phone": "987654321", "code": "1503"},
                        {"phone": "987654321", "code": "15030a"}, {"phone": "987654321"}):
            assert client.post(path + "/approve", json=invalid).status_code == 422
        assert client.get(f"/api/cedar/requests/{row['id']}", headers=auth).json()["receipts"] == []


def test_approval_is_rate_limited_per_request(settings: Settings) -> None:
    with TestClient(create_app(sample_settings(settings))) as client:
        _, auth = owner(client)
        first = client.post("/api/cedar/requests", headers=auth, json=request_data()).json()
        second = client.post("/api/cedar/requests", headers=auth, json=request_data(
            invoice_id="invoice-2", document_id="note-2", reference="F001-2", idempotency_key="second",
        )).json()
        path = first["buyer_url"].removeprefix(settings.public_origin)
        codes = [client.post(path + "/approve", json={"phone": "987654321", "code": f"9999{n:02d}", "quote_id": first["quote_id"]}).status_code
                 for n in range(10)]
        assert codes[:8] == [200] * 8 and codes[8:] == [429, 429]
        # The limit is this request's own; another order's page is unaffected.
        other = second["buyer_url"].removeprefix(settings.public_origin)
        assert client.post(other + "/approve", json={"phone": "987654321", "code": "150304", "quote_id": second["quote_id"]}).status_code == 200



def test_sample_movement_order_uses_stable_receipt_identity_across_workspaces() -> None:
    from runtime.cedar_store import fingerprint

    now = datetime(2026, 9, 15, 17, 0, tzinfo=timezone.utc)
    base = {"scope": "fish", "requests": {}, "setup": {}}
    first = sample_bank.movements({**base, "id": "workspace-one"}, fingerprint, now)
    second = sample_bank.movements({**base, "id": "workspace-two"}, fingerprint, now)
    def reading(rows):
        return [(row["date"], row["reference"], row["credit_minor"]) for row in rows]
    assert reading(first) == reading(second)
    assert {row["id"] for row in first}.isdisjoint({row["id"] for row in second})
