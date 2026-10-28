"""Private mailbox aliases only: raw bodies, subjects and attachment bytes stay transient."""

from __future__ import annotations

import hashlib
import os
import re
import secrets
import sqlite3
import time
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator

from fastapi import HTTPException


def opaque(prefix: str) -> str:
    return prefix + secrets.token_urlsafe(24)


class EmailStore:
    def __init__(self, path: Path):
        self.path = path

    @contextmanager
    def db(self) -> Iterator[sqlite3.Connection]:
        self.path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        fd = os.open(self.path, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
        os.close(fd)
        conn = sqlite3.connect(self.path, timeout=10)
        self.path.chmod(0o600)
        conn.row_factory = sqlite3.Row
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS email_attempts (digest TEXT PRIMARY KEY, workspace TEXT NOT NULL,
          scope TEXT NOT NULL, provider TEXT NOT NULL, expires REAL NOT NULL, used INTEGER DEFAULT 0,
          return_to TEXT NOT NULL DEFAULT 'settings');
        CREATE TABLE IF NOT EXISTS email_accounts (ref TEXT PRIMARY KEY, workspace TEXT NOT NULL,
          provider_id TEXT UNIQUE NOT NULL, provider TEXT NOT NULL, scope TEXT NOT NULL,
          mode TEXT NOT NULL DEFAULT 'connected', status TEXT NOT NULL, revision INTEGER DEFAULT 0,
          cursor TEXT, offset INTEGER DEFAULT 0, history_complete INTEGER DEFAULT 0,
          synced_at TEXT, consent_at TEXT, forwarding_address TEXT,
          owner_address TEXT NOT NULL DEFAULT '');
        CREATE INDEX IF NOT EXISTS email_workspace ON email_accounts(workspace);
        CREATE TABLE IF NOT EXISTS email_sources (ref TEXT PRIMARY KEY, account_ref TEXT NOT NULL,
          provider_id TEXT NOT NULL, thread_id TEXT, at TEXT NOT NULL, revision INTEGER DEFAULT 1,
          UNIQUE(account_ref,provider_id));
        CREATE TABLE IF NOT EXISTS email_attachments (ref TEXT PRIMARY KEY, source_ref TEXT NOT NULL,
          provider_id TEXT NOT NULL, UNIQUE(source_ref,provider_id));
        CREATE TABLE IF NOT EXISTS email_webhooks (digest TEXT PRIMARY KEY, at REAL NOT NULL);
        CREATE TABLE IF NOT EXISTS email_thread_pages (ref TEXT PRIMARY KEY, workspace TEXT NOT NULL,
          account_ref TEXT NOT NULL, source_ref TEXT NOT NULL, after_id TEXT NOT NULL, expires REAL NOT NULL,
          UNIQUE(workspace,source_ref,after_id));
        CREATE TABLE IF NOT EXISTS email_customer_bindings (workspace TEXT NOT NULL,
          provider_id TEXT NOT NULL, address TEXT NOT NULL, customer_id TEXT NOT NULL,
          PRIMARY KEY(workspace,provider_id,address));
        CREATE TABLE IF NOT EXISTS email_binding_profiles (workspace TEXT NOT NULL,
          provider TEXT NOT NULL, owner_address TEXT NOT NULL, address TEXT NOT NULL,
          customer_id TEXT NOT NULL, PRIMARY KEY(workspace,provider,owner_address,address));
        CREATE TABLE IF NOT EXISTS email_intake_events (sequence INTEGER PRIMARY KEY AUTOINCREMENT,
          workspace TEXT NOT NULL, account_ref TEXT NOT NULL, source_ref TEXT NOT NULL,
          source_revision INTEGER NOT NULL, occurred_at TEXT NOT NULL,
          UNIQUE(workspace,account_ref,source_ref,source_revision));
        CREATE INDEX IF NOT EXISTS email_intake_workspace
          ON email_intake_events(workspace,sequence);
        CREATE TABLE IF NOT EXISTS email_sends (receipt_ref TEXT PRIMARY KEY, workspace TEXT NOT NULL,
          source_ref TEXT NOT NULL, idempotency_key TEXT NOT NULL, provider_id TEXT NOT NULL,
          at TEXT NOT NULL, UNIQUE(workspace,idempotency_key));
        """)
        if "return_to" not in {row[1] for row in conn.execute("PRAGMA table_info(email_attempts)")}:
            conn.execute("ALTER TABLE email_attempts ADD COLUMN return_to TEXT NOT NULL DEFAULT 'settings'")
        if "owner_address" not in {row[1] for row in conn.execute("PRAGMA table_info(email_accounts)")}:
            conn.execute("ALTER TABLE email_accounts ADD COLUMN owner_address TEXT NOT NULL DEFAULT ''")
        columns = {row[1] for row in conn.execute("PRAGMA table_info(email_accounts)")}
        # `live_since` is the moment the mailbox was connected: mail dated after it is an arrival,
        # mail before it is history. `pulled_at` is the last filtered pull.
        if "live_since" not in columns:
            conn.execute("ALTER TABLE email_accounts ADD COLUMN live_since TEXT")
        # Gmail hands out a different attachment id on every read path (list, thread, single
        # message), so a file is recognised inside its message by a digest of its name and type;
        # the store keeps the digest, never the name, and the provider id seen last.
        attachment_columns = {
            row[1] for row in conn.execute("PRAGMA table_info(email_attachments)").fetchall()
        }
        if "identity" not in attachment_columns:
            conn.execute("ALTER TABLE email_attachments ADD COLUMN identity TEXT NOT NULL DEFAULT ''")
        if "pulled_at" not in columns:
            conn.execute("ALTER TABLE email_accounts ADD COLUMN pulled_at TEXT")
        try:
            with conn:
                yield conn
        finally:
            conn.close()

    def accounts(self, workspace: str) -> list[dict[str, Any]]:
        with self.db() as db:
            return [
                dict(row)
                for row in db.execute("SELECT * FROM email_accounts WHERE workspace=?", (workspace,))
            ]

    def account(self, workspace: str, ref: str) -> dict[str, Any]:
        with self.db() as db:
            row = db.execute(
                "SELECT * FROM email_accounts WHERE workspace=? AND ref=?", (workspace, ref)
            ).fetchone()
        if row is None:
            raise HTTPException(404, "Mailbox source unavailable.")
        return dict(row)

    def remove_account(self, workspace: str, ref: str) -> None:
        """Forget one provider account and every opaque alias Cedar derived from it."""
        with self.db() as db:
            row = db.execute(
                "SELECT ref,provider_id FROM email_accounts WHERE workspace=? AND ref=?",
                (workspace, ref),
            ).fetchone()
            if row is None:
                raise HTTPException(404, "Mailbox source unavailable.")
            db.execute(
                "DELETE FROM email_attachments WHERE source_ref IN "
                "(SELECT ref FROM email_sources WHERE account_ref=?)",
                (ref,),
            )
            db.execute("DELETE FROM email_thread_pages WHERE account_ref=?", (ref,))
            db.execute("DELETE FROM email_intake_events WHERE account_ref=?", (ref,))
            db.execute(
                "DELETE FROM email_sends WHERE source_ref IN "
                "(SELECT ref FROM email_sources WHERE account_ref=?)",
                (ref,),
            )
            db.execute("DELETE FROM email_sources WHERE account_ref=?", (ref,))
            db.execute(
                "DELETE FROM email_customer_bindings WHERE workspace=? AND provider_id=?",
                (workspace, row["provider_id"]),
            )
            db.execute("DELETE FROM email_accounts WHERE workspace=? AND ref=?", (workspace, ref))

    def bind_customer(
        self, workspace: str, provider_id: str, provider: str, owner_address: str,
        address: str, customer_id: str,
    ) -> None:
        with self.db() as db:
            db.execute(
                "INSERT INTO email_customer_bindings VALUES(?,?,?,?) "
                "ON CONFLICT(workspace,provider_id,address) DO UPDATE SET customer_id=excluded.customer_id",
                (workspace, provider_id, address, customer_id),
            )
            if owner_address:
                db.execute(
                    "INSERT INTO email_binding_profiles VALUES(?,?,?,?,?) "
                    "ON CONFLICT(workspace,provider,owner_address,address) "
                    "DO UPDATE SET customer_id=excluded.customer_id",
                    (workspace, provider, owner_address, address, customer_id),
                )

    def bound_addresses(self, workspace: str, provider_id: str) -> list[str]:
        """The customer addresses this workspace explicitly bound for one provider account."""
        with self.db() as db:
            return [
                str(row["address"])
                for row in db.execute(
                    "SELECT address FROM email_customer_bindings WHERE workspace=? AND provider_id=? "
                    "ORDER BY address",
                    (workspace, provider_id),
                )
            ]

    def customer_for(self, workspace: str, provider_id: str, address: str) -> str | None:
        with self.db() as db:
            row = db.execute(
                "SELECT customer_id FROM email_customer_bindings "
                "WHERE workspace=? AND provider_id=? AND address=?",
                (workspace, provider_id, address),
            ).fetchone()
        return str(row["customer_id"]) if row else None

    def enqueue_intake(
        self, workspace: str, account_ref: str, source_ref: str, revision: int, occurred_at: str
    ) -> bool:
        """True when this source revision entered the queue now; a repeat has no effect."""
        with self.db() as db:
            inserted = db.execute(
                "INSERT OR IGNORE INTO email_intake_events"
                "(workspace,account_ref,source_ref,source_revision,occurred_at) VALUES(?,?,?,?,?)",
                (workspace, account_ref, source_ref, revision, occurred_at),
            ).rowcount
        return inserted == 1

    def reserve_send(self, workspace: str, source_ref: str, idempotency_key: str) -> tuple[str, str]:
        """Claim the key: `new` with a fresh receipt, `sent` with the earlier receipt, or `pending`
        while another request holds it."""
        ref = opaque("sent_")
        with self.db() as db:
            db.execute("BEGIN IMMEDIATE")
            row = db.execute(
                "SELECT receipt_ref, provider_id FROM email_sends WHERE workspace=? AND idempotency_key=?",
                (workspace, idempotency_key),
            ).fetchone()
            if row is not None:
                return str(row["receipt_ref"]), "sent" if row["provider_id"] else "pending"
            db.execute(
                "INSERT INTO email_sends VALUES(?,?,?,?,?,?)",
                (ref, workspace, source_ref, idempotency_key, "", datetime.now(timezone.utc).isoformat()),
            )
        return ref, "new"

    def complete_send(self, receipt_ref: str, provider_id: str) -> None:
        with self.db() as db:
            db.execute("UPDATE email_sends SET provider_id=? WHERE receipt_ref=?", (provider_id, receipt_ref))

    def abandon_send(self, receipt_ref: str) -> None:
        with self.db() as db:
            db.execute("DELETE FROM email_sends WHERE receipt_ref=? AND provider_id=''", (receipt_ref,))

    def pull_targets(self) -> list[dict[str, Any]]:
        """Every connected mailbox with the customer addresses its workspace knows."""
        with self.db() as db:
            accounts = [
                dict(row)
                for row in db.execute("SELECT * FROM email_accounts WHERE mode='connected' ORDER BY ref")
            ]
            for account in accounts:
                account["addresses"] = [
                    str(row["address"])
                    for row in db.execute(
                        "SELECT address FROM email_customer_bindings WHERE workspace=? AND provider_id=? "
                        "ORDER BY address",
                        (account["workspace"], account["provider_id"]),
                    )
                ]
        return accounts

    def mark_pulled(self, ref: str, stamp: str, live_since: str | None = None) -> None:
        with self.db() as db:
            if live_since:
                db.execute(
                    "UPDATE email_accounts SET pulled_at=?, live_since=COALESCE(live_since, ?) WHERE ref=?",
                    (stamp, live_since, ref),
                )
            else:
                db.execute("UPDATE email_accounts SET pulled_at=? WHERE ref=?", (stamp, ref))

    def intake(self, workspace: str, after: int, limit: int) -> list[dict[str, Any]]:
        with self.db() as db:
            return [
                dict(row)
                for row in db.execute(
                    "SELECT * FROM email_intake_events WHERE workspace=? AND sequence>? "
                    "ORDER BY sequence LIMIT ?",
                    (workspace, after, limit),
                )
            ]

    def thread_page(self, workspace: str, account_ref: str, source_ref: str, after_id: str) -> str:
        """Continuation stores only the private provider anchor, never thread content."""
        with self.db() as db:
            db.execute("DELETE FROM email_thread_pages WHERE expires<?", (time.time(),))
            db.execute(
                "INSERT OR IGNORE INTO email_thread_pages VALUES(?,?,?,?,?,?)",
                (opaque("page_"), workspace, account_ref, source_ref, after_id, time.time() + 1800),
            )
            row = db.execute(
                "SELECT ref FROM email_thread_pages WHERE workspace=? AND source_ref=? AND after_id=?",
                (workspace, source_ref, after_id),
            ).fetchone()
        return str(row["ref"])

    def thread_anchor(self, workspace: str, account_ref: str, source_ref: str, cursor: str) -> str:
        with self.db() as db:
            row = db.execute(
                "SELECT after_id FROM email_thread_pages WHERE ref=? AND workspace=? AND account_ref=? "
                "AND source_ref=? AND expires>?",
                (cursor, workspace, account_ref, source_ref, time.time()),
            ).fetchone()
        if row is None:
            raise HTTPException(404, "Reopen this thread to continue its history.")
        return str(row["after_id"])

    def attempt(
        self, workspace: str, scope: str, provider: str, state: str, return_to: str = "settings"
    ) -> None:
        with self.db() as db:
            db.execute("DELETE FROM email_attempts WHERE expires<?", (time.time(),))
            db.execute(
                "INSERT INTO email_attempts(digest,workspace,scope,provider,expires,return_to) "
                "VALUES(?,?,?,?,?,?)",
                (
                    hashlib.sha256(state.encode()).hexdigest(),
                    workspace,
                    scope,
                    provider,
                    time.time() + 600,
                    return_to,
                ),
            )

    def pending(self, state: str) -> dict[str, Any]:
        with self.db() as db:
            row = db.execute(
                "SELECT * FROM email_attempts WHERE digest=? AND expires>? AND used=0",
                (hashlib.sha256(state.encode()).hexdigest(), time.time()),
            ).fetchone()
        if row is None:
            raise HTTPException(400, "Start a new mailbox connection.")
        return dict(row)

    def bind(self, pending: dict[str, Any], account: dict[str, Any]) -> str:
        if (
            account.get("account_scope_id") != pending["scope"]
            or account.get("provider") != pending["provider"]
            or not str(account.get("id", "")).startswith("acc_")
        ):
            raise HTTPException(403, "This mailbox belongs to a different connection attempt.")
        ref = opaque("mail_")
        try:
            with self.db() as db:
                changed = db.execute(
                    "UPDATE email_attempts SET used=1 WHERE digest=? AND used=0 AND expires>?",
                    (pending["digest"], time.time()),
                ).rowcount
                if changed != 1:
                    raise HTTPException(400, "Start a new mailbox connection.")
                owner_address = str(account.get("name", "")).strip().lower()
                if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", owner_address):
                    owner_address = ""
                db.execute(
                    "INSERT INTO email_accounts"
                    "(ref,workspace,provider_id,provider,scope,status,owner_address,live_since) "
                    "VALUES(?,?,?,?,?,?,?,?)",
                    (
                        ref,
                        pending["workspace"],
                        account["id"],
                        account["provider"],
                        pending["scope"],
                        account["status"],
                        owner_address,
                        datetime.now(timezone.utc).isoformat(),
                    ),
                )
                if owner_address:
                    db.execute(
                        "INSERT OR IGNORE INTO email_customer_bindings "
                        "SELECT workspace,?,address,customer_id FROM email_binding_profiles "
                        "WHERE workspace=? AND provider=? AND owner_address=?",
                        (account["id"], pending["workspace"], account["provider"], owner_address),
                    )
        except sqlite3.IntegrityError:
            raise HTTPException(409, "This mailbox already has a connection.") from None
        return ref

    def source(self, account_ref: str, message: dict[str, Any]) -> str:
        identifier = message.get("id")
        if not isinstance(identifier, str) or not identifier or len(identifier) > 2048:
            raise HTTPException(502, "The mailbox returned an invalid source.")
        with self.db() as db:
            db.execute(
                "INSERT OR IGNORE INTO email_sources(ref,account_ref,provider_id,thread_id,at) "
                "VALUES(?,?,?,?,?)",
                (
                    opaque("src_"),
                    account_ref,
                    identifier,
                    message.get("thread_id"),
                    str(message.get("date", ""))[:80],
                ),
            )
            row = db.execute(
                "SELECT ref FROM email_sources WHERE account_ref=? AND provider_id=?",
                (account_ref, identifier),
            ).fetchone()
            return str(row["ref"])

    @staticmethod
    def attachment_digest(source_ref: str, name: str, content_type: str, ordinal: int) -> str:
        return hashlib.sha256(f"{source_ref}\0{name}\0{content_type}\0{ordinal}".encode()).hexdigest()

    def attachment(self, source_ref: str, identifier: str, identity: str = "") -> str:
        with self.db() as db:
            row = db.execute(
                "SELECT ref FROM email_attachments WHERE source_ref=? AND provider_id=?",
                (source_ref, identifier),
            ).fetchone()
            if row is None and identity:
                row = db.execute(
                    "SELECT ref FROM email_attachments WHERE source_ref=? AND identity=?",
                    (source_ref, identity),
                ).fetchone()
            if row is None:
                ref = opaque("att_")
                db.execute(
                    "INSERT INTO email_attachments(ref,source_ref,provider_id,identity) VALUES(?,?,?,?)",
                    (ref, source_ref, identifier, identity),
                )
                return ref
            db.execute(
                "UPDATE email_attachments SET provider_id=?,identity=? WHERE ref=?",
                (identifier, identity, row["ref"]),
            )
            return str(row["ref"])

    def attachment_identity(self, source_ref: str, ref: str) -> dict[str, str] | None:
        with self.db() as db:
            row = db.execute(
                "SELECT provider_id,identity FROM email_attachments WHERE ref=? AND source_ref=?",
                (ref, source_ref),
            ).fetchone()
        return {key: str(row[key]) for key in ("provider_id", "identity")} if row else None

    def resolve(self, workspace: str, ref: str) -> tuple[dict[str, Any], dict[str, Any]]:
        with self.db() as db:
            source = db.execute("SELECT * FROM email_sources WHERE ref=?", (ref,)).fetchone()
        if source is None:
            raise HTTPException(404, "Mailbox source unavailable.")
        return self.account(workspace, source["account_ref"]), dict(source)
