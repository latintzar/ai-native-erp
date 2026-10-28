import asyncio
import base64
import hashlib
import hmac
import json
from dataclasses import replace

import httpx
import pytest

from runtime.contracts import Checkout, PaymentIntent, ProviderError
from runtime.providers.izipay import IzipayAdapter

CREDENTIALS = {"merchant_code": "4007701", "api_key": "fixture-api-key", "hash_key": "fixture-hash-key"}
LINK_ID = "1450558deaf948f2a46a37ddfcd85ea1"
LINK_URL = "https://paymentlink.izipay.pe/pay/example"
CUSTOMER = {
    "firstName": "Ana", "lastName": "Torres", "email": "buyer@example.test",
    "phoneNumber": "987654321", "street": "Av. Jorge Chavez 275",
    "postalCode": "15074", "city": "Lima", "state": "Lima", "country": "PE",
    "documentType": "DNI", "document": "12345678",
}
INTENT = PaymentIntent(
    reference="INV-105", amount_minor=15050, currency="PEN", description="Invoice 105",
    payer_email="buyer@example.test", notify_url="https://pay.example.test/webhooks/izipay",
    return_url="https://pay.example.test/return", billing=CUSTOMER, shipping=CUSTOMER,
)
CHECKOUT = Checkout(LINK_ID, LINK_URL, "2026-01-01")


def link_response(**overrides):
    return {"code": "00", "response": {
        "paymentLinkId": LINK_ID, "urL_PaymentLink": LINK_URL,
        "merchantCode": CREDENTIALS["merchant_code"], "amount": "150.50",
        "currency": "PEN", "referenceCode": INTENT.reference, "state": "1",
        **overrides,
    }}


def transaction(**overrides):
    return {
        "code": "00", "descriptionStatus": "AUTORIZADA", "amount": 150.5,
        "currencyCode": "S/", "payMethodAuthorization": "YAPE_CODE",
        "orderNumber": "LP0038521600002", "uniqueId": "0922184733451627",
        "transactionId": "LP290925-487652143-KdYaM7", **overrides,
    }


def transport_for(*responses):
    calls = []
    pending = iter(responses)

    def handler(request):
        calls.append(request)
        response = next(pending)
        if isinstance(response, Exception):
            raise response
        return httpx.Response(200, json=response)

    return httpx.MockTransport(handler), calls


TOKEN = {"code": "00", "response": {"token": "fixture-session-token"}}


def run_adapter(transport, method, *args):
    async def run():
        async with httpx.AsyncClient(transport=transport) as client:
            return await getattr(IzipayAdapter(CREDENTIALS, "sandbox", client), method)(*args)
    return asyncio.run(run())


def test_create_uses_documented_token_and_real_customer_contract():
    transport, calls = transport_for(TOKEN, link_response())
    result = run_adapter(transport, "create_checkout", INTENT)
    assert result.provider_id == LINK_ID
    assert result.url == LINK_URL
    assert len(result.recovery_token) == 10
    assert len(calls) == 2
    assert str(calls[0].url) == "https://sandbox-api-pw.izipay.pe/security/v1/Token/Generate"
    assert json.loads(calls[0].content) == {
        "requestSource": "ECOMMERCE", "merchantCode": "4007701",
        "orderNumber": "4007701", "publicKey": "fixture-api-key", "amount": "0.00",
    }
    assert calls[1].headers["authorization"] == "Bearer fixture-session-token"
    assert calls[1].headers["transactionid"] == calls[0].headers["transactionid"]
    body = json.loads(calls[1].content)
    assert body["payMethod"] == "YAPE_CODE"
    assert body["wayOfUse"] == "INDIVIDUAL"
    assert body["referenceCode"] == "INV-105"
    assert body["urlIpn"] == INTENT.notify_url
    assert body["email_Notification"] is None
    assert body["urL_Terms_and_Conditions"] is None
    assert body["billing"] == CUSTOMER
    assert body["shipping"] == CUSTOMER
    assert body["amount"] == "150.50"
    assert body["customFields"] == []


@pytest.mark.parametrize("intent", [
    replace(INTENT, billing={}), replace(INTENT, shipping={}),
    replace(INTENT, billing={**CUSTOMER, "document": "1"}),
    replace(INTENT, billing={**CUSTOMER, "street": "x" * 26}),
    replace(INTENT, amount_minor=200001), replace(INTENT, amount_minor=0),
    replace(INTENT, currency="USD"),
])
def test_creation_validates_customer_and_yape_limits_before_network(intent):
    transport, calls = transport_for()
    with pytest.raises(ProviderError):
        run_adapter(transport, "create_checkout", intent)
    assert calls == []


