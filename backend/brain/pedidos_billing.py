"""Rocoto Pedidos — LIVE Stripe billing (PEDIDOS-PRICING-BUILD.md, "THE SETTLED SHAPE — 2026-08-12",
which supersedes §1/§2/§4 of that file; §3, §5, §6, §7, §8, §10 and §11 are still live).

TWO self-serve bands, `s` = **Small** (up to 500 orders/month) and `m` = **Growth** (up to 2.000).
Anything above that — or any of the spec's Custom triggers (more than one WhatsApp number, email
intake, phone, a team of order-takers who need routing, setup done by Peter) — is **Custom**: a
conversation and a quote, never a self-serve Checkout, and its price is never published.

Each sellable band resolves ONE recurring price at Checkout: `mensual`, or `anual` (10× prepaid).
**There is no alta on Small or Growth** — they set themselves up with the knowledge base, so a
Checkout for these two bands carries exactly one line item, the plan. The `alta` prices still exist
in Stripe and `alta_paid_at` still exists on the row, both for tenants who bought under the older
shape; new Checkouts simply never reference them.

`l` and `xl` stay in BANDS but carry `sellable: False`. They are kept for exactly two reasons: a
tenant already on one keeps a correct ceiling in the meter and a correct upsert in the webhook, and
their Stripe objects stay provisioned and untouched, so the decision is reversible. `create_checkout_
session` refuses them with `reason='band_not_sellable'`, which the UI can render.

Prices are provisioned in Stripe by `scripts/provision_stripe_pedidos.py`, keyed on the stable
`lookup_key` this module also uses to resolve them at Checkout time — `pedidos_s_mensual` /
`pedidos_s_anual` for Small, `pedidos_m_mensual` / `pedidos_m_anual` for Growth, at the amounts they
already carry. **No new Stripe object is needed for the settled shape.** BANDS below is the ONE
source of truth for the pricing table; the provisioning script imports it rather than repeating the
numbers.

Mirrors brain/setupfee.py's shape (mode-aware key selection, sync Stripe calls wrapped in
asyncio.to_thread, never crash on a missing key) and brain/stripe_subs.py's shape (lookup_key
catalogue resolution, Checkout + Billing Portal). This is a THIRD, distinct Stripe surface: setupfee
is the €50/500€ onboarding alta (payment mode, one tenant: BRAIN_TENANT); stripe_subs bills Sancho's
per-employee add-ons (subscription mode, one tenant); THIS bills a Pedidos tenant's whole plan
(subscription mode, MULTI-tenant — `tenant_slug` is never assumed, always passed in).

Mode (test vs live) is read off the TENANT's own `tenants.status` ('test' → the *_TEST Stripe keys;
anything else → live) — the same "a test token/tenant never touches real money" posture setupfee.py
uses for onboarding tokens.

Webhook routing: ONE Stripe endpoint (`/api/stripe/webhook` in app.py) already multiplexes several
kind-routed consumers (setupfee, reparto driver payouts, order_payment). handle_webhook() here is
just one more — it verifies the signature itself (so it never trusts app.py's other consumers to have
done it), no-ops loudly on any event that isn't rocoto_pedidos, and is idempotent on `event.id` via
the pedidos_webhook_events table (schema_runtime.sql).

Overage is NEVER auto-charged (spec §5) — that's pedidos_meter.py's job to flag, not this module's.

⚠️ 2026-08-14 — EVERYTHING ABOVE DESCRIBES THE CEILING MODEL, WHICH IS RETIRED. Read BANDS and
scripts/STRIPE-V2-PLAN.md for what is actually sold now: a seat band (Pequeño/Mediano/Grande, wire
codes peq/med/gra) plus a published per-order rate plus optional modules, with nothing capping how
many orders enter. Three things in this file changed with it and each carries its own note below —
`min_term_months` is per band (the seat bands say «Sin permanencia»), `orders_ceiling` is 0 and 0
means unlimited, and a tenant on brain/founder_prices.py's roster resolves their own pinned price at
Checkout instead of the public band. The paragraphs above are kept because tenants on `s`/`m`/`l`/`xl`
are still billed exactly as they describe.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import config
import db
from brain import founder_prices

log = logging.getLogger("rocoto.pedidos_billing")


# ──────────────────────────── Stripe SDK access helper ────────────────────────────
# stripe 15.x's StripeObject (every value the SDK returns — Price, Subscription, the webhook Event,
# even a nested `.metadata`) has NO `.get()` method: it falls through StripeObject.__getattr__, which
# treats "get" as a literal key lookup and raises AttributeError. `**stripe_obj` / `dict(stripe_obj)`
# fail too — StripeObject implements no `.keys()`, so it isn't a mapping as far as Python is concerned.
# Only `obj["key"]` (raises KeyError on a miss, never AttributeError) and `obj.attr` are safe. Empirically
# verified against the installed SDK (stripe==15.0.1) — see the bug-sweep task that added this helper.
def _sv(obj, key, default=None):
    """Read `key` off a Stripe SDK object (or a plain dict — both index the same way) and tolerate a
    missing key/attr or a None receiver. Use this everywhere a Stripe-returned value is read; never
    call `.get()` on one."""
    try:
        v = obj[key]
    except (KeyError, TypeError, AttributeError):
        return default
    return default if v is None else v


def _sv_dict(obj, key, default=None):
    """Like `_sv`, but for a field (e.g. `.metadata`) that's about to be merged into a new dict with
    `{**...}` — a raw StripeObject can't be `**`-unpacked (TypeError: not a mapping), so materialize it
    via `.to_dict()` first. Plain-dict values pass through untouched."""
    v = _sv(obj, key, default)
    if v is None:
        return default
    to_dict = getattr(v, "to_dict", None)
    return to_dict() if callable(to_dict) else v


def _sv_id(v, default: str = "") -> str:
    """A Stripe link field as an ID STRING, whether it came back as `"sub_123"` or as an expanded
    object. Every `ExpandableField` in the SDK is one or the other depending on what the caller
    expanded, and a handler that assumes the string form silently compares an object to a database
    column and matches nothing."""
    if not v:
        return default
    if isinstance(v, str):
        return v
    got = _sv(v, "id")
    return got if isinstance(got, str) and got else default


def _invoice_subscription_id(inv) -> str:
    """The subscription that generated this Invoice, as an id string. '' when the invoice is not a
    subscription invoice.

    ⚠️ READ THIS BEFORE WRITING `_sv(invoice, "subscription")` AGAIN. On stripe 15.0.1 / API
    2026-03-25.dahlia there is NO top-level `subscription` field on an Invoice — verified against the
    installed SDK, not against a doc: `stripe.Invoice.__annotations__` has no `subscription` key, and
    `stripe/_invoice.py` declares `parent: Optional[Parent]` where `Parent.subscription_details.
    subscription` is the `ExpandableField["Subscription"]`. The link MOVED. `_sv` answers a missing
    key with None and every caller then reads that as «not a subscription invoice», so the old path
    does not raise, does not log, and does not fire — the silent-swallow failure mode that already
    shipped a broken factura lookup to production on 2026-08-13. `invoice.paid` was reading the dead
    path too (fixed the same day as this was written), which is why status never moved off the
    checkout's own value.

    The legacy top-level field is still read as a fallback: a webhook is delivered under whatever API
    version the ENDPOINT is pinned to in the dashboard, which is account state this code does not
    control, so an older-shaped payload must still resolve rather than quietly bill nobody."""
    parent = _sv(inv, "parent")
    if parent is not None:
        details = _sv(parent, "subscription_details")
        if details is not None:
            got = _sv_id(_sv(details, "subscription"))
            if got:
                return got
    return _sv_id(_sv(inv, "subscription"))


EUR = "eur"
MIN_TERM_MONTHS = 3          # spec §5: monthly subscriptions carry a 3-month minimum

# ── THE CONTRACT THE BUYER IS ACCEPTING ──────────────────────────────────────────────────────────
# Until 2026-08-19 this Checkout took money with NO acceptance of anything. Stripe rendered no
# checkbox, the Session carried no `consent`, and nothing anywhere recorded that a buyer had ever
# seen the terms — so «acepta las condiciones» was a sentence on a marketing page and not a fact
# about a customer. In a dispute, or a chargeback, the evidence did not exist.
#
# `consent_collection` makes Stripe render the checkbox and refuse the payment until it is ticked;
# the completed Session then carries `consent.terms_of_service == "accepted"`, which is durable,
# timestamped and retrievable from Stripe forever.
#
# THE VERSION IS THE OTHER HALF. Terms change. Proving that someone accepted *a* contract is worth
# little if we cannot say WHICH one, so the version string rides on the session metadata and from
# there onto the subscription — no schema change, and it travels with the object that took the
# money. Bump it whenever legal/terms-of-service-es.md in Rocoto-Labs/company changes materially, in the same
# commit, so the two can never drift.
TERMS_VERSION = "2026-08-28"
TERMS_URL = "https://soyrocoto.com/terminos"
CADENCES = ("mensual", "anual")
CHECKOUT_KIND = "rocoto_pedidos"  # the metadata.kind every session/subscription this module mints carries

# The Billing Meter every per-order price aggregates against, and the event name the reporter emits.
# It lives HERE, in the module both ends already import, because it is a WIRE CONTRACT between two
# files that never see each other: scripts/provision_stripe_v2.py names it on the metered prices it
# creates, and brain/pedidos_usage_report.py names it on every MeterEvent it sends. A second copy
# that drifted would not fail — the meter would simply never see usage, silently, all month.
ORDERS_METER_EVENT = "rocoto_pedido"

# ── pricing catalogue — amounts are integer CENTS ────────────────────────────────────────────────
# `label` is the WIRE code: it is what `?band=` carries between the plan selector and Checkout, and
# what names the Stripe product ("Rocoto Pedidos PEQ"). `name` is what a customer reads — Pequeño,
# Mediano, Grande, Peter's own words. Changing `label` would rename live Stripe products and break
# every existing `?band=` link, so the two are deliberately separate.
#
# These runtime constants match the preserved backend/pricing.json catalogue input, checked by
# tests/vital_term_split.py. Historical comments below describe the implemented August model.
# Current intended commercial terms live in Rocoto-Labs/company; restoring the catalogue does
# not change these constants, accepted agreements or published offers.
#
# ───────────────────── THE MODEL CHANGED — 2026-08-14 ─────────────────────
# Peter, after a full day on it: «i spent all day figuring out this pricing».
#
# OUT: one plan whose price bought a monthly ORDER CEILING (249 € up to 1.500 pedidos).
# IN:  a seat band you pay for, plus a published price per order, plus modules you turn on.
#      `mensual_cents` is the band's monthly fee, `seats` how many people may attend orders
#      (None on Grande — no limit), `per_order_cents` the rate every order is invoiced at, and
#      `compras_cents` the Compras module at half the plan. NOTHING CAPS HOW MANY ORDERS ENTER.
#
# `orders_ceiling` STAYS, AT ZERO, AND ZERO MEANS "NO CEILING". pedidos_meter.ceiling_for() reads it
# and the checkout webhook writes it onto pedidos_subscription, and both spell "unlimited" as 0:
# `is_warn_threshold` and `is_over_ceiling` each guard on `ceiling > 0`, so a seat-band tenant is
# never warned and never flagged over. Removing the key would KeyError in both places instead.
#
# `alta_cents` STAYS, AT ZERO: the seat-band plans carry no setup fee (ALTA_AT_SELF_SERVE_CHECKOUT is
# already False, so no Checkout references one), and the key is kept because scripts/provision_stripe_
# pedidos.py iterates a fixed (mensual, anual, alta) triple per band.
#
# WIRE CODES ARE NEW ON PURPOSE: PEQ/MED/GRA, not S/M/L. The Stripe catalogue is keyed on
# `pedidos_{band}_{kind}` lookup keys and `pedidos_s_*` / `pedidos_m_*` / `pedidos_l_*` already exist
# at the OLD ceiling-model amounts. Reusing a letter would have Checkout resolve a live price of
# 899 € for a plan the page quotes at 1.499 €. New codes fail closed instead: the lookup misses and
# create_checkout_session refuses with `catalogue_not_provisioned` until the catalogue is rebuilt for
# the seat-band model.
#
# S/M/L/XL stay below as sellable:False. A tenant already on one keeps a correct row, a correct meter
# and untouched Stripe objects; nothing in Stripe is archived or deleted, so the decision is
# reversible. `create_checkout_session` refuses them with `reason='band_not_sellable'`.
#
# ANUAL IS TEN MONTHS — «Pago anual: dos meses gratis». It replaced the old 20%-off rule, which
# belonged to the ceiling model and to a badge the page no longer carries.
#   PEQ 199 x 10 = 1.990    MED 499 x 10 = 4.990    GRA 1.499 x 10 = 14.990
BANDS: Dict[str, Dict[str, Any]] = {
    "peq": {"label": "PEQ", "name": "Pequeño", "sellable": True,  "seats": 3,
            "orders_ceiling": 0, "alta_cents": 0, "mensual_cents": 19900,
            "anual_cents": 199000,  "per_order_cents": 60, "compras_cents": 9900},
    "med": {"label": "MED", "name": "Mediano", "sellable": True,  "seats": 10,
            "orders_ceiling": 0, "alta_cents": 0, "mensual_cents": 49900,
            "anual_cents": 499000,  "per_order_cents": 50, "compras_cents": 24900},
    "gra": {"label": "GRA", "name": "Grande",  "sellable": True,  "seats": None,
            "orders_ceiling": 0, "alta_cents": 0, "mensual_cents": 149900,
            "anual_cents": 1499000, "per_order_cents": 40, "compras_cents": 74900},
    # ── retired: the ceiling model, kept for tenants already on it ──
    "s":  {"label": "S",  "name": "Small",  "sellable": False, "orders_ceiling": 1500,
           "alta_cents": 60000,  "mensual_cents": 24900,
           "anual_cents": 239000,  "cost_per_order_cents": 30},
    "m":  {"label": "M",  "name": "Growth", "sellable": False, "orders_ceiling": 5000,
           "alta_cents": 90000,  "mensual_cents": 44900,
           "anual_cents": 431000,  "cost_per_order_cents": 22},
    "l":  {"label": "L",  "name": "L",      "sellable": False, "orders_ceiling": 5000,
           "alta_cents": 150000, "mensual_cents": 89900,
           "anual_cents": 899000,  "cost_per_order_cents": 18},
    "xl": {"label": "XL", "name": "XL",     "sellable": False, "orders_ceiling": 10000,
           "alta_cents": 250000, "mensual_cents": 149000,
           "anual_cents": 1490000, "cost_per_order_cents": 15},
}

# The three bands a visitor can buy without talking to anyone. Order matters — it is the order they
# are shown in and the order the plan selector lists them.
#
# COST PER ORDER IS NOW A PUBLISHED PRICE, NOT A DERIVED ONE. Under the ceiling model it was implied
# (mensual / ceiling), so it was computed here and a hardcoded copy of it was a bug. The seat-band
# model QUOTES it — «desde 199 € + 0,60 €/pedido» — and invoices on it, so it is stored, and the
# ceiling it used to be divided from is what disappeared. `cost_per_order_cents` keeps its name
# because provision_stripe_pedidos.py and the Stripe price metadata are keyed on it; the retired
# bands keep the old derivation, which is also what stops a division by a zero ceiling.
for _b in BANDS.values():
    _b["cost_per_order_cents"] = (
        _b["per_order_cents"] if _b.get("per_order_cents")
        else round(_b["mensual_cents"] / _b["orders_ceiling"], 2))
    # THE TERM IS THREE MONTHS ON EVERY BAND. NO EXCEPTIONS.
    #
    # Peter, 2026-08-13: «in stripe it has to charge the whole 3 months or 1 year in one go!!! it's
    # currently monthly!!!» — and again on 2026-08-17, when the seat bands were found charging one
    # month: «Stripe should, in all cases, be charging the three months in one go. All of it should
    # always be the three months up front. That's the whole point of doing a one-year or three-month
    # thing.»
    #
    # ⚠️ THIS LINE READ `0 if _b.get("per_order_cents") else MIN_TERM_MONTHS` FROM 2026-08-14 TO
    # 2026-08-17, so every seat band — which is every band anyone can actually buy — took one month
    # at Checkout while /precios, the app configurator and /terms.html §5 all promised three. The
    # reasoning that produced it («a 3-month term would take 597 € under a page quoting 199 €/mes —
    # a mis-sale») had the direction backwards: what the page quotes is a MONTHLY RATE, and what
    # Stripe takes is the TERM. Those are different numbers on purpose, which is the whole quote-vs-
    # charge split the cards already print («199 €/mes … facturado cada 3 meses»). Charging one
    # month under a page that promises three is the mis-sale, and it is also the thing that makes a
    # three-month commitment unenforceable — there is no minimum_term_end to enforce.
    #
    # The per-order component is untouched by this: the SEAT FEE is prepaid for the quarter, and the
    # orders that actually arrive are still metered and billed in arrears each month («a mes
    # vencido»). Prepaying a usage charge nobody has incurred is the one thing that would be wrong.
    #
    # One field drives three things — the Checkout charge, the Stripe `interval_count`
    # (scripts/provision_stripe_v2.py, scripts/reprice_stripe_pedidos.py) and the `minimum_term_end`
    # stamped by `_on_checkout_completed`.
    _b["min_term_months"] = MIN_TERM_MONTHS
    _b["mensual_charge_cents"] = _b["mensual_cents"] * MIN_TERM_MONTHS
    # The annual price is ALREADY the whole year in one payment, so it needs no equivalent — it is
    # quoted per month on the card and charged once a year.
    _b["anual_charge_cents"] = _b["anual_cents"]

SELLABLE_BANDS: Tuple[str, ...] = ("peq", "med", "gra")

# ── THE PREPAID BOLSAS A CHECKOUT MAY CARRY ──────────────────────────────────────────────────────
# «Compras una bolsa de pedidos más barata que la tarifa de tu plan y se va consumiendo según
# entran. Válida 12 meses» (product/pricing.json → `bundles`). The SIZES are published; the AMOUNT
# is never held here, because it is derived per band from one shared percentage and Stripe already
# carries the twelve prices it produces — `pedidos_bundle_{band}_{qty}`, three bands × four sizes.
#
# THE SIZES LIVE HERE FOR ONE REASON: so a qty that no bolsa was ever sold at is refused as bad
# INPUT rather than discovered as a missing price. Both answers fail closed, but «bad_bundle» is a
# 400 the buyer can act on and `catalogue_not_provisioned` is a 503 that reads as our outage.
# Mirrored in product/pricing.json → `bundles.rows` and asserted by tools/check_pricing_sync.py,
# same contract as BANDS above.
BUNDLE_SIZES: Tuple[int, ...] = (1000, 3000, 5000, 10000)

# ── THE MODULES A TENANT TURNED ON, ON THE SUBSCRIPTION ITSELF ───────────────────────────────────
# Ventas · Compras · Reparto · Radar (product/pricing.json → `modules`). Ventas is the plan and is
# never optional, so only the other three are a choice and only they are recorded here.
#
# WHY THE SUBSCRIPTION AND NOT A COLUMN. Radar is «+15 % sobre tu factura», billed by adding an
# invoice item to the draft invoice on `invoice.created` (see `_on_invoice_created`). That handler
# gets a Stripe object and nothing else — it has a subscription id and no tenant until it reads one
# off metadata — so «does this tenant have Radar» has to be answerable from Stripe alone. Before
# this, NOTHING wrote it: the page sold Radar, the runbook specified the 15 %, and the flag the
# handler keys on was never stamped by any code path, so the surcharge could not have fired once.
#
# EVERY module is written on every Checkout, '1' or '', rather than only the ones that are on. A key
# that is present when true and absent when false makes «off» and «never asked» the same value, and
# that ambiguity is precisely the defect this same file carried in `metered` (brain/founder_prices.py,
# ORDERS_BILLING_KEY).
MODULE_IDS: Tuple[str, ...] = ("compras", "reparto", "radar")


def module_metadata(modules: Any) -> Dict[str, str]:
    """{'compras': '1'|'', 'reparto': …, 'radar': …} from whatever the caller has — a list of ids,
    a comma-separated string, or a {id: bool} mapping, because the plan selector, an operator tool
    and a Payment Link each hold the selection in a different shape. Unknown ids are dropped: this
    dict ends up on a live Stripe object, and it may only ever contain keys this file defines."""
    on: set = set()
    if isinstance(modules, dict):
        on = {str(k).strip().lower() for k, v in modules.items() if v}
    elif isinstance(modules, str):
        on = {p.strip().lower() for p in modules.split(",") if p.strip()}
    elif modules:
        on = {str(m).strip().lower() for m in modules}
    return {m: ("1" if m in on else "") for m in MODULE_IDS}


def _with_pinned_modules(modules: Any, pinned: Dict[str, Any]) -> Dict[str, bool]:
    """`modules`, with every module the founder's pinned PERIOD already buys turned on.

    A pinned period is a plan plus the lines that ride with it (brain/founder_prices.py), and one of
    those lines can be a module — Carlos's months 4–12 are quoted as «Plan Mediano con Compras
    dentro», so Compras is part of what he was told 1.998 € buys. The roster is the quote, exactly as
    it already is for his band and his cadence, so it decides this too rather than the plan selector.

    IT ONLY EVER TURNS THINGS ON. A module the caller ticked that is outside the founder's quote
    stays ticked and rides at the public price, because nobody quoted them a different one; and a
    module inside the quote can never be silently dropped by a caller that forgot to pass it. Returns
    the {id: bool} shape `module_metadata` already accepts, so nothing downstream learns a new one."""
    on = {k: bool(v) for k, v in module_metadata(modules).items()}
    for ln in (pinned.get("lines") or ()):
        if ln["role"] in MODULE_IDS:
            on[ln["role"]] = True
    return on


# A caller may name a band by its wire code ('peq'/'PEQ') or by its customer-facing name ('Pequeño').
# Both resolve to the same key, so the plan selector can send whichever it renders. The retired
# names stay so an old link or an old row still resolves to the band it was sold under.
BAND_ALIASES: Dict[str, str] = {
    "pequeño": "peq", "pequeno": "peq", "mediano": "med", "grande": "gra",
    "small": "s", "growth": "m",
}

# NO ALTA on Small or Growth (the settled shape). A self-serve Checkout builds ONE line item, the
# plan. The `alta` prices stay in Stripe and `alta_paid_at` stays on the row for tenants who bought
# under the older shape; Custom keeps an alta, and Custom is quoted and invoiced outside this module.
ALTA_AT_SELF_SERVE_CHECKOUT = False

# ── customer portal (spec §5: cards + cancellations self-serve; price switching disabled — an
# upgrade is a NEW Checkout so it lands on checkout.session.completed and we observe the band change).
PORTAL_METADATA_KEY = "pedidos_portal"
PORTAL_FEATURES: Dict[str, Any] = {
    "customer_update": {"enabled": True, "allowed_updates": ["email", "address", "tax_id"]},
    "invoice_history": {"enabled": True},
    "payment_method_update": {"enabled": True},
    "subscription_cancel": {"enabled": True, "mode": "at_period_end"},
    "subscription_update": {"enabled": False},
}


def band_key(band: str) -> str:
    """Normalize a band label ('S' / 's' / ' M ' / 'Small' / 'growth') to its BANDS key. Raises
    ValueError on an unknown band — a typo here must never silently fall through to the wrong price.
    Resolving a name says nothing about whether it can be BOUGHT; that is `is_sellable`."""
    k = (band or "").strip().lower()
    k = BAND_ALIASES.get(k, k)
    if k not in BANDS:
        raise ValueError(f"unknown pedidos band {band!r}: must be one of {sorted(BANDS)}")
    return k


def is_sellable(band: str) -> bool:
    """True when this band can go through self-serve Checkout — Small and Growth. Everything above
    Growth is Custom: a conversation and a quote (the settled shape). L and XL answer False; they are
    retained for tenants already on them, never sold again."""
    try:
        return bool(BANDS[band_key(band)].get("sellable"))
    except ValueError:
        return False


def band_name(band: str) -> str:
    """The customer-facing name for a band — 'Small', 'Growth'. Peter's own words."""
    return str(BANDS[band_key(band)]["name"])


