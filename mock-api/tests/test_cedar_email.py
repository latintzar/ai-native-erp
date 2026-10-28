"""Synthetic HTTP contract proofs; never connects a real mailbox or sends email."""

import base64
import hashlib
import hmac
import json
import sqlite3
import time

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import cedar_access, cedar_email
from app.cedar_email_provider import UnipileClient
from app.config import settings


@pytest.fixture
def runtime(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "state_dir", tmp_path)
    monkeypatch.setenv("UNIPILE_API_KEY", "synthetic-provider-key")
    monkeypatch.setenv("UNIPILE_WEBHOOK_SECRET", "synthetic-signing-secret")
    monkeypatch.setenv("CEDAR_EMAIL_PUBLIC_BASE", "https://demo.soyrocoto.com")
    state = {"scope": "scope_fixture", "provider": "google", "auth_state": "", "calls": [], "locked": False}
    message = {
        "object": "Email",
        "id": "provider-message",
        "thread_id": "provider-thread",
        "date": "2025-08-22T14:45:00Z",
        "subject": "SYNTHETIC private invoice subject",
        "body": "<p>SYNTHETIC raw source</p><script>unsafe()</script>",
        "from": [{"email": "customer@example.invalid"}],
        "to": [{"email": "seller@example.invalid"}],
        "attachments": [
            {"id": "provider-file", "filename": "SYNTHETIC-private.pdf", "mimetype": "application/pdf"},
            {"id": "provider-file-2", "filename": "SYNTHETIC-private.pdf", "mimetype": "application/pdf"},
        ],
    }
    state["message"] = message

    def handler(request):
        assert request.url.host == "api.unipile.com"
        assert request.headers["x-api-key"] == "synthetic-provider-key"
        state["calls"].append((request.method, request.url.path, dict(request.url.params)))
        path = request.url.path
        if path == "/v2/scopes/":
            return httpx.Response(200, json={"id": state["scope"]})
        if path == "/v2/auth/link":
            body = json.loads(request.content)
            assert body["account_scope_id"] == state["scope"]
            assert body["providers"] == "google"
            scopes = [
                "https://www.googleapis.com/auth/gmail.readonly",
                "https://www.googleapis.com/auth/gmail.send",
                "openid",
                "email",
            ]
            assert body["config"] == {"google": {"oauth_scope": scopes}}
            state["auth_state"] = body["state"]
            return httpx.Response(
                200, json={"object": "HostedAuthLink", "link": "https://auth.unipile.com/fixture"}
            )
        if path.startswith("/v2/accounts/"):
            if request.method == "DELETE":
                return httpx.Response(200, json={"success": True})
            return httpx.Response(
                200,
                json={
                    "id": path.rsplit("/", 1)[1],
                    "account_scope_id": state["scope"],
                    "provider": state["provider"],
                    "status": "running",
                    "is_locked": state["locked"],
                    "name": "seller@example.invalid",
                },
            )
        if path.endswith("/emails/send"):
            body = json.loads(request.content)
            state["sent"] = body
            return httpx.Response(200, json={"object": "EmailSent", "id": "sent-fixture-1"})
        if path.endswith("/attachments/provider-file-fresh"):
            return httpx.Response(200, content=b"%PDF-1.4 SYNTHETIC attachment")
        if path.endswith("/attachments/provider-file-2-fresh"):
            return httpx.Response(200, content=b"%PDF-1.4 SYNTHETIC second file")
        if path.endswith("/attachments/provider-file") or path.endswith("/attachments/provider-file-2"):
            raise AssertionError("A download must use the attachment id of the read it came from")
        if "/emails/" in path:
            selected = next(
                (
                    item
                    for item in state.get("thread_messages", [message])
                    if item["id"] == path.rsplit("/", 1)[1]
                ),
                message,
            )
            # Gmail: a single read issues a different attachment id from the list or thread read.
            files = [{**a, "id": a["id"] + "-fresh"} for a in selected["attachments"]]
            fresh = {**selected, "attachments": files}
            return httpx.Response(200, json=fresh)
        if path.endswith("/threads/provider-thread"):
            emails = state.get("thread_messages", [message])
            return httpx.Response(200, json={"object": "Thread", "id": "provider-thread", "emails": emails})
        if path.endswith("/emails"):
            blank = {"object": "Email", "id": "", "message_id": "", "subject": "", "body": "", "date": ""}
            return httpx.Response(200, json={"data": [message, blank]})
        raise AssertionError(f"Unexpected provider route: {path}")

    provider_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    monkeypatch.setattr(
        cedar_email, "provider", lambda: UnipileClient("synthetic-provider-key", provider_client)
    )
    app = FastAPI()
    app.include_router(cedar_access.router)
    app.include_router(cedar_email.router)
    with TestClient(app) as client:
        first = client.post("/api/cedar/access/workspaces", json={}).json()
        second = client.post("/api/cedar/access/workspaces", json={}).json()
        headers = {"Authorization": "Bearer " + first["access_token"]}
        other = {"Authorization": "Bearer " + second["access_token"]}
        yield client, headers, other, state, tmp_path


