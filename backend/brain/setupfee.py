"""Rocoto onboarding SETUP FEE — the €50 one-time 'alta' that gates the waitlist.

Flow:
  wizard's last step → create_checkout() mints a Stripe Checkout Session (payment mode, the €50 EUR
  price, invoice_creation ON so Stripe issues a real invoice + PDF) → customer pays on Stripe's hosted
  page → returns to /onboarding/{token}?paid=1&sid=... → complete_from_session() verifies the session
  with Stripe and finalizes onboarding (join waitlist + branded invoice email). A Stripe webhook
  (checkout.session.completed / invoice.paid) is the authoritative backstop so a closed tab still
  finalizes and still gets the invoice email.

Idempotency (exactly-once across the redirect + webhook + invoice.paid paths):
  • onboarding.submit_wizard flips the token active→used ATOMICALLY → the waitlist join happens once.
  • onboarding_progress.invoice_email_sent_at is an atomic claim → the branded invoice email sends once
    (released on send failure so a backstop can retry).

TEST tokens (owner ?test=1) use the *_TEST Stripe keys + test price so a walkthrough never touches real
money. When no test keys are configured, enabled(is_test=True) is False and the frontend falls back to a
direct (unpaid) waitlist join for test tokens — real (live) tokens always pay.

Stripe calls are sync (official lib), wrapped in asyncio.to_thread — same pattern as stripe_subs.py /
stripe_connect.py. No key/price → every entry point returns a graceful {error/…}, never crashes.
"""
from __future__ import annotations

import asyncio
import logging

import config
import db
from brain import onboarding as _ob

log = logging.getLogger("rocoto.setupfee")

# The direct backend host Stripe signs the webhook against (matches the endpoint URL created in Stripe).
WEBHOOK_PATH = "/api/stripe/webhook"


# ──────────────────────────── mode-aware key/price/secret selection ────────────────────────────
def _keys(is_test: bool) -> tuple[str, str, str]:
    """(secret_key, price_id, webhook_secret) for the mode. Test reads the *_TEST env; live the mains."""
    if is_test:
        return (getattr(config, "STRIPE_SECRET_KEY_TEST", "") or "",
                getattr(config, "ROCOTO_SETUP_FEE_PRICE_ID_TEST", "") or "",
                getattr(config, "STRIPE_WEBHOOK_SECRET_TEST", "") or "")
    return (getattr(config, "STRIPE_SECRET_KEY", "") or "",
            getattr(config, "ROCOTO_SETUP_FEE_PRICE_ID", "") or "",
            getattr(config, "STRIPE_WEBHOOK_SECRET", "") or "")


def enabled(is_test: bool = False) -> bool:
    """True when this mode can take a payment (a secret key AND a price id are configured)."""
    sk, price, _ = _keys(is_test)
    return bool(sk and price)


def _stripe(is_test: bool):
    import stripe
    sk, _, _ = _keys(is_test)
    stripe.api_key = sk
    stripe.max_network_retries = 2
    return stripe


def amount_eur() -> str:
    return str(getattr(config, "ROCOTO_SETUP_FEE_EUR", "50") or "50")


async def token_is_payable(token: str) -> bool:
    """True if this token can — and therefore MUST — be paid before it finalizes, i.e. payment is
    configured for its mode. The plain wizard-submit endpoint uses this to REFUSE finalizing a payable
    token unpaid; only the paid path (payment-complete / webhook) may finalize it. Non-payable tokens
    (payment not configured — e.g. a test token with no test keys) still finalize via the plain path."""
    token = (token or "").strip()
    if not token:
        return False
    pool = db.get_pool()
    async with pool.acquire() as con:
        is_test = await con.fetchval("select is_test from onboarding_tokens where token = $1", token)
    if is_test is None:
        return False
    return enabled(bool(is_test))


# ──────────────────────────── invoice normalisation ────────────────────────────
def _normalize_invoice(invoice) -> dict:
    """Stripe Invoice → the compact dict our email + records use."""
    return {
        "id": invoice.get("id"),
        "number": invoice.get("number"),
        "hosted_url": invoice.get("hosted_invoice_url"),
        "pdf_url": invoice.get("invoice_pdf"),
        "total": invoice.get("total"),
        "currency": invoice.get("currency"),
    }


