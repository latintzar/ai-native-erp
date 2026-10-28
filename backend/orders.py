"""Phase-A order intake — UNGROUNDED extraction → Excel dispatch.

The "to Excel" core (see product/PHASE-A-orders-to-excel.md). NO per-customer catalogue
grounding yet (Phase B): we extract raw {item, qty, unit, price?} lines straight from the
message/transcript, the operator reviews + approves in the app, and approved orders are
compiled into an **Excel** file and emailed on a configurable cadence.

Three pure-ish pieces, each testable on its own:
  - extract_order_sync(text, …)  → Claude Sonnet structured-output extraction (run in a thread,
    mirroring transcribe.polish_sync). Returns an order dict or None (not an order).
  - build_excel(orders)          → openpyxl .xlsx bytes, grouped by order.
  - send_email_async(...)         → Resend HTTP API via httpx (already a dep). No SDK needed.
  - dispatch_async(orders, to)    → build + email; returns a small result dict.

Storage + cadence/scheduler live in db.py + app.py; this module is the engine.
"""
from __future__ import annotations

import base64
import io
import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Optional

import anthropic
import httpx

import business_day
import config
import delivery as _delivery
import mindcheck as _mind

log = logging.getLogger("rocoto.orders")

# ──────────────────────────── extraction ────────────────────────────

# Tool schema the model MUST fill. Ungrounded: `item` is the product phrase as the customer
# said it (NOT matched to a SKU — sku is added in Phase B). `confidence` = how sure the model
# is it read the line right, so the app's red-underline trust surface still works.
_RECORD_ORDER_TOOL = {
    "name": "record_order",
    "description": (
        "Record whether this WhatsApp message is a customer ORDER for a food "
        "producer-distributor, and if so its line items. Spanish embutidos/charcutería/"
        "fruta-verdura context. Do NOT invent products or quantities — only what is stated. "
        "If it is not an order (a greeting, a question, chit-chat, a complaint), set is_order=false."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "is_order": {"type": "boolean", "description": "true only if this message places/changes an order"},
            "customer_name": {"type": "string", "description": "customer/business name if stated, else empty"},
            "delivery_date": {
                "type": ["string", "null"],
                "description": (
                    "The date the customer wants DELIVERY, as ISO YYYY-MM-DD. Resolve relative "
                    "phrases ('mañana', 'pasado mañana', 'el jueves', 'para el viernes', 'hoy') "
                    "against the reference date given in the system prompt. Orders are often for "
                    "a FUTURE day. null if no delivery date is stated."
                ),
            },
            "lines": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "raw_text": {"type": "string", "description": "the exact phrase from the message this line came from"},
                        "item": {"type": "string", "description": "the product as stated (e.g. 'chorizo ibérico', 'la de cabeza') — NOT a SKU"},
                        "qty": {"type": "number", "description": "numeric quantity; if a range/unclear use best read and lower confidence"},
                        "unit": {"type": "string", "description": "unit as stated: kg, ud, caja, docena, sarta, … (empty if none)"},
                        "price": {"type": ["number", "null"], "description": "unit price if the customer stated one, else null"},
                        "note": {"type": "string", "description": "any qualifier ('loncheado', 'para el viernes'), else empty"},
                        "confidence": {"type": "string", "enum": ["low", "medium", "high"], "description": "how sure you read THIS line correctly"},
                        "mentions": {
                            "type": "array",
                            "description": (
                                "the exact substrings FROM THE MESSAGE that make up this line, each tagged by "
                                "category — for inline highlighting in the transcript. Copy the words verbatim "
                                "as they appear (same casing/accents) so they can be located in the text."
                            ),
                            "items": {
                                "type": "object",
                                "properties": {
                                    "text": {"type": "string", "description": "the verbatim substring as it appears in the message"},
                                    "category": {"type": "string", "enum": ["producto", "cantidad", "fecha", "cliente"], "description": "producto=item name, cantidad=quantity+unit, fecha=delivery date/time, cliente=customer name"},
                                },
                                "required": ["text", "category"],
                            },
                        },
                    },
                    "required": ["raw_text", "item", "qty", "unit", "confidence"],
                },
            },
        },
        "required": ["is_order", "lines"],
    },
}

_SYSTEM = (
    "You read WhatsApp messages sent to a small Spanish family food producer-distributor "
    "(meat/embutidos, fruta-verdura, panadería). Customers (bars, restaurants, shops) order in "
    "informal Spanish — voice notes transcribed to text, shorthand, 'lo de siempre', nicknames. "
    "Your ONLY job is to decide if the message is an order and, if so, extract the line items "
    "EXACTLY as stated. You are NOT matching to a catalogue and you NEVER invent items, "
    "quantities or prices. When unsure on a line, still record it but mark confidence low — a "
    "human will review every order before anything is sent."
)


