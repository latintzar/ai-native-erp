"""The document boundary rejects before Starlette can parse or spool multipart bytes."""

import asyncio

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import cedar_access, cedar_documents
from app import cedar_request_limits as limits
from app.config import settings


@pytest.fixture
def authorized(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "state_dir", tmp_path)
    app = FastAPI()
    app.include_router(cedar_access.router)
    with TestClient(app) as client:
        workspace = client.post("/api/cedar/access/workspaces", json={}).json()
    return [(b"authorization", ("Bearer " + workspace["access_token"]).encode())]


def scope(headers=None, path="/api/cedar/documents"):
    return {
        "type": "http",
        "method": "POST",
        "path": path,
        "raw_path": path.encode(),
        "query_string": b"",
        "headers": headers or [],
        "client": ("127.0.0.1", 1234),
        "server": ("localhost", 80),
        "scheme": "http",
        "http_version": "1.1",
    }


async def invoke(app, request_scope, chunks):
    messages, reads = [], []

    async def receive():
        reads.append(True)
        body = chunks.pop(0)
        return {"type": "http.request", "body": body, "more_body": bool(chunks)}

    async def send(message):
        messages.append(message)

    await app(request_scope, receive, send)
    return messages, reads


def test_authentication_precedes_receiving_or_parsing(authorized):
    called = []

    async def downstream(scope, receive, send):
        called.append(True)

    app = limits.CedarDocumentRequestLimit(downstream)
    messages, reads = asyncio.run(invoke(app, scope(), [b"untrusted multipart"]))
    assert messages[0]["status"] == 401 and reads == [] and called == []
    messages, reads = asyncio.run(
        invoke(
            app,
            scope(authorized + [(b"content-length", str(limits.MAX_BODY + 1).encode())]),
            [b"unread"],
        )
    )
    assert messages[0]["status"] == 413 and reads == [] and called == []


def test_actual_chunked_bytes_are_capped_and_bounded_body_replays(authorized):
    received = []

    async def downstream(scope, receive, send):
        received.append(await receive())
        await send({"type": "http.response.start", "status": 200, "headers": []})
        await send({"type": "http.response.body", "body": b"ok"})

    app = limits.CedarDocumentRequestLimit(downstream)
    messages, reads = asyncio.run(
        invoke(
            app,
            scope(authorized),
            [b"a" * limits.MAX_BODY, b"x", b"never received"],
        )
    )
    assert messages[0]["status"] == 413 and len(reads) == 2 and received == []
    messages, reads = asyncio.run(invoke(app, scope(authorized), [b"part-one", b"part-two"]))
    assert messages[0]["status"] == 200 and len(reads) == 2
    assert received == [{"type": "http.request", "body": b"part-onepart-two", "more_body": False}]


def test_concurrent_slow_uploads_are_bounded_and_capacity_recovers(authorized):
    async def proof():
        held = asyncio.Event()
        entered = 0
        completed = []

        async def downstream(scope, receive, send):
            await receive()
            await send({"type": "http.response.start", "status": 200, "headers": []})
            await send({"type": "http.response.body", "body": b""})

        async def slow_receive():
            nonlocal entered
            entered += 1
            await held.wait()
            return {"type": "http.request", "body": b"a", "more_body": False}

        async def send(message):
            if message["type"] == "http.response.start":
                completed.append(message["status"])

        app = limits.CedarDocumentRequestLimit(downstream)
        tasks = [
            asyncio.create_task(app(scope(authorized), slow_receive, send))
            for _ in range(limits.MAX_CONCURRENT)
        ]
        while entered < limits.MAX_CONCURRENT:
            await asyncio.sleep(0)
        messages, reads = await invoke(app, scope(authorized), [b"held outside parser"])
        assert messages[0]["status"] == 429 and reads == []
        held.set()
        await asyncio.gather(*tasks)
        assert completed == [200] * limits.MAX_CONCURRENT
        messages, _ = await invoke(app, scope(authorized), [b"recovered"])
        assert messages[0]["status"] == 200

    asyncio.run(proof())


def test_body_deadline_releases_capacity(authorized, monkeypatch):
    monkeypatch.setattr(limits, "READ_SECONDS", 0.01)

    async def proof():
        messages = []

        async def downstream(scope, receive, send):
            raise AssertionError("slow body reached multipart parser")

        async def slow_receive():
            await asyncio.sleep(10)

        async def send(message):
            messages.append(message)

        app = limits.CedarDocumentRequestLimit(downstream)
        await app(scope(authorized), slow_receive, send)
        assert messages[0]["status"] == 408 and app.active == 0

    asyncio.run(proof())


def test_real_upload_route_retains_its_file_limit_and_consent(authorized):
    app = FastAPI()
    app.include_router(cedar_documents.router)
    app.add_middleware(limits.CedarDocumentRequestLimit)
    auth = {key.decode(): value.decode() for key, value in authorized}
    with TestClient(app) as client:
        response = client.post(
            "/api/cedar/documents",
            headers=auth,
            files={"file": ("source.pdf", b"%PDF-1.4 synthetic", "application/pdf")},
            data={"retention_consent": "private-30-days"},
        )
        assert response.status_code == 201
        response = client.post(
            "/api/cedar/documents",
            headers=auth,
            files={"file": ("source.pdf", b"%PDF-" + b"x" * cedar_documents.MAX_BYTES, "application/pdf")},
            data={"retention_consent": "private-30-days"},
        )
        assert response.status_code == 413