def _receipt_url_from_session(session) -> str:
    """Fallback to the card receipt when an invoice PDF isn't available (payment_intent expanded)."""
    pi = session.get("payment_intent")
    if isinstance(pi, dict):
        ch = pi.get("latest_charge")
        if isinstance(ch, dict):
            return ch.get("receipt_url") or ""
    return ""


async def _invoice_info_from_session(session, is_test: bool, retries: int = 5) -> dict:
    """Resolve the invoice for a completed session, waiting briefly for Stripe to finalize it (the
    invoice_creation invoice is issued a moment after the session completes)."""
    inv = session.get("invoice")
    inv_id = inv.get("id") if isinstance(inv, dict) else inv
    st = _stripe(is_test)
    for _ in range(max(1, retries)):
        if inv_id:
            try:
                invoice = await asyncio.to_thread(lambda i=inv_id: st.Invoice.retrieve(i))
            except Exception:
                invoice = None
            if invoice and (invoice.get("hosted_invoice_url") or invoice.get("invoice_pdf")):
                return _normalize_invoice(invoice)
        else:
            try:
                sid = session.get("id")
                s2 = await asyncio.to_thread(
                    lambda: st.checkout.Session.retrieve(sid, expand=["invoice"]))
                i2 = s2.get("invoice")
                inv_id = i2.get("id") if isinstance(i2, dict) else i2
            except Exception:
                pass
        await asyncio.sleep(1.2)
    if inv_id:
        try:
            invoice = await asyncio.to_thread(lambda i=inv_id: st.Invoice.retrieve(i))
            return _normalize_invoice(invoice)
        except Exception:
            return {"id": inv_id}
    return {}


# ──────────────────────────── persistence ────────────────────────────
async def _record_session(token: str, session) -> None:
    pool = db.get_pool()
    async with pool.acquire() as con:
        await con.execute(
            "update onboarding_progress set stripe_session_id = $2, updated_at = now() where token = $1",
            token, session.get("id"))


async def _record_payment(token: str, session) -> None:
    pi = session.get("payment_intent")
    pi_id = pi.get("id") if isinstance(pi, dict) else pi
    inv = session.get("invoice")
    inv_id = inv.get("id") if isinstance(inv, dict) else inv
    # M1M2 WP-4 (eng F7): the durable Customer the saved card hangs on — the meter charges it.
    cust = session.get("customer")
    cust_id = cust.get("id") if isinstance(cust, dict) else cust
    pool = db.get_pool()
    async with pool.acquire() as con:
        await con.execute(
            "update onboarding_progress set paid_at = coalesce(paid_at, now()), "
            "stripe_session_id = coalesce(stripe_session_id, $2), "
            "stripe_payment_intent = coalesce(stripe_payment_intent, $3), "
            "stripe_invoice_id = coalesce(stripe_invoice_id, $4), "
            "amount_total = coalesce(amount_total, $5), currency = coalesce(currency, $6), "
            "stripe_customer_id = coalesce(stripe_customer_id, $7), "
            "updated_at = now() where token = $1",
            token, session.get("id"), pi_id, inv_id,
            session.get("amount_total"), session.get("currency"), cust_id)
    # M1M2 WP-4: the paid alta becomes prepaid commission CREDIT — one +amount ledger row
    # ('setup_fee_credit', unique per tenant: the webhook/browser-return race and any replay adopt
    # the same row). Fail-soft: a ledger hiccup must never block onboarding finalize; the WP-7
    # rehearsal (and the credit fact) makes a missing row loud.
    try:
        from brain import billing
        await billing.grant_setup_credit(token, session)
    except Exception:
        log.exception("setup credit grant failed for %s (onboarding continues; backfill via "
                      "billing.grant_setup_credit)", token)


async def _record_invoice_urls(token: str, invoice_info: dict) -> None:
    ii = invoice_info or {}
    if not (ii.get("hosted_url") or ii.get("pdf_url") or ii.get("id")):
        return
    pool = db.get_pool()
    async with pool.acquire() as con:
        await con.execute(
            "update onboarding_progress set stripe_invoice_id = coalesce(stripe_invoice_id, $2), "
            "invoice_hosted_url = coalesce($3, invoice_hosted_url), "
            "invoice_pdf_url = coalesce($4, invoice_pdf_url), updated_at = now() where token = $1",
            token, ii.get("id"), ii.get("hosted_url"), ii.get("pdf_url"))


