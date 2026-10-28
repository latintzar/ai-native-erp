"""brain/order_card.py — THE CLEAN ORDER CARD, rendered as an actual image for WhatsApp.

Peter, 2026-07-27: *"the runtime shouldn't send the links before it confirms the order. and should
make an image of the clean order card and send it as an image to the customer with a questionnaire to
confirm if that's correct or if not with the button whatsapp thing."*

Until this pass, the moment an order was FILED (extracted from the customer's message, before any
comercial had looked at it) the runtime sent the customer their portal link — see `pipeline._settle_review`
and `_offer_portal_link`'s own docstring, which says the quiet part out loud: "the customer has been
ACKNOWLEDGED, never CONFIRMED". This module is the missing step in between: what Rocoto understood,
drawn as a picture a customer can glance at on a phone screen, followed by a one-tap Sí/No. The link
now only goes out once they say yes (`pipeline.ask_order_confirm` / `resolve_order_confirm_tap`).

WHY AN IMAGE AND NOT TEXT. A WhatsApp order confirmation as a wall of "1x PALETA COCIDA — 3kg — 12,40€"
text reads like a receipt from a bad printer; a business's own customers deserve the same care an
e-commerce checkout would give them. This draws it instead — the same information, laid out the way a
real order summary looks.

NOTHING HERE INVENTS A NUMBER. Lines and totals ride straight off `portal._lines_out`/`_order_total`
(the exact same shape the confirmation LINK page itself renders from) — one source of truth for what
"the order" means, never a second copy that could disagree with the first.
"""
from __future__ import annotations

import logging
import textwrap
from typing import Any, Optional

from PIL import Image, ImageDraw, ImageFont

log = logging.getLogger("rocoto.brain.order_card")

# Brand ink, on the app's own cream — DESIGN-CANON's palette, not a colour invented for this module.
_BG = (250, 247, 243)
_INK = (26, 20, 19)
_MUTED = (111, 102, 92)
_FAINT = (176, 166, 153)
_BORDER = (229, 221, 208)
_SAFFRON = (192, 27, 44)          # the brand red — used ONLY for the total, the one figure that matters

_W = 900
_PAD = 56
_ROW_H = 64
_FONT_PATHS = (
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
)


def _fonts() -> dict[str, ImageFont.FreeTypeFont]:
    """Loaded once per render (cheap — this fires a handful of times a day, not per request) rather
    than cached at import time: a missing font file must degrade to Pillow's bitmap default, never
    crash the confirmation this image exists to send."""
    try:
        reg = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
        bold = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
        return {
            "title": ImageFont.truetype(bold, 44),
            "kicker": ImageFont.truetype(bold, 20),
            "heading": ImageFont.truetype(bold, 30),
            "body": ImageFont.truetype(reg, 28),
            "body_bold": ImageFont.truetype(bold, 28),
            "small": ImageFont.truetype(reg, 22),
            "qty": ImageFont.truetype(bold, 27),
            "total": ImageFont.truetype(bold, 40),
        }
    except Exception:
        log.warning("order_card: system font missing, falling back to Pillow's bitmap default")
        d = ImageFont.load_default()
        return dict.fromkeys(("title", "kicker", "heading", "body", "body_bold", "small", "qty", "total"), d)


def _euro(v: Optional[float]) -> str:
    """«12,40 €» — Spanish decimal comma, the same convention `brain/stock._es` uses elsewhere."""
    if v is None:
        return ""
    s = f"{v:.2f}".replace(".", ",")
    return f"{s} €"


def _qty_es(qty: Optional[float], unit: str) -> str:
    """«3 kg» / «2,5 cajas» — whole numbers lose the decimal, same convention as `brain/stock._es`."""
    if qty is None:
        return unit or ""
    q = str(int(qty)) if qty == int(qty) else f"{qty:.2f}".rstrip("0").rstrip(".")
    return f"{q.replace('.', ',')} {unit}".strip()


