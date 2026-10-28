"""Explicit operator uploads: private 30-day custody and source-bound document line review.

This is a separate source class from provider-backed email. Email bytes never enter this store.
"""

from __future__ import annotations

import hashlib
import io
import json
import os
import secrets
import sqlite3
import time
from contextlib import closing, contextmanager
from typing import Iterator

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse, Response
from PIL import Image, UnidentifiedImageError

from . import cedar_access, cedar_source_budget, parsewise
from .config import settings

router = APIRouter(prefix="/api/cedar/documents", tags=["cedar-documents"])
RETENTION = 30 * 86400
MAX_BYTES = 12 * 1024 * 1024
HEADERS = {"Cache-Control": "no-store", "Pragma": "no-cache", "Referrer-Policy": "no-referrer"}


@contextmanager
def database() -> Iterator[sqlite3.Connection]:
    path = settings.state_dir / "cedar-documents.sqlite"
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    fd = os.open(path, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    os.close(fd)
    path.chmod(0o600)
    with closing(sqlite3.connect(path, timeout=10)) as db, db:
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA secure_delete=ON")
        db.execute(
            "CREATE TABLE IF NOT EXISTS documents (ref TEXT PRIMARY KEY, workspace TEXT NOT NULL, "
            "digest TEXT NOT NULL, filename TEXT NOT NULL, content_type TEXT NOT NULL, "
            "content BLOB NOT NULL, "
            "created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, consent_at INTEGER NOT NULL, "
            "parsed TEXT, lease INTEGER NOT NULL DEFAULT 0, UNIQUE(workspace,digest))"
        )
        if "lease" not in {row[1] for row in db.execute("PRAGMA table_info(documents)")}:
            db.execute("ALTER TABLE documents ADD COLUMN lease INTEGER NOT NULL DEFAULT 0")
        db.execute("CREATE INDEX IF NOT EXISTS documents_owner ON documents(workspace)")
        db.execute("BEGIN IMMEDIATE")
        db.execute("DELETE FROM documents WHERE expires_at<=?", (int(time.time()),))
        yield db


def view(row: sqlite3.Row) -> dict:
    result = json.loads(row["parsed"]) if row["parsed"] else None
    return {
        "source_ref": row["ref"],
        "source_kind": "operator_upload",
        "name": row["filename"],
        "content_type": row["content_type"],
        "created_at": row["created_at"],
        "expires_at": row["expires_at"],
        "status": "review" if result else "uploaded",
        "result": result,
        "provenance": {
            "source_ref": row["ref"],
            "source_revision": 1,
            "method": "parsewise-albaran-lines" if result else "operator-upload",
            "actor": "workspace-owner",
            "policy": "cedar-operator-upload-30d-v1",
            "consent_at": row["consent_at"],
        },
    }


def resolve(workspace: str, ref: str) -> sqlite3.Row:
    with database() as db:
        row = db.execute("SELECT * FROM documents WHERE workspace=? AND ref=?", (workspace, ref)).fetchone()
    if row is None:
        raise HTTPException(404, "Choose the document again to continue its review.")
    return row


def purge_expired() -> None:
    """The runtime's periodic maintenance can purge expired bytes while the UI is idle."""
    with database():
        pass


def content_type(content: bytes) -> str:
    if content.startswith(b"%PDF-"):
        return "application/pdf"
    try:
        with Image.open(io.BytesIO(content)) as image:
            if image.format not in ("JPEG", "PNG") or image.width * image.height > 25_000_000:
                raise HTTPException(415, "Choose a PDF, JPG or PNG up to 25 megapixels.")
            kind = "image/jpeg" if image.format == "JPEG" else "image/png"
            image.verify()
            return kind
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        raise HTTPException(415, "Choose a PDF, JPG or PNG document.") from None


@router.post("")
async def upload(
    request: Request, file: UploadFile = File(...), retention_consent: str = Form(...)
) -> JSONResponse:
    workspace = cedar_access.authorize(request)
    if retention_consent != "private-30-days":
        raise HTTPException(422, "Confirm private document storage for 30 days.")
    content = await file.read(MAX_BYTES + 1)
    await file.close()
    if not content or len(content) > MAX_BYTES:
        raise HTTPException(413, "Choose a document smaller than 12 MB.")
    kind = content_type(content)
    filename = (file.filename or "Document").replace("\\", "/").rsplit("/", 1)[-1]
    filename = "".join(char for char in filename if ord(char) >= 32)[:200] or "Document"
    stamp = int(time.time())
    digest = hashlib.sha256(content).hexdigest()
    with database() as db:
        existing = db.execute(
            "SELECT * FROM documents WHERE workspace=? AND digest=?", (workspace, digest)
        ).fetchone()
        if existing:
            return JSONResponse(view(existing), headers=HEADERS)
        count, size = db.execute(
            "SELECT COUNT(*),COALESCE(SUM(LENGTH(content)),0) FROM documents WHERE workspace=?", (workspace,)
        ).fetchone()
        total = db.execute("SELECT COUNT(*) FROM documents").fetchone()[0]
        if count >= 20 or size + len(content) > 50 * 1024 * 1024 or total >= 1000:
            raise HTTPException(409, "Remove a reviewed document to make room for this upload.")
        ref = "doc_" + secrets.token_hex(20)
        db.execute(
            "INSERT INTO documents(ref,workspace,digest,filename,content_type,content,created_at,expires_at,"
            "consent_at) VALUES(?,?,?,?,?,?,?,?,?)",
            (ref, workspace, digest, filename, kind, content, stamp, stamp + RETENTION, stamp),
        )
        row = db.execute("SELECT * FROM documents WHERE ref=?", (ref,)).fetchone()
    return JSONResponse(view(row), status_code=201, headers=HEADERS)


@router.get("")
async def listing(request: Request) -> JSONResponse:
    workspace = cedar_access.authorize(request)
    with database() as db:
        rows = db.execute(
            "SELECT * FROM documents WHERE workspace=? ORDER BY created_at DESC,ref", (workspace,)
        ).fetchall()
    return JSONResponse({"documents": [view(row) for row in rows]}, headers=HEADERS)


@router.post("/{source_ref}/parse")
async def parse(source_ref: str, request: Request) -> JSONResponse:
    workspace = cedar_access.authorize(request)
    row = resolve(workspace, source_ref)
    if row["parsed"]:
        return JSONResponse(view(row), headers=HEADERS)
    stamp = int(time.time())
    with database() as db:
        claimed = db.execute(
            "UPDATE documents SET lease=? WHERE workspace=? AND ref=? AND lease<? AND parsed IS NULL",
            (stamp + 660, workspace, source_ref, stamp),
        ).rowcount
    if not claimed:
        raise HTTPException(409, "This document is being read. Refresh its review shortly.")
    try:
        cedar_source_budget.charge(workspace)
        result = await parsewise.parse_document(
            row["content"],
            "source.pdf" if row["content_type"] == "application/pdf" else "source-image",
            row["content_type"],
            "albaran",
        )
    except BaseException:
        with database() as db:
            db.execute("UPDATE documents SET lease=0 WHERE workspace=? AND ref=?", (workspace, source_ref))
        raise
    with database() as db:
        changed = db.execute(
            "UPDATE documents SET parsed=?,lease=0 WHERE workspace=? AND ref=?",
            (json.dumps(result), workspace, source_ref),
        ).rowcount
    if not changed:
        raise HTTPException(404, "Choose the document again to continue its review.")
    return JSONResponse(view(resolve(workspace, source_ref)), headers=HEADERS)


@router.get("/{source_ref}/file")
async def download(source_ref: str, request: Request) -> Response:
    row = resolve(cedar_access.authorize(request), source_ref)
    return Response(
        row["content"],
        media_type="application/octet-stream",
        headers={
            **HEADERS,
            "Content-Disposition": 'attachment; filename="source-document"',
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'; sandbox",
        },
    )


@router.delete("/{source_ref}")
async def delete(source_ref: str, request: Request) -> JSONResponse:
    workspace = cedar_access.authorize(request)
    resolve(workspace, source_ref)
    with database() as db:
        db.execute("DELETE FROM documents WHERE workspace=? AND ref=?", (workspace, source_ref))
    return JSONResponse({"deleted": True}, headers=HEADERS)
