"""orders_tool.py — placing/editing a real Medusa order as a runtime AGENCY action (SPEC §5/§7).

This is the FIRST ORDER seam: Rocoto reads a customer's message, grounds it into an order sheet
against the tenant's real catalogue, and — ONLY on an explicit approval — writes that order into
Medusa (the order master). Two organs:

  * draft_order(scope, text)  — turn a free-text order into a GROUNDED order sheet
      {lines:[{sku,qty,price}], total, unmatched:[]}. Every line is grounded through the existing
      order-brain matcher (brain/matcher.match) against catalogue_skus; a mention that doesn't
      resolve NEVER invents a SKU or a price — it lands in `unmatched` (SPEC §4.3 grounding: abstain,
      don't guess). No Medusa write, no side effects beyond an `order.drafted` event.

  * place_order(scope, draft, approved) — GATED agency (SPEC §0 / §5.0.1: placing is a dangerous
      grant, never autonomous). approved=True → build the frozen create-order payload
      (brain/medusa_map.build_create_order_payload) and create it via the existing MedusaClient,
      bind the provider id in entity_map, append `order.placed`, and return a grounded confirmation
      sentence + the Medusa order id. approved=False (or Medusa unavailable) → park an
      action(kind='place_order', needs_human=true) on the review sheet and append `order.parked`.
      NEVER auto-places.

Design contracts (do NOT drift):
  * Grounding: a line's `sku`, `name`, and `price` come ONLY from the catalogue row the matcher
    resolves. An unresolved/abstained mention is parked as unmatched, never fabricated.
  * jsonb params are passed as Python dicts (the connection carries asyncpg's jsonb codec — see
    spine.py / db._init_conn); scope params cast ::ltree. Never json.dumps()+"::jsonb".
  * Fail-soft: no organ raises into a turn. On any failure draft returns an empty sheet with an
    error note; place degrades to parking. If the Medusa client isn't importable/enabled we STILL
    draft + park (documented degrade), we just can't write the order.
  * All employee-runtime DB work rides db.scoped_tx(scope) (RLS-enforced isolation).
"""
from __future__ import annotations

import logging
import re
import time
from typing import Any, Optional

import config
import db
import spine
import tenancy

log = logging.getLogger("rocoto.orders_tool")


def _lineage_of(scope: str) -> str:
    """Mirrors runtime.run_turn's own `is_test = scope.startswith("test.")` check (SPEC §13 / WP-E):
    every event this module appends on a test-pinned scope (the persona console, the public try-chat
    widget) must carry lineage=test too — appending with the append_event default ('live') tagged a
    scope's own order.drafted/order.parked/order.placed events 'live' even though scope_node.lineage
    was correctly 'test', an inconsistency found 2026-07-28 verifying WP-E against a real DB.

    DELEGATES to `spine.lineage_of` since 2026-08-09 (BUG 2): `spine.append_event` now derives the
    same answer itself, so this call is belt-and-braces for the `action` INSERT below — which writes
    the `lineage` column directly and is therefore NOT covered by the spine's derivation. Two copies
    of one derivation is how the class came back the first time; there is now exactly one."""
    return spine.lineage_of(scope)


# ── scope → tenant slug (t.<slug>.c.<id> | t.<slug> → <slug>; else the default tenant) ───────────
def _tenant_of(scope: str) -> str:
    """Derive the catalogue tenant id from a party scope. The runtime scope for a customer is
    `t.<slug>.c.<id>` (spine.scope_customer); catalogue_skus is keyed by tenant_id. Fall back to the
    configured BRAIN_TENANT for prospect/creator scopes that have no tenant segment."""
    import tenancy
    return tenancy.tenant_of(scope)


async def _scope_phone(con, scope: str) -> Optional[str]:
    """Best-effort E.164 for the party owning `scope` — used to bias alias matching + tag the order
    (the Medusa route resolves/creates the customer from metadata.phone). Fail-soft None."""
    try:
        addr = await con.fetchval(
            "select e.addr from endpoint e join contact c on c.id=e.contact_id "
            "where c.scope=$1::ltree and e.kind='wa' order by e.id desc limit 1", scope)
        if not addr:
            addr = tenancy.phone_of_scope(scope)   # both scope shapes (WP-A1)
        return addr
    except Exception:
        return None


async def _scope_name(con, scope: str) -> str:
    try:
        return (await con.fetchval(
            "select display_name from contact where scope=$1::ltree order by id limit 1", scope)) or ""
    except Exception:
        return ""


