"""Synthetic contract replays; these tests never connect to Meta or prove real history import."""

import hashlib
import hmac
import json
import os
import shutil
import subprocess
import sys
import time
from dataclasses import replace
from pathlib import Path
from uuid import uuid4

import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
from service import COEXISTENCE, COOKIE, Config, GraphError, create_app
from storage import Store


@pytest.fixture
def config(tmp_path):
    return Config(
        app_id="123",
        app_secret="app-secret-for-synthetic-tests",
        config_id="456",
        graph_version="v26.0",
        public_origin="https://cedar.example.test",
        verify_token="synthetic-verification-token",
        encryption_key=Fernet.generate_key().decode(),
        state_dir=str(tmp_path / "private"),
    )


def bind(store):
    store.bind(
        {
            "wabaId": "101",
            "phoneId": "202",
            "number": "15550000001",
            "name": "Synthetic business",
            "coexistence": True,
            "workspace": "fish",
        },
        "synthetic-meta-token",
        True,
    )


def bind_phone(store, phone):
    store.bind(
        {
            "wabaId": "101",
            "phoneId": phone,
            "number": "15550000" + phone,
            "name": "Synthetic business",
            "coexistence": True,
            "workspace": "fish",
        },
        "synthetic-meta-token-" + phone,
        True,
    )


def envelope(field, value, phone="202", waba="101"):
    return {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "id": waba,
                "changes": [{"field": field, "value": {"metadata": {"phone_number_id": phone}, **value}}],
            }
        ],
    }


def message(wamid, text="Synthetic private message", timestamp="1700000000", **extra):
    return {
        "id": wamid,
        "from": "15550000002",
        "timestamp": timestamp,
        "type": "text",
        "text": {"body": text},
        **extra,
    }


def history(messages, progress=20, chunk=1):
    return envelope(
        "history",
        {
            "history": [
                {
                    "metadata": {"phase": 1, "chunk_order": chunk, "progress": progress},
                    "threads": [{"id": "15550000002", "messages": messages}],
                }
            ]
        },
    )


def replay(store, payload):
    store.capture(json.dumps(payload).encode())
    store.drain()


def test_dedupe_shuffled_progress_and_encrypted_storage(config):
    store = Store(config)
    bind(store)
    replay(store, history([message("wamid-one")], 100, 3))
    replay(store, history([message("wamid-two", timestamp="1690000000")], 35, 1))
    replay(store, history([message("wamid-one")], 70, 2))
    replay(store, envelope("messages", {"messages": [message("wamid-one")]}))
    assert store.history()["progress"] == 100
    assert store.history()["status"] == "complete"
    assert store.history()["messages"] == 2
    assert store.history()["oldestAt"] < store.history()["newestAt"]
    assert b"Synthetic private message" not in store.path.read_bytes()
    assert b"synthetic-meta-token" not in store.path.read_bytes()
    assert store.path.stat().st_mode & 0o777 == 0o600
    assert store.path.parent.stat().st_mode & 0o777 == 0o700


def test_intake_excludes_history_outbound_and_prebind_messages(config, monkeypatch):
    monkeypatch.setattr(time, "time", lambda: 1_700_000_000)
    store = Store(config)
    bind(store)
    replay(store, history([message("historical", timestamp="1700000010")], 100))
    replay(store, envelope("messages", {"messages": [
        message("old-live", timestamp="1699999999"),
        message("fresh-live", "12 kg merluza", timestamp="1700000011"),
        message(
            "outbound", "We have it", timestamp="1700000012",
            **{"from": "15550000001", "to": "15550000002"},
        ),
    ]}))

    first = store.intake(None, 50)
    assert [(row["id"], row["text"], row["historical"]) for row in first["messages"]] == [
        ("fresh-live", "12 kg merluza", False)
    ]
    assert first["workspace"] == "fish"
    assert first["nextCursor"]
    assert store.intake(first["nextCursor"], 50)["messages"] == []
    with pytest.raises(ValueError):
        store.intake(store.seal({"kind": "messages"}).decode(), 50)


def test_intake_arrival_cursor_keeps_late_provider_timestamp(config, monkeypatch):
    monkeypatch.setattr(time, "time", lambda: 1_700_000_000)
    store = Store(config)
    bind(store)
    replay(store, envelope("messages", {"messages": [
        message("first-arrival", "4 kg bonito", timestamp="1700000100"),
    ]}))
    first = store.intake(None, 50)
    assert [row["id"] for row in first["messages"]] == ["first-arrival"]

    replay(store, envelope("messages", {"messages": [
        message("late-arrival", "2 kg corvina", timestamp="1700000050"),
    ]}))
    second = store.intake(first["nextCursor"], 50)
    assert [row["id"] for row in second["messages"]] == ["late-arrival"]


def test_intake_cursor_is_bound_to_exact_provider_identity(config, monkeypatch):
    monkeypatch.setattr(time, "time", lambda: 1_700_000_000)
    first = Store(config)
    bind(first)
    replay(first, envelope("messages", {"messages": [message("first", timestamp="1700000001")]}))
    cursor = first.intake(None, 50)["nextCursor"]

    second_config = replace(config, state_dir=str(Path(config.state_dir).parent / "other-private"))
    second = Store(second_config)
    second.bind(
        {
            "wabaId": "303", "phoneId": "404", "number": "15550000003",
            "name": "Other business", "coexistence": True, "workspace": "fish",
        },
        "other-token",
        False,
    )
    with pytest.raises(ValueError, match="Valid intake cursor required"):
        second.intake(cursor, 50)


def test_workspace_binding_is_exact_and_fill_once(config):
    store = Store(config)
    bind(store)
    connected_at = store.get("connection")["connectedAt"]
    assert store.connection()["workspace"] == "fish"
    store.bind_workspace("fish")
    store.bind(
        {
            "wabaId": "101",
            "phoneId": "202",
            "number": "15550000001",
            "name": "Reauthorized business",
            "coexistence": True,
        },
        "replacement-token",
        False,
    )
    assert store.connection()["workspace"] == "fish"
    assert store.get("connection")["connectedAt"] == connected_at
    with pytest.raises(ValueError):
        store.bind_workspace("meat")
    configured = replace(config, workspace_bindings='{"101:202":"fish","101:999":"meat"}')
    assert configured.workspace_for("101", "202") == "fish"
    assert configured.workspace_for("101", "203") == ""


def test_private_sender_binding_requires_exact_provider_and_workspace(config, monkeypatch):
    monkeypatch.setattr(time, "time", lambda: 1_700_000_000)
    configured = replace(
        config,
        sender_bindings=json.dumps({
            "101:202:15550000002": {"workspace": "fish", "customerId": "customer-one"},
        }),
    )
    assert configured.customer_for("101", "202", "+1 (555) 000-0002", "fish") == "customer-one"
    assert configured.customer_for("101", "999", "15550000002", "fish") == ""
    assert configured.customer_for("101", "202", "15550000002", "meat") == ""
    store = Store(configured)
    bind(store)
    replay(store, envelope("messages", {"messages": [
        message("bound-sender", "12 kg merluza", timestamp="1700000001"),
    ]}))
    row = store.intake(None, 50)["messages"][0]
    assert row["customerId"] == "customer-one"


def test_existing_account_receives_configured_workspace_once_at_boot(config):
    store = Store(config)
    store.bind(
        {
            "wabaId": "101",
            "phoneId": "202",
            "number": "15550000001",
            "name": "Existing business",
            "coexistence": True,
        },
        "synthetic-meta-token",
        True,
    )
    assert "workspace" not in store.connection()

    configured = replace(config, workspace_bindings='{"101:202":"fish"}')
    create_app(configured)
    assert Store(configured).connection()["workspace"] == "fish"

    create_app(replace(configured, workspace_bindings='{"101:202":"meat"}'))
    assert Store(configured).connection()["workspace"] == "fish"


def test_media_enrichment_preserves_thread_time_direction_both_orders(config):
    for suffix, reverse in (("a", False), ("b", True)):
        store = Store(replace(config, state_dir=config.state_dir + suffix))
        bind(store)
        placeholder = history(
            [message("media", type="media_placeholder", text={}, **{"from": "15550000001"})]
        )
        asset = envelope(
            "history",
            {
                "messages": [
                    message(
                        "media",
                        type="document",
                        text={},
                        timestamp="1699999990",
                        document={"id": "asset-1", "filename": "price.pdf"},
                    )
                ]
            },
        )
        for event in [asset, placeholder] if reverse else [placeholder, asset]:
            replay(store, event)
        conversation = store.conversations()[0]
        rows = store.messages(conversation["id"], None, 100)["messages"]
        assert len(rows) == 1
        assert rows[0]["direction"] == "outbound"
        assert rows[0]["kind"] == "document"
        assert rows[0]["text"] == "price.pdf"
        assert rows[0]["historical"] is True
        assert rows[0]["mediaAvailable"] is False


def test_declined_and_interrupted_are_durable(config):
    store = Store(config)
    bind(store)
    replay(store, envelope("history", {"history": [{"errors": [{"code": 2593109}]}]}))
    assert Store(config).history()["status"] == "declined"
    replay(store, history([message("late")], 10))
    assert store.history()["status"] == "declined"