# ──────────────────────────── finalize + email (idempotent) ────────────────────────────
async def _finalize_onboarding(token: str, session, is_test: bool) -> dict | None:
    """Record the payment and join the waitlist (once, via submit_wizard's atomic token flip)."""
    await _record_payment(token, session)
    wl = await _ob.submit_wizard(token, send_confirm=False, paid=True)
    if wl is None:  # already finalized by the other path — resolve the existing position
        wl = await _ob.waitlist_for_token(token)
    # PROMOTE the runtime identity (SPEC §6): a paid prospect becomes a boss — the event-sourced
    # employee must learn the conversion, or it treats a paying customer as a cold prospect forever.
    # Best-effort, off the critical finalize path.
    if not is_test:
        try:
            import runtime
            async with db.get_pool().acquire() as _con:
                phone = await _con.fetchval(
                    "select l.phone from onboarding_tokens t join leads l on l.id=t.lead_id where t.token=$1", token)
            if phone:
                await runtime.on_conversion(str(phone), to_tier="boss")
        except Exception:
            log.debug("conversion promotion fail-soft (token=%s)", token, exc_info=True)
    return wl


async def _send_invoice_email_once(token: str, invoice_info: dict, wl: dict | None,
                                   is_test: bool, receipt_url: str = "") -> dict:
    """Atomically claim + send the branded invoice email exactly once. Releases the claim on failure
    so a later path (webhook / invoice.paid) can retry. Defers if onboarding isn't finalized yet."""
    if wl is None:
        # onboarding not finalized yet (rare invoice.paid-before-completed race) — let the
        # checkout/redirect path own the email once the waitlist row exists.
        return {"deferred": True}
    inv = invoice_info or {}
    if not (inv.get("hosted_url") or inv.get("pdf_url") or receipt_url):
        # The invoice_creation invoice often finalizes AFTER checkout.session.completed. Don't claim the
        # guard + send a document-less email now — defer so the invoice.paid webhook (which carries the
        # finalized invoice) sends the authoritative one. The guard stays unclaimed until a doc exists.
        return {"deferred_no_invoice": True}
    pool = db.get_pool()
    async with pool.acquire() as con:
        won = await con.fetchval(
            "update onboarding_progress set invoice_email_sent_at = now() "
            "where token = $1 and invoice_email_sent_at is null returning token", token)
    if not won:
        return {"already_sent": True}
    try:
        await _record_invoice_urls(token, invoice_info)
        lead = await _ob.lead_public_by_token(token)
        res = await _ob.send_setup_paid_email(lead, wl, invoice_info,
                                              amount_eur=amount_eur(), receipt_url=receipt_url)
        if not res.get("ok"):
            raise RuntimeError(res.get("error") or "email send failed")
        return {"sent": True}
    except Exception:
        try:
            async with pool.acquire() as con:
                await con.execute(
                    "update onboarding_progress set invoice_email_sent_at = null where token = $1", token)
        except Exception:  # pragma: no cover
            log.exception("release email guard failed for %s", token)
        log.exception("setup-paid email failed for token %s", token)
        return {"error": "email_failed"}


