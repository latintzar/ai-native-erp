"""delivery.py — EL REPARTO: the stop state machine and the money ledger (SPEC §5.11).

An order used to run `needs_review → approved → sent` and then leave the product. Who took it, when
it arrived, whether anybody paid and what was said at the door lived in a van and in one driver's
head. This module is that half. It owns exactly two things and nothing else:

  1. **THE STOP STATE MACHINE** — `pendiente → entregada → liquidada`, plus the terminal
     `no_entregada` and `descartada`. Nothing else in the codebase writes `delivery_stops.state`.
  2. **THE LEDGER** — an append-only row per settlement EVENT. `owed = value − Σ settlements`, aged
     from delivery. **It is the only source of any amount shown anywhere** in the reparto surface,
     the credit gate, or a payment link. There is no screen in this feature where a human types what
     somebody owes, and there is no function here that accepts one.

WHAT THE VALUE OF AN ORDER IS, AND WHY IT IS NOT `total` — audited 2026-07-27, and it is the single
most important honesty rule in this file. **`orders` has no total column.** Extraction records only
STATED prices, so most lines carry a NULL price and no sum of the lines is a real number. The one
resolved euro value in this product is `orders.value_snapshot_cents`: frozen ONCE at dispatch by the
meter's own rule (line price → tenant catalogue price → flag unpriced), audited in `value_snapshot`,
and already the number the business bills 0.3% on. That is what a debt is measured in.

  → **An order with no snapshot has NO KNOWN VALUE and never becomes a number.** It shows «sin
    importe», it is excluded from every total, and it cannot be part of a payment link. A driver can
    still record that cash was taken for it — that is a fact — but this module will not invent the
    figure it was taken for. Inventing it would put a made-up euro amount in front of a restaurant
    owner, which is the money-shaped version of the fabricated delivery window `brain/window.py`
    exists to refuse.

ROUTE ORDERING IS NOT HERE. `vroom.py` owns the only thing in this product allowed to sequence stops;
this module PERSISTS the sequence it returns (a driver is following it — a route that re-shuffles
under him is worse than none) and never computes one. There is no ETA here and none is ever sent to a
customer: VROOM's arrival time exists to satisfy the franja constraint and to plan the day, and the
moment it crosses to the customer it has become a promise nobody made.
"""
from __future__ import annotations

import datetime as _dt
import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

log = logging.getLogger("rocoto.delivery")

# ── the closed sets. Every one of these is a state a person can be in front of; none is a flag. ──
PENDIENTE, ENTREGADA, NO_ENTREGADA, DESCARTADA = "pendiente", "entregada", "no_entregada", "descartada"
STOP_STATES = (PENDIENTE, ENTREGADA, NO_ENTREGADA, DESCARTADA)

# Why a delivery did not happen. A CLOSED list, and short on purpose: a driver types nothing here.
# It must never be harder to record a failure than a success, or the app gets lied to.
FAIL_REASONS = {
    "cerrado":    "Estaba cerrado",
    "no_estaba":  "No había nadie",
    "rechazado":  "Lo han rechazado",
    "no_llego":   "No me ha dado tiempo",
}

EFECTIVO, BIZUM, TARJETA, CREDITO = "efectivo", "bizum", "tarjeta", "credito"
METHODS = (EFECTIVO, BIZUM, TARJETA, CREDITO)
METHOD_LABEL = {EFECTIVO: "Efectivo", BIZUM: "Bizum", TARJETA: "Tarjeta", CREDITO: "Crédito"}

# Who is carrying the money when «Crédito» is chosen. This distinction is never collapsed into one
# word anywhere in the product: the supplier must always know whether HE is the one out of pocket.
BILLIE, CONFIANZA = "billie", "confianza"

# Tenant credit defaults. `on_breach='avisar'` is a DECISION, not timidity — see §5.11.7 and
# `credit_terms` below.
DEFAULT_CREDIT_DAYS = 30
AVISAR, PEDIR_PAGO = "avisar", "pedir_pago"

OVERDUE_KEY = "pago_vencido"    # the dedupe key for the one automatic aviso this module raises


