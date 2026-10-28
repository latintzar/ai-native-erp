from __future__ import annotations

import hashlib
import hmac
import json
import unittest
from dataclasses import replace
from urllib.parse import parse_qs, urlsplit

import httpx

from runtime.contracts import Checkout, PaymentIntent, ProviderError
from runtime.providers.mercadopago import (
    MercadoPagoAdapter,
    authorization_url,
    exchange_code,
    refresh_tokens,
)

CREDENTIALS = {
    "access_token": "private-access",
    "public_key": "public-key",
    "collector_id": "42",
    "webhook_secret": "private-webhook",
}
INTENT = PaymentIntent("invoice-1", 12345, "PEN", "Invoice 1", "buyer@example.com",
                       "https://demo.soyrocoto.com/hooks/mp", "https://demo.soyrocoto.com/pay/one")
CHECKOUT = Checkout("42-preference", "https://www.mercadopago.com.pe/checkout/v1/redirect?pref_id=42")


def payment(**changes):
    result = {"id": 777, "external_reference": "invoice-1", "transaction_amount": 123.45,
              "currency_id": "PEN", "collector_id": 42, "live_mode": False,
              "status": "approved", "status_detail": "accredited", "payment_method_id": "yape"}
    result.update(changes)
    return result


def signed_notification(payment_id="777", **body_changes):
    body = {"type": "payment", "data": {"id": payment_id}, "user_id": 42, "live_mode": False}
    body.update(body_changes)
    manifest = f"id:{payment_id};request-id:request-1;ts:1704908010;"
    digest = hmac.new(b"private-webhook", manifest.encode(), hashlib.sha256).hexdigest()
    return json.dumps(body).encode(), {"x-signature": f"ts=1704908010,v1={digest}",
                                       "x-request-id": "request-1"}, {"data.id": payment_id}


