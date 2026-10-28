#!/usr/bin/env python3
"""Cedar scenario validation over the shared, private JSON-fixture lifecycle."""

from __future__ import annotations

import importlib.util
import json
import math
import re
import sys
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location(
    "cedar_shared_fixtures", ROOT / "tools/vendor/testdata/adapters/fixtures.py"
)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("The retained shared fixture adapter is required.")
fixtures = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(fixtures)


def require(condition, message):
    if not condition:
        raise fixtures.ContractError(message)


def identifier(value):
    return isinstance(value, str) and re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,119}", value) is not None


def calendar(value):
    require(
        isinstance(value, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", value),
        "Use a calendar date for each invoice.",
    )
    try:
        result = date.fromisoformat(value)
    except ValueError:
        raise fixtures.ContractError("Use a valid calendar date for each invoice.") from None
    require(2000 <= result.year <= 2200, "Keep sample calendar dates within the supported period.")
    return result


def timestamp(value):
    require(
        isinstance(value, str) and len(value) <= 40 and "T" in value, "Use an ISO timestamp with a timezone."
    )
    try:
        result = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        raise fixtures.ContractError("Use a valid ISO timestamp with a timezone.") from None
    require(
        result.tzinfo is not None and result.utcoffset() is not None and 2000 <= result.year <= 2200,
        "Use a sample clock with an explicit timezone.",
    )
    return result


def validate(scenario):
    require(
        isinstance(scenario, dict)
        and scenario.get("version") == 1
        and scenario.get("id") == "cedar-money-v1"
        and scenario.get("synthetic") is True,
        "Use the retained Cedar money scenario version 1.",
    )
    fixture = scenario.get("fixture")
    history = scenario.get("history")
    require(isinstance(history, dict), "Declare the sales-history recipe with the fixture.")
    require(type(history.get("days")) is int and 90 <= history["days"] <= 180,
            "Keep ninety to one hundred eighty calendar days of source sales.")
    weekdays = history.get("weekdayOrders")
    require(isinstance(weekdays, list) and len(weekdays) == 7
            and all(type(value) is int and 1 <= value <= 100 for value in weekdays),
            "Declare a positive source-order count for each weekday.")
    require(all(type(history.get(key)) is int and 0 <= history[key] <= 2500
                for key in ("partialBasisPoints", "lateBasisPoints")),
            "Declare payment shares in basis points.")
    require(history.get("paymentDelayDays") == 7 and history.get("partialDueDays") == 30,
            "Keep the week's receipt spread and thirty-day partial terms.")
    require(isinstance(history.get("disputedOffsets"), list)
            and 1 <= len(history["disputedOffsets"]) <= 2
            and all(type(day) is int and -history["days"] <= day <= -2 for day in history["disputedOffsets"]),
            "Keep one or two past disputed orders in the source history.")
    chases = history.get("chases")
    require(isinstance(chases, list) and len(chases) == 3
            and all(isinstance(row, dict) and row.get("step") == index + 1
                    and type(row.get("hoursAgo")) is int and 1 <= row["hoursAgo"] <= 23
                    and row.get("everyHours") in (12, 24, 48) for index, row in enumerate(chases)),
            "Declare the first, second and call reminder rungs.")
    require(isinstance(fixture, dict), "The Cedar scenario requires its fixture collections.")
    collections = fixture.get("collections")
    require(
        isinstance(collections, dict) and set(collections) == {"workspaces", "invoiceSeeds"},
        "Declare Cedar workspaces and invoice seeds together.",
    )
    workspaces, invoices = collections["workspaces"], collections["invoiceSeeds"]
    require(
        isinstance(workspaces, list) and workspaces and isinstance(invoices, list),
        "Use lists for Cedar workspace and invoice records.",
    )
    scopes = {}
    for row in workspaces:
        require(isinstance(row, dict) and identifier(row.get("scope")), "Each workspace needs a valid scope.")
        scope = row["scope"]
        require(scope not in scopes, "Each workspace scope must be unique.")
        require(row.get("currency") == "PEN", "Cedar money workspaces use PEN.")
        opening, rate = row.get("openingBalanceMinor"), row.get("fxRate")
        require(
            type(opening) is int and abs(opening) <= 9007199254740991,
            "Opening balances use safe integer minor units.",
        )
        require(type(rate) in (int, float) and math.isfinite(rate) and rate == 1, "Cedar Money uses the native PEN rate.")
        require(
            isinstance(row.get("houseName"), str) and 0 < len(row["houseName"].strip()) <= 200,
            "Each workspace needs its sample house name.",
        )
        scopes[scope] = timestamp(row.get("referenceAt"))
    sales, references = set(), set()
    for row in invoices:
        require(
            isinstance(row, dict) and row.get("scope") in scopes,
            "Every invoice seed belongs to a declared workspace.",
        )
        scope = row["scope"]
        require(
            identifier(row.get("saleId"))
            and identifier(row.get("customerId"))
            and identifier(row.get("reference")),
            "Invoice seeds require sale, customer and receipt identifiers.",
        )
        key, reference = (scope, row["saleId"]), (scope, row["reference"])
        require(
            key not in sales and reference not in references,
            "Sale and receipt identities must be unique within a workspace.",
        )
        sales.add(key)
        references.add(reference)
        source_day = calendar(row.get("sourceDay"))
        calendar(row.get("dueAt"))
        receipt_at = timestamp(row.get("receiptAt"))
        require(
            source_day <= scopes[scope].date() and receipt_at <= scopes[scope],
            "Sample invoice events belong at or before their workspace clock.",
        )
        require(
            type(row.get("paidBps")) is int and row["paidBps"] in (0, 5000, 10000),
            "Choose an unpaid, half-paid or paid sample invoice.",
        )
        require(
            row.get("method") in ("yape", "plin", "transfer"), "Choose a supported sample receipt method."
        )
    return collections


def run(request):
    collections = validate(request.get("scenario"))
    response = fixtures.run(request)
    if response.get("ok") and request.get("operation") == "exercise":
        # The shared adapter already verified private-path and run ownership before this read.
        state = json.loads(Path(response["resources"]["fixture_file"]).read_text())
        require(
            state.get("collections") == collections,
            "Populated Cedar collections must exactly match the retained scenario.",
        )
        require(
            [effect.get("payload") for effect in state.get("captured_effects", [])]
            == request["scenario"]["fixture"].get("effects", []),
            "Captured effects must exactly match the retained scenario.",
        )
        response["result"].update(
            collections_exact=True,
            scope_count=len(collections["workspaces"]),
            invoice_seed_count=len(collections["invoiceSeeds"]),
            proof="Retained Cedar collections and captured effects match exactly",
        )
    return response


def main():
    request = {}
    try:
        request = json.load(sys.stdin)
        if not isinstance(request, dict):
            request = {}
            raise fixtures.ContractError("Use a protocol request object.")
        response = run(request)
    except fixtures.ContractError as error:
        response = {"ok": False, "resources": request.get("resources", {}), "error": str(error)}
    except Exception:
        response = {
            "ok": False,
            "resources": request.get("resources", {}),
            "error": "Cedar fixture operation failed; inspect its private run state.",
        }
    json.dump(response, sys.stdout, sort_keys=True)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
