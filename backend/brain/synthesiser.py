"""Synthesiser (Sonnet) — merge the 5 scale-reads into the real order, then run the SKU match.

The merge is the LLM's job (reconcile reads, resolve references/ellipsis, dedupe, split). The
matching is deterministic code (brain.matcher), not the LLM — understand first, match second
(Register #17, READ≠MATCH). Output = the merged lines each carrying its matcher candidates.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List

import config
from brain import llm, matcher, prompts

log = logging.getLogger("rocoto.brain.synth")


def _reads_blob(reads: List[Dict[str, Any]]) -> str:
    out = []
    for r in reads:
        items = "; ".join(
            f"{i.get('qty','?')}{i.get('unit','')} {i.get('mention','')}"
            + (f" (ref: {i['reference']})" if i.get("reference") else "")
            for i in (r.get("items") or [])
        ) or "(nothing)"
        sig = ", ".join(r.get("signals") or [])
        out.append(f"[{r.get('scale')}] order={r.get('is_order')} items: {items}" + (f" | signals: {sig}" if sig else ""))
    return "\n".join(out)


async def synthesise(ctx: Dict[str, Any], reads: List[Dict[str, Any]]) -> Dict[str, Any]:
    prof = ctx.get("profile") or {}
    basket = prof.get("typical_basket") or []
    basket_str = ", ".join(
        f"{b.get('qty', '?')}{b.get('unit', '')} {b.get('name', b.get('sku_id', ''))}" for b in basket
    ) or "(none on file yet)"
    user = "\n".join([
        f"TODAY IS {ctx.get('today_date','')}.",
        f"CURRENT MESSAGE:\n{ctx['today_text']}",
        "",
        f"THEIR USUAL BASKET (expand 'the usual'/'lo de siempre' to THESE concrete lines):\n{basket_str}",
        "",
        f"SCALE READS:\n{_reads_blob(reads)}",
        "",
        f"RECENT ORDERS:\n{ctx['recent_orders_text']}",
        "",
        "OPEN ORDERS YOU CAN CHANGE (set amends_ref to one of these numbers if the message modifies "
        f"that order; FULL updated basket in lines):\n{ctx.get('open_orders_text', '(none)')}",
        "",
        f"PROFILE:\n{ctx['profile_text']}",
    ])
    try:
        synth = await llm.call_tool(
            config.SYNTH_MODEL, prompts.SYNTH_SYSTEM, user, prompts.SYNTH_TOOL,
            "synthesise_order", max_tokens=1536, fallback=config.ORDER_EXTRACT_FALLBACK_MODEL)
    except Exception:
        log.exception("synthesise failed")
        synth = None
    if not synth:
        # fall back to the today reader's items so we never silently lose an order
        today = next((r for r in reads if r.get("scale") == "today"), {})
        synth = {"is_order": bool(today.get("items")),
                 "lines": [{"mention": i.get("mention", ""), "qty": i.get("qty"), "unit": i.get("unit", ""),
                            "note": i.get("note", "")} for i in (today.get("items") or [])]}

    # Resolve the amendment reference (a number into ctx["open_orders"]) to a concrete order id.
    open_orders = ctx.get("open_orders") or []
    synth["amends_order_id"] = None
    try:
        ref = int(synth.get("amends_ref") or 0)
    except (TypeError, ValueError):
        ref = 0
    if 1 <= ref <= len(open_orders):
        synth["amends_order_id"] = open_orders[ref - 1].get("id")
    # …and the CANCELLATION reference the same way. It is deliberately a separate field: a
    # cancellation carries no lines, so folding it into `amends_ref` would be indistinguishable
    # from an amendment the reader failed to fill in — and the pipeline's «no lines → not an
    # order» drop is precisely how «anúlame el pedido» used to disappear.
    synth["cancels_order_id"] = None
    try:
        cref = int(synth.get("cancels_ref") or 0)
    except (TypeError, ValueError):
        cref = 0
    if 1 <= cref <= len(open_orders):
        synth["cancels_order_id"] = open_orders[cref - 1].get("id")
    synth["change_reason"] = (synth.get("change_reason") or "").strip()

    lines = synth.get("lines") or []
    phone = ctx.get("phone")
    # ground each merged line (deterministic matcher) -> candidates for the decision agent
    grounded: List[Dict[str, Any]] = []
    for ln in lines:
        mention = (ln.get("mention") or "").strip()
        if not mention:
            continue
        # WP-2.5 rehearsal find: the tenant MUST thread through — defaulting to BRAIN_TENANT here
        # grounded every post-golive tenant's order against the wrong (empty) catalogue.
        m = await matcher.match(mention, phone=phone, tenant=ctx.get("tenant"),
                                unit_hint=ln.get("unit"), qty=ln.get("qty"))
        grounded.append({
            "mention": mention,
            "qty": ln.get("qty"),
            "unit": ln.get("unit") or (m.pick or {}).get("base_unit") or "",
            "note": ln.get("note", ""),
            "match": m.as_dict(),
        })
    synth["grounded_lines"] = grounded
    return synth
