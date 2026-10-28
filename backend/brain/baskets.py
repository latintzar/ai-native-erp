"""Storefront custom-order baskets — the draft that lands in the supplier's WhatsApp thread.

A customer composes a non-standard custom on the Next.js storefront (composer + mic). Rocoto captures
it as a DRAFT basket (a person must decide it — the agent never auto-accepts a customization) and
surfaces it in the supplier's conversation as a `BasketRequestCard`. On accept it converts to a placed
order (the brain's submit path → outbox → Medusa) and the warm pay-link is sent back into the chat.

Stage 5 ships the read + accept surface against the `basket_sessions` table (seeded). The storefront
SUBMIT path (Medusa draft order) + the Twilio `bsk_` inbound binding land with the storefront (Stage 6);
the Stripe-Connect pay-link is finalized at deploy (Stage 11). Defensive: never raises on a read.
"""
from __future__ import annotations

import logging
import secrets
import uuid
from datetime import timedelta
from typing import Any, Dict, List, Optional

import config
import db

log = logging.getLogger("rocoto.baskets")

# Access-token TTL: a basket link is reachable for this long after mint (refreshed on no event). The
# token expires the moment the basket is accepted/paid, so a leaked wa.me link is dead after conversion.
ACCESS_TOKEN_TTL = timedelta(days=getattr(config, "BASKET_TOKEN_TTL_DAYS", 14) or 14)


def _mint_token() -> str:
    """An unguessable per-basket access token (URL-safe, ~256 bits). Public read/pay require it."""
    return secrets.token_urlsafe(32)


def _row_to_dict(r) -> Dict[str, Any]:
    d = dict(r)
    # numeric total → float for the JSON wire
    if d.get("total") is not None:
        try:
            d["total"] = float(d["total"])
        except Exception:
            d["total"] = None
    return d


async def list_for_phone(phone: str, *, tenant: Optional[str] = None,
                         status: str = "submitted") -> List[Dict[str, Any]]:
    tenant = tenant or config.BRAIN_TENANT
    pool = db.get_pool()
    try:
        async with pool.acquire() as con:
            rows = await con.fetch(
                "select id, phone_number, customer_name, lines, custom_note, total, status, "
                "pay_link, created_at from basket_sessions "
                "where tenant_id=$1 and phone_number=$2 and status=$3 order by created_at desc",
                tenant, phone, status,
            )
        return [_row_to_dict(r) for r in rows]
    except Exception:
        return []


def _pay_base() -> str:
    """The base for the warm pay-link, read from config (NEVER hardcoded). The `/shop`→`/store` rename
    couples here: when the storefront session flips the base path this is the single place that follows."""
    base = (getattr(config, "STOREFRONT_URL", "") or getattr(config, "PUBLIC_BASE_URL", "")).rstrip("/")
    seg = (getattr(config, "SHOP_PAY_PATH", "") or "/shop/pay").strip("/")
    return f"{base}/{seg}"


