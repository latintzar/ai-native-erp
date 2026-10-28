#!/usr/bin/env python3
"""Development-only adapter for synthetic JSON collections and captured effects.

Scenario shape: {"synthetic": true, "fixture": {"collections": {"name": [objects]}, "effects":
[objects]}}. The optional ``fail_after_create`` flag exercises recovery paths.
This adapter uses only its run directory; it has no provider integration.
"""

import hashlib
import json
import os
import sys
import tempfile
from pathlib import Path


class ContractError(Exception):
    pass


def save(path, value):
    descriptor, temporary = tempfile.mkstemp(prefix=".fixtures-", dir=path.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            json.dump(value, handle, sort_keys=True, separators=(",", ":"))
            handle.write("\n")
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def run(request):
    if request.get("protocol") != 1 or request.get("environment") != "development":
        raise ContractError("The fixture adapter requires protocol 1 and development.")
    operation = request.get("operation")
    if operation not in {"plan", "create", "populate", "exercise", "status", "reset", "delete"}:
        raise ContractError("Choose a supported fixture operation.")
    scenario = request.get("scenario", {}).get("fixture", {})
    collections = scenario.get("collections", {})
    effects = scenario.get("effects", [])
    if (
        not isinstance(collections, dict)
        or any(
            not isinstance(name, str)
            or not isinstance(rows, list)
            or any(not isinstance(row, dict) for row in rows)
            for name, rows in collections.items()
        )
        or not isinstance(effects, list)
        or any(not isinstance(effect, dict) for effect in effects)
    ):
        raise ContractError("Fixture collections contain lists of objects; effects contain objects.")
    if operation == "plan":
        return {
            "ok": True,
            "resources": {},
            "result": {
                "collections": {name: len(rows) for name, rows in collections.items()},
                "effects": "capture",
                "effect_count": len(effects),
            },
        }

    state_dir = Path(request["state_dir"])
    if not state_dir.is_absolute() or not state_dir.is_dir() or state_dir.is_symlink():
        raise ContractError("Use an absolute private run directory.")
    path = state_dir / "fixtures.json"
    if path.is_symlink():
        raise ContractError("The fixture file must be a regular private file.")
    resources = {"fixture_file": str(path), "namespace": request["run_id"]}
    supplied = request.get("resources", {})
    if supplied and supplied != resources:
        raise ContractError("Fixture resource identity must match this run.")
    empty = {"run_id": request["run_id"], "populated": False, "collections": {}, "captured_effects": []}
    exists = path.exists()
    state = json.loads(path.read_text()) if exists else empty
    if state["run_id"] != request["run_id"]:
        raise ContractError("Fixture ownership must match this run.")

    if operation == "create":
        if not exists:
            save(path, empty)
            exists = True
        if scenario.get("fail_after_create"):
            return {
                "ok": False,
                "resources": resources,
                "error": "Synthetic creation fault; use delete to recover this run.",
            }
    elif operation == "populate":
        if not exists:
            raise ContractError("Create the fixture store before populating it.")
        state.update(populated=True, collections=collections)
        save(path, state)
    elif operation == "exercise":
        if not exists or not state["populated"]:
            raise ContractError("Populate the fixture store before exercising it.")
        captured = []
        for index, effect in enumerate(effects):
            payload = json.dumps(effect, sort_keys=True, separators=(",", ":"))
            effect_id = hashlib.sha256(f"{request['run_id']}:{index}:{payload}".encode()).hexdigest()
            captured.append({"id": effect_id, "mode": "capture", "payload": effect})
        state["captured_effects"] = captured
        save(path, state)
    elif operation == "reset":
        if exists:
            state = {**empty, "populated": True, "collections": collections}
            save(path, state)
    elif operation == "delete":
        if exists:
            path.unlink()
        exists = False
        state = empty

    return {
        "ok": True,
        "resources": resources,
        "result": {
            "exists": exists,
            "populated": state["populated"] if exists else False,
            "collections": {name: len(rows) for name, rows in state["collections"].items()} if exists else {},
            "captured_effects": len(state["captured_effects"]) if exists else 0,
            "effects": "capture",
        },
    }


def main():
    try:
        response = run(json.load(sys.stdin))
    except ContractError as error:
        response = {"ok": False, "resources": {}, "error": str(error)}
    except Exception:
        response = {
            "ok": False,
            "resources": {},
            "error": "Fixture operation failed; inspect the private run state.",
        }
    json.dump(response, sys.stdout, sort_keys=True)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
