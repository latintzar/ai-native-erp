"""brain/billing.py — M1M2 WP-4: the €500 credit ledger + the 0,3% GMV meter (SPEC §16.4).

THE MONEY LOOP, end to end (organ: the commerce stack + spine events):

  €500 alta paid (setupfee) ──► +50000 'setup_fee_credit' row in credit_ledger
  orders dispatched          ──► value SNAPSHOT frozen on each order row (eng F1: line.price →
                                 tenant catalogue price → flag unpriced; the meter sums ONLY snapshots)
  worker.run_billing_once    ──► for each live tenant × fully-elapsed Europe/Madrid month (eng F12):
                                 billing_run row, state computed → debited → invoiced, EACH transition
                                 its own tx (eng F3) under a per-tenant advisory lock —
                                   · commission = round(GMV × 0.003)
                                   · credit debited FIRST (ledger row -x/'commission_YYYY-MM';
                                     unique(tenant_id, reason) = structural no-double-debit)
                                   · remainder → Stripe Invoice on the SAVED card, auto_advance
                                     (AUTO-CHARGE — Peter's law; idempotency_key comm-{tenant}-{period})
  invoice paid / failed      ──► Stripe webhook (metadata kind='rocoto_commission') routes into the
                                 employment duty sense — the EXISTING chase_salary manifest row opens
                                 the dunning tab (/api/employment/event stays the canonical consumer;
                                 setupfee.handle_webhook calls on_stripe_invoice_event here)

Every meter pass emits `billing.meter_run{period,gmv_cents,commission_cents,credit_debited_cents,
invoiced_cents}` on the tenant scope (dx F4 — the credit-burn months are never a why-trace blind
spot); ledger rows ref that event. Billing figures are ALSO served as keyed COMMERCIAL facts on the
boss scope (`billing:credit`, `billing:comision:<period>`) so in-chat amounts ride the keyed-read
path and gate.standing_prices carries them — «12,40 € de comisión» never false-parks (eng F10).

SINGLE-TENANT SHORTCUT (named, the customer-#2 wall): the legacy `orders` table carries no
tenant_id, so GMV attributes to config.BRAIN_TENANT ONLY — any other live tenant meters 0 until
order rows are tenant-scoped. This prevents the double-billing failure (two live tenants each
billing the same global order book), loudly, rather than hiding it.

Stripe is MOCKED in vitals via `_invoice_creator` (module seam). No key/customer → the run parks at
'debited' with a typed error + 6h retry pacing — money owed is never silently forgotten.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from zoneinfo import ZoneInfo

import config
import db

log = logging.getLogger("rocoto.billing")

TZ = ZoneInfo("Europe/Madrid")          # the billing calendar (eng F12) — same zone presence.py uses
COMMISSION_PERMILLE = 3                 # 0.3% of GMV — Peter's law, a constant, not a config knob
SETUP_CREDIT_REASON = "setup_fee_credit"
RETRY_HOURS = 6                         # a stuck invoice step retries at most every 6h (never spams)
MAX_BACKFILL_PERIODS = 24               # catch-up bound: a box down never bills >24 months blindly


def commission_cents(gmv_cents: int) -> int:
    """0.3% of GMV in euro cents, integer math, half-up — exact and reproducible."""
    return (int(gmv_cents) * COMMISSION_PERMILLE + 500) // 1000


# ── Europe/Madrid calendar months (eng F12) ──────────────────────────────────────────────────
def period_of(dt: datetime) -> str:
    """The 'YYYY-MM' Madrid calendar month an instant falls in (tz-aware instants convert; a naive
    instant is taken as already-Madrid — vitals inject those deterministically)."""
    if dt.tzinfo is not None:
        dt = dt.astimezone(TZ)
    return f"{dt.year:04d}-{dt.month:02d}"


def period_bounds(period: str) -> tuple[datetime, datetime]:
    """[start, end) of a 'YYYY-MM' period as tz-aware Madrid instants — the SQL bucket edges, so an
    order dispatched 23:30 UTC on the 30th lands in the month Madrid says it does."""
    y, m = int(period[:4]), int(period[5:7])
    start = datetime(y, m, 1, tzinfo=TZ)
    end = datetime(y + (m == 12), 1 if m == 12 else m + 1, 1, tzinfo=TZ)
    return start, end


def _prev_period(period: str) -> str:
    y, m = int(period[:4]), int(period[5:7])
    return f"{y - (m == 1):04d}-{12 if m == 1 else m - 1:02d}"


def elapsed_periods(since: datetime, now: datetime) -> List[str]:
    """Every FULLY-ELAPSED Madrid month from `since`'s month up to (and including) the month before
    `now`'s — the meter bills only closed months; a box down on the 1st catches up here. Bounded."""
    first = period_of(since)
    last_closed = _prev_period(period_of(now))
    out: List[str] = []
    p = first
    while p <= last_closed and len(out) < MAX_BACKFILL_PERIODS:
        out.append(p)
        y, m = int(p[:4]), int(p[5:7])
        p = f"{y + (m == 12):04d}-{1 if m == 12 else m + 1:02d}"
    return out


