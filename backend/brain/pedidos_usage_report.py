"""Rocoto Pedidos — THE USAGE REPORTER: what turns a counted order into a billed one.

«Los pedidos se facturan a mes vencido» — the page, and the per-order rate it publishes (0,60 /
0,50 / 0,40 € by band) is the second half of every seat-band quote. STRIPE-V2-PLAN.md §3c is the
runbook this implements.

WHAT WAS MISSING, AND WHY IT MATTERED (built 2026-08-15). `pedidos_meter.py` already counted every
order exactly once, forever — a UNIQUE `(tenant_id, order_id)` row in `pedidos_order_usage`, written
by `record_order()` on the direct paths and by `reconcile()` for the six call sites that module does
not own. That table is the right thing to bill from and no second counter should ever be invented.
But NOTHING read it into Stripe: `stripe.billing.MeterEvent` was named in the catalogue script, in
the runbook and in the plan, and called from nowhere. Every seat-band tenant would have paid their
seat fee and nothing at all for their orders, while the meter ticked correctly all month.

THE FOUR OUTCOMES, ONE PER ORDER, ALL RECORDED IN `billed_via` — every order lands in exactly one:

  · `included:<founder>`   the pinned price ALREADY covers their orders. Carlos's 1.347 €/trimestre
                           includes 15.000 pedidos (Peter, 2026-08-14: «my first customer will get an
                           order quantity bundle so they prepay it all rather than go on metered»), so
                           reporting usage for him would charge a NAMED customer twice for the same
                           orders. This is the case the whole `orders_billing` marker exists for.
  · `bundle:<price_id>`    drawn off a live prepaid bag. No Stripe call at all — the money was taken
                           when the bag was bought. Metering resumes on the first order after the bag
                           is exhausted or expires, at the plan's own published rate («a bundle is a
                           discount for paying up front, never a lower rate for that customer»).
  · `metered`              reported to the `rocoto_pedido` meter at the band's rate. The default, and
                           deliberately what an unrecognised marker falls back to: billing what the
                           page quoted is the safe failure, silently billing zero is not.
  · `stale`                older than Stripe's 35-day timestamp window. Never billed, always logged
                           LOUDLY. Under-billing is the safe direction; revenue reported at a wrong
                           date is a bill the customer can disprove.

TWO INDEPENDENT EXACTLY-ONCE GUARDS, AND BOTH ARE NEEDED. The MeterEvent `identifier`
(`ped_<tenant>_<order>`) is deduped by Stripe for a rolling ~24 h only; `reported_at` in our own
table is the permanent one. So the order of operations is REPORT FIRST, MARK SECOND: a crash between
the two re-reports the order and Stripe's identifier absorbs it, whereas marking first would drop
revenue silently. That asymmetry is the whole reason the sequence is written this way.

⚠️ `.get()` ON A STRIPE OBJECT RAISES AttributeError on SDK 15.x. Every read of a Stripe value here
goes through `_sv` / `_sv_dict` from brain/pedidos_billing.py, same as the rest of the money path.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import config
import db
from brain import founder_prices
from brain.pedidos_billing import (
    ORDERS_METER_EVENT,
    _stripe,
    _stripe_mode_is_test,
    _sv,
    _sv_dict,
    _sv_id,
    enabled,
)

log = logging.getLogger("rocoto.pedidos_usage_report")

# Stripe refuses a MeterEvent timestamp older than 35 calendar days. 34 is the line this module
# holds, so an order sitting exactly on the boundary while the pass runs is never reported into a
# rejection — the loss would be silent, and the API error would arrive per-order for the rest of the
# backlog behind it.
MAX_AGE_DAYS = 34

# Rows settled per tenant per pass. A backlog drains over several ticks rather than holding one
# tenant's loop open for thousands of sequential HTTP calls — the meter's own row is exactly-once
# either way, so a partial pass is always safe to resume.
BATCH = 400

REPORT_INTERVAL_SEC = 300      # five minutes; the bill is monthly, nothing here is latency-sensitive

BILLED_METERED = "metered"
BILLED_STALE = "stale"


def _iso(v: Any) -> Optional[datetime]:
    """A metadata timestamp back into an aware datetime, or None. Stripe metadata is all strings, and
    a value written by a human in the dashboard is exactly as likely as one written by the webhook."""
    s = str(v or "").strip()
    if not s:
        return None
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _int(v: Any) -> int:
    try:
        return int(str(v or "0").strip() or 0)
    except ValueError:
        return 0


def _has_metered_item(sub_obj) -> bool:
    """True when this subscription holds at least one METERED item — a per-order price sitting there
    waiting for usage. Used only to detect a subscription that CONTRADICTS its own
    `orders_billing=included` marker; see the guard in `report_tenant`.

    ⚠️ `sub_obj["items"]`, NEVER `sub_obj.items`. On a StripeObject the attribute of that name
    resolves to the dict method, so `sub_obj.items` comes back as a bound method: truthy, iterable of
    nothing useful, and a guard written that way answers the same thing for every subscription alive.
    Indexing is the only safe read — the standing `_sv` rule at the top of this file, with a name
    that makes the mistake especially easy.

    UNREADABLE → False, deliberately. This function exists to raise a hand about a contradiction; if
    the object cannot be read there is no contradiction to see, and the marker stands on its own
    exactly as it did before this guard existed."""
    data = _sv(_sv(sub_obj, "items"), "data") or []
    for it in data:
        rec = _sv(_sv(it, "price"), "recurring")
        if (_sv(rec, "usage_type") or "") == founder_prices.USAGE_METERED:
            return True
    return False


async def _mark(con, tenant_id: str, order_id: str, billed_via: str) -> None:
    """Settle one row. `reported_at is null` in the predicate keeps two overlapping passes from
    rewriting a settled row's answer — the first one to land owns it."""
    await con.execute(
        "update pedidos_order_usage set reported_at = now(), billed_via = $3 "
        "where tenant_id = $1 and order_id = $2 and reported_at is null",
        tenant_id, order_id, billed_via)


