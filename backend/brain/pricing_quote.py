"""What a /precios quiz submission is actually worth — recomputed here, never read off the wire.

WHY THE BROWSER'S NUMBER IS NOT USED. The report on /precios does its arithmetic in JavaScript, so
every figure in that POST body is a figure the visitor could have edited before it left. Peter reads
the alert email as fact — it is the number he quotes back on the phone — so the alert prints a price
THIS box computed from `pedidos_billing.BANDS`, and the visitor's own claim rides along only as a
claim, next to ours, so a disagreement is visible instead of silent.

WHY IT IS ITS OWN MODULE. `app.py` holds the request path and `lead_notify.py` holds the templates;
neither should own money. Everything here is pure — no I/O, no DB, no Stripe — so it can be reasoned
about and called from anywhere, and `build()` is written so it cannot raise into a form submission.

TOLERANT ON PURPOSE. The page that posts here is built by a different pair of hands than this file,
and a quiz is a shape that moves: a question gets renamed, an option gains a sublabel, a control
starts sending its value instead of its label. So `build()` reads a `selection` block when one
arrives, DERIVES the same facts from the answers when it does not, and falls back to the smallest
band rather than refusing. A lead is worth more than a schema.
"""
from __future__ import annotations

import logging
import unicodedata
from typing import Any, Dict, List, Optional, Sequence

from brain.pedidos_billing import BANDS

log = logging.getLogger("rocoto.pricing_quote")

# Existing quote inputs outside BANDS. tests/vital_term_split.py checks these constants against
# the preserved backend/pricing.json input. Runtime calculations continue to use these literals.
# Current intended commercial terms live in Rocoto-Labs/company; the historical model described
# below records this implementation rather than a current public offer.
REPARTO_VAN_CENTS = 3900        # 39 € por furgoneta al mes
RADAR_PCT = 15                  # +15 % sobre el resto de la factura
INTEGRACION_DAY_CENTS = 70000   # 700 € al día, sólo cuando el ERP está instalado en un ordenador

# Historical calculation flags, all true since 2026-08-15; mirrored in backend/pricing.json.
# These affect quote arithmetic. Product readiness is recorded separately in the product map.
#
# Peter: «we dont do the hasnt shipped thing for radar. if people pay i scramble to make it. but the
# customers will be chaperoned by me for now and I'll give them a code to get radar, compras and
# reparto for free while theyre in BETA.» /precios and /plan stopped splitting their bill into
# «Empiezas pagando» / «Cuando estén listos» that day, and the free quarter became a Stripe promotion
# code rather than a caveat on the page.
#
# IT STILL DOES REAL WORK HERE, which is why it survived: `build()` computes a `today` column with
# these flags applied and a `chosen` column without them, and brain/lead_notify.py prints the second
# ONLY when the two differ. All-true makes them identical, so Peter's alert collapses to one bill by
# itself — and the day something genuinely regresses, this is the one line that says so.
#
# tests/vital_term_split.py checks this dict against backend/pricing.json so the preserved
# calculation flags agree wherever this implementation computes the quote.
LIVE: Dict[str, bool] = {"ventas": True, "compras": True, "reparto": True, "radar": True}

MODULE_IDS = ("ventas", "compras", "reparto", "radar")

# Prepaid order bolsas. Mirrors pricing.json → `bundles`: the SIZES that are on offer, and the one
# percentage every one of them comes off at. A bolsa is a purchase, never a rate the customer's plan
# moves to, so it is reported on its own line and never folded into the monthly total.
#
# ─── A PERCENTAGE OFF THE BAND'S OWN RATE, NOT A RATE OF ITS OWN — 2026-08-15 ───
# Peter: «we can give a promotional thing in the checkout or in the configurator that says, Pre-pay a
# certain number of orders at a 10% discount».
#
# THIS TABLE USED TO CARRY THREE FIXED RATES — 0,45 / 0,42 / 0,40 €, at 2.250 / 4.200 / 10.000 € —
# and that broke two things at once.
#   (a) A Grande customer already buys pedidos at 0,40 €, so the 5.000 bolsa charged them 12 % MORE
#       than being metered while /precios printed «−12 % más barato que tu tarifa» over the same
#       button. The biggest customers were sold the worst deal and told the opposite of the truth,
#       and this module quietly agreed: `_bundle` dropped the row instead of naming the problem.
#   (b) It flattened the ladder. Peter, same day: «a bigger company pays less per order because we
#       know that they have more orders […] they can then get a bigger plan, but then their base
#       would be bigger, so it's just those tradeoffs». A fixed 0,45 € bolsa handed a Pequeño
#       customer a near-Grande rate without moving band — the one thing the ladder exists to sell.
#
# So the size is published and the price is derived, per band, by `bundle_total_cents` below:
# 5.000 pedidos is 2.700 € on Pequeño, 2.250 € on Mediano, 1.800 € on Grande. The old fixed 2.250 €
# was Mediano's own 10 % figure all along, which is where it came from.
BUNDLES = (1000, 3000, 5000, 10000)
BUNDLE_DISCOUNT_PCT = 10

