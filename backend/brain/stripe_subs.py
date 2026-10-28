"""Rocoto's Stripe SUBSCRIPTIONS layer — OUR SaaS billing of the supplier for their AI employees.

DISTINCT from brain/stripe_connect.py: Connect onboards the supplier's *payout* account so card
payments on their storefront settle to THEM (with us taking an application fee). THIS module is the
other direction — WE bill the supplier a monthly/annual subscription for the AI employees they switch
on. The two never share a Stripe object: Connect creates `acct_…` connected accounts; this creates a
platform-side `cus_…` Customer and hangs Subscriptions off it.

The employees and how they bill (Peter's authoritative pricing doc):
  • Order Manager   (Marco,  agent id "orders")     — TIERED MONTHLY by daily WhatsApp-order volume:
                                                        <15/day €29 · 15–40/day €79 · 40+/day €149.
                                                        Annual = 10× the monthly tier (~2 months free, ~17% off).
  • E-commerce Mgr  (Carmen, agent id "storefront")  — NOT a subscription. A 0.3% application fee on shop
                                                        card sales (ties to Stripe Connect), gated by an
                                                        ENABLE toggle with a ONE-MONTH minimum lock-in.
                                                        No Stripe Price, no recurring charge here — the flag
                                                        lives in employee_subscriptions.ecommerce_enabled.
  • Delivery Mgr    (Hugo,   agent id "deliveries")  — €99/mo standard · €49/mo if ≤2 vans ("small").
                                                        Annual = 10× the monthly price (~17% off).

Stripe calls are sync (the official lib 15.0.1), wrapped in asyncio.to_thread. TEST MODE: reads
config.STRIPE_SUBS_SECRET_KEY (the *_TEST key, test-first). No key → every call returns a disabled/empty
result, never crashes. The catalogue is built idempotently by stable `lookup_key`, so ensure_catalog()
is safe to re-run.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict, List, Optional

import config
import db

log = logging.getLogger("rocoto.stripe_subs")


# ── pricing catalogue (source of truth for products/prices) ──────────────────────────────────────
# Each entry: a Stripe Product + its Prices. `lookup_key` is the STABLE handle we create-or-look-up by,
# so re-running ensure_catalog() never duplicates. `employee` maps a price back to the roster employee id
# the Android app uses; `tier`/`plan`/`interval` annotate it for subscription_status().
EUR = "eur"

# Order Manager (Marco / "orders") — tiered monthly, with a 10×-the-monthly annual variant.
_ORDERS_PRODUCT = {
    "lookup_key": "orders_product",
    "name": "Order Manager (Marco)",
    "description": "AI WhatsApp order manager — reads, grounds and dispatches incoming orders.",
}
# Delivery Manager (Hugo / "deliveries") — flat monthly (std/small), each with an annual variant.
_DELIVERIES_PRODUCT = {
    "lookup_key": "deliveries_product",
    "name": "Delivery Manager (Hugo)",
    "description": "AI delivery manager — routes, schedules and tracks deliveries.",
}

# Price rows. amount is in CENTS. Annual = 10× the monthly amount (≈ 2 months free / ~17% off).
PRICES: List[Dict[str, Any]] = [
    # ── Marco (orders) — monthly tiers ──
    {"lookup_key": "orders_t1", "product": "orders_product", "employee": "orders",
     "amount": 2900, "interval": "month", "tier": "t1",
     "nickname": "Order Manager — up to 15 orders/day (monthly)"},
    {"lookup_key": "orders_t2", "product": "orders_product", "employee": "orders",
     "amount": 7900, "interval": "month", "tier": "t2",
     "nickname": "Order Manager — 15–40 orders/day (monthly)"},
    {"lookup_key": "orders_t3", "product": "orders_product", "employee": "orders",
     "amount": 14900, "interval": "month", "tier": "t3",
     "nickname": "Order Manager — 40+ orders/day (monthly)"},
    # ── Marco (orders) — annual (10× the monthly tier) ──
    {"lookup_key": "orders_t1_yr", "product": "orders_product", "employee": "orders",
     "amount": 29000, "interval": "year", "tier": "t1",
     "nickname": "Order Manager — up to 15 orders/day (annual)"},
    {"lookup_key": "orders_t2_yr", "product": "orders_product", "employee": "orders",
     "amount": 79000, "interval": "year", "tier": "t2",
     "nickname": "Order Manager — 15–40 orders/day (annual)"},
    {"lookup_key": "orders_t3_yr", "product": "orders_product", "employee": "orders",
     "amount": 149000, "interval": "year", "tier": "t3",
     "nickname": "Order Manager — 40+ orders/day (annual)"},
    # ── Hugo (deliveries) — monthly std/small ──
    {"lookup_key": "deliveries_std", "product": "deliveries_product", "employee": "deliveries",
     "amount": 9900, "interval": "month", "plan": "std",
     "nickname": "Delivery Manager — standard (monthly)"},
    {"lookup_key": "deliveries_small", "product": "deliveries_product", "employee": "deliveries",
     "amount": 4900, "interval": "month", "plan": "small",
     "nickname": "Delivery Manager — ≤2 vans (monthly)"},
    # ── Hugo (deliveries) — annual (10× the monthly) ──
    {"lookup_key": "deliveries_std_yr", "product": "deliveries_product", "employee": "deliveries",
     "amount": 99000, "interval": "year", "plan": "std",
     "nickname": "Delivery Manager — standard (annual)"},
    {"lookup_key": "deliveries_small_yr", "product": "deliveries_product", "employee": "deliveries",
     "amount": 49000, "interval": "year", "plan": "small",
     "nickname": "Delivery Manager — ≤2 vans (annual)"},
]

PRODUCTS = {"orders_product": _ORDERS_PRODUCT, "deliveries_product": _DELIVERIES_PRODUCT}

# Roster display metadata (the Android app keys employees by these ids).
EMPLOYEES = {
    "orders": {"name": "Order Manager", "agent": "Marco"},
    "storefront": {"name": "E-commerce Manager", "agent": "Carmen"},
    "deliveries": {"name": "Delivery Manager", "agent": "Hugo"},
}

# Fast price-lookup_key → metadata index (built once).
_PRICE_BY_KEY = {p["lookup_key"]: p for p in PRICES}


def configured() -> bool:
    return bool(getattr(config, "STRIPE_SUBS_SECRET_KEY", ""))


def _stripe():
    import stripe
    stripe.api_key = config.STRIPE_SUBS_SECRET_KEY
    stripe.max_network_retries = 2
    return stripe


# ── idempotent catalogue (products + prices, by stable lookup_key) ───────────────────────────────
def _ensure_product_sync(stripe, key: str, spec: Dict[str, Any]) -> Any:
    """Create-or-look-up a Product. Products have no lookup_key field, so we look up by metadata
    (`sancho_product_key`) and create on miss. Idempotent."""
    found = stripe.Product.search(query=f"metadata['sancho_product_key']:'{key}'", limit=1)
    if found.data:
        return found.data[0]
    return stripe.Product.create(
        name=spec["name"],
        description=spec.get("description") or None,
        metadata={"sancho": "true", "sancho_product_key": key},
    )


def _ensure_price_sync(stripe, product_id: str, spec: Dict[str, Any]) -> Any:
    """Create-or-look-up a Price by its `lookup_key` (Stripe's native idempotency handle for prices)."""
    found = stripe.Price.list(lookup_keys=[spec["lookup_key"]], limit=1)
    if found.data:
        return found.data[0]
    return stripe.Price.create(
        product=product_id,
        currency=EUR,
        unit_amount=spec["amount"],
        recurring={"interval": spec["interval"]},
        lookup_key=spec["lookup_key"],
        nickname=spec.get("nickname") or None,
        metadata={
            "sancho": "true",
            "employee": spec["employee"],
            **({"tier": spec["tier"]} if spec.get("tier") else {}),
            **({"plan": spec["plan"]} if spec.get("plan") else {}),
        },
    )


def _ensure_catalog_sync() -> Dict[str, Any]:
    stripe = _stripe()
    product_ids: Dict[str, str] = {}
    for key, spec in PRODUCTS.items():
        prod = _ensure_product_sync(stripe, key, spec)
        product_ids[key] = prod.id
    price_ids: Dict[str, str] = {}
    for spec in PRICES:
        price = _ensure_price_sync(stripe, product_ids[spec["product"]], spec)
        price_ids[spec["lookup_key"]] = price.id
    return {"products": product_ids, "prices": price_ids}


async def ensure_catalog() -> Dict[str, Any]:
    """Idempotently create-or-look-up the Stripe test-mode Products + Prices for the AI employees.
    Safe to re-run: products are matched on a metadata key, prices on their stable `lookup_key`."""
    if not configured():
        return {"ok": False, "reason": "stripe_not_configured", "products": {}, "prices": {}}
    try:
        out = await asyncio.to_thread(_ensure_catalog_sync)
    except Exception as e:  # noqa: BLE001
        log.warning("ensure_catalog failed: %s", e)
        return {"ok": False, "reason": "ensure_catalog_failed", "detail": str(e)[:200],
                "products": {}, "prices": {}}
    return {"ok": True, **out}


# ── per-supplier Stripe Customer ─────────────────────────────────────────────────────────────────
def _ensure_customer_sync(existing_id: Optional[str], tenant: str, email: str) -> Any:
    stripe = _stripe()
    if existing_id:
        try:
            cust = stripe.Customer.retrieve(existing_id)
            if not getattr(cust, "deleted", False):
                return cust
        except Exception:  # customer deleted / wrong mode → recreate
            pass
    return stripe.Customer.create(
        email=email or None,
        name=tenant,
        metadata={"sancho": "true", "tenant": tenant},
    )


async def get_or_create_customer(tenant: Optional[str] = None, *, email: str = "") -> Dict[str, Any]:
    """A Stripe Customer per supplier/tenant (stored in employee_subscriptions.stripe_customer_id)."""
    tenant = tenant or config.BRAIN_TENANT
    if not configured():
        return {"ok": False, "reason": "stripe_not_configured"}
    existing = await db.subs_get_customer_id(tenant)
    cust = await asyncio.to_thread(_ensure_customer_sync, existing, tenant, email)
    if cust.id != existing:
        await db.subs_set_customer_id(tenant, cust.id)
    return {"ok": True, "customer_id": cust.id}


# ── Checkout (subscribe to an employee) ──────────────────────────────────────────────────────────
def _checkout_sync(customer_id: str, price_id: str, success_url: str, cancel_url: str,
                   tenant: str, lookup_key: str) -> str:
    stripe = _stripe()
    session = stripe.checkout.Session.create(
        mode="subscription",
        customer=customer_id,
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=success_url,
        cancel_url=cancel_url,
        allow_promotion_codes=True,
        subscription_data={"metadata": {"sancho": "true", "tenant": tenant, "price_key": lookup_key}},
        metadata={"sancho": "true", "tenant": tenant, "price_key": lookup_key},
    )
    return session.url


async def create_checkout_session(tenant: Optional[str], price_lookup_key: str) -> Dict[str, Any]:
    """A Stripe Checkout Session in SUBSCRIPTION mode for `price_lookup_key` (e.g. 'orders_t2',
    'deliveries_std_yr'). Returns the hosted-checkout url; success/cancel return to the app."""
    tenant = tenant or config.BRAIN_TENANT
    if not configured():
        return {"ok": False, "reason": "stripe_not_configured"}
    spec = _PRICE_BY_KEY.get(price_lookup_key)
    if not spec:
        return {"ok": False, "reason": "unknown_price_key"}
    cust = await get_or_create_customer(tenant)
    if not cust.get("ok"):
        return cust
    # Resolve the live Price id by its lookup_key (ensures the catalogue exists in this test account).
    try:
        price = await asyncio.to_thread(
            lambda: _stripe().Price.list(lookup_keys=[price_lookup_key], limit=1))
        if not price.data:
            cat = await ensure_catalog()  # self-heal: build the catalogue if it's missing, then retry
            if not cat.get("ok"):
                return {"ok": False, "reason": "price_not_found"}
            price = await asyncio.to_thread(
                lambda: _stripe().Price.list(lookup_keys=[price_lookup_key], limit=1))
            if not price.data:
                return {"ok": False, "reason": "price_not_found"}
        price_id = price.data[0].id
    except Exception as e:  # noqa: BLE001
        log.warning("checkout price lookup failed: %s", e)
        return {"ok": False, "reason": "price_lookup_failed", "detail": str(e)[:200]}
    base = config.SUBS_RETURN_URL.rstrip("/")
    success_url = f"{base}?checkout=success&session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{base}?checkout=cancel"
    try:
        url = await asyncio.to_thread(
            _checkout_sync, cust["customer_id"], price_id, success_url, cancel_url, tenant, price_lookup_key)
    except Exception as e:  # noqa: BLE001
        log.warning("checkout session create failed: %s", e)
        return {"ok": False, "reason": "checkout_failed", "detail": str(e)[:200]}
    return {"ok": True, "url": url}


# ── Billing Portal (manage / upgrade / cancel) ───────────────────────────────────────────────────
def _portal_sync(customer_id: str, return_url: str) -> str:
    stripe = _stripe()
    session = stripe.billing_portal.Session.create(customer=customer_id, return_url=return_url)
    return session.url


async def create_billing_portal(tenant: Optional[str] = None) -> Dict[str, Any]:
    """A Stripe Billing Portal session url — the supplier manages/upgrades/cancels their employees."""
    tenant = tenant or config.BRAIN_TENANT
    if not configured():
        return {"ok": False, "reason": "stripe_not_configured"}
    cust = await get_or_create_customer(tenant)
    if not cust.get("ok"):
        return cust
    try:
        url = await asyncio.to_thread(
            _portal_sync, cust["customer_id"], config.SUBS_RETURN_URL)
    except Exception as e:  # noqa: BLE001
        log.warning("billing portal create failed: %s", e)
        return {"ok": False, "reason": "portal_failed", "detail": str(e)[:200]}
    return {"ok": True, "url": url}


# ── live subscription status (which employees are on) ────────────────────────────────────────────
def _active_subs_sync(customer_id: str) -> List[Any]:
    """All non-terminal subscriptions for the customer (active + trialing + past_due), price expanded."""
    stripe = _stripe()
    out: List[Any] = []
    for status in ("active", "trialing", "past_due"):
        subs = stripe.Subscription.list(
            customer=customer_id, status=status, limit=100,
            expand=["data.items.data.price"])
        out.extend(subs.data)
    return out


def _employee_from_price_key(lookup_key: Optional[str]) -> Optional[Dict[str, Any]]:
    if not lookup_key:
        return None
    return _PRICE_BY_KEY.get(lookup_key)


async def subscription_status(tenant: Optional[str] = None) -> Dict[str, Any]:
    """Which employees are currently subscribed — reads the customer's live Stripe subscriptions and maps
    each price back to its employee id (Marco's tier, Hugo's plan), plus Carmen's 0.3% enabled flag from
    the DB. Always returns a per-employee roster the Android app can render directly."""
    tenant = tenant or config.BRAIN_TENANT
    row = await db.subs_row(tenant)
    ecommerce_enabled = bool((row or {}).get("ecommerce_enabled"))

    # Default roster (nothing subscribed). Carmen is always "manageable" via the enable toggle.
    employees: Dict[str, Dict[str, Any]] = {
        "orders": {"id": "orders", "name": "Order Manager", "agent": "Marco",
                   "subscribed": False, "tier": None, "interval": None,
                   "price_key": None, "manageable": True},
        "storefront": {"id": "storefront", "name": "E-commerce Manager", "agent": "Carmen",
                       "subscribed": ecommerce_enabled, "enabled": ecommerce_enabled,
                       "model": "application_fee", "fee_percent": 0.3,
                       "lock_in_months": 1, "ecommerce_enabled_at": (row or {}).get("ecommerce_enabled_at"),
                       "manageable": True},
        "deliveries": {"id": "deliveries", "name": "Delivery Manager", "agent": "Hugo",
                       "subscribed": False, "plan": None, "interval": None,
                       "price_key": None, "manageable": True},
    }

    if not configured():
        return {"configured": False, "tenant": tenant, "ecommerce_enabled": ecommerce_enabled,
                "employees": list(employees.values())}

    customer_id = (row or {}).get("stripe_customer_id")
    if not customer_id:
        return {"configured": True, "tenant": tenant, "ecommerce_enabled": ecommerce_enabled,
                "employees": list(employees.values())}

    try:
        subs = await asyncio.to_thread(_active_subs_sync, customer_id)
    except Exception as e:  # noqa: BLE001
        log.warning("subscription_status fetch failed: %s", e)
        return {"configured": True, "tenant": tenant, "ecommerce_enabled": ecommerce_enabled,
                "stale": True, "employees": list(employees.values())}

    for sub in subs:
        for item in sub["items"]["data"]:
            price = item.get("price") or {}
            lookup_key = price.get("lookup_key")
            meta = _employee_from_price_key(lookup_key)
            if not meta:
                # Fall back to the price metadata (employee/tier/plan) if the lookup_key isn't ours.
                pmeta = price.get("metadata") or {}
                emp_id = pmeta.get("employee")
                if emp_id not in employees:
                    continue
                meta = {"employee": emp_id, "interval": (price.get("recurring") or {}).get("interval"),
                        "tier": pmeta.get("tier"), "plan": pmeta.get("plan")}
            emp_id = meta["employee"]
            e = employees.get(emp_id)
            if not e:
                continue
            e["subscribed"] = True
            e["price_key"] = lookup_key
            e["interval"] = meta.get("interval") or (price.get("recurring") or {}).get("interval")
            e["subscription_id"] = sub.get("id")
            e["status"] = sub.get("status")
            e["current_period_end"] = sub.get("current_period_end")
            e["cancel_at_period_end"] = sub.get("cancel_at_period_end")
            if meta.get("tier"):
                e["tier"] = meta["tier"]
            if meta.get("plan"):
                e["plan"] = meta["plan"]

    return {"configured": True, "tenant": tenant, "customer_id": customer_id,
            "ecommerce_enabled": ecommerce_enabled, "employees": list(employees.values())}


# ── Carmen's 0.3% enable toggle (one-month lock-in) ──────────────────────────────────────────────
async def set_ecommerce_enabled(tenant: Optional[str], on: bool) -> Dict[str, Any]:
    """Toggle Carmen's (storefront) 0.3% application-fee enable. This is NOT a Stripe subscription — it's
    a persisted flag with a ONE-MONTH minimum lock-in: turning it ON stamps `ecommerce_enabled_at`; the
    storefront's application-fee path reads `ecommerce_enabled`. Returns the persisted state."""
    tenant = tenant or config.BRAIN_TENANT
    row = await db.subs_set_ecommerce_enabled(tenant, bool(on))
    return {
        "ok": True,
        "tenant": tenant,
        "ecommerce_enabled": bool(row.get("ecommerce_enabled")),
        "ecommerce_enabled_at": row.get("ecommerce_enabled_at"),
        "lock_in_months": 1,
        "note": "0.3% on shop card sales; one-month minimum (lock-in) from ecommerce_enabled_at.",
    }
