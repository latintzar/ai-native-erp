import asyncio
import hashlib
import hmac
from urllib.parse import parse_qs

import httpx
import pytest

from runtime.contracts import Checkout, PaymentIntent, ProviderError
from runtime.providers.flow import FlowAdapter


def intent(**changes):
    data = dict(reference="invoice-42", amount_minor=12345, currency="PEN",
                description="Invoice & delivery + 42", payer_email="buyer@example.com",
                notify_url="https://rocoto.example/hooks/flow", return_url="https://rocoto.example/paid")
    data.update(changes)
    return PaymentIntent(**data)


def credentials(**changes):
    return dict(api_key="test-api", secret_key="test-secret", **changes)


def run(handler, action, creds=None, environment="sandbox"):
    async def execute():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            return await action(FlowAdapter(creds or credentials(), environment, client))
    return asyncio.run(execute())


def status(**changes):
    return dict(flowOrder=71, commerceOrder="invoice-42", amount=123.45, currency="PEN", status=2,
                paymentData={"media": "Yape"}, **changes)


def test_create_encodes_after_signing_and_preserves_invoice_and_cents():
    def handler(request):
        assert request.url == "https://sandbox.flow.cl/api/payment/create"
        assert request.headers["content-type"].startswith("application/x-www-form-urlencoded")
        values = {key: value[0] for key, value in parse_qs(request.content.decode()).items()}
        expected = {
            "apiKey": "test-api", "commerceOrder": "invoice-42", "subject": "Invoice & delivery + 42",
            "amount": "123.45", "currency": "PEN", "email": "buyer@example.com",
            "urlConfirmation": "https://rocoto.example/hooks/flow", "urlReturn": "https://rocoto.example/paid",
            "paymentMethod": "123", "merchantId": "seller-1",
        }
        signature = hmac.new(b"test-secret", "".join(key + expected[key] for key in sorted(expected)).encode(), hashlib.sha256).hexdigest()
        assert values == {**expected, "s": signature}
        return httpx.Response(200, json={"url": "https://sandbox.flow.cl/app/web/pay.php", "token": "token-a", "flowOrder": 71})
    checkout = run(handler, lambda adapter: adapter.create_checkout(intent()), credentials(payment_method="123", merchant_id="seller-1"))
    assert checkout == Checkout("71", "https://sandbox.flow.cl/app/web/pay.php?token=token-a", "token-a")


def test_confirmation_fetches_signed_provider_status():
    def handler(request):
        assert request.method == "GET"
        assert request.url.path == "/api/payment/getStatus"
        expected = hmac.new(b"test-secret", b"apiKeytest-apitokentoken-a", hashlib.sha256).hexdigest()
        assert dict(request.url.params) == {"apiKey": "test-api", "token": "token-a", "s": expected}
        return httpx.Response(200, json=status(merchantId="seller-1"))
    observation = run(handler, lambda adapter: adapter.get_payment(Checkout("71", "https://sandbox.flow.cl/?token=token-a", "token-a"), intent()), credentials(merchant_id="seller-1"))
    assert observation.amount_minor == 12345
    assert observation.status == "paid"
    assert observation.reference == "invoice-42"
    assert observation.merchant_id == "seller-1"
    assert observation.payment_method == "Yape"


@pytest.mark.parametrize("body", [b"token=forged", b"token=token-a&token=forged", b"token=token-a&status=paid", b"", b"token="])
def test_forged_or_ambiguous_callback_cannot_confirm(body):
    adapter = FlowAdapter(credentials(), "sandbox", None)
    with pytest.raises(ProviderError, match="invalid_flow_notification"):
        adapter.verify_notification(body, {"Content-Type": "application/x-www-form-urlencoded"}, {}, Checkout("71", "https://sandbox.flow.cl/?token=token-a", "token-a"))


def test_valid_callback_only_returns_token_for_authenticated_status_lookup():
    adapter = FlowAdapter(credentials(), "sandbox", None)
    assert adapter.verify_notification(b"token=token-a", {"content-type": "application/x-www-form-urlencoded; charset=UTF-8"}, {}, Checkout("71", "https://sandbox.flow.cl/?token=token-a", "token-a")) == "token-a"


@pytest.mark.parametrize("change", [{"merchantId": "other-seller"}, {}, {"merchantId": "seller-1", "amount": "123.451"}, {"merchantId": "seller-1", "amount": "123.44"}, {"merchantId": "seller-1", "commerceOrder": "other-invoice"}, {"merchantId": "seller-1", "flowOrder": 72}, {"merchantId": "seller-1", "currency": "USD"}])
def test_mismatched_provider_result_is_rejected(change):
    response = status()
    response.update(change)
    with pytest.raises(ProviderError):
        run(lambda request: httpx.Response(200, json=response), lambda adapter: adapter.get_payment(Checkout("71", "https://sandbox.flow.cl/?token=token-a", "token-a"), intent()), credentials(merchant_id="seller-1"))


