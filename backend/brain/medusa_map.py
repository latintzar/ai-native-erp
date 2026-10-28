"""Pure mappers between Rocoto's order shape and Medusa's order shape.

medusa-integration.md §8/§9. These functions are PURE (no I/O) so the create-order payload can be
frozen into the outbox row at enqueue time, and so the reshapers are trivially unit-testable
against the seeded Sancho Cured Meats data (test_medusa_map).

The Rocoto order-line dict (from brain/tabular.build) carries:
  sku_id, item, name, code, qty, unit, price, line_total, variable_weight, note, confidence, ...
A grounded line gets `medusa_variant_id` attached at enqueue (looked up from catalogue_skus).
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

import config


# ── Rocoto order → Medusa createOrderWorkflow input ─────────────────────────────────────────
def build_create_order_payload(o: Dict[str, Any]) -> Dict[str, Any]:
    """Freeze the exact body POSTed to Medusa. Catalogue line = variant_id+quantity (+optional
    unit_price override); custom/variable-weight line = title+unit_price, no variant_id (§9)."""
    items: List[Dict[str, Any]] = []
    for ln in o.get("lines", []) or []:
        vid = ln.get("medusa_variant_id")
        qty = ln.get("qty") or 0
        if vid and not ln.get("variable_weight"):
            item: Dict[str, Any] = {
                "variant_id": vid,
                "quantity": qty,
                "metadata": {
                    "unit": ln.get("unit", ""),
                    "note": ln.get("note", ""),
                    "confidence": str(ln.get("confidence", "")),
                    "sancho_sku_id": ln.get("sku_id", ""),
                },
            }
            if ln.get("price") is not None:
                item["unit_price"] = ln["price"]  # override the catalogue price when known
            items.append(item)
        else:
            # ungrounded OR variable-weight → custom line item (no variant_id; price set by us)
            title = (
                ln.get("item") or ln.get("name") or ln.get("raw_text")
                or ln.get("mention") or "Custom item"
            )
            items.append({
                "title": title,
                "quantity": qty,
                "unit_price": ln.get("price") or 0,
                "metadata": {
                    "unit": ln.get("unit", ""),
                    "note": ln.get("note", ""),
                    "variable_weight": bool(ln.get("variable_weight")),
                    "sancho_sku_id": ln.get("sku_id", ""),
                },
            })
    return {
        "region_id": config.MEDUSA_REGION_ID,
        "sales_channel_id": config.MEDUSA_SALES_CHANNEL_ID,
        "currency_code": config.MEDUSA_CURRENCY_CODE or "eur",
        "status": "pending",                       # human-review hold → pending/not_paid/not_fulfilled
        "customer_id": None,                       # the Medusa route resolves it from metadata.phone
        "email": o.get("email"),
        "metadata": {
            "sancho_order_id": o["id"],            # the cross-boundary idempotency key
            "source": "storefront" if o.get("from_storefront") else "whatsapp",
            "phone": o.get("phone_number", ""),
            "customer_name": o.get("customer_name", ""),
            "delivery_date": o.get("delivery_date"),
            "seeded": bool(o.get("seeded", False)),
            "recurring": bool(o.get("recurring", False)),
        },
        "items": items,
    }


# ── Medusa order → Rocoto OrderDto (the app's wire shape) ───────────────────────────────────
def _line_from_medusa(li: Dict[str, Any]) -> Dict[str, Any]:
    meta = li.get("metadata") or {}
    return {
        "item": li.get("title") or (li.get("product_title") or ""),
        "qty": li.get("quantity"),
        "unit": meta.get("unit", ""),
        "price": li.get("unit_price"),
        "note": meta.get("note", ""),
        "confidence": meta.get("confidence", ""),
        "sku_id": meta.get("sancho_sku_id", ""),
        "variable_weight": bool(meta.get("variable_weight", False)),
    }


def medusa_order_to_dto(mo: Dict[str, Any], rocoto_extra: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Reshape a Medusa order (GET /admin/orders/{id}) back into the existing OrderDto, merging the
    Rocoto-only event-log fields (stage, per-line confidence, recurring) the app still needs (§4)."""
    sx = rocoto_extra or {}
    meta = mo.get("metadata") or {}
    lines = [_line_from_medusa(li) for li in (mo.get("items") or [])]
    dto = {
        "id": meta.get("sancho_order_id") or mo.get("id"),
        "medusa_order_id": mo.get("id"),
        "phone_number": meta.get("phone", "") or sx.get("phone_number", ""),
        "customer_name": meta.get("customer_name", "") or sx.get("customer_name", ""),
        "status": sx.get("status") or _status_from_medusa(mo),
        "lines": lines,
        "note": sx.get("note", ""),
        "delivery_date": meta.get("delivery_date") or sx.get("delivery_date"),
        "source_message_ids": sx.get("source_message_ids", []),
        "stage": sx.get("stage", ""),
        "recurring": bool(sx.get("recurring", meta.get("recurring", False))),
        "recurring_label": sx.get("recurring_label"),
        "created_at": mo.get("created_at"),
        "seeded": bool(meta.get("seeded", False)),
    }
    return dto


def _status_from_medusa(mo: Dict[str, Any]) -> str:
    """Map Medusa's independent status/payment/fulfillment back to the Rocoto status vocabulary."""
    fs = mo.get("fulfillment_status")
    if fs in ("fulfilled", "shipped", "delivered", "partially_fulfilled"):
        return "sent"
    st = mo.get("status")
    if st in ("completed",):
        return "sent"
    return "approved"  # created in Medusa = past the review hold


# ── Medusa order → build_excel dict (Sage/Excel dispatch, §8) ───────────────────────────────
def medusa_order_to_excel_dict(mo: Dict[str, Any]) -> Dict[str, Any]:
    meta = mo.get("metadata") or {}
    cust = meta.get("customer_name") or ""
    if not cust:
        c = mo.get("customer") or {}
        cust = (c.get("first_name") or "") or meta.get("phone", "")
    lines = []
    for li in mo.get("items") or []:
        lmeta = li.get("metadata") or {}
        var = bool(lmeta.get("variable_weight", False))
        lines.append({
            "item": li.get("title") or li.get("product_title") or "",
            "qty": li.get("quantity"),
            "unit": lmeta.get("unit", ""),
            # variable-weight lines render blank Importe in build_excel when price is None
            "price": None if var else li.get("unit_price"),
            "note": lmeta.get("note", ""),
        })
    return {
        "customer_name": cust,
        "phone_number": meta.get("phone", ""),
        "lines": lines,
        "delivery_date": meta.get("delivery_date"),
    }