def lookup_key(band: str, kind: str) -> str:
    """The stable Stripe Price lookup_key for (band, kind).

    kind ∈ 'mensual' | 'anual' | 'alta' | 'orders'. `orders` is the METERED per-order price the seat
    band is sold alongside — «desde 199 € + 0,60 €/pedido» — and it is provisioned under this same
    pattern by scripts/provision_stripe_v2.py, so the two must keep agreeing on the name."""
    return f"pedidos_{band_key(band)}_{kind}"


def bundle_lookup_key(band: str, qty: int) -> str:
    """The stable Stripe Price lookup_key for a prepaid bolsa of `qty` pedidos on this band.

    THE BAND IS PART OF THE KEY, and that is the whole point of the shape: a bolsa is a percentage
    off the band's OWN rate, so 5.000 pedidos is 2.700 € on Pequeño, 2.250 € on Mediano and 1.800 €
    on Grande. The band-agnostic `pedidos_bundle_{qty}` prices this replaced sold the biggest
    customers a bag dearer than metering — scripts/provision_stripe_v2.py §3 tells that story and
    mints these twelve, so the two must keep agreeing on the name."""
    return f"pedidos_bundle_{band_key(band)}_{int(qty)}"


def _product_key(band: str) -> str:
    return f"pedidos_{band_key(band)}_product"


# ──────────────────────────── mode-aware key selection (mirrors setupfee.py) ────────────────────────────
def _keys(is_test: bool) -> Tuple[str, str]:
    """(secret_key, webhook_secret) for the mode. Test reads the *_TEST env; live the mains — the SAME
    pair setupfee.py's onboarding alta and app.py's /api/stripe/webhook already use, so provisioning a
    second webhook endpoint in the Stripe dashboard is never required."""
    if is_test:
        return (getattr(config, "STRIPE_SECRET_KEY_TEST", "") or "",
                getattr(config, "STRIPE_WEBHOOK_SECRET_TEST", "") or "")
    return (getattr(config, "STRIPE_SECRET_KEY", "") or "",
            getattr(config, "STRIPE_WEBHOOK_SECRET", "") or "")


def enabled(is_test: bool = False) -> bool:
    """True when this mode can take a payment: the feature flag AND a secret key are both present."""
    if not getattr(config, "STRIPE_ENABLED", False):
        return False
    sk, _ = _keys(is_test)
    return bool(sk)


def _stripe(is_test: bool):
    import stripe
    sk, _ = _keys(is_test)
    stripe.api_key = sk
    stripe.max_network_retries = 2
    return stripe


