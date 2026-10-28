"""vital_doubt_wire.py — THE DOUBT FACULTY IS ACTUALLY CALLED (WP-2, SPEC §5.7a).

`vital_doubt.py` proves the CLASSIFIER is right. This one proves the WIRE exists: that the verdict
reaches the mind before it reasons, that the question that goes out is the one the faculty chose with
the options the faculty supplied, that nothing is asked when asking would be worse than silence, and
that an answer closes the loop into `sku_aliases` so the same word is never asked about twice.

Each check is a product promise, not an assertion about arithmetic:

  W1  a CLEAN order adds NOTHING — empty note, no question, no park, and a prompt byte-identical to
      the one this pipeline built before the faculty existed
  W2  an AMBIGUOUS line ⇒ exactly ONE question, exactly TWO real catalogue rows + the escape
  W3  the BUDGET holds — three ambiguous lines are one question, not three
  W4  an UNKNOWN mention is never put to the customer; it is the comercial's, with our own words
  W5  an UNGROUNDED tenant asks NOTHING and routes ONCE with one honest reason
  W6  an `alias_hit` line is never asked again — §5.7's loop, closed
  W7  a line already ASKED and IGNORED is never re-asked
  W8  dirty audio ⇒ nothing asked, the order goes to the human
  W9  the note is injected BEFORE the evidence — asserted on the ACTUAL prompt `decide()` sends
  W10 an answered tap writes the alias, and that alias makes the next order silent

DETERMINISM: no DB, no network, no model. The model is stubbed at `brain.llm.call_tool`; the alias
write is driven against a recording fake connection, the way `vital_review_rule.py` fakes its egress.

WHAT THIS FILE DELIBERATELY DOES NOT CHECK, so that nothing here can flake:
  · that `actions.send_interactive_as_rocoto` reaches Meta — that is egress, and it has its own gates
    and its own vitals. W2/W3 assert the OPTIONS handed to that door, which is this wire's half.
  · that `matcher._alias_lookup` reads the row `_write_alias` wrote. W10 asserts the row's SQL and
    then asserts the classifier's behaviour GIVEN `alias_hit`; joining them needs a real catalogue and
    a real index, which is `vital_brain`'s job, not a promise this file can keep honestly.

Run: PYTHONPATH=. python3 tests/vital_doubt_wire.py
"""
import asyncio
import logging
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
# W9 deliberately drives the model-down path, and `decision.decide` logs that with a full traceback
# (correctly — in production that IS an incident). Quiet it here so a PASSING run prints only its
# summary line, which is the whole of the harness's contract with this file.
logging.getLogger("rocoto.brain.decision").setLevel(logging.CRITICAL)

import doubt
from brain import decision, llm, matcher, pipeline, prompts
from brain import learn as brain_learn

ok, fail = 0, []


def check(name, cond, detail=""):
    global ok
    if cond:
        ok += 1
    else:
        fail.append(f"{name}{(' — ' + detail) if detail else ''}")


# ── fixtures shaped like the REAL thing ───────────────────────────────────────────────────────
# A candidate row is exactly what `matcher.MatchResult.as_dict()` puts in `line['match']['candidates']`
# (brain/matcher.py:258-266) — not a convenient stub. If that shape changes, this vital must break.
def C(sku_id, name, score=0.52, price=2.4):
    return {"sku_id": sku_id, "code": sku_id, "name": name, "family": "FRUTA",
            "base_unit": "kg", "pack_factor": None, "variable_weight": False,
            "price": price, "in_assortment": True, "doc": name.lower(),
            "score": score, "dense": 0.41, "method": "dense+sparse"}


def L(mention, qty=3, unit="kg", **m):
    """One `synthesiser.grounded_lines` entry: mention/qty/unit/note/match — and NO price, exactly as
    the synthesiser emits it. `pipeline.doubt_lines()` is what has to put the price back."""
    m.setdefault("band", "clean")
    m.setdefault("unit_ok", True)
    m.setdefault("candidates", [])
    m.setdefault("alias_hit", False)
    m.setdefault("tight", False)
    m.setdefault("pick", (m["candidates"] or [{}])[0])
    return {"mention": mention, "qty": qty, "unit": unit, "note": "", "match": m}