async def _mark_all(con, tenant_id: str, billed_via: str) -> int:
    """Settle every unreported row for a tenant in one statement — the founder path, where the answer
    is the same for every order and no Stripe call is involved."""
    rows = await con.fetch(
        "update pedidos_order_usage set reported_at = now(), billed_via = $2 "
        "where tenant_id = $1 and reported_at is null returning order_id", tenant_id, billed_via)
    return len(rows)


async def report_tenant(tenant_id: str, dry_run: bool = False) -> Dict[str, Any]:
    """Settle one tenant's unreported orders. Returns a per-outcome tally, never raises.

    Reads the subscription's Stripe metadata ONCE per pass: `orders_billing` and the prepaid-bundle
    balance are both facts about the subscription, and re-reading them per order would be one HTTP
    call per pedido to answer a question that cannot change mid-pass."""
    out: Dict[str, Any] = {"tenant_id": tenant_id, "metered": 0, "bundle": 0, "included": 0,
                           "stale": 0, "skipped": ""}
    pool = db.get_pool()
    async with pool.acquire() as con:
        sub = await con.fetchrow(
            "select stripe_subscription_id, stripe_usage_subscription_id, stripe_customer_id "
            "from pedidos_subscription where tenant_id = $1", tenant_id)
        pending = await con.fetchval(
            "select count(*) from pedidos_order_usage where tenant_id = $1 and reported_at is null",
            tenant_id)
    if not int(pending or 0):
        out["skipped"] = "nothing_pending"
        return out
    sub_id = (sub or {}).get("stripe_subscription_id") or ""
    cust_id = (sub or {}).get("stripe_customer_id") or ""
    if not sub_id:
        # No Stripe subscription to bill against. Left UNREPORTED on purpose: the rows keep their
        # null and are settled the moment one exists, rather than being written off as a decision
        # this module was never asked to make.
        out["skipped"] = "no_subscription"
        return out

    # ⚠️ AND THE METER MUST HAVE SOMETHING TO BILL AGAINST — the fail-closed hole this module used
    # to have (2026-08-17).
    #
    # A MeterEvent is aggregated against whatever metered subscription ITEM the customer holds. If
    # none exists, Stripe accepts the event, aggregates it to nothing, and `_mark` then writes
    # `reported_at = now()` — the permanent exactly-once guard. Every one of those orders is money
    # gone, silently and unrecoverably, and the invoice simply looks smaller.
    #
    # It was safe by accident while the metered item rode the one subscription every payer had. Now
    # the meter lives on its own monthly subscription, minted AFTER the term is paid, and that mint
    # can fail. The checkout builder already refuses a sale when the metered PRICE is missing,
    # before money moves; this is the same posture after it has moved — report nothing, settle
    # nothing, and answer with a reason, exactly like `no_subscription` and `included_but_metered`
    # above. An absent meter then costs a retry rather than a month of orders.
    usage_sub_id = (sub or {}).get("stripe_usage_subscription_id") or ""
    if not usage_sub_id:
        out["skipped"] = "no_usage_subscription"
        log.error("pedidos usage: %s has %d order(s) to meter and NO usage subscription — nothing "
                  "reported, nothing settled; rows wait for one to exist", tenant_id, int(pending))
        return out

    is_test = _stripe_mode_is_test()
    if not enabled(is_test):
        out["skipped"] = "stripe_not_configured"
        return out
    st = _stripe(is_test)
    try:
        sub_obj = await asyncio.to_thread(lambda: st.Subscription.retrieve(sub_id))
    except Exception:  # noqa: BLE001
        log.exception("pedidos usage: subscription retrieve failed for %s (%s)", tenant_id, sub_id)
        out["skipped"] = "subscription_unreadable"
        return out
    meta = _sv_dict(sub_obj, "metadata") or {}
    # `_sv_id`, not str(): a Stripe link field comes back as an id OR as an expanded object, and the
    # meter maps usage to a customer BY ID — a stringified object would be reported as a nonsense
    # customer and silently aggregate against nobody.
    cust_id = cust_id or _sv_id(_sv_dict(sub_obj, "customer"))

    # ── the founder / prepaid-price case ──────────────────────────────────────────────────────────
    # A POSITIVE MARKER, never the absence of a key. `orders_billing='included'` is written by
    # `create_checkout_session` and by the pinned price's own Stripe metadata; anything else — a
    # missing key, an unknown value, an ordinary customer's subscription — is billed at the published
    # rate. The inverse test («no metered key means founder») would have suppressed billing for every
    # normal tenant on the platform, since a normal subscription carries no such key at all.
    orders_billing = str(meta.get(founder_prices.ORDERS_BILLING_KEY) or "").strip().lower()
    if orders_billing == founder_prices.ORDERS_BILLING_INCLUDED:
        who = str(meta.get("founder") or "prepaid")
        # ── THE SUBSCRIPTION ITSELF GETS A VOTE, AND A CONTRADICTION IS NOT DECIDED HERE ──────────
        # `included` says «somebody already paid for these orders, do not bill them». A METERED ITEM
        # on the same subscription says the exact opposite: Stripe is holding a per-order price open,
        # waiting for usage that will never arrive. Both cannot be true, and this module cannot know
        # which one is — so it does neither and says so, loudly. Writing the orders off would give
        # away every pedido of a customer who is not prepaid at all; reporting them would charge a
        # prepaid customer twice for orders they have already bought, which is the exact failure the
        # `included` marker was built to prevent. The rows keep their `reported_at` NULL and settle
        # the moment a human fixes the object — the same posture as `no_subscription` above, and for
        # the same reason: it is a decision nobody asked this module to make.
        #
        # THIS BECAME REACHABLE ON 2026-08-15, when a founder's glide path first had a metered period.
        # Carlos's quarter is `included`; his months 4–12 are `metered` at his locked 0,25 €, and the
        # move between them is MANUAL (STRIPE-V2-PLAN.md §6b, step 4b) — three line items swapped on
        # the subscription he already has, plus a metadata edit. The metadata edit is the one a human
        # forgets, and forgetting it leaves exactly this contradiction: the year-1 items attached, the
        # quarter's marker still sitting on the object. Nothing else can produce it —
        # `create_checkout_session` never attaches a metered item to an `included` sale — so this is
        # always a hand-edit half-finished, and a hand-edit is finished by hand.
        if _has_metered_item(sub_obj):
            log.error("pedidos usage: %s carries orders_billing='included' AND a metered "
                      "subscription item. The marker says these orders are paid for and the "
                      "subscription says they are not; %s order(s) left unreported until one of the "
                      "two is corrected (STRIPE-V2-PLAN.md §6b step 4b).", tenant_id, int(pending or 0))
            out["skipped"] = "included_but_metered"
            return out
        if dry_run:
            out["included"] = int(pending or 0)
            return out
        async with pool.acquire() as con:
            out["included"] = await _mark_all(con, tenant_id, f"included:{who}")
        return out

    # ── the prepaid bundle (STRIPE-V2-PLAN.md §5) ─────────────────────────────────────────────────
    # The balance is derived, never stored: how many orders have already been drawn is a count of the
    # rows that say so. That is what makes a re-run safe and what keeps Stripe the one place the bag
    # itself is recorded.
    now = datetime.now(timezone.utc)
    prepaid_total = _int(meta.get("orders_prepaid"))
    prepaid_start = _iso(meta.get("orders_prepaid_start"))
    prepaid_expires = _iso(meta.get("orders_prepaid_expires"))
    prepaid_source = str(meta.get("orders_prepaid_source") or "bundle")
    bundle_live = bool(prepaid_total > 0 and prepaid_start and prepaid_expires
                       and now < prepaid_expires)
    drawn = 0
    if bundle_live:
        async with pool.acquire() as con:
            drawn = int(await con.fetchval(
                "select count(*) from pedidos_order_usage where tenant_id = $1 "
                "and billed_via like 'bundle:%' and counted_at >= $2", tenant_id, prepaid_start) or 0)

    async with pool.acquire() as con:
        rows = await con.fetch(
            "select order_id, counted_at from pedidos_order_usage "
            "where tenant_id = $1 and reported_at is null order by counted_at asc limit $2",
            tenant_id, BATCH)

    cutoff = now - timedelta(days=MAX_AGE_DAYS)
    for r in rows:
        order_id, counted_at = r["order_id"], r["counted_at"]
        if counted_at.tzinfo is None:
            counted_at = counted_at.replace(tzinfo=timezone.utc)

        if bundle_live and drawn < prepaid_total:
            drawn += 1
            out["bundle"] += 1
            if not dry_run:
                async with pool.acquire() as con:
                    await _mark(con, tenant_id, order_id, f"bundle:{prepaid_source}")
            # The bag emptying mid-pass is the normal way it ends: from the next order on, this
            # tenant is metered again at their plan's own published rate. Nothing is written to
            # Stripe to make that happen — a metered item with no reported usage bills zero, so the
            # resume costs no API call and the rate never changed in the first place.
            bundle_live = drawn < prepaid_total
            continue

        if counted_at < cutoff:
            log.error("pedidos usage: order %s/%s counted %s is past Stripe's %s-day window — "
                      "NOT billed (marked stale). Revenue lost rather than mis-dated; if this is not "
                      "a one-off the reporter has been down and needs looking at.",
                      tenant_id, order_id, counted_at.isoformat(), MAX_AGE_DAYS)
            out["stale"] += 1
            if not dry_run:
                async with pool.acquire() as con:
                    await _mark(con, tenant_id, order_id, BILLED_STALE)
            continue

        if not cust_id:
            # The meter maps usage to a customer by id; without one there is nothing to report
            # against. Leave the rows unsettled so they bill once the customer id is on the row.
            out["skipped"] = "no_customer"
            break

        if dry_run:
            out["metered"] += 1
            continue

        # REPORT FIRST, MARK SECOND — see the module docstring. A failure here stops this tenant's
        # pass rather than skipping the row: the backlog is ordered and the next tick resumes from
        # the same place, whereas continuing would report later orders before earlier ones and hide
        # a persistent failure behind a growing tail of successes.
        try:
            await asyncio.to_thread(lambda: st.billing.MeterEvent.create(
                event_name=ORDERS_METER_EVENT,
                payload={"stripe_customer_id": cust_id, "value": "1"},
                identifier=f"ped_{tenant_id}_{order_id}"[:200],
                timestamp=int(counted_at.timestamp()),
            ))
        except Exception:  # noqa: BLE001
            log.exception("pedidos usage: MeterEvent failed for %s/%s — stopping this tenant's pass, "
                          "row stays unreported and the next tick retries it", tenant_id, order_id)
            out["skipped"] = "meter_event_failed"
            break
        async with pool.acquire() as con:
            await _mark(con, tenant_id, order_id, BILLED_METERED)
        out["metered"] += 1

    return out