def _date_context(ref_date: Optional[str]) -> str:
    """The reference date the model resolves «mañana» against.

    ⚠️ IT IS THE BUSINESS DAY, NOT THE CALENDAR DAY (2026-08-19). This used to hand over
    `datetime.now().date()`, so a customer writing at 00:30 «para mañana» was told today is the
    20th and filed the order for the 21st. Raquel is at the market at that hour and her working day
    has not turned over — «hoy» is still the 19th and «mañana» is the 20th. The order landed on a
    day she was not printing: «cuando voy a imprimir no lo tengo, me vuelvo loca».

    An explicit `ref_date` still wins — the caller knows something we do not."""
    dias = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
    if ref_date:
        try:
            d = datetime.fromisoformat(ref_date).date()
        except ValueError:
            d = business_day.today()
    else:
        d = business_day.today()
    return (
        f"\n\nReference date (today) is {d.isoformat()} ({dias[d.weekday()]}). "
        f"Resolve any relative delivery date in the message against this. "
        f"Note this is the SUPPLIER'S working day: before dawn it is still the previous "
        f"calendar date, because the market night belongs to the day before."
    )


def extract_order_sync(text: str, phone: str, name: str = "",
                       source_message_ids: Optional[list[str]] = None,
                       ref_date: Optional[str] = None) -> Optional[dict]:
    """Classify + extract one message into an order dict, or None if it isn't an order.

    Synchronous (call via asyncio.to_thread, like transcribe.polish_sync). Returns the order
    shape stored in db.orders: id/phone_number/customer_name/source_message_ids/status/lines/
    delivery_date. `ref_date` (ISO) anchors relative delivery dates; defaults to today.
    """
    text = (text or "").strip()
    if not text or not config.ANTHROPIC_API_KEY:
        return None
    # Reliability: an arriving order must NOT be silently dropped on a transient Anthropic 529
    # (overloaded). The SDK backs off `max_retries` times; if the primary model stays overloaded we
    # fall back to a second model (usually has spare capacity during a primary-model overload).
    client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY, max_retries=8, timeout=60.0)
    models = [config.ORDER_EXTRACT_MODEL]
    if config.ORDER_EXTRACT_FALLBACK_MODEL and config.ORDER_EXTRACT_FALLBACK_MODEL not in models:
        models.append(config.ORDER_EXTRACT_FALLBACK_MODEL)
    resp = None
    for model in models:
        try:
            resp = client.messages.create(
                model=model,
                max_tokens=1500,
                system=_SYSTEM + _date_context(ref_date),
                tools=[_RECORD_ORDER_TOOL],
                tool_choice={"type": "tool", "name": "record_order"},
                messages=[{"role": "user", "content": text}],
            )
            _mind.note_ok()
            break
        except (anthropic.OverloadedError, anthropic.RateLimitError, anthropic.APITimeoutError) as e:
            _mind.note_fail(e)
            log.warning("order extraction overloaded on %s for %s; trying next model", model, phone)
            continue
        except Exception as e:
            # The Phase-A extractor is the LAST rail an order can arrive on, so its failures are the
            # most important ones to notice: this is exactly where a dead key stops being a log line
            # and starts being a lost order (mindcheck.py).
            _mind.note_fail(e)
            log.exception("order extraction call failed for %s", phone)
            return None
    if resp is None:
        log.warning("order extraction unavailable (all models overloaded) for %s", phone)
        return None

    data: Optional[dict] = None
    for block in resp.content:
        if getattr(block, "type", None) == "tool_use" and block.name == "record_order":
            data = block.input
            break
    if not data or not data.get("is_order"):
        return None
    lines = [_clean_line(l) for l in (data.get("lines") or []) if l.get("item")]
    if not lines:
        return None
    return {
        "id": str(uuid.uuid4()),
        "phone_number": phone,
        "customer_name": (data.get("customer_name") or name or "").strip(),
        "source_message_ids": source_message_ids or [],
        "status": "needs_review",
        "lines": lines,
        "note": "",
        "delivery_date": _clean_iso_date(data.get("delivery_date")),
    }


def _clean_iso_date(v) -> Optional[str]:
    """Keep only a valid ISO YYYY-MM-DD; anything else → None (stored as text, sorts chronologically)."""
    if not v or not isinstance(v, str):
        return None
    s = v.strip()[:10]
    try:
        datetime.strptime(s, "%Y-%m-%d")
        return s
    except ValueError:
        return None


def _clean_line(l: dict) -> dict:
    try:
        qty = float(l.get("qty") or 0)
    except (TypeError, ValueError):
        qty = 0.0
    price = l.get("price")
    try:
        price = float(price) if price is not None else None
    except (TypeError, ValueError):
        price = None
    conf = (l.get("confidence") or "medium").lower()
    if conf not in ("low", "medium", "high"):
        conf = "medium"
    return {
        "raw_text": (l.get("raw_text") or "").strip(),
        "item": (l.get("item") or "").strip(),
        "qty": qty,
        "unit": (l.get("unit") or "").strip(),
        "price": price,
        "note": (l.get("note") or "").strip(),
        "confidence": conf,
        "mentions": _clean_mentions(l.get("mentions")),
    }