@pytest.mark.parametrize("url", [
    "http://paymentlink.izipay.pe/pay/abc", "https://paymentlink.izipay.pe.evil.test/pay/abc",
    "https://evil.test/pay/abc", "https://user:pass@paymentlink.izipay.pe/pay/abc",
    "https://paymentlink.izipay.pe:8443/pay/abc",
])
def test_create_rejects_unverified_checkout_origins(url):
    transport, _ = transport_for(TOKEN, link_response(urL_PaymentLink=url))
    with pytest.raises(ProviderError):
        run_adapter(transport, "create_checkout", INTENT)


def test_create_timeout_is_uncertain_and_is_not_retried():
    transport, calls = transport_for(TOKEN, httpx.ReadTimeout("secret provider detail"))
    with pytest.raises(ProviderError, match="creation_uncertain") as error:
        run_adapter(transport, "create_checkout", INTENT)
    assert not error.value.retryable
    assert len(calls) == 2
    assert "secret" not in str(error.value)


def notification(signed=None, **outer):
    signed = signed or {
        "code": "00", "message": "Operación exitosa",
        "response": {"merchant": {"merchantCode": "4007701"}, "order": [{
            "orderNumber": "LP0038521600002", "amount": "150.50", "currency": "PEN",
        }]}, "transactionId": "signed-transaction",
    }
    payload = json.dumps(signed, ensure_ascii=False, indent=1)
    signature = base64.b64encode(hmac.new(
        CREDENTIALS["hash_key"].encode(), payload.encode(), hashlib.sha256,
    ).digest()).decode()
    return json.dumps({"payloadHttp": payload, "signature": signature, **outer}).encode()


def verify(body):
    return IzipayAdapter(CREDENTIALS, "sandbox", None).verify_notification(body, {}, {}, CHECKOUT)


def test_notification_uses_exact_signed_payload_and_ignores_unsigned_link_and_result():
    body = notification(code="DENIED", response={"merchant": {"merchantCode": "evil"},
                        "order": [{"paymentLinkId": "other-link", "orderNumber": "forged-order"}]})
    assert verify(body) == "LP0038521600002"


def test_signature_tampering_is_rejected():
    data = json.loads(notification())
    data["payloadHttp"] = data["payloadHttp"].replace("150.50", "1.00")
    with pytest.raises(ProviderError):
        verify(json.dumps(data).encode())


@pytest.mark.parametrize("change", ["merchant", "signed_link", "missing_payload"])
def test_notification_rejects_wrong_signed_binding_or_missing_payload(change):
    signed = json.loads(json.loads(notification())["payloadHttp"])
    if change == "merchant":
        signed["response"]["merchant"]["merchantCode"] = "another-seller"
    elif change == "signed_link":
        signed["response"]["order"][0]["paymentLinkId"] = "another-link"
    body = notification(signed)
    if change == "missing_payload":
        body = b'{"code":"00","signature":"fake"}'
    with pytest.raises(ProviderError):
        verify(body)


def payment_page(rows, total=None, page=1):
    return {"code": "00", "response": {
        "transactions": rows, "totalRecords": len(rows) if total is None else total,
        "currentPage": page, "pageSize": 100,
    }}


@pytest.mark.parametrize("row,expected", [
    (transaction(), "paid"),
    (transaction(code="Y06", descriptionStatus="DENEGADA"), "failed"),
    (transaction(descriptionStatus="PRE_AUTORIZADA"), "pending"),
    (transaction(descriptionStatus="ANULADA"), "cancelled"),
])
def test_query_requires_transaction_result_and_status_not_top_level_success(row, expected):
    transport, calls = transport_for(TOKEN, link_response(), TOKEN, payment_page([row]))
    result = run_adapter(transport, "get_payment", CHECKOUT, INTENT)
    assert result.status == expected
    assert result.reference == INTENT.reference
    assert result.amount_minor == 15050
    assert result.currency == "PEN"
    assert result.merchant_id == "4007701"
    assert calls[2].headers["transactionid"] != calls[0].headers["transactionid"]
    assert calls[3].headers["transactionid"] == calls[2].headers["transactionid"]
    assert LINK_ID in calls[3].url.path
    assert json.loads(calls[3].content)["stateList"] == ["0"]


