"""The welcome email — sent once, when a Pedidos Checkout completes.

Peter, 2026-08-12: «of course do an email on checkout!!! with logo and congrats and shit like this.
nice feel to it».

WHY IT IS ITS OWN MODULE. `pedidos_billing.py` is the money path: it verifies Stripe signatures,
reconciles subscriptions and writes the row that decides what a tenant is allowed to do. An email
template has no business in there, and — more importantly — an email failure must never be able to
affect that path. This module is called fail-soft from the webhook and cannot raise into it.

SENT ONCE, AND THE ROW IS THE LEDGER. `pedidos_subscription.welcomed_at` is set in the same
statement that reads it, so two webhook deliveries of the same event (Stripe retries; we also
handle `checkout.session.completed` idempotently) cannot produce two emails. Stripe WILL redeliver
— that is not a hypothetical, it is the documented contract — so "send once" has to be enforced by
the database, not by hoping.

WHAT IT DELIBERATELY DOES NOT DO: no tracking pixel, no click wrapping, no List-Unsubscribe. This
is a transactional receipt-shaped message about a thing they just paid for, and `actions.send_email`
documents precisely why marketing headers must not be attached to that kind of mail.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, Optional

log = logging.getLogger("rocoto.pedidos.welcome")

# The face, not the wordmark: Gmail and Outlook do not render SVG, and `leo-charcoal.svg` is the
# only wordmark we ship. `face-open.png` is a real raster on the landing's own CDN, served over
# https from the apex — which is what an image in an email has to be to survive image proxying.
LOGO_URL = "https://soyrocoto.com/brand/face-open.png"
APP_URL = "https://app.soyrocoto.com"

# Rocoto's own ink and red, hard-coded ON PURPOSE: an email has no access to the token sheet, and
# `var()` is unsupported in every major mail client. These are the values `--rocoto-ink` and
# `--rocoto-accent` resolve to; if the brand moves, this list moves with it by hand.
INK = "#17120f"
MID = "#5f5751"
RED = "#b3122c"
PAPER = "#faf7f3"
LINE = "#e7e0d8"


def _eur(cents: int, es: bool, dec: int = 0) -> str:
    """19900 → «199 €» (ES) · «€199» (EN). The same shape as the landing's `px_eur`, so a figure in
    this email and the same figure on /precios are separated by nothing but the runtime."""
    s = f"{cents / 100:,.{dec}f}"
    if es:
        s = s.replace(",", "\x00").replace(".", ",").replace("\x00", ".")
        return f"{s} €"
    return f"€{s}"


def _rows(t_es: bool, facts, invoice_url: str = "") -> str:
    """The things they now have, as a table — the only layout primitive that survives Outlook.

    `facts` is an ordered list of (label, value) built by `send_welcome`, because what a band is
    SOLD BY differs between the two models this file has to serve: a seat band buys people plus a
    published per-order rate, a retired ceiling band bought a monthly volume. One row list that
    tried to say both is what produced «hasta 0 pedidos al mes» — see the note in `send_welcome`."""
    items = list(facts)
    # THE FACTURA, BOTH WAYS (Peter, 2026-08-12: «could we give them their invoice from Stripe
    # there too […] can we send it to them too as pdf attachment»). The PDF rides as an attachment
    # because a Spanish B2B customer forwards it to their gestor and wants a file, not a login;
    # the LINK goes in as well because Stripe's hosted invoice is the authoritative copy — it
    # carries their CIF/NIF (we collect it at Checkout via tax_id_collection) and it stays correct
    # if anything about the invoice is ever amended, which a PDF sent today cannot.
    if invoice_url:
        label = "Tu factura" if t_es else "Your invoice"
        text = ("Va adjunta en PDF. También la tienes siempre en Stripe: "
                if t_es else "Attached as a PDF. It also lives in Stripe: ")
        link = "verla ahí" if t_es else "view it there"
        items.append((label, f'{text}<a href="{invoice_url}" style="color:{RED}">{link}</a>.'))
    out = []
    for k, v in items:
        out.append(
            f'<tr>'
            f'<td style="padding:14px 0;border-bottom:1px solid {LINE};'
            f'font:600 13px/1.4 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;'
            f'color:{MID};white-space:nowrap;vertical-align:top;width:38%">{k}</td>'
            f'<td style="padding:14px 0 14px 16px;border-bottom:1px solid {LINE};'
            f'font:400 15px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;'
            f'color:{INK};vertical-align:top">{v}</td>'
            f'</tr>'
        )
    return "".join(out)


def render(lang: str, band_name: str, facts, company: str = "",
           invoice_url: str = "") -> Dict[str, str]:
    """(subject, html). Tables and inline styles only — no flexbox, no grid, no <style> block:
    Outlook's Word renderer supports none of them, and a broken welcome is worse than a plain one."""
    es = (lang or "es").startswith("es")
    who = (company or "").strip()

    subject = (
        f"Ya tienes Rocoto Pedidos {band_name}" if es
        else f"You're on Rocoto Orders {band_name}"
    )
    hi = (f"Enhorabuena{', ' + who if who else ''}." if es
          else f"Congratulations{', ' + who if who else ''}.")
    lede = (
        "Rocoto Pedidos ya está activo en tu cuenta. Desde ahora los pedidos entran por WhatsApp, "
        "se leen contra tu catálogo y salen en tu formato."
        if es else
        "Rocoto Orders is live on your account. From now on orders arrive over WhatsApp, get read "
        "against your catalogue and come out in your own format."
    )
    cta = "Entrar en Rocoto" if es else "Open Rocoto"
    foot = (
        "¿Alguna duda? Responde a este correo y te contesto yo."
        if es else
        "Any questions? Reply to this email and it comes straight to me."
    )

    html = f"""<!doctype html>
<html lang="{'es' if es else 'en'}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{subject}</title></head>
<body style="margin:0;padding:0;background:{PAPER}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
       style="background:{PAPER};padding:32px 16px">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="max-width:520px;background:#ffffff;border:1px solid {LINE};border-radius:16px">
      <tr><td style="padding:32px 32px 0">
        <img src="{LOGO_URL}" width="44" height="44" alt="Rocoto"
             style="display:block;border:0;outline:none;text-decoration:none">
      </td></tr>
      <tr><td style="padding:22px 32px 0">
        <h1 style="margin:0;font:600 26px/1.2 Georgia,'Times New Roman',serif;color:{INK}">{hi}</h1>
      </td></tr>
      <tr><td style="padding:12px 32px 0">
        <p style="margin:0;font:400 15px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
                  color:{MID}">{lede}</p>
      </td></tr>
      <tr><td style="padding:24px 32px 0">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          {_rows(es, facts, invoice_url)}
        </table>
      </td></tr>
      <tr><td style="padding:28px 32px 0">
        <a href="{APP_URL}"
           style="display:inline-block;background:{RED};color:#ffffff;text-decoration:none;
                  padding:13px 26px;border-radius:999px;
                  font:600 15px/1 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">{cta}</a>
      </td></tr>
      <tr><td style="padding:26px 32px 32px">
        <p style="margin:0;font:400 13px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
                  color:{MID}">{foot}</p>
      </td></tr>
    </table>
    <p style="max-width:520px;margin:16px auto 0;
              font:400 12px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#9a908a">
      Rocoto · soyrocoto.com
    </p>
  </td></tr>
</table>
</body></html>"""
    return {"subject": subject, "html": html}


