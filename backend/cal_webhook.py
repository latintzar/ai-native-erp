"""Authenticate Cal webhook bytes before parsing or applying booking effects.

Protocol: https://cal.com/docs/developing/guides/automation/webhooks
Cal signs the exact request body with HMAC-SHA256 in X-Cal-Signature-256.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import re

from fastapi import HTTPException, Request

import config

MAX_BODY_BYTES = 1024 * 1024


def verified_payload(raw: bytes, signature: str, secret: str) -> dict:
    """Return an authenticated JSON object; fail closed even in development."""
    if not secret:
        raise HTTPException(503, "cal_webhook_unconfigured")
    if len(raw) > MAX_BODY_BYTES:
        raise HTTPException(413, "cal_webhook_body_too_large")
    expected = hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()
    if not re.fullmatch(r"[a-fA-F0-9]{64}", signature) or not hmac.compare_digest(
        expected, signature.lower()
    ):
        raise HTTPException(403, "cal_webhook_signature_required")
    try:
        payload = json.loads(raw)
    except (ValueError, UnicodeError) as exc:
        raise HTTPException(400, "cal_webhook_json_required") from exc
    if not isinstance(payload, dict):
        raise HTTPException(400, "cal_webhook_object_required")
    return payload


async def authenticated_payload(request: Request) -> dict:
    if not config.ROCOTO_CAL_WEBHOOK_SECRET:
        raise HTTPException(503, "cal_webhook_unconfigured")
    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > MAX_BODY_BYTES:
            raise HTTPException(413, "cal_webhook_body_too_large")
    signatures = request.headers.getlist("x-cal-signature-256")
    signature = signatures[0] if len(signatures) == 1 else ""
    return verified_payload(bytes(body), signature, config.ROCOTO_CAL_WEBHOOK_SECRET)
