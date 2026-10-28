"""test_call_becomes_order.py — a phone call has to end in an order, not just a transcript.

Rocoto's promise to a distributor is «cada llamada acaba en un pedido escrito». Until 2026-08-18 it
did not: `orders_tool.place_order` had exactly one caller — `agent_reply`, the WhatsApp mind — and
`_maybe_extract_order` fired from three message rails, none of them voice. A call produced a
transcript, a summary, memory and a review row, and no order.

Checked structurally against the syntax tree: the wiring is one call on a hangup path that no unit
test can drive without a live bridge, and the failure mode is silence rather than an exception.
"""
import ast
import os

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = open(os.path.join(HERE, "app.py")).read()
POSTCALL = open(os.path.join(HERE, "postcall.py")).read()


def _calls_named(src: str, name: str) -> list[int]:
    return [n.lineno for n in ast.walk(ast.parse(src))
            if isinstance(n, ast.Call)
            and (getattr(n.func, "attr", None) or getattr(n.func, "id", None)) == name]


def test_the_call_end_path_reaches_order_intake():
    """THE test. Somewhere on the hangup path, a call's words must be handed to the same extractor
    the WhatsApp rail uses — not a parallel one that will drift."""
    assert _calls_named(APP, "_maybe_extract_order"), "nothing routes anything to order intake"
    assert "_postcall.call_transcript" in APP, "the call's words never reach the extractor"


def test_the_extractor_is_shared_with_the_message_rails():
    """One extractor, so an improvement to order-reading helps both mouths. A voice-only copy would
    be two order brains that disagree about the same customer."""
    assert APP.count("async def _maybe_extract_order") == 1, "the extractor was forked"


def test_only_the_callers_words_are_extracted():
    """Rocoto reads a draft back down the phone («entonces cuatro cajas de tomate rama…»). If its own
    turns reach the extractor, that repetition becomes a second order line and quantities double."""
    assert "inbound_only" in POSTCALL
    fn = next(n for n in ast.walk(ast.parse(POSTCALL))
              if isinstance(n, ast.AsyncFunctionDef) and n.name == "call_transcript")
    src = ast.dump(fn)
    assert "msg.sent" in src, "the outbound type must be named, if only to exclude it"
    # the default must be the safe one
    default = fn.args.defaults[-1] if fn.args.defaults else None
    kwdefaults = [d for d in (fn.args.kw_defaults or []) if d is not None]
    val = kwdefaults[-1] if kwdefaults else default
    assert isinstance(val, ast.Constant) and val.value is True, \
        "inbound_only must DEFAULT to True — the unsafe direction doubles orders"


def test_a_failed_extraction_never_breaks_the_hangup():
    """The call ending is the moment call.ended fires, reset hooks run and the debrief is built.
    An order-intake hiccup must not take that with it."""
    i = APP.index("_postcall.call_transcript")
    window = APP[i - 700:i + 700]
    assert "except Exception" in window, "call→order intake must be wrapped fail-soft"
