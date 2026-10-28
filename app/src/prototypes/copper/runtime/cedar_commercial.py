"""The order's commercial identity precedes separately reviewed fiscal preparation."""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, StrictInt, model_validator

from .cedar_amounts import refresh_quote
from .cedar_fiscal import DraftLine
from .cedar_store import CedarStore, fingerprint, now_iso
from .store import StoreError


class CommercialDocument(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    version: Literal[1]
    origin: Literal["cedar-order"]
    customer_id: str = Field(min_length=1, max_length=120)
    customer_name: str = Field(min_length=1, max_length=100)
    seller_name: str = Field(min_length=1, max_length=160)
    document_number: str = Field(min_length=1, max_length=120)
    currency: Literal["PEN"]
    total_minor: StrictInt = Field(gt=0, le=1_000_000_000_000)
    lines: list[DraftLine] = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def conserved(self) -> CommercialDocument:
        if (sum(row.total_minor for row in self.lines) != self.total_minor
                or len({row.id for row in self.lines}) != len(self.lines)
                or any(Decimal(row.quantity) <= 0 for row in self.lines)):
            raise ValueError("commercial_document_totals_invalid")
        return self


def validate_commercial(item: dict[str, Any], document: dict[str, Any]) -> None:
    if (any(item[key] != document[key] for key in ("seller_name", "customer_name", "currency"))
            or item["invoice_amount_minor"] != document["total_minor"]
            or item["reference"] != document["document_number"]):
        raise StoreError("commercial_document_binding_mismatch")


def attach_fiscal(state: dict[str, Any], item: dict[str, Any], draft: dict[str, Any]) -> dict[str, Any]:
    document = item.get("commercial_document")
    if not document:
        raise StoreError("commercial_document_required")
    if (any(draft[key] != document[key] for key in ("customer_id", "customer_name", "seller_name", "currency", "total_minor", "lines"))
            or draft["source_currency"] != "PEN" or draft["source_total_minor"] != document["total_minor"]
            or draft["fx_rate"] != "1" or not draft["customer_address"]
            or (item["seller_ruc"] and draft["seller_ruc"] != item["seller_ruc"])):
        raise StoreError("billing_draft_binding_mismatch")
    if item.get("billing_draft") == draft:
        return item
    if item.get("billing_draft") or any(row["request_id"] == item["id"] for row in state["documents"].values()):
        raise StoreError("billing_draft_frozen")
    item.update(billing_draft=draft, seller_ruc=draft["seller_ruc"])
    return item


def revise_commercial(state: dict[str, Any], item: dict[str, Any], document: dict[str, Any], expected: str) -> dict[str, Any]:
    prior = item.get("commercial_document")
    if not prior:
        raise StoreError("commercial_document_required")
    if prior == document:
        refresh_quote(state, item)
        return item
    if fingerprint(prior) != expected:
        raise StoreError("commercial_document_changed")
    if (item.get("billing_draft") or item.get("commissioned_at")
            or any(row["request_id"] == item["id"] for row in state["documents"].values())):
        raise StoreError("commercial_document_frozen")
    if any(document[key] != prior[key] for key in ("customer_id", "customer_name", "seller_name", "document_number", "currency")):
        raise StoreError("commercial_document_binding_mismatch")
    received = item["invoice_amount_minor"] - CedarStore.totals(item)["balance_minor"]
    if document["total_minor"] < received:
        raise StoreError("commercial_document_received_total")
    item.update(commercial_document=document, invoice_amount_minor=document["total_minor"], merchant_action_at=now_iso())
    refresh_quote(state, item)
    return item
