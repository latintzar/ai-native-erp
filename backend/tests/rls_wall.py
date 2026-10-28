#!/usr/bin/env python3
"""rls_wall.py — stand the isolation wall up on a throwaway database, off the box.

The vitals' only runner (`deploy/harness/run_all_vitals.sh`) needs root on production: `/opt/rocoto`
paths, `sudo -u postgres`, prod's `.env`. This does the same job from ONE superuser DSN, so CI — and
anybody with the pgvector container — can run behind the same FORCE-RLS wall production runs behind,
instead of behind db.py's `RUNTIME_DATABASE_URL unset — FORCE RLS is BYPASSED` warning.

It builds what `deploy/harness/rehearsal_rebuild.sh` builds, in the same order:
  1. a fresh database — dropped and recreated, so a run never inherits the last one's rows;
  2. `ltree` + `vector` as the superuser (the schema's own `create extension if not exists` then
     no-ops, exactly as it does under the harness's owner apply);
  3. `schema_runtime.sql` — the runtime tables;
  4. `schema_rls.sql` — FORCE row-level security, the per-table policies, the two roles;
  5. LOGIN + a password on `rocoto_rt` and `rocoto_ctrl`. `schema_rls.sql` deliberately leaves the
     roles NOLOGIN ("come-alive gives them LOGIN + vaulted passwords, NOT in this file"), so the
     wall does that step — throwaway credentials for a throwaway database, never a production key.

Then it PROVES the wall is standing before anything runs behind it: as `rocoto_rt` with no scope
set, an insert must be REFUSED. A wall that does not refuse is not a wall, and this exits non-zero.

It emits the environment db.py and the vitals read:
  DATABASE_URL          owner       — db.py's `_pool`: DDL, the legacy tables, `get_pool()`
  RUNTIME_DATABASE_URL  rocoto_rt   — db.py's `_rt_pool`: every `scoped_tx`, the fenced pool
  CONTROL_DATABASE_URL  rocoto_ctrl — db.py's `_ctrl_pool`: tier-P, sees every scope
  SETUP_DSN · REHEARSAL_DSN · RT_DSN · CTRL_DSN · REHEARSAL_DB   the aliases the vitals read
  ROCOTO_EGRESS_SANDBOX=1   the class-E floor: no rail reaches a real party

  rocoto_wall_env="$(python3 tests/rls_wall.py)" && eval "$rocoto_wall_env"
  python3 tests/rls_wall.py --format=env >> "$GITHUB_ENV"    # CI

ONE difference from production, stated so nobody reads more into a green run than is there: the
owner role here is the container's superuser, which bypasses FORCE RLS (the harness says the same of
its own owner apply — "a superuser owner bypasses anyway"). The wall is under the RUNTIME and
CONTROL pools, which is where the isolation floor lives: `db.scoped_tx` and `db.control_pool`.
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

import asyncpg

BACKEND = Path(__file__).resolve().parent.parent

# The clone name KEEPS the `rocoto_rehearsal` prefix: `guard_clone()` in vital_multitenant and
# vital_cold_tenant asserts the DSN contains it, and that guard is what keeps a vital off production.
DEFAULT_DB = "rocoto_rehearsal_ci"
DEFAULT_SUPERUSER_DSN = "postgresql://rocoto:rocoto@127.0.0.1:5434/postgres"


def _swap_db(dsn: str, db: str) -> str:
    """Same DSN, different database name (the harness's `_reh()` in Python)."""
    p = urlsplit(dsn)
    return urlunsplit((p.scheme, p.netloc, "/" + db, p.query, p.fragment))


def _as_role(dsn: str, role: str, password: str, db: str) -> str:
    """The owner DSN's host/port, re-credentialled for a runtime role."""
    p = urlsplit(_swap_db(dsn, db))
    return urlunsplit((p.scheme, f"{role}:{password}@{p.hostname}:{p.port or 5432}",
                       "/" + db, p.query, p.fragment))


async def _recreate_database(admin_dsn: str, db: str) -> None:
    con = await asyncpg.connect(admin_dsn)
    try:
        # Lingering pool connections make DROP DATABASE fail; terminate them first, then PROVE the
        # drop — a rebuild that silently keeps the old database poisons every append-only vital.
        await con.execute(
            "select pg_terminate_backend(pid) from pg_stat_activity "
            "where datname = $1 and pid <> pg_backend_pid()", db)
        await con.execute(f'drop database if exists "{db}"')
        left = await con.fetchval("select count(*) from pg_database where datname = $1", db)
        if left:
            raise SystemExit(f"FAIL: {db} still exists after drop (open connections?)")
        await con.execute(f'create database "{db}"')
    finally:
        await con.close()


async def _apply(dsn: str, *sql_files: Path) -> None:
    con = await asyncpg.connect(dsn)
    try:
        # superuser-only extensions first, so the schema files' own `create extension if not exists`
        # lines no-op — the same two-step the harness does with `sudo -u postgres psql`.
        await con.execute("create extension if not exists ltree; create extension if not exists vector;")
        for f in sql_files:
            await con.execute(f.read_text())
    finally:
        await con.close()


async def _come_alive(dsn: str, db: str, rt_password: str, ctrl_password: str) -> None:
    """The step schema_rls.sql leaves out on purpose: give the two roles a way in."""
    con = await asyncpg.connect(dsn)
    try:
        for role, password in (("rocoto_rt", rt_password), ("rocoto_ctrl", ctrl_password)):
            await con.execute(f"alter role {role} login password '{password}'")
            await con.execute(f'grant connect on database "{db}" to {role}')
    finally:
        await con.close()


async def _prove_the_wall(rt_dsn: str, ctrl_dsn: str) -> list[str]:
    """Refusals, not the absence of a crash. Returns the lines proved, raises if one does not hold.

    With no `rocoto.scope` set, `rocoto_rt` must be refused a write (the policy's WITH CHECK) and
    must read nothing. `rocoto_ctrl` must be able to connect and read across scopes. If any of that
    is untrue the wall is decorative and the suite behind it proves nothing, so this exits non-zero.
    """
    proved: list[str] = []
    rt = await asyncpg.connect(rt_dsn)
    try:
        refused = ""
        try:
            await rt.execute(
                "insert into event(scope, type, source) values('t.wallcheck'::ltree,'message','wa')")
        except asyncpg.PostgresError as e:
            refused = str(e)
        # The message has to name the POLICY. A missing grant ("permission denied for table event")
        # also refuses, and would let a wall with no policies at all read as green.
        if "row-level security policy" not in refused:
            raise SystemExit(
                "FAIL: rocoto_rt's scope-less insert was not refused BY THE POLICY "
                f"({refused or 'it succeeded'}). The wall is not standing; refusing to hand out DSNs.")
        proved.append("rocoto_rt insert with no scope → REFUSED by the row-level security policy")

        seen = await rt.fetchval("select count(*) from event")
        if seen != 0:
            raise SystemExit(f"FAIL: rocoto_rt read {seen} rows with NO scope set (must be fail-CLOSED)")
        proved.append("rocoto_rt read with no scope → 0 rows (fail-closed)")

        # …and the other half of the claim: the wall FENCES, it does not simply block. In scope, the
        # same insert lands. A wall that refused everything would pass the two checks above and make
        # every suite behind it meaningless.
        await rt.execute("select set_config('rocoto.scope', 't.wallcheck', false)")
        await rt.execute(
            "insert into event(scope, type, source) values('t.wallcheck'::ltree,'message','wa')")
        await rt.execute("delete from event where scope = 't.wallcheck'::ltree")
        proved.append("rocoto_rt insert IN scope → lands (the wall fences, it does not block)")
    finally:
        await rt.close()

    ctrl = await asyncpg.connect(ctrl_dsn)
    try:
        who = await ctrl.fetchval("select current_user")
        if who != "rocoto_ctrl":
            raise SystemExit(f"FAIL: control DSN connected as {who!r}, not rocoto_ctrl")
        await ctrl.fetchval("select count(*) from event")   # tier-P reads every scope, no GUC needed
        proved.append("rocoto_ctrl connects as tier-P and reads across scopes")
    finally:
        await ctrl.close()
    return proved


def _env_for(superuser_dsn: str, db: str, rt_password: str, ctrl_password: str) -> dict[str, str]:
    owner = _swap_db(superuser_dsn, db)
    rt = _as_role(superuser_dsn, "rocoto_rt", rt_password, db)
    ctrl = _as_role(superuser_dsn, "rocoto_ctrl", ctrl_password, db)
    return {
        "DATABASE_URL": owner,
        "RUNTIME_DATABASE_URL": rt,
        "CONTROL_DATABASE_URL": ctrl,
        # the aliases deploy/harness/rehearsal_env.sh exports for the organ vitals
        "SETUP_DSN": owner,
        "REHEARSAL_DSN": owner,
        "RT_DSN": rt,
        "CTRL_DSN": ctrl,
        "REHEARSAL_DB": db,
        # vital_followup_fire rehearses the deploy backfill as the superuser: `sudo -u postgres psql`
        # on the box, this DSN "e.g. local dev without sudo/postgres" everywhere else.
        "BACKFILL_DSN": owner,
        "ROCOTO_EGRESS_SANDBOX": "1",
        # Fail closed. With the wall up there is no reason to tolerate the owner-pool fallback, and
        # this turns db.py's warning into a refusal to boot — so a wall that silently stopped being
        # built cannot leave a green suite behind it (backend/db.py `_fell_back_to_owner`).
        "ROCOTO_REQUIRE_RLS": "true",
    }


async def build(superuser_dsn: str, db: str, rt_password: str, ctrl_password: str,
                recreate: bool = True, runtime_only: bool = False,
                tenant: str | None = None) -> tuple[dict[str, str], list[str]]:
    """Build the wall; return (the environment to export, the refusals proved)."""
    admin = _swap_db(superuser_dsn, "postgres")
    owner = _swap_db(superuser_dsn, db)
    if recreate:
        await _recreate_database(admin, db)
    if runtime_only:
        # The historical runtime-only catalog vital deliberately excludes legacy product tables.
        await _apply(owner, BACKEND / "schema_runtime.sql", BACKEND / "schema_rls.sql")
    else:
        sys.path.insert(0, str(BACKEND))
        from schema_migrations import migrate

        await migrate(owner, tenant=str(tenant or os.getenv("BRAIN_TENANT") or "sancho"))
    await _come_alive(owner, db, rt_password, ctrl_password)

    env = _env_for(superuser_dsn, db, rt_password, ctrl_password)
    proved = await _prove_the_wall(env["RUNTIME_DATABASE_URL"], env["CONTROL_DATABASE_URL"])
    return env, proved


async def fork(superuser_dsn: str, template: str, db: str,
               rt_password: str, ctrl_password: str) -> dict[str, str]:
    """A private copy of an already-built clone, for one vital.

    Postgres copies a template database by copying its files — under a second for a schema-only
    clone — so every vital can meet the database state its author wrote it against instead of
    whatever the previous forty left behind. That is the collision `run_all_vitals.sh` documents at
    length (four concurrent `vital_presence` runs on one clone: 5/12, 9/12, 10/12, 11/12; the same
    vital alone: 12/12 every time), arriving by sequence rather than by concurrency.
    """
    con = await asyncpg.connect(_swap_db(superuser_dsn, "postgres"))
    try:
        # `create database … template` refuses while anyone is connected to the template, and
        # `drop database` refuses while anyone is connected to the target. Clear both, then copy.
        await con.execute(
            "select pg_terminate_backend(pid) from pg_stat_activity "
            "where datname = any($1::text[]) and pid <> pg_backend_pid()", [db, template])
        await con.execute(f'drop database if exists "{db}"')
        await con.execute(f'create database "{db}" template "{template}"')
    finally:
        await con.close()
    return _env_for(superuser_dsn, db, rt_password, ctrl_password)


async def drop(superuser_dsn: str, *names: str) -> None:
    """Best-effort teardown of the databases a run made."""
    con = await asyncpg.connect(_swap_db(superuser_dsn, "postgres"))
    try:
        for n in names:
            try:
                await con.execute(
                    "select pg_terminate_backend(pid) from pg_stat_activity "
                    "where datname = $1 and pid <> pg_backend_pid()", n)
                await con.execute(f'drop database if exists "{n}"')
            except asyncpg.PostgresError:
                pass
    finally:
        await con.close()


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--dsn", default=os.getenv("ROCOTO_WALL_SUPERUSER_DSN", DEFAULT_SUPERUSER_DSN),
                    help="a superuser DSN on the cluster (any database; the wall makes its own)")
    ap.add_argument("--db", default=os.getenv("REHEARSAL_DB", DEFAULT_DB),
                    help="the clone to build (must keep the rocoto_rehearsal prefix: the vitals' "
                         "guard_clone() reads it)")
    ap.add_argument("--format", choices=("sh", "env"), default="sh",
                    help="sh: `export K=V` for eval; env: `K=V` for $GITHUB_ENV")
    ap.add_argument("--no-recreate", action="store_true",
                    help="apply onto the existing clone instead of dropping it (local iteration)")
    a = ap.parse_args(argv)

    if "rocoto_rehearsal" not in a.db:
        print(f"REFUSED: --db {a.db!r} does not carry the rocoto_rehearsal prefix — the vitals' "
              "guard_clone() would take it for production.", file=sys.stderr)
        return 2

    # Throwaway credentials for a throwaway database. Kept overridable so a shared runner can pick
    # its own, and never read from a production vault.
    rt_password = os.getenv("ROCOTO_WALL_RT_PASSWORD", "wall_rt")
    ctrl_password = os.getenv("ROCOTO_WALL_CTRL_PASSWORD", "wall_ctrl")

    env, proved = asyncio.run(build(a.dsn, a.db, rt_password, ctrl_password,
                                    recreate=not a.no_recreate))

    # Diagnostics on stderr so stdout stays evaluable.
    print(f"[rls_wall] {a.db}: versioned schema applied, roles rocoto_rt + "
          f"rocoto_ctrl alive", file=sys.stderr)
    for line in proved:
        print(f"[rls_wall]   proved: {line}", file=sys.stderr)

    prefix = "export " if a.format == "sh" else ""
    for k, v in env.items():
        print(f"{prefix}{k}={v}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
