"""Official wire contracts, exercised entirely through HTTP fixtures."""
import asyncio
import json
from datetime import date
from urllib.parse import parse_qs

import httpx
import pytest

from runtime.contracts import ProviderError
from runtime.providers.nubefact import NubeFactClient
from runtime.providers.prometeo import PrometeoClient

NUBE_URL = "https://api.nubefact.com/api/v1/48239908-7ae7-4353-824d-071765d4"


def run(handler, action):
    async def execute():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            return await action(client)
    return asyncio.run(execute())


def invoice_response(**changes):
    return {"tipo_de_comprobante": 1, "serie": "F001", "numero": 42,
            "aceptada_por_sunat": True, "sunat_responsecode": "0", **changes}


def test_prometeo_login_form_and_challenge_keep_password_out_of_client_state():
    def handler(request):
        assert str(request.url) == "https://test.prometeo.qualia.uy/login/"
        assert request.headers["x-api-key"] == "fixture-api-key"
        assert parse_qs(request.content.decode()) == {
            "provider": ["bcp_pers_pe"], "username": ["fixture-user"],
            "password": ["fixture-password"], "document_type": ["DNI"],
        }
        return httpx.Response(200, json={"status": "interaction_required", "key": "session-key",
                                        "field": "otp", "context": "Enter bank code"})

    async def action(http):
        client = PrometeoClient("fixture-api-key", "sandbox", http)
        result = await client.login("bcp_pers_pe", "fixture-user", "fixture-password", {"document_type": "DNI"})
        assert "fixture-password" not in repr(vars(client))
        assert result == {"status": "interaction_required", "key": "session-key", "field": "otp", "context": "Enter bank code"}
    run(handler, action)


def test_prometeo_account_balances_are_bank_values_including_overdraft():
    def handler(request):
        assert request.url.path == "/account/" and dict(request.url.params) == {"key": "session-key"}
        return httpx.Response(200, json={"status": "success", "accounts": [{"id": "account-1", "name": "Current",
            "number": "001234", "branch": "01", "currency": "PEN", "balance": "-123.45"}]})
    accounts = run(handler, lambda http: PrometeoClient("key", "live", http).accounts("session-key"))
    assert accounts[0]["balance_minor"] == -12345
    assert accounts[0]["currency"] == "PEN"


def test_prometeo_movement_preserves_reference_and_never_invents_invoice_identity():
    def handler(request):
        assert request.url.path == "/movement/"
        assert dict(request.url.params) == {"key": "session-key", "account": "001234", "currency": "PEN",
                                            "date_start": "01/09/2026", "date_end": "09/09/2026"}
        return httpx.Response(200, json={"status": "success", "movements": [{"id": 71, "reference": "BANK-REF",
            "date": "09/09/2026", "detail": "Transfer received", "debit": "0.00", "credit": "10.25"}]})
    movements = run(handler, lambda http: PrometeoClient("key", "sandbox", http).movements(
        "session-key", "001234", "PEN", date(2026, 9, 1), date(2026, 9, 9)))
    assert movements == [{"id": "71", "reference": "BANK-REF", "date": "2026-09-09", "detail": "Transfer received",
        "debit_minor": 0, "credit_minor": 1025, "currency": "PEN", "account_number": "001234", "extra_data": None}]


@pytest.mark.parametrize("amount", [None, "", "NaN", "1.001", "1,000.00", True])
def test_prometeo_ambiguous_amount_rejects_whole_feed(amount):
    response = {"status": "success", "movements": [{"id": "m1", "reference": "", "date": "09/09/2026",
                "detail": "receipt", "debit": 0, "credit": amount}]}
    with pytest.raises(ProviderError, match="prometeo_invalid_amount"):
        run(lambda request: httpx.Response(200, json=response), lambda http: PrometeoClient("key", "sandbox", http).movements(
            "session-key", "001234", "PEN", date(2026, 9, 1), date(2026, 9, 9)))


def test_prometeo_expired_session_returns_safe_reauthentication_error():
    with pytest.raises(ProviderError, match="prometeo_session_expired"):
        run(lambda request: httpx.Response(200, json={"status": "error", "message": "Invalid key"}),
            lambda http: PrometeoClient("key", "sandbox", http).accounts("session-key"))


