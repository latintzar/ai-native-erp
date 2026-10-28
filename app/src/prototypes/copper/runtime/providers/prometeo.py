"""Read-only Banking API transport using Prometeo's published SDK wire contract.

Sources: https://prometeo-python.readthedocs.io/en/stable/_modules/prometeo/banking/client.html
and https://prometeo-python.readthedocs.io/en/stable/_modules/prometeo/base_client.html
Current private provider documentation and seller/bank acceptance require commissioning.
The client retains the API key; bank passwords and session keys are request-scoped arguments.
"""
from __future__ import annotations

import re
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from urllib.parse import quote

import httpx

from ..contracts import ProviderError

_BASES = {"sandbox": "https://test.prometeo.qualia.uy", "live": "https://prometeo.qualia.uy"}


def _text(value: object, *, empty: bool = False, maximum: int = 4096) -> str:
    if not isinstance(value, str) or len(value) > maximum or (not empty and not value):
        raise ProviderError("prometeo_invalid_field")
    return value


def _id(value: object) -> str:
    if type(value) is int:
        value = str(value)
    return _text(value, maximum=256)


def _minor(value: object, *, signed: bool = False) -> int:
    try:
        if isinstance(value, bool) or not isinstance(value, (str, int, float)):
            raise ValueError
        amount = Decimal(str(value)) * 100
        if not amount.is_finite() or abs(amount) > 9007199254740991 or amount != amount.to_integral_value() or (amount < 0 and not signed):
            raise ValueError
        return int(amount)
    except (InvalidOperation, ValueError, OverflowError):
        raise ProviderError("prometeo_invalid_amount") from None


def _currency(value: object) -> str:
    value = _text(value, maximum=3)
    if not re.fullmatch(r"[A-Z]{3}", value):
        raise ProviderError("prometeo_invalid_currency")
    return value


class PrometeoClient:
    """Account reads only. Session lifetime is determined by Prometeo and the bank."""

    def __init__(self, api_key: str, environment: str, client: httpx.AsyncClient) -> None:
        if environment not in _BASES:
            raise ProviderError("invalid_provider_environment")
        self._api_key = _text(api_key)
        self.base = _BASES[environment]
        self.client = client

    async def _send(self, method: str, path: str, *, params: dict | None = None, data: dict | None = None) -> dict:
        try:
            response = await self.client.request(method, self.base + path, headers={"X-API-Key": self._api_key},
                params=params, data=data, timeout=30.0, follow_redirects=False)
        except httpx.HTTPError:
            raise ProviderError("prometeo_unavailable", retryable=method == "GET") from None
        if response.status_code >= 500 or response.status_code == 429:
            raise ProviderError("prometeo_unavailable", retryable=method == "GET")
        if len(response.content) > 8_000_000:
            raise ProviderError("prometeo_invalid_response")
        try:
            body = response.json()
        except (ValueError, UnicodeError):
            raise ProviderError("prometeo_invalid_response") from None
        if not isinstance(body, dict):
            raise ProviderError("prometeo_invalid_response")
        if body.get("status") == "wrong_credentials":
            raise ProviderError("prometeo_wrong_credentials")
        if body.get("status") == "error" and body.get("message") == "Invalid key":
            raise ProviderError("prometeo_session_expired")
        if response.status_code in (401, 403):
            raise ProviderError("prometeo_access_rejected")
        if response.status_code != 200 or body.get("status") == "error":
            raise ProviderError("prometeo_request_rejected")
        return body

    async def login(self, provider: str, username: str, password: str, extra: dict[str, str] | None = None,
                    *, session_key: str | None = None) -> dict:
        data = {"provider": _text(provider, maximum=100), "username": _text(username), "password": _text(password)}
        for key, value in (extra or {}).items():
            if not isinstance(key, str) or not re.fullmatch(r"[A-Za-z][A-Za-z0-9_]{0,99}", key) or key in {"provider", "username", "password", "key"}:
                raise ProviderError("prometeo_invalid_login_field")
            data[key] = _text(value)
        result = await self._send("POST", "/login/", data=data,
                                  params={"key": _text(session_key)} if session_key is not None else None)
        status = result.get("status")
        if status not in {"logged_in", "select_client", "interaction_required"}:
            raise ProviderError("prometeo_invalid_login_response")
        session = {"status": status, "key": _text(result.get("key"))}
        if status == "interaction_required":
            field = _text(result.get("field"), maximum=100)
            if not re.fullmatch(r"[A-Za-z][A-Za-z0-9_]{0,99}", field) or field in {"provider", "username", "password", "key"}:
                raise ProviderError("prometeo_invalid_login_response")
            session.update(field=field, context=_text(result.get("context"), empty=True))
        return session

    async def clients(self, session_key: str) -> list[dict]:
        data = await self._send("GET", "/client/", params={"key": _text(session_key)})
        clients = data.get("clients")
        if not isinstance(clients, dict):
            raise ProviderError("prometeo_invalid_response")
        return [{"id": _id(key), "name": _text(value)} for key, value in clients.items()]

    async def select_client(self, session_key: str, client_id: str) -> None:
        await self._send("GET", f"/client/{quote(_id(client_id), safe='')}/", params={"key": _text(session_key)})

    async def accounts(self, session_key: str) -> list[dict]:
        data = await self._send("GET", "/account/", params={"key": _text(session_key)})
        values = data.get("accounts")
        if not isinstance(values, list) or any(not isinstance(item, dict) for item in values):
            raise ProviderError("prometeo_invalid_response")
        return [{"id": _id(item.get("id")), "name": _text(item.get("name"), empty=True),
                 "number": _text(item.get("number")), "branch": item.get("branch"),
                 "currency": _currency(item.get("currency")), "balance_minor": _minor(item.get("balance"), signed=True)} for item in values]

    async def movements(self, session_key: str, account_number: str, currency: str, date_start: date, date_end: date) -> list[dict]:
        if not isinstance(date_start, date) or not isinstance(date_end, date) or date_start > date_end:
            raise ProviderError("prometeo_invalid_date_range")
        account_number, currency = _text(account_number), _currency(currency)
        data = await self._send("GET", "/movement/", params={"key": _text(session_key), "account": account_number,
            "currency": currency, "date_start": date_start.strftime("%d/%m/%Y"), "date_end": date_end.strftime("%d/%m/%Y")})
        values = data.get("movements")
        if not isinstance(values, list) or any(not isinstance(item, dict) for item in values):
            raise ProviderError("prometeo_invalid_response")
        movements = []
        for item in values:
            try:
                when = datetime.strptime(_text(item.get("date")), "%d/%m/%Y").date()
            except ValueError:
                raise ProviderError("prometeo_invalid_movement_date") from None
            if not date_start <= when <= date_end:
                raise ProviderError("prometeo_movement_outside_range")
            movements.append({"id": _id(item.get("id")), "reference": _text(item.get("reference"), empty=True),
                "date": when.isoformat(), "detail": _text(item.get("detail"), empty=True),
                "debit_minor": _minor(item.get("debit")), "credit_minor": _minor(item.get("credit")),
                "currency": currency, "account_number": account_number, "extra_data": item.get("extra_data")})
        return movements

    async def logout(self, session_key: str) -> None:
        await self._send("GET", "/logout/", params={"key": _text(session_key)})
