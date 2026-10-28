"""vital_doubt.py — the DOUBT FACULTY's load-bearing rules (SPEC §5.7a).

These are not unit tests of arithmetic; each one is a product promise that must not silently regress:
  1. a taught alias never asks again          (§5.7 — the friction is self-extinguishing)
  2. an out-of-catalogue mention never becomes a multiple choice to the customer
  3. dirty audio asks the customer NOTHING     (a choice built on a bad transcript is worse than silence)
  4. an off-normal quantity goes to the comercial, never to the customer
  5. the question BUDGET holds — three doubts do not become three questions
  6. a tight margin over the same product family reads as the CALIBRE question, not "which product"
  7. the note is EMPTY when nothing is doubted  (no prompt noise on a clean order)
  8. a mention we already asked and got silence on is not re-asked
  9. an ungrounded tenant is ONE state, not a pile of unknowns
 10. a tight margin across MORE than two rows is UNKNOWN — there is no honest 2-of-9 question
 11. THE CALIBRE IS NOT A QUANTITY: «salchichón vela 55» is the 55, and 20 sartas is still 20
Run: python3 tests/vital_doubt.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import doubt
from brain import matcher


def L(mention, qty=3, price=12.4, **m):
    return {"mention": mention, "qty": qty, "unit": "kg", "price": price, "match": m}

C = lambda name, score=.5: {"sku_id": name[:3], "name": name, "score": score}
ok, fail = 0, []
def check(name, cond):
    global ok
    if cond: ok += 1
    else: fail.append(name)

# 1 taught alias is silent
v = doubt.classify([L("jamón york", band="clean", alias_hit=True, candidates=[C("PALETA COCIDA")])])
check("1 alias_hit never asks", not v["ask"] and doubt.doubt_note(v) == "")

# 2 out of catalogue -> comercial, no customer question
v = doubt.classify([L("el jamoncito", band="unsure", candidates=[])])
check("2 unknown -> comercial", v["lines"][0]["kind"] == doubt.UNKNOWN
      and v["lines"][0]["direction"] == doubt.COMERCIAL and not v["ask"])

# 3 dirty audio -> ask nothing, route to review
v = doubt.classify([L("manzana golden", band="clean", tight=True, candidates=[C("MANZANA GOLDEN 20"), C("MANZANA GOLDEN 26")])],
                   audio={"review": True, "level": "dirty"})
check("3 dirty audio asks nothing", not v["ask"] and v["review"])

# 4 off-normal qty -> comercial
v = doubt.classify([L("solomillo", band="clean", candidates=[C("SOLOMILLO")])],
                   validators=[{"qty_off_norm": True, "typical_qty": 4}])
check("4 conflict -> comercial", v["lines"][0]["kind"] == doubt.CONFLICT
      and v["lines"][0]["direction"] == doubt.COMERCIAL and not v["ask"])

# 5 the budget: three tight lines, one question
three = [L("manzana golden", price=40, band="clean", tight=True, candidates=[C("MANZANA GOLDEN 20"), C("MANZANA GOLDEN 26")]),
         L("pera conferencia", price=30, band="clean", tight=True, candidates=[C("PERA CONFERENCIA 18/20"), C("PERA CONFERENCIA 26/28")]),
         L("cherry", price=20, band="clean", tight=True, candidates=[C("T.CHERRY ROJO GRANEL"), C("T.CHERRY ROJO 250 GR BDJA")])]
v = doubt.classify(three)
check("5 budget holds", len(v["ask"]) == doubt.QUESTION_BUDGET and len(v["flagged"]) == 2)
check("5 highest value asked", v["ask"][0]["mention"] == "manzana golden")

# 6 same family + tight -> the calibre question
v = doubt.classify([L("manzana golden", band="clean", tight=True,
                      candidates=[C("MANZANA GOLDEN 20 - 4/5 PZAS KG"), C("MANZANA GOLDEN 26 - 7/8 PZAS KG")])])
check("6 dimensionless not ambiguous", v["ask"][0]["kind"] == doubt.DIMENSIONLESS)
check("6 two candidates max (3-button cap)", len(v["ask"][0]["candidates"]) <= doubt.MAX_CANDIDATES)

# 7 clean order -> empty note
v = doubt.classify([L("paleta cocida", band="clean", candidates=[C("PALETA COCIDA 3KG", .8)])])
check("7 clean note empty", doubt.doubt_note(v) == "")

# 8 asked once, ignored -> not re-asked
v = doubt.classify([L("manzana golden", band="clean", tight=True,
                      candidates=[C("MANZANA GOLDEN 20"), C("MANZANA GOLDEN 26")])],
                   asked_aliases={"manzana golden"})
check("8 silence is not an invitation to repeat", not v["ask"])

# 9 ungrounded tenant: accept + comercial, ask the customer NOTHING
v = doubt.classify([L("paleta cocida", band="unsure", candidates=[]),
                    L("pollo entero", band="unsure", candidates=[])], grounded=False)
check("9 ungrounded asks nothing", not v["ask"] and v["review"] and v.get("ungrounded"))
check("9 ungrounded is ONE reason not N unknowns",
      all(l["kind"] == doubt.UNGROUNDED for l in v["lines"]))
note = doubt.doubt_note(v)
check("9 ungrounded note tells the mind it is OUR gap", "no él" in note and "comercial" in note)

# 10 THE WIDE TIE — the law the module docstring and §5.7a both state, and that `classify_line` had
# no branch for until 2026-07-27. Both of the seed's own `two_candidate:false` mentions («lomo» ties
# across 4 rows, «chorizo para asar» across 9) came back AMBIGUOUS, i.e. the customer was offered two
# options out of nine. Two of nine is worse than silence, because it looks confident.
wide = [C("CHORIZO FRESCO SARTA", .61), C("CHORIZO CRIOLLO PARRILLA", .60),
        C("CHORIZO SARTA EXTRA 500 G", .58), C("CHORIZO IBERICO BELLOTA PIEZA", .55)]
v = doubt.classify([L("chorizo para asar", band="clean", tight=True, candidates=wide)])
check("10 a tie across four rows is UNKNOWN, not ambiguous", v["lines"][0]["kind"] == doubt.UNKNOWN)
check("10 …the comercial's, and the customer is asked nothing",
      v["lines"][0]["direction"] == doubt.COMERCIAL and not v["ask"])
check("10 …and it says WHY it could not be reduced to two",
      "empate" in v["lines"][0]["reason"] and "4" in v["lines"][0]["reason"])

# 11 …and the law must not eat the feature it exists to protect: exactly two close rows is still the
# real multiple choice, however many distant rows sit behind them.
two = [C("MORCILLA BURGOS ARROZ 400 G", .61), C("MORCILLA CEBOLLA HERRADURA", .60),
       C("CHORIZO FRESCO SARTA", .20)]
v = doubt.classify([L("morcilla", band="clean", tight=True, candidates=two)])
check("11 two close rows + a distant third is still a real question",
      v["lines"][0]["kind"] == doubt.AMBIGUOUS and len(v["ask"][0]["candidates"]) == 2)

# 12 the MATCHER's count wins: `as_dict()` truncates candidates to five, so a nine-row tie is
# invisible to anything that recounts them downstream.
v = doubt.classify([L("lomo", band="clean", tight=True, n_close=4,
                      candidates=[C("LOMO EMBUCHADO CANA 900 G", .60),
                                  C("LOMO ADOBADO PIEZA", .59)])])
check("12 n_close from the matcher outranks the visible top-5", v["lines"][0]["kind"] == doubt.UNKNOWN)

# ── 13 THE CALIBRE IS NOT A QUANTITY (matcher's pure halves — no DB, no model) ──────────────────
# §5.7: "CALIBRE IS THE HIDDEN DIMENSION… Match the product NAME first, then ask the calibre." The
# measured defect: «SALCHICHÓN VELA 55» resolved to SALCHICHÓN VELA 40 MM, band=clean, score 1.0,
# because every bare digit was stripped as a quantity and the remainder hit the family alias.
check("13 a trailing number QUALIFIES the product", matcher.dims_of("salchichón vela 55") == {"55"})
check("13 …after «del» too", matcher.dims_of("salchichón del 55") == {"55"})
check("13 …and after «de»", matcher.dims_of("fuet de 170") == {"170"})
check("13 a LEADING number is a quantity — «20 sartas de chorizo» orders 20",
      matcher.dims_of("20 sartas de chorizo") == set()
      and matcher.item_form("20 sartas de chorizo") == "sartas de chorizo")
check("13 …and «10 kg de chorizo» leaves just the product",
      matcher.dims_of("10 kg de chorizo") == set() and matcher.item_form("10 kg de chorizo") == "chorizo")
check("13 a mention that is ONLY a number keeps it (nothing to be a quantity OF)",
      matcher.item_form("del 55") == "del 55")

# the catalogue — not a word list — decides that a number is a calibre here
CAT = [{"id": "sku-salchichon-vela-40", "name": "SALCHICHÓN VELA 40 MM"},
       {"id": "sku-salchichon-vela-55", "name": "SALCHICHÓN VELA 55 MM"},
       {"id": "sku-morcilla-burgos", "name": "MORCILLA BURGOS ARROZ 400 G"},
       {"id": "sku-morcilla-cebolla", "name": "MORCILLA CEBOLLA HERRADURA"}]
IDX = matcher.build_dimension_index(CAT)
check("13 only rows that differ ONLY by a number form a dimensioned family",
      IDX["dimensioned"] == {"salchichon vela mm"})
check("13 the calibre the customer said picks the sibling that carries it",
      matcher.reconcile_dimension(IDX, "sku-salchichon-vela-40", {"55"})[0] == "sku-salchichon-vela-55")
check("13 no calibre in the mention changes nothing",
      matcher.reconcile_dimension(IDX, "sku-salchichon-vela-40", set())[0] == "sku-salchichon-vela-40")
check("13 a number in a family the catalogue does NOT separate by number decides nothing",
      matcher.reconcile_dimension(IDX, "sku-morcilla-burgos", {"12"})[0] == "sku-morcilla-burgos")
check("13 a calibre this house does not carry is NOT resolved silently — it goes to the faculty",
      matcher.reconcile_dimension(IDX, "sku-salchichon-vela-40", {"30"})[0] is None)

# ── 14 THE CALIBRE NOBODY NAMED — the other half of the same law ───────────────────────────────
# «velas» resolved SILENTLY to SALCHICHON VELA 40 MM at margin 0.418: the reranker was confident
# about the PRODUCT, and the product was never what was in doubt. §5.7's headline case.
check("14 a bare family word names no calibre",
      matcher.named_nothing(IDX, "sku-salchichon-vela-40", "velas"))
check("14 …but «del 55» does", not matcher.named_nothing(IDX, "sku-salchichon-vela-40", "salchichon del 55"))
check("14 …and so does a word the catalogue itself uses to tell them apart",
      not matcher.named_nothing(IDX, "sku-salchichon-vela-40", "salchichon vela fino"))
check("14 a family the catalogue does NOT separate by number is never forced to ask",
      not matcher.named_nothing(IDX, "sku-morcilla-burgos", "morcilla"))

total = ok + len(fail)
print(f"vital_doubt: {ok}/{total}")
for f in fail: print("  FAIL:", f)
sys.exit(1 if fail else 0)
