"""Authenticate and bound Cedar document uploads before multipart parsing can spool files."""

from __future__ import annotations

import asyncio
from typing import Any, Awaitable, Callable

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse

from . import cedar_access

MAX_BODY = 13 * 1024 * 1024  # 12 MiB document plus bounded multipart fields and headers.
MAX_CONCURRENT = 3
READ_SECONDS = 30
Message = dict[str, Any]
Receive = Callable[[], Awaitable[Message]]
Send = Callable[[Message], Awaitable[None]]
ASGI = Callable[[Message, Receive, Send], Awaitable[None]]


class CedarDocumentRequestLimit:
    def __init__(self, app: ASGI):
        self.app = app
        self.active = 0

    async def __call__(self, scope: Message, receive: Receive, send: Send) -> None:
        if (
            scope["type"] != "http"
            or scope.get("method") != "POST"
            or scope.get("path") != "/api/cedar/documents"
        ):
            await self.app(scope, receive, send)
            return

        async def refuse(status: int, detail: str) -> None:
            response = JSONResponse(
                {"detail": detail},
                status_code=status,
                headers={"Cache-Control": "no-store", "Referrer-Policy": "no-referrer"},
            )
            await response(scope, receive, send)

        # Header-only Request construction: authentication never reads the body.
        request = Request(scope)
        try:
            cedar_access.authorize(request)
        except HTTPException as error:
            await refuse(error.status_code, str(error.detail))
            return
        stated = request.headers.get("content-length")
        if stated is not None:
            if not stated.isascii() or not stated.isdigit() or len(stated) > 16:
                await refuse(400, "Choose a document with a valid upload size.")
                return
            if int(stated) > MAX_BODY:
                await refuse(413, "Choose a document smaller than 12 MB.")
                return
        if self.active >= MAX_CONCURRENT:
            await refuse(429, "Document uploads are busy. Try again shortly.")
            return

        # No await between capacity check and claim; one event loop owns this middleware instance.
        self.active += 1
        try:
            buffer = bytearray()
            size = 0
            try:
                async with asyncio.timeout(READ_SECONDS):
                    while True:
                        message = await receive()
                        if message["type"] == "http.disconnect":
                            return
                        if message["type"] != "http.request":
                            await refuse(400, "Choose the document again to upload it.")
                            return
                        body = message.get("body", b"")
                        size += len(body)
                        if size > MAX_BODY:
                            await refuse(413, "Choose a document smaller than 12 MB.")
                            return
                        buffer.extend(body)
                        if not message.get("more_body", False):
                            break
            except TimeoutError:
                await refuse(408, "The upload took too long. Choose the document again.")
                return
            content = bytes(buffer)
            buffer.clear()
            replayed = False

            async def replay() -> Message:
                nonlocal replayed
                if replayed:
                    return await receive()
                replayed = True
                return {"type": "http.request", "body": content, "more_body": False}

            await self.app(scope, replay, send)
        finally:
            self.active -= 1
