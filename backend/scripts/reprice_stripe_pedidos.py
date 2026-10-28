#!/usr/bin/env python3
"""Move a Rocoto Pedidos lookup_key onto a NEW Stripe Price when BANDS says the amount changed.

This operator tool preserves the existing billing implementation. Historical rationale below
includes superseded public-pricing and tax claims. Current commercial intent lives in
Rocoto-Labs/company/decisions/2026-08-31-two-week-trial-commercial-model.md; publication readiness
is recorded in docs/ENGINEERING-READINESS.md. Both CLI modes contact Stripe, including dry runs.

WHY THIS IS A SEPARATE SCRIPT FROM provision_stripe_pedidos.py. That one is create-only and
deliberately never mutates: a Stripe Price amount is IMMUTABLE, so when BANDS disagrees with the
live price it reports `exists_amount_drift` and stops. That is the right default — silently
repricing a live catalogue is how customers get charged something nobody decided.

Repricing is therefore an explicit, separate act. It is what you run after a deliberate price
change (Peter, 2026-08-12: «make small 249 surely that's better», and «just make it 20% off if
they do annual»).

WHAT IT DOES, per drifted (band, kind):
  1. creates a NEW Price at the amount BANDS now says, carrying `transfer_lookup_key=True` — Stripe
     moves the lookup_key off the old price and onto the new one in that single call, so there is
     never a moment where the key resolves to nothing and Checkout 500s
  2. archives the OLD price (`active=False`) so it stops appearing in the dashboard's pickers

WHAT IT DELIBERATELY DOES NOT DO:
  - it never deletes anything (Stripe prices cannot be deleted, only archived)
  - it never touches an existing SUBSCRIPTION. A tenant already billing on the old price keeps
    billing on it until they change plan, which is the correct behaviour and the reason repricing
    is safe to do with customers on the book
  - it never changes `tax_behavior` (immutable) — the new price is created `exclusive`, matching
    the catalogue, because every Rocoto figure is quoted sin IVA and Checkout adds 21%
  - ⚠️ IT NEVER TOUCHES THE `founder_` NAMESPACE. Peter, 2026-08-14: «carlos gets sent his own link
    and his own stripe link, so that we can do the public one and still score him without changing
    what i quoted him already.» A pinned price exists precisely because this script would otherwise
    rewrite a named human's quote the next time the public list moves — transfer_lookup_key would
    carry his key onto a new amount, or archiving would leave his subscription pointing at a dead
    price. The fence is `brain/founder_prices.is_protected()`, asserted in the write loop rather than
    only filtered on input, and the count it protected is printed every run so the operator SEES it
    hold instead of trusting that it did.

Usage:
    python3 scripts/reprice_stripe_pedidos.py --mode test --dry-run
    python3 scripts/reprice_stripe_pedidos.py --mode live --dry-run   # ⚠️ read-only, but real data
    python3 scripts/reprice_stripe_pedidos.py --mode live --yes       # ⚠️ writes to live Stripe

Reads STRIPE_SECRET_KEY (--mode live) or STRIPE_SECRET_KEY_TEST (--mode test). Never prints a key.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Tuple

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from brain import founder_prices  # noqa: E402
from brain.pedidos_billing import BANDS, SELLABLE_BANDS, _sv, lookup_key  # noqa: E402

# Reparto's preserved van rate is owned alongside these backend operator tools.
_RATES = json.loads((Path(__file__).resolve().parents[1] / "pricing.json").read_text())["rates"]

# Only the recurring plan prices are ever repriced here. `alta` is not sold under the settled shape,
# so leaving it alone keeps this script's blast radius to what is live.
#
# THE FIELD IS THE CHARGE, NOT THE QUOTE (2026-08-13). `mensual_cents` is the per-month figure the
# pricing card prints; `mensual_charge_cents` is the money that actually moves. `interval_count`
# carries the other half of the same fact, and BOTH now come from the band's own `min_term_months`
# rather than a constant written here: the ceiling bands sold a three-month commitment and charge
# 3 × the quote every 3 months, the seat bands say «Sin permanencia» and charge the quote every
# month. Hardcoding either shape would silently rewrite the other model's cadence.
KINDS: Tuple[Tuple[str, str, str], ...] = (
    ("mensual", "mensual_charge_cents", "month"),
    ("anual", "anual_charge_cents", "year"),
)


def _plan_rows() -> List[Tuple[str, str, int, str, int, str]]:
    """(band, kind, want_cents, interval, interval_count, lookup_key) for every recurring price
    that rides the TERM subscription.

    ⚠️ THE MODULES ARE IN HERE TOO, AND LEAVING THEM OUT WOULD HAVE BROKEN EVERY CHECKOUT
    (2026-08-17). Compras and Reparto sit on the SAME subscription as the seat band, and Stripe
    permits one billing interval per subscription. Repricing only the band would leave the plan at
    month × 3 beside modules still at month × 1, and `Session.create` refuses that outright — a 503
    on every purchase, from a script whose output said «3 prices repriced, done».

    The metered `pedidos_{band}_orders` prices are deliberately ABSENT: they ride the separate
    monthly usage subscription and must stay month × 1, because «los pedidos se facturan a mes
    vencido» is a promise on the page."""
    rows: List[Tuple[str, str, int, str, int, str]] = []
    for band in SELLABLE_BANDS:
        b = BANDS[band]
        term = int(b.get("min_term_months") or 0)
        for kind, field, interval in KINDS:
            count = (term or 1) if kind == "mensual" else 1
            rows.append((band, kind, int(b[field]), interval, count, lookup_key(band, kind)))
        # Compras — the module's per-month figure × the term, on the term's cadence
        rows.append((band, "compras", int(b["compras_cents"]) * (term or 1),
                     "month", (term or 1), f"compras_{band}_mensual"))
    # Reparto carries no band; its term comes from the constant the bands all share
    _t = int(BANDS[SELLABLE_BANDS[0]].get("min_term_months") or 1) or 1
    rows.append(("", "reparto", int(_RATES["reparto_van"]) * 100 * _t,
                 "month", _t, "reparto_van_mensual"))
    return rows


def _protected_keys(stripe) -> List[str]:
    """Every live `founder_` lookup_key in this Stripe mode. Listed purely so the run PRINTS what it
    is refusing to touch: a fence nobody can see is a fence nobody trusts, and the whole reason the
    namespace exists is that «remember not to reprice Carlos» already failed as a mechanism."""
    keys: List[str] = []
    try:
        for p in stripe.Price.list(limit=100, active=True).auto_paging_iter():
            lk = _sv(p, "lookup_key") or ""
            if founder_prices.is_protected(lk):
                keys.append(lk)
    except Exception as e:  # noqa: BLE001 — a reporting read must never block the actual work
        print(f"[reprice] could not list prices to report the founder fence: {e}", file=sys.stderr)
    return sorted(keys)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--mode", choices=["test", "live"], required=True)
    ap.add_argument("--dry-run", action="store_true",
                    help="report what would change; make no writes")
    ap.add_argument("--yes", action="store_true",
                    help="required to actually write when --dry-run is absent")
    args = ap.parse_args()

    if not args.dry_run and not args.yes:
        print("refusing to write without --yes (or pass --dry-run to preview)", file=sys.stderr)
        return 2

    key_env = "STRIPE_SECRET_KEY_TEST" if args.mode == "test" else "STRIPE_SECRET_KEY"
    secret = os.environ.get(key_env, "")
    if not secret:
        print(f"[reprice] {key_env} is not set in the environment — nothing to do.", file=sys.stderr)
        return 1

    import stripe
    stripe.api_key = secret
    stripe.max_network_retries = 2

    planned: List[Dict[str, Any]] = []
    for band, kind, want, interval, count, lk in _plan_rows():
        found = stripe.Price.list(lookup_keys=[lk], limit=1)
        if not found.data:
            planned.append({"lk": lk, "band": band, "kind": kind, "want": want,
                            "interval": interval, "count": count, "old_id": None, "have": None,
                            "have_cad": "—",
                            "action": "MISSING — run provision_stripe_v2.py first"})
            continue
        p = found.data[0]
        have = int(_sv(p, "unit_amount") or 0)
        # THE CADENCE IS PART OF THE PRICE, so it is part of the comparison. Checking only the
        # amount is what let «249 € every 1 month» sit there looking correct while the page sold a
        # 3-month commitment: the number matched the quote exactly, and the cadence — the thing that
        # was wrong — was never looked at.
        rec = _sv(p, "recurring") or {}
        have_int = (rec.get("interval") if isinstance(rec, dict) else getattr(rec, "interval", None))
        have_cnt = (rec.get("interval_count") if isinstance(rec, dict)
                    else getattr(rec, "interval_count", None)) or 1
        same = (have == want and have_int == interval and int(have_cnt) == count)
        planned.append({"lk": lk, "band": band, "kind": kind, "want": want,
                        "interval": interval, "count": count, "old_id": p.id, "have": have,
                        "have_cad": f"{have_cnt} {have_int}",
                        "product": _sv(p, "product"),
                        "action": "ok" if same else "REPRICE"})

    todo = [r for r in planned if r["action"] == "REPRICE"]
    protected = _protected_keys(stripe)

    print(f"\nRocoto Pedidos repricing — mode={args.mode} dry_run={args.dry_run}\n")
    print(f"{'lookup_key':<24}{'live':>22}{'wanted':>22}  action")
    print("-" * 86)
    for r in planned:
        live = (f"€{r['have']/100:.2f} / {r['have_cad']}" if r["have"] is not None else "—")
        want = f"€{r['want']/100:.2f} / {r['count']} {r['interval']}"
        print(f"{r['lk']:<24}{live:>22}{want:>22}  {r['action']}")
    print()
    print(f"protected: {len(protected)} price(s) in the `{founder_prices.NAMESPACE}` namespace are "
          f"never created, modified or archived by this script"
          + (f" — {', '.join(protected)}" if protected else ""))
    print("existing subscriptions are never touched by this script, on any band.\n")

    if not todo:
        print("nothing to reprice — live Stripe already matches BANDS.")
        return 0

    if args.dry_run:
        print(f"(dry run — {len(todo)} price(s) would be replaced, "
              f"{len(todo)} old price(s) would be archived)")
        return 0

    for r in todo:
        # THE FENCE, ASSERTED AT THE WRITE rather than only filtered at the input. `_plan_rows()`
        # builds keys from BANDS, so a `founder_` key cannot reach here today — which is exactly why
        # the check belongs here: it is what keeps that true after somebody widens the input.
        if founder_prices.is_protected(r["lk"]):
            print(f"REFUSING to reprice {r['lk']} — protected founder namespace", file=sys.stderr)
            return 3
        # 1. new price, taking the lookup_key with it in the same call
        new = stripe.Price.create(
            product=r["product"],
            currency="eur",
            unit_amount=r["want"],
            lookup_key=r["lk"],
            transfer_lookup_key=True,
            tax_behavior="exclusive",
            recurring={"interval": r["interval"], "interval_count": r["count"]},
            # ⚠️ A BAND-LESS ROW EXISTS AND THIS LINE ASSUMED IT COULD NOT (2026-08-17). Reparto is
            # priced per furgoneta and carries no band, so `BANDS[""]` raised KeyError mid-run —
            # after six prices had already been replaced. The plan was on month × 3 and Reparto
            # still on month × 1, which is a state where any checkout including Reparto is refused
            # by Stripe outright. Every band-keyed field below is therefore conditional, and the
            # nickname names the module when there is no band to name.
            nickname=(f"Rocoto Pedidos {BANDS[r['band']]['label']} — {r['kind']}" if r["band"]
                      else f"Rocoto {r['kind'].capitalize()} — término"),
            metadata=({
                "band": r["band"], "kind": r["kind"],
                "orders_ceiling": str(BANDS[r["band"]]["orders_ceiling"]),
                "cost_per_order_cents": str(BANDS[r["band"]]["cost_per_order_cents"]),
            } if r["band"] else {"module": r["kind"], "kind": "mensual", "unit": "furgoneta"}),
        )
        # 2. retire the old one so it stops showing up in the dashboard's pickers
        stripe.Price.modify(r["old_id"], active=False)
        print(f"  {r['lk']:<24} {r['old_id']} -> {new.id}  "
              f"(€{r['have']/100:.2f} / {r['have_cad']} -> "
              f"€{r['want']/100:.2f} / {r['count']} {r['interval']}, old archived)")

    print(f"\ndone — {len(todo)} price(s) repriced. Existing subscriptions are untouched.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