# ──────────────────────────── public entry points ────────────────────────────
async def create_checkout(token: str) -> dict:
    """Mint a Stripe Checkout Session for the €50 alta. Returns {ok, url} or {error:...}."""
    token = (token or "").strip()
    if not token:
        return {"error": "no_token"}
    pool = db.get_pool()
    async with pool.acquire() as con:
        row = await con.fetchrow(
            "select t.lead_id, t.status, t.is_test, l.email, l.name, p.paid_at "
            "from onboarding_tokens t left join leads l on l.id = t.lead_id "
            "left join onboarding_progress p on p.token = t.token where t.token = $1", token)
    if not row:
        return {"error": "not_found"}
    # Never mint a second charge: an already-used token OR one already marked paid is done.
    if row["status"] != "active" or row["paid_at"] is not None:
        return {"error": "already_used"}  # frontend jumps to the waitlist/status
    is_test = bool(row["is_test"])
    if not enabled(is_test):
        return {"error": "not_configured"}
    _, price_id, _ = _keys(is_test)
    email = (row["email"] or "").strip() or None
    base = getattr(config, "ONBOARD_PUBLIC_BASE_URL", "https://soyrocoto.com").rstrip("/")
    test_q = "&test=1" if is_test else ""
    success_url = f"{base}/onboarding/{token}?paid=1&sid={{CHECKOUT_SESSION_ID}}{test_q}"
    cancel_url = f"{base}/onboarding/{token}?canceled=1{test_q}"
    st = _stripe(is_test)
    # DYNAMIC amount from ROCOTO_SETUP_FEE_EUR (the founding offer = 500 €) so the charge tracks the
    # stated price with NO Stripe-console step; fall back to the fixed price_id if the env is unset.
    try:
        _eur = int(round(float(getattr(config, "ROCOTO_SETUP_FEE_EUR", "") or 0)))
    except (TypeError, ValueError):
        _eur = 0
    if _eur > 0:
        _line = [{"price_data": {"currency": "eur", "unit_amount": _eur * 100,
                                 "product_data": {"name": "Alta y configuración de Rocoto"}},
                  "quantity": 1}]
    else:
        _line = [{"price": price_id, "quantity": 1}]

    def _create():
        return st.checkout.Session.create(
            mode="payment",
            # Spain-facing: a clean card checkout (Apple/Google Pay ride on 'card') — not the automatic
            # jumble of Klarna/Satispay/MB WAY/EPS that Stripe would otherwise surface. tax_id_collection
            # below keeps the NIF/CIF field so the invoice is a proper Spanish factura.
            payment_method_types=["card"],
            # Full override (the shared account's base descriptor is VITRINA — Peter's other brand): a
            # Rocoto supplier's card statement reads a clean "ROCOTO", never the unfamiliar VITRINA.
            # M1M2 WP-4 (eng F7): setup_future_usage=off_session SAVES this card — the card that pays
            # the €500 alta IS the card the 0.3% commission meter auto-charges (brain/billing.py).
            payment_intent_data={"statement_descriptor": "Rocoto",
                                 "setup_future_usage": "off_session"},
            # …and customer_creation='always' mints the durable Stripe Customer the saved card hangs
            # on (session.customer → onboarding_progress.stripe_customer_id in _record_payment).
            customer_creation="always",
            line_items=_line,
            customer_email=email,
            client_reference_id=token,
            metadata={"token": token, "lead_id": row["lead_id"] or "",
                      "mode": "test" if is_test else "live", "kind": "rocoto_setup_fee"},
            invoice_creation={
                "enabled": True,
                "invoice_data": {
                    "description": "Alta y configuración de tu empleado de ventas Rocoto (pago único).",
                    "metadata": {"token": token, "kind": "rocoto_setup_fee"},
                    "footer": "Gracias por confiar en Rocoto · peter@soyrocoto.com",
                },
            },
            billing_address_collection="required",
            tax_id_collection={"enabled": True},
            locale="es",
            success_url=success_url,
            cancel_url=cancel_url,
        )

    try:
        session = await asyncio.to_thread(_create)
    except Exception as e:
        log.exception("checkout create failed for %s", token)
        return {"error": "stripe_error", "detail": str(e)[:200]}
    try:
        await _record_session(token, session)
    except Exception:  # pragma: no cover
        log.exception("record session failed for %s", token)
    return {"ok": True, "url": session.get("url"), "session_id": session.get("id")}