# ── the dispatch-time VALUE SNAPSHOT (eng F1 — the meter sums ONLY snapshots) ────────────────
def order_value_snapshot(order: Dict[str, Any],
                         price_by_sku: Dict[str, float]) -> tuple[int, Dict[str, Any]]:
    """Resolve one order's euro value at dispatch. Per line: the STATED price wins → else the tenant
    CATALOGUE price for the line's grounded sku → else the line is FLAGGED unpriced (contributes 0,
    counted — never silently guessed). Pure; returns (total_cents, audit_detail)."""
    lines_out: List[Dict[str, Any]] = []
    total = 0
    unpriced = 0
    for ln in (order.get("lines") or []):
        if not isinstance(ln, dict):
            continue
        try:
            qty = float(ln.get("qty") or 0)
        except (TypeError, ValueError):
            qty = 0.0
        price: Optional[float] = None
        source = "unpriced"
        raw = ln.get("price")
        if isinstance(raw, (int, float)) and not isinstance(raw, bool) and float(raw) > 0:
            price, source = float(raw), "stated"
        else:
            sid = str(ln.get("sku_id") or ln.get("sku") or "")
            cp = price_by_sku.get(sid) if sid else None
            if cp is not None and float(cp) > 0:
                price, source = float(cp), "catalogue"
        cents = int(round(qty * price * 100)) if price is not None else 0
        if price is None:
            unpriced += 1
        total += cents
        lines_out.append({"item": ln.get("item") or "", "qty": qty,
                          "unit_price_eur": price, "source": source, "value_cents": cents})
    detail = {"lines": lines_out, "unpriced_lines": unpriced,
              "at": datetime.now(TZ).isoformat()}
    return total, detail


async def _catalogue_prices(sku_ids: List[str], tenant: Optional[str] = None) -> Dict[str, float]:
    """sku_id → price for the fallback rule, one query. Fail-soft to {} (lines flag unpriced)."""
    ids = [s for s in dict.fromkeys(sku_ids) if s]
    if not ids:
        return {}
    try:
        async with db.get_pool().acquire() as con:
            rows = await con.fetch(
                "select id, price::float8 as price from catalogue_skus "
                "where tenant_id=$1 and id = any($2::text[]) and price is not null",
                tenant or config.BRAIN_TENANT, ids)
        return {r["id"]: float(r["price"]) for r in rows}
    except Exception:
        log.exception("billing: catalogue price read failed (lines will flag unpriced)")
        return {}