# Guard rails on anything numeric that arrives from a browser. They are not business rules — they are
# what stops a pasted `1e9` from rendering a subject line the length of a paragraph.
MAX_ORDERS = 5_000_000
MAX_VANS = 500
MAX_ANSWERS = 40
MAX_FIELD = 400

# Above this the volume itself is the conversation, and /precios stops quoting: it drops the
# Checkout button for «Tu caso lo vemos contigo — esto es el punto de partida». Same shape as the
# report's «Por tamaño, volumen o número de sedes, el precio final lo ajustamos contigo.»
#
# IT IS THE PUBLISHED RULE, 8.000, MIRRORED FROM pricing.json → `routing.sales_orders_over`
# (2026-08-15). It used to be the largest prepaid bundle, 25.000, which read plausibly and was a
# different rule from the one the page ran: a visitor at 12.000 pedidos saw the page route them to
# sales while the alert about that same visitor printed no routing reason at all. One lead cannot
# have two verdicts; tests/vital_term_split.py checks the preserved threshold against pricing.json.
SALES_ORDERS_OVER = 8000


# ─────────────────────────────── small readers ───────────────────────────────

def _norm(s: Any) -> str:
    """Lowercase, unaccented, underscore-joined — so `Límite`, `limite` and `LIMITE` are one key."""
    t = unicodedata.normalize("NFKD", str(s or ""))
    t = "".join(c for c in t if not unicodedata.combining(c)).lower().strip()
    return "".join(c if c.isalnum() else "_" for c in t).strip("_")


def _text(v: Any) -> str:
    """One line of visitor text, capped. Everything that reaches a template goes through here."""
    s = " ".join(str(v if v is not None else "").split())
    return s[:MAX_FIELD]


def _scalar(v: Any) -> str:
    """A single answer as the visitor would read it. A raw boolean from a toggle becomes «Sí»/«No»
    BEFORE anything else touches it, so the printed answer and the parsed one cannot disagree."""
    if isinstance(v, bool):
        return "Sí" if v else "No"
    if isinstance(v, (list, tuple)):
        return ", ".join(_scalar(x) for x in list(v)[:12])
    return _text(v)


def _ints(s: str) -> List[int]:
    """Every integer in a string, thousands separators folded away: '7.200' → [7200], '4 a 10' → [4, 10]."""
    out, cur = [], ""
    for ch in str(s or "") + " ":
        if ch.isdigit():
            cur += ch
        elif ch in ".," and cur:
            continue  # a separator INSIDE a number — '1.500' is one number, not two
        else:
            if cur:
                out.append(int(cur))
            cur = ""
    return out


def _int_of(v: Any, default: int = 0) -> int:
    if isinstance(v, bool):
        return default
    if isinstance(v, (int, float)):
        return int(v)
    got = _ints(str(v or ""))
    return got[0] if got else default


def _clamp(v: Any, lo: int, hi: int, default: int = 0) -> int:
    try:
        n = _int_of(v, default)
    except Exception:  # noqa: BLE001 — a browser can send anything
        n = default
    return max(lo, min(hi, n))


_YES = ("si", "s", "yes", "y", "true", "1", "quiero", "incluidlo", "anadidlo", "claro", "vale")
_NO = ("no", "false", "0", "de_momento_no", "todavia_no", "mas_adelante")