def connect(runtime):
    client, headers, _, state, _ = runtime
    assert (
        client.post("/api/cedar/email/auth", json={"provider": "google"}, headers=headers).status_code == 200
    )
    callback = client.get(
        "/api/cedar/email/callback",
        params={"state": state["auth_state"], "account_id": "acc_fixture"},
        follow_redirects=False,
    )
    assert callback.status_code == 303
    result = client.get("/api/cedar/email/status", headers=headers)
    assert result.headers["cache-control"] == "no-store"
    return result.json()["accounts"][0]["account_ref"]


def test_hosted_auth_checks_scope_replay_and_private_workspace(runtime):
    client, headers, other, state, _ = runtime
    account = connect(runtime)
    assert account.startswith("mail_")
    assert client.get("/api/cedar/email/status", headers=other).json()["accounts"] == []
    assert (
        client.get(
            "/api/cedar/email/callback", params={"state": state["auth_state"], "account_id": "acc_fixture"}
        ).status_code
        == 400
    )
    client.post("/api/cedar/email/auth", json={"provider": "google"}, headers=other)
    state["scope"] = "scope_foreign"
    assert (
        client.get(
            "/api/cedar/email/callback", params={"state": state["auth_state"], "account_id": "acc_foreign"}
        ).status_code
        == 403
    )
    assert client.post(f"/api/cedar/email/accounts/{account}/sync", headers=other, json={}).status_code == 404
    assert client.get("/api/cedar/email/status").status_code == 401


def test_history_threads_attachments_no_raw_retention_and_lock(runtime):
    client, headers, other, state, path = runtime
    account = connect(runtime)
    binding = f"/api/cedar/email/accounts/{account}/customer-binding"
    assert client.post(
        binding,
        headers=headers,
        json={"address": " Customer@Example.INVALID ", "customer_id": "customer-1"},
    ).json() == {"customerId": "customer-1"}
    assert client.post(
        binding,
        headers=other,
        json={"address": "customer@example.invalid", "customer_id": "customer-2"},
    ).status_code == 404
    result = client.post(
        f"/api/cedar/email/accounts/{account}/sync", headers=headers, json={"scope": "customers"}
    ).json()
    assert result["coverage"] == "bound-customers" and result["bound"] == 1
    assert result["messages"][0]["customerId"] == "customer-1"
    listed = [call for call in state["calls"] if call[1].endswith("/emails")]
    assert [call[2].get("from") or call[2].get("to") for call in listed] == ["customer@example.invalid"] * 2
    filtered = {"query": "pedido has:attachment"}
    searched = client.post(f"/api/cedar/email/accounts/{account}/sync", headers=headers, json=filtered).json()
    assert searched["coverage"] == "search" and searched["query"] == "pedido has:attachment"
    last = state["calls"][-1][2]
    assert last["q"] == "pedido has:attachment" and "has_attachment" not in last
    assert "provider_id" not in result["messages"][0]
    source = result["messages"][0]["source_ref"]
    attachment = result["messages"][0]["attachments"][0]["attachment_ref"]
    assert "provider-message" not in json.dumps(result)
    assert result["messages"][0]["body"] == ""
    thread = client.get(f"/api/cedar/email/sources/{source}/thread", headers=headers)
    assert thread.status_code == 200
    assert thread.json()["messages"][0]["body"].strip() == "SYNTHETIC raw source"
    assert client.get(f"/api/cedar/email/sources/{source}/thread", headers=other).status_code == 404
    download = client.get(f"/api/cedar/email/sources/{source}/attachments/{attachment}", headers=headers)
    assert download.content.startswith(b"%PDF-")
    assert download.headers["cache-control"] == "no-store"
    assert "sandbox" in download.headers["content-security-policy"]
    stored = (path / "cedar-email.sqlite").read_bytes()
    for forbidden in (
        b"SYNTHETIC raw source",
            b"SYNTHETIC private invoice subject",
            b"SYNTHETIC-private.pdf",
            b"%PDF-",
        ):
        assert forbidden not in stored
    state["locked"] = True
    assert client.get(f"/api/cedar/email/sources/{source}/thread", headers=headers).status_code == 409