async def snapshot_dispatch_values(orders: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Freeze the value snapshot onto every order in a dispatch batch (called from app._run_dispatch
    right before mark_dispatched). SET-ONCE per row (db.order_set_value_snapshot). Fail-soft per
    order — one bad row never blocks the batch; a hole is visible as billing_run.unsnapshotted."""
    sku_ids: List[str] = []
    for o in orders or []:
        for ln in (o.get("lines") or []):
            if isinstance(ln, dict) and not ln.get("price"):
                sid = ln.get("sku_id") or ln.get("sku")
                if sid:
                    sku_ids.append(str(sid))
    prices = await _catalogue_prices(sku_ids)
    written = skipped = failed = 0
    for o in orders or []:
        try:
            cents, detail = order_value_snapshot(o, prices)
            if await db.order_set_value_snapshot(str(o.get("id")), cents, detail):
                written += 1
            else:
                skipped += 1                      # already snapshotted (set-once) — never rewritten
        except Exception:
            failed += 1
            log.exception("billing: value snapshot failed for order %s (meter will show the hole)",
                          o.get("id"))
    return {"written": written, "skipped": skipped, "failed": failed}


# ── the credit ledger ────────────────────────────────────────────────────────────────────────
async def credit_balance_cents(tenant: str) -> int:
    async with db.get_pool().acquire() as con:
        return int(await con.fetchval(
            "select coalesce(sum(delta_cents),0) from credit_ledger where tenant_id=$1", tenant) or 0)


async def _resolve_tenant_for_token(token: str) -> Optional[str]:
    """The tenant slug the paid token belongs to: the stored onboarding_tokens.tenant_slug, else the
    SAME deterministic derivation golive uses — stamped back onto the token so every later read
    (golive, meter, refund) resolves the ONE tenant."""
    async with db.get_pool().acquire() as con:
        row = await con.fetchrow(
            "select t.token, t.tenant_slug, t.lead_id, l.name, l.business "
            "from onboarding_tokens t left join leads l on l.id=t.lead_id where t.token=$1", token)
    if not row:
        return None
    slug = (row["tenant_slug"] or "").strip().lower()
    if slug:
        return slug
    if not row["lead_id"]:
        return None
    from brain import golive
    slug = golive._derive_slug(row["business"] or row["name"] or "", row["lead_id"])
    async with db.get_pool().acquire() as con:
        await con.execute("update onboarding_tokens set tenant_slug=$1 "
                          "where token=$2 and tenant_slug is null", slug, token)
    return slug


async def grant_setup_credit(token: str, session: Any) -> Dict[str, Any]:
    """The paid €500 alta becomes prepaid commission credit: ONE +amount row ('setup_fee_credit',
    unique per tenant — a replayed webhook / browser-return race conflicts and adopts). Called from
    setupfee._record_payment; fail-soft there (a ledger hiccup never blocks onboarding finalize)."""
    tenant = await _resolve_tenant_for_token(token)
    if not tenant:
        return {"ok": False, "reason": "no_tenant"}
    amount = int(session.get("amount_total") or 0)
    if amount <= 0:
        try:
            amount = int(round(float(config.ROCOTO_SETUP_FEE_EUR or "0"))) * 100
        except (TypeError, ValueError):
            amount = 0
    if amount <= 0:
        return {"ok": False, "reason": "no_amount"}
    async with db.get_pool().acquire() as con:
        new_id = await con.fetchval(
            "insert into credit_ledger (tenant_id, delta_cents, reason, detail) "
            "values ($1,$2,$3,$4) on conflict (tenant_id, reason) do nothing returning id",
            tenant, amount, SETUP_CREDIT_REASON,
            {"token": token, "session_id": session.get("id"), "src": "setupfee"})
    balance = await credit_balance_cents(tenant)
    await _refresh_credit_fact(tenant, balance)
    log.info("billing: setup credit %s for %s → %+d cents (balance %d, %s)",
             "GRANTED" if new_id else "already-granted", tenant, amount, balance,
             f"token={token[:8]}…")
    return {"ok": True, "tenant": tenant, "granted": bool(new_id),
            "amount_cents": amount, "balance_cents": balance}


# ── keyed billing facts (eng F10 — in-chat awareness rides the keyed-read path) ──────────────
def _eur(cents: int) -> str:
    return f"{int(cents) / 100:.2f}".replace(".", ",") + " €"


async def _boss_scope(tenant: Optional[str] = None) -> Optional[str]:
    """The boss scope billing facts land on (and the dunning duty chases): the newest live
    tier='boss' scope_node, else the creator line (single-tenant v1 — same resolution order as the
    dispatch reflexes). None → no rail; the caller fail-softs."""
    try:
        async with db.control_pool().acquire() as con:
            sc = await con.fetchval(
                "select scope::text from scope_node where tier='boss' and lineage='live' "
                "order by created_at desc limit 1")
        if sc:
            return str(sc)
    except Exception:
        log.debug("billing: boss scope_node read fail-soft", exc_info=True)
    first = (config._env("ROCOTO_CREATOR_NUMBERS", "+12025550110").split(",") or [""])[0].strip()
    if not first:
        return None
    import runtime
    return runtime.scope_of(first)


async def _write_billing_fact(scope: str, key: str, text: str) -> None:
    """A keyed COMMERCIAL fact write with memory.write_fact's exact keyed semantics (restate → drop;
    new value → invalidate prior + insert), but embedding NULL: keyed reads are exact index lookups
    and gate.standing_prices reads by kind — and the WORKER process must never lazy-load the 384-d
    embed model just to note a balance (its footprint invariant, worker.py docstring)."""
    async with db.scoped_tx(scope) as con:
        cur = await con.fetchrow(
            "select id, text from fact where scope=$1::ltree and key=$2 and invalid_at is null "
            "order by id desc limit 1", scope, key)
        if cur is not None:
            if " ".join((cur["text"] or "").lower().split()) == " ".join(text.lower().split()):
                return
            await con.execute("update fact set invalid_at=now() where id=$1", cur["id"])
        await con.execute(
            "insert into fact(scope,kind,text,key,valid_at,confidence) "
            "values($1::ltree,'COMMERCIAL',$2,$3,now(),'high')", scope, text, key)


async def _refresh_credit_fact(tenant: str, balance_cents: int) -> None:
    """billing:credit on the boss scope — the amount the employee can STATE in chat without the gate
    parking it (standing_prices carries every CURRENT COMMERCIAL amount). Fail-soft."""
    try:
        scope = await _boss_scope(tenant)
        if scope:
            await _write_billing_fact(
                scope, "billing:credit",
                f"Crédito Rocoto restante (alta a cuenta de comisión): {_eur(balance_cents)}.")
    except Exception:
        log.debug("billing: credit fact refresh fail-soft", exc_info=True)


async def _refresh_period_fact(tenant: str, period: str, gmv: int, comm: int) -> None:
    try:
        scope = await _boss_scope(tenant)
        if scope:
            await _write_billing_fact(
                scope, f"billing:comision:{period}",
                f"Comisión Rocoto de {period} (0,3% de {_eur(gmv)} facturados): {_eur(comm)}.")
    except Exception:
        log.debug("billing: period fact refresh fail-soft", exc_info=True)


# ── the METER — durable billing_run state machine (eng F2/F3) ────────────────────────────────
async def _period_gmv(tenant: str, period: str) -> tuple[int, int]:
    """(gmv_cents, unsnapshotted) for a Madrid month: Σ value snapshots of LIVE (never seeded/demo)
    orders dispatched in [start, end), FOR THIS TENANT.

    THE CUSTOMER-#2 WALL, now down (2026-07-27). This function used to refuse outright: the orders
    table carried no `tenant_id`, so the only honest reading of a global book was "it is all
    BRAIN_TENANT's", and any other tenant metered 0 rather than being billed for Peter's orders.
    That refusal was correct while the column did not exist and is wrong now that it does — leaving
    it would mean a second distributor is invoiced €0 for every order Rocoto files for them.
    Peter's own number is unchanged: every pre-existing order backfills to BRAIN_TENANT at boot
    (db._backfill_order_tenants), so the predicate selects exactly the rows the global scan did."""
    start, end = period_bounds(period)
    async with db.get_pool().acquire() as con:
        row = await con.fetchrow(
            "select coalesce(sum(value_snapshot_cents),0)::bigint as gmv, "
            "       count(*) filter (where value_snapshot_cents is null)::int as holes "
            "from orders where dispatched_at >= $1 and dispatched_at < $2 "
            "and coalesce(seeded,false)=false and tenant_id = $3", start, end, tenant)
    return int(row["gmv"] or 0), int(row["holes"] or 0)


async def _stripe_customer_for(tenant: str) -> tuple[Optional[str], bool]:
    """(stripe_customer_id, is_test) — the saved card behind the newest PAID progress row of this
    tenant's tokens (the card that paid the €500 IS the card the meter charges, eng F7)."""
    async with db.get_pool().acquire() as con:
        row = await con.fetchrow(
            "select p.stripe_customer_id, coalesce(p.is_test,false) as is_test "
            "from onboarding_progress p join onboarding_tokens t on t.token=p.token "
            "where t.tenant_slug=$1 and p.stripe_customer_id is not null "
            "order by p.paid_at desc nulls last limit 1", tenant)
    if not row:
        return None, False
    return row["stripe_customer_id"], bool(row["is_test"])