def test_foreign_binding_refused_before_storage(config):
    store = Store(config)
    bind(store)
    with pytest.raises(ValueError):
        store.capture(json.dumps(envelope("messages", {"messages": [message("x")]}, phone="999")).encode())
    assert store.history()["messages"] == 0


def test_one_shot_claim_survives_restart(config):
    store = Store(config)
    bind(store)
    assert store.claim("history") is True
    assert Store(config).claim("history") is False


def test_login_origin_hmac_and_unconfigured_state(config):
    app = create_app(config)
    with TestClient(app, base_url=config.public_origin) as client:
        assert client.get("/api/proof/state").status_code == 401
        assert client.post("/api/proof/session", json={}).status_code == 403
        assert (
            client.post(
                "/api/proof/session",
                headers={"Origin": config.public_origin},
                json={},
            ).status_code
            == 200
        )
        assert client.cookies.get(COOKIE)
        assert client.get("/api/proof/state").json()["ready"] is True
        bind(app.state.store)
        raw = json.dumps(history([message("signed")])).encode()
        assert client.post("/webhooks/whatsapp", content=raw).status_code == 403
        signature = "sha256=" + hmac.new(config.app_secret.encode(), raw, hashlib.sha256).hexdigest()
        assert (
            client.post(
                "/webhooks/whatsapp", content=raw, headers={"X-Hub-Signature-256": signature}
            ).status_code
            == 200
        )
    missing = replace(config, app_secret="", state_dir=config.state_dir + "missing")
    with TestClient(create_app(missing), base_url=config.public_origin) as client:
        client.post(
            "/api/proof/session",
            headers={"Origin": config.public_origin},
            json={},
        )
        state = client.get("/api/proof/state").json()
        assert state["ready"] is False
        assert "CEDAR_PROOF_APP_SECRET" in state["blockers"]


def test_same_waba_webhook_routes_each_phone_to_its_exact_store(config):
    app = create_app(config, SyntheticGraph(config))
    bind(app.state.store)
    second = app.state.registry.for_account("101", "303")
    bind_phone(second, "303")
    payload = envelope("messages", {"messages": [message("first-phone")]})
    payload["entry"][0]["changes"].extend(
        envelope(
            "messages", {"messages": [message("second-phone", "Second private phone")]},
            phone="303",
        )["entry"][0]["changes"]
    )
    raw = json.dumps(payload).encode()
    signature = "sha256=" + hmac.new(config.app_secret.encode(), raw, hashlib.sha256).hexdigest()
    with TestClient(app, base_url=config.public_origin) as client:
        assert client.post(
            "/webhooks/whatsapp", content=raw,
            headers={"X-Hub-Signature-256": signature},
        ).status_code == 200
    app.state.store.drain()
    second.drain()
    assert app.state.store.history()["messages"] == 1
    assert second.history()["messages"] == 1
    assert "Second private phone" not in json.dumps(app.state.store.conversations())


def test_disconnecting_one_waba_phone_keeps_sibling_subscription(config):
    graph = SyntheticGraph(config)
    app = create_app(config, graph)
    bind(app.state.store)
    second = app.state.registry.for_account("101", "303")
    bind_phone(second, "303")
    with TestClient(app, base_url=config.public_origin) as client:
        client.headers["Origin"] = config.public_origin
        assert client.post("/api/proof/session", json={}).status_code == 200
        cookie = app.state.registry.grant(client.cookies.get(COOKIE), app.state.store)
        client.cookies.set(COOKIE, cookie)
        assert client.post("/api/proof/whatsapp/disconnect", json={}).status_code == 200
    assert not app.state.store.authorized()
    assert second.authorized()
    assert all(call[0] != "DELETE" for call in graph.calls)


def test_contacts_echoes_stable_pagination_and_capture_restart(config):
    store = Store(config)
    bind(store)
    store.capture(json.dumps(history([message("first"), message("second")])).encode())
    assert store.history()["messages"] == 0  # Capture committed before asynchronous projection.
    store = Store(config)
    store.drain()
    replay(
        store,
        envelope(
            "smb_message_echoes",
            {
                "message_echoes": [
                    message(
                        "owner",
                        "Owner's synthetic reply",
                        "1700000001",
                        **{"from": "15550000001", "to": "15550000002"},
                    )
                ]
            },
        ),
    )
    for timestamp, name in (("1700000010", "Current contact"), ("1699999990", "Older contact")):
        replay(
            store,
            envelope(
                "smb_app_state_sync",
                {
                    "state_sync": [
                        {
                            "type": "contact",
                            "action": "add",
                            "contact": {"phone_number": "15550000002", "full_name": name},
                            "metadata": {"timestamp": timestamp},
                        }
                    ]
                },
            ),
        )
    conversation = store.conversations()[0]
    assert conversation["name"] == "Current contact"
    assert conversation["count"] == 3
    first = store.messages(conversation["id"], None, 1)
    assert first["messages"][0]["direction"] == "outbound"
    assert first["messages"][0]["historical"] is False
    second = store.messages(conversation["id"], first["nextCursor"], 1)
    third = store.messages(conversation["id"], second["nextCursor"], 1)
    assert len({page["messages"][0]["id"] for page in [first, second, third]}) == 3
    assert third["nextCursor"] is None
    with pytest.raises(ValueError):
        store.messages("another-conversation", first["nextCursor"], 1)


def test_malformed_projection_retained_and_interrupted(config):
    store = Store(config)
    bind(store)
    replay(store, history([{"type": "text", "text": {"body": "Malformed synthetic record"}}]))
    assert store.history()["status"] == "interrupted"
    with store.db() as con:
        row = con.execute("SELECT processed,error,body FROM inbox").fetchone()
        assert row["processed"] == 0
        assert row["error"] == "ValueError"
        assert "Malformed synthetic record" in json.dumps(store.unseal(row["body"]))


def test_late_failed_projection_overrides_provider_completion(config):
    store = Store(config)
    bind(store)
    replay(store, history([message("last-provider-chunk")], progress=100, chunk=3))
    assert store.history()["status"] == "complete"
    replay(
        store, history([{"type": "text", "text": {"body": "Late malformed record"}}], progress=50, chunk=2)
    )
    result = store.history()
    assert result["progress"] == 100  # Preserve the provider's observed progress separately.
    assert result["status"] == "interrupted"  # A durable chunk still needs local projection.
    assert result["messages"] == 1


def test_provider_complete_waits_for_already_captured_late_chunk(config):
    store = Store(config)
    bind(store)
    replay(store, history([message("newest")], progress=100, chunk=2))
    store.capture(json.dumps(history([message("older")], progress=50, chunk=1)).encode())
    assert store.history()["status"] == "syncing"
    store.drain()
    assert store.history()["status"] == "complete"
    assert store.history()["messages"] == 2


class SyntheticGraph:
    """In-process provider contract double. Every mutation is recorded; all payloads are synthetic."""

    def __init__(
        self,
        config,
        *,
        existing=False,
        coexistence=True,
        fail_history=False,
        application_callback=None,
        drift_after_override=False,
    ):
        self.config, self.calls = config, []
        self.existing, self.coexistence, self.fail_history = existing, coexistence, fail_history
        self.callback = ""
        self.waba_callback = ""
        self.subscription_override = ""
        self.numbers = [{"id": "202", "display_phone_number": "15550000001"}]
        self.other_apps = []
        self.subscription_error = None
        self.fresh_subscription_error = None
        self.after_subscription = None
        self.application_callback = (
            application_callback
            if application_callback is not None
            else "https://existing.example.test/webhooks"
        )
        self.drift_after_override = drift_after_override

    async def exchange(self, code):
        self.calls.append(("exchange",))
        return "synthetic-token"

    async def collection(self, path, token, fields=None):
        self.calls.append(("GET", path))
        if path.endswith("phone_numbers"):
            return self.numbers
        if path.endswith("subscribed_apps"):
            if self.fresh_subscription_error:
                raise GraphError(self.fresh_subscription_error)
            own = [{
                "whatsapp_business_api_data": {"id": self.config.app_id},
                "override_callback_uri": self.subscription_override,
            }] if self.existing else []
            return own + self.other_apps
        raise AssertionError(path)

    async def request(self, method, path, token="", params=None, body=None):
        self.calls.append((method, path, body))
        if method == "DELETE" and path == "101/subscribed_apps":
            self.existing = False
            self.subscription_override = ""
            self.waba_callback = ""
            return {"success": True}
        if method == "GET" and path == "101":
            return {"id": "101", "name": "Synthetic business"}
        if method == "GET" and path == "202":
            return {
                "id": "202",
                "is_on_biz_app": self.coexistence,
                "platform_type": "CLOUD_API",
                "webhook_configuration": {
                    "phone_number": self.callback,
                    "whatsapp_business_account": self.waba_callback,
                    "application": self.application_callback,
                },
            }
        if method == "POST" and path == "101/subscribed_apps":
            if self.subscription_error == "100":
                raise GraphError("100")
            self.existing = True
            self.subscription_override = (body or {}).get("override_callback_uri", "")
            self.waba_callback = self.subscription_override
            if self.drift_after_override:
                self.application_callback = "https://changed.example.test/webhooks"
            if self.after_subscription:
                self.after_subscription()
            if self.subscription_error:
                raise GraphError(self.subscription_error)
            return {"success": True}
        if method == "POST" and path == "202":
            self.callback = body["webhook_configuration"]["override_callback_uri"]
            if self.drift_after_override:
                self.application_callback = "https://existing.example.test/webhooks"
            return {"success": True}
        if method == "POST" and path == "202/smb_app_data":
            if self.fail_history and body["sync_type"] == "history":
                raise GraphError("transport")
            return {"request_id": "synthetic-sync-request"}
        raise AssertionError((method, path))


