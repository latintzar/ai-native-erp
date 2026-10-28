"""order_receipt.py — THE CONFIRMATION THE CUSTOMER ACTUALLY GETS.

Peter, after Raquel and Carlos tested it (2026-08-19): *«no enviaron la confirmación. La misma
experiencia que personas tienen en WhatsApp, con botones en mensajes para responder a cosas y con
imágenes con confirmaciones de orden. Eso no estaba sucediendo.»*

Every piece already existed and none of it arrived together. `brain/order_card.render_order_card`
has drawn the card since 2026-07-27; `whatsapp_cloud.send_interactive_buttons` has offered taps
since 2026-07-26; `brain/pipeline.ask_order_confirm` sends the two of them — as TWO messages, the
picture first, and it RETURNS EARLY on `image_send_failed`, so a picture that does not go takes the
acknowledgement and the buttons down with it. A customer who ordered then heard nothing at all.

WHAT THIS MODULE IS. One place that turns a filed order into the message a person recognises: the
card, the sentence, the taps — composed once, sent as ONE WhatsApp message
(`whatsapp_cloud.send_image_with_buttons`), and DEGRADING to the sentence and the taps alone when
the picture fails. The acknowledgement is never hostage to a PNG.

THE LAW IT OBEYS (Raquel, twice, and it is a gate elsewhere too — `market_voice.py`):

    «Mientras no se vincule con mi ERP: "ok, recibido" — no "confirmado", RECIBIDO.»

So this message ACKNOWLEDGES WHAT WAS WRITTEN DOWN. It never says the goods are had, held or on
their way. Every composed sentence leaves through `market_voice.apply_for`, which is the authority
on that rule — this module does not re-implement it, it submits to it. That is also why the
question is «¿está bien así?» and not «¿lo confirmas?»: the customer is checking OUR TRANSCRIPTION,
which is a thing they can actually see and answer, not the state of a market stall at 04:00.

THE DELIVERY DAY IS ON THE FACE OF IT, and that is Raquel's «mañana» bug turned into a safety net:
a customer writing at 00:30 means the day she is about to work, the calendar means the next one, and
the mis-read only ever surfaced when the sheet printed without their order on it. Naming the
resolved day in the acknowledgement puts the mistake in front of the one person who can correct it
in one tap, hours before the van.

THE TAP IDS ARE `brain/pipeline`'s, DELIBERATELY. `pipeline.resolve_order_confirm_tap` already knows
how to settle this question — it keys on the option id ('yes' / 'no') and on an
`order_confirm.asked` event carrying the wamid we asked with. `send()` writes exactly that event
with exactly those ids, so a tap on a receipt sent from here resolves through the resolver that is
already live and already tested. The button TITLES are ours and are new, which is safe because the
resolver reads the ID first and only falls back to matching a title when no id arrived — and Meta's
webhook always carries one (`app.py` reads it straight off `interactive.button_reply.id`).
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional

import config
import market_voice

log = logging.getLogger("rocoto.order_receipt")

# ── the taps ────────────────────────────────────────────────────────────────────────────────────
# `brain/pipeline.ORDER_CONFIRM_YES_ID` / `_NO_ID` — THE SAME TWO STRINGS, on purpose. Literals
# rather than an import because `brain.pipeline` pulls in half the backend and a composer a webhook
# path may call must not drag that in. If those ever move, this pair moves with them: they are the
# only reason a tap on a receipt sent from here reaches `resolve_order_confirm_tap` at all.
CONFIRM_YES_ID = "yes"
CONFIRM_CHANGE_ID = "no"
CONFIRM_ASKED_EVENT = "order_confirm.asked"

# ONE OF THESE IS A NEGATIVE AND IT IS NOT SHIPPING. pipeline's pair reads «Sí, es correcto» / «No
# es correcto» — and a button that says NO spends the customer's attention on the failure case.
# «Quiero cambiar algo» is the same tap and says what they will actually DO with it, which is also
# what the comercial needs to read on the review sheet.
BTN_YES_ES = "Sí, está bien"
BTN_CHANGE_ES = "Quiero cambiar algo"
BTN_YES_EN = "Yes, that's right"
BTN_CHANGE_EN = "I want to change it"

ASK_ES = "¿Está bien así?"
ASK_EN = "Is that right?"

_DIAS_ES = ("lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo")
_MESES_ES = ("enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
             "septiembre", "octubre", "noviembre", "diciembre")


def _es(lang: str) -> bool:
    return (lang or "es").lower().startswith("es")


def _parse_iso(value: Any) -> Optional[datetime]:
    """A delivery date in any of the shapes the order rows carry → a datetime, or None.

    Never raises and never guesses: an unparseable date produces NO day line at all, because a
    receipt that names the wrong day is worse than one that names none — the customer reads the
    wrong day as confirmed and stops looking."""
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, datetime):
        return value
    if hasattr(value, "year") and hasattr(value, "month") and hasattr(value, "day"):
        return datetime(value.year, value.month, value.day)
    try:
        return datetime.strptime(str(value).strip()[:10], "%Y-%m-%d")
    except (TypeError, ValueError):
        return None


def delivery_phrase(value: Any, *, lang: str = "es") -> str:
    """«el jueves 21» — the day named the way somebody says it on the phone. '' when unknown.

    Weekday AND day number, because either alone is ambiguous exactly where this matters: «el
    jueves» is two different days if the order was written after midnight (Raquel's bug), and «el
    21» makes nobody picture their week."""
    dt = _parse_iso(value)
    if dt is None:
        return ""
    if _es(lang):
        return f"el {_DIAS_ES[dt.weekday()]} {dt.day}"
    return dt.strftime("%A %-d")


def card_date_label(value: Any, *, lang: str = "es") -> str:
    """«Entrega: jueves 21 de agosto» — the card's own top-right line. '' when unknown.

    LABELLED, not a bare date. `brain/order_card` draws whatever string it is given next to «TU
    PEDIDO», and a naked «21 de agosto» there reads as the day the order was TAKEN — which is the
    one reading that makes the mis-filed-day bug invisible again."""
    dt = _parse_iso(value)
    if dt is None:
        return ""
    if _es(lang):
        return f"Entrega: {_DIAS_ES[dt.weekday()]} {dt.day} de {_MESES_ES[dt.month - 1]}"
    return f"Delivery: {dt.strftime('%A %-d %B')}"


def _ack_parts(lang: str) -> tuple[str, str]:
    """(«Recibido.», the coletilla) — SPLIT OUT OF `market_voice.ACK_ES` rather than retyped here.

    That sentence is Raquel's own words («si hubiera alguna incidencia o alguna falta te avisaremos
    lo antes posible… como muchísimo esa coletilla») and `market_voice` is where they live. A second
    copy in this file is the copy that goes stale the day hers is tuned, and then the product says
    two different things to the same customer on the same rail."""
    base = market_voice.ACK_ES if _es(lang) else market_voice.ACK_EN
    head, sep, tail = base.partition(". ")
    return ((head + "."), tail) if sep else (base, "")


def acknowledgement(*, delivery_date: Any = None, lang: str = "es", ask: bool = True) -> str:
    """The sentence under the card. RECIBIDO — never confirmado, never disponible, never a promise
    that the goods exist. The delivery day rides the first clause when we resolved one."""
    head, tail = _ack_parts(lang)
    dia = delivery_phrase(delivery_date, lang=lang)
    if dia:
        # «Recibido.» → «Recibido para el jueves 21.» — the verb is still the authorised one, the
        # day is spliced into its clause. The preposition is per-language: built from the Spanish
        # one alone it produced «Got it para Friday 21» the first time it was run.
        head = f"{head.rstrip('.')} {'para' if _es(lang) else 'for'} {dia}."
    parts = [head]
    if ask:
        parts.append(ASK_ES if _es(lang) else ASK_EN)
    if tail:
        parts.append(tail)
    return " ".join(p for p in parts if p)


def confirm_buttons(*, lang: str = "es") -> list[dict]:
    """The two taps. Two and not three: a third option is a third thing to read, and the customer
    who wants something else will type it anyway."""
    if _es(lang):
        return [{"id": CONFIRM_YES_ID, "title": BTN_YES_ES},
                {"id": CONFIRM_CHANGE_ID, "title": BTN_CHANGE_ES}]
    return [{"id": CONFIRM_YES_ID, "title": BTN_YES_EN},
            {"id": CONFIRM_CHANGE_ID, "title": BTN_CHANGE_EN}]


# ── the card ────────────────────────────────────────────────────────────────────────────────────
def card_lines(raw: Any) -> list[dict[str, Any]]:
    """The customer-facing shape of the order lines — `portal._lines_out`, not a second copy.

    One source of truth for what «the order» means: the confirmation page, the card in this message
    and the /demo preview all render the same list, so a customer can never be shown two different
    descriptions of the thing they just ordered. It already tolerates both line shapes in the tree
    (the order-brain's `name`/`qty` rows and `orders_tool.draft_order`'s), which is why this reaches
    for it instead of normalising here."""
    try:
        import portal
    except Exception:
        log.exception("order_receipt: portal unimportable — cannot shape the lines")
        return []
    try:
        return portal._lines_out(raw)
    except Exception:
        log.exception("order_receipt: line shaping failed")
        return []


def strip_prices(lines: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """The same lines with every figure removed — what a supplier on `prices: hide` sends.

    A price on the card is a QUOTE, exactly as it is in a sentence (`market_voice.apply_for` refuses
    one in text for the same reason), and in this trade a quote is a commitment. The money gate
    reads sentences, not pixels — nothing downstream can catch a number that is drawn — so the
    decision has to be made HERE, before the render. `brain/order_card` collapses to a clean
    product/quantity list when no line carries a figure, which is the layout Peter asked for anyway:
    «if no prices, should be making it just with quantities»."""
    out = []
    for ln in lines:
        row = dict(ln)
        row["precio"] = None
        row["importe"] = None
        out.append(row)
    return out


def order_total(lines: list[dict[str, Any]]) -> Optional[float]:
    """`portal._order_total` — a total only when every line carries one. None otherwise, and the
    card then draws no total row at all rather than «a confirmar», which is a promise of a number
    nobody has."""
    try:
        import portal
        return portal._order_total(lines)
    except Exception:
        log.exception("order_receipt: total failed (no total drawn)")
        return None


def render_card(*, business_name: str, customer_name: str, lines: list[dict[str, Any]],
                total: Optional[float], date_label: str = "") -> Optional[bytes]:
    """The order card as PNG bytes — `brain/order_card.render_order_card`, never a second drawing.

    Returns None on any failure, and None is a survivable outcome: `send()` then delivers the
    sentence and the taps on their own. The picture is the nicety; the acknowledgement is the
    product."""
    try:
        from brain import order_card
        return order_card.render_order_card(
            business_name=business_name or "", customer_name=customer_name or "",
            lines=lines, total=total, fecha=date_label)
    except Exception:
        log.exception("order_receipt: card render failed (the message goes without it)")
        return None


# ── the composed receipt ────────────────────────────────────────────────────────────────────────
@dataclass(frozen=True)
class Receipt:
    """Everything the message is, before anything is sent. Pure data — build it in a test, assert
    on the words, and never touch a network to do it."""
    body: str
    buttons: list[dict] = field(default_factory=list)
    card: Optional[bytes] = None
    lines: list[dict] = field(default_factory=list)
    total: Optional[float] = None
    order_id: str = ""
    delivery: str = ""

    @property
    def option_titles(self) -> list[str]:
        return [str(b.get("title") or "") for b in self.buttons]

    def as_text(self) -> str:
        """The plain-text mirror of the COMPOSED receipt — for logs, tests and previews."""
        return sent_text(self.body, self.option_titles)


def sent_text(body: str, titles: list[str]) -> str:
    """The plain-text mirror of what the customer sees — the shape `actions` already projects
    interactive sends with ('▸' per option), so the app thread and the Control Room render a
    receipt the same way they render every other one-tap question. Takes the body as an ARGUMENT
    rather than reading it off the Receipt, because the body that goes on the wire is the one
    `market_voice` returned, which is not always the one that was composed."""
    return "\n".join([body] + [f"▸ {t}" for t in titles])


def compose(*, business_name: str, lines: Any, customer_name: str = "",
            delivery_date: Any = None, order_id: str = "", show_prices: bool = True,
            lang: str = "es", with_card: bool = True) -> Optional[Receipt]:
    """Build the receipt. Returns None when there is nothing to acknowledge.

    NOTHING HERE INVENTS A FACT: the lines are the filed lines, the total is `portal._order_total`
    (None unless every line carries a figure), and the day is the day that was resolved onto the
    order. An order with no grounded lines produces NO receipt at all rather than an empty card —
    a customer shown a blank order believes we have nothing of theirs."""
    shaped = card_lines(lines)
    if not shaped:
        return None
    if not show_prices:
        shaped = strip_prices(shaped)
    total = order_total(shaped) if show_prices else None
    card = render_card(business_name=business_name, customer_name=customer_name, lines=shaped,
                       total=total, date_label=card_date_label(delivery_date, lang=lang)) \
        if with_card else None
    return Receipt(
        body=acknowledgement(delivery_date=delivery_date, lang=lang),
        buttons=confirm_buttons(lang=lang), card=card, lines=shaped, total=total,
        order_id=str(order_id or ""), delivery=delivery_phrase(delivery_date, lang=lang))


async def prices_visible(scope: str) -> bool:
    """Does this supplier let a number leave Rocoto's mouth? (`behaviour.prices`.)

    Fail-soft to True, matching `market_voice.apply_for` exactly: `quote` is the default in
    `behaviour._SPEC` because it is the pre-existing behaviour, and a settings hiccup must not
    quietly change what every tenant's card looks like."""
    try:
        import behaviour
        import tenancy
        return (await behaviour.get(tenancy.tenant_of(scope))).get("prices") != "hide"
    except Exception:
        log.debug("order_receipt: prices setting unavailable for %s (showing)", scope, exc_info=True)
        return True


