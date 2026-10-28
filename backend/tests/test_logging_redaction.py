"""WP-E — what the journal is allowed to hold.

The claim is about the LINE THE BOX EMITS, so every assertion formats a real LogRecord through
`logging_setup.JsonLine` — the formatter journald reads — rather than reading `record.getMessage()`.
A writer who puts a phone number in an `extra=` field would sail past a message-only scan and publish
it anyway, so the fields are scanned too.

The redaction is the floor, not the rule: it cannot recognise a customer's sentence, which is why
message bodies are dropped at the call site. The last test here holds those call sites to that.
"""
from __future__ import annotations

import ast
import json
import logging
import os
import pathlib
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("ROCOTO_MEDIA_DIR", "/tmp/rocoto-test-media")

import logging_setup  # noqa: E402

BACKEND = pathlib.Path(__file__).resolve().parent.parent

# Deliberately synthetic: construct the provider-shaped test value at runtime.
_FAKE_STRIPE_KEY = "sk_" + "live_" + ("A" * 32)


def _line(msg: str, *args, **extra) -> str:
    record = logging.LogRecord("rocoto.test", logging.INFO, __file__, 1, msg, args or None, None)
    for k, v in extra.items():
        setattr(record, k, v)
    return logging_setup.JsonLine().format(record)


def test_a_line_with_a_phone_an_email_and_a_key_comes_out_masked():
    written = _line("inbound from=%s for %s using %s",
                    "+34611111102", "raquel.perez@escofruit.es", _FAKE_STRIPE_KEY)
    assert "+34611111102" not in written and "611111102" not in written, written
    assert "+…1102" in written, "the last four digits stay — enough to recognise, never to dial"
    assert "raquel.perez" not in written, written
    assert "@escofruit.es" in written, "the domain stays; the person does not"
    assert _FAKE_STRIPE_KEY not in written, written
    assert "[redacted]" in written


def test_the_extra_fields_are_masked_too():
    written = _line("call ended", call_sid="CA1", scope="party.+34611111102", ms=1200)
    assert "611111102" not in written, written
    assert json.loads(written)["call_sid"] == "CA1", "the ids a human needs stay readable"
    assert json.loads(written)["ms"] == 1200


def test_a_configured_secret_is_masked_even_when_a_provider_quotes_it_back():
    import config
    written = _line("provider said: bad token %s", config.MEDUSA_SUBSCRIBER_TOKEN or "x")
    if len(config.MEDUSA_SUBSCRIBER_TOKEN or "") >= 8:
        assert config.MEDUSA_SUBSCRIBER_TOKEN not in written  # pragma: no cover — env-dependent
    written = _line("anthropic error: %s", "sk-ant-api03-AAAAAAAAAAAAAAAAAAAAAAAAAA")
    assert "sk-ant-api03" not in written, written


def test_dates_counts_and_prices_survive():
    """A rule loose enough to mask every long number would mask the journal's own timestamps, and a
    masked timestamp reads as a bug in the box rather than a rule about privacy."""
    written = _line("swept %d calls at 1757203200 on 2026-09-06; 1998 eur", 3)
    for kept in ("1757203200", "2026-09-06", "1998"):
        assert kept in written, f"{kept} vanished: {written}"


def test_the_shape_is_closed():
    """Only the contract's own keys reach the journal, so a customer's words cannot ride in under a
    name nobody scans for."""
    written = json.loads(_line("hello", route="/api/x", smuggled="hola quiero 5 kg de merluza"))
    assert "smuggled" not in written, written
    assert set(written) <= {"ts", "level", "logger", "msg", "exc"} | set(logging_setup.FIELDS)


def test_uvicorn_access_is_silenced():
    """Its line carries the full path, and on this backend a path holds tokens and phone numbers."""
    logging_setup.configure()
    access = logging.getLogger("uvicorn.access")
    assert access.handlers == [] and access.propagate is False


def test_the_inbound_doors_log_lengths_and_ids_never_bodies():
    """The three call sites that used to print a customer's message into the journal. Read from the
    source, because the point is that the CONTENT never reaches the formatter in the first place."""
    src = (BACKEND / "app.py").read_text()
    tree = ast.parse(src)
    offenders = []
    for node in ast.walk(tree):
        if not (isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)
                and node.func.attr in ("info", "warning", "error")
                and isinstance(node.func.value, ast.Name) and node.func.value.id == "log"):
            continue
        fmt = node.args[0] if node.args else None
        if not (isinstance(fmt, ast.Constant) and isinstance(fmt.value, str)):
            continue
        # A log call whose format string publishes a body/transcript/text field.
        if any(k in fmt.value for k in ("body=%r", "body=%s", "transcript from", "transcript: %s")):
            offenders.append((node.lineno, fmt.value))
    assert offenders == [], f"these log lines carry customer content: {offenders}"