# ── mention extraction: LLM (structured) with a deterministic regex fallback ─────────────────────
_LINE_RE = re.compile(
    r"(?P<qty>\d+(?:[.,]\d+)?)\s*"
    r"(?P<unit>kg|kilos?|kgs|g|gr|gramos?|uds?|unidades?|u|cajas?|packs?|bandejas?|piezas?)?\s+"
    r"(?:de\s+)?(?P<item>[a-zA-ZáéíóúñÁÉÍÓÚÑ][\wáéíóúñÁÉÍÓÚÑ\s]{1,60}?)"
    r"(?=(?:\s*[,;\n]|\s+y\s+\d|\s+\d+(?:[.,]\d+)?\s*(?:kg|kilos?|uds?|u|cajas?|packs?)|$))",
    re.IGNORECASE)


def _fallback_mentions(text: str) -> list[dict[str, Any]]:
    """Deterministic last-resort parse: "<qty> <unit> <item>" fragments. Conservative — it under-reads
    rather than mis-reads (a missed line surfaces as a smaller sheet, never a fabricated one)."""
    out: list[dict[str, Any]] = []
    for m in _LINE_RE.finditer(text or ""):
        item = (m.group("item") or "").strip(" .,-")
        if not item:
            continue
        try:
            qty = float((m.group("qty") or "0").replace(",", "."))
        except ValueError:
            qty = 0.0
        out.append({"mention": item, "qty": qty, "unit": (m.group("unit") or "").strip()})
    return out


def mentions_products(text: str) -> bool:
    """Is this text ORDER-SHAPED — does it name quantities of things? The SAME conservative
    `<qty> <unit> <item>` reader the fallback parse uses, exposed rather than copied, so
    `review.claims_filing_without_one` and this module can never disagree about what an order line
    looks like. It reads SHAPE, not meaning — «te llamo en 5 minutos» is order-shaped to it — which
    is why the contradiction check it feeds never fires on this signal alone."""
    return bool(_fallback_mentions(text or ""))


_EXTRACT_TOOL = {
    "name": "order_lines",
    "description": "The order lines the customer is asking for, one per distinct product mention.",
    "input_schema": {
        "type": "object",
        "properties": {
            "lines": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "mention": {"type": "string", "description": "the product as the customer named it, no quantity"},
                        "qty": {"type": "number", "description": "quantity requested (0 if unstated)"},
                        "unit": {"type": "string", "description": "unit as stated (kg, ud, caja...) or empty"},
                    },
                    "required": ["mention", "qty"],
                },
            }
        },
        "required": ["lines"],
    },
}


async def _extract_mentions(text: str) -> list[dict[str, Any]]:
    """Pull candidate order lines from free text. LLM structured-output (brain.llm.call_tool) with the
    regex fallback on any failure. This step is UNGROUNDED on purpose — grounding is the matcher's job;
    here we only segment the message into (mention, qty, unit) triples."""
    text = (text or "").strip()
    if not text:
        return []
    try:
        from brain import llm
        out = await llm.call_tool(
            model=config.ORDER_EXTRACT_MODEL,
            system=(
                "Extraes las líneas de un pedido de un mensaje de WhatsApp de un cliente a su "
                "distribuidor de alimentación. Una línea por producto distinto. NO inventes productos "
                "que no menciona. Devuelve la cantidad tal cual (0 si no la dice) y la unidad si la da."
            ),
            user=text,
            tool=_EXTRACT_TOOL,
            tool_name="order_lines",
            max_tokens=1024,
            fallback=config.ORDER_EXTRACT_FALLBACK_MODEL,
        )
        lines = (out or {}).get("lines") or []
        cleaned = []
        for ln in lines:
            mention = (ln.get("mention") or "").strip()
            if not mention:
                continue
            try:
                qty = float(ln.get("qty") or 0)
            except (TypeError, ValueError):
                qty = 0.0
            cleaned.append({"mention": mention, "qty": qty, "unit": (ln.get("unit") or "").strip()})
        if cleaned:
            return cleaned
    except Exception:
        log.exception("order line extraction via LLM failed — using regex fallback (fail-soft)")
    return _fallback_mentions(text)


