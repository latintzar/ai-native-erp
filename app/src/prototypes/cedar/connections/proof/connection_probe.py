"""A development-only, same-window Meta authorization probe.

The independent attempt cookie and state prove the callback belongs to this browser. A successful
code exchange records that fact and discards the returned token. Existing account authorization,
subscriptions, histories and business records are outside this experiment.
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import secrets
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path
from urllib.parse import urlencode
from uuid import uuid4

from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator

COOKIE = "__Host-bodega_connection_probe"
PREFIX = "/api/proof/whatsapp/redirect"
REDIRECT_URI = "https://demo.soyrocoto.com/"
RESULT_URL = REDIRECT_URI + "bodega-pay-later/?connection-test=direct&returned=1"
SERVICE_ORIGIN = "https://cedar-demo.soyrocoto.com"
STATE_PREFIX = "bodega-direct-"
TOKEN = re.compile(r"^[A-Za-z0-9_-]{43}$")
TTL = 600
COOKIE_TTL = 24 * 3600
STARTS_PER_MINUTE = 20
STARTS_PER_HOUR = 200
MAX_BODY = 16 * 1024
logger = logging.getLogger("uvicorn.error")


def _hash(value):
    return hashlib.sha256(value.encode()).hexdigest()


def _event(run_id, event, provider_code=None):
    record = {"kind": "bodega_connection_probe", "runId": run_id, "event": event}
    if provider_code:
        record["providerCode"] = provider_code
    logger.info("%s", json.dumps(record, separators=(",", ":")))


class Completion(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    state: str = Field(pattern=r"^bodega-direct-[A-Za-z0-9_-]{43}$")
    code: str | None = Field(default=None, min_length=1, max_length=8192)
    cancelled: bool = False

    @model_validator(mode="after")
    def one_answer(self):
        if (self.code is not None) == self.cancelled:
            raise ValueError("One authorization outcome is required")
        return self


class Attempts:
    def __init__(self, directory, encryption_key):
        self.path = Path(directory) / "connection-probe.sqlite3"
        self.cipher = Fernet(encryption_key.encode())
        with self.db() as db:
            db.execute("BEGIN IMMEDIATE")
            db.execute(
                "CREATE TABLE IF NOT EXISTS attempts (cookie_hash TEXT PRIMARY KEY, "
                "state_hash TEXT NOT NULL UNIQUE, run_id TEXT NOT NULL, created REAL NOT NULL, "
                "expires REAL NOT NULL, claimed INTEGER NOT NULL DEFAULT 0, "
                "status TEXT NOT NULL DEFAULT 'pending', provider_code TEXT, launch_url BLOB)"
            )
            columns = {row["name"] for row in db.execute("PRAGMA table_info(attempts)")}
            if "launch_url" not in columns:
                db.execute("ALTER TABLE attempts ADD COLUMN launch_url BLOB")

    @contextmanager
    def db(self):
        fd = os.open(self.path, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
        os.fchmod(fd, 0o600)
        os.close(fd)
        db = sqlite3.connect(self.path, timeout=5)
        db.row_factory = sqlite3.Row
        try:
            with db:
                yield db
        finally:
            db.close()

    def create(self, make_url):
        now = time.time()
        cookie = secrets.token_urlsafe(32)
        state, run_id = STATE_PREFIX + secrets.token_urlsafe(32), str(uuid4())
        url = make_url(state)
        with self.db() as db:
            db.execute("BEGIN IMMEDIATE")
            db.execute("DELETE FROM attempts WHERE created<=?", (now - 3600,))
            counts = db.execute(
                "SELECT COUNT(*) AS hour, SUM(created>?) AS minute FROM attempts", (now - 60,),
            ).fetchone()
            if counts["hour"] >= STARTS_PER_HOUR or (counts["minute"] or 0) >= STARTS_PER_MINUTE:
                raise HTTPException(429, "Open a fresh authorization test after a short pause.")
            db.execute(
                "INSERT INTO attempts(cookie_hash,state_hash,run_id,created,expires,launch_url) "
                "VALUES(?,?,?,?,?,?)",
                (_hash(cookie), _hash(state), run_id, now, now + TTL, self.cipher.encrypt(url.encode())),
            )
        return cookie, url, run_id

    def row(self, cookie, db):
        if not TOKEN.fullmatch(cookie):
            return None
        return db.execute("SELECT * FROM attempts WHERE cookie_hash=?", (_hash(cookie),)).fetchone()

    def resume(self, cookie):
        with self.db() as db:
            row = self.row(cookie, db)
            if row is not None:
                _event(row["run_id"], "resume_requested")
            if (row is None or row["expires"] <= time.time() or row["claimed"]
                    or row["status"] != "pending"):
                return RESULT_URL
            return self.saved_url(row) or RESULT_URL

    def saved_url(self, row):
        if row["launch_url"] is None:
            return None
        try:
            return self.cipher.decrypt(row["launch_url"]).decode()
        except (InvalidToken, UnicodeDecodeError):
            # An unavailable original launch requires an explicit new attempt.
            return None

    def claim(self, cookie, state):
        with self.db() as db:
            db.execute("BEGIN IMMEDIATE")
            row = self.row(cookie, db)
            if row is None or not secrets.compare_digest(row["state_hash"], _hash(state)):
                raise HTTPException(403, "Return to the authorization test opened in this browser.")
            if row["expires"] <= time.time():
                raise HTTPException(410, "Open a fresh authorization test.")
            if row["claimed"]:
                if row["status"] == "pending":
                    raise HTTPException(409, "The authorization attempt is processing. Open its result.")
                return row, False
            db.execute("UPDATE attempts SET claimed=1 WHERE cookie_hash=?", (_hash(cookie),))
        return row, True

    def finish(self, cookie, status, provider_code=None):
        with self.db() as db:
            db.execute(
                "UPDATE attempts SET status=?,provider_code=?,expires=? WHERE cookie_hash=?",
                (status, provider_code, time.time() + TTL, _hash(cookie)),
            )

    def result(self, cookie):
        with self.db() as db:
            row = self.row(cookie, db)
        if row is None:
            return {"status": "expired"}
        if row["expires"] <= time.time():
            return {"status": "expired", "runId": row["run_id"]}
        status = row["status"]
        if status == "pending":
            if row["claimed"]:
                status = "processing"
            elif self.saved_url(row) is None:
                status = "expired"
        result = {"status": status, "runId": row["run_id"]}
        if row["provider_code"]:
            result["providerCode"] = row["provider_code"]
        return result


def _cookie(response, cookie):
    response.set_cookie(
        COOKIE, cookie, max_age=COOKIE_TTL, secure=True, httponly=True, samesite="lax", path="/",
    )
    return response


def install(app, config, graph, configured):
    # This helper is published inside the existing development service only. The public entry
    # and callback belong to demo; its fixed bridge supplies the provider's existing Origin.
    if config.public_origin != SERVICE_ORIGIN:
        return
    attempts = Attempts(config.state_dir, config.encryption_key)

    def origin(request):
        configured()
        if request.headers.get("origin") != config.public_origin:
            raise HTTPException(403, "Open the authorization test from its development address.")

    def launch_url(state):
        query = urlencode({
            "client_id": config.app_id, "config_id": config.config_id,
            "response_type": "code", "override_default_response_type": "true",
            "redirect_uri": REDIRECT_URI, "state": state,
            "extras": json.dumps({"setup": {}, "featureType": "whatsapp_business_app_onboarding",
                                   "sessionInfoVersion": "3"}, separators=(",", ":")),
        })
        return f"https://www.facebook.com/{config.graph_version}/dialog/oauth?{query}"

    def fresh_attempt():
        cookie, url, run_id = attempts.create(launch_url)
        _event(run_id, "start")
        return _cookie(RedirectResponse(url, status_code=303), cookie)

    @app.get(PREFIX + "/start")
    async def start(request: Request):
        origin(request)
        if COOKIE in request.cookies:
            return RedirectResponse(attempts.resume(request.cookies[COOKIE]), status_code=303)
        return fresh_attempt()

    @app.post(PREFIX + "/restart")
    async def restart(request: Request):
        origin(request)
        return fresh_attempt()

    @app.post(PREFIX + "/complete")
    async def complete(request: Request):
        origin(request)
        raw = bytearray()
        async for chunk in request.stream():
            if len(raw) + len(chunk) > MAX_BODY:
                raise HTTPException(413, "Submit one authorization result.")
            raw.extend(chunk)
        try:
            body = Completion.model_validate_json(raw)
        except ValidationError:
            raise HTTPException(422, "Submit the supported authorization result fields.") from None
        cookie = request.cookies.get(COOKIE, "")
        row, first = attempts.claim(cookie, body.state)
        if first:
            _event(row["run_id"], "callback")
            if body.cancelled:
                attempts.finish(cookie, "cancelled")
                _event(row["run_id"], "cancelled")
            else:
                try:
                    token = await graph.exchange(body.code, redirect_uri=REDIRECT_URI)
                    if not isinstance(token, str) or not token:
                        raise ValueError("Authorization token required")
                    token = None  # The probe records the exchange outcome, never the acquired token.
                except Exception as error:
                    code = str(getattr(error, "code", ""))
                    code = code if re.fullmatch(r"[0-9]{1,12}", code) else None
                    attempts.finish(cookie, "failed", code)
                    _event(row["run_id"], "failed", code)
                else:
                    attempts.finish(cookie, "authorized")
                    _event(row["run_id"], "code_exchanged")
        return _cookie(JSONResponse({"ok": True}), cookie)

    @app.get(PREFIX + "/result")
    async def result(request: Request):
        origin(request)
        return attempts.result(request.cookies.get(COOKIE, ""))
