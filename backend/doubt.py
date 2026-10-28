"""doubt.py — THE DOUBT FACULTY (Peter, 2026-07-26; SPEC §5.7a).

The twin of `confidence.py`. That module grounds doubt about WHAT WAS HEARD (audio); this one grounds
doubt about WHAT IT MEANS (which SKU). Same shape on purpose:

  * deterministic — no LLM. The faculty supplies the FACT; the mind supplies the words.
  * fail-safe — an unmeasured line is doubted, never silently trusted. Same reasoning as the audio:
    we do not auto-confirm money on a signal we did not measure.
  * a PERCEPTION note injected BEFORE the mind reasons, and EMPTY when there is nothing to doubt, so
    a clean order adds no noise to the prompt.

WHY A FACULTY AND NOT A SCORE. A single "confidence: 0.62" on a line cannot tell you what to DO.
Doubt has a KIND (what to ask) and a DIRECTION (who can even answer). Getting the direction wrong is
what turns this product back into a review queue — the whole §5.7 thesis is that the CUSTOMER
resolves ambiguity because the customer is the only one who knows what they meant.

TWO MEASURED SIGNALS, AND NEITHER IS ENOUGH ALONE (Peter: "the quality of the audio, and then the
scoring of the embedding search"):

  1. AUDIO — `confidence.classify()`. Gates whether asking is worth anything at all. On DIRTY audio a
     perfect SKU match is worthless, so we never ask a multiple choice about a transcript we do not
     trust; the order goes to human review instead.
  2. RETRIEVAL — the matcher's own numbers, which already exist (brain/matcher.py):
       * `band` ∈ clean | note | unsure   — rerank score gate (RERANK_CLEAR .45 / RERANK_UNSURE .15)
       * `tight`                          — top1−top2 rerank gap < MARGIN_TIGHT (.12)
       * `alias_hit`                      — this customer already taught us this word
       * `unit_ok`                        — the unit itself is the doubt, not the product
     NOTE the bands ride a RERANKER, not raw dense cosine. matcher.py says so explicitly ("Dense
     cosine does NOT separate in-vs-out-of-catalogue"), which is why this faculty reads rerank bands
     rather than embedding distance — the cross-encoder is the better-calibrated signal.

THE MARGIN IS THE POINT. `top1` alone cannot separate the kinds; `top1 − top2` can:
     high score + wide margin  -> resolved, say nothing
     high score + TIGHT margin -> AMBIGUOUS: two real candidates, a genuine multiple choice
     mid  score + wide margin  -> THIN: one plausible hit, confirm it singly
     low  score                -> UNKNOWN: nothing matches; three wrong options is worse than silence

This also makes Meta's 3-button cap coherent rather than arbitrary: the escape row «Ninguno, te digo»
eats one button, so a real choice is TWO candidates plus the escape. If the margin is tight across
five rows we cannot get to two, and the honest classification is UNKNOWN — not ambiguous. (That
sentence described an unimplemented branch until 2026-07-27; `classify_line` now enforces it off the
matcher's `n_close`. A LIST beyond three options is available in `ask_options` and is deliberately NOT
used here: picking which two of nine to show is a guess, and §5.7a says the cap is a feature.)

WHO ANSWERS (the direction):
    AMBIGUOUS / DIMENSIONLESS / UNIT / THIN -> the CUSTOMER. They know what they meant.
    UNKNOWN                                 -> the COMERCIAL. A catalogue gap is not the customer's
                                               to fix, and guessing at them erodes the relationship.
    CONFLICT                                -> the COMERCIAL. §5.8's "pedido muy grande". You do not
                                               interrogate a customer about their own order size.

THE BUDGET. One question per order; a second only if it rides the same message. Three ambiguous
lines must not become three questions — an order that generates four questions has already lost the
customer. We rank by value (money at risk × how often this alias will recur) and ask the best one;
the rest are accepted FLAGGED or go to review. This is the difference between a careful supplier and
an interrogation, and it is enforced here in code rather than left to the mind's judgement.

NEVER TWICE. `alias_hit` means answered once ⇒ never ask again. And a line we already ASKED about and
got SILENCE on is not re-asked on the next order either — re-asking is nagging, and §5.8's timeout
already owns that case. Silence is an answer about the channel, not an invitation to repeat.
Callers pass `already_asked` for this.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

# ── kinds ────────────────────────────────────────────────────────────────────────────────────────
AMBIGUOUS = "ambiguous"        # 2+ real candidates, tight margin      -> customer, buttons
DIMENSIONLESS = "dimensionless"  # product fixed, calibre/format missing -> customer, buttons
UNIT = "unit"                  # qty fine, the UNIT is the doubt       -> customer, buttons
THIN = "thin"                  # one weak hit                          -> customer, single confirm
UNKNOWN = "unknown"            # nothing in the catalogue matches      -> comercial
CONFLICT = "conflict"          # resolves, but contradicts what we know -> comercial

CUSTOMER = "customer"
COMERCIAL = "comercial"

_DIRECTION = {AMBIGUOUS: CUSTOMER, DIMENSIONLESS: CUSTOMER, UNIT: CUSTOMER, THIN: CUSTOMER,
              UNKNOWN: COMERCIAL, CONFLICT: COMERCIAL}

# ── GROUNDING GATE (Peter, 2026-07-26: "obviously it needs the inventory loaded to work") ────────
# Doubt is only meaningful against a catalogue. With no SKUs loaded the matcher cannot help but return
# band='unsure' on EVERY line, and two bad things follow if we do not gate: we would either ask the
# customer to choose from an empty list, or bury the comercial under a review queue containing his
# whole order book — on his FIRST day, which is exactly when trust is thinnest.
#
# So an ungrounded tenant is a distinct state, not a pile of UNKNOWNs: accept and acknowledge the
# order (§5.7's answering line still holds — the restaurant is never left hanging), route it to the
# comercial ONCE with a single honest reason, and ask the customer NOTHING. It is our catalogue that
# is missing, not their clarity.
#
# This is pure DB state — `select count(*) from catalogue_skus where tenant_id=$1` (the same read
# lifecycle.py already does) — so onboarding's "upload your products" step is literally the switch
# that turns this faculty on. Nothing else to configure.
MIN_SKUS_GROUNDED = 1


async def catalogue_ready(con, tenant: str) -> Dict[str, Any]:
    """Is this tenant grounded enough for doubt to mean anything? DB state only.

    Returns {grounded, skus, in_assortment, reason}. `in_assortment` is counted separately because a
    tenant can have rows loaded but nothing sellable, which grounds the matcher no better than zero.
    """
    skus = await con.fetchval("select count(*) from catalogue_skus where tenant_id=$1", tenant) or 0
    live = await con.fetchval(
        "select count(*) from catalogue_skus where tenant_id=$1 and in_assortment", tenant) or 0
    grounded = live >= MIN_SKUS_GROUNDED
    return {"grounded": grounded, "skus": int(skus), "in_assortment": int(live),
            "reason": ("catálogo cargado" if grounded else
                       "sin catálogo cargado — no se puede preguntar por productos que no tenemos")}


UNGROUNDED = "ungrounded"   # our catalogue is missing, not their clarity -> comercial, ask nothing

# One question per order. A second only if it costs the customer nothing extra (same message).
QUESTION_BUDGET = 1
# Meta allows 3 buttons and the escape row takes one, so a real multiple choice is two candidates.
MAX_CANDIDATES = 2

# ── THE WIDE TIE (the law this module's docstring has always stated, implemented 2026-07-27) ─────
# "If the margin is tight across five rows we cannot get to two, and the honest classification is
# UNKNOWN — not ambiguous." That sentence was in the docstring above and in §5.7a, and `classify_line`
# had no branch for it: the seed's own two wide-tie mentions («lomo», tied across 4 rows; «chorizo
# para asar», across 9) both came back AMBIGUOUS, so the customer was offered a two-way choice out of
# nine. That is precisely the "three wrong options is worse than silence" failure the section forbids
# — and worse than silence, because two of nine looks confident.
#
# `n_close` is the matcher's own count of rows indistinguishable from the pick, taken over the FULL
# candidate pool. `TIE_WIDTH` only exists for callers that hand-build a match dict (the vitals, the
# review tooling): it mirrors matcher.MARGIN_TIGHT but is NOT imported from it, because this faculty
# reads facts and must not acquire an opinion about the matcher's thresholds.
TIE_WIDTH = 0.12


def _n_close(m: Dict[str, Any], cands: List[Dict[str, Any]]) -> int:
    """How many candidate rows are indistinguishable from the pick? The matcher's count wins."""
    n = m.get("n_close")
    if isinstance(n, int) and n > 0:
        return n
    scored = [c["score"] for c in cands if isinstance(c.get("score"), (int, float))]
    if len(scored) < 2:
        return len(cands)
    top = max(scored)
    return sum(1 for s in scored if (top - s) < TIE_WIDTH)