async def _default_invoice_creator(tenant: str, period: str, cents: int,
                                   customer_id: str, is_test: bool,
                                   boss_scope: Optional[str]) -> Dict[str, Any]:
    """The REAL Stripe remainder invoice: pending InvoiceItem + Invoice on the saved card,
    auto_advance + charge_automatically (AUTO-CHARGE — Peter's law). idempotency_key
    comm-{tenant}-{period} makes a crash-rerun return the SAME invoice, never a second charge.
    metadata kind='rocoto_commission' routes the paid/failed webhook into the employment duty."""
    from brain import setupfee
    if not setupfee.enabled(is_test):
        return {"ok": False, "error": "not_configured"}
    st = setupfee._stripe(is_test)
    ikey = f"comm-{tenant}-{period}"
    metadata = {"kind": "rocoto_commission", "tenant": tenant, "period": period,
                "invoice_key": ikey, "tenant_scope": boss_scope or ""}

    def _create():
        st.InvoiceItem.create(
            customer=customer_id, amount=int(cents), currency="eur",
            description=f"Comisión Rocoto 0,3% — {period}",
            metadata=metadata, idempotency_key=f"{ikey}-item")
        return st.Invoice.create(
            customer=customer_id, auto_advance=True, collection_method="charge_automatically",
            metadata=metadata, idempotency_key=ikey)

    try:
        inv = await asyncio.to_thread(_create)
        return {"ok": True, "invoice_id": inv.get("id")}
    except Exception as e:
        log.exception("billing: stripe invoice failed for %s %s", tenant, period)
        return {"ok": False, "error": f"stripe:{str(e)[:160]}"}


