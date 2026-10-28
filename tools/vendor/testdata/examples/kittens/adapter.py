#!/usr/bin/env python3
"""A standalone SQLite product adapter demonstrating tenant and run isolation.

Everything belongs to a synthetic run. Booking lookups always include household
identity, and foreign keys enforce the household boundary for kitten references.
"""

import json
import os
import sqlite3
import sys
import tempfile
from pathlib import Path

SCHEMA = """
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS run_identity (
    singleton INTEGER PRIMARY KEY CHECK (singleton = 1), run_id TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS households (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS kittens (
    household_id TEXT NOT NULL REFERENCES households(id),
    id TEXT NOT NULL, name TEXT NOT NULL,
    PRIMARY KEY (household_id, id)
);
CREATE TABLE IF NOT EXISTS bookings (
    household_id TEXT NOT NULL, id TEXT NOT NULL, kitten_id TEXT NOT NULL,
    starts_at TEXT NOT NULL, PRIMARY KEY (household_id, id),
    FOREIGN KEY (household_id, kitten_id) REFERENCES kittens(household_id, id)
);
CREATE TABLE IF NOT EXISTS captured_effects (
    household_id TEXT NOT NULL, booking_id TEXT NOT NULL,
    kind TEXT NOT NULL, recipient TEXT NOT NULL,
    PRIMARY KEY (household_id, booking_id, kind),
    FOREIGN KEY (household_id, booking_id) REFERENCES bookings(household_id, id)
);
"""


def booking_for_household(connection, household_id, booking_id):
    return connection.execute(
        "SELECT id, kitten_id, starts_at FROM bookings WHERE household_id = ? AND id = ?",
        (household_id, booking_id),
    ).fetchone()


def verify_owner(connection, run_id):
    owner = connection.execute("SELECT run_id FROM run_identity WHERE singleton = 1").fetchone()
    if owner != (run_id,):
        raise ValueError("Database ownership must match this run.")


def initialize_database(path, run_id):
    """Install a database only after its schema and ownership record are complete."""
    connection = sqlite3.connect(":memory:")
    temporary = None
    try:
        connection.executescript(SCHEMA)
        connection.execute("INSERT INTO run_identity VALUES (1, ?)", (run_id,))
        connection.commit()
        descriptor, temporary = tempfile.mkstemp(prefix=".kittens-", dir=path.parent)
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(connection.serialize())
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        connection.close()
        if temporary and os.path.exists(temporary):
            os.unlink(temporary)


def respond(request):
    if request.get("protocol") != 1 or request.get("environment") != "development":
        raise ValueError("Use protocol 1 with development.")
    operation = request.get("operation")
    if operation not in {"plan", "create", "populate", "exercise", "status", "reset", "delete"}:
        raise ValueError("Choose a supported kitten-sitting operation.")
    households = request["scenario"]["households"]
    if any(not household["email"].endswith("@example.invalid") for household in households):
        raise ValueError("Use synthetic household addresses at example.invalid.")
    if operation == "plan":
        return {}, {
            "households": len(households),
            "bookings": sum(len(h["bookings"]) for h in households),
            "effects": "capture",
        }
    state_dir = Path(request["state_dir"])
    path = state_dir / "kittens.sqlite3"
    if not state_dir.is_absolute() or not state_dir.is_dir() or state_dir.is_symlink() or path.is_symlink():
        raise ValueError("Use an absolute private run directory and regular database file.")
    resources = {"database": str(path), "namespace": request["run_id"]}
    if request.get("resources") and request["resources"] != resources:
        raise ValueError("Database resource identity must match this run.")
    if operation == "delete":
        if path.exists():
            with sqlite3.connect(path.as_uri() + "?mode=ro", uri=True) as connection:
                verify_owner(connection, request["run_id"])
        path.unlink(missing_ok=True)
        return resources, {"exists": False, "effects": "capture"}
    if not path.exists() and operation != "create":
        if operation in {"status", "reset"}:
            return resources, {"exists": False, "effects": "capture"}
        raise ValueError("Create the household database first.")
    if not path.exists():
        initialize_database(path, request["run_id"])
    connection = sqlite3.connect(path)
    try:
        verify_owner(connection, request["run_id"])
        connection.execute("PRAGMA foreign_keys = ON")
        with connection:
            if operation == "reset":
                for table in ("captured_effects", "bookings", "kittens", "households"):
                    connection.execute(f"DELETE FROM {table}")
            if operation in {"populate", "reset"}:
                for household in households:
                    connection.execute(
                        "INSERT OR IGNORE INTO households VALUES (?, ?, ?)",
                        (household["id"], household["name"], household["email"]),
                    )
                    for kitten in household["kittens"]:
                        connection.execute(
                            "INSERT OR IGNORE INTO kittens VALUES (?, ?, ?)",
                            (household["id"], kitten["id"], kitten["name"]),
                        )
                    for booking in household["bookings"]:
                        connection.execute(
                            "INSERT OR IGNORE INTO bookings VALUES (?, ?, ?, ?)",
                            (household["id"], booking["id"], booking["kitten_id"], booking["starts_at"]),
                        )
            elif operation == "exercise":
                for household in households:
                    for booking in household["bookings"]:
                        if booking_for_household(connection, household["id"], booking["id"]) is None:
                            raise ValueError("Populate this household booking before exercising it.")
                        connection.execute(
                            "INSERT OR IGNORE INTO captured_effects VALUES (?, ?, ?, ?)",
                            (household["id"], booking["id"], "booking-confirmation", household["email"]),
                        )
        counts = {
            table: connection.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
            for table in ("households", "kittens", "bookings", "captured_effects")
        }
        result = {"exists": True, "counts": counts, "effects": "capture"}
        if operation == "exercise":
            result["proof"] = "Household-scoped booking reads and captured booking confirmations"
        return resources, result
    finally:
        connection.close()


def main():
    try:
        resources, result = respond(json.load(sys.stdin))
        response = {"ok": True, "resources": resources, "result": result}
    except ValueError as error:
        response = {"ok": False, "resources": {}, "error": str(error)}
    except Exception:
        response = {
            "ok": False,
            "resources": {},
            "error": "Kitten-sitting operation failed; inspect the private run state.",
        }
    json.dump(response, sys.stdout, sort_keys=True)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
