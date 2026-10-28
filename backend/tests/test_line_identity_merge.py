"""test_line_identity_merge.py — a desk edit must not lobotomise the line it touches.

Found by the 2026-08-19 dimension audit: the desk's save sends {item, qty, unit, price} per line
(api/client.ts) and `line_set` stored that verbatim — so correcting a QUANTITY destroyed the line's
`sku`, `code`, `band`, `mention` and `variable_weight`. One touched line, and the order forgot it
needed weighing before billing. Nobody sees this happen: the edit LOOKS successful, and the loss
only surfaces when the albarán bills an estimate as a final number.
"""
from brain.events import _merge_line_identities as merge

BEFORE = [{
    "sku": "sku-md-lubina", "code": "PES-LUB", "item": "LUBINA", "name": "LUBINA",
    "qty": 2.0, "price": 10.0, "unit": "caja",
    "variable_weight": True, "band": "clean", "mention": "la lubina de siempre",
    "line_total": 20.0,
}]


def test_a_quantity_edit_keeps_the_lines_identity():
    out = merge(BEFORE, [{"item": "LUBINA", "qty": 3, "unit": "caja", "price": 10}])[0]
    assert out["variable_weight"] is True
    assert out["sku"] == "sku-md-lubina" and out["code"] == "PES-LUB"
    assert out["mention"] == "la lubina de siempre", "the customer's own words survive the edit"


def test_the_total_is_recomputed_never_inherited():
    """A stale line_total from the pre-edit quantity is worse than none: it is a wrong number that
    looks authoritative."""
    out = merge(BEFORE, [{"item": "LUBINA", "qty": 3, "unit": "caja", "price": 10}])[0]
    assert out["line_total"] == 30.0


def test_a_name_only_edit_finds_a_sku_keyed_line():
    """THE asymmetry this exists for: the before-line's richest key is its sku, the edit carries
    only the name. The first cut indexed each line under one key and missed exactly this."""
    out = merge(BEFORE, [{"item": "lubina", "qty": 5, "unit": "caja", "price": 10}])[0]
    assert out["sku"] == "sku-md-lubina"


def test_a_genuinely_new_line_stays_new():
    out = merge(BEFORE, [{"item": "RODABALLO", "qty": 1, "unit": "kg", "price": 28}])
    # the rename fallback may hand it line 0's identity ONLY positionally; a two-line proof below
    # pins the dangerous case. Here: it must at least be the rodaballo the operator typed.
    assert out[0]["item"] == "RODABALLO"


def test_deleting_line_one_does_not_glue_its_identity_onto_line_two():
    """The positional fallback must not fire for a row another edit already claimed by key —
    otherwise deleting the first line hands its variable_weight to whatever comes next."""
    before = [
        {"sku": "a", "item": "A", "qty": 1, "price": 1, "variable_weight": True},
        {"sku": "b", "item": "B", "qty": 1, "price": 2},
    ]
    out = merge(before, [{"item": "B", "qty": 5, "unit": "kg", "price": 2}])[0]
    assert out["sku"] == "b"
    assert "variable_weight" not in out