GOLDEN = [C("F-1020", "MANZANA GOLDEN 20 - 4/5 PZAS KG", 0.51, 2.10),
          C("F-1026", "MANZANA GOLDEN 26 - 7/8 PZAS KG", 0.47, 2.35)]
PERA = [C("F-2018", "PERA CONFERENCIA 18/20", 0.50, 1.80),
        C("F-2026", "PERA CONFERENCIA 26/28", 0.46, 1.95)]
CHERRY = [C("F-3001", "T.CHERRY ROJO GRANEL", 0.49, 3.10),
          C("F-3002", "T.CHERRY ROJO 250 GR BDJA", 0.45, 3.40)]

CTX = {"profile_text": "Bar Lumbre — pide los martes y los viernes."}


def synth_of(lines):
    return {"is_order": True, "grounded_lines": lines, "order_note": ""}


def classify(lines, **kw):
    """The faculty exactly as `pipeline.classify_doubt` calls it — through `doubt_lines`, so the price
    projection this wire adds is inside every check rather than beside it."""
    return doubt.classify(pipeline.doubt_lines(lines), **kw)


# ── W1 · a clean order costs the prompt nothing ────────────────────────────────────────────────
clean = [L("paleta cocida", match_pick=None, band="clean",
           candidates=[C("E-77", "PALETA COCIDA 3KG", 0.81, 8.9)])]
v_clean = classify(clean)
check("W1 clean order: nothing doubted", not v_clean["ask"] and not v_clean["flagged"])
check("W1 clean order: EMPTY note", doubt.doubt_note(v_clean) == "",
      repr(doubt.doubt_note(v_clean))[:120])
check("W1 clean order: nothing parked", pipeline.park_reason(v_clean) is None)
u_clean = decision.build_user(CTX, synth_of(clean), [{}], v_clean)
u_none = decision.build_user(CTX, synth_of(clean), [{}], None)
check("W1 clean prompt is byte-identical to the pre-wire prompt", u_clean == u_none)
check("W1 clean prompt carries no DUDA block", "DUDA" not in u_clean)

# ── W2 · one ambiguous line ⇒ ONE question, TWO real rows + the escape ─────────────────────────
amb = [L("manzana golden", qty=20, tight=True, candidates=GOLDEN)]
v_amb = classify(amb)
check("W2 exactly one question", len(v_amb["ask"]) == 1, str(len(v_amb["ask"])))
entry = v_amb["ask"][0]
check("W2 it is the calibre question, not 'which product'", entry["kind"] == doubt.DIMENSIONLESS,
      str(entry["kind"]))
check("W2 exactly two candidates (Meta's 3-button cap minus the escape)",
      len(entry["candidates"]) == 2)
opts = pipeline.build_options(entry)
check("W2 three rows go out: two candidates + the escape", len(opts) == 3, str(len(opts)))
check("W2 the escape row is present", opts[-1]["id"] == pipeline.ESCAPE_ID
      and opts[-1]["title"] == "Ninguno, te digo")
check("W2 option ids encode the REAL catalogue sku_ids",
      [o["id"] for o in opts[:2]] == ["sku:F-1020", "sku:F-1026"], str([o["id"] for o in opts[:2]]))
check("W2 the shared product name is stripped so the CALIBRE is the choice",
      [o["title"] for o in opts[:2]] == ["20 - 4/5 PZAS KG", "26 - 7/8 PZAS KG"],
      str([o["title"] for o in opts[:2]]))
check("W2 every title fits Meta's button limit (so it goes out as buttons)",
      all(len(o["title"]) <= 20 for o in opts) and not any("description" in o for o in opts))
check("W2 the money at risk was actually measured (price threaded off match.pick)",
      v_amb["lines"][0]["value"] > 0, str(v_amb["lines"][0]["value"]))

# ── W3 · the budget ───────────────────────────────────────────────────────────────────────────
three = [L("manzana golden", qty=20, tight=True, candidates=GOLDEN),
         L("pera conferencia", qty=8, tight=True, candidates=PERA),
         L("cherry", qty=2, tight=True, candidates=CHERRY)]
