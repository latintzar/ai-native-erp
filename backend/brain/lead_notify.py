"""The two alerts Peter gets: somebody priced themselves on /precios, and somebody opened an account.

Peter, 2026-08-14: «Email is the alert, not the record.» That sentence is the whole design. The row
in `leads` is what survives, what the CRM lists and what a later conversation is built on; these
emails exist so Peter finds out within a minute, on his phone, without opening anything. So they
carry EVERYTHING in the body — every quiz answer in the order it was asked, the price this box
computed, why the case was routed to a conversation — because an alert that makes you go and look
something up is a notification, not an alert.

WHY ITS OWN MODULE. `app.py` owns the request and `pricing_quote.py` owns the money; a template that
lives in either of them ends up being edited under pressure by somebody fixing the other. This file
holds only strings and one `actions.send_email` call, and nothing here may raise into a caller: a
Resend outage must cost the alert and never the form submission or the sign-in that triggered it.

MAIL IS TABLES AND INLINE STYLES. Same constraint the welcome email documents — Outlook renders with
Word, which has no flexbox, no grid and no `<style>` block — so the brand colours come from
`pedidos_welcome_email` rather than being typed a second time.

REPLY-TO IS THE LEAD. Peter's most likely next action after reading one of these is to answer the
person, so hitting reply has to reach them and not us.
"""
from __future__ import annotations

import asyncio
import html as _html
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import config
from brain import pricing_quote as pq
from brain.pedidos_welcome_email import INK, LINE, MID, PAPER, RED

log = logging.getLogger("rocoto.lead_notify")

# Strong references to in-flight alert tasks. `asyncio.create_task` only holds a WEAK one, so a task
# nobody keeps can be garbage-collected mid-await and vanish without sending or logging — the exact
# failure that makes fire-and-forget look flaky and unreproducible.
_INFLIGHT: set = set()

_FONT = "-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif"


def to_address() -> str:
    """Where an alert goes. `config.NOTIFY_EMAIL` — see the comment beside it in config.py for how it
    relates to `DEMO_NOTIFY_EMAIL`."""
    return (getattr(config, "NOTIFY_EMAIL", "") or "").strip()


# ─────────────────────────────── html bits ───────────────────────────────

def _esc(v: Any) -> str:
    return _html.escape(str(v if v is not None else ""), quote=True)


def _head(title: str) -> str:
    return (f'<tr><td colspan="2" style="padding:26px 0 8px;font:700 12px/1.3 {_FONT};'
            f'letter-spacing:.08em;text-transform:uppercase;color:{RED}">{_esc(title)}</td></tr>')


def _row(k: str, v: str, *, strong: bool = False) -> str:
    """One label/value line. `v` is ALREADY-ESCAPED html — every caller escapes at its own edge,
    because some values are deliberately marked up (a total in bold) and double-escaping them would
    print the tags."""
    weight = "700" if strong else "400"
    size = "17px" if strong else "15px"
    return (
        f'<tr>'
        f'<td style="padding:9px 0;border-bottom:1px solid {LINE};font:600 13px/1.4 {_FONT};'
        f'color:{MID};vertical-align:top;width:34%">{_esc(k)}</td>'
        f'<td style="padding:9px 0 9px 14px;border-bottom:1px solid {LINE};'
        f'font:{weight} {size}/1.5 {_FONT};color:{INK};vertical-align:top">{v}</td>'
        f'</tr>'
    )


def _note(text: str) -> str:
    return (f'<tr><td colspan="2" style="padding:10px 0;font:400 14px/1.55 {_FONT};color:{MID}">'
            f'{_esc(text)}</td></tr>')


def _bill(title: str, col: Dict[str, Any], *, strong: bool = False) -> str:
    """One column of the bill: its lines, then its total. Printed even when it is only the base fee,
    because «what would they pay today» with nothing else live IS the answer to Peter's question."""
    out = [_head(title)]
    for line in col.get("lines") or []:
        out.append(_row(str(line.get("label") or ""), _esc(pq.eur(int(line.get("cents") or 0)))))
    out.append(_row("Total", f'<b>{_esc(pq.eur(int(col.get("total_cents") or 0)))}</b> al mes, sin IVA',
                    strong=strong))
    return "".join(out)