def overdue_body(pos: Dict[str, Any]) -> str:
    """The one sentence the money aviso says, built from a position (`owed`/`breach`) and PURE, so a
    vital can assert the exact words with no database.

    Three shapes, because there are three truths and only one of them is a plain total:
      · everything valued   → «2 entregas sin pagar · 480,20 € · la más antigua hace 34 días»
      · nothing valued      → «2 entregas sin pagar · sin importe · la más antigua hace 40 días»
      · some of each        → «3 entregas sin pagar · 480,20 € (+1 sin importe) · …»
    The third shape exists so a partial total can never be read as the whole debt. It would be
    shorter to print `euros(cents)` in every case; that prints «0,00 €» for a customer who owes two
    deliveries, which is a number nobody computed, on the aviso nobody can dismiss."""
    n = int(pos.get("count") or 0)
    unvalued = int(pos.get("unvalued") or 0)
    known = n - unvalued
    head = f"{n} entrega{'s' if n != 1 else ''} sin pagar"
    if known <= 0:
        money = euros(None)
    elif unvalued:
        money = f"{pos.get('label') or euros(pos.get('cents'))} (+{unvalued} sin importe)"
    else:
        money = pos.get("label") or euros(pos.get("cents"))
    return f"{head} · {money} · la más antigua {age_label(int(pos.get('oldest_days') or 0))}"


# ══ formatting (es-ES; the ONE place euros become words, so the phone and the desk cannot drift) ══
def euros(cents: Optional[int]) -> str:
    """Cents → «480,20 €». None → «sin importe» — the honest string for an order whose value was
    never resolved, and the reason this returns a string rather than a number."""
    if cents is None:
        return "sin importe"
    return f"{cents / 100:,.2f} €".replace(",", " ").replace(".", ",").replace(" ", ".")


def age_label(days: int) -> str:
    """How long the money has been owed, in the words a person would use at a door."""
    if days <= 0:
        return "hoy"
    if days == 1:
        return "ayer"
    return f"hace {days} días"


def _days_since(ts: Optional[datetime]) -> int:
    if not ts:
        return 0
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    return max(0, (datetime.now(timezone.utc) - ts).days)


# ══ la ruta ══════════════════════════════════════════════════════════════════════════════════════
def route_id_for(tenant: str, day: str, driver_id: str = "") -> str:
    """Deterministic id, so the same day for the same driver is the same route however it is reached
    (the desk optimising it, the driver opening the app, a retry)."""
    return f"rt_{tenant}_{day}" + (f"_{driver_id}" if driver_id else "")


async def ensure_route(con, tenant: str, day: Any, driver_id: str = "") -> Dict[str, Any]:
    """The day's route, created if this is the first time anybody looked at it. Idempotent.

    `day` takes EITHER a `date` or a 'YYYY-MM-DD' string, and normalises here rather than making
    every caller remember which one. The trap it removes: the insert casts `$3::date`, so asyncpg
    types that parameter as a date at prepare time and a plain string raises DataError — from a
    route id that was itself built out of that same string, which is what makes it confusing."""
    if isinstance(day, str):
        day = _dt.date.fromisoformat(day.strip()[:10])
    rid = route_id_for(tenant, day.isoformat(), driver_id)
    await con.execute(
        "insert into delivery_routes (id, tenant_id, route_date, driver_operator_id) "
        "values ($1,$2,$3::date,$4) on conflict (id) do nothing",
        rid, tenant, day, driver_id or None)
    row = await con.fetchrow("select * from delivery_routes where id=$1 and tenant_id=$2", rid, tenant)
    return dict(row) if row else {}


async def sync_stops(con, tenant: str, route_id: str, order_ids: List[str]) -> None:
    """Make the route's stops match the day's orders, WITHOUT touching state anybody has already set.

    New orders become `pendiente` stops. An order no longer on the day becomes `descartada` — never
    deleted, because a stop that silently vanished is the failure this table exists to prevent — and
    only if nobody has acted on it yet; a stop already delivered stays exactly as it is, because it
    happened."""
    if order_ids:
        await con.executemany(
            "insert into delivery_stops (tenant_id, route_id, order_id) values ($1,$2,$3) "
            "on conflict (route_id, order_id) do nothing",
            [(tenant, route_id, oid) for oid in order_ids])
    await con.execute(
        # `tenant_id` is named explicitly even though `route_id` is tenant-prefixed by construction
        # ('rt_<tenant>_<date>'). Every other statement in this feature fences on the COLUMN; this
        # one would have fenced on an id-naming convention, and a tenant slug containing an
        # underscore is exactly the shape that makes two tenants' route ids collide.
        "update delivery_stops set state=$3, updated_at=now() "
        "where route_id=$1 and tenant_id=$5 and state=$2 and not (order_id = any($4::text[]))",
        route_id, PENDIENTE, DESCARTADA, list(order_ids or []), tenant)