# ── draft_order ──────────────────────────────────────────────────────────────────────────────────
async def draft_order(scope: str, text: str) -> dict[str, Any]:
    """Turn a free-text order into a GROUNDED order sheet (SPEC §5/§7 FIRST ORDER).

    Returns {lines:[{sku,name,qty,unit,price,line_total,variable_weight,medusa_variant_id}],
             total, unmatched:[{mention,qty,unit,reason}], currency}. Every priced/SKU'd line is
    grounded through brain/matcher against catalogue_skus; a mention that abstains or has no price
    lands in `unmatched` — this organ NEVER fabricates a SKU or a price (SPEC §4.3). No Medusa write.
    Fail-soft: on error returns an empty sheet with an `error` note."""
    sheet: dict[str, Any] = {
        "lines": [], "unmatched": [], "total": 0.0,
        "currency": (config.MEDUSA_CURRENCY_CODE or "eur"),
    }
    try:
        mentions = await _extract_mentions(text)
    except Exception:
        log.exception("draft_order: extraction failed (fail-soft empty)")
        sheet["error"] = "extraction_failed"
        return sheet
    if not mentions:
        return sheet

    tenant = _tenant_of(scope)
    async with db.scoped_tx(scope) as con:
        phone = await _scope_phone(con, scope)

        # Ground each mention. matcher.match uses its OWN shared pool (db.get_pool) — it is a
        # read-only catalogue lookup, independent of this scoped txn, which is fine: catalogue_skus
        # is tenant-scoped, not party-scoped.
        try:
            from brain import matcher
        except Exception:
            log.exception("draft_order: matcher unimportable — cannot ground, parking all mentions")
            matcher = None

        total = 0.0
        for m in mentions:
            mention, qty, unit = m["mention"], m.get("qty") or 0, m.get("unit") or ""
            if matcher is None:
                sheet["unmatched"].append(
                    {"mention": mention, "qty": qty, "unit": unit, "reason": "matcher_unavailable"})
                continue
            try:
                res = await matcher.match(
                    mention, phone=phone, unit_hint=unit or None,
                    qty=(qty or None), tenant=tenant)
            except Exception:
                log.exception("draft_order: match failed for %r (parked unmatched)", mention)
                sheet["unmatched"].append(
                    {"mention": mention, "qty": qty, "unit": unit, "reason": "match_error"})
                continue

            pick = res.pick if res else None
            # Abstain / no pick → unmatched (never guess). SPEC §4.3 grounding.
            if res is None or res.abstain or not pick:
                sheet["unmatched"].append(
                    {"mention": mention, "qty": qty, "unit": unit, "reason": "no_confident_match"})
                continue

            price = pick.get("price")
            variable = bool(pick.get("variable_weight"))
            # No standing price and NOT a variable-weight line → we can't ground a total. Park it
            # rather than invent a number (variable-weight lines legitimately carry no price yet —
            # exact kg is confirmed at dispatch, so they stay on the sheet with price=None).
            if price is None and not variable:
                sheet["unmatched"].append(
                    {"mention": mention, "qty": qty, "unit": unit,
                     "reason": "no_standing_price", "sku": pick.get("sku_id")})
                continue

            line_total = round(float(price) * float(qty), 2) if (price is not None and qty) else None
            if line_total:
                total += line_total
            line: dict[str, Any] = {
                # THE CUSTOMER'S OWN WORD, kept on the line (2026-08-10). The grounded line used to
                # carry only OUR catalogue name, so a later correction had nothing to learn FROM: an
                # alias is «what they said» → «what it is», and «what they said» was thrown away the
                # instant the matcher picked. `brain/learn.learn_from_edit` reads exactly this field
                # first, so a corrected line now writes the alias the matcher will hit next time.
                # Additive to an append-only payload; every reader tolerates its absence.
                "mention": mention,
                "sku": pick.get("sku_id") or pick.get("id"),
                # the supplier's OWN article code (WP-3) — a SEPARATE field; `sku` above stays the
                # internal id chain (aliases/accept-rules key on it, eng F6) and is never overwritten.
                "code": pick.get("code"),
                "name": pick.get("name", ""),
                "qty": qty,
                "unit": unit or (pick.get("base_unit") or ""),
                "price": (float(price) if price is not None else None),
                "line_total": line_total,
                "variable_weight": variable,
                "medusa_variant_id": pick.get("medusa_variant_id"),
                "band": getattr(res, "band", ""),
                "note": getattr(res, "unit_note", "") or "",
            }
            sheet["lines"].append(line)

        sheet["total"] = round(total, 2)
        # Evented, but no world-mutation: drafting is sensing, not agency.
        try:
            await spine.append_event(
                con, scope, "order.drafted", "runtime",
                {"lines": sheet["lines"], "unmatched": sheet["unmatched"],
                 "total": sheet["total"], "currency": sheet["currency"]},
                lane="world", lineage=_lineage_of(scope))
        except Exception:
            log.exception("draft_order: order.drafted append failed (fail-soft)")

    return sheet