_VALID_CATEGORIES = ("producto", "cantidad", "fecha", "cliente")


def _clean_mentions(raw) -> list[dict]:
    """Category-tagged verbatim substrings for inline transcript highlighting."""
    out: list[dict] = []
    for m in (raw or []):
        if not isinstance(m, dict):
            continue
        text = (m.get("text") or "").strip()
        cat = (m.get("category") or "").strip().lower()
        if text and cat in _VALID_CATEGORIES:
            out.append({"text": text, "category": cat})
    return out


# ──────────────────────────── Excel ────────────────────────────

# Export template presets (spec §9 item 5 — Peter: «ship templates. good ones. and then for custom
# templates we do THAT later»). NOT a template builder: a fixed, curated set covering how a Spanish
# food distributor actually consumes a day's orders. Each preset is a stable id → its Spanish display
# name, one-line Spanish description, and the columns it emits — everything a frontend needs to list
# them without knowing anything about how the sheet is built. `EXCEL_FORMATS` (the id list every
# `fmt`/`format` param downstream validates against) is derived from this, so the two can never drift.
EXPORT_PRESETS: dict[str, dict] = {
    "standard": {
        "id": "standard",
        "name": "Hoja de picking",
        "description": "Cada pedido en su bloque, listo para preparar cliente a cliente.",
        "columns": ["Cliente", "Producto", "Cantidad", "Ud", "Precio", "Importe", "Nota"],
    },
    "albaranes": {
        "id": "albaranes",
        "name": "Albaranes por cliente",
        "description": "Un albarán por cliente, con su fecha de entrega.",
        "columns": ["Fecha", "Producto", "Cantidad", "Ud", "Precio", "Importe", "Nota"],
    },
    "totales": {
        "id": "totales",
        "name": "Totales por producto",
        "description": "Cada artículo sumado del día, listo para la furgoneta o para compras.",
        "columns": ["Artículo", "Cantidad", "Ud"],
    },
    "flat": {
        "id": "flat",
        "name": "Exportación plana",
        "description": "Una fila por línea de pedido, lista para pegar en tu programa de gestión.",
        "columns": ["Pedido", "Cliente", "Producto", "Cantidad", "Ud", "Precio", "Importe", "Nota"],
    },
    "sage50": {
        "id": "sage50",
        "name": "Exportación Sage 50",
        "description": "La fila plana con las columnas que ya usa Sage 50.",
        "columns": ["Fecha", "Cliente", "Producto", "Cantidad", "Ud", "Precio", "Importe", "Nota"],
    },
}
EXCEL_FORMATS = tuple(EXPORT_PRESETS.keys())


