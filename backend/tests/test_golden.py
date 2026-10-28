"""Stage-6 SHIP GATE: the golden eval. Real customer messages from the seeded world, run through the
REAL pipeline against the REAL catalogue (seed/catalogue.json — Cárnicas Aldonza, Mercamadrid), in
es-ES, asserting two different things in one file:

  · buckets 1-7 (reference · discourse · implicit · change · identity · grounding · voice) — WHAT WAS
    UNDERSTOOD: {sku, qty, unit} + delivery date + "it was not filled silently".
  · bucket 8 (`doubt`) — THE LAW (SPEC §5.7/§5.7a): who gets asked, how many times, with how many
    options, and what must never reach the customer at all. Read off the `_doubt` verdict that
    `pipeline._compute` rides out beside the order, so these assert the faculty's decision itself and
    not a paraphrase of it.

Run as the canonical gate:  pytest tests/test_golden.py -q -s
Or for a per-case scorecard:  python -m tests.test_golden

⚠️ THE ROT THIS FILE IS NOW FENCED AGAINST. `test_golden_eval` needs a DATABASE and an LLM, so
`deploy/harness/run_all_vitals.sh` does not run it — which is exactly how the whole fixture came to
be expecting sku ids (`sku-chops`, `sku-ribs-spare`, …) that a catalogue rewrite had deleted, without
one thing going red. So `test_golden_fixture_is_grounded` below asserts the fixture against
`seed/catalogue.json`, `seed/contacts.json` and `doubt.py` with NO DATABASE, NO MODEL and NO NETWORK:
it runs anywhere pytest runs, and the next id rename fails loudly on the spot. The heavy imports live
INSIDE `_run_all` for the same reason — a missing asyncpg must not take the cheap guard down with it
at collection time.
"""
from __future__ import annotations

import asyncio
import datetime as _dt
import json
import os
import re
from collections import defaultdict
from typing import Any, Dict, List

_HERE = os.path.dirname(os.path.abspath(__file__))
_BACKEND = os.path.dirname(_HERE)
CASES = os.path.join(_HERE, "fixtures", "golden_cases.json")
CATALOGUE = os.path.join(_BACKEND, "seed", "catalogue.json")
CONTACTS = os.path.join(_BACKEND, "seed", "contacts.json")
CONCURRENCY = 3

# Numbers deliberately NOT in contacts.json: the identity bucket needs one message arriving from a
# number we have never seen. Anything else must be a seeded contact, or the case is testing a
# customer who does not exist and will fail for the wrong reason.
UNKNOWN_PHONES = {"+34699999999"}

# Names already caught in this repo for being REAL (or being a person's, which is worse in a fixture
# that gets screenshotted). The invented set itself is read from contacts.json, so it stays one list.
# Kept in step with tests/test_fixtures_grounded.BANNED_NAMES, which sweeps the same list across
# every tests/*.py. The last three were added 2026-07-27 after the same rot turned up outside the
# golden fixture: «Taberna Gil» in brain/baskets.py, «Gastrobar Lúa» in its docstring, «Casa Nieto»
# across the delivery-map fixtures.
BANNED_NAMES = ["Peter's Bistro", "Bar Marisol", "Collsar", "Casa Alberto", "Botín", "Casa Pepe",
                "Taberna Gil", "Gastrobar Lúa", "Casa Nieto"]
# A venue in a message reads as «<tipo> <apellido>». Used to catch a NEW invented-looking name
# slipping in without going through contacts.json's `invented_names`.
_VENUE_RE = re.compile(
    r"\b(Bar|Casa|Taberna|Mesón|Meson|Café|Cafe|Freiduría|Freiduria|Asador|Cárnicas|Carnicas|"
    r"Restaurante|Bistro|Mesón)\s+([A-ZÁÉÍÓÚÑ][\wáéíóúñ]+)")