async def _route_to_outbox(con, basket_id: str, d: Dict[str, Any], tenant: str) -> Optional[str]:
    """Convert an ACCEPTED basket into a placed order through the SAME outbox/submit path the WhatsApp
    brain uses (medusa-integration.md §1/§2) — never a parallel Medusa create. Idempotent on the basket:
    we stamp `medusa_order_id` (here = the sancho order id) once and re-use it on a replay.

    Preferred path: `events.create_order` → `events.submit_order`, which appends the `submitted` event AND
    enqueues the `create_order` outbox row in one txn (find-then-create dedupe lives at the Medusa boundary).
    If that import/path isn't cleanly available we fall back to enqueuing the `medusa_sync` outbox row
    directly (idempotent on idem_key), so a half-wired box still records the projection intent rather than
    dropping the order. Flag-safe: with MEDUSA_SYNC_ENABLED off the intent is still recorded; the drainer
    no-ops until the flag flips (the land-dark contract).

    Returns the sancho order id (the cross-boundary idempotency key) or None if conversion was skipped.
    Runs OUTSIDE the basket-row txn deliberately: `submit_order` takes its own advisory xact-lock + txn.
    """
    if d.get("medusa_order_id"):
        return d["medusa_order_id"]  # already converted — idempotent double-accept
    order_id = "ord_bsk_" + basket_id.replace("bsk_", "")[:24]
    lines = [
        {
            "item": l.get("item") or l.get("name") or "",
            "qty": l.get("qty") or 1,
            "unit": l.get("unit") or "",
            "price": l.get("price"),
            "note": l.get("note") or "",
            "sku_id": l.get("sku_id"),
            "custom": bool(l.get("custom")),
        }
        for l in (d.get("lines") or []) if isinstance(l, dict)
    ]
    try:
        from brain import events as ev  # local import: avoids an import cycle (events → db → …)
        await ev.create_order(
            {
                "id": order_id,
                "phone_number": d.get("phone_number") or "",
                "customer_name": d.get("customer_name") or "",
                "lines": lines,
                "note": d.get("custom_note") or "",
                "status": "needs_review",
                "from_storefront": True,
                "seeded": bool(d.get("seeded", False)),
            },
            actor="storefront",
            seeded=bool(d.get("seeded", False)),
        )
        await ev.submit_order(order_id, actor="storefront_accept")
        return order_id
    except Exception:
        # Fallback: enqueue the outbox row directly (idempotent on idem_key) so the intent is never lost.
        log.exception("baskets._route_to_outbox: submit path unavailable, enqueuing outbox row directly")
        try:
            await con.execute(
                """insert into medusa_sync (tenant_id, sancho_order_id, sancho_seq, op, idem_key, payload, seeded)
                   values ($1,$2,$3,$4,$5,$6,$7) on conflict (idem_key) do nothing""",
                tenant, order_id, 1, "create_order", f"{order_id}:1:create_order",
                {"from_basket": basket_id, "lines": lines, "phone_number": d.get("phone_number") or "",
                 "customer_name": d.get("customer_name") or "", "note": d.get("custom_note") or ""},
                bool(d.get("seeded", False)),
            )
            return order_id
        except Exception:
            log.exception("baskets._route_to_outbox: direct outbox enqueue failed")
            return None