def authorize(client, config):
    client.headers["Origin"] = config.public_origin
    assert client.post("/api/proof/session", json={}).status_code == 200
    response = client.post("/api/proof/whatsapp/code", json={"code": "synthetic-authorization-code"})
    assert response.status_code == 200
    return {
        "authorizationId": response.json()["authorizationId"],
        "wabaId": "101",
        "event": COEXISTENCE,
        "historyRequested": True,
    }


def test_connect_mutations_exactly_once_and_no_register_or_sends(config):
    graph = SyntheticGraph(config)
    app = create_app(config, graph)
    with TestClient(app, base_url=config.public_origin) as client:
        body = authorize(client, config)
        first = client.post("/api/proof/whatsapp/connect", json=body)
        assert first.status_code == 200, first.text
        assert first.json()["connection"]["coexistence"] is True
        assert first.json()["setup"]["status"] == "ready"
        assert client.post("/api/proof/whatsapp/connect", json=body).status_code == 200
        posts = [call for call in graph.calls if call[0] == "POST"]
        assert len(posts) == 3
        assert [call[1] for call in posts] == [
            "101/subscribed_apps",
            "202/smb_app_data",
            "202/smb_app_data",
        ]
        assert posts[0][2] == {
            "override_callback_uri": config.callback,
            "verify_token": config.verify_token,
        }
        assert graph.application_callback == "https://existing.example.test/webhooks"
        assert app.state.store.get("routing-audit")["accountUpdates"] == "existing-application-default"
        assert app.state.store.operation("history")["requestId"] == "synthetic-sync-request"
        assert app.state.store.history()["messages"] == 0
        assert app.state.store.history()["status"] == "waiting"


def test_disconnect_revokes_ingress_and_reconnect_preserves_scope_with_new_cursor_epoch(
    config, monkeypatch
):
    clock = [1_700_000_000.0]
    monkeypatch.setattr("storage.time.time", lambda: clock[0])
    monkeypatch.setattr("service.time.time", lambda: clock[0])
    graph = SyntheticGraph(config)
    app = create_app(config, graph)
    with TestClient(app, base_url=config.public_origin) as client:
        body = authorize(client, config)
        assert client.post("/api/proof/whatsapp/connect", json=body).status_code == 200
        app.state.store.bind_workspace("fish")
        replay(app.state.store, envelope("messages", {"messages": [
            message("before-disconnect", timestamp="1700000001"),
        ]}))
        cursor = app.state.store.intake(None, 50)["nextCursor"]
        response = client.post("/api/proof/whatsapp/disconnect", json={})
        assert response.status_code == 200
        assert response.json()["connection"] is None
        assert client.cookies.get(COOKIE) is None
        retained = Store(config)
        assert retained.connection()["workspace"] == "fish"
        assert retained.get("token") is None
        assert retained.intake(None, 50)["messages"] == []
        with pytest.raises(ValueError, match="binding"):
            retained.capture(
                json.dumps(envelope("messages", {"messages": [message("gap")]})).encode()
            )

        clock[0] += 25 * 60 * 60
        body = authorize(client, config)
        assert client.post("/api/proof/whatsapp/connect", json=body).status_code == 200
        assert client.get("/api/proof/state").json()["connection"]["workspace"] == "fish"
    with pytest.raises(ValueError, match="Valid intake cursor"):
        retained.intake(cursor, 50)
    replay(retained, envelope("messages", {"messages": [
        message("late-gap-timestamp", timestamp="1700000050"),
        message("after-reconnect", timestamp=str(int(clock[0] + 1))),
    ]}))
    assert [row["id"] for row in retained.intake(None, 50)["messages"]] == ["after-reconnect"]


def test_fresh_connection_check_revokes_a_provider_removed_subscription(config):
    graph = SyntheticGraph(config)
    app = create_app(config, graph)
    with TestClient(app, base_url=config.public_origin) as client:
        body = authorize(client, config)
        assert client.post("/api/proof/whatsapp/connect", json=body).status_code == 200
        current = client.post("/api/proof/whatsapp/verify", json={})
        assert current.status_code == 200
        assert current.json()["connection"]["phoneId"] == "202"

        # The provider removed the subscription outside Rocoto. Its locally held token must not
        # keep this browser authorized when fresh provider state no longer names this application.
        graph.existing = False
        stale = client.post("/api/proof/whatsapp/verify", json={})
        assert stale.status_code == 409
        assert stale.json() == {"connection": None}
        assert client.cookies.get(COOKIE) is None
        assert client.get("/api/proof/state").status_code == 401
        retained = Store(config)
        assert retained.connection() is not None
        assert retained.get("token") is None


def test_fresh_connection_check_revokes_known_provider_inaccessible_binding(config):
    graph = SyntheticGraph(config)
    app = create_app(config, graph)
    with TestClient(app, base_url=config.public_origin) as client:
        body = authorize(client, config)
        assert client.post("/api/proof/whatsapp/connect", json=body).status_code == 200
        graph.fresh_subscription_error = "100"
        refused = client.post("/api/proof/whatsapp/verify", json={})
        assert refused.status_code == 409
        assert refused.json() == {"connection": None}
        assert client.get("/api/proof/state").status_code == 401


def test_signed_offboarded_lifecycle_suspends_connection_until_reconnected(config):
    graph = SyntheticGraph(config)
    app = create_app(config, graph)
    with TestClient(app, base_url=config.public_origin) as client:
        body = authorize(client, config)
        assert client.post("/api/proof/whatsapp/connect", json=body).status_code == 200
        payload = {
            "object": "whatsapp_business_account",
            "entry": [{
                "id": "101",
                "time": int(app.state.store.get("connection")["authorizedAt"]),
                "changes": [{"field": "account_update", "value": {"event": "ACCOUNT_OFFBOARDED"}}],
            }],
        }
        raw = json.dumps(payload).encode()
        signature = "sha256=" + hmac.new(config.app_secret.encode(), raw, hashlib.sha256).hexdigest()
        delivered = client.post(
            "/webhooks/whatsapp", content=raw, headers={"X-Hub-Signature-256": signature}
        )
        assert delivered.status_code == 200
        before_verify = list(graph.calls)
        assert client.get("/api/proof/state").status_code == 401
        assert client.post("/api/proof/whatsapp/verify", json={}).status_code == 401
        assert graph.calls == before_verify  # Graph remains reachable but cannot restore an offboarded proof.
        retained = Store(config)
        assert retained.connection() is not None
        assert retained.get("token") == "synthetic-token"
        assert retained.get("connection")["active"] is False

        fresh = authorize(client, config)
        blocked = client.post("/api/proof/whatsapp/connect", json=fresh)
        assert blocked.status_code == 409
        assert retained.authorized() is False

        payload["entry"][0]["changes"][0]["value"]["event"] = "ACCOUNT_RECONNECTED"
        payload["entry"][0]["time"] += 1
        raw = json.dumps(payload).encode()
        signature = "sha256=" + hmac.new(config.app_secret.encode(), raw, hashlib.sha256).hexdigest()
        delivered = client.post(
            "/webhooks/whatsapp", content=raw, headers={"X-Hub-Signature-256": signature}
        )
        assert delivered.status_code == 200
        assert retained.authorized() is False
        renewed = authorize(client, config)
        assert client.post("/api/proof/whatsapp/connect", json=renewed).status_code == 200
        assert retained.authorized() is True


def test_signed_terminal_lifecycle_discards_only_matching_provider_authority(config):
    graph = SyntheticGraph(config)
    app = create_app(config, graph)
    with TestClient(app, base_url=config.public_origin) as client:
        body = authorize(client, config)
        assert client.post("/api/proof/whatsapp/connect", json=body).status_code == 200
        payload = {
            "object": "whatsapp_business_account",
            "entry": [{
                "id": "101",
                "time": int(app.state.store.get("connection")["authorizedAt"]),
                "changes": [{"field": "account_update", "value": {
                    "event": "PARTNER_APP_UNINSTALLED",
                    "waba_info": {"partner_app_id": "someone-else"},
                }}],
            }],
        }

        def deliver():
            raw = json.dumps(payload).encode()
            signature = "sha256=" + hmac.new(config.app_secret.encode(), raw, hashlib.sha256).hexdigest()
            return client.post("/webhooks/whatsapp", content=raw, headers={"X-Hub-Signature-256": signature})

        assert deliver().status_code == 200
        assert app.state.store.authorized() is True
        payload["entry"][0]["changes"][0]["value"]["waba_info"]["partner_app_id"] = config.app_id
        assert deliver().status_code == 200
        assert app.state.store.authorized() is False
        assert Store(config).connection() is not None
        assert Store(config).get("token") is None
        assert client.get("/api/proof/state").status_code == 401