async def compose_for(scope: str, *, business_name: str, lines: Any, customer_name: str = "",
                      delivery_date: Any = None, order_id: str = "", lang: str = "es",
                      with_card: bool = True) -> Optional[Receipt]:
    """`compose` with this supplier's own answer to «¿decimos precios?» already applied."""
    return compose(business_name=business_name, lines=lines, customer_name=customer_name,
                   delivery_date=delivery_date, order_id=order_id, lang=lang,
                   with_card=with_card, show_prices=await prices_visible(scope))


# ── sending it ──────────────────────────────────────────────────────────────────────────────────
async def _endpoint(con, scope: str) -> str:
    """The customer's WhatsApp number for this scope — the endpoint row, else the number the scope
    itself encodes (both scope shapes, WP-A1). Same two steps every mouth in `actions.py` takes."""
    try:
        addr = await con.fetchval(
            "select e.addr from endpoint e join contact c on c.id=e.contact_id "
            "where c.scope=$1::ltree and e.kind='wa' order by e.id desc limit 1", scope)
    except Exception:
        log.debug("order_receipt: endpoint read failed for %s", scope, exc_info=True)
        addr = None
    if addr:
        return str(addr)
    import tenancy
    return tenancy.phone_of_scope(scope) or ""


async def already_asked(con, scope: str, order_id: str) -> bool:
    """Has this order already been put to this customer? ONE QUESTION PER ORDER.

    The same read `pipeline.ask_order_confirm` does, on the same event, so the two senders cannot
    both ask about one order — whichever runs second sees the first one's row and stands down."""
    if not order_id:
        return False
    try:
        return bool(await con.fetchval(
            "select 1 from event where scope=$1::ltree and type=$2 "
            "and payload->>'order_id' = $3 limit 1", scope, CONFIRM_ASKED_EVENT, order_id))
    except Exception:
        log.debug("order_receipt: asked-already read failed for %s", order_id, exc_info=True)
        return False


