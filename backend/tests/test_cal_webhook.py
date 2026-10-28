"""Provider-free Cal authentication, including exact bytes and bounded streaming."""

import asyncio
import hashlib
import hmac

import pytest
from fastapi import HTTPException
from starlette.requests import Request

import cal_webhook
import config

SECRET = "synthetic-cal-signing-secret"
RAW = b'{"triggerEvent":"BOOKING_CREATED", "payload":{"uid":"synthetic-1"}}'


def signature(raw=RAW, secret=SECRET):
    return hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()


def test_accepts_exact_signed_bytes():
    assert cal_webhook.verified_payload(RAW, signature(), SECRET)["payload"]["uid"] == "synthetic-1"


@pytest.mark.parametrize(
    "raw,sig,secret,status",
    [
        (RAW, "", SECRET, 403),
        (RAW, signature(secret="forged"), SECRET, 403),
        (RAW.replace(b", ", b","), signature(), SECRET, 403),
        (RAW, "a" * 63, SECRET, 403),
        (RAW, "é" * 64, SECRET, 403),
        (RAW, signature(), "", 503),
        (b"[]", signature(b"[]"), SECRET, 400),
        (b"{", signature(b"{"), SECRET, 400),
        (b"x" * (cal_webhook.MAX_BODY_BYTES + 1), "", SECRET, 413),
    ],
)
def test_refuses_before_any_application_effect(raw, sig, secret, status):
    with pytest.raises(HTTPException) as error:
        cal_webhook.verified_payload(raw, sig, secret)
    assert error.value.status_code == status


def test_streaming_and_duplicate_signature_headers(monkeypatch):
    monkeypatch.setattr(config, "ROCOTO_CAL_WEBHOOK_SECRET", SECRET)

    async def run(headers):
        async def receive():
            return {"type": "http.request", "body": RAW, "more_body": False}

        request = Request({"type": "http", "headers": headers}, receive)
        return await cal_webhook.authenticated_payload(request)

    header = (b"x-cal-signature-256", signature().encode())
    assert asyncio.run(run([header]))["triggerEvent"] == "BOOKING_CREATED"
    with pytest.raises(HTTPException) as error:
        asyncio.run(run([header, header]))
    assert error.value.status_code == 403