def test_lifecycle_replay_cannot_revoke_a_newer_authorization_epoch(config, monkeypatch):
    clock = [1_700_000_000.0]
    monkeypatch.setattr("storage.time.time", lambda: clock[0])
    store = Store(config)
    bind(store)
    assert store.apply_lifecycle("suspend", 1_700_000_001) is True
    clock[0] = 1_700_000_002.0
    store.reauthorize("new-synthetic-meta-token")
    assert store.authorized() is True
    assert store.apply_lifecycle("disconnect", 1_700_000_001) is False
    assert store.authorized() is True
    assert store.get("token") == "new-synthetic-meta-token"


@pytest.mark.parametrize(
    "events",
    [("ACCOUNT_RECONNECTED", "PARTNER_REMOVED"), ("PARTNER_REMOVED", "ACCOUNT_RECONNECTED")],
)
def test_same_time_lifecycle_terminal_wins_in_each_provider_change_order(config, events):
    graph = SyntheticGraph(config)
    app = create_app(config, graph)
    with TestClient(app, base_url=config.public_origin) as client:
        body = authorize(client, config)
        assert client.post("/api/proof/whatsapp/connect", json=body).status_code == 200
        payload = {
            "object": "whatsapp_business_account",
            "entry": [{
                "id": "101",
                "time": int(app.state.store.get("connection")["authorizedAt"]),
                "changes": [
                    {"field": "account_update", "value": {"event": event}}
                    for event in events
                ],
            }],
        }
        raw = json.dumps(payload).encode()
        signature = "sha256=" + hmac.new(config.app_secret.encode(), raw, hashlib.sha256).hexdigest()
        assert client.post(
            "/webhooks/whatsapp", content=raw, headers={"X-Hub-Signature-256": signature}
        ).status_code == 200
        assert app.state.store.authorized() is False
        assert app.state.store.get("token") is None


@pytest.mark.parametrize("existing,coexistence", [(True, True), (False, False)])
def test_existing_consumer_or_fresh_number_stops_before_mutation(config, existing, coexistence):
    graph = SyntheticGraph(config, existing=existing, coexistence=coexistence)
    with TestClient(create_app(config, graph), base_url=config.public_origin) as client:
        body = authorize(client, config)
        assert client.post("/api/proof/whatsapp/connect", json=body).status_code == 409
        assert all(call[0] != "POST" for call in graph.calls)


def test_uncertain_history_request_persisted_and_never_retried(config):
    graph = SyntheticGraph(config, fail_history=True)
    app = create_app(config, graph)
    with TestClient(app, base_url=config.public_origin) as client:
        body = authorize(client, config)
        assert client.post("/api/proof/whatsapp/connect", json=body).status_code == 502
        assert client.post("/api/proof/whatsapp/connect", json=body).status_code == 409
        assert app.state.store.history()["status"] == "interrupted"
        assert client.get("/api/proof/state").json()["setup"]["status"] == "interrupted"
        posts = [
            call
            for call in graph.calls
            if call[0] == "POST" and call[1] == "202/smb_app_data" and call[2]["sync_type"] == "history"
        ]
        assert len(posts) == 1
        assert Store(config).operation("history")["error"] == "transport"


def test_validation_redacts_credentials_and_session_owner_binding(config):
    graph = SyntheticGraph(config)
    app = create_app(config, graph)
    with TestClient(app, base_url=config.public_origin) as client:
        body = authorize(client, config)
        credential = "private-authorization-code" * 500
        response = client.post("/api/proof/whatsapp/code", json={"code": credential})
        assert response.status_code == 422
        assert credential not in response.text
        client.cookies.clear()
        client.post("/api/proof/session", json={})
        assert client.post("/api/proof/whatsapp/connect", json=body).status_code == 401
        assert all(call[0] != "POST" for call in graph.calls)


def test_expired_onboarding_blocks_both_sync_requests(config):
    graph = SyntheticGraph(config, existing=True)
    graph.subscription_override = graph.waba_callback = config.callback
    app = create_app(config, graph)
    bind(app.state.store)
    app.state.store.put("subscription-intent", {
        "appId": config.app_id, "wabaId": "101", "phoneId": "202", "callback": config.callback,
        "applicationCallback": graph.application_callback,
    })
    assert app.state.store.claim("subscription")
    app.state.store.outcome("subscription", True)
    connection = app.state.store.get("connection")
    app.state.store.put("connection", {**connection, "connectedAt": time.time() - 25 * 60 * 60})
    with TestClient(app, base_url=config.public_origin) as client:
        body = authorize(client, config)
        assert client.post("/api/proof/whatsapp/connect", json=body).status_code == 409
        assert all(call[0] != "POST" for call in graph.calls)
        assert app.state.store.operation("contacts") is None
        assert app.state.store.operation("history") is None


def test_unknown_app_default_refused_before_any_mutation(config):
    graph = SyntheticGraph(config, application_callback="")
    app = create_app(config, graph)
    with TestClient(app, base_url=config.public_origin) as client:
        body = authorize(client, config)
        response = client.post("/api/proof/whatsapp/connect", json=body)
        assert response.status_code == 409
        assert all(call[0] != "POST" for call in graph.calls)
        assert app.state.store.connection() is None


def test_multiple_waba_phones_refused_before_selected_number_filter(config):
    graph = SyntheticGraph(config, application_callback=config.callback)
    graph.numbers.append({"id": "303", "display_phone_number": "15550000003"})
    with TestClient(create_app(config, graph), base_url=config.public_origin) as client:
        body = {**authorize(client, config), "phoneNumberId": "202"}
        assert client.post("/api/proof/whatsapp/connect", json=body).status_code == 409
        assert all(call[0] != "POST" for call in graph.calls)


@pytest.mark.parametrize("consumer", ["own-subscription", "foreign-app", "phone", "waba"])
def test_prior_consumers_require_exact_proof_provenance(config, consumer):
    graph = SyntheticGraph(config, application_callback=config.callback)
    if consumer == "own-subscription":
        graph.existing = True
        graph.subscription_override = graph.waba_callback = config.callback
        graph.callback = config.callback
    elif consumer == "foreign-app":
        graph.other_apps = [{"whatsapp_business_api_data": {"id": "999"}}]
    elif consumer == "phone":
        graph.callback = "https://another.example.test/webhooks"
    else:
        graph.waba_callback = "https://another.example.test/webhooks"
    with TestClient(create_app(config, graph), base_url=config.public_origin) as client:
        body = authorize(client, config)
        assert client.post("/api/proof/whatsapp/connect", json=body).status_code == 409
        assert all(call[0] != "POST" for call in graph.calls)


@pytest.mark.parametrize(
    "changed,value",
    [
        ("subscription_override", ""),
        ("subscription_override", "https://another.example.test/webhooks"),
        ("callback", "https://another.example.test/webhooks"),
        ("waba_callback", "https://another.example.test/webhooks"),
        ("waba_callback", ""),
    ],
)
def test_subscription_and_effective_route_must_agree_before_sync(config, changed, value):
    graph = SyntheticGraph(config)
    graph.after_subscription = lambda: setattr(graph, changed, value)
    app = create_app(config, graph)
    with TestClient(app, base_url=config.public_origin) as client:
        body = authorize(client, config)
        assert client.post("/api/proof/whatsapp/connect", json=body).status_code == 409
        assert [call[1] for call in graph.calls if call[0] == "POST"] == ["101/subscribed_apps"]
        assert app.state.store.operation("contacts") is None
        assert app.state.store.operation("history") is None


@pytest.mark.parametrize("error", ["100", "transport"])
def test_failed_combined_subscription_is_durable_without_retry_or_bare_fallback(config, error):
    graph = SyntheticGraph(config)
    graph.subscription_error = error
    app = create_app(config, graph)
    with TestClient(app, base_url=config.public_origin) as client:
        body = authorize(client, config)
        assert client.post("/api/proof/whatsapp/connect", json=body).status_code == 502
        assert client.post("/api/proof/whatsapp/connect", json=body).status_code == 409
        posts = [call for call in graph.calls if call[0] == "POST"]
        assert len(posts) == 1
        assert posts[0][2] == {
            "override_callback_uri": config.callback, "verify_token": config.verify_token,
        }
        saved = Store(config).operation("subscription")
        assert saved["state"] == "interrupted"
        assert saved["error"] == error
        assert app.state.store.operation("contacts") is None
        assert app.state.store.operation("history") is None


def test_binding_and_request_intent_are_durable_before_subscription_callback(config):
    graph = SyntheticGraph(config)
    app = create_app(config, graph)

    def receive_early_callback():
        captured = Store(config)
        assert captured.get("connection")["phoneId"] == "202"
        assert captured.get("subscription-intent")["callback"] == config.callback
        assert captured.operation("subscription")["state"] == "attempted"
        captured.capture(json.dumps(history([message("during-subscription")])).encode())

    graph.after_subscription = receive_early_callback
    with TestClient(app, base_url=config.public_origin) as client:
        body = authorize(client, config)
        assert client.post("/api/proof/whatsapp/connect", json=body).status_code == 200
    app.state.store.drain()
    assert app.state.store.history()["messages"] == 1