async def save_sequence(con, tenant: str, route_id: str, result: Dict[str, Any]) -> None:
    """Persist what VROOM decided: the driving order onto the stops, the totals and the honestly
    unfitted stops onto the route. Called ONLY with a real solver result — never with a guess."""
    stops = result.get("stops") or []
    if stops:
        await con.executemany(
            "update delivery_stops set position=$3, updated_at=now() "
            "where route_id=$1 and order_id=$2",
            [(route_id, s.get("order_id"), int(s.get("position") or 0)) for s in stops])
    await con.execute(
        "update delivery_routes set optimised_at=now(), total_distance_m=$2, total_duration_s=$3, "
        "unassigned=$4::jsonb, updated_at=now() where id=$1",
        route_id, int(result.get("total_distance_m") or 0), int(result.get("total_duration_s") or 0),
        json.dumps(result.get("unassigned_order_ids") or []))


# ══ la parada ════════════════════════════════════════════════════════════════════════════════════
async def mark_delivered(con, tenant: str, stop_id: int, *, by: str = "",
                         lat: Optional[float] = None, lon: Optional[float] = None) -> Dict[str, Any]:
    """The hold-to-confirm at the door. Position is recorded ONCE, at the tap, as proof of PRESENCE —
    this product has no live trail and does not track a driver between stops.

    Idempotent by construction: re-confirming an already-delivered stop does not move the timestamp,
    because the second tap is a double-tap and not a second delivery."""
    row = await con.fetchrow(
        "update delivery_stops set state=$3, delivered_at=coalesce(delivered_at, now()), "
        "delivered_by=coalesce(delivered_by,$4), lat=coalesce($5,lat), lon=coalesce($6,lon), "
        "updated_at=now() where id=$1 and tenant_id=$2 and state in ($7,$3) returning *",
        stop_id, tenant, ENTREGADA, by or None, lat, lon, PENDIENTE)
    if not row:
        raise LookupError("no_such_stop")
    return dict(row)


async def mark_failed(con, tenant: str, stop_id: int, reason: str, *, by: str = "") -> Dict[str, Any]:
    """«No he podido entregar» — a real outcome, recorded as easily as a success."""
    if reason not in FAIL_REASONS:
        raise ValueError("Elige por qué no has podido entregarlo.")
    row = await con.fetchrow(
        "update delivery_stops set state=$3, failed_reason=$4, delivered_by=coalesce(delivered_by,$5), "
        "updated_at=now() where id=$1 and tenant_id=$2 returning *",
        stop_id, tenant, NO_ENTREGADA, reason, by or None)
    if not row:
        raise LookupError("no_such_stop")
    return dict(row)


async def attach(con, tenant: str, stop_id: int, *, proof_url: str = "", note: str = "") -> Dict[str, Any]:
    """The photo and the note. A note APPENDS — a driver adding a second thought must not silently
    erase the first — and dictation has already become text by the time it arrives here, because a
    voice note nobody plays is not a record."""
    row = await con.fetchrow(
        "update delivery_stops set proof_url=coalesce(nullif($3,''), proof_url), "
        "note = case when $4 = '' then note "
        "            when note = '' then $4 else note || E'\\n' || $4 end, "
        "updated_at=now() where id=$1 and tenant_id=$2 returning *",
        stop_id, tenant, proof_url or "", note or "")
    if not row:
        raise LookupError("no_such_stop")
    return dict(row)


# ══ lo pendiente — the ledger ════════════════════════════════════════════════════════════════════
async def outstanding(con, tenant: str, phone: str) -> List[Dict[str, Any]]:
    """Every DELIVERED order this customer has not finished paying for, oldest first.

    Delivered is the gate on purpose: an order still in the van is not a debt, and dunning somebody
    for goods they have not received is the worst thing this feature could do. Orders with no
    resolved value are returned too, marked `known=False` — the driver can see they exist (they are
    part of the relationship) but they carry no figure and never enter a total."""
    rows = await con.fetch(
        """select o.id, o.delivery_date, o.value_snapshot_cents, s.delivered_at,
                  coalesce(sum(x.amount_cents), 0) as paid_cents,
                  coalesce(bool_or(x.method is not null and x.method <> $4), false) as was_collected
             from orders o
             join delivery_stops s on s.order_id = o.id and s.tenant_id = o.tenant_id
             left join delivery_settlements x on x.order_id = o.id and x.tenant_id = o.tenant_id
            where o.tenant_id = $1 and o.phone_number = $2 and s.state = $3
            group by o.id, o.delivery_date, o.value_snapshot_cents, s.delivered_at
            order by s.delivered_at asc nulls last""",
        tenant, phone, ENTREGADA, CREDITO)
    out: List[Dict[str, Any]] = []
    for r in rows:
        val = r["value_snapshot_cents"]
        paid = int(r["paid_cents"] or 0)
        if val is not None and paid >= int(val):
            continue                                    # settled; it leaves the list, it is not a zero
        if val is None and r["was_collected"]:
            # AN UNVALUED ORDER CLOSES ON THE ACT, NOT ON THE ARITHMETIC. Its settlement row is
            # necessarily amount 0 (we never invented the figure), so `paid >= val` can never retire
            # it — without this branch a driver takes the cash, the order stays outstanding forever,
            # the overdue aviso keeps shouting, and because an `auto` aviso refuses to be closed by
            # hand the customer is dunned permanently for money he already paid. What settles it is
            # that somebody recorded a real method (efectivo/bizum/tarjeta); `credito` is excluded
            # because agreeing to carry it is precisely NOT collecting it.
            continue
        days = _days_since(r["delivered_at"])
        out.append({
            "order_id": r["id"],
            "known": val is not None,
            "amount_cents": (int(val) - paid) if val is not None else None,
            "amount_label": euros(int(val) - paid) if val is not None else euros(None),
            "delivered_at": r["delivered_at"],
            "days": days,
            "age_label": age_label(days),
        })
    return out


