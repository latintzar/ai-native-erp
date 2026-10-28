"""Cedar development channel workspaces: opaque access, independent of demo scenarios.

A new workspace owns empty email/phone stores. Provider authorization and operator-commissioned
calling permissions are separate capabilities. Neither a cast nor a browser-supplied account ID
selects a private account. Existing prototype state and legacy routes retain their own contracts.
"""

from __future__ import annotations

import hashlib
import hmac
import os
import re
import secrets
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator
from urllib.parse import urlsplit

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict

from .config import settings

router = APIRouter(prefix="/api/cedar/access", tags=["cedar-development"])
TTL = 30 * 24 * 60 * 60
MAX_WORKSPACES = 1000
TOKEN = re.compile(r"^[A-Za-z0-9_-]{64}$")
WORKSPACE = re.compile(r"^[a-f0-9]{32}$")


def _path() -> Path:
    return settings.state_dir / "cedar-access.sqlite"


@contextmanager
def _db() -> Iterator[sqlite3.Connection]:
    path = _path()
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.is_symlink():
        raise RuntimeError("Cedar access storage requires a regular private file")
    fd = os.open(path, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    os.close(fd)
    os.chmod(path, 0o600)
    db = sqlite3.connect(path, timeout=5)
    try:
        with db:
            db.row_factory = sqlite3.Row
            db.execute("PRAGMA secure_delete=ON")
            db.execute(
                "CREATE TABLE IF NOT EXISTS workspaces (id TEXT PRIMARY KEY, "
                "token_hash TEXT UNIQUE NOT NULL, created_at INTEGER NOT NULL, "
                "expires_at INTEGER NOT NULL, revoked INTEGER NOT NULL DEFAULT 0)"
            )
            db.execute(
                "CREATE TABLE IF NOT EXISTS allocations "
                "(bucket TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL)"
            )
            yield db
    finally:
        db.close()


def _hash(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


# Maintained and production hosts never allocate Cedar channel stores, even when they run this code.
MAINTAINED_HOSTS = {
    "soyrocoto.com", "www.soyrocoto.com", "api.soyrocoto.com", "kit.soyrocoto.com",
    "staging.soyrocoto.com",
}


def own_origin() -> str:
    """The consumer's declared HTTPS development origin: a dedicated preview such as
    cedar-channels.soyrocoto.com serves Cedar and this API on one origin, and its browser
    requests carry that origin. A maintained host, a path or a plain-HTTP base grants nothing."""
    base = settings.public_base.rstrip("/")
    try:
        parsed = urlsplit(base)
    except ValueError:
        return ""
    if (
        parsed.scheme != "https"
        or not parsed.hostname
        or parsed.hostname in MAINTAINED_HOSTS
        or parsed.username
        or parsed.password
        or parsed.port
        or parsed.path
        or parsed.query
        or parsed.fragment
    ):
        return ""
    return base


def allowed_origin(value: str) -> bool:
    if value == "https://demo.soyrocoto.com":
        return True
    own = own_origin()
    if own and value == own:
        return True
    try:
        parsed = urlsplit(value)
        return (
            parsed.scheme in ("http", "https")
            and parsed.hostname in ("localhost", "127.0.0.1", "::1")
            and not parsed.username
            and not parsed.password
            and not parsed.path
            and not parsed.query
            and not parsed.fragment
        )
    except ValueError:
        return False


def _origin(request: Request) -> None:
    origin = request.headers.get("origin")
    # CLI bearer access can omit Origin. A browser supplies an explicitly selected development
    # origin; the production kit/staging hosts cannot allocate or mutate Cedar channel stores.
    if origin is not None and not allowed_origin(origin):
        raise HTTPException(403, "Open Cedar at its development address to continue.")


def authorize(request: Request) -> str:
    _origin(request)
    header = request.headers.get("authorization", "")
    token = header.removeprefix("Bearer ") if header.startswith("Bearer ") else ""
    if not TOKEN.fullmatch(token):
        raise HTTPException(401, "Reopen your saved Cedar connection workspace.")
    with _db() as db:
        row = db.execute(
            "SELECT id FROM workspaces WHERE token_hash=? AND expires_at>? AND revoked=0",
            (_hash(token), int(time.time())),
        ).fetchone()
    if not row:
        raise HTTPException(401, "Your connection workspace needs its saved access or renewed authorization.")
    return str(row["id"])


def workspace_exists(workspace_id: str) -> bool:
    if not WORKSPACE.fullmatch(workspace_id):
        return False
    with _db() as db:
        row = db.execute(
            "SELECT id FROM workspaces WHERE id=? AND expires_at>? AND revoked=0",
            (workspace_id, int(time.time())),
        ).fetchone()
    return row is not None


def require_operator(request: Request) -> None:
    _origin(request)
    key = (os.environ.get("CEDAR_CHANNEL_OPERATOR_KEY") or "").strip()
    header = request.headers.get("authorization", "")
    supplied = header.removeprefix("Bearer ") if header.startswith("Bearer ") else ""
    if len(key) < 32 or not hmac.compare_digest(key, supplied):
        raise HTTPException(403, "Use Cedar’s protected operator access for commissioning.")


class Empty(BaseModel):
    model_config = ConfigDict(extra="forbid")


@router.post("/workspaces")
def create_workspace(body: Empty, request: Request) -> JSONResponse:
    _origin(request)
    now = int(time.time())
    # Use the socket address, never a browser-supplied forwarding header. The small global
    # allocation budget also covers proxied traffic. Existing workspace reads remain available.
    peer = request.client.host if request.client else "local"
    buckets = ((_hash(peer) + f":{now // 3600}", 20), (f"all:{now // 3600}", 100))
    with _db() as db:
        db.execute("BEGIN IMMEDIATE")
        db.execute("DELETE FROM allocations WHERE expires_at<=?", (now,))
        for bucket, ceiling in buckets:
            count = db.execute("SELECT count FROM allocations WHERE bucket=?", (bucket,)).fetchone()
            if count and count["count"] >= ceiling:
                raise HTTPException(
                    429, "Cedar’s connection setup limit renews shortly. Reopen an existing workspace."
                )
        count = db.execute(
            "SELECT count(*) FROM workspaces WHERE expires_at>? AND revoked=0", (now,)
        ).fetchone()[0]
        if count >= MAX_WORKSPACES:
            raise HTTPException(429, "Cedar’s development workspace capacity needs an operator review.")
        token, workspace_id = secrets.token_urlsafe(48), secrets.token_hex(16)
        expires = now + TTL
        db.execute(
            "INSERT INTO workspaces(id,token_hash,created_at,expires_at) VALUES(?,?,?,?)",
            (workspace_id, _hash(token), now, expires),
        )
        for bucket, _ in buckets:
            db.execute(
                "INSERT INTO allocations VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1",
                (bucket, now + 3600),
            )
    return JSONResponse(
        {"workspace_id": workspace_id, "access_token": token, "expires_at": expires},
        status_code=201,
        headers={"Cache-Control": "no-store", "Referrer-Policy": "no-referrer"},
    )


@router.get("/workspace")
def read_workspace(request: Request) -> JSONResponse:
    workspace_id = authorize(request)
    return JSONResponse(
        {"workspace_id": workspace_id, "environment": "development/demo"},
        headers={"Cache-Control": "no-store"},
    )