def test_app_default_drift_after_override_blocks_contacts_and_history(config):
    graph = SyntheticGraph(config, drift_after_override=True)
    app = create_app(config, graph)
    with TestClient(app, base_url=config.public_origin) as client:
        body = authorize(client, config)
        response = client.post("/api/proof/whatsapp/connect", json=body)
        assert response.status_code == 409
        assert all(call[1] != "202/smb_app_data" for call in graph.calls if call[0] == "POST")
        assert app.state.store.operation("contacts") is None
        assert app.state.store.operation("history") is None


@pytest.mark.parametrize("crossing", ["verification", "contacts"])
def test_import_deadline_is_checked_before_each_sync_after_network_delay(config, monkeypatch, crossing):
    clock = [time.time()]
    monkeypatch.setattr("service.time.time", lambda: clock[0])

    class DelayedGraph(SyntheticGraph):
        async def request(self, method, path, token="", params=None, body=None):
            result = await super().request(method, path, token, params, body)
            verification = method == "GET" and params == {"fields": "webhook_configuration"}
            contacts = method == "POST" and (body or {}).get("sync_type") == "smb_app_state_sync"
            if (crossing == "verification" and verification) or (crossing == "contacts" and contacts):
                clock[0] += 2
            return result

    graph = DelayedGraph(config)
    app = create_app(config, graph)

    def import_window_nearly_elapsed():
        connection = app.state.store.get("connection")
        app.state.store.put("connection", {**connection, "connectedAt": clock[0] - 24 * 60 * 60 + 1})

    graph.after_subscription = import_window_nearly_elapsed
    with TestClient(app, base_url=config.public_origin) as client:
        body = authorize(client, config)
        assert client.post("/api/proof/whatsapp/connect", json=body).status_code == 409
        assert app.state.store.operation("history") is None
        contact_operation = app.state.store.operation("contacts")
        if crossing == "verification":
            assert contact_operation is None
        else:
            assert contact_operation["state"] == "accepted"


def test_account_update_is_captured_only_for_exact_bound_waba(config):
    store = Store(config)
    bind(store)
    event = {
        "object": "whatsapp_business_account",
        "entry": [
            {"id": "101", "changes": [{"field": "account_update", "value": {"event": "PARTNER_ADDED"}}]}
        ],
    }
    replay(store, event)
    assert store.history()["messages"] == 0
    with store.db() as con:
        assert con.execute("SELECT COUNT(*) FROM inbox WHERE processed=1").fetchone()[0] == 1
    event["entry"][0]["id"] = "999"
    with pytest.raises(ValueError):
        store.capture(json.dumps(event).encode())


def test_config_private_path_key_and_https_boundaries(config):
    for updated, expected in (
        ({"encryption_key": "invalid"}, "ENCRYPTION_KEY"),
        ({"state_dir": "."}, "STATE_DIR"),
        ({"public_origin": "http://cedar.example.test"}, "PUBLIC_ORIGIN"),
        ({"public_origin": "https://cedar.example.test/path"}, "PUBLIC_ORIGIN"),
        ({"public_origin": "https://[invalid"}, "PUBLIC_ORIGIN"),
    ):
        assert "CEDAR_PROOF_" + expected in replace(config, **updated).blockers()


def test_valid_provider_configuration_allows_authorization_before_asset_validation(config):
    graph = SyntheticGraph(config)
    app = create_app(config, graph)
    with TestClient(app, base_url=config.public_origin) as client:
        client.headers["Origin"] = config.public_origin
        assert client.post("/api/proof/session", json={}).status_code == 200
        state = client.get("/api/proof/state").json()
        assert state["ready"] is True
        assert state["blockers"] == []
        response = client.post("/api/proof/whatsapp/code", json={"code": "synthetic-code"})
        assert response.status_code == 200
        assert response.json()["authorizationId"]
        assert graph.calls == [("exchange",)]
        assert app.state.store.connection() is None


@pytest.mark.parametrize(
    "change,blocker",
    [
        ({"app_id": ""}, "APP_ID"),
        ({"config_id": ""}, "CONFIG_ID"),
        ({"app_secret": ""}, "APP_SECRET"),
        ({"config_id": "invalid-id"}, "CONFIG_ID"),
    ],
)
def test_required_provider_configuration_blocks_authorization(config, change, blocker):
    config = replace(config, **change)
    graph = SyntheticGraph(config)
    with TestClient(create_app(config, graph), base_url=config.public_origin) as client:
        client.headers["Origin"] = config.public_origin
        assert client.post("/api/proof/session", json={}).status_code == 200
        state = client.get("/api/proof/state").json()
        assert state["ready"] is False
        assert "CEDAR_PROOF_" + blocker in state["blockers"]
        assert client.post("/api/proof/whatsapp/code", json={"code": "unused-code"}).status_code == 503
        assert graph.calls == []


