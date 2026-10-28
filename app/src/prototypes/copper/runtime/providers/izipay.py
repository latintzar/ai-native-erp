"""Izipay's documented individual Yape links; provider execution requires credentials."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import re
from collections.abc import Mapping
from datetime import date, datetime, timedelta
from urllib.parse import urlsplit
from uuid import uuid4
from zoneinfo import ZoneInfo

import httpx

from ..contracts import Checkout, PaymentIntent, PaymentObservation, ProviderError, minor_units

_BASES = {"sandbox": "https://sandbox-api-pw.izipay.pe", "live": "https://api-pw.izipay.pe"}
_LIMA = ZoneInfo("America/Lima")
_CUSTOMER_LENGTHS = {
    "firstName": (2, 50), "lastName": (2, 50), "email": (5, 50),
    "phoneNumber": (7, 15), "street": (5, 25), "postalCode": (5, 10),
    "city": (3, 40), "state": (3, 40), "country": (2, 2),
}
_PAID_STATES = {"AUTORIZADA", "PENDIENTE_DE_DEPOSITO", "DEPOSITADA", "ABONADA"}
_PENDING_STATES = {"PRE_AUTORIZADA"}


def _https_url(value: object, *, checkout: bool = False) -> str:
    if not isinstance(value, str):
        raise ProviderError("izipay_invalid_url")
    try:
        parsed = urlsplit(value)
        valid = (parsed.scheme == "https" and parsed.hostname and not parsed.username
                 and not parsed.password and parsed.port in (None, 443)
                 and not any(char.isspace() for char in value))
        if checkout:
            # The official OpenAPI response documents this exact hosted origin.
            valid = valid and parsed.hostname == "paymentlink.izipay.pe" and parsed.path.startswith("/pay/")
        if not valid:
            raise ValueError("url")
    except ValueError as exc:
        raise ProviderError("izipay_invalid_url") from exc
    return value


def _customer(value: object) -> dict[str, str]:
    if not isinstance(value, dict):
        raise ProviderError("izipay_customer_details_required")
    for key, (minimum, maximum) in _CUSTOMER_LENGTHS.items():
        field = value.get(key)
        if not isinstance(field, str) or not field.strip() or not minimum <= len(field) <= maximum:
            raise ProviderError("izipay_customer_details_required")
    kind, document = value.get("documentType"), value.get("document")
    sizes = {"DNI": (8, 8), "RUC": (11, 11), "CE": (9, 12), "PASAPORTE": (8, 12), "OTROS": (8, 12)}
    if not isinstance(kind, str) or kind not in sizes or not isinstance(document, str):
        raise ProviderError("izipay_customer_details_required")
    minimum, maximum = sizes[kind]
    if not minimum <= len(document) <= maximum or (kind in {"DNI", "RUC"} and not document.isdecimal()):
        raise ProviderError("izipay_customer_details_required")
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", value["email"]):
        raise ProviderError("izipay_customer_details_required")
    if not re.fullmatch(r"[A-Z]{2}", value["country"]):
        raise ProviderError("izipay_customer_details_required")
    # API address objects prohibit additional properties.
    return {key: value[key] for key in (*_CUSTOMER_LENGTHS, "documentType", "document")}


class IzipayAdapter:
    def __init__(self, credentials: dict[str, str], environment: str, client: httpx.AsyncClient) -> None:
        if environment not in _BASES:
            raise ProviderError("invalid_provider_environment")
        if any(not isinstance(credentials.get(key), str) or not credentials[key].strip()
               for key in ("merchant_code", "api_key", "hash_key")):
            raise ProviderError("izipay_credentials_required")
        self.credentials = credentials.copy()
        self.base = _BASES[environment]
        self.client = client
        self.merchant = credentials["merchant_code"]

    async def _send(self, path: str, body: dict, headers: dict, *, creating: bool = False) -> dict:
        try:
            response = await self.client.post(self.base + path, json=body, headers=headers,
                                              timeout=20.0, follow_redirects=False)
        except httpx.HTTPError as exc:
            raise ProviderError("creation_uncertain" if creating else "izipay_unavailable",
                                retryable=not creating) from exc
        if response.status_code >= 500:
            raise ProviderError("creation_uncertain" if creating else "izipay_unavailable",
                                retryable=not creating)
        if response.status_code != 200:
            raise ProviderError("izipay_request_rejected")
        try:
            data = response.json()
        except (ValueError, UnicodeError) as exc:
            raise ProviderError("creation_uncertain" if creating else "izipay_invalid_response") from exc
        if not isinstance(data, dict):
            raise ProviderError("creation_uncertain" if creating else "izipay_invalid_response")
        if not isinstance(data.get("code"), str) or not data["code"]:
            raise ProviderError("creation_uncertain" if creating else "izipay_invalid_response")
        if data.get("code") != "00":
            raise ProviderError("izipay_operation_rejected")
        return data

    async def _post(self, path: str, body: dict, *, creating: bool = False) -> dict:
        transaction_id = uuid4().hex
        headers = {"transactionId": transaction_id, "Content-Type": "application/json"}
        token_response = await self._send("/security/v1/Token/Generate", {
            "requestSource": "ECOMMERCE", "merchantCode": self.merchant,
            "orderNumber": self.merchant, "publicKey": self.credentials["api_key"], "amount": "0.00",
        }, headers)
        token = token_response.get("response", {})
        token = token.get("token") if isinstance(token, dict) else None
        if not isinstance(token, str) or not token:
            raise ProviderError("izipay_invalid_token_response")
        return await self._send(path, body, {**headers, "Authorization": "Bearer " + token}, creating=creating)

    def _link(self, data: dict, intent: PaymentIntent, expected_id: str = "") -> dict:
        link = data.get("response")
        if not isinstance(link, dict):
            raise ProviderError("izipay_invalid_link_response")
        link_id = link.get("paymentLinkId")
        if (not isinstance(link_id, str) or not re.fullmatch(r"[a-fA-F0-9]{32}", link_id)
                or (expected_id and link_id != expected_id)):
            raise ProviderError("izipay_link_mismatch")
        if (link.get("merchantCode") != self.merchant
                or link.get("referenceCode") != intent.reference
                or link.get("currency") != intent.currency
                or minor_units(link.get("amount")) != intent.amount_minor
                or link.get("payMethod", "YAPE_CODE") != "YAPE_CODE"
                or link.get("wayOfUse", "INDIVIDUAL") != "INDIVIDUAL"):
            raise ProviderError("izipay_link_mismatch")
        return link

    async def create_checkout(self, intent: PaymentIntent) -> Checkout:
        if (type(intent.amount_minor) is not int or not 1 <= intent.amount_minor <= 200000
                or intent.currency != "PEN"):
            raise ProviderError("izipay_yape_amount_or_currency_invalid")
        if not 1 <= len(intent.reference) <= 64 or not 1 <= len(intent.description) <= 100:
            raise ProviderError("izipay_document_details_invalid")
        billing, shipping = _customer(intent.billing), _customer(intent.shipping)
        callback = _https_url(intent.notify_url)
        if len(callback) > 400:
            raise ProviderError("izipay_invalid_url")
        terms = self.credentials.get("terms_url") or None
        if terms is not None and (len(_https_url(terms)) > 255):
            raise ProviderError("izipay_invalid_url")
        now = datetime.now(_LIMA)
        data = await self._post("/paymentlink/api/v1/process/generate", {
            "merchantCode": self.merchant, "productDescription": intent.description,
            "amount": intent.amount, "currency": intent.currency,
            "expirationDate": (now + timedelta(days=1)).strftime("%Y-%m-%d %H:%M:%S.000"),
            "wayOfUse": "INDIVIDUAL", "email_Notification": None, "payMethod": "YAPE_CODE",
            "referenceCode": intent.reference, "languageUsed": "ESP",
            "urL_Terms_and_Conditions": terms, "urlIpn": callback,
            "billing": billing, "shipping": shipping, "customFields": [],
        }, creating=True)
        try:
            link = self._link(data, intent)
            url = _https_url(link.get("urL_PaymentLink"), checkout=True)
        except ProviderError as exc:
            # A successful create with an unusable response may still have created a payable link.
            raise ProviderError("creation_uncertain") from exc
        return Checkout(link["paymentLinkId"], url, now.date().isoformat())

    def verify_notification(self, body: bytes, headers: Mapping[str, str],
                            query: Mapping[str, str], checkout: Checkout) -> str:
        try:
            envelope = json.loads(body)
            payload, signature = envelope["payloadHttp"], envelope["signature"]
            if not isinstance(payload, str) or not isinstance(signature, str):
                raise ValueError("signature")
            expected = base64.b64encode(hmac.new(self.credentials["hash_key"].encode("utf-8"),
                                                payload.encode("utf-8"), hashlib.sha256).digest()).decode("ascii")
            if not hmac.compare_digest(expected, signature):
                raise ValueError("signature")
            signed = json.loads(payload)
            response = signed["response"]
            merchant = response.get("merchant", {}).get("merchantCode", response.get("merchantCode"))
            if merchant != self.merchant:
                raise ValueError("merchant")
            orders = response.get("order", [])
            if not isinstance(orders, list):
                raise ValueError("order")
            order = orders[0] if len(orders) == 1 else {}
            if len(orders) > 1:
                raise ValueError("ambiguous_order")
            for obj in (response, order):
                if obj.get("paymentLinkId") and obj["paymentLinkId"] != checkout.provider_id:
                    raise ValueError("link")
            event_id = order.get("orderNumber") or response.get("orderNumber") or signed.get("transactionId")
            if not isinstance(event_id, str) or not 1 <= len(event_id) <= 64:
                raise ValueError("event")
            return event_id
        except (ValueError, TypeError, KeyError, AttributeError, IndexError) as exc:
            raise ProviderError("izipay_invalid_notification") from exc

    async def get_payment(self, checkout: Checkout, intent: PaymentIntent, event_id: str = "") -> PaymentObservation:
        if not re.fullmatch(r"[a-fA-F0-9]{32}", checkout.provider_id):
            raise ProviderError("izipay_invalid_link_id")
        link_data = await self._post("/paymentlink/api/v1/process/search", {
            "paymentLinkId": checkout.provider_id, "merchantCode": self.merchant, "languageUsed": "ESP",
        })
        link = self._link(link_data, intent, checkout.provider_id)
        # The authenticated link query documents urL_PaymentLink for both usage modes.
        # Validate the actual buyer destination as well as the link's financial identity.
        if _https_url(link.get("urL_PaymentLink"), checkout=True) != checkout.url:
            raise ProviderError("izipay_checkout_url_mismatch")
        today = datetime.now(_LIMA).date()
        try:
            start = date.fromisoformat(checkout.recovery_token)
            if start > today:
                raise ValueError("future")
        except ValueError as exc:
            raise ProviderError("izipay_invalid_recovery_date") from exc
        rows: list[dict] = []
        page = 1
        while True:
            data = await self._post(f"/paymentlink/api/payment-links/{checkout.provider_id}/transactions/search", {
                "stateList": ["0"], "dateTimeStart": start.isoformat(), "dateTimeEnd": today.isoformat(),
                "payMethod": "YAPE_CODE", "orderNumber": "", "transactionId": "",
                "pagination": {"pageNumber": str(page), "pageSize": "100"},
            })
            result = data.get("response")
            if not isinstance(result, dict) or not isinstance(result.get("transactions"), list):
                raise ProviderError("izipay_invalid_transaction_response")
            batch, total = result["transactions"], result.get("totalRecords")
            if (type(total) is not int or total < 0 or len(batch) > 100
                    or result.get("currentPage") != page
                    or any(not isinstance(row, dict) for row in batch)):
                raise ProviderError("izipay_invalid_transaction_response")
            rows.extend(batch)
            if len(rows) >= total:
                break
            if not batch or page >= 100:
                raise ProviderError("izipay_incomplete_transaction_response", retryable=True)
            page += 1
        observations = []
        for row in rows:
            amount = minor_units(row.get("amount"))
            currency = {"S/": "PEN", "$": "USD"}.get(row.get("currencyCode"))
            method = row.get("payMethodAuthorization")
            if amount != intent.amount_minor or currency != intent.currency or method != "YAPE_CODE":
                raise ProviderError("izipay_payment_mismatch")
            provider_id = row.get("uniqueId") or row.get("transactionId") or row.get("orderNumber")
            if not isinstance(provider_id, str) or not provider_id:
                raise ProviderError("izipay_missing_payment_id")
            state = str(row.get("descriptionStatus", "")).upper().replace(" ", "_")
            if state in _PAID_STATES and row.get("code") == "00":
                status = "paid"
            elif state == "DENEGADA":
                status = "failed"
            elif state == "ANULADA":
                status = "cancelled"
            elif state in _PENDING_STATES:
                status = "pending"
            else:
                raise ProviderError("izipay_unknown_payment_state")
            observations.append(PaymentObservation(provider_id, intent.reference, amount, currency,
                                                   status, self.merchant, method))
        # An individual link has one successful payment; later failed attempts do not erase it.
        for status in ("paid", "pending", "cancelled", "failed"):
            for observation in observations:
                if observation.status == status:
                    return observation
        status = "cancelled" if str(link.get("state")) in {"5", "6"} else "pending"
        return PaymentObservation(checkout.provider_id, intent.reference, intent.amount_minor, intent.currency,
                                  status, self.merchant, "YAPE_CODE")