async def complete_from_session(session_id: str, token: str) -> dict:
    """Verify a returned Checkout session with Stripe and finalize (join waitlist + invoice email).
    Returns {ok, paid, waitlist, lead} or {error:...} / {paid:false}."""
    token = (token or "").strip()
    session_id = (session_id or "").strip()
    if not (token and session_id):
        return {"error": "bad_request"}
    pool = db.get_pool()
    async with pool.acquire() as con:
        trow = await con.fetchrow("select is_test from onboarding_tokens where token = $1", token)
    if not trow:
        return {"error": "not_found"}
    is_test = bool(trow["is_test"])
    if not enabled(is_test):
        return {"error": "not_configured"}
    st = _stripe(is_test)
    try:
        session = await asyncio.to_thread(
            lambda: st.checkout.Session.retrieve(
                session_id, expand=["invoice", "payment_intent.latest_charge"]))
    except Exception as e:
        log.exception("session retrieve failed for %s", token)
        return {"error": "stripe_error", "detail": str(e)[:200]}
    if (session.get("metadata") or {}).get("token") != token:
        return {"error": "token_mismatch"}
    if session.get("payment_status") != "paid":
        return {"ok": False, "paid": False, "status": session.get("payment_status")}
    wl = await _finalize_onboarding(token, session, is_test)
    invoice_info = await _invoice_info_from_session(session, is_test)
    receipt = _receipt_url_from_session(session)
    await _send_invoice_email_once(token, invoice_info, wl, is_test, receipt)
    lead = await _ob.lead_public_by_token(token)
    return {"ok": True, "paid": True, "waitlist": wl, "lead": lead}


async def handle_webhook(payload: bytes, sig_header: str) -> dict:
    """Verify + handle a Stripe webhook (tries the live then test signing secret). Authoritative
    backstop for both onboarding finalize and the invoice email."""
    import stripe
    event = None
    for is_test in (False, True):
        _, _, whsec = _keys(is_test)
        if not whsec:
            continue
        try:
            event = stripe.Webhook.construct_event(payload, sig_header, whsec)
            break
        except Exception:
            event = None
    if event is None:
        return {"error": "bad_signature"}
    etype = event.get("type")
    obj = event["data"]["object"]
    is_test = not bool(event.get("livemode"))
    try:
        # M1M2 WP-4: COMMISSION-invoice events route by metadata kind (never by token). The 0.3%
        # meter's remainder invoice carries kind='rocoto_commission'; its paid/failed webhook feeds
        # the SAME canonical employment duty events /api/employment/event consumes — the existing
        # chase_salary manifest row (friendly dunning) does the rest. Checked FIRST: a commission
        # invoice has no wizard token, so the setup-fee branches below would just ignore it.
        if etype in ("invoice.paid", "invoice.payment_succeeded", "invoice.payment_failed") \
                and (obj.get("metadata") or {}).get("kind") == "rocoto_commission":
            from brain import billing
            return await billing.on_stripe_invoice_event(obj, etype)
        if etype in ("checkout.session.completed", "checkout.session.async_payment_succeeded"):
            token = (obj.get("metadata") or {}).get("token")
            if not token:
                return {"ignored": "no_token"}
            if obj.get("payment_status") != "paid":
                return {"pending": True}
            st = _stripe(is_test)
            session = await asyncio.to_thread(
                lambda: st.checkout.Session.retrieve(
                    obj["id"], expand=["invoice", "payment_intent.latest_charge"]))
            wl = await _finalize_onboarding(token, session, is_test)
            invoice_info = await _invoice_info_from_session(session, is_test)
            receipt = _receipt_url_from_session(session)
            er = await _send_invoice_email_once(token, invoice_info, wl, is_test, receipt)
            if er.get("error") == "email_failed":
                return {"error": "handler_error"}  # 5xx → Stripe redelivers so the email retries
            return {"handled": etype}
        if etype == "invoice.paid":
            token = (obj.get("metadata") or {}).get("token")
            if not token:
                return {"ignored": "no_token"}
            wl = await _ob.waitlist_for_token(token)
            if wl is None:
                # finalize (checkout.session.completed) hasn't landed yet — ask Stripe to redeliver
                # this invoice.paid so we can send the invoice email once the waitlist row exists.
                return {"error": "handler_error"}
            invoice_info = _normalize_invoice(obj)
            er = await _send_invoice_email_once(token, invoice_info, wl, is_test)
            if er.get("error") == "email_failed":
                return {"error": "handler_error"}
            return {"handled": etype}
        if etype == "checkout.session.async_payment_failed":
            return {"handled": etype}
    except Exception:
        log.exception("webhook handling failed for %s", etype)
        return {"error": "handler_error"}
    return {"ignored": etype}