def test_disconnect_removes_provider_account_and_private_aliases(runtime):
    client, headers, other, state, path = runtime
    account = connect(runtime)
    everything = client.post(
        f"/api/cedar/email/accounts/{account}/sync", headers=headers, json={"scope": "all"}
    ).json()
    assert everything["coverage"] == "all-mail" and len(everything["messages"]) == 1
    assert "customerId" not in everything["messages"][0]
    unbound = client.post(
        f"/api/cedar/email/accounts/{account}/sync", headers=headers, json={"scope": "customers"}
    ).json()
    assert unbound == {
        "messages": [], "has_more": False, "coverage": "bound-customers", "bound": 0, "unnamed": 0
    }
    assert len([call for call in state["calls"] if call[1].endswith("/emails")]) == 1
    client.post(
        f"/api/cedar/email/accounts/{account}/customer-binding",
        headers=headers,
        json={"address": "customer@example.invalid", "customer_id": "customer-1"},
    )
    synced = client.post(f"/api/cedar/email/accounts/{account}/sync", headers=headers, json={}).json()
    source = synced["messages"][0]["source_ref"]
    attachment = synced["messages"][0]["attachments"][0]["attachment_ref"]
    assert client.post(
        f"/api/cedar/email/accounts/{account}/customer-binding",
        headers=headers,
        json={"address": "customer@example.invalid", "customer_id": "customer-1"},
    ).status_code == 200

    endpoint = f"/api/cedar/email/accounts/{account}"
    assert client.delete(endpoint, headers=other).status_code == 404
    assert client.delete(endpoint, headers=headers).json() == {"disconnected": True}
    assert state["calls"][-1][:2] == ("DELETE", "/v2/accounts/acc_fixture")
    assert client.get("/api/cedar/email/status", headers=headers).json()["accounts"] == []
    assert client.get(f"/api/cedar/email/sources/{source}/thread", headers=headers).status_code == 404
    assert client.get(
        f"/api/cedar/email/sources/{source}/attachments/{attachment}", headers=headers
    ).status_code == 404
    with cedar_email.store().db() as db:
        assert db.execute("SELECT COUNT(*) FROM email_accounts").fetchone()[0] == 0
        assert db.execute("SELECT COUNT(*) FROM email_sources").fetchone()[0] == 0
        assert db.execute("SELECT COUNT(*) FROM email_attachments").fetchone()[0] == 0
        assert db.execute("SELECT COUNT(*) FROM email_customer_bindings").fetchone()[0] == 0
        assert db.execute("SELECT COUNT(*) FROM email_binding_profiles").fetchone()[0] == 1
    assert path.joinpath("cedar-email.sqlite").exists()
    reconnected = connect(runtime)
    restored = client.post(
        f"/api/cedar/email/accounts/{reconnected}/sync", headers=headers, json={}
    ).json()
    assert restored["messages"][0]["customerId"] == "customer-1"


def test_invoice_search_requires_consent_and_pdf_has_provenance(runtime, monkeypatch):
    client, headers, _, state, _ = runtime
    account = connect(runtime)
    endpoint = f"/api/cedar/email/accounts/{account}"
    assert (
        client.post(endpoint + "/invoice-search", json={"query": "factura"}, headers=headers).status_code
        == 403
    )
    client.post(endpoint + "/invoice-consent", json={"consent": True}, headers=headers)
    results = client.post(endpoint + "/invoice-search", json={"query": "factura"}, headers=headers).json()
    assert state["calls"][-1][2]["q"] == "factura"
    assert state["calls"][-1][2]["has_attachment"] == "true"
    source = results["messages"][0]

    async def parse(content, filename, content_type, kind):
        assert content.startswith(b"%PDF-") and filename == "source.pdf" and kind == "albaran"
        return {"rows": [{"product": "Synthetic item", "quantity": 2}], "columns": ["product", "quantity"]}

    monkeypatch.setattr(cedar_email.parsewise, "parse_document", parse)
    result = client.post(
        f"/api/cedar/email/sources/{source['source_ref']}/attachments/{source['attachments'][0]['attachment_ref']}/parse",
        headers=headers,
    )
    assert result.status_code == 200
    assert result.json()["review_required"] is True
    assert result.json()["provenance"]["source_ref"] == source["source_ref"]
    client.post(endpoint + "/invoice-consent", json={"consent": False}, headers=headers)
    assert (
        client.post(endpoint + "/invoice-search", json={"query": "factura"}, headers=headers).status_code
        == 403
    )
    assert all(not route.endswith("/send") for _, route, _ in state["calls"])


