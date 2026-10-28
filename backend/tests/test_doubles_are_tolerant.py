"""test_doubles_are_tolerant.py — a stub of a real organ must accept optional keywords.

TWICE IN ONE DAY (2026-08-19) a deploy went red on this, and neither failure said anything about
the product:

    TypeError: fake_dg() got an unexpected keyword argument 'keyterms'
    TypeError: _no_post() got an unexpected keyword argument 'from_id'

Both times the organ gained an OPTIONAL argument — a domain prior for transcription, the number a
send must leave from — and a test double declared with the exact old arity turned that into a red
gate that reported a media-rail failure and an egress failure respectively. The cost is not just
the deploy: the message points at the wrong subsystem, so the first thing you do is look in the
wrong place.

A double that patches a module attribute is standing in for a signature it does not own. It must
therefore accept what it does not know about. This test finds doubles that cannot.
"""
import ast
import pathlib

HERE = pathlib.Path(__file__).resolve().parent


def _patched_names(tree: ast.AST) -> set[str]:
    """Functions assigned onto an imported module — `wc._post_messages = _no_post`, `tx.x = fake`."""
    out: set[str] = set()
    for node in ast.walk(tree):
        if not isinstance(node, ast.Assign):
            continue
        for tgt in node.targets:
            if not isinstance(tgt, ast.Attribute):
                continue
            v = node.value
            if isinstance(v, ast.Name):
                out.add(v.id)
            elif isinstance(v, ast.Tuple):
                for el in v.elts:
                    if isinstance(el, ast.Name):
                        out.add(el.id)
    return out


# THE RATCHET, not a big-bang cleanup. 62 doubles predate this check; rewriting them all in one
# pass would be a large, untested edit across every vital on the box for a benefit that is entirely
# about the FUTURE. So the baseline is frozen and the gate is «no NEW ones» — the same shape the
# kernel-boundary vital already uses («0 NEW breaches, 5 named legacy edges ratcheted»). Every time
# one of these files is touched for a real reason, its double should gain **kw and leave this list.
_LEGACY = {
    "eval_retrieval.py::_cached",
    "rehearsal_dirty.py::_cap2",
    "rehearsal_dirty.py::_capture_send",
    "rehearsal_dirty.py::_spy_email",
    "rehearsal_dirty.py::_stub_understand",
    "test_amend.py::_noop_notify",
    "test_basket_accept.py::_fake_route",
    "test_voice_reply.py::form",
    "vital_app_onboarding.py::_fake_counts",
    "vital_app_onboarding.py::_fake_verify",
    "vital_avisos.py::_fake_emit",
    "vital_behaviour_confirm.py::_spy_card",
    "vital_behaviour_confirm.py::_stub_checks",
    "vital_behaviour_confirm.py::_stub_hold",
    "vital_behaviour_confirm.py::_stub_link",
    "vital_billing.py::_boom",
    "vital_billing.py::_mock_invoice",
    "vital_codes.py::_fake_email",
    "vital_codes.py::_fake_for_dispatch",
    "vital_codes.py::_fake_mark",
    "vital_codes.py::_fake_pending",
    "vital_codes.py::_fake_settings",
    "vital_demo_auth.py::_fake",
    "vital_demo_auth.py::_spy",
    "vital_demo_auth.py::_stub_send",
    "vital_demo_doors.py::_fake_verify",
    "vital_demo_doors.py::_stub_send",
    "vital_demo_learn.py::_stub",
    "vital_demo_lineage.py::_recorder",
    "vital_demo_url.py::_boom",
    "vital_followup_fire.py::_fake_reach",
    "vital_followup_fire.py::_fake_surface",
    "vital_golive.py::_fake_send",
    "vital_intake.py::_stub_llm",
    "vital_intake_link.py::_is_founder",
    "vital_intake_link.py::_scope",
    "vital_intake_link.py::_verify",
    "vital_interactive.py::_spy_wake",
    "vital_interactive.py::_spy_wake2",
    "vital_lifecycle.py::_stub_r1",
    "vital_nudge.py::_fake_count",
    "vital_nudge.py::_fake_email",
    "vital_nudge.py::_fake_empty",
    "vital_nudge.py::_fake_for_dispatch",
    "vital_nudge.py::_fake_mark",
    "vital_nudge.py::_fake_reach",
    "vital_one_mind.py::_openerless",
    "vital_order_always_files.py::_regex_mentions",
    "vital_presence.py::_spy_rx",
    "vital_reflexes.py::_fake_surface",
    "vital_reparto_api.py::_day_stops_stub",
    "vital_reparto_api.py::_status",
    "vital_reparto_api.py::_stub",
    "vital_review_rule.py::_fake_reach",
    "vital_review_rule.py::_fake_surface",
    "vital_sombra.py::_broken",
    "vital_stock.py::_extract",
    "vital_stock.py::_ground_stub",
    "vital_stock.py::_vision",
    "vital_sup_auth.py::_fake_surface",
    "vital_vibe.py::_boom",
    "vital_vibe.py::_fake_settings_get",
}


def test_no_new_arity_pinned_double():
    offenders: list[str] = []
    for f in sorted(HERE.glob("*.py")):
        try:
            tree = ast.parse(f.read_text())
        except SyntaxError:
            continue
        patched = _patched_names(tree)
        if not patched:
            continue
        for node in ast.walk(tree):
            if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                continue
            if node.name not in patched:
                continue
            if node.args.kwarg is None and f"{f.name}::{node.name}" not in _LEGACY:
                offenders.append(f"{f.name}:{node.lineno} {node.name}()")
    assert not offenders, (
        "NEW arity-pinned double(s). These replace a real organ but pin its signature, so the day "
        "that organ gains an optional argument the failure reads «unexpected keyword argument» and "
        "points at the wrong subsystem. Add **kw:\n  " + "\n  ".join(offenders))


def test_the_two_that_cost_a_deploy_today_are_fixed():
    """Regression, by name. Both went red in production deploys on 2026-08-19."""
    for fname, fn in (("vital_demo_media.py", "fake_dg"), ("vital_interactive.py", "_no_post")):
        src = (HERE / fname).read_text()
        i = src.index(f"def {fn}(")
        sig = src[i:src.index(")", i)]
        assert "**kw" in sig, f"{fname}::{fn} pins its arity again"
