"""vital_term_split.py — the prepaid term and the monthly meter, on two subscriptions.

Peter, 2026-08-17: «Stripe should, in all cases, be charging the three months in one go… the metered
per order would be a monthly thing, whatever they've used for the month. If they're doing a
three-month plan, it'll charge them each month for whatever they've used. If they've done an annual,
it will also be metered each month.»

Those two facts cannot share one Stripe subscription — Stripe permits ONE billing interval per
subscription. So the TERM (seat fee + Compras + Reparto) is prepaid on a 3-month or yearly
subscription, and the METER (orders) rides its own monthly one, minted server-side after Checkout
against the card Checkout already saved. The customer does one checkout and pays once.

WHAT THIS PROVES, and every item is something that silently took money when it was wrong:

  1. THE TERM IS THREE MONTHS ON EVERY BAND. It was 0 on the seat bands from 2026-08-14 to
     2026-08-17, so /precios, the app and /terms.html §5 all promised a quarter while Stripe took a
     month. `mensual_charge_cents` must be exactly 3 × the quote, and `min_term_months` 3.

  2. ONE CADENCE PER SUBSCRIPTION. Every recurring price that can land on the TERM session —
     the band, Compras, Reparto — must share `(interval, interval_count)`. If they ever diverge,
     `Session.create` raises and EVERY checkout 503s. The metered orders price must stay month×1,
     because it rides the other subscription and «se facturan a mes vencido» is a promise on the
     page.

  3. THE METERED ITEM IS NOT ON THE SESSION. It is carried as `meta['usage_price']` instead. A
     session that still carried it would be un-creatable the moment the plan went to month×3.

  4. THE SCHEMA CAN HOLD THE SECOND ID. `create table if not exists` never adds a column to a table
     that already exists, so a missing ALTER means the webhook writes land nowhere.

  5. THE USAGE REPORTER FAILS CLOSED. A MeterEvent aggregates against whatever metered subscription
     ITEM the customer holds. With none, Stripe accepts the event, aggregates it to nothing, and the
     reporter marks the row `reported_at = now()` — the permanent exactly-once guard. That is money
     gone, silently, with the invoice merely looking smaller. It must report nothing and settle
     nothing when there is no usage subscription.

  6. ANNUAL IS SELLABLE AGAIN. The `anual_not_sellable` guard existed for exactly one reason — a
     metered item cannot ride a yearly subscription — and the split removes that reason.

Checks the existing implementation and its backend-owned catalogue. This preserves current
billing behavior; current commercial intent is maintained separately in Rocoto-Labs/company.
Reads local code and data only; touches no Stripe account and needs no network.
Usage:  python tests/vital_term_split.py
"""
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

BACKEND = Path(__file__).resolve().parent.parent

fails: list[str] = []


def check(ok: bool, label: str, detail: str = "") -> None:
    print(f"  {'ok  ' if ok else 'FAIL'}  {label}")
    if not ok:
        fails.append(f"{label}{(' — ' + detail) if detail else ''}")
        if detail:
            print(f"        {detail}")


# ── 1 · the term ────────────────────────────────────────────────────────────────────────────────
from brain import pricing_quote as _quote  # noqa: E402
from brain.pedidos_billing import (  # noqa: E402
    BANDS,
    BUNDLE_SIZES,
    MIN_TERM_MONTHS,
    SELLABLE_BANDS,
)

print("1 · the term is three months on every band")
check(MIN_TERM_MONTHS == 3, "MIN_TERM_MONTHS is 3", f"got {MIN_TERM_MONTHS}")
for band in SELLABLE_BANDS:
    b = BANDS[band]
    term = int(b.get("min_term_months") or 0)
    check(term == MIN_TERM_MONTHS, f"{band}: min_term_months == {MIN_TERM_MONTHS}", f"got {term}")
    want = int(b["mensual_cents"]) * MIN_TERM_MONTHS
    got = int(b["mensual_charge_cents"])
    check(got == want, f"{band}: charge is {MIN_TERM_MONTHS} × the quote",
          f"quote {b['mensual_cents']}c → want {want}c, got {got}c")
    # the annual price is already a whole year in one payment and must NOT be multiplied again
    check(int(b["anual_charge_cents"]) == int(b["anual_cents"]),
          f"{band}: annual charge is the annual price, unmultiplied")

