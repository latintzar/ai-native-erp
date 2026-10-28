"""Private, encrypted capture and projection for one explicitly connected WhatsApp Business number.

Source lineage: backend/wa_coexistence.py; projection here is a separate, read-only Cedar experiment.
Raw payloads are durable before acknowledgment. No order, sending or production modules are imported.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import sqlite3
import threading
import time
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

from cryptography.fernet import Fernet

SIGNUP_DIAGNOSTIC_TTL = 7 * 24 * 60 * 60
SIGNUP_DIAGNOSTIC_LIMIT = 200
SIGNUP_DIAGNOSTIC_INPUT = (
    "attemptId", "event", "errorCode", "currentStep", "sessionId", "reportedAt",
)
SIGNUP_DIAGNOSTIC_FIELDS = (*SIGNUP_DIAGNOSTIC_INPUT, "receiptId", "observedAt", "source",
                            "appId", "configId", "graphVersion", "ownerHash")


def iso(timestamp):
    return datetime.fromtimestamp(int(timestamp), timezone.utc).isoformat().replace("+00:00", "Z")


def phone(value):
    return "".join(c for c in str(value or "") if c.isdigit())


def epoch(value, fallback=0):
    try:
        result = int(value)
        return result if 0 <= result <= 253402300799 else fallback
    except (TypeError, ValueError):
        return fallback


class MissingConversationIdentity(ValueError):
    def __init__(self, user_id=None):
        super().__init__("Message conversation identity required")
        self.user_id = user_id


class Store:
    def __init__(self, config):
        self.config = config
        directory = Path(config.state_dir).expanduser()
        if not directory.is_absolute() or directory.is_symlink():
            raise ValueError("Private state directory requires an absolute, ordinary path")
        directory.mkdir(mode=0o700, parents=True, exist_ok=True)
        if directory.stat().st_uid != os.getuid():
            raise ValueError("Private state directory requires current-user ownership")
        directory.chmod(0o700)
        self.path = directory / "cedar-proof.sqlite3"
        if self.path.is_symlink():
            raise ValueError("Private database requires an ordinary file")
        fd = os.open(self.path, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
        os.close(fd)
        self.path.chmod(0o600)
        self.cipher = Fernet(config.encryption_key.encode())
        self.hash_key = base64.urlsafe_b64decode(config.encryption_key)
        self.lock = threading.RLock()
        with self.db() as con:
            con.executescript("""
                CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, body BLOB NOT NULL);
                CREATE TABLE IF NOT EXISTS inbox (
                    id TEXT PRIMARY KEY, body BLOB NOT NULL, received REAL NOT NULL,
                    processed INTEGER NOT NULL DEFAULT 0, error TEXT NOT NULL DEFAULT '');
                CREATE TABLE IF NOT EXISTS messages (
                    id TEXT PRIMARY KEY, conversation TEXT NOT NULL, timestamp INTEGER NOT NULL,
                    body BLOB NOT NULL, arrival INTEGER NOT NULL DEFAULT 0);
                CREATE INDEX IF NOT EXISTS message_timeline ON messages(conversation,timestamp,id);
                CREATE TABLE IF NOT EXISTS contacts (id TEXT PRIMARY KEY, body BLOB NOT NULL);
                CREATE TABLE IF NOT EXISTS operations (id TEXT PRIMARY KEY, body BLOB NOT NULL);
                CREATE TABLE IF NOT EXISTS identity_waits (
                    event TEXT PRIMARY KEY, identity TEXT NOT NULL);
                CREATE INDEX IF NOT EXISTS identity_wait_lookup ON identity_waits(identity);
            """)
            columns = {row["name"] for row in con.execute("PRAGMA table_info(messages)").fetchall()}
            if "arrival" not in columns:
                con.execute("ALTER TABLE messages ADD COLUMN arrival INTEGER NOT NULL DEFAULT 0")
            sentinel = self.get("encryption-check", con)
            if sentinel is None:
                self.put("encryption-check", {"format": 1}, con)

    @contextmanager
    def db(self):
        with self.lock:
            con = sqlite3.connect(self.path, timeout=15)
            con.row_factory = sqlite3.Row
            # FULL + rollback journal means successful capture survives process interruption.
            con.execute("PRAGMA synchronous=FULL")
            try:
                with con:
                    yield con
            finally:
                con.close()

    def seal(self, data):
        return self.cipher.encrypt(json.dumps(data, ensure_ascii=False).encode())

    def unseal(self, data):
        return json.loads(self.cipher.decrypt(data))

    def key(self, value):
        return hmac.new(self.hash_key, str(value).encode(), hashlib.sha256).hexdigest()

    def get(self, key, con=None):
        if con is None:
            with self.db() as connection:
                return self.get(key, connection)
        row = con.execute("SELECT body FROM kv WHERE key=?", (key,)).fetchone()
        return self.unseal(row[0]) if row else None

    def put(self, key, value, con=None):
        if con is None:
            with self.db() as connection:
                return self.put(key, value, connection)
        con.execute(
            "INSERT INTO kv VALUES (?,?) ON CONFLICT(key) DO UPDATE SET body=excluded.body",
            (key, self.seal(value)),
        )

    def delete(self, key, con=None):
        if con is None:
            with self.db() as connection:
                return self.delete(key, connection)
        con.execute("DELETE FROM kv WHERE key=?", (key,))

    def signup_diagnostics(self, now=None):
        """Read-only operator projection of private, browser-reported signup metadata."""
        now = time.time() if now is None else now
        records = self.get("signup-diagnostics") or []
        return [
            {key: row[key] for key in SIGNUP_DIAGNOSTIC_FIELDS if key in row}
            for row in records if row["observedAt"] > now - SIGNUP_DIAGNOSTIC_TTL
        ][-SIGNUP_DIAGNOSTIC_LIMIT:]

    def prune_signup_diagnostics(self, now=None):
        now = time.time() if now is None else now
        with self.db() as con:
            con.execute("BEGIN IMMEDIATE")
            stored = self.get("signup-diagnostics", con)
            if stored is None:
                return
            retained = [row for row in stored if row["observedAt"] > now - SIGNUP_DIAGNOSTIC_TTL]
            retained = retained[-SIGNUP_DIAGNOSTIC_LIMIT:]
            if retained != stored:
                self.put("signup-diagnostics", retained, con)

    def record_signup_diagnostic(self, data, *, owner, config, now=None):
        """Capture an allowlisted report once; authorization and account stores stay separate."""
        now = time.time() if now is None else now
        owner_hash = self.key("signup-diagnostic-owner:" + owner)
        receipt_id = self.key(f"signup-diagnostic:{owner_hash}:{data['attemptId']}:{data['event']}")
        with self.db() as con:
            # The transaction also bounds concurrent writers from separate Store instances.
            con.execute("BEGIN IMMEDIATE")
            stored = self.get("signup-diagnostics", con) or []
            rows = [row for row in stored if row["observedAt"] > now - SIGNUP_DIAGNOSTIC_TTL]
            rows = rows[-SIGNUP_DIAGNOSTIC_LIMIT:]
            if rows != stored:
                self.put("signup-diagnostics", rows, con)
            if any(row["receiptId"] == receipt_id for row in rows):
                return {"receiptId": receipt_id}
            recent = [row for row in rows if row["observedAt"] > now - 60]
            if len(recent) >= 100 or sum(row["ownerHash"] == owner_hash for row in recent) >= 10:
                return None
            record = {key: data[key] for key in SIGNUP_DIAGNOSTIC_INPUT if key in data}
            record.update(
                receiptId=receipt_id, observedAt=now, source="browser_reported", ownerHash=owner_hash,
                appId=config.app_id, configId=config.config_id, graphVersion=config.graph_version,
            )
            self.put("signup-diagnostics", [*rows, record][-SIGNUP_DIAGNOSTIC_LIMIT:], con)
        return {"receiptId": receipt_id}

    def bind(self, connection, token, history_requested, activate=True):
        with self.db() as con:
            now = time.time()
            existing = self.get("connection", con)
            if existing:
                if (existing["wabaId"], existing["phoneId"]) != (connection["wabaId"], connection["phoneId"]):
                    raise ValueError("This private proof already belongs to another connection")
                self.put(
                    "connection",
                    {
                        **existing,
                        **{key: value for key, value in connection.items() if key != "workspace"},
                        "active": bool(activate),
                        **({
                            "authorizedAt": now,
                            "authorizationEpoch": str(time.time_ns()),
                        } if activate else {}),
                    },
                    con,
                )
                self.put("token", token, con)
                return
            self.put(
                "connection",
                {
                    **connection,
                    "connectedAt": now,
                    "authorizedAt": now,
                    "authorizationEpoch": str(time.time_ns()),
                    "active": True,
                    "historyRequested": history_requested,
                },
                con,
            )
            self.put("token", token, con)
            self.put("history", {"status": "waiting" if history_requested else "idle", "progress": None}, con)

    def reauthorize(self, token):
        """Refresh provider authority without moving the live intake boundary."""
        with self.db() as con:
            connection = self.get("connection", con)
            if not connection:
                raise ValueError("Connection binding required")
            now = time.time()
            self.put("token", token, con)
            self.put(
                "connection",
                {
                    **connection,
                    "active": True,
                    "authorizedAt": now,
                    "authorizationEpoch": str(time.time_ns()),
                },
                con,
            )

    def activate(self):
        """Open a new live epoch after a disconnected provider subscription is verified."""
        with self.db() as con:
            connection = self.get("connection", con)
            if not connection or not self.get("token", con):
                raise ValueError("Provider authorization required")
            now = time.time()
            self.put("connection", {
                **connection,
                "active": True,
                "authorizedAt": now,
                "authorizationEpoch": str(time.time_ns()),
            }, con)

    def apply_lifecycle(self, action, occurred_at):
        """Apply one ordered signed provider lifecycle change to this authorization epoch."""
        priority = {"resume": 1, "suspend": 2, "disconnect": 3}.get(action, 0)
        if priority == 0:
            return False
        with self.db() as con:
            connection = self.get("connection", con)
            if not connection:
                return False
            try:
                latest = int(connection.get("lifecycleAt", 0))
                authorized = int(connection.get("authorizedAt", connection.get("connectedAt", 0)))
                previous_priority = int(connection.get("lifecyclePriority", 0))
            except (TypeError, ValueError):
                return False
            if occurred_at < latest or occurred_at < authorized:
                return False
            if occurred_at == latest and priority <= previous_priority:
                return False
            if action == "disconnect":
                self.put(
                    "connection",
                    {
                        **connection,
                        "active": False,
                        "disconnectedAt": time.time(),
                        "lifecycleAt": occurred_at,
                        "lifecyclePriority": priority,
                        "lifecycleEvent": "terminal",
                    },
                    con,
                )
                self.delete("token", con)
                return True
            if action == "suspend":
                if not self.get("token", con):
                    return False
                self.put(
                    "connection",
                    {
                        **connection,
                        "active": False,
                        "suspendedAt": time.time(),
                        "lifecycleAt": occurred_at,
                        "lifecyclePriority": priority,
                        "lifecycleEvent": "ACCOUNT_OFFBOARDED",
                    },
                    con,
                )
                return True
            if action == "resume":
                # Reconnect is recorded but cannot revive a stale browser/provider grant. The
                # user completes a fresh Meta handoff, which opens its own authorization epoch.
                self.put(
                    "connection",
                    {
                        **connection,
                        "lifecycleAt": occurred_at,
                        "lifecyclePriority": priority,
                        "lifecycleEvent": "ACCOUNT_RECONNECTED",
                    },
                    con,
                )
                return True

    def connection(self):
        data = self.get("connection")
        fields = ("wabaId", "phoneId", "number", "name", "coexistence")
        if not data:
            return None
        connection = {field: data[field] for field in fields}
        if data.get("workspace"):
            connection["workspace"] = data["workspace"]
        return connection

    def authorized(self):
        connection = self.get("connection")
        return bool(connection and connection.get("active", True) and self.get("token"))

    def active_connection(self):
        return self.connection() if self.authorized() else None

    def disconnect(self):
        """Remove provider authority while retaining this account's durable Cedar association."""
        with self.db() as con:
            connection = self.get("connection", con)
            if not connection:
                return
            self.put(
                "connection",
                {**connection, "active": False, "disconnectedAt": time.time()},
                con,
            )
            self.delete("token", con)

    def bind_workspace(self, workspace):
        """Fill an account's one durable workspace association; changing it needs operator review."""
        with self.db() as con:
            connection = self.get("connection", con)
            if not connection:
                raise ValueError("Connection binding required")
            if connection.get("workspace") and connection["workspace"] != workspace:
                raise ValueError("Workspace binding already exists")
            if not connection.get("workspace"):
                self.put("connection", {**connection, "workspace": workspace}, con)

    def claim(self, operation):
        with self.db() as con:
            result = con.execute(
                "INSERT OR IGNORE INTO operations VALUES (?,?)",
                (operation, self.seal({"state": "attempted", "attemptedAt": time.time()})),
            )
            return result.rowcount == 1

    def operation(self, operation):
        with self.db() as con:
            row = con.execute("SELECT body FROM operations WHERE id=?", (operation,)).fetchone()
            return self.unseal(row[0]) if row else None

    def outcome(self, operation, success, request_id="", error=""):
        with self.db() as con:
            current = self.operation(operation) or {}
            current.update(
                state="accepted" if success else "interrupted",
                requestId=request_id,
                error=error,
                updatedAt=time.time(),
            )
            con.execute("UPDATE operations SET body=? WHERE id=?", (self.seal(current), operation))
            if not success and operation == "history":
                state = self.get("history", con) or {}
                if state.get("status") not in {"complete", "declined"}:
                    self.put("history", {**state, "status": "interrupted"}, con)

    def history(self):
        with self.db() as con:
            state = self.get("history", con) or {"status": "idle", "progress": None}
            connection = self.get("connection", con)
            pending, failed = con.execute(
                "SELECT COUNT(*), COALESCE(SUM(error<>''),0) FROM inbox WHERE processed=0"
            ).fetchone()
            operation = self.operation("history")
            timed_out = connection and time.time() - connection["connectedAt"] > 24 * 60 * 60
            uncertain = (
                operation
                and operation["state"] == "attempted"
                and (time.time() - operation["attemptedAt"] > 90)
            )
            # Provider progress and local projection are different facts. A shuffled chunk may
            # arrive after progress=100; preserve that progress while exposing local unfinished work.
            if failed and state["status"] != "declined":
                state = {**state, "status": "interrupted"}
            elif pending and state["status"] == "complete":
                state = {**state, "status": "syncing"}
            elif state["status"] in {"waiting", "syncing"} and (timed_out or uncertain):
                state = {**state, "status": "interrupted"}
            counts = con.execute(
                "SELECT COUNT(*), COUNT(DISTINCT conversation), MIN(timestamp), MAX(timestamp) FROM messages"
            ).fetchone()
            return {
                **state,
                "messages": counts[0],
                "conversations": counts[1],
                "oldestAt": iso(counts[2]) if counts[2] is not None else None,
                "newestAt": iso(counts[3]) if counts[3] is not None else None,
            }

    def capture(self, raw):
        payload = json.loads(raw)
        digest = self.key(raw.hex())
        with self.db() as con:
            connection = self.get("connection", con)
            if (
                not connection
                or not connection.get("active", True)
                or not self.get("token", con)
                or payload.get("object") != "whatsapp_business_account"
            ):
                raise ValueError("Webhook connection binding required")
            entries = payload.get("entry")
            if not isinstance(entries, list) or not entries:
                raise ValueError("Webhook entries required")
            for entry in entries:
                if str(entry.get("id")) != connection["wabaId"]:
                    raise ValueError("Webhook WABA binding mismatch")
                for change in entry.get("changes", []):
                    value = change.get("value") or {}
                    number_id = (value.get("metadata") or {}).get("phone_number_id")
                    # WABA-level account updates carry no phone. Message/history fields must.
                    if change.get("field") == "account_update" and number_id is None:
                        continue
                    if str(number_id) != connection["phoneId"]:
                        raise ValueError("Webhook phone binding mismatch")
            con.execute(
                "INSERT OR IGNORE INTO inbox (id,body,received) VALUES (?,?,?)",
                (digest, self.seal(payload), time.time()),
            )
        return digest

    def drain(self):
        """Project durable pending events; transaction rollback preserves the raw retry evidence."""
        while True:
            with self.db() as con:
                row = con.execute(
                    "SELECT rowid AS arrival,* FROM inbox WHERE processed=0 AND error='' "
                    "ORDER BY received,rowid LIMIT 1"
                ).fetchone()
            if row is None:
                return
            try:
                with self.db() as con:
                    payload = self.unseal(row["body"])
                    for entry in payload["entry"]:
                        for change in entry.get("changes", []):
                            self.project(
                                con, change["field"], change["value"],
                                row["received"], row["arrival"],
                            )
                    con.execute("UPDATE inbox SET processed=1 WHERE id=?", (row["id"],))
                    con.execute("DELETE FROM identity_waits WHERE event=?", (row["id"],))
            except Exception as error:
                # Type only: exception messages can contain a private body or token.
                with self.db() as con:
                    con.execute("UPDATE inbox SET error=? WHERE id=?", (type(error).__name__, row["id"]))
                    identity = self.contact_identity_key(error.user_id) if isinstance(
                        error, MissingConversationIdentity
                    ) else None
                    con.execute("DELETE FROM identity_waits WHERE event=?", (row["id"],))
                    if identity:
                        evidence = self.get(identity, con)
                        if evidence and evidence.get("number") and not evidence.get("ambiguous"):
                            # Contact evidence can arrive between projection rollback and this index write.
                            con.execute("UPDATE inbox SET error='' WHERE id=?", (row["id"],))
                        else:
                            con.execute("INSERT INTO identity_waits VALUES (?,?)", (row["id"], identity))

    def contact_identity_key(self, user_id):
        # Provider user IDs are opaque: preserve their exact spelling and never extract digits.
        if not isinstance(user_id, str) or not 1 <= len(user_id) <= 512:
            return None
        return "contact-user:" + self.key(user_id)

    def remember_contact_identity(self, con, user_id, number):
        identity = self.contact_identity_key(user_id)
        number = phone(number)
        if not identity or not number:
            return False
        if not con.in_transaction:
            con.execute("BEGIN IMMEDIATE")
        previous = self.get(identity, con)
        if previous and (previous.get("ambiguous") or previous.get("number") == number):
            return False
        # Conflicting provider evidence stays ambiguous; subsequent arrivals cannot choose a winner.
        current = {"ambiguous": True} if previous else {"number": number, "ambiguous": False}
        self.put(identity, current, con)
        if not current["ambiguous"]:
            con.execute(
                "UPDATE inbox SET error='' WHERE processed=0 AND error='MissingConversationIdentity' "
                "AND id IN (SELECT event FROM identity_waits WHERE identity=?)", (identity,),
            )
            con.execute("DELETE FROM identity_waits WHERE identity=?", (identity,))
        return True

    def contact_identity_number(self, con, user_id):
        identity = self.contact_identity_key(user_id)
        evidence = self.get(identity, con) if identity else None
        if evidence and evidence.get("ambiguous"):
            raise MissingConversationIdentity(user_id)
        return evidence.get("number") if evidence else None

    def backfill_contact_identities(self):
        """Explicit local repair from retained signed contact events; provider requests stay untouched."""
        changed = 0
        with self.db() as con:
            for row in con.execute("SELECT body FROM inbox WHERE processed=1 ORDER BY received").fetchall():
                payload = self.unseal(row["body"])
                for entry in payload.get("entry", []):
                    for change in entry.get("changes", []):
                        if change.get("field") != "smb_app_state_sync":
                            continue
                        for item in change.get("value", {}).get("state_sync", []):
                            contact = item.get("contact") or {}
                            if item.get("type") == "contact":
                                changed += self.remember_contact_identity(
                                    con, contact.get("user_id"), contact.get("phone_number"),
                                )
        return changed

    def contact(self, con, number, name, timestamp, removed=False, user_id=None):
        number = phone(number)
        if not number:
            return
        self.remember_contact_identity(con, user_id, number)
        key = self.key(number)
        row = con.execute("SELECT body FROM contacts WHERE id=?", (key,)).fetchone()
        previous = self.unseal(row[0]) if row else {}
        if previous.get("timestamp", -1) > timestamp:
            return
        data = {
            "number": number,
            "name": name or previous.get("name", ""),
            "timestamp": timestamp,
            "removed": removed,
        }
        con.execute(
            "INSERT INTO contacts VALUES (?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body",
            (key, self.seal(data)),
        )

    def project(self, con, field, value, received, arrival):
        if field == "smb_app_state_sync":
            for item in value.get("state_sync", []):
                if item.get("type") == "contact":
                    contact = item.get("contact") or {}
                    self.contact(
                        con,
                        contact.get("phone_number"),
                        contact.get("full_name") or contact.get("first_name") or "",
                        epoch((item.get("metadata") or {}).get("timestamp"), int(received)),
                        item.get("action") == "remove",
                        contact.get("user_id"),
                    )
        elif field == "history":
            state = self.get("history", con) or {"status": "waiting", "progress": None}
            errors = list(value.get("errors") or [])
            for chunk in value.get("history", []):
                errors.extend(chunk.get("errors") or [])
                metadata = chunk.get("metadata") or {}
                if "progress" in metadata:
                    progress = max(state.get("progress") or 0, min(100, epoch(metadata["progress"])))
                    state["progress"] = progress
                    if state["status"] != "declined":
                        state["status"] = "complete" if progress == 100 else "syncing"
                for thread in chunk.get("threads", []):
                    for message in thread.get("messages", []):
                        self.upsert_message(
                            con, message, True, thread.get("id"), "thread",
                            (thread.get("context") or {}).get("user_id"), arrival,
                        )
            for message in value.get("messages", []):
                self.upsert_message(con, message, True, None, "asset", arrival=arrival)
            if any(epoch(error.get("code")) == 2593109 for error in errors):
                state["status"] = "declined"
            elif errors and state["status"] != "declined":
                state["status"] = "interrupted"
            self.put("history", state, con)
        elif field in {"messages", "smb_message_echoes"}:
            for contact in value.get("contacts", []):
                self.contact(
                    con, contact.get("wa_id"), (contact.get("profile") or {}).get("name", ""), int(received)
                )
            key = "message_echoes" if field == "smb_message_echoes" else "messages"
            for message in value.get(key, []):
                self.upsert_message(
                    con, message, False, None,
                    "echo" if key == "message_echoes" else "live", arrival=arrival,
                )

    def upsert_message(
        self, con, incoming, historical, thread_id, source, thread_user_id=None, arrival=0,
    ):
        provider_id = str(incoming.get("id") or "")
        if not provider_id:
            raise ValueError("Provider message ID required")
        key = self.key(provider_id)
        row = con.execute("SELECT * FROM messages WHERE id=?", (key,)).fetchone()
        previous = self.unseal(row["body"]) if row else {}
        connection = self.get("connection", con)
        sender = phone(incoming.get("from"))
        outbound = source == "echo" or sender == phone(connection["number"])
        if not thread_id and source == "thread":
            thread_id = self.contact_identity_number(con, thread_user_id)
        counterpart = phone(thread_id or (incoming.get("to") if outbound else incoming.get("from")))
        # History thread metadata is authoritative when a delayed asset carries conflicting fields.
        authoritative = source in {"thread", "live", "echo"}
        if previous.get("authoritative") and not authoritative:
            counterpart, outbound = previous["number"], previous["direction"] == "outbound"
        if not counterpart:
            counterpart = previous.get("number", "")
        if not counterpart:
            raise MissingConversationIdentity(thread_user_id)
        kind = str(incoming.get("type") or "unknown")
        content = incoming.get(kind) or {}
        if not isinstance(content, dict):
            content = {}
        text = str(content.get("body") or content.get("caption") or content.get("filename") or "")
        # Placeholders arriving after asset metadata must enrich the same row, never erase the asset.
        if kind == "media_placeholder" and previous.get("kind") not in {None, "media_placeholder"}:
            kind, text, content = previous["kind"], previous["text"], previous.get("content", {})
        timestamp = epoch(incoming.get("timestamp"), previous.get("epoch", 0))
        if previous.get("authoritative") and not authoritative:
            timestamp = previous["epoch"]
        data = {
            "id": provider_id,
            "number": counterpart,
            "direction": "outbound" if outbound else "inbound",
            "text": text or previous.get("text", ""),
            "kind": kind,
            "epoch": timestamp,
            "timestamp": iso(timestamp),
            "historical": historical or previous.get("historical", False),
            "mediaAvailable": False,
            "content": content,
            "authoritative": authoritative or previous.get("authoritative", False),
        }
        con.execute(
            "INSERT INTO messages (id,conversation,timestamp,body,arrival) VALUES (?,?,?,?,?) "
            "ON CONFLICT(id) DO UPDATE SET "
            "conversation=excluded.conversation,timestamp=excluded.timestamp,body=excluded.body",
            (key, self.key(counterpart), timestamp, self.seal(data), arrival),
        )

    def conversations(self):
        with self.db() as con:
            rows = con.execute("SELECT conversation, COUNT(*) AS count FROM messages GROUP BY conversation")
            output = []
            for row in rows.fetchall():
                last = con.execute(
                    "SELECT body FROM messages WHERE conversation=? ORDER BY timestamp DESC,id DESC LIMIT 1",
                    (row["conversation"],),
                ).fetchone()
                data = self.unseal(last[0])
                contact = con.execute(
                    "SELECT body FROM contacts WHERE id=?", (row["conversation"],)
                ).fetchone()
                name = self.unseal(contact[0]).get("name", "") if contact else ""
                output.append(
                    {
                        "id": row["conversation"],
                        "name": name or data["number"],
                        "number": data["number"],
                        "lastMessage": data["text"] or data["kind"],
                        "lastAt": data["timestamp"],
                        "count": row["count"],
                    }
                )
            return sorted(output, key=lambda item: item["lastAt"], reverse=True)

    def messages(self, conversation, before, limit):
        with self.db() as con:
            clauses, args = ["conversation=?"], [conversation]
            if before:
                try:
                    cursor = self.unseal(before.encode())
                    if cursor["conversation"] != conversation:
                        raise ValueError("Cursor conversation mismatch")
                    clauses.append("(timestamp<? OR (timestamp=? AND id<?))")
                    args.extend((cursor["timestamp"], cursor["timestamp"], cursor["id"]))
                except Exception as error:
                    raise ValueError("Valid conversation cursor required") from error
            rows = con.execute(
                "SELECT * FROM messages WHERE "
                + " AND ".join(clauses)
                + " ORDER BY timestamp DESC,id DESC LIMIT ?",
                (*args, limit + 1),
            ).fetchall()
            selected = rows[:limit]
            next_cursor = None
            if len(rows) > limit:
                end = selected[-1]
                next_cursor = self.seal(
                    {"conversation": conversation, "timestamp": end["timestamp"], "id": end["id"]}
                ).decode()
            fields = ("id", "direction", "text", "kind", "timestamp", "historical", "mediaAvailable")
            return {
                "messages": [
                    {key: self.unseal(row["body"])[key] for key in fields} for row in reversed(selected)
                ],
                "nextCursor": next_cursor,
            }

    def intake(self, after, limit):
        """Forward-only order candidates from live inbound text for this verified account.

        The account's first verified bind is the durable time lower bound. A SQLite arrival
        sequence provides the forward watermark, so delayed provider timestamps remain visible.
        Imported history is excluded by retained provenance. The cursor advances over every
        scanned row so outbound/media traffic cannot stall intake.
        """
        with self.db() as con:
            connection = self.get("connection", con)
            if not connection or not connection.get("active", True) or not self.get("token", con):
                return {"messages": [], "nextCursor": None}
            workspace = connection.get("workspace")
            if not workspace:
                raise ValueError("Workspace binding required")
            start = int(connection.get("authorizedAt") or connection.get("connectedAt") or 0)
            authorization_epoch = str(connection.get("authorizationEpoch") or "legacy")
            cursor_arrival, cursor_id = 0, ""
            if after:
                try:
                    cursor = self.unseal(after.encode())
                    if cursor.get("kind") != "intake":
                        raise ValueError("Cursor kind mismatch")
                    if (
                        cursor.get("wabaId") != connection["wabaId"]
                        or cursor.get("phoneId") != connection["phoneId"]
                        or cursor.get("authorizationEpoch", "legacy") != authorization_epoch
                    ):
                        raise ValueError("Cursor account mismatch")
                    cursor_arrival = max(0, int(cursor["arrival"]))
                    cursor_id = str(cursor["id"])
                except Exception as error:
                    raise ValueError("Valid intake cursor required") from error

            output = []
            scanned_arrival, scanned_id = cursor_arrival, cursor_id
            # Read bounded chunks because direction/provenance remain inside encrypted rows.
            while len(output) < limit:
                rows = con.execute(
                    "SELECT * FROM messages WHERE (arrival>? OR (arrival=? AND id>?)) "
                    "ORDER BY arrival ASC,id ASC LIMIT 200",
                    (scanned_arrival, scanned_arrival, scanned_id),
                ).fetchall()
                if not rows:
                    break
                for row in rows:
                    scanned_arrival, scanned_id = row["arrival"], row["id"]
                    data = self.unseal(row["body"])
                    if (
                        data.get("epoch", 0) < start
                        or data.get("direction") != "inbound"
                        or data.get("historical") is not False
                        or data.get("kind") != "text"
                        or not str(data.get("text") or "").strip()
                    ):
                        continue
                    contact = con.execute(
                        "SELECT body FROM contacts WHERE id=?", (row["conversation"],)
                    ).fetchone()
                    name = self.unseal(contact[0]).get("name", "") if contact else ""
                    item = {
                            "id": data["id"],
                            "conversationId": row["conversation"],
                            "name": name or data["number"],
                            "number": data["number"],
                            "text": data["text"],
                            "timestamp": data["timestamp"],
                            "historical": False,
                        }
                    resolve_customer = getattr(self.config, "customer_for", None)
                    customer_id = resolve_customer(
                        connection["wabaId"], connection["phoneId"], data["number"], workspace
                    ) if callable(resolve_customer) else ""
                    if customer_id:
                        item["customerId"] = customer_id
                    output.append(item)
                    if len(output) == limit:
                        break
                if len(rows) < 200 or len(output) == limit:
                    break

            moved = (scanned_arrival, scanned_id) != (cursor_arrival, cursor_id)
            next_cursor = self.seal(
                {
                    "kind": "intake", "wabaId": connection["wabaId"],
                    "phoneId": connection["phoneId"], "authorizationEpoch": authorization_epoch,
                    "arrival": scanned_arrival,
                    "id": scanned_id,
                }
            ).decode() if moved else after
            return {"workspace": workspace, "messages": output, "nextCursor": next_cursor}
