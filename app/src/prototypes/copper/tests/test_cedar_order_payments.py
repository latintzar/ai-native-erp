"""A commercial order collects before fiscal preparation, with frozen identity and receipts."""

from copy import deepcopy
from dataclasses import replace

from fastapi.testclient import TestClient
from test_cedar_native import owner, receipt, request_data
from test_cedar_native import settings as native_settings

from runtime.cedar_service import create_app

settings = native_settings


def document(**changes):
    return {
        "version": 1, "origin": "cedar-order", "customer_id": "buyer-1",
        "customer_name": "Sample buyer", "seller_name": "Sample seller",
        "document_number": "1509-001", "currency": "PEN", "total_minor": 10000,
        "lines": [{"id": "line-1", "description": "Fish", "quantity": "10", "unit": "kg", "total_minor": 10000}],
        **changes,
    }


def payload(**changes):
    return request_data(reference="1509-001", commercial_document=document(), **changes)


def fiscal(**changes):
    return {
        "version": 2, "origin": "cedar-draft", "customer_id": "buyer-1",
        "customer_name": "Sample buyer", "customer_ruc": "20987654321", "customer_address": "Buyer address",
        "seller_name": "Sample seller", "seller_ruc": "20123456789", "series": "F001",
        "issued_date": "2026-09-15", "due_date": "2026-09-15", "currency": "PEN",
        "source_currency": "PEN", "source_total_minor": 10000, "fx_rate": "1", "tax_rate": 0,
        "net_minor": 10000, "tax_minor": 0, "total_minor": 10000, "lines": document()["lines"], **changes,
    }


def test_order_collects_before_fiscal_and_link_survives_approval_restart(settings):
    settings = replace(settings, sample_bank=True)
    with TestClient(create_app(settings)) as client:
        _, auth = owner(client)
        made = client.post("/api/cedar/requests", headers=auth, json=payload())
        assert made.status_code == 201, made.text
        row = made.json()
        assert row["commercial_document"] == document()
        assert row["billing_draft"] is None and row["fiscal"]["phase"] == "unprepared"
        assert client.post("/api/cedar/requests", headers=auth, json=payload()).json()["id"] == row["id"]
        paid = client.post(row["buyer_url"] + "/approve", json={"phone": "987654321", "code": "123456", "quote_id": row["quote_id"]})
        assert paid.status_code == 200, paid.text
        path = "/api/cedar/requests/" + row["id"]
        owner_payment=client.get(path, headers=auth).json()
        assert owner_payment["balance_minor"] == 0
        assert paid.json()["timeline"][-1]["effective_at"] == owner_payment["receipts"][-1]["received_at"]
        assert paid.json()["timeline"][-1]["effective_at"] != owner_payment["receipts"][-1]["created_at"]
    with TestClient(create_app(settings)) as client:
        held = client.get(path, headers=auth).json()
        assert held["buyer_url"] == row["buyer_url"] and len(held["receipts"]) == 1
        assert held["fiscal"]["phase"] == "unprepared"


def test_order_snapshot_validates_money_document_and_identity(settings):
    with TestClient(create_app(settings)) as client:
        _, auth = owner(client)
        for bad in [document(total_minor=9999), document(customer_name="Different"), document(document_number="OTHER"),
                    document(lines=[{**document()["lines"][0], "quantity": "0"}])]:
            result = client.post("/api/cedar/requests", headers=auth, json={**payload(), "commercial_document": bad})
            assert result.status_code in (409, 422)
        row = client.post("/api/cedar/requests", headers=auth, json=payload()).json()
        changed = deepcopy(payload(idempotency_key="again"))
        changed["commercial_document"]["lines"][0]["description"] = "Other goods"
        assert client.post("/api/cedar/requests", headers=auth, json=changed).status_code == 409
        assert client.get("/api/cedar/requests/" + row["id"], headers=auth).json()["commercial_document"] == document()


