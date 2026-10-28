"""Event-sourced, bi-temporal orders (Register #12, #19, #21).

The `orders` table is a DETERMINISTIC PROJECTION of the append-only `order_events` log
(invalidate-not-overwrite). Every edit appends an event, drives learn.py (write aliases/habits),
and re-projects so `orders` + Excel stay correct, fully auditable, and rebuildable from the log.

Backward compatible: a legacy Phase-A order (rows created via db.order_insert with no events) is
"adopted" — a synthetic `created` event is derived from its current state on first edit.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

import config
import db
from brain import learn, medusa_map

log = logging.getLogger("rocoto.brain.events")

# Events folded into the projection. 'undone' is audit-only (never folded).
_FOLDED = {
    "created", "line_set", "line_edited", "qty_changed", "sku_changed",
    "note_set", "delivery_set", "customer_set", "status_changed", "submitted", "dispatched",
    "amended",
}

# Statuses an order can still be CHANGED in by a customer follow-up (before it's shipped).
AMENDABLE = {"needs_review", "approved"}


# ── Medusa transactional outbox (medusa-integration.md §1) ──────────────────────────────────
# Enqueue rides INSIDE the existing con.transaction() + pg_advisory_xact_lock, so the order event
# and the intent-to-project commit atomically. The DRAINER (brain/medusa_drain.py) does the
# unreliable network part. We never enqueue a CREATE before approve/auto-accept.

async def _resolve_variant_ids(con, lines: List[Dict[str, Any]], tenant: Optional[str] = None) -> None:
    """Attach catalogue_skus.medusa_variant_id to each grounded line (keyed by sku_id), in place.
    Reads the ORDER's tenant catalogue — resolving a variant against BRAIN_TENANT's SKUs would push
    another distributor's product id into this distributor's Medusa order."""
    sku_ids = [ln.get("sku_id") for ln in (lines or []) if ln.get("sku_id")]
    if not sku_ids:
        return
    try:
        rows = await con.fetch(
            "select id, medusa_variant_id from catalogue_skus where tenant_id=$1 and id = any($2::text[])",
            tenant or config.BRAIN_TENANT, sku_ids)
    except Exception:
        return  # catalogue_skus may lack the column on a half-migrated box → custom-line fallback
    m = {r["id"]: r["medusa_variant_id"] for r in rows}
    for ln in lines:
        vid = m.get(ln.get("sku_id"))
        if vid:
            ln["medusa_variant_id"] = vid


async def _latest_create(con, order_id: str):
    return await con.fetchrow(
        "select id, status, medusa_order_id from medusa_sync "
        "where sancho_order_id=$1 and op='create_order' order by id desc limit 1", order_id)


async def _outbox_insert(con, order_id: str, seq: int, op: str, payload: dict, seeded: bool,
                         tenant: Optional[str] = None) -> None:
    await con.execute(
        """insert into medusa_sync (tenant_id, sancho_order_id, sancho_seq, op, idem_key, payload, seeded)
           values ($1,$2,$3,$4,$5,$6,$7) on conflict (idem_key) do nothing""",
        await tenant_of_order(con, order_id, tenant), order_id, seq, op,
        f"{order_id}:{seq}:{op}", payload, seeded)


async def _enqueue_create(con, order_id: str, seq: int, o: Dict[str, Any]) -> None:
    """Called at approve/auto-accept ONLY. The single path that may CREATE in Medusa.
    - already done in Medusa  → enqueue an edit_order (a re-approval is an edit)
    - a create still pending  → re-freeze that pending payload (fold the latest state in)
    - otherwise               → enqueue the create_order
    """
    await _resolve_variant_ids(con, o.get("lines") or [], await tenant_of_order(con, order_id))
    seeded = bool(o.get("seeded", False))
    payload = medusa_map.build_create_order_payload(o)
    prior = await _latest_create(con, order_id)
    if prior and prior["status"] == "done" and prior["medusa_order_id"]:
        payload["medusa_order_id"] = prior["medusa_order_id"]
        await _outbox_insert(con, order_id, seq, "edit_order", payload, seeded)
    elif prior and prior["status"] in ("pending", "in_flight"):
        await con.execute("update medusa_sync set payload=$2, updated_at=now() where id=$1",
                          prior["id"], payload)
    else:
        await _outbox_insert(con, order_id, seq, "create_order", payload, seeded)


async def _enqueue_edit_if_live(con, order_id: str, seq: int, o: Dict[str, Any]) -> None:
    """Called from operator edit. Pushes an edit ONLY if the order already exists in Medusa;
    a pre-approve edit never touches Medusa (the eventual submit enqueues the create)."""
    prior = await _latest_create(con, order_id)
    if not (prior and prior["status"] == "done" and prior["medusa_order_id"]):
        return
    await _resolve_variant_ids(con, o.get("lines") or [], await tenant_of_order(con, order_id))
    payload = medusa_map.build_create_order_payload(o)
    payload["medusa_order_id"] = prior["medusa_order_id"]
    await _outbox_insert(con, order_id, seq, "edit_order", payload, bool(o.get("seeded", False)))


async def _next_seq(con, order_id: str) -> int:
    n = await con.fetchval("select coalesce(max(seq),0) from order_events where order_id=$1", order_id)
    return int(n) + 1


async def tenant_of_order(con, order_id: str, tenant: Optional[str] = None) -> str:
    """Whose order is this? THE LOG IS THE TRUTH (2026-07-27, multi-tenancy pass).

    `order_events.tenant_id` was already written on every event and read by nothing; `append_event`
    hardcoded `config.BRAIN_TENANT`, so an order belonging to a second distributor was stamped with
    the first one's slug. Now the tenant is passed IN at creation and INHERITED afterwards: every
    later append/projection on an existing order reads the tenant off its own log rather than
    guessing. An order with no events yet (or an unattributed legacy row) falls back to
    BRAIN_TENANT — correct by definition, because only single-tenant code could have written it."""
    if tenant:
        return tenant
    t = await con.fetchval(
        "select tenant_id from order_events where order_id=$1 and tenant_id is not null "
        "order by seq limit 1", order_id)
    if not t:
        t = await con.fetchval("select tenant_id from orders where id=$1", order_id)
    return t or config.BRAIN_TENANT


async def append_event(con, order_id: str, event_type: str, payload: Dict[str, Any],
                       *, actor: str = "system", seeded: bool = False,
                       tenant: Optional[str] = None) -> int:
    seq = await _next_seq(con, order_id)
    await con.execute(
        """insert into order_events (tenant_id, order_id, seq, event_type, payload, actor, seeded)
           values ($1,$2,$3,$4,$5,$6,$7)""",
        await tenant_of_order(con, order_id, tenant), order_id, seq, event_type,
        payload or {}, actor, seeded,
    )
    return seq


async def _active_events(con, order_id: str) -> List[Dict[str, Any]]:
    rows = await con.fetch(
        """select seq, event_type, payload, actor, valid_from, recorded_at
             from order_events where order_id=$1 and not invalidated order by seq""",
        order_id,
    )
    return [dict(r) for r in rows]


def _fold(order_id: str, events: List[Dict[str, Any]]) -> Dict[str, Any]:
    o: Dict[str, Any] = {
        "id": order_id, "phone_number": "", "customer_name": "", "source_message_ids": [],
        "status": "needs_review", "lines": [], "note": "", "delivery_date": None,
        "seeded": False, "dispatched_at": None, "delivery_note": None, "from_storefront": False,
    }
    for e in events:
        t = e["event_type"]
        p = e.get("payload") or {}
        if t == "created":
            for k in ("phone_number", "customer_name", "source_message_ids", "lines",
                      "note", "delivery_date", "seeded", "from_storefront"):
                if p.get(k) is not None:
                    o[k] = p[k]
            if p.get("status"):
                o["status"] = p["status"]
        elif t == "line_set":
            o["lines"] = p.get("lines", o["lines"])
        elif t == "line_edited":
            i = p.get("index")
            if i is not None and 0 <= i < len(o["lines"]):
                o["lines"][i] = {**o["lines"][i], **(p.get("after") or {})}
        elif t == "qty_changed":
            i = p.get("index")
            if i is not None and 0 <= i < len(o["lines"]):
                o["lines"][i]["qty"] = p.get("qty")
        elif t == "sku_changed":
            i = p.get("index")
            if i is not None and 0 <= i < len(o["lines"]):
                o["lines"][i].update(p.get("sku") or {})
        elif t == "note_set":
            if p.get("index") is not None:
                i = p["index"]
                if 0 <= i < len(o["lines"]):
                    o["lines"][i]["note"] = p.get("note", "")
            else:
                o["note"] = p.get("note", "")
        elif t == "delivery_set":
            o["delivery_date"] = p.get("delivery_date")
        elif t == "customer_set":
            o["customer_name"] = p.get("customer_name", o["customer_name"])
        elif t == "status_changed":
            o["status"] = p.get("to", o["status"])
        elif t == "submitted":
            o["status"] = "approved"
        elif t == "dispatched":
            o["status"] = "sent"
            o["dispatched_at"] = p.get("dispatched_at")
            o["delivery_note"] = p.get("delivery_note")
        elif t == "amended":
            # A customer follow-up changed this order: the line/delivery/note edits are their own
            # folded events (above); this event just folds in the new source messages + the trail.
            if p.get("source_message_ids") is not None:
                o["source_message_ids"] = p["source_message_ids"]
    return o


def _as_ts(v):
    """jsonb event payloads carry timestamps as ISO strings — parse them back at the projection
    boundary (WP-2.5 rehearsal find: binding the string to the timestamptz column crashed every
    real dispatch inside mark_dispatched, leaving orders approved-unsent forever)."""
    if isinstance(v, str):
        try:
            return datetime.fromisoformat(v)
        except ValueError:
            return None
    return v


async def _project(con, order_id: str, tenant: Optional[str] = None) -> Dict[str, Any]:
    o = _fold(order_id, await _active_events(con, order_id))
    t = await tenant_of_order(con, order_id, tenant)
    await con.execute(
        """insert into orders (id, phone_number, customer_name, source_message_ids, status,
                               lines, note, delivery_date, seeded, dispatched_at, delivery_note,
                               from_storefront, tenant_id, updated_at)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13, now())
           on conflict (id) do update set
             phone_number=excluded.phone_number, customer_name=excluded.customer_name,
             source_message_ids=excluded.source_message_ids, status=excluded.status,
             lines=excluded.lines, note=excluded.note, delivery_date=excluded.delivery_date,
             seeded=excluded.seeded, dispatched_at=excluded.dispatched_at,
             delivery_note=excluded.delivery_note, from_storefront=excluded.from_storefront,
             tenant_id=coalesce(orders.tenant_id, excluded.tenant_id),
             updated_at=now()""",
        o["id"], o["phone_number"], o["customer_name"], o["source_message_ids"], o["status"],
        o["lines"], o["note"], o["delivery_date"], o["seeded"], _as_ts(o["dispatched_at"]),
        o["delivery_note"], bool(o.get("from_storefront", False)), t,
    )
    o["tenant_id"] = t
    return o


async def _ensure_created(con, order_id: str) -> None:
    """Adopt a legacy Phase-A order (no events) by synthesising a `created` event from its row."""
    has = await con.fetchval("select 1 from order_events where order_id=$1 limit 1", order_id)
    if has:
        return
    row = await con.fetchrow("select * from orders where id=$1", order_id)
    if not row:
        raise KeyError(order_id)
    r = dict(row)
    await append_event(con, order_id, "created", {
        "phone_number": r.get("phone_number", ""), "customer_name": r.get("customer_name", ""),
        "source_message_ids": r.get("source_message_ids") or [], "lines": r.get("lines") or [],
        "note": r.get("note", ""), "delivery_date": r.get("delivery_date"),
        "status": r.get("status", "needs_review"), "seeded": bool(r.get("seeded", False)),
    }, actor="system", seeded=bool(r.get("seeded", False)))


async def create_order(order: Dict[str, Any], *, actor: str = "system", seeded: bool = False,
                       tenant: Optional[str] = None) -> Dict[str, Any]:
    """Brain entry point (Stage 4). Create an order from a `created` event and project it.

    `tenant` is the ONE place an order's owner is decided; every later event inherits it from the
    log (see `tenant_of_order`). Omitted → BRAIN_TENANT, so a single-tenant box is unchanged."""
    oid = order.get("id") or uuid.uuid4().hex
    tenant = tenant or order.get("tenant_id") or config.BRAIN_TENANT
    pool = db.get_pool()
    async with pool.acquire() as con, con.transaction():
        await con.execute("select pg_advisory_xact_lock(hashtext($1)::bigint)", oid)
        await append_event(con, oid, "created", tenant=tenant, payload={
            "phone_number": order.get("phone_number", ""),
            "customer_name": order.get("customer_name", ""),
            "source_message_ids": order.get("source_message_ids") or [],
            "lines": order.get("lines") or [],
            "note": order.get("note", ""),
            "delivery_date": order.get("delivery_date"),
            "status": order.get("status", "needs_review"),
            "seeded": seeded,
            "from_storefront": order.get("from_storefront", False),
        }, actor=actor, seeded=seeded)
        return await _project(con, oid, tenant)


def _merge_line_identities(before: List[dict], edited: List[dict]) -> List[dict]:
    """Carry each line's IDENTITY through a desk edit (2026-08-19).

    The desk's save sends four fields per line — {item, qty, unit, price} (webapp api/client.ts) —
    and `line_set` stored that verbatim. So an operator correcting a QUANTITY silently destroyed
    everything else the line knew about itself: `sku` (the catalogue match), `code`, `band`,
    `mention` (the customer's own words), and `variable_weight` — the flag that says «this line is
    billed by the kilo after weighing». One touched line, and the order forgot it needed weighing.

    Matching: a before-line is findable under EVERY name it has — sku, code, and normalised
    item/name — because the edit arrives carrying only the name half. (The first cut indexed each
    line under its first key only, and a name-only edit missed a sku-keyed line: the exact
    field-asymmetry this function exists to survive.) The edit wins on every key it carries;
    `line_total` is recomputed rather than inherited, since a stale total from the pre-edit
    quantity is worse than none."""
    def _keys(ln: dict) -> list[str]:
        out = []
        for k in ("sku", "code"):
            v = str(ln.get(k) or "").strip()
            if v:
                out.append(f"{k}:{v}")
        name = " ".join(str(ln.get("item") or ln.get("name") or "").lower().split())
        if name:
            out.append(f"name:{name}")
        return out

    by_key: dict[str, list[int]] = {}
    for i, ln in enumerate(before):
        if isinstance(ln, dict):
            for k in _keys(ln):
                by_key.setdefault(k, []).append(i)
    claimed: set[int] = set()

    def _claim(idx: int) -> Optional[dict]:
        if idx in claimed:
            return None
        claimed.add(idx)
        return before[idx]

    out: List[dict] = []
    for i, new_ln in enumerate(edited):
        if not isinstance(new_ln, dict):
            out.append(new_ln)
            continue
        old_ln = None
        for k in _keys(new_ln):
            for idx in by_key.get(k, []):
                old_ln = _claim(idx)
                if old_ln is not None:
                    break
            if old_ln is not None:
                break
        if old_ln is None and i < len(before) and i not in claimed and isinstance(before[i], dict):
            old_ln = _claim(i)
        merged = {**(old_ln or {}), **new_ln}
        merged.pop("line_total", None)
        try:
            q, pr = float(merged.get("qty") or 0), float(merged.get("price") or 0)
            if q and pr:
                merged["line_total"] = round(q * pr, 2)
        except (TypeError, ValueError):
            pass
        out.append(merged)
    return out


async def edit_order(order_id: str, *, lines: Optional[List[dict]] = None, note: Optional[str] = None,
                     delivery_date: Optional[str] = None, customer_name: Optional[str] = None,
                     actor: str = "operator") -> Optional[Dict[str, Any]]:
    pool = db.get_pool()
    async with pool.acquire() as con, con.transaction():
        await con.execute("select pg_advisory_xact_lock(hashtext($1)::bigint)", order_id)
        try:
            await _ensure_created(con, order_id)
        except KeyError:
            return None
        before = _fold(order_id, await _active_events(con, order_id))
        if lines is not None:
            lines = _merge_line_identities(before.get("lines") or [], lines)
            await append_event(con, order_id, "line_set", {"lines": lines}, actor=actor)
            # LEARN FROM THE EDIT TRAIL — UNDER THIS ORDER'S OWN TENANT (2026-08-19).
            # This omitted the tenant, so `learn_from_edit` defaulted to BRAIN_TENANT: every
            # alias Raquel's corrections minted was written into 'rocoto'\'s book while her
            # matcher reads under hers. The corrections looked like they worked — the order
            # was right on screen — and taught her Rocoto nothing, forever. This is the DESK
            # path, the one an operator actually uses, which makes it the one that mattered.
            try:
                _t = ""
                try:
                    r = await con.fetchrow("select tenant_id from orders where id=$1", order_id)
                    _t = str((r and r["tenant_id"]) or "")
                except Exception:
                    log.debug("learn: tenant read fail-soft for %s", order_id, exc_info=True)
                await learn.learn_from_edit(con, before.get("phone_number", ""),
                                            before.get("lines") or [], lines,
                                            tenant=_t or None)
            except Exception:
                pass
        if customer_name is not None:
            await append_event(con, order_id, "customer_set", {"customer_name": customer_name}, actor=actor)
        if delivery_date is not None:
            await append_event(con, order_id, "delivery_set", {"delivery_date": delivery_date}, actor=actor)
        if note is not None:
            await append_event(con, order_id, "note_set", {"note": note}, actor=actor)
        o = await _project(con, order_id)
        seq = await con.fetchval("select max(seq) from order_events where order_id=$1", order_id)
        await _enqueue_edit_if_live(con, order_id, int(seq or 0), o)
        return o


async def submit_order(order_id: str, *, actor: str = "operator") -> Optional[Dict[str, Any]]:
    pool = db.get_pool()
    async with pool.acquire() as con, con.transaction():
        await con.execute("select pg_advisory_xact_lock(hashtext($1)::bigint)", order_id)
        try:
            await _ensure_created(con, order_id)
        except KeyError:
            return None
        seq = await append_event(con, order_id, "submitted", {"by": actor}, actor=actor)
        o = _fold(order_id, await _active_events(con, order_id))
        await _enqueue_create(con, order_id, seq, o)
        return await _project(con, order_id)


async def set_status(order_id: str, status: str, *, actor: str = "operator") -> Optional[Dict[str, Any]]:
    pool = db.get_pool()
    async with pool.acquire() as con, con.transaction():
        await con.execute("select pg_advisory_xact_lock(hashtext($1)::bigint)", order_id)
        try:
            await _ensure_created(con, order_id)
        except KeyError:
            return None
        cur = _fold(order_id, await _active_events(con, order_id))
        await append_event(con, order_id, "status_changed",
                           {"from": cur.get("status"), "to": status}, actor=actor)
        return await _project(con, order_id)


async def mark_dispatched(order_ids: List[str], delivery_note: Optional[str] = None) -> None:
    pool = db.get_pool()
    async with pool.acquire() as con:
        for oid in order_ids:
            async with con.transaction():
                await con.execute("select pg_advisory_xact_lock(hashtext($1)::bigint)", oid)
                try:
                    await _ensure_created(con, oid)
                except KeyError:
                    continue
                await append_event(con, oid, "dispatched",
                                   {"dispatched_at": str(db.now_iso()), "delivery_note": delivery_note},
                                   actor="system")
                await _project(con, oid)


async def finalize_order(order_id: str, order: Dict[str, Any], *,
                         status: str = "needs_review", actor: str = "system") -> Optional[Dict[str, Any]]:
    """Fill a 'preparing' placeholder with the computed order and flip it live (Stage demo: the card
    appears as 'preparing' the moment a message lands, then fills in)."""
    pool = db.get_pool()
    async with pool.acquire() as con:
        async with con.transaction():
            await con.execute("select pg_advisory_xact_lock(hashtext($1)::bigint)", order_id)
            try:
                await _ensure_created(con, order_id)
            except KeyError:
                return None
            await append_event(con, order_id, "line_set", {"lines": order.get("lines") or []}, actor=actor)
            if order.get("customer_name"):
                await append_event(con, order_id, "customer_set", {"customer_name": order["customer_name"]}, actor=actor)
            if order.get("delivery_date"):
                await append_event(con, order_id, "delivery_set", {"delivery_date": order["delivery_date"]}, actor=actor)
            if order.get("note"):
                await append_event(con, order_id, "note_set", {"note": order["note"]}, actor=actor)
            cur = _fold(order_id, await _active_events(con, order_id))
            await append_event(con, order_id, "status_changed", {"from": cur.get("status"), "to": status}, actor=actor)
            proj = await _project(con, order_id)
    # ONE SPINE (SPEC §1.7 — the order-brain is a PROJECTION): mirror the finalized order onto the
    # universal event spine so the runtime KNOWS the customer ordered — it lands on their scope's event
    # log + folds a keyed order fact, and the mind sees it next turn. Best-effort, off the order tx.
    try:
        import runtime
        ph = (proj or {}).get("phone_number") or order.get("phone_number") or ""
        if ph:
            nlines = len((proj or order).get("lines") or [])
            await runtime.emit_sense(
                phone=str(ph), type="order.placed", source="medusa",
                payload={"text": f"Hizo un pedido ({nlines} línea(s)), estado: {status}.",
                         "order_id": order_id, "status": status, "lines": nlines},
                dedupe_key=f"order:{order_id}:{status}", entity_key=f"order:{order_id}")
    except Exception:
        pass
    return proj


async def amend_order(order_id: str, computed: Dict[str, Any], *, reason: str = "",
                      source_message_ids: Optional[List[str]] = None,
                      actor: str = "customer") -> Optional[Dict[str, Any]]:
    """A customer follow-up CHANGES an order they already placed (not a new order). Append the change
    to the SAME event-sourced order — the card keeps its identity, its state evolves, and the trail
    (what changed + why + which message) stays auditable. `computed` carries the FULL updated basket.

    Returns None if the order isn't AMENDABLE any more (already sent/rejected/gone) — the caller then
    files a fresh order instead. A change to an already-approved order re-opens it for review."""
    pool = db.get_pool()
    async with pool.acquire() as con, con.transaction():
        await con.execute("select pg_advisory_xact_lock(hashtext($1)::bigint)", order_id)
        try:
            await _ensure_created(con, order_id)
        except KeyError:
            return None
        cur = _fold(order_id, await _active_events(con, order_id))
        if cur.get("status") not in AMENDABLE:
            return None   # shipped/rejected — not amendable; caller files a new order
        new_lines = computed.get("lines") or []
        merged_ids = list(dict.fromkeys(
            list(cur.get("source_message_ids") or []) + list(source_message_ids or [])))
        await append_event(con, order_id, "line_set", {"lines": new_lines}, actor=actor)
        try:
            await learn.learn_from_edit(con, cur.get("phone_number", ""),
                                        cur.get("lines") or [], new_lines)
        except Exception:
            pass
        dd = computed.get("delivery_date")
        if dd and dd != cur.get("delivery_date"):
            await append_event(con, order_id, "delivery_set", {"delivery_date": dd}, actor=actor)
        if computed.get("note") and computed["note"] != cur.get("note"):
            await append_event(con, order_id, "note_set", {"note": computed["note"]}, actor=actor)
        if cur.get("status") == "approved":   # a customer change re-opens an approved order
            await append_event(con, order_id, "status_changed",
                               {"from": "approved", "to": "needs_review"}, actor=actor)
        await append_event(con, order_id, "amended",
                           {"reason": reason, "source_message_ids": merged_ids,
                            "added_ids": list(source_message_ids or [])}, actor=actor)
        return await _project(con, order_id)


async def cancel_order(order_id: str, *, reason: str = "",
                       source_message_ids: Optional[List[str]] = None,
                       actor: str = "customer") -> Optional[Dict[str, Any]]:
    """«Anúlame el pedido». The customer calls off an order they already placed.

    THIS DID NOT EXIST until 2026-08-19, and its absence was the worst hole in Ventas: the word
    `cancelled` was in the status vocabulary and read by `accept.py` and `habits.py`, but NOTHING
    EVER WROTE IT. A cancellation arrived as a message with no lines, the pipeline dropped it as
    «no order», and the goods went on the van. The customer had said the words and watched them do
    nothing — which is worse than an app that cannot take cancellations at all, because they think
    it worked.

    IT IS AN AMENDMENT, not a deletion. The order keeps its identity and its trail: the lines stay
    readable, the event says who called it off and why, and the desk can see a cancelled order
    rather than a hole where one used to be. She may have already printed it.

    Returns None when the order is past cancelling (already dispatched/rejected/gone) — the caller
    then tells the customer the truth instead of a confirmation it cannot honour."""
    pool = db.get_pool()
    async with pool.acquire() as con, con.transaction():
        await con.execute("select pg_advisory_xact_lock(hashtext($1)::bigint)", order_id)
        try:
            await _ensure_created(con, order_id)
        except KeyError:
            return None
        cur = _fold(order_id, await _active_events(con, order_id))
        if cur.get("status") not in AMENDABLE:
            return None   # on the van already — saying «hecho» here would be a lie
        merged_ids = list(dict.fromkeys(
            list(cur.get("source_message_ids") or []) + list(source_message_ids or [])))
        await append_event(con, order_id, "status_changed",
                           {"from": cur.get("status"), "to": "cancelled"}, actor=actor)
        await append_event(con, order_id, "amended",
                           {"reason": reason or "anulado por el cliente",
                            "cancelled": True,
                            "source_message_ids": merged_ids,
                            "added_ids": list(source_message_ids or [])}, actor=actor)
        return await _project(con, order_id)


async def latest_amendable(phone: str, tenant: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """The most recent still-changeable order for this phone (needs_review/approved), if any.

    TENANT-SCOPED (2026-07-27). Two distributors can legitimately serve the SAME restaurant on the
    SAME phone number. Without the predicate, «que sean 10 kilos» to distributor B would amend the
    order that restaurant placed with distributor A — cross-tenant corruption of a real order,
    silently, with no leak visible anywhere."""
    pool = db.get_pool()
    async with pool.acquire() as con:
        row = await con.fetchrow(
            "select id, status from orders where phone_number=$1 and status = any($2::text[]) "
            "and not seeded and tenant_id=$3 order by created_at desc limit 1",
            phone, list(AMENDABLE), tenant or config.BRAIN_TENANT)
    return dict(row) if row else None


async def delete_order(order_id: str) -> None:
    """Drop a placeholder that turned out not to be an order (junk slipped past the gate)."""
    pool = db.get_pool()
    async with pool.acquire() as con:
        await con.execute("delete from order_events where order_id=$1", order_id)
        await con.execute("delete from orders where id=$1", order_id)


async def find_preparing(phone: str, tenant: Optional[str] = None) -> Optional[str]:
    """The live (non-seeded) 'preparing' placeholder for this phone, if one is already open.

    TENANT-SCOPED for the same reason as `latest_amendable`: a shared customer phone would otherwise
    make tenant B's burst fill tenant A's open card."""
    pool = db.get_pool()
    async with pool.acquire() as con:
        row = await con.fetchrow(
            "select id from orders where phone_number=$1 and status='preparing' and not seeded "
            "and tenant_id=$2 order by created_at desc limit 1", phone, tenant or config.BRAIN_TENANT)
    return row["id"] if row else None


async def set_stage(order_id: str, stage: str) -> None:
    """Set the live intake stage shown on the loader (listening|reading|matching|deciding). Written
    directly on the orders row (transient UI state) — _project preserves it (not in its column set)."""
    pool = db.get_pool()
    async with pool.acquire() as con:
        await con.execute("update orders set stage=$2, updated_at=now() where id=$1", order_id, stage or "")


async def ensure_preparing(phone: str, customer_name: str = "", tenant: Optional[str] = None) -> str:
    """Drop a 'preparing' order card the MOMENT a likely-order message lands (filled by the drainer),
    so the operator immediately sees Rocoto taking the order. Idempotent per open burst. New messages
    arriving while one is open flip it back to 'listening' (intaking more)."""
    existing = await find_preparing(phone, tenant)
    if existing:
        await set_stage(existing, "listening")   # more coming in — keep listening
        return existing
    o = await create_order({"phone_number": phone, "customer_name": customer_name,
                            "lines": [], "status": "preparing"}, actor="system", tenant=tenant)
    await set_stage(o["id"], "listening")
    return o["id"]


async def undo_order(order_id: str, *, actor: str = "operator") -> Optional[Dict[str, Any]]:
    """Revert the last action: invalidate the highest active non-created event, log an `undone`."""
    pool = db.get_pool()
    async with pool.acquire() as con, con.transaction():
        await con.execute("select pg_advisory_xact_lock(hashtext($1)::bigint)", order_id)
        row = await con.fetchrow(
            """select seq, event_type from order_events
                     where order_id=$1 and not invalidated and event_type not in ('created','undone')
                     order by seq desc limit 1""",
            order_id,
        )
        if not row:
            return _fold(order_id, await _active_events(con, order_id))
        await con.execute("update order_events set invalidated=true where order_id=$1 and seq=$2",
                          order_id, row["seq"])
        await append_event(con, order_id, "undone",
                           {"target_seq": row["seq"], "target_type": row["event_type"]}, actor=actor)
        return await _project(con, order_id)


async def get_events(order_id: str) -> List[Dict[str, Any]]:
    pool = db.get_pool()
    async with pool.acquire() as con:
        rows = await con.fetch(
            """select seq, event_type, payload, actor, invalidated, valid_from, recorded_at
                 from order_events where order_id=$1 order by seq""",
            order_id,
        )
    return [dict(r) for r in rows]