def _stripe_mode_is_test() -> bool:
    """Stripe mode is a CONFIG decision, never a tenant-status one (shared contract #2,
    PEDIDOS-PRICING-BUILD.md). `tenants.status` starts 'test' for every tenant at signup and only
    flips to 'live' at the manual WhatsApp-binding step — which happens AFTER a tenant can already
    pay. Keying Stripe mode off tenant status would route every first paying customer's Checkout to
    TEST Stripe and lose the money. Reads `PEDIDOS_STRIPE_MODE` ('live'|'test'), defaulting to
    'live'. Read defensively (getattr) in case config.py hasn't grown the key yet — see this
    module's DEFECT-1 fix note for the exact line to add there."""
    mode = (getattr(config, "PEDIDOS_STRIPE_MODE", "live") or "live").strip().lower()
    return mode == "test"


def _add_months(dt: datetime, months: int) -> datetime:
    """Calendar-month add with day clamping (no dateutil dependency in requirements.txt)."""
    m0 = dt.month - 1 + months
    year = dt.year + m0 // 12
    month = m0 % 12 + 1
    days_in_month = [31, 29 if (year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)) else 28,
                     31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    day = min(dt.day, days_in_month[month - 1])
    return dt.replace(year=year, month=month, day=day)


# ──────────────────────────── payment methods (spec §5: "Card and SEPA") ────────────────────────────
# Spec §5 says card and SEPA debit, and nothing else. Two things make that awkward in practice:
#   · Naming `sepa_debit` explicitly makes EVERY checkout fail with InvalidRequestError unless the
#     account carries the capability. This live account does not — found by live smoke test 2026-08-11.
#   · Omitting `payment_method_types` entirely hands the decision to the dashboard, which currently
#     offers klarna, link, amazon_pay and satispay — consumer methods, on a €1.600 B2B invoice.
# So: always card, plus SEPA the moment the capability goes active. Peter enables it in the Stripe
# dashboard and it appears here on the next process start, with no deploy and no code change.
_SEPA_CAPABILITY: Dict[bool, bool] = {}


async def _payment_method_types(st, is_test: bool) -> List[str]:
    """CARD ONLY, DELIBERATELY (Peter, 2026-08-19: «Card only, drop SEPA entirely»).

    SEPA Core gives the payer an UNCONDITIONAL, no-questions-asked reversal for EIGHT WEEKS after
    any debit, and Stripe carries no SEPA B2B scheme. Every charge this file makes is a whole term
    up front — 597 € on the smallest quarter, 14.990 € on an annual Grande — so the account with
    the largest single payment is exactly the one that can be pulled back without a reason, months
    after the service was delivered. Refunding does not close it either: a payer can still raise
    the dispute after a refund and take both.

    A card dispute needs a stated reason and is defensible with the evidence this flow now keeps:
    the Checkout consent, `metadata.terms_version`, the invoice and the order meter.

    The capability probe is kept below, unused, because the decision is commercial rather than
    technical — if a B2B mandate scheme ever exists on the account, this is the one line to change.
    """
    return ["card"]


async def _sepa_capability(st, is_test: bool) -> bool:
    """Whether the account could take SEPA at all. Not consulted by the sale — see above."""
    if is_test not in _SEPA_CAPABILITY:
        try:
            acct = await asyncio.to_thread(st.Account.retrieve)
            caps = _sv(acct, "capabilities") or {}
            _SEPA_CAPABILITY[is_test] = _sv(caps, "sepa_debit_payments") == "active"
        except Exception as e:  # noqa: BLE001 — a capability probe must never block a sale
            log.warning("pedidos: sepa capability probe failed: %s", e)
            _SEPA_CAPABILITY[is_test] = False
    return _SEPA_CAPABILITY[is_test]


def _base_url() -> str:
    # app.soyrocoto.com — the Pedidos webapp's own host (DEMO_PUBLIC_BASE_URL is already pinned there,
    # see config.py's `sup_api`-cookie note); /billing is the "Tu suscripción" screen (routes.ts).
    return getattr(config, "DEMO_PUBLIC_BASE_URL", "https://app.soyrocoto.com").rstrip("/")


# ──────────────────────────── IVA — who owes it, and therefore who charges it ────────────────────
# ⚠️ CORRECTED 2026-08-19. Until today every line item carried a fixed 21 % Spanish TaxRate, so a
# Pequeño quarter billed 722,37 € under a page and a contract quoting 597 €. That is the wrong tax
# for this supply, and it is money we could not keep: **Leo Casa Limited is established in the United
# Kingdom and holds no Spanish VAT registration.**
#
# THE LAW (verified against BOE, 2026-08-19). A B2B service supplied to a business established in
# Spain is located in Spain — LIVA art. 69.Uno.1º, «con independencia de dónde se encuentre
# establecido el prestador» — and the taxable person is the CUSTOMER when the supplier is not
# established there: art. 84.Uno.2º.a), «Cuando las mismas se efectúen por personas o entidades no
# establecidas en el territorio de aplicación del Impuesto». So the supplier charges nothing and the
# invoice carries «inversión del sujeto pasivo» (RD 1619/2012 art. 6.1.m). The customer declares it
# on their own modelo 303, as output and input tax at once, netting to zero for them.
#
# The CIF stays mandatory — it is what proves the customer is a business — and no tax rate rides the
# sale. `tax_id_collection` never computed the reverse charge on its own: a manual TaxRate is applied
# exactly as written, which is how the 21 % got charged.
#
# THE DAY THE SPANISH SL EXISTS THIS FLIPS. A Spanish supplier billing a Spanish customer charges
# 21 % and files the 303 itself. That is one setting, not a rewrite: IVA_MODE = "charge_es" and the
# TaxRate below is attached again. Its create-or-find is kept intact for that day.
#
# Every Pedidos price is provisioned SIN IVA (tax_behavior='exclusive' — immutable once a price
# exists), which is what makes both modes possible off one catalogue.
IVA_MODE = "reverse_charge"          # "reverse_charge" (UK supplier) | "charge_es" (Spanish supplier)

# THE INVOICE HAS TO SAY WHY THERE IS NO IVA ON IT. Under reverse charge the Spanish rules do not
# merely permit the mention, they require it: RD 1619/2012 art. 6.1.m makes «inversión del sujeto
# pasivo» a mandatory content of the invoice. Without it the customer's gestor is holding a document
# that shows no tax and gives no reason, and the sale looks like an error rather than a treatment.
#
# It is stamped from `_on_invoice_created` rather than left to the Dashboard's default footer,
# because a footer someone typed into a settings page once is not in the repo, does not travel to a
# new account, and nobody notices when it is lost. Verified absent on the live account 2026-08-20
# (`settings.invoices.default_footer` was never set), which is exactly the failure mode.
IVA_FOOTER_ES = (
    "Operación no sujeta a IVA español: inversión del sujeto pasivo "
    "(art. 84.Uno.2º.a de la Ley 37/1992). El destinatario declara el impuesto. "
    "Leo Casa Limited · nº 16259714 · Londres, Reino Unido."
)
IVA_TAX_RATE_METADATA_KEY = "pedidos_iva_es"
_iva_tax_rate_cache: Dict[bool, Optional[str]] = {}


async def _tax_rates_for_line(st, is_test: bool) -> List[str]:
    """The `tax_rates` a line item carries — empty under reverse charge, which is the live mode.

    Returns [] rather than raising under reverse charge: there is no rate to find, so the old
    «refuse the checkout if the IVA rate is missing» guard would otherwise refuse every sale."""
    if IVA_MODE != "charge_es":
        return []
    rate = await _iva_tax_rate_id(st, is_test)
    if not rate:
        # charge_es only: never sell without the tax we owe.
        raise RuntimeError("iva_tax_rate_unavailable")
    return [rate]


async def _iva_tax_rate_id(st, is_test: bool) -> Optional[str]:
    """The 21% Spanish IVA TaxRate id for this Stripe mode. Returns None on ANY failure (list error,
    create error) — the caller MUST treat None as fatal and refuse the checkout rather than silently
    selling without IVA (spec §2's guard)."""
    if is_test in _iva_tax_rate_cache:
        return _iva_tax_rate_cache[is_test]
    try:
        found = await asyncio.to_thread(lambda: st.TaxRate.list(active=True, limit=100))
        for r in found.data:
            meta = _sv(r, "metadata") or {}
            if _sv(meta, IVA_TAX_RATE_METADATA_KEY) == "true":
                _iva_tax_rate_cache[is_test] = r["id"]
                return r["id"]
        created = await asyncio.to_thread(lambda: st.TaxRate.create(
            display_name="IVA",
            percentage=21,
            inclusive=False,
            country="ES",
            jurisdiction="ES",
            metadata={IVA_TAX_RATE_METADATA_KEY: "true"},
        ))
        _iva_tax_rate_cache[is_test] = created["id"]
        return created["id"]
    except Exception:  # noqa: BLE001
        log.exception("pedidos: IVA TaxRate create-or-find failed (mode test=%s)", is_test)
        return None