def test_signed_webhook_replay_and_payload_minimization(runtime):
    client, headers, other, state, path = runtime
    account = connect(runtime)
    assert client.post(
        f"/api/cedar/email/accounts/{account}/customer-binding",
        headers=headers,
        json={"address": "customer@example.invalid", "customer_id": "customer-1"},
    ).status_code == 200
    payload = json.dumps(
        {
            "id": "webhook-incoming",
            "type": "email.new",
            "account_id": "acc_fixture",
            "payload": {"email": state["message"], "body": "SYNTHETIC webhook body"},
        }
    ).encode()
    stamp = str(int(time.time()))
    digest = hmac.new(
        b"synthetic-signing-secret", stamp.encode() + b"." + payload, hashlib.sha256
    ).hexdigest()
    signature = {"unipile-signature": f"t={stamp},v0={digest}"}
    assert client.post("/api/cedar/email/webhook", content=payload).status_code == 401
    for _ in range(2):
        assert client.post("/api/cedar/email/webhook", content=payload, headers=signature).status_code == 200
    result = client.get("/api/cedar/email/status", headers=headers).json()["accounts"][0]
    assert result["account_ref"] == account and result["revision"] == 1
    # A push carries the message, so it never feeds the queue: arrivals come from the filtered pull.
    assert client.get("/api/cedar/email/intake", headers=headers).json()["messages"] == []
    assert b"SYNTHETIC webhook body" not in (path / "cedar-email.sqlite").read_bytes()
    assert (
        client.post("/api/cedar/email/webhook", content=payload + b" ", headers=signature).status_code == 401
    )


def test_filtered_pull_queues_only_new_mail_from_known_customers(runtime):
    import asyncio
    from datetime import datetime, timedelta, timezone

    client, headers, other, state, path = runtime
    account = connect(runtime)
    # History dated before the connection stays out of the queue even from a known customer.
    assert asyncio.run(cedar_email.pull_arrivals()) == {"accounts": 1, "queued": 0}
    assert not [call for call in state["calls"] if call[1].endswith("/emails")]
    assert client.post(
        f"/api/cedar/email/accounts/{account}/customer-binding",
        headers=headers,
        json={"address": "customer@example.invalid", "customer_id": "customer-1"},
    ).status_code == 200
    arrival = datetime.now(timezone.utc) + timedelta(minutes=1)
    state["message"]["date"] = arrival.isoformat().replace("+00:00", "Z")
    assert asyncio.run(cedar_email.pull_arrivals()) == {"accounts": 1, "queued": 1}
    pulls = [call for call in state["calls"] if call[1].endswith("/emails")]
    assert pulls
    assert all(call[2]["from"] == "customer@example.invalid" and "after" in call[2] for call in pulls)
    intake = client.get("/api/cedar/email/intake", headers=headers).json()
    assert len(intake["messages"]) == 1 and intake["messages"][0]["customerId"] == "customer-1"
    assert intake["messages"][0]["historical"] is False
    assert intake["messages"][0]["text"].strip() == "SYNTHETIC raw source"
    assert "customer@example.invalid" not in json.dumps(intake)
    assert client.get("/api/cedar/email/intake", headers=other).json()["messages"] == []
    # The same pull again queues nothing more; a message the owner sent is never an arrival.
    assert asyncio.run(cedar_email.pull_arrivals()) == {"accounts": 1, "queued": 0}
    state["message"]["from"], state["message"]["to"] = state["message"]["to"], state["message"]["from"]
    assert asyncio.run(cedar_email.pull_arrivals()) == {"accounts": 1, "queued": 0}