def _is_yes(v: Any) -> Optional[bool]:
    """True / False / None (nothing was said).

    THE FIRST WORD DECIDES, and only the first word: the rest of an option label is sales copy that
    must not get a vote — «No, lo lleva un tercero» is a refusal that contains «lleva». The one
    exception is the trailing negation Spanish actually uses, and which the copy deck uses four
    times: «De momento no» says no with its LAST word.
    """
    if isinstance(v, bool):
        return v
    t = _norm(v)
    if not t:
        return None
    if t in _YES:
        return True
    if t in _NO:
        return False
    head = t.split("_")[0]
    if head in _NO:
        return False
    if head in _YES:
        return True
    if t.endswith("_no"):
        return False
    return None


def eur(cents: int, lang: str = "es") -> str:
    """«4.099 €» / «€4,099». Whole euros lose the decimals; a sub-euro rate keeps both digits."""
    v = (cents or 0) / 100
    s = f"{v:,.0f}" if (cents or 0) % 100 == 0 else f"{v:,.2f}"
    if (lang or "es").startswith("es"):
        return s.replace(",", "\x00").replace(".", ",").replace("\x00", ".") + " €"
    return "€" + s


def num(n: int, lang: str = "es") -> str:
    """«7.200» / «7,200» — the thousands separator the reader's locale expects."""
    s = f"{int(n or 0):,}"
    return s.replace(",", ".") if (lang or "es").startswith("es") else s


# ─────────────────────────────── the answer set ───────────────────────────────

# Every id the quiz might name a question with, folded onto the ten questions in
# product/PRICING-COPY-ES.md. Matching is on the NORMALIZED id first and the question text second,
# so a renamed key still lands as long as the heading survived.
_ALIASES: Dict[str, Sequence[str]] = {
    "personas": ("personas", "persona", "equipo", "team", "seats", "gente", "cuantas_personas"),
    "pedidos": ("pedidos", "volumen", "orders", "volume", "cuantos_pedidos"),
    "limite": ("limite", "tope", "cap", "que_te_impide"),
    "compras": ("compras", "compra", "purchasing", "quieres_compras"),
    "reparte": ("reparte", "repartes", "furgonetas_propias", "delivers", "repartes_tu"),
    "reparto": ("reparto", "quiere_reparto", "delivery", "quieres_reparto"),
    "furgonetas": ("furgonetas", "furgoneta", "vans", "van", "cuantas_furgonetas"),
    "radar": ("radar", "vigile", "senales"),
    "erp": ("erp", "facturacion", "invoicing", "con_que_facturas", "programa"),
    "sedes": ("sedes", "sede", "almacenes", "marcas", "sites", "varios_almacenes"),
}


def _slot(ident: str, question: str) -> str:
    """Which of the ten questions this is, or '' when it is one we do not price on."""
    nid, nq = _norm(ident), _norm(question)
    for slot, keys in _ALIASES.items():
        for k in keys:
            if nid == k or nid.startswith(k + "_") or nid.endswith("_" + k):
                return slot
    for slot, keys in _ALIASES.items():
        if any(k in nq for k in keys):
            return slot
    return ""


def clean_answers(raw: Any) -> List[Dict[str, str]]:
    """The submitted answers, IN ORDER, capped and flattened to {id, q, a, slot}.

    ORDER IS THE POINT — Peter asked for «every quiz answer IN ORDER», because the order is the
    conversation he would have had. So a list is kept as sent and a dict is kept in insertion order
    (Python 3.7+ guarantees it, and `json.loads` preserves the wire order), never sorted.
    """
    items: List[Dict[str, str]] = []
    if isinstance(raw, dict):
        raw = [{"id": k, "answer": v} for k, v in raw.items()]
    if not isinstance(raw, (list, tuple)):
        return items
    for entry in list(raw)[:MAX_ANSWERS]:
        if isinstance(entry, (list, tuple)) and len(entry) >= 2:
            entry = {"id": entry[0], "answer": entry[1]}
        if not isinstance(entry, dict):
            entry = {"answer": entry}
        ident = _text(entry.get("id") or entry.get("key") or entry.get("name"))
        question = _text(entry.get("q") or entry.get("question") or entry.get("label")
                         or entry.get("title"))
        answer = _scalar(entry.get("a", entry.get("answer", entry.get("value"))))
        # `value` is the machine option code when the page sends both: it decides yes/no and numbers,
        # while `answer` is what the visitor read and is what gets printed. Kept apart because
        # «De momento no» and `compras=false` are the same fact said two ways, and only one of them
        # belongs in an email Peter reads.
        raw_value = entry.get("value")
        value = _scalar(raw_value) if raw_value is not None else ""
        if value == answer:
            value = ""
        if not (ident or question or answer):
            continue
        items.append({"id": ident, "q": question, "a": answer, "value": value,
                      "slot": _slot(ident, question)})
    return items