# ──────────────────────────── Checkout (one session, two line items) ────────────────────────────
async def create_checkout_session(tenant_slug: str, band: str, cadence: str,
                                  operator_email: str = "",
                                  modules: Any = None,
                                  vans: int = 0,
                                  bundle: int = 0) -> Dict[str, Any]:
    """ONE Stripe Checkout Session, mode='subscription', carrying ONE line item: the band's
    `mensual`|`anual` plan (recurring, qty 1), with 21% IVA on top. **Small and Growth carry no
    alta**, so the plan price plus IVA is the whole total and Stripe's order summary shows exactly
    that. Card + SEPA debit, EUR. tenant_slug/band/cadence/operator_email ride on BOTH the session and
    the resulting subscription's metadata (spec §5) so the webhook provisions without trusting the
    client a second time. A band above Growth is Custom and comes back `band_not_sellable`.

    A tenant on brain/founder_prices.py's roster resolves their own pinned `founder_*` price instead
    of the public band, at the cadence they were quoted — see the note at the top of the body.

    `modules` is the Compras/Reparto/Radar selection. It rides on the subscription metadata because
    that is the only place `_on_invoice_created` can read it from when it has to decide whether this
    month's invoice carries Radar's 15 %.

    `bundle` is the prepaid bolsa in pedidos, or 0. It is a ONE-OFF price on this same subscription
    Checkout — Stripe charges a non-recurring line item on the first invoice — so the customer pays
    the month and the bag in one act, which is what the page quotes them."""
    tenant_slug = (tenant_slug or "").strip()
    if not tenant_slug:
        return {"ok": False, "reason": "no_tenant"}

    # ── A PINNED FOUNDER PRICE WINS OVER THE PUBLIC LIST (brain/founder_prices.py) ──
    # Peter, 2026-08-14: «carlos gets sent his own link and his own stripe link, so that we can do the
    # public one and still score him without changing what i quoted him already.» A tenant on the
    # roster resolves their own `founder_<slug>_<cadence>` price, so every future public reprice
    # (create-new + transfer_lookup_key + archive-old) passes them by untouched. Resolved FIRST, so
    # their roster band and quoted cadence — not whatever the plan selector sent — are what the rest
    # of this function validates and what the tenant row ends up recording.
    # Matched on the workspace OR the signed-in operator's address (founder_prices.identify): Carlos
    # is quoted before he has a workspace, and the page is what he signs from, so an address is the
    # identifier that exists first. Passing both is what makes the roster reachable at all — keyed on
    # the slug alone it resolved nobody, because the roster row has no slug until his world is built.
    pinned = founder_prices.resolve(tenant_slug, cadence, operator_email)
    if pinned:
        band = pinned["band"] or band
        cadence = pinned["cadence"]
        # AND THE MODULES THEIR PERIOD ALREADY BUYS, for the same reason the band and the cadence are
        # taken from the roster rather than from the selector. Carlos's months 4–12 are quoted as
        # «Plan Mediano con Compras dentro» — Compras is INSIDE the 1.998 €, not something he re-picks
        # — so a session built from a caller who left it unticked would charge 249 € less than the
        # page he signed from says, every month, and leave him without a module he is paying for.
        # `_with_pinned_modules` only ever turns things ON: anything he adds beyond his quote
        # (Reparto, Radar) still rides at the public price, because nobody quoted him a different one.
        modules = _with_pinned_modules(modules, pinned)

    try:
        band = band_key(band)
    except ValueError:
        return {"ok": False, "reason": "bad_band"}
    if not is_sellable(band):
        # Above Growth is Custom: a conversation and a quote, never a self-serve Checkout. A clean,
        # renderable refusal — the caller shows the contact route, and this never raises or 500s.
        return {"ok": False, "reason": "band_not_sellable", "band": BANDS[band]["label"],
                "sellable_bands": [BANDS[b]["label"] for b in SELLABLE_BANDS]}
    cadence = (cadence or "").strip().lower()
    # A founder's cadence is whatever they were quoted ('trimestre'), which is deliberately not a
    # public one — the roster is the authority for them, so CADENCES only gates everybody else.
    if not pinned and cadence not in CADENCES:
        return {"ok": False, "reason": "bad_cadence"}

    # ── A SEAT BAND IS SOLD BY THE MONTH, AND SAYING SO HERE IS THE POINT (2026-08-16) ───────────
    # «Pago anual: dos meses gratis» was printed on /precios and on /plan, and no screen could buy
    # it: /plan sends `mensual` and always has. It could not have shipped as a control either. The
    # seat band is sold WITH a metered per-order price, Stripe requires every recurring item on one
    # subscription to share a billing interval, and provision_stripe_v2.py's own answer to that is
    # «An annual tenant's orders go on a second, monthly subscription» — a second subscription
    # nothing in this file mints. So an annual session would either be refused by Stripe or, worse,
    # complete without the item that bills the larger half of the invoice: at 1.500 pedidos a
    # Pequeño customer's orders are 900 € against a 199 € band, given away every month, silently.
    # The modules have no annual price on the page either, so the total could not even be quoted.
    #
    # The claim came off both surfaces in the same change (product/pricing.json §billing.footer).
    # This is the same fact, said in the place where it would otherwise be found by a customer.
    # The RETIRED ceiling bands keep `anual` — their prices exist, they carry no metered item, and a
    # tenant already on one is billed exactly as before. A founder's cadence is their roster's.
    # ⚠️ THIS REFUSED EVERY ANNUAL SALE UNTIL 2026-08-17, and the reason it gave was true at the
    # time: a metered month×1 item cannot ride a year×1 subscription, so an annual session would be
    # refused by Stripe or complete without the item that bills the larger half of the invoice.
    # The meter now has its own monthly subscription, so a yearly term and monthly usage coexist —
    # which is exactly what Peter asked for: «if they've done an annual, it will also be metered
    # each month». The guard is gone; the annual prices already exist for all three bands.

    # An existing ACTIVE subscription on the exact same band+cadence would bill the same plan twice —
    # refuse. A different band/cadence is an upgrade/switch and goes through (spec: price switching is
    # disabled in the PORTAL specifically because an upgrade is meant to be a fresh Checkout we observe).
    pool = db.get_pool()
    async with pool.acquire() as con:
        existing = await con.fetchrow(
            "select band, cadence, status from pedidos_subscription where tenant_id=$1",
            tenant_slug)
    if existing and existing["status"] == "active" and existing["band"] == band and existing["cadence"] == cadence:
        return {"ok": False, "reason": "already_subscribed"}

    is_test = _stripe_mode_is_test()
    if not enabled(is_test):
        return {"ok": False, "reason": "stripe_not_configured"}
    st = _stripe(is_test)
    plan_lk = pinned["lookup_key"] if pinned else lookup_key(band, cadence)

    def _resolve_price(lk: str):
        """The whole Price object for a lookup_key, or None. The bolsa needs the metadata Stripe
        carries on it — how many pedidos the bag holds and how long it is valid — which is the
        catalogue's own answer rather than a second copy of it living here."""
        found = st.Price.list(lookup_keys=[lk], limit=1)
        return found.data[0] if found.data else None

    def _resolve(lk: str) -> Optional[str]:
        price = _resolve_price(lk)
        return _sv(price, "id") if price else None

    try:
        plan_id = await asyncio.to_thread(_resolve, plan_lk)
    except Exception as e:  # noqa: BLE001
        log.warning("pedidos checkout price lookup failed for %s/%s: %s", tenant_slug, band, e)
        return {"ok": False, "reason": "price_lookup_failed", "detail": str(e)[:200]}
    if not plan_id:
        # The catalogue hasn't been provisioned in this mode yet — scripts/provision_stripe_pedidos.py
        # must run first. Never fabricate a price_data fallback here: the amounts are Peter's LOCKED
        # figures and must come from the one place they're declared (BANDS, read by provisioning too).
        return {"ok": False, "reason": "catalogue_not_provisioned"}

    try:
        line_tax = await _tax_rates_for_line(st, is_test)
    except RuntimeError:
        # charge_es mode only — under reverse charge there is no rate to be missing.
        return {"ok": False, "reason": "iva_tax_rate_unavailable"}

    # Per spec §11: success lands on the celebration, cancel returns to the in-flow plan selector with
    # the band still selected (?band=S|M — the same casing the pricing card and demo wall already
    # carry into ③, via BANDS[band]['label']).
    base = _base_url()
    success_url = f"{base}/bienvenida?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{base}/plan?band={BANDS[band]['label']}"
    # `alta_included` stays on the metadata as an explicit "" — the webhook reads it to decide whether
    # to stamp alta_paid_at, so a self-serve sale is recorded for what it is: a plan, no alta.
    meta = {"tenant_slug": tenant_slug, "band": band, "cadence": cadence,
           "operator_email": operator_email or "", "kind": CHECKOUT_KIND,
           # WHICH contract this sale was made under — see TERMS_VERSION.
           "terms_version": TERMS_VERSION,
           "alta_included": "1" if ALTA_AT_SELF_SERVE_CHECKOUT else "",
           # The module selection, and how this tenant's orders are billed. Both are read off the
           # SUBSCRIPTION later by code that has no database handle: `_on_invoice_created` decides
           # Radar's 15 % from `radar`, and brain/pedidos_usage_report.py decides whether to report a
           # MeterEvent at all from `orders_billing`. Written on every session, never conditionally.
           **module_metadata(modules),
           founder_prices.ORDERS_BILLING_KEY: founder_prices.ORDERS_BILLING_METERED}
    if pinned:
        # THE PRICE THEY WERE QUOTED, AND WHY NOTHING ELSE IS ADDED ON TOP. `orders_billing` is the
        # explicit model of the bundle-vs-metered choice (Peter, 2026-08-14: «my first customer will
        # get an order quantity bundle so they prepay it all rather than go on metered»). Carlos's
        # 1.347 €/trimestre ALREADY INCLUDES his 15.000 orders, so his subscription must carry no
        # per-order item and no usage may ever be reported for him — a founder who quietly picked up a
        # metered item on top of a prepaid quarter would be a named customer charged twice for the
        # same orders. Recorded on the session AND the subscription so the answer is readable off
        # Stripe alone, without this roster. It OVERWRITES the 'metered' default set above, which is
        # why the default is written unconditionally first: the ordinary customer's value and the
        # founder's value are both present facts, and neither is the absence of the other.
        meta.update({
            "founder": pinned["slug"],
            "pinned_lookup_key": pinned["lookup_key"],
            "includes_orders": pinned["includes_orders"],
            founder_prices.ORDERS_BILLING_KEY: pinned["orders_billing"],
        })

    # The seat band. Small and Growth have no alta, so this plus 21 % IVA is the recurring floor.
    line_items = [{"price": plan_id, "quantity": 1, "tax_rates": line_tax}]

    # ── AND THE ORDERS, WHICH ARE HALF THE PRICE ─────────────────────────────────────────────────
    # THE SEAT BAND IS NOT THE WHOLE SALE. The page quotes «desde 199 € + 0,60 €/pedido», and the
    # per-order half is the larger number for anyone real: at 1.500 pedidos a Pequeño customer owes
    # 900 € of orders on top of a 199 € band. Attaching only `plan_id` therefore does not undercharge
    # a little — it bills the minority of the invoice and silently gives every order away, on every
    # subscription, forever. Found in review before it reached a customer.
    #
    # A METERED PRICE TAKES NO `quantity`. Stripe rejects a quantity on a metered recurring item, and
    # the amount comes from usage reported against the meter (brain/pedidos_usage_report.py) rather
    # than from anything decided here.
    #
    # AND IT IS ATTACHED ONLY WHEN THIS TENANT IS ACTUALLY METERED. `orders_billing` above is the
    # explicit bundle-vs-metered decision: a founder on a pinned quarter, or anyone holding a live
    # prepaid bolsa, has ALREADY PAID for their orders, and adding a metered item on top would charge
    # a named customer twice for the same pedidos. That is the failure this branch exists to prevent,
    # so it reads the same key the usage reporter reads rather than re-deriving the answer.
    #
    # AND A FOUNDER WHO IS METERED IS METERED AT THEIR OWN RATE, WHICH IS THE WHOLE POINT (2026-08-15).
    # Until Carlos's year-1 prices existed, every founder was `included`, so this branch was
    # unreachable for one and `lookup_key(band, 'orders')` was safe by accident. His months 4–12 are
    # metered at 0,25 € — «tu tarifa por pedido se queda a la mitad, bloqueada hasta el mes 12» — and
    # the public MED price is 0,50 €. Reading the public key here would bill a named customer DOUBLE
    # the rate he was locked, on every order, while his plan line showed the pinned figure and the
    # invoice looked entirely normal. `line_key` returns '' for everybody else, so the public
    # catalogue is still what every non-founder resolves.
    if meta.get(founder_prices.ORDERS_BILLING_KEY) == founder_prices.ORDERS_BILLING_METERED:
        orders_lk = (founder_prices.line_key(pinned, founder_prices.ROLE_ORDERS)
                     or lookup_key(band, "orders"))
        try:
            orders_id = await asyncio.to_thread(_resolve, orders_lk)
        except Exception as e:  # noqa: BLE001
            log.warning("pedidos checkout orders-price lookup failed for %s/%s: %s",
                        tenant_slug, band, e)
            return {"ok": False, "reason": "price_lookup_failed", "detail": str(e)[:200]}
        if not orders_id:
            # FAIL CLOSED, exactly as the band price does. A Checkout that completes without the
            # metered item produces a subscription that can never bill for orders — and nothing
            # downstream would ever notice, because the invoice would simply be smaller. Refusing is
            # recoverable (run provisioning); a half-provisioned sale is not.
            log.error("pedidos: %s has no metered orders price (%s) — refusing checkout",
                      band, orders_lk)
            return {"ok": False, "reason": "catalogue_not_provisioned"}
        # ⚠️ THE METERED ITEM DOES NOT RIDE THIS SESSION ANY MORE (2026-08-17).
        #
        # The term is now prepaid — the seat fee and the modules are charged 3 months (or 12) in one
        # go — and Stripe permits exactly ONE billing interval per subscription. A month×3 plan and
        # a month×1 meter therefore cannot share a subscription; `Session.create` refuses the whole
        # thing. Peter wants both, and both are right: «all of it should always be the three months
        # up front… the metered per order would be a monthly thing, whatever they've used».
        #
        # So the meter is carried in metadata instead, and `_ensure_usage_subscription` mints it as
        # its own MONTHLY subscription on the same customer, against the card this Checkout already
        # saved. THE CUSTOMER STILL DOES ONE CHECKOUT AND PAYS ONCE; there are two rows in Stripe,
        # not two payments and not two cards.
        #
        # The fail-closed posture above is unchanged and still earns its keep: a price that does not
        # exist is refused HERE, before money moves, rather than discovered afterwards when there is
        # nothing left to refuse.
        meta["usage_price"] = orders_id
        meta["usage_lookup_key"] = orders_lk

    # ── AND THE MODULES THE PAGE JUST TOTALLED ───────────────────────────────────────────────────
    # THE PAGE AND THE BILL HAVE TO AGREE. Until 2026-08-15 the modules sat under «Cuando estén
    # listos» — chosen but not yet charged — so a Checkout carrying only the band was CORRECT. Peter
    # retired that split the same day («we dont do the hasnt shipped thing… if people pay i scramble
    # to make it»), which means the figure above the button now INCLUDES Compras and Reparto. A
    # session that omits them quotes a number Stripe will not take: the customer ticks Compras, reads
    # a total, pays less than it, and nobody finds out until the invoice.
    #
    # RADAR IS DELIBERATELY NOT HERE. It is 15 % of the rest of the bill, which is not expressible as
    # a Price — it is added to each invoice by `_on_invoice_created` from the `radar` flag in
    # `module_metadata`, already written onto both the session and the subscription above. Putting a
    # placeholder line here would double-charge it.
    mods = module_metadata(modules)
    if mods.get("compras"):
        # The founder's own pinned Compras where their period carries one, the public band price
        # otherwise — same rule, and the same reason, as the per-order rate above.
        cmp_lk = (founder_prices.line_key(pinned, founder_prices.ROLE_COMPRAS)
                  or f"compras_{band_key(band)}_{cadence}")
        try:
            cmp_id = await asyncio.to_thread(_resolve, cmp_lk)
        except Exception as e:  # noqa: BLE001
            log.warning("pedidos checkout compras lookup failed for %s: %s", tenant_slug, e)
            return {"ok": False, "reason": "price_lookup_failed", "detail": str(e)[:200]}
        if not cmp_id:
            log.error("pedidos: no Compras price %s — refusing checkout", cmp_lk)
            return {"ok": False, "reason": "catalogue_not_provisioned"}
        line_items.append({"price": cmp_id, "quantity": 1, "tax_rates": line_tax})

    # Reparto is priced PER FURGONETA, so it is the one module that carries a quantity. A tenant who
    # ticked it without saying how many vans is a selection we cannot price, and quoting them one van
    # would be inventing a number — so it is refused rather than guessed.
    if mods.get("reparto"):
        n_vans = max(0, int(vans or 0))
        if n_vans <= 0:
            return {"ok": False, "reason": "reparto_needs_vans"}
        try:
            van_id = await asyncio.to_thread(_resolve, f"reparto_van_{cadence}")
        except Exception as e:  # noqa: BLE001
            log.warning("pedidos checkout reparto lookup failed for %s: %s", tenant_slug, e)
            return {"ok": False, "reason": "price_lookup_failed", "detail": str(e)[:200]}
        if not van_id:
            log.error("pedidos: no Reparto price reparto_van_%s — refusing checkout", cadence)
            return {"ok": False, "reason": "catalogue_not_provisioned"}
        line_items.append({"price": van_id, "quantity": n_vans, "tax_rates": line_tax})

    # ── AND THE BOLSA THEY PREPAID, WHICH THE PAGE QUOTED AND NOTHING CHARGED ────────────────────
    # /precios prices a bolsa, offers it, prints it under the total («Pagar pedidos por adelantado ·
    # 5.000 pedidos · 2.700 €») and hands the app `&bundle=5000`. /plan shows the same row, chosen.
    # And the payload was {band, cadence, modules, vans}: the bag reached Stripe in NO form at all.
    # The customer read one figure, paid a smaller one, and owned no bolsa — so every pedido they
    # believed prepaid was metered at the published rate on top. Quoted and never charged, on the
    # one line the page sells as the way to pay less.
    #
    # A BOLSA IS A ONE-OFF, so it rides as a non-recurring price on this subscription Checkout,
    # which Stripe puts on the first invoice — the same act the customer performed on the page:
    # start the plan and buy the bag together. `quote()` in the webapp keeps it out of every monthly
    # figure for the same reason, and the summary prints it in its own group under the total.
    #
    # THE CATALOGUE IS THE AUTHORITY ON WHAT THE BAG IS. `orders` and `valid_months` are read off
    # the resolved Price rather than sent from the browser or copied into this file: the webhook
    # stamps a BALANCE and an EXPIRY from them, and a bag recorded with a guessed size or a guessed
    # expiry either bills a customer for pedidos he prepaid or gives away pedidos he did not.
    #
    # AND IT FAILS CLOSED, exactly as the band, the metered orders and the modules do. A session
    # that completes without the bolsa line takes the customer's money for a plan while the screen
    # they bought from says they hold 5.000 pedidos — the invoice looks ordinary and nothing
    # downstream ever notices. Refusing is recoverable; a half-sold bag is not.
    #
    # THE METERED ORDERS ITEM STAYS ON THE SUBSCRIPTION, and removing it would be the next bug. A
    # bolsa is a bag that RUNS OUT — «se va consumiendo según entran… válida 12 meses» — and the
    # rate takes over when it does. Nothing is double-charged in the meantime, because
    # brain/pedidos_usage_report.py reports no usage at all while the balance is live (`bundle:` in
    # `billed_via`) and resumes the moment it is exhausted or expires. A subscription with no
    # metered item could never resume, so the orders after the bag would be free forever.
    if bundle:
        try:
            qty = int(bundle)
        except (TypeError, ValueError):
            qty = 0
        if qty not in BUNDLE_SIZES:
            # a size nobody sells is bad input, not a missing price — see BUNDLE_SIZES' own note
            return {"ok": False, "reason": "bad_bundle", "sizes": list(BUNDLE_SIZES)}
        bundle_lk = bundle_lookup_key(band, qty)
        try:
            bundle_price = await asyncio.to_thread(_resolve_price, bundle_lk)
        except Exception as e:  # noqa: BLE001
            log.warning("pedidos checkout bolsa lookup failed for %s/%s: %s", tenant_slug, band, e)
            return {"ok": False, "reason": "price_lookup_failed", "detail": str(e)[:200]}
        if not bundle_price:
            log.error("pedidos: no bolsa price %s — refusing checkout", bundle_lk)
            return {"ok": False, "reason": "catalogue_not_provisioned"}
        bundle_meta = _sv(bundle_price, "metadata") or {}
        try:
            bundle_orders = int(str(_sv(bundle_meta, "orders") or "0").strip() or 0)
            bundle_months = int(str(_sv(bundle_meta, "valid_months") or "0").strip() or 0)
        except ValueError:
            bundle_orders = bundle_months = 0
        # A RECURRING PRICE UNDER THIS KEY WOULD BILL THE BAG EVERY MONTH, and a bag whose own
        # metadata disagrees with the size being sold would stamp the wrong balance. Both are the
        # catalogue being wrong about what this price is, which is the one thing this branch may
        # not shrug at: refuse, and let provisioning be re-run.
        if _sv(bundle_price, "recurring") or bundle_orders != qty or bundle_months <= 0:
            log.error("pedidos: bolsa price %s is not a one-off bag of %s pedidos with a validity "
                      "(orders=%s valid_months=%s recurring=%s) — refusing checkout",
                      bundle_lk, qty, bundle_orders, bundle_months,
                      bool(_sv(bundle_price, "recurring")))
            return {"ok": False, "reason": "catalogue_not_provisioned"}
        # WHAT THE WEBHOOK STAMPS THE BALANCE FROM. `_on_bundle_purchased` reads exactly these three
        # keys off the session, so the bag is recorded from the price that was actually charged.
        meta.update({"bundle_orders": str(qty),
                     "bundle_price": _sv(bundle_price, "id") or "",
                     "bundle_valid_months": str(bundle_months)})
        line_items.append({"price": _sv(bundle_price, "id"), "quantity": 1, "tax_rates": line_tax})

    pmts = await _payment_method_types(st, is_test)

    def _create():
        return st.checkout.Session.create(
            mode="subscription",
            payment_method_types=pmts,
            line_items=line_items,
            customer_email=(operator_email or None),
            subscription_data={"metadata": meta},
            metadata=meta,
            # THE CIF IS REQUIRED, NOT OFFERED (Peter, 2026-08-15: «it should make cif
            # mandatory»). `enabled` alone renders an optional field almost nobody fills in,
            # and the tax ID is what proves the buyer is a business — which is the condition
            # the reverse charge in IVA_MODE rests on. Without a CIF on it, a Spanish company
            # is holding an invoice their gestor cannot use. `if_supported` demands it wherever Stripe can
            # collect one and stays out of the way where it cannot.
            tax_id_collection={"enabled": True, "required": "if_supported"},
            # NO ACCEPTANCE, NO PAYMENT. Stripe renders the checkbox from the Terms-of-service URL
            # configured on the account (Settings → Checkout) and blocks the pay button until it is
            # ticked; the completed Session carries `consent.terms_of_service == "accepted"`. That
            # is the evidence, and `metadata.terms_version` says which text it was.
            consent_collection={"terms_of_service": "required"},
            # The default Stripe sentence is generic. This one names the two documents by their own
            # names, in Spanish, because the buyer is a Spanish distributor and the DPA is an annex
            # they are also accepting. Stripe caps this at 1200 characters.
            custom_text={"terms_of_service_acceptance": {
                "message": ("Acepto las Condiciones del servicio de Rocoto y su Anexo de "
                            "tratamiento de datos, y el cobro por adelantado del periodo que "
                            "contrato."),
            }},
            # Peter, 2026-08-11: he needs to walk the real flow end to end without paying, so
            # Checkout shows a promotion-code field and the FOUNDER code (100 % off, unlimited)
            # zeroes it. Same field a real discount would ride on later.
            allow_promotion_codes=True,
            locale="es",
            success_url=success_url,
            cancel_url=cancel_url,
        )

    try:
        session = await asyncio.to_thread(_create)
    except Exception as e:  # noqa: BLE001
        # THE ONE FAILURE THAT LOOKS LIKE A STRIPE OUTAGE AND IS A CHECKBOX IN A DASHBOARD.
        # `consent_collection` requires a Terms-of-service URL in the account's public details;
        # without it Stripe rejects EVERY session with a 400, and «stripe_error» would send whoever
        # is on call hunting an outage. Probed on 2026-08-19: unset in BOTH test and live mode.
        # Set it at https://dashboard.stripe.com/settings/public to https://soyrocoto.com/terminos,
        # once per mode. Fail closed either way — a sale with no recorded acceptance is the bug this
        # whole path exists to prevent.
        if "terms of service" in str(e).lower():
            log.error("pedidos checkout REFUSED: no Terms-of-service URL on the Stripe account. Set it "
                      "at dashboard.stripe.com/settings/public → https://soyrocoto.com/terminos, in "
                      "this mode (test=%s). No sale may complete without a recorded acceptance.",
                      is_test)
            return {"ok": False, "reason": "terms_url_not_set"}
        log.exception("pedidos checkout create failed for %s/%s/%s", tenant_slug, band, cadence)
        return {"ok": False, "reason": "stripe_error", "detail": str(e)[:200]}
    return {"ok": True, "url": _sv(session, "url"), "session_id": _sv(session, "id")}


