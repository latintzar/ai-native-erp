#!/usr/bin/env python3
"""Build the Stripe catalogue for the SEAT-BAND model — Ventas · Compras · Reparto · Radar ·
prepaid order bundles · pinned founder prices. Plan first, write only on `--yes`.

This operator tool preserves the existing billing implementation. The historical notes below
describe the August 2026 rollout, including superseded public-pricing and cadence claims.
backend/pricing.json supplies its preserved catalogue input. Current commercial intent lives in
Rocoto-Labs/company/decisions/2026-08-31-two-week-trial-commercial-model.md; publication readiness
is recorded in docs/ENGINEERING-READINESS.md. A dry run contacts Stripe; offline tests call the
catalogue-building functions directly.

Peter, 2026-08-14, after a full day on it: «i spent all day figuring out this pricing.» The model the
old catalogue was built for is gone. OUT: one plan whose price bought a monthly ORDER CEILING. IN: a
seat band you pay for, plus a published price per order, plus modules you turn on. Nothing caps how
many orders enter, and «los pedidos se facturan a mes vencido».

WHAT THIS SCRIPT IS. It is the create-only twin of scripts/provision_stripe_pedidos.py, for the new
model: keyed on stable `lookup_key`s, safe to re-run, and it NEVER mutates a price — a Stripe Price
is immutable, so a live price that disagrees with the plan is REPORTED as drift and left alone.
Changing an amount is a separate, deliberate act and it lives in scripts/reprice_stripe_pedidos.py.

IT ARCHIVES IN EXACTLY TWO PLACES, and both are narrow:
  · `--archive-retired`, opt-in, for the ceiling-model prices nobody can buy any more. A tidy-up.
  · `_supersede_bundles`, which runs with the bolsa group, for the three band-agnostic
    `pedidos_bundle_{qty}` prices THIS SCRIPT ITSELF replaced with `pedidos_bundle_{band}_{qty}` on
    2026-08-15. That one is not a tidy-up: those prices are live, sellable, sit in a namespace the
    new keys look like siblings of, and quote an amount no surface offers any more. Leaving one
    reachable is how a customer eventually pays 2.250 € for the bag /precios prices at 2.700 €.
Neither ever touches the `founder_` namespace, which is asserted at every write rather than
remembered.

EXISTING SUBSCRIPTIONS ARE NEVER TOUCHED, by any path in this file. A tenant billing on a ceiling
band keeps billing on it, at the amount they bought, whether or not that price is archived —
archiving a Stripe price hides it from pickers and stops new sales; it does not reprice or cancel
anything already running. The run prints that fact every time.

    python3 scripts/provision_stripe_v2.py --mode test --dry-run     # the default posture
    python3 scripts/provision_stripe_v2.py --mode test --yes
    python3 scripts/provision_stripe_v2.py --mode live --dry-run     # ⚠️ read-only, real data
    python3 scripts/provision_stripe_v2.py --mode live --yes         # ⚠️ writes to live Stripe

Reads STRIPE_SECRET_KEY (--mode live) or STRIPE_SECRET_KEY_TEST (--mode test) from the environment.
Never prints a key — object ids, the figures already published on /precios, and nothing else.

────────────────────────────── THE SIX PIECES, AND THE SHAPE EACH ONE TAKES ──────────────────────────────

1. VENTAS — the seat band. A plain recurring licensed price, quantity 1: 199 / 499 / 1.499 € a month,
   or ten months' worth once a year («Pago anual: dos meses gratis»). `interval_count` comes from the
   band's own `min_term_months`, which is 0 for these — their page says «Sin permanencia», so the
   cadence is one month and the charge is the quote. (The ceiling bands sold a three-month
   commitment and are charged 3× every 3 months; that is why the field exists rather than a constant.)

2. PER-ORDER — a METERED price at the band's published rate, `recurring.usage_type='metered'`, billed
   in arrears at the end of each month. Metered prices need a Billing Meter to aggregate against
   (stripe.UsageRecord was removed from the SDK; usage is reported with billing.MeterEvent), so this
   script creates ONE meter, `rocoto_pedido`, summing a `value` payload and mapping to the customer by
   id. See STRIPE-V2-PLAN.md §4 for the reporting wiring — `pedidos_order_usage` already holds an
   exactly-once row per order, and that table is what feeds the meter.

   ⚠️ ONE SUBSCRIPTION, ONE INTERVAL. Stripe requires every recurring item on a subscription to share
   an interval, so the monthly metered item can ride alongside the MENSUAL seat price but not the
   ANUAL one. An annual tenant's orders go on a second, monthly subscription. Same price object either
   way; the split is a subscription-shape fact, not a catalogue one.

3. PREPAID BOLSAS — one-off prices, NINE of them: three sizes × three bands. Each carries its order
   quantity in metadata and is drawn down as orders land. A tenant holding a live bolsa is NOT
   metered; metering resumes when it is exhausted or expires at 12 months. THE FIRST REAL CUSTOMER
   TAKES THIS ROUTE, so it is the one that has to be right on day one (Peter: «my first customer will
   get an order quantity bundle so they prepay it all rather than go on metered»).

   THERE ARE NINE BECAUSE THE BOLSA IS A PERCENTAGE OFF THE BAND'S OWN RATE — 2026-08-15, Peter: «we
   can give a promotional thing in the checkout or in the configurator that says, Pre-pay a certain
   number of orders at a 10% discount». It used to be three band-agnostic prices at three fixed
   rates (0,45 / 0,42 / 0,40 €, at 2.250 / 4.200 / 10.000 €), and that broke two things at once.
     (a) A Grande customer already buys pedidos at 0,40 €, so the 5.000 bolsa charged them 12 % MORE
         than being metered while /precios printed «−12 % más barato que tu tarifa» over the same
         button — the biggest customers sold the worst deal, and told the opposite.
     (b) It flattened the ladder. Peter, same day: «a bigger company pays less per order because we
         know that they have more orders […] they can then get a bigger plan, but then their base
         would be bigger, so it's just those tradeoffs». A fixed 0,45 € bolsa handed a Pequeño
         customer a near-Grande rate without moving band — what the ladder exists to sell.
   So the key is `pedidos_bundle_{band}_{qty}` and the amount is derived per band: 5.000 pedidos is
   2.700 € on Pequeño, 2.250 € on Mediano, 1.800 € on Grande. The old fixed 2.250 € was Mediano's
   own 10 % figure all along, which is where it came from.

   AND THE THREE BAND-AGNOSTIC PRICES ARE ARCHIVED, in the same run that creates their replacements
   — see `_supersede_bundles`. They quote a figure no surface offers any more, and a live price
   nothing references is how somebody eventually gets charged it.

4. COMPRAS — «la mitad de tu plan», one price per band per cadence. REPARTO — 39 €/furgoneta/mes, a
   LICENSED price whose quantity is the number of vans, so adding a van is a quantity change rather
   than a new price.

5. RADAR — «+15 % sobre tu factura», and a percentage is not a Price object. The standard Stripe shape
   for a percentage surcharge on a variable bill is an INVOICE ITEM added to the draft invoice before
   it finalises: subscribe to `invoice.created`, read the draft's own lines, take 15 % of them, and
   `InvoiceItem.create` against that invoice. It is then always exactly 15 % of what they actually
   had that month, which is the promise the page makes — «Se activa una vez y cubre todos los módulos
   que tengas contratados. Si un mes vendes poco, cuesta poco.» So Radar gets a PRODUCT here (so the
   line has a stable identity in Stripe's reporting) and no price at all. STRIPE-V2-PLAN.md §5 is the
   handler, including its three guards: idempotent per invoice, skipped when Radar is off, and
   excluded from its own base.

6. FOUNDER PRICES — the `founder_` namespace, from brain/founder_prices.py. Created here and NEVER
   modified or archived here, so a public reprice can never reach a quote a human already gave. The
   fence is asserted at every write, not remembered.

   A FOUNDER IS A GLIDE PATH, NOT A PRICE (2026-08-15). Carlos is one all-in quarter and then nine
   months of plan + Compras + a per-order rate at half Mediano's published one, so the roster emits
   SEVERAL prices per founder and one of them is METERED — `usage_type` and `meter` are read off the
   row, against the same `rocoto_pedido` meter §2 creates. Two consequences worth knowing before a
   run: `--only founder` will now also ensure that meter exists, because a metered price cannot be
   created without one; and the year-1 prices carry NO payment link, because Carlos already has a
   subscription and a link would mint him a second one that bills him twice.

   `_founder_ledger()` prints the roster a second time, grouped by customer and period instead of by
   lookup_key, and deliberately prints no monthly total for a metered period — see its docstring.

7. THE BETA CODE — a 100 %-off Coupon SCOPED TO THE THREE MODULE PRODUCTS, plus the Promotion Code
   `BETA` that a human types. Peter, 2026-08-15: «the customers will be chaperoned by me for now and
   I'll give them a code to get radar, compras and reparto for free while theyre in BETA.»

   WHAT IT MUST NOT REACH IS THE POINT. `applies_to.products` is the whole mechanism: Compras,
   Reparto and Radar, and NOTHING ELSE. The seat band and the per-order price stay at list, because
   the thing being tested is the modules and a discount that quietly swallowed the band would make
   every beta customer's revenue unreadable. It never touches the `founder_` namespace either —
   asserted, like every other write in this file.

   `duration=forever`, because there is no end date to invent («no date, because there is no date to
   give» is this repo's standing rule). It ends when the discount is removed from that customer's
   subscription, which is a deliberate act — and until then it is a live 100 % discount, so the run
   says so out loud every time.

   ⚠️ IT CANNOT BE TYPED AT CHECKOUT YET, and that is a fact about the Checkout, not the coupon.
   brain/pedidos_billing.create_checkout_session already passes `allow_promotion_codes=True`, so the
   field is on the page — but the session's line items are the seat band plus the metered per-order
   price, and neither hangs off a product this coupon applies to. Stripe refuses a product-scoped
   promotion code against an order containing none of its products. So today the code is applied to
   the SUBSCRIPTION (dashboard or API), where it does bite: Radar arrives as an InvoiceItem on
   `radar_product` (`_on_invoice_created`) and is discounted to zero. It becomes enterable at
   Checkout the moment Compras and Reparto are attached as line items — see the note at `checkout`
   in webapp/src/routes/plan.tsx, which is the same gap seen from the other end.

   A SECOND THING TO KNOW BEFORE THE FIRST BETA INVOICE: Radar's 15 % is taken on the invoice's own
   line `amount`s, which are pre-discount. So a coupon covering Compras but not Radar would surcharge
   a discounted Compras line at list. BETA covers all three, so it nets to zero either way.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Tuple

# backend/ is the parent of scripts/ — needed to import brain.* when this script is run directly.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import config  # noqa: E402
from brain import founder_prices  # noqa: E402
from brain.pedidos_billing import (  # noqa: E402,F401
    BANDS,
    MIN_TERM_MONTHS,
    ORDERS_METER_EVENT,
    SELLABLE_BANDS,
    _product_key,
    _sv,
    _sv_id,
    lookup_key,
)

# Backend-owned input travels with these operator scripts and their offline checks.
PRICING_JSON = Path(__file__).resolve().parents[1] / "pricing.json"

# The meter every per-order price aggregates against. `event_name` is the wire contract with the
# reporter: change it and every metered price stops seeing usage, silently. It is therefore IMPORTED
# from brain/pedidos_billing.py — the one module both this script and brain/pedidos_usage_report.py
# already depend on — rather than declared here, so the catalogue and the reporter cannot disagree
# about the name they are both keyed on.
ORDERS_METER_NAME = "Rocoto — pedidos"

CURRENCY = "eur"

# Every price in this catalogue is quoted SIN IVA — «Precios sin IVA», Peter's own footer, the way
# every Spanish B2B price list works. `tax_behavior` is fixed for the life of a price (prices are
# immutable), so it cannot be corrected after the fact and is set on every single create below.
TAX_BEHAVIOR = "exclusive"


# ──────────────────────────── the figures, read from the one place they live ────────────────────────────
def _pricing() -> Dict[str, Any]:
    """Read backend/pricing.json, the existing model's module rates and bundle rows."""
    if not PRICING_JSON.exists():
        raise SystemExit(
            f"[provision_v2] {PRICING_JSON} not found. The module rates and bundle totals live "
            f"there and nowhere else — run this script from a checkout of the repo.")
    return json.loads(PRICING_JSON.read_text("utf-8"))