def _by_slot(answers: List[Dict[str, str]], slot: str) -> Optional[Dict[str, str]]:
    for a in answers:
        if a["slot"] == slot:
            return a
    return None


def _voice(a: Optional[Dict[str, str]]) -> str:
    """The string a slot votes with: the machine value when the page sent one, else what they read."""
    if not a:
        return ""
    return a.get("value") or a.get("a") or ""


def _label(a: Optional[Dict[str, str]]) -> str:
    """The string a slot is PRINTED with — what the visitor read, and only then the machine value.

    The mirror of `_voice`, and the rule `clean_answers` already states: «`value` decides yes/no and
    numbers, `answer` is what the visitor read and is what gets printed». Two fields in `_derive`
    broke it and it went unnoticed while the page posted nothing at all: the moment /precios started
    sending both halves (2026-08-15), Peter's alert read «Personas peq» and «Factura con cloud»
    instead of «1 a 3» and «Holded, o algo en la nube». Those two go in an email he reads on a phone
    before ringing somebody; they are not identifiers.
    """
    if not a:
        return ""
    return a.get("a") or a.get("value") or ""


def _band_from_team(v: str) -> str:
    """«1 a 3» → peq · «4 a 10» → med · «Más de 10» → gra. Reads the numbers, not the punctuation,
    so «1-3», «hasta 3 personas» and «3» all land in the same place."""
    t = _norm(v)
    if t in ("peq", "pequeno", "med", "mediano", "gra", "grande"):
        return {"peq": "peq", "pequeno": "peq", "med": "med", "mediano": "med",
                "gra": "gra", "grande": "gra"}[t]
    got = _ints(t)
    top = max(got) if got else 0
    more = any(w in t for w in ("mas_de", "more_than", "over", "plus"))
    if more and top >= 10:
        return "gra"
    if top > 10:
        return "gra"
    if top > 3:
        return "med"
    return "peq"


def _derive(answers: List[Dict[str, str]]) -> Dict[str, Any]:
    """Everything the price needs, read out of the answers alone — the path taken when the page
    posts what the visitor SAID without also posting what the report computed."""
    team = _voice(_by_slot(answers, "personas"))
    band = _band_from_team(team) if team else "peq"
    # The band VOTES on the code and the alert PRINTS the label — `_band_from_team` reads «peq» and
    # «4 a 10» equally well, so nothing is lost by keeping the two apart.
    team_label = _label(_by_slot(answers, "personas"))

    orders = _clamp(_voice(_by_slot(answers, "pedidos")), 0, MAX_ORDERS, 0)
    vans = _clamp(_voice(_by_slot(answers, "furgonetas")), 0, MAX_VANS, 0)

    compras = _is_yes(_voice(_by_slot(answers, "compras")))
    # HAVING VANS IS NOT WANTING THE MODULE — the deck says so in capitals («Having vans MUST NOT
    # imply wanting the module»), because question 5 asks whether they deliver and question 6 asks
    # whether Rocoto should. Only question 6 turns Reparto on.
    reparto = _is_yes(_voice(_by_slot(answers, "reparto")))
    radar = _is_yes(_voice(_by_slot(answers, "radar")))
    sedes = _is_yes(_voice(_by_slot(answers, "sedes")))
    reparte = _is_yes(_voice(_by_slot(answers, "reparte")))

    # Same split for the invoicing question: «desktop» is what decides whether the integration is
    # bespoke, «Sage, o algo instalado en un ordenador» is what Peter reads.
    erp_raw = _voice(_by_slot(answers, "erp"))
    erp_label = _label(_by_slot(answers, "erp"))
    erp = _norm(erp_raw)
    erp_desktop = any(k in erp for k in ("sage", "instalado", "ordenador", "desktop", "local"))
    erp_cloud = any(k in erp for k in ("holded", "nube", "cloud"))

    # Multiple sites is what Grande is FOR («Sin límite de personas, varios almacenes y marcas»), so
    # it lifts the band rather than routing anywhere.
    if sedes:
        band = "gra"

    return {"band": band, "orders": orders, "vans": vans,
            "compras": bool(compras), "reparto": bool(reparto), "radar": bool(radar),
            "sedes": bool(sedes), "reparte": bool(reparte),
            "team_answer": team_label, "erp_answer": erp_label,
            "erp_desktop": erp_desktop, "erp_cloud": erp_cloud}


