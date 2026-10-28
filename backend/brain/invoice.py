"""brain/invoice.py — THE ORDER DOCUMENT, as a downloadable PDF, for the customer portal (portal.py).

Peter, 2026-07-28: *"their invoices linked there"* — every order on `/pedidos/{token}` gets a
document link. What this module draws is NOT a tax invoice (a real factura needs the distributor's
own NIF/IVA registration threaded through it, which this product does not capture) — it is the
same honest "what did we agree" summary `order_card.py` sends on WhatsApp, laid out as a proper
one-page printable document instead of a chat bubble. It says so on its own footer, on purpose,
mirroring `order_card.py`'s own "never mistaken for an invoice" footer line.

When an order WAS paid through `brain/order_payment.py`'s Stripe Checkout, Stripe itself issues a
real, VAT-correct invoice on the distributor's own connected account (a direct charge makes them the
seller) — `orders.card_invoice_hosted_url` / `card_invoice_pdf_url`. THAT is the real factura, and
the portal links it in preference to this one whenever it exists (see `portal.py`'s `_lines_out`
caller). This module only covers the (normal, majority) case: an order nobody has paid by card yet,
still worth a clean document to keep for the books.

Same PIL rendering approach as `order_card.py`, at print resolution (A4 @ 150dpi) and saved straight
to PDF — Pillow can write a single RGB image as a one-page PDF with no extra dependency.
"""
from __future__ import annotations

import io
import logging
import textwrap
from typing import Any, Optional

from PIL import Image, ImageDraw, ImageFont

log = logging.getLogger("rocoto.brain.invoice")

_BG = (250, 247, 243)
_INK = (26, 20, 19)
_MUTED = (111, 102, 92)
_FAINT = (176, 166, 153)
_BORDER = (222, 213, 199)
_SAFFRON = (192, 27, 44)

# A4 @ 150dpi — a real print size, crisp on screen and on paper.
_W = 1240
_H = 1754
_PAD = 90


def _fonts() -> dict[str, ImageFont.FreeTypeFont]:
    try:
        reg = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
        bold = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
        return {
            "title": ImageFont.truetype(bold, 44),
            "heading": ImageFont.truetype(bold, 26),
            "body": ImageFont.truetype(reg, 24),
            "body_bold": ImageFont.truetype(bold, 24),
            "small": ImageFont.truetype(reg, 20),
            "total": ImageFont.truetype(bold, 32),
        }
    except Exception:
        log.warning("invoice: system font missing, falling back to Pillow's bitmap default")
        d = ImageFont.load_default()
        return dict.fromkeys(("title", "heading", "body", "body_bold", "small", "total"), d)


def _euro(v: Optional[float]) -> str:
    if v is None:
        return "—"
    return f"{v:.2f}".replace(".", ",") + " €"


def _qty_es(qty: Optional[float], unit: str) -> str:
    if qty is None:
        return unit or ""
    q = str(int(qty)) if qty == int(qty) else f"{qty:.2f}".rstrip("0").rstrip(".")
    return f"{q.replace('.', ',')} {unit}".strip()


