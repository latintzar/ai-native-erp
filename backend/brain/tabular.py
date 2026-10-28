"""Build the tabular SKU order (Register #19): code · qty · unit · price · date + the doubt band.

Produces order lines compatible with the existing orders.lines / Excel shape (raw_text, item, qty,
unit, price, note, confidence) PLUS the grounded fields the brain adds (sku_id, code, name,
keep_in_mind, attention band, candidates) — additive, so build_excel and the app keep working.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List

import config
import db
from brain import keepinmind

log = logging.getLogger("rocoto.tabular")


async def _sku_info(sku_ids: List[str], tenant: str) -> Dict[str, Dict[str, Any]]:
    ids = [s for s in dict.fromkeys(sku_ids) if s]
    if not ids:
        return {}
    pool = db.get_pool()
    async with pool.acquire() as con:
        rows = await con.fetch(
            """select id, code, name, family, base_unit, price::float8 as price, variable_weight
                 from catalogue_skus where tenant_id=$1 and id = any($2::text[])""",
            tenant, ids)
    return {r["id"]: dict(r) for r in rows}


async def _customer_prices(phone: str, sku_ids: List[str], tenant: str) -> Dict[str, float]:
    """§17.45 — this customer's own prices with THIS supplier, per article.

    «A fixed price beats the list price — for that customer alone; different customers can hold
    different fixed prices for the same product.» Dana at Escofruit, Mercabarna, Aug 2026.

    Keyed (tenant, phone, sku) because a restaurant that buys from two distributors holds a
    separate arrangement with each — the same law WP-A1 phase C wrote into `endpoint` and
    `customer_profiles`. Rows with a NULL price are the OTHER half of §17.45 («his list, at my
    prices») and are skipped here: they limit what he can order, not what it costs.
    """
    ids = [s for s in dict.fromkeys(sku_ids) if s]
    if not ids or not phone:
        return {}
    try:
        async with db.get_pool().acquire() as con:
            rows = await con.fetch(
                "select sku_id, price::float8 as price from customer_sku_prices "
                "where tenant_id=$1 and phone_number=$2 and sku_id = any($3::text[]) "
                "and price is not null", tenant, phone, ids)
        return {r["sku_id"]: r["price"] for r in rows}
    except Exception:
        # fail-soft to the LIST price: a pricing table hiccup must never leave a line unpriced,
        # and the list price is the honest fallback (it is what this article costs by default).
        log.debug("customer price read fail-soft for %s", phone, exc_info=True)
        return {}


async def build(decided: Dict[str, Any], synth: Dict[str, Any],
                vflags: List[Dict[str, Any]], ctx: Dict[str, Any]) -> List[Dict[str, Any]]:
    tenant = ctx.get("tenant") or config.BRAIN_TENANT
    grounded = synth.get("grounded_lines") or []
    chosen = [d.get("sku_id") for d in decided.get("lines") or []]
    info = await _sku_info(chosen, tenant)
    # §17.45: his price, if he has one with this supplier, beats the list price below.
    own = await _customer_prices(str(ctx.get("phone") or ""), chosen, tenant)
    # §PERSONALIZACIÓN — `custom: ignore` takes the product and the quantity and drops the
    # qualifier. Read ONCE per order rather than per line: it is a property of the supplier, and a
    # per-line read would be six identical queries for one answer. Fail-soft to keeping the note,
    # which is the default and the pre-existing behaviour — losing what a customer said should
    # never be what a database hiccup does.
    keep_custom = True
    try:
        import behaviour as _behaviour
        keep_custom = (await _behaviour.get(tenant)).get("custom", "keep") != "ignore"
    except Exception:
        log.debug("tabular: custom posture read fail-soft for %s", tenant, exc_info=True)

    out: List[Dict[str, Any]] = []
    for d in decided.get("lines") or []:
        i = d.get("index")
        if not isinstance(i, int) or not (0 <= i < len(grounded)):
            continue
        gl = grounded[i]
        m = gl.get("match") or {}
        fl = vflags[i] if i < len(vflags) else {}
        # §17.35 write-down law: when the decision agent leaves sku_id empty the line is
        # OFF-LIST and carries the customer's verbatim words — never the matcher's best
        # guess. `pick` stays in candidates, where it is a question, not a line.
        sku_id = d.get("sku_id") or ""
        off_list = not sku_id
        ci = info.get(sku_id) or {}
        attention, kim = keepinmind.decide_band(m, fl, d.get("keep_in_mind"), sku_id)
        qty = d.get("qty")
        unit = d.get("unit") or ci.get("base_unit") or gl.get("unit") or ""
        # §17.45 — HIS price wins over the list price, for him alone. Off-list lines stay
        # unpriced no matter what: §17.35's write-down law says an off-catalogue mention carries
        # the customer's verbatim words and NO price, and a per-customer arrangement is keyed on a
        # sku_id that an off-list line does not have.
        price = (own.get(sku_id) or ci.get("price")) if not off_list else None
        variable = bool(ci.get("variable_weight"))
        line_total = (round(qty * price, 2)
                      if isinstance(qty, (int, float)) and isinstance(price, (int, float)) and not variable
                      else None)
        name = ci.get("name") if not off_list else gl.get("mention")
        name = name or gl.get("mention")
        out.append({
            "raw_text": gl.get("mention"),
            "mention": gl.get("mention"),
            "item": name,
            "off_list": off_list,
            "sku_id": sku_id,
            "code": ci.get("code") if not off_list else None,
            "name": name,
            "family": ci.get("family"),
            "qty": qty,
            "unit": unit,
            "price": price,
            "line_total": line_total,
            "variable_weight": variable,
            "note": (gl.get("note", "") if keep_custom else ""),
            # CUSTOM IS THE LABEL ON THE NOTE (Peter, 2026-08-16). `custom` already exists on the
            # wire in all four closed-vocabulary places — contract.ts, Dto.kt, the Kotlin model and
            # baskets — where `brain/seed.py` states the semantics outright: «a customization
            # request flips the line custom». Nothing on the WhatsApp path ever set it, so the flag
            # had one writer (the storefront) and no reader on the web at all.
            # Derived, never asked for separately: a line the customer qualified IS a customised
            # line, and asking the model for a second boolean about its own note is how the two
            # drift apart. `note` is the fact; `custom` is how a surface finds it.
            "custom": bool(keep_custom and str(gl.get("note", "") or "").strip()),
            "keep_in_mind": kim,
            "attention": attention,            # clean | note | underline
            "band": m.get("band"),
            "confidence": keepinmind.confidence_for(attention),
            "candidates": (m.get("candidates") or [])[:3],
        })
    return out
