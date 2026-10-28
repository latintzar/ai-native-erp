"""Test-mode + isolation unit gate — the canonical safety layer (TEST-MODE-AND-ACCESS spec).

Pure-logic (no DB): the drift guard (the generator's enums stay a SUBSET of the frozen wizard contract
in data.ts, so a new ERP/voice can't make it emit an invalid value), generator validity across many
seeds, the value-constrained validation gate + repair, the guarded wipe_test's allowlist refusals, the
central pred()/flag() chokepoint, and resolve_role's exact-match elevation. The DB-backed isolation
INVARIANTS (list_leads / waitlist.position / drip exclude test rows) are verified end-to-end on the box
during each phase's flow walk.

Run:  PYTHONPATH=. pytest tests/test_testmode.py -q
"""
from __future__ import annotations

import asyncio
import os
import re

import pytest

import config  # noqa: F401 (ensures the allowlists are loaded)
from brain import auth, onboard_q
from brain import testdata as t

# ── generator: always schema-valid, reproducible, scope-respecting ──

def test_generator_valid_across_seeds():
    async def _run():
        os.environ["ANTHROPIC_API_KEY"] = ""  # force the deterministic canned path (no network)
        for seed in range(0, 60):
            ws = (await t.generate_fill("all", seed=seed))["wizard_state"]
            assert ws["program"] in t.PROGRAMS
            assert ws["voice_id"] in t.VOICE_IDS
            assert re.match(r"^([01]\d|2[0-3]):[0-5]\d$", ws["excel_send_time"])
            assert re.match(r"^([01]\d|2[0-3]):[0-5]\d$", ws["waking_from"])
            assert 6 <= len(ws["products"]) <= 12
            for a in ws["catchment"]:
                lng, lat = a["center"]
                assert -180 <= lng <= 180 and -90 <= lat <= 90
    asyncio.run(_run())


def test_generator_deterministic():
    async def _run():
        a = await t.generate_fill("all", seed=123)
        b = await t.generate_fill("all", seed=123)
        assert a["wizard_state"] == b["wizard_state"]
        assert a["business"] == b["business"]
    asyncio.run(_run())


def test_generator_scope_slices():
    async def _run():
        v = await t.generate_fill("voice", seed=7)
        assert set(v["wizard_state"]) <= {"voice_id"}
        c = await t.generate_fill("catchment", seed=7)
        assert set(c["wizard_state"]) <= {"catchment", "catchment_center"}
    asyncio.run(_run())


# ── the value-constrained validation gate (m8: not just Optional shape) ──

@pytest.mark.parametrize("kwargs", [
    {"program": "not-an-erp"},
    {"voice_id": "not-a-voice"},
    {"excel_send_time": "25:00"},
    {"waking_from": "7am"},
    {"catchment_center": [999, 999]},
])
def test_gate_rejects_bad_values(kwargs):
    with pytest.raises(Exception):
        t.WizardStateModel(**kwargs)


def test_gate_accepts_partial_step_fill():
    # a per-step fill (only voice_id) is valid — the gate no-ops on absent fields
    t.WizardStateModel(voice_id=t.VOICE_IDS[0])


def test_repair_fixes_bad_values():
    r = t.validate_and_repair({"program": "x", "voice_id": "y", "excel_send_time": "99:99",
                               "waking_from": "aa", "catchment_center": "nope"})
    assert r["program"] in t.PROGRAMS
    assert r["voice_id"] in t.VOICE_IDS
    assert r["excel_send_time"] == "06:00"
    t.WizardStateModel(**r)  # now valid


# ── the central chokepoint + the guarded wipe ──

def test_pred_and_flag():
    assert onboard_q.pred("leads", onboard_q.MODE_LIVE) == "is_test = false"
    assert onboard_q.pred("leads", onboard_q.MODE_TEST, "l") == "l.is_test = true"
    assert onboard_q.flag("orders") == "seeded"           # brain table → `seeded`
    assert onboard_q.flag("onboarding_tokens") == "is_test"
    with pytest.raises(ValueError):
        onboard_q.flag("unknown_table")                    # fail-loud, never silently skip the filter


def test_wipe_guard_refuses_bad_table_and_idcol():
    async def _run():
        with pytest.raises(ValueError):
            await onboard_q.wipe_test(None, "not_allowed_table")       # off-allowlist table
        with pytest.raises(ValueError):
            await onboard_q.wipe_test(None, "leads", id_col="evil")     # off-allowlist id_col
    asyncio.run(_run())


# ── RBAC: exact-match elevation, verified-only, case-insensitive ──

def test_resolve_role_elevation():
    assert auth.resolve_role("peter@leo.casa", True) == ("owner", True)
    assert auth.resolve_role("PETER@LEO.CASA", True) == ("owner", True)      # case-insensitive
    assert auth.resolve_role("peter@rocoto.com", True) == ("owner", False)
    assert auth.resolve_role("peter@leo.casa", False) == ("customer", False)  # unverified never elevates
    assert auth.resolve_role("stranger@example.com", True) == ("customer", False)
    assert auth.resolve_role("", True) == ("customer", False)


def test_elevation_requires_oauth_not_just_confirmed_email():
    # THE HOLE THIS CLOSES: with Supabase email-confirmation OFF, a password signup is AUTO-confirmed
    # (email_confirmed_at set). is_email_verified() is then True — but that must NOT elevate an owner
    # address. Only a real Google/OAuth identity may. Callers pass has_oauth_identity() to resolve_role.
    pw_user = {"email": "peter@leo.casa", "email_confirmed_at": "2026-01-01T00:00:00Z",
               "identities": [{"provider": "email"}], "app_metadata": {"provider": "email"}}
    google_user = {"email": "peter@leo.casa", "email_confirmed_at": "2026-01-01T00:00:00Z",
                   "identities": [{"provider": "google"}], "app_metadata": {"provider": "google"}}
    assert auth.is_email_verified(pw_user) is True            # confirmed…
    assert auth.has_oauth_identity(pw_user) is False           # …but NOT an OAuth login
    assert auth.resolve_role("peter@leo.casa", auth.has_oauth_identity(pw_user)) == ("customer", False)
    assert auth.has_oauth_identity(google_user) is True
    assert auth.resolve_role("peter@leo.casa", auth.has_oauth_identity(google_user)) == ("owner", True)
