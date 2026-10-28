"""test_ventas_arithmetic.py — the two silent money-losers from VENTAS-COVERAGE.md.

Both were invisible: the order looked right on screen and was wrong in the world.
"""
from brain.learn import _pair_lines
from brain.matcher import _unit_check

KG_CASE = {"base_unit": "kg", "pack_factor": 12, "variable_weight": False}


# ── «2 cajas de lubina» filed as 2 kg ─────────────────────────────────────────────────────────────
def test_the_unit_check_speaks_spanish():
    """It was English-only — {unit, units, ud, piece, pcs} — so «caja» matched nothing, the check
    returned CLEAN, and a 120 EUR case was filed, printed and exported as 24 EUR. Rocoto's own
    `_UNIT_WORDS` twenty lines away has carried these the whole time."""
    for word in ("caja", "cajas", "docena", "docenas", "bandeja", "bandejas", "pieza", "piezas",
                 "unidad", "unidades", "bolsa", "paquete"):
        clean, note = _unit_check(KG_CASE, word, 2)
        assert clean is False, f"«{word}» on a per-kg article must not pass as clean"
        assert note, f"«{word}» must say why"


def test_it_names_the_arithmetic_rather_than_waving():
    """«confirm weight» tells her to check something. This tells her WHAT: a case is pack_factor
    kilos. Nothing in the product multiplies that yet, so holding the line is the honest act."""
    _, note = _unit_check(KG_CASE, "caja", 2)
    assert "12" in note and "kg" in note


def test_ordering_in_kg_on_a_kg_article_is_still_clean():
    """The check must not become noise: the common case has to stay silent."""
    clean, _ = _unit_check(KG_CASE, "kg", 6)
    assert clean is True
    clean, _ = _unit_check(KG_CASE, "", 6)
    assert clean is True


# ── the alias corruption ──────────────────────────────────────────────────────────────────────────
def test_reordering_a_basket_teaches_nothing():
    """It diffed BY INDEX over two independently-built baskets. Reorder the lines — which a desk
    edit does routinely — and index 0 was «costillas» before and «merluza» after, so the customer's
    word for ribs became a permanent alias for hake, grounded on the matcher's FAST path. A
    learning system that learns the wrong thing is worse than one that learns nothing."""
    before = [{"sku_id": "ribs", "mention": "costillas"}, {"sku_id": "hake", "mention": "merluza"}]
    after = [{"sku_id": "hake", "mention": "merluza"}, {"sku_id": "ribs", "mention": "costillas"}]
    for b, a in _pair_lines(before, after):
        assert b["sku_id"] == a["sku_id"], "a reordered basket must pair by identity, not position"


def test_a_genuine_correction_is_still_learned():
    """The fix must not cost the feature: correcting which article the customer's words mean is
    exactly what this is for."""
    pairs = _pair_lines(
        [{"sku_id": "wrong", "mention": "la de cabeza"}],
        [{"sku_id": "right", "mention": "la de cabeza"}],
    )
    assert [(b["sku_id"], a["sku_id"]) for b, a in pairs] == [("wrong", "right")]


def test_deleting_a_line_does_not_marry_its_words_to_its_neighbour():
    """The positional fallback fires only where BOTH sides are unclaimed."""
    before = [{"sku_id": "a", "mention": "costillas"}, {"sku_id": "b", "mention": "merluza"}]
    after = [{"sku_id": "b", "mention": "merluza"}]
    pairs = _pair_lines(before, after)
    assert all(b["sku_id"] == a["sku_id"] for b, a in pairs), pairs
