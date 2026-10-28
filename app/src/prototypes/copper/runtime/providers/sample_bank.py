"""The seeded bank, answered in the shape the commissioned account answers (FEED-IA §251).

«it should be with mock data cos we still dont have rela prometeo but people dont need to know
 that. this is still admeo after all. a hybrid real.fake demo»            — Peter, 14 September 2026

A demo workspace holds no Prometeo account, so §247.2 made every Money door read «Connect bank».
This module is the other answer: with ``CEDAR_SAMPLE_BANK=1`` a workspace whose providers are empty
reads its bank from Cedar's own seed — the house's receiving account, its opening balance plus the
seeded receipts, those receipts as movements, Yape and Plin as its collectors. The day a Prometeo
key is commissioned the same workspace reads the real account through the same doors and these
answers stop.

EVERY FIGURE IS THE FIXTURE'S. ``sample_bank_v1.json`` beside this package is derived from
``money-v1.json``, ``money-seed.ts`` and ``sale.ts`` by ``app/tools/test-sample-bank.mjs``, which
also fails when the two drift, so the balance here and the balance the browser projects are the same
arithmetic. Days are offsets from the workspace's own reference day, resolved against Lima's
calendar exactly as ``scenario-clock.ts`` resolves them in the browser, so the seed follows the
calendar on both sides. Provenance travels in the data — ``mode`` and ``source`` are ``sample`` on
the account and on every movement — rather than in the words a merchant reads.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta
from functools import lru_cache
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

DATA = Path(__file__).resolve().parent.parent / "sample_bank_v1.json"
# Money is Peru's surface (FEED-IA §247.9), and the browser reads every Cedar day in this zone.
WORKSPACE_ZONE = ZoneInfo("America/Lima")
METHOD_WORDS = {"yape": "Yape", "plin": "Plin", "transfer": "Bank transfer", "cash": "Cash"}


class SampleBankError(RuntimeError):
    """The seeded ledger could not be read, so sample mode answers nothing."""


@lru_cache(maxsize=2)
def book(revision: int = 2) -> dict[str, Any]:
    """The seeded accounts and seven browser-derived weekday ledgers, read once."""
    try:
        raw = json.loads(DATA.read_text())
        if raw["fixture"]["schema"] != 2:
            raise ValueError("weekday_ledger_required")
        collections = (raw["fixture"]["legacy"] if revision == 1 else raw["fixture"])["collections"]
        accounts = {row["scope"]: row for row in collections["accounts"]}
        variants = collections["receiptsByWeekday"]
        if set(variants) != {str(day) for day in range(7)}:
            raise ValueError("seven_weekdays_required")
        receipts: dict[int, dict[str, list[dict[str, Any]]]] = {}
        for weekday, rows in variants.items():
            receipts[int(weekday)] = {scope: [] for scope in accounts}
            for row in rows:
                receipts[int(weekday)][row["scope"]].append(row)
    except (OSError, ValueError, KeyError, TypeError) as exc:
        raise SampleBankError("sample_bank_unavailable") from exc
    if not accounts:
        raise SampleBankError("sample_bank_unavailable")
    return {"accounts": accounts, "receiptsByWeekday": receipts, "default": next(iter(accounts))}


def available() -> bool:
    """A seeded ledger that could be read. A damaged file leaves every door on its own posture."""
    try:
        return bool(book(2)["accounts"])
    except SampleBankError:
        return False


def houses() -> list[str]:
    return list(book(2)["accounts"])


def scope_of(state: dict[str, Any]) -> str:
    """Which house this workspace is. The browser declares its scope when the workspace is created;
    a workspace created before that reads the seller name its setup already carries, and a workspace
    that has stated neither reads the book's first house."""
    accounts = state_book(state)["accounts"]
    declared = state.get("scope")
    if isinstance(declared, str) and declared in accounts:
        return declared
    seller = str(state.get("setup", {}).get("seller_name") or "")
    for scope, account in accounts.items():
        if seller and seller == account["houseName"]:
            return scope
    return str(state_book(state)["default"])


def state_book(state: dict[str, Any]) -> dict[str, Any]:
    """A retained authored predecessor ledger keeps its original receipt history."""
    return book(1 if state.get("fixture_revision") == 1 else 2)


def today(now: datetime | None = None) -> str:
    """The workspace's own calendar day, the reading every seeded date is shifted onto."""
    return (now or datetime.now(WORKSPACE_ZONE)).astimezone(WORKSPACE_ZONE).date().isoformat()


def reference_day(state: dict[str, Any], now: datetime | None = None) -> str:
    """The browser's saved ledger day, or today's Peru day for a fresh sample read."""
    return state.get("fixture_day") or today(now)


def _day(reference_day: str, offset: int) -> str:
    noon = datetime.fromisoformat(f"{reference_day}T12:00:00+00:00")
    return (noon + timedelta(days=offset)).date().isoformat()


def _instant(reference_day: str, row: dict[str, Any]) -> str:
    return f"{_day(reference_day, int(row['dayOffset']))}T{row['time']}"


def _base_clock(state: dict[str, Any], now: datetime | None = None) -> str:
    account = state_book(state)["accounts"][scope_of(state)]
    return f"{reference_day(state, now)}T{account['referenceTime']}"