def build_excel(orders: list[dict], fmt: str = "standard",
                columns: list[dict] | None = None,
                per_customer: dict[str, list[dict]] | None = None) -> bytes:
    """One .xlsx of the approved orders, in the chosen `fmt` (a key of EXPORT_PRESETS):
      • standard  — grouped by order, styled, per-order subtotals (the picking/prep sheet).
      • albaranes — grouped by CUSTOMER (not order), one delivery block per customer with a delivery-
        note number and each line's own delivery date (the per-customer delivery sheet).
      • totales   — every article summed across the day, no customer names, no prices (§17.36(1) —
        the compras/van-loading shape).
      • flat      — one flat table, a row per line with a Pedido # column (easy to filter/pivot/import).
      • sage50    — Sage-50-style flat columns (Fecha · Cliente · Producto · Cantidad · Precio · Importe).
    MVP per-customer columns (2026-07-23): when `columns` (the supplier's default layout) and/or
    `per_customer` (phone → that customer's own column layout) are set, the column-map renderer wins —
    the file drops into how THEY already work. Orders sharing a layout share a sheet; a customer with
    their own layout gets their own sheet. Falls back to `fmt` when no map is configured.
    Human-usable files (the operator pastes/keys them into their accounting tool) — native Sage 50
    import is master-data-only, so these are intentionally NOT auto-import formats."""
    if columns or per_customer:
        return _build_excel_columns(orders, columns or _DEFAULT_COLUMNS, per_customer or {})
    if (fmt or "standard") == "albaranes":
        return _build_excel_albaranes(orders)
    if (fmt or "standard") == "totales":
        # §17.36(1): the compras shape — quantities only; customer names never leave the building
        return _build_excel_totales(orders)
    if (fmt or "standard") in ("flat", "sage50"):
        return _build_excel_flat(orders, sage=(fmt == "sage50"))
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Border, Font, PatternFill, Side

    wb = Workbook()
    ws = wb.active
    ws.title = "Pedidos"

    title_font = Font(name="Calibri", size=14, bold=True, color="211C15")
    head_font = Font(name="Calibri", size=10, bold=True, color="FBF8F2")
    head_fill = PatternFill("solid", fgColor="2A2018")
    cust_font = Font(name="Calibri", size=11, bold=True, color="211C15")
    mono = Font(name="Consolas", size=10)
    thin = Side(style="thin", color="D8CFC2")
    border = Border(bottom=thin)
    right = Alignment(horizontal="right")

    today = datetime.now(timezone.utc).astimezone().strftime("%d/%m/%Y")
    ws["A1"] = f"Pedidos — {today}"
    ws["A1"].font = title_font
    ws.append([])

    headers = ["Cliente", "Producto", "Cantidad", "Ud", "Precio", "Importe", "Nota"]
    widths = [26, 34, 11, 8, 10, 12, 28]
    for i, w in enumerate(widths, start=1):
        ws.column_dimensions[chr(64 + i)].width = w

    def _header_row() -> None:
        r = ws.max_row + 1
        for i, h in enumerate(headers, start=1):
            c = ws.cell(row=r, column=i, value=h)
            c.font = head_font
            c.fill = head_fill
            c.alignment = right if i in (3, 5, 6) else Alignment(horizontal="left")

    grand = 0.0
    for order in orders:
        _header_row()
        cust = order.get("customer_name") or order.get("phone_number") or ""
        first = True
        sub = 0.0
        for ln in order.get("lines", []):
            qty = float(ln.get("qty") or 0)
            price = ln.get("price")
            importe = (qty * float(price)) if price else None
            if importe:
                sub += importe
            r = ws.max_row + 1
            vals = [
                cust if first else "",
                ln.get("item", ""),
                qty or "",
                ln.get("unit", ""),
                # Spanish money via delivery.euros() — same helper, same shape as the albaranes
                # sheet, so a picking sheet and a driver's ledger never disagree on "1.234,56 €".
                (_delivery.euros(round(float(price) * 100)) if price is not None else ""),
                (_delivery.euros(round(importe * 100)) if importe is not None else ""),
                ln.get("note", ""),
            ]
            for i, v in enumerate(vals, start=1):
                c = ws.cell(row=r, column=i, value=v)
                c.font = mono if i in (2, 3, 4, 5, 6) else cust_font if (i == 1 and first) else Font(size=10)
                if i in (3, 5, 6):
                    c.alignment = right
                c.border = border
            first = False
        if sub:
            grand += sub
            r = ws.max_row + 1
            tc = ws.cell(row=r, column=5, value="Total")
            tc.font = Font(size=10, bold=True)
            tc.alignment = right
            vc = ws.cell(row=r, column=6, value=_delivery.euros(round(sub * 100)))
            vc.font = Font(name="Consolas", size=10, bold=True)
            vc.alignment = right
        ws.append([])

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


# openpyxl RAISES on these in a sheet title (and on >31 chars) — one dirty customer name
# ('Bar "Niño"/Q:*') must never kill a whole dispatch (eng F11).
_ILLEGAL_SHEET_CHARS = re.compile(r"[\\/*?:\[\]]")


def _safe_sheet_title(name: str, taken: set[str]) -> str:
    """A customer name → a legal, unique worksheet title. Strips openpyxl-illegal characters,
    collapses whitespace, trims to length, never returns empty, and dedupes within the workbook
    (same sanitized name on two customers → 'Nombre' / 'Nombre (2)')."""
    t = _ILLEGAL_SHEET_CHARS.sub(" ", str(name or ""))
    t = re.sub(r"\s+", " ", t).strip().strip("'")[:28].strip() or "Cliente"
    base, n = t, 2
    while t.lower() in taken:
        suffix = f" ({n})"
        t = base[: 28 - len(suffix)] + suffix
        n += 1
    taken.add(t.lower())
    return t


_DEFAULT_COLUMNS = [
    {"header": "Fecha", "field": "fecha", "order": 0},
    {"header": "Cliente", "field": "cliente", "order": 1},
    # §17.35: their own article code, right after the customer — for the bookkeeper who imports.
    # Dropped from the default automatically when the file carries no codes at all (below).
    {"header": "Código", "field": "codigo", "order": 2},
    {"header": "Producto", "field": "producto", "order": 3},
    {"header": "Cantidad", "field": "cantidad", "order": 4},
    {"header": "Ud", "field": "unidad", "order": 5},
    {"header": "Precio", "field": "precio", "order": 6},
    {"header": "Importe", "field": "importe", "order": 7},
    {"header": "Nota", "field": "nota", "order": 8},
]
_NUM_FIELDS = {"cantidad", "precio", "importe"}


