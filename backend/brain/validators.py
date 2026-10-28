"""Deterministic validators (RUNTIME L3) — code, not vibes.

Catch a confidently-wrong fill independent of the LLM: SKU exists, unit/pack sane, quantity in
range vs this customer's history, delivery date parses. These feed the decision agent + the
keep-in-mind bands; they never depend on the model's self-confidence.

TWO NORMS, NOT ONE (SPEC §5.8a item 1, WP-3 2026-07-26). `validate()` is the PER-LINE norm: this
qty against this customer's own history for this SKU. It misses the risk that actually costs money —
**fifteen individually normal lines that add to four times their usual basket**. `validate_order()`
is that second norm, order-level, computed from the same history and shaped the same way (median of
the last N, a ratio, a band). It is a REVIEW reason (§5.8 FLAG), not a keep-in-mind band: nobody but
the comercial can decide whether this customer is good for a €4.000 order.
"""
from __future__ import annotations

import re
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from brain import billing

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

# ── the ORDER-LEVEL norm (§5.8a item 1) ──────────────────────────────────────────────────────────
# N = the last 8 orders. Chosen because that is EXACTLY the window `brain.context.gather` already
# holds (`order by created_at desc limit 8`) — one definition of "recent", no second query, and the
# validator can never disagree with the history the mind is reading in the same turn. At these
# customers' cadence (weekly-ish) eight orders is about two months: long enough that one fiesta week
# cannot define the norm, short enough that a seasonal price move has not rewritten it.
ORDER_VALUE_WINDOW = 8
# The floor. Below THREE priced orders there is no norm and we say so — a median of two is just their
# mean, so a single big Christmas order would silently become "typical" and every ordinary order
# after it would read as suspiciously small. With no norm, `value_off_norm` is False: we never invent
# one (the same rule brain/range.py applies to a range the tenant never gave us).
ORDER_VALUE_MIN_N = 3
# The band is ONE-SIDED: > 3× the median. Two reasons it is not the per-line ±band (<0.4 / >2.5).
# (a) A SMALL order needs no commercial decision — nobody has to approve a customer buying less —
#     and §5.8 keeps the queue near-empty by refusing reasons that are not decisions.
# (b) An order TOTAL is a sum, so it is structurally less volatile than one line's qty: a normal busy
#     week already lands near 2×, and a 2.5 band would put the queue straight back into the
#     "everything the system noticed" business this rule exists to end. 3× is a basket you look at.
ORDER_VALUE_HIGH = 3.0


