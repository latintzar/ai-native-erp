"""Acceptability engine (acceptability-engine.md) — DETERMINISTIC at runtime, no LLM.

`evaluate(basket, *, now, phone)` returns the decision ladder outcome:
  {decision, message, alt, rule_id, queued}

Ladder (FIRST MATCH WINS):
  1. rogue/unknown customization      → review        (queued if sleeping-window)
  2. over the quantity envelope        → qty_pushback   (alt at instant_accept_max — the "hero gift")
  3. ASAP/overnight inside an asap rule→ instant_accept (rule_id set; hit_count++)
  4. ASAP/overnight outside every rule → suggest_alt    (guaranteed-yes next-day alt)
  5. standard non-ASAP order           → instant_accept (falls through to checkout)
  6. catch-all / error                 → review         (safe default)

NO money movement here — the engine returns a decision only. Instant-accept = order confirmed,
settles on the customer's normal terms (Medusa/Stripe-Connect's job). The "no silent charge" law.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional
from zoneinfo import ZoneInfo

import config
import db

MADRID = ZoneInfo("Europe/Madrid")
DEFAULT_SLEEP_START = 22  # 22:00 Madrid
DEFAULT_SLEEP_END = 8     # 08:00 Madrid


def _now_madrid(now: Optional[datetime] = None) -> datetime:
    if now is None:
        return datetime.now(MADRID)
    if now.tzinfo is None:
        now = now.replace(tzinfo=MADRID)
    return now.astimezone(MADRID)


def in_sleeping_window(now: Optional[datetime] = None, *,
                       start_hour: int = DEFAULT_SLEEP_START,
                       end_hour: int = DEFAULT_SLEEP_END) -> bool:
    """True if the Madrid wall-clock hour is inside the owner's sleeping window. DST-correct: the
    instant is converted to Europe/Madrid (CET/CEST) before the hour is read, so the window never
    drifts across the DST boundary."""
    h = _now_madrid(now).hour
    if start_hour <= end_hour:
        return start_hour <= h < end_hour
    return h >= start_hour or h < end_hour   # wraps midnight (e.g. 22:00 → 08:00)


def _d(decision: str, message: str = "", *, alt: Optional[dict] = None,
       rule_id: Optional[str] = None, queued: bool = False) -> Dict[str, Any]:
    return {"decision": decision, "message": message, "alt": alt, "rule_id": rule_id, "queued": queued}


async def _hold_new_customer(tenant: str, phone: str) -> bool:
    """§17.6 / issue #12 — THE NEW-CUSTOMER GATE. Per-tenant, OFF by default (additive column
    `tenants.behaviour`), so nothing changes for any live tenant until they flip it. «New» =
    this phone has never had a booked, non-test order with this tenant before the one under
    evaluation (which is already filed → prior count ≤ 1 means first)."""
    pool = db.get_pool()
    async with pool.acquire() as con:
        on = await con.fetchval(
            "select coalesce((behaviour->>'hold_new_customers')::boolean, false) "
            "from tenants where slug=$1", tenant)
        if not on:
            return False
        prior = await con.fetchval(
            """select count(*) from orders
                where tenant_id=$1 and phone_number=$2
                  and status not in ('cancelled', 'rejected')
                  and coalesce(stage, '') <> 'test'""", tenant, phone)
        return int(prior or 0) <= 1


async def _load_rules(tenant: str, phone: Optional[str]) -> List[Dict[str, Any]]:
    pool = db.get_pool()
    async with pool.acquire() as con:
        rows = await con.fetch(
            """select id, kind, scope, phone_number, pattern from accept_rules
                 where tenant_id=$1 and enabled
                   and (scope='tenant' or (scope='customer' and phone_number=$2))""",
            tenant, phone or "")
    rules = [dict(r) for r in rows]
    # customer-scoped rules win → evaluate them first
    rules.sort(key=lambda r: 0 if r["scope"] == "customer" else 1)
    return rules


def _basket_total(lines: List[dict]) -> float:
    t = 0.0
    for ln in lines:
        p = ln.get("price")
        q = ln.get("qty") or 0
        if p is not None:
            t += float(p) * float(q)
    return t


def _line_category(ln: dict) -> str:
    return ln.get("category") or ln.get("family") or ""


def _custom_known(ln: dict, rules: List[dict]) -> bool:
    """A customization is 'known' if a kind='customization' rule covers (sku, value)."""
    val = (ln.get("customization") or ln.get("customization_value") or "").strip().lower()
    if not val:
        return True
    sku = ln.get("sku_id")
    for r in rules:
        if r["kind"] != "customization":
            continue
        p = r.get("pattern") or {}
        if (p.get("sku") in (None, sku)) and str(p.get("option_value", "")).strip().lower() == val:
            return True
    return False


def _has_rogue_custom(lines: List[dict], rules: List[dict]) -> bool:
    for ln in lines:
        if (ln.get("customization") or ln.get("customization_value")) and not _custom_known(ln, rules):
            return True
    return False


def _qty_rule_for(ln: dict, rules: List[dict]) -> Optional[dict]:
    sku = ln.get("sku_id")
    cat = _line_category(ln)
    for r in rules:
        if r["kind"] != "qty":
            continue
        p = r.get("pattern") or {}
        if (p.get("sku") and p["sku"] == sku) or (p.get("category") and p["category"] == cat):
            return r
    return None


def _qty_pushback(lines: List[dict], rules: List[dict]) -> Optional[Dict[str, Any]]:
    for ln in lines:
        r = _qty_rule_for(ln, rules)
        if not r:
            continue
        p = r.get("pattern") or {}
        review_above = p.get("review_above")
        iamax = p.get("instant_accept_max")
        soft_cap = p.get("soft_cap") or review_above
        qty = float(ln.get("qty") or 0)
        if review_above is not None and qty > float(review_above):
            name = ln.get("item") or ln.get("name") or "that"
            msg = (f"{int(qty)} {name} is a lot — we usually do under {soft_cap}. "
                   f"{iamax} instant-accepts, {int(qty)} needs a quick check. "
                   f"Want the {iamax} now, or shall I send {int(qty)} to the team?")
            alt = {"lines": [dict(ln, qty=iamax)] , "asap": False, "instant_qty": iamax}
            return _d("qty_pushback", msg, alt=alt, rule_id=r["id"])
    return None


def _match_asap(basket: dict, lines: List[dict], rules: List[dict]) -> Optional[dict]:
    total = basket.get("total_eur")
    if total is None:
        total = _basket_total(lines)
    for r in rules:
        if r["kind"] != "asap":
            continue
        p = r.get("pattern") or {}
        mqpl = p.get("max_qty_per_line")
        if mqpl is not None and any(float(ln.get("qty") or 0) > float(mqpl) for ln in lines):
            continue
        ml = p.get("max_lines")
        if ml is not None and len(lines) > int(ml):
            continue
        mt = p.get("max_total_eur")
        if mt is not None and total > float(mt):
            continue
        skus = p.get("skus")
        cats = p.get("categories")
        if skus:
            if not all(ln.get("sku_id") in skus for ln in lines):
                continue
        if cats:
            if not all(_line_category(ln) in cats for ln in lines):
                continue
        return r
    return None


async def _record_hit(rule_id: str) -> None:
    try:
        pool = db.get_pool()
        async with pool.acquire() as con:
            await con.execute(
                "update accept_rules set hit_count=hit_count+1, last_hit_at=now() where id=$1", rule_id)
    except Exception:
        pass


async def evaluate(basket: Dict[str, Any], *, now: Optional[datetime] = None,
                   phone: Optional[str] = None, tenant: Optional[str] = None) -> Dict[str, Any]:
    tenant = tenant or config.BRAIN_TENANT
    phone = phone or basket.get("phone")
    lines = basket.get("lines") or []
    asap = bool(basket.get("asap"))
    sleeping = in_sleeping_window(now)
    try:
        rules = await _load_rules(tenant, phone)
        # 0.5 · the NEW-CUSTOMER gate (before any accept path; same fail-toward-parking bias)
        if phone and await _hold_new_customer(tenant, phone):
            return _d("review", "Sent to Rocoto — they'll confirm on WhatsApp.", queued=sleeping)
    except Exception:
        return _d("review", "Sent to Rocoto — they'll confirm on WhatsApp.", queued=sleeping)

    # 1. rogue customization
    if _has_rogue_custom(lines, rules):
        return _d("review", "Sent to Rocoto — they'll confirm on WhatsApp.", queued=sleeping)
    # 2. over the quantity envelope
    push = _qty_pushback(lines, rules)
    if push:
        return push
    # 3/4. ASAP / overnight
    if asap or sleeping:
        rule = _match_asap(basket, lines, rules)
        if rule:
            await _record_hit(rule["id"])
            return _d("instant_accept", "Accepted ✓ — out for next-day morning.", rule_id=rule["id"])
        alt = {**basket, "asap": False, "delivery_window": "next_day_am"}
        return _d("suggest_alt", "Not tonight — but tomorrow 8am is guaranteed. Want that?",
                  alt=alt, queued=sleeping)
    # 5. standard, non-ASAP
    return _d("instant_accept", "")


def order_to_basket(order: Dict[str, Any], *, asap: bool = True) -> Dict[str, Any]:
    """Build an evaluate() basket from a Rocoto order projection (for the auto-accept sweep)."""
    lines = order.get("lines") or []
    return {
        "lines": lines,
        "total_eur": _basket_total(lines),
        "asap": asap,
        "phone": order.get("phone_number", ""),
    }