def _build_excel_columns(orders: list[dict], default_cols: list[dict],
                         per_customer: dict[str, list[dict]]) -> bytes:
    """Column-map renderer (MVP per-customer Excel). One row per order line; the columns — headers,
    fields, order — are the supplier's own (default layout), overridden per customer by THEIR layout.
    Orders sharing a layout share a worksheet; a customer with an override gets their own sheet, so a
    file never mixes two bookkeepers' habits on one table."""
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Border, Font, PatternFill, Side

    has_codes = any((ln.get("code") for o in orders for ln in (o.get("lines") or [])))

    def _norm(cols) -> list[dict]:
        cs = sorted([c for c in (cols or []) if c.get("field")], key=lambda c: int(c.get("order") or 0))
        if cs:
            return cs                              # a customer's own layout is never edited
        df = list(_DEFAULT_COLUMNS)
        if not has_codes:                          # no codes anywhere → the column is not offered
            df = [c for c in df if c.get("field") != "codigo"]
        return df

    today = datetime.now(timezone.utc).astimezone().strftime("%d/%m/%Y")

    def _value(field: str, order: dict, ln: dict, oi: int):
        qty = float(ln.get("qty") or 0)
        price = ln.get("price")
        if field == "fecha":
            return today
        if field == "cliente":
            return order.get("customer_name") or order.get("phone_number") or ""
        if field == "producto":
            return ln.get("item", "")
        if field == "codigo":
            # THE SUPPLIER'S OWN article code (WP-3, eng F6): only ever ln["code"] — the matcher
            # carries it as a separate field. NEVER the internal sku id (ln["sku"]/["sku_id"]),
            # which is the alias/accept-rule keying chain, not a code their bookkeeper knows.
            return ln.get("code") or ""
        if field == "codigo_cliente":
            # the customer's ERP CLIENT code (customer_profiles.erp_client_code) — resolved at
            # dispatch onto the order dict, so the supplier's import keeps referential integrity.
            return order.get("erp_client_code") or ""
        if field == "cantidad":
            return qty or ""
        if field == "unidad":
            return ln.get("unit", "")
        if field == "precio":
            return f"{float(price):.2f}" if price is not None else ""
        if field == "importe":
            return f"{qty * float(price):.2f}" if (price is not None and qty) else ""
        if field == "nota":
            return ln.get("note", "")
        if field == "pedido":
            return oi
        return ""

    # group orders by their effective layout (default vs a customer override). Per-customer groups
    # key on the PHONE — the identity the override is configured on — never the display name
    # (eng F11: two different customers both called "Bar Paco" must land on SEPARATE sheets, each
    # under THEIR OWN column layout). The name only titles the sheet, sanitized + deduped.
    by_phone: dict[str, tuple[str, list[dict], list[tuple[int, dict]]]] = {}  # phone -> (name, cols, rows)
    phone_order: list[str] = []
    default_group: list[tuple[int, dict]] = []
    for oi, order in enumerate(orders, start=1):
        ph = str(order.get("phone_number") or "")
        override = per_customer.get(ph)
        if override:
            if ph not in by_phone:
                by_phone[ph] = (str(order.get("customer_name") or ph or "Cliente"),
                                _norm(override), [])
                phone_order.append(ph)
            by_phone[ph][2].append((oi, order))
        else:
            default_group.append((oi, order))
    taken: set[str] = {"pedidos"} if default_group else set()
    sheets = ([("Pedidos", _norm(default_cols), default_group)] if default_group else []) + [
        (_safe_sheet_title(by_phone[ph][0], taken), by_phone[ph][1], by_phone[ph][2])
        for ph in phone_order
    ]

    wb = Workbook()
    wb.remove(wb.active)
    head_font = Font(name="Calibri", size=10, bold=True, color="FBF8F2")
    head_fill = PatternFill("solid", fgColor="2A2018")
    mono = Font(name="Consolas", size=10)
    body = Font(name="Calibri", size=10)
    border = Border(bottom=Side(style="thin", color="E4DCCE"))
    right = Alignment(horizontal="right")

    for sheet_name, cols, rows in sheets:
        ws = wb.create_sheet(title=sheet_name)
        num_idx = {i for i, c in enumerate(cols, start=1) if c["field"] in _NUM_FIELDS}
        for i, c in enumerate(cols, start=1):
            ws.column_dimensions[ws.cell(row=1, column=i).column_letter].width = 26 if c["field"] in ("cliente", "producto", "nota") else 12
            h = ws.cell(row=1, column=i, value=c.get("header") or c["field"].title())
            h.font = head_font
            h.fill = head_fill
            h.alignment = right if i in num_idx else Alignment(horizontal="left")
        for oi, order in rows:
            for ln in order.get("lines", []):
                r = ws.max_row + 1
                for i, c in enumerate(cols, start=1):
                    cell = ws.cell(row=r, column=i, value=_value(c["field"], order, ln, oi))
                    cell.font = mono if i in num_idx else body
                    if i in num_idx:
                        cell.alignment = right
                    cell.border = border

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def _build_excel_totales(orders: list[dict]) -> bytes:
    """TOTALS ONLY — the purchase-order shape (§17.36 correction 1): an article, a unit, the
    day's summed quantity. NO customer names, NO per-order columns, NO prices — those are the
    supplier's book, and a compras send goes to an outside partner by design."""
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Border, Font, PatternFill, Side

    wb = Workbook()
    ws = wb.active
    ws.title = "Compras"
    head_font = Font(name="Calibri", size=10, bold=True, color="FBF8F2")
    head_fill = PatternFill("solid", fgColor="2A2018")
    body = Font(name="Calibri", size=10)
    thin = Side(style="thin", color="E4DCCE")
    border = Border(bottom=thin)
    right = Alignment(horizontal="right")

    totals: dict[str, dict] = {}
    for o in orders:
        for l in o.get("lines") or []:
            key = str(l.get("item") or l.get("raw_text") or "")
            if not key:
                continue
            t = totals.setdefault(key, {"unit": str(l.get("unit") or ""), "qty": 0.0})
            try:
                t["qty"] += float(l.get("qty") or 0)
            except (TypeError, ValueError):
                pass
    for i, w in enumerate((44, 12, 8), start=1):
        ws.column_dimensions[chr(64 + i)].width = w
    for i, h in enumerate(("Artículo", "Cantidad", "Ud"), start=1):
        c = ws.cell(row=1, column=i, value=h)
        c.font, c.fill = head_font, head_fill
    row = 2
    for name in sorted(totals):
        t = totals[name]
        ws.cell(row=row, column=1, value=name).font = body
        q = ws.cell(row=row, column=2, value=round(t["qty"], 2))
        q.font, q.alignment, q.border = body, right, border
        ws.cell(row=row, column=3, value=t["unit"]).font = body
        row += 1
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def _es_date(iso: Optional[str]) -> Optional[str]:
    """ISO 'YYYY-MM-DD' (an order's `delivery_date`) → Spanish 'DD/MM/YYYY' for display.
    None or unparseable → None, so the caller can fall back to today (the same default every other
    Excel builder in this file uses when an order carries no delivery date)."""
    if not iso or not isinstance(iso, str):
        return None
    try:
        return datetime.strptime(iso[:10], "%Y-%m-%d").strftime("%d/%m/%Y")
    except ValueError:
        return None


