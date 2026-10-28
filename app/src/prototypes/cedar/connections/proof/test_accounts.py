"""Synthetic account/session isolation tests. These never contact Meta or import real history."""

import hashlib
import os
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass

import pytest
from accounts import AccountRegistry
from cryptography.fernet import Fernet
from storage import Store


@dataclass(frozen=True)
class RegistryConfig:
    state_dir: str
    encryption_key: str


@pytest.fixture
def config(tmp_path):
    return RegistryConfig(str(tmp_path / "private"), Fernet.generate_key().decode())


def connect(registry, waba="101", phone="202"):
    store = registry.for_account(waba, phone)
    store.bind({
        "wabaId": waba, "phoneId": phone, "number": "+15550000001",
        "name": "Synthetic business", "coexistence": True,
    }, "synthetic-provider-token", True)
    return store


def test_unbound_session_and_rotated_account_session_survive_restart(config):
    registry = AccountRegistry(config)
    before = time.time()
    unbound = registry.begin(None)
    identity = registry.lookup(unbound)
    assert identity["identity"] == hashlib.sha256(unbound.encode()).hexdigest()
    assert identity["account"] is None
    assert before + 1799 <= identity["expiresAt"] <= time.time() + 1800
    assert registry.store_for_session(unbound) is None
    assert AccountRegistry(config).lookup(unbound) == identity
    first = connect(registry)
    first.put("synthetic-account-record", {"text": "first-account-only"})
    bound = registry.grant(unbound, first)
    assert bound != unbound
    assert registry.lookup(unbound) is None
    assert registry.begin(bound) == bound
    assert registry.lookup(bound)["expiresAt"] >= before + 8 * 60 * 60
    restarted = AccountRegistry(config)
    assert restarted.store_for_session(bound).get("synthetic-account-record")["text"] == "first-account-only"
    assert restarted.lookup(bound)["account"] == restarted.root.key("account:101:202")
    with registry.root.db() as con:
        row = con.execute("SELECT id, body FROM proof_sessions").fetchone()
        assert row["id"] == hashlib.sha256(bound.encode()).hexdigest()
        assert bound.encode() not in row["body"]
        assert b"account:101:202" not in row["body"]


def test_two_accounts_use_separate_stores_and_cookie_scopes(config):
    registry = AccountRegistry(config)
    first = connect(registry)
    second = connect(registry, "303", "404")
    first.put("record", {"text": "first-account"})
    second.put("record", {"text": "second-account"})
    first_cookie = registry.grant(registry.begin(None), first)
    second_cookie = registry.grant(registry.begin(None), second)
    assert first is registry.root
    assert first.path != second.path
    assert second.path.parent.name == registry.root.key("account:303:404")
    assert second.path.parent.parent.name == "accounts"
    assert registry.store_for_session(first_cookie).get("record")["text"] == "first-account"
    assert registry.store_for_session(second_cookie).get("record")["text"] == "second-account"
    restarted = AccountRegistry(config)
    assert len(restarted.stores()) == 2
    assert restarted.store_for_session(second_cookie).get("record")["text"] == "second-account"
    assert restarted.for_account("303", "404").path == second.path
    assert os.stat(second.path.parent).st_mode & 0o777 == 0o700
    assert os.stat(second.path).st_mode & 0o777 == 0o600


def test_new_child_is_discoverable_immediately_after_external_bind(config):
    registry = AccountRegistry(config)
    connect(registry)
    child = registry.for_account("303", "404")
    assert child in registry.stores()
    assert registry.webhook_store("303") is None
    assert connect(registry, "303", "404") is child
    assert registry.webhook_store("303") is child
    assert registry.webhook_store("999") is None
    connect(registry, "303", "505")
    assert registry.webhook_store("303") is None  # An ambiguous WABA never selects a default store.
    assert registry.webhook_store("303", "404") is child
    assert registry.webhook_store("303", "505").connection()["phoneId"] == "505"
    assert registry.webhook_store("303", "999") is None
    assert len(registry.authorized_waba_stores("303")) == 2


def test_legacy_root_binding_and_data_are_adopted_without_moving(config):
    legacy = Store(config)
    legacy.bind({
        "wabaId": "101", "phoneId": "202", "number": "+15550000001",
        "name": "Legacy synthetic business", "coexistence": True,
    }, "legacy-synthetic-token", True)
    legacy.put("record", {"text": "retained"})
    registry = AccountRegistry(config)
    assert registry.for_account("101", "202") is registry.root
    assert registry.root.path == legacy.path
    assert registry.root.get("record") == {"text": "retained"}
    assert registry.webhook_store("101") is registry.root
    assert connect(registry, "303", "404").path != legacy.path


def test_reauthorization_rotates_bound_cookie_and_explicitly_changes_scope(config):
    registry = AccountRegistry(config)
    first, second = connect(registry), connect(registry, "303", "404")
    original = registry.grant(registry.begin(None), first)
    # The service verifies fresh Meta authority for the chosen store before invoking grant.
    updated = registry.grant(original, second)
    assert registry.lookup(original) is None
    assert registry.store_for_session(updated) is second
    registry.invalidate(updated)
    assert registry.lookup(updated) is None