def test_prometeo_continues_challenge_and_selects_business_client_then_logs_out():
    paths = []
    def handler(request):
        paths.append(request.url.path)
        assert request.url.params["key"] == "session-key"
        if request.url.path == "/login/":
            assert parse_qs(request.content.decode())["otp"] == ["123456"]
            return httpx.Response(200, json={"status": "select_client", "key": "session-key"})
        if request.url.path == "/client/":
            return httpx.Response(200, json={"status": "success", "clients": {"company-1": "Seller"}})
        return httpx.Response(200, json={"status": "success"})
    async def action(http):
        client = PrometeoClient("key", "sandbox", http)
        await client.login("bank", "user", "pass", {"otp": "123456"}, session_key="session-key")
        assert await client.clients("session-key") == [{"id": "company-1", "name": "Seller"}]
        await client.select_client("session-key", "company-1")
        await client.logout("session-key")
    run(handler, action)
    assert paths == ["/login/", "/client/", "/client/company-1/", "/logout/"]


def test_nubefact_submit_uses_documented_header_and_frozen_identity():
    payload = {"tipo_de_comprobante": 1, "serie": "F001", "numero": 42, "total": "118.00", "items": []}
    def handler(request):
        assert str(request.url) == NUBE_URL and request.method == "POST"
        assert request.headers["authorization"] == "fixture-token"
        sent = json.loads(request.content)
        assert sent == {**payload, "operacion": "generar_comprobante", "enviar_automaticamente_al_cliente": False}
        return httpx.Response(200, json=invoice_response())
    result = run(handler, lambda http: NubeFactClient(NUBE_URL, "fixture-token", http).submit(payload))
    assert result["acceptance"] == "accepted" and payload.get("operacion") is None


@pytest.mark.parametrize("accepted,expected", [(False, "pending"), (True, "accepted")])
def test_nubefact_query_keeps_acceptance_separate_from_payment(accepted, expected):
    def handler(request):
        assert json.loads(request.content) == {"operacion": "consultar_comprobante", "tipo_de_comprobante": 1, "serie": "F001", "numero": 42}
        return httpx.Response(200, json=invoice_response(aceptada_por_sunat=accepted))
    result = run(handler, lambda http: NubeFactClient(NUBE_URL, "token", http).query(1, "F001", 42))
    assert result["acceptance"] == expected and "paid" not in result


@pytest.mark.parametrize("url", ["http://api.nubefact.com/api/v1/abc12345", "https://127.0.0.1/api/v1/abc12345",
    "https://api.nubefact.com.evil.example/api/v1/abc12345", "https://user@api.nubefact.com/api/v1/abc12345",
    "https://api.nubefact.com:8443/api/v1/abc12345", "https://api.nubefact.com/api/v1/abc12345?target=evil",  # gitleaks:allow — rejected URL fixtures
    "https://api.nubefact.com/api/v1/../admin", "https://api.nubefact.com/api/v1/abc12345#fragment"])
def test_nubefact_endpoint_rejects_arbitrary_destinations(url):
    with pytest.raises(ProviderError, match="nubefact_invalid_api_url"):
        NubeFactClient(url, "token", None)


def test_nubefact_uncertain_creation_has_one_attempt_and_query_recovery():
    calls = []
    def handler(request):
        calls.append(json.loads(request.content)["operacion"])
        if calls[-1] == "generar_comprobante":
            raise httpx.ReadTimeout("fixture-token confidential", request=request)
        return httpx.Response(200, json=invoice_response())
    async def action(http):
        client = NubeFactClient(NUBE_URL, "fixture-token", http)
        with pytest.raises(ProviderError) as error:
            await client.submit({"tipo_de_comprobante": 1, "serie": "F001", "numero": 42})
        assert error.value.code == "creation_uncertain" and not error.value.retryable
        assert "fixture-token" not in str(error.value)
        assert (await client.query(1, "F001", 42))["acceptance"] == "accepted"
    run(handler, action)
    assert calls == ["generar_comprobante", "consultar_comprobante"]


@pytest.mark.parametrize("body", [invoice_response(numero=43), invoice_response(aceptada_por_sunat="true"), {}, []])
def test_nubefact_mismatched_or_malformed_successful_submission_is_uncertain(body):
    with pytest.raises(ProviderError, match="creation_uncertain"):
        run(lambda request: httpx.Response(200, json=body), lambda http: NubeFactClient(NUBE_URL, "token", http).submit(
            {"tipo_de_comprobante": 1, "serie": "F001", "numero": 42}))


def test_nubefact_provider_error_sanitizes_details_and_redirect_is_never_followed():
    for response in [httpx.Response(200, json={"errors": "confidential buyer data", "codigo": 20}),
                     httpx.Response(307, headers={"location": "https://evil.example"})]:
        calls = []
        def handler(request):
            calls.append(request)
            return response
        with pytest.raises(ProviderError) as error:
            run(handler, lambda http: NubeFactClient(NUBE_URL, "token", http).query(1, "F001", 42))
        assert "confidential" not in str(error.value) and len(calls) == 1