def _build_excel_albaranes(orders: list[dict]) -> bytes:
    """Per-customer delivery sheet (preset «albaranes»): one block per CUSTOMER, not per order — a
    customer with two approved orders in the same dispatch gets ONE albarán, not two. Groups by
    PHONE, the identity (the same eng F11 pattern as `_build_excel_columns`: two different customers
    that happen to share a display name — e.g. two "Bar Paco" — must never merge into one block).
    Every line carries its own delivery date rather than forcing one date onto the whole block,
    since a customer's several orders can legitimately ask for different days. Amounts render via
    delivery.euros() — the ONE place in this product euros become words — so a picking sheet and a
    driver's ledger never disagree on what "1.234,56 €" looks like."""
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Border, Font, PatternFill, Side

    wb = Workbook()
    ws = wb.active
    ws.title = "Albaranes"

    block_font = Font(name="Calibri", size=12, bold=True, color="211C15")
    meta_font = Font(name="Calibri", size=10, italic=True, color="5B5348")
    head_font = Font(name="Calibri", size=10, bold=True, color="FBF8F2")
    head_fill = PatternFill("solid", fgColor="2A2018")
    mono = Font(name="Consolas", size=10)
    body = Font(name="Calibri", size=10)
    total_font = Font(name="Consolas", size=10, bold=True)
    border = Border(bottom=Side(style="thin", color="E4DCCE"))
    right = Alignment(horizontal="right")

    headers = ["Fecha", "Producto", "Cantidad", "Ud", "Precio", "Importe", "Nota"]
    widths = [12, 34, 11, 8, 12, 12, 28]
    for i, w in enumerate(widths, start=1):
        ws.column_dimensions[chr(64 + i)].width = w
    num_cols = {3, 5, 6}  # Cantidad, Precio, Importe

    today = datetime.now(timezone.utc).astimezone().strftime("%d/%m/%Y")

    by_phone: dict[str, list[dict]] = {}
    names: dict[str, str] = {}
    order_of: list[str] = []
    for order in orders:
        ph = str(order.get("phone_number") or "")
        if ph not in by_phone:
            by_phone[ph] = []
            names[ph] = order.get("customer_name") or ph or "Cliente"
            order_of.append(ph)
        by_phone[ph].append(order)

    n = 0
    grand_cents = 0
    for ph in order_of:
        n += 1
        row = ws.max_row + 1
        ws.cell(row=row, column=1, value=names[ph]).font = block_font
        ws.cell(row=row, column=2, value=f"Albarán nº {n}").font = meta_font

        row = ws.max_row + 1
        for i, h in enumerate(headers, start=1):
            c = ws.cell(row=row, column=i, value=h)
            c.font = head_font
            c.fill = head_fill
            c.alignment = right if i in num_cols else Alignment(horizontal="left")

        sub_cents = 0
        for order in by_phone[ph]:
            fecha = _es_date(order.get("delivery_date")) or today
            for ln in order.get("lines", []):
                qty = float(ln.get("qty") or 0)
                price = ln.get("price")
                importe = (qty * float(price)) if price is not None else None
                if importe is not None:
                    sub_cents += round(importe * 100)
                vals = [
                    fecha,
                    ln.get("item", ""),
                    qty or "",
                    ln.get("unit", ""),
                    (_delivery.euros(round(float(price) * 100)) if price is not None else ""),
                    (_delivery.euros(round(importe * 100)) if importe is not None else ""),
                    ln.get("note", ""),
                ]
                row = ws.max_row + 1
                for i, v in enumerate(vals, start=1):
                    c = ws.cell(row=row, column=i, value=v)
                    c.font = mono if i in num_cols else body
                    if i in num_cols:
                        c.alignment = right
                    c.border = border
        if sub_cents:
            grand_cents += sub_cents
            row = ws.max_row + 1
            tc = ws.cell(row=row, column=5, value="Total")
            tc.font = total_font
            tc.alignment = right
            vc = ws.cell(row=row, column=6, value=_delivery.euros(sub_cents))
            vc.font = total_font
            vc.alignment = right
        ws.append([])  # spacer between customer blocks

    if grand_cents:
        row = ws.max_row + 1
        tc = ws.cell(row=row, column=5, value="Total general")
        tc.font = total_font
        tc.alignment = right
        vc = ws.cell(row=row, column=6, value=_delivery.euros(grand_cents))
        vc.font = total_font
        vc.alignment = right

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def _build_excel_flat(orders: list[dict], sage: bool = False) -> bytes:
    """Flat one-row-per-line table. `sage=True` uses Sage-50-style columns with a date column;
    otherwise a Pedido #/Cliente table that filters and pivots cleanly.
    Money stays RAW NUMERIC ('12.50', not '12,50 €') on purpose in both `flat` and `sage50` — these
    two are the machine-consumed presets, read back by a management program's import, and a
    Spanish-formatted string with a '€' suffix and comma decimal would break that parse. Dates still
    render dd/mm/yyyy like every other preset; only the currency cells are exempt."""
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Border, Font, PatternFill, Side

    wb = Workbook()
    ws = wb.active
    ws.title = "Pedidos"

    head_font = Font(name="Calibri", size=10, bold=True, color="FBF8F2")
    head_fill = PatternFill("solid", fgColor="2A2018")
    mono = Font(name="Consolas", size=10)
    body = Font(name="Calibri", size=10)
    thin = Side(style="thin", color="E4DCCE")
    border = Border(bottom=thin)
    right = Alignment(horizontal="right")

    today = datetime.now(timezone.utc).astimezone().strftime("%d/%m/%Y")
    if sage:
        headers = ["Fecha", "Cliente", "Producto", "Cantidad", "Ud", "Precio", "Importe", "Nota"]
        widths = [12, 26, 34, 11, 8, 10, 12, 26]
        num_cols = (4, 6, 7)
    else:
        headers = ["Pedido", "Cliente", "Producto", "Cantidad", "Ud", "Precio", "Importe", "Nota"]
        widths = [9, 26, 34, 11, 8, 10, 12, 26]
        num_cols = (4, 6, 7)
    for i, w in enumerate(widths, start=1):
        ws.column_dimensions[chr(64 + i)].width = w

    for i, h in enumerate(headers, start=1):
        c = ws.cell(row=1, column=i, value=h)
        c.font = head_font
        c.fill = head_fill
        c.alignment = right if i in num_cols else Alignment(horizontal="left")

    grand = 0.0
    for oi, order in enumerate(orders, start=1):
        cust = order.get("customer_name") or order.get("phone_number") or ""
        lead = today if sage else oi
        for ln in order.get("lines", []):
            qty = float(ln.get("qty") or 0)
            price = ln.get("price")
            importe = (qty * float(price)) if price else None
            if importe:
                grand += importe
            r = ws.max_row + 1
            vals = [
                lead,
                cust,
                ln.get("item", ""),
                qty or "",
                ln.get("unit", ""),
                (f"{float(price):.2f}" if price is not None else ""),
                (f"{importe:.2f}" if importe is not None else ""),
                ln.get("note", ""),
            ]
            for i, v in enumerate(vals, start=1):
                c = ws.cell(row=r, column=i, value=v)
                c.font = mono if i in (4, 6, 7) else body
                if i in num_cols:
                    c.alignment = right
                c.border = border
    if grand:
        r = ws.max_row + 2
        tc = ws.cell(row=r, column=6, value="Total")
        tc.font = Font(size=10, bold=True)
        tc.alignment = right
        vc = ws.cell(row=r, column=7, value=f"{grand:.2f}")
        vc.font = Font(name="Consolas", size=10, bold=True)
        vc.alignment = right

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


