"""test_business_day.py — «cuando voy a imprimir no lo tengo, me vuelvo loca».

Raquel serves until 21:30 and buys at the market at midnight. At 00:30 her working day has not
turned over: «hoy» is still the day she has been working, so «mañana» is the day she delivers. The
calendar disagrees by one, and the order lands on a day she is not printing — so it never reaches
the van.
"""
import ast
import os
from datetime import datetime
from zoneinfo import ZoneInfo

import business_day as b

MADRID = ZoneInfo("Europe/Madrid")
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _at(day: int, hh: int, mm: int = 0) -> datetime:
    return datetime(2026, 8, day, hh, mm, tzinfo=MADRID)


# ── THE bug, in her own hours ─────────────────────────────────────────────────────────────────────
def test_after_midnight_is_still_the_working_day_before():
    """00:30 on the 20th, at the market. Her «hoy» is the 19th, so «mañana» is the 20th."""
    assert b.today(_at(20, 0, 30)).isoformat() == "2026-08-19"


def test_the_evening_and_the_small_hours_are_the_same_working_day():
    """21:30 serving and 00:30 buying are one shift, and must file to one day."""
    assert b.today(_at(19, 21, 30)) == b.today(_at(20, 0, 30))


def test_the_day_turns_at_the_boundary_and_not_before():
    assert b.today(_at(20, 5, 59)).isoformat() == "2026-08-19"
    assert b.today(_at(20, 6, 0)).isoformat() == "2026-08-20"


def test_a_normal_working_hour_is_unremarkable():
    assert b.today(_at(19, 11, 0)).isoformat() == "2026-08-19"


def test_the_boundary_is_configurable_because_trades_differ():
    """A wholesaler starting at 05:00 has a different night from one starting at 09:00."""
    assert b.today(_at(20, 4, 0), rollover_hour=3).isoformat() == "2026-08-20"
    assert b.today(_at(20, 4, 0), rollover_hour=8).isoformat() == "2026-08-19"


# ── the settings, which must never move everybody's orders by a day ───────────────────────────────
def test_settings_fall_back_rather_than_raise():
    for bad in [None, {}, {"tz": "Mars/Olympus"}, {"rollover_hour": "x"}, {"rollover_hour": 99}]:
        cfg = b.parse_settings(bad)
        assert cfg["tz"] and 0 <= cfg["rollover_hour"] <= 12


def test_an_afternoon_rollover_is_refused():
    """Past midday it is a shift, not a day boundary — accepting it would file every afternoon
    order on yesterday."""
    assert b.parse_settings({"rollover_hour": 15})["rollover_hour"] == b.DEFAULT_ROLLOVER_HOUR


# ── the wiring ────────────────────────────────────────────────────────────────────────────────────
def test_the_extractor_resolves_against_the_business_day():
    """`_date_context` is what tells the model what «hoy» is. If it hands over the calendar date,
    the bug is back and nothing else in this file matters."""
    src = open(os.path.join(HERE, "orders.py")).read()
    fn = next(n for n in ast.walk(ast.parse(src))
              if isinstance(n, ast.FunctionDef) and n.name == "_date_context")
    body = ast.dump(fn)
    assert "business_day" in body, "_date_context must resolve against the business day"
    # and it must not reach for the wall clock itself — checked as a CALL, not a substring
    # (the first version of this matched the "now" inside "knows", which is how a test earns
    # distrust rather than confidence)
    calls = [n for n in ast.walk(fn) if isinstance(n, ast.Call)
             and getattr(n.func, "attr", None) == "now"]
    assert not calls, "_date_context must not call datetime.now — the business day owns that"