def render_order_card(*, business_name: str, customer_name: str, lines: list[dict[str, Any]],
                      total: Optional[float], fecha: str = "") -> bytes:
    """The clean order card → PNG bytes. `lines` is `portal._lines_out`'s own shape
    (nombre/cantidad/unidad/precio/importe/peso_variable) — the exact list the confirmation link page
    renders, so a customer never sees two different descriptions of the same order.

    `fecha` is the caller's own es-ES date string (Peter, 2026-07-28: "also needs date") — this module
    does not compute one itself (no timezone opinion belongs in a drawing function); blank omits the
    line entirely rather than falling back to a guess.

    Height grows with the line count (wrapped at two lines per product, so a long name never runs off
    the card) — there is no scrolling on an image, so nothing may be silently cut off."""
    f = _fonts()
    # Pre-measure: every line's wrapped height, so the canvas is exactly tall enough and never padded
    # with empty cream or, worse, clipped mid-row. Names wrap narrower than the full width because the
    # quantity is right-aligned on the same baseline and the two must never collide.
    wrapped: list[list[str]] = []
    for ln in lines:
        name = str(ln.get("nombre") or "").strip() or "—"
        wrapped.append(textwrap.wrap(name, width=28) or [name])

    # NO PRICES ⇒ NO MONEY FURNITURE AT ALL (Peter, 2026-07-28: "no need for the total right now as
    # prices aren't in. if no prices, should be making it just with quantities"). A «Total: a
    # confirmar» row under a list that carries no figures is a promise of a number nobody has, and it
    # costs the card its whole point: a customer glancing at a phone should see WHAT and HOW MUCH,
    # nothing else. So the total block only exists when there IS a total, and a line's price sub-line
    # only when that line has one — the layout collapses to a clean product/quantity list otherwise.
    priced = total is not None
    any_line_priced = any(ln.get("importe") is not None or ln.get("peso_variable") for ln in lines)

    # `len(w) - 1` — the EXTRA wrapped lines only. The first line is already inside `row_h`; counting
    # it twice (the earlier `max(1, …)`) left a block of dead cream under the last product.
    row_h = 74 if any_line_priced else 52
    body_h = sum((len(w) - 1) * 34 + row_h for w in wrapped)
    # These MUST match what the drawing code below actually advances `y` by — they are not taste.
    # The header was hardcoded 18px short of its own drawing, which the old over-counted `body_h`
    # happened to mask; once that was fixed the footer landed on top of the total.
    header_h = (_PAD + 14) + 34 + 58 + (34 if customer_name else 0) + 32
    total_h = 104 if priced else 22   # the rule + the Total row, or just air before the footer
    footer_h = 66                     # the one attribution line, and nothing under it
    height = header_h + body_h + total_h + footer_h

    img = Image.new("RGB", (_W, height), _BG)
    draw = ImageDraw.Draw(img)

    # ── header: a saffron band, so the card is unmistakably Rocoto's at a glance in a chat list ──
    draw.rectangle([(0, 0), (_W, 8)], fill=_SAFFRON)

    y = _PAD + 14
    draw.text((_PAD, y), "TU PEDIDO", font=f["kicker"], fill=_SAFFRON)
    if fecha:
        fw = draw.textlength(fecha, font=f["small"])
        draw.text((_W - _PAD - fw, y - 1), fecha, font=f["small"], fill=_MUTED)
    y += 34
    draw.text((_PAD, y), business_name or "Tu pedido", font=f["title"], fill=_INK)
    y += 58
    if customer_name:
        draw.text((_PAD, y), customer_name, font=f["small"], fill=_MUTED)
        y += 34
    draw.line([(_PAD, y), (_W - _PAD, y)], fill=_BORDER, width=2)
    y += 32

    # ── the lines: name left, quantity right in the brand colour (it is what they are checking) ──
    for i, (ln, name_lines) in enumerate(zip(lines, wrapped)):
        if i:
            # a hairline between products — the eye needs the rows separated to check them one by one
            draw.line([(_PAD, y - 18), (_W - _PAD, y - 18)], fill=_BORDER, width=1)
        qty_txt = _qty_es(ln.get("cantidad"), str(ln.get("unidad") or ""))
        qw = draw.textlength(qty_txt, font=f["qty"])
        draw.text((_W - _PAD - qw, y + 2), qty_txt, font=f["qty"], fill=_SAFFRON)

        draw.text((_PAD, y), name_lines[0], font=f["body_bold"], fill=_INK)
        y += 34
        for extra in name_lines[1:]:
            draw.text((_PAD, y), extra, font=f["body_bold"], fill=_INK)
            y += 34

        price_txt = _euro(ln.get("importe")) if ln.get("importe") is not None else (
            "peso variable" if ln.get("peso_variable") else "")
        if price_txt:
            draw.text((_PAD, y), price_txt, font=f["small"], fill=_FAINT)
            y += 40
        else:
            y += 18

    # ── the total — the ONE figure in the brand colour, and ONLY when we can stand behind it. No
    # total ⇒ no rule and no «a confirmar» row either: see the note above the height calculation. ──
    if priced:
        y += 4
        draw.line([(_PAD, y), (_W - _PAD, y)], fill=_INK, width=3)
        y += 34
        draw.text((_PAD, y + 8), "Total", font=f["heading"], fill=_MUTED)
        total_txt = _euro(total)
        tw = draw.textlength(total_txt, font=f["total"])
        draw.text((_W - _PAD - tw, y), total_txt, font=f["total"], fill=_SAFFRON)

    # ── footer: whose voice this is, so the card is never mistaken for an invoice ──
    draw.text((_PAD, height - 52), "Rocoto · escrito por tu proveedor", font=f["small"], fill=_FAINT)

    import io
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()