def _typical_qty(sku_id: Optional[str], name: Optional[str],
                 recent_orders: List[Dict[str, Any]]) -> (Optional[float], int):
    qtys: List[float] = []
    for o in recent_orders:
        for ln in (o.get("lines") or []):
            same = (sku_id and ln.get("sku_id") == sku_id) or \
                   (name and name in (ln.get("name"), ln.get("mention"), ln.get("item")))
            if same and isinstance(ln.get("qty"), (int, float)):
                qtys.append(float(ln["qty"]))
    if len(qtys) >= 2:
        qtys.sort()
        return qtys[len(qtys) // 2], len(qtys)  # median
    return None, len(qtys)


def _order_lines(o: Dict[str, Any]) -> List[Dict[str, Any]]:
    """The lines of a past order, whatever the pool handed us. asyncpg's jsonb codec decodes to a
    list, but a row read through a pool without the codec arrives as text — a norm that silently
    became "no history" because of a connection setting is the kind of bug nobody ever finds."""
    lines = o.get("lines")
    if isinstance(lines, str):
        import json
        try:
            lines = json.loads(lines or "[]")
        except ValueError:
            lines = []
    return [ln for ln in (lines or []) if isinstance(ln, dict)]


def _typical_order_value(recent_orders: List[Dict[str, Any]]) -> (Optional[int], int):
    """(median order value in cents, how many priced orders it came from) for THIS customer.

    Same shape as `_typical_qty` above, one level up: sort, take the upper-middle element (not the
    mean of the two middles — the existing convention, kept so both norms behave identically on an
    even count). Only orders that resolved to a real value count: a fully-unpriced order values at 0
    cents, and letting a zero into the sample would drag the median down until every ordinary order
    read as enormous. Under ORDER_VALUE_MIN_N priced orders there is NO norm — (None, n)."""
    values: List[int] = []
    for o in (recent_orders or [])[:ORDER_VALUE_WINDOW]:
        cents, _ = billing.order_value_snapshot({"lines": _order_lines(o)}, {})
        if cents > 0:
            values.append(int(cents))
    if len(values) >= ORDER_VALUE_MIN_N:
        values.sort()
        return values[len(values) // 2], len(values)
    return None, len(values)


def _order_value_now(grounded_lines: List[Dict[str, Any]]) -> (int, int):
    """(cents, unpriced line count) for the order in front of us, by the SAME rule the money meter
    uses at dispatch (brain.billing.order_value_snapshot, eng F1): the STATED price wins → else the
    tenant CATALOGUE price for the grounded SKU → else the line is counted unpriced and contributes
    zero. There is exactly one price rule in this product and this is a call into it, not a copy.

    The catalogue half needs no query: the matcher already read `price` off `catalogue_skus` for
    every candidate this turn, so `match.pick.price` IS the catalogue price. `line["price"]` is the
    stated-price seam — the synthesiser does not emit one today, and the day it does this honours it
    without a change here."""
    lines: List[Dict[str, Any]] = []
    prices: Dict[str, float] = {}
    for gl in (grounded_lines or []):
        pick = ((gl.get("match") or {}).get("pick")) or {}
        sku_id = str(pick.get("sku_id") or "")
        p = pick.get("price")
        if sku_id and isinstance(p, (int, float)) and not isinstance(p, bool) and float(p) > 0:
            prices[sku_id] = float(p)
        lines.append({"item": gl.get("mention") or "", "qty": gl.get("qty"),
                      "price": gl.get("price"), "sku_id": sku_id})
    cents, detail = billing.order_value_snapshot({"lines": lines}, prices)
    return int(cents), int(detail.get("unpriced_lines") or 0)


def _x(ratio: float) -> str:
    """«4×» — how many times their usual, the way a person says it. Whole multiples: the band starts
    at 3×, so a decimal here would only ever be false precision about a median of eight orders."""
    return f"{round(ratio):g}"


def validate_order(grounded_lines: List[Dict[str, Any]], vflags: List[Dict[str, Any]],
                   ctx: Dict[str, Any]) -> Dict[str, Any]:
    """The ORDER-LEVEL norm (§5.8a item 1): is this whole order far bigger than this customer ever
    orders? Deterministic, index-free, and it never looks at what the model thought.

    Returns {value_cents, typical_value_cents, typical_n, value_off_norm, ratio, unpriced_lines,
    reason}. `reason` is es-ES and boss-facing — ONE reason, never a list (§5.8a tone law): the
    comercial needs to know what to decide, not everything the system noticed. It is "" unless the
    band actually fired, so a caller can park on the truthiness of the reason itself.

    `vflags` is accepted (and index-aligned with `grounded_lines`, as `validate()` returns it) so the
    order-level rule can grow a "…and half the lines were already off-norm" refinement without a
    signature change; it is deliberately not consulted today — the per-line rule already speaks for
    those lines, and a review that fires twice for the same fact is two reasons wearing one coat."""
    value_cents, unpriced = _order_value_now(grounded_lines)
    typical, n = _typical_order_value(ctx.get("recent_orders") or [])
    out: Dict[str, Any] = {
        "value_cents": value_cents,
        "typical_value_cents": typical,
        "typical_n": n,
        "value_off_norm": False,
        "ratio": None,
        "unpriced_lines": unpriced,
        "reason": "",
    }
    # No norm (thin history), or nothing we could price → no claim. Never invent a norm.
    if not typical or typical <= 0 or value_cents <= 0:
        return out
    ratio = value_cents / float(typical)
    out["ratio"] = round(ratio, 2)
    if ratio > ORDER_VALUE_HIGH:
        out["value_off_norm"] = True
        out["reason"] = f"pedido muy grande para este cliente: ~{_x(ratio)}× lo que suele pedir"
    return out


def date_ok(d: Optional[str]) -> bool:
    if not d:
        return True  # absent is fine (inferred/none)
    if not _DATE_RE.match(d):
        return False
    try:
        dt = datetime.strptime(d, "%Y-%m-%d").date()
    except ValueError:
        return False
    # plausible delivery window: not absurdly far past/future
    today = date.today()
    return (dt - today).days >= -2 and (dt - today).days <= 120


def validate(grounded_lines: List[Dict[str, Any]], ctx: Dict[str, Any]) -> List[Dict[str, Any]]:
    recent = ctx.get("recent_orders") or []
    flags: List[Dict[str, Any]] = []
    for gl in grounded_lines:
        m = gl.get("match") or {}
        pick = m.get("pick") or {}
        qty = gl.get("qty")
        typ, n = _typical_qty(pick.get("sku_id"), pick.get("name"), recent)
        off_norm = False
        if typ and isinstance(qty, (int, float)) and typ > 0:
            ratio = qty / typ
            off_norm = ratio < 0.4 or ratio > 2.5
        flags.append({
            "sku_exists": bool(pick.get("sku_id")) and not m.get("abstain"),
            "unit_ok": m.get("unit_ok", True),
            "unit_note": m.get("unit_note", ""),
            "variable_weight": bool(pick.get("variable_weight")),
            "qty_off_norm": off_norm,
            "typical_qty": typ,
            "typical_n": n,
            "tight": m.get("tight", False),
            "band": m.get("band", "unsure"),
        })
    return flags
