import asyncio
import json

import httpx
import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient

from runtime.config import Settings
from runtime.contracts import Checkout, PaymentObservation, ProviderError
from runtime.service import create_app


class FakeAdapter:
    calls = 0
    def __init__(self, credentials, environment, client):
        self.credentials = credentials

    async def create_checkout(self, intent):
        self.intent = intent
        FakeAdapter.calls += 1
        return Checkout("order-1", "https://sandbox.flow.cl/pay?token=secret", "secret")

    async def get_payment(self, checkout, intent, event_id=""):
        return PaymentObservation("payment-1", intent.reference, intent.amount_minor, intent.currency, "paid", "seller-a", "yape")

    def verify_notification(self, body, headers, query, checkout):
        if body != b"token=secret":
            raise ProviderError("invalid_notification")
        return "payment-1"


@pytest.fixture
def client(tmp_path):
    settings = Settings(tmp_path, "http://127.0.0.1:8795", "a" * 40, Fernet.generate_key().decode())
    app = create_app(settings, adapter_factory=lambda *args: FakeAdapter(*args), start_worker=False)
    with TestClient(app) as client:
        yield client


def auth():
    return {"Authorization": "Bearer " + "a" * 40}


def create(client):
    seller = client.post("/api/sellers", headers=auth(), json={
        "name": "Pilot", "provider": "flow", "environment": "sandbox",
        "credentials": {"api_key": "secret", "secret_key": "secret", "merchant_id": "seller-a"}
    }).json()
    response = client.post("/api/requests", headers={**auth(), "Idempotency-Key": "one"}, json={
        "seller_id": seller["id"], "document_id": "INV-1", "description": "Invoice 1",
        "amount_minor": 1000, "currency": "PEN", "payer_email": "buyer@example.test"
    })
    assert response.status_code == 201, response.text
    return seller, response.json()


def test_admin_auth_and_secret_redaction(client):
    assert client.get("/api/sellers").status_code == 401
    seller, request = create(client)
    serialized = client.get("/api/sellers", headers=auth()).text
    assert "secret_key" not in serialized and '"credentials"' not in serialized
    assert "secret" not in json.dumps(seller)
    assert request["status"] == "pending"


def test_public_link_cannot_mark_paid_and_wrong_capability_is_private(client):
    _, request = create(client)
    path = request["public_url"].replace("http://127.0.0.1:8795", "")
    assert client.get(path).status_code == 200
    assert client.get(path + "/status").json()["status"] == "pending"
    assert client.get(path.rsplit("/", 1)[0] + "/wrong").status_code == 404
    assert client.post(path + "/paid").status_code in {404, 405}


def test_authenticated_callback_durable_then_reconciles_once(client):
    _, item = create(client)
    stored = client.app.state.store.request(item["id"])
    path = f"/webhooks/{item['id']}/{stored['webhook_token']}"
    assert client.post(path, content=b"token=forged").status_code == 401
    assert client.app.state.store.request(item["id"])["status"] == "pending"
    assert client.post(path, content=b"token=secret").status_code == 200
    assert client.post(path, content=b"token=secret").status_code == 200
    jobs = client.app.state.store.jobs()
    assert len(jobs) == 1
    import asyncio
    asyncio.run(client.app.state.engine.process_jobs())
    assert client.app.state.store.request(item["id"])["status"] == "paid"
    assert len(client.app.state.store.observations(item["id"])) == 1


def test_missing_callback_recovers_and_real_payments_stay_disabled(client):
    seller, item = create(client)
    result = client.post(f"/api/requests/{item['id']}/refresh", headers=auth())
    assert result.status_code == 200 and result.json()["status"] == "paid"
    rejected = client.post("/api/sellers", headers=auth(), json={
        "name": "Live", "provider": "flow", "environment": "live",
        "credentials": {"api_key": "x", "secret_key": "y"}
    })
    assert rejected.status_code == 409


def test_body_limit_and_invalid_amount(client):
    assert client.post("/api/sellers", content=b"x" * 70000, headers=auth()).status_code == 413
    seller, _ = create(client)
    result = client.post("/api/requests", headers={**auth(), "Idempotency-Key": "bad"}, json={
        "seller_id": seller["id"], "document_id": "INV-2", "description": "Invoice 2",
        "amount_minor": 1.5, "payer_email": "buyer@example.test"
    })
    assert result.status_code == 422


