"""test_anonymous_caller_scope.py — two anonymous callers must never share a conversation.

The bug this pins was silent and live: `scope_of` is a pure function of the caller's DIGITS, so
every caller with none — `From="anonymous"`, `"unknown"`, `""` — produced the same string, and the
voice rail mapped all of them onto the single constant `"voice.demo"`. One customer's name, order
history and standing facts were then read back to the next stranger who rang, with nothing raised
and nothing logged.

It is not an edge case. CLIR is a free supplementary service any caller can invoke, and 3GPP
TS 22.081 §1.4 has the network itself withhold the identity whenever the signalling cannot carry it
(«the called PLMN user shall receive an indication that the calling line identity is not
available»). Every one of those is an ordinary inbound call.
"""
import pytest

import presence_call
import tenancy

ANON = ("", "anonymous", "unknown", "Restricted", "+")


# ── the identity predicate ────────────────────────────────────────────────────────────────────────
def test_a_word_is_not_a_number():
    for a in ANON:
        assert not tenancy.has_identity(a), f"{a!r} identifies nobody"
    assert tenancy.has_identity("+34600111222")
    assert tenancy.has_identity("0034 600 111 222")


# ── the property that was violated ────────────────────────────────────────────────────────────────
def test_two_anonymous_calls_never_share_a_scope():
    """THE test. Different calls, both unidentified — they must not meet."""
    a = presence_call.scope_for("anonymous", "CA1111")
    b = presence_call.scope_for("anonymous", "CA2222")
    assert a != b
    assert "1111" in a and "2222" in b


def test_an_anonymous_call_never_lands_in_the_demo_conversation():
    """`voice.demo` is the landing page's own scope. A real customer withholding their number used
    to be dropped straight into it, beside strangers demoing the product from the website."""
    assert presence_call.scope_for("anonymous", "CA1111") != "voice.demo"
    assert presence_call.scope_for("", "CA1111") != "voice.demo"


def test_an_anonymous_scope_is_not_a_party_scope():
    """It must not be mistakable for a phone party — nothing downstream may derive a customer,
    a phone number or a WhatsApp reply address from it."""
    s = presence_call.scope_for("anonymous", "CA1111")
    assert not s.startswith("wa.") and ".wa." not in s
    assert s.startswith("anon.") or ".anon." in s


def test_a_known_caller_is_unchanged():
    """The fix must be invisible to the 99% path: a caller with a number keeps the exact scope they
    had before, so no existing conversation is orphaned."""
    assert presence_call.scope_for("+34600111222", "CA1111") == tenancy.scope_of("+34600111222")
    assert presence_call.scope_for("+34600111222", "") == tenancy.scope_of("+34600111222")


def test_the_same_call_is_stable_across_its_turns():
    """Ring time and every later turn must agree, or the session pin misses and the mind loses the
    call's grounding mid-sentence."""
    assert presence_call.scope_for("anonymous", "CAxyz") == presence_call.scope_for("unknown", "CAxyz")


def test_party_scope_refuses_the_shared_bucket_rather_than_guessing():
    """A caller that cannot name its call gets an exception, not the merged scope. Failing loudly is
    the whole point: the silent version of this is the bug."""
    with pytest.raises(ValueError):
        tenancy.party_scope("anonymous")
    with pytest.raises(ValueError):
        tenancy.party_scope("unknown", "sitjar", fallback_key="   ")


# ── the bug class, pinned structurally ────────────────────────────────────────────────────────────
def test_every_live_call_site_names_its_call():
    """`scope_for(caller)` with one argument is the whole bug: it cannot key an anonymous caller on
    anything, so it falls back to the shared bucket. Every site in app.py and presence_call.py must
    pass the call reference. Checked against the syntax tree, because a convention nobody enforces is
    how the one-argument version came back the first time."""
    import ast
    import os
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    bad = []
    for mod in ("app.py", "presence_call.py"):
        tree = ast.parse(open(os.path.join(here, mod)).read())
        for node in ast.walk(tree):
            if (isinstance(node, ast.Call)
                    and getattr(node.func, "attr", None) == "scope_for"
                    and len(node.args) < 2):
                bad.append(f"{mod}:{node.lineno}")
    assert not bad, f"scope_for called without a call reference at {bad}"


def test_the_lifecycle_scope_follows_the_call_sid():
    """call_started/call_ended take `scope_key` (the Twilio SID) separately from `call_id` (the
    bridge's own uuid, which keys event dedupe). Handing one where the other belongs splits an
    anonymous call in half: turns under one scope, start/end under another."""
    import inspect

    import presence_call
    for fn in (presence_call.call_started, presence_call.call_ended):
        assert "scope_key" in inspect.signature(fn).parameters, fn.__name__
        assert "scope_key or call_id" in inspect.getsource(fn), \
            f"{fn.__name__} must prefer the SID when deriving its scope"