def test_relocated_shallow_package_preflight_imports_without_repository_layout(tmp_path):
    package = tmp_path / "proof"
    package.mkdir()
    source = Path(__file__).parent
    for name in ("run.py", "service.py", "storage.py", "accounts.py"):
        shutil.copyfile(source / name, package / name)
    result = subprocess.run(
        [sys.executable, str(package / "run.py"), "--preflight"],
        cwd=tmp_path,
        env={"PATH": os.defpath},
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 1
    assert result.stderr == ""
    assert "CEDAR_PROOF_APP_SECRET" in result.stdout.splitlines()
    assert all(line.startswith("CEDAR_PROOF_") for line in result.stdout.splitlines())
    boundary = subprocess.run(
        [
            sys.executable,
            "-c",
            "from pathlib import Path; from service import Config, SOURCE_ROOT; "
            "expected = Path.cwd().parent; assert SOURCE_ROOT == expected; "
            "assert 'CEDAR_PROOF_STATE_DIR' in Config(state_dir=str(expected / 'private')).blockers(); "
            "assert 'CEDAR_PROOF_STATE_DIR' not in "
            "Config(state_dir=str(expected.parent / 'private-outside-package')).blockers()",
        ],
        cwd=package,
        env={"PATH": os.defpath},
        capture_output=True,
        text=True,
        check=False,
    )
    assert boundary.returncode == 0, boundary.stderr


def test_unicode_webhook_verification_token(config):
    config = replace(config, verify_token="verificación sintética privada para Cedar")
    with TestClient(
        create_app(config), base_url=config.public_origin, raise_server_exceptions=False
    ) as client:
        query = {"hub.mode": "subscribe", "hub.verify_token": config.verify_token, "hub.challenge": "123"}
        result = client.get("/webhooks/whatsapp", params=query)
        assert result.status_code == 200
        assert result.text == "123"
        query["hub.verify_token"] = "verificación diferente para Cedar"
        assert client.get("/webhooks/whatsapp", params=query).status_code == 403


def test_pending_setup_restart_requires_review(config):
    store = Store(config)
    bind(store)
    store.put("setup", {"status": "pending", "step": "history", "error": None})
    assert store.claim("history")
    restarted = create_app(config)
    assert restarted.state.store.get("setup")["status"] == "interrupted"
    assert restarted.state.store.claim("history") is False


def test_customer_cookie_and_webhook_tampering(config):
    app = create_app(config)
    with TestClient(app, base_url=config.public_origin) as client:
        client.headers["Origin"] = config.public_origin
        response = client.post("/api/proof/session", json={})
        cookie = response.headers["set-cookie"].lower()
        assert "httponly" in cookie and "secure" in cookie and "samesite=strict" in cookie
        bind(app.state.store)
        raw = json.dumps(history([message("tampered")])).encode()
        signature = "sha256=" + hmac.new(config.app_secret.encode(), raw, hashlib.sha256).hexdigest()
        response = client.post(
            "/webhooks/whatsapp", content=raw + b" ", headers={"X-Hub-Signature-256": signature}
        )
        assert response.status_code == 403
        assert app.state.store.history()["messages"] == 0
        assert (
            client.post(
                "/api/proof/whatsapp/code",
                headers={"Origin": "https://attacker.test"},
                json={"code": "unused-code"},
            ).status_code
            == 403
        )
        assert cookie.startswith("__host-cedar_session=")
        assert "domain=" not in cookie
        client.cookies.clear()
        client.cookies.set(COOKIE, "forged-browser-session")
        assert client.get("/api/proof/state").status_code == 401


def test_unauthorized_connect_preserves_another_pending_setup(config):
    app = create_app(config)
    app.state.store.put("setup", {"status": "pending", "step": "history", "error": None})
    with TestClient(app, base_url=config.public_origin) as client:
        response = client.post(
            "/api/proof/whatsapp/connect",
            headers={"Origin": config.public_origin},
            json={
                "authorizationId": "unknown-authorization-identifier",
                "wabaId": "101",
                "event": COEXISTENCE,
                "historyRequested": True,
            },
        )
        assert response.status_code == 401
        assert app.state.store.get("setup")["status"] == "pending"


@pytest.mark.parametrize(
    ("agent", "platform", "expected"),
    [
        (
            "Mozilla/5.0 (Linux; Android 15; Pixel 9)",
            "",
            "https://play.google.com/store/apps/details?id=com.whatsapp.w4b",
        ),
        (
            "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
            "",
            "https://apps.apple.com/app/whatsapp-business/id1386412985",
        ),
        (
            "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)",
            "",
            "https://apps.apple.com/app/whatsapp-business/id1386412985",
        ),
        (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15",
            "",
            "https://apps.apple.com/app/whatsapp-business/id1386412985",
        ),
        ("Mozilla/5.0", '"Android"', "https://play.google.com/store/apps/details?id=com.whatsapp.w4b"),
        ("Mozilla/5.0", '"iOS"', "https://apps.apple.com/app/whatsapp-business/id1386412985"),
        ("Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "", "/?preview=setup&transfer=1#whatsapp-business"),
    ],
)
def test_public_business_app_download_redirect(agent, platform, expected):
    # A scanned public download link works independently of account/provider setup.
    client = TestClient(create_app(Config()), follow_redirects=False)
    response = client.get(
        "/download/whatsapp-business?next=https://untrusted.example&accessCode=discarded",
        headers={"user-agent": agent, "sec-ch-ua-platform": platform},
    )
    assert response.status_code == 302
    assert response.headers["location"] == expected
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["vary"] == "User-Agent, Sec-CH-UA-Platform"
    assert "set-cookie" not in response.headers


def test_browser_bootstrap_has_setup_only_access_to_an_existing_account(config):
    app = create_app(config)
    bind(app.state.store)
    replay(app.state.store, history([message("private-before-new-visitor")], progress=100))
    with TestClient(app, base_url=config.public_origin) as visitor:
        assert visitor.post("/api/proof/session", json={}).status_code == 403
        response = visitor.post("/api/proof/session", json={}, headers={"Origin": config.public_origin})
        assert response.status_code == 200
        state = visitor.get("/api/proof/state")
        assert state.status_code == 200
        assert state.json()["ready"] is True
        assert state.json()["connection"] is None
        assert state.json()["history"]["messages"] == 0
        assert visitor.get("/api/proof/conversations").status_code == 401
        assert visitor.get("/api/proof/conversations/anything/messages").status_code == 401
        assert "private-before-new-visitor" not in state.text


class TwoCustomerGraph:
    """Two independent provider grants, each limited to its own synthetic business assets."""

    def __init__(self, config):
        self.config, self.calls = config, []
        self.assets = {"token-a": ("101", "202"), "token-b": ("303", "404")}
        self.subscribed = set()

    async def exchange(self, code):
        self.calls.append(("exchange",))
        return "token-b" if code == "customer-b" else "token-a"

    async def collection(self, path, token, fields=None):
        self.calls.append(("GET", path, token))
        waba, phone = self.assets[token]
        if path == f"{waba}/phone_numbers":
            return [{"id": phone, "display_phone_number": "1555000" + phone}]
        if path == f"{waba}/subscribed_apps":
            return [{"whatsapp_business_api_data": {"id": self.config.app_id},
                     "override_callback_uri": self.config.callback}] if waba in self.subscribed else []
        raise GraphError("unauthorized_asset")

    async def request(self, method, path, token, params=None, body=None):
        self.calls.append((method, path, token))
        waba, phone = self.assets[token]
        if method == "GET" and path == waba:
            return {"id": waba, "name": f"Synthetic business {waba}"}
        if method == "GET" and path == phone:
            routing = {"application": "https://existing.example.test/webhooks"}
            if waba in self.subscribed:
                routing["whatsapp_business_account"] = self.config.callback
            return {"id": phone, "is_on_biz_app": True, "platform_type": "CLOUD_API",
                    "webhook_configuration": routing}
        if method == "POST" and path == f"{waba}/subscribed_apps":
            assert body == {"override_callback_uri": self.config.callback,
                            "verify_token": self.config.verify_token}
            self.subscribed.add(waba)
            return {"success": True}
        if method == "POST" and path == f"{phone}/smb_app_data":
            return {"request_id": f"synthetic-sync-{phone}"}
        raise GraphError("unauthorized_asset")


def customer_authorization(client, config, customer="a"):
    client.headers["Origin"] = config.public_origin
    assert client.post("/api/proof/session", json={}).status_code == 200
    response = client.post("/api/proof/whatsapp/code", json={"code": "customer-" + customer})
    assert response.status_code == 200
    return {"authorizationId": response.json()["authorizationId"],
            "wabaId": "303" if customer == "b" else "101", "event": COEXISTENCE,
            "historyRequested": True}


class BrowserCookies:
    """Separate browser cookie jars sharing the server's single ASGI lifespan and event loop."""

    def __init__(self, transport):
        self.transport = transport
        self.cookies = type(transport.cookies)()
        self.headers = {}

    def request(self, method, path, **kwargs):
        self.transport.cookies = self.cookies
        self.transport.headers = self.headers
        response = self.transport.request(method, path, **kwargs)
        self.cookies = type(self.transport.cookies)(self.transport.cookies)
        return response

    def get(self, path, **kwargs):
        return self.request("GET", path, **kwargs)

    def post(self, path, **kwargs):
        return self.request("POST", path, **kwargs)


def test_two_customer_sessions_callbacks_and_restart_remain_separate(config):
    graph = TwoCustomerGraph(config)
    app = create_app(config, graph)
    with TestClient(app, base_url=config.public_origin) as transport:
        a, b = BrowserCookies(transport), BrowserCookies(transport)
        a_body = customer_authorization(a, config)
        unbound_a = a.cookies.get(COOKIE)
        b_body = customer_authorization(b, config, "b")
        assert b.post("/api/proof/whatsapp/connect", json=a_body).status_code == 401
        assert a.post("/api/proof/whatsapp/connect", json=a_body).status_code == 200
        assert a.cookies.get(COOKIE) != unbound_a
        assert b.get("/api/proof/state").json()["connection"] is None
        assert b.get("/api/proof/conversations").status_code == 401
        assert b.post("/api/proof/whatsapp/connect", json=b_body).status_code == 200
        assert a.get("/api/proof/state").json()["connection"]["wabaId"] == "101"
        assert b.get("/api/proof/state").json()["connection"]["wabaId"] == "303"
        # Meta may batch multiple businesses. Both use the same contact: scope comes from the business.
        event_a = envelope("messages", {"messages": [message("a-live", "A private conversation")]})
        event_b = envelope("messages", {"messages": [message("b-live", "B private conversation")]},
                           phone="404", waba="303")
        event_a["entry"].extend(event_b["entry"])
        raw = json.dumps(event_a).encode()
        signature = "sha256=" + hmac.new(config.app_secret.encode(), raw, hashlib.sha256).hexdigest()
        assert a.post("/webhooks/whatsapp", content=raw,
                      headers={"X-Hub-Signature-256": signature}).status_code == 200
        for store in app.state.registry.stores():
            store.drain()
        for client, own, foreign in ((a, "A private conversation", "B private conversation"),
                                      (b, "B private conversation", "A private conversation")):
            response = client.get("/api/proof/conversations")
            conversation = response.json()["conversations"][0]["id"]
            messages = client.get(f"/api/proof/conversations/{conversation}/messages")
            assert own in messages.text and foreign not in messages.text
        cookie_a = a.cookies.get(COOKIE)
    restarted = create_app(config, graph)
    with TestClient(restarted, base_url=config.public_origin) as returning:
        returning.cookies.set(COOKIE, cookie_a)
        returning.headers["Origin"] = config.public_origin
        assert returning.post("/api/proof/session", json={}).status_code == 200
        assert returning.get("/api/proof/state").json()["connection"]["wabaId"] == "101"
        assert "A private conversation" in returning.get("/api/proof/conversations").text
        returning.cookies.clear()
        returning.cookies.set(COOKIE, unbound_a)
        assert returning.get("/api/proof/state").status_code == 401


def test_new_meta_authorization_reopens_completed_account_after_import_window(config):
    graph = TwoCustomerGraph(config)
    app = create_app(config, graph)
    with TestClient(app, base_url=config.public_origin) as first:
        body = customer_authorization(first, config)
        assert first.post("/api/proof/whatsapp/connect", json=body).status_code == 200
    connection = app.state.store.get("connection")
    app.state.store.put("connection", {**connection, "connectedAt": time.time() - 48 * 60 * 60})
    replay(app.state.store, history([message("saved-history", "Previously imported history")], progress=100))
    before = len([call for call in graph.calls if call[0] == "POST"])
    restarted = create_app(config, graph)
    with TestClient(restarted, base_url=config.public_origin) as returning:
        body = customer_authorization(returning, config)
        response = returning.post("/api/proof/whatsapp/connect", json=body)
        assert response.status_code == 200, response.text
        assert response.json()["history"]["messages"] == 1
        assert "Previously imported history" in returning.get("/api/proof/conversations").text
    assert len([call for call in graph.calls if call[0] == "POST"]) == before


def test_valid_meta_grant_for_another_customer_cannot_interrupt_existing_setup(config):
    graph = TwoCustomerGraph(config)
    app = create_app(config, graph)
    bind(app.state.store)
    app.state.store.put("setup", {"status": "pending", "step": "history", "error": None})
    with TestClient(app, base_url=config.public_origin) as attacker:
        body = customer_authorization(attacker, config, "b")
        body["wabaId"] = "101"
        assert attacker.post("/api/proof/whatsapp/connect", json=body).status_code >= 400
        assert app.state.store.get("setup")["status"] == "pending"
        assert attacker.get("/api/proof/state").json()["connection"] is None
        assert attacker.get("/api/proof/conversations").status_code == 401
    assert all(call[0] != "POST" for call in graph.calls)


def test_replacement_phone_preserves_existing_account_callback_route(config):
    graph = TwoCustomerGraph(config)
    graph.assets["token-a"] = ("101", "999")
    app = create_app(config, graph)
    bind(app.state.store)
    with TestClient(app, base_url=config.public_origin) as client:
        body = customer_authorization(client, config)
        response = client.post("/api/proof/whatsapp/connect", json=body)
        assert response.status_code == 409
        assert app.state.registry.webhook_store("101") is app.state.store
        assert app.state.store.get("connection")["phoneId"] == "202"
        assert len(app.state.registry.stores()) == 1
        assert client.get("/api/proof/state").json()["connection"] is None
    assert all(call[0] != "POST" for call in graph.calls)


def signup_diagnostic(**changes):
    return {
        "attemptId": str(uuid4()), "event": "CANCEL", "errorCode": "2494064",
        "currentStep": "PHONE_NUMBER_SETUP", "sessionId": "f34b51dab5e0498",
        "reportedAt": "1746041036", **changes,
    }


def test_signup_diagnostics_private_idempotent_and_provider_independent(config):
    graph = SyntheticGraph(config)
    app = create_app(config, graph)
    body = signup_diagnostic()
    with TestClient(app, base_url=config.public_origin) as client:
        client.headers["Origin"] = config.public_origin
        assert client.post("/api/proof/session", json={}).status_code == 200
        before = client.get("/api/proof/state").json()
        started = time.time()
        first = client.post("/api/proof/whatsapp/diagnostics", json=body)
        assert first.status_code == 200, first.text
        assert set(first.json()) == {"receiptId"}
        assert len(first.json()["receiptId"]) == 64
        again = client.post("/api/proof/whatsapp/diagnostics", json={**body, "errorCode": "999"})
        assert again.json() == first.json()
        assert client.get("/api/proof/state").json() == before
        assert client.get("/api/proof/whatsapp/diagnostics").status_code == 405
        rows = app.state.store.signup_diagnostics()
        assert len(rows) == 1
        row = rows[0]
        assert {key: row[key] for key in body} == body
        assert row["receiptId"] == first.json()["receiptId"]
        assert started <= row["observedAt"] <= time.time()
        assert row["source"] == "browser_reported"
        assert (row["appId"], row["configId"], row["graphVersion"]) == ("123", "456", "v26.0")
        assert len(row["ownerHash"]) == 64
        assert set(row) == set(body) | {
            "receiptId", "observedAt", "source", "appId", "configId", "graphVersion", "ownerHash",
        }
        assert row["ownerHash"] != client.cookies.get(COOKIE)
    assert graph.calls == []
    assert Store(config).signup_diagnostics() == rows
    for value in [body["attemptId"], body["sessionId"], body["currentStep"], row["ownerHash"]]:
        assert value.encode() not in app.state.store.path.read_bytes()


def test_signup_diagnostics_require_origin_and_unbound_session(config):
    app = create_app(config, SyntheticGraph(config))
    body = signup_diagnostic()
    with TestClient(app, base_url=config.public_origin) as client:
        path = "/api/proof/whatsapp/diagnostics"
        assert client.post(path, json=body).status_code == 403
        client.headers["Origin"] = config.public_origin
        assert client.post(path, json=body).status_code == 401
        client.cookies.set(COOKIE, "forged-browser-session")
        assert client.post(path, json=body).status_code == 401
        client.cookies.clear()
        assert client.post("/api/proof/session", json={}).status_code == 200
        bind(app.state.store)
        token = app.state.registry.grant(client.cookies.get(COOKIE), app.state.store)
        client.cookies.clear()
        client.cookies.set(COOKIE, token)
        assert client.post(path, json=body).status_code == 403
        client.headers["Origin"] = "https://other.example.test"
        assert client.post(path, json=body).status_code == 403
    assert app.state.store.signup_diagnostics() == []


@pytest.mark.parametrize("changes", [
    {"event": "FINISH"}, {"attemptId": "not-a-uuid"}, {"errorCode": "1x"},
    {"errorCode": "1" * 13}, {"errorCode": 2494064}, {"currentStep": "private message"},
    {"currentStep": "X" * 65}, {"sessionId": "https://private.example/secret"},
    {"sessionId": "f" * 65}, {"reportedAt": "yesterday"}, {"reportedAt": "1" * 14},
    {"error_message": "private-error-text"}, {"code": "private-auth-code"},
    {"access_token": "private-token"}, {"appId": "999"}, {"observedAt": 0},
])
def test_signup_diagnostics_reject_unapproved_data_without_echo(config, changes):
    app = create_app(config, SyntheticGraph(config))
    with TestClient(app, base_url=config.public_origin) as client:
        client.headers["Origin"] = config.public_origin
        client.post("/api/proof/session", json={})
        result = client.post("/api/proof/whatsapp/diagnostics", json=signup_diagnostic(**changes))
        assert result.status_code == 422
        assert result.json() == {"detail": "Check the required fields and try again."}
        assert app.state.store.signup_diagnostics() == []
    for secret in [b"private-error-text", b"private-auth-code", b"private-token"]:
        assert secret not in app.state.store.path.read_bytes()


def test_signup_diagnostics_rate_limits_and_owner_scoped_deduplication(config):
    app = create_app(config, SyntheticGraph(config))
    with TestClient(app, base_url=config.public_origin) as client:
        client.headers["Origin"] = config.public_origin
        client.post("/api/proof/session", json={})
        path = "/api/proof/whatsapp/diagnostics"
        body = signup_diagnostic()
        first = client.post(path, json=body)
        assert first.status_code == 200
        for _ in range(9):
            assert client.post(path, json=signup_diagnostic()).status_code == 200
        assert client.post(path, json=signup_diagnostic()).status_code == 429
        assert client.post(path, json=body).json() == first.json()
        client.cookies.clear()
        client.post("/api/proof/session", json={})
        other = client.post(path, json=body)
        assert other.status_code == 200
        assert other.json()["receiptId"] != first.json()["receiptId"]
        # A restarted process retains its per-browser rate history.
        restarted = create_app(config, SyntheticGraph(config))
        with TestClient(restarted, base_url=config.public_origin) as retry:
            retry.headers["Origin"] = config.public_origin
            retry.cookies.update(client.cookies)
            for _ in range(9):
                assert retry.post(path, json=signup_diagnostic()).status_code == 200
            assert retry.post(path, json=signup_diagnostic()).status_code == 429


def test_signup_diagnostics_storage_bound_expiry_and_readonly_projection(config, monkeypatch):
    store = Store(config)
    started = 1800000000.0
    for index in range(205):
        now = started + index * 61
        receipt = store.record_signup_diagnostic(
            signup_diagnostic(), owner=f"synthetic-owner-{index}", config=config, now=now,
        )
        assert receipt is not None
    rows = store.signup_diagnostics(now=now)
    assert len(rows) == 200
    assert rows[0]["observedAt"] == started + 5 * 61
    with store.db() as con:
        stored = store.get("signup-diagnostics", con)
        stored[0]["rawError"] = "unapproved-private-text"
        store.put("signup-diagnostics", stored, con)
    assert "rawError" not in store.signup_diagnostics(now=now)[0]
    assert "rawError" in store.get("signup-diagnostics")[0], "operator accessor must be read-only"
    after_retention = now + 7 * 24 * 60 * 60
    assert store.signup_diagnostics(now=after_retention) == []
    monkeypatch.setattr("storage.time.time", lambda: after_retention)
    restarted = create_app(config, SyntheticGraph(config))
    assert restarted.state.store.get("signup-diagnostics") == []


def test_signup_diagnostics_global_rate_limit_and_atomic_duplicate(config):
    from concurrent.futures import ThreadPoolExecutor

    store = Store(config)
    now = 1800000000.0
    body = signup_diagnostic()
    with ThreadPoolExecutor(max_workers=8) as pool:
        receipts = list(pool.map(lambda _: Store(config).record_signup_diagnostic(
            body, owner="same-owner", config=config, now=now,
        ), range(12)))
    assert all(receipt == receipts[0] for receipt in receipts)
    assert len(store.signup_diagnostics(now=now)) == 1
    for index in range(99):
        assert store.record_signup_diagnostic(
            signup_diagnostic(), owner=f"owner-{index}", config=config, now=now,
        ) is not None
    assert store.record_signup_diagnostic(
        signup_diagnostic(), owner="fresh-owner", config=config, now=now,
    ) is None
    assert len(store.signup_diagnostics(now=now)) == 100
    assert store.record_signup_diagnostic(body, owner="same-owner", config=config, now=now) == receipts[0]


def test_signup_diagnostics_concurrent_writes_keep_storage_bound(config):
    from concurrent.futures import ThreadPoolExecutor

    store = Store(config)
    now = 1800000000.0
    for index in range(190):
        store.record_signup_diagnostic(
            signup_diagnostic(), owner=f"old-{index}", config=config, now=now + index * 61,
        )
    now += 191 * 61
    with ThreadPoolExecutor(max_workers=8) as pool:
        receipts = list(pool.map(lambda index: Store(config).record_signup_diagnostic(
            signup_diagnostic(), owner=f"new-{index}", config=config, now=now,
        ), range(25)))
    assert all(receipts)
    assert len(store.signup_diagnostics(now=now)) == 200
    assert len({row["receiptId"] for row in store.signup_diagnostics(now=now)}) == 200


def test_signup_diagnostics_operator_cli_reads_only_reports_and_preserves_files(config, tmp_path):
    from diagnostics import read_reports

    store = Store(config)
    bind(store)
    store.put("unrelated-record", {"access_token": "private-other-account-token"})
    for index in range(25):
        store.record_signup_diagnostic(
            signup_diagnostic(event="ERROR"), owner=f"owner-{index}", config=config,
        )
    records = store.get("signup-diagnostics")
    records[-1]["error_message"] = "PRIVATE_MESSAGE_CONTENT"
    records[-1]["errorCode"] = "PRIVATE_TOKEN_IN_WRONG_FIELD"
    store.put("signup-diagnostics", records)
    env_file = tmp_path / "private.env"
    env_file.write_text(
        f"CEDAR_PROOF_STATE_DIR={config.state_dir}\n"
        f"CEDAR_PROOF_ENCRYPTION_KEY={config.encryption_key}\n"
        "CEDAR_PROOF_APP_SECRET=PRIVATE_APP_SECRET\n"
    )
    env_file.chmod(0o600)
    before = store.path.read_bytes(), store.path.stat().st_mtime_ns, env_file.read_bytes()
    rows = read_reports(env_file)
    assert len(rows) == 20
    assert len(read_reports(env_file, 200)) == 25
    assert "error_message" not in rows[-1]
    assert "errorCode" not in rows[-1]
    run = subprocess.run([
        sys.executable, str(Path(__file__).with_name("diagnostics.py")), "--env-file", str(env_file),
        "--limit", "1",
    ], capture_output=True, text=True, check=True)
    assert json.loads(run.stdout) == rows[-1:]
    assert "PRIVATE" not in run.stdout + run.stderr
    assert "private-other-account-token" not in run.stdout + run.stderr
    assert before == (store.path.read_bytes(), store.path.stat().st_mtime_ns, env_file.read_bytes())
    with pytest.raises(ValueError):
        read_reports(env_file, 201)
    env_file.chmod(0o644)
    with pytest.raises(ValueError):
        read_reports(env_file)


def test_signup_diagnostics_operator_cli_missing_database_stays_missing(config, tmp_path):
    env_file = tmp_path / "private.env"
    env_file.write_text(
        f"CEDAR_PROOF_STATE_DIR={config.state_dir}\n"
        f"CEDAR_PROOF_ENCRYPTION_KEY={config.encryption_key}\n"
    )
    env_file.chmod(0o600)
    Path(config.state_dir).mkdir()
    result = subprocess.run([
        sys.executable, str(Path(__file__).with_name("diagnostics.py")), "--env-file", str(env_file),
    ], capture_output=True, text=True)
    assert result.returncode == 2
    assert result.stdout == ""
    assert config.encryption_key not in result.stderr
    assert list(Path(config.state_dir).iterdir()) == []


def identity_contact(user_id="opaque-owner-2026001", number="15550000001"):
    return envelope("smb_app_state_sync", {"state_sync": [{
        "type": "contact", "action": "add",
        "contact": {"user_id": user_id, "phone_number": number, "full_name": "Synthetic owner"},
    }]})


def identity_history(sibling, chunk=1, user_id="opaque-owner-2026001"):
    return envelope("history", {"history": [{
        "metadata": {"progress": 100, "chunk_order": chunk},
        "threads": [
            {"id": "15550000002", "messages": [message(sibling)]},
            {"context": {"user_id": user_id}, "messages": [message(
                "synthetic-owner-self-note", "Synthetic self note", **{
                    "from": "15550000001", "history_context": {"from_me": True, "status": "delivered"},
                },
            )]},
        ],
    }]})


def test_history_context_identity_mapping_recovers_self_chat_and_duplicate_chunks(config):
    store = Store(config)
    bind(store)
    replay(store, identity_contact())
    replay(store, identity_history("sibling-one"))
    replay(store, identity_history("sibling-two", 2))
    assert store.history()["messages"] == 3
    assert store.history()["status"] == "complete"
    conversations = store.conversations()
    own = next(row for row in conversations if row["number"] == "15550000001")
    assert own["count"] == 1
    assert store.messages(own["id"], None, 100)["messages"][0]["direction"] == "outbound"
    assert b"opaque-owner-2026001" not in store.path.read_bytes()
    assert b"Synthetic self note" not in store.path.read_bytes()
    assert Store(config).history()["messages"] == 3


def test_history_context_identity_waits_for_matching_contact_only(config):
    store = Store(config)
    bind(store)
    replay(store, identity_history("waiting-sibling"))
    assert store.history()["messages"] == 0
    with store.db() as con:
        assert con.execute("SELECT error FROM inbox").fetchone()[0] == "MissingConversationIdentity"
    replay(store, identity_contact("another-opaque-2026001", "15550000009"))
    assert store.history()["messages"] == 0
    replay(store, identity_contact())
    assert store.history()["messages"] == 2
    assert store.history()["status"] == "complete"
    with store.db() as con:
        assert con.execute("SELECT COUNT(*) FROM identity_waits").fetchone()[0] == 0
        assert con.execute("SELECT COUNT(*) FROM inbox WHERE processed=0").fetchone()[0] == 0


def test_history_context_identity_conflicts_remain_unresolved_and_account_local(config):
    store = Store(config)
    bind(store)
    replay(store, identity_contact())
    replay(store, identity_contact(number="15550000008"))
    replay(store, identity_contact())
    replay(store, identity_history("conflicting-sibling"))
    assert store.history()["messages"] == 0
    inbound = identity_history("another-conflicting-sibling", 2)
    inbound_threads = inbound["entry"][0]["changes"][0]["value"]["history"][0]["threads"]
    inbound_threads[1]["messages"][0]["from"] = "15550000003"
    replay(store, inbound)
    assert store.history()["messages"] == 0, (
        "An ambiguous user identity remains unresolved with a sender hint"
    )
    with store.db() as con:
        error = con.execute("SELECT error FROM inbox WHERE processed=0").fetchone()[0]
        assert error == "MissingConversationIdentity"
    other = Store(replace(config, state_dir=config.state_dir + "-other"))
    bind(other)
    replay(other, identity_history("other-account-sibling"))
    assert other.history()["messages"] == 0
    replay(other, identity_contact())
    assert other.history()["messages"] == 2
    assert store.history()["messages"] == 0


def test_history_context_contact_backfill_uses_captured_evidence_without_reimport(config):
    store = Store(config)
    bind(store)
    event = store.capture(json.dumps(identity_contact()).encode())
    # Emulate contact projection by the prior release, which retained raw events but omitted user_id.
    with store.db() as con:
        store.contact(con, "15550000001", "Synthetic owner", 1700000000)
        con.execute("UPDATE inbox SET processed=1 WHERE id=?", (event,))
    replay(store, identity_history("legacy-sibling"))
    assert store.history()["messages"] == 0
    assert store.backfill_contact_identities() == 1
    store.drain()
    assert store.history()["messages"] == 2
    assert store.backfill_contact_identities() == 0
    assert store.operation("history") is None
    with store.db() as con:
        assert con.execute("SELECT COUNT(*) FROM inbox").fetchone()[0] == 2


def test_history_context_mapping_keeps_generic_malformed_events_rolled_back(config):
    store = Store(config)
    bind(store)
    payload = identity_history("valid-sibling")
    payload["entry"][0]["changes"][0]["value"]["history"][0]["threads"][1]["messages"][0].pop("id")
    replay(store, payload)
    replay(store, identity_contact())
    assert store.history()["messages"] == 0
    with store.db() as con:
        assert con.execute("SELECT error FROM inbox WHERE processed=0").fetchone()[0] == "ValueError"
        assert con.execute("SELECT COUNT(*) FROM identity_waits").fetchone()[0] == 0


def test_history_context_mapping_concurrent_conflicts_never_choose_a_winner(config):
    from concurrent.futures import ThreadPoolExecutor

    store = Store(config)
    bind(store)

    def remember(number):
        other = Store(config)
        with other.db() as con:
            return other.remember_contact_identity(con, "opaque-owner-2026001", number)

    with ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(remember, ["15550000001", "15550000003"]))
    replay(store, identity_history("conflict-race-sibling"))
    assert store.history()["messages"] == 0
    with store.db() as con:
        assert store.get(store.contact_identity_key("opaque-owner-2026001"), con) == {"ambiguous": True}
