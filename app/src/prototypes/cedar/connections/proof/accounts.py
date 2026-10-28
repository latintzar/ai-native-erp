"""Cedar-owned encrypted account stores and opaque browser sessions.

The service verifies Meta authority before selecting an account or granting its browser scope.
Existing root-store data stays in place; additional accounts have separate private databases.
"""

from __future__ import annotations

import hashlib
import math
import os
import re
import secrets
import stat
import threading
import time
from dataclasses import replace
from pathlib import Path

from storage import Store

TOKEN = re.compile(r"[A-Za-z0-9_-]{43}")
NAMESPACE = re.compile(r"[0-9a-f]{64}")
ASSET_ID = re.compile(r"[0-9]{1,40}")
UNBOUND_TTL = 30 * 60
BOUND_TTL = 8 * 60 * 60
SESSION_LIMIT = 1000


def private_directory(path: Path) -> None:
    if not path.is_absolute() or path.is_symlink() or path.resolve() != path:
        raise ValueError("Account state requires an absolute, ordinary directory path")
    if path.exists() and not path.is_dir():
        raise ValueError("Account state requires an ordinary directory")
    path.mkdir(parents=True, mode=0o700, exist_ok=True)
    if path.stat().st_uid != os.getuid():
        raise ValueError("Account state requires current-user ownership")
    path.chmod(0o700)
    database = path / "cedar-proof.sqlite3"
    if database.is_symlink():
        raise ValueError("Account database requires an ordinary file")
    if database.exists():
        info = database.stat()
        if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1 or info.st_uid != os.getuid():
            raise ValueError("Account database requires a private current-user-owned regular file")