class MercadoPagoTests(unittest.IsolatedAsyncioTestCase):
    def make_adapter(self, handler, environment="sandbox"):
        client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
        self.addAsyncCleanup(client.aclose)
        return MercadoPagoAdapter(CREDENTIALS, environment, client)

    async def test_preference_preserves_invoice_and_seller(self):
        def handler(request):
            self.assertEqual(str(request.url), "https://api.mercadopago.com/checkout/preferences")
            self.assertEqual(request.headers["authorization"], "Bearer private-access")
            body = json.loads(request.content)
            self.assertEqual(body["external_reference"], "invoice-1")
            self.assertEqual(body["items"][0]["unit_price"], 123.45)
            self.assertEqual(body["items"][0]["currency_id"], "PEN")
            self.assertEqual(body["notification_url"], INTENT.notify_url)
            return httpx.Response(201, json={"id": "42-preference", "collector_id": 42,
                "init_point": CHECKOUT.url,
                "sandbox_init_point": "https://sandbox.mercadopago.com.pe/checkout/v1/redirect?pref_id=42"})
        checkout = await self.make_adapter(handler).create_checkout(INTENT)
        self.assertEqual(checkout.provider_id, "42-preference")
        self.assertEqual(urlsplit(checkout.url).hostname, "sandbox.mercadopago.com.pe")

    async def test_hosted_urls_and_collector_fail_closed(self):
        for fields in ({"collector_id": 99}, {"sandbox_init_point": "https://evil.example/pay"},
                       {"sandbox_init_point": "https://www.mercadopago.com.pe.evil.example/pay"},
                       {"sandbox_init_point": "https://user@www.mercadopago.com.pe/checkout/v1/redirect"},
                       {"sandbox_init_point": "http://www.mercadopago.com.pe/checkout/v1/redirect"}):
            with self.subTest(fields=fields):
                response = {"id": "42-pref", "collector_id": 42, "sandbox_init_point": CHECKOUT.url}
                response.update(fields)
                adapter = self.make_adapter(lambda request, result=response: httpx.Response(201, json=result))
                with self.assertRaises(ProviderError):
                    await adapter.create_checkout(INTENT)

    async def test_payment_fetch_enforces_every_financial_identity_field(self):
        for fields in ({"id": 778}, {"external_reference": "other-invoice"}, {"collector_id": 99},
                       {"currency_id": "USD"}, {"transaction_amount": 123.46},
                       {"transaction_amount": "123.451"}, {"live_mode": True},
                       {"live_mode": "false"}, {"live_mode": None}):
            with self.subTest(fields=fields):
                adapter = self.make_adapter(
                    lambda request, changes=fields: httpx.Response(200, json=payment(**changes)))
                with self.assertRaises(ProviderError):
                    await adapter.get_payment(CHECKOUT, INTENT, "777")

    async def test_payment_states_and_full_refund(self):
        for upstream, expected in (("approved", "paid"), ("pending", "pending"),
                ("in_process", "pending"), ("authorized", "pending"), ("rejected", "failed"),
                ("cancelled", "cancelled"), ("refunded", "refunded"), ("charged_back", "refunded")):
            with self.subTest(status=upstream):
                adapter = self.make_adapter(
                    lambda request, status=upstream: httpx.Response(200, json=payment(status=status)))
                result = await adapter.get_payment(CHECKOUT, INTENT, "777")
                self.assertEqual(result.status, expected)
                self.assertEqual(result.amount_minor, 12345)
                self.assertEqual(result.merchant_id, "42")
        adapter = self.make_adapter(lambda request: httpx.Response(200,
            json=payment(transaction_amount_refunded=123.45)))
        self.assertEqual((await adapter.get_payment(CHECKOUT, INTENT, "777")).status, "refunded")

    async def test_partial_refunds_and_unknown_status_require_review(self):
        for fields in ({"transaction_amount_refunded": 1}, {"status": "unrecognized"}):
            adapter = self.make_adapter(
                lambda request, changes=fields: httpx.Response(200, json=payment(**changes)))
            with self.assertRaises(ProviderError):
                await adapter.get_payment(CHECKOUT, INTENT, "777")

    async def test_recovery_fetches_full_authenticated_detail(self):
        seen = []
        def handler(request):
            seen.append(request.url.path)
            self.assertEqual(request.headers["authorization"], "Bearer private-access")
            if request.url.path.endswith("search"):
                self.assertEqual(request.url.params["external_reference"], "invoice-1")
                return httpx.Response(200, json={"paging": {"total": 1}, "results": [{"id": 777}]})
            return httpx.Response(200, json=payment())
        result = await self.make_adapter(handler).get_payment(CHECKOUT, INTENT)
        self.assertEqual(result.status, "paid")
        self.assertEqual(seen, ["/v1/payments/search", "/v1/payments/777"])

    async def test_multiple_recovery_payments_never_pick_arbitrary_result(self):
        for status in ("approved", "pending", "in_process", "authorized", "cancelled", "refunded"):
            with self.subTest(status=status):
                def handler(request, status=status):
                    if request.url.path.endswith("search"):
                        return httpx.Response(200, json={"paging": {"total": 2},
                            "results": [{"id": 777}, {"id": 778}]})
                    return httpx.Response(200, json=payment(id=int(request.url.path.rsplit("/", 1)[1]),
                        status=status if request.url.path.endswith("778") else "approved"))
                with self.assertRaisesRegex(ProviderError, "ambiguous"):
                    await self.make_adapter(handler).get_payment(CHECKOUT, INTENT)

    async def test_recovery_ignores_only_authenticated_rejected_attempts(self):
        for status, expected in (("approved", "paid"), ("refunded", "refunded")):
            with self.subTest(status=status):
                seen = []
                def handler(request, status=status, seen=seen):
                    seen.append(request.url.path)
                    self.assertEqual(request.headers["authorization"], "Bearer private-access")
                    if request.url.path.endswith("search"):
                        self.assertEqual(request.url.params["limit"], "10")
                        self.assertEqual(request.url.params["offset"], "0")
                        self.assertNotIn("status", request.url.params)
                        return httpx.Response(200, json={"paging": {"total": 3, "offset": 0, "limit": 10},
                            "results": [{"id": 776}, {"id": 777}, {"id": 778}]})
                    return httpx.Response(200, json=payment(id=int(request.url.path.rsplit("/", 1)[1]),
                        status=status if request.url.path.endswith("777") else "rejected"))
                result = await self.make_adapter(handler).get_payment(CHECKOUT, INTENT)
                self.assertEqual((result.provider_id, result.status), ("777", expected))
                self.assertEqual(seen, ["/v1/payments/search", "/v1/payments/776",
                                       "/v1/payments/777", "/v1/payments/778"])

    async def test_recovery_validates_rejected_attempt_identity_and_refunds(self):
        for fields, error in (({"collector_id": 99}, "provider_merchant_mismatch"),
                ({"currency_id": "USD"}, "provider_currency_mismatch"),
                ({"live_mode": True}, "provider_environment_mismatch"),
                ({"transaction_amount": 1}, "provider_amount_mismatch"),
                ({"external_reference": "other-invoice"}, "provider_reference_mismatch"),
                ({"transaction_amount_refunded": 1}, "partial_refund_requires_review"),
                ({"transaction_amount_refunded": 123.45}, "ambiguous_provider_payments")):
            with self.subTest(fields=fields):
                def handler(request, fields=fields):
                    if request.url.path.endswith("search"):
                        return httpx.Response(200, json={"paging": {"total": 2},
                            "results": [{"id": 777}, {"id": 778}]})
                    data = (payment() if request.url.path.endswith("777")
                            else payment(id=778, status="rejected", **fields))
                    return httpx.Response(200, json=data)
                with self.assertRaisesRegex(ProviderError, error):
                    await self.make_adapter(handler).get_payment(CHECKOUT, INTENT)

    async def test_recovery_requires_complete_bounded_unique_search_results(self):
        cases = (
            ({"total": 11}, [{"id": value} for value in range(10)]),
            ({"total": 2}, [{"id": 777}]),
            ({"total": 1}, [{"id": 777}, {"id": 778}]),
            ({"total": 2}, [{"id": 777}, {"id": 777}]),
            ({"total": 1, "offset": 1}, [{"id": 777}]),
            ({"total": 1, "offset": True}, [{"id": 777}]),
        )
        for paging, rows in cases:
            with self.subTest(paging=paging, rows=rows):
                def handler(request, paging=paging, rows=rows):
                    self.assertTrue(request.url.path.endswith("search"),
                                    "Incomplete results must not fetch details")
                    return httpx.Response(200, json={"paging": paging, "results": rows})
                with self.assertRaises(ProviderError):
                    await self.make_adapter(handler).get_payment(CHECKOUT, INTENT)

    async def test_empty_recovery_remains_pending(self):
        adapter = self.make_adapter(lambda request: httpx.Response(200,
            json={"paging": {"total": 0}, "results": []}))
        result = await adapter.get_payment(CHECKOUT, INTENT)
        self.assertEqual(result.status, "pending")

    async def test_custom_yape_has_durable_idempotency_and_validates_response(self):
        def handler(request):
            self.assertEqual(request.url.path, "/v1/payments")
            self.assertEqual(request.headers["x-idempotency-key"], "attempt-123")
            data = json.loads(request.content)
            self.assertEqual(data["token"], "single-use-token")
            self.assertEqual(data["external_reference"], INTENT.reference)
            self.assertEqual(data["installments"], 1)
            self.assertEqual(data["payment_method_id"], "yape")
            self.assertEqual(data["payer"]["email"], INTENT.payer_email)
            return httpx.Response(201, json=payment())
        result = await self.make_adapter(handler).create_yape_payment(
            INTENT, "single-use-token", "attempt-123")
        self.assertEqual(result.status, "paid")

    async def test_live_mode_is_explicit_even_for_identically_prefixed_tokens(self):
        adapter = self.make_adapter(lambda request: httpx.Response(200, json=payment(live_mode=True)), "live")
        self.assertEqual((await adapter.get_payment(CHECKOUT, INTENT, "777")).status, "paid")
        with self.assertRaises(ProviderError):
            self.make_adapter(lambda request: httpx.Response(200), "production")

    async def test_network_and_provider_errors_are_safe_and_retryable(self):
        def timeout(request):
            raise httpx.ReadTimeout("secret-token-in-upstream-message", request=request)
        for handler in (timeout, lambda request: httpx.Response(503, text="private-access")):
            with self.assertRaises(ProviderError) as result:
                await self.make_adapter(handler).get_payment(CHECKOUT, INTENT, "777")
            self.assertTrue(result.exception.retryable)
            self.assertNotIn("private", str(result.exception))
            self.assertNotIn("secret-token", str(result.exception))

    async def test_api_redirect_cannot_forward_credentials_to_another_host(self):
        visited = []
        def handler(request):
            visited.append(request.url.host)
            return httpx.Response(302, headers={"location": "https://evil.example/collect"})
        with self.assertRaises(ProviderError):
            await self.make_adapter(handler).get_payment(CHECKOUT, INTENT, "777")
        self.assertEqual(visited, ["api.mercadopago.com"])

    async def test_notification_requires_signature_and_matching_signed_query_id(self):
        adapter = self.make_adapter(lambda request: httpx.Response(500))
        body, headers, query = signed_notification()
        self.assertEqual(adapter.verify_notification(body, headers, query, CHECKOUT), "777")
        for supplied_body, supplied_headers, supplied_query in (
            (body, headers, {"data.id": "778"}),
            (json.dumps({"type": "payment", "data": {"id": "778"}}).encode(), headers, query),
            (body, {**headers, "x-signature": "ts=1704908010,v1=" + "0" * 64}, query),
            (body, headers, {}), (body, {}, query), (b"invalid", headers, query),
        ):
            with self.subTest(query=supplied_query), self.assertRaises(ProviderError):
                adapter.verify_notification(supplied_body, supplied_headers, supplied_query, CHECKOUT)

    async def test_notification_rejects_wrong_collector_environment_and_topic(self):
        adapter = self.make_adapter(lambda request: httpx.Response(500))
        for changes in ({"user_id": 99}, {"live_mode": True}, {"type": "mp-connect"}):
            with self.assertRaises(ProviderError):
                adapter.verify_notification(*signed_notification(**changes), CHECKOUT)

    async def test_invalid_reference_id_cannot_change_api_path(self):
        adapter = self.make_adapter(lambda request: self.fail("Invalid IDs must not trigger a request"))
        for event_id in ("../users/me", "777?extra=1", "https://evil.example"):
            with self.assertRaises(ProviderError):
                await adapter.get_payment(CHECKOUT, INTENT, event_id)
        with self.assertRaises(ProviderError):
            await adapter.create_checkout(replace(INTENT, currency="USD"))