def render_order_pdf(*, business_name: str, business_address: str, customer_name: str,
                     customer_address: str, customer_phone: str, order_id: str, fecha: str,
                     lines: list[dict[str, Any]], total: Optional[float],
                     paid: bool = False, paid_note: str = "") -> bytes:
    """`lines`/`total` are `portal._lines_out`/`_order_total`'s own shape — one source of truth for
    what "the order" means, same as `order_card.py`. Returns single-page PDF bytes."""
    f = _fonts()
    img = Image.new("RGB", (_W, _H), _BG)
    draw = ImageDraw.Draw(img)
    y = _PAD

    # ── header ──
    draw.text((_PAD, y), business_name or "Rocoto", font=f["title"], fill=_INK)
    right = f"Pedido {order_id[:8]}"
    rw = draw.textlength(right, font=f["heading"])
    draw.text((_W - _PAD - rw, y + 8), right, font=f["heading"], fill=_MUTED)
    y += 56
    if business_address:
        draw.text((_PAD, y), business_address, font=f["small"], fill=_MUTED)
        y += 28
    date_txt = fecha or ""
    dw = draw.textlength(date_txt, font=f["small"])
    draw.text((_W - _PAD - dw, y - 28 if business_address else y), date_txt, font=f["small"], fill=_MUTED)
    y += 20
    draw.line([(_PAD, y), (_W - _PAD, y)], fill=_BORDER, width=2)
    y += 40

    # ── client block ──
    draw.text((_PAD, y), "CLIENTE", font=f["small"], fill=_FAINT)
    y += 30
    draw.text((_PAD, y), customer_name or "—", font=f["body_bold"], fill=_INK)
    y += 32
    if customer_address:
        for wline in textwrap.wrap(customer_address, width=60) or [customer_address]:
            draw.text((_PAD, y), wline, font=f["body"], fill=_MUTED)
            y += 28
    if customer_phone:
        draw.text((_PAD, y), customer_phone, font=f["body"], fill=_MUTED)
        y += 28
    y += 24
    draw.line([(_PAD, y), (_W - _PAD, y)], fill=_BORDER, width=2)
    y += 40

    # ── table header ──
    col_name = _PAD
    col_qty = _W - _PAD - 420
    col_price = _W - _PAD - 260
    col_total = _W - _PAD
    draw.text((col_name, y), "PRODUCTO", font=f["small"], fill=_FAINT)
    draw.text((col_qty, y), "CANTIDAD", font=f["small"], fill=_FAINT)
    draw.text((col_price, y), "PRECIO", font=f["small"], fill=_FAINT)
    tw = draw.textlength("IMPORTE", font=f["small"])
    draw.text((col_total - tw, y), "IMPORTE", font=f["small"], fill=_FAINT)
    y += 34
    draw.line([(_PAD, y), (_W - _PAD, y)], fill=_BORDER, width=1)
    y += 24

    for ln in lines:
        name = str(ln.get("nombre") or "—")
        wrapped = textwrap.wrap(name, width=38) or [name]
        qty_txt = _qty_es(ln.get("cantidad"), str(ln.get("unidad") or ""))
        price_txt = _euro(ln.get("precio")) if ln.get("precio") is not None else "—"
        imp = ln.get("importe")
        imp_txt = _euro(imp) if imp is not None else ("peso var." if ln.get("peso_variable") else "—")
        draw.text((col_name, y), wrapped[0], font=f["body"], fill=_INK)
        draw.text((col_qty, y), qty_txt, font=f["body"], fill=_INK)
        draw.text((col_price, y), price_txt, font=f["body"], fill=_MUTED)
        iw = draw.textlength(imp_txt, font=f["body"])
        draw.text((col_total - iw, y), imp_txt, font=f["body"], fill=_INK)
        y += 32
        for extra in wrapped[1:]:
            draw.text((col_name, y), extra, font=f["body"], fill=_INK)
            y += 32
        y += 10
        if y > _H - 260:  # one page — a very long order truncates rather than corrupts the layout
            draw.text((col_name, y), "… pedido continúa", font=f["small"], fill=_FAINT)
            y += 32
            break

    y += 14
    draw.line([(_PAD, y), (_W - _PAD, y)], fill=_BORDER, width=2)
    y += 34

    # ── total ──
    draw.text((_PAD, y), "Total", font=f["heading"], fill=_MUTED)
    total_txt = _euro(total)
    ttw = draw.textlength(total_txt, font=f["total"])
    draw.text((_W - _PAD - ttw, y - 4), total_txt, font=f["total"], fill=_SAFFRON)
    y += 60

    # ── payment status / terms ──
    status_txt = paid_note or ("Pagado con tarjeta" if paid else "Recibe 30 días")
    draw.text((_PAD, y), status_txt, font=f["body_bold"],
              fill=_SAFFRON if paid else _MUTED)

    # ── footer: never mistaken for a tax invoice unless Stripe issued a real one (see module docstring) ──
    footer = "Resumen del pedido · no es una factura fiscal" if not paid else \
             "Resumen del pedido — la factura de Stripe es el documento fiscal"
    draw.text((_PAD, _H - 56), footer, font=f["small"], fill=_FAINT)

    buf = io.BytesIO()
    img.save(buf, format="PDF")
    return buf.getvalue()