def _shell(title: str, inner: str) -> str:
    return f"""<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>{_esc(title)}</title></head>
<body style="margin:0;padding:0;background:{PAPER}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
       style="background:{PAPER};padding:28px 14px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
       style="max-width:620px;background:#ffffff;border:1px solid {LINE};border-radius:14px;padding:26px 26px 30px">
<tr><td>
<p style="margin:0 0 4px;font:700 20px/1.3 {_FONT};color:{INK}">{_esc(title)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">{inner}</table>
</td></tr></table>
</td></tr></table>
</body></html>"""


def _stamp() -> str:
    """Madrid time, because that is the clock Peter reads, with UTC behind it so a log line can be
    matched to an email without arithmetic."""
    now = datetime.now(timezone.utc)
    try:
        from zoneinfo import ZoneInfo
        local = now.astimezone(ZoneInfo("Europe/Madrid"))
        return f"{local:%d/%m/%Y %H:%M} (Madrid) · {now:%H:%M} UTC"
    except Exception:  # noqa: BLE001 — a missing tzdata must not cost the alert
        return f"{now:%d/%m/%Y %H:%M} UTC"


def _context_rows(ctx: Dict[str, Any]) -> str:
    """Locale, timestamp, referrer and any UTM parameters — Peter's own list. Where a lead came from
    is the difference between «the pricing page works» and «that LinkedIn post worked»."""
    ctx = ctx or {}
    out = [_head("Contexto"),
           _row("Fecha", _esc(_stamp())),
           _row("Idioma", _esc(ctx.get("lang") or "es"))]
    if ctx.get("page"):
        out.append(_row("Página", _esc(ctx["page"])))
    if ctx.get("referrer"):
        out.append(_row("Viene de", _esc(ctx["referrer"])))
    utm = ctx.get("utm") if isinstance(ctx.get("utm"), dict) else {}
    for k in ("utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "ref"):
        v = utm.get(k) or (ctx.get(k) if k == "ref" else "")
        if v:
            out.append(_row(k, _esc(v)))
    return "".join(out)


def _contact_rows(c: Dict[str, Any]) -> str:
    c = c or {}
    out = [_head("Contacto")]
    for label, key in (("Nombre", "name"), ("Empresa", "company"),
                       ("Correo", "email"), ("Teléfono", "phone")):
        v = str(c.get(key) or "").strip()
        if not v:
            continue
        if key == "email":
            v = f'<a href="mailto:{_esc(v)}" style="color:{RED}">{_esc(v)}</a>'
        elif key == "phone":
            digits = "".join(ch for ch in v if ch.isdigit())
            v = f'<a href="https://wa.me/{digits}" style="color:{RED}">{_esc(v)}</a>' if digits else _esc(v)
        else:
            v = _esc(v)
        out.append(_row(label, v))
    if len(out) == 1:
        out.append(_note("Envío anónimo."))
    return "".join(out)


def _answer_rows(answers: List[Dict[str, str]]) -> str:
    """Every answer, numbered, in the order it was asked. The numbering is what makes a skipped
    conditional question legible — questions 4, 6 and 7 only exist for some visitors."""
    if not answers:
        return ""
    out = [_head("Respuestas")]
    for i, a in enumerate(answers, 1):
        label = a.get("q") or a.get("id") or f"Pregunta {i}"
        out.append(_row(f"{i}. {label}", f'<b>{_esc(a.get("a") or "")}</b>'))
    return "".join(out)


# ─────────────────────────────── templates ───────────────────────────────

def render_pricing_lead(contact: Dict[str, Any], q: Dict[str, Any],
                        ctx: Optional[Dict[str, Any]] = None) -> Dict[str, str]:
    """(subject, html) for a /precios quiz submission.

    THE SUBJECT CARRIES THE USEFUL PART — plan, volume, price — because that is what decides whether
    Peter reads it now or after lunch, and it is all he needs to answer the phone if they ring first.
    """
    ctx = ctx or {}
    bits = [str(q.get("band_name") or "")]
    if q.get("orders"):
        bits.append(f"{pq.num(int(q['orders']))} pedidos")
    bits.append(f"{pq.eur(int(q.get('chosen', {}).get('total_cents') or 0))}/mes")
    subject = "Lead — " + ", ".join(b for b in bits if b)
    if q.get("sales"):
        subject += " · a ventas"

    body = [_contact_rows(contact), _answer_rows(q.get("answers") or [])]

    # WHAT THEY CONFIGURED, separate from what they answered: the two can differ, because the report
    # lets them toggle a module after the quiz has already asked about it.
    cfg = [_head("Lo que ha configurado"),
           _row("Plan", _esc(f"{q.get('band_name')} ({str(q.get('band') or '').upper()})")),
           _row("Personas", _esc(q.get("team_answer") or
                                 ("Sin límite" if q.get("seats") is None else f"hasta {q.get('seats')}"))),
           _row("Pedidos al mes", _esc(pq.num(int(q.get("orders") or 0)))),
           _row("Módulos", _esc(" · ".join(m.capitalize() for m in (q.get("modules") or []))))]
    if "reparto" in (q.get("modules") or []):
        cfg.append(_row("Furgonetas", _esc(pq.num(int(q.get("vans") or 0)))))
    if q.get("erp_answer"):
        cfg.append(_row("Factura con", _esc(q["erp_answer"])))
    b = q.get("bundle")
    if b:
        cfg.append(_row("Bono de pedidos",
                        _esc(f"{pq.num(int(b['qty']))} a {pq.eur(int(b['rate_cents']))} = "
                             f"{pq.eur(int(b['total_cents']))} · {b['saving_pct']} % más barato "
                             f"que su tarifa")))
    body.append("".join(cfg))

    # THREE BILLS, because «what would they pay» has three honest answers and Peter asked for two of
    # them by name. «Hoy» is the invoice that could go out this afternoon; «Con lo que ha elegido» is
    # the same customer once every module they picked is on; «Con todo» is the ceiling.
    #
    # SINCE 2026-08-15 THE FIRST TWO ARE THE SAME BILL and this collapses to one by itself. Every
    # `pricing_quote.LIVE` flag is true — Peter: «we dont do the hasnt shipped thing for radar» — so
    # `today` and `chosen` land on the same total and the `!=` below drops the duplicate. That is the
    # whole reason the comparison is a comparison rather than a flag: nothing had to be edited here.
    body.append(_bill("Hoy", q.get("today") or {}, strong=True))
    if (q.get("chosen") or {}).get("total_cents") != (q.get("today") or {}).get("total_cents"):
        body.append(_bill("Con lo que ha elegido", q.get("chosen") or {}))
    if (q.get("everything") or {}).get("total_cents") != (q.get("chosen") or {}).get("total_cents"):
        body.append(_bill("Con todo", q.get("everything") or {}))

    if q.get("sales"):
        rows = [_head("Va a ventas")]
        for r in q.get("sales_reasons") or []:
            rows.append(_row("Motivo", _esc(r)))
        body.append("".join(rows))

    notes: List[str] = []
    # UNREACHABLE WHILE EVERY LIVE FLAG IS TRUE, which tools/check_pricing_sync.py now asserts. Kept
    # rather than deleted: `pending` is computed from those flags, so if one is ever legitimately
    # turned off again this line is what tells Peter about it in the alert he reads as fact.
    if q.get("pending"):
        notes.append("Ha elegido " + " y ".join(m.capitalize() for m in q["pending"]) +
                     ". Sale pronto, y el primer mes va incluido.")
    if q.get("erp_desktop"):
        notes.append(f"Su programa de facturación está instalado en un ordenador: la integración se "
                     f"hace a medida, {pq.eur(pq.INTEGRACION_DAY_CENTS)} al día. Mientras tanto, "
                     f"exporta el pedido en su formato.")
    if q.get("reparte") and "reparto" not in (q.get("modules") or []):
        notes.append("Reparte con furgonetas propias y de momento lleva las rutas a mano.")
    ct = q.get("client_total_cents")
    if ct is not None and ct != (q.get("chosen") or {}).get("total_cents"):
        # The page said one thing and this box computed another. Printed rather than resolved: the
        # discrepancy IS the finding, and it is usually a rate that moved in pricing.json and not in
        # pricing_quote.py's mirror.
        notes.append(f"La página mostró {pq.eur(int(ct))} y aquí sale "
                     f"{pq.eur(int((q.get('chosen') or {}).get('total_cents') or 0))}. "
                     f"Revisar las tarifas de pricing_quote.py contra pricing.json.")
    if not q.get("ok", True):
        notes.append("Cálculo fallido: la forma del envío ha cambiado. Las respuestas están arriba "
                     "tal cual llegaron.")
    if notes:
        body.append(_head("Notas") + "".join(_note(n) for n in notes))

    body.append(_context_rows(ctx))
    return {"subject": subject, "html": _shell(subject, "".join(body))}


def render_account(contact: Dict[str, Any], account: Dict[str, Any],
                   q: Optional[Dict[str, Any]] = None,
                   ctx: Optional[Dict[str, Any]] = None) -> Dict[str, str]:
    """(subject, html) for a new account, and for the moment its payment lands.

    ONE TEMPLATE, TWO MOMENTS. `account['paid']` is the only thing that differs, and it is the field
    Peter actually asked about — «whether payment completed or they stopped at checkout». A single
    email cannot answer that, because on this product the account is always created BEFORE Checkout
    (`/plan` is behind the sign-in gate), so the alta alert would forever read «pendiente». It fires
    twice instead: once when they walk in, once when the money lands, with a subject that tells the
    two apart at a glance in an inbox.
    """
    ctx = ctx or {}
    company = str(account.get("company") or contact.get("company") or "").strip()
    paid = bool(account.get("paid"))
    subject = (f"Alta pagada — {company}" if paid else f"Alta — {company}") if company \
        else ("Alta pagada" if paid else "Alta")

    body = [_contact_rows({**(contact or {}), "company": company})]

    acc = [_head("Cuenta")]
    if account.get("tenant_slug"):
        acc.append(_row("Espacio", _esc(account["tenant_slug"])))
    if account.get("via"):
        acc.append(_row("Ha entrado por", _esc(account["via"])))
    plan_line = str(account.get("plan_line") or "").strip()
    acc.append(_row("Plan", _esc(plan_line) if plan_line else "Lo elige en /plan"))
    acc.append(_row("Pago", "<b>Completado</b>" if paid else "Pendiente", strong=paid))
    if account.get("amount_line"):
        acc.append(_row("Importe", _esc(account["amount_line"])))
    body.append("".join(acc))

    if q:
        body.append(_note("Viene del cálculo de /precios:"))
        body.append(_answer_rows(q.get("answers") or []))
        body.append(_bill("Lo que calculó", q.get("chosen") or {}))
        if q.get("sales_reasons"):
            body.append(_head("Va a ventas") +
                        "".join(_row("Motivo", _esc(r)) for r in q["sales_reasons"]))
    else:
        body.append(_note("Llega directo a la cuenta."))

    body.append(_context_rows(ctx))
    return {"subject": subject, "html": _shell(subject, "".join(body))}


# ─────────────────────────────── sending ───────────────────────────────

async def _send(msg: Dict[str, str], reply_to: str = "") -> bool:
    """The one outbound call. Fail-soft to the bone: every failure mode below returns False and logs,
    and none of them can reach the caller. `actions.send_email` already honours EGRESS_SANDBOX, so a
    regression run reports a send and mails nobody."""
    try:
        to = to_address()
        if not to:
            log.warning("lead alert not sent: NOTIFY_EMAIL is unset (subject=%r)", msg.get("subject"))
            return False
        import actions
        ok = await actions.send_email(to, msg["subject"], msg["html"],
                                      reply_to=(reply_to or None))
        if not ok:
            log.warning("lead alert send returned false (subject=%r)", msg.get("subject"))
        return bool(ok)
    except Exception:  # noqa: BLE001
        log.exception("lead alert failed (fail-soft)")
        return False


def spawn(coro) -> None:
    """Run an alert without making anybody wait for it.

    A form submission and a sign-in are the two moments where latency is most expensive and an email
    is least urgent, so the send is detached. The task is held in `_INFLIGHT` until it finishes —
    `asyncio.create_task` keeps only a weak reference, and a collected task disappears silently
    rather than raising, which is how a fire-and-forget rail ends up "sometimes not sending".
    """
    try:
        task = asyncio.create_task(coro)
        _INFLIGHT.add(task)
        task.add_done_callback(_INFLIGHT.discard)
    except Exception:  # noqa: BLE001 — no event loop, a shutting-down loop, anything
        log.exception("lead alert could not be scheduled (fail-soft)")


async def notify_pricing_lead(contact: Dict[str, Any], q: Dict[str, Any],
                              ctx: Optional[Dict[str, Any]] = None) -> bool:
    """Somebody finished the calculator on /precios."""
    try:
        return await _send(render_pricing_lead(contact, q, ctx),
                           reply_to=str((contact or {}).get("email") or ""))
    except Exception:  # noqa: BLE001
        log.exception("pricing lead alert failed (fail-soft)")
        return False


async def notify_account(contact: Dict[str, Any], account: Dict[str, Any],
                         q: Optional[Dict[str, Any]] = None,
                         ctx: Optional[Dict[str, Any]] = None) -> bool:
    """Somebody opened an account, or the payment for one just landed."""
    try:
        return await _send(render_account(contact, account, q, ctx),
                           reply_to=str((contact or {}).get("email") or ""))
    except Exception:  # noqa: BLE001
        log.exception("account alert failed (fail-soft)")
        return False


# ─────────────────────────── the two call sites, one line each ───────────────────────────
# Both of these do their own reading. The alternative — the caller gathering a name, a phone and ten
# quiz answers before it can send an alert — would put four fail-soft DB reads inside `sign_in` and
# inside the Stripe webhook, which are the two places least able to afford them. Everything below is
# wrapped: these functions return False, they never raise, and neither caller checks.

async def alert_account(email: str, *, company: str = "", tenant_slug: str = "", via: str = "",
                        paid: bool = False, plan_line: str = "", amount_line: str = "",
                        lang: str = "es") -> bool:
    """A new account (or its payment). Fills in the name, the phone and the quiz from the lead row.

    THE LEAD LOOKUP IS WHAT ANSWERS «did they come through the quiz». `/precios` writes the answers
    onto the lead keyed by the address they typed; if that is the same address they then sign in
    with, this joins the two halves and Peter reads one email instead of correlating two.
    """
    try:
        e = (email or "").strip()
        contact: Dict[str, Any] = {"email": e, "company": company}
        quiz = None
        try:
            from brain import onboarding as _ob
            lead = await _ob.lead_by_email(e)
            if lead:
                contact["name"] = lead.get("name") or ""
                contact["phone"] = lead.get("phone") or ""
                contact["company"] = company or lead.get("business") or ""
                quiz = lead.get("pricing_quiz") or None
        except Exception:  # noqa: BLE001 — the alert is worth sending without the join
            log.exception("account alert: lead lookup failed (fail-soft)")
        account = {"company": contact.get("company") or company, "tenant_slug": tenant_slug,
                   "via": via, "paid": paid, "plan_line": plan_line, "amount_line": amount_line}
        # A quiz they never took leaves the plan line empty, so fall back to the plan they configured
        # — «Mediano, 7.200 pedidos» is a better answer than a dash while they are still on /plan.
        if not plan_line and quiz:
            account["plan_line"] = (f"Del cálculo: {quiz.get('band_name')}"
                                    + (f", {pq.num(int(quiz.get('orders') or 0))} pedidos"
                                       if quiz.get("orders") else ""))
        return await notify_account(contact, account, quiz, {"lang": lang})
    except Exception:  # noqa: BLE001
        log.exception("account alert failed (fail-soft)")
        return False


async def alert_paid(tenant_slug: str, band: str = "") -> bool:
    """A Pedidos Checkout completed. Reads who and what off `pedidos_subscription`, which the money
    path has already written by the time this runs — so the alert reports the row, not the webhook."""
    try:
        import db
        from brain.pedidos_billing import BANDS
        email = name = ""
        cadence = ""
        async with db.get_pool().acquire() as con:
            row = await con.fetchrow(
                "select operator_email, band, cadence from pedidos_subscription where tenant_id = $1",
                tenant_slug)
            name = await con.fetchval("select name from tenants where slug = $1", tenant_slug) or ""
        if row:
            email = row["operator_email"] or ""
            band = row["band"] or band
            cadence = row["cadence"] or ""
        b = BANDS.get(band) or {}
        plan_line = " · ".join(x for x in [f"Pedidos {b.get('name') or band.upper()}", cadence] if x)
        # BOTH FIGURES, because they are different numbers and Peter meets both: the quote the page
        # printed, and the money Stripe actually moved. `pedidos_welcome_email` says the same thing
        # to the customer for the same reason.
        if cadence == "anual":
            charge = int(b.get("anual_charge_cents") or 0)
            amount_line = f"{pq.eur(charge)} + IVA una vez al año"
        else:
            charge = int(b.get("mensual_charge_cents") or 0)
            amount_line = (f"{pq.eur(int(b.get('mensual_cents') or 0))} al mes · "
                           f"{pq.eur(charge)} + IVA por adelantado")
        return await alert_account(email, company=name, tenant_slug=tenant_slug, via="checkout",
                                   paid=True, plan_line=plan_line, amount_line=amount_line)
    except Exception:  # noqa: BLE001
        log.exception("paid alert failed (fail-soft) for %s", tenant_slug)
        return False