@pytest.mark.parametrize("cookie", [None, "", "forged", "x" * 43, "ñ" * 43, "x" * 10000])
def test_forged_cookie_grants_no_scope(config, cookie):
    registry = AccountRegistry(config)
    assert registry.lookup(cookie) is None
    assert registry.store_for_session(cookie) is None
    with pytest.raises(ValueError):
        registry.grant(cookie, connect(registry))


def test_expiry_and_capacity_pruning_preserve_valid_existing_session(config, monkeypatch):
    clock = [time.time()]
    monkeypatch.setattr("accounts.time.time", lambda: clock[0])
    registry = AccountRegistry(config)
    unbound = registry.begin(None)
    with registry.root.db() as con:
        con.executemany("INSERT INTO proof_sessions VALUES (?, ?)", [
            (hashlib.sha256(f"synthetic-session-{i}".encode()).hexdigest(),
             registry.root.seal({"expiresAt": clock[0] + 1800, "account": None}))
            for i in range(999)
        ])
    assert registry.begin(unbound) == unbound
    with pytest.raises(ValueError):
        registry.begin(None)
    clock[0] += 1801
    assert registry.lookup(unbound) is None
    new_cookie = registry.begin(unbound)
    assert new_cookie != unbound
    with registry.root.db() as con:
        assert con.execute("SELECT COUNT(*) FROM proof_sessions").fetchone()[0] == 1
    bound = registry.grant(new_cookie, connect(registry))
    clock[0] += 8 * 60 * 60 + 1
    assert registry.lookup(bound) is None
    assert registry.store_for_session(bound) is None


def test_grant_rotation_is_atomic_across_registry_instances(config):
    registry = AccountRegistry(config)
    connect(registry)
    cookie = registry.begin(None)

    def grant(_):
        peer = AccountRegistry(config)
        try:
            return peer.grant(cookie, peer.root)
        except ValueError:
            return None

    with ThreadPoolExecutor(max_workers=2) as workers:
        granted = list(workers.map(grant, range(2)))
    assert sum(token is not None for token in granted) == 1
    assert registry.lookup(cookie) is None


def test_session_scope_requires_current_matching_connection_metadata(config):
    registry = AccountRegistry(config)
    store = connect(registry)
    cookie = registry.grant(registry.begin(None), store)
    connection = store.get("connection")
    store.put("connection", {**connection, "wabaId": "999"})
    assert registry.store_for_session(cookie) is None


def test_invalidating_account_removes_every_session_for_that_account_only(config):
    registry = AccountRegistry(config)
    first, second = connect(registry), connect(registry, "303", "404")
    first_one = registry.grant(registry.begin(None), first)
    first_two = registry.grant(registry.begin(None), first)
    second_one = registry.grant(registry.begin(None), second)
    registry.invalidate_account(first)
    assert registry.lookup(first_one) is None
    assert registry.lookup(first_two) is None
    assert registry.store_for_session(second_one) is second


@pytest.mark.parametrize("bad", ["../outside", "/tmp/escape", "", "abc", "101:202"])
def test_account_ids_are_validated_before_creating_paths(config, bad):
    registry = AccountRegistry(config)
    with pytest.raises(ValueError):
        registry.for_account(bad, "202")
    assert registry.stores() == [registry.root]


@pytest.mark.parametrize("target", ["root", "accounts", "child", "database"])
def test_symlink_paths_are_refused(config, tmp_path, target):
    state = tmp_path / "private"
    outside = tmp_path / "outside"
    outside.mkdir()
    if target == "root":
        state.symlink_to(outside, target_is_directory=True)
    else:
        registry = AccountRegistry(config)
        if target == "accounts":
            (state / "accounts").rmdir()
            (state / "accounts").symlink_to(outside, target_is_directory=True)
        elif target == "child":
            (state / "accounts" / registry.root.key("account:303:404")).symlink_to(
                outside, target_is_directory=True,
            )
        else:
            child = state / "accounts" / registry.root.key("account:303:404")
            child.mkdir()
            (outside / "fake.sqlite3").touch()
            (child / "cedar-proof.sqlite3").symlink_to(outside / "fake.sqlite3")
    with pytest.raises(ValueError):
        AccountRegistry(config)


def test_symlink_ancestor_is_refused(config, tmp_path):
    from dataclasses import replace

    outside = tmp_path / "outside"
    outside.mkdir()
    (tmp_path / "alias").symlink_to(outside, target_is_directory=True)
    with pytest.raises(ValueError):
        AccountRegistry(replace(config, state_dir=str(tmp_path / "alias" / "private")))


def test_misnamed_child_account_is_refused_on_restart(config):
    registry = AccountRegistry(config)
    connect(registry)
    child = connect(registry, "303", "404")
    changed = child.get("connection")
    child.put("connection", {**changed, "phoneId": "999"})
    with pytest.raises(ValueError):
        AccountRegistry(config)