# vitals monkeypatch THIS seam — Stripe is never called in tests.
_invoice_creator = _default_invoice_creator


async def _emit_meter_event(tenant: str, period: str, gmv: int, comm: int,
                            debited: int, invoiced: int, state: str) -> Optional[int]:
    """billing.meter_run on the tenant scope — every pass, so a credit-burn month is never a
    why-trace blind spot (dx F4). Ledger rows ref the returned event id. Fail-soft to None."""
    try:
        import spine
        scope = f"t.{tenant}"
        async with db.scoped_tx(scope) as con:
            eid, _ = await spine.append_event(
                con, scope, "billing.meter_run", "billing",
                {"period": period, "gmv_cents": int(gmv), "commission_cents": int(comm),
                 "credit_debited_cents": int(debited), "invoiced_cents": int(invoiced),
                 "state": state},
                lane="world")
        return int(eid)
    except Exception:
        log.debug("billing: meter_run event fail-soft (%s %s)", tenant, period, exc_info=True)
        return None


async def process_run(tenant: str, period: str, *, force: bool = False) -> Dict[str, Any]:
    """Drive ONE (tenant, period) through the state machine, each transition its own tx, all under
    the per-tenant advisory lock (eng F3 — two scans can never double-debit; the single-worker
    invariant makes the lock a belt). Idempotent at every crash point:
      · rerun before the billing_run insert → recompute (same figures, on-conflict-do-nothing);
      · rerun of the debit → the ledger unique(tenant, reason) conflicts and the EXISTING row's
        delta is adopted into billing_run (no double-debit);
      · rerun of the invoice → the Stripe idempotency_key returns the SAME invoice (no lost, no
        duplicate invoice); a failed invoice parks at 'debited' with a typed error + retry pacing.
    """
    out: Dict[str, Any] = {"tenant": tenant, "period": period}
    pool = db.get_pool()
    async with pool.acquire() as con:
        await con.execute("select pg_advisory_lock(hashtext($1)::bigint)", f"rocoto_billing:{tenant}")
        try:
            row = await con.fetchrow(
                "select * from billing_run where tenant_id=$1 and period=$2", tenant, period)

            # ── COMPUTE (→ 'computed'): freeze GMV + commission for the closed month, once ──
            if row is None:
                gmv, holes = await _period_gmv(tenant, period)
                comm = commission_cents(gmv)
                async with con.transaction():
                    await con.execute(
                        "insert into billing_run (tenant_id, period, state, gmv_cents, "
                        "commission_cents, unsnapshotted) values ($1,$2,'computed',$3,$4,$5) "
                        "on conflict (tenant_id, period) do nothing",
                        tenant, period, gmv, comm, holes)
                row = await con.fetchrow(
                    "select * from billing_run where tenant_id=$1 and period=$2", tenant, period)

            state = row["state"]
            gmv, comm = int(row["gmv_cents"]), int(row["commission_cents"])
            debited = int(row["credit_debited_cents"])
            invoiced = int(row["invoiced_cents"])
            if state == "invoiced":
                return {**out, "state": "invoiced", "skipped": True}

            # invoice-retry pacing: a run stuck at 'debited' (no card / stripe down) retries at
            # most every RETRY_HOURS — money owed is never forgotten, and never spams.
            if (state == "debited" and not force and row["last_attempt_at"] is not None
                    and row["last_attempt_at"] > datetime.now(TZ) - timedelta(hours=RETRY_HOURS)):
                return {**out, "state": state, "waiting_retry": True}

            # planned figures for THIS pass (authoritative under the lock) + the pass's spine event.
            if state == "computed":
                balance = await credit_balance_cents(tenant)
                debited = min(max(balance, 0), comm)
            remainder = comm - debited
            eid = await _emit_meter_event(tenant, period, gmv, comm, debited, remainder, state)
            await con.execute(
                "update billing_run set meter_event=coalesce($3, meter_event), updated_at=now() "
                "where tenant_id=$1 and period=$2", tenant, period, eid)

            # ── DEBIT (computed → debited): credit FIRST, never below zero, one tx ──
            if state == "computed":
                reason = f"commission_{period}"
                async with con.transaction():
                    if debited > 0:
                        await con.execute(
                            "insert into credit_ledger (tenant_id, delta_cents, reason, ref_event, detail) "
                            "values ($1,$2,$3,$4,$5) on conflict (tenant_id, reason) do nothing",
                            tenant, -debited, reason, eid, {"period": period, "gmv_cents": gmv})
                    # ADOPT whatever the ledger actually holds (a crash-rerun's earlier insert wins —
                    # the unique(tenant_id, reason) row IS the truth; no double-debit, structurally).
                    actual = await con.fetchval(
                        "select coalesce(-sum(delta_cents),0) from credit_ledger "
                        "where tenant_id=$1 and reason=$2", tenant, reason)
                    debited = int(actual or 0)
                    await con.execute(
                        "update billing_run set credit_debited_cents=$3, state='debited', "
                        "updated_at=now() where tenant_id=$1 and period=$2 and state='computed'",
                        tenant, period, debited)
                state = "debited"
                remainder = comm - debited
                await _refresh_period_fact(tenant, period, gmv, comm)
                balance = await credit_balance_cents(tenant)
                await _refresh_credit_fact(tenant, balance)

            # ── INVOICE (debited → invoiced): the remainder on the saved card, one tx ──
            if state == "debited":
                if remainder <= 0:
                    async with con.transaction():
                        await con.execute(
                            "update billing_run set invoiced_cents=0, state='invoiced', error=null, "
                            "updated_at=now() where tenant_id=$1 and period=$2 and state='debited'",
                            tenant, period)
                    return {**out, "state": "invoiced", "gmv_cents": gmv,
                            "commission_cents": comm, "credit_debited_cents": debited,
                            "invoiced_cents": 0}
                customer_id, is_test = await _stripe_customer_for(tenant)
                if not customer_id:
                    async with con.transaction():
                        await con.execute(
                            "update billing_run set error='no_card', last_attempt_at=now(), "
                            "updated_at=now() where tenant_id=$1 and period=$2", tenant, period)
                    log.warning("billing: %s %s owes %d cents but has NO saved card — parked at "
                                "'debited', retrying (backfill the customer, WP-7)",
                                tenant, period, remainder)
                    return {**out, "state": "debited", "error": "no_card",
                            "remainder_cents": remainder}
                boss = await _boss_scope(tenant)
                res = await _invoice_creator(tenant, period, remainder, customer_id, is_test, boss)
                if not res.get("ok"):
                    async with con.transaction():
                        await con.execute(
                            "update billing_run set error=$3, last_attempt_at=now(), "
                            "updated_at=now() where tenant_id=$1 and period=$2",
                            tenant, period, str(res.get("error") or "invoice_failed")[:200])
                    return {**out, "state": "debited", "error": res.get("error")}
                async with con.transaction():
                    await con.execute(
                        "update billing_run set invoiced_cents=$3, stripe_invoice_id=$4, "
                        "state='invoiced', error=null, last_attempt_at=now(), updated_at=now() "
                        "where tenant_id=$1 and period=$2 and state='debited'",
                        tenant, period, remainder, res.get("invoice_id"))
                return {**out, "state": "invoiced", "gmv_cents": gmv, "commission_cents": comm,
                        "credit_debited_cents": debited, "invoiced_cents": remainder,
                        "stripe_invoice_id": res.get("invoice_id")}
            return {**out, "state": state}
        finally:
            await con.execute("select pg_advisory_unlock(hashtext($1)::bigint)",
                              f"rocoto_billing:{tenant}")


