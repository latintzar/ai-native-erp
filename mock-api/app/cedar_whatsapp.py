"""Same-origin Cedar bridge to its existing, account-scoped WhatsApp development service.

The proof service retains all provider operations, host-only session semantics and private data.
This fixed-route loopback bridge gives the full Cedar UI its own host-only cookie; it never reads
or migrates the connection-preview browser's cookie. Reauthorization opens the verified account.
"""

from __future__ import annotations

import os
import re

import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response

from .cedar_access import allowed_origin

router = APIRouter()
COOKIE = "__Host-cedar_session"
POST_PATHS = {
    "session", "whatsapp/code", "whatsapp/connect", "whatsapp/diagnostics",
    "whatsapp/disconnect", "whatsapp/verify",
}
GET_PATH = re.compile(r"^(state|intake|conversations|conversations/[A-Za-z0-9_-]{1,200}/messages)$")
UPSTREAM = "http://127.0.0.1:8793"
PROVIDER_ORIGIN = "https://cedar-demo.soyrocoto.com"


@router.api_route("/api/proof/{path:path}", methods=["GET", "POST"])
async def whatsapp_bridge(path: str, request: Request) -> Response:
    permitted = path in POST_PATHS if request.method == "POST" else GET_PATH.fullmatch(path)
    if not permitted:
        raise HTTPException(404, "Choose an available WhatsApp connection action.")
    origin = request.headers.get("origin")
    if (request.method == "POST" and not origin) or (origin and not allowed_origin(origin)):
        raise HTTPException(403, "Open WhatsApp setup in Cedar’s development workspace.")
    if os.environ.get("CEDAR_WHATSAPP_BRIDGE_ENABLED") != "true":
        raise HTTPException(
            503,
            "WhatsApp setup is ready in the connection preview. Its Cedar connection is awaiting activation.",
        )
    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > 128 * 1024:
            raise HTTPException(413, "Choose a smaller WhatsApp setup request.")
    cookie = request.cookies.get(COOKIE, "")
    headers = {"Accept": "application/json", "Origin": PROVIDER_ORIGIN, "Content-Type": "application/json"}
    if re.fullmatch(r"[A-Za-z0-9_-]{20,200}", cookie):
        headers["Cookie"] = f"{COOKIE}={cookie}"
    # Forward only the documented pagination fields; the browser cannot choose a URL, host,
    # provider origin, forwarded header or private service operation.
    params = [
        (key, value) for key, value in request.query_params.multi_items()
        if key in ("after", "before", "limit")
    ]
    try:
        async with httpx.AsyncClient(timeout=65, follow_redirects=False) as client, client.stream(
            request.method,
            f"{UPSTREAM}/api/proof/{path}",
            params=params,
            headers=headers,
            content=bytes(body),
        ) as upstream:
            data = bytearray()
            async for chunk in upstream.aiter_bytes():
                data.extend(chunk)
                if len(data) > 8 * 1024 * 1024:
                    raise HTTPException(502, "Open a smaller page of WhatsApp history.")
            result = Response(
                bytes(data),
                status_code=upstream.status_code,
                media_type="application/json",
                headers={
                    "Cache-Control": "no-store",
                    "Referrer-Policy": "no-referrer",
                    "X-Content-Type-Options": "nosniff",
                },
            )
            for value in upstream.headers.get_list("set-cookie"):
                if value.startswith(COOKIE + "=") and "domain=" not in value.lower():
                    result.headers.append("Set-Cookie", value)
            return result
    except httpx.HTTPError:
        raise HTTPException(
            503, "WhatsApp is reconnecting. Try again to reopen your saved conversations."
        ) from None