async def accept(basket_id: str, *, expected_version: Optional[int] = None,
                 tenant: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Accept a draft basket → place the order (outbox/submit) + mint the warm pay-link. Idempotent.

    Version guard (the money bug the plan flags): the "card updates as they chat" flow means the supplier
    may tap Accept on a STALE total. When `expected_version` is supplied we do a guarded
    `UPDATE … WHERE id=$1 AND version=$2`; on mismatch we DON'T accept — we return
    `{"conflict": True, "basket": <fresh row>}` so the client re-renders the new total and re-confirms.

    Conversion routes through the brain's submit_order → outbox (never a parallel Medusa create). The pay
    base is read from config (never hardcoded `/shop`). The access token is expired on accept (a leaked
    wa.me link is dead post-conversion). Flag-safe + defensive: never raises on the happy path.
    """
    tenant = tenant or config.BRAIN_TENANT
    pool = db.get_pool()
    async with pool.acquire() as con, con.transaction():
        row = await con.fetchrow(
            "select * from basket_sessions where id=$1 and tenant_id=$2 for update", basket_id, tenant)
        if not row:
            return None
        d = dict(row)
        if d["status"] in ("accepted", "paid"):
            # idempotent double-accept: never enqueue a second order, never re-mint
            return _row_to_dict(row)
        # optimistic-concurrency guard: a mid-chat edit bumped `version` after the client rendered.
        if expected_version is not None and int(d.get("version") or 0) != int(expected_version):
            return {"conflict": True, "basket": _row_to_dict(row)}

        order_id = await _route_to_outbox(con, basket_id, d, tenant)
        pay_link = d.get("pay_link") or f"{_pay_base()}/{basket_id}"
        # Guarded write: bump version, stamp the order id, clear the access token (link dies on accept).
        updated = await con.fetchrow(
            "update basket_sessions set status='accepted', pay_link=$3, "
            "medusa_order_id=coalesce(medusa_order_id,$4), version=version+1, "
            "access_token=null, access_token_at=null, updated_at=now() "
            "where id=$1 and tenant_id=$2 "
            + ("and version=$5 " if expected_version is not None else "")
            + "returning id",
            *( (basket_id, tenant, pay_link, order_id, int(expected_version))
               if expected_version is not None
               else (basket_id, tenant, pay_link, order_id) ),
        )
        if updated is None:
            # lost the race between the SELECT FOR UPDATE read and the guarded UPDATE (a concurrent
            # accept/edit landed) → surface a conflict with the fresh row, never a stale accept.
            fresh = await con.fetchrow(
                "select * from basket_sessions where id=$1 and tenant_id=$2", basket_id, tenant)
            return {"conflict": True, "basket": _row_to_dict(fresh)} if fresh else None
        row2 = await con.fetchrow(
            "select id, phone_number, customer_name, lines, custom_note, total, status, "
            "pay_link, medusa_order_id, version, phone_verified, created_at from basket_sessions "
            "where id=$1 and tenant_id=$2", basket_id, tenant)
    out = _row_to_dict(row2) if row2 else None
    # Fire the customer "accepted" notification (SMS+email source-of-truth, WhatsApp best-effort). Behind
    # NOTIFY_ENABLED (default OFF → no-op) and OUTSIDE the basket txn — a notify failure never breaks accept.
    if out:
        try:
            from brain import notify
            await notify.notify_customer("accepted", out, pay_link=out.get("pay_link"))
        except Exception:
            log.exception("baskets.accept: notify_customer(accepted) failed (non-fatal)")
    return out


async def verify_access(basket_id: str, token: str, *, tenant: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Gate a PUBLIC read/pay: return the basket ONLY if `token` matches AND is within TTL. Else None.

    Constant-time token compare; the TTL is measured from `access_token_at` (mint time). An accepted/paid
    basket has a nulled token, so the link is dead post-conversion. Never raises (a bad/missing token =
    None, treated by the caller as 404/forbidden — never leaks whether the id exists)."""
    tenant = tenant or config.BRAIN_TENANT
    if not basket_id or not token:
        return None
    pool = db.get_pool()
    try:
        async with pool.acquire() as con:
            row = await con.fetchrow(
                "select * from basket_sessions where id=$1 and tenant_id=$2", basket_id, tenant)
        if not row:
            return None
        d = dict(row)
        stored = d.get("access_token")
        minted_at = d.get("access_token_at")
        if not stored or not minted_at:
            return None
        if not secrets.compare_digest(str(stored), str(token)):
            return None
        if db.now_iso() - minted_at > ACCESS_TOKEN_TTL:
            return None
        return _row_to_dict(row)
    except Exception:
        log.exception("baskets.verify_access failed")
        return None


async def create(phone: str, customer_name: str, lines: List[Dict[str, Any]], custom_note: str,
                 *, total: Optional[float] = None, phone_verified: bool = False,
                 tenant: Optional[str] = None) -> Dict[str, Any]:
    """Create a draft basket from a storefront custom-order submit. It lands in the supplier's WhatsApp
    conversation (keyed by `phone`) as a BasketRequestCard via list_for_phone. Returns the new basket.

    `phone_verified` (the route passes True once Twilio Verify approved the number) decides whether
    notify.py may later send paid SMS to it — the toll-fraud guard. An unguessable `access_token` is
    minted here and returned so the wa.me link / basket widget can carry it (public read/pay require it)."""
    tenant = tenant or config.BRAIN_TENANT
    bid = "bsk_" + uuid.uuid4().hex[:14]
    token = _mint_token()  # carried in the wa.me link + widget payload; required on every public read/pay
    # coerce a client-supplied total defensively (it reaches a numeric column) before the None-check
    try:
        total = float(total) if total is not None else None
    except (TypeError, ValueError):
        total = None
    if total is None:
        def _num(v):
            try:
                return float(v)
            except (TypeError, ValueError):
                return 0.0
        total = sum(_num(l.get("price")) * (_num(l.get("qty")) or 1.0) for l in (lines or []) if isinstance(l, dict)) or None
    # phone_verified flows from the OTP gate at the route layer (app.py gates basket creation on Twilio
    # Verify); we record it so notify.py can fire paid SMS only to an OTP-verified number (toll-fraud guard).
    pool = db.get_pool()
    async with pool.acquire() as con:
        await con.execute(
            """insert into basket_sessions
                 (id, tenant_id, phone_number, customer_name, lines, custom_note, total, status,
                  access_token, access_token_at, phone_verified)
               values ($1,$2,$3,$4,$5,$6,$7,'submitted',$8,now(),$9)""",
            bid, tenant, phone, customer_name or "", lines or [], custom_note or "", total,
            token, bool(phone_verified))
        row = await con.fetchrow(
            "select id, phone_number, customer_name, lines, custom_note, total, status, pay_link, "
            "access_token, phone_verified, created_at from basket_sessions where id=$1", bid)
    out = _row_to_dict(row)
    # Fire the customer "submitted, not accepted yet" ack (SMS+email source of truth, WhatsApp best-effort).
    # Behind NOTIFY_ENABLED (default OFF → records intent, sends nothing) and OUTSIDE the create txn — a
    # notify failure never breaks basket creation. ASAP is inferred so the copy reads "short-notice request".
    if out:
        try:
            from brain import notify
            await notify.notify_customer("submitted", out, asap=_looks_asap(out))
        except Exception:
            log.exception("baskets.create: notify_customer(submitted) failed (non-fatal)")
    return out


_ASAP_HINTS = ("asap", "urgent", "hoy", "today", "tonight", "esta noche", "lo antes posible",
               "cuanto antes", "mañana temprano", "fuera de horario", "out of hours")


def _looks_asap(basket: Dict[str, Any]) -> bool:
    """Cheap heuristic: does this basket read as a short-notice / out-of-hours request? Drives the
    'submitted' ack copy (the email/SMS distinguishes a same-day rush from a standard custom)."""
    note = (basket.get("custom_note") or "").lower()
    if any(h in note for h in _ASAP_HINTS):
        return True
    for line in basket.get("lines") or []:
        if isinstance(line, dict):
            blob = " ".join(str(line.get(k) or "") for k in ("item", "name", "note")).lower()
            if any(h in blob for h in _ASAP_HINTS):
                return True
    return False


async def seed_demo(tenant: Optional[str] = None) -> int:
    """No-op (Peter, 2026-06-29). We used to seed one draft basket, but to show it in the Daily Brief the
    brief's coupling forced it onto a venue that ALSO had a WhatsApp order — making that account look like
    it ordered on BOTH channels, which Peter rejected ("there wouldn't really be a situation where they
    ordered on e-commerce AND on WhatsApp"). The e-commerce customization is now demoed cleanly by a
    from_storefront order's custom line («Casa Bermejo (tienda)», the e-commerce side of that account) in
    `brain/seed.py::_STOREFRONT_ORDERS`, so no standalone seeded basket is needed. Left as a no-op so
    callers stay happy + the toggle is inert."""
    return 0
    # ── retired below (kept for reference; never executes) ──
    tenant = tenant or config.BRAIN_TENANT  # noqa: F841 — dead code past the early return
    pool = db.get_pool()
    bid = "bsk_seed_casanieto"
    customer_name = "Taberna Gil"
    fallback_phone = "+34611111002"  # Taberna Ruano's seeded number (contacts.json). The dead literals
    # above (`bid` / `customer_name`) still say «casanieto» / «Taberna Gil» — names from before the
    # rename, in a branch that can never run. Fixing them is a code edit in brain/baskets.py, not a
    # comment: the whole retired block below should go with the next pass over this file.
    lines = [
        {"item": "Paleta ibérica", "qty": 2, "unit": "ud", "price": 86.0, "custom": True},
        {"item": "Morcilla de Burgos", "qty": 5, "unit": "ud", "price": 28.0, "custom": False},
    ]
    note = "¿Podéis deshuesar la paleta y envasar al vacío en raciones individuales?"
    try:
        async with pool.acquire() as con:
            # Anchor on a venue that HAS a pending order (the brief's coupling). Prefer the seeded venue
            # by name; fall back to its known number so the basket is never orphaned again.
            phone = await con.fetchval(
                "select phone_number from orders where customer_name ilike $1 limit 1",
                f"%{customer_name}%")
            phone = phone or fallback_phone
            await con.execute(
                """insert into basket_sessions
                     (id, tenant_id, phone_number, customer_name, lines, custom_note, total, status, seeded)
                   values ($1,$2,$3,$4,$5,$6,$7,'submitted',true)
                   on conflict (id) do update set phone_number=excluded.phone_number,
                     customer_name=excluded.customer_name, lines=excluded.lines,
                     custom_note=excluded.custom_note, total=excluded.total, status='submitted',
                     updated_at=now()""",
                bid, tenant, phone, customer_name, lines, note, 312.0)
        return 1
    except Exception:
        return 0
