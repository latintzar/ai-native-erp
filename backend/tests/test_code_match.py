"""§17.35 Stage 0 — exact-code matching, pure half. Deterministic: no DB, no embeddings.

The law under test (PRODUCT-SPEC §17.35 / audits/2026-08-04-seven-layers/offlist-sku.md B.3):
  0a — an exact code hit is an identity: beats any fuzzy name match.
  0d — a code-shaped token NOT in the tenant's list abstains loudly (never a plausible guess).
  0e — a purely numeric code shorter than 4 digits is a number, not a product — unless framed
       («el codigo 12»), where the framing word is the disambiguator.
  A numeric token followed by a unit word is a QUANTITY, never a code.
"""
from brain.matcher import build_code_index, code_scan

ROWS = [
    {"id": "sku-1204", "code": "1204"},
    {"id": "sku-1207x", "code": "F-1300"},
    {"id": "sku-12", "code": "12"},          # short numeric — indexed but never bare-matched
]
IDX = build_code_index(ROWS)


def test_exact_code_hit_wins():
    kind, sku, tok = code_scan(IDX, "40 de la 1204")
    assert (kind, sku, tok) == ("hit", "sku-1204", "1204")


def test_bare_code_hits():
    assert code_scan(IDX, "1204")[:2] == ("hit", "sku-1204")


def test_phrase_forms_hit():
    assert code_scan(IDX, "ponme 3 del 1204")[:2] == ("hit", "sku-1204")


def test_unknown_code_shaped_token_abstains_loudly():
    kind, sku, tok = code_scan(IDX, "40 de la 1207")
    assert kind == "abstain" and sku is None and tok == "1207"


def test_quantity_before_unit_is_not_a_code():
    # 1500 is 4-digit numeric (code-shaped length ≠ dominant? dominant length is 4 → shaped),
    # but it is followed by a unit word: it told us a quantity.
    assert code_scan(IDX, "1500 gramos de chorizo")[0] == "none"


def test_short_numeric_is_a_number_not_a_product():
    assert code_scan(IDX, "ponme 12 de chorizo")[0] == "none"


def test_short_numeric_matches_when_framed():
    kind, sku, tok = code_scan(IDX, "el codigo 12")
    assert (kind, sku) == ("hit", "sku-12")


def test_no_codes_no_stage():
    empty = build_code_index([{"id": "x", "code": None}])
    assert code_scan(empty, "40 de la 1204")[0] == "none"


def test_two_digit_quantity_never_abstains():
    # «40» alone must never trip 0d even in a code-quoting tenant.
    assert code_scan(IDX, "40 cajas de tomate")[0] == "none"


def test_index_shapes():
    assert IDX["has_codes"] is True
    assert 4 in IDX["numeric_lengths"]       # 1204 dominates the numeric population
    assert 2 not in IDX["numeric_lengths"]   # <4 digits is never code-shaped (0e)