# ──────────────────────────── Billing Portal ────────────────────────────
_portal_config_cache: Dict[bool, Optional[str]] = {}


async def _portal_configuration_id(st, is_test: bool) -> Optional[str]:
    """The Configuration provisioned by scripts/provision_stripe_pedidos.py (price switching OFF,
    cancel/payment-method update ON), found by its metadata tag. Cached per-mode for the process
    lifetime. Missing (not yet provisioned) → None, so the portal still opens on Stripe's account
    default rather than failing the request — fail-soft, never a 500 for a missing one-time setup step."""
    if is_test in _portal_config_cache:
        return _portal_config_cache[is_test]
    cfg_id = None
    try:
        found = await asyncio.to_thread(lambda: st.billing_portal.Configuration.list(limit=100))
        for c in found.data:
            meta = _sv(c, "metadata") or {}
            if _sv(meta, PORTAL_METADATA_KEY) == "true":
                cfg_id = c["id"]
                break
    except Exception:  # noqa: BLE001
        log.debug("pedidos portal configuration lookup failed", exc_info=True)
    _portal_config_cache[is_test] = cfg_id
    return cfg_id


async def billing_portal_url(tenant_slug: str) -> Dict[str, Any]:
    """A Stripe Billing Portal session url for tenant_slug's Pedidos subscription — cards and
    cancellations happen there, never through Peter (spec §5)."""
    tenant_slug = (tenant_slug or "").strip()
    if not tenant_slug:
        return {"ok": False, "reason": "no_tenant"}
    pool = db.get_pool()
    async with pool.acquire() as con:
        row = await con.fetchrow(
            "select stripe_customer_id from pedidos_subscription where tenant_id=$1", tenant_slug)
    cust_id = (row or {}).get("stripe_customer_id")
    if not cust_id:
        return {"ok": False, "reason": "no_subscription"}
    is_test = _stripe_mode_is_test()
    if not enabled(is_test):
        return {"ok": False, "reason": "stripe_not_configured"}
    st = _stripe(is_test)
    kwargs: Dict[str, Any] = {"customer": cust_id, "return_url": f"{_base_url()}/billing"}
    cfg_id = await _portal_configuration_id(st, is_test)
    if cfg_id:
        kwargs["configuration"] = cfg_id
    try:
        session = await asyncio.to_thread(lambda: st.billing_portal.Session.create(**kwargs))
    except Exception as e:  # noqa: BLE001
        log.warning("pedidos billing portal create failed for %s: %s", tenant_slug, e)
        return {"ok": False, "reason": "portal_failed", "detail": str(e)[:200]}
    return {"ok": True, "url": _sv(session, "url")}


# ──────────────────────────── webhook handlers ────────────────────────────
# ──────────────────────────── prepaid order bundles (STRIPE-V2-PLAN.md §5) ────────────────────────
# «Compras una bolsa de pedidos más barata que la tarifa de tu plan y se va consumiendo según entran.
# Válida 12 meses.» A bundle is a PURCHASE, never a lower rate: the plan's `per_order_cents` is
# untouched, the bag simply runs out and the published rate takes over.
#
# THE BALANCE LIVES ON THE SUBSCRIPTION, not in a table. It has to: brain/pedidos_usage_report.py
# decides «meter this order or draw it off the bag» from what Stripe tells it about the subscription,
# and the draw-down itself is derivable — `count(pedidos_order_usage where billed_via like 'bundle:%'
# and counted_at >= orders_prepaid_start)`. A second store would be a second truth.
PREPAID_KEYS = ("orders_prepaid", "orders_prepaid_start", "orders_prepaid_expires",
                "orders_prepaid_source", "orders_prepaid_session")