def test_oauth_state_is_one_use_and_bound_to_browser(tmp_path):
    from runtime.store import Store, StoreError
    store = Store(tmp_path / "oauth.sqlite", Fernet.generate_key().decode())
    state = store.create_oauth({"verifier": "private"}, "browser-a")
    with pytest.raises(StoreError, match="oauth_state_invalid"):
        store.consume_oauth(state, "browser-b")
    assert store.consume_oauth(state, "browser-a")["verifier"] == "private"
    with pytest.raises(StoreError, match="oauth_state_invalid"):
        store.consume_oauth(state, "browser-a")


def test_sweep_isolates_a_broken_seller(client, monkeypatch):
    _, broken = create(client)
    _, healthy = create(client)
    engine = client.app.state.engine
    actual = engine.refresh
    visited = []

    async def refresh(request_id, event_id=""):
        visited.append(request_id)
        if request_id == broken["id"]:
            raise ValueError("malformed credential")
        await actual(request_id, event_id)

    monkeypatch.setattr(engine, "refresh", refresh)
    monkeypatch.setattr(engine.store, "requests", lambda **_: [
        {**engine.store.request(broken["id"]), "created": 0},
        {**engine.store.request(healthy["id"]), "created": 0},
    ])
    asyncio.run(engine.sweep())
    assert visited == [broken["id"], healthy["id"]]
    assert engine.store.request(healthy["id"])["status"] == "paid"
    assert engine.store.request(broken["id"])["last_error"] == "confirmation_retry_required"


def test_failed_yape_confirmation_unlocks_only_the_first_delivery(client):
    _, item = create(client)
    store = client.app.state.store
    payload = store.request(item["id"])
    payload["checkout_mode"] = "yape"
    # Isolate retry semantics from the provider HTTP contract covered in its own tests.
    with store.connect() as db:
        db.execute("UPDATE requests SET payload=? WHERE id=?", (store.encrypt(payload), item["id"]))
    first_key = store.claim_charge(item["id"])

    class DeclinedAdapter(FakeAdapter):
        async def get_payment(self, checkout, intent, event_id=""):
            return PaymentObservation("decline-1", intent.reference, intent.amount_minor,
                                      intent.currency, "failed", "seller-a", "yape")

    client.app.state.engine.factory = lambda *args: DeclinedAdapter(*args)
    asyncio.run(client.app.state.engine.refresh(item["id"]))
    assert store.request(item["id"])["charge_phase"] == "idle"
    second_key = store.claim_charge(item["id"])
    assert second_key != first_key
    asyncio.run(client.app.state.engine.refresh(item["id"]))
    assert store.request(item["id"])["charge_phase"] == "processing"
    assert store.request(item["id"])["charge_key"] == second_key


def test_marketplace_callback_routes_to_the_matching_connection(tmp_path):
    response_body = {}
    def transport(request):
        return httpx.Response(200, json=response_body)
    settings = Settings(tmp_path, "http://127.0.0.1:8795", "a" * 40, Fernet.generate_key().decode())
    http_client = httpx.AsyncClient(transport=httpx.MockTransport(transport))
    app = create_app(settings, adapter_factory=lambda *args: FakeAdapter(*args),
                     start_worker=False, http_client=http_client)
    with TestClient(app) as client:
        credentials = {"access_token": "synthetic", "collector_id": "seller-a", "webhook_secret": "synthetic"}
        older = app.state.store.add_seller("Older", "mercadopago", "sandbox", credentials)
        newer = app.state.store.add_seller("Newer", "mercadopago", "sandbox", credentials)
        item = app.state.store.add_request(older["id"], "one", {
            "document_id": "INV-1", "description": "Invoice 1", "amount_minor": 1000,
            "currency": "PEN", "payer_email": "buyer@example.test", "checkout_mode": "hosted",
        })
        app.state.store.set_checkout(item["id"], Checkout("pref-1", "https://www.mercadopago.com.pe/checkout"))
        response_body.update(external_reference=item["id"], collector_id="seller-a")
        # Simulate signature validation independently of the real adapter's signature tests.
        app.state.engine.raw_adapter = lambda _: type("Verified", (), {
            "verify_notification": lambda *args: "12345"
        })()
        assert app.state.store.sellers()[0]["id"] == newer["id"]
        result = client.post("/webhooks/mercadopago", json={"user_id": "seller-a"})
        assert result.status_code == 200, result.text
        assert result.json() == {"received": "queued"}
        assert app.state.store.jobs()[0]["request_id"] == item["id"]
    asyncio.run(http_client.aclose())
