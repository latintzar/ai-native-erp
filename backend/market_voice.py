"""market_voice.py — what Rocoto is ALLOWED to say to a customer, enforced after the model.

Raquel (Julio Pérez, 500 orders a morning), 2026-08-19, on the two things that would lose her
customers. Both are gates here rather than lines in the persona, because a persona is a request and
this is a rule:

① IT MUST NOT PROMISE STOCK IT CANNOT SEE.
   «Mientras no se vincule con mi ERP: "ok, recibido" — no "confirmado", RECIBIDO. Y "si hubiera
   alguna incidencia o alguna falta te avisaremos lo antes posible". Como muchísimo esa coletilla.»

   Her reason is the trade, not pedantry: she buys at the market at midnight. A customer orders
   100 boxes of lubina at 20:00; five arrive. Anything Rocoto said at 20:00 about having it was a
   sale of fish that does not exist, and she is the one who has to ring them in the morning.

② IT MUST BE SHORT.
   «De mensaje me sobra… al cliente le voy a volver loco. Ellos mandan el mensaje y cierran el
   WhatsApp. No se van a parar a leer una biblia, ni de coña. Como mucho un "ok" o un pulgar.»

   Her buyers write one line and close the app. The register she wants, verbatim: «No me queda.
   ¿4 o 6? ¿Te vale? ¿Te apaña?»

WHY REPLACE RATHER THAN EDIT. A forbidden claim is not a phrasing problem — the sentence is wrong
about the world. Trimming the word «confirmado» out of «te lo confirmo para mañana» leaves a
sentence that still promises. So a reply that claims stock is replaced wholesale by the
acknowledgement she authorised, and the attempt is logged: how often the model reaches for a
promise is a fact worth having.
"""
from __future__ import annotations

import logging
import re
from typing import Optional

log = logging.getLogger("rocoto.market_voice")

# Her ceiling, in characters. Two short sentences — «Recibido. Si hay alguna falta te aviso.» is
# 40. This is not a style preference: past it, the customer has stopped reading and the next
# order goes to the wholesaler who answered with «ok».
MAX_CHARS = 240

# The acknowledgement she authorised, in her own words. Positive throughout — it says what WILL
# happen, never what we cannot do.
ACK_ES = "Recibido. Si hay alguna incidencia o falta, te avisamos lo antes posible."
ACK_EN = "Got it. If anything is short or changes, we'll let you know as soon as we can."

# Claims about HAVING the goods. Each one is a sentence about stock we cannot see without the ERP.
_PROMISE = re.compile(
    r"\b("
    r"confirmad[oa]s?|confirmo|confirmamos|te lo confirmo|queda confirmad[oa]|"
    r"disponible|disponibles|en stock|hay stock|tenemos existencias|"
    r"te lo guardo|te lo reservo|reservad[oa]|apartad[oa]|"
    r"seguro que llega|llega seguro|garantizad[oa]"
    r")\b",
    re.IGNORECASE,
)


def promises_stock(text: str) -> bool:
    """Does this reply claim the goods are had, held or guaranteed?"""
    return bool(_PROMISE.search(text or ""))


def shorten(text: str, limit: int = MAX_CHARS) -> str:
    """Trim to `limit` at a SENTENCE boundary where one is near the end, else a word boundary.

    Cutting mid-sentence reads as a bug to the customer; cutting at a full stop reads as someone
    who is busy, which is exactly what she is."""
    t = (text or "").strip()
    if len(t) <= limit:
        return t
    head = t[:limit]
    stop = max(head.rfind(". "), head.rfind("? "), head.rfind("! "))
    if stop > limit * 0.5:
        return head[: stop + 1].strip()
    sp = head.rfind(" ")
    return (head[:sp] if sp > limit * 0.5 else head).strip()


# A price said out loud. In this trade a quoted number is a commitment: fish moves daily and some
# suppliers price per customer, so a supplier on `prices: hide` wants nothing said before they say
# it themselves.
_PRICE = re.compile(r"(\d+[.,]?\d*\s*(?:€|eur|euros)|(?:€|eur)\s*\d+[.,]?\d*)", re.IGNORECASE)

ASK_PRICE_ES = "Apuntado. El precio te lo confirma {who} enseguida."
ASK_PRICE_EN = "Noted. {who} will confirm the price shortly."


def quotes_price(text: str) -> bool:
    return bool(_PRICE.search(text or ""))


async def apply_for(scope: str, text: str, *, lang: str = "es") -> str:
    """THE GATE, WITH THIS SUPPLIER'S OWN ANSWERS.

    The setup questions decide what Rocoto may say, and until now they were stored and ignored —
    `approve` had zero readers and `prices` did not exist. This is where the answers become the
    behaviour:

      · `stock: no`  → it may not speak about availability. It cannot see the shelf, so a claim is
                       a guess dressed as a fact. `stock: yes` lifts that, because then it CAN.
      · `prices: hide` → no number leaves its mouth; the supplier quotes.

    Fail-soft to the cautious answers: a settings hiccup must never make Rocoto braver than the
    supplier allowed."""
    stock_known = False
    hide_prices = False
    try:
        import behaviour
        import tenancy
        b = await behaviour.get(tenancy.tenant_of(scope))
        stock_known = (b.get("stock") == "yes")
        hide_prices = (b.get("prices") == "hide")
    except Exception:
        log.debug("market_voice: settings unavailable for %s (cautious)", scope, exc_info=True)
    out = apply(text, erp_linked=stock_known, lang=lang, scope=scope)
    if hide_prices and quotes_price(out):
        log.info("market_voice: price withheld (scope=%s) — was: %s", scope, out[:120])
        who = "el equipo" if (lang or "es").startswith("es") else "the team"
        return (ASK_PRICE_ES if (lang or "es").startswith("es") else ASK_PRICE_EN).format(who=who)
    return out


def apply(text: str, *, erp_linked: bool = False, lang: str = "es",
          scope: Optional[str] = None) -> str:
    """The gate. Returns what may actually be sent.

    `erp_linked=False` is the truth today for every supplier, and it is the safe default: a box
    that wrongly believes it can see stock sells fish that never arrived."""
    t = (text or "").strip()
    if not t:
        return t
    if not erp_linked and promises_stock(t):
        log.info("market_voice: stock promise replaced (scope=%s) — was: %s", scope, t[:120])
        return ACK_ES if (lang or "es").startswith("es") else ACK_EN
    return shorten(t)