async def _on_bundle_purchased(obj, meta, tenant_slug: str, is_test: bool) -> Dict[str, Any]:
    """Stamp a paid prepaid bundle onto the tenant's live subscription so the reporter stops metering.

    Fires for any completed session whose metadata carries `bundle_orders`, which is now BOTH doors:
    a one-off `mode='payment'` Checkout on a `pedidos_bundle_<band>_<qty>` price (the operator route,
    for a bag bought on its own), and the self-serve `mode='subscription'` Checkout, where the bolsa
    the visitor picked on /precios rides as a one-off line item beside the plan (2026-08-16). The
    second door is why the balance is stamped from `_on_checkout_completed` as well: the money and
    the subscription arrive in the same event, and a bag that is paid for but never recorded means
    that customer is metered for orders he has already bought.

    Peter, 2026-08-14: «my first customer will get an order quantity bundle so they prepay it all
    rather than go on metered»."""
    if _sv(obj, "payment_status") not in ("paid", "no_payment_required"):
        return {"pending": True}
    try:
        qty = int(str(_sv(meta, "bundle_orders") or "0").strip() or 0)
    except ValueError:
        qty = 0
    if qty <= 0:
        return {"ignored": "bad_bundle_qty"}
    source = str(_sv(meta, "bundle_price") or "")

    pool = db.get_pool()
    async with pool.acquire() as con:
        sub_id = await con.fetchval(
            "select stripe_subscription_id from pedidos_subscription where tenant_id=$1", tenant_slug)
    if not sub_id:
        # Loud, because the money already moved. A bag with no subscription to hang on cannot
        # suppress metering, and the customer would be billed per order for orders he has paid for.
        log.error("pedidos bundle: %s bought %s orders with NO active subscription on file — "
                  "balance NOT recorded, needs manual reconciliation", tenant_slug, qty)
        return {"ignored": "no_subscription_for_bundle", "tenant_slug": tenant_slug}

    st = _stripe(is_test)
    try:
        sub = await asyncio.to_thread(lambda: st.Subscription.retrieve(sub_id))
    except Exception:  # noqa: BLE001
        log.exception("pedidos bundle: subscription retrieve failed for %s", sub_id)
        return {"error": "handler_error"}
    sub_meta = _sv_dict(sub, "metadata") or {}

    # ── ONE SESSION STAMPS ONE BAG (2026-08-16) ─────────────────────────────────────────────────
    # The balance STACKS by design: a bag bought while an earlier one is still live adds to it. That
    # makes a second run of this handler on the SAME purchase indistinguishable from a second
    # purchase — it would silently double the balance and hand the customer thousands of pedidos
    # nobody paid for. Stripe's own retry is fenced off by `pedidos_webhook_events`, but the plan
    # door now calls this from inside `_on_checkout_completed`, whose event IS re-delivered whenever
    # any later step of that handler fails and releases its claim. So the session id that paid for
    # the bag is stamped beside it, and a repeat of that session is a no-op rather than a gift.
    session_id = _sv(obj, "id") or ""
    if session_id and str(sub_meta.get("orders_prepaid_session") or "") == session_id:
        return {"handled": "bundle.already_recorded", "tenant_slug": tenant_slug,
                "bundle_orders": int(str(sub_meta.get("orders_prepaid") or "0") or 0)}

    # «Válida 12 meses» — read from the session, else off the bundle Price's own metadata, which
    # scripts/provision_stripe_v2.py stamps from product/pricing.json. NEVER defaulted: an invented
    # expiry either bills a customer for orders he prepaid or gives away orders he did not.
    months = 0
    for candidate in (_sv(meta, "bundle_valid_months"), None):
        try:
            months = int(str(candidate or "0").strip() or 0)
        except ValueError:
            months = 0
        if months:
            break
    if not months and source:
        try:
            price = await asyncio.to_thread(lambda: st.Price.retrieve(source))
            months = int(str(_sv(_sv(price, "metadata") or {}, "valid_months") or "0") or 0)
        except Exception:  # noqa: BLE001
            months = 0
    if months <= 0:
        log.error("pedidos bundle: no valid_months for %s (price %s) — balance NOT recorded rather "
                  "than stamped with a guessed expiry", tenant_slug, source or "—")
        return {"ignored": "no_bundle_validity"}

    now = datetime.now(timezone.utc)
    # STACKING. A bag bought while an earlier one is still live ADDS to it and keeps the earlier
    # start (so the orders already drawn still count against the balance) and the later expiry. A
    # bag bought after the last one lapsed starts clean.
    start, total = now, qty
    prior_expires = str(sub_meta.get("orders_prepaid_expires") or "")
    live_prior = False
    if prior_expires:
        try:
            live_prior = datetime.fromisoformat(prior_expires) > now
        except ValueError:
            live_prior = False
    expires = _add_months(now, months)
    if live_prior:
        try:
            start = datetime.fromisoformat(str(sub_meta.get("orders_prepaid_start") or ""))
            total = int(str(sub_meta.get("orders_prepaid") or "0") or 0) + qty
            expires = max(expires, datetime.fromisoformat(prior_expires))
        except ValueError:
            start, total = now, qty

    stamped = {**sub_meta, "orders_prepaid": str(total),
               "orders_prepaid_start": start.isoformat(),
               "orders_prepaid_expires": expires.isoformat(),
               "orders_prepaid_source": source,
               "orders_prepaid_session": session_id}
    try:
        await asyncio.to_thread(lambda: st.Subscription.modify(sub_id, metadata=stamped))
    except Exception:  # noqa: BLE001
        log.exception("pedidos bundle: could not stamp %s orders on %s", total, sub_id)
        return {"error": "handler_error"}
    log.info("pedidos bundle: %s now holds %s prepaid orders until %s", tenant_slug, total,
             expires.date().isoformat())
    # A DISTINCT `handled` VALUE, deliberately. app.py fires Peter's «they paid» alta alert on
    # `handled == 'checkout.session.completed'`, and a bag of orders is not a plan starting — that
    # alert would announce a new customer who has been one for months, with an empty band.
    return {"handled": "bundle.purchased", "bundle_orders": total, "tenant_slug": tenant_slug}


async def _ensure_usage_subscription(st, session, meta, sub, is_test: bool) -> Optional[str]:
    """Mint the MONTHLY metered subscription that carries the orders, and return its id.

    WHY IT EXISTS. The term is prepaid — 3 months or 12 in one go — and Stripe allows one billing
    interval per subscription, so the meter cannot sit beside it. Peter wants both, and both are
    right: the fee is a commitment and is paid for up front; usage is usage and is billed for what
    actually arrived. The customer sees one Checkout and one payment; this is a second row in
    Stripe, minted against the payment method that Checkout already saved.

    IDEMPOTENT ON PURPOSE. Stripe redelivers `checkout.session.completed`, and a duplicate here is
    not a duplicate row — it is a customer metered TWICE PER ORDER, because the meter aggregates by
    CUSTOMER and every metered item that customer holds reads the same events. So: look for a live
    one first, and pass an idempotency key derived from the session id, which makes a redelivery
    return the subscription the first call created rather than a second one.

    RETURNS None RATHER THAN RAISING. The money for the term has already moved by the time this
    runs; throwing here would fail the webhook and leave the tenant unprovisioned on top of an
    unmintable meter. The caller records what it got, and `pedidos_usage_report` refuses to settle
    a single order until a live metered item exists — so an absent meter costs a retry, never
    silent revenue loss."""
    price_id = (_sv(meta, "usage_price") or "").strip()
    if not price_id:
        return None                                   # bolsa / founder-included: nothing to meter
    cust_id = _sv(session, "customer") or (_sv(sub, "customer") if sub else None)
    if not cust_id:
        log.error("pedidos: cannot mint usage subscription — session carries no customer")
        return None

    def _existing() -> Optional[str]:
        subs = st.Subscription.list(customer=cust_id, status="all", limit=100)
        for x in subs.auto_paging_iter():
            if _sv(x, "status") in ("canceled", "incomplete_expired"):
                continue
            if (_sv(_sv_dict(x, "metadata") or {}, "role") or "") == "usage":
                return _sv(x, "id")
        return None

    try:
        found = await asyncio.to_thread(_existing)
    except Exception:  # noqa: BLE001
        log.warning("pedidos: usage-subscription lookup failed for %s", cust_id)
        found = None
    if found:
        return found

    # The card Checkout saved. Without it Stripe would try to charge a default the customer never
    # chose, and the first monthly usage invoice would fail on a subscription they never saw.
    pm = None
    if sub:
        pm = _sv(sub, "default_payment_method") or None
    if not pm:
        try:
            pm = await asyncio.to_thread(
                lambda: _sv(st.Customer.retrieve(cust_id, expand=["invoice_settings"]),
                            "invoice_settings") or None)
            pm = _sv(pm, "default_payment_method") if pm else None
        except Exception:  # noqa: BLE001
            pm = None

    # The SAME metadata the term subscription carries. `_on_invoice_created` gates Radar on
    # `kind` and `radar` being on the invoice's own subscription, so without this the 15 % would
    # apply to the prepaid term and to nothing else — and the orders are the larger half of the
    # bill for anyone real.
    umeta = {k: v for k, v in (meta or {}).items()
             if k in ("kind", "tenant_slug", "band", "radar", "compras", "reparto",
                      "operator_email", "orders_billing")}
    umeta["role"] = "usage"
    umeta["term_subscription"] = _sv(sub, "id") if sub else ""

    def _create():
        kw = {"customer": cust_id,
              "items": [{"price": price_id}],
              "metadata": umeta,
              "collection_method": "charge_automatically"}
        if pm:
            kw["default_payment_method"] = pm
        return st.Subscription.create(
            **kw, idempotency_key=f"rocoto_usage_{_sv(session, 'id')}")

    try:
        created = await asyncio.to_thread(_create)
    except Exception as e:  # noqa: BLE001
        log.exception("pedidos: usage subscription create failed for %s: %s", cust_id, e)
        return None
    uid = _sv(created, "id")
    log.info("pedidos: usage subscription %s minted for %s", uid, cust_id)
    return uid


