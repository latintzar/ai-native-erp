"""test_workspace_ready.py — one fact, one derivation: «does this company have a catalogue?»

The bug this pins (reproduced live on prod, 2026-08-19): `demo_sessions.catalog_ready` is keyed by
TOKEN. The 2026-08-17 fix taught `session_view` to also ask whether the TENANT holds SKUs — but the
CHAT gate kept reading the raw column. So the UI showed a ready catalogue while every order was
refused with «primero sube tu lista»: Raquel's «las órdenes no estaban apareciendo», exactly.

A fact derived in two places will disagree eventually; these tests hold the merge together.
"""
import ast
import os

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = open(os.path.join(HERE, "demo_flow.py")).read()
TREE = ast.parse(SRC)


def _fn(name):
    return next(n for n in ast.walk(TREE)
                if isinstance(n, ast.AsyncFunctionDef) and n.name == name)


def test_the_chat_gate_asks_the_question_not_the_column():
    """THE bug. The gate that refuses an order must call workspace_ready — never read the raw
    per-token flag, which answers a different question («did THIS session finish an upload»)."""
    assert SRC.count("workspace_ready") >= 3, "the one derivation must exist and be used"
    # inside the gate that returns _NEEDS_CATALOG, the check must be workspace_ready
    i = SRC.index("_NEEDS_CATALOG, \"order\"") if "_NEEDS_CATALOG, \"order\"" in SRC else SRC.rindex("reply\": _NEEDS_CATALOG")
    window = SRC[i - 400:i]
    assert "workspace_ready" in window, "the refusal gate still reads the raw column"


def test_session_view_and_the_gate_share_one_derivation():
    """If either grows its own inline copy again, the UI and the mouth can disagree again."""
    view = ast.dump(_fn("session_view"))
    assert "workspace_ready" in view
    assert "catalogue_skus" not in view, "session_view grew its own inline probe back"


def test_the_refusal_names_what_to_do_not_what_it_cannot():
    """House rule (Peter, 2026-08-09: «NEVER GIVE NEGATIVES»). The old line spent its clause on
    «sin ella no puedo casar nada» — a sentence about the failure. The new one says what happens
    when they do it."""
    i = SRC.index("_NEEDS_CATALOG = ")
    line = SRC[i:SRC.index(")", i)]
    for negative in ("no puedo", "sin ella", "no hay"):
        assert negative not in line, f"the refusal copy carries the negative {negative!r}"
