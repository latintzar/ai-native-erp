from pathlib import Path

from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
from test_cedar_native import owner, receipt, request_data

from runtime.cedar_service import create_app
from runtime.config import Settings


def test_owner_cursor_tracks_receipts_and_preserves_workspace_isolation(tmp_path: Path) -> None:
    settings = Settings(tmp_path, "https://collections.example", "operator-" + "x" * 40, Fernet.generate_key().decode())
    with TestClient(create_app(settings)) as client:
        _, auth = owner(client)
        _, other = owner(client)
        created = client.post("/api/cedar/requests", headers=auth, json=request_data()).json()
        first = client.get("/api/cedar/request-updates", headers=auth)
        assert first.status_code == 200
        page = first.json()
        assert len(page["cursor"]) == 64
        assert [row["id"] for row in page["requests"]] == [created["id"]]
        assert page["changed"] is True
        path = "/api/cedar/request-updates?cursor=" + page["cursor"]
        assert client.get(path, headers=auth).json() == {"cursor": page["cursor"], "requests": [], "changed": False}
        isolated = client.get(path, headers=other).json()
        assert isolated["cursor"] != page["cursor"]
        assert isolated["requests"] == []
        assert client.get(path).status_code == 401
        assert client.get("/api/cedar/request-updates?cursor=invalid", headers=auth).status_code == 422
        client.post(f"/api/cedar/requests/{created['id']}/receipts", headers=auth, json=receipt())
        changed = client.get(path, headers=auth).json()
        assert changed["cursor"] != page["cursor"]
        assert changed["requests"][0]["balance_minor"] == 6000
        assert changed["requests"][0]["receipts"][0]["amount_minor"] == 4000
        assert "bank_account" not in changed["requests"][0]["receipts"][0]


def test_collection_cursor_reads_the_workspace_once_per_poll(tmp_path: Path) -> None:
    settings = Settings(tmp_path, "https://collections.example", "operator-" + "x" * 40, Fernet.generate_key().decode())
    app = create_app(settings)
    with TestClient(app) as client:
        _, auth = owner(client)
        for index in range(6):
            client.post("/api/cedar/requests", headers=auth, json=request_data(
                invoice_id=f"invoice-{index}", document_id=f"note-{index}", reference=f"F001-{index}", idempotency_key=f"item-{index}"))
        read = app.state.store.read
        reads = []

        def counted(workspace: str):
            reads.append(workspace)
            return read(workspace)

        app.state.store.read = counted
        result = client.get("/api/cedar/request-updates", headers=auth)
        assert result.status_code == 200
        assert len(result.json()["requests"]) == 6
        assert len(reads) == 1
