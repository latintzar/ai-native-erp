"""test_receipt_wired.py — a module with no caller is a feature that does not exist.

`order_receipt.py` was written complete — compose, buttons, card, the «recibido» sentence taken
from market_voice's own constant — and NOTHING CALLED IT. So the confirmation Peter reported
missing was still missing after it was «built»:

    «no enviaron la confirmación. La misma experiencia que personas tienen en whatsApp, con botones
     en mensajes para responder a cosas y con imágenes con confirmaciones de orden.»

That is the same species as a setting with no reader (`approve`), a column with no arithmetic
(`pack_factor`) and a wizard answer nobody reads (`program`). This test holds the wire.
"""
import ast
import os

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = open(os.path.join(HERE, "agent_reply.py")).read()


def test_the_receipt_is_sent_when_an_order_is_filed():
    """It belongs at the moment the order is FILED — that is when there is something true to
    acknowledge. Earlier would be a promise; later would be a different conversation."""
    i = SRC.index("orders_tool.place_order")
    window = SRC[i:i + 1800]
    assert "order_receipt" in window, "an order is filed and the customer is told nothing"
    assert "send_for_order" in window


def test_it_cannot_take_the_order_down_with_it():
    """A receipt that cannot go must leave the order exactly where it is — the comercial still has
    it on the sheet, which is the outcome that matters."""
    i = SRC.index("send_for_order")
    assert "except Exception" in SRC[i:i + 700], "the receipt send must be fail-soft"


def test_it_is_signed_by_the_supplier_not_by_us():
    """A receipt signed «rocoto» tells a restaurant they are dealing with a software company
    instead of their fishmonger."""
    assert "_business_name_for" in SRC
    fn = next(n for n in ast.walk(ast.parse(SRC))
              if isinstance(n, ast.AsyncFunctionDef) and n.name == "_business_name_for")
    body = ast.dump(fn)
    assert "tenants" in body and "name" in body
    assert "BRAND_NAME" not in body, "it must never fall back to our brand"


def test_the_acknowledgement_is_not_retyped():
    """`order_receipt` must take «Recibido» from market_voice's constant, not carry its own copy —
    two copies of Raquel's rule is how one of them drifts into «confirmado»."""
    rec = open(os.path.join(HERE, "order_receipt.py")).read()
    assert "market_voice" in rec, "the receipt must source the acknowledgement, not restate it"