# ──────────────────────────── email (Resend) ────────────────────────────

async def send_email_async(to: str, subject: str, html: str,
                           attachment_name: str | None = None,
                           attachment_bytes: bytes | None = None) -> dict:
    """Send via the Resend HTTP API (no SDK; httpx is already a dep). Returns {ok, id?|error}.
    Attachment optional (WP-0: the held-only notice is a bare email, no Excel to attach)."""
    if config.EGRESS_SANDBOX:
        # class-E floor (WP-2.5 dirty rehearsal find): the DISPATCH email is a real outbound rail —
        # it must short-circuit under the sandbox like every other rail (actions.py pattern).
        log.info("[EGRESS_SANDBOX] suppressed dispatch email to %s (subject=%r)", to, subject[:60])
        return {"ok": True, "id": "SANDBOX-email"}
    if not config.RESEND_API_KEY:
        return {"ok": False, "error": "RESEND_API_KEY unset"}
    payload = {
        "from": config.DISPATCH_FROM_EMAIL,
        "to": [to],
        "subject": subject,
        "html": html,
    }
    if attachment_name and attachment_bytes is not None:
        payload["attachments"] = [{
            "filename": attachment_name,
            "content": base64.b64encode(attachment_bytes).decode("ascii"),
        }]
    try:
        async with httpx.AsyncClient(timeout=30) as cx:
            r = await cx.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {config.RESEND_API_KEY}", "User-Agent": "rocoto-mailer/1.0"},
                json=payload,
            )
        if r.status_code >= 300:
            log.warning("resend send failed %s: %s", r.status_code, r.text[:300])
            return {"ok": False, "error": f"{r.status_code}: {r.text[:200]}"}
        return {"ok": True, "id": (r.json() or {}).get("id", "")}
    except Exception as e:
        log.exception("resend send error")
        return {"ok": False, "error": str(e)}


