"""Gate: medusa_map purity + canon() identity (medusa-integration.md §12). No DB / no Medusa."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gatelib  # noqa: E402

gatelib.setup_env()
from brain import medusa_map  # noqa: E402
from identity_phone import canon  # noqa: E402


def test_canon_e164_region_es():
    cases = {
        "whatsapp:+34 611 11 11 02": "+34611111102",
        "611111102": "+34611111102",
        "0034611111102": "+34611111102",
        "+34611111102": "+34611111102",
    }
    for raw, exp in cases.items():
        assert canon(raw) == exp, (raw, canon(raw))
    assert canon("") == ""
    assert canon("not a phone") == "not a phone"  # never crashes an inbound


def test_payload_catalogue_line():
    o = {"id": "o1", "phone_number": "+34611111002", "customer_name": "Bar", "seeded": False,
         "lines": [{"sku_id": "sku-x", "item": "X", "qty": 4, "unit": "kg", "price": 8.5,
                    "medusa_variant_id": "variant_x", "confidence": "high"}]}
    p = medusa_map.build_create_order_payload(o)
    it = p["items"][0]
    assert it["variant_id"] == "variant_x" and it["quantity"] == 4 and it["unit_price"] == 8.5
    assert it["metadata"]["sancho_sku_id"] == "sku-x"
    assert p["status"] == "pending" and p["currency_code"] == "eur"
    assert p["metadata"]["sancho_order_id"] == "o1" and p["metadata"]["source"] == "whatsapp"


def test_payload_custom_and_variable_weight():
    o = {"id": "o2", "lines": [
        {"sku_id": "sku-ung", "item": "Mystery", "qty": 2, "price": 5.0},                 # ungrounded
        {"sku_id": "sku-ears", "item": "Pork ears", "qty": 3, "price": 4.5,
         "variable_weight": True, "medusa_variant_id": "v2"}]}                              # variable-weight
    p = medusa_map.build_create_order_payload(o)
    assert "variant_id" not in p["items"][0] and p["items"][0]["title"] == "Mystery"
    assert "variant_id" not in p["items"][1] and p["items"][1]["metadata"]["variable_weight"] is True


def test_reshape_order_to_dto():
    mo = {"id": "order_1", "status": "pending",
          "metadata": {"sancho_order_id": "o1", "phone": "+34611111002",
                       "customer_name": "Bar", "delivery_date": "2026-07-01"},
          "items": [{"title": "Chorizo", "quantity": 14, "unit_price": 12.0,
                     "metadata": {"unit": "kg", "note": "vac"}}]}
    dto = medusa_map.medusa_order_to_dto(mo, {"status": "approved", "source_message_ids": ["m1"]})
    assert dto["id"] == "o1" and dto["medusa_order_id"] == "order_1" and dto["status"] == "approved"
    assert dto["lines"][0]["qty"] == 14 and dto["lines"][0]["unit"] == "kg"


def test_reshape_order_to_excel():
    mo = {"id": "o", "metadata": {"phone": "+34611", "customer_name": "Bar", "delivery_date": "2026-07-01"},
          "items": [{"title": "Chorizo", "quantity": 14, "unit_price": 12.0, "metadata": {"unit": "kg"}},
                    {"title": "Ears", "quantity": 3, "unit_price": 4.5, "metadata": {"variable_weight": True}}]}
    xl = medusa_map.medusa_order_to_excel_dict(mo)
    assert xl["customer_name"] == "Bar" and xl["lines"][0]["item"] == "Chorizo"
    assert xl["lines"][0]["price"] == 12.0
    assert xl["lines"][1]["price"] is None  # variable-weight → blank Importe in build_excel