def _load(path: str) -> Dict[str, Any]:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _eval_case(case: Dict[str, Any], order: Dict[str, Any]) -> List[str]:
    exp = case["expect"]
    lines = (order or {}).get("lines", [])
    verdict = (order or {}).get("_doubt") or {}
    dlines = verdict.get("lines") or []
    asks = verdict.get("ask") or []
    by_sku: Dict[str, Any] = {}
    for ln in lines:
        by_sku.setdefault(ln.get("sku_id"), ln)
    problems: List[str] = []
    for el in exp.get("lines", []):
        ln = by_sku.get(el["sku"])
        if not ln:
            problems.append(f"missing {el['sku']}")
            continue
        if "qty" in el and ln.get("qty") != el["qty"]:
            problems.append(f"{el['sku']} qty {ln.get('qty')}≠{el['qty']}")
        if "unit" in el and ln.get("unit") != el["unit"]:
            problems.append(f"{el['sku']} unit {ln.get('unit')}≠{el['unit']}")
    for sk in exp.get("absent", []):
        if sk in by_sku:
            problems.append(f"should be absent: {sk}")
    if exp.get("no_clean"):
        # Scoped to the sku set this case EXPECTS: on a pure out-of-assortment message that is the
        # old assertion unchanged (nothing may fill clean), and on a mixed order it is the stronger
        # one — the lines we sell fill, the gap does not quietly become a product.
        want = {el["sku"] for el in exp.get("lines", [])}
        for ln in lines:
            if ln.get("attention") == "clean" and ln.get("sku_id") and ln["sku_id"] not in want:
                problems.append(f"filled clean off-list: {ln['sku_id']} ({ln.get('mention')!r})")
    if exp.get("date"):
        dd = (order or {}).get("delivery_date")
        if exp["date"] == "tomorrow":
            tmr = (_dt.date.today() + _dt.timedelta(days=1)).isoformat()
            if dd != tmr:
                problems.append(f"date {dd}≠tomorrow({tmr})")
        elif not dd:
            problems.append("delivery date missing")
    if exp.get("doubt"):
        if not any(ln.get("attention") in ("note", "underline") or ln.get("keep_in_mind") for ln in lines):
            problems.append("expected a keep-in-mind/doubt, none present")

    # ── §5.7a: the faculty's own verdict. Anything below needs `_doubt`, and its absence is itself a
    # failure on these cases — an order that came back through the Phase-A fallback never consulted
    # the faculty, so "no verdict" must never read as "nothing to doubt".
    law_keys = ("doubt_kinds", "ask_direction", "not_asked", "to_comercial",
                "max_questions", "max_options", "no_doubt")
    if any(k in exp for k in law_keys) and not verdict:
        problems.append("no doubt verdict on the order (_doubt missing — fallback path?)")
        return problems
    for kind in exp.get("doubt_kinds", []):
        if not any(d.get("kind") == kind for d in dlines):
            got = sorted({str(d.get("kind")) for d in dlines if d.get("kind")}) or ["none"]
            problems.append(f"expected doubt kind {kind}, got {got}")
    if exp.get("ask_direction"):
        if not asks:
            problems.append(f"expected a question to the {exp['ask_direction']}, none asked")
        else:
            bad = [d.get("direction") for d in asks if d.get("direction") != exp["ask_direction"]]
            if bad:
                problems.append(f"asked the wrong side: {bad}≠{exp['ask_direction']}")
    if exp.get("not_asked") and asks:
        problems.append(f"asked the customer {len(asks)} question(s); this one is the comercial's")
    if exp.get("to_comercial") and not any(d.get("direction") == "comercial" for d in dlines):
        problems.append("nothing routed to the comercial")
    if "max_questions" in exp and len(asks) > exp["max_questions"]:
        problems.append(f"{len(asks)} questions > budget {exp['max_questions']}")
    if "max_options" in exp:
        for d in asks:
            n = len(d.get("candidates") or [])
            if n > exp["max_options"]:
                problems.append(f"{n} options on «{d.get('mention')}» > {exp['max_options']} "
                                f"(+ the escape row = more buttons than Meta allows)")
    if exp.get("no_doubt"):
        if asks:
            problems.append(f"asked again about «{asks[0].get('mention')}» — already learned")
        kinds = sorted({str(d.get("kind")) for d in dlines if d.get("kind")})
        if kinds:
            problems.append(f"expected nothing doubted, got {kinds}")
    return problems


async def _run_all() -> Dict[str, Any]:
    # Imported here on purpose — see the module docstring. The cheap fixture guard must survive a box
    # with no database driver installed.
    import db
    from brain import pipeline, seed

    await db.init()
    pool = db.get_pool()
    async with pool.acquire() as con:
        if not await con.fetchval("select count(*) from orders where seeded"):
            await seed.refresh_seed()
    cases = _load(CASES)["cases"]
    sem = asyncio.Semaphore(CONCURRENCY)

    async def one(case):
        async with sem:
            try:
                order = await pipeline.run_message(case["text"], phone=case["phone"])
            except Exception as e:
                return case, None, [f"pipeline error: {e}"]
            return case, order, _eval_case(case, order)

    results = await asyncio.gather(*[one(c) for c in cases])
    return {"results": results, "total": len(cases)}


