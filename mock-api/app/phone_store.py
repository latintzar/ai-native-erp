"""Cedar phone state, independent from synthetic browser decisions and legacy call rows."""

from __future__ import annotations

import hashlib
import json
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Iterator

from .errors import RuntimeError_


class PhoneStore:
    def __init__(self, directory: Path):
        directory.mkdir(mode=0o700, parents=True, exist_ok=True)
        self.path = directory / "cedar-phone.sqlite"
        descriptor = os.open(self.path, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
        os.close(descriptor)
        with self.db() as db:
            db.execute("PRAGMA journal_mode=WAL")
            db.execute("CREATE TABLE IF NOT EXISTS workspaces (id TEXT PRIMARY KEY, data TEXT NOT NULL)")
            db.execute(
                "CREATE TABLE IF NOT EXISTS numbers (number TEXT PRIMARY KEY, workspace TEXT NOT NULL)"
            )
            db.execute("CREATE TABLE IF NOT EXISTS calls (sid TEXT PRIMARY KEY, workspace TEXT NOT NULL)")
            db.execute(
                "CREATE TABLE IF NOT EXISTS recording_jobs "
                "(sid TEXT PRIMARY KEY, workspace TEXT NOT NULL, due REAL NOT NULL)"
            )
            db.execute("CREATE INDEX IF NOT EXISTS recording_due ON recording_jobs(due)")
            db.execute(
                "CREATE TABLE IF NOT EXISTS maintenance (workspace TEXT PRIMARY KEY, due REAL NOT NULL)"
            )
            db.execute(
                "CREATE TABLE IF NOT EXISTS issued_numbers (number TEXT PRIMARY KEY, "
                "workspace TEXT NOT NULL, line TEXT NOT NULL, sid TEXT NOT NULL, at TEXT NOT NULL)"
            )
        os.chmod(self.path, 0o600)

    @contextmanager
    def db(self) -> Iterator[sqlite3.Connection]:
        db = sqlite3.connect(self.path, timeout=15)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA secure_delete=ON")
        try:
            with db:
                yield db
        finally:
            db.close()

    @staticmethod
    def empty(workspace: str) -> dict[str, Any]:
        return {
            "id": workspace,
            "setup": {
                "source_number": "",
                "fallback_number": "",
                "recording": "off",
                "live_transcription": False,
            },
            "connection": None,
            "checks": {},
            "lines": {},
            "default_line": None,
            "devices": {},
            "intents": {},
            "calls": {},
        }

    @staticmethod
    def upgrade(state: dict[str, Any]) -> dict[str, Any]:
        """Lift the original single-line document into the additive multi-line shape."""
        lines = state.setdefault("lines", {})
        state.setdefault("default_line", None)
        connection = state.get("connection")
        if connection and not lines:
            identity = "line_" + hashlib.sha256(
                (state["id"] + ":" + connection["inbound_number"]).encode()
            ).hexdigest()[:24]
            lines[identity] = {
                "id": identity,
                "setup": state["setup"],
                "connection": connection,
                "checks": state.get("checks", {}),
            }
            state["default_line"] = identity
        default = state.get("default_line")
        if default not in lines or not lines.get(default, {}).get("connection"):
            default = next((key for key, line in lines.items() if line.get("connection")), None)
            state["default_line"] = default
        if default:
            line = lines[default]
            state["setup"] = line["setup"]
            state["connection"] = line["connection"]
            state["checks"] = line["checks"]
        return state

    def read(self, workspace: str) -> dict[str, Any]:
        with self.db() as db:
            row = db.execute("SELECT data FROM workspaces WHERE id=?", (workspace,)).fetchone()
        return self.upgrade(json.loads(row["data"]) if row else self.empty(workspace))

    def change(self, workspace: str, fn: Callable[[dict[str, Any]], Any]) -> Any:
        with self.db() as db:
            db.execute("BEGIN IMMEDIATE")
            row = db.execute("SELECT data FROM workspaces WHERE id=?", (workspace,)).fetchone()
            state = self.upgrade(json.loads(row["data"]) if row else self.empty(workspace))
            result = fn(state)
            state = self.upgrade(state)
            if len(state["calls"]) > 2000 or len(state["intents"]) > 4000:
                raise RuntimeError_(
                    "phone_capacity", "Archive the completed pilot before adding more calls.", 409
                )
            content = json.dumps(state, allow_nan=False, separators=(",", ":"))
            if len(content) > 20_000_000:
                raise RuntimeError_(
                    "phone_capacity", "Archive the completed pilot before adding more calls.", 409
                )
            connections = [
                line["connection"] for line in state.get("lines", {}).values() if line.get("connection")
            ] or ([state["connection"]] if state.get("connection") else [])
            active_numbers = {connection["inbound_number"] for connection in connections}
            for row in db.execute("SELECT number FROM numbers WHERE workspace=?", (workspace,)):
                if row["number"] not in active_numbers:
                    db.execute(
                        "DELETE FROM numbers WHERE number=? AND workspace=?",
                        (row["number"], workspace),
                    )
            for connection in connections:
                owner = db.execute(
                    "SELECT workspace FROM numbers WHERE number=?", (connection["inbound_number"],)
                ).fetchone()
                if owner and owner["workspace"] != workspace:
                    raise RuntimeError_(
                        "phone_number_bound", "Select the workspace that owns this phone line.", 409
                    )
                db.execute(
                    "INSERT OR IGNORE INTO numbers VALUES (?,?)", (connection["inbound_number"], workspace)
                )
            db.execute(
                "INSERT INTO workspaces VALUES (?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
                (workspace, content),
            )
            db.execute("INSERT OR IGNORE INTO maintenance VALUES (?,0)", (workspace,))
            for sid in state["calls"]:
                prior = db.execute("SELECT workspace FROM calls WHERE sid=?", (sid,)).fetchone()
                if prior and prior["workspace"] != workspace:
                    raise RuntimeError_("phone_call_bound", "Open the workspace that owns this call.", 409)
                db.execute("INSERT OR IGNORE INTO calls VALUES (?,?)", (sid, workspace))
                call = state["calls"][sid]
                if call.get("recording_job") in {"queued", "retry", "processing"}:
                    db.execute(
                        "INSERT INTO recording_jobs VALUES (?,?,?) "
                        "ON CONFLICT(sid) DO UPDATE SET due=excluded.due",
                        (sid, workspace, call.get("recording_retry_at", 0)),
                    )
                else:
                    db.execute("DELETE FROM recording_jobs WHERE sid=?", (sid,))
            return result

    def due_recordings(self, stamp: float) -> list[tuple[str, str]]:
        with self.db() as db:
            return [
                (row["workspace"], row["sid"])
                for row in db.execute(
                    "SELECT workspace,sid FROM recording_jobs WHERE due<=? ORDER BY due LIMIT 10", (stamp,)
                )
            ]

    def issued_count(self) -> int:
        with self.db() as db:
            return int(db.execute("SELECT count(*) FROM issued_numbers").fetchone()[0])

    def record_issued(self, number: str, workspace: str, line: str, sid: str) -> None:
        with self.db() as db:
            db.execute(
                "INSERT OR IGNORE INTO issued_numbers VALUES (?,?,?,?,?)",
                (number, workspace, line, sid, datetime.now(timezone.utc).isoformat()),
            )

    def number_workspace(self, number: str) -> str | None:
        with self.db() as db:
            row = db.execute("SELECT workspace FROM numbers WHERE number=?", (number,)).fetchone()
        return row["workspace"] if row else None

    def call_workspace(self, sid: str) -> str | None:
        with self.db() as db:
            row = db.execute("SELECT workspace FROM calls WHERE sid=?", (sid,)).fetchone()
        return row["workspace"] if row else None

    def all_workspaces(self) -> list[str]:
        with self.db() as db:
            return [row["id"] for row in db.execute("SELECT id FROM workspaces LIMIT 2000")]

    def due_maintenance(self, stamp: float) -> list[str]:
        with self.db() as db:
            return [
                row["workspace"]
                for row in db.execute(
                    "SELECT workspace FROM maintenance WHERE due<=? ORDER BY due LIMIT 10", (stamp,)
                )
            ]

    def schedule_maintenance(self, workspace: str, stamp: float) -> None:
        with self.db() as db:
            db.execute("UPDATE maintenance SET due=? WHERE workspace=?", (stamp, workspace))


def append_intake(call: dict[str, Any], kind: str, evidence: list[dict[str, Any]]) -> None:
    """An atomic outbox of quoted sources, ready for the owner's order-intake review."""
    canonical = json.dumps(evidence, sort_keys=True, allow_nan=False, separators=(",", ":"))
    revision = hashlib.sha256((call["sid"] + ":" + kind + ":" + canonical).encode()).hexdigest()[:32]
    events = call.setdefault("intake_events", [])
    batches = [evidence[offset : offset + 50] for offset in range(0, len(evidence), 50)]
    for index, batch in enumerate(batches):
        event_id = revision + ":" + str(index)
        if any(event["id"] == event_id for event in events):
            continue
        if len(events) >= 4000:
            raise RuntimeError_("phone_intake_capacity", "Review the completed pilot's call sources.", 409)
        events.append(
            {
                "id": event_id,
                "sequence": len(events) + 1,
                "call_sid": call["sid"],
                "kind": kind,
                "mode": "incremental" if kind == "final_delta" else "historical",
                "revision_id": revision,
                "batch_index": index,
                "batch_count": len(batches),
                "created_at": datetime.now(timezone.utc).isoformat(),
                "status": "pending-review",
                "source_ids": [item["id"] for item in batch],
                "evidence": batch,
                "proposal": {"kind": "order-intake", "customer_id": None, "lines": []},
            }
        )