def test_fiscal_attachment_is_exact_owner_review_and_preserves_payment(settings):
    with TestClient(create_app(settings)) as client:
        _, auth = owner(client)
        _, other = owner(client)
        row = client.post("/api/cedar/requests", headers=auth, json=payload()).json()
        base = "/api/cedar/requests/" + row["id"]
        client.post(base + "/receipts", headers=auth, json=receipt())
        path = base + "/billing-draft"
        assert client.post(path, headers=other, json={"billing_draft": fiscal()}).status_code == 404
        assert client.post(path, headers=auth, json={"billing_draft": fiscal(customer_id="other")}).status_code == 409
        changed = fiscal(lines=[{**document()["lines"][0], "quantity": "5"}])
        assert client.post(path, headers=auth, json={"billing_draft": changed}).status_code == 409
        attached = client.post(path, headers=auth, json={"billing_draft": fiscal()})
        assert attached.status_code == 200, attached.text
        held = attached.json()
        assert held["reference"] == "1509-001" and held["buyer_url"] == row["buyer_url"]
        assert held["balance_minor"] == 6000 and len(held["receipts"]) == 1
        assert held["fiscal"]["phase"] == "awaiting-authorization" and held["fiscal"]["can_issue"] is False
        assert client.post(path, headers=auth, json={"billing_draft": fiscal()}).status_code == 200
        assert client.post(path, headers=auth, json={"billing_draft": fiscal(customer_ruc="20000000000")}).status_code == 409
        legacy = client.post("/api/cedar/requests", headers=auth, json=request_data(invoice_id="old", reference="OLD", idempotency_key="old")).json()
        assert client.post("/api/cedar/requests/" + legacy["id"] + "/billing-draft", headers=auth, json={"billing_draft": fiscal()}).status_code == 409


def test_explicit_revision_preserves_receipts_checks_prior_snapshot_and_fiscal_freeze(settings):
    with TestClient(create_app(settings)) as client:
        wid, auth = owner(client)
        row = client.post("/api/cedar/requests", headers=auth, json=payload()).json()
        base = "/api/cedar/requests/" + row["id"]
        client.post(base + "/receipts", headers=auth, json=receipt())
        updated = document(total_minor=8000, lines=[{**document()["lines"][0], "quantity": "8", "total_minor": 8000}])
        body = {"expected_fingerprint": row["commercial_fingerprint"], "commercial_document": updated}
        changed = client.post(base + "/commercial-document", headers=auth, json=body)
        assert changed.status_code == 200, changed.text
        held = changed.json()
        assert held["balance_minor"] == 4000 and held["invoice_amount_minor"] == 8000
        assert held["buyer_url"] == row["buyer_url"] and len(held["receipts"]) == 1
        assert client.post(base + "/commercial-document", headers=auth, json=body).status_code == 200
        assert client.post(base + "/commercial-document", headers=auth, json={**body, "commercial_document": document()}).status_code == 409
        below = document(total_minor=3000, lines=[{**document()["lines"][0], "total_minor": 3000}])
        assert client.post(base + "/commercial-document", headers=auth, json={"expected_fingerprint": held["commercial_fingerprint"], "commercial_document": below}).status_code == 409
        app_state = client.app.state.store
        app_state.mutate(wid, lambda state: state["requests"][row["id"]].update(commissioned_at="2026-09-15T12:00:00Z"))
        assert client.post(base + "/commercial-document", headers=auth, json={"expected_fingerprint": held["commercial_fingerprint"], "commercial_document": document()}).status_code == 409


def test_bulk_hydration_is_atomic_idempotent_and_supports_the_whole_history(settings):
    with TestClient(create_app(settings)) as client:
        _, auth = owner(client)
        batch = [{**payload(), "invoice_id": f"invoice-{i}", "document_id": f"order-{i}", "reference": f"1509-{i:03}",
                  "idempotency_key": f"link-{i}", "commercial_document": document(document_number=f"1509-{i:03}")}
                 for i in range(25)]
        for index, row in enumerate(batch):
            total = 10000 + index * 100
            row.update(amount_minor=total, invoice_amount_minor=total)
            row["commercial_document"].update(total_minor=total)
            row["commercial_document"]["lines"][0]["total_minor"] = total
        path = "/api/cedar/requests/batch"
        made = client.post(path, headers=auth, json={"requests": batch})
        assert made.status_code == 201, made.text
        assert len(made.json()) == 25
        assert [r["id"] for r in client.post(path, headers=auth, json={"requests": batch}).json()] == [r["id"] for r in made.json()]
        bad = deepcopy(batch[:2])
        bad[0].update(invoice_id="new", reference="NEW", idempotency_key="new")
        bad[0]["commercial_document"]["document_number"] = "NEW"
        bad[1]["invoice_amount_minor"] = 9000
        assert client.post(path, headers=auth, json={"requests": bad}).status_code == 409
        assert len(client.get("/api/cedar/requests", headers=auth).json()) == 25
        for start in range(25, 250, 25):
            more = [{**payload(), "invoice_id": f"invoice-{i}", "document_id": f"order-{i}", "reference": f"1509-{i:03}",
                     "idempotency_key": f"link-{i}", "commercial_document": document(document_number=f"1509-{i:03}")}
                    for i in range(start, start + 25)]
            for index, row in enumerate(more, start):
                total = 10000 + index * 100
                row.update(amount_minor=total, invoice_amount_minor=total)
                row["commercial_document"].update(total_minor=total)
                row["commercial_document"]["lines"][0]["total_minor"] = total
            assert client.post(path, headers=auth, json={"requests": more}).status_code == 201
        assert len(client.get("/api/cedar/requests", headers=auth).json()) == 250


