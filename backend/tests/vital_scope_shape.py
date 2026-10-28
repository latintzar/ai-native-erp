"""vital_scope_shape.py — NO MODULE SPELLS A SCOPE (WP-A1, A1-TENANT-SCOPE-CUTOVER.md §4).

WHAT THIS EXISTS TO PROVE. A WhatsApp party's scope is moving from `wa.<digits>` to
`t.<slug>.wa.<digits>`, because a flat scope is one row per phone and two distributors who share a
customer therefore share that customer's MEMORY (vital_multitenant §⑧).

The danger in that change is not the data — measured, the whole history is under 900 rows. It is
that the old shape was SPELLED BY HAND in 93 places, and every hand-spelling fails **silently**
under the new shape rather than crashing:

    "t.rocoto.wa.34600111222".startswith("wa.")   →  False

…so `actions.py` derives no reply address and the message goes out with no addressee; `lifecycle`'s
WhatsApp branch never runs; `phone` resolves to "". Nothing raises. Nothing logs. The eight sites
that did this are listed in §4 of the design doc and were all replaced with `tenancy.phone_of_scope`.

This vital is what stops them growing back. It is a STATIC check — it reads the source, because the
thing under test is a spelling, and no runtime assertion can catch a line that was never executed
in the test corpus. Three rules:

  1. no `startswith("wa.")`   → ask `tenancy.is_wa_scope(scope)`
  2. no `"wa." + …` / f"wa.{…}" construction → build with `tenancy.scope_of(phone, tenant)`
  3. no `scope.split(".", 1)[1]` to get a phone → read it with `tenancy.phone_of_scope(scope)`

TESTS ARE EXEMPT, on purpose: a test that asserts on a literal scope is testing the shape itself,
which is exactly what it should do. `tenancy.py` is exempt because it IS the one home.

Standalone:  PYTHONPATH=. python tests/vital_scope_shape.py     (no DB, no network)
Nonzero exit on any failure.
"""
from __future__ import annotations

import os
import re
import sys

BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# The one home for the shape, plus the two places allowed to name it for their own reasons.
EXEMPT = {
    "tenancy.py": "THE one home — scope_of / is_wa_scope / phone_of_scope live here",
    # Phase C deletes this line; it is the flat-vs-pathed conditional the cutover exists to kill,
    # and it is named in the design doc §3 rather than hidden behind an exemption.
    os.path.join("brain", "seed.py"): "seed.py:3111's prefix conditional — deleted in phase C",
}

RULES = [
    ("startswith-wa", re.compile(r'\.startswith\(\s*["\']wa\.["\']'),
     "use tenancy.is_wa_scope(scope) — this predicate is False for a pathed scope, silently"),
    ("construct-wa", re.compile(r'(f["\']wa\.\{|["\']wa\.["\']\s*\+)'),
     "use tenancy.scope_of(phone, tenant) — one spelling, so phase M is one line"),
]

R: list[bool] = []


def ck(name: str, ok: bool, detail: str = "") -> None:
    R.append(bool(ok))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


def strip_comments_and_docstrings(src: str) -> str:
    """Blank out # comments and triple-quoted blocks, keeping line numbers.

    Without this the check fails on its own explanatory prose — and a guard that cannot survive
    being documented gets deleted rather than fixed.
    """
    src = re.sub(r'("""|\'\'\')(?:.|\n)*?\1',
                 lambda m: re.sub(r"[^\n]", " ", m.group(0)), src)
    return re.sub(r"(?m)#.*$", "", src)


def scan() -> dict[str, list[tuple[str, int, str]]]:
    hits: dict[str, list[tuple[str, int, str]]] = {k: [] for k, _, _ in RULES}
    for dirpath, dirnames, filenames in os.walk(BACKEND):
        dirnames[:] = [d for d in dirnames
                       if d not in ("tests", "__pycache__", "scratch", "migrations", "venv")]
        for fn in sorted(filenames):
            if not fn.endswith(".py"):
                continue
            path = os.path.join(dirpath, fn)
            rel = os.path.relpath(path, BACKEND)
            if rel in EXEMPT:
                continue
            src = strip_comments_and_docstrings(open(path, encoding="utf-8", errors="replace").read())
            for i, line in enumerate(src.split("\n"), 1):
                for key, rx, _ in RULES:
                    if rx.search(line):
                        hits[key].append((rel, i, line.strip()[:88]))
    return hits


