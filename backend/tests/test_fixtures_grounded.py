"""THE CHEAP GUARD: the hand-written scenario fixtures still name rows that exist.

NO DATABASE, NO MODEL, NO NETWORK — it reads the scenario files as text and checks them against
`seed/catalogue.json` and `seed/contacts.json`. It runs anywhere pytest runs, which is the whole
point: `test_pipeline_smoke.py`, `sim_live.py` and `sim_ecommerce.py` all need a live Postgres (and
two of them an LLM or a Medusa), so `deploy/harness/run_all_vitals.sh` never runs them — and that is
exactly how all three came to be asserting `sku-chops`, `sku-ribs-spare`, `sku-loin-whole`,
`sku-chorizo-fresh` and the families `sausages` / `chops_ribs` for a full day after the seed rewrite
(08a2d18bb) deleted every one of them, without a single thing going red.

`test_golden.py::test_golden_fixture_is_grounded` does this for the golden JSON fixture. This is the
same guard for the fixtures that live in PYTHON, and it checks four things:

  1. every `sku-…` literal is a real catalogue row AND `in_assortment` (a fixture that orders a row
     the house does not sell is testing the gap machinery by accident, not on purpose);
  2. every `family` / `categories` value is a real catalogue family (an ASAP rule whose category no
     line carries can never match — the chain would go green down the wrong branch);
  3. every phone number is a seeded contact or a DECLARED test number;
  4. every «<tipo> <apellido>» venue name is in contacts.json's closed `invented_names` set, and
     none of the names already caught for being real (or a person's) is back.

Add a file to SCANNED when it starts naming seeded rows. Run it directly for a scorecard:
    python -m tests.test_fixtures_grounded
"""
from __future__ import annotations

import json
import os
import re
from typing import Dict, List, Set

_HERE = os.path.dirname(os.path.abspath(__file__))
_BACKEND = os.path.dirname(_HERE)
CATALOGUE = os.path.join(_BACKEND, "seed", "catalogue.json")
CONTACTS = os.path.join(_BACKEND, "seed", "contacts.json")

# The scenario fixtures that ride the seeded world. Every one of these is excluded from the vitals
# harness because it needs infrastructure, so every one of them can rot in silence.
SCANNED = ["test_pipeline_smoke.py", "sim_live.py", "sim_ecommerce.py"]

# Numbers deliberately NOT in contacts.json, each with the reason it is not:
DECLARED_PHONES = {
    "+34000000555": "test_pipeline_smoke — a customer with NO history, so nothing can be answered "
                    "out of a standing basket",
    "+34655123987": "sim_live — the unknown caller in the live-call probe",
    "+34611950001": "sim_ecommerce — storefront chain 1",
    "+34611950002": "sim_ecommerce — storefront chain 2 (rogue customization)",
    "+34611950003": "sim_ecommerce — storefront chain 3 (overnight ASAP)",
}

# Names already caught in this repo for being REAL, or a person's, which in a screenshotted fixture
# is worse. Kept in step with test_golden.BANNED_NAMES.
BANNED_NAMES = ["Peter's Bistro", "Bar Marisol", "Collsar", "Casa Alberto", "Botín", "Casa Pepe",
                "Taberna Gil", "Gastrobar Lúa", "Casa Nieto"]

_SKU_RE = re.compile(r"\bsku-[a-z0-9]+(?:-[a-z0-9]+)*")
_PHONE_RE = re.compile(r"\+\d{9,15}")
_FAMILY_RE = re.compile(r"""["']family["']\s*:\s*["']([a-z_]+)["']""")
_CATEGORIES_RE = re.compile(r"""["']categories["']\s*:\s*\[([^\]]*)\]""")
_VENUE_RE = re.compile(
    r"\b(Bar|Casa|Taberna|Mesón|Meson|Café|Cafe|Freiduría|Freiduria|Asador|Cárnicas|Carnicas|"
    r"Restaurante|Bistro)\s+([A-ZÁÉÍÓÚÑ][\wáéíóúñ]+)")


def _load(path: str) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _world() -> Dict[str, Set[str]]:
    cat = _load(CATALOGUE)
    con = _load(CONTACTS)
    inv = con.get("invented_names") or {}
    names: Set[str] = set()
    for key, vals in inv.items():
        if key.startswith("_"):
            continue
        names.update(vals)
    names.add(con.get("business", {}).get("name", ""))
    return {
        "sku_ids": {s["id"] for s in cat["skus"]},
        "in_assortment": {s["id"] for s in cat["skus"] if s.get("in_assortment")},
        "families": {s["family"] for s in cat["skus"]},
        "phones": {c["phone"] for c in con["contacts"]},
        "invented": {n for n in names if n},
    }


