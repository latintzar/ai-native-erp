"""Rocoto Pedidos — the orders METER (PEDIDOS-PRICING-BUILD.md §3).

Volume is the only price variable, so this is the module that decides what a tenant is paying for.
Two self-serve bands: **Small**, up to 1.500 orders a month, and **Growth**, up to 5.000. The ceilings
come from BANDS in `brain/pedidos_billing.py` via `ceiling_for()` — one source of truth shared with
Checkout, so the number a tenant is measured against is the number they bought. Above Growth is
Custom, quoted in a conversation; a tenant on a retired band keeps the ceiling stored on their row.

Counts an order against its tenant's band ceiling the FIRST time it reaches 'approved' or 'sent',
once per order id ever — enforced by a UNIQUE (tenant_id, order_id) row (pedidos_order_usage,
schema_runtime.sql), never an incrementing column, so a re-entered counting status or a duplicate call
never counts twice.

SEAM COVERAGE — read before assuming every order is counted the instant it flips. Order status
transitions land through brain/events.py's `_project()` from MANY call sites across this codebase:
app.py's own desk/APK endpoints (submit/set_status/mark_dispatched — record_order() is called
directly from those, zero-latency), but also sup_api.py's desk actions, brain/autoaccept.py's
auto-accept, brain/pipeline.py's auto-decision finalize, and portal.py's bulk finalize — none of which
this module owns or may edit. reconcile()/reconcile_all() are the safety net for THOSE: they read the
`orders` table directly (which every one of those paths already writes through `_project()`), so a
status flip is counted within one reconcile_loop() tick (started at app.py boot) even with no direct
record_order() call. Both converge on the same UNIQUE row, so calling either — or both — for the same
order is always exactly-once. The one imprecision this trades away: if reconcile() is what discovers
an order (rather than a direct record_order() call), the `counted_status` column records whatever the
order's status IS at sweep time, not necessarily whichever of 'approved'/'sent' it reached first (e.g.
an order that flips approved→sent between transitions and before any sweep runs is recorded 'sent').
The COUNT itself is still exactly-once and correct either way — only that one audit label can lag.

Overage is NEVER auto-charged (spec §5) — usage_for()'s `warn`/`over` flags only drive an email to the
account owner (maybe_warn(), fired once per calendar-month period per threshold) and the in-app upgrade
prompt (the webapp reads GET /api/pedidos/usage — see app.py).
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import config
import db
from brain.pedidos_billing import BANDS, band_key

log = logging.getLogger("rocoto.pedidos_meter")

COUNTING_STATUSES = ("approved", "sent")
WARN_PCT = 0.80                    # spec §6's ring reuses this same 80% language for the demo cap
_RECONCILE_INTERVAL_SEC = 90       # boot-loop cadence (app.py's reconcile_loop task)


def _period_of(dt: Optional[datetime] = None) -> str:
    """Calendar-month period key, 'YYYY-MM' (UTC) — ceilings are per calendar month, not per day
    (spec §2: "Ceilings are orders per calendar month, not per day")."""
    dt = dt or datetime.now(timezone.utc)
    return f"{dt.year:04d}-{dt.month:02d}"


def is_warn_threshold(used: int, ceiling: int) -> bool:
    """80% of the band ceiling — the point the ring/email nudges an upgrade (spec §6 reuses the same
    threshold language for the demo cap)."""
    return ceiling > 0 and (used / ceiling) >= WARN_PCT


def is_over_ceiling(used: int, ceiling: int) -> bool:
    """Past the band ceiling. Never auto-charged (spec §5) — only a flag."""
    return ceiling > 0 and used > ceiling


def ceiling_for(band: Optional[str], stored: Optional[int] = None) -> int:
    """The orders-per-calendar-month ceiling for `band`. The two self-serve bands are Small (1.500) and
    Growth (5.000), and BANDS in brain/pedidos_billing.py is where those numbers live — the meter reads
    them from there so the ceiling a customer is measured against is the same number the checkout sold
    them, with no second copy to drift. `stored` is the `orders_ceiling` column the webhook wrote at
    purchase time and is the fallback for a band this build no longer carries."""
    try:
        return int(BANDS[band_key(band or "")]["orders_ceiling"])
    except (ValueError, KeyError, TypeError):
        return int(stored or 0)


# ──────────────────────────── counting ────────────────────────────
async def record_order(tenant_id: str, order_id: str, status: str) -> bool:
    """Count `order_id` against `tenant_id`'s band ceiling the first time it reaches 'approved' or
    'sent'. Returns True the first time (newly counted) — the caller (app.py's owned status-change
    routes) can use that to know a fresh count just landed. False for a non-counting status, a missing
    id, or an order already counted (re-entering a counting status never counts twice — spec §3)."""
    if status not in COUNTING_STATUSES or not tenant_id or not order_id:
        return False
    pool = db.get_pool()
    async with pool.acquire() as con:
        won = await con.fetchval(
            "insert into pedidos_order_usage (tenant_id, order_id, counted_status) "
            "values ($1,$2,$3) on conflict (tenant_id, order_id) do nothing returning order_id",
            tenant_id, order_id, status)
    won = bool(won)
    if won:
        try:
            await maybe_warn(tenant_id)
        except Exception:
            log.exception("pedidos_meter: maybe_warn failed after recording %s/%s", tenant_id, order_id)
    return won


async def reconcile(tenant_id: str) -> int:
    """Safety-net sweep for one tenant: backfill any approved/sent order this meter hasn't seen yet,
    read straight off the `orders` projection (see the module docstring's SEAM COVERAGE note). Returns
    the number newly counted. Idempotent — safe to call on a timer or inline before a usage read."""
    if not tenant_id:
        return 0
    pool = db.get_pool()
    async with pool.acquire() as con:
        rows = await con.fetch(
            "insert into pedidos_order_usage (tenant_id, order_id, counted_status) "
            "select o.tenant_id, o.id, o.status from orders o "
            "where o.tenant_id = $1 and o.status = any($2::text[]) "
            "on conflict (tenant_id, order_id) do nothing returning order_id",
            tenant_id, list(COUNTING_STATUSES))
    return len(rows)


async def reconcile_all() -> int:
    """Sweep every tenant with a Pedidos subscription. One shot; reconcile_loop() calls this on a
    timer. Fail-soft per tenant — one bad sweep never blocks the others."""
    pool = db.get_pool()
    async with pool.acquire() as con:
        tenants = await con.fetch(
            "select tenant_id from pedidos_subscription where status in ('active','past_due')")
    total = 0
    for r in tenants:
        tid = r["tenant_id"]
        try:
            total += await reconcile(tid)
            await maybe_warn(tid)
        except Exception:
            log.exception("pedidos_meter reconcile_all failed for %s", tid)
    return total


async def reconcile_loop(interval_sec: int = _RECONCILE_INTERVAL_SEC) -> None:
    """Boot-started background loop (app.py's startup event) — the seam that makes metering live
    regardless of which module flipped the order's status. Never exits; one bad sweep just waits for
    the next tick."""
    while True:
        try:
            await reconcile_all()
        except Exception:
            log.exception("pedidos_meter reconcile_loop sweep failed")
        await asyncio.sleep(interval_sec)


# ──────────────────────────── usage read ────────────────────────────
async def usage_for(tenant_id: str, period: Optional[str] = None) -> Dict[str, Any]:
    """{tenant_id, period, band, used, ceiling, pct, warn, over, plan, cadence, alta_paid_at,
    priority_support_until} for tenant_id's current (or given 'YYYY-MM') billing month. Reconciles
    first so a read is never stale for want of a direct record_order() call on the path that flipped
    the order.

    THE SHAPE IS A CONTRACT the webapp consumes: every one of those keys is present on every response,
    so the frontend reads a value and never has to branch on a missing key. Two carry a null routinely
    and both are still always there — `alta_paid_at`, null for everyone who bought Small or Growth
    (they carry no alta) and a date only for a tenant who paid one under the older shape; and `plan`,
    which `app.py`'s GET /api/pedidos/usage fills in with 'pedidos' | 'empresa' | null (shared contract
    3 — `_pedidos_plan_for` reads the tenant row this module has no business reading). It is seeded
    null here purely so the key exists for every other caller too.

    `ceiling` comes from the band itself (`ceiling_for`), so it tracks the sold band rather than a
    stored copy. `cadence`/`priority_support_until` let `/billing` show the term and when priority
    support ends (PEDIDOS-PRICING-BUILD.md §5/§11)."""
    period = period or _period_of()
    await reconcile(tenant_id)
    pool = db.get_pool()
    async with pool.acquire() as con:
        sub = await con.fetchrow(
            "select band, orders_ceiling, cadence, alta_paid_at, priority_support_until "
            "from pedidos_subscription where tenant_id=$1", tenant_id)
        used = await con.fetchval(
            "select count(*) from pedidos_order_usage "
            "where tenant_id=$1 and to_char(counted_at at time zone 'utc', 'YYYY-MM')=$2",
            tenant_id, period)
    band = (sub or {}).get("band")
    ceiling = ceiling_for(band, (sub or {}).get("orders_ceiling"))
    used = int(used or 0)
    pct = round(used / ceiling, 4) if ceiling > 0 else 0.0
    return {
        "tenant_id": tenant_id, "period": period, "band": band, "used": used, "ceiling": ceiling,
        "pct": pct, "warn": is_warn_threshold(used, ceiling), "over": is_over_ceiling(used, ceiling),
        # app.py's /api/pedidos/usage overwrites this with the real plan; seeded so the key is never
        # absent for any other caller of usage_for().
        "plan": None,
        "cadence": (sub or {}).get("cadence"),
        "alta_paid_at": (sub or {}).get("alta_paid_at"),
        "priority_support_until": (sub or {}).get("priority_support_until"),
    }


# ──────────────────────────── the owner email (once per period per threshold) ────────────────────────────
async def _owner_email_fallback(tenant_id: str) -> str:
    """When no operator_email was captured at checkout, fall back to the tenant's owner/founder."""
    pool = db.get_pool()
    async with pool.acquire() as con:
        row = await con.fetchrow(
            "select o.email from team_members tm join operators o on o.id = tm.operator_id "
            "where tm.tenant_slug=$1 and tm.role in ('owner','founder') and o.email is not null "
            "order by (tm.role = 'owner') desc limit 1", tenant_id)
    return (row or {}).get("email") or ""


async def _send_usage_email(to_email: str, usage: Dict[str, Any], crossing: str) -> bool:
    # The band's customer-facing name — «Small», «Growth» — not its wire code, so the email calls the
    # plan what the pricing page and `/billing` call it.
    try:
        band = BANDS[band_key(usage.get("band") or "")]["name"]
    except (ValueError, KeyError, TypeError):
        band = (usage.get("band") or "").upper()
    used, ceiling = usage["used"], usage["ceiling"]
    base = getattr(config, "DEMO_PUBLIC_BASE_URL", "https://app.soyrocoto.com").rstrip("/")
    billing_url = f"{base}/billing"
    # NOT verbatim Peter copy (spec §4/§6 lock the pricing-page + demo strings only) — follows the
    # same copy law anyway: no negative, states the fact, one direct sentence.
    if crossing == "over_ceiling":
        title = f"Este mes llevas {used} de {ceiling} pedidos en tu plan {band}"
        body = ("Tu cuenta sigue tomando pedidos con normalidad. Un plan mayor baja tu coste por "
               "pedido — lo cambias cuando quieras.")
    else:
        title = f"Vas por {used} de {ceiling} pedidos este mes"
        body = (f"Tu plan {band} incluye hasta {ceiling} pedidos al mes. Al llegar al límite, Rocoto "
               f"sigue tomando pedidos igual — este correo es solo para que lo tengas en cuenta.")
    try:
        from brain import notify  # lazy: avoids a module-load cycle (notify → app → …)
        html = notify._email_shell(title, body, "Ver planes", billing_url, lang="es")
        res = await notify._send_email(to_email, title, html)
        return bool(res.get("ok"))
    except Exception:
        log.exception("pedidos_meter: usage email send failed")
        return False


async def maybe_warn(tenant_id: str) -> Optional[Dict[str, Any]]:
    """Check tenant_id's current-period usage; the FIRST time this period crosses 80% or the ceiling,
    email the account owner once and mark it flagged so the same crossing never re-sends (warn_period/
    warned_80_at/warned_ceiling_at on pedidos_subscription, reset when the calendar month rolls over).
    Returns {crossing, emailed, ...usage} or None when nothing new crossed. Overage is never
    auto-charged (spec §5) — this only flags."""
    usage = await usage_for(tenant_id)
    if not usage.get("ceiling"):
        return None
    period = usage["period"]
    pool = db.get_pool()
    async with pool.acquire() as con:
        sub = await con.fetchrow(
            "select operator_email, warn_period, warned_80_at, warned_ceiling_at "
            "from pedidos_subscription where tenant_id=$1", tenant_id)
        if not sub:
            return None
        if sub["warn_period"] != period:
            await con.execute(
                "update pedidos_subscription set warn_period=$2, warned_80_at=null, "
                "warned_ceiling_at=null, updated_at=now() where tenant_id=$1", tenant_id, period)
            already_80 = already_ceiling = False
        else:
            already_80 = sub["warned_80_at"] is not None
            already_ceiling = sub["warned_ceiling_at"] is not None

    crossing: Optional[str] = None
    if usage["over"] and not already_ceiling:
        crossing = "over_ceiling"
    elif usage["warn"] and not already_80:
        crossing = "warn_80"
    if not crossing:
        return None

    to_email = ((sub["operator_email"] or "").strip() if sub["operator_email"] else "")
    if not to_email:
        to_email = await _owner_email_fallback(tenant_id)
    sent = await _send_usage_email(to_email, usage, crossing) if to_email else False

    col = "warned_ceiling_at" if crossing == "over_ceiling" else "warned_80_at"
    async with pool.acquire() as con:
        await con.execute(
            f"update pedidos_subscription set {col}=now(), updated_at=now() where tenant_id=$1",
            tenant_id)
    return {"crossing": crossing, "emailed": sent, **usage}