# ── 2 · one cadence per subscription ────────────────────────────────────────────────────────────
print("\n2 · every recurring price on the term session shares one cadence")
import importlib.util as _u  # noqa: E402

_spec = _u.spec_from_file_location("_prov", BACKEND / "scripts" / "provision_stripe_v2.py")
assert _spec and _spec.loader
_prov = _u.module_from_spec(_spec)
_spec.loader.exec_module(_prov)
pricing = _prov._pricing()
rows = _prov._want_rows(pricing)
by_key = {r["lookup_key"]: r for r in rows}

# A recovered catalogue must agree with the running backend's supported plans and bundle sizes.
check(tuple(plan["code"].lower() for plan in pricing["plans"]) == SELLABLE_BANDS,
      "the catalogue and backend expose the same existing bands")
for plan in pricing["plans"]:
    band = plan["code"].lower()
    current = BANDS[band]
    for source_field, runtime_field, multiplier in (
        ("base", "mensual_cents", 100), ("anual", "anual_cents", 100),
        ("compras", "compras_cents", 100), ("per_order_cents", "per_order_cents", 1),
    ):
        check(plan[source_field] * multiplier == current[runtime_field],
              f"{band}: catalogue {source_field} matches backend {runtime_field}")
    check(plan["seats"] == current["seats"] and plan["sellable"] == current["sellable"],
          f"{band}: catalogue seats and sellability match the backend")
check(tuple(row["qty"] for row in pricing["bundles"]["rows"]) == BUNDLE_SIZES,
      "catalogue bundle sizes match the backend")
check(BUNDLE_SIZES == _quote.BUNDLES and
      pricing["bundles"]["discount_pct"] == _quote.BUNDLE_DISCOUNT_PCT,
      "catalogue bundle quantities and discount match the quote calculation")
for field, value, multiplier in (
    ("reparto_van", _quote.REPARTO_VAN_CENTS, 100),
    ("radar_pct", _quote.RADAR_PCT, 1),
    ("integracion_day", _quote.INTEGRACION_DAY_CENTS, 100),
):
    check(pricing["rates"][field] * multiplier == value,
          f"catalogue {field} matches the existing quote calculation")
check(pricing["live"] == _quote.LIVE and
      pricing["routing"]["sales_orders_over"] == _quote.SALES_ORDERS_OVER,
      "catalogue calculation flags and sales threshold match the quote module")
check(12 - pricing["billing"]["anual_free_months"] == _prov._anual_months(),
      "catalogue annual multiplier matches the existing backend")

# Exercise the second consumer's real data loader without invoking either provider CLI.
_repricing_spec = _u.spec_from_file_location("_reprice", BACKEND / "scripts/reprice_stripe_pedidos.py")
assert _repricing_spec and _repricing_spec.loader
_reprice = _u.module_from_spec(_repricing_spec)
_repricing_spec.loader.exec_module(_reprice)
for _, _, amount, interval, count, key in _reprice._plan_rows():
    target = by_key.get(key)
    check(target is not None and (amount, interval, count) ==
          (target["amount"], target["interval"], target["interval_count"]),
          f"{key}: provisioning and repricing agree on the term price")

term_cadences = set()
for band in SELLABLE_BANDS:
    for key in (f"pedidos_{band}_mensual", f"compras_{band}_mensual"):
        r = by_key.get(key)
        if not r:
            check(False, f"{key} exists in the intended catalogue")
            continue
        term_cadences.add((r["interval"], int(r["interval_count"])))
r = by_key.get("reparto_van_mensual")
if r:
    term_cadences.add((r["interval"], int(r["interval_count"])))
else:
    check(False, "reparto_van_mensual exists in the intended catalogue")

check(len(term_cadences) == 1,
      "band + Compras + Reparto share exactly one (interval, interval_count)",
      f"found {sorted(term_cadences)} — Stripe refuses a session mixing these")