def test_pristine_fixture_rollover_preserves_old_evidence_and_closes_old_payable_links(settings):
    settings = replace(settings, sample_bank=True)
    with TestClient(create_app(settings)) as client:
        wid, auth = owner(client)
        seed = payload(fixture_owned=True, fixture_day="2026-09-15")
        row = client.post("/api/cedar/requests", headers=auth, json=seed)
        assert row.status_code == 201, row.text
        row = row.json()
        path = "/api/cedar/workspace/fixture-rollover"
        body = {"from_day": "2026-09-15", "to_day": "2026-09-16"}
        rotated = client.post(path, headers=auth, json=body)
        assert rotated.status_code == 200, rotated.text
        replacement = rotated.json()
        assert replacement["id"] != wid
        assert client.post(path, headers=auth, json=body).json() == replacement
        assert client.get(row["buyer_url"] + "/status").status_code == 404
        assert client.post(row["buyer_url"] + "/approve", json={"phone": "987654321", "code": "123456", "quote_id": row["quote_id"]}).status_code == 404
        assert len(client.get("/api/cedar/requests", headers=auth).json()) == 1
        assert client.post("/api/cedar/requests", headers=auth, json=payload(idempotency_key="later")).status_code == 409
        fresh = {"Authorization": "Bearer " + replacement["token"]}
        assert client.get("/api/cedar/requests", headers=fresh).json() == []


def test_every_native_authored_evidence_holds_the_current_fixture_calendar(settings):
    settings = replace(settings, sample_bank=True)
    with TestClient(create_app(settings)) as client:
        changes = [
            lambda state, row: state["providers"].update(prometeo={"environment": "sandbox", "credentials": {}}),
            lambda state, row: state["bank"].update(receiving_account={"number": "1234"}),
            lambda state, row: state["requests"][row["id"]].update(commissioned_at="2026-09-15T12:00:00Z"),
            lambda state, row: state["requests"][row["id"]].update(merchant_action_at="2026-09-15T12:00:00Z"),
            lambda state, row: state["requests"][row["id"]].update(fixture_owned=False),
        ]
        for change in changes:
            wid, auth = owner(client)
            made = client.post("/api/cedar/requests", headers=auth, json=payload(fixture_owned=True, fixture_day="2026-09-15"))
            assert made.status_code == 201, made.text
            row = made.json()
            client.app.state.store.mutate(wid, lambda state: change(state, row))
            assert client.post("/api/cedar/workspace/fixture-rollover", headers=auth,
                               json={"from_day": "2026-09-15", "to_day": "2026-09-16"}).status_code == 409
        _, auth = owner(client)
        row = client.post("/api/cedar/requests", headers=auth, json=payload(fixture_owned=True, fixture_day="2026-09-15")).json()
        assert client.post(row["buyer_url"] + "/approve", json={"phone": "987654321", "code": "123456", "quote_id": row["quote_id"]}).status_code == 200
        assert client.post("/api/cedar/workspace/fixture-rollover", headers=auth,
                           json={"from_day": "2026-09-15", "to_day": "2026-09-16"}).status_code == 409


def test_commercial_revision_refreshes_exact_quote_in_same_mutation(settings):
    settings = replace(settings, sample_bank=True)
    with TestClient(create_app(settings)) as client:
        _, auth = owner(client)
        prior = client.post("/api/cedar/requests", headers=auth, json=payload()).json()
        base = "/api/cedar/requests/" + prior["id"]
        updated = document(total_minor=12000, lines=[{**document()["lines"][0], "total_minor": 12000}])
        body = {"expected_fingerprint": prior["commercial_fingerprint"], "commercial_document": updated}
        revised = client.post(base + "/commercial-document", headers=auth, json=body)
        assert revised.status_code == 200, revised.text
        quote = revised.json()
        assert quote["quote_status"] == "ready", "the revision response already owns the refreshed quote"
        assert quote["quote_id"] and quote["quote_id"] != prior["quote_id"]
        assert quote["amount_minor"] - quote["rounding_minor"] == quote["balance_minor"] == 12000
        assert client.post(base + "/commercial-document", headers=auth, json=body).json()["quote_id"] == quote["quote_id"]
        stale = client.post(prior["buyer_url"] + "/approve", json={"phone": "987654321", "code": "123456", "quote_id": prior["quote_id"]})
        assert stale.status_code == 409
        paid = client.post(prior["buyer_url"] + "/approve", json={"phone": "987654321", "code": "123456", "quote_id": quote["quote_id"]})
        assert paid.status_code == 200, paid.text
        assert paid.json()["balance_minor"] == 0
        assert client.get(base, headers=auth).json()["sample_minor"] == 12000