def test_long_thread_pages_are_private_anchored_and_keep_attachments(runtime):
    client, headers, other, state, path = runtime
    account = connect(runtime)
    client.post(
        f"/api/cedar/email/accounts/{account}/customer-binding",
        headers=headers,
        json={"address": "customer@example.invalid", "customer_id": "customer-1"},
    )
    source = client.post(f"/api/cedar/email/accounts/{account}/sync", headers=headers, json={}).json()[
        "messages"
    ][0]["source_ref"]
    state["thread_messages"] = [
        {
            **state["message"],
            "id": f"provider-history-{index}",
            "date": f"2025-08-22T14:{index:02d}:00Z",
            "body": f"SYNTHETIC history {index}",
        }
        for index in reversed(range(60))
    ]
    endpoint = f"/api/cedar/email/sources/{source}/thread"
    first = client.get(endpoint, headers=headers).json()
    assert len(first["messages"]) == 50 and first["has_more"]
    assert first["messages"][0]["body"] == "SYNTHETIC history 59"
    assert first["messages"][-1]["body"] == "SYNTHETIC history 10"
    cursor = first["next_cursor"]
    assert cursor.startswith("page_") and "provider-history" not in json.dumps(first)
    assert state["calls"][-1][2] == {}  # Official Get Thread accepts no paging parameter.

    # A new current message arrives between pages. Its arrival must not shift the older page.
    state["thread_messages"].insert(
        0,
        {
            **state["message"],
            "id": "provider-latest",
            "date": "2025-08-22T15:00:00Z",
            "body": "SYNTHETIC new arrival",
        },
    )
    current = client.get(endpoint, headers=headers).json()
    assert current["messages"][0]["body"] == "SYNTHETIC new arrival"
    second = client.get(endpoint, params={"cursor": cursor}, headers=headers).json()
    assert len(second["messages"]) == 10 and second["has_more"] is False and second["next_cursor"] is None
    assert [row["body"] for row in second["messages"]] == [
        f"SYNTHETIC history {i}" for i in reversed(range(10))
    ]
    assert not {row["source_ref"] for row in first["messages"]} & {
        row["source_ref"] for row in second["messages"]
    }
    repeated = client.get(endpoint, params={"cursor": cursor}, headers=headers).json()
    assert [row["source_ref"] for row in repeated["messages"]] == [
        row["source_ref"] for row in second["messages"]
    ]
    older = second["messages"][-1]
    attachment = older["attachments"][0]["attachment_ref"]
    download = f"/api/cedar/email/sources/{older['source_ref']}/attachments/{attachment}"
    assert client.get(download, headers=headers).content.startswith(b"%PDF-")
    assert client.get(download, headers=other).status_code == 404

    calls = len(state["calls"])
    assert client.get(endpoint, params={"cursor": cursor}, headers=other).status_code == 404
    wrong_source = f"/api/cedar/email/sources/{first['messages'][0]['source_ref']}/thread"
    assert client.get(wrong_source, params={"cursor": cursor}, headers=headers).status_code == 404
    assert client.get(endpoint, params={"cursor": "provider-history-10"}, headers=headers).status_code == 404
    assert len(state["calls"]) == calls
    stored = (path / "cedar-email.sqlite").read_bytes()
    assert b"SYNTHETIC history" not in stored and b"SYNTHETIC new arrival" not in stored


def test_operator_registers_a_known_sender_for_the_workspace(runtime):
    client, headers, other, state, path = runtime
    account = connect(runtime)
    workspace = client.get("/api/cedar/access/workspace", headers=headers).json()["workspace_id"]
    body = {"workspace_id": workspace, "address": " Customer@Example.INVALID ", "customer_id": "customer-9"}
    owner_try = client.post("/api/cedar/email/operator/customer-binding", json=body, headers=headers)
    assert owner_try.status_code == 403
    import os

    os.environ["CEDAR_CHANNEL_OPERATOR_KEY"] = "fixture-operator-" + "x" * 32
    operator = {"Authorization": "Bearer " + os.environ["CEDAR_CHANNEL_OPERATOR_KEY"]}
    result = client.post("/api/cedar/email/operator/customer-binding", json=body, headers=operator)
    assert result.status_code == 200 and result.json() == {"customerId": "customer-9", "accounts": 1}
    synced = client.post(
        f"/api/cedar/email/accounts/{account}/sync", headers=headers, json={"scope": "customers"}
    ).json()
    assert synced["bound"] == 1 and synced["messages"][0]["customerId"] == "customer-9"
    stranger = {**body, "workspace_id": "f" * 32}
    refused = client.post("/api/cedar/email/operator/customer-binding", json=stranger, headers=operator)
    assert refused.status_code == 404
    del os.environ["CEDAR_CHANNEL_OPERATOR_KEY"]


def test_reply_goes_to_the_customer_from_the_connected_mailbox_once(runtime):
    client, headers, other, state, path = runtime
    account = connect(runtime)
    synced = client.post(
        f"/api/cedar/email/accounts/{account}/sync", headers=headers, json={"scope": "all"}
    ).json()
    source = synced["messages"][0]["source_ref"]
    body = {"text": "Recibido, gracias.", "idempotency_key": "reply-1"}
    # An unknown sender is refused before anything is sent.
    refused = client.post(f"/api/cedar/email/sources/{source}/reply", headers=headers, json=body)
    assert refused.status_code == 403 and "sent" not in state
    client.post(
        f"/api/cedar/email/accounts/{account}/customer-binding",
        headers=headers,
        json={"address": "customer@example.invalid", "customer_id": "customer-1"},
    )
    route = f"/api/cedar/email/sources/{source}/reply"
    assert client.post(route, headers=other, json=body).status_code == 404
    first = client.post(route, headers=headers, json=body).json()
    assert first["accepted"] is True and first["receipt_ref"].startswith("sent_")
    assert state["sent"]["to"] == [{"email": "customer@example.invalid"}]
    assert state["sent"]["subject"] == "Re: SYNTHETIC private invoice subject"
    assert state["sent"]["plain_text"] == "Recibido, gracias."
    assert state["sent"]["reply_to_message_id"] == "provider-message"
    sends = [call for call in state["calls"] if call[1].endswith("/emails/send")]
    again = client.post(route, headers=headers, json=body).json()
    assert again == {"accepted": True, "receipt_ref": first["receipt_ref"], "repeated": True}
    assert len([call for call in state["calls"] if call[1].endswith("/emails/send")]) == len(sends)
    assert b"Recibido" not in (path / "cedar-email.sqlite").read_bytes()


