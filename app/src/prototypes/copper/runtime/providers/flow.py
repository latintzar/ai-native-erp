"""Flow Peru checkout and server-confirmed payment status.

Contract: https://developers.flow.cl/docs/tutorial-basics/create-order
The callback token identifies a checkout; the signed status request establishes
the payment result. Creation is attempted once because a timeout is uncertain.
"""

from __future__ import annotations

import hashlib
import hmac
from collections.abc import Mapping
from urllib.parse import SplitResult, parse_qsl, urlencode, urlsplit, urlunsplit

import httpx

from runtime.contracts import (
    Checkout,
    PaymentIntent,
    PaymentObservation,
    PaymentState,
    ProviderError,
    minor_units,
)

_BASE_URLS = {
    "sandbox": "https://sandbox.flow.cl/api",
    "live": "https://www.flow.cl/api",
}
_CHECKOUT_HOSTS = frozenset({"flow.cl", "www.flow.cl", "sandbox.flow.cl", "api.flow.cl"})
_STATES: dict[int, PaymentState] = {1: "pending", 2: "paid", 3: "failed", 4: "cancelled"}


class FlowAdapter:
    def __init__(self, credentials: dict[str, str], environment: str, client: httpx.AsyncClient) -> None:
        if environment not in _BASE_URLS:
            raise ProviderError("invalid_flow_environment")
        if not credentials.get("api_key") or not credentials.get("secret_key"):
            raise ProviderError("missing_flow_credentials")
        self._credentials = dict(credentials)
        self._base_url = _BASE_URLS[environment]
        self._client = client

    def _signed(self, params: dict[str, str]) -> dict[str, str]:
        values = {"apiKey": self._credentials["api_key"], **params}
        canonical = "".join(key + values[key] for key in sorted(values))
        signature = hmac.new(
            self._credentials["secret_key"].encode("utf-8"),
            canonical.encode("utf-8"), hashlib.sha256,
        ).hexdigest()
        return {**values, "s": signature}

    async def _request(self, method: str, path: str, params: dict[str, str]) -> dict:
        signed = self._signed(params)
        try:
            if method == "POST":
                response = await self._client.post(
                    self._base_url + path, data=signed, timeout=10.0, follow_redirects=False,
                )
            else:
                response = await self._client.get(
                    self._base_url + path, params=signed, timeout=10.0, follow_redirects=False,
                )
        except httpx.TimeoutException:
            raise ProviderError("flow_timeout", retryable=True) from None
        except httpx.RequestError:
            raise ProviderError("flow_connection_error", retryable=True) from None
        if response.status_code != 200:
            raise ProviderError(
                "flow_http_error", retryable=response.status_code == 429 or response.status_code >= 500,
            )
        try:
            payload = response.json()
        except (ValueError, UnicodeDecodeError):
            raise ProviderError("invalid_flow_response") from None
        if not isinstance(payload, dict):
            raise ProviderError("invalid_flow_response")
        return payload

    @staticmethod
    def _provider_id(value: object) -> str:
        if isinstance(value, bool) or not isinstance(value, (int, str)):
            raise ProviderError("invalid_flow_response")
        identifier = str(value)
        if len(identifier) > 32 or not identifier.isascii() or not identifier.isdigit() or int(identifier) <= 0:
            raise ProviderError("invalid_flow_response")
        return identifier

    @staticmethod
    def _checkout_parts(value: object) -> tuple[SplitResult, list[tuple[str, str]]]:
        if not isinstance(value, str):
            raise ProviderError("invalid_flow_checkout")
        try:
            parsed = urlsplit(value)
            if (
                parsed.scheme != "https" or parsed.hostname not in _CHECKOUT_HOSTS
                or parsed.username is not None or parsed.password is not None
                or parsed.port not in (None, 443) or parsed.fragment
            ):
                raise ValueError("checkout")
            return parsed, parse_qsl(parsed.query, keep_blank_values=True, strict_parsing=True)
        except (ValueError, TypeError):
            raise ProviderError("invalid_flow_checkout") from None

    @classmethod
    def _checkout_url(cls, value: object, token: str) -> str:
        parsed, query = cls._checkout_parts(value)
        if any(key == "token" for key, _ in query):
            raise ProviderError("invalid_flow_checkout")
        return urlunsplit(parsed._replace(query=urlencode([*query, ("token", token)])))

    @classmethod
    def _validate_recovery_url(cls, checkout: Checkout) -> None:
        _, query = cls._checkout_parts(checkout.url)
        tokens = [value for key, value in query if key == "token"]
        if len(tokens) != 1 or not hmac.compare_digest(tokens[0].encode(), checkout.recovery_token.encode()):
            raise ProviderError("invalid_flow_checkout")

    async def create_checkout(self, intent: PaymentIntent) -> Checkout:
        if (
            type(intent.amount_minor) is not int or intent.amount_minor <= 200
            or intent.currency != "PEN" or not intent.payer_email
            or not intent.reference or not intent.description
        ):
            raise ProviderError("invalid_flow_intent")
        params = {
            "commerceOrder": intent.reference, "subject": intent.description,
            "amount": intent.amount, "currency": "PEN", "email": intent.payer_email,
            "urlConfirmation": intent.notify_url, "urlReturn": intent.return_url,
        }
        payment_method = self._credentials.get("payment_method", "")
        if payment_method:
            if len(payment_method) > 16 or not payment_method.isascii() or not payment_method.isdigit() or int(payment_method) <= 0:
                raise ProviderError("invalid_flow_payment_method")
            params["paymentMethod"] = payment_method
        merchant_id = self._credentials.get("merchant_id", "")
        if merchant_id:
            params["merchantId"] = merchant_id
        payload = await self._request("POST", "/payment/create", params)
        token = payload.get("token")
        if not isinstance(token, str) or not token or len(token) > 1024:
            raise ProviderError("invalid_flow_response")
        return Checkout(
            provider_id=self._provider_id(payload.get("flowOrder")),
            url=self._checkout_url(payload.get("url"), token), recovery_token=token,
        )

    async def get_payment(
        self, checkout: Checkout, intent: PaymentIntent, event_id: str = "",
    ) -> PaymentObservation:
        if not checkout.recovery_token or (
            event_id and not hmac.compare_digest(event_id.encode(), checkout.recovery_token.encode())
        ):
            raise ProviderError("invalid_flow_notification")
        self._validate_recovery_url(checkout)
        payload = await self._request("GET", "/payment/getStatus", {"token": checkout.recovery_token})
        provider_id = self._provider_id(payload.get("flowOrder"))
        amount_minor = minor_units(payload.get("amount"))
        merchant_id = payload.get("merchantId") or ""
        expected_merchant = self._credentials.get("merchant_id", "")
        if (
            provider_id != checkout.provider_id or payload.get("commerceOrder") != intent.reference
            or payload.get("currency") != intent.currency or amount_minor != intent.amount_minor
            or (expected_merchant and merchant_id != expected_merchant)
            or not isinstance(merchant_id, str)
        ):
            raise ProviderError("flow_payment_mismatch")
        state = payload.get("status")
        if type(state) is not int or state not in _STATES:
            raise ProviderError("invalid_flow_response")
        payment_data = payload.get("paymentData")
        payment_method = payment_data.get("media", "") if isinstance(payment_data, dict) else ""
        if not isinstance(payment_method, str):
            raise ProviderError("invalid_flow_response")
        return PaymentObservation(
            provider_id=provider_id, reference=intent.reference, amount_minor=amount_minor,
            currency=intent.currency, status=_STATES[state], merchant_id=merchant_id,
            payment_method=payment_method,
        )

    def verify_notification(
        self, body: bytes, headers: Mapping[str, str], query: Mapping[str, str], checkout: Checkout,
    ) -> str:
        content_type = next((value for key, value in headers.items() if key.lower() == "content-type"), "")
        if content_type.split(";", 1)[0].strip().lower() != "application/x-www-form-urlencoded" or len(body) > 4096:
            raise ProviderError("invalid_flow_notification")
        try:
            values = parse_qsl(body.decode("utf-8"), keep_blank_values=True, strict_parsing=True)
        except (UnicodeDecodeError, ValueError):
            raise ProviderError("invalid_flow_notification") from None
        if (
            len(values) != 1 or values[0][0] != "token" or not values[0][1]
            or not checkout.recovery_token
            or not hmac.compare_digest(values[0][1].encode(), checkout.recovery_token.encode())
        ):
            raise ProviderError("invalid_flow_notification")
        return values[0][1]