async def report_all(dry_run: bool = False) -> Dict[str, Any]:
    """One pass over every tenant with a live Pedidos subscription. Fail-soft per tenant — one bad
    tenant never blocks the others, which is the same posture pedidos_meter.reconcile_all() takes."""
    totals: Dict[str, Any] = {"tenants": 0, "metered": 0, "bundle": 0, "included": 0, "stale": 0}
    # A MeterEvent is a Stripe WRITE against a real customer. Every vital runs with
    # ROCOTO_EGRESS_SANDBOX=1 precisely so a test run cannot touch a real rail; without this guard
    # run_all_vitals.sh would report usage against live subscriptions.
    if getattr(config, "EGRESS_SANDBOX", False):
        totals["skipped"] = "egress_sandbox"
        return totals
    if not getattr(config, "PEDIDOS_USAGE_REPORT_ENABLED", True):
        # A kill switch that needs no deploy — set PEDIDOS_USAGE_REPORT_ENABLED=0 and the loop keeps
        # running as a no-op, with the meter still counting, so nothing is lost while it is off.
        totals["skipped"] = "disabled"
        return totals
    pool = db.get_pool()
    async with pool.acquire() as con:
        tenants = await con.fetch(
            "select tenant_id from pedidos_subscription where status in ('active','past_due')")
    for r in tenants:
        tid = r["tenant_id"]
        try:
            got = await report_tenant(tid, dry_run=dry_run)
        except Exception:  # noqa: BLE001
            log.exception("pedidos usage: pass failed for %s", tid)
            continue
        totals["tenants"] += 1
        for k in ("metered", "bundle", "included", "stale"):
            totals[k] += int(got.get(k) or 0)
    if totals["metered"] or totals["stale"]:
        log.info("pedidos usage: reported %s, bundle %s, included %s, stale %s across %s tenant(s)",
                 totals["metered"], totals["bundle"], totals["included"], totals["stale"],
                 totals["tenants"])
    return totals