def test_customer_and_search_lists_carry_files_and_all_mail_pages_light(runtime):
    client, headers, _, state, _ = runtime
    account = connect(runtime)
    client.post(
        f"/api/cedar/email/accounts/{account}/customer-binding",
        headers=headers,
        json={"address": "customer@example.invalid", "customer_id": "customer-1"},
    )
    customers = client.post(
        f"/api/cedar/email/accounts/{account}/sync", headers=headers, json={"scope": "customers"}
    ).json()
    assert customers["messages"][0]["attachments"][0]["name"] == "SYNTHETIC-private.pdf"
    search = client.post(
        f"/api/cedar/email/accounts/{account}/sync", headers=headers, json={"query": "pedido"}
    ).json()
    assert search["messages"][0]["attachments"][0]["name"] == "SYNTHETIC-private.pdf"
    client.post(f"/api/cedar/email/accounts/{account}/sync", headers=headers, json={"scope": "all"})
    lists = [params for method, path, params in state["calls"] if path.endswith("/emails")]
    assert [p.get("meta_only") for p in lists] == [None, None, None, "true"]
    assert [p.get("from") for p in lists[:2]] == ["customer@example.invalid", None]
    assert lists[2]["q"] == "pedido"


def test_rows_the_mailbox_lists_without_content_are_counted_and_skipped(runtime):
    client, headers, _, state, _ = runtime
    account = connect(runtime)
    page = client.post(
        f"/api/cedar/email/accounts/{account}/sync", headers=headers, json={"scope": "all"}
    ).json()
    assert [m["subject"] for m in page["messages"]] == ["SYNTHETIC private invoice subject"]
    assert page["unnamed"] == 1
    search = client.post(
        f"/api/cedar/email/accounts/{account}/sync", headers=headers, json={"query": "pedido"}
    ).json()
    assert len(search["messages"]) == 1 and search["unnamed"] == 1
    source = page["messages"][0]["source_ref"]
    blank = {"object": "Email", "id": "", "subject": "", "body": "", "date": "", "attachments": []}
    state["thread_messages"] = [state["message"], blank]
    thread = client.get(f"/api/cedar/email/sources/{source}/thread", headers=headers).json()
    assert [m["source_ref"] for m in thread["messages"]] == [source]


def test_two_same_named_files_in_one_message_stay_two_files(runtime):
    client, headers, _, state, _ = runtime
    account = connect(runtime)
    page = client.post(
        f"/api/cedar/email/accounts/{account}/sync", headers=headers, json={"scope": "all"}
    ).json()
    message = page["messages"][0]
    refs = [a["attachment_ref"] for a in message["attachments"]]
    assert len(refs) == 2 and refs[0] != refs[1]
    base = f"/api/cedar/email/sources/{message['source_ref']}/attachments/"
    first = client.get(base + refs[0], headers=headers)
    second = client.get(base + refs[1], headers=headers)
    assert first.content == b"%PDF-1.4 SYNTHETIC attachment"
    assert second.content == b"%PDF-1.4 SYNTHETIC second file"