async def _invoice_pdf(pdf_url: str) -> Optional[str]:
    """Fetch the Stripe invoice PDF and return it base64 for Resend, or None.

    FAIL-SOFT BY DESIGN, and the failure mode matters: if the PDF cannot be fetched the welcome
    still goes out with the hosted-invoice LINK, which is the authoritative copy anyway. Losing the
    attachment costs a click; losing the whole email over a slow CDN would cost the moment.

    `invoice_pdf` is a Stripe URL that requires no auth (it carries its own signed token), so this
    is a plain GET. Capped at 8 MB: an invoice for one subscription line is a few KB, and anything
    that large means something is wrong rather than something worth mailing.
    """
    if not pdf_url:
        return None
    try:
        import base64

        import httpx
        async with httpx.AsyncClient(timeout=20, follow_redirects=True) as c:
            r = await c.get(pdf_url)
            if r.status_code >= 300 or len(r.content) > 8 * 1024 * 1024:
                log.warning("invoice pdf fetch: status=%s bytes=%s", r.status_code, len(r.content))
                return None
            return base64.b64encode(r.content).decode("ascii")
    except Exception:  # noqa: BLE001
        log.exception("invoice pdf fetch failed (fail-soft — the link still ships)")
        return None


async def send_welcome(pool, tenant_slug: str, band: str, cadence: str,
                       to_email: str, bands: Dict[str, Any],
                       lang: str = "es", company: str = "",
                       invoice_url: str = "", invoice_pdf_url: str = "") -> bool:
    """Claim the send in the DB, then send. Returns True when an email actually went out.

    THE CLAIM IS THE POINT. `update … where welcomed_at is null returning 1` is atomic, so of two
    concurrent webhook deliveries exactly one gets a row back and exactly one email is sent. Doing
    this the obvious way — read, branch, send, write — races with Stripe's own retry.
    """
    if not to_email:
        return False
    try:
        async with pool.acquire() as con:
            claimed = await con.fetchval(
                "update pedidos_subscription set welcomed_at = now() "
                "where tenant_id = $1 and welcomed_at is null returning 1", tenant_slug)
        if not claimed:
            return False

        b = bands.get(band) or {}
        name = str(b.get("name") or band.upper())
        _es = lang.startswith("es")

        # ── WHAT THE BAND ACTUALLY BUYS ──────────────────────────────────────────────────────────
        # ⚠️ THIS EMAIL OPENED «Pedidos Pequeño · hasta 0 pedidos al mes» ON EVERY SALE WE CAN MAKE
        # — found 2026-08-17. The line was `orders_ceiling`, formatted, and every SEAT band carries
        # `orders_ceiling: 0` on purpose: the ceiling model was retired on 2026-08-14 and zero is
        # how this codebase spells «no limit» (pedidos_meter.ceiling_for guards on `ceiling > 0`).
        # So the arithmetic was right, the sentence was not, and the first thing a paying customer
        # read after handing over 597 € was that they had bought nothing.
        #
        # A SEAT BAND IS SOLD BY PEOPLE AND BY A PUBLISHED RATE — «Una cuota por tu equipo, más un
        # precio por pedido» (Peter's own lede on /precios). So `seats` is what the plan row says,
        # and the rate gets a row of its own, because it is the half of the bill that arrives
        # LATER and on a different rhythm: metered, monthly, a mes vencido.
        #
        # THE RETIRED CEILING BANDS KEEP THEIR OLD SENTENCE. A tenant on `s`/`m` really did buy a
        # monthly volume, their `orders_ceiling` is a real number, and their bill has no per-order
        # line at all — telling them about a rate they are not charged would be the same defect
        # pointing the other way.
        rate_cents = int(b.get("per_order_cents") or 0)
        seats = b.get("seats")
        if rate_cents:
            # PETER'S OWN `who` LINES, from product/pricing.json → plans[].who, which is what
            # /precios prints under each band. Composed from `seats` rather than copied, because
            # BANDS here carries the number and not the sentence — the words are his, in his order.
            if seats is None:
                who = ("Sin límite de personas, varios almacenes y marcas" if _es
                       else "Unlimited people, several warehouses and brands")
            else:
                who = (f"Hasta {seats} personas atendiendo pedidos" if _es
                       else f"Up to {seats} people handling orders")
            orders_line = (
                f"{_eur(rate_cents, _es, 2)} por pedido, facturados a mes vencido" if _es
                else f"{_eur(rate_cents, _es, 2)} per order, billed at the end of each month")
        else:
            ceiling = f"{int(b.get('orders_ceiling') or 0):,}".replace(",", ".")
            who = (f"hasta {ceiling} pedidos al mes" if _es
                   else f"up to {ceiling} orders a month")
            orders_line = ""

        # BOTH NUMBERS, BECAUSE THE CUSTOMER MEETS BOTH (2026-08-13). The card quotes a per-month
        # price and Stripe charges the whole term at once — «249 € al mes · 747 € + IVA cada 3
        # meses». Printing only the quote would have this email name a figure that never appears on
        # their statement; printing only the charge would hide the number they actually bought on.
        #
        # AND THE ROW IS «Tu cuota», NOT «Lo que pagas», ON A SEAT BAND (2026-08-17). This figure is
        # the band fee alone: it contains no pedidos, and it contains no módulos either — Compras
        # and Reparto ride the same Checkout and this line has never known about them. Under «Lo
        # que pagas» that made it a wrong total; under «Tu cuota» it is exactly what it is, with
        # the pedidos named on their own row underneath. The ceiling bands keep the old label,
        # where the band fee really was the whole bill.
        per_month_cents = int(b.get("mensual_cents") or 0)
        if cadence == "anual":
            charge_cents = int(b.get("anual_charge_cents") or b.get("anual_cents") or 0)
            per_month_cents = round(int(b.get("anual_cents") or 0) / 12)
            price_line = (
                f"{_eur(per_month_cents, _es)} al mes · "
                f"{_eur(charge_cents, _es)} + IVA una vez al año, por adelantado" if _es else
                f"{_eur(per_month_cents, _es)} a month · "
                f"{_eur(charge_cents, _es)} + VAT once a year, up front")
        else:
            charge_cents = int(b.get("mensual_charge_cents") or b.get("mensual_cents") or 0)
            price_line = (
                f"{_eur(per_month_cents, _es)} al mes · "
                f"{_eur(charge_cents, _es)} + IVA cada 3 meses, por adelantado" if _es else
                f"{_eur(per_month_cents, _es)} a month · "
                f"{_eur(charge_cents, _es)} + VAT every 3 months, up front")

        facts = [
            (("Tu plan" if _es else "Your plan"),
             f"{'Pedidos' if _es else 'Orders'} {name} · {who}"),
        ]
        if orders_line:
            facts.append((("Tu cuota" if _es else "Your fee"), price_line))
            facts.append((("Tus pedidos" if _es else "Your orders"), orders_line))
        else:
            facts.append((("Lo que pagas" if _es else "What you pay"), price_line))
        facts.append((("Lo siguiente" if _es else "Next"),
                      "Subes tu catálogo y das de alta a tus clientes. Te lleva una tarde." if _es
                      else "Upload your catalogue and add your customers. It takes an afternoon."))

        msg = render(lang, name, facts, company, invoice_url)
        # The attachment is fetched BEFORE the send and never blocks it: `_invoice_pdf` swallows its
        # own failures, so a Stripe hiccup costs the PDF, not the welcome.
        attachments = None
        pdf_b64 = await _invoice_pdf(invoice_pdf_url)
        if pdf_b64:
            fname = ("factura-rocoto.pdf" if (lang or "es").startswith("es")
                     else "rocoto-invoice.pdf")
            attachments = [{"filename": fname, "content": pdf_b64}]
        import actions
        ok = await actions.send_email(to_email, msg["subject"], msg["html"],
                                      reply_to="hello@soyrocoto.com",
                                      attachments=attachments)
        if not ok:
            # release the claim so a later retry can try again — a welcome that silently never
            # arrives is worse than one that arrives late
            async with pool.acquire() as con:
                await con.execute(
                    "update pedidos_subscription set welcomed_at = null where tenant_id = $1",
                    tenant_slug)
        return bool(ok)
    except Exception:  # noqa: BLE001
        log.exception("pedidos welcome email failed (fail-soft) for %s", tenant_slug)
        return False