def _report(run: Dict[str, Any]) -> bool:
    by_bucket = defaultdict(lambda: [0, 0])
    failed = []
    for case, order, problems in run["results"]:
        ok = not problems
        b = by_bucket[case["bucket"]]
        b[1] += 1
        if ok:
            b[0] += 1
        else:
            failed.append((case, order, problems))
    print("\n===== Golden eval scorecard =====")
    total_ok = sum(v[0] for v in by_bucket.values())
    for bucket, (ok, n) in sorted(by_bucket.items()):
        print(f"  {bucket:11s} {ok}/{n}")
    print(f"  {'TOTAL':11s} {total_ok}/{run['total']}")
    if failed:
        print("\n-- failures --")
        for case, order, problems in failed:
            got = [(l.get('sku_id'), l.get('qty'), l.get('attention')) for l in (order or {}).get('lines', [])]
            verdict = (order or {}).get("_doubt") or {}
            kinds = sorted({str(d.get("kind")) for d in (verdict.get("lines") or []) if d.get("kind")})
            print(f"  [{case['bucket']}] {case['text']!r}\n     probes: {case.get('probes', '—')}"
                  f"\n     problems: {problems}\n     got: {got}  date={(order or {}).get('delivery_date')}"
                  f"  doubt={kinds or 'none'} asked={len(verdict.get('ask') or [])}")
    return not failed


# ── the cheap gate: no database, no model, no network ────────────────────────────────────────────
def check_fixture_grounded() -> List[str]:
    """Every id / phone / name in the fixture must exist in the seeded world, and every law
    expectation must be a law the code actually has. Pure file reads — this is the guard that would
    have caught the English-sku rot the day the catalogue was replaced."""
    import doubt  # dependency-free module (typing only): the kinds and the budget are ITS numbers

    fx = _load(CASES)
    cat = _load(CATALOGUE)
    con = _load(CONTACTS)
    skus = {s["id"]: s for s in cat["skus"]}
    phones = {c["phone"] for c in con["contacts"]}
    invented = [n for k, v in (con.get("invented_names") or {}).items()
                if not k.startswith("_") and isinstance(v, list) for n in v]
    kinds = {doubt.AMBIGUOUS, doubt.DIMENSIONLESS, doubt.UNIT, doubt.THIN, doubt.UNKNOWN,
             doubt.CONFLICT, doubt.UNGROUNDED}
    problems: List[str] = []

    for i, case in enumerate(fx["cases"]):
        tag = f"[{i} {case.get('bucket')}] {case.get('text', '')[:40]!r}"
        exp = case.get("expect") or {}
        if not case.get("probes"):
            problems.append(f"{tag} has no `probes` — a case nobody can read is a case nobody maintains")
        for sku in [el["sku"] for el in exp.get("lines", [])] + list(exp.get("absent", [])):
            if sku not in skus:
                problems.append(f"{tag} references {sku}, which is not in seed/catalogue.json")
            elif not skus[sku].get("in_assortment", True):
                problems.append(f"{tag} expects {sku}, which is loaded but NOT sellable "
                                f"(in_assortment=false)")
        if case["phone"] not in phones and case["phone"] not in UNKNOWN_PHONES:
            problems.append(f"{tag} is from {case['phone']}, which is neither a seeded contact nor a "
                            f"declared unknown-number probe")
        for kind in exp.get("doubt_kinds", []):
            if kind not in kinds:
                problems.append(f"{tag} expects doubt kind {kind!r}, which doubt.py does not have")
        if exp.get("max_questions", 0) > doubt.QUESTION_BUDGET:
            problems.append(f"{tag} allows {exp['max_questions']} questions; the budget is "
                            f"{doubt.QUESTION_BUDGET}")
        if exp.get("max_options", 0) > doubt.MAX_CANDIDATES:
            problems.append(f"{tag} allows {exp['max_options']} options; MAX_CANDIDATES is "
                            f"{doubt.MAX_CANDIDATES}")
        text = case.get("text", "")
        for bad in BANNED_NAMES:
            if bad.lower() in text.lower():
                problems.append(f"{tag} names {bad!r} — outside the invented set (LOCKED LAW)")
        for m in _VENUE_RE.finditer(text):
            if not any(m.group(0).lower() in n.lower() for n in invented):
                problems.append(f"{tag} names «{m.group(0)}», which is not in contacts.json's "
                                f"invented_names")
    return problems


def test_golden_fixture_is_grounded():
    problems = check_fixture_grounded()
    assert not problems, "golden fixture is stale:\n  " + "\n  ".join(problems)


def test_golden_eval():
    import config
    if not config.ANTHROPIC_API_KEY:
        import pytest
        pytest.skip("the golden eval runs the model: set ANTHROPIC_API_KEY to run it "
                    "(a skip is a visible «unchecked», never a pass)")
    run = asyncio.run(_run_all())
    ok = _report(run)
    assert ok, "golden eval had failures (see scorecard above; run with -s)"


if __name__ == "__main__":
    import sys
    stale = check_fixture_grounded()
    if stale:
        print("===== golden fixture is STALE (no DB needed to know this) =====")
        for p in stale:
            print("  " + p)
        sys.exit(1)
    print(f"fixture grounded: {len(_load(CASES)['cases'])} cases, every sku/phone/name real ✅")
    run = asyncio.run(_run_all())
    sys.exit(0 if _report(run) else 1)