v3 = classify(three)
check("W3 three doubts, ONE question", len(v3["ask"]) == doubt.QUESTION_BUDGET, str(len(v3["ask"])))
check("W3 the other two are flagged, not dropped", len(v3["flagged"]) == 2, str(len(v3["flagged"])))
check("W3 the money decides which one is worth the question",
      v3["ask"][0]["mention"] == "manzana golden", str(v3["ask"][0]["mention"]))
note3 = doubt.doubt_note(v3)
check("W3 the note tells the mind the budget is spent",
      "Máximo UNA pregunta" in note3 and "ya se gastó la pregunta" in note3)

# ── W4 · UNKNOWN is the comercial's, never the customer's ─────────────────────────────────────
v_unk = classify([L("el jamoncito", band="unsure", candidates=[])])
check("W4 unknown is never asked of the customer", not v_unk["ask"])
check("W4 unknown goes to the comercial",
      v_unk["lines"][0]["direction"] == doubt.COMERCIAL
      and v_unk["lines"][0]["kind"] == doubt.UNKNOWN)
r_unk = pipeline.park_reason(v_unk)
check("W4 it parks with ONE reason", isinstance(r_unk, str) and "\n" not in (r_unk or ""))
check("W4 the reason blames our catalogue, not the customer",
      "hueco nuestro" in (r_unk or "") and "jamoncito" in (r_unk or ""), repr(r_unk))

# ── W5 · an ungrounded tenant ─────────────────────────────────────────────────────────────────
v_ung = classify([L("paleta cocida", band="unsure", candidates=[]),
                  L("pollo entero", band="unsure", candidates=[])], grounded=False)
check("W5 ungrounded asks the customer nothing", not v_ung["ask"] and v_ung.get("ungrounded"))
r_ung = pipeline.park_reason(v_ung)
check("W5 ONE reason for the whole order, not one per line",
      isinstance(r_ung, str) and "sin catálogo cargado" in r_ung and "\n" not in r_ung, repr(r_ung))
check("W5 the note tells the mind WE are the ones missing something",
      "no él" in doubt.doubt_note(v_ung))

# ── W6 · a taught alias never comes back ──────────────────────────────────────────────────────
v_alias = classify([L("jamón york", alias_hit=True, tight=True,
                      candidates=[C("E-77", "PALETA COCIDA 3KG", 0.9, 8.9),
                                  C("E-78", "PALETA COCIDA 1KG", 0.88, 3.4)])])
check("W6 alias_hit is silent", not v_alias["ask"] and not v_alias["flagged"])
check("W6 alias_hit adds no prompt noise either", doubt.doubt_note(v_alias) == "")

# ── W7 · asked once and ignored ⇒ never again ─────────────────────────────────────────────────
v_asked = classify(amb, asked_aliases={"manzana golden"})
check("W7 an ignored question is not repeated", not v_asked["ask"])
check("W7 the line is still flagged, not silently guessed", len(v_asked["flagged"]) == 1)
check("W7 no fresh FLAG park — §5.8's timeout already owns the silence",
      pipeline.park_reason(v_asked) is None, repr(pipeline.park_reason(v_asked)))

# ── W8 · dirty audio ──────────────────────────────────────────────────────────────────────────
DIRTY = {"level": "dirty", "review": True, "reason": "audio poco fiable", "avg": 0.44}
v_dirty = classify(amb, audio=DIRTY)
check("W8 dirty audio asks nothing", not v_dirty["ask"])
check("W8 dirty audio routes to the human", v_dirty["review"] is True)
r_dirty = pipeline.park_reason(v_dirty)
check("W8 with the audio as the ONE reason",
      isinstance(r_dirty, str) and "audio poco fiable" in r_dirty, repr(r_dirty))
# and the verdict has to actually REACH the pipeline: the confidence blob lives on transcript_meta
burst = [{"message_type": "text", "message_text": "ponme lo de siempre", "transcript_meta": {}},
         {"message_type": "audio", "transcript": "manzana golden",
          "transcript_meta": {"confidence": DIRTY}}]
check("W8 the burst's audio verdict is read off transcript_meta (it used to be dropped)",
      (pipeline.audio_verdict(burst) or {}).get("review") is True)