def _money(line: Dict[str, Any]) -> float:
    """Money at risk on this line — the primary ranking term. Missing price ⇒ 0, which correctly
    deprioritises a line we cannot value against one we can."""
    try:
        qty = float(line.get("qty") or 0)
        price = float((line.get("price") if line.get("price") is not None else 0) or 0)
        return abs(qty * price)
    except (TypeError, ValueError):
        return 0.0


def classify_line(line: Dict[str, Any], *, validator: Optional[Dict[str, Any]] = None,
                  already_asked: bool = False) -> Dict[str, Any]:
    """Classify ONE line's doubt from the matcher's own output. Deterministic.

    `line` carries the matcher result under `match` (band / tight / alias_hit / unit_ok / candidates),
    plus `mention`, `qty`, `unit`, `price`. `validator` carries the deterministic flags
    (qty_off_norm, typical_qty, new_customer). Returns {kind, direction, ask, candidates, reason} —
    `kind=None` means resolved and nothing is said about it.
    """
    m = (line.get("match") or {})
    v = (validator or {})
    cands: List[Dict[str, Any]] = list(m.get("candidates") or [])

    # already taught: the whole point of §5.7 is that this never comes back
    if m.get("alias_hit"):
        return {"kind": None, "direction": None, "ask": False, "candidates": [],
                "reason": "alias ya aprendido para este cliente"}

    band = (m.get("band") or "unsure").lower()
    tight = bool(m.get("tight"))
    unit_ok = m.get("unit_ok", True)

    # ── comercial-facing first: these must never become a question to the customer ──
    if band == "unsure" or not cands:
        return {"kind": UNKNOWN, "direction": COMERCIAL, "ask": False, "candidates": cands[:3],
                "reason": "no hay nada en el catálogo que encaje — hueco de catálogo, no duda del cliente"}
    if v.get("qty_off_norm"):
        return {"kind": CONFLICT, "direction": COMERCIAL, "ask": False, "candidates": cands[:1],
                "reason": f"cantidad fuera de lo normal para este cliente (habitual ~{v.get('typical_qty')})"}
    # THE WIDE TIE — checked here, ABOVE the unit branch, because a unit question asked about a
    # product we have not identified is a question about nothing. If the top rows cannot be reduced
    # to two, there is no honest multiple choice to send and it is the comercial's.
    n_close = _n_close(m, cands)
    if tight and n_close > MAX_CANDIDATES:
        return {"kind": UNKNOWN, "direction": COMERCIAL, "ask": False, "candidates": cands[:3],
                "reason": f"empate estrecho entre {n_close} filas del catálogo — no se puede reducir "
                          f"a dos opciones honestas, así que no se le pregunta al cliente"}

    # ── customer-facing ──
    if not unit_ok:
        return {"kind": UNIT, "direction": CUSTOMER, "ask": not already_asked,
                "candidates": cands[:MAX_CANDIDATES],
                "reason": m.get("unit_note") or "la unidad es la duda, no el producto"}
    if tight and len(cands) >= 2:
        # DIMENSIONLESS is AMBIGUOUS whose candidates are the SAME product at different calibre/pack —
        # worth naming separately because the question is about the dimension, not the product, and
        # that is the common case in this trade (MANZANA GOLDEN 20 vs 26).
        kind = DIMENSIONLESS if _same_product(cands[0], cands[1]) else AMBIGUOUS
        return {"kind": kind, "direction": CUSTOMER, "ask": not already_asked,
                "candidates": cands[:MAX_CANDIDATES],
                "reason": "dos candidatos reales, margen estrecho"}
    if band == "note":
        return {"kind": THIN, "direction": CUSTOMER, "ask": not already_asked,
                "candidates": cands[:1], "reason": "un solo candidato y flojo — confirmar, no elegir"}
    return {"kind": None, "direction": None, "ask": False, "candidates": [],
            "reason": "resuelto"}