def test_query_paginates_and_finds_success_after_first_page_failures():
    declined = transaction(code="Y06", descriptionStatus="DENEGADA")
    transport, calls = transport_for(
        TOKEN, link_response(), TOKEN, payment_page([declined] * 100, total=101),
        TOKEN, payment_page([transaction()], total=101, page=2),
    )
    result = run_adapter(transport, "get_payment", CHECKOUT, INTENT)
    assert result.status == "paid"
    assert len(calls) == 6
    assert json.loads(calls[-1].content)["pagination"]["pageNumber"] == "2"


@pytest.mark.parametrize("override", [
    {"merchantCode": "other-seller"}, {"paymentLinkId": "other-link"},
    {"referenceCode": "another-invoice"}, {"amount": "1.00"}, {"currency": "USD"},
])
def test_query_checks_authenticated_link_binding(override):
    transport, calls = transport_for(TOKEN, link_response(**override))
    with pytest.raises(ProviderError):
        run_adapter(transport, "get_payment", CHECKOUT, INTENT)
    assert len(calls) == 2


@pytest.mark.parametrize("url", [
    "https://paymentlink.izipay.pe/pay/another-invoice",
    LINK_URL + "?different=checkout",
    LINK_URL + "#another-checkout",
])
def test_recovery_binds_buyer_url_to_authenticated_link(url):
    transport, calls = transport_for(TOKEN, link_response(), TOKEN, payment_page([]))
    with pytest.raises(ProviderError, match="izipay_checkout_url_mismatch"):
        run_adapter(transport, "get_payment", replace(CHECKOUT, url=url), INTENT)
    assert len(calls) == 2


def test_query_requires_authenticated_checkout_url_metadata():
    response = link_response()
    del response["response"]["urL_PaymentLink"]
    transport, calls = transport_for(TOKEN, response, TOKEN, payment_page([]))
    with pytest.raises(ProviderError, match="izipay_invalid_url"):
        run_adapter(transport, "get_payment", CHECKOUT, INTENT)
    assert len(calls) == 2


@pytest.mark.parametrize("override", [
    {"amount": 1}, {"amount": 150.501}, {"currencyCode": "$"},
    {"payMethodAuthorization": "CARD"}, {"code": "00", "descriptionStatus": "UNRECOGNIZED"},
])
def test_query_fails_closed_for_mismatched_or_unrecognized_payment(override):
    transport, _ = transport_for(TOKEN, link_response(), TOKEN, payment_page([transaction(**override)]))
    with pytest.raises(ProviderError):
        run_adapter(transport, "get_payment", CHECKOUT, INTENT)


def test_empty_query_stays_pending_even_if_link_reports_success():
    transport, _ = transport_for(TOKEN, link_response(state="3"), TOKEN, payment_page([]))
    assert run_adapter(transport, "get_payment", CHECKOUT, INTENT).status == "pending"


def test_recovery_date_is_required_instead_of_silently_omitting_old_payments():
    transport, _ = transport_for(TOKEN, link_response())
    with pytest.raises(ProviderError, match="izipay_invalid_recovery_date"):
        run_adapter(transport, "get_payment", replace(CHECKOUT, recovery_token=""), INTENT)


def test_pagination_rejects_repeated_page_instead_of_counting_duplicate_rows():
    declined = transaction(code="Y06", descriptionStatus="DENEGADA")
    transport, _ = transport_for(
        TOKEN, link_response(), TOKEN, payment_page([declined] * 100, total=200),
        TOKEN, payment_page([declined] * 100, total=200, page=1),
    )
    with pytest.raises(ProviderError, match="izipay_invalid_transaction_response"):
        run_adapter(transport, "get_payment", CHECKOUT, INTENT)


def test_missing_create_result_is_uncertain():
    transport, _ = transport_for(TOKEN, {"response": {}})
    with pytest.raises(ProviderError, match="creation_uncertain"):
        run_adapter(transport, "create_checkout", INTENT)


def test_live_uses_only_documented_live_api_origin():
    transport, calls = transport_for(TOKEN, link_response())

    async def run():
        async with httpx.AsyncClient(transport=transport) as client:
            await IzipayAdapter(CREDENTIALS, "live", client).create_checkout(INTENT)

    asyncio.run(run())
    assert all(request.url.host == "api-pw.izipay.pe" for request in calls)
