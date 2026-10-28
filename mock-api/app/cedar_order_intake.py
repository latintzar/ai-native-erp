"""Authenticated Cedar text-order reading, aligned with the maintained order-brain contract.

The maintained product owns persistence and the five-scale pipeline. This development runtime
reuses its conservative structured boundary: classify first, quote every line, ground product IDs
against the supplied Cedar catalogue, and leave every accepted order in operator review.
"""
from __future__ import annotations

import json
import math
import re
import time
from datetime import date
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Request

from . import cedar_access, cedar_source_budget, copilot
from .config import settings
from .errors import RuntimeError_

router = APIRouter(prefix="/api/cedar/orders", tags=["cedar-development"])
MAX_TEXT = 5000
MAX_PRODUCTS = 200
MAX_LINES = 50
DAY = re.compile(r"^\d{4}-\d{2}-\d{2}$")
ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.:-]{0,119}$")

SYSTEM = """You read an informal customer message sent to a fresh-food distributor.
Decide whether it places or changes an order. Quote only words present in the message. Extract no
quantity, product or date the customer did not state. Match a productId only to an exact catalogue
item in the supplied list; use null when the words remain outside that catalogue. A human reviews
every result. Answer with one JSON object in this exact shape:
{"isOrder":true,"needsReply":true,"deliveryDay":"YYYY-MM-DD or null","deliveryRaw":"exact date words or null",
"lines":[{"rawText":"exact quote",
"item":"customer's product words","qty":12,"unit":"kg","productId":"catalogue id or null",
"confidence":"low|medium|high"}]}
A question or complaint answers isOrder false and needsReply true. A greeting or conversation that
is complete answers both false. Always include needsReply and answer with lines [] for a non-order."""


def calendar_day(value: object) -> bool:
    if not isinstance(value, str) or not DAY.fullmatch(value):
        return False
    try:
        date.fromisoformat(value)
        return True
    except ValueError:
        return False