check("W8 worst wins across a burst — a clean text does not launder a dirty voice note",
      (pipeline.audio_verdict(list(reversed(burst))) or {}).get("review") is True)
check("W8 a burst with no audio has no audio verdict",
      pipeline.audio_verdict([{"message_type": "text", "transcript_meta": {}}]) is None)
# …and the gate must not be INFERRED. "reviewed but asked nothing" is also what an order looks like
# when its one customer-facing doubt was already asked once and another line is the comercial's —
# clean audio throughout. Inferring the gate from that shape told the comercial «audio poco fiable»
# about a voice note that was fine, and ranked it above a real shortfall. The gate declares itself.
v_quiet = classify([L("manzana golden", qty=6, price=1.2, tight=True, candidates=GOLDEN),
                    L("burrata", band="unsure", candidates=[])],
                   asked_aliases={"manzana golden"})
check("W8 that shape happens with NO audio at all",
      not v_quiet["ask"] and v_quiet["review"] is True and not v_quiet.get("audio"))
r_quiet = pipeline.park_reason(v_quiet)
check("W8 …and it is NOT reported as an audio problem",
      "audio" not in (r_quiet or ""), repr(r_quiet))
check("W8 …it is the catalogue hole, which is what actually happened",
      "hueco nuestro" in (r_quiet or "") and "burrata" in (r_quiet or ""), repr(r_quiet))

# ── W9 · the note is injected BEFORE the mind reasons ─────────────────────────────────────────
u_amb = decision.build_user(CTX, synth_of(amb), [{}], v_amb)
i_note, i_line = u_amb.find("DUDA"), u_amb.find("LINE 0")
check("W9 the DUDA block is in the prompt", i_note >= 0)
check("W9 it sits ABOVE the evidence it is about", 0 <= i_note < i_line, f"{i_note} vs {i_line}")
check("W9 it carries the real catalogue options, not a paraphrase",
      "MANZANA GOLDEN 20 - 4/5 PZAS KG" in u_amb and "Ninguno, te digo" in u_amb)
check("W9 it forbids «apuntado» before the tap",
      "no digas «listo» ni «apuntado»" in u_amb)
check("W9 the tool has somewhere to put the sentence",
      "pregunta" in prompts.DECISION_TOOL["input_schema"]["properties"])
check("W9 the system prompt no longer claims it never asks",
      "NEVER ask the customer a question" not in prompts.DECISION_SYSTEM)


# the mind writes the sentence — stub it, and prove the faculty still owns the DECISION to ask
def _stub_llm(reply):
    async def _call(*a, **k):
        _stub_llm.seen_user = a[2] if len(a) > 2 else k.get("user", "")
        return reply
    return _call


_orig_call = llm.call_tool
try:
    llm.call_tool = _stub_llm({"lines": [{"index": 0, "sku_id": "F-1020", "qty": 20}],
                               "pregunta": "A ver que no la líe: ¿la golden del 20 o la del 26?"})
    d_amb = asyncio.run(decision.decide(CTX, synth_of(amb), [{}], doubt_verdict=v_amb))
    check("W9 the mind's sentence survives when the faculty opened the door",
          d_amb.get("pregunta", "").startswith("A ver"))
    check("W9 the prompt the model actually received carried the note",
          "DUDA" in getattr(_stub_llm, "seen_user", ""))
    # the hallucination guard: a question on an order with no askable doubt is dropped
    llm.call_tool = _stub_llm({"lines": [{"index": 0, "sku_id": "E-77", "qty": 3}],
                               "pregunta": "¿te pongo también pan?"})
    d_clean = asyncio.run(decision.decide(CTX, synth_of(clean), [{}], doubt_verdict=v_clean))
    check("W9 a question the faculty never authorised never reaches the customer",
          d_clean.get("pregunta", "") == "", repr(d_clean.get("pregunta")))
    # no model at all ⇒ the question STILL goes out, in character
    llm.call_tool = None

    async def _boom(*a, **k):
        raise RuntimeError("model down")
    llm.call_tool = _boom
    d_down = asyncio.run(decision.decide(CTX, synth_of(amb), [{}], doubt_verdict=v_amb))
    check("W9 model down: the order is still filed from the matcher's pick",
          d_down["lines"][0]["sku_id"] == "F-1020")
    fq = decision.fallback_question(v_amb["ask"][0])
    check("W9 model down: the question still has an in-character sentence",
          "manzana golden" in fq and "apuntado" not in fq and "listo" not in fq, repr(fq))