class AccountRegistry:
    def __init__(self, config):
        self.config = config
        state = Path(config.state_dir).expanduser()
        private_directory(state)
        self.root = Store(config)
        self.accounts_path = state / "accounts"
        private_directory(self.accounts_path)
        self.lock = threading.RLock()
        self._children: dict[str, Store] = {}
        with self.root.db() as con:
            con.execute("CREATE TABLE IF NOT EXISTS proof_sessions (id TEXT PRIMARY KEY, body BLOB NOT NULL)")
        for path in sorted(self.accounts_path.iterdir()):
            if NAMESPACE.fullmatch(path.name) is None or path.is_symlink() or not path.is_dir():
                raise ValueError("Account store directory requires a valid private namespace")
            private_directory(path)
            store = Store(replace(config, state_dir=str(path)))
            connection = store.connection()
            if connection and self._connection_namespace(connection) != path.name:
                raise ValueError("Account store connection must match its private namespace")
            self._children[path.name] = store

    def _namespace(self, waba, phone):
        if (
            not isinstance(waba, str) or ASSET_ID.fullmatch(waba) is None
            or not isinstance(phone, str) or ASSET_ID.fullmatch(phone) is None
        ):
            raise ValueError("Account scope requires verified WhatsApp account and phone IDs")
        return self.root.key(f"account:{waba}:{phone}")

    def _connection_namespace(self, connection):
        return self._namespace(connection.get("wabaId"), connection.get("phoneId"))

    def stores(self):
        with self.lock:
            return [self.root, *self._children.values()]

    def for_account(self, waba, phone):
        namespace = self._namespace(waba, phone)
        with self.lock:
            connection = self.root.connection()
            if connection and self._connection_namespace(connection) == namespace:
                return self.root
            if namespace in self._children:
                store = self._children[namespace]
                current = store.connection()
                if current and self._connection_namespace(current) != namespace:
                    raise ValueError("Account store connection must match its private namespace")
                return store
            if connection is None:
                return self.root
            path = self.accounts_path / namespace
            private_directory(path)
            store = Store(replace(self.config, state_dir=str(path)))
            current = store.connection()
            if current and self._connection_namespace(current) != namespace:
                raise ValueError("Account store connection must match its private namespace")
            self._children[namespace] = store
            return store

    def _scope(self, store):
        if store not in self.stores():
            return None
        connection = store.connection()
        if not connection:
            return None
        try:
            namespace = self._connection_namespace(connection)
        except ValueError:
            return None
        if store is not self.root and self._children.get(namespace) is not store:
            return None
        return namespace

    def webhook_store(self, waba, phone=None):
        matches = [
            store for store in self.stores()
            if self._scope(store) and store.authorized()
            and store.connection()["wabaId"] == waba
            and (phone is None or store.connection()["phoneId"] == phone)
        ]
        return matches[0] if len(matches) == 1 else None

    def authorized_waba_stores(self, waba):
        return [
            store for store in self.stores()
            if self._scope(store) and store.authorized() and store.connection()["wabaId"] == waba
        ]

    def waba_stores(self, waba):
        """All exact WABA stores, including a lifecycle-suspended connection."""
        return [
            store for store in self.stores()
            if self._scope(store) and store.connection()["wabaId"] == waba
        ]

    @staticmethod
    def _identity(cookie):
        if not isinstance(cookie, str) or TOKEN.fullmatch(cookie) is None:
            return None
        return hashlib.sha256(cookie.encode()).hexdigest()

    def _session(self, body, identity, now):
        try:
            data = self.root.unseal(body)
            expires = data["expiresAt"]
            account = data["account"]
            if (
                isinstance(expires, bool) or not isinstance(expires, (int, float))
                or not math.isfinite(expires) or expires <= now
                or (account is not None and (
                    not isinstance(account, str) or NAMESPACE.fullmatch(account) is None
                ))
            ):
                return None
            return {"identity": identity, "account": account, "expiresAt": expires}
        except Exception:
            # Damaged encrypted session metadata never establishes access to an account.
            return None

    def _lookup(self, con, cookie, now):
        identity = self._identity(cookie)
        if identity is None:
            return None
        row = con.execute("SELECT body FROM proof_sessions WHERE id=?", (identity,)).fetchone()
        return self._session(row["body"], identity, now) if row else None

    def lookup(self, cookie):
        with self.root.db() as con:
            return self._lookup(con, cookie, time.time())

    def begin(self, cookie=None):
        now = time.time()
        with self.root.db() as con:
            con.execute("BEGIN IMMEDIATE")
            for row in con.execute("SELECT id, body FROM proof_sessions").fetchall():
                if self._session(row["body"], row["id"], now) is None:
                    con.execute("DELETE FROM proof_sessions WHERE id=?", (row["id"],))
            if self._lookup(con, cookie, now):
                return cookie
            if con.execute("SELECT COUNT(*) FROM proof_sessions").fetchone()[0] >= SESSION_LIMIT:
                raise ValueError("The browser session limit has been reached")
            token = secrets.token_urlsafe(32)
            con.execute("INSERT INTO proof_sessions VALUES (?, ?)", (
                self._identity(token), self.root.seal({"expiresAt": now + UNBOUND_TTL, "account": None}),
            ))
            return token

    def grant(self, cookie, store):
        namespace = self._scope(store)
        if namespace is None:
            raise ValueError("A bound account store is required for browser access")
        now = time.time()
        with self.root.db() as con:
            # Serializing lookup, replacement and deletion prevents concurrent grants from
            # turning one verified attempt into several independently valid browser sessions.
            con.execute("BEGIN IMMEDIATE")
            previous = self._lookup(con, cookie, now)
            if previous is None:
                raise ValueError("A valid browser session is required before granting account access")
            token = secrets.token_urlsafe(32)
            con.execute("INSERT INTO proof_sessions VALUES (?, ?)", (
                self._identity(token),
                self.root.seal({"expiresAt": now + BOUND_TTL, "account": namespace}),
            ))
            con.execute("DELETE FROM proof_sessions WHERE id=?", (previous["identity"],))
            return token

    def store_for_session(self, cookie):
        session = self.lookup(cookie)
        if not session or session["account"] is None:
            return None
        matches = [store for store in self.stores() if self._scope(store) == session["account"]]
        return matches[0] if len(matches) == 1 else None

    def invalidate(self, cookie):
        identity = self._identity(cookie)
        if identity:
            with self.root.db() as con:
                con.execute("DELETE FROM proof_sessions WHERE id=?", (identity,))

    def invalidate_account(self, store):
        namespace = self._scope(store)
        if namespace is None:
            return
        now = time.time()
        with self.root.db() as con:
            for row in con.execute("SELECT id, body FROM proof_sessions").fetchall():
                session = self._session(row["body"], row["id"], now)
                if session and session["account"] == namespace:
                    con.execute("DELETE FROM proof_sessions WHERE id=?", (row["id"],))