async def owed(con, tenant: str, phone: str) -> Dict[str, Any]:
    """The customer's position in one shape: what is owed, how old the oldest is, and how much of it
    we cannot put a number on. `cents` NEVER includes an unvalued order.

    **`label` is «sin importe» when nothing outstanding has a value**, and that is the whole point of
    this function rather than a detail of it. The obvious `euros(cents)` renders «0,00 €» for two
    unvalued deliveries — a made-up euro figure, on the one aviso that is underlined, undismissible
    and read out at a restaurant's door. Zero is not what we know; «sin importe» is. When SOME are
    valued and some are not, the label carries the real sum and `unvalued` carries the rest, so no
    caller can mistake a partial total for the whole debt."""
    items = await outstanding(con, tenant, phone)
    known = [i for i in items if i["known"]]
    cents = sum(int(i["amount_cents"]) for i in known)
    return {
        "count": len(items),
        "cents": cents,
        "label": euros(cents) if known else euros(None),
        "oldest_days": max([i["days"] for i in items], default=0),
        "unvalued": len(items) - len(known),
        "items": items,
    }


async def credit_terms(con, tenant: str) -> Dict[str, Any]:
    """The tenant's credit rule, with the defaults that ship.

    `on_breach` defaults to **avisar** — the employee briefs the boss rather than chasing the
    customer. That is not caution for its own sake: an AI asking a restaurant for money when the
    supplier has not said it may is the employee acting on the customer relationship, which the
    product's standing law reserves for the human. `pedir_pago` is one tap away in Ajustes."""
    row = await con.fetchrow("select * from tenant_credit where tenant_id=$1", tenant)
    if not row:
        return {"tenant_id": tenant, "credit_days": DEFAULT_CREDIT_DAYS, "credit_limit_cents": None,
                "on_breach": AVISAR, "offer_terms": False}
    return dict(row)


async def breach(con, tenant: str, phone: str) -> Dict[str, Any]:
    """Has this customer gone past the tenant's terms — by TIME or by AMOUNT? Returns the position
    plus WHY, because the reason is what the employee says out loud and «llevas mucho» is not a
    reason. Nothing here decides what to do about it; that is the caller's, per `on_breach`."""
    pos = await owed(con, tenant, phone)
    terms = await credit_terms(con, tenant)
    days, limit = int(terms["credit_days"] or DEFAULT_CREDIT_DAYS), terms.get("credit_limit_cents")
    by_time = pos["count"] > 0 and pos["oldest_days"] > days
    by_amount = limit is not None and pos["cents"] > int(limit)
    reason = ""
    if by_time:
        reason = f"lleva {pos['oldest_days']} días sin liquidar (el plazo son {days})"
    elif by_amount:
        reason = f"debe {pos['label']} (el límite son {euros(int(limit))})"
    return {**pos, "breached": bool(by_time or by_amount), "by_time": by_time,
            "by_amount": by_amount, "reason": reason, "terms": terms}