class OAuthTests(unittest.IsolatedAsyncioTestCase):
    def test_authorization_binds_pkce_state_and_exact_redirect(self):
        verifier = "A" * 43
        url = authorization_url("123", "https://demo.soyrocoto.com/oauth/callback", "random-state", verifier)
        parsed = urlsplit(url)
        self.assertEqual(parsed.netloc, "auth.mercadopago.com")
        args = parse_qs(parsed.query)
        self.assertEqual(args["state"], ["random-state"])
        self.assertEqual(args["code_challenge_method"], ["S256"])
        self.assertNotIn(verifier, url)
        self.assertEqual(args["redirect_uri"], ["https://demo.soyrocoto.com/oauth/callback"])
        for redirect in ("http://evil.example/callback", "https://user@demo.soyrocoto.com/callback"):
            with self.assertRaises(ProviderError):
                authorization_url("123", redirect, "random-state", verifier)

    async def test_code_exchange_and_refresh_return_only_allowed_fields(self):
        def handler(request):
            self.assertEqual(str(request.url), "https://api.mercadopago.com/oauth/token")
            body = json.loads(request.content)
            self.assertEqual(body["client_id"], "123")
            self.assertEqual(body["client_secret"], "client-secret")
            if body["grant_type"] == "authorization_code":
                self.assertEqual(body["code_verifier"], "A" * 43)
                self.assertTrue(body["test_token"])
            else:
                self.assertEqual(body["refresh_token"], "old-refresh")
            return httpx.Response(200, json={"access_token": "new-access", "refresh_token": "new-refresh",
                "public_key": "new-public", "user_id": 42, "scope": "read write offline_access",
                "expires_in": 15552000, "live_mode": False, "unexpected_secret": "discard"})
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            result = await exchange_code(client, client_id="123", client_secret="client-secret",
                redirect_uri="https://demo.soyrocoto.com/oauth/callback", code="auth-code",
                verifier="A" * 43, environment="sandbox")
            self.assertEqual(result["collector_id"], "42")
            self.assertNotIn("unexpected_secret", result)
            self.assertEqual(result["environment"], "sandbox")
            self.assertGreater(result["expires_at"], 0)
            refreshed = await refresh_tokens(client, client_id="123", client_secret="client-secret",
                refresh_token="old-refresh", environment="sandbox")
            self.assertEqual(refreshed["refresh_token"], "new-refresh")

    async def test_oauth_wrong_mode_is_rejected(self):
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda request: httpx.Response(200,
            json={"access_token": "access", "refresh_token": "refresh", "public_key": "public",
                  "user_id": 42, "expires_in": 1, "scope": "offline_access", "live_mode": True}))) as client:
            with self.assertRaises(ProviderError):
                await refresh_tokens(client, client_id="123", client_secret="secret",
                                     refresh_token="old", environment="sandbox")


if __name__ == "__main__":
    unittest.main()