# ─────────────────────────────── the price ───────────────────────────────

def _band_of(v: Any) -> str:
    """A wire band code, or '' when it is not one of ours. Deliberately narrow: the retired ceiling
    bands (s/m/l/xl) resolve in `pedidos_billing.band_key` and must NOT be quotable from a web form."""
    t = _norm(v)
    alias = {"peq": "peq", "pequeno": "peq", "small": "peq",
             "med": "med", "mediano": "med", "medium": "med",
             "gra": "gra", "grande": "gra", "large": "gra"}
    return alias.get(t, "")


def _modules_of(payload_mods: Any, derived: Dict[str, Any]) -> Dict[str, bool]:
    """Ventas is always on — it is the thing being bought; the other three are choices."""
    picked = {"ventas": True, "compras": derived["compras"],
              "reparto": derived["reparto"], "radar": derived["radar"]}
    if isinstance(payload_mods, dict):
        for m in MODULE_IDS:
            if m in payload_mods:
                picked[m] = bool(payload_mods[m])
    elif isinstance(payload_mods, (list, tuple)):
        named = {_norm(x) for x in payload_mods}
        if named:
            for m in MODULE_IDS:
                picked[m] = m in named
    picked["ventas"] = True
    return picked


def _half_up(numerator: int, denominator: int) -> int:
    """floor(n/d + 0.5), in integers — the half-up rounding both JavaScript surfaces do.

    Python's `round()` is banker's (half to EVEN), so it lands a cent under `Math.round` on every
    tie, and a tie is not exotic here: Mediano with any odd order count puts Radar's 15 % exactly on
    a half cent (7.201 pedidos + Compras is 65.227,5 c). The landing island and the webapp both
    spell this as `Math.floor((cents * pct + 50) / 100)`; this is the same arithmetic, and it is
    integer-only so no float ever holds money on this side either.
    """
    return (2 * numerator + denominator) // (2 * denominator)


def _lines(band: str, orders: int, mods: Dict[str, bool], vans: int,
           lang: str = "es") -> Dict[str, Any]:
    """One column of the bill: the labelled lines and their sum, in cents.

    RADAR IS LAST AND IS A PERCENTAGE OF WHAT CAME BEFORE IT — «Se activa una vez y cubre todos los
    módulos que tengas contratados», so it is computed on the subtotal of this same column rather
    than on some other column's, which is what makes «si un mes vendes poco, cuesta poco» true.

    WHICH IS ALSO THE RULE THE OTHER TWO SURFACES RUN: Radar is charged on the lines it actually
    covers. That falls out of taking the percentage per column — `today` is called with the LIVE
    modules and `chosen` with the whole configuration. Since 2026-08-15 every LIVE flag is true, so
    the two columns are the same bill and lead_notify prints one; the machinery survives because it
    is what would report a module genuinely going dark again.
    """
    b = BANDS[band]
    es = (lang or "es").startswith("es")
    lines: List[Dict[str, Any]] = []

    lines.append({"id": "ventas",
                  "label": (f"Ventas {b['name']} · cuota" if es else f"Sales {b['name']} · fee"),
                  "cents": int(b["mensual_cents"])})
    if orders:
        rate = int(b["per_order_cents"])
        lines.append({"id": "pedidos",
                      "label": (f"{num(orders, lang)} pedidos × {eur(rate, lang)}" if es
                                else f"{num(orders, lang)} orders × {eur(rate, lang)}"),
                      "cents": orders * rate})
    if mods.get("compras"):
        lines.append({"id": "compras", "label": "Compras" if es else "Purchasing",
                      "cents": int(b["compras_cents"])})
    if mods.get("reparto"):
        lines.append({"id": "reparto",
                      "label": (f"Reparto · {num(vans, lang)} furgonetas × {eur(REPARTO_VAN_CENTS, lang)}"
                                if es else
                                f"Delivery · {num(vans, lang)} vans × {eur(REPARTO_VAN_CENTS, lang)}"),
                      "cents": vans * REPARTO_VAN_CENTS})
    subtotal = sum(l["cents"] for l in lines)
    if mods.get("radar"):
        lines.append({"id": "radar",
                      "label": (f"Radar · {RADAR_PCT} % de {eur(subtotal, lang)}" if es
                                else f"Radar · {RADAR_PCT}% of {eur(subtotal, lang)}"),
                      "cents": _half_up(subtotal * RADAR_PCT, 100)})
    return {"lines": lines, "total_cents": sum(l["cents"] for l in lines)}