async def dispatch_async(orders: list[dict], recipient: str, fmt: str = "standard",
                         columns: list[dict] | None = None,
                         per_customer: dict[str, list[dict]] | None = None,
                         held_count: int = 0) -> dict:
    """Compile `orders` into an Excel (column-map when configured, else `fmt`) and email it.
    `held_count` (WP-0 unreviewed-at-cutoff policy, eng F9): how many orders sit unreviewed — HELD,
    never auto-sent — flagged in the daily email so a held set is never a silent hole."""
    if not orders:
        return {"ok": True, "count": 0, "note": "nothing to send"}
    recipient = (recipient or config.DISPATCH_DEFAULT_EMAIL or "").strip()
    if not recipient:
        return {"ok": False, "error": "no recipient configured"}
    xlsx = build_excel(orders, fmt=fmt, columns=columns, per_customer=per_customer)
    today = datetime.now(timezone.utc).astimezone().strftime("%Y-%m-%d")
    n = len(orders)
    held_note = (
        f"<p><b>{held_count}</b> pedido(s) más siguen sin revisar y quedan retenidos — "
        f"se incluirán en el próximo Excel en cuanto los apruebes.</p>"
        if held_count else "")
    html = (
        f"<p>Adjunto el Excel con <b>{n}</b> pedido(s) aprobado(s) del {today}.</p>"
        f"{held_note}"
        f"<p>— Rocoto</p>"
    )
    subject = f"Pedidos {today} ({n})" + (f" · {held_count} sin revisar" if held_count else "")
    res = await send_email_async(recipient, subject, html, f"pedidos-{today}.xlsx", xlsx)
    res["count"] = n
    return res


async def send_held_notice(recipient: str, held_count: int) -> dict:
    """WP-0 unreviewed-at-cutoff policy: the scheduled send found NOTHING approved while `held_count`
    orders sit unreviewed. The daily email still goes out flagging the held set — a day where
    everything is unreviewed must never be a silent day."""
    recipient = (recipient or config.DISPATCH_DEFAULT_EMAIL or "").strip()
    if not recipient:
        return {"ok": False, "error": "no recipient configured"}
    today = datetime.now(timezone.utc).astimezone().strftime("%Y-%m-%d")
    html = (
        f"<p>Hoy no hay pedidos aprobados que enviar.</p>"
        f"<p><b>{held_count}</b> pedido(s) esperan tu revisión y quedan retenidos — "
        f"se incluirán en el próximo Excel en cuanto los apruebes.</p>"
        f"<p>— Rocoto</p>"
    )
    return await send_email_async(
        recipient, f"Pedidos {today} (0 enviados · {held_count} sin revisar)", html)