@pytest.mark.parametrize("url", ["https://flow.cl.evil.example/pay", "http://sandbox.flow.cl/pay", "https://user:password@sandbox.flow.cl/pay", "https://sandbox.flow.cl:444/pay", "https://evil.example/pay"])
def test_untrusted_checkout_url_is_rejected(url):
    with pytest.raises(ProviderError, match="invalid_flow_checkout"):
        run(lambda request: httpx.Response(200, json={"url": url, "token": "token-a", "flowOrder": 71}), lambda adapter: adapter.create_checkout(intent()))


def test_create_timeout_has_one_attempt_and_safe_uncertain_error():
    requests = []
    def handler(request):
        requests.append(request)
        raise httpx.ReadTimeout("test-secret leaked by upstream", request=request)
    with pytest.raises(ProviderError) as error:
        run(handler, lambda adapter: adapter.create_checkout(intent()))
    assert error.value.code == "flow_timeout"
    assert error.value.retryable
    assert len(requests) == 1
    assert "test-secret" not in str(error.value)


@pytest.mark.parametrize("amount", [0, 200, -1])
def test_peru_minimum_amount_rejected_before_network(amount):
    def handler(request):
        pytest.fail("Invalid amount reached the provider")
    with pytest.raises(ProviderError, match="invalid_flow_intent"):
        run(handler, lambda adapter: adapter.create_checkout(intent(amount_minor=amount)))


def test_live_base_is_fixed_and_provider_errors_are_safe():
    def handler(request):
        assert str(request.url) == "https://www.flow.cl/api/payment/create"
        return httpx.Response(401, json={"message": "test-secret provider dump"})
    with pytest.raises(ProviderError) as error:
        run(handler, lambda adapter: adapter.create_checkout(intent()), environment="live")
    assert error.value.code == "flow_http_error"
    assert not error.value.retryable


def test_unknown_environment_is_rejected():
    with pytest.raises(ProviderError, match="invalid_flow_environment"):
        FlowAdapter(credentials(), "https://evil.example", None)


@pytest.mark.parametrize(("provider_state", "expected"), [(1, "pending"), (2, "paid"), (3, "failed"), (4, "cancelled")])
def test_payment_states_remain_distinct(provider_state, expected):
    response = status()
    response["status"] = provider_state
    observation = run(lambda request: httpx.Response(200, json=response), lambda adapter: adapter.get_payment(Checkout("71", "https://sandbox.flow.cl/?token=token-a", "token-a"), intent()))
    assert observation.status == expected


def test_callback_content_type_is_checked():
    adapter = FlowAdapter(credentials(), "sandbox", None)
    with pytest.raises(ProviderError, match="invalid_flow_notification"):
        adapter.verify_notification(b"token=token-a", {"content-type": "application/json"}, {}, Checkout("71", "https://sandbox.flow.cl/?token=token-a", "token-a"))


def test_invalid_provider_json_has_safe_error():
    with pytest.raises(ProviderError, match="invalid_flow_response"):
        run(lambda request: httpx.Response(200, content="upstream test-secret dump"), lambda adapter: adapter.create_checkout(intent()))


@pytest.mark.parametrize("url", [
    "https://sandbox.flow.cl/pay?token=another-payment",
    "https://sandbox.flow.cl/pay?token=token-a&token=token-a",
    "https://sandbox.flow.cl/pay?token=token-a&token=another-payment",
    "https://sandbox.flow.cl/pay",
    "https://sandbox.flow.cl/pay?token=",
    "https://evil.example/pay?token=token-a",
    "https://sandbox.flow.cl.evil.example/pay?token=token-a",
    "http://sandbox.flow.cl/pay?token=token-a",
    "https://attacker@sandbox.flow.cl/pay?token=token-a",
    "https://sandbox.flow.cl:444/pay?token=token-a",
    "https://sandbox.flow.cl/pay?token=token-a#another-payment",
])
def test_recovery_rejects_unbound_checkout_url_before_provider_request(url):
    requests = []
    def handler(request):
        requests.append(request)
        return httpx.Response(200, json=status())
    with pytest.raises(ProviderError, match="invalid_flow_checkout"):
        run(handler, lambda adapter: adapter.get_payment(Checkout("71", url, "token-a"), intent()))
    assert requests == []


@pytest.mark.parametrize("host", ["flow.cl", "www.flow.cl", "api.flow.cl", "sandbox.flow.cl"])
def test_recovery_accepts_allowed_host_with_matching_single_token(host):
    observation = run(
        lambda request: httpx.Response(200, json=status()),
        lambda adapter: adapter.get_payment(Checkout("71", f"https://{host}/pay?locale=es&token=token-a", "token-a"), intent()),
    )
    assert observation.status == "paid"
