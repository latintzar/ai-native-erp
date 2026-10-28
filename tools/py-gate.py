#!/usr/bin/env python3
"""py-gate.py — the Python lint and the Python types, each against a baseline that only counts down.

86,000 lines of annotated Python and, until this file, no linter and no type checker ran anywhere;
the app side of the same CI job has gated on `tsc --noEmit` for months. Turning either tool on
whole is not an option — ruff finds 2,608 things and mypy 1,225 — and a gate nobody can make green
is a gate somebody switches off.

So: a RATCHET. Every finding that exists today is written down in a baseline file. The gate fails
on a finding that is NOT in the baseline, which is the whole point — new code is clean code. It
ALSO fails when the baseline names a finding that no longer exists, because a baseline nobody
shrinks is a list of debts nobody pays: fixing something makes the gate red until you run
`--update`, and `--update` writes the smaller number in a commit somebody reads.

    python3 tools/py-gate.py                # both, the way `make gates` runs it
    python3 tools/py-gate.py ruff           # ruff only
    python3 tools/py-gate.py types          # mypy only
    python3 tools/py-gate.py ruff --update  # after fixing something: shrink the baseline

`--update` REFUSES TO GROW. Against an existing baseline it writes only when the run holds no
finding the baseline lacks, so the one command that edits the file cannot be the way a new finding
gets blessed. It does take the FIRST baseline when the file is absent — which makes deleting a
committed baseline the only way to grow one, and that is a red line in a diff. Adding a finding on
purpose is an edit to the .json, with a reason in the commit message.

WHAT A FINDING IS, for the comparison: the triple (path, rule code, message), counted. Line numbers
are deliberately out — an import added at the top of a file would otherwise renumber every finding
below it and the gate would fail on a thousand things nobody touched. Two identical findings in one
file are two, so deleting one of them still counts down.

THE TYPES GATE READS NO INSTALLED PACKAGE (`no_site_packages` in pyproject.toml). Its answer is a
function of this repository's source and the mypy pin, and of nothing else — so it is the same
answer on a laptop, in CI, and on a box that has never installed the backend, and a dependabot bump
cannot turn it red. What that costs is written down beside the setting.

THE TOOL VERSION IS PART OF THE BASELINE. A different ruff finds different things; without this
check the upgrade would arrive as several hundred unexplained findings. `tools/requirements-dev.txt`
pins both tools, and the gate names it when the versions disagree.

PROVE IT RED BEFORE TRUSTING IT. Add `import os` to a file under backend/ that does not use it and
run the ruff gate; delete a `-> str` from a function that returns an int and run the types gate.
Both name the file, the rule and the line, and exit 1.
"""
from __future__ import annotations

import argparse
import json
import pathlib
import re
import subprocess
import sys
from collections import Counter

ROOT = pathlib.Path(__file__).resolve().parents[1]
TOOLS = ROOT / "tools"

# Every root that holds Python this repository owns. `app/`, `docs/` and `library/` are out, and
# pyproject.toml's extend-exclude says the same thing to ruff.
ROOTS = ("backend", "mock-api", "tools", "drives", "deploy")

RUFF_BASELINE = TOOLS / "ruff-baseline.json"
MYPY_BASELINE = TOOLS / "mypy-baseline.json"
PINS = "tools/requirements-dev.txt"

# mypy writes `path:line: error: message  [code]`, and drops the line number for a whole-file
# complaint. `note:` lines hang off the error above them and are not findings of their own.
MYPY_LINE = re.compile(
    r"^(?P<path>[^:]+?):(?:(?P<line>\d+):)?\s*(?P<severity>error|warning):\s*(?P<message>.*)$"
)
MYPY_CODE = re.compile(r"\s+\[(?P<code>[a-z0-9-]+)\]$")

MAX_SHOWN = 40


# ── running the two tools ────────────────────────────────────────────────────────────────────────

