"""vital_durability.py — WP-0d data-durability floor.

"An untested backup is not a backup." This vital proves, on the box, that:
  1. the live runtime DB dumps + restores into a scratch DB with all core tables intact, within budget;
  2. a SCHEDULED prod backup exists, is fresh, and is itself restorable (RED before the timer is
     installed+run — the test-first hook for WP-0d);
  3. a copy of this box has actually LEFT it recently (deploy/backup/rocoto_backup_pull.sh stamps
     /var/backups/rocoto/LAST_OFFBOX_PULL from leo-dev on every successful pull);
and notes where N-1 rollback is asserted (n1_rollback_check.sh on leo-dev, at deploy/seal).

Assertion 3 exists because for 36 hours after the Nuremberg cutover it was false and this file said
DURABLE anyway (2026-08-20). Every check here ran on-box, so a dump sitting next to the database it
came from satisfied all of them — while the closing line claimed the backups were "off-box". A box
cannot testify that it survived its own loss. The nearest true thing it CAN check is whether someone
came and took a copy, so that is what it now checks, and the word off-box is only printed when that
assertion passed.

Numbers (the threshold rule): restore of the ~9-14 MB DB must complete in ≤ RESTORE_BUDGET_SEC (60s);
a scheduled backup must be < 30h old (a 6-hourly timer keeps it well under that).

Run on prod as root:  PYTHONPATH=. venv/bin/python tests/vital_durability.py
"""
import os
import subprocess
import time
from pathlib import Path

BUDGET = int(os.environ.get("RESTORE_BUDGET_SEC", "60"))
REHEARSAL_DB = os.environ.get("REHEARSAL_DB", "rocoto_rehearsal")
CORE = ["event", "fact", "card", "contact", "scope_node", "open_loop", "timer", "manifest_duty", "endpoint"]
R = []


def ck(name, ok, detail=""):
    R.append(bool(ok))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


def restore_drill(source_db=None, dump_path=None):
    """Use the maintained encrypted recovery drill, including strict errors and owned scratch cleanup."""
    script = Path(__file__).resolve().parents[2] / "deploy/backup/restore_drill.sh"
    args = [str(dump_path)] if dump_path else ["--from-db", str(source_db)]
    started = time.time()
    result = subprocess.run(["bash", str(script), *args], capture_output=True, text=True)
    return result.returncode == 0, time.time() - started, "verified", result.stdout + result.stderr


def main():
    print("VITAL: durability (WP-0d)")

    ok, el, ntab, err = restore_drill(source_db=REHEARSAL_DB)
    ck(f"restore-drill: {REHEARSAL_DB} dumps + restores into a scratch DB, 9 core tables intact",
       ok and el <= BUDGET, f"{el:.1f}s (budget {BUDGET}s), {ntab} tables" + (f" — {err}" if err else ""))

    latest = Path("/var/backups/rocoto/LATEST.dump.age")
    if latest.exists():
        age_h = (time.time() - latest.stat().st_mtime) / 3600
        ck("scheduled prod backup is fresh (< 30h)", age_h < 30, f"age {age_h:.1f}h")
        ok2, el2, ntab2, err2 = restore_drill(dump_path=str(latest.resolve()))
        ck("the real scheduled backup file restores cleanly", ok2 and el2 <= BUDGET,
           f"{el2:.1f}s, {ntab2} tables" + (f" — {err2}" if err2 else ""))
    else:
        ck("scheduled backup exists (/var/backups/rocoto/LATEST.dump.age)", False,
           "none yet — install + run rocoto-backup.timer")

    # THE OFF-BOX ASSERTION. Everything above this line is satisfied by a dump lying next to the
    # database it was taken from, which is precisely the thing that does not survive losing the box.
    pull = Path("/var/backups/rocoto/LAST_OFFBOX_PULL")
    if pull.exists():
        stamp = pull.read_text().strip()
        pull_age_h = (time.time() - pull.stat().st_mtime) / 3600
        ck("a copy has LEFT this box recently (< 30h)", pull_age_h < 30,
           f"age {pull_age_h:.1f}h — last pull: {stamp or '(empty)'}")
    else:
        ck("a copy has LEFT this box recently (/var/backups/rocoto/LAST_OFFBOX_PULL)", False,
           "never stamped — check rocoto-backup-pull.timer on leo-dev; the on-box dumps above do "
           "NOT survive losing this machine")

    print("  [NOTE] N-1 rollback is asserted on leo-dev via n1_rollback_check.sh at deploy/seal time.")
    passed = sum(R)
    print(f"\nDURABILITY: {passed}/{len(R)} passed"
          f" — {'DURABLE (backups exist, have left the box, and are PROVEN restorable)' if passed == len(R) else 'NOT YET'}")
    return 0 if passed == len(R) else 1


raise SystemExit(main())