def _same_product(a: Dict[str, Any], b: Dict[str, Any]) -> bool:
    """Do two candidates look like the same product at a different calibre / format / pack? Compared
    on the leading words of the name, which is how these catalogues are written
    ('MANZANA GOLDEN 20 - 4/5 PZAS KG' vs 'MANZANA GOLDEN 26 - 7/8 PZAS KG')."""
    def head(c: Dict[str, Any]) -> str:
        words = [w for w in str(c.get("name") or "").upper().split() if not any(ch.isdigit() for ch in w)]
        return " ".join(words[:2])
    ha, hb = head(a), head(b)
    return bool(ha) and ha == hb


def classify(lines: List[Dict[str, Any]], *, audio: Optional[Dict[str, Any]] = None,
             validators: Optional[List[Dict[str, Any]]] = None,
             asked_aliases: Optional[set] = None,
             grounded: bool = True) -> Dict[str, Any]:
    """Classify a whole order and apply the budget.

    `audio` is `confidence.classify()`'s verdict. If it says review (dirty/shaky), we ask the customer
    NOTHING — a multiple choice built on a transcript we do not trust is worse than silence — and the
    order routes to the human. That gate is why this takes the audio verdict rather than re-deriving it.

    Returns {ask: [..], flagged: [..], review: bool, reason} where `ask` is at most QUESTION_BUDGET
    entries, each {index, kind, candidates, ...}.
    """
    # ungrounded tenant: ONE honest reason to the comercial, nothing asked of the customer
    if not grounded:
        return {"ask": [], "flagged": [], "review": True, "ungrounded": True,
                "reason": "sin catálogo cargado — el pedido se acepta y va al comercial; "
                          "no se le pregunta nada al cliente",
                "lines": [{"index": i, "kind": UNGROUNDED, "direction": COMERCIAL, "ask": False,
                           "mention": ln.get("mention"), "candidates": [], "value": _money(ln),
                           "reason": "todavía no hay catálogo contra el que casar"}
                          for i, ln in enumerate(lines or [])]}
    validators = validators or []
    asked = asked_aliases or set()
    per_line: List[Dict[str, Any]] = []
    for i, ln in enumerate(lines or []):
        v = validators[i] if i < len(validators) else {}
        d = classify_line(ln, validator=v, already_asked=(str(ln.get("mention") or "").lower() in asked))
        d["index"] = i
        d["mention"] = ln.get("mention")
        d["value"] = _money(ln)
        per_line.append(d)

    doubted = [d for d in per_line if d["kind"]]
    if not doubted:
        return {"ask": [], "flagged": [], "review": False, "reason": "todas las líneas resueltas",
                "lines": per_line}

    # audio gate: never interrogate on a transcript we do not trust
    if audio and audio.get("review"):
        # `audio: True` NAMES this gate on the verdict (2026-07-26). It is not decoration: "asked
        # nothing AND went to review" is ALSO what an order looks like when every doubted line was
        # already asked about once and one of them is the comercial's — so a reader inferring the
        # audio gate from `review and not ask` puts «audio poco fiable» in front of a comercial
        # whose audio was fine. The gate that fired is the gate's to declare.
        return {"ask": [], "flagged": doubted, "review": True, "audio": True,
                "reason": "audio poco fiable — no se pregunta nada al cliente; va a revisión humana",
                "lines": per_line}

    askable = [d for d in doubted if d["ask"]]
    # value first, then how often the word will recur (a shorter mention is more likely to be a
    # habitual term worth learning than a long one-off phrase)
    askable.sort(key=lambda d: (-d["value"], len(str(d.get("mention") or ""))))
    ask = askable[:QUESTION_BUDGET]
    chosen = {id(d) for d in ask}
    flagged = [d for d in doubted if id(d) not in chosen]
    review = any(d["direction"] == COMERCIAL for d in doubted)
    return {"ask": ask, "flagged": flagged, "review": review,
            "reason": f"{len(doubted)} línea(s) con duda; se pregunta {len(ask)}", "lines": per_line}


