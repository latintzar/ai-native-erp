"""brain/order_payment.py — «Paga con tarjeta» on the customer portal (portal.py / SPEC §5.9).

⚠️ DOCUMENTED CAVEAT (Peter asked for this explicitly, 2026-07-28): this is STRIPE CHECKOUT — Stripe's
own HOSTED, redirect-based payment page (`stripe.checkout.Session`, mode="payment") — NOT an embedded
Payment Element and NOT a card form drawn by us. The customer taps «Paga con tarjeta», LEAVES
soyrocoto.com/pedidos/{token} for Stripe's own checkout.stripe.com page, pays, and is bounced back to
the same portal URL. Deliberate: Checkout is the PCI-safest and fastest-to-ship-correctly path — we
never see or store a card number — at the cost of a page handoff instead of an in-page payment sheet.
An embedded Payment Element is a real, separate follow-up if that handoff turns out to matter.

DIRECT CHARGE on the DISTRIBUTOR'S OWN connected Stripe account (`brain/stripe_connect.py`'s Express
account — the same one the founder connects from Ajustes → Cobros), mirroring `reparto_api._mint_link`
exactly (`stripe_account=<acct>`, the same three-refusal ladder for "not configured" / "not connected"
/ "charges not enabled"). Money settles to THEM, never to the platform. Rocoto's own commission is
metered elsewhere, off `value_snapshot_cents` FROZEN AT DISPATCH (brain/billing.py) — this module
takes no application_fee and never touches that column, so a card payment here can never double-bill
a euro of commission.

⚠️ WHY THIS IS NOT reparto_api._mint_link, STATED RATHER THAN HIDDEN: that function prices an order
off `delivery.payable()`, which reads `orders.value_snapshot_cents` — a number that is NULL until the
order is DISPATCHED (`brain/billing.py`, "freeze the resolved euro value... AT dispatch"). This button
has to work on an order the moment it lands (`needs_review`/`preparing`), long before any dispatch — so
it prices off `portal._order_total()` instead, the same live total the portal page already shows.
CONSEQUENCE: this is deliberately NOT wired into `delivery.settle` / `delivery_settlements` (reparto's
driver-COD ledger) — a driver collecting cash at the door has no automatic way to see "this one was
already paid by card". The two ledgers do not talk to each other yet; reconcile by hand if it happens.
Tracked instead on the order row itself (`orders.card_paid_at` / `card_paid_cents`, SET-ONCE).

Stripe's `invoice_creation` is ON (mirrors `brain/setupfee.py`'s pattern) so a PAID order gets a real,
VAT-correct Stripe-hosted invoice issued BY THE DISTRIBUTOR'S OWN ACCOUNT (a direct charge makes the
connected account the seller of record) — stored as `card_invoice_hosted_url` / `card_invoice_pdf_url`.
An order nobody has paid by card gets `brain/invoice.py`'s own plain order-summary PDF instead, clearly
labelled "no es una factura fiscal" — we do not fabricate a tax document for money that has not moved.

NOT BUILT, stated rather than faked: no partial/split-order payment, no saved card / one-click repeat
pay, no refund flow (refunds go through the Stripe dashboard by hand for now).
"""
from __future__ import annotations

import asyncio
import logging
from typing import Optional

import config
import db

log = logging.getLogger("rocoto.brain.order_payment")

CHECKOUT_KIND = "rocoto_order_paga"


async def _order_row(tenant: str, phone: str, order_id: str) -> Optional[dict]:
    pool = db.get_pool()
    async with pool.acquire() as con:
        row = await con.fetchrow(
            "select id, phone_number, tenant_id, lines, status, card_paid_at, card_checkout_session_id "
            "from orders where id=$1 and tenant_id=$2 and phone_number=$3",
            order_id, tenant, phone)
    return dict(row) if row else None


