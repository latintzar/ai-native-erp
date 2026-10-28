from __future__ import annotations

import hashlib
import json
import secrets
import sqlite3
import threading
import time
import uuid
from contextlib import contextmanager
from dataclasses import asdict
from pathlib import Path
from typing import Any, Iterator

from cryptography.fernet import Fernet

from .contracts import Checkout, PaymentObservation


class StoreError(Exception):
    pass


class Store:
    def __init__(self, path: Path, encryption_key: str) -> None:
        self.path = path
        self.cipher = Fernet(encryption_key.encode())
        self.lock = threading.RLock()
        path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        with self.connect() as db:
            db.executescript("""
                PRAGMA journal_mode=WAL;
                CREATE TABLE IF NOT EXISTS sellers (
                    id TEXT PRIMARY KEY, name TEXT NOT NULL, provider TEXT NOT NULL,
                    environment TEXT NOT NULL, payload BLOB NOT NULL, created REAL NOT NULL
                );
                CREATE TABLE IF NOT EXISTS requests (
                    id TEXT PRIMARY KEY, seller_id TEXT NOT NULL REFERENCES sellers(id),
                    idempotency TEXT NOT NULL, fingerprint TEXT NOT NULL,
                    document_id TEXT NOT NULL,
                    phase TEXT NOT NULL DEFAULT 'draft', status TEXT NOT NULL DEFAULT 'pending',
                    payload BLOB NOT NULL, checkout BLOB, last_error TEXT NOT NULL DEFAULT '',
                    created REAL NOT NULL, updated REAL NOT NULL, last_sync REAL,
                    UNIQUE(seller_id, idempotency), UNIQUE(seller_id, document_id)
                );
                CREATE TABLE IF NOT EXISTS allocations (
                    seller_id TEXT NOT NULL, provider_id TEXT NOT NULL,
                    request_id TEXT NOT NULL, PRIMARY KEY(seller_id, provider_id)
                );
                CREATE TABLE IF NOT EXISTS observations (
                    request_id TEXT NOT NULL, provider_id TEXT NOT NULL, status TEXT NOT NULL,
                    payload BLOB NOT NULL, created REAL NOT NULL,
                    UNIQUE(request_id, provider_id, status)
                );
                CREATE TABLE IF NOT EXISTS jobs (
                    id TEXT PRIMARY KEY, request_id TEXT NOT NULL,
                    payload BLOB NOT NULL, done INTEGER NOT NULL DEFAULT 0,
                    attempts INTEGER NOT NULL DEFAULT 0, next_attempt REAL NOT NULL DEFAULT 0,
                    last_error TEXT NOT NULL DEFAULT '', created REAL NOT NULL
                );
                CREATE TABLE IF NOT EXISTS oauth_states (
                    id TEXT PRIMARY KEY, binding TEXT NOT NULL, payload BLOB NOT NULL,
                    expires REAL NOT NULL
                );
            """)
        path.chmod(0o600)

    @contextmanager
    def connect(self) -> Iterator[sqlite3.Connection]:
        db = sqlite3.connect(self.path, timeout=15)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys=ON")
        db.execute("PRAGMA busy_timeout=15000")
        try:
            with db:
                yield db
        finally:
            db.close()

    def encrypt(self, payload: Any) -> bytes:
        return self.cipher.encrypt(json.dumps(payload, separators=(",", ":"), sort_keys=True).encode())

    def decrypt(self, payload: bytes) -> Any:
        return json.loads(self.cipher.decrypt(payload))

    def add_seller(self, name: str, provider: str, environment: str,
                   credentials: dict[str, str]) -> dict[str, Any]:
        if provider not in {"izipay", "mercadopago", "flow"} or environment not in {"sandbox", "live"}:
            raise StoreError("invalid_connection")
        seller_id = str(uuid.uuid4())
        with self.lock, self.connect() as db:
            db.execute("INSERT INTO sellers VALUES (?,?,?,?,?,?)",
                       (seller_id, name, provider, environment, self.encrypt(credentials), time.time()))
        return self.seller(seller_id)

    def seller(self, seller_id: str) -> dict[str, Any]:
        with self.connect() as db:
            row = db.execute("SELECT * FROM sellers WHERE id=?", (seller_id,)).fetchone()
        if row is None:
            raise StoreError("seller_missing")
        data = dict(row)
        data["credentials"] = self.decrypt(data.pop("payload"))
        return data

    def sellers(self) -> list[dict[str, Any]]:
        with self.connect() as db:
            ids = [row[0] for row in db.execute("SELECT id FROM sellers ORDER BY created DESC")]
        return [self.seller(seller_id) for seller_id in ids]

    def update_credentials(self, seller_id: str, credentials: dict[str, str]) -> None:
        with self.lock, self.connect() as db:
            changed = db.execute("UPDATE sellers SET payload=? WHERE id=?",
                                 (self.encrypt(credentials), seller_id)).rowcount
            if changed != 1:
                raise StoreError("seller_missing")

    def add_request(self, seller_id: str, idempotency: str, data: dict[str, Any]) -> dict[str, Any]:
        self.seller(seller_id)
        fingerprint = hashlib.sha256(json.dumps(data, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
        with self.lock, self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            old = db.execute("SELECT id,fingerprint FROM requests WHERE seller_id=? AND idempotency=?",
                             (seller_id, idempotency)).fetchone()
            if old:
                if old["fingerprint"] != fingerprint:
                    raise StoreError("idempotency_conflict")
                request_id = old["id"]
            else:
                if db.execute("SELECT 1 FROM requests WHERE seller_id=? AND document_id=?",
                              (seller_id, data["document_id"])).fetchone():
                    raise StoreError("document_request_exists")
                request_id = str(uuid.uuid4())
                data = {**data, "public_token": secrets.token_urlsafe(32),
                        "webhook_token": secrets.token_urlsafe(32),
                        "charge_key": str(uuid.uuid4()), "charge_phase": "idle"}
                now = time.time()
                db.execute("""INSERT INTO requests
                    (id,seller_id,idempotency,fingerprint,document_id,payload,created,updated)
                    VALUES (?,?,?,?,?,?,?,?)""",
                    (request_id, seller_id, idempotency, fingerprint, data["document_id"], self.encrypt(data), now, now))
        return self.request(request_id)

    def request(self, request_id: str) -> dict[str, Any]:
        with self.connect() as db:
            row = db.execute("SELECT * FROM requests WHERE id=?", (request_id,)).fetchone()
        if row is None:
            raise StoreError("request_missing")
        item = dict(row)
        payload = self.decrypt(item.pop("payload"))
        item["checkout"] = self.decrypt(item["checkout"]) if item["checkout"] else None
        return {**payload, **item}

    def requests(self, limit: int | None = 500) -> list[dict[str, Any]]:
        with self.connect() as db:
            ids = [r[0] for r in db.execute("SELECT id FROM requests ORDER BY created DESC LIMIT ?", (limit or -1,))]
        return [self.request(request_id) for request_id in ids]

    def claim_creation(self, request_id: str) -> bool:
        with self.lock, self.connect() as db:
            return db.execute("UPDATE requests SET phase='creating',updated=? WHERE id=? AND phase='draft'",
                              (time.time(), request_id)).rowcount == 1

    def set_checkout(self, request_id: str, checkout: Checkout) -> None:
        with self.lock, self.connect() as db:
            db.execute("UPDATE requests SET checkout=?,phase='ready',last_error='',updated=? WHERE id=?",
                       (self.encrypt(asdict(checkout)), time.time(), request_id))

    def creation_failed(self, request_id: str, code: str, *, uncertain: bool) -> None:
        with self.lock, self.connect() as db:
            db.execute("UPDATE requests SET phase=?,last_error=?,updated=? WHERE id=?",
                       ("uncertain" if uncertain else "error", code, time.time(), request_id))

    def sync_failed(self, request_id: str, code: str) -> None:
        with self.lock, self.connect() as db:
            db.execute("UPDATE requests SET last_error=?,updated=? WHERE id=?",
                       (code, time.time(), request_id))

    def recover_inflight(self) -> None:
        with self.lock, self.connect() as db:
            db.execute("UPDATE requests SET phase='uncertain',last_error='creation_recovery_required' WHERE phase='creating'")

    def claim_charge(self, request_id: str) -> str:
        with self.lock, self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            row = db.execute("SELECT payload,status FROM requests WHERE id=?", (request_id,)).fetchone()
            if row is None:
                raise StoreError("request_missing")
            data = self.decrypt(row["payload"])
            allocated = db.execute("SELECT 1 FROM allocations WHERE request_id=?", (request_id,)).fetchone()
            if allocated or row["status"] in {"paid", "refunded"} or data["charge_phase"] != "idle":
                raise StoreError("charge_already_started")
            data["charge_phase"] = "processing"
            db.execute("UPDATE requests SET payload=?,updated=? WHERE id=?",
                       (self.encrypt(data), time.time(), request_id))
            return data["charge_key"]

    def apply(self, request_id: str, observed: PaymentObservation) -> bool:
        with self.lock, self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            row = db.execute("SELECT * FROM requests WHERE id=?", (request_id,)).fetchone()
            if row is None:
                raise StoreError("request_missing")
            request = self.decrypt(row["payload"])
            seller = db.execute("SELECT * FROM sellers WHERE id=?", (row["seller_id"],)).fetchone()
            credentials = self.decrypt(seller["payload"])
            merchant = credentials.get("collector_id") or credentials.get("merchant_id") or credentials.get("merchant_code")
            if (observed.reference != request_id or observed.amount_minor != request["amount_minor"]
                    or observed.currency != request["currency"] or not observed.provider_id
                    or (merchant and observed.merchant_id != str(merchant))):
                raise StoreError("payment_mismatch")
            existing_paid = db.execute("SELECT provider_id FROM allocations WHERE request_id=?", (request_id,)).fetchone()
            if existing_paid and existing_paid["provider_id"] != observed.provider_id:
                if observed.status == "paid":
                    raise StoreError("additional_payment_requires_review")
                if observed.status in {"refunded", "cancelled"}:
                    raise StoreError("reversal_payment_mismatch")
            if observed.status in {"paid", "refunded"}:
                allocation = db.execute("SELECT request_id FROM allocations WHERE seller_id=? AND provider_id=?",
                                        (row["seller_id"], observed.provider_id)).fetchone()
                if allocation and allocation["request_id"] != request_id:
                    raise StoreError("payment_already_allocated")
                db.execute("INSERT OR IGNORE INTO allocations VALUES (?,?,?)",
                           (row["seller_id"], observed.provider_id, request_id))
            previous = row["status"]
            next_status = observed.status
            if (previous == "refunded" or (previous == "cancelled" and existing_paid)
                    or (previous == "paid" and next_status not in {"refunded", "cancelled"})):
                next_status = previous
            fresh = False
            if next_status != "pending":
                inserted = db.execute("INSERT OR IGNORE INTO observations VALUES (?,?,?,?,?)",
                           (request_id, observed.provider_id, next_status,
                            self.encrypt(asdict(observed)), time.time()))
                fresh = inserted.rowcount == 1
            if (fresh and request.get("checkout_mode") == "yape" and not existing_paid
                    and next_status in {"failed", "cancelled"}):
                # The rejection and retry state commit together. An old rejection must
                # never unlock a different attempt that is already processing.
                request["charge_phase"] = "idle"
                request["charge_key"] = str(uuid.uuid4())
                db.execute("UPDATE requests SET payload=? WHERE id=?", (self.encrypt(request), request_id))
            now = time.time()
            db.execute("UPDATE requests SET status=?,last_error='',last_sync=?,updated=? WHERE id=?",
                       (next_status, now, now, request_id))
            return fresh

    def observations(self, request_id: str) -> list[dict[str, Any]]:
        with self.connect() as db:
            rows = db.execute("SELECT payload FROM observations WHERE request_id=? ORDER BY created", (request_id,))
            return [self.decrypt(row["payload"]) for row in rows]

    def enqueue(self, request_id: str, payload: str) -> str:
        job_id = hashlib.sha256((request_id + "\n" + payload).encode()).hexdigest()
        with self.lock, self.connect() as db:
            db.execute("INSERT OR IGNORE INTO jobs (id,request_id,payload,created) VALUES (?,?,?,?)",
                       (job_id, request_id, self.encrypt(payload), time.time()))
            db.execute("UPDATE jobs SET done=0,attempts=0,next_attempt=0,last_error='' WHERE id=? AND done=1", (job_id,))
        return job_id

    def jobs(self) -> list[dict[str, Any]]:
        with self.connect() as db:
            rows = db.execute("SELECT * FROM jobs WHERE done=0 AND attempts<12 AND next_attempt<=? ORDER BY created LIMIT 50",
                              (time.time(),)).fetchall()
        return [{**dict(row), "payload": self.decrypt(row["payload"])} for row in rows]

    def finish_job(self, job_id: str) -> None:
        with self.lock, self.connect() as db:
            db.execute("UPDATE jobs SET done=1 WHERE id=?", (job_id,))

    def fail_job(self, job_id: str, code: str) -> None:
        with self.lock, self.connect() as db:
            row = db.execute("SELECT attempts FROM jobs WHERE id=?", (job_id,)).fetchone()
            if row:
                attempts = row["attempts"] + 1
                db.execute("UPDATE jobs SET attempts=?,next_attempt=?,last_error=? WHERE id=?",
                           (attempts, time.time() + min(300, 2 ** attempts), code, job_id))

    def create_oauth(self, payload: dict[str, Any], binding: str) -> str:
        state = secrets.token_urlsafe(32)
        with self.lock, self.connect() as db:
            db.execute("DELETE FROM oauth_states WHERE expires<?", (time.time(),))
            db.execute("INSERT INTO oauth_states VALUES (?,?,?,?)",
                       (hashlib.sha256(state.encode()).hexdigest(), binding,
                        self.encrypt(payload), time.time() + 600))
        return state

    def consume_oauth(self, state: str, binding: str) -> dict[str, Any]:
        state_id = hashlib.sha256(state.encode()).hexdigest()
        with self.lock, self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            row = db.execute("SELECT * FROM oauth_states WHERE id=?", (state_id,)).fetchone()
            if (row is None or row["expires"] < time.time()
                    or not secrets.compare_digest(row["binding"], binding)):
                raise StoreError("oauth_state_invalid")
            db.execute("DELETE FROM oauth_states WHERE id=?", (state_id,))
            return self.decrypt(row["payload"])