async def run_meter_once(now: Optional[datetime] = None, *, force: bool = False) -> Dict[str, Any]:
    """One meter SCAN (the worker's 4th scan, precedent run_wake_once): every live tenant × every
    fully-elapsed unbilled Madrid month. Durable billing_run rows drive it — a box down on the 1st
    just catches up. Fail-soft per tenant/period; the scan itself never raises into the worker."""
    now = now or datetime.now(TZ)
    processed: List[Dict[str, Any]] = []
    try:
        async with db.get_pool().acquire() as con:
            tenants = await con.fetch(
                "select slug, golive_at from tenants "
                "where status='live' and golive_at is not null")
    except Exception:
        log.exception("billing: tenant scan failed")
        return {"processed": []}
    for t in tenants:
        for period in elapsed_periods(t["golive_at"], now):
            try:
                async with db.get_pool().acquire() as con:
                    done = await con.fetchval(
                        "select 1 from billing_run where tenant_id=$1 and period=$2 "
                        "and state='invoiced'", t["slug"], period)
                if done:
                    continue
                r = await process_run(t["slug"], period, force=force)
                if not r.get("skipped"):
                    processed.append(r)
            except Exception:
                log.exception("billing: run failed for %s %s — scan continues", t["slug"], period)
    if processed:
        log.info("billing: meter scan processed %d run(s): %s", len(processed),
                 [(p["tenant"], p["period"], p.get("state")) for p in processed])
    return {"processed": processed}


