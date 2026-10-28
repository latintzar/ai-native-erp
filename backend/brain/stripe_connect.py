"""Rocoto's OWN Stripe Connect layer — clean, self-contained, Medusa-adjacent.

Deliberately NOT routed through Leo's legacy payments package (Scope's escrow/contractor model — wrong
shape + wired badly). Rocoto is a fresh start: the supplier (a charcutería) onboards a Stripe **Express**
connected account so card payments on the storefront settle to THEM, with the platform taking an
`application_fee` (the G2 "we grow when you grow" rate). Medusa's payment-stripe provider does the
charge with `stripeAccount` = the connected account; THIS module owns the onboarding side (create the
account, mint the redoable onboarding AccountLink, read live status).

The connected-account id is stored in `shop_connect` (one row per tenant). Stripe calls are sync (the
official lib), wrapped in asyncio.to_thread. No key → every call returns a disabled/empty result, never
crashes. Uses the TEST secret in test mode; live is a one-env-var swap.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict, Optional
from urllib.parse import urlsplit

import config
import db

log = logging.getLogger("rocoto.stripe_connect")


def configured() -> bool:
    return bool(getattr(config, "STRIPE_SECRET_KEY", ""))


def _stripe():
    import stripe
    stripe.api_key = config.STRIPE_SECRET_KEY
    stripe.max_network_retries = 2
    return stripe


# ── persistence (shop_connect: one connected account per tenant) ──
async def _get_row(tenant: str) -> Optional[Dict[str, Any]]:
    pool = db.get_pool()
    async with pool.acquire() as con:
        r = await con.fetchrow("select * from shop_connect where tenant_id=$1", tenant)
    return dict(r) if r else None


async def _save_status(tenant: str, acct: Any) -> None:
    pool = db.get_pool()
    async with pool.acquire() as con:
        await con.execute(
            """insert into shop_connect (tenant_id, stripe_account_id, charges_enabled, payouts_enabled,
                                         details_submitted, updated_at)
                 values ($1,$2,$3,$4,$5, now())
               on conflict (tenant_id) do update set
                 stripe_account_id=excluded.stripe_account_id, charges_enabled=excluded.charges_enabled,
                 payouts_enabled=excluded.payouts_enabled, details_submitted=excluded.details_submitted,
                 updated_at=now()""",
            tenant, acct.id, bool(acct.charges_enabled), bool(acct.payouts_enabled),
            bool(acct.details_submitted))


# ── sync Stripe calls (run in a thread) ──
def _ensure_account_sync(existing_id: Optional[str], email: str) -> Any:
    stripe = _stripe()
    if existing_id:
        try:
            return stripe.Account.retrieve(existing_id)
        except Exception:  # account deleted / wrong mode → recreate
            pass
    return stripe.Account.create(
        type="express", country="ES",
        email=email or None,
        business_type="company",
        default_currency="eur",
        capabilities={"card_payments": {"requested": True}, "transfers": {"requested": True}},
        business_profile={"product_description": "Artisan cured meats — wholesale to bars & restaurants"},
        # NB: the Stripe-HOSTED Express flow follows the browser language; to force Spanish we use the
        # EMBEDDED onboarding component (ConnectComponentsProvider locale="es-ES") — see connect session.
        metadata={"sancho": "true", "tenant": config.BRAIN_TENANT},
    )


def _account_link_sync(account_id: str, refresh_url: str, return_url: str) -> str:
    stripe = _stripe()
    link = stripe.AccountLink.create(
        account=account_id, refresh_url=refresh_url, return_url=return_url, type="account_onboarding")
    return link.url


# ── public async API ──
async def status(tenant: Optional[str] = None) -> Dict[str, Any]:
    """Live connect status for the supplier's payout account."""
    tenant = tenant or config.BRAIN_TENANT
    if not configured():
        return {"configured": False, "connected": False}
    row = await _get_row(tenant)
    if not row or not row.get("stripe_account_id"):
        return {"configured": True, "connected": False, "charges_enabled": False,
                "payouts_enabled": False, "details_submitted": False}
    # refresh from Stripe (source of truth) + persist
    try:
        acct = await asyncio.to_thread(lambda: _stripe().Account.retrieve(row["stripe_account_id"]))
        await _save_status(tenant, acct)
        return {"configured": True, "connected": True, "account_id": acct.id,
                "charges_enabled": bool(acct.charges_enabled), "payouts_enabled": bool(acct.payouts_enabled),
                "details_submitted": bool(acct.details_submitted)}
    except Exception as e:
        log.warning("connect status fetch failed: %s", e)
        return {"configured": True, "connected": True, "account_id": row["stripe_account_id"],
                "charges_enabled": bool(row.get("charges_enabled")),
                "payouts_enabled": bool(row.get("payouts_enabled")),
                "details_submitted": bool(row.get("details_submitted")), "stale": True}


