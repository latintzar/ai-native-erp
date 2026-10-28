import json

import pytest
from cryptography.fernet import Fernet

from runtime.contracts import Checkout, PaymentObservation
from runtime.store import Store, StoreError


def setup(tmp_path):
    key = Fernet.generate_key().decode()
    path = tmp_path / "payments.sqlite"
    store = Store(path, key)
    seller = store.add_seller("Pilot", "flow", "sandbox", {"api_key": "private-value", "secret_key": "secret", "merchant_id": "seller-a"})
    data = {"document_id": "invoice-12", "amount_minor": 15000, "currency": "PEN", "description": "Invoice 12", "payer_email": "buyer@example.test", "billing": {}, "shipping": {}}
    request = store.add_request(seller["id"], "create-once", data)
    return store, seller, request, key, path, data


def observation(request, **overrides):
    data = dict(provider_id="payment-1", reference=request["id"], amount_minor=15000, currency="PEN", status="paid", merchant_id="seller-a")
    data.update(overrides)
    return PaymentObservation(**data)


def test_secrets_and_persistence(tmp_path):
    store, seller, request, key, path, _ = setup(tmp_path)
    assert b"private-value" not in path.read_bytes()
    assert b"buyer@example.test" not in path.read_bytes()
    again = Store(path, key)
    assert again.seller(seller["id"])["credentials"]["api_key"] == "private-value"
    assert again.request(request["id"])["public_token"] == request["public_token"]


def test_idempotent_creation_and_mismatched_reuse(tmp_path):
    store, seller, request, _, _, data = setup(tmp_path)
    assert store.add_request(seller["id"], "create-once", data)["id"] == request["id"]
    with pytest.raises(StoreError, match="idempotency_conflict"):
        store.add_request(seller["id"], "create-once", {**data, "amount_minor": 16000})
    assert store.claim_creation(request["id"])
    assert not store.claim_creation(request["id"])
    store.creation_failed(request["id"], "creation_uncertain", uncertain=True)
    assert not store.claim_creation(request["id"])


def test_confirmation_is_exactly_once_and_survives_old_events(tmp_path):
    store, _, request, _, _, _ = setup(tmp_path)
    store.set_checkout(request["id"], Checkout("order-1", "https://example.test/pay", "lookup-token"))
    store.apply(request["id"], observation(request))
    store.apply(request["id"], observation(request))
    store.apply(request["id"], observation(request, status="pending"))
    assert store.request(request["id"])["status"] == "paid"
    assert len(store.observations(request["id"])) == 1
    store.apply(request["id"], observation(request, status="refunded"))
    store.apply(request["id"], observation(request))
    assert store.request(request["id"])["status"] == "refunded"


@pytest.mark.parametrize("bad", [
    {"reference": "other-request"},
    {"amount_minor": 14999},
    {"currency": "USD"},
    {"merchant_id": "seller-b"},
])
def test_mismatched_confirmation_never_pays(tmp_path, bad):
    store, _, request, _, _, _ = setup(tmp_path)
    with pytest.raises(StoreError, match="payment_mismatch"):
        store.apply(request["id"], observation(request, **bad))
    assert store.request(request["id"])["status"] == "pending"


def test_same_payment_cannot_pay_two_documents(tmp_path):
    store, seller, request, _, _, data = setup(tmp_path)
    second = store.add_request(seller["id"], "second", {**data, "document_id": "invoice-13"})
    store.apply(request["id"], observation(request))
    with pytest.raises(StoreError, match="payment_already_allocated"):
        store.apply(second["id"], observation(second))


def test_webhook_inbox_is_durable_deduplicated_and_private(tmp_path):
    store, _, request, key, path, _ = setup(tmp_path)
    event = json.dumps({"provider_id": "payment-1", "secret": "callback-sensitive"})
    first = store.enqueue(request["id"], event)
    assert first == store.enqueue(request["id"], event)
    assert b"callback-sensitive" not in path.read_bytes()
    again = Store(path, key)
    jobs = again.jobs()
    assert len(jobs) == 1
    assert jobs[0]["payload"] == event
    again.finish_job(first)
    assert not again.jobs()
    again.enqueue(request["id"], event)
    assert len(again.jobs()) == 1


def test_reversal_only_changes_the_confirmed_payment(tmp_path):
    store, _, request, _, _, _ = setup(tmp_path)
    store.apply(request["id"], observation(request))
    with pytest.raises(StoreError, match="additional_payment_requires_review"):
        store.apply(request["id"], observation(request, provider_id="second-payment"))
    with pytest.raises(StoreError, match="reversal_payment_mismatch"):
        store.apply(request["id"], observation(request, provider_id="second-payment", status="refunded"))
    assert store.request(request["id"])["status"] == "paid"
    store.apply(request["id"], observation(request, status="cancelled"))
    assert store.request(request["id"])["status"] == "cancelled"
    store.apply(request["id"], observation(request))
    assert store.request(request["id"])["status"] == "cancelled"


@pytest.mark.parametrize("status", ["failed", "cancelled"])
def test_yape_failure_and_retry_readiness_commit_together(tmp_path, status):
    store, seller, _, key, path, data = setup(tmp_path)
    item = store.add_request(seller["id"], "yape-attempt", {
        **data, "document_id": "invoice-yape", "checkout_mode": "yape",
    })
    original = store.claim_charge(item["id"])
    store.apply(item["id"], observation(item, status=status))
    restarted = Store(path, key)
    assert restarted.request(item["id"])["status"] == status
    assert restarted.request(item["id"])["charge_phase"] == "idle"
    retry = restarted.claim_charge(item["id"])
    assert retry != original
    restarted.apply(item["id"], observation(item, status=status))
    assert restarted.request(item["id"])["charge_phase"] == "processing"
    assert restarted.request(item["id"])["charge_key"] == retry
