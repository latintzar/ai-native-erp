"""The unique cents key preserves bank cash, document principal and older payment quotes."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient

from runtime.cedar_service import CollectionInput, create_app
from runtime.cedar_store import CedarStore
from runtime.config import Settings
from runtime.store import StoreError


def request(index: int, amount: int = 10000) -> dict:
    return CollectionInput(invoice_id=f"invoice-{index}", document_id=f"order-{index}",
        seller_name="Fish house", customer_name="Restaurant", description=f"Order {index}",
        amount_minor=amount, invoice_amount_minor=amount, currency="PEN", receiving_bank="bbva",
        account_label="Receiving account", reference=f"ORDER-{index}", idempotency_key=f"request-{index}",
        sample_clock="2026-09-15T12:00:00Z").model_dump(mode="json", exclude_none=True)


@pytest.fixture
def store(tmp_path: Path):
    result = CedarStore(tmp_path / "collections.sqlite", Fernet.generate_key().decode())
    workspace = result.create_workspace("fish")
    return result, workspace["id"]


def view(store: CedarStore, item: dict) -> dict:
    return store.safe_request(item, "https://collections.example")


def pay(amount: int, reference: str) -> dict:
    return {"amount_minor": amount, "currency": "PEN", "method": "yape", "source": "sample", "reference": reference}


def test_atomic_quotes_keep_the_invoice_and_allocate_each_cent_once(store):
    ledger, wid = store
    with ThreadPoolExecutor(max_workers=8) as pool:
        items = list(pool.map(lambda index: ledger.create_request(wid, request(index)), range(12)))
    quotes = [view(ledger, item) for item in items]
    assert sorted(row["amount_minor"] for row in quotes) == list(range(10000, 10012))
    assert all(row["balance_minor"] == row["invoice_amount_minor"] == 10000 for row in quotes)
    assert all(row["rounding_minor"] == row["amount_minor"] - 10000 for row in quotes)
    assert len({row["quote_id"] for row in quotes}) == 12
    again = ledger.create_request(wid, request(0))
    assert view(ledger, again)["quote_id"] == quotes[0]["quote_id"]
    reopened = ledger.read(wid)
    assert {row["quote_id"] for row in map(lambda item: view(ledger, item), reopened["requests"].values())} == {row["quote_id"] for row in quotes}


def test_partial_payment_rotates_quote_and_keeps_old_amount_reserved(store):
    ledger, wid = store
    first = ledger.create_request(wid, request(1))
    old = view(ledger, first)
    partial = view(ledger, ledger.receipt(wid, first["id"], pay(1000, "PARTIAL")))
    assert partial["balance_minor"] == 9000
    assert partial["quote_id"] != old["quote_id"]
    other = view(ledger, ledger.create_request(wid, request(2)))
    assert other["amount_minor"] != old["amount_minor"]
    with pytest.raises(StoreError, match="payment_quote_changed"):
        ledger.approve_payment(wid, first["id"], "987654321", "123456", old["quote_id"])
    assert view(ledger, ledger.item(ledger.read(wid), first["id"]))["balance_minor"] == 9000


def test_checkout_records_cash_and_rounding_separately_and_retries_once(store):
    ledger, wid = store
    ledger.create_request(wid, request(0))
    item = ledger.create_request(wid, request(1))
    quoted = view(ledger, item)
    assert quoted["amount_minor"] == 10001
    settled = ledger.approve_payment(wid, item["id"], "987654321", "123456", quoted["quote_id"])
    result = view(ledger, settled)
    assert (result["balance_minor"], result["sample_minor"], result["rounding_received_minor"]) == (0, 10000, 1)
    assert result["receipts"][0]["amount_minor"] == 10001
    assert result["receipts"][0]["rounding_minor"] == 1
    assert result["sample_received_minor"] == 10001
    assert result["manual_received_minor"] == result["confirmed_received_minor"] == 0
    assert ledger.approve_payment(wid, item["id"], "987654321", "123456", quoted["quote_id"])["receipts"] == settled["receipts"]


def test_exhaustion_keeps_received_principal_and_exposes_reference_payment(store):
    ledger, wid = store
    large = ledger.create_request(wid, request(199, 20000))
    for index in range(100):
        ledger.create_request(wid, request(index))
    with pytest.raises(StoreError, match="unique_amount_exhausted"):
        ledger.create_request(wid, request(101))
    partial = view(ledger, ledger.receipt(wid, large["id"], pay(10000, "LARGE-PARTIAL")))
    assert partial["balance_minor"] == 10000
    assert partial["quote_id"]
    assert partial["quote_status"] == "reference-required"
    assert len(partial["receipts"]) == 1
    colliding = view(ledger, next(row for row in ledger.read(wid)["requests"].values() if row["invoice_id"] == "invoice-0"))
    assert colliding["quote_status"] == "reference-required"
    paid = view(ledger, ledger.approve_payment(wid, large["id"], "987654321", "123456", partial["quote_id"]))
    assert paid["balance_minor"] == 0


@pytest.fixture
def runtime(tmp_path: Path):
    settings = Settings(tmp_path, "https://collections.example", "operator-" + "x" * 40,
        Fernet.generate_key().decode(), allow_live=True, sample_bank=True)
    app = create_app(settings)
    with TestClient(app) as client:
        owner = client.post("/api/cedar/workspaces", json={"scope": "fish"}).json()
        wid = owner["id"]
        app.state.test_owner = owner["token"]
        def configure(state):
            state["providers"]["prometeo"] = {"environment": "live", "credentials": {"api_key": "fixture"}}
            state["bank"] = {"status": "logged_in", "key": "fixture", "provider": "bbva_pe",
                "receiving_account": {"number": "123456789", "bank": "bbva", "currency": "PEN", "name": "Receiving account", "balance_minor": 100000, "as_of": "2026-09-15T12:00:00Z"}}
        app.state.store.mutate(wid, configure)
        yield client, app.state.store, wid, {"Authorization": "Bearer " + settings.admin_token}


def movement(ledger, wid, index, amount, reference="", **changes):
    identity = str(index).zfill(64)
    row = {"id": str(index), "date": datetime.now(ZoneInfo("America/Lima")).date().isoformat(), "reference": reference, "detail": "Restaurant transfer",
        "account_number": "123456789", "currency": "PEN", "credit_minor": amount, "debit_minor": 0,
        "extra_data": {"payer_name": "Another restaurant"}, **changes}
    ledger.mutate(wid, lambda state: state["movements"].update({identity: {"id": identity,
        "movement": row, "allocated_to": None, "mode": "live", "match_status": "review", "reason": "review_required"}}))
    return identity


def authorize(ledger, wid, item):
    ledger.mutate(wid, lambda state: state["requests"][item["id"]].update(commissioned_at="2026-09-15T12:00:00Z"))


def test_absent_reference_matches_one_exact_quote_and_rounding_keeps_fiscal_principal(runtime):
    client, ledger, wid, admin = runtime
    ledger.create_request(wid, request(0))
    item = ledger.create_request(wid, request(1))
    authorize(ledger, wid, item)
    identity = movement(ledger, wid, 1, 10001)
    result = client.post(f"/api/operator/workspaces/{wid}/bank/match", headers=admin,
        json={"request_id": item["id"], "movement_id": identity})
    assert result.status_code == 200, result.text
    paid = result.json()
    assert paid["confirmed_minor"] == paid["invoice_amount_minor"] == 10000
    assert paid["rounding_received_minor"] == 1
    assert paid["receipts"][0]["amount_minor"] == 10001
    evidence = ledger.read(wid)["movements"][identity]
    assert evidence["allocated_minor"] == 10001
    assert evidence["match_key"] == "amount"


@pytest.mark.parametrize("changes", [
    {"reference": "WRONG"}, {"account_number": "987654321"}, {"currency": "USD"},
    {"debit_minor": 1}, {"credit_minor": 9999}, {"credit_minor": 10001},
])
def test_ambiguous_or_mismatched_evidence_stays_in_review(runtime, changes):
    client, ledger, wid, admin = runtime
    item = ledger.create_request(wid, request(1))
    authorize(ledger, wid, item)
    identity = movement(ledger, wid, 1, 10000, **changes)
    result = client.post(f"/api/operator/workspaces/{wid}/bank/match", headers=admin,
        json={"request_id": item["id"], "movement_id": identity})
    assert result.status_code == 409
    assert ledger.read(wid)["requests"][item["id"]]["receipts"] == []


def test_correct_reference_allows_partial_and_a_late_old_quote_stays_in_review(runtime):
    client, ledger, wid, admin = runtime
    item = ledger.create_request(wid, request(1))
    authorize(ledger, wid, item)
    old = view(ledger, item)
    identity = movement(ledger, wid, 1, 1000, "ORDER-1")
    assert client.post(f"/api/operator/workspaces/{wid}/bank/match", headers=admin,
        json={"request_id": item["id"], "movement_id": identity}).status_code == 200
    late = movement(ledger, wid, 2, old["amount_minor"])
    assert client.post(f"/api/operator/workspaces/{wid}/bank/match", headers=admin,
        json={"request_id": item["id"], "movement_id": late}).status_code == 409
    assert view(ledger, ledger.item(ledger.read(wid), item["id"]))["balance_minor"] == 9000


def test_amount_key_keeps_live_document_authorization_boundary(runtime):
    client, ledger, wid, admin = runtime
    item = ledger.create_request(wid, request(1))
    identity = movement(ledger, wid, 1, 10000)
    result = client.post(f"/api/operator/workspaces/{wid}/bank/match", headers=admin,
        json={"request_id": item["id"], "movement_id": identity})
    assert result.status_code == 409
    assert ledger.read(wid)["requests"][item["id"]]["receipts"] == []


def test_an_opening_receipt_preserves_rounding_as_sample_evidence(store):
    ledger, wid = store
    data = request(1)
    data.update(amount_minor=0, initial_receipts=[{**pay(10003, "OPENING"), "rounding_minor": 3}])
    result = view(ledger, ledger.create_request(wid, data))
    assert result["balance_minor"] == 0
    assert result["sample_minor"] == 10000
    assert result["rounding_received_minor"] == 3


def test_a_bank_credit_before_the_quote_day_stays_in_review(runtime):
    client, ledger, wid, admin = runtime
    item = ledger.create_request(wid, request(1))
    authorize(ledger, wid, item)
    identity = movement(ledger, wid, 1, 10000, date="2020-01-01")
    result = client.post(f"/api/operator/workspaces/{wid}/bank/match", headers=admin,
        json={"request_id": item["id"], "movement_id": identity})
    assert result.status_code == 409
    assert ledger.read(wid)["requests"][item["id"]]["receipts"] == []


def test_duplicate_current_quotes_stay_in_review(runtime):
    client, ledger, wid, admin = runtime
    first = ledger.create_request(wid, request(1))
    second = ledger.create_request(wid, request(2))
    authorize(ledger, wid, first)
    authorize(ledger, wid, second)
    ledger.mutate(wid, lambda state: state["requests"][second["id"]].update(quote=state["requests"][first["id"]]["quote"]))
    identity = movement(ledger, wid, 1, 10000)
    result = client.post(f"/api/operator/workspaces/{wid}/bank/match", headers=admin,
        json={"request_id": first["id"], "movement_id": identity})
    assert result.status_code == 409


def test_payer_name_is_visible_as_review_context_without_becoming_a_matching_key(runtime):
    client, ledger, wid, admin = runtime
    item = ledger.create_request(wid, request(1))
    authorize(ledger, wid, item)
    movement(ledger, wid, 1, 10000, "WRONG", extra_data={"payer_name": "Restaurant"})
    activity = client.get("/api/cedar/bank/movements", headers={"Authorization": "Bearer " + client.app.state.test_owner}).json()
    assert activity["movements"][0]["payer_name"] == "Restaurant"
    assert activity["movements"][0]["status"] == "review"


@pytest.mark.parametrize("received", [1000, 10000])
def test_reading_a_legacy_link_preserves_previously_displayed_amounts(store, received):
    ledger, wid = store
    original = ledger.create_request(wid, request(1))
    ledger.receipt(wid, original["id"], pay(received, "LEGACY-PAYMENT"))
    def predecessor(state):
        item = state["requests"][original["id"]]
        item.pop("quote", None)
        item.pop("quote_history", None)
    ledger.mutate(wid, predecessor)
    # A predecessor's unpaid and original face amounts were already visible to its payer.
    ledger.quoted_request(wid, original["id"])
    later = view(ledger, ledger.create_request(wid, request(2)))
    assert later["amount_minor"] != 10000, "reading the old link keeps its face amount reserved"
    if received < 10000:
        remainder = view(ledger, ledger.create_request(wid, request(3, 10000 - received)))
        assert remainder["amount_minor"] != 10000 - received