def _run(argv: list[str], cwd: pathlib.Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(argv, cwd=cwd, capture_output=True, text=True)


def _version(module: str) -> str:
    out = _run([sys.executable, "-m", module, "--version"], ROOT)
    if out.returncode != 0:
        raise SystemExit(
            f"RED · `{sys.executable} -m {module} --version` failed. The gate needs both tools at the\n"
            f"pinned versions:  pip install -r {PINS}\n\n{out.stderr.strip()}"
        )
    # ruff prints "ruff 0.16.6"; mypy prints "mypy 2.3.1 (compiled: yes)".
    return out.stdout.strip().split()[1]


def collect_ruff() -> Counter[tuple[str, str, str]]:
    """Every ruff finding in the tree, as (path, code, message) → count."""
    out = _run([sys.executable, "-m", "ruff", "check", "--no-cache", "--output-format", "json", "."], ROOT)
    if out.returncode not in (0, 1):           # 0 clean, 1 findings, anything else is a crash
        raise SystemExit(f"RED · ruff failed to run (exit {out.returncode}):\n{out.stderr.strip()}")
    found: Counter[tuple[str, str, str]] = Counter()
    for item in json.loads(out.stdout or "[]"):
        path = pathlib.Path(item["filename"]).resolve().relative_to(ROOT).as_posix()
        found[(path, item.get("code") or "", item["message"])] += 1
    return found


def collect_mypy() -> Counter[tuple[str, str, str]]:
    """Every mypy error in the tree, as (path, code, message) → count.

    One run per root, from inside it: that root is then the package base, which is what makes
    `import config` resolve in backend/ and `app.main` resolve in mock-api/. One run over all five
    would collide on the module names the roots share — `app`, `tests`, `seed`.
    """
    found: Counter[tuple[str, str, str]] = Counter()
    for root in ROOTS:
        out = _run(
            [sys.executable, "-m", "mypy", "--config-file", str(ROOT / "pyproject.toml"),
             # one cache per root: two roots hold a module called `app`, and one shared cache
             # would answer for the wrong one
             "--cache-dir", str(ROOT / ".mypy_cache" / root),
             "--no-error-summary", "--no-color-output", "--no-pretty", "."],
            ROOT / root,
        )
        if out.returncode not in (0, 1):
            raise SystemExit(
                f"RED · mypy failed to run in {root}/ (exit {out.returncode}):\n"
                f"{(out.stderr or out.stdout).strip()[:2000]}"
            )
        for line in out.stdout.splitlines():
            match = MYPY_LINE.match(line)
            if not match:
                continue
            message = match["message"]
            code_match = MYPY_CODE.search(message)
            code = code_match["code"] if code_match else ""
            if code_match:
                message = message[: code_match.start()]
            path = (pathlib.Path(root) / match["path"]).as_posix()
            found[(path, code, message.strip())] += 1
    return found


# ── the baseline file ────────────────────────────────────────────────────────────────────────────

def read_baseline(path: pathlib.Path) -> tuple[Counter[tuple[str, str, str]], str]:
    if not path.exists():
        return Counter(), ""
    blob = json.loads(path.read_text(encoding="utf-8"))
    counts: Counter[tuple[str, str, str]] = Counter()
    for row in blob["findings"]:
        counts[(row["path"], row["code"], row["message"])] = row["count"]
    return counts, blob.get("tool_version", "")


def write_baseline(
    path: pathlib.Path, tool: str, version: str, counts: Counter[tuple[str, str, str]]
) -> None:
    rows = [
        {"path": p, "code": c, "message": m, "count": n}
        for (p, c, m), n in sorted(counts.items())
    ]
    blob = {
        "tool": tool,
        "tool_version": version,
        "roots": list(ROOTS),
        "total": sum(counts.values()),
        "distinct": len(rows),
        "how": f"python3 tools/py-gate.py {'ruff' if tool == 'ruff' else 'types'} --update",
        "what": "every finding that existed when this file was written. The gate fails on a finding "
                "that is not here, and on an entry here that no longer happens. It only counts down.",
        "findings": rows,
    }
    path.write_text(json.dumps(blob, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


# ── the gate ─────────────────────────────────────────────────────────────────────────────────────

def _print_rows(title: str, rows: list[tuple[tuple[str, str, str], int]]) -> None:
    print(f"\n{title} ({len(rows)}):")
    for (path, code, message), count in rows[:MAX_SHOWN]:
        times = f" ×{count}" if count > 1 else ""
        print(f"  {path}: {code or '—'} {message}{times}")
    if len(rows) > MAX_SHOWN:
        print(f"  … and {len(rows) - MAX_SHOWN} more")


def gate(which: str, update: bool) -> int:
    tool, module, baseline_path, label = (
        ("ruff", "ruff", RUFF_BASELINE, "ruff") if which == "ruff"
        else ("mypy", "mypy", MYPY_BASELINE, "mypy")
    )
    version = _version(module)
    current = collect_ruff() if which == "ruff" else collect_mypy()
    baseline, baseline_version = read_baseline(baseline_path)

    if baseline_version and baseline_version != version:
        print(
            f"RED · {label} is {version}, and {baseline_path.relative_to(ROOT)} was taken with "
            f"{baseline_version}.\nA different version finds different things, so the comparison would be "
            f"noise. Install the pins:\n    pip install -r {PINS}\nMoving the pin on purpose means "
            f"re-taking the baseline in the same commit as the pin."
        )
        return 1

    new = [(k, n - baseline.get(k, 0)) for k, n in sorted(current.items()) if n > baseline.get(k, 0)]
    stale = [(k, n - current.get(k, 0)) for k, n in sorted(baseline.items()) if n > current.get(k, 0)]

    if update:
        if not baseline_path.exists():
            write_baseline(baseline_path, tool, version, current)
            print(
                f"GREEN · {baseline_path.relative_to(ROOT)} CREATED from nothing: "
                f"{sum(current.values())} finding(s). Every later --update can only shrink it, so "
                f"deleting this file is the one way to grow it — and that shows in the diff."
            )
            return 0
        if new:
            _print_rows(
                f"RED · --update refuses to grow the baseline; {label} finds these and it does not", new
            )
            print(
                f"\nFix them, or edit {baseline_path.relative_to(ROOT)} by hand, "
                f"with the reason in the commit."
            )
            return 1
        before = sum(baseline.values())
        write_baseline(baseline_path, tool, version, current)
        after = sum(current.values())
        print(
            f"GREEN · {baseline_path.relative_to(ROOT)} rewritten: {before} → {after} findings"
            + (f" ({before - after} paid off)" if before > after else " (unchanged)")
        )
        return 0

    if not baseline_path.exists():
        print(
            f"RED · {baseline_path.relative_to(ROOT)} is missing, and this gate is only meaningful "
            f"against one.\nTake it with:  python3 tools/py-gate.py {which} --update"
        )
        return 1

    if new:
        _print_rows(f"RED · {len(new)} {label} finding(s) this baseline does not hold", new)
        print(
            "\nNew code is clean code: fix them. A finding that has to stay needs a `# noqa:` with the "
            "reason\n(ruff) or a `# type: ignore[code]` with the reason (mypy), which is a line a "
            "reviewer can see."
        )
        return 1

    if stale:
        _print_rows(f"RED · {len(stale)} baseline entr(ies) {label} no longer finds", stale)
        print(
            f"\nSomething got fixed and the number goes down. Run:\n"
            f"    python3 tools/py-gate.py {which} --update\n"
            f"and commit {baseline_path.relative_to(ROOT)} beside the fix."
        )
        return 1

    total = sum(current.values())
    print(
        f"GREEN · {label} {version} · {total} finding(s), every one of them in "
        f"{baseline_path.relative_to(ROOT)} · roots: {' '.join(ROOTS)}"
    )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("which", nargs="?", default="all", choices=("all", "ruff", "types"))
    parser.add_argument("--update", action="store_true",
                        help="rewrite the baseline from this run; refuses when the run holds a new finding")
    args = parser.parse_args()
    if args.which == "all" and args.update:
        parser.error("--update takes one gate at a time: `ruff` or `types`")
    if args.which == "all":
        return max(gate("ruff", False), gate("types", False))
    return gate(args.which, args.update)


if __name__ == "__main__":
    raise SystemExit(main())