async def _on_checkout_completed(obj, is_test: bool) -> Dict[str, Any]:
    # `obj` is a Stripe SDK StripeObject (the webhook Event's data.object — a Checkout Session), NOT a
    # plain dict — every read below MUST go through `_sv`, never `.get()`.
    meta = _sv(obj, "metadata") or {}
    if _sv(meta, "kind") != CHECKOUT_KIND:
        return {"ignored": "not_pedidos"}
    tenant_slug = (_sv(meta, "tenant_slug") or "").strip()
    band_raw = _sv(meta, "band") or ""
    # A BAG BOUGHT ON ITS OWN IS A PURCHASE, NOT A PLAN — routed before the band checks because it
    # carries no band and would otherwise fall out of this handler as `no_metadata` with the money
    # taken.
    #
    # «ON ITS OWN» IS THE LOAD-BEARING WORD (2026-08-16). Since the self-serve Checkout can carry a
    # bolsa BESIDE the plan, `bundle_orders` alone no longer identifies this door: a session with
    # both would have been diverted here, and the whole plan — the subscription row, the ceiling,
    # the welcome, Peter's «they paid» alert — would never have been recorded, while
    # `_on_bundle_purchased` looked for a subscription id that this handler had not yet written.
    # The band is what tells the two apart, so the band is what the branch reads. The plan path
    # stamps its own bolsa after the upsert, below.
    if tenant_slug and _sv(meta, "bundle_orders") and not band_raw:
        return await _on_bundle_purchased(obj, meta, tenant_slug, is_test)
    cadence = (_sv(meta, "cadence") or "mensual").strip().lower()
    operator_email = _sv(meta, "operator_email") or ""
    if not (tenant_slug and band_raw):
        return {"ignored": "no_metadata"}
    try:
        band = band_key(band_raw)
    except ValueError:
        return {"ignored": "bad_band"}
    if _sv(obj, "payment_status") not in ("paid", "no_payment_required"):
        return {"pending": True}
    # Small and Growth charge no alta, so this session stamps no alta_paid_at. The column is kept and
    # coalesced below, so a tenant who paid one under the older shape keeps their date and `/billing`
    # keeps showing what it covered. Only a session whose metadata says an alta rode along sets it.
    alta_included = (_sv(meta, "alta_included") or "").strip() == "1"

    # THE ACCEPTANCE, WRITTEN DOWN ON OUR SIDE TOO. Stripe holds the authoritative record on the
    # Session (`consent.terms_of_service`), and this line puts the same fact in our own log with the
    # tenant and the version beside it, so answering «what did they agree to, and when» never
    # depends on still having Stripe API access to a session id nobody wrote down. A session created
    # before consent collection existed reads as "", which is the honest answer for those sales.
    consent = _sv(obj, "consent") or {}
    log.info("pedidos terms accepted: tenant=%s session=%s consent=%s version=%s",
             tenant_slug, _sv(obj, "id"), _sv(consent, "terms_of_service") or "",
             _sv(meta, "terms_version") or "")

    sub_id = _sv(obj, "subscription")
    cust_id = _sv(obj, "customer")
    minimum_term_end: Optional[datetime] = None
    if sub_id:
        st = _stripe(is_test)
        try:
            sub = await asyncio.to_thread(lambda: st.Subscription.retrieve(sub_id))
        except Exception:  # noqa: BLE001
            log.warning("pedidos: subscription retrieve failed for %s", sub_id)
            sub = None
        if sub:
            cust_id = cust_id or _sv(sub, "customer")
            # EVERY BAND SELLS A TERM, so every monthly subscription gets a floor stamped on it.
            # This branch read `min_term_months` when that field was 0 for the seat bands, which
            # meant no floor was recorded for anybody who could actually buy — while /precios, the
            # app and /terms.html §5 all promised three months. The field is now 3 everywhere
            # (see BANDS above), so the guard is kept for the annual cadence, which pays the whole
            # year at once and needs no separate floor.
            if cadence == "mensual" and BANDS[band].get("min_term_months"):
                start_epoch = _sv(sub, "start_date") or _sv(sub, "created")
                if start_epoch:
                    start = datetime.fromtimestamp(start_epoch, tz=timezone.utc)
                    minimum_term_end = _add_months(start, int(BANDS[band]["min_term_months"]))
                    try:
                        await asyncio.to_thread(lambda: st.Subscription.modify(
                            sub_id, metadata={**(_sv_dict(sub, "metadata") or {}),
                                              "minimum_term_end": minimum_term_end.isoformat()}))
                    except Exception:  # noqa: BLE001
                        log.warning("pedidos: could not stamp minimum_term_end on %s", sub_id)

    ceiling = BANDS[band]["orders_ceiling"]
    pool = db.get_pool()

    # DEFECT-2 fix: an upgrade (a brand-new Checkout Session while a DIFFERENT subscription is
    # already on file for this tenant) must not orphan the old Stripe subscription — never cancelled,
    # still billing, unreachable by future webhooks. Cancel it before adopting the new one. Idempotent:
    # only fires when the ids differ and the old one isn't already gone; a failed cancel is logged
    # LOUDLY (never silently) and never blocks activating the new, already-paid-for subscription — the
    # customer already paid Stripe, refusing to record that here would just make things worse.
    async with pool.acquire() as con:
        prior = await con.fetchrow(
            "select stripe_subscription_id, stripe_usage_subscription_id "
            "from pedidos_subscription where tenant_id=$1", tenant_slug)
    prior_sub_id = prior["stripe_subscription_id"] if prior else None
    # ⚠️ AND THE OLD METER, WHICH IS THE ONE THAT DOUBLE-BILLS (2026-08-17). The meter aggregates
    # BY CUSTOMER: every metered subscription item that customer holds reads the same events. So a
    # band switch that cancels only the term leaves the previous usage subscription live, and every
    # pedido is then billed TWICE, at two different rates, on two invoices that both look ordinary.
    # It is cancelled here, in the same block and under the same rule — logged loudly on failure,
    # never blocking activation of a subscription the customer has already paid for.
    prior_usage_id = prior["stripe_usage_subscription_id"] if prior else None
    st_old = _stripe(is_test)

    async def _cancel_superseded(old_id: str, what: str) -> None:
        try:
            old_sub = await asyncio.to_thread(lambda: st_old.Subscription.retrieve(old_id))
        except Exception:  # noqa: BLE001
            old_sub = None
        if old_sub is not None and _sv(old_sub, "status") in ("canceled", "incomplete_expired"):
            return
        try:
            await asyncio.to_thread(lambda: st_old.Subscription.cancel(old_id))
            log.info("pedidos: canceled superseded %s subscription %s for %s (replaced by %s)",
                     what, old_id, tenant_slug, sub_id)
        except Exception:  # noqa: BLE001
            log.exception(
                "pedidos: FAILED to cancel superseded %s subscription %s for %s (replaced by %s) — "
                "tenant may now have TWO live Stripe subscriptions, needs manual reconciliation",
                what, old_id, tenant_slug, sub_id)

    if prior_sub_id and sub_id and prior_sub_id != sub_id:
        await _cancel_superseded(prior_sub_id, "term")
        if prior_usage_id:
            await _cancel_superseded(prior_usage_id, "usage")

    # THE METER, ON ITS OWN MONTHLY SUBSCRIPTION. Minted after the term is paid and before the row
    # is written, so the id lands in the same upsert and no webhook can arrive to a half-written
    # tenant. It returns None rather than raising when Stripe refuses — the term money has already
    # moved, and failing the webhook here would leave the tenant unprovisioned on top of an
    # unmintable meter. `pedidos_usage_report` then refuses to settle a single order until a live
    # metered item exists, so an absent meter costs a retry rather than revenue.
    usage_sub_id = await _ensure_usage_subscription(_stripe(is_test), obj, meta, sub, is_test)
    if _sv(meta, "usage_price") and not usage_sub_id:
        log.error("pedidos: %s paid the term but has NO usage subscription — orders will not bill "
                  "until one exists; usage rows stay unsettled meanwhile", tenant_slug)

    async with pool.acquire() as con:
        await con.execute(
            """insert into pedidos_subscription
                 (tenant_id, band, cadence, operator_email, stripe_customer_id, stripe_subscription_id,
                  stripe_usage_subscription_id,
                  status, minimum_term_end, alta_paid_at, priority_support_until, orders_ceiling,
                  warn_period, warned_80_at, warned_ceiling_at, updated_at)
               values ($1,$2,$3,$4,$5,$6,$10,'active',$7, $9, now() + interval '1 month', $8,
                       null, null, null, now())
               on conflict (tenant_id) do update set
                 band = excluded.band, cadence = excluded.cadence,
                 operator_email = coalesce(excluded.operator_email, pedidos_subscription.operator_email),
                 stripe_customer_id = excluded.stripe_customer_id,
                 stripe_subscription_id = excluded.stripe_subscription_id,
                 -- COALESCE, not overwrite: a re-delivered session that could not mint the meter
                 -- must never erase the one an earlier delivery already created.
                 stripe_usage_subscription_id = coalesce(excluded.stripe_usage_subscription_id,
                                                         pedidos_subscription.stripe_usage_subscription_id),
                 status = 'active', minimum_term_end = excluded.minimum_term_end,
                 alta_paid_at = coalesce(pedidos_subscription.alta_paid_at, excluded.alta_paid_at),
                 priority_support_until = excluded.priority_support_until,
                 orders_ceiling = excluded.orders_ceiling,
                 -- a band/cadence CHANGE resets this period's warn flags (a bigger ceiling can un-cross
                 -- the very threshold that was just flagged; a smaller one should be able to re-flag).
                 warn_period = case when pedidos_subscription.band = excluded.band
                                     then pedidos_subscription.warn_period else null end,
                 warned_80_at = case when pedidos_subscription.band = excluded.band
                                      then pedidos_subscription.warned_80_at else null end,
                 warned_ceiling_at = case when pedidos_subscription.band = excluded.band
                                           then pedidos_subscription.warned_ceiling_at else null end,
                 updated_at = now()""",
            tenant_slug, band, cadence, (operator_email or None), cust_id, sub_id, minimum_term_end,
            ceiling, (datetime.now(timezone.utc) if alta_included else None), usage_sub_id)

    # ── THE BOLSA THAT RODE WITH THE PLAN (2026-08-16) ──────────────────────────────────────────
    # The visitor picked a bag on /precios, it was charged as a one-off line on this very session,
    # and the BALANCE it buys lives on the subscription's own metadata — which is where
    # brain/pedidos_usage_report.py looks before deciding to meter a pedido. Stamped here, after the
    # upsert, because that row is what tells `_on_bundle_purchased` which subscription is theirs.
    #
    # The same handler the standalone purchase takes, deliberately: one place computes an expiry and
    # stacks a balance, and it is already idempotent per session. The result is carried rather than
    # returned, so the plan's own `handled` value still reaches app.py's «they paid» alert — and so
    # the welcome below still goes out on this pass even when the stamp has to be retried.
    bundle_res: Dict[str, Any] = {}
    if _sv(meta, "bundle_orders"):
        bundle_res = await _on_bundle_purchased(obj, meta, tenant_slug, is_test)

    # THE WELCOME (Peter, 2026-08-12: «of course do an email on checkout!!! with logo and congrats
    # and shit like this. nice feel to it»). Deliberately AFTER the upsert and deliberately
    # fail-soft: the row above is what actually grants the plan, and no email problem — a bad
    # address, a Resend outage, a template bug — may ever stand between a paying customer and the
    # thing they just bought. `send_welcome` claims its own send in the DB, so Stripe's retries
    # cannot mail them twice.
    try:
        import brain.pedidos_welcome_email as welcome
        tenant_name = ""
        try:
            async with pool.acquire() as con:
                tenant_name = await con.fetchval(
                    "select name from tenants where slug = $1", tenant_slug) or ""
        except Exception:  # noqa: BLE001
            tenant_name = ""
        # THE FACTURA RIDES ALONG (Peter, 2026-08-12: «could we give them their invoice from Stripe
        # there too […] as pdf attachment»). Stripe sends its own receipt, but this is the email a
        # Spanish customer forwards to their gestor, so the document belongs IN it.
        #
        # The session carries only an invoice ID, so it has to be retrieved for the URLs. Both are
        # fetched here rather than inside the email module to keep every Stripe call on the money
        # path, where the key and the test/live switch already live. Fail-soft: a missing invoice
        # costs the attachment, never the welcome.
        inv_url = inv_pdf = ""
        try:
            # `_sv`, NEVER `.get()` — 2026-08-14. This block shipped on 2026-08-13 using `.get()` on
            # a StripeObject, which raises AttributeError on stripe 15.x (StripeObject.__getattr__
            # treats "get" as a literal key lookup). The surrounding `except` then swallowed it every
            # single time, so the welcome went out with no factura and no link while the logs quietly
            # recorded a failure nobody read. The helper directly above exists for exactly this and
            # its own docstring says so; the rule is only worth having if it is followed here too.
            inv_id = _sv(obj, "invoice")
            if inv_id:
                inv = await asyncio.to_thread(
                    _stripe(is_test).Invoice.retrieve, inv_id)
                inv_url = _sv(inv, "hosted_invoice_url") or ""
                inv_pdf = _sv(inv, "invoice_pdf") or ""
        except Exception:  # noqa: BLE001
            log.exception("pedidos: invoice lookup failed for %s (welcome still sends)", tenant_slug)
        await welcome.send_welcome(pool, tenant_slug, band, cadence,
                                   (operator_email or ""), BANDS, "es", tenant_name,
                                   inv_url, inv_pdf)
    except Exception:  # noqa: BLE001
        log.exception("pedidos: welcome email failed for %s (fail-soft, plan is active)", tenant_slug)

    # A BAG THAT WAS PAID FOR AND NOT RECORDED IS WORTH A REDELIVERY. The plan is granted either
    # way — the row is written, the welcome is out — but a missing balance meters a customer for
    # pedidos he has already bought, every day, until somebody notices. Answering `handler_error`
    # makes app.py 5xx so Stripe retries, and every step of this handler survives a second pass: the
    # upsert is `on conflict`, the welcome claims its own send, and the bolsa stamp is fenced on the
    # session id. `ignored` is NOT retried — those are the two refusals that say the bag cannot be
    # recorded from what Stripe holds (no validity, no subscription), which no retry improves.
    if bundle_res.get("error"):
        log.error("pedidos: %s paid for a %s-pedido bolsa on session %s and the balance did not "
                  "land — asking Stripe to redeliver", tenant_slug,
                  _sv(meta, "bundle_orders") or "?", _sv(obj, "id") or "?")
        return {"error": "handler_error"}

    out: Dict[str, Any] = {"handled": "checkout.session.completed", "tenant_slug": tenant_slug,
                           "band": band}
    if bundle_res.get("bundle_orders"):
        out["bundle_orders"] = bundle_res["bundle_orders"]
    return out


async def _on_subscription_updated(obj, is_test: bool) -> Dict[str, Any]:
    # `obj` is the webhook Event's data.object — a Subscription StripeObject, not a dict.
    sub_id = _sv(obj, "id")
    if not sub_id:
        return {"ignored": "no_sub_id"}
    pool = db.get_pool()
    async with pool.acquire() as con:
        row = await con.fetchrow(
            "select tenant_id, cadence, minimum_term_end from pedidos_subscription "
            "where stripe_subscription_id=$1 or stripe_usage_subscription_id=$1", sub_id)
    if not row:
        return {"ignored": "not_pedidos_sub"}

    now = datetime.now(timezone.utc)
    mte = row["minimum_term_end"]
    cancel_at_period_end = bool(_sv(obj, "cancel_at_period_end"))
    cancel_at = _sv(obj, "cancel_at")
    # ── the minimum-term rewrite (spec §5): a monthly plan cancelled BEFORE its 3-month floor is
    # rewritten to land exactly on that floor instead — the cancellation still happens without Peter,
    # it just can't leave before the committed term. Skip if this event IS that rewrite landing back
    # (cancel_at already equals the floor) — Stripe's own confirmation of our own modify, not a new ask.
    if (row["cadence"] == "mensual" and mte and now < mte and cancel_at_period_end
            and cancel_at != int(mte.timestamp())):
        st = _stripe(is_test)
        try:
            await asyncio.to_thread(lambda: st.Subscription.modify(
                sub_id, cancel_at_period_end=False, cancel_at=int(mte.timestamp())))
            cancel_at_period_end, cancel_at = False, int(mte.timestamp())
        except Exception:  # noqa: BLE001
            log.exception("pedidos: minimum-term rewrite failed for %s", sub_id)

    cpe = _sv(obj, "current_period_end")
    cpe_dt = datetime.fromtimestamp(cpe, tz=timezone.utc) if cpe else None
    cancel_dt = datetime.fromtimestamp(cancel_at, tz=timezone.utc) if cancel_at else None
    async with pool.acquire() as con:
        await con.execute(
            "update pedidos_subscription set status=$2, current_period_end=$3, cancel_at=$4, "
            "updated_at=now() where stripe_subscription_id=$1 or stripe_usage_subscription_id=$1",
            sub_id, _sv(obj, "status") or "active", cpe_dt, cancel_dt)
    return {"handled": "customer.subscription.updated"}


async def _on_subscription_deleted(obj) -> Dict[str, Any]:
    # `obj` is the webhook Event's data.object — a Subscription StripeObject, not a dict.
    sub_id = _sv(obj, "id")
    if not sub_id:
        return {"ignored": "no_sub_id"}
    pool = db.get_pool()
    async with pool.acquire() as con:
        n = await con.fetchval(
            "update pedidos_subscription set status='canceled', updated_at=now() "
            "where stripe_subscription_id=$1 or stripe_usage_subscription_id=$1 returning tenant_id", sub_id)
    if not n:
        return {"ignored": "not_pedidos_sub"}
    return {"handled": "customer.subscription.deleted"}


async def _on_invoice_event(obj, ok: bool) -> Dict[str, Any]:
    """invoice.paid / invoice.payment_failed — keep status honest (spec §5). Matched by subscription
    id (never by customer id alone: a customer can hold subscriptions on other Stripe products in the
    same account). `obj` is the webhook Event's data.object — an Invoice StripeObject, not a dict."""
    sub_id = _invoice_subscription_id(obj)
    if not sub_id:
        return {"ignored": "no_sub_id"}
    pool = db.get_pool()
    async with pool.acquire() as con:
        n = await con.fetchval(
            "update pedidos_subscription set status=$2, updated_at=now() "
            "where stripe_subscription_id=$1 or stripe_usage_subscription_id=$1 returning tenant_id",
            sub_id, ("active" if ok else "past_due"))
    if not n:
        return {"ignored": "not_pedidos_sub"}
    return {"handled": "invoice.paid" if ok else "invoice.payment_failed"}


# ──────────────────────────── Radar's 15 % (STRIPE-V2-PLAN.md §4) ────────────────────────────
# «Se activa una vez y cubre todos los módulos que tengas contratados. Si un mes vendes poco, cuesta
# poco.» — the page. A percentage of a variable bill is not a Price object and does not need to be:
# the standard Stripe shape is an INVOICE ITEM added to the draft invoice before it finalises, so the
# charge is always exactly 15 % of what that tenant actually had that month.
#
# The Product carries no price; it exists so the invoice line has a stable identity in Stripe's
# reporting. Found by the metadata key scripts/provision_stripe_v2.py stamps, cached per mode for the
# process lifetime — the same create-or-find shape `_iva_tax_rate_id` and `_portal_configuration_id`
# already use, except this one NEVER creates: the catalogue is provisioned by that script and a
# product invented here would be a second Radar in the dashboard with no plan behind it.
RADAR_PRODUCT_KEY = "radar_product"
RADAR_LINE_METADATA_KEY = "rocoto_radar"     # the tag that makes the surcharge recognisable on sight
_radar_product_cache: Dict[bool, Optional[str]] = {}