async def send(scope: str, receipt: Receipt, *, con=None, lang: str = "es",
               tenant: str = "") -> dict:
    """Send the receipt. Fail-soft: returns {ok, sid, card, reason, parked} and never raises.

    THE GATES RUN HERE, ONCE, AND THEY ARE `gate.py`'s OWN:
      · MODO SOMBRA (§5.5) — a picture with taps is speech; held, drafted on the review sheet, and
        nothing reaches Meta.
      · the money gate — the body and every button title are checked against the scope's standing
        prices, and a concession PARKS (action row, needs_human, money) with nothing sent.
      · `market_voice.apply_for` — the supplier's own answers about stock and prices, applied to the
        sentence by the module that owns that rule.
    Only once all three have passed does anything choose a WIRE FORMAT, and the format is allowed to
    degrade: the picture rides the same message as the taps when it can
    (`whatsapp_cloud.send_image_with_buttons`), and when that fails the sentence and the taps go on
    their own. That order is the whole point of this function — `pipeline.ask_order_confirm` sent
    the picture FIRST and returned early when it failed, so a picture that did not go silenced the
    acknowledgement too, and the customer heard nothing at all about the order they had just placed.

    THE TAP IS WIRED: an `order_confirm.asked` event carrying the wamid we asked with lets
    `pipeline.resolve_order_confirm_tap` settle the answer with no re-inference — the resolver that
    is already live, already tested, and already knows what «Sí» is worth."""
    import db
    import gate
    import spine
    import whatsapp_cloud as wc

    def _fail(reason: str, **kw) -> dict:
        return {"ok": False, "sid": None, "card": False, "parked": False, "reason": reason, **kw}

    if receipt is None or not (receipt.body or "").strip() or len(receipt.buttons) < 1:
        return _fail("empty_receipt")

    own_con = con is None
    cm = None
    try:
        if own_con:
            cm = db.scoped_tx(scope)
            con = await cm.__aenter__()

        if await already_asked(con, scope, receipt.order_id):
            return {"ok": True, "sid": None, "card": False, "parked": False, "noop": True,
                    "reason": "already_asked"}

        addr = await _endpoint(con, scope)
        if not addr:
            return _fail("no_endpoint")

        # THE SENTENCE GOES THROUGH THE VOICE GATE, NOT AROUND IT. `compose` writes «recibido» on
        # purpose, and this is the check that the purpose held — if anything ever composes a stock
        # promise here, market_voice replaces the whole sentence with the one Raquel authorised
        # rather than leaving it half-edited and still promising.
        body = await market_voice.apply_for(scope, receipt.body, lang=lang)
        titles = receipt.option_titles

        if (h := await gate.hold_if_sombra(scope, "interactive", body, con=con,
                                           detail={"options": titles, "kind": "order_receipt",
                                                   "order_id": receipt.order_id})):
            return {"ok": False, "sid": None, "card": False, "parked": False,
                    "reason": h.get("reason", "sombra")}

        try:
            standing = await gate.standing_prices(con, scope)
        except Exception:
            standing = []
        verdict = gate.check_outbound("\n".join([body] + titles), standing)
        if verdict.get("needs_approval"):
            try:
                await con.execute(
                    "insert into action(scope,kind,payload,state,reason,needs_human,money) "
                    "values($1::ltree,'concession',$2,'pending','money_concession',true,true)",
                    scope, {"draft": body[:600], "surface": "order_receipt", "options": titles,
                            "order_id": receipt.order_id, "gate": verdict.get("reason", "")})
            except Exception:
                log.debug("order_receipt: gate park fail-soft", exc_info=True)
            return {"ok": False, "sid": None, "card": False, "parked": True,
                    "reason": f"gate:{verdict.get('reason', 'money')}"}

        card_sent = bool(receipt.card)
        if config.EGRESS_SANDBOX:
            log.info("[EGRESS_SANDBOX] suppressed order receipt (%d options, card=%s) to %s",
                     len(receipt.buttons), card_sent, addr)
            sid = "SANDBOX-order-receipt"
        elif receipt.card:
            try:
                sid = await wc.send_image_with_buttons(
                    addr, receipt.card, body, receipt.buttons,
                    filename=f"pedido-{receipt.order_id or 'rocoto'}.png")
            except Exception:
                # THE ACKNOWLEDGEMENT IS NOT HOSTAGE TO A PNG. An upload that 4xx'd, a Graph hiccup,
                # a card too big — none of that is a reason for a customer who just ordered to hear
                # nothing. The words and the taps go anyway, and the log says the picture was lost.
                log.warning("order_receipt: image+buttons failed for %s — sending the words and the "
                            "taps without the card", scope, exc_info=True)
                card_sent = False
                sid = await wc.send_interactive_buttons(addr, body, receipt.buttons)
        else:
            sid = await wc.send_interactive_buttons(addr, body, receipt.buttons)

        eid, _ = await spine.append_event(
            con, scope, "msg.sent", "runtime",
            {"text": body, "kind": "interactive", "interactive": "button",
             "surface": "order_receipt", "options": receipt.buttons, "card": card_sent,
             "order_id": receipt.order_id, "sid": sid})
        if receipt.order_id:
            # THE TAP'S OTHER HALF. Without this row the buttons come back to a resolver that finds
            # no open question and treats the answer as a no-op — the customer taps «Sí, está bien»
            # and nothing whatsoever happens. `ask_key` is the wamid we asked with, exactly as the
            # doubt loop does it; the dedupe key makes a retry idempotent.
            try:
                await spine.append_event(
                    con, scope, CONFIRM_ASKED_EVENT, "portal",
                    {"order_id": receipt.order_id, "ask_key": str(sid or ""),
                     "tenant": tenant or ""},
                    lane="world", dedupe_key=f"orderconfirm:{receipt.order_id}")
            except Exception:
                log.exception("order_receipt: could not record the open question for %s "
                              "(the tap will not resolve)", receipt.order_id)
        try:
            import projector
            # THE THREAD SHOWS WHAT WENT OUT, not what was composed. `market_voice.apply_for` may
            # have replaced the sentence above; projecting `receipt.body` would put a message in
            # the app and the Control Room that the customer never received, and «what did we
            # actually say to them» is the one question those surfaces exist to answer.
            await projector.project_msg_sent(scope, sent_text(body, titles), sid, eid,
                                             kind="interactive")
        except Exception:
            log.debug("order_receipt: projection fail-soft", exc_info=True)
        return {"ok": True, "sid": sid, "card": card_sent, "parked": False, "reason": "sent"}
    except wc.InteractiveLimitError as e:
        # A button title that outgrew Meta's 20 chars is a COMPOSITION bug in this file, not a
        # runtime condition — surfaced as its own reason so it reads as one in the log.
        log.warning("order_receipt refused by the interactive limit guard: %s", e)
        return _fail(f"limit:{e}")
    except Exception:
        log.exception("order_receipt: send failed (fail-soft)")
        return _fail("send_failed")
    finally:
        if own_con and cm is not None:
            try:
                await cm.__aexit__(None, None, None)
            except Exception:
                pass


async def send_for_order(scope: str, *, business_name: str, lines: Any, customer_name: str = "",
                         delivery_date: Any = None, order_id: str = "", lang: str = "es",
                         tenant: str = "", con=None) -> dict:
    """Compose and send in one call — the door a caller with a freshly filed order wants.

    Returns `send`'s dict, or {ok: False, reason: 'nothing_to_acknowledge'} when the order grounded
    no lines. Fail-soft throughout: a receipt that cannot go leaves the order exactly where it was
    and the comercial still has it in «lo que te toca»."""
    receipt = await compose_for(scope, business_name=business_name, lines=lines,
                                customer_name=customer_name, delivery_date=delivery_date,
                                order_id=order_id, lang=lang)
    if receipt is None:
        return {"ok": False, "sid": None, "card": False, "parked": False,
                "reason": "nothing_to_acknowledge"}
    return await send(scope, receipt, con=con, lang=lang, tenant=tenant)