async def create_checkout(order_id: str, token: str) -> Optional[dict]:
    """token → verified (tenant, phone) via `portal.resolve`; the order must belong to THIS customer.

    Returns None for a token that does not resolve (the portal's uniform 404 — see portal.py's own
    non-leaking law). Otherwise {"ok": True, "url": ...} or {"ok": False, "motivo": ..., "mensaje":
    "<es-ES, safe to show the customer verbatim>"}."""
    import portal
    who = await portal.resolve(token, touch=False)
    if not who:
        return None
    tenant, phone = who["tenant_id"], who["phone_number"]

    order_id = (order_id or "").strip()
    row = await _order_row(tenant, phone, order_id)
    if not row:
        return {"ok": False, "motivo": "no_encontrado", "mensaje": "No encuentro ese pedido."}
    if row.get("card_paid_at"):
        return {"ok": False, "motivo": "ya_pagado", "mensaje": "Este pedido ya está pagado."}

    lines = portal._lines_out(row["lines"])
    total = portal._order_total(lines)
    if total is None or total <= 0:
        return {"ok": False, "motivo": "sin_total",
                "mensaje": "Este pedido todavía no tiene un importe cerrado — no se puede pagar con "
                           "tarjeta todavía."}

    from brain import stripe_connect
    if not stripe_connect.configured():
        return {"ok": False, "motivo": "no_configurado",
                "mensaje": "El pago con tarjeta no está disponible ahora mismo."}
    st = await stripe_connect.status(tenant)
    acct = str(st.get("account_id") or "")
    if not st.get("connected") or not acct:
        return {"ok": False, "motivo": "sin_cuenta",
                "mensaje": "Tu proveedor todavía no ha activado el pago con tarjeta. Puedes seguir "
                           "con el pago habitual."}
    if not st.get("charges_enabled"):
        return {"ok": False, "motivo": "cobros_no_activos",
                "mensaje": "Tu proveedor todavía está terminando de activar el pago con tarjeta. "
                           "Puedes seguir con el pago habitual."}

    cents = int(round(total * 100))
    base = (getattr(config, "ONBOARD_PUBLIC_BASE_URL", "") or "https://soyrocoto.com").rstrip("/")
    portal_page = f"{base}/pedidos/{token}"
    success_url = f"{portal_page}?pagado=1"
    cancel_url = portal_page
    idem = f"order_paga:{tenant}:{order_id}:{cents}"
    label = f"Pedido {order_id[:8]}"

    def _mint():
        # stripe_connect._stripe() is the ONE place this codebase sets the API key + retry policy.
        stripe = stripe_connect._stripe()
        return stripe.checkout.Session.create(
            mode="payment",
            payment_method_types=["card"],
            line_items=[{"price_data": {"currency": "eur", "unit_amount": cents,
                                        "product_data": {"name": label}}, "quantity": 1}],
            locale="es",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={"kind": CHECKOUT_KIND, "tenant": tenant, "order_id": order_id},
            stripe_account=acct,
            invoice_creation={"enabled": True,
                              "invoice_data": {"description": label,
                                               "metadata": {"kind": CHECKOUT_KIND, "order_id": order_id}}},
            idempotency_key=idem,
        )

    try:
        session = await asyncio.to_thread(_mint)
    except Exception:
        log.exception("order_payment: checkout mint failed for %s", order_id)
        return {"ok": False, "motivo": "stripe_error",
                "mensaje": "No he podido generar el enlace de pago. Inténtalo de nuevo en un momento."}
    url = str(getattr(session, "url", "") or "")
    if not url:
        return {"ok": False, "motivo": "stripe_error",
                "mensaje": "No he podido generar el enlace de pago."}

    pool = db.get_pool()
    async with pool.acquire() as con:
        await con.execute("update orders set card_checkout_session_id=$2 where id=$1",
                          order_id, session.get("id"))
    return {"ok": True, "url": url, "session_id": session.get("id")}


async def _invoice_info(acct: str, session_id: str, retries: int = 4) -> dict:
    """Poll briefly for the invoice_creation invoice to finalize (same shape as setupfee.py's own
    `_invoice_info_from_session` — the invoice lands a moment after the session completes)."""
    from brain import stripe_connect
    st = stripe_connect._stripe()
    for _ in range(max(1, retries)):
        try:
            s2 = await asyncio.to_thread(
                lambda: st.checkout.Session.retrieve(session_id, expand=["invoice"],
                                                     stripe_account=acct))
            inv = s2.get("invoice")
            if isinstance(inv, dict) and (inv.get("hosted_invoice_url") or inv.get("invoice_pdf")):
                return {"hosted_url": inv.get("hosted_invoice_url"), "pdf_url": inv.get("invoice_pdf")}
        except Exception:
            log.debug("order_payment: invoice poll failed for %s", session_id, exc_info=True)
        await asyncio.sleep(1.2)
    return {}


async def on_webhook(obj: dict, etype: str) -> dict:
    """`checkout.session.completed` for `kind==CHECKOUT_KIND` → SET-ONCE mark the order paid. Called
    from app.py's `/api/stripe/webhook`, alongside `brain_setupfee.handle_webhook` and
    `reparto_api.record_checkout_paid` — same endpoint, routed by `metadata.kind`, same convention
    every Stripe consumer in this codebase already uses."""
    meta = obj.get("metadata") or {}
    if (meta.get("kind") or "") != CHECKOUT_KIND:
        return {"ignored": "not_ours"}
    order_id = str(meta.get("order_id") or "")
    if not order_id or (obj.get("payment_status") or "") not in ("paid", "no_payment_required"):
        return {"ignored": "not_paid_or_incomplete"}

    pool = db.get_pool()
    async with pool.acquire() as con:
        won = await con.fetchval(
            "update orders set card_paid_at=now(), card_paid_cents=$2, "
            "card_checkout_session_id=coalesce(card_checkout_session_id, $3) "
            "where id=$1 and card_paid_at is null returning id",
            order_id, obj.get("amount_total"), obj.get("id"))
    if not won:
        return {"ok": True, "reason": "already"}
    log.info("order_payment: card payment settled for order %s", order_id)

    # Invoice urls, best-effort AFTER the payment is already durably recorded — a slow/failed Stripe
    # poll must never make the webhook look like it failed (Stripe would redeliver a payment that in
    # fact already landed). The connected account id comes off OUR OWN `stripe_connect.status(tenant)`
    # rather than the event's top-level `account` field — simpler than threading that field through
    # setupfee.py's dispatcher, and it is the same account `create_checkout` minted the session on.
    try:
        from brain import stripe_connect
        tenant = str(meta.get("tenant") or "")
        st = await stripe_connect.status(tenant) if tenant else {}
        acct = str(st.get("account_id") or "")
        sid = str(obj.get("id") or "")
        if acct and sid:
            info = await _invoice_info(acct, sid)
            if info.get("hosted_url") or info.get("pdf_url"):
                async with pool.acquire() as con:
                    await con.execute(
                        "update orders set card_invoice_hosted_url=coalesce(card_invoice_hosted_url,$2), "
                        "card_invoice_pdf_url=coalesce(card_invoice_pdf_url,$3) where id=$1",
                        order_id, info.get("hosted_url"), info.get("pdf_url"))
    except Exception:
        log.exception("order_payment: invoice url fetch failed for %s (payment already recorded)", order_id)
    return {"ok": True, "reason": "settled", "order_id": order_id}