def audit() -> List[str]:
    """Every problem, as one line each. Empty list = the fixtures still name real rows."""
    w = _world()
    problems: List[str] = []
    for fname in SCANNED:
        path = os.path.join(_HERE, fname)
        if not os.path.exists(path):
            problems.append(f"{fname}: SCANNED but missing")
            continue
        src = open(path, encoding="utf-8").read()
        # strip the module docstring: it is where we NAME the dead ids we removed, on purpose.
        body = src.split('"""', 2)[-1] if src.lstrip().startswith('"""') else src

        for sku in sorted(set(_SKU_RE.findall(body))):
            if sku not in w["sku_ids"]:
                problems.append(f"{fname}: {sku} is not a row in seed/catalogue.json")
            elif sku not in w["in_assortment"]:
                problems.append(f"{fname}: {sku} exists but is in_assortment=false")

        fams = set(_FAMILY_RE.findall(body))
        for m in _CATEGORIES_RE.findall(body):
            fams.update(re.findall(r"""["']([a-z_]+)["']""", m))
        for fam in sorted(fams):
            if fam not in w["families"]:
                problems.append(f"{fname}: family/category {fam!r} is not a catalogue family "
                                f"({', '.join(sorted(w['families']))})")

        for ph in sorted(set(_PHONE_RE.findall(body))):
            if ph not in w["phones"] and ph not in DECLARED_PHONES:
                problems.append(f"{fname}: phone {ph} is neither a seeded contact nor declared in "
                                f"DECLARED_PHONES")

        problems.extend(_venue_problems(fname, body, w))
    return problems


def _venue_problems(fname: str, body: str, w: Dict[str, Set[str]]) -> List[str]:
    out: List[str] = []
    for bad in BANNED_NAMES:
        if bad in body:
            out.append(f"{fname}: banned name {bad!r} is back")
    for m in _VENUE_RE.finditer(body):
        venue = m.group(0)
        if not any(venue in inv for inv in w["invented"]):
            out.append(f"{fname}: venue {venue!r} is outside contacts.json invented_names")
    return out


def audit_all_test_venues() -> List[str]:
    """The REAL-NAME half of the guard, over EVERY test file rather than the three fixtures.

    Deliberately narrower than `audit()`: it does NOT require a venue to be in contacts.json's
    invented set, because most vitals name a throwaway («Bar Prueba», «Bar Vital», «Restaurante
    Vital») and those are obviously nobody's business. It checks the one thing that actually goes
    wrong — a REAL establishment ending up in a fixture whose output gets screenshotted. That has
    now happened four times: «Casa Pepe» in test_queue.py's identity fixture and «Casa Alberto» in
    vital_trackers.py's signal draft (both fixed 2026-07-27), plus «Collsar» and «Botín» before them.

    Docstrings, `#` comments and the BANNED_NAMES literal itself are stripped first: those are where
    a file legitimately RECORDS which name it removed, and flagging the tombstone would train
    everyone to ignore the guard.
    """
    w = _world()
    out: List[str] = []
    for fname in sorted(os.listdir(_HERE)):
        if not fname.endswith(".py"):
            continue
        src = open(os.path.join(_HERE, fname), encoding="utf-8").read()
        body = re.sub(r'"""[\s\S]*?"""', "", src)          # docstrings + tombstones
        body = re.sub(r"'''[\s\S]*?'''", "", body)
        body = re.sub(r"BANNED_NAMES\s*=\s*\[[\s\S]*?\]", "", body)   # the ban list itself
        body = re.sub(r"(?m)#.*$", "", body)               # line comments
        for bad in BANNED_NAMES:
            if bad in body:
                out.append(f"{fname}: banned name {bad!r} is live in the code, not just a tombstone")
    return out


def test_no_test_names_a_real_venue():
    problems = audit_all_test_venues()
    assert not problems, "\n".join(problems)


def test_scenario_fixtures_are_grounded():
    problems = audit()
    assert not problems, "\n".join(problems)


def _main() -> int:
    w = _world()
    print(f"catalogue: {len(w['sku_ids'])} rows, {len(w['in_assortment'])} in_assortment · "
          f"{len(w['families'])} families · contacts: {len(w['phones'])} · "
          f"invented names: {len(w['invented'])}")
    for fname in SCANNED:
        path = os.path.join(_HERE, fname)
        src = open(path, encoding="utf-8").read()
        body = src.split('"""', 2)[-1] if src.lstrip().startswith('"""') else src
        skus = sorted(set(_SKU_RE.findall(body)))
        print(f"\n{fname} — {len(skus)} sku id(s) referenced")
        for s in skus:
            state = ("MISSING" if s not in w["sku_ids"]
                     else "not-in-assortment" if s not in w["in_assortment"] else "ok, in_assortment")
            print(f"    {'ok  ' if state.startswith('ok') else 'FAIL'} {s:<28} {state}")
    problems = audit()
    print("\n" + ("GROUNDED ✅ — every sku, family, phone and venue name is real"
                  if not problems else "FAIL ❌\n  " + "\n  ".join(problems)))
    vp = audit_all_test_venues()
    print("VENUE SWEEP over every tests/*.py: "
          + ("clean ✅ — no test names a real venue" if not vp else "FAIL ❌\n  " + "\n  ".join(vp)))
    return 0 if not (problems or vp) else 1


if __name__ == "__main__":
    raise SystemExit(_main())