# ── §17.56 Q3 · the nearest REAL rows for an off-list mention ─────────────────────────────────────
async def suggest_alternatives(scope: str, unmatched: list[dict[str, Any]],
                               k: int = 2, cap: int = 3) -> list[dict[str, Any]]:
    """For each unmatched mention, up to `k` nearest CATALOGUE rows — the matcher's own candidates,
    read the way `doubt`/`pipeline.build_options` read them, never a second ranking. This is the
    grounding for `behaviour.offsku='open'` («ofrece la alternativa») and for the /demo board's
    review pane: the alternative OFFERED is always a row that exists, with its real name (and its
    real price when the row has one) — this module's §4.3 law (never fabricate a SKU or a price)
    applies to suggestions exactly as it does to lines.

    `cap` bounds how many mentions get the (embedding + rerank) spend — an off-list flood should
    not turn one reply into a dozen matcher runs. Fail-soft to [] per mention and overall: a
    suggestion is an extra, and an extra must never cost the turn."""
    out: list[dict[str, Any]] = []
    if not unmatched:
        return out
    tenant = _tenant_of(scope)
    try:
        from brain import matcher
    except Exception:
        log.debug("suggest_alternatives: matcher unimportable (fail-soft empty)", exc_info=True)
        return out
    try:
        async with db.scoped_tx(scope) as con:
            phone = await _scope_phone(con, scope)
    except Exception:
        phone = None
    for u in unmatched[:max(0, int(cap))]:
        mention = str((u or {}).get("mention") or "").strip()
        if not mention:
            continue
        cands: list[dict[str, Any]] = []
        try:
            res = await matcher.match(mention, phone=phone, tenant=tenant)
            for c in (res.candidates or [])[:max(1, int(k))]:
                name = str(c.get("name") or "").strip()
                if not name:
                    continue
                cands.append({"sku_id": c.get("sku_id") or c.get("id") or "",
                              "name": name,
                              "price": (float(c["price"]) if c.get("price") is not None else None)})
        except Exception:
            log.debug("suggest_alternatives: match failed for %r (fail-soft)", mention,
                      exc_info=True)
        out.append({"mention": mention, "candidates": cands})
    return out


# ── place_order (GATED — never autonomous; SPEC §0 / §5.0.1) ──────────────────────────────────────
def _confirmation_sentence(sheet: dict[str, Any], order_id: str) -> str:
    """A GROUNDED confirmation — every number comes from the sheet, nothing invented. Spanish, plain."""
    n = len(sheet.get("lines") or [])
    total = sheet.get("total") or 0
    cur = (sheet.get("currency") or "eur").upper()
    unit_word = "línea" if n == 1 else "líneas"
    base = f"Pedido confirmado ({n} {unit_word}"
    if total:
        base += f", total {total:.2f} {cur}"
    base += f"). Referencia {order_id}."
    if sheet.get("unmatched"):
        base += f" Quedan {len(sheet['unmatched'])} sin identificar para revisar."
    return base


async def _park_place(con, scope: str, draft: dict[str, Any], reason: str,
                      event_id: Optional[int] = None) -> int:
    """Park a place_order action on the review sheet — needs_human=true, money=true, state=pending.
    NEVER writes to Medusa. Returns the action id. This is the ONLY path when approved is False or
    Medusa is unavailable (SPEC §5.0.1 T0: a dangerous grant parks; it never fires on its own)."""
    payload = {"draft": draft, "reason": reason, "kind": "place_order"}
    aid = await con.fetchval(
        "insert into action(scope,kind,payload,state,reason,needs_human,money,opened_by_event,lineage) "
        "values($1::ltree,'place_order',$2,'pending',$3,true,true,$4,$5) returning id",
        scope, payload, reason, event_id, _lineage_of(scope))
    await spine.append_event(
        con, scope, "order.parked", "runtime",
        {"action_id": int(aid), "reason": reason,
         "total": draft.get("total"), "lines": len(draft.get("lines") or [])},
        lane="world", caused_by=event_id, lineage=_lineage_of(scope))
    return int(aid)


