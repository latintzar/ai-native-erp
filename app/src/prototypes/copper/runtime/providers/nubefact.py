"""NubeFact JSON submit/query transport; invoice identity belongs to the caller's ledger.

Official manual linked from https://www.nubefact.com/integracion:
https://docs.google.com/document/d/1QWWSILBbjd4MDkJl7vCkL2RZvkPh0IC7Wa67BvoYIhA/edit
The September 2026 manual specifies Authorization: <token> on the seller's API route.
Submit is one attempt. On an uncertain outcome, query the same type/series/number.
"""
from __future__ import annotations

import json
import re
from urllib.parse import urlsplit

import httpx

from ..contracts import ProviderError


def validate_api_url(value: str) -> str:
    try:
        parsed = urlsplit(value)
        if (parsed.scheme != "https" or parsed.hostname != "api.nubefact.com" or parsed.port not in (None, 443)
                or parsed.username or parsed.password or parsed.query or parsed.fragment
                or not re.fullmatch(r"/api/v1/[A-Za-z0-9_-]{8,128}", parsed.path)
                or any(char.isspace() for char in value)):
            raise ValueError
    except (ValueError, TypeError, AttributeError):
        raise ProviderError("nubefact_invalid_api_url") from None
    return value


def _identity(document_type: object, series: object, number: object) -> dict:
    if (type(document_type) is not int or document_type not in (1, 2, 3, 4)
            or not isinstance(series, str) or not re.fullmatch(r"[FB][A-Z0-9]{3}", series)
            or (document_type == 1 and not series.startswith("F")) or (document_type == 2 and not series.startswith("B"))
            or type(number) is not int or not 1 <= number <= 99999999):
        raise ProviderError("nubefact_invalid_document_identity")
    return {"tipo_de_comprobante": document_type, "serie": series, "numero": number}


class NubeFactClient:
    def __init__(self, api_url: str, token: str, client: httpx.AsyncClient) -> None:
        self.url = validate_api_url(api_url)
        if not isinstance(token, str) or not token or len(token) > 4096 or any(char.isspace() for char in token):
            raise ProviderError("nubefact_credentials_required")
        self._token = token
        self.client = client

    async def _send(self, payload: dict, identity: dict, *, creating: bool) -> dict:
        try:
            encoded = json.dumps(payload, allow_nan=False, ensure_ascii=False).encode("utf-8")
        except (ValueError, TypeError, OverflowError):
            raise ProviderError("nubefact_invalid_payload") from None
        if len(encoded) > 1_000_000:
            raise ProviderError("nubefact_payload_too_large")
        uncertain = "creation_uncertain" if creating else "nubefact_unavailable"
        try:
            response = await self.client.post(self.url, content=encoded,
                headers={"Authorization": self._token, "Content-Type": "application/json"},
                timeout=30.0, follow_redirects=False)
        except httpx.HTTPError:
            raise ProviderError(uncertain, retryable=not creating) from None
        if response.status_code >= 500 or response.status_code in (408, 429):
            raise ProviderError(uncertain, retryable=not creating)
        if not 200 <= response.status_code < 300:
            raise ProviderError("nubefact_request_rejected")
        invalid = "creation_uncertain" if creating else "nubefact_invalid_response"
        if len(response.content) > 8_000_000:
            raise ProviderError(invalid)
        try:
            body = response.json()
        except (ValueError, UnicodeError):
            raise ProviderError(invalid) from None
        if not isinstance(body, dict):
            raise ProviderError(invalid)
        if body.get("errors"):
            # Keep provider text (which can include private document data) out of exceptions.
            code = body.get("codigo")
            safe_code = str(code) if type(code) is int and 0 <= code <= 9999 else "unknown"
            raise ProviderError(f"nubefact_operation_rejected_{safe_code}")
        if any(type(body.get(key)) is not type(value) or body.get(key) != value for key, value in identity.items()):
            raise ProviderError(invalid)
        if type(body.get("aceptada_por_sunat")) is not bool:
            raise ProviderError(invalid)
        if body.get("anulado") is not None and type(body["anulado"]) is not bool:
            raise ProviderError(invalid)
        accepted = body["aceptada_por_sunat"]
        # False may mean queued, SUNAT unavailable, or rejected. Preserve evidence for review.
        fields = ("enlace", "enlace_del_pdf", "enlace_del_xml", "enlace_del_cdr", "aceptada_por_sunat",
                  "sunat_description", "sunat_note", "sunat_responsecode", "sunat_soap_error", "anulado",
                  "cadena_para_codigo_qr", "codigo_hash")
        return {**identity, **{key: body[key] for key in fields if key in body},
                "acceptance": "accepted" if accepted else "pending"}

    async def submit(self, payload: dict) -> dict:
        if not isinstance(payload, dict):
            raise ProviderError("nubefact_invalid_payload")
        identity = _identity(payload.get("tipo_de_comprobante"), payload.get("serie"), payload.get("numero"))
        if payload.get("operacion", "generar_comprobante") != "generar_comprobante":
            raise ProviderError("nubefact_invalid_operation")
        # Delivery to the buyer is an explicit application workflow, separate from issuance.
        body = {**payload, "operacion": "generar_comprobante", "enviar_automaticamente_al_cliente": False}
        return await self._send(body, identity, creating=True)

    async def query(self, document_type: int, series: str, number: int) -> dict:
        identity = _identity(document_type, series, number)
        return await self._send({"operacion": "consultar_comprobante", **identity}, identity, creating=False)