async def report_loop(interval_sec: int = REPORT_INTERVAL_SEC) -> None:
    """Boot-started background loop (app.py's startup event), beside pedidos_meter.reconcile_loop().
    Never exits; one bad sweep just waits for the next tick."""
    while True:
        try:
            await report_all()
        except Exception:  # noqa: BLE001
            log.exception("pedidos usage: sweep failed")
        await asyncio.sleep(interval_sec)


async def _main() -> int:
    """`python3 -m brain.pedidos_usage_report [--once] [--dry-run] [--tenant SLUG]` — the same pass
    the loop runs, on demand, for the hour after a deploy when somebody wants to watch it settle a
    real backlog. `--dry-run` reads everything and writes nothing, to Stripe or to the database."""
    import argparse
    ap = argparse.ArgumentParser(description="Report Rocoto Pedidos order usage to Stripe.")
    ap.add_argument("--once", action="store_true", help="one pass, then exit (the default)")
    ap.add_argument("--dry-run", action="store_true", help="report what WOULD be settled, write nothing")
    ap.add_argument("--tenant", default="", help="restrict the pass to one tenant slug")
    args = ap.parse_args()
    await db.init()
    if args.tenant:
        got = await report_tenant(args.tenant, dry_run=args.dry_run)
    else:
        got = await report_all(dry_run=args.dry_run)
    print(got)
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(_main()))