finally:
    llm.call_tool = _orig_call


# ── W10 · the tap writes the alias, and the alias silences the next order ─────────────────────
ASKED_PAYLOAD = {
    "mention": "manzana golden", "kind": doubt.DIMENSIONLESS, "ask_key": "wamid.ASKED1",
    "options": [{"id": "sku:F-1020", "title": "20 - 4/5 PZAS KG", "sku_id": "F-1020"},
                {"id": "sku:F-1026", "title": "26 - 7/8 PZAS KG", "sku_id": "F-1026"},
                {"id": "none", "title": "Ninguno, te digo", "sku_id": ""}],
}
check("W10 a tap on the id we minted resolves with no re-inference",
      pipeline.resolve_option(ASKED_PAYLOAD, option_id="sku:F-1026") == (True, "F-1026", "26 - 7/8 PZAS KG"))
check("W10 a rail with no id resolves off the option title",
      pipeline.resolve_option(ASKED_PAYLOAD, option_title="20 - 4/5 PZAS KG") == (True, "F-1020", "20 - 4/5 PZAS KG"))
check("W10 the escape row is an ANSWER that writes no alias",
      pipeline.resolve_option(ASKED_PAYLOAD, option_id="none") == (True, "", ""))
check("W10 an ordinary message is NOT an answer (no phantom refusals)",
      pipeline.resolve_option(ASKED_PAYLOAD, option_title="oye y mañana me traes el pan?")[0] is False)


class FakeCon:
    """Records SQL the way the DB-backed vitals fake their egress: enough to assert WHAT was written,
    nothing that pretends to be Postgres."""

    def __init__(self, exists=None):
        self.exists, self.sql = exists, []

    async def fetchval(self, q, *a):
        self.sql.append(("fetchval", " ".join(q.split()), a))
        return self.exists

    async def execute(self, q, *a):
        self.sql.append(("execute", " ".join(q.split()), a))


con = FakeCon(exists=None)
_, sku, name = pipeline.resolve_option(ASKED_PAYLOAD, option_id="sku:F-1026")
alias = matcher.normalize(ASKED_PAYLOAD["mention"])
asyncio.run(brain_learn._write_alias(con, "rocoto", alias, sku, "+34600111222"))
wrote = [s for s in con.sql if s[0] == "execute"]
check("W10 the tap writes exactly one sku_aliases row", len(wrote) == 1, str(len(wrote)))
check("W10 into sku_aliases, customer-scoped",
      "insert into sku_aliases" in wrote[0][1] and wrote[0][2][3] == "+34600111222", str(wrote[0][2]))
check("W10 with the NORMALISED mention and the chosen sku",
      wrote[0][2][1] == "manzana golden" and wrote[0][2][2] == "F-1026", str(wrote[0][2][:3]))

con2 = FakeCon(exists=1)   # the same customer confirms it again
asyncio.run(brain_learn._write_alias(con2, "rocoto", alias, sku, "+34600111222"))
check("W10 a repeat tap bumps weight instead of duplicating",
      any("set weight=weight+1" in s[1] for s in con2.sql if s[0] == "execute"))

# and the promise that makes the friction self-extinguishing: with that row, the matcher reports
# alias_hit, and the faculty says nothing at all about the same words on the next order.
v_next = classify([L("manzana golden", qty=20, alias_hit=True, tight=True, candidates=GOLDEN)])
check("W10 the SAME mention is resolved next time, with no question",
      not v_next["ask"] and not v_next["flagged"] and v_next["lines"][0]["kind"] is None)
check("W10 and adds no prompt noise", doubt.doubt_note(v_next) == "")

