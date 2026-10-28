"""Private operator uploads use synthetic files and a fixture parser only."""

import io

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from PIL import Image

from app import cedar_access, cedar_documents
from app.cedar_source_budget import charge
from app.config import settings


@pytest.fixture
def runtime(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "state_dir", tmp_path)
    calls = []

    async def parse(content, filename, content_type, kind):
        calls.append((content_type, kind))
        return {
            "columns": ["product", "quantity"],
            "rows": [{"product": "Synthetic item", "quantity": 3}],
            "confidence": 0.9,
        }

    monkeypatch.setattr(cedar_documents.parsewise, "parse_document", parse)
    app = FastAPI()
    app.include_router(cedar_access.router)
    app.include_router(cedar_documents.router)
    with TestClient(app) as client:
        first = client.post("/api/cedar/access/workspaces", json={}).json()
        second = client.post("/api/cedar/access/workspaces", json={}).json()
        yield (
            client,
            {"Authorization": "Bearer " + first["access_token"]},
            {"Authorization": "Bearer " + second["access_token"]},
            calls,
        )


def upload(
    client, headers, content=b"%PDF-1.4 synthetic invoice", filename="fixture.pdf", consent="private-30-days"
):
    return client.post(
        "/api/cedar/documents",
        files={"file": (filename, content, "application/pdf")},
        data={"retention_consent": consent},
        headers=headers,
    )


def test_upload_requires_consent_and_owner_and_reloads_with_source_and_parse(runtime):
    client, headers, other, calls = runtime
    assert upload(client, headers, consent="").status_code == 422
    assert upload(client, {}, consent="private-30-days").status_code == 401
    uploaded = upload(client, headers)
    assert uploaded.status_code == 201
    source = uploaded.json()["source_ref"]
    assert uploaded.json()["expires_at"] - uploaded.json()["created_at"] == 30 * 86400
    assert upload(client, headers).json()["source_ref"] == source
    assert client.get("/api/cedar/documents", headers=other).json()["documents"] == []
    assert client.post(f"/api/cedar/documents/{source}/parse", headers=other).status_code == 404
    assert client.get(f"/api/cedar/documents/{source}/file", headers=other).status_code == 404
    result = client.post(f"/api/cedar/documents/{source}/parse", headers=headers)
    assert result.status_code == 200
    assert result.json()["provenance"]["source_ref"] == source
    assert result.json()["provenance"]["policy"] == "cedar-operator-upload-30d-v1"
    assert result.json()["result"]["rows"][0]["quantity"] == 3
    client.post(f"/api/cedar/documents/{source}/parse", headers=headers)
    assert calls == [("application/pdf", "albaran")]
    # Fresh HTTP client, same persistent server source, no browser body cache.
    with TestClient(client.app) as reloaded:
        records = reloaded.get("/api/cedar/documents", headers=headers).json()["documents"]
        assert len(records) == 1 and records[0]["status"] == "review"
        assert records[0]["source_ref"] == source
    download = client.get(f"/api/cedar/documents/{source}/file", headers=headers)
    assert download.content.startswith(b"%PDF-") and download.headers["cache-control"] == "no-store"
    assert client.delete(f"/api/cedar/documents/{source}", headers=other).status_code == 404
    assert client.delete(f"/api/cedar/documents/{source}", headers=headers).json()["deleted"] is True
    assert client.get(f"/api/cedar/documents/{source}/file", headers=headers).status_code == 404


def test_content_validation_image_parser_and_expiry(runtime):
    client, headers, _, calls = runtime
    assert upload(client, headers, content=b"<script>fixture</script>").status_code == 415
    assert upload(client, headers, content=b"x" * (12 * 1024 * 1024 + 1)).status_code == 413
    image = io.BytesIO()
    Image.new("RGB", (2, 2), "white").save(image, "PNG")
    result = upload(client, headers, image.getvalue(), "photo.png")
    assert result.status_code == 201
    source = result.json()["source_ref"]
    assert result.json()["content_type"] == "image/png"
    client.post(f"/api/cedar/documents/{source}/parse", headers=headers)
    assert calls == [("image/png", "albaran")]
    with cedar_documents.database() as db:
        db.execute("UPDATE documents SET expires_at=0 WHERE ref=?", (source,))
    assert client.get("/api/cedar/documents", headers=headers).json()["documents"] == []
    assert client.get(f"/api/cedar/documents/{source}/file", headers=headers).status_code == 404


def test_source_read_budget_bounds_new_workspace_spend(runtime):
    from fastapi import HTTPException

    for _ in range(20):
        charge("budget-workspace")
    with pytest.raises(HTTPException) as rejected:
        charge("budget-workspace")
    assert rejected.value.status_code == 429
    # The private global counter prevents replacing a workspace from bypassing the ceiling.
    for workspace in range(4):
        for _ in range(20):
            charge(f"other-{workspace}")
    with pytest.raises(HTTPException) as global_rejected:
        charge("new-workspace")
    assert global_rejected.value.status_code == 429
