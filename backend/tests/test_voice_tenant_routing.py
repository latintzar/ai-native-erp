"""test_voice_tenant_routing.py — which distributor was called, and why it must be the DIALLED number.

The voice rail was single-tenant: `voice_incoming` read `From` and ignored `To`, so it could not tell
which distributor a call was for. Everything — the catalogue an order is grounded against, the review
sheet it lands on, the hours the posture is resolved against — hangs off getting this right.

The temptation is to route on the DIVERTING number (whose phone forwarded the call), because that is
literally the distributor. It cannot be done: 3GPP TS 22.082 §1.3.8 makes presenting the diverting
number a SUBSCRIPTION OPTION of the forwarding subscriber, and Twilio's `ForwardedFrom` is observably
present for one caller and absent for the next on the SAME line. These tests pin the safe key.
"""
import ast
import os

import channels

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = open(os.path.join(HERE, "app.py")).read()
CH = open(os.path.join(HERE, "channels.py")).read()


def test_voice_is_its_own_channel_kind():
    assert channels.VOICE == "voice"
    assert channels.VOICE != channels.WHATSAPP, "a DID is not a WhatsApp line"


def test_the_webhook_reads_the_number_that_was_dialled():
    fn = next(n for n in ast.walk(ast.parse(APP))
              if isinstance(n, ast.AsyncFunctionDef) and n.name == "voice_incoming")
    src = ast.dump(fn)
    assert "tenant_of_did" in src, "voice_incoming must resolve the tenant from the dialled number"
    assert "'To'" in src or '"To"' in src, "it must actually read To"


def test_it_never_routes_on_the_diverting_number():
    """The field that looks perfect and silently vanishes."""
    fn_src = APP[APP.index("async def voice_incoming"):]
    fn_src = fn_src[:fn_src.index("\n@app.")] if "\n@app." in fn_src else fn_src
    assert "ForwardedFrom" not in fn_src, "routing on ForwardedFrom mis-delivers orders"


def test_an_unknown_number_is_reported_as_unknown_not_invented():
    """`tenant_of_did` must not manufacture a tenant. The caller decides the fallback, and it says so
    in the return value rather than hiding it — the same contract the WhatsApp resolver uses."""
    fn = next(n for n in ast.walk(ast.parse(CH))
              if isinstance(n, ast.AsyncFunctionDef) and n.name == "tenant_of_did")
    returns = [n for n in ast.walk(fn) if isinstance(n, ast.Return)]
    assert returns, "tenant_of_did must return"
    for r in returns:
        assert isinstance(r.value, ast.Tuple) and len(r.value.elts) == 2, \
            "it must return (tenant, known) so an unknown number cannot pass as a known one"
    # and the miss must be audible
    assert "log.warning" in ast.dump(fn) or "UNREGISTERED" in CH


def test_numbers_are_stored_under_their_kind():
    """`upsert_number` hardcoded WHATSAPP in four places while pretending to have a `kind` column;
    a voice DID stored as a WhatsApp line would collide with the WhatsApp uniqueness fence."""
    fn = next(n for n in ast.walk(ast.parse(CH))
              if isinstance(n, ast.AsyncFunctionDef) and n.name == "upsert_number")
    names = {a.arg for a in fn.args.kwonlyargs}
    assert "kind" in names, "upsert_number must take a kind"
    # WHATSAPP is legitimate as the DEFAULT of `kind` (WhatsApp is the established rail). What must
    # not survive is a WHATSAPP literal in the BODY, which would file a voice DID as a WhatsApp line.
    body = " ".join(ast.dump(st) for st in fn.body)
    assert "WHATSAPP" not in body, "a hardcoded WHATSAPP survived inside upsert_number's body"
    kind_default = fn.args.kw_defaults[[a.arg for a in fn.args.kwonlyargs].index("kind")]
    assert isinstance(kind_default, ast.Name) and kind_default.id == "WHATSAPP", \
        "kind must default to WHATSAPP so every existing caller is unaffected"