def bundle_total_cents(qty: int, plan_rate_cents: int) -> int:
    """What a bolsa of `qty` pedidos costs on a band that charges `plan_rate_cents`, in cents.

        total_cents = half_up(qty × per_order_cents × (100 − discount_pct) / 100)

    THE SAME EXPRESSION THE OTHER TWO SURFACES RUN, deliberately. /precios spells it
    `pctCents(qty * plan.rate, 100 - C.bundles.discountPct)` and /plan spells it
    `pctCents(qty * plan.per_order_cents, 100 - BUNDLES.discount_pct)`; `_half_up` here is that same
    `Math.floor((cents * pct + 50) / 100)` written in integers. A second rounding rule on this line
    is exactly the cent of divergence the three surfaces were unified to kill on 2026-08-15, and it
    is a line a customer pays in one go rather than a cent on a monthly bill.

    PUBLIC BECAUSE THE GATE CALLS IT. tools/check_pricing_sync.py asserts this function against
    pricing.json's own figures — including that no bolsa can ever cost more than metering the same
    orders, which is the defect the flat percentage was introduced to kill. A gate that recomputed
    the formula itself would pass while this shipped something else.
    """
    return _half_up(int(qty) * int(plan_rate_cents) * (100 - BUNDLE_DISCOUNT_PCT), 100)


def _bundle(qty: Any, band: str, orders: int) -> Optional[Dict[str, Any]]:
    """The prepaid bolsa they ticked, priced on THEIR OWN band — «Válida 12 meses».

    EVERY SIZE IS OFFERED TO EVERY BAND (2026-08-15). This used to drop any bolsa whose fixed rate
    failed to beat the visitor's tarifa, which on Grande hid two of the three — a filter whose only
    real job was to conceal a promotion that was not one. Now the price comes off their own rate, so
    nobody can be quoted worse than metering and there is nothing left to hide: «{pct} % más barato
    que tu tarifa» is true on every row for everybody, at the same flat percentage.

    IT STAYS A DISCOUNT FOR PAYING UP FRONT, NEVER A LOWER RATE. Nothing here touches the band's
    `per_order_cents`; the bag is bought once, runs down as orders land, and the published rate
    takes over when it is empty.
    """
    want = _clamp(qty, 0, 10_000_000, 0)
    if want not in BUNDLES:
        return None
    # A bolsa that is not cheaper is not a bolsa. Unreachable at the published 10 % and asserted in
    # tools/check_pricing_sync.py, but kept as a refusal rather than a comment: the one failure this
    # whole change exists to end was a bag quoted above the customer's own metered rate, and it
    # reached /precios because every layer assumed some other layer had checked.
    if BUNDLE_DISCOUNT_PCT <= 0:
        return None
    plan_rate = int(BANDS[band]["per_order_cents"])
    total = bundle_total_cents(want, plan_rate)
    return {"qty": want,
            # THE TOTAL IS WHAT IS CHARGED; the per-order figure is derived FROM it for the alert's
            # «5.000 a 0,54 € = 2.700 €» line, so the sentence Peter reads always multiplies out.
            # Deriving it the other way round would let a rounded rate disagree with the price.
            "rate_cents": _half_up(total, want),
            "total_cents": total,
            # Flat, by construction: the same percentage off whatever rate they are on.
            "saving_pct": BUNDLE_DISCOUNT_PCT,
            "covers_months": round(want / orders, 1) if orders else None}


