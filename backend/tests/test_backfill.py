"""test_backfill.py — the history replay must be provably unable to speak to a real customer.

The parser is tested against Meta's documented payload shape, and the SAFETY properties are tested
against the module's own syntax tree rather than its prose. That distinction matters: a docstring
promising «we never call ingest_chat» is worth nothing, and an AST that contains no such call is a
proof. This is the file that should fail loudly if somebody later adds a convenience call that
happens to wake the mouth.
"""
import ast
import os

import backfill

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = open(os.path.join(HERE, "backfill.py")).read()


# ── the parser, against the shape Meta actually sends ───────────────────────────────────────────
PAYLOAD = {"history": [{"threads": [{"id": "34600111222", "messages": [
    {"id": "wamid.A", "timestamp": "1710000000", "type": "text",
     "text": {"body": "buenos dias, 20 kg de tomate"}, "history_context": {"from_me": "false"}},
    {"id": "wamid.B", "timestamp": "1710000600", "type": "text",
     "text": {"body": "anotado, sale para mañana"}, "history_context": {"from_me": "true"}},
    {"id": "wamid.C", "timestamp": "1710086400", "type": "media_placeholder"},
    {"id": "wamid.D", "timestamp": "0", "type": "text", "text": {"body": "sin fecha"}},
]}]}]}


def test_parses_metas_nesting():
    lines = backfill.parse_history_chunk(PAYLOAD)
    assert len(lines) == 3, "history → threads → messages, with the undated line dropped"
    assert all(l["ts"].year > 2015 for l in lines), "a zero timestamp must never become 1970"
    assert all(l["phone"] == "34600111222" for l in lines), "the party comes off the thread id"


def test_direction_is_not_guessed():
    """from_me=true is the BUSINESS. Getting this backwards turns a two-way relationship into a
    monologue, and the replay's whole value is that both voices are in it."""
    lines = backfill.parse_history_chunk(PAYLOAD)
    assert [l["direction"] for l in lines] == ["in", "out", "in"]


def test_media_survives_as_a_line():
    """«mandó una foto» is itself a fact about how this customer orders, so a placeholder is kept
    rather than dropped for having no text."""
    lines = backfill.parse_history_chunk(PAYLOAD)
    assert any(l["kind"] == "media_placeholder" for l in lines)


def test_grouped_by_calendar_day_and_sorted():
    days = backfill.group_by_day(backfill.parse_history_chunk(PAYLOAD))
    assert len(days) == 2
    for rows in days.values():
        assert rows == sorted(rows, key=lambda x: x["ts"])


# ── the safety properties, proven against the syntax tree ───────────────────────────────────────
def _call_names(src: str) -> list[str]:
    out = []
    for node in ast.walk(ast.parse(src)):
        if isinstance(node, ast.Call):
            n = getattr(node.func, "attr", None) or getattr(node.func, "id", None)
            if n:
                out.append(n)
    return out


def test_cannot_speak_or_wake_anything():
    """THE test. Every one of these would either send a message to a real person about a two-year-old
    conversation, or arm a timer/turn that later does. The replay must contain none of them —
    verified structurally, because a comment saying so is not evidence."""
    forbidden = {
        "ingest_chat",        # arms pending_turn → worker.run_pending_backstop sends a REAL reply
        "ingest_inbound",
        "ingest_webhook",     # → cascade.on_nonmessage_event → the duty binder
        "run_turn",
        "upsert_pending_turn",
        "send_whatsapp_as_rocoto",
        "send_text",
        "send_media",
        "react_to_sense",     # opens tabs and arms chase timers, dated now()
        "on_duty_sense",
    }
    found = sorted(set(_call_names(SRC)) & forbidden)
    assert not found, f"backfill must not be able to speak or wake anything; found {found}"


def test_writes_only_conversation_event_types():
    """Only `message` and `msg.sent` reach the spine. Any other type can hit a manifest_duty's
    `opens_on` and arm a chase timer at now() about something from March."""
    types = {n.value for n in ast.walk(ast.parse(SRC))
             if isinstance(n, ast.Constant) and isinstance(n.value, str)
             and n.value in ("message", "msg.sent", "order.placed", "call.ended", "quote.sent")}
    assert "msg.sent" in types and "message" in types
    assert not ({"order.placed", "call.ended", "quote.sent"} & types), \
        "a duty-triggering event type appeared in the replay"


def test_every_write_is_dated_and_idempotent():
    assert 'dedupe_key=f"backfill:' in SRC, "a re-run must be swallowed, not duplicated"
    assert "ts=ln[" in SRC, "events carry the historical timestamp"
    assert "ts=when" in SRC, "the summary is dated as the day it describes"
    assert "valid_at=when" in SRC, "a fact learned in March was true from March"


def test_the_watermark_is_advanced_even_on_failure():
    """The nightly sweep keys on event ID and the replay owns the highest ids in the table. If the
    watermark is not moved past them, the 12:00 run distils two years of history as «EVENTOS DE
    HOY» — so it must happen in a finally, not on the happy path."""
    fn = next(n for n in ast.walk(ast.parse(SRC))
              if isinstance(n, ast.AsyncFunctionDef) and n.name == "replay_party")
    tries = [n for n in ast.walk(fn) if isinstance(n, ast.Try) and n.finalbody]
    assert tries, "replay_party must use try/finally"
    finally_src = " ".join(ast.dump(x) for t in tries for x in t.finalbody)
    assert "_advance_watermark" in finally_src
