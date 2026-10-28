#!/usr/bin/env python3
"""prod-ip-gate.py — the decommissioned box is named in ONE file, and this is what says so.

Rocoto moved from Hetzner Ashburn to Hetzner Nuremberg on 2026-08-19. `deploy/prod-host.sh` holds
the whole story and the guard; the short version is the part that matters here: THE OLD BOX IS
STILL ALIVE. It still answers SSH, it still holds a `/opt/rocoto`, and it still serves other
products. A command aimed at the old address therefore lands on a real machine, does what it was
told, and reports success. Nothing looks wrong until someone wonders why the fix never shipped.

`assert_prod_box` in `deploy/prod-host.sh` refuses that address at run time. This gate closes the
other half: the address must not be written down anywhere a person or an agent can copy it out of.
A runbook line is a command someone will paste, and the eight hand-written copies this gate first
found were exactly that.

THE RULE. The literal old address appears in exactly one tracked file — `deploy/prod-host.sh`,
which exports it as `ROCOTO_OLD_IP` so the refusal can name it. Every other tracked file names
production as `$ROCOTO_PROD` after sourcing that file, or says «the prod box» in prose.

THE ADDRESS ITSELF IS NOT WRITTEN HERE. The gate reads `ROCOTO_OLD_IP` out of `deploy/prod-host.sh`
and searches for whatever that says, so this file does not become a second place to find it. A
missing guard, a missing variable or an empty file listing is a RED run, never a clean one.

NO TREE IS EXCLUDED. `company/` used to be, because the business canon records the old address as
a fact about a machine that hosts Cancha, Hermes and the Sancho demo — true, and never executed
against Rocoto's production. The canon moved to its own repository on 2026-09-07 (decision record
0010), so every tree left here is operational: `deploy/` runs, and `docs/` is read by the next
session as a runbook. The exclusion list is empty, and the gate is that much stricter for it.

RUN, from the repository root:

    python3 tools/prod-ip-gate.py

PROVE IT RED BEFORE TRUSTING IT. Paste the old address into any tracked file outside
`deploy/prod-host.sh`, run the gate, watch it name that file and line and exit 1, take it back out.
"""
from __future__ import annotations

import pathlib
import re
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[1]
GUARD = pathlib.Path("deploy/prod-host.sh")          # the one file allowed to name the old box
EXCLUDED_TREES: tuple[str, ...] = ()                  # nothing is excluded any more — see above
OLD_IP_DECL = re.compile(r'^\s*ROCOTO_OLD_IP="([^"]+)"', re.M)


def old_address() -> str:
    """The address to hunt for, read from the guard so this file never spells it out."""
    guard = ROOT / GUARD
    if not guard.is_file():
        raise SystemExit(f"RED · the guard is missing at {GUARD} — the gate cannot know what to refuse")
    found = OLD_IP_DECL.search(guard.read_text(encoding="utf-8"))
    if not found:
        raise SystemExit(f"RED · {GUARD} declares no ROCOTO_OLD_IP — the gate has nothing to hunt for")
    return found.group(1)


def tracked_files() -> list[pathlib.Path]:
    """Every file git tracks. An empty listing is a red run: it means we searched nothing."""
    try:
        out = subprocess.run(
            ["git", "-C", str(ROOT), "ls-files", "-z"],
            capture_output=True, check=True,
        ).stdout
    except (OSError, subprocess.CalledProcessError) as exc:
        raise SystemExit(f"RED · could not list the tracked files ({exc}) — «I could not look» is not «clean»")
    files = [pathlib.PurePosixPath(name.decode()) for name in out.split(b"\0") if name]
    if not files:
        raise SystemExit("RED · git tracks no files here — the gate searched nothing")
    return [pathlib.Path(f) for f in files]


def main() -> int:
    needle = old_address().encode()
    hits: list[tuple[str, int, str]] = []
    searched = 0
    for rel in tracked_files():
        posix = rel.as_posix()
        if posix == GUARD.as_posix() or posix.startswith(EXCLUDED_TREES):
            continue
        path = ROOT / rel
        if not path.is_file():          # a submodule or a broken link, not our subject
            continue
        blob = path.read_bytes()
        searched += 1
        if needle not in blob:
            continue
        for number, line in enumerate(blob.split(b"\n"), 1):
            if needle in line:
                hits.append((posix, number, line.decode("utf-8", "replace").strip()[:140]))

    for posix, number, line in hits:
        print(f"{posix}:{number}: {line}")
    if hits:
        print(
            f"\nRED · {len(hits)} line(s) name the decommissioned box outside {GUARD}.\n"
            f"That machine still answers SSH and still holds a /opt/rocoto, so a command pasted from\n"
            f"one of these lines lands on it and reports success. Source {GUARD} and use $ROCOTO_PROD,\n"
            f"or name the box in prose. deploy/prod-host.sh explains the swap."
        )
        return 1
    print(f"GREEN · {searched} tracked files searched · the decommissioned box is named only in {GUARD}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
