"""Persistent Cedar workspaces and invoice collection ledgers, isolated from legacy gateways."""

from __future__ import annotations

import hashlib
import hmac
import json
import secrets
import sqlite3
import time
import uuid
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable, Iterator

from cryptography.fernet import Fernet

from .cedar_amounts import quote_values, quoted_rounding, receipt_principal, refresh_quote
from .store import StoreError


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def fingerprint(value: Any) -> str:
    return hashlib.sha256(
        json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()
    ).hexdigest()


class CedarStore:
    def __init__(self, path: Path, encryption_key: str) -> None:
        self.path = path
        self.cipher = Fernet(encryption_key.encode())
        path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        with self.connect() as db:
            db.execute("PRAGMA journal_mode=WAL")
            db.execute(
                "CREATE TABLE IF NOT EXISTS workspaces (id TEXT PRIMARY KEY, "
                "token_hash TEXT UNIQUE NOT NULL, created REAL NOT NULL, payload BLOB NOT NULL)"
            )
            db.execute(
                "CREATE TABLE IF NOT EXISTS public_requests (id TEXT PRIMARY KEY, "
                "workspace_id TEXT NOT NULL, token_hash TEXT NOT NULL)"
            )
            db.execute(
                "CREATE TABLE IF NOT EXISTS bank_monitors "
                "(workspace_id TEXT PRIMARY KEY, next_due REAL NOT NULL)"
            )
            db.execute("CREATE INDEX IF NOT EXISTS bank_monitors_due ON bank_monitors(next_due)")
            db.execute(
                "CREATE TABLE IF NOT EXISTS fiscal_series_owners "
                "(mode TEXT, seller_ruc TEXT, series TEXT, workspace_id TEXT NOT NULL, "
                "PRIMARY KEY (mode,seller_ruc,series))"
            )
            db.execute(
                "CREATE TABLE IF NOT EXISTS fiscal_pending "
                "(workspace_id TEXT PRIMARY KEY, next_due REAL NOT NULL)"
            )
        path.chmod(0o600)

    @contextmanager
    def connect(self) -> Iterator[sqlite3.Connection]:
        db = sqlite3.connect(self.path, timeout=15)
        db.row_factory = sqlite3.Row
        try:
            with db:
                yield db
        finally:
            db.close()

    def encode(self, value: Any) -> bytes:
        return self.cipher.encrypt(
            json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()
        )

    def decode(self, value: bytes) -> dict[str, Any]:
        return json.loads(self.cipher.decrypt(value))

    def create_workspace(self, scope: str = "") -> dict[str, str]:
        """`scope` is the Cedar house this workspace belongs to. The browser states it when it
        creates the workspace, and the seeded bank answers that house's own ledger (FEED-IA §251)."""
        workspace_id, token = str(uuid.uuid4()), secrets.token_urlsafe(32)
        state = {
            "id": workspace_id,
            "mode": "sample",
            "scope": scope,
            "setup": {},
            "requests": {},
            "idempotency": {},
            "providers": {},
            "bank": {},
            "movements": {},
            "documents": {},
        }
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            if db.execute("SELECT COUNT(*) FROM workspaces").fetchone()[0] >= 10000:
                raise StoreError("workspace_capacity")
            db.execute(
                "INSERT INTO workspaces VALUES (?,?,?,?)",
                (workspace_id, hashlib.sha256(token.encode()).hexdigest(), time.time(), self.encode(state)),
            )
        return {"id": workspace_id, "token": token, "mode": "sample"}

    def rollover_fixture(self, workspace_id: str, from_day: str, to_day: str) -> dict[str, str]:
        """Archive a wholly synthetic book atomically with its new, idempotent owner binding."""
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            row = db.execute("SELECT payload FROM workspaces WHERE id=?", (workspace_id,)).fetchone()
            if not row:
                raise StoreError("workspace_missing")
            state = self.decode(row["payload"])
            prior = state.get("fixture_rollover")
            if prior:
                if prior["day"] == to_day and prior["from_day"] == from_day:
                    return prior["workspace"]
                raise StoreError("fixture_calendar_retained")
            if (state["mode"] != "sample" or state["providers"] or state["bank"] or state["documents"]
                    or state["movements"] or state.get("fiscal_series")
                    or any(not item.get("fixture_owned") or item.get("fixture_day") != from_day
                           or item.get("commissioned_at") or item.get("destination") or item.get("billing_draft")
                           or item.get("merchant_action_at")
                           or any(not r.get("opening") or r["source"] != "sample" for r in item["receipts"])
                           for item in state["requests"].values())):
                raise StoreError("fixture_calendar_retained")
            if db.execute("SELECT COUNT(*) FROM workspaces").fetchone()[0] >= 10000:
                raise StoreError("workspace_capacity")
            new_id, token = str(uuid.uuid4()), secrets.token_urlsafe(32)
            fresh = {"id": new_id, "mode": "sample", "scope": state["scope"], "setup": {}, "requests": {},
                     "idempotency": {}, "providers": {}, "bank": {}, "movements": {}, "documents": {}}
            result = {"id": new_id, "token": token, "mode": "sample"}
            state["fixture_rollover"] = {"day": to_day, "from_day": from_day, "workspace": result, "at": now_iso()}
            db.execute("INSERT INTO workspaces VALUES (?,?,?,?)", (new_id, hashlib.sha256(token.encode()).hexdigest(), time.time(), self.encode(fresh)))
            db.execute("UPDATE workspaces SET payload=? WHERE id=?", (self.encode(state), workspace_id))
            db.execute("DELETE FROM public_requests WHERE workspace_id=?", (workspace_id,))
            return result

    def authenticate(self, token: str) -> str:
        if not 32 <= len(token) <= 256:
            raise StoreError("workspace_access_required")
        with self.connect() as db:
            row = db.execute(
                "SELECT id FROM workspaces WHERE token_hash=?", (hashlib.sha256(token.encode()).hexdigest(),)
            ).fetchone()
        if not row:
            raise StoreError("workspace_access_required")
        return str(row["id"])

    def read(self, workspace_id: str) -> dict[str, Any]:
        with self.connect() as db:
            row = db.execute("SELECT payload FROM workspaces WHERE id=?", (workspace_id,)).fetchone()
        if not row:
            raise StoreError("workspace_missing")
        return self.decode(row["payload"])

    def mutate(self, workspace_id: str, change: Callable[[dict[str, Any]], Any]) -> Any:
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            row = db.execute("SELECT payload FROM workspaces WHERE id=?", (workspace_id,)).fetchone()
            if not row:
                raise StoreError("workspace_missing")
            state = self.decode(row["payload"])
            if state.get("fixture_rollover"):
                raise StoreError("fixture_calendar_archived")
            result = change(state)
            for series, configuration in state.get("fiscal_series", {}).items():
                binding = (configuration["mode"], configuration["seller_ruc"], series)
                db.execute(
                    "INSERT OR IGNORE INTO fiscal_series_owners VALUES (?,?,?,?)", (*binding, workspace_id)
                )
                assigned = db.execute(
                    "SELECT workspace_id FROM fiscal_series_owners "
                    "WHERE mode=? AND seller_ruc=? AND series=?",
                    binding,
                ).fetchone()
                if assigned["workspace_id"] != workspace_id:
                    raise StoreError("invoice_series_already_bound")
            pending = any(
                record.get("auto_issue_after_payment")
                and record.get("owner_authorized")
                and record["phase"] == "authorized"
                and self.totals(state["requests"][record["request_id"]])["confirmed_minor"]
                == state["requests"][record["request_id"]]["invoice_amount_minor"]
                for record in state["documents"].values()
            )
            if pending:
                db.execute(
                    "INSERT INTO fiscal_pending VALUES (?,?) ON CONFLICT(workspace_id) "
                    "DO UPDATE SET next_due=excluded.next_due",
                    (workspace_id, state.get("fiscal_retry_at", 0)),
                )
            else:
                db.execute("DELETE FROM fiscal_pending WHERE workspace_id=?", (workspace_id,))
            encoded = self.encode(state)
            if len(encoded) > 8_000_000:
                raise StoreError("workspace_capacity")
            db.execute("UPDATE workspaces SET payload=? WHERE id=?", (encoded, workspace_id))
            monitor = state["bank"].get("monitor", {})
            if monitor.get("enabled") and monitor.get("next_due") is not None:
                db.execute(
                    "INSERT INTO bank_monitors VALUES (?,?) ON CONFLICT(workspace_id) "
                    "DO UPDATE SET next_due=excluded.next_due",
                    (workspace_id, monitor["next_due"]),
                )
            else:
                db.execute("DELETE FROM bank_monitors WHERE workspace_id=?", (workspace_id,))
            for item in state["requests"].values():
                db.execute(
                    "INSERT OR IGNORE INTO public_requests VALUES (?,?,?)",
                    (item["id"], workspace_id, hashlib.sha256(item["public_token"].encode()).hexdigest()),
                )
        return result

    def due_monitors(self, stamp: float) -> list[str]:
        with self.connect() as db:
            return [
                str(row["workspace_id"])
                for row in db.execute(
                    "SELECT workspace_id FROM bank_monitors WHERE next_due<=? ORDER BY next_due LIMIT 10",
                    (stamp,),
                )
            ]

    def due_fiscal(self, stamp: float) -> list[str]:
        with self.connect() as db:
            return [
                str(row["workspace_id"])
                for row in db.execute(
                    "SELECT workspace_id FROM fiscal_pending WHERE next_due<=? ORDER BY next_due LIMIT 10",
                    (stamp,),
                )
            ]

    def workspaces(self) -> list[dict[str, Any]]:
        with self.connect() as db:
            rows = db.execute(
                "SELECT id,created,payload FROM workspaces ORDER BY created DESC LIMIT 200"
            ).fetchall()
        return [
            {
                "id": row["id"],
                "created": row["created"],
                "mode": "sample",
                "request_count": len(self.decode(row["payload"])["requests"]),
            }
            for row in rows
        ]

    @staticmethod
    def item(state: dict[str, Any], request_id: str) -> dict[str, Any]:
        item = state["requests"].get(request_id)
        if not item:
            raise StoreError("request_missing")
        return item

    @staticmethod
    def totals(item: dict[str, Any]) -> dict[str, int | str]:
        sums = {
            source: sum(
                receipt_principal(row)
                for row in item["receipts"]
                if row["status"] == "matched" and row["source"] == source
            )
            for source in ("sample", "manual", "prometeo")
        }
        paid = sum(sums.values())
        balance = max(0, item["invoice_amount_minor"] - paid)
        return {
            "balance_minor": balance,
            "amount_minor": balance,
            "sample_minor": sums["sample"],
            "manual_minor": sums["manual"],
            "confirmed_minor": sums["prometeo"],
            "status": "paid" if balance == 0 else "partial" if paid else "pending",
        }

    def safe_request(self, item: dict[str, Any], origin: str, *, public: bool = False) -> dict[str, Any]:
        keys = (
            "id",
            "invoice_id",
            "document_id",
            "seller_name",
            "customer_name",
            "description",
            "currency",
            "receiving_bank",
            "account_label",
            "reference",
            "invoice_amount_minor",
            "created_at",
        )
        result = {key: item[key] for key in keys}
        result.update(self.totals(item))
        result.update(quote_values(item))
        result["rounding_received_minor"] = sum(row.get("rounding_minor", 0) for row in item["receipts"] if row["status"] == "matched")
        for source, label in [("sample", "sample"), ("manual", "manual"), ("prometeo", "confirmed")]:
            result[f"{label}_received_minor"] = sum(row["amount_minor"] for row in item["receipts"]
                if row["status"] == "matched" and row["source"] == source)
        result.update(mode="sample", buyer_url=f"{origin}/collect/{item['id']}/{item['public_token']}")
        destination = item.get("destination")
        result["destination"] = (
            {key: destination[key] for key in ("method", "phone", "account_mask", "mode")}
            if destination
            else None
        )
        if not public:
            result["receipts"] = [
                {key: value for key, value in receipt.items() if key != "bank_account"}
                for receipt in item["receipts"]
            ]
            result["billing_draft"] = item.get("billing_draft")
            result["commercial_document"] = item.get("commercial_document")
            result["commercial_fingerprint"] = fingerprint(item["commercial_document"]) if item.get("commercial_document") else None
        else:
            result["timeline"] = [
                {
                    **{key: row[key] for key in ("amount_minor", "currency", "method", "source", "status", "created_at")},
                    "effective_at": row["created_at"] if row["source"] == "prometeo" or row.get("opening")
                    else row.get("received_at", row["created_at"]),
                }
                for row in item["receipts"][-30:]
            ]
        return result

    @staticmethod
    def add_receipt(state: dict[str, Any], item: dict[str, Any], receipt: dict[str, Any], *, opening: bool = False) -> None:
        if item.get("commissioned_at") and receipt["source"] == "sample":
            raise StoreError("commissioned_payment_evidence_required")
        # One reference in a workspace cannot allocate twice through another link or source.
        for existing in state["requests"].values():
            for row in existing["receipts"]:
                if row["reference"] != receipt["reference"]:
                    continue
                same = existing["id"] == item["id"] and all(
                    row[k] == receipt[k] for k in ("amount_minor", "currency", "method", "source")
                )
                if same:
                    return
                raise StoreError("receipt_reference_conflict")
        if sum(len(request["receipts"]) for request in state["requests"].values()) >= 10000:
            raise StoreError("receipt_capacity")
        balance = CedarStore.totals(item)["balance_minor"]
        rounding = quoted_rounding(item, receipt["amount_minor"], receipt["currency"])
        if opening:
            rounding = receipt.get("rounding_minor", 0)
            if type(rounding) is not int or not 0 <= rounding <= 99 or rounding >= receipt["amount_minor"]:
                raise StoreError("receipt_rounding_invalid")
        reason = (
            "currency_mismatch"
            if receipt["currency"] != item["currency"]
            else "amount_exceeds_balance"
            if receipt["amount_minor"] - rounding > balance
            else ""
        )
        clock = datetime.fromisoformat(item["sample_clock"].replace("Z", "+00:00")) + timedelta(
            seconds=len(item["receipts"]) + 1
        )
        item["receipts"].append(
            {
                **receipt,
                "rounding_minor": rounding if not reason else 0,
                "id": str(uuid.uuid4()),
                "created_at": receipt.get("created_at") or clock.isoformat(),
                "received_at": now_iso(),
                "status": "review" if reason else "matched",
                "reason": reason,
            }
        )
        if not opening:
            refresh_quote(state, item)

    def create_request(self, workspace_id: str, data: dict[str, Any]) -> dict[str, Any]:
        return self.mutate(workspace_id, lambda state: self._create_request(state, workspace_id, data))

    def create_requests(self, workspace_id: str, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return self.mutate(workspace_id, lambda state: [self._create_request(state, workspace_id, data) for data in rows])

    def _create_request(self, state: dict[str, Any], workspace_id: str, data: dict[str, Any]) -> dict[str, Any]:
        # Zero opening adjustments preserve predecessor request fingerprints.
        data = {**data, "initial_receipts": [{key: value for key, value in row.items()
            if key != "rounding_minor" or value} for row in data["initial_receipts"]]}
        key = data["idempotency_key"]
        digest = fingerprint(data)
        prior = state["idempotency"].get(key)
        if prior:
            if prior["fingerprint"] != digest:
                raise StoreError("idempotency_conflict")
            item = self.item(state, prior["id"])
            refresh_quote(state, item)
            return item
        if len(state["idempotency"]) >= 10000:
            raise StoreError("request_capacity")
        existing = next(
            (row for row in state["requests"].values() if row["invoice_id"] == data["invoice_id"]), None
        )
        if existing:
            immutable = (
                "document_id",
                "seller_name",
                "seller_ruc",
                "customer_name",
                "currency",
                "invoice_amount_minor",
                "reference",
                "receiving_bank",
                "account_label",
            )
            if any(existing[k] != data[k] for k in immutable) or existing.get(
                "billing_draft"
            ) != data.get("billing_draft") or existing.get("commercial_document") != data.get("commercial_document"):
                raise StoreError("invoice_binding_conflict")
            state["idempotency"][key] = {"id": existing["id"], "fingerprint": digest}
            refresh_quote(state, existing)
            return existing
        if len(state["requests"]) >= 2000:
            raise StoreError("request_capacity")
        if any(row["reference"] == data["reference"] for row in state["requests"].values()):
            raise StoreError("invoice_reference_conflict")
        request_id = str(uuid.uuid4())
        item = {
            k: v
            for k, v in data.items()
            if k not in {"initial_receipts", "idempotency_key", "amount_minor"}
        }
        clock = data.get("sample_clock") or now_iso()
        item.update(
            id=request_id,
            workspace_id=workspace_id,
            public_token=secrets.token_urlsafe(32),
            sample_clock=clock,
            created_at=clock,
            received_at=now_iso(),
            receipts=[],
            quote_history=[],
        )
        receiving = state["bank"].get("receiving_account", {})
        if (
            receiving.get("bank") == item["receiving_bank"]
            and receiving.get("currency") == item["currency"]
        ):
            item["receiving_account_number"] = receiving["number"]
        state["requests"][request_id] = item
        for receipt in data["initial_receipts"]:
            self.add_receipt(state, item, {**receipt, "opening": True}, opening=True)
        if self.totals(item)["balance_minor"] != data["amount_minor"]:
            raise StoreError("opening_balance_mismatch")
        refresh_quote(state, item, required=True)
        state["idempotency"][key] = {"id": request_id, "fingerprint": digest}
        return item

    def receipt(self, workspace_id: str, request_id: str, data: dict[str, Any]) -> dict[str, Any]:
        def change(state: dict[str, Any]) -> dict[str, Any]:
            item = self.item(state, request_id)
            self.add_receipt(state, item, data)
            return item

        return self.mutate(workspace_id, change)

    def quoted_request(self, workspace_id: str, request_id: str) -> dict[str, Any]:
        item = self.item(self.read(workspace_id), request_id)
        remaining = self.totals(item)["balance_minor"]
        quote = item.get("quote")
        # Polling reads an already-issued quote. Only initialization or a changed balance writes.
        if "quote_history" in item and ((remaining == 0 and quote is None)
                or (quote and quote["principal_minor"] == remaining)):
            return item
        def change(state: dict[str, Any]) -> dict[str, Any]:
            item = self.item(state, request_id)
            refresh_quote(state, item)
            return item
        return self.mutate(workspace_id, change)

    @staticmethod
    def free_reference(state: dict[str, Any], base: str) -> str:
        """The document's own number, and the number plus a two-digit suffix for a second payment
        on the same document (FEED-IA §252). One reference allocates once inside a workspace, so a
        part-paid order whose buyer pays the rest carries `F001-00000002-02`."""
        taken = {
            row["reference"] for request in state["requests"].values() for row in request["receipts"]
        }
        if base not in taken:
            return base
        if len(base) > 117:
            raise StoreError("receipt_reference_conflict")
        for index in range(2, 100):
            candidate = f"{base}-{index:02d}"
            if candidate not in taken:
                return candidate
        raise StoreError("receipt_reference_conflict")

    def approve_payment(
        self, workspace_id: str, request_id: str, phone: str, code: str, quote_id: str | None = None
    ) -> dict[str, Any]:
        """THE BUYER'S APPROVAL CODE, RECORDED AS THIS ORDER'S PAYMENT (FEED-IA §252).

        «can we just clone that and serve the links in our own demo domain as a new tab that goes
         through the motions?»                                    — Peter, 14 September 2026

        The checkout at `/collect/{id}/{token}` posts the buyer's Yape phone and approval code
        here, and the seeded workspace answers the way the wallet will: the outstanding balance
        becomes one receipt under the order's own number, carrying `source: sample` so provenance
        stays in the data. The same phone and code arriving twice records one payment — a retried
        tap and a re-submitted form settle the order once. The day Izipay is commissioned this
        path posts the pair to the processor's Yape-code flow and everything above it is unchanged.
        """
        def change(state: dict[str, Any]) -> dict[str, Any]:
            item = self.item(state, request_id)
            approvals = item.setdefault("approvals", {})
            key = hashlib.sha256(f"{request_id}:{phone}:{code}".encode()).hexdigest()
            if key in approvals:
                return item
            if len(approvals) >= 50:
                raise StoreError("receipt_capacity")
            record: dict[str, Any] = {"at": now_iso(), "phone_mask": "••• ••• " + phone[-3:]}
            balance = int(self.totals(item)["balance_minor"])
            if balance > 0:
                quote = refresh_quote(state, item)
                if quote is None or quote_id != quote["id"]:
                    raise StoreError("payment_quote_changed")
                self.add_receipt(
                    state,
                    item,
                    {
                        "amount_minor": quote["amount_minor"],
                        "currency": item["currency"],
                        "reference": self.free_reference(state, item["reference"]),
                        "method": "yape",
                        "source": "sample",
                    },
                )
                record["receipt_id"] = item["receipts"][-1]["id"]
            approvals[key] = record
            return item

        return self.mutate(workspace_id, change)

    def public_request(self, request_id: str, token: str) -> dict[str, Any]:
        with self.connect() as db:
            row = db.execute(
                "SELECT workspace_id,token_hash FROM public_requests WHERE id=?", (request_id,)
            ).fetchone()
        if not row or not hmac.compare_digest(row["token_hash"], hashlib.sha256(token.encode()).hexdigest()):
            raise StoreError("request_missing")
        state = self.read(row["workspace_id"])
        if state.get("fixture_rollover"):
            raise StoreError("request_missing")
        return self.item(state, request_id)
