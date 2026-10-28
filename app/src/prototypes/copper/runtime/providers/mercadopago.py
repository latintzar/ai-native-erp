"""Mercado Pago Peru checkout and seller authorization for Copper.

Provider callbacks identify a payment. Authenticated API details establish its
seller, environment, document association and financial state.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import re
import time
from collections.abc import Mapping
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlencode, urlsplit

import httpx

from ..contracts import Checkout, PaymentIntent, PaymentObservation, PaymentState, ProviderError, minor_units

API_ORIGIN = "https://api.mercadopago.com"
AUTHORIZATION_ENDPOINT = "https://auth.mercadopago.com/authorization"
CHECKOUT_HOSTS = frozenset({"www.mercadopago.com.pe", "sandbox.mercadopago.com.pe"})
_PAYMENT_ID = re.compile(r"[0-9]{1,30}\Z")
_PKCE_VERIFIER = re.compile(r"[A-Za-z0-9._~-]{43,128}\Z")
_RECOVERY_LIMIT = 10
_STATES: dict[str, PaymentState] = {
    "approved": "paid",
    "pending": "pending",
    "in_process": "pending",
    "authorized": "pending",
    "in_mediation": "pending",
    "rejected": "failed",
    "cancelled": "cancelled",
    "refunded": "refunded",
    # The shared state records a reversal; the observation retains payment ID.
    "charged_back": "refunded",
}


def _environment(value: str) -> bool:
    if value not in {"sandbox", "live"}:
        raise ProviderError("invalid_provider_environment")
    return value == "live"


def _text(value: object, code: str, maximum: int = 4096) -> str:
    if not isinstance(value, str) or not value or len(value) > maximum or any(
        ord(character) < 32 for character in value
    ):
        raise ProviderError(code)
    return value


def _payment_id(value: object) -> str:
    if isinstance(value, bool) or not isinstance(value, (str, int)):
        raise ProviderError("invalid_provider_payment_id")
    result = str(value)
    if not _PAYMENT_ID.fullmatch(result):
        raise ProviderError("invalid_provider_payment_id")
    return result


def _https_url(value: object, *, checkout: bool = False) -> str:
    result = _text(value, "invalid_provider_url")
    try:
        url = urlsplit(result)
        valid = (url.scheme == "https" and url.hostname and url.port in {None, 443}
                 and url.username is None and url.password is None and not url.fragment)
        if checkout:
            valid = (valid and url.hostname in CHECKOUT_HOSTS
                     and url.path.rstrip("/") == "/checkout/v1/redirect")
        if not valid:
            raise ValueError("url")
    except ValueError:
        raise ProviderError("invalid_provider_url") from None
    return result


async def _request(
    client: httpx.AsyncClient,
    method: str,
    path: str,
    *,
    token: str = "",
    payload: dict[str, Any] | None = None,
    params: dict[str, str | int] | None = None,
    idempotency_key: str = "",
) -> dict[str, Any]:
    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if idempotency_key:
        headers["X-Idempotency-Key"] = idempotency_key
    try:
        response = await client.request(method, API_ORIGIN + path, headers=headers, json=payload,
                                        params=params, follow_redirects=False, timeout=20.0)
    except httpx.RequestError:
        # A creation timeout can follow successful processing. The caller must
        # recover the existing attempt before creating another preference/charge.
        code = "mercadopago_request_uncertain" if method == "POST" else "mercadopago_unavailable"
        raise ProviderError(code, retryable=True) from None
    if not 200 <= response.status_code < 300:
        if response.status_code in {401, 403}:
            raise ProviderError("mercadopago_credentials_rejected")
        retryable = response.status_code == 429 or response.status_code >= 500
        raise ProviderError("mercadopago_request_failed", retryable=retryable)
    try:
        result = response.json()
    except (ValueError, UnicodeError):
        raise ProviderError("invalid_provider_response") from None
    if not isinstance(result, dict):
        raise ProviderError("invalid_provider_response")
    return result


class MercadoPagoAdapter:
    def __init__(self, credentials: dict[str, str], environment: str, client: httpx.AsyncClient):
        self.environment = environment
        self.live_mode = _environment(environment)
        self.client = client
        self.access_token = _text(credentials.get("access_token"), "missing_provider_access_token")
        self.collector_id = _payment_id(credentials.get("collector_id"))
        self.webhook_secret = credentials.get("webhook_secret", "")

    def _validate_intent(self, intent: PaymentIntent) -> float:
        if (isinstance(intent.amount_minor, bool) or not isinstance(intent.amount_minor, int)
                or intent.amount_minor <= 0 or intent.amount_minor > 999999999999
                or intent.currency != "PEN"):
            raise ProviderError("invalid_payment_intent")
        _text(intent.reference, "invalid_payment_reference", 256)
        _https_url(intent.notify_url)
        _https_url(intent.return_url)
        amount = float(intent.amount)
        if minor_units(amount) != intent.amount_minor:
            raise ProviderError("invalid_payment_intent")
        return amount

    async def create_checkout(self, intent: PaymentIntent) -> Checkout:
        amount = self._validate_intent(intent)
        payload: dict[str, Any] = {
            "items": [{"id": intent.reference, "title": intent.description,
                       "quantity": 1, "currency_id": intent.currency, "unit_price": amount}],
            "external_reference": intent.reference,
            "notification_url": intent.notify_url,
            "back_urls": dict.fromkeys(("success", "pending", "failure"), intent.return_url),
            "auto_return": "approved",
            "expires": True,
            "expiration_date_to": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat(),
        }
        if intent.payer_email:
            payload["payer"] = {"email": intent.payer_email}
        result = await _request(self.client, "POST", "/checkout/preferences",
                                token=self.access_token, payload=payload)
        if _payment_id(result.get("collector_id")) != self.collector_id:
            raise ProviderError("provider_merchant_mismatch")
        if result.get("external_reference", intent.reference) != intent.reference:
            raise ProviderError("provider_reference_mismatch")
        provider_id = _text(result.get("id"), "invalid_provider_checkout_id", 200)
        if not re.fullmatch(r"[A-Za-z0-9_-]+", provider_id):
            raise ProviderError("invalid_provider_checkout_id")
        target = result.get("init_point")
        if not self.live_mode:
            target = result.get("sandbox_init_point") or target
        return Checkout(provider_id=provider_id, url=_https_url(target, checkout=True))

    def _observation(self, data: dict[str, Any], intent: PaymentIntent,
                     expected_id: str = "") -> PaymentObservation:
        payment_id = _payment_id(data.get("id"))
        if expected_id and payment_id != expected_id:
            raise ProviderError("provider_payment_mismatch")
        if data.get("live_mode") is not self.live_mode:
            raise ProviderError("provider_environment_mismatch")
        collector = _payment_id(data.get("collector_id"))
        if collector != self.collector_id:
            raise ProviderError("provider_merchant_mismatch")
        if data.get("external_reference") != intent.reference:
            raise ProviderError("provider_reference_mismatch")
        if data.get("currency_id") != intent.currency:
            raise ProviderError("provider_currency_mismatch")
        amount = minor_units(data.get("transaction_amount"))
        if amount != intent.amount_minor:
            raise ProviderError("provider_amount_mismatch")
        upstream_status = data.get("status")
        if not isinstance(upstream_status, str) or upstream_status not in _STATES:
            raise ProviderError("unknown_provider_payment_status")
        status = _STATES[upstream_status]
        refunded = minor_units(data.get("transaction_amount_refunded", 0))
        if refunded > amount:
            raise ProviderError("invalid_provider_refund_amount")
        if 0 < refunded < amount:
            raise ProviderError("partial_refund_requires_review")
        if refunded == amount:
            status = "refunded"
        method = data.get("payment_method_id", "")
        if not isinstance(method, str):
            raise ProviderError("invalid_provider_response")
        return PaymentObservation(provider_id=payment_id, reference=intent.reference,
                                  amount_minor=amount, currency=intent.currency, status=status,
                                  merchant_id=collector, payment_method=method)

    async def get_payment(self, checkout: Checkout, intent: PaymentIntent,
                          event_id: str = "") -> PaymentObservation:
        self._validate_intent(intent)
        if not event_id:
            # Inspect the complete bounded result set without a status filter:
            # filtering to approved would hide pending or additional payments.
            found = await _request(self.client, "GET", "/v1/payments/search", token=self.access_token,
                                   params={"external_reference": intent.reference,
                                           "limit": _RECOVERY_LIMIT, "offset": 0})
            rows = found.get("results")
            paging = found.get("paging")
            if not isinstance(rows, list) or not isinstance(paging, dict):
                raise ProviderError("invalid_provider_response")
            total = paging.get("total")
            if isinstance(total, bool) or not isinstance(total, int) or total < 0:
                raise ProviderError("invalid_provider_response")
            offset = paging.get("offset", 0)
            limit = paging.get("limit", _RECOVERY_LIMIT)
            if (isinstance(offset, bool) or not isinstance(offset, int) or offset != 0
                    or isinstance(limit, bool) or not isinstance(limit, int)
                    or not 1 <= limit <= _RECOVERY_LIMIT):
                raise ProviderError("invalid_provider_response")
            if total > _RECOVERY_LIMIT or len(rows) > _RECOVERY_LIMIT:
                raise ProviderError("ambiguous_provider_payments")
            if total != len(rows) or total > limit:
                raise ProviderError("invalid_provider_response")
            if total == 0 and rows == []:
                return PaymentObservation(provider_id=checkout.provider_id, reference=intent.reference,
                                          amount_minor=intent.amount_minor, currency=intent.currency,
                                          status="pending", merchant_id=self.collector_id)
            if any(not isinstance(row, dict) for row in rows):
                raise ProviderError("invalid_provider_response")
            payment_ids = [_payment_id(row.get("id")) for row in rows]
            if len(set(payment_ids)) != total:
                raise ProviderError("invalid_provider_response")
            if total > 1:
                candidates = []
                ambiguous = False
                for candidate_id in payment_ids:
                    detail = await _request(self.client, "GET", f"/v1/payments/{candidate_id}",
                                            token=self.access_token)
                    observation = self._observation(detail, intent, candidate_id)
                    if detail["status"] == "rejected" and observation.status == "failed":
                        continue
                    if detail["status"] in {"approved", "refunded"}:
                        candidates.append(observation)
                    else:
                        ambiguous = True
                # Only definitively rejected attempts can be disregarded. Each
                # detail, including failures, passed the same financial checks.
                if ambiguous or len(candidates) != 1:
                    raise ProviderError("ambiguous_provider_payments")
                return candidates[0]
            event_id = payment_ids[0]
        payment_id = _payment_id(event_id)
        result = await _request(self.client, "GET", f"/v1/payments/{payment_id}", token=self.access_token)
        return self._observation(result, intent, payment_id)

    async def create_yape_payment(self, intent: PaymentIntent, token: str,
                                  idempotency_key: str) -> PaymentObservation:
        amount = self._validate_intent(intent)
        _text(token, "missing_yape_token")
        _text(idempotency_key, "missing_idempotency_key", 128)
        _text(intent.payer_email, "missing_payer_email", 320)
        result = await _request(self.client, "POST", "/v1/payments", token=self.access_token,
            idempotency_key=idempotency_key, payload={
                "token": token, "transaction_amount": amount, "description": intent.description,
                "installments": 1, "payment_method_id": "yape", "payer": {"email": intent.payer_email},
                "external_reference": intent.reference, "notification_url": intent.notify_url,
            })
        observation = self._observation(result, intent)
        if observation.payment_method != "yape":
            raise ProviderError("provider_payment_method_mismatch")
        return observation

    def verify_notification(self, body: bytes, headers: Mapping[str, str],
                            query: Mapping[str, str], checkout: Checkout) -> str:
        # The manifest signs the query ID rather than the body. Binding both
        # prevents an attacker replacing the unsigned body with a different ID.
        secret = _text(self.webhook_secret, "missing_webhook_secret")
        incoming = {key.lower(): value for key, value in headers.items()}
        payment_id = _payment_id(query.get("data.id"))
        request_id = _text(incoming.get("x-request-id"), "invalid_webhook_signature", 200)
        if ";" in request_id:
            raise ProviderError("invalid_webhook_signature")
        signature = _text(incoming.get("x-signature"), "invalid_webhook_signature", 1024)
        pairs: dict[str, str] = {}
        for part in signature.split(","):
            key, separator, value = part.strip().partition("=")
            if not separator or key in pairs:
                raise ProviderError("invalid_webhook_signature")
            pairs[key] = value
        timestamp, digest = pairs.get("ts", ""), pairs.get("v1", "")
        if not re.fullmatch(r"[0-9]{1,16}", timestamp) or not re.fullmatch(r"[0-9a-f]{64}", digest):
            raise ProviderError("invalid_webhook_signature")
        manifest = f"id:{payment_id};request-id:{request_id};ts:{timestamp};"
        expected = hmac.new(secret.encode(), manifest.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, digest):
            raise ProviderError("invalid_webhook_signature")
        # Delayed/replayed notifications are safe because the caller fetches the
        # latest authenticated payment and applies durable observation deduplication.
        try:
            data = json.loads(body)
        except (ValueError, UnicodeError):
            raise ProviderError("invalid_webhook_body") from None
        if (not isinstance(data, dict) or data.get("type") != "payment"
                or not isinstance(data.get("data"), dict)
                or _payment_id(data["data"].get("id")) != payment_id):
            raise ProviderError("invalid_webhook_body")
        if "user_id" in data and _payment_id(data["user_id"]) != self.collector_id:
            raise ProviderError("provider_merchant_mismatch")
        if "live_mode" in data and data["live_mode"] is not self.live_mode:
            raise ProviderError("provider_environment_mismatch")
        return payment_id


def authorization_url(client_id: str, redirect_uri: str, state: str, verifier: str) -> str:
    _payment_id(client_id)
    _https_url(redirect_uri)
    _text(state, "invalid_oauth_state", 512)
    if not isinstance(verifier, str) or not _PKCE_VERIFIER.fullmatch(verifier):
        raise ProviderError("invalid_pkce_verifier")
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip("=")
    return AUTHORIZATION_ENDPOINT + "?" + urlencode({
        "client_id": client_id, "response_type": "code", "platform_id": "mp",
        "redirect_uri": redirect_uri, "state": state,
        "code_challenge": challenge, "code_challenge_method": "S256",
    })


def _tokens(data: dict[str, Any], environment: str) -> dict[str, str | int]:
    live_mode = _environment(environment)
    if data.get("live_mode") is not live_mode:
        raise ProviderError("provider_environment_mismatch")
    expires_in = data.get("expires_in")
    if isinstance(expires_in, bool) or not isinstance(expires_in, int) or expires_in <= 0:
        raise ProviderError("invalid_oauth_token_response")
    scope = _text(data.get("scope"), "invalid_oauth_token_response")
    if "offline_access" not in scope.split():
        raise ProviderError("oauth_offline_access_required")
    return {
        "access_token": _text(data.get("access_token"), "invalid_oauth_token_response"),
        "public_key": _text(data.get("public_key"), "invalid_oauth_token_response"),
        "refresh_token": _text(data.get("refresh_token"), "invalid_oauth_token_response"),
        "collector_id": _payment_id(data.get("user_id")),
        "scope": scope, "expires_in": expires_in, "expires_at": int(time.time()) + expires_in,
        "environment": environment,
    }


async def exchange_code(client: httpx.AsyncClient, *, client_id: str, client_secret: str,
                        redirect_uri: str, code: str, verifier: str,
                        environment: str) -> dict[str, str | int]:
    live_mode = _environment(environment)
    authorization_url(client_id, redirect_uri, "validation-only", verifier)
    _text(client_secret, "missing_oauth_client_secret")
    _text(code, "missing_oauth_code")
    result = await _request(client, "POST", "/oauth/token", payload={
        "client_id": client_id, "client_secret": client_secret, "code": code,
        "grant_type": "authorization_code", "redirect_uri": redirect_uri,
        "code_verifier": verifier, "test_token": not live_mode,
    })
    return _tokens(result, environment)


async def refresh_tokens(client: httpx.AsyncClient, *, client_id: str, client_secret: str,
                         refresh_token: str, environment: str) -> dict[str, str | int]:
    _environment(environment)
    _payment_id(client_id)
    _text(client_secret, "missing_oauth_client_secret")
    _text(refresh_token, "missing_oauth_refresh_token")
    result = await _request(client, "POST", "/oauth/token", payload={
        "client_id": client_id, "client_secret": client_secret,
        "grant_type": "refresh_token", "refresh_token": refresh_token,
    })
    return _tokens(result, environment)
