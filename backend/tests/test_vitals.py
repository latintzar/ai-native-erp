"""test_vitals.py — the pytest door onto the 106 vitals.

`backend/tests` holds 37 `test_*.py` files and 106 `vital_*.py` files. pytest collects `test_*.py`
only, so the vitals — the product's own proofs, one per organ or promise — were collected by nothing.
Their one runner is `deploy/harness/run_all_vitals.sh`, which needs root on the production box:
`/opt/rocoto` paths, `sudo -u postgres`, prod's `.env`. That file says it four times, in four
different incidents' words: A VITAL NOBODY RUNS IS A DOCUMENT.

This is the door. Every vital that can run off the box runs here as a subprocess, exactly the way
the harness runs it (`PYTHONPATH=. python3 tests/vital_x.py`, exit code is the verdict), with the
wall's environment and a timeout. Every vital that cannot is in SKIPPED with the reason, and is
reported as a pytest skip — a vital is never silently absent. A new `vital_*.py` that is in none of
the three lists fails `test_every_vital_is_classified`, so it cannot join them quietly.

  NO_DB   runs on nothing. Run with every DSN STRIPPED from the child's environment, so the claim
          is tested rather than asserted — these need no Postgres at all.
  DB      needs the wall and nothing else (tests/rls_wall.py; see tests/README.md).
  SKIPPED needs the box: /opt/rocoto, a live provider key, `sudo -u postgres`, prod's own database
          — or, in four cases, needs its owner: it is red on main for a product reason.

EVERY DB VITAL GETS ITS OWN DATABASE, forked from a template by Postgres in about half a second.
That is not tidiness. `run_all_vitals.sh` documents at length what a shared clone does — four
concurrent `vital_presence` runs on one reported 5/12, 9/12, 10/12 and 11/12, the same vital alone
reported 12/12 every time — and running seventy-nine of them in sequence produces the same failure
by another route: six of them went red here on rows the previous forty left behind, and green the
moment they were handed a clean one. A private clone makes the order of this list uninteresting,
which is the property a suite needs to stay green as it grows.

Run them SEQUENTIALLY all the same: they share the cluster, and pytest-xdist would put them back in
each other's way.
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import pytest

TESTS = Path(__file__).resolve().parent
BACKEND = TESTS.parent
sys.path.insert(0, str(TESTS))   # tests/ is a package, so `import rls_wall` needs it by name

# A vital that has not finished by now has stopped being a proof and started being a wait.
# vital_seedworld (a whole seeded world, ~50 SKUs and a week of chat) is the long pole at ~90s.
TIMEOUT_S = int(os.getenv("ROCOTO_VITAL_TIMEOUT", "300"))

# What the wall hands out. Its absence IS "the wall is down"; NO_DB vitals run without any of it —
# ROCOTO_REQUIRE_RLS included, because a database that is not there cannot be required to be fenced.
DSN_ENV = ("DATABASE_URL", "RUNTIME_DATABASE_URL", "CONTROL_DATABASE_URL", "SETUP_DSN",
           "REHEARSAL_DSN", "RT_DSN", "CTRL_DSN", "REHEARSAL_DB", "BACKFILL_DSN",
           "ROCOTO_REQUIRE_RLS")

WALL_DOWN = "the RLS wall is down (RUNTIME_DATABASE_URL unset) — run make vitals from the repository root"

# `tests/conftest.py` calls `gatelib.setup_env()`, which points THIS process at the Medusa gate's
# world: BRAIN_TENANT=sancho and an optional explicitly configured Medusa test service. A vital
# inherits whatever the runner exports, so without this the door would hand every vital an
# environment no box has — and vital_multitenant went red on exactly that, asserting Peter's own
# tenant is still `rocoto` while the suite's default said `sancho`. Stripped, `config` falls back to
# its own declared defaults, which is what the harness gives them on the box.
#
# ANTHROPIC_API_KEY is on the list for a sharper version of the same reason: `test_testmode.py`
# sets it to the EMPTY STRING in this process, permanently, to force its deterministic path — and
# an empty string is a value, so `vital_mindcheck`'s `os.environ.setdefault(…, "sk-vital-not-a-
# real-key")` cannot replace it. Its order rail then short-circuits on `not config.ANTHROPIC_API_KEY`
# before it touches the stubbed client, and three checks fail on a rail that never ran. Unset is what
# a runner actually has, so unset is what a vital gets.
SUITE_ENV = ("BRAIN_TENANT", "MEDUSA_SYNC_ENABLED", "MEDUSA_BASE_URL", "MEDUSA_REGION_ID",
             "MEDUSA_SALES_CHANNEL_ID", "MEDUSA_CURRENCY_CODE", "MEDUSA_ADMIN_EMAIL",
             "MEDUSA_ADMIN_PASSWORD", "ANTHROPIC_API_KEY")


# ── NO_DB — pure functions, AST, fixtures, stubbed rails. No Postgres, no provider, no network. ──
NO_DB: dict[str, str] = {
    "vital_kernel_boundary": "pure AST over the import graph — the kernel may not import the app",
    "vital_scope_shape": "greps the corpus for a hand-spelled scope; reads files, runs nothing",
    "vital_gate": "the money gate is a pure function over sentences",
    "vital_doubt": "the doubt classifier is pure — fixtures in, verdicts out",
    "vital_doubt_wire": "the wire is asserted on the prompt bytes the faculty produces",
    "vital_egress_sandbox": "monkeypatches every rail and proves each short-circuits — zero network",
    "vital_speech": "the mouth sanitizer is a string transform",
    "vital_vibe": "the VOZ line is rendered from constants; the live proof is eval_golden_call",
    "vital_caps_split": "the cap matrix is two dicts and the call sites that read them",
    "vital_reparto_caps": "ROLE_CAPS and APP_ROLE_CAPS compared as sets",
    "vital_reparto_api": "reads the route table and its dependencies, never calls one",
    "vital_cr_tokens": "a file check: every var(--rocoto-*) in cr.css resolves in tokens.css",
    "vital_demo_url": "the SSRF guards are pure address checks; nothing is fetched",
    "vital_one_mind": "proves an absence — no module, no toggle, no second agent id",
    "vital_mindcheck": "the health verdict is computed from stubbed rails, model included",
    "vital_terms_acceptance": "backend checkout consent and accepted-version declarations",
    "vital_term_split": "existing term and meter cadence from backend-owned catalogue data",
}

# ── DB — the wall, and nothing else. Each gets a private clone (the `clone` fixture below). ──────
# Grouped the way run_all_vitals.sh groups them. Phase 1: the organ vitals, owner pool, db.init().
DB: dict[str, str] = {
    "vital_demo_resume": "authenticated demo resume preserves account ownership",
    "vital_field_law": "the current voice default and permission boundary",
    "vital_portal": "tenant portal contract with captured outbound delivery",
    "vital_spine": "truncates and rebuilds the event spine",
    "vital_duties": "the generic duty binder against seeded manifest_duty rows",
    "vital_memory": "facts, recall and the card, byte-reproducible",
    "vital_assemble": "the bounded turn, assembled from 300 real events",
    "vital_ops": "writes a durable alert, refuses outbound paging, preserves heartbeats",
    "vital_rls_coverage": "reads the catalogue of a clone that holds ONLY schema_runtime.sql "
                          "(see the pristine fixture below)",
    "vital_range": "the radius rule, with the tenant's own row",
    "vital_stock": "the capture→correction→apply loop writes levels",
    "vital_reparto": "delivery windows as stored provenance",
    "vital_capture_unmatched": "the unmatched half of a reading is a column",
    "vital_vocab": "a tenant's catalogue brings its own aliases",
    "vital_app_onboarding": "the invite gate is a row in agent_settings",

    # Phase 2: isolation, then the composed vitals, on the RLS-ON clone.
    "vital_rls": "THE isolation canary — rocoto_rt scoped to A cannot see or write B",
    "vital_tenant_isolation": "boots the real app and attacks the app rail's tenant fence",
    "vital_multitenant": "two distributors, one shared customer, through the real webhook",
    "vital_sup_auth": "the desk's session world and its absolute tenant isolation",
    "vital_cascade": "a payment resolves a tab and cancels its timers",
    "vital_cascade_nine": "the update-in-place and reschedule tab actions",
    "vital_stripe_spine": "a webhook runs the same cascade as an internal sense",
    "vital_senses": "one webhook, one event; a bad one dead-letters",
    "vital_projection": "a spine msg.sent projects, idempotently",
    "vital_wake": "the wake spine: produce, dedupe, consume, absorb",
    "vital_reach": "the deliverable-hand ladder for a closed window",
    "vital_repertoire": "three seeded repertoire duties open their tabs",
    "vital_install": "talk writes a manifest row, and the row binds",
    "vital_person": "human pacing and the relationship stage",
    "vital_gate_full": "the money gate, adversarially, against a seeded standing price",
    "vital_reviewsheet": "park → list → approve → resume, on the money surface",
    "vital_hoy": "the boss's cross-scope daily digest",
    "vital_lifecycle": "the hard lifecycle switch and the no-catalogue freeze fix",
    "vital_confidence": "dirty audio routes to review; the human's fix becomes an alias",
    "vital_memory_turn": "recall injection and the assembly snapshot on the live path",
    "vital_memory_engines": "de-silting and the cosine flag-band",
    "vital_incall": "the in-call runtime across turns, with a scripted mind",
    "vital_founder": "founder mode: the boss is never pitched",
    "vital_fabric": "a background process's result reaches the next turn's mouth",
    "vital_directory": "the supplier card distils, and reaches both mouths",
    "vital_directory_tiers": "the compaction ladder never makes the mind sure about an absence",
    "vital_golive": "the catalogue→grounding bridge, re-run and re-uploaded",
    "vital_nudge": "the review nudge fires once per cutoff",
    "vital_reflexes": "the two call-end reflexes, from their seeded rows",
    "vital_codes": "their supplier codes, all the way through dispatch",
    "vital_billing": "the credit ledger and the GMV meter, Stripe mocked at the seam",
    "vital_intake": "transcript + notes → a staged ficha",
    "vital_onboarded_unpaid": "the embedded-call lifecycle stage",
    "vital_testworld": "the lab builds a fake tenant and anonymizes a subject",
    "vital_tab_dossier": "open, relate, resolve — the dossier reads back",
    "vital_cr_auth": "the Control Room's role gate and its append-only audit",
    "vital_cr_read": "summary→source expansion and the chat columns",
    "vital_cr_control": "refund and GDPR erase, with stripe.Refund stubbed",
    "vital_sup_routes": "the day gather and the VROOM organ, VROOM mocked on localhost",
    "vital_demo_auth": "the magic link is a credential, and consent is evidence",
    "vital_demo_doors": "both /demo sign-in doors, end to end, through the real app",
    "vital_demo_learn": "a correction writes a row the matcher then hits",
    "vital_demo_lineage": "a demo turn writes nothing the live sweep can eat",
    "vital_journey": "the claim rail's seven properties",
    "vital_behaviour_confirm": "one setting governs one message, and not the receipt rail",
    "vital_presence": "the reaction webhook and the reaction send path",
    "vital_interactive": "the one-tap contract: limits enforced, surface chosen by code",
    "vital_stage_brief": "the per-stage job brief reaches both mouths as SYSTEM bytes",
    "vital_context": "every §4.1.1 context component appears in the assembled bytes",
    "vital_pursuit": "the lead-pursuit tab, as data",
    "vital_sombra": "one mouth switch, four half-toggles retired",
    "vital_trackers": "a standing watch is one manifest row",
    "vital_review_rule": "three sources put a matter in front of the comercial, and a one-hour clock",
    "vital_review_why": "every row on the sheet carries exactly one reason",
    "vital_order_always_files": "an order is filed, or it is not claimed",
    "vital_choco": "a Choco link becomes an order, from a fixture — choco.com is never fetched",
    "vital_followup_fire": "rehearses the deploy backfill (BACKFILL_DSN) then proves the ladder fires",
    "vital_measure": "the recall instrument runs and produces a number",
    "vital_liveness_mechanism": "the whole run_turn mechanism with a canned tool-plan",
    "vital_runtime_liveness": "advisory on the box because it drives a real model; with no key here "
                              "it runs its deterministic path",
    "vital_entitlement": "what ON means, and who decides",
    "vital_invitations": "a pending invitation grants nothing at all",
    "vital_team": "granting access is an act, with a door and an audit row",
    "vital_avisos": "an aviso is delivered only where it matters",
    "vital_window": "a row exists only for a day that differs",
    "vital_intake_link": "ingestion everywhere, through the real routes",
    "vital_seedworld": "loads a whole world (~50 SKUs, 8 venues, a week of chat) and tears it down",
}

# ── SKIPPED — the box, or the owner. Reported as skips, never silently absent. ────────────────────
SKIPPED: dict[str, str] = {
    # the box
    "vital_durability": "box: dumps and restores the live database and reads /var/backups/rocoto",
    "vital_schema_drift": "box: diffs the clone against PROD (rocoto) — it needs production's schema",
    "vital_media_writable": "box: asserts the ownership of /opt/rocoto/media on the running host",
    "vital_demo_reap": "box: the orphan-pass guard is defined against /opt/rocoto/.env, so off the "
                       "box the dangerous pair (someone else's database, the box's bytes) cannot form",
    # a live provider
    "vital_cold_tenant": "live model: drives real Sonnet/Opus through the wizard (advisory even on "
                         "the box); with no key it polls a matching job that never completes",
    "vital_ingest": "live model: without ANTHROPIC_API_KEY the parse falls back to the deterministic "
                    "reader and six of its promises have nothing to assert",
    "vital_demo_media": "live model: six checks read the mind's own output; with no key every turn "
                        "answers «Perdona, ¿me lo repites?»",
    # red on main, for a product reason — these need their owner, not a runner
}


def _vitals_on_disk() -> set[str]:
    return {p.stem for p in TESTS.glob("vital_*.py")}


def _run(name: str, env: dict[str, str]) -> None:
    """Run one vital the way the harness does. Non-zero exit is the failure; show its tail."""
    path = TESTS / f"{name}.py"
    try:
        p = subprocess.run([sys.executable, str(path)], cwd=BACKEND, env=env,
                           capture_output=True, text=True, timeout=TIMEOUT_S)
    except subprocess.TimeoutExpired as e:
        tail = (e.output or b"").decode("utf-8", "replace") if isinstance(e.output, bytes) else (e.output or "")
        pytest.fail(f"{name} did not finish in {TIMEOUT_S}s\n" + "\n".join(tail.splitlines()[-20:]))
    if p.returncode != 0:
        # A vital prints one line per check, so the tail alone can be sixty PASSes and hide the
        # three FAILs that matter. Lead with the lines that name a failure, then the tail.
        lines = (p.stdout + p.stderr).splitlines()
        named = [ln for ln in lines if "FAIL" in ln or "Error" in ln][:15]
        out = (named + ["…"] if named else []) + lines[-25:]
        if p.returncode < 0:
            # A negative code is a SIGNAL, not a verdict. The four vitals that embed a catalogue
            # carry the model in RAM, and on a small box an out-of-memory reaper (earlyoom's default
            # action is SIGTERM) takes the biggest process — which is one of them, and which reads
            # as "the vital failed" unless the message says otherwise.
            why = ("; on a small machine that is usually an out-of-memory reaper taking the "
                   "biggest process — this vital loads the embedding model"
                   if -p.returncode == 15 else "")
            pytest.fail(f"{name} was KILLED by signal {-p.returncode}{why}\n" + "\n".join(out))
        pytest.fail(f"{name} exited {p.returncode}\n" + "\n".join(out))


def _base_env() -> dict[str, str]:
    env = {k: v for k, v in os.environ.items() if k not in SUITE_ENV}
    env["PYTHONPATH"] = str(BACKEND)
    # The class-E floor, belt and braces: no rail reaches a real party from a test runner.
    env["ROCOTO_EGRESS_SANDBOX"] = "1"
    env["ROCOTO_MEDIA_DIR"] = "/tmp/rocoto-vital-media"
    return env


@pytest.fixture(scope="session")
def clone():
    """Hand each vital a private database, forked from one of two templates.

    RUNTIME holds schema_runtime.sql + schema_rls.sql and nothing else — the clone
    `rehearsal_rebuild.sh --with-rls` builds. FULL is that plus one `db.init()`, which is the state
    the harness's phase-2 vitals actually meet (its own comment: the first vitals to call db.init()
    apply BRAIN/SHOP/ONBOARD_SCHEMA to the clone, and everything after them relies on it).

    `vital_rls_coverage` is the one vital that must have RUNTIME: it asks whether every scope-keyed
    table in schema_runtime.sql is fenced by schema_rls.sql, and db.init() adds three more tables
    that carry a `scope` column and are outside the regime by design. Asked on a FULL clone the
    gate reports a breach that is not one.
    """
    import asyncio

    import rls_wall

    src = os.environ["DATABASE_URL"]
    base = os.environ.get("REHEARSAL_DB", "rocoto_rehearsal_ci")
    rt_pw = os.getenv("ROCOTO_WALL_RT_PASSWORD", "wall_rt")
    ctrl_pw = os.getenv("ROCOTO_WALL_CTRL_PASSWORD", "wall_ctrl")
    runtime_tpl, full_tpl, live = base + "_tpl_runtime", base + "_tpl_full", base + "_v"

    asyncio.run(rls_wall.build(src, runtime_tpl, rt_pw, ctrl_pw, runtime_only=True))
    full_env, _ = asyncio.run(rls_wall.build(src, full_tpl, rt_pw, ctrl_pw, tenant="rocoto"))
    # db.init() in a CHILD, so this process's own pools (test_rls_wall's, the suite's) are untouched.
    p = subprocess.run([sys.executable, "-c", "import asyncio, db; asyncio.run(db.init())"],
                       cwd=BACKEND, env={**_base_env(), **full_env},
                       capture_output=True, text=True, timeout=TIMEOUT_S)
    assert p.returncode == 0, f"could not seed the FULL template:\n{p.stdout}\n{p.stderr}"

    def make(name: str) -> dict[str, str]:
        tpl = runtime_tpl if name == "vital_rls_coverage" else full_tpl
        return asyncio.run(rls_wall.fork(src, tpl, live, rt_pw, ctrl_pw))

    yield make
    asyncio.run(rls_wall.drop(src, live, full_tpl, runtime_tpl))


def test_every_vital_is_classified():
    """A new vital joins a list or fails here — it never joins the corpus of files nobody runs."""
    on_disk = _vitals_on_disk()
    classified = set(NO_DB) | set(DB) | set(SKIPPED)
    assert not (on_disk - classified), (
        "unclassified vitals (add to NO_DB, DB or SKIPPED in tests/test_vitals.py): "
        + ", ".join(sorted(on_disk - classified)))
    assert not (classified - on_disk), (
        "classified but gone from disk: " + ", ".join(sorted(classified - on_disk)))
    overlap = (set(NO_DB) & set(DB)) | (set(NO_DB) & set(SKIPPED)) | (set(DB) & set(SKIPPED))
    assert not overlap, "a vital is in two lists: " + ", ".join(sorted(overlap))


@pytest.mark.parametrize("name", list(NO_DB), ids=list(NO_DB))
def test_vital_no_db(name):
    """Runs with every DSN stripped, so «this one needs no database» is proved, not claimed."""
    env = _base_env()
    for k in DSN_ENV:
        env.pop(k, None)
    _run(name, env)


@pytest.mark.skipif(not os.getenv("RUNTIME_DATABASE_URL"), reason=WALL_DOWN)
@pytest.mark.parametrize("name", list(DB), ids=list(DB))
def test_vital_db(name, clone):
    _run(name, {**_base_env(), **clone(name)})


@pytest.mark.parametrize("name", list(SKIPPED), ids=list(SKIPPED))
def test_vital_needs_the_box(name):
    pytest.skip(SKIPPED[name])