def _seeded_receipts(state: dict[str, Any], now: datetime | None = None) -> list[dict[str, Any]]:
    scope = scope_of(state)
    anchor = reference_day(state, now)
    weekday = datetime.fromisoformat(anchor).weekday()
    limit = datetime.fromisoformat(_base_clock(state, now))
    rows = []
    for row in state_book(state)["receiptsByWeekday"][weekday][scope]:
        at = _instant(anchor, row)
        if datetime.fromisoformat(at) <= limit:
            rows.append({**row, "at": at})
    return rows


def _runtime_receipts(
    state: dict[str, Any], seeded: list[dict[str, Any]], now: datetime
) -> list[dict[str, Any]]:
    """New sample bank evidence joins the seed once. Opening receipts keep their existing entry.

    The service's arrival instant dates a new action even when its request retains an older
    sample clock. Cash and manually asserted receipts remain in the collection ledger.
    """
    scope = scope_of(state)
    account = state_book(state)["accounts"][scope]
    seen = {row["reference"] for row in seeded}
    rows = []
    for request in state.get("requests", {}).values():
        for receipt in request.get("receipts", []):
            reference = receipt.get("reference")
            amount = receipt.get("amount_minor")
            if (not reference or reference in seen or receipt.get("source") != "sample"
                    or receipt.get("status") != "matched" or receipt.get("currency") != account["currency"]
                    or receipt.get("method") not in {"yape", "plin", "transfer"}
                    or not isinstance(amount, int) or isinstance(amount, bool) or amount <= 0):
                continue
            at = receipt.get("received_at") or receipt.get("created_at")
            try:
                instant = datetime.fromisoformat(at)
            except (ValueError, TypeError):
                continue
            if instant.tzinfo is None or instant > now:
                continue
            seen.add(reference)
            rows.append({"scope": scope, "reference": reference, "amountMinor": amount,
                         "method": receipt["method"], "at": at,
                         "customerId": (request.get("billing_draft") or {}).get("customer_id", ""),
                         "invoiceId": request["invoice_id"], "documentId": request["document_id"],
                         "requestId": request["id"]})
    return rows


def clock(state: dict[str, Any], now: datetime | None = None) -> str:
    """The sample reference hour, advanced through actual new bank arrivals."""
    now = now or datetime.now(WORKSPACE_ZONE)
    instants = [_base_clock(state, now)]
    instants.extend(row["at"] for row in _runtime_receipts(state, _seeded_receipts(state, now), now))
    return max(instants, key=datetime.fromisoformat)


def receipts(state: dict[str, Any], now: datetime | None = None) -> list[dict[str, Any]]:
    """The weekday seed and new sample bank receipts, oldest first on their own recorded clocks."""
    now = now or datetime.now(WORKSPACE_ZONE)
    seeded = _seeded_receipts(state, now)
    rows = seeded + _runtime_receipts(state, seeded, now)
    return sorted(rows, key=lambda row: (datetime.fromisoformat(row["at"]), row["reference"]))


def snapshot(state: dict[str, Any], now: datetime | None = None) -> dict[str, Any]:
    """`GET /api/cedar/bank`, in the shape a commissioned Prometeo account answers."""
    now = now or datetime.now(WORKSPACE_ZONE)
    account = state_book(state)["accounts"][scope_of(state)]
    balance = account["openingBalanceMinor"] + sum(row["amountMinor"] for row in receipts(state, now))
    return {
        "ready": True,
        "bank": account["bank"],
        "account_label": account["houseName"],
        "account_mask": "•••• " + account["accountNumber"][-4:],
        "balance_minor": balance,
        "currency": account["currency"],
        "as_of": clock(state, now),
        "mode": "sample",
        "source": "sample",
        "monitor": {"enabled": False, "status": "off"},
        "wallets": dict(account["wallets"]),
    }


def movements(state: dict[str, Any], identity: Any, now: datetime | None = None) -> list[dict[str, Any]]:
    """`GET /api/cedar/bank/movements`. Each seeded receipt is the credit that paid its request, so
    every row carries the request, invoice and Delivery Note the seed allocated it to."""
    now = now or datetime.now(WORKSPACE_ZONE)
    account = state_book(state)["accounts"][scope_of(state)]
    mask = "•••• " + account["accountNumber"][-4:]
    rows = []
    for row in receipts(state, now):
        rows.append(
            {
                "id": identity([state.get("id", ""), "sample", account["scope"], row["reference"]]),
                "source": "sample",
                "mode": "sample",
                "date": datetime.fromisoformat(row["at"]).astimezone(WORKSPACE_ZONE).date().isoformat(),
                "detail": f"{METHOD_WORDS.get(row['method'], 'Bank transfer')} · {row['reference']}",
                "reference": row["reference"],
                "currency": account["currency"],
                "account_mask": mask,
                "debit_minor": 0,
                "credit_minor": row["amountMinor"],
                "allocated_minor": row["amountMinor"],
                "unallocated_minor": 0,
                "status": "matched",
                "reason": "",
                "request_id": row["requestId"],
                "invoice_id": row["invoiceId"],
                "document_id": row["documentId"],
            }
        )
    return sorted(rows, key=lambda row: (row["date"], row["reference"]), reverse=True)
