"""test_human_hold.py — the boss typing IS the takeover gesture.

Raquel, 2026-08-19: «que yo, como Raquel jefa, pueda meterme como humana a seguir entablando una
conversación… enderezar la conversación con él a nivel particular». The takeover VERB existed;
the natural gesture did not — she wrote, and Rocoto answered over her.

Structure-checked, because the wiring is inside the one outbound door and its failure mode is
Rocoto talking over a human, which no one reports as a bug — it reads as enthusiasm.
"""
import ast
import os

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = open(os.path.join(HERE, "actions.py")).read()


def _send_fn():
    return next(n for n in ast.walk(ast.parse(SRC))
                if isinstance(n, ast.AsyncFunctionDef) and n.name == "send_whatsapp_as_rocoto")


def test_a_boss_message_bumps_the_hold():
    """override=True — a human speaking through Rocoto — must extend human_hold_until."""
    body = ast.dump(_send_fn())
    assert "human_hold_until" in body
    assert "HUMAN_HOLD_MINUTES" in body, "the TTL must come from config, not a literal"


def test_a_held_reply_is_drafted_never_dropped():
    """While the hold stands, Rocoto's reply goes to gate.hold — the review sheet — not into a
    void. A silence with no trace is what would make the hold untrustworthy."""
    i = SRC.index('"origin": "human_hold"')
    window = SRC[i - 400:i + 100]
    assert ".hold(" in window
    assert "return None" in SRC[i:i + 300], "the held send must not fall through to the rail"


def test_expiry_is_the_handback():
    """The hold is a TTL comparison, not a flag someone must remember to clear — a forgotten
    takeover must not kill a thread forever."""
    assert "human_hold_until > now()" in SRC


def test_schema_carries_the_column_additively():
    sql = open(os.path.join(HERE, "schema_runtime.sql")).read()
    assert "add column if not exists human_hold_until" in sql
