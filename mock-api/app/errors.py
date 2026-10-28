"""ONE error shape, and it is JSON (FEED-IA §196.5 — the kit parses `response.json()` on every road).

`runtime-client.ts` throws `RuntimeUnreachable` when the fetch itself fails and a plain Error on a
non-200. Neither path parses HTML, so an HTML error page from the framework would reach the person
as an unexplained failure. Every error out of this service is therefore

    {"error": {"code": "<machine word>", "message": "<one plain sentence>"}}

and the message is redacted like everything else.
"""
from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .config import redact

logger = logging.getLogger("rocoto.runtime.errors")


class RuntimeError_(Exception):
    """An honest failure with a name the kit can read."""

    def __init__(self, code: str, message: str, status: int = 502):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status


def json_error(code: str, message: str, status: int) -> JSONResponse:
    return JSONResponse({"error": {"code": code, "message": redact(message)}}, status_code=status)


def install(app: FastAPI) -> None:
    @app.exception_handler(RuntimeError_)
    async def _runtime(_: Request, exc: RuntimeError_) -> JSONResponse:
        logger.warning("handled failure: %s", exc.message, extra={"outcome": exc.code, "status": exc.status})
        return json_error(exc.code, exc.message, exc.status)

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        return json_error("http_error", str(exc.detail), exc.status_code)

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        first = (exc.errors() or [{}])[0]
        where = ".".join(str(p) for p in (first.get("loc") or ()) if p not in ("body", "query"))
        return json_error("bad_request", f"{where or 'request'}: {first.get('msg', 'invalid')}", 422)

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception) -> JSONResponse:
        # The traceback goes to the journal (redacted); the caller gets a sentence, never a stack.
        logger.exception("unhandled failure", extra={"outcome": "unhandled"})
        return json_error("runtime_error", f"{type(exc).__name__} while handling the request", 500)