check(term_cadences == {("month", MIN_TERM_MONTHS)},
      f"that cadence is month × {MIN_TERM_MONTHS}", f"found {sorted(term_cadences)}")

for band in SELLABLE_BANDS:
    r = by_key.get(f"pedidos_{band}_orders")
    if not r:
        check(False, f"pedidos_{band}_orders exists")
        continue
    check(r["interval"] == "month" and int(r["interval_count"]) == 1,
          f"{band}: the metered orders price stays month × 1",
          f"got {r['interval']} × {r['interval_count']} — «a mes vencido» is on the page")
    check(bool(r.get("meter")), f"{band}: the orders price is metered")

# the module prices must be the per-month figure × the term, or the page and the bill disagree
for band in SELLABLE_BANDS:
    r = by_key.get(f"compras_{band}_mensual")
    if r:
        want = int(BANDS[band]["compras_cents"]) * MIN_TERM_MONTHS
        check(int(r["amount"]) == want, f"{band}: Compras is {MIN_TERM_MONTHS} × its monthly figure",
              f"want {want}c, got {r['amount']}c")

# ── 3 · the metered item is off the session ─────────────────────────────────────────────────────
print("\n3 · the metered item rides metadata, not the checkout session")
src = (BACKEND / "brain" / "pedidos_billing.py").read_text()
check('meta["usage_price"] = orders_id' in src,
      "the resolved metered price id is put on the session metadata")
check(not re.search(r'line_items\.append\(\{"price": orders_id', src),
      "the metered price is NOT appended to line_items",
      "a session carrying it is un-creatable once the plan is month × 3")
check("_ensure_usage_subscription" in src, "the usage-subscription minter exists")
check("idempotency_key" in src,
      "the mint is idempotent",
      "a redelivered checkout.session.completed would otherwise meter the customer twice per order")

# ── 4 · the schema can hold the second id ───────────────────────────────────────────────────────
print("\n4 · the schema carries the usage subscription")
schema = (BACKEND / "schema_runtime.sql").read_text()
check("add column if not exists stripe_usage_subscription_id" in schema,
      "an explicit ALTER adds stripe_usage_subscription_id",
      "`create table if not exists` never adds a column to an existing table")
check("pedidos_subscription_usage_sub_idx" in schema,
      "the second id is indexed")
check(src.count("stripe_usage_subscription_id=$1") >= 4,
      "every webhook lookup matches EITHER subscription",
      f"found {src.count('stripe_usage_subscription_id=$1')} — a usage invoice would be invisible")

# ── 5 · the reporter fails closed ───────────────────────────────────────────────────────────────
print("\n5 · the usage reporter refuses to settle what it cannot bill")
rep = (BACKEND / "brain" / "pedidos_usage_report.py").read_text()
check("no_usage_subscription" in rep,
      "there is a no_usage_subscription branch")
i_guard = rep.find("no_usage_subscription")
i_meter = rep.find("MeterEvent.create")
check(0 < i_guard < i_meter,
      "the guard returns BEFORE any MeterEvent is sent",
      "reporting first would settle rows against a meter nothing reads")
check("stripe_usage_subscription_id" in rep,
      "the reporter reads the usage subscription id")

# ── 6 · annual is sellable ──────────────────────────────────────────────────────────────────────
print("\n6 · annual is sellable again")
check('"reason": "anual_not_sellable"' not in src,
      "the anual_not_sellable guard is gone",
      "its only reason was a metered item on a yearly subscription")
for band in SELLABLE_BANDS:
    r = by_key.get(f"pedidos_{band}_anual")
    check(bool(r) and r["interval"] == "year" and int(r["interval_count"]) == 1,
          f"{band}: an annual price exists at year × 1")

print()
if fails:
    print(f"❌ vital_term_split: {len(fails)} failure(s)")
    for f in fails:
        print(f"   · {f}")
    sys.exit(1)
print("✅ vital_term_split: the term is prepaid, the meter is monthly, and nothing settles blind")