def doubt_note(verdict: Dict[str, Any]) -> str:
    """The fold-ready PERCEPTION note (organ ② → ④, injected BEFORE the mind — the twin of
    `confidence.perception_note`). EMPTY when nothing is doubted, so a clean order adds no prompt
    noise. Gives the mind the FACT and the PERMISSION, never the wording: the tentative register and
    the sentence itself are the mind's, per §5.7's tone law."""
    if not verdict:
        return ""
    ask = verdict.get("ask") or []
    flagged = verdict.get("flagged") or []
    if not ask and not flagged and not verdict.get("ungrounded"):
        return ""

    if verdict.get("ungrounded"):
        return ("⚠️ DUDA (pre-razonamiento, dato duro): este proveedor TODAVÍA NO TIENE CATÁLOGO "
                "cargado, así que no puedes casar ninguna línea con un producto real. Acusa recibo "
                "del pedido con naturalidad («recibido — te lo confirmamos en cuanto lo preparemos») "
                "y NO le preguntes al cliente por productos ni le ofrezcas opciones: el que falta "
                "somos nosotros, no él. El pedido entero va al comercial.")
    out = ["⚠️ DUDA (pre-razonamiento, dato duro):"]
    for d in ask:
        opts = " · ".join(f"«{c.get('name')}»" for c in (d.get("candidates") or []))
        out.append(
            f"· «{d.get('mention')}»: {d['kind']}. Pregúntale AL CLIENTE, con estas opciones de SU "
            f"catálogo: {opts} — más la salida «Ninguno, te digo». Máximo UNA pregunta en este pedido."
        )
    for d in flagged:
        if d["direction"] == COMERCIAL:
            out.append(f"· «{d.get('mention')}»: {d['kind']} — NO se lo preguntes al cliente. "
                       f"Eso lo mira el comercial ({d.get('reason')}).")
        else:
            out.append(f"· «{d.get('mention')}»: {d['kind']} — queda MARCADA, sin preguntar "
                       f"(ya se gastó la pregunta de este pedido).")
    out.append("Nada de esto está «apuntado» hasta que el cliente conteste: acusa recibo del pedido, "
               "pregunta con naturalidad como quien no quiere liarla, y no digas «listo» ni «apuntado» "
               "de las líneas en duda.")
    return "\n".join(out)