# ── W11 · ⑥ THE ONE PARK — four reasons arrive, ONE goes in front of the comercial ─────────────
# The integration (2026-07-26, SPEC §5.8/§5.8a). Doubt is no longer the only thing that can hold an
# order: stock, the delivery range and the order-level norm run over the same order. §5.8a's tone law
# says a review carries ONE reason, so this asserts the arbitration itself — the precedence, the
# source mapping, and that the sentence is the OWNING MODULE'S, not one this seam re-wrote.
import review as review_mod  # noqa: E402
from brain import range as rng_mod  # noqa: E402
from brain import stock as stock_mod  # noqa: E402
from brain import validators as val_mod  # noqa: E402

SHORT = {"sku_id": "E-77", "name": "PALETA COCIDA", "have": 4.0, "want": 12.0, "unit": "kg"}
V_STOCK = {"ok": False, "inventory": True, "short": [SHORT],
           "reason": stock_mod.short_reason(SHORT)}
V_STOCK_OK = {"ok": True, "inventory": True, "short": [], "reason": ""}
V_RANGE_OUT = {"known": True, "servable": False, "distance_km": 34.2,
               "reason": rng_mod.distance_reason(34.2)}
V_RANGE_IN = {"known": True, "servable": True, "distance_km": 5.1, "reason": ""}
V_RANGE_UNKNOWN = {"known": False, "servable": True, "distance_km": None, "reason": ""}
NORM_BIG = {"value_off_norm": True, "ratio": 4.1,
            "reason": "pedido muy grande para este cliente: ~4× lo que suele pedir"}
NORM_OK = {"value_off_norm": False, "ratio": 1.1, "reason": ""}

check("W11 a clean order on every check parks NOTHING",
      pipeline.park_decision(doubt_verdict=v_clean, stock_verdict=V_STOCK_OK,
                             range_verdict=V_RANGE_IN, order_norm=NORM_OK) is None)

p_stock = pipeline.park_decision(stock_verdict=V_STOCK, range_verdict=V_RANGE_IN, order_norm=NORM_OK)
check("W11 a shortfall is the ONLY source that is not a FLAG — it is low_stock",
      p_stock["source"] == review_mod.LOW_STOCK, str(p_stock))
check("W11 …with brain/stock's own sentence, verbatim, naming ONE item",
      p_stock["reason"] == stock_mod.short_reason(SHORT) and "\n" not in p_stock["reason"]
      and "PALETA COCIDA" in p_stock["reason"], repr(p_stock["reason"]))

p_range = pipeline.park_decision(stock_verdict=V_STOCK, range_verdict=V_RANGE_OUT,
                                 order_norm=NORM_BIG, doubt_verdict=v_unk)
check("W11 OUT OF RANGE outranks stock, size and doubt — if the van does not go, nothing else matters",
      p_range["cause"] == "range" and p_range["source"] == review_mod.FLAG, str(p_range))
check("W11 …and it says DISTANCE and nothing else (never a zone, never «no vamos ahí»)",
      p_range["reason"] == rng_mod.distance_reason(34.2)
      and "zona" not in p_range["reason"] and "~34 km" in p_range["reason"],
      repr(p_range["reason"]))

check("W11 UNGROUNDED outranks even the range — every other check ran against no catalogue",
      pipeline.park_decision(doubt_verdict=v_ung, stock_verdict=V_STOCK,
                             range_verdict=V_RANGE_OUT, order_norm=NORM_BIG)["cause"] == "doubt")
check("W11 DIRTY AUDIO outranks stock — a shortfall computed from words we distrust is noise",
      pipeline.park_decision(doubt_verdict=v_dirty, stock_verdict=V_STOCK,
                             range_verdict=V_RANGE_IN, order_norm=NORM_BIG)["cause"] == "doubt")
check("W11 …but only REAL dirty audio does: the same shape with clean audio ranks as UNKNOWN, "
      "so a shortfall we can actually prove still wins",
      pipeline.park_decision(doubt_verdict=v_quiet, stock_verdict=V_STOCK,
                             range_verdict=V_RANGE_IN, order_norm=NORM_BIG)["cause"] == "stock")
check("W11 STOCK (a fact) outranks TOO BIG (a judgement) and CONFLICT",
      pipeline.park_decision(stock_verdict=V_STOCK, range_verdict=V_RANGE_IN,
                             order_norm=NORM_BIG)["cause"] == "stock")