# ── the Stripe webhook → employment duty routing (the consumer stays /api/employment/event) ──
# The commission invoice carries metadata kind='rocoto_commission'; setupfee.handle_webhook routes
# its paid/failed events HERE, and this adapter feeds the SAME canonical duty events the
# /api/employment/event endpoint consumes (app._SALARY_KIND_EVENT) — the chase_salary manifest row
# does the rest (friendly dunning ladder; vital_stripe_spine proves the cascade).
_ETYPE_KIND = {
    "invoice.paid": "invoice_paid",
    "invoice.payment_succeeded": "invoice_paid",
    "invoice.payment_failed": "payment_failed",
}
_KIND_EVENT = {  # mirrors app._SALARY_KIND_EVENT (the endpoint remains the canonical consumer)
    "invoice_paid": "employment.invoice_paid",
    "payment_failed": "employment.salary_failed",
}


async def on_stripe_invoice_event(obj: Dict[str, Any], etype: str) -> Dict[str, Any]:
    """Route a commission-invoice webhook (metadata kind='rocoto_commission') into the employment
    duty sense — same event vocabulary, same dedupe shape as /api/employment/event."""
    md = obj.get("metadata") or {}
    if md.get("kind") != "rocoto_commission":
        return {"ignored": "not_commission"}
    kind = _ETYPE_KIND.get(etype)
    event = _KIND_EVENT.get(kind or "")
    if not event:
        return {"ignored": etype}
    invoice_key = md.get("invoice_key") or f"comm-{md.get('tenant', '')}-{md.get('period', '')}"
    scope = (md.get("tenant_scope") or "").strip() or await _boss_scope(md.get("tenant"))
    if not scope:
        return {"ignored": "no_scope"}
    amount = float(obj.get("total") or obj.get("amount_due") or 0) / 100.0
    import runtime
    res = await runtime.on_duty_sense(scope, event, {"invoice_key": invoice_key, "amount": amount},
                                      dedupe_key=f"emp:{invoice_key}:{kind}")
    return {"handled": etype, **res}