async def settle(con, tenant: str, order_ids: List[str], method: str, *,
                 credit_kind: str = "", by: str = "", external_ref: str = "",
                 stop_id: Optional[int] = None, note: str = "") -> Dict[str, Any]:
    """Record that these deliveries were settled — ONE ledger row per order, append-only.

    **The amount is never passed in.** It is read from the ledger for each order, which is what makes
    it impossible for any screen to settle a debt for a figure somebody typed. `credito` writes rows
    of amount ZERO on purpose: it records that the money was NOT taken and who agreed to that, which
    is a fact worth keeping and not the absence of one.

    Orders with no resolved value are accepted for cash (the fact is real) and recorded at zero —
    they were never in a total, so they cannot leave a balance behind."""
    if method not in METHODS:
        raise ValueError("Método de pago desconocido.")
    if method == CREDITO and credit_kind not in (BILLIE, CONFIANZA):
        raise ValueError("Di quién asume el crédito.")
    if not order_ids:
        raise ValueError("No has elegido ninguna entrega.")
    rows = await con.fetch(
        """select o.id, o.value_snapshot_cents, coalesce(sum(x.amount_cents),0) as paid
             from orders o left join delivery_settlements x
               on x.order_id = o.id and x.tenant_id = o.tenant_id
            where o.tenant_id = $1 and o.id = any($2::text[])
            group by o.id, o.value_snapshot_cents""",
        tenant, sorted(set(order_ids)))
    if not rows:
        raise LookupError("no_such_order")
    total = 0
    written: List[Tuple] = []
    for r in rows:
        val, paid = r["value_snapshot_cents"], int(r["paid"] or 0)
        amount = 0 if (method == CREDITO or val is None) else max(0, int(val) - paid)
        total += amount
        written.append((tenant, r["id"], stop_id, amount, method, credit_kind or "",
                        external_ref or "", by or None, note or ""))
    await con.executemany(
        "insert into delivery_settlements (tenant_id, order_id, stop_id, amount_cents, method, "
        "credit_kind, external_ref, recorded_by, note) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)", written)
    if stop_id is not None:
        await con.execute("update delivery_stops set updated_at=now() where id=$1 and tenant_id=$2",
                          stop_id, tenant)
    return {"orders": len(written), "cents": total, "label": euros(total), "method": method,
            "credit_kind": credit_kind or ""}


async def payable(con, tenant: str, order_ids: List[str]) -> Dict[str, Any]:
    """What a payment link for these orders must be for — the ledger's own number, and the ONLY
    function allowed to produce the figure a customer is asked to pay. Unvalued orders are refused
    rather than guessed at: we do not put a made-up euro amount in front of a restaurant."""
    rows = await con.fetch(
        """select o.id, o.value_snapshot_cents, coalesce(sum(x.amount_cents),0) as paid
             from orders o left join delivery_settlements x
               on x.order_id = o.id and x.tenant_id = o.tenant_id
            where o.tenant_id = $1 and o.id = any($2::text[])
            group by o.id, o.value_snapshot_cents""",
        tenant, sorted(set(order_ids)))
    unvalued = [r["id"] for r in rows if r["value_snapshot_cents"] is None]
    if unvalued:
        raise ValueError("Hay entregas sin importe — no puedo cobrar una cantidad que no tengo.")
    cents = sum(max(0, int(r["value_snapshot_cents"]) - int(r["paid"] or 0)) for r in rows)
    if cents <= 0:
        raise ValueError("No queda nada por pagar en esas entregas.")
    return {"cents": cents, "label": euros(cents), "order_ids": [r["id"] for r in rows]}


# ══ the one automatic aviso this module raises ═══════════════════════════════════════════════════
async def sync_overdue_aviso(con, tenant: str, phone: str) -> Optional[int]:
    """Money overdue → the `auto` aviso that meets the driver at that customer's door; money settled
    → it closes itself. It is not dismissible anywhere in the UI because it is not an opinion: it
    goes away when the fact does, and this function is the only thing that decides.

    Returns the aviso id when one is open. Fail-soft: a delivery list is never taken down by this."""
    try:
        b = await breach(con, tenant, phone)
        if not b["breached"]:
            await con.execute(
                "update avisos set state='resuelto', resolved_at=now(), "
                "resolved_choice='se ha liquidado' where tenant_id=$1 and phone_number=$2 "
                "and kind='auto' and auto_key=$3 and state='abierto'", tenant, phone, OVERDUE_KEY)
            return None
        body = overdue_body(b)
        return await con.fetchval(
            """insert into avisos (tenant_id, phone_number, kind, audience, band, body, auto_key)
               values ($1,$2,'auto','repartidor','subrayado',$3,$4)
               on conflict (tenant_id, phone_number, auto_key) where kind='auto' and state='abierto'
               do update set body = excluded.body
               returning id""",
            tenant, phone, body, OVERDUE_KEY)
    except Exception:
        log.debug("delivery.sync_overdue_aviso fail-soft for %s", phone, exc_info=True)
        return None