def main() -> int:
    print("── vital_scope_shape · no module spells a scope (WP-A1 §4) ──")
    hits = scan()

    for key, _, fix in RULES:
        found = hits[key]
        ck(f"{key}: zero occurrences outside tenancy.py",
           not found,
           "" if not found else f"{len(found)} — {fix}")
        for rel, ln, text in found[:12]:
            print(f"          {rel}:{ln}  {text}")

    # The helpers must actually exist and answer for BOTH shapes — a guard that points at a
    # missing function is worse than no guard.
    sys.path.insert(0, BACKEND)
    import tenancy  # noqa: E402

    ck("is_wa_scope accepts both shapes",
       tenancy.is_wa_scope("wa.34600111222") and tenancy.is_wa_scope("t.rocoto.wa.34600111222"))
    ck("is_wa_scope rejects non-wa scopes",
       not tenancy.is_wa_scope("t.rocoto.c.42") and not tenancy.is_wa_scope("test.try.abc")
       and not tenancy.is_wa_scope(""))
    ck("phone_of_scope reads both shapes",
       tenancy.phone_of_scope("wa.34600111222") == "+34600111222"
       and tenancy.phone_of_scope("t.rocoto.wa.34600111222") == "+34600111222")
    ck("phone_of_scope returns '' rather than a guess",
       tenancy.phone_of_scope("t.rocoto.c.42") == "" and tenancy.phone_of_scope("voice.demo") == "")
    ck("hyphenated slugs survive the round trip (casa-vega is a live slug)",
       tenancy.phone_of_scope("t.casa-vega.wa.12025550110") == "+12025550110")
    ck("scope_of round-trips through phone_of_scope",
       tenancy.phone_of_scope(tenancy.scope_of("+34 600 111 222")) == "+34600111222")
    # ── the writer, in BOTH modes ────────────────────────────────────────────────────────────
    # ROCOTO_SCOPE_PATHED is the phase-M switch and it is read at import, so each mode is proved in
    # its own interpreter. Both are asserted on purpose: the flag ships OFF and is turned on in a
    # separate deploy, so "off behaves exactly as phase E" is as load-bearing as "on paths it".
    import subprocess

    def writer(env_on: bool, tenant: str) -> str:
        env = dict(os.environ, ROCOTO_SCOPE_PATHED="1" if env_on else "")
        out = subprocess.run(
            [sys.executable, "-c",
             "import tenancy;print(tenancy.scope_of('+34 600 111 222', %r))" % (tenant or None)],
            cwd=BACKEND, env=env, capture_output=True, text=True)
        return (out.stdout or "").strip() or f"ERR:{(out.stderr or '')[-90:]}"

    ck("flag OFF: flat, tenant ignored (phase E behaviour, unchanged)",
       writer(False, "rocoto") == "wa.34600111222", writer(False, "rocoto"))
    ck("flag ON + tenant: the party is OWNED",
       writer(True, "rocoto") == "t.rocoto.wa.34600111222", writer(True, "rocoto"))
    ck("flag ON, NO tenant: flat — an absent tenant is never defaulted to BRAIN_TENANT",
       writer(True, "") == "wa.34600111222", writer(True, ""))
    ck("flag ON: a hyphenated slug still builds (casa-vega is live; PG16 accepts the label)",
       writer(True, "casa-vega") == "t.casa-vega.wa.34600111222", writer(True, "casa-vega"))
    ck("both shapes read back to the same phone",
       tenancy.phone_of_scope("t.rocoto.wa.34600111222") == tenancy.phone_of_scope("wa.34600111222"))

    ok = all(R)
    print(f"\n  {sum(R)}/{len(R)} " + ("PASS" if ok else "— ❌ FAILED"))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
