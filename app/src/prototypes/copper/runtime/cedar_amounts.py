"""Server-owned unique cents quotes. Invoice principal and received money remain separate."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any
from zoneinfo import ZoneInfo

from .store import StoreError

MAX_ROUNDING_MINOR = 99
MAX_PAYMENT_MINOR = 1_000_000_000_000


def payer_name(movement: dict[str, Any]) -> str | None:
    """Only the name explicitly supplied by the bank travels as review context."""
    extra = movement.get("extra_data")
    value = extra.get("payer_name") if isinstance(extra, dict) else None
    return value.strip()[:160] if isinstance(value, str) and value.strip() else None


def receipt_principal(receipt: dict[str, Any]) -> int:
    return receipt["amount_minor"] - receipt.get("rounding_minor", 0)


def balance(item: dict[str, Any]) -> int:
    paid = sum(receipt_principal(row) for row in item["receipts"] if row["status"] == "matched")
    return max(0, item["invoice_amount_minor"] - paid)


def refresh_quote(state: dict[str, Any], item: dict[str, Any], *, required: bool = False) -> dict[str, Any] | None:
    """Called inside the workspace transaction, after every change to principal.

    Every issued amount stays reserved, including superseded and paid quotes. A delayed transfer
    therefore keeps its original review context instead of paying a later request by coincidence.
    """
    remaining = balance(item)
    current = item.get("quote")
    if current and current["principal_minor"] == remaining:
        return current
    item["quote"] = None
    if "quote_history" not in item:
        # A predecessor already displayed both the face amount and its remaining principal.
        # Store that reservation before initialization, including fully paid old links.
        item["legacy_reserved_amounts"] = sorted({item["invoice_amount_minor"], remaining} - {0})
    history = item.setdefault("quote_history", [])
    if remaining == 0:
        return None
    reserved = set()
    for other in state["requests"].values():
        if other["currency"] != item["currency"]:
            continue
        reserved.update(row["amount_minor"] for row in other.get("quote_history", []))
        reserved.update(other.get("legacy_reserved_amounts", []))
        # Predecessor links already displayed these principal amounts before cents quotes existed.
        if other["id"] != item["id"] and "quote_history" not in other:
            reserved.update((other["invoice_amount_minor"], balance(other)))
    for rounding in range(MAX_ROUNDING_MINOR + 1):
        amount = remaining + rounding
        if amount in reserved or amount > MAX_PAYMENT_MINOR:
            continue
        quote = {"id": str(uuid.uuid4()), "principal_minor": remaining, "amount_minor": amount, "unique": True,
            "rounding_minor": rounding, "created_at": datetime.now(timezone.utc).isoformat()}
        history.append(quote)
        item["quote"] = quote
        return quote
    if required:
        raise StoreError("unique_amount_exhausted")
    # The accepted partial payment remains recorded. Its remaining principal can still be paid
    # through the exact reference. Any colliding amount now requires a reference permanently.
    for other in state["requests"].values():
        if other["currency"] != item["currency"]:
            continue
        for held in [*other.get("quote_history", []), other.get("quote")]:
            if held and held["amount_minor"] == remaining:
                held["unique"] = False
    quote = {"id": str(uuid.uuid4()), "principal_minor": remaining, "amount_minor": remaining,
        "rounding_minor": 0, "unique": False, "created_at": datetime.now(timezone.utc).isoformat()}
    history.append(quote)
    item["quote"] = quote
    return quote


def quote_values(item: dict[str, Any]) -> dict[str, Any]:
    remaining = balance(item)
    quote = item.get("quote")
    if quote and quote["principal_minor"] == remaining and remaining > 0:
        return {"amount_minor": quote["amount_minor"], "rounding_minor": quote["rounding_minor"],
            "quote_id": quote["id"], "quote_status": "ready" if quote.get("unique", True) else "reference-required"}
    return {"amount_minor": remaining, "rounding_minor": 0, "quote_id": None,
        "quote_status": "paid" if remaining == 0 else "reference-required"}


def quoted_rounding(item: dict[str, Any], amount: int, currency: str) -> int:
    quote = item.get("quote")
    if (quote and item["currency"] == currency and quote["principal_minor"] == balance(item)
            and quote["amount_minor"] == amount):
        return quote["rounding_minor"]
    return 0


def amount_candidate(state: dict[str, Any], movement: dict[str, Any]) -> list[dict[str, Any]]:
    """A missing reference can use one current exact quote. A stated reference owns its own key."""
    reference = movement["reference"]
    candidates = []
    for item in state["requests"].values():
        if item.get("receiving_account_number") != movement["account_number"] or item["currency"] != movement["currency"]:
            continue
        if reference:
            if item["reference"] == reference:
                candidates.append(item)
        else:
            quote = item.get("quote")
            if (quote and quote.get("unique", True) and quote["principal_minor"] == balance(item) and balance(item) > 0
                    and quote["amount_minor"] == movement["credit_minor"]
                    and movement["date"] >= datetime.fromisoformat(quote["created_at"]).astimezone(ZoneInfo("America/Lima")).date().isoformat()):
                candidates.append(item)
    return candidates