def build(payload: Dict[str, Any], lang: str = "es") -> Dict[str, Any]:
    """The whole recompute, from a raw request body. NEVER RAISES — a lead that arrives with a
    malformed body is still a lead, and the alert is worth more than the arithmetic in it.

    Returns the answers (in order), what was configured, three bills, the sales routing and the
    visitor's own claimed total so the two can be compared by eye.
    """
    try:
        answers = clean_answers(payload.get("answers"))
        d = _derive(answers)
        sel = payload.get("selection") if isinstance(payload.get("selection"), dict) else {}

        band = _band_of(sel.get("band") or sel.get("plan")) or d["band"]
        orders = _clamp(sel.get("orders", sel.get("pedidos")), 0, MAX_ORDERS, d["orders"])
        vans = _clamp(sel.get("vans", sel.get("furgonetas")), 0, MAX_VANS, d["vans"])
        mods = _modules_of(sel.get("modules"), d)

        chosen = _lines(band, orders, mods, vans, lang)
        today = _lines(band, orders, {m: (mods[m] and LIVE.get(m, False)) for m in MODULE_IDS},
                       vans, lang)
        everything = _lines(band, orders, dict.fromkeys(MODULE_IDS, True), vans, lang)

        pending = [m for m in MODULE_IDS if mods.get(m) and not LIVE.get(m, False)]

        # SALES ROUTING, RECOMPUTED. Grande is where «el precio final lo ajustamos contigo» starts —
        # it is the band a team over ten, or more than one warehouse or brand, lands in — and a
        # volume past the largest prepaid bundle has no published answer left to give.
        reasons: List[str] = []
        if d["sedes"]:
            reasons.append("Varios almacenes o marcas")
        if band == "gra" and not d["sedes"]:
            reasons.append("Equipo de más de 10 personas")
        if orders > SALES_ORDERS_OVER:
            reasons.append(f"Más de {num(SALES_ORDERS_OVER, lang)} pedidos al mes")
        sales = bool(reasons)

        claimed = sel.get("total_cents")
        if claimed is None and sel.get("total") is not None:
            claimed = _clamp(sel.get("total"), 0, 10_000_000, 0) * 100

        return {
            "ok": True,
            "answers": answers,
            "band": band, "band_name": str(BANDS[band]["name"]),
            "seats": BANDS[band].get("seats"),
            "orders": orders, "vans": vans,
            "modules": [m for m in MODULE_IDS if mods.get(m)],
            "pending": pending,
            "today": today, "chosen": chosen, "everything": everything,
            "bundle": _bundle(sel.get("bundle", sel.get("bono")), band, orders),
            "sales": sales, "sales_reasons": reasons,
            "erp_desktop": d["erp_desktop"], "erp_cloud": d["erp_cloud"],
            "erp_answer": d["erp_answer"], "team_answer": d["team_answer"],
            "reparte": d["reparte"],
            "client_total_cents": (int(claimed) if isinstance(claimed, (int, float)) else None),
            "client_route": _text(payload.get("route") or sel.get("route")),
        }
    except Exception:  # noqa: BLE001 — the whole point of this module is that it cannot fail a submit
        log.exception("pricing_quote.build failed (fail-soft — the lead still lands)")
        return {"ok": False, "answers": clean_answers((payload or {}).get("answers")),
                "band": "peq", "band_name": str(BANDS["peq"]["name"]), "seats": 3,
                "orders": 0, "vans": 0, "modules": ["ventas"], "pending": [],
                "today": {"lines": [], "total_cents": 0},
                "chosen": {"lines": [], "total_cents": 0},
                "everything": {"lines": [], "total_cents": 0},
                "bundle": None, "sales": False, "sales_reasons": [],
                "erp_desktop": False, "erp_cloud": False, "erp_answer": "", "team_answer": "",
                "reparte": False, "client_total_cents": None, "client_route": ""}