def test_reply_key_is_reserved_before_the_send_and_a_forwarding_mailbox_is_refused(runtime):
    client, headers, _, state, path = runtime
    account = connect(runtime)
    client.post(
        f"/api/cedar/email/accounts/{account}/customer-binding",
        headers=headers,
        json={"address": "customer@example.invalid", "customer_id": "customer-1"},
    )
    synced = client.post(f"/api/cedar/email/accounts/{account}/sync", headers=headers, json={}).json()
    source = synced["messages"][0]["source_ref"]
    route = f"/api/cedar/email/sources/{source}/reply"
    db = sqlite3.connect(path / "cedar-email.sqlite")
    workspace = db.execute("SELECT workspace FROM email_accounts WHERE ref=?", (account,)).fetchone()[0]
    # Another request holds the key: the answer says the reply is on its way, and nothing is sent.
    db.execute(
        "INSERT INTO email_sends VALUES(?,?,?,?,?,?)",
        ("sent_pending", workspace, source, "shared-key", "", "2026-09-14T00:00:00+00:00"),
    )
    db.commit()
    held = client.post(route, headers=headers, json={"text": "Recibido.", "idempotency_key": "shared-key"})
    assert held.status_code == 409 and "sent" not in state
    db.execute("UPDATE email_sends SET provider_id='provider-sent' WHERE receipt_ref='sent_pending'")
    db.commit()
    done = client.post(route, headers=headers, json={"text": "Recibido.", "idempotency_key": "shared-key"})
    assert done.json() == {"accepted": True, "receipt_ref": "sent_pending", "repeated": True}
    assert "sent" not in state
    # A forwarding mailbox is Rocoto's, so a reply from it is refused before any send.
    db.execute("UPDATE email_accounts SET mode='forwarded' WHERE ref=?", (account,))
    db.commit()
    refused = client.post(route, headers=headers, json={"text": "Recibido.", "idempotency_key": "other-key"})
    assert refused.status_code == 403 and "sent" not in state
    db.execute("UPDATE email_accounts SET mode='connected' WHERE ref=?", (account,))
    db.commit()
    sent = client.post(route, headers=headers, json={"text": "Recibido.", "idempotency_key": "other-key"})
    assert sent.json()["accepted"] is True
    assert state["sent"]["to"] == [{"email": "customer@example.invalid"}]
    # Disconnect forgets the receipts with the sources.
    assert client.delete(f"/api/cedar/email/accounts/{account}", headers=headers).status_code == 200
    assert db.execute("SELECT count(*) FROM email_sends").fetchone()[0] == 0


def test_filtered_pull_accepts_the_owner_in_cc_and_skips_a_gone_workspace(runtime, monkeypatch):
    import asyncio

    client, headers, _, state, path = runtime
    account = connect(runtime)
    client.post(
        f"/api/cedar/email/accounts/{account}/customer-binding",
        headers=headers,
        json={"address": "customer@example.invalid", "customer_id": "customer-1"},
    )
    db = sqlite3.connect(path / "cedar-email.sqlite")
    db.execute("UPDATE email_accounts SET live_since='2025-01-01T00:00:00+00:00' WHERE ref=?", (account,))
    db.commit()
    state["message"]["to"] = [{"email": "alias@example.invalid"}]
    state["message"]["cc"] = [{"email": "seller@example.invalid"}]
    first = asyncio.run(cedar_email.pull_arrivals())
    assert first["queued"] == 1
    workspace = db.execute("SELECT workspace FROM email_accounts WHERE ref=?", (account,)).fetchone()[0]
    access = sqlite3.connect(path / "cedar-access.sqlite")
    access.execute("UPDATE workspaces SET revoked=1 WHERE id=?", (workspace,))
    access.commit()
    state["message"]["id"] = "provider-message-later"
    again = asyncio.run(cedar_email.pull_arrivals())
    assert again["queued"] == 0


def test_only_a_customers_own_message_is_replyable_and_a_blank_reply_is_refused(runtime):
    client, headers, _, state, _ = runtime
    account = connect(runtime)
    unknown = client.post(
        f"/api/cedar/email/accounts/{account}/sync", headers=headers, json={"scope": "all"}
    ).json()["messages"][0]
    assert unknown["replyable"] is False
    client.post(
        f"/api/cedar/email/accounts/{account}/customer-binding",
        headers=headers,
        json={"address": "customer@example.invalid", "customer_id": "customer-1"},
    )
    incoming = client.post(f"/api/cedar/email/accounts/{account}/sync", headers=headers, json={}).json()
    assert incoming["messages"][0]["replyable"] is True
    # The mailbox's own mail to the customer is listed with the customer, and is read, not answered.
    state["message"]["from"], state["message"]["to"] = (
        [{"email": "seller@example.invalid"}], [{"email": "customer@example.invalid"}]
    )
    state["message"]["id"] = "provider-message-sent"
    outgoing = client.post(f"/api/cedar/email/accounts/{account}/sync", headers=headers, json={}).json()
    assert outgoing["messages"][0]["customerId"] == "customer-1"
    assert outgoing["messages"][0]["replyable"] is False
    source = incoming["messages"][0]["source_ref"]
    body = {"text": "   ", "idempotency_key": "k"}
    blank = client.post(f"/api/cedar/email/sources/{source}/reply", headers=headers, json=body)
    assert blank.status_code == 422 and "sent" not in state


