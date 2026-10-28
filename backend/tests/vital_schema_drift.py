"""vital_schema_drift.py — the structural gate that catches PROD-ONLY schema bugs (eng-review CRITICAL #2).

schema_runtime.sql is 100% `create table if not exists`, so EDITING a create-table block to add a COLUMN
is a SILENT NO-OP on prod (the table already exists) — the column ships on a fresh clone (vitals green)
and is MISSING on prod. This vital builds nothing new: it diffs the FRESH-from-schema clone
(rocoto_rehearsal, rebuilt this run) against PROD (rocoto). If the schema declares a runtime table/column
that prod lacks, that is exactly the no-op drift → RED. (The LAW: every new column is an explicit
`ALTER TABLE … ADD COLUMN IF NOT EXISTS`, which DOES reach prod.)

Run on prod as root:  REHEARSAL_DB=rocoto_rehearsal PROD_DB=rocoto PYTHONPATH=. venv/bin/python tests/vital_schema_drift.py
"""
import os
import subprocess

REHEARSAL = os.environ.get("REHEARSAL_DB", "rocoto_rehearsal")
PROD = os.environ.get("PROD_DB", "rocoto")
R = []


def ck(name, ok, detail=""):
    R.append(bool(ok))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


def _q(db, sql):
    r = subprocess.run(["sudo", "-u", "postgres", "psql", "-d", db, "-tAc", sql], capture_output=True, text=True)
    return set(x.strip() for x in r.stdout.splitlines() if x.strip())


def main():
    print(f"VITAL: schema-drift ({REHEARSAL} fresh-from-schema  vs  {PROD} prod)")
    reh_tables = _q(REHEARSAL, "SELECT table_name FROM information_schema.tables WHERE table_schema='public'")
    prod_tables = _q(PROD, "SELECT table_name FROM information_schema.tables WHERE table_schema='public'")
    reh_cols = _q(REHEARSAL, "SELECT table_name||'.'||column_name FROM information_schema.columns WHERE table_schema='public'")
    prod_cols = _q(PROD, "SELECT table_name||'.'||column_name FROM information_schema.columns WHERE table_schema='public'")

    if not reh_tables:
        ck("clone reachable (fresh-from-schema tables found)", False, "no tables in the clone — rebuild it first")
        print("\nSCHEMA DRIFT: 0/1 — clone empty")
        return 1

    # every RUNTIME table the schema defines must exist on prod
    missing_tables = sorted(t for t in reh_tables if t not in prod_tables)
    ck(f"every schema-defined runtime table exists on prod ({len(reh_tables)} tables)",
       not missing_tables, ("missing on prod: " + ", ".join(missing_tables)) if missing_tables else "")

    # every column the schema declares (for a table that DOES exist on prod) must exist on prod
    # — this is the create-table-no-op catcher.
    drift_cols = sorted(c for c in reh_cols
                        if c.split(".")[0] in prod_tables and c not in prod_cols)
    ck("every schema-declared column reached prod (no create-table-no-op drift)",
       not drift_cols, ("MISSING on prod: " + ", ".join(drift_cols)) if drift_cols else f"{len(reh_cols)} columns aligned")

    # informational: prod columns absent from the schema file (usually legacy / additive-on-prod) — not a failure
    ahead = sorted(c for c in prod_cols if c.split(".")[0] in reh_tables and c not in reh_cols)
    if ahead:
        print(f"  [NOTE] {len(ahead)} prod column(s) not in schema_runtime.sql (legacy/ALTER-added, informational):"
              f" {', '.join(ahead[:8])}{' …' if len(ahead) > 8 else ''}")

    passed = sum(R)
    print(f"\nSCHEMA DRIFT: {passed}/{len(R)} — {'NO DANGEROUS DRIFT (schema ⊆ prod)' if passed == len(R) else 'DRIFT — a schema edit never reached prod'}")
    return 0 if passed == len(R) else 1


raise SystemExit(main())