def _anual_months() -> int:
    """How many months a year costs — «Pago anual: dos meses gratis», so ten.

    DERIVED AND THEN PROVEN, rather than typed. Every sellable band must already satisfy
    `anual_cents == mensual_cents × N` for the same N, which is what tools/check_pricing_sync.py
    asserts against pricing.json's `anual_free_months`. Compras' annual price is that same N × its
    monthly figure, and deriving it here is what stops a second copy of the «dos meses gratis» rule
    existing in this file."""
    found = set()
    for b in SELLABLE_BANDS:
        m, a = int(BANDS[b]["mensual_cents"]), int(BANDS[b]["anual_cents"])
        if m <= 0 or a % m:
            raise SystemExit(f"[provision_v2] band {b}: anual {a} is not a whole number of months "
                             f"of {m} — refusing to guess the annual rule.")
        found.add(a // m)
    if len(found) != 1:
        raise SystemExit(f"[provision_v2] the bands disagree about how many months a year costs: "
                         f"{sorted(found)} — fix BANDS before provisioning.")
    return found.pop()


def _eur(cents: int) -> str:
    return f"€{cents / 100:,.2f}"


def _bundle_total_cents(qty: int, plan_rate_cents: int, discount_pct: int) -> int:
    """What a bolsa of `qty` pedidos costs on a band charging `plan_rate_cents`, in integer cents.

        total_cents = half_up(qty × per_order_cents × (100 − discount_pct) / 100)

    HALF UP, IN INTEGERS, LIKE ALL FOUR SURFACES. /precios runs
    `pctCents(qty * plan.rate, 100 - C.bundles.discountPct)`, /plan runs the same in TypeScript and
    brain/pricing_quote.bundle_total_cents runs it in Python for the lead alert; `(2n + d) // (2d)`
    is that same `Math.floor((cents * pct + 50) / 100)`. Python's own `round()` is banker's and
    would land a cent under the other three on a tie. This is the amount a customer actually pays in
    one go, so a cent of divergence here is a Checkout that disagrees with the page that sold it.

    THE FIGURES ARE READ, NOT MIRRORED — `discount_pct` comes from pricing.json and the rate from
    BANDS, which tools/check_pricing_sync.py asserts against pricing.json. So this script cannot
    quote a bolsa off a rate the page does not publish, and it does not need a copy of the
    percentage to do it."""
    return (2 * int(qty) * int(plan_rate_cents) * (100 - int(discount_pct)) + 100) // 200


# ──────────────────────────── what the catalogue should contain ────────────────────────────
def _products(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """The distinct products the price rows hang off, in first-seen order."""
    seen: Dict[str, Dict[str, Any]] = {}
    for r in rows:
        k = r["product_key"]
        if k not in seen:
            seen[k] = {"product_key": k, "name": r["product_name"], "desc": r.get("product_desc", ""),
                       "metadata": r.get("product_metadata") or {}, "group": r["group"]}
    return list(seen.values())


def _want_rows(pricing: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Every price this catalogue wants, as plain dicts. One row = one Stripe Price.

    `meter` is filled in later (the meter id is only known after the meter exists), which is why the
    metered rows carry `meter: True` as a marker rather than an id."""
    rows: List[Dict[str, Any]] = []
    anual_months = _anual_months()
    rates = pricing["rates"]

    for band in SELLABLE_BANDS:
        b = BANDS[band]
        label, name = b["label"], b["name"]
        seats = b.get("seats")
        who = f"{seats} personas" if seats else "sin límite de personas"
        pkey = _product_key(band)          # pedidos_peq_product — the same key the old script uses
        base = {
            "group": "ventas", "product_key": pkey,
            "product_name": f"Rocoto Ventas {name}",
            "product_desc": f"Rocoto Ventas {name} — {who}, {b['per_order_cents']} céntimos/pedido.",
            "product_metadata": {"pedidos_product_key": pkey, "band": band,
                                 "seats": str(seats or ""), "model": "seat_band"},
            "band": band,
        }
        # THE SEAT BAND. `mensual_charge_cents` is what MOVES and `min_term_months` is the cadence
        # it moves on — 3 on every band since 2026-08-17, so the charge is three months and the
        # interval is three months. Peter: «all of it should always be the three months up front.»
        # Reading both off the band is what lets this script also describe the retired ceiling bands
        # correctly without a second code path.
        term = int(b.get("min_term_months") or 0)
        rows.append({**base, "lookup_key": lookup_key(band, "mensual"),
                     "amount": int(b["mensual_charge_cents"]),
                     "interval": "month", "interval_count": (term or 1),
                     "usage_type": "licensed", "meter": False,
                     "nickname": f"Rocoto Ventas {name} — mensual",
                     "metadata": {"band": band, "kind": "mensual", "seats": str(seats or ""),
                                  "per_order_cents": str(b["per_order_cents"]),
                                  "min_term_months": str(term)}})
        rows.append({**base, "lookup_key": lookup_key(band, "anual"),
                     "amount": int(b["anual_charge_cents"]),
                     "interval": "year", "interval_count": 1,
                     "usage_type": "licensed", "meter": False,
                     "nickname": f"Rocoto Ventas {name} — anual",
                     "metadata": {"band": band, "kind": "anual", "seats": str(seats or ""),
                                  "per_order_cents": str(b["per_order_cents"]),
                                  "anual_months": str(anual_months)}})
        # THE PER-ORDER RATE — metered, monthly, in arrears. «Los pedidos se facturan a mes vencido»,
        # which is precisely what a metered price does: Stripe totals the period's reported usage and
        # bills it at the end. Always month/1 regardless of the plan's cadence, because the sentence
        # says a month; an annual tenant carries this item on a second monthly subscription (see the
        # module docstring, §2).
        rows.append({**base, "lookup_key": f"pedidos_{band}_orders",
                     "amount": int(b["per_order_cents"]),
                     "interval": "month", "interval_count": 1,
                     "usage_type": "metered", "meter": True,
                     "nickname": f"Rocoto Ventas {name} — pedidos",
                     "metadata": {"band": band, "kind": "orders",
                                  "per_order_cents": str(b["per_order_cents"]),
                                  "meter_event": ORDERS_METER_EVENT}})

        # COMPRAS — «la mitad de tu plan». The half is already resolved in BANDS (and asserted against
        # pricing.json by tools/check_pricing_sync.py), so it is read, never recomputed here.
        crows = {
            "group": "compras", "product_key": "compras_product",
            "product_name": "Rocoto Compras",
            "product_desc": "Rocoto Compras — tus pedidos a proveedores. La mitad de tu plan.",
            "product_metadata": {"rocoto_product_key": "compras_product", "module": "compras"},
            "band": band,
        }
        # ⚠️ COMPRAS RIDES THE PLAN'S CADENCE, because it rides the plan's SUBSCRIPTION. It was
        # month/1 while the plan was, which was fine; the moment the plan became month/3 a session
        # carrying both became un-creatable — Stripe permits one interval per subscription. So the
        # module is prepaid for the same term as the seat it attaches to, which is also what the
        # page now promises.
        rows.append({**crows, "lookup_key": f"compras_{band}_mensual",
                     "amount": int(b["compras_cents"]) * (term or 1),
                     "interval": "month", "interval_count": (term or 1),
                     "usage_type": "licensed", "meter": False,
                     "nickname": f"Rocoto Compras {name} — mensual",
                     "metadata": {"band": band, "module": "compras", "kind": "mensual",
                                  "min_term_months": str(term)}})
        rows.append({**crows, "lookup_key": f"compras_{band}_anual",
                     "amount": int(b["compras_cents"]) * anual_months,
                     "interval": "year", "interval_count": 1,
                     "usage_type": "licensed", "meter": False,
                     "nickname": f"Rocoto Compras {name} — anual",
                     "metadata": {"band": band, "module": "compras", "kind": "anual",
                                  "anual_months": str(anual_months)}})

    # REPARTO — «39 €/furgoneta/mes». ONE price, LICENSED, and the number of vans is the subscription
    # item's QUANTITY. That is what makes adding a van a quantity update instead of a new price, and
    # it is why this is not metered: vans are a licence you hold for the month, not usage you accrue.
    van = int(rates["reparto_van"]) * 100
    rrow = {
        "group": "reparto", "product_key": "reparto_product",
        "product_name": "Rocoto Reparto",
        "product_desc": "Rocoto Reparto — del almacén a la puerta. Por furgoneta y mes.",
        "product_metadata": {"rocoto_product_key": "reparto_product", "module": "reparto"},
        "band": "",
    }
    # Same cadence rule as Compras, for the same reason — it rides the plan's subscription. Reparto
    # carries no band, so the term comes from MIN_TERM_MONTHS directly rather than off a band row.
    _rt = int(MIN_TERM_MONTHS)
    rows.append({**rrow, "lookup_key": "reparto_van_mensual", "amount": van * _rt,
                 "interval": "month", "interval_count": _rt, "usage_type": "licensed", "meter": False,
                 "nickname": "Rocoto Reparto — furgoneta/mes",
                 "metadata": {"module": "reparto", "kind": "mensual", "unit": "furgoneta",
                              "min_term_months": str(_rt)}})
    rows.append({**rrow, "lookup_key": "reparto_van_anual", "amount": van * anual_months,
                 "interval": "year", "interval_count": 1, "usage_type": "licensed", "meter": False,
                 "nickname": "Rocoto Reparto — furgoneta/año",
                 "metadata": {"module": "reparto", "kind": "anual", "unit": "furgoneta",
                              "anual_months": str(anual_months)}})

    # PREPAID BOLSAS — one-off prices, no `recurring` at all. `orders` is the allowance the payment
    # buys and it rides in metadata so the draw-down can be read off Stripe alone, without this repo
    # (brain/pedidos_billing._on_bundle_purchased reads `valid_months` straight off the Price when
    # the session does not carry it). `valid_months` is the expiry from Peter's own line, «Válida 12
    # meses», and is never defaulted anywhere.
    #
    # THREE SIZES × THREE BANDS = NINE PRICES (2026-08-15, module docstring §3). The size is
    # published and the AMOUNT IS DERIVED from the band the customer is on, so the bag can never be
    # the thing that hands somebody a rate their band does not sell — which is exactly what the
    # three fixed prices did, upside down, to the largest customers.
    bundles = pricing["bundles"]
    pct = int(bundles["discount_pct"])
    brow = {
        "group": "bundles", "product_key": "bundles_product",
        "product_name": "Rocoto — pedidos por adelantado",
        "product_desc": ("Bolsa de pedidos prepagada. Se consume según entran los pedidos. "
                         f"Válida {bundles['valid_months']} meses."),
        "product_metadata": {"rocoto_product_key": "bundles_product", "module": "bundles"},
        "band": "",
    }
    for band in SELLABLE_BANDS:
        b = BANDS[band]
        rate = int(b["per_order_cents"])
        for r in bundles["rows"]:
            qty = int(r["qty"])
            total = _bundle_total_cents(qty, rate, pct)
            rows.append({**brow, "lookup_key": f"pedidos_bundle_{band}_{qty}", "amount": total,
                         "band": band,
                         "interval": None, "interval_count": 1, "usage_type": "", "meter": False,
                         "nickname": f"Rocoto {b['name']} — {qty} pedidos por adelantado",
                         # `plan_rate_cents` and `discount_pct` are the two figures the amount was
                         # built from, stamped so the price can be AUDITED from Stripe alone: an
                         # invoice line that disagrees with them is a bag sold off the wrong band,
                         # and that is unreadable from the total on its own.
                         #
                         # `rate_cents` is what a pedido inside the bag effectively cost, half up —
                         # DERIVED FROM THE TOTAL, never the other way round, so the figure a human
                         # reads on the price can never multiply out to an amount Stripe did not
                         # charge. brain/pricing_quote._bundle derives the lead alert's «5.000 a
                         # 0,54 € = 2.700 €» from the same direction, for the same reason.
                         # `orders` and `valid_months` are load-bearing, not decoration:
                         # brain/pedidos_billing._on_bundle_purchased reads `valid_months` straight
                         # off this Price when the Checkout session does not carry it, and refuses
                         # to record the bag rather than guess an expiry.
                         "metadata": {"module": "bundles", "band": band, "orders": str(qty),
                                      "plan_rate_cents": str(rate), "discount_pct": str(pct),
                                      "rate_cents": str((2 * total + qty) // (2 * qty)),
                                      "valid_months": str(bundles["valid_months"])}})

    # FOUNDER PRICES — the pinned namespace. One product per founder, so their invoice line says who
    # they are, and the metadata carries the human facts (quoted / locked_until / includes_orders).
    #
    # A FOUNDER CAN HAVE SEVERAL PRICES, AND SOME OF THEM ARE METERED (2026-08-15). A glide path is
    # periods, and a period is a plan plus the lines that ride with it — Carlos is one all-in quarter
    # and then nine months of plan + Compras + a per-order rate at half Mediano's published one. So
    # `usage_type` and `meter` are READ OFF THE ROW rather than hardcoded licensed: his
    # `founder_carlos_mensual_orders` is a metered price against the same `rocoto_pedido` meter every
    # public per-order price uses, and minting it licensed would charge 0,25 € A MONTH in place of
    # 0,25 € a pedido — 1.250 € missing from every invoice, on a price that looks fine in the
    # dashboard. brain/founder_prices.py owns the shape; this loop only carries it across.
    #
    # THE PRODUCT TAKES A NARROWER METADATA DICT than the prices do. All of a founder's prices share
    # one product and `_products()` stamps it from the FIRST row, so a per-line fact copied up there
    # would describe one third of what it sits over — Carlos's product would read
    # `orders_billing=included` above a metered price. `stripe_product_metadata` is that subset.
    for f in founder_prices.price_rows():
        rows.append({
            "group": "founder", "product_key": f["product_key"],
            "product_name": f"Rocoto — {f['display']} (precio fijado)",
            "product_desc": (f"Precio fijado para {f['display']}, cotizado {f['quoted']}, "
                             f"bloqueado hasta {f['locked_until']}."),
            "product_metadata": {"rocoto_product_key": f["product_key"],
                                 **founder_prices.stripe_product_metadata(f)},
            "band": f["band"], "lookup_key": f["lookup_key"], "amount": f["amount_cents"],
            "interval": f["interval"], "interval_count": f["interval_count"],
            "usage_type": f["usage_type"], "meter": f["meter"], "nickname": f["nickname"],
            "metadata": founder_prices.stripe_metadata(f),
        })

    return rows


# ──────────────────────────── reading what Stripe has ────────────────────────────
def _cadence_of(price) -> str:
    """'1 month' / '3 month' / '1 year' / 'one-off' — the human form of the half of a price that is
    NOT the amount. THE CADENCE IS PART OF THE PRICE, so it is part of every comparison: checking
    only the amount is what let «249 € every 1 month» sit under a page selling a three-month
    commitment, looking correct, because the number matched and nobody looked at the interval."""
    rec = _sv(price, "recurring")
    if not rec:
        return "one-off"
    interval = _sv(rec, "interval") or "?"
    count = int(_sv(rec, "interval_count") or 1)
    usage = _sv(rec, "usage_type") or "licensed"
    meter = _sv(rec, "meter") or ""
    tail = "" if usage == "licensed" else f" {usage}"
    return f"{count} {interval}{tail}" + (f" ←{meter}" if meter else "")


def _wanted_cadence(row: Dict[str, Any], meter_id: str) -> str:
    if not row["interval"]:
        return "one-off"
    usage = row["usage_type"] or "licensed"
    tail = "" if usage == "licensed" else f" {usage}"
    return (f"{row['interval_count']} {row['interval']}{tail}"
            + (f" ←{meter_id}" if row["meter"] else ""))


def _diff(price, row: Dict[str, Any], meter_id: str) -> List[str]:
    """Every way the live price disagrees with the plan. Amount AND cadence AND usage_type AND meter
    AND tax_behavior — a price is immutable, so any one of these being wrong means the object has to
    be replaced, and reporting only the amount would hide the ones that cost the most to discover."""
    out: List[str] = []
    have_amount = int(_sv(price, "unit_amount") or 0)
    if have_amount != int(row["amount"]):
        out.append(f"amount {_eur(have_amount)} → {_eur(int(row['amount']))}")
    have_cad, want_cad = _cadence_of(price), _wanted_cadence(row, meter_id)
    if have_cad != want_cad:
        out.append(f"cadence {have_cad} → {want_cad}")
    have_tax = _sv(price, "tax_behavior") or ""
    if have_tax != TAX_BEHAVIOR:
        out.append(f"tax_behavior {have_tax or '—'} → {TAX_BEHAVIOR}")
    if (_sv(price, "currency") or "") != CURRENCY:
        out.append(f"currency {_sv(price, 'currency')} → {CURRENCY}")
    if not _sv(price, "active", False):
        out.append("archived in Stripe")
    return out


# ──────────────────────────── writes ────────────────────────────
def _payment_method_types(stripe) -> List[str]:
    """['card'] plus SEPA when the account actually carries the capability.

    NAMING `payment_method_types` PINS CHECKOUT TO EXACTLY THAT LIST, which cuts both ways: naming
    `sepa_debit` on an account without the capability fails every checkout with InvalidRequestError,
    and omitting the field hands the choice to the dashboard, which currently offers klarna, link and
    amazon_pay — consumer methods, on a four-figure B2B invoice. So the list is RESOLVED from
    Account.capabilities, never assumed. Same probe brain/pedidos_billing._payment_method_types
    makes, deliberately duplicated rather than imported because that one is async."""
    try:
        acct = stripe.Account.retrieve()
        caps = _sv(acct, "capabilities") or {}
        if _sv(caps, "sepa_debit_payments") == "active":
            return ["card", "sepa_debit"]
    except Exception as e:  # noqa: BLE001 — a capability probe never blocks the run
        print(f"[provision_v2] sepa capability probe failed, assuming card only: {e}", file=sys.stderr)
    return ["card"]


def _stripe_tax_active(stripe) -> bool:
    """Whether Stripe Tax is switched on for this account.

    It matters for exactly one object: a PAYMENT LINK cannot carry a manual TaxRate the way a
    Checkout Session can (there is no `tax_rates` on a payment-link line item), so the only way a
    pinned founder link adds 21 % IVA is `automatic_tax`. Everything else in this catalogue is sold
    through brain/pedidos_billing's Checkout, which attaches the manual `pedidos_iva_es` rate. A
    founder link minted without tax would invoice a Spanish company a figure they cannot reclaim
    IVA on, so this is a refusal, not a warning."""
    try:
        settings = stripe.tax.Settings.retrieve()
        return (_sv(settings, "status") or "") == "active"
    except Exception as e:  # noqa: BLE001
        print(f"[provision_v2] Stripe Tax status probe failed: {e}", file=sys.stderr)
        return False


def _ensure_meter(stripe, dry_run: bool) -> Tuple[str, str]:
    """(meter_id, action). Found by `event_name` — meters carry no metadata, and the event name is
    the wire contract anyway, so it is the only stable handle there is."""
    try:
        for m in stripe.billing.Meter.list(status="active", limit=100).auto_paging_iter():
            if (_sv(m, "event_name") or "") == ORDERS_METER_EVENT:
                return _sv(m, "id"), "exists"
    except Exception as e:  # noqa: BLE001
        return "(unreadable)", f"list_failed ({e})"
    if dry_run:
        return "(dry-run)", "would_create"
    m = stripe.billing.Meter.create(
        display_name=ORDERS_METER_NAME,
        event_name=ORDERS_METER_EVENT,
        # SUM of an explicit `value`, not COUNT of events: one reported event can then carry a whole
        # day's orders if the reporter ever batches, and a per-order report is simply value=1. COUNT
        # would lock the reporter into exactly one HTTP call per order forever.
        default_aggregation={"formula": "sum"},
        value_settings={"event_payload_key": "value"},
        customer_mapping={"type": "by_id", "event_payload_key": "stripe_customer_id"},
    )
    return _sv(m, "id"), "created"


# Stripe's tax code for B2B SaaS — see _ensure_product for why every product must carry one.
SAAS_TAX_CODE = "txcd_10103001"

# ──────────────────────────── the BETA code (module docstring §7) ────────────────────────────
# THE CODE A HUMAN TYPES. Short, upper case, and the same word Peter already uses for the thing it
# names — «while theyre in BETA». Stripe upper-cases promotion codes anyway and they are matched
# case-insensitively at Checkout.
BETA_CODE = "BETA"

# Coupons carry no `lookup_key`, so metadata is the idempotent handle — the same move `_ensure_product`
# makes. Found by this key, never by name: a name is display text somebody edits in the dashboard.
BETA_COUPON_KEY = "beta_modules"

# EXACTLY WHAT THE DISCOUNT MAY REACH. Products, not prices — a coupon's `applies_to` is keyed on
# products, which is also why Radar can be in it at all: Radar has a product and no price, and its
# InvoiceItem is created against that product. The seat band's products (`pedidos_{band}_product`)
# and therefore the per-order rate are deliberately absent.
BETA_PRODUCT_KEYS = ("compras_product", "reparto_product", "radar_product")

BETA_PCT = 100
BETA_DURATION = "forever"


def _ensure_product(stripe, p: Dict[str, Any], dry_run: bool) -> Tuple[str, str]:
    key = p["product_key"]
    # Products have no lookup_key, so metadata is the idempotent handle. Two keys are searched
    # because the Ventas products keep the OLD script's `pedidos_product_key` name — the backend's
    # _product_key() builds it and renaming it would orphan every existing product.
    for meta_key in ("pedidos_product_key", "rocoto_product_key"):
        try:
            found = stripe.Product.search(query=f"metadata['{meta_key}']:'{key}'", limit=1)
        except Exception as e:  # noqa: BLE001
            return "(unreadable)", f"search_failed ({e})"
        if found.data:
            prod = found.data[0]
            # BACKFILL THE TAX CODE ONTO A PRODUCT THAT PREDATES THIS RULE. Products created before
            # the tax code was required carry none, and `_ensure_product`'s early return would leave
            # them that way forever — so `automatic_tax` keeps refusing on a catalogue that otherwise
            # looks complete. Unlike a Price, a Product IS mutable, so this is a safe repair rather
            # than a create-and-archive.
            if not _sv(prod, "tax_code") and not dry_run:
                try:
                    stripe.Product.modify(prod.id, tax_code=SAAS_TAX_CODE)
                    return prod.id, "exists (tax code set)"
                except Exception as e:  # noqa: BLE001
                    return prod.id, f"exists (tax code FAILED: {e})"
            return prod.id, "exists"
    if dry_run:
        return "(dry-run)", "would_create"
    # EVERY PRODUCT CARRIES A TAX CODE, because `automatic_tax` refuses without one — «You must
    # specify a tax code in all line items to calculate taxes» is what Stripe answers when a Payment
    # Link tries to compute 21 % on a product that has none. A manual TaxRate covers the in-app
    # Checkout, but a payment-link line item cannot carry one, so the founder link is the surface that
    # forced this — and setting it here rather than as an account default keeps the fact in code where
    # it is reviewable.
    #
    # txcd_10103001 is "Software as a service (SaaS) — business use", which is what Rocoto is: a
    # B2B subscription sold to Spanish companies who reclaim the IVA. Getting this wrong does not
    # fail loudly; it invoices at the wrong rate.
    prod = stripe.Product.create(name=p["name"], description=p["desc"] or None,
                                 tax_code=SAAS_TAX_CODE, metadata=p["metadata"])
    return prod.id, "created"


def _create_price(stripe, product_id: str, row: Dict[str, Any], meter_id: str):
    kwargs: Dict[str, Any] = dict(
        product=product_id, currency=CURRENCY, unit_amount=int(row["amount"]),
        lookup_key=row["lookup_key"], tax_behavior=TAX_BEHAVIOR,
        nickname=row["nickname"], metadata=row["metadata"],
    )
    if row["interval"]:
        rec: Dict[str, Any] = {"interval": row["interval"],
                               "interval_count": int(row["interval_count"])}
        if row["usage_type"] == "metered":
            rec["usage_type"] = "metered"
            rec["meter"] = meter_id
        kwargs["recurring"] = rec
    return stripe.Price.create(**kwargs)


def _ensure_payment_link(stripe, f: Dict[str, Any], price_id: str, pmts: List[str],
                         tax_ok: bool, dry_run: bool) -> Tuple[str, str]:
    """A Stripe Payment Link for a pinned founder price, so Peter can literally send a URL.

    TWO HARD REFUSALS, both of which produce a worse outcome than no link at all:

      · NO TENANT SLUG → the Checkout Session this link mints would carry no `tenant_slug`, and
        brain/pedidos_billing._on_checkout_completed ignores a session without one. The customer would
        pay and be provisioned nothing. Fill in the roster entry first.
      · NO STRIPE TAX → a payment-link line item cannot carry the manual `pedidos_iva_es` TaxRate, so
        the only route to 21 % is `automatic_tax`. A Spanish company invoiced without IVA cannot
        reclaim it.

    The link's own `metadata` is copied by Stripe onto every session it creates, which is exactly what
    the webhook reads, and `subscription_data.metadata` puts the same facts on the subscription so the
    answer survives on the object that outlives the session."""
    tenant = (f.get("tenant_slug") or "").strip()
    if not tenant:
        return "—", "REFUSED (roster entry has no tenant_slug — a paid link would provision nothing)"
    if not tax_ok:
        return "—", "REFUSED (Stripe Tax inactive — a link cannot carry the manual IVA rate)"

    meta = {
        "kind": "rocoto_pedidos",           # brain/pedidos_billing.CHECKOUT_KIND — the routing key
        "tenant_slug": tenant,
        "band": f["band"],
        "cadence": f["cadence"],
        "operator_email": "",
        "alta_included": "",
        **founder_prices.stripe_metadata(f),
        "pinned_lookup_key": f["lookup_key"],
    }
    try:
        for link in stripe.PaymentLink.list(limit=100, active=True).auto_paging_iter():
            lm = _sv(link, "metadata") or {}
            if _sv(lm, "pinned_lookup_key") == f["lookup_key"]:
                return _sv(link, "url") or _sv(link, "id"), "exists"
    except Exception as e:  # noqa: BLE001
        return "(unreadable)", f"list_failed ({e})"
    if dry_run:
        return "(dry-run)", "would_create"

    base = (getattr(config, "DEMO_PUBLIC_BASE_URL", "https://app.soyrocoto.com") or "").rstrip("/")
    link = stripe.PaymentLink.create(
        line_items=[{"price": price_id, "quantity": 1}],
        payment_method_types=pmts,
        metadata=meta,
        subscription_data={"metadata": meta,
                           "description": f"Rocoto — {f['display']} (precio fijado {f['quoted']})"},
        automatic_tax={"enabled": True},
        # THE CIF IS REQUIRED, NOT OFFERED (Peter, 2026-08-15: «it should make cif
        # mandatory»). `enabled` alone renders an optional field almost nobody fills in,
        # and the tax ID is what decides the INVOICE: with it Stripe returns 0 %
        # `reverse_charge` for a Spanish company — measured against the live account —
        # and the customer can account for the 21 % and reclaim it. Without it the same
        # sale falls to «not_collecting», which leaves a Spanish business holding an
        # invoice their gestor cannot use. `if_supported` demands it wherever Stripe can
        # collect one and stays out of the way where it cannot.
        tax_id_collection={"enabled": True, "required": "if_supported"},
        after_completion={"type": "redirect", "redirect": {"url": f"{base}/bienvenida"}},
    )
    return _sv(link, "url") or _sv(link, "id"), "created"


def _ensure_beta(stripe, product_ids: Dict[str, str], dry_run: bool) -> List[Tuple[str, str, str]]:
    """The BETA coupon and the promotion code that redeems it — module docstring §7.

    CREATE-ONLY, LIKE EVERY OTHER OBJECT IN THIS FILE. A coupon's `percent_off`, `duration` and
    `applies_to` are fixed at creation (only `name` and `metadata` can be modified), so a live coupon
    that disagrees with this plan is REPORTED as drift and left alone — replacing it would silently
    change what an existing beta customer is being discounted.

    SCOPE IS ASSERTED BEFORE ANY WRITE, not after. The whole value of this object is the three
    products it may touch, and a coupon created with a missing product id would silently be a wider
    discount than anybody agreed to — on a run restricted with `--only beta`, or before the module
    products exist, that is exactly what would happen. So a missing product is a refusal.

    Returns printable rows, the same shape `_supersede_bundles` returns."""
    out: List[Tuple[str, str, str]] = []

    # ── the fence, first ──
    if founder_prices.is_protected(BETA_CODE.lower()):   # unreachable by construction; asserted anyway
        return [(BETA_CODE, "—", "REFUSED (protected founder namespace)")]

    want_products: List[str] = []
    missing: List[str] = []
    for key in BETA_PRODUCT_KEYS:
        pid = product_ids.get(key, "")
        if not pid or pid.startswith("("):
            missing.append(key)
        else:
            want_products.append(pid)
    # A REAL WRITE REFUSES; A DRY RUN GOES ON AND PRINTS THE WHOLE INTENT. On a fresh account every
    # product is «would_create», so stopping here would hand a reader a plan that says nothing about
    # the object they are being asked to approve — and the scope IS the object. The refusal that
    # matters is the one before `Coupon.create`, which is below and is not reachable from here.
    if missing and not dry_run:
        out.append((BETA_COUPON_KEY, "—",
                    f"REFUSED (products unavailable: {', '.join(missing)} — a coupon created "
                    f"without its scope is 100 % off the seat band too, and a coupon's "
                    f"`applies_to` cannot be edited afterwards)"))
        out.append((BETA_CODE, "—", "waits for the coupon"))
        return out

    # ── the coupon ──
    coupon_id, coupon_action = "", ""
    try:
        for c in stripe.Coupon.list(limit=100).auto_paging_iter():
            if _sv(_sv(c, "metadata") or {}, "rocoto_coupon_key") == BETA_COUPON_KEY:
                coupon_id = _sv(c, "id")
                have_pct = _sv(c, "percent_off")
                have_dur = _sv(c, "duration") or ""
                have_prods = sorted(_sv(_sv(c, "applies_to") or {}, "products") or [])
                problems = []
                if int(have_pct or 0) != BETA_PCT:
                    problems.append(f"percent_off {have_pct} → {BETA_PCT}")
                if have_dur != BETA_DURATION:
                    problems.append(f"duration {have_dur or '—'} → {BETA_DURATION}")
                if have_prods != sorted(want_products):
                    problems.append(f"applies_to.products {have_prods} → {sorted(want_products)}")
                if not _sv(c, "valid", False):
                    problems.append("no longer valid in Stripe")
                coupon_action = ("DRIFT: " + "; ".join(problems)) if problems else "exists"
                break
    except Exception as e:  # noqa: BLE001
        return [(BETA_COUPON_KEY, "(unreadable)", f"list_failed ({e})")]

    if not coupon_id:
        if dry_run:
            coupon_action = "would create"
            if missing:
                coupon_action += f" (scope waits for {', '.join(missing)}, created earlier in this run)"
        else:
            c = stripe.Coupon.create(
                name="Rocoto BETA — Compras · Reparto · Radar",
                percent_off=BETA_PCT,
                duration=BETA_DURATION,
                # THE SCOPE. Without this the same object is 100 % off the whole invoice, seat band
                # and pedidos included, which is not what was asked for and is unrecoverable once a
                # customer holds it — a coupon's restrictions cannot be edited afterwards.
                applies_to={"products": want_products},
                metadata={"rocoto_coupon_key": BETA_COUPON_KEY, "module_scope": ",".join(BETA_PRODUCT_KEYS),
                          "why": "chaperoned beta — modules free while Peter onboards"},
            )
            coupon_id, coupon_action = _sv(c, "id"), "created"
    out.append((BETA_COUPON_KEY, coupon_id or "(dry-run)",
                f"{coupon_action}   [{BETA_PCT} % off · {BETA_DURATION} · "
                f"{' + '.join(BETA_PRODUCT_KEYS)}]"))

    # ── the promotion code a human types ──
    try:
        found = stripe.PromotionCode.list(code=BETA_CODE, limit=1)
    except Exception as e:  # noqa: BLE001
        out.append((BETA_CODE, "(unreadable)", f"list_failed ({e})"))
        return out
    if found.data:
        pc = found.data[0]
        on = _sv_id(_sv(pc, "coupon"))
        # A code pointing at SOME OTHER coupon is the dangerous case: the word Peter hands a customer
        # would redeem a discount this file never described. Reported, never repointed.
        action = "exists" if (coupon_id and on == coupon_id) else f"DRIFT: redeems coupon {on}"
        if not _sv(pc, "active", True):
            action += " (inactive)"
        out.append((BETA_CODE, _sv(pc, "id"), action))
        return out
    if dry_run:
        out.append((BETA_CODE, "(dry-run)", "would create (unlimited redemptions, no expiry)"))
        return out
    if not coupon_id:
        out.append((BETA_CODE, "—", "REFUSED (coupon missing)"))
        return out
    pc = stripe.PromotionCode.create(
        coupon=coupon_id, code=BETA_CODE, active=True,
        # NO `max_redemptions` AND NO `expires_at`. Peter gave neither, and inventing one is how a
        # chaperoned customer's discount disappears mid-beta with nobody having decided it should.
        # The customers are onboarded by hand, which is the actual control on who holds this.
        metadata={"rocoto_coupon_key": BETA_COUPON_KEY},
    )
    out.append((BETA_CODE, _sv(pc, "id"), "created"))
    return out


def _supersede_bundles(stripe, pricing: Dict[str, Any], dry_run: bool) -> List[Tuple[str, str, str]]:
    """Archive the three band-agnostic `pedidos_bundle_{qty}` prices this script replaced.

    NOT OPT-IN, UNLIKE `--archive-retired`, AND THE DIFFERENCE IS THE POINT. The ceiling-model prices
    are dead stock: nothing sells them and nothing looks like them. These three are live, sellable
    one-off prices sitting one underscore away from the nine keys created in the same run, quoting
    2.250 / 4.200 / 10.000 € — figures no surface offers any more, and which are wrong in the
    customer's favour on Pequeño (2.700 €) and in ours on Grande (1.800 €). A live price nothing
    references is how somebody eventually gets charged it: a stale link, a copied lookup_key, a
    picker in the dashboard. So the run that stops publishing them is the run that closes them.

    ARCHIVING IS NOT CANCELLING, and here it cannot even be that: these are one-off prices, so no
    subscription holds one. `active=False` removes a price from pickers and stops new Checkout
    sessions using it. A bag already bought stays bought — the balance lives on the tenant's
    subscription metadata (brain/pedidos_billing.PREPAID_KEYS), not on the price — and
    `_on_bundle_purchased` still resolves `valid_months` off an archived Price by id.

    Never touches the `founder_` namespace, asserted rather than assumed.

    ⚠️ IT SCANS STRIPE, IT DOES NOT WALK `rows` — 2026-08-15, after this exact miss. Deriving the
    keys from the CURRENT sizes only closes the ones that still exist in pricing.json, so the moment
    a size is RETIRED its band-agnostic price is orphaned: dropping 25.000 left
    `pedidos_bundle_25000` live at 10.000 € with nothing on any surface offering it, which is
    precisely the failure this function was written to prevent. The shape is what identifies them —
    `pedidos_bundle_<digits>`, no band — so listing live prices and matching that shape catches
    every one, including sizes nobody remembers.
    """
    out: List[Tuple[str, str, str]] = []
    stale: List[str] = []
    try:
        for pr in stripe.Price.list(limit=100, active=True).auto_paging_iter():
            k = _sv(pr, "lookup_key") or ""
            tail = k[len("pedidos_bundle_"):] if k.startswith("pedidos_bundle_") else ""
            if tail and tail.isdigit():                 # band-agnostic by shape: no band segment
                stale.append(k)
    except Exception as e:  # noqa: BLE001
        out.append(("(scan failed)", "—", f"could not list prices: {e}"))
    for lk in sorted(stale, key=lambda x: int(x.rsplit("_", 1)[1])):
        if founder_prices.is_protected(lk):             # unreachable by construction; asserted anyway
            out.append((lk, "—", "REFUSED (protected founder namespace)"))
            continue
        try:
            found = stripe.Price.list(lookup_keys=[lk], limit=1)
        except Exception as e:  # noqa: BLE001
            out.append((lk, "—", f"list_failed ({e})"))
            continue
        if not found.data:
            out.append((lk, "—", "absent"))
            continue
        p = found.data[0]
        if not _sv(p, "active", False):
            out.append((lk, p.id, "already archived"))
            continue
        if dry_run:
            out.append((lk, p.id, f"would archive ({_eur(int(_sv(p, 'unit_amount') or 0))} fixed)"))
            continue
        stripe.Price.modify(p.id, active=False)
        out.append((lk, p.id, "archived"))
    return out


def _founder_ledger() -> None:
    """Print the pinned roster grouped the way a customer's BILL is grouped — one block per founder
    per period, the plan first and then the lines that ride on it.

    THE PRICE TABLE ABOVE IS KEYED ON LOOKUP KEYS, WHICH IS THE WRONG UNIT FOR CHECKING A QUOTE.
    `founder_carlos_mensual`, `founder_carlos_mensual_compras` and `founder_carlos_mensual_orders`
    are three adjacent rows there and ONE monthly bill here, and the bill is what somebody has to
    recognise before typing `--yes`: this is the only place a figure a human promised out loud is
    about to become an immutable object.

    NO MONTHLY TOTAL IS PRINTED FOR A METERED PERIOD, because there is no such number. Carlos's
    «1.998 €/mes» is his bill at exactly 5.000 pedidos; the month he sends 7.000 he owes 2.498 € and
    the month he sends 3.000 he owes 1.498 €. So the ledger prints what is actually fixed and the
    rate the rest is billed at, which is the quote — printing a total would be printing an assumption
    about his volume, which is the one thing in the deal nobody controls."""
    by_period: Dict[Tuple[str, str], List[Dict[str, Any]]] = {}
    for f in founder_prices.price_rows():
        by_period.setdefault((f["slug"], f["cadence"]), []).append(f)
    if not by_period:
        return
    print("pinned founder prices, as each customer's bill is shaped:")
    for (slug, cadence), lines in by_period.items():
        plan = next((r for r in lines if r["role"] == founder_prices.ROLE_PLAN), None)
        if not plan:
            print(f"  {slug} · {cadence}   ⚠️ no plan line — a period must have exactly one")
            continue
        head = f"{plan['display']} · {cadence}"
        every = (f"every {plan['interval_count']} {plan['interval']}"
                 if plan["interval_count"] != 1 else f"every {plan['interval']}")
        allowance = f" ({plan['includes_orders']})" if plan["includes_orders"] else ""
        print(f"  {head}   orders: {plan['orders_billing']}{allowance}"
              f"   ·   locked until {plan['locked_until']}"
              f"   ·   workspace {plan['tenant_slug'] or '— none yet —'}")
        fixed = 0
        for r in sorted(lines, key=lambda x: 0 if x["role"] == founder_prices.ROLE_PLAN else 1):
            per = ("per pedido, metered in arrears" if r["meter"]
                   else f"{every}" if r["role"] == founder_prices.ROLE_PLAN else "every month")
            if not r["meter"]:
                fixed += int(r["amount_cents"])
            print(f"    {r['role']:<8}{r['lookup_key']:<34}{_eur(int(r['amount_cents'])):>12}  {per}")
        metered = [r for r in lines if r["meter"]]
        tail = f"fixed {_eur(fixed)} {every}"
        if metered:
            tail += ("   plus " + " + ".join(f"{_eur(int(r['amount_cents']))}/pedido"
                                             for r in metered) + ", on what actually arrives")
        print(f"    {'':8}{tail}")
    print()


def _archive_retired(stripe, dry_run: bool) -> List[Tuple[str, str, str]]:
    """Archive the ceiling-model prices — `pedidos_s_*`, `pedidos_m_*`, `pedidos_l_*`, `pedidos_xl_*`.

    ARCHIVING IS NOT CANCELLING. Stripe keeps billing an archived price on a subscription that already
    holds it; `active=False` only removes it from pickers and stops it being sold again. So a tenant on
    a ceiling band is untouched by this, which is the whole reason it is safe — and why it is still
    opt-in: it is a tidy-up, not a step the new catalogue needs.

    Never touches the `founder_` namespace, asserted rather than assumed."""
    out: List[Tuple[str, str, str]] = []
    retired = [b for b in BANDS if not BANDS[b].get("per_order_cents")]
    for band in retired:
        for kind in ("mensual", "anual", "alta"):
            lk = lookup_key(band, kind)
            if founder_prices.is_protected(lk):          # unreachable by construction; asserted anyway
                out.append((lk, "—", "REFUSED (protected founder namespace)"))
                continue
            try:
                found = stripe.Price.list(lookup_keys=[lk], limit=1)
            except Exception as e:  # noqa: BLE001
                out.append((lk, "—", f"list_failed ({e})"))
                continue
            if not found.data:
                out.append((lk, "—", "absent"))
                continue
            p = found.data[0]
            if not _sv(p, "active", False):
                out.append((lk, p.id, "already archived"))
                continue
            if dry_run:
                out.append((lk, p.id, "would archive"))
                continue
            stripe.Price.modify(p.id, active=False)
            out.append((lk, p.id, "archived"))
    return out


# ──────────────────────────── main ────────────────────────────
# `beta` produces no PRICE, so it contributes no row to `_want_rows` — it is a Coupon and a
# Promotion Code hanging off products the other groups create. Listed here so `--only beta` and the
# plan table both name it, and so a run that omits it says so.
GROUPS = ("ventas", "compras", "reparto", "radar", "bundles", "founder", "beta")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--mode", choices=["test", "live"], required=True,
                    help="test → STRIPE_SECRET_KEY_TEST; live → STRIPE_SECRET_KEY")
    ap.add_argument("--dry-run", action="store_true",
                    help="report the whole plan and write nothing (the default posture)")
    ap.add_argument("--yes", action="store_true",
                    help="required to actually write when --dry-run is absent")
    ap.add_argument("--only", choices=GROUPS, action="append", default=None,
                    help="restrict the run to one or more groups (repeatable)")
    ap.add_argument("--archive-retired", action="store_true",
                    help="also archive the ceiling-model prices (subscriptions are unaffected)")
    args = ap.parse_args()

    # DEFAULT-SAFE: a run with neither flag is a dry run that says so, rather than a write.
    if not args.dry_run and not args.yes:
        print("refusing to write without --yes (or pass --dry-run to preview)", file=sys.stderr)
        return 2
    dry = args.dry_run or not args.yes

    key_env = "STRIPE_SECRET_KEY_TEST" if args.mode == "test" else "STRIPE_SECRET_KEY"
    secret = os.environ.get(key_env, "")
    if not secret:
        print(f"[provision_v2] {key_env} is not set in the environment — nothing to do.",
              file=sys.stderr)
        return 1

    import stripe
    stripe.api_key = secret
    stripe.max_network_retries = 2

    pricing = _pricing()
    rows = _want_rows(pricing)
    groups = set(args.only) if args.only else set(GROUPS)
    rows = [r for r in rows if r["group"] in groups]

    # THE FENCE, ASSERTED BEFORE ANY WRITE. Only the founder group may produce a `founder_` key. If
    # any other group ever did, it would mean the public catalogue had grown a way into the pinned
    # namespace — which is the one thing this whole mechanism exists to make impossible.
    strays = [r["lookup_key"] for r in rows
              if founder_prices.is_protected(r["lookup_key"]) and r["group"] != "founder"]
    if strays:
        print(f"REFUSING: non-founder rows claim the protected namespace: {strays}", file=sys.stderr)
        return 3

    # ── the meter first: the metered price rows need its id to be comparable at all ──
    meter_id, meter_action = ("—", "skipped")
    if any(r["meter"] for r in rows):
        meter_id, meter_action = _ensure_meter(stripe, dry)

    print(f"\nRocoto Stripe catalogue v2 (seat bands) — mode={args.mode} "
          f"dry_run={dry} groups={','.join(sorted(groups))}\n")

    # ── products ──
    prods = _products(rows)
    product_ids: Dict[str, str] = {}
    print(f"{'product_key':<26}{'stripe_id':<32}action")
    print("-" * 92)
    for p in prods:
        pid, action = _ensure_product(stripe, p, dry)
        product_ids[p["product_key"]] = pid
        print(f"{p['product_key']:<26}{pid:<32}{action}")
    if "radar" in groups:
        # Radar has a product and NO price — «+15 % sobre tu factura» is an invoice item computed per
        # invoice, not an amount that can exist ahead of time. Provisioned as its own line so the plan
        # states it rather than leaving a reader to notice the absence.
        radar_pct = pricing["rates"]["radar_pct"]
        rp = {"product_key": "radar_product", "name": "Rocoto Radar",
              "desc": f"Rocoto Radar — +{radar_pct} % sobre la factura del mes.",
              "metadata": {"rocoto_product_key": "radar_product", "module": "radar",
                           "pct": str(radar_pct), "billed_as": "invoice_item_on_invoice_created"},
              "group": "radar"}
        pid, action = _ensure_product(stripe, rp, dry)
        product_ids["radar_product"] = pid
        print(f"{'radar_product':<26}{pid:<32}{action}")
    print()

    # ── the meter ──
    if meter_action != "skipped":
        print(f"meter    {ORDERS_METER_EVENT:<18}{meter_id:<32}{meter_action}"
              f"   (sum of `value`, customer by id)\n")

    # ── prices: what exists vs what is wanted, amount AND cadence, BEFORE any write ──
    # The key column is 34 wide because a founder's per-line keys are the longest in the catalogue —
    # `founder_carlos_mensual_orders` is 30 characters, and a key that overflows its column pushes
    # the live/wanted figures out of alignment on exactly the rows somebody is reading most closely.
    # The columns are separated by explicit SPACES rather than by their widths alone: a metered row's
    # cadence carries the meter id («0,25 € / 1 month metered ←mtr_…»), which is longer than any
    # column can honestly reserve, and without a gap it fuses onto the value to its left — the first
    # run printed «—€0.25», which reads as a negative amount.
    print(f"{'lookup_key':<34}{'live':>26}  {'wanted':>26}  action")
    print("-" * 116)
    to_create: List[Dict[str, Any]] = []
    drift = 0
    for row in rows:
        lk = row["lookup_key"]
        want = f"{_eur(int(row['amount']))} / {_wanted_cadence(row, meter_id)}"
        try:
            found = stripe.Price.list(lookup_keys=[lk], limit=1)
        except Exception as e:  # noqa: BLE001
            print(f"{lk:<34}{'—':>26}  {want:>26}  list_failed ({e})")
            continue
        if not found.data:
            to_create.append(row)
            print(f"{lk:<34}{'—':>26}  {want:>26}  "
                  f"{'would create' if dry else 'CREATE'}")
            continue
        p = found.data[0]
        live = f"{_eur(int(_sv(p, 'unit_amount') or 0))} / {_cadence_of(p)}"
        problems = _diff(p, row, meter_id)
        if problems:
            drift += 1
            # CREATE-ONLY, DELIBERATELY. A Stripe price is immutable, so "fixing" this would mean
            # minting a replacement and moving the lookup_key — repricing a live catalogue, which is
            # how a customer gets charged something nobody decided. It is reported and left alone;
            # scripts/reprice_stripe_pedidos.py is the explicit, separate act that does it.
            print(f"{lk:<34}{live:>26}  {want:>26}  DRIFT: {'; '.join(problems)}")
        else:
            print(f"{lk:<34}{live:>26}  {want:>26}  ok")
    print()

    # ── the pinned roster, read as bills rather than as keys ──
    # AFTER THE TABLE AND BEFORE THE LINKS, because it is the last thing between a reader and `--yes`
    # on the only prices in this catalogue that were promised to a named human out loud.
    if "founder" in groups:
        _founder_ledger()

    # ── founder payment links ──
    link_rows: List[Tuple[str, str, str]] = []
    if "founder" in groups:
        pmts = _payment_method_types(stripe)
        tax_ok = _stripe_tax_active(stripe)
        for f in founder_prices.price_rows():
            if not f["payment_link"]:
                continue
            price_id = ""
            try:
                got = stripe.Price.list(lookup_keys=[f["lookup_key"]], limit=1)
                price_id = got.data[0].id if got.data else ""
            except Exception:  # noqa: BLE001
                price_id = ""
            if not price_id and dry:
                link_rows.append((f["lookup_key"], "—", "waits for the price (same run creates both)"))
                continue
            if not price_id:
                link_rows.append((f["lookup_key"], "—", "REFUSED (price missing)"))
                continue
            url, action = _ensure_payment_link(stripe, f, price_id, pmts, tax_ok, dry)
            link_rows.append((f["lookup_key"], url, action))
        if link_rows:
            print(f"{'payment link for':<26}{'url':<52}action")
            print("-" * 104)
            for lk, url, action in link_rows:
                print(f"{lk:<26}{url:<52}{action}")
            print(f"\npayment methods resolved from Account.capabilities: {', '.join(pmts)}"
                  f"   ·   Stripe Tax: {'active' if tax_ok else 'INACTIVE'}\n")

    # ── writes ──
    if to_create and not dry:
        print("creating:")
        for row in to_create:
            if founder_prices.is_protected(row["lookup_key"]) and row["group"] != "founder":
                print(f"REFUSING to create {row['lookup_key']} — protected founder namespace",
                      file=sys.stderr)
                return 3
            pid = product_ids.get(row["product_key"], "")
            if not pid or pid.startswith("("):
                print(f"  {row['lookup_key']:<26} skipped — product {row['product_key']} unavailable")
                continue
            price = _create_price(stripe, pid, row, meter_id)
            print(f"  {row['lookup_key']:<26}{price.id:<32}"
                  f"{_eur(int(row['amount']))} / {_wanted_cadence(row, meter_id)}")
        print()

    # ── the three band-agnostic bolsas this run replaces ──
    # AFTER THE CREATES, ALWAYS. The nine per-band prices exist before the three fixed ones are
    # closed, so there is never a moment where the catalogue can sell neither — and on a dry run the
    # plan simply reads create-then-close, which is the order a reader needs to approve it in.
    if "bundles" in groups:
        print("superseded bolsas (band-agnostic, replaced by pedidos_bundle_{band}_{qty}):")
        for lk, pid, action in _supersede_bundles(stripe, pricing, dry):
            print(f"  {lk:<26}{pid:<32}{action}")
        print()

    # ── the BETA code ──
    # AFTER THE PRODUCTS AND THE PRICES, ALWAYS. The coupon is defined by the three products it may
    # touch, so it cannot be created before they exist — and on a dry run the plan reads
    # create-products-then-scope-coupon, which is the order somebody has to approve it in.
    if "beta" in groups:
        print("beta code (100 % off Compras · Reparto · Radar — never the band, never the pedidos):")
        for name, oid, action in _ensure_beta(stripe, product_ids, dry):
            print(f"  {name:<26}{oid:<32}{action}")
        print("  ⚠️ it has NO expiry and NO redemption limit — it stops when the discount is removed "
              "from that customer's subscription.")
        print("  ⚠️ Checkout will not accept it until Compras/Reparto ride as line items: a "
              "product-scoped code is refused against an order holding none of its products. "
              "Applied to the subscription it already zeroes Radar's invoice item.")
        print()

    # ── the retired ceiling prices ──
    if args.archive_retired:
        print("retired ceiling-model prices:")
        for lk, pid, action in _archive_retired(stripe, dry):
            print(f"  {lk:<26}{pid:<32}{action}")
        print()

    # ── the standing facts, printed every run ──
    print(f"protected: the `{founder_prices.NAMESPACE}` namespace is created only from "
          f"brain/founder_prices.py's roster, and is never modified or archived by this script or by "
          f"scripts/reprice_stripe_pedidos.py.")
    # SAID PLAINLY, EVERY RUN, because this is the line somebody reads before typing --yes. «No
    # amount is changed» is the honest form of it now that the run archives: archiving sets
    # `active=False` and touches nothing else, so no customer's price moves.
    print("existing subscriptions are NOT touched by this run — no amount is ever changed, and "
          "archiving a price only stops it being SOLD again; it never reprices or cancels a "
          "subscription already holding it, nor a prepaid bolsa already bought.")
    if drift:
        print(f"\n⚠️ {drift} live price(s) disagree with the plan. Prices are immutable, so this "
              f"script reports and stops. Repricing is scripts/reprice_stripe_pedidos.py.")
    if dry:
        print(f"\n(dry run — nothing was written; {len(to_create)} price(s) would be created)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
