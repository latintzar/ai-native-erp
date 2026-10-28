#!/usr/bin/env python3
"""Idempotently create/update the Stripe catalogue for Rocoto Pedidos (PEDIDOS-PRICING-BUILD.md §2/§5):
4 products (S/M/L/XL), each with 3 prices (`mensual`, `anual`, `alta`) — 12 prices total — plus the
customer-portal Configuration (price switching OFF; payment-method update + cancel ON).

BANDS (the pricing numbers) lives in `brain/pedidos_billing.py`, imported here rather than repeated —
that module is what actually resolves these same lookup_keys at Checkout time, so the two can never
drift apart.

Keyed on stable identifiers, so RE-RUNNING THIS SCRIPT IS ALWAYS SAFE:
  - a Product is found by its `pedidos_product_key` metadata (Stripe products have no lookup_key)
  - a Price is found by its `lookup_key` (pedidos_<band>_<mensual|anual|alta>) — Stripe's own
    idempotent handle for prices
  - the portal Configuration is found by its `pedidos_portal` metadata tag
Nothing here ever deletes or archives — a price amount cannot change in Stripe once created (prices
are immutable), so a drifted amount is reported, never silently "fixed" by mutating the existing price.

Usage:
    python3 scripts/provision_stripe_pedidos.py --mode test --dry-run
    python3 scripts/provision_stripe_pedidos.py --mode test
    python3 scripts/provision_stripe_pedidos.py --mode live          # ⚠️ real Stripe, real prices

Reads STRIPE_SECRET_KEY (--mode live) or STRIPE_SECRET_KEY_TEST (--mode test) from the environment.
Never prints a key value — only Stripe object ids and the amounts already LOCKED in the spec.
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# backend/ is the parent of scripts/ — needed to import brain.pedidos_billing when this script is run
# directly (`python3 scripts/provision_stripe_pedidos.py`) rather than as a package module.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from brain.pedidos_billing import (  # noqa: E402
    BANDS,
    PORTAL_FEATURES,
    PORTAL_METADATA_KEY,
    _product_key,
    _sv,
    lookup_key,
)

# (band, kind, amount_field, recurring_interval|None, interval_count)
#
# THE AMOUNT FIELD IS THE CHARGE, NOT THE QUOTE (2026-08-13, Peter: «in stripe it has to charge the
# whole 3 months or 1 year in one go!!!»). `mensual_cents` is the per-month figure the pricing card
# prints; `mensual_charge_cents` is the money that moves — the whole 3-month minimum term, billed
# once. Provisioning from the quote is what produced a live «249 € every 1 month» underneath a page
# selling a three-month commitment.
#
# ⚠️ THIS SCRIPT NOW COVERS THE RETIRED CEILING BANDS ONLY (2026-08-14). BANDS grew three seat bands
# — peq/med/gra — and every assumption baked into the rows below is false for them: the 3-month
# cadence contradicts their own «Sin permanencia», `mensual_charge_cents` is no longer 3× the quote,
# and their `alta_cents` is 0, so this loop would mint three €0 setup prices nobody sells. Running it
# unfiltered against live Stripe would have produced `pedidos_peq_mensual` at «199 € every 3 months»
# under a page quoting 199 €/mes. The seat bands, the per-order meter, the modules and the prepaid
# bundles are provisioned by scripts/provision_stripe_v2.py instead; this script stays as the record
# of what the ceiling bands were sold at, and re-running it is still safe and still a no-op.
CEILING_BANDS: Tuple[str, ...] = tuple(b for b in BANDS if not BANDS[b].get("per_order_cents"))

PRICE_ROWS: List[Tuple[str, str, str, Optional[str], int]] = []
for _band in CEILING_BANDS:
    PRICE_ROWS.append((_band, "mensual", "mensual_charge_cents", "month", 3))
    PRICE_ROWS.append((_band, "anual", "anual_charge_cents", "year", 1))
    PRICE_ROWS.append((_band, "alta", "alta_cents", None, 1))


def _product_name(band: str) -> str:
    return f"Rocoto Pedidos {BANDS[band]['label']}"


def _ensure_product(stripe, band: str, dry_run: bool) -> Tuple[str, str]:
    """(product_id, action) — action ∈ 'exists' | 'would_create' | 'created'."""
    key = _product_key(band)
    found = stripe.Product.search(query=f"metadata['pedidos_product_key']:'{key}'", limit=1)
    if found.data:
        return found.data[0].id, "exists"
    if dry_run:
        return "(dry-run)", "would_create"
    prod = stripe.Product.create(
        name=_product_name(band),
        description=(f"Rocoto Pedidos {BANDS[band]['label']} — hasta "
                    f"{BANDS[band]['orders_ceiling']} pedidos/mes."),
        metadata={
            "pedidos_product_key": key, "band": band,
            "orders_ceiling": str(BANDS[band]["orders_ceiling"]),
            "cost_per_order_cents": str(BANDS[band]["cost_per_order_cents"]),
        },
    )
    return prod.id, "created"


def _ensure_price(stripe, product_id: str, band: str, kind: str, amount: int,
                  interval: Optional[str], dry_run: bool,
                  interval_count: int = 1) -> Tuple[str, str]:
    """(price_id, action) — action ∈ 'exists' | 'exists_amount_drift' | 'would_create' | 'created'."""
    lk = lookup_key(band, kind)
    found = stripe.Price.list(lookup_keys=[lk], limit=1)
    if found.data:
        p = found.data[0]
        return p.id, ("exists" if p.unit_amount == amount else
                      f"exists_amount_drift (stripe has €{p.unit_amount / 100:.2f})")
    if dry_run:
        return "(dry-run)", "would_create"
    kwargs: Dict[str, Any] = dict(
        product=product_id, currency="eur", unit_amount=amount, lookup_key=lk,
        # Peter, 2026-08-11: the bands are quoted SIN IVA, the way every Spanish B2B price list is —
        # €449 stays €449 on the card and IVA is added at Checkout. `tax_behavior` is fixed for the
        # life of a price (prices are immutable), so this cannot be corrected after the fact.
        tax_behavior="exclusive",
        nickname=f"Rocoto Pedidos {BANDS[band]['label']} — {kind}",
        metadata={
            "band": band, "orders_ceiling": str(BANDS[band]["orders_ceiling"]),
            "cost_per_order_cents": str(BANDS[band]["cost_per_order_cents"]), "kind": kind,
        },
    )
    if interval:
        kwargs["recurring"] = {"interval": interval, "interval_count": interval_count}
    price = stripe.Price.create(**kwargs)
    return price.id, "created"


def _ensure_portal_configuration(stripe, dry_run: bool) -> Tuple[str, str]:
    found = stripe.billing_portal.Configuration.list(limit=100)
    for c in found.data:
        meta = _sv(c, "metadata") or {}
        if _sv(meta, PORTAL_METADATA_KEY) == "true":
            return c.id, "exists"
    if dry_run:
        return "(dry-run)", "would_create"
    cfg = stripe.billing_portal.Configuration.create(
        business_profile={"headline": "Rocoto Pedidos — gestiona tu suscripción"},
        features=PORTAL_FEATURES,
        metadata={PORTAL_METADATA_KEY: "true"},
    )
    return cfg.id, "created"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--mode", choices=["test", "live"], required=True,
                    help="test → STRIPE_SECRET_KEY_TEST; live → STRIPE_SECRET_KEY")
    ap.add_argument("--dry-run", action="store_true", help="only report what would happen — no writes")
    args = ap.parse_args()

    key_env = "STRIPE_SECRET_KEY_TEST" if args.mode == "test" else "STRIPE_SECRET_KEY"
    secret = os.environ.get(key_env, "")
    if not secret:
        print(f"[provision_stripe_pedidos] {key_env} is not set in the environment — nothing to do.",
             file=sys.stderr)
        return 1

    import stripe
    stripe.api_key = secret
    stripe.max_network_retries = 2

    rows: List[Tuple[str, str, str, str]] = []  # (kind, key, stripe_id, action)
    product_ids: Dict[str, str] = {}
    for band in CEILING_BANDS:
        pid, action = _ensure_product(stripe, band, args.dry_run)
        product_ids[band] = pid
        rows.append(("product", _product_key(band), pid, action))

    for band, kind, field, interval, interval_count in PRICE_ROWS:
        amount = BANDS[band][field]
        price_id, action = _ensure_price(stripe, product_ids[band], band, kind, amount, interval,
                                         args.dry_run, interval_count)
        unit = (f"€{amount / 100:.2f}"
                + (f" every {interval_count} {interval}" if interval else " one-off"))
        rows.append(("price", lookup_key(band, kind), price_id, f"{action} ({unit})"))

    cfg_id, cfg_action = _ensure_portal_configuration(stripe, args.dry_run)
    rows.append(("portal_configuration", PORTAL_METADATA_KEY, cfg_id, cfg_action))

    # ── print the table (never a key value — object ids and the spec's own LOCKED amounts only) ──
    w0 = max(len(r[0]) for r in rows) + 2
    w1 = max(len(r[1]) for r in rows) + 2
    w2 = max(len(r[2]) for r in rows) + 2
    print(f"\nRocoto Pedidos Stripe provisioning — mode={args.mode} dry_run={args.dry_run}\n")
    print(f"{'kind':<{w0}}{'key':<{w1}}{'stripe_id':<{w2}}action")
    print("-" * (w0 + w1 + w2 + 30))
    for kind, key, sid, action in rows:
        print(f"{kind:<{w0}}{key:<{w1}}{sid:<{w2}}{action}")
    print()
    if args.dry_run:
        print("(dry run — nothing was created)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