def shape(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise HTTPException(400, "Send one Cedar order-reading object.")
    text = str(payload.get("text") or "").strip()
    source_event = str(payload.get("sourceEvent") or "").strip()
    reference_day = str(payload.get("referenceDay") or "").strip()
    customer_id = str(payload.get("customerId") or "").strip()
    if not text or len(text) > MAX_TEXT or not ID.fullmatch(source_event):
        raise HTTPException(400, "Review the source message and its event identity.")
    if not calendar_day(reference_day):
        raise HTTPException(400, "Choose the current Cedar calendar day.")
    if customer_id and not ID.fullmatch(customer_id):
        raise HTTPException(400, "Choose a Cedar customer identity.")
    product_rows = payload.get("products")
    if not isinstance(product_rows, list) or len(product_rows) > MAX_PRODUCTS:
        raise HTTPException(400, "Review the Cedar product catalogue supplied for this reading.")
    products = []
    for row in product_rows:
        if not isinstance(row, dict):
            continue
        product_id = str(row.get("id") or "").strip()
        name = str(row.get("name") or "").strip()
        unit = str(row.get("unit") or "").strip()
        if ID.fullmatch(product_id) and 1 <= len(name) <= 160 and len(unit) <= 30:
            products.append({"id": product_id, "name": name, "unit": unit})
    return {
        "text": text,
        "sourceEvent": source_event,
        "referenceDay": reference_day,
        "customerId": customer_id,
        "products": products,
    }


def _object(value: str) -> dict[str, Any]:
    body = value.strip()
    fenced = re.fullmatch(r"```(?:json)?\s*(.*?)\s*```", body, re.S)
    if fenced:
        body = fenced.group(1)
    parsed = json.loads(body)
    if not isinstance(parsed, dict):
        raise ValueError("object required")
    return parsed


def read(value: str, request: dict[str, Any]) -> dict[str, Any]:
    parsed = _object(value)
    needs_reply = parsed.get("needsReply") is True
    if parsed.get("isOrder") is not True:
        return {
            "isOrder": False,
            "needsReply": needs_reply,
            "deliveryDay": None,
            "lines": [],
        }
    known = {row["id"] for row in request["products"]}
    text = request["text"]
    lines = []
    raw_lines = parsed.get("lines")
    if not isinstance(raw_lines, list) or len(raw_lines) > MAX_LINES:
        raise ValueError("bounded lines required")
    for raw in raw_lines:
        if not isinstance(raw, dict):
            continue
        quote = str(raw.get("rawText") or "").strip()
        item = str(raw.get("item") or "").strip()
        unit = str(raw.get("unit") or "").strip()[:30]
        product_id = raw.get("productId")
        confidence = raw.get("confidence")
        qty = raw.get("qty")
        if not quote or quote not in text or not item or len(item) > 160:
            continue
        if isinstance(qty, bool) or not isinstance(qty, (int, float)) or not math.isfinite(qty) or qty <= 0:
            qty = None
        if not isinstance(product_id, str) or product_id not in known:
            product_id = None
        if confidence not in ("low", "medium", "high"):
            confidence = "low"
        lines.append({
            "rawText": quote,
            "item": item,
            "qty": qty,
            "unit": unit,
            "productId": product_id,
            "confidence": confidence,
        })
    if not lines:
        return {"isOrder": False, "needsReply": needs_reply, "deliveryDay": None, "lines": []}
    delivery_day = parsed.get("deliveryDay")
    delivery_raw = parsed.get("deliveryRaw")
    if (
        not calendar_day(delivery_day)
        or not isinstance(delivery_raw, str)
        or not delivery_raw.strip()
        or delivery_raw.strip() not in text
    ):
        delivery_day = None
    return {"isOrder": True, "needsReply": True, "deliveryDay": delivery_day, "lines": lines}


async def parse(payload: Any) -> dict[str, Any]:
    request = shape(payload)
    provider = settings.copilot_provider
    if provider == "awaiting key":
        raise RuntimeError_("order_intake_unconfigured", "Order reading is awaiting its runtime key.", 503)
    prompt = json.dumps(request, ensure_ascii=False, separators=(",", ":"))
    call = copilot.PROVIDERS[provider]
    started = time.time()
    budget = settings.copilot_timeout_seconds
    turns = [{"role": "user", "text": prompt + "\nAnswer with the JSON object alone."}]
    tokens = 0
    async with httpx.AsyncClient(timeout=httpx.Timeout(budget, connect=10.0)) as client:
        for attempt in (1, 2):
            try:
                answer, spent = await call(client, SYSTEM, turns)
                tokens += spent
                parsed = read(answer, request)
                elapsed = int((time.time() - started) * 1000)
                return {
                    **parsed,
                    "mode": "model",
                    "evidence": {
                        "model": copilot.model_name(provider),
                        "ms": elapsed,
                        "tokens": tokens,
                    },
                }
            except (json.JSONDecodeError, ValueError):
                if attempt == 2:
                    break
                turns = [
                    {"role": "user", "text": prompt},
                    {"role": "model", "text": answer[:1200]},
                    {"role": "user", "text": "Return the required JSON object alone."},
                ]
            except RuntimeError_:
                raise
            except httpx.TimeoutException as error:
                raise RuntimeError_(
                    "order_intake_timeout",
                    "Order reading is ready for another attempt.",
                    504,
                ) from error
            except Exception as error:
                raise RuntimeError_(
                    "order_intake_failed",
                    "Order reading is ready for another attempt.",
                    502,
                ) from error
    raise RuntimeError_("order_intake_shape", "Order reading is ready for another attempt.", 502)


@router.post("/parse")
async def parse_order(payload: dict, request: Request):
    workspace = cedar_access.authorize(request)
    cedar_source_budget.charge(workspace)
    return await parse(payload)