async def onboarding_link(base_url: str, *, email: str = "", tenant: Optional[str] = None) -> Dict[str, Any]:
    """Create/reuse the supplier's Express account + mint a REDOABLE onboarding link. The supplier opens
    it to connect (or re-connect / update) their payout account; on return the status reflects it."""
    tenant = tenant or config.BRAIN_TENANT
    if not configured():
        return {"ok": False, "reason": "stripe_not_configured"}
    # Validate the integration origin before creating or persisting an external account.
    base_url = base_url.strip().rstrip("/")
    try:
        origin = urlsplit(base_url)
        valid_origin = (origin.scheme in {"http", "https"} and bool(origin.hostname)
                        and not origin.username and not origin.password
                        and not origin.path and not origin.query and not origin.fragment
                        and (origin.port is None or origin.port > 0)
                        and not any(c.isspace() for c in base_url))
    except ValueError:
        valid_origin = False
    if not valid_origin:
        return {"ok": False, "reason": "storefront_not_configured"}
    row = await _get_row(tenant)
    acct = await asyncio.to_thread(_ensure_account_sync, (row or {}).get("stripe_account_id"), email)
    await _save_status(tenant, acct)
    refresh = f"{base_url}/connect/refresh"
    ret = f"{base_url}/connect/return"
    url = await asyncio.to_thread(_account_link_sync, acct.id, refresh, ret)
    return {"ok": True, "url": url, "account_id": acct.id}


def _account_session_sync(account_id: str) -> str:
    """Mint a Stripe Account Session for the EMBEDDED Connect components (onboarding + management) — this
    is what lets onboarding render INSIDE our own page (no redirect to connect.stripe.com)."""
    stripe = _stripe()
    session = stripe.AccountSession.create(
        account=account_id,
        components={
            "account_onboarding": {"enabled": True},
            "account_management": {"enabled": True},
            "notification_banner": {"enabled": True},
        },
    )
    return session.client_secret


async def account_session(*, email: str = "", tenant: Optional[str] = None) -> Dict[str, Any]:
    """Create/reuse the Express account + mint an Account Session client_secret for the embedded onboarding
    components. The supplier onboards/manages their payout account fully IN our app (a /connect page opened
    in an Android Custom Tab), in Spanish, never leaving for Stripe's hosted page."""
    tenant = tenant or config.BRAIN_TENANT
    if not configured():
        return {"ok": False, "reason": "stripe_not_configured"}
    row = await _get_row(tenant)
    acct = await asyncio.to_thread(_ensure_account_sync, (row or {}).get("stripe_account_id"), email)
    await _save_status(tenant, acct)
    try:
        client_secret = await asyncio.to_thread(_account_session_sync, acct.id)
    except Exception as e:  # noqa: BLE001
        log.warning("account session create failed: %s", e)
        return {"ok": False, "reason": "account_session_failed", "detail": str(e)[:200]}
    return {"ok": True, "client_secret": client_secret, "account_id": acct.id,
            "publishable_key": config.STRIPE_PUBLISHABLE_KEY}