async def place_order(scope: str, draft: dict[str, Any], approved: bool) -> dict[str, Any]:
    """Place the drafted order in Medusa — GATED agency (SPEC §0 / §5.0.1: placing is a dangerous
    grant, NEVER autonomous).

    approved=False → park an action(needs_human) on the review sheet, append `order.parked`, and
      return {placed:False, parked:True, action_id, sentence}. Nothing is written to Medusa.
    approved=True  → build the frozen create-order payload (medusa_map.build_create_order_payload),
      create the order via the existing MedusaClient (idempotent on metadata.sancho_order_id), bind
      the provider id in entity_map, append `order.placed`, and return {placed:True, order_id,
      sentence}.

    Degrade path (documented): if the Medusa client isn't importable OR sync is disabled, we CANNOT
    write the order — so even an approved order PARKS (with reason 'medusa_unavailable') rather than
    silently dropping. Fail-soft throughout: never raises into a turn."""
    result: dict[str, Any] = {"placed": False, "parked": False}
    draft = draft or {}
    lines = draft.get("lines") or []

    async with db.scoped_tx(scope) as con:
        if not lines:
            # Nothing grounded to place — park for a human to look at the unmatched items.
            aid = await _park_place(con, scope, draft, "empty_or_ungrounded_draft")
            result.update(parked=True, action_id=aid, sentence="No hay líneas confirmadas que cursar; lo dejo para revisión.")
            return result

        if not approved:
            aid = await _park_place(con, scope, draft, "not_approved")
            result.update(
                parked=True, action_id=aid,
                sentence="Pedido preparado y en espera de tu visto bueno antes de cursarlo.")
            return result

        # approved == True → attempt the real Medusa write. Guard the client.
        try:
            from brain import medusa_client, medusa_map
        except Exception:
            log.exception("place_order: Medusa modules unimportable — parking (degrade)")
            aid = await _park_place(con, scope, draft, "medusa_unavailable")
            result.update(
                parked=True, action_id=aid,
                sentence="No puedo cursarlo automáticamente ahora mismo; lo dejo listo para cursar a mano.")
            return result

        if not medusa_client.enabled():
            aid = await _park_place(con, scope, draft, "medusa_sync_disabled")
            result.update(
                parked=True, action_id=aid,
                sentence="No puedo cursarlo automáticamente ahora mismo; lo dejo listo para cursar a mano.")
            return result

        # Build the Rocoto order shape medusa_map expects, then freeze the payload.
        sancho_order_id = draft.get("id") or f"ord_{scope.replace('.', '_')}_{int(time.time())}"
        phone = await _scope_phone(con, scope)
        customer_name = draft.get("customer_name") or await _scope_name(con, scope)
        order_shape = {
            "id": sancho_order_id,
            "phone_number": phone or "",
            "customer_name": customer_name,
            "email": draft.get("email"),
            "delivery_date": draft.get("delivery_date"),
            "from_storefront": bool(draft.get("from_storefront", False)),
            "seeded": bool(draft.get("seeded", False)),
            "recurring": bool(draft.get("recurring", False)),
            "lines": [
                {
                    "sku_id": ln.get("sku"),
                    "medusa_variant_id": ln.get("medusa_variant_id"),
                    "item": ln.get("name"),
                    "name": ln.get("name"),
                    "qty": ln.get("qty"),
                    "unit": ln.get("unit", ""),
                    "price": ln.get("price"),
                    "variable_weight": bool(ln.get("variable_weight")),
                    "note": ln.get("note", ""),
                    "confidence": ln.get("band", ""),
                }
                for ln in lines
            ],
        }
        payload = medusa_map.build_create_order_payload(order_shape)

        try:
            created = await medusa_client.get_client().create_order(payload)
        except Exception as e:
            # Transient or permanent — either way we do NOT drop the order. Park it with the error so
            # a human (or the drainer) can finish it. Placing is gated; a failed place is a parked place.
            log.exception("place_order: Medusa create_order failed — parking (fail-soft)")
            aid = await _park_place(
                con, scope, {**draft, "id": sancho_order_id}, f"medusa_error:{type(e).__name__}")
            result.update(
                parked=True, action_id=aid,
                sentence="Tuve un problema al cursarlo; lo dejo en revisión para no perderlo.")
            return result

        order_id = (created or {}).get("id") or sancho_order_id
        # Bind the provider id → this scope so future Medusa webhooks resolve deterministically
        # (spine.resolve_webhook_scope reads entity_map). Fail-soft: the order is already placed.
        try:
            if created and created.get("id"):
                await spine.record_entity_mapping(
                    con, "medusa", str(created["id"]), scope, sancho_order_id)
        except Exception:
            log.exception("place_order: entity_map bind failed (order still placed)")

        sentence = _confirmation_sentence({**draft, "currency": draft.get("currency") or config.MEDUSA_CURRENCY_CODE or "eur"}, order_id)
        try:
            await spine.append_event(
                con, scope, "order.placed", "runtime",
                {"medusa_order_id": order_id, "sancho_order_id": sancho_order_id,
                 "total": draft.get("total"), "lines": len(lines),
                 "idempotent": not (created or {}).get("created", True)},
                lane="world", lineage=_lineage_of(scope))
        except Exception:
            log.exception("place_order: order.placed append failed (order still placed)")

        result.update(placed=True, order_id=order_id, sancho_order_id=sancho_order_id, sentence=sentence)
        return result