def _radar_pct() -> int:
    """Read the quote module's Radar percentage, checked against backend/pricing.json by
    tests/vital_term_split.py. The quote and billing rail share this runtime value.
    Imported inside the function because pricing_quote imports BANDS from this module — at call time
    both are long since loaded, so the cycle never forms."""
    from brain.pricing_quote import RADAR_PCT
    return int(RADAR_PCT)


def _radar_description(pct: int, base_cents: int) -> str:
    """«Radar · 15 % de 403,00 €» — the line the customer reads on the invoice.

    THE PERCENTAGE ALWAYS ARRIVES WITH THE FIGURE IT IS 15 % OF. That is the rule the copy deck sets
    for the same number on /precios («Radar's toggle shows its 15 % as a euro figure of the current
    subtotal, so it is never abstract», PRICING-COPY-ES.md), and an invoice is the surface where an
    abstract percentage is worst — it is what a gestor reconciles. Same construction and the same
    Spanish euro formatter brain/pricing_quote.py already renders it with, so the quote a customer was
    sent and the invoice they receive read alike rather than merely agreeing arithmetically."""
    from brain.pricing_quote import eur
    return f"Radar · {pct} % de {eur(int(base_cents), 'es')}"


async def _radar_product_id(st, is_test: bool) -> Optional[str]:
    """The Radar Product id for this Stripe mode, or None when the catalogue has not been
    provisioned. None is FATAL to the surcharge and never a reason to invent a product."""
    if is_test in _radar_product_cache:
        return _radar_product_cache[is_test]
    pid = None
    try:
        found = await asyncio.to_thread(lambda: st.Product.search(
            query=f"metadata['rocoto_product_key']:'{RADAR_PRODUCT_KEY}'", limit=1))
        if found.data:
            pid = found.data[0].id
    except Exception:  # noqa: BLE001
        log.exception("pedidos: radar product lookup failed (mode test=%s)", is_test)
        return None            # NOT cached: a transient search failure must not disable Radar for
        #                        the life of the process, which a cached None would do.
    _radar_product_cache[is_test] = pid
    return pid


async def _on_invoice_created(obj, is_test: bool) -> Dict[str, Any]:
    """Add Radar's 15 % to a draft subscription invoice before Stripe finalises it.

    THE THREE GUARDS, each of which is a real bill if it is missing:

      1. IDEMPOTENT PER INVOICE. Stripe redelivers webhooks by contract. A line already tagged
         `rocoto_radar` aborts the whole handler, and the create additionally carries an
         idempotency_key derived from the invoice id — two independent layers, because the first one
         loses a race between two simultaneous deliveries and the second one only covers 24 hours.
      2. SKIPPED WHEN RADAR IS OFF. Driven by `subscription.metadata.radar`, stamped at Checkout from
         the module selection. Never a schema change: the flag rides on the object Stripe hands us.
      3. EXCLUDED FROM ITS OWN BASE. The base is summed from the invoice's own lines, skipping any
         radar-tagged one, rather than read off `invoice.subtotal` — on a redelivery the subtotal
         already includes Radar, and 15 % of 115 % is a bill nobody agreed to.

    Timing: Stripe finalises a draft subscription invoice about an hour after `invoice.created`, so
    this runs well inside the window. `invoice.created` must be enabled on the endpoint in the Stripe
    dashboard (STRIPE-V2-PLAN.md §4c) — that list is dashboard state, not code, and without it this
    handler is simply never called."""
    if _sv(obj, "status") != "draft":
        # An invoice can only be edited while it is a draft. Anything else is already finalised and
        # adding to it would either fail or, worse, land on the NEXT invoice.
        return {"ignored": "not_draft"}
    inv_id = _sv_id(_sv(obj, "id"))
    sub_id = _invoice_subscription_id(obj)
    cust_id = _sv_id(_sv(obj, "customer"))

    # ── the reverse-charge legend, on EVERY draft invoice ────────────────────────────────────────
    # Before the subscription checks below, because a one-off invoice needs the mention just as much
    # as a subscription one, and `not_a_subscription_invoice` returns before them. Idempotent: a
    # redelivered webhook finds the footer already there and leaves it alone.
    if inv_id and IVA_MODE == "reverse_charge" and not (_sv(obj, "footer") or "").strip():
        try:
            await asyncio.to_thread(
                lambda: _stripe(is_test).Invoice.modify(inv_id, footer=IVA_FOOTER_ES))
        except Exception:  # noqa: BLE001
            # Never fail the invoice over its footer: a bill that goes out without the mention is a
            # problem, a bill that does not go out at all is a bigger one.
            log.warning("pedidos: could not stamp the IVA footer on %s", inv_id, exc_info=True)

    if not (inv_id and sub_id):
        return {"ignored": "not_a_subscription_invoice"}

    st = _stripe(is_test)
    try:
        sub = await asyncio.to_thread(lambda: st.Subscription.retrieve(sub_id))
    except Exception:  # noqa: BLE001
        log.warning("pedidos radar: subscription retrieve failed for %s", sub_id)
        return {"error": "handler_error"}
    sub_meta = _sv(sub, "metadata") or {}
    if _sv(sub_meta, "kind") != CHECKOUT_KIND:
        return {"ignored": "not_pedidos"}
    if _sv(sub_meta, "radar") != "1":
        return {"ignored": "radar_off"}
    cust_id = cust_id or _sv_id(_sv(sub, "customer"))
    if not cust_id:
        return {"ignored": "no_customer"}

    try:
        lines = await asyncio.to_thread(lambda: st.Invoice.list_lines(inv_id, limit=100))
    except Exception:  # noqa: BLE001
        log.warning("pedidos radar: could not read lines of %s", inv_id)
        return {"error": "handler_error"}
    # ⚠️ RADAR IS 15 % OF THE RECURRING BILL, NEVER OF A ONE-OFF — 2026-08-16, caught in review the
    # same day the bolsa line item shipped. This loop summed EVERY line on the draft invoice, so a
    # customer who bought a 2.250 € bolsa with Radar on would have been charged 337,50 € on top of
    # it — an amount NO SURFACE EVER QUOTED. /precios and /plan both compute Radar on the MONTHLY
    # subtotal and show the bolsa as a separate one-off underneath it, so the invoice must do the
    # same or the page and the card disagree about a number the customer already read.
    #
    # A prepaid bolsa is also the wrong thing to surcharge on principle: it is money paid in advance
    # for orders that have not happened, and Radar's own promise is «si un mes vendes poco, cuesta
    # poco» — a percentage of a lump sum is the opposite of that.
    #
    # The test is the PRICE, not the amount: a one-off has no `recurring`. That is the same fact the
    # checkout builder uses to refuse a "bolsa" that came back recurring, so both ends read one
    # property rather than trusting a metadata flag somebody could forget to write.
    base = 0
    for ln in lines.auto_paging_iter():
        if _sv(_sv(ln, "metadata") or {}, RADAR_LINE_METADATA_KEY) == "1":
            return {"ignored": "radar_already_added", "invoice": inv_id}
        price = _sv(ln, "price") or _sv(_sv(ln, "pricing") or {}, "price_details")
        if price is not None and not _sv(price, "recurring"):
            continue        # one-off (a prepaid bolsa): never part of Radar's base
        base += int(_sv(ln, "amount") or 0)

    pct = _radar_pct()
    # HALF-UP, IN INTEGERS, LIKE THE THREE SURFACES THAT QUOTED IT. `round()` is banker's rounding
    # and operates on a float here, which is the exact defect just corrected in pricing_quote.py,
    # plans.ts and the landing island — and this is the path that actually TAKES the money, so a
    # divergence here bills a customer a cent away from every figure they were shown. `(2n + d) //
    # (2d)` is floor(x + 0.5) with no float anywhere near it.
    amount = (2 * base * pct + 100) // 200
    if amount <= 0:
        # A zero (or credited) month costs zero — «Si un mes vendes poco, cuesta poco» taken to its
        # end. Adding a 0 € line would just be noise on the customer's invoice.
        return {"ignored": "nothing_to_surcharge", "base_cents": base}

    try:
        radar_tax = await _tax_rates_for_line(st, is_test)
    except RuntimeError:
        radar_tax = None
    if radar_tax is None:
        # NEVER bill sin IVA (spec §2). A retryable error, not a silent skip: Stripe redelivers and
        # the draft is still open for the best part of an hour.
        return {"error": "handler_error"}
    product_id = await _radar_product_id(st, is_test)
    if not product_id:
        log.error("pedidos radar: %s has radar on but the Radar product is not provisioned in this "
                  "mode — surcharge NOT added to %s (run scripts/provision_stripe_v2.py)", sub_id, inv_id)
        return {"error": "handler_error"}

    def _create():
        return st.InvoiceItem.create(
            customer=cust_id, invoice=inv_id, quantity=1,
            description=_radar_description(pct, base),
            price_data={"product": product_id, "currency": EUR,
                        "unit_amount": int(amount), "tax_behavior": "exclusive"},
            tax_rates=radar_tax,
            metadata={RADAR_LINE_METADATA_KEY: "1", "kind": CHECKOUT_KIND,
                      "pct": str(pct), "base_cents": str(base), "tenant_slug":
                          str(_sv(sub_meta, "tenant_slug") or "")},
            # The second idempotency layer (guard 1). Keyed on the invoice, so two deliveries of the
            # same event that both get past the line scan still produce ONE invoice item.
            idempotency_key=f"rocoto_radar_{inv_id}",
        )

    try:
        await asyncio.to_thread(_create)
    except Exception:  # noqa: BLE001
        log.exception("pedidos radar: InvoiceItem.create failed for %s (invoice %s)", sub_id, inv_id)
        return {"error": "handler_error"}
    log.info("pedidos radar: added %s c (%s %% of %s c) to %s", amount, pct, base, inv_id)
    return {"handled": "invoice.created", "radar_cents": amount, "base_cents": base}


async def handle_webhook(payload: bytes, sig_header: str) -> Dict[str, Any]:
    """Verify (live then test secret) + handle one Stripe event. Idempotent on event.id via
    pedidos_webhook_events — a redelivery is a no-op insert, never re-processed. Never raises; a
    genuine retry-worthy failure comes back as {"error": "handler_error"} so the caller can 5xx and
    let Stripe redeliver."""
    import stripe
    event = None
    for is_test in (False, True):
        _, whsec = _keys(is_test)
        if not whsec:
            continue
        try:
            event = stripe.Webhook.construct_event(payload, sig_header, whsec)
            break
        except Exception:
            event = None
    if event is None:
        return {"error": "bad_signature"}

    # `event` is a Stripe SDK StripeObject (returned by construct_event) — and so is its nested
    # `.data`, and so is `.data.object` (the actual Session/Subscription/Invoice). None of them support
    # `.get()`; every read here goes through `_sv`.
    event_id = _sv(event, "id") or ""
    etype = _sv(event, "type") or ""
    event_data = _sv(event, "data") or {}
    obj = _sv(event_data, "object") or {}
    is_test = not bool(_sv(event, "livemode"))

    pool = db.get_pool()
    if event_id:
        async with pool.acquire() as con:
            won = await con.fetchval(
                "insert into pedidos_webhook_events (event_id, event_type) values ($1,$2) "
                "on conflict (event_id) do nothing returning event_id", event_id, etype)
        if not won:
            return {"ignored": "duplicate_event"}

    res: Dict[str, Any]
    try:
        if etype == "checkout.session.completed":
            res = await _on_checkout_completed(obj, is_test)
        elif etype == "customer.subscription.updated":
            res = await _on_subscription_updated(obj, is_test)
        elif etype == "customer.subscription.deleted":
            res = await _on_subscription_deleted(obj)
        elif etype == "invoice.created":
            res = await _on_invoice_created(obj, is_test)
        elif etype == "invoice.paid":
            res = await _on_invoice_event(obj, True)
        elif etype == "invoice.payment_failed":
            res = await _on_invoice_event(obj, False)
        else:
            res = {"ignored": etype}
    except Exception:
        log.exception("pedidos_billing webhook handling failed for %s", etype)
        res = {"error": "handler_error"}

    # ⚠️ A FAILED HANDLER MUST RELEASE ITS IDEMPOTENCY CLAIM (2026-08-15).
    #
    # The claim is taken BEFORE the work, which is the only way to make concurrent deliveries of the
    # same event safe. But app.py 5xxs on `handler_error` precisely so Stripe redelivers — and the
    # redelivery carries the SAME event id, so it hit the row above and returned `duplicate_event`
    # without ever re-running the handler. Every retry was therefore a no-op, and one transient
    # failure (a Stripe read timing out, the IVA rate momentarily unresolvable) silently and
    # permanently dropped that event's effect. On Radar that is an entire month's 15 % on a real
    # invoice, lost with a 500 in a log and nothing else.
    #
    # Deleting the row on failure returns the event to «never processed», which is exactly what it
    # is. It does not weaken the guard for the successful path — a handled event keeps its row
    # forever — and the handlers are each independently idempotent anyway (the Radar line scan, the
    # `on conflict` upsert, `reported_at`), so a re-run of one that partly succeeded is safe.
    if event_id and res.get("error"):
        try:
            async with pool.acquire() as con:
                await con.execute("delete from pedidos_webhook_events where event_id = $1", event_id)
        except Exception:  # noqa: BLE001
            log.exception("pedidos: could not release the webhook claim on %s — Stripe's retry of "
                          "this event will be ignored as a duplicate", event_id)
    return res