def test_composed_mail_leaves_the_connected_mailbox_with_its_files_once(runtime):
    client, headers, _, state, path = runtime
    account = connect(runtime)
    route = f"/api/cedar/email/accounts/{account}/send"
    pdf = b"%PDF-1.4 SYNTHETIC composed file"
    mail = {
        "to": ["Anyone@Example.invalid", "second@example.invalid"],
        "cc": ["copy@example.invalid"],
        "subject": " Pedido de prueba ",
        "text": "Hola, adjunto el pedido.",
        "idempotency_key": "compose-1",
        "attachments": [
            {"name": "pedido.pdf", "content_type": "application/pdf", "data": base64.b64encode(pdf).decode()}
        ],
    }
    first = client.post(route, headers=headers, json=mail)
    assert first.status_code == 200, first.text
    receipt = first.json()
    assert receipt["accepted"] is True and receipt["recipients"] == 3 and receipt["files"] == 1
    sent = state["sent"]
    assert sent["to"] == [{"email": "anyone@example.invalid"}, {"email": "second@example.invalid"}]
    assert sent["cc"] == [{"email": "copy@example.invalid"}]
    assert sent["subject"] == "Pedido de prueba" and sent["plain_text"] == "Hola, adjunto el pedido."
    content = mail["attachments"][0]["data"]
    expected_file = {"filename": "pedido.pdf", "content_type": "application/pdf", "content": content}
    assert sent["attachments"] == [expected_file]
    assert "reply_to_message_id" not in sent
    sends = len([call for call in state["calls"] if call[1].endswith("/emails/send")])
    again = client.post(route, headers=headers, json=mail).json()
    assert again == {"accepted": True, "receipt_ref": receipt["receipt_ref"], "repeated": True}
    assert len([c for c in state["calls"] if c[1].endswith("/emails/send")]) == sends
    wrong = {**mail, "to": ["nobody"], "idempotency_key": "compose-2"}
    bad = client.post(route, headers=headers, json=wrong)
    assert bad.status_code == 422
    db = sqlite3.connect(path / "cedar-email.sqlite")
    db.execute("UPDATE email_accounts SET mode='forwarded' WHERE ref=?", (account,))
    db.commit()
    refused = client.post(route, headers=headers, json={**mail, "idempotency_key": "compose-3"})
    assert refused.status_code == 403
    assert b"Hola, adjunto" not in (path / "cedar-email.sqlite").read_bytes()


def test_thread_carries_the_message_as_written_minus_what_could_run(runtime):
    client, headers, _, state, _ = runtime
    account = connect(runtime)
    state["message"]["body"] = (
        '<div style="color:red"><p>Hola <b>Pedro</b></p><script>steal()</script>'
        '<img src="https://x.invalid/pixel.png" onerror="steal()"><a href="javascript:steal()">link</a>'
        '<iframe src="https://x.invalid"></iframe><style>p{margin:0}</style></div>'
    )
    state["message"]["snippet"] = "Hola Pedro"
    state["message"]["is_unread"] = True
    page = client.post(
        f"/api/cedar/email/accounts/{account}/sync", headers=headers, json={"scope": "all"}
    ).json()
    listed = page["messages"][0]
    assert listed["snippet"] == "Hola Pedro" and listed["unread"] is True
    assert listed["html"] == ""
    thread = client.get(f"/api/cedar/email/sources/{listed['source_ref']}/thread", headers=headers).json()
    html = thread["messages"][0]["html"]
    assert "<b>Pedro</b>" in html and "<style>" in html and 'style="color:red"' in html
    for gone in ("<script", "steal()", "onerror", "<iframe", "javascript:"):
        assert gone not in html
    assert 'href="#' in html
    assert "Hola Pedro" in thread["messages"][0]["body"]


def test_rich_text_travels_to_the_provider_as_html_and_text(runtime):
    client, headers, _, state, _ = runtime
    account = connect(runtime)
    mail = {
        "to": ["someone@example.invalid"], "subject": "Rich", "text": "Hola Pedro",
        "idempotency_key": "rich-1",
        "html": "<p>Hola <b>Pedro</b></p><script>x()</script>",
    }
    route = f"/api/cedar/email/accounts/{account}/send"
    assert client.post(route, headers=headers, json=mail).status_code == 200
    assert state["sent"]["html"] == "<p>Hola <b>Pedro</b></p>"
    assert state["sent"]["plain_text"] == "Hola Pedro"


def test_a_composed_reply_threads_under_the_message_it_answers(runtime):
    client, headers, other, state, _ = runtime
    account = connect(runtime)
    source = client.post(
        f"/api/cedar/email/accounts/{account}/sync", headers=headers, json={"scope": "all"}
    ).json()["messages"][0]["source_ref"]
    route = f"/api/cedar/email/accounts/{account}/send"
    mail = {"to": ["customer@example.invalid"], "subject": "Re: SYNTHETIC", "text": "Recibido.",
            "idempotency_key": "thread-1", "in_reply_to": source}
    assert client.post(route, headers=headers, json=mail).status_code == 200
    assert state["sent"]["reply_to_message_id"] == "provider-message"
    elsewhere = client.post(route, headers=other, json={**mail, "idempotency_key": "thread-2"})
    assert elsewhere.status_code == 404
