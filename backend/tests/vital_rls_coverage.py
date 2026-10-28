"""vital_rls_coverage.py — the structural gate that catches an UNPROTECTED scope table (eng-review CRITICAL #3).

vital_rls proves the isolation BEHAVIOUR on a couple of tables; this proves COVERAGE: EVERY table that
carries a `scope` column is inside the RLS regime — FORCE row-level security + a `<table>_scope` policy +
a `rocoto_rt` grant. A new scope-keyed table added to schema_runtime.sql but forgotten in schema_rls.sql
would get `permission denied` for rocoto_rt on prod (invisible on an owner-DSN box) — this catches it at
build time. Run against the RLS-ON clone.

Run on prod as root:  REHEARSAL_DB=rocoto_rehearsal PYTHONPATH=. venv/bin/python tests/vital_rls_coverage.py
"""
import os
import subprocess

DB = os.environ.get("REHEARSAL_DB", "rocoto_rehearsal")
# `sudo -u postgres` exists on the production box and nowhere else, which kept this gate — the one
# that catches an unfenced scope table — off every runner but prod. A DSN answers the same catalogue
# questions, so a runner with no `postgres` user falls back to one (tests/rls_wall.py hands out
# SETUP_DSN). The sudo path stays FIRST and unchanged: on the box nothing about this gate moves.
DSN = os.environ.get("SETUP_DSN") or os.environ.get("REHEARSAL_DSN") or ""
R = []


def ck(name, ok, detail=""):
    R.append(bool(ok))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


def _q_dsn(sql):
    import asyncio

    import asyncpg

    async def _go():
        con = await asyncpg.connect(DSN)
        try:
            return [str(r[0]).strip() for r in await con.fetch(sql) if str(r[0]).strip()]
        finally:
            await con.close()

    return asyncio.run(_go())


def _q(sql):
    # `-n`: never prompt. A sudo that sat waiting for a password would look exactly like a hung gate.
    try:
        r = subprocess.run(["sudo", "-n", "-u", "postgres", "psql", "-d", DB, "-tAc", sql],
                           capture_output=True, text=True)
        if r.returncode == 0:
            return [x.strip() for x in r.stdout.splitlines() if x.strip()]
    except OSError:
        pass
    if not DSN:
        raise SystemExit("rls-coverage: no `sudo -u postgres` here and no SETUP_DSN exported — "
                         'build the wall first: eval "$(python3 tests/rls_wall.py)"')
    return _q_dsn(sql)


# Documented PRE-SCOPE plumbing (schema_rls.sql): these carry a `scope` column but are HOW you resolve
# the scope, so they cannot themselves be scope-gated (you'd need the scope to read the row that tells
# you the scope). They are granted directly to rt/ctrl and only ever reached through scope-bounded
# joins. A NEW table here must be added deliberately + documented — never to silence a real gap.
PRE_SCOPE = {"entity_map"}


def main():
    print(f"VITAL: rls-coverage ({DB}, RLS-ON clone)")

    all_scope_tables = _q("SELECT table_name FROM information_schema.columns "
                          "WHERE table_schema='public' AND column_name='scope' ORDER BY table_name")
    scope_tables = [t for t in all_scope_tables if t not in PRE_SCOPE]
    excluded = [t for t in all_scope_tables if t in PRE_SCOPE]
    ck("scope-keyed tables discovered", len(scope_tables) >= 10, f"{len(scope_tables)} scope tables"
       + (f" (pre-scope excluded: {', '.join(excluded)})" if excluded else ""))

    forced = set(_q("SELECT relname FROM pg_class WHERE relforcerowsecurity"))
    no_force = [t for t in scope_tables if t not in forced]
    ck("every scope table has FORCE row-level security",
       not no_force, ("NOT forced: " + ", ".join(no_force)) if no_force else f"all {len(scope_tables)} forced")

    policied = set(_q("SELECT tablename FROM pg_policies WHERE policyname LIKE '%\\_scope'"))
    no_policy = [t for t in scope_tables if t not in policied]
    ck("every scope table has a <table>_scope policy",
       not no_policy, ("no policy: " + ", ".join(no_policy)) if no_policy else "all have a _scope policy")

    granted = set(_q("SELECT table_name FROM information_schema.role_table_grants "
                     "WHERE grantee='rocoto_rt' AND privilege_type='SELECT'"))
    no_grant = [t for t in scope_tables if t not in granted]
    ck("every scope table grants SELECT to rocoto_rt",
       not no_grant, ("no rt grant: " + ", ".join(no_grant)) if no_grant else "all grant to rocoto_rt")

    passed = sum(R)
    print(f"\nRLS COVERAGE: {passed}/{len(R)} — "
          f"{'FULL (every scope table is fenced)' if passed == len(R) else 'A SCOPE TABLE IS UNPROTECTED'}")
    return 0 if passed == len(R) else 1


raise SystemExit(main())