# ── the visibility read (dx F5 / plan §4) — every field an int with a default, Long-friendly ──
async def billing_summary(tenant: Optional[str] = None) -> Dict[str, Any]:
    """The billing card: credit balance · current-period GMV/commission (month to date, from
    snapshots) · what the next charge would be after credit · the last closed run. Fail-soft:
    any read hiccup degrades that figure to its 0 default — the endpoint never 500s the app."""
    tenant = (tenant or config.BRAIN_TENANT).strip().lower()
    now = datetime.now(TZ)
    period = period_of(now)
    out: Dict[str, Any] = {
        "tenant": tenant, "period": period, "credit_cents": 0,
        "period_gmv_cents": 0, "period_commission_cents": 0, "next_charge_cents": 0,
        "unsnapshotted": 0, "last_billed_period": "", "last_state": "",
        "last_gmv_cents": 0, "last_commission_cents": 0,
        "last_credit_debited_cents": 0, "last_invoiced_cents": 0,
    }
    try:
        out["credit_cents"] = await credit_balance_cents(tenant)
    except Exception:
        log.debug("billing: summary credit read fail-soft", exc_info=True)
    try:
        gmv, holes = await _period_gmv(tenant, period)
        comm = commission_cents(gmv)
        out.update({"period_gmv_cents": gmv, "period_commission_cents": comm,
                    "unsnapshotted": holes,
                    "next_charge_cents": max(0, comm - max(out["credit_cents"], 0))})
    except Exception:
        log.debug("billing: summary gmv read fail-soft", exc_info=True)
    try:
        async with db.get_pool().acquire() as con:
            last = await con.fetchrow(
                "select * from billing_run where tenant_id=$1 order by period desc limit 1", tenant)
        if last:
            out.update({"last_billed_period": last["period"], "last_state": last["state"],
                        "last_gmv_cents": int(last["gmv_cents"]),
                        "last_commission_cents": int(last["commission_cents"]),
                        "last_credit_debited_cents": int(last["credit_debited_cents"]),
                        "last_invoiced_cents": int(last["invoiced_cents"])})
    except Exception:
        log.debug("billing: summary run read fail-soft", exc_info=True)
    return out