p_big = pipeline.park_decision(stock_verdict=V_STOCK_OK, range_verdict=V_RANGE_UNKNOWN,
                               order_norm=NORM_BIG)
check("W11 on a healthy order the order-level norm is the reason, as a FLAG",
      p_big["cause"] == "order_value" and p_big["source"] == review_mod.FLAG, str(p_big))
check("W11 …with validators' own sentence — «~4× lo que suele pedir»",
      p_big["reason"] == NORM_BIG["reason"] and "\n" not in p_big["reason"])

check("W11 an UNKNOWN range claims nothing — no range, no rule, no park",
      pipeline.park_decision(stock_verdict=V_STOCK_OK, range_verdict=V_RANGE_UNKNOWN,
                             order_norm=NORM_OK) is None)
check("W11 inventory OFF can never make an order short, whatever the levels say",
      pipeline.park_decision(stock_verdict={"ok": False, "inventory": False, "short": [SHORT],
                                            "reason": "x"}, range_verdict=V_RANGE_IN,
                             order_norm=NORM_OK) is None)
check("W11 every source it can emit is inside §5.8's closed set",
      all(pipeline.park_decision(**kw)["source"] in review_mod.SOURCES for kw in (
          {"stock_verdict": V_STOCK}, {"range_verdict": V_RANGE_OUT},
          {"order_norm": NORM_BIG}, {"doubt_verdict": v_unk})))
_all4 = pipeline.park_decision(doubt_verdict=v_unk, stock_verdict=V_STOCK,
                               range_verdict=V_RANGE_OUT, order_norm=NORM_BIG)
check("W11 ONE reason, never a list — all four fire, ONE sentence comes out and the losers are silent",
      isinstance(_all4["reason"], str) and "\n" not in _all4["reason"]
      and " · " not in _all4["reason"] and ";" not in _all4["reason"]
      and not any(s in _all4["reason"] for s in (stock_mod.short_reason(SHORT), NORM_BIG["reason"],
                                                 "hueco nuestro")),
      repr(_all4["reason"]))
# the norm the park stands on is the module's, not a number invented here
check("W11 the order-level band is one-sided and >3× (validators owns it, this only reads it)",
      val_mod.ORDER_VALUE_HIGH == 3.0 and val_mod.ORDER_VALUE_MIN_N == 3)
# and the queue can still say why, in one line, for a source that carries a specific sentence
_row = review_mod.annotate({"kind": "review", "payload": {"review_source": review_mod.LOW_STOCK,
                                                          "text": p_stock["reason"]}})
check("W11 review_list answers «why is this in front of me?» with the WRITER's one line",
      _row["review_source"] == review_mod.LOW_STOCK and _row["why"] == p_stock["reason"]
      and _row["why_kind"] == review_mod.WHY[review_mod.LOW_STOCK], str(_row.get("why"))[:80])
# …and when the WRITER left no sentence, the row still names its own matter rather than the drawer
# it sits in (2026-07-27: `annotate` gained the middle tier — see review.KIND_WHY. Before it, a
# failed WhatsApp and a price concession both read «hace falta tu visto bueno antes de prometer nada»).
_bare = review_mod.annotate({"kind": "place_order", "payload": {}})
check("W11 …and a writer with no sentence still gets the KIND's own line, never the category",
      _bare["review_source"] == review_mod.FLAG
      and _bare["why"] == review_mod.KIND_WHY["place_order"]
      and _bare["why"] != review_mod.WHY[review_mod.FLAG]
      and _bare["why_kind"] == review_mod.WHY[review_mod.FLAG], str(_bare.get("why"))[:80])
_unknown = review_mod.annotate({"kind": "no_clasificado", "payload": {}})
check("W11 …and ONLY an unclassified kind falls all the way through to the category line",
      _unknown["why"] == review_mod.WHY[review_mod.FLAG])

total = ok + len(fail)
print(f"vital_doubt_wire: {ok}/{total}")
for f in fail:
    print("  FAIL:", f)
sys.exit(1 if fail else 0)
