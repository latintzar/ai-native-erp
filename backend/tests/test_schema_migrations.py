"""Exercise actual PostgreSQL revisions, legacy adoption and read-only/concurrent startup."""
from __future__ import annotations

import ast
import asyncio
import json
import os
import subprocess
import sys
import uuid
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

import asyncpg
import pytest
from sqlalchemy.ext.asyncio import create_async_engine

from schema_migrations import (
    BASELINE,
    MigrationError,
    assert_current,
    catalog,
    head_revision,
    migrate,
    sqlalchemy_url,
)

BACKEND = Path(__file__).resolve().parents[1]


def swap_database(dsn: str, name: str) -> str:
    parsed = urlsplit(dsn)
    return urlunsplit((parsed.scheme, parsed.netloc, '/' + name, parsed.query, parsed.fragment))


@pytest.fixture
def database():
    source = os.environ.get("DATABASE_URL", "")
    if not urlsplit(source).path.startswith("/rocoto_rehearsal"):
        pytest.skip("run through tools/test-database.py, which owns the disposable PostgreSQL cluster")
    name = "migration_test_" + uuid.uuid4().hex
    admin = swap_database(source, "postgres")

    async def create():
        connection = await asyncpg.connect(admin)
        try:
            await connection.execute(f'create database "{name}"')
        finally:
            await connection.close()

    async def remove():
        connection = await asyncpg.connect(admin)
        try:
            await connection.execute(f'drop database "{name}" with (force)')
        finally:
            await connection.close()

    asyncio.run(create())
    yield swap_database(source, name)
    asyncio.run(remove())


async def revision(dsn):
    connection = await asyncpg.connect(dsn)
    try:
        return await connection.fetchval("select version_num from alembic_version")
    finally:
        await connection.close()


def test_blank_startup_refuses_without_changing_schema(database):
    async def run():
        connection = await asyncpg.connect(database)
        try:
            with pytest.raises(MigrationError, match="unversioned"):
                await assert_current(connection)
            assert not await connection.fetchval("select count(*) from pg_tables where schemaname='public'")
        finally:
            await connection.close()
    asyncio.run(run())


def test_fresh_upgrade_and_repeated_concurrent_upgrade(database):
    async def run():
        await asyncio.gather(migrate(database), migrate(database))
        await migrate(database)
        assert await revision(database) == head_revision()
        connection = await asyncpg.connect(database)
        try:
            await assert_current(connection)
            assert await connection.fetchval("select to_regclass('demo_sessions')")
            assert await connection.fetchval("select to_regclass('operator_access')")
            assert await connection.fetchval("select relforcerowsecurity from pg_class where relname='event'")
        finally:
            await connection.close()
    asyncio.run(run())



def test_native_postgres_dsn_options_work_for_preflight_upgrade_and_alembic(database):
    from schema_migrations import check, preflight

    separator = "&" if "?" in database else "?"
    dsn = database + separator + "sslmode=disable&application_name=migration-proof"

    async def run():
        assert (await preflight(dsn))["action"] == "upgrade"
        await migrate(dsn, revision=BASELINE)
        assert (await preflight(dsn))["current"] == BASELINE

    asyncio.run(run())
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "-c", "alembic.ini", "upgrade", "head"],
        cwd=BACKEND, env={**os.environ, "DATABASE_URL": dsn}, capture_output=True, text=True,
    )
    assert result.returncode == 0, result.stderr
    asyncio.run(check(dsn))
    assert asyncio.run(preflight(dsn))["action"] == "check"


def test_baseline_catalog_matches_immutable_snapshot(database):
    async def run():
        await migrate(database, revision=BASELINE, tenant="a_different_market")
        engine = create_async_engine(sqlalchemy_url(database))
        try:
            async with engine.connect() as connection:
                actual = await connection.run_sync(catalog)
            expected = json.loads((BACKEND / "migrations/baseline-catalog.json").read_text())
            assert actual == expected
        finally:
            await engine.dispose()
    asyncio.run(run())


def test_existing_data_adoption_is_explicit_and_preserves_rows_and_defaults(database):
    async def run():
        await migrate(database, revision=BASELINE, tenant="old_market")
        connection = await asyncpg.connect(database)
        try:
            await connection.execute("insert into orders(id,phone_number,note) "
                                     "values('retained','+1000','keep me')")
            await connection.execute("drop table alembic_version")
        finally:
            await connection.close()
        with pytest.raises(MigrationError, match="adopt"):
            await migrate(database)
        await migrate(database, "verify-legacy")
        connection = await asyncpg.connect(database)
        assert not await connection.fetchval("select to_regclass('alembic_version')")
        await connection.close()
        await migrate(database, "adopt", tenant="new_market")
        connection = await asyncpg.connect(database)
        try:
            row = await connection.fetchrow("select tenant_id,note from orders where id='retained'")
            assert dict(row) == {"tenant_id": "old_market", "note": "keep me"}
            await connection.execute("insert into orders(id,phone_number) values('after','+1001')")
            assert await connection.fetchval("select tenant_id from orders where id='after'") == "old_market"
        finally:
            await connection.close()
        assert await revision(database) == head_revision()
    asyncio.run(run())


@pytest.mark.parametrize("damage", [
    "alter table orders alter column note type varchar(12)",
    "alter table event no force row level security",
    "grant insert on fact to rocoto_ctrl",
    "drop trigger trg_ctrl_event_write on event",
])
def test_adoption_refuses_structural_or_permission_drift(database, damage):
    async def run():
        await migrate(database, revision=BASELINE)
        connection = await asyncpg.connect(database)
        try:
            await connection.execute("drop table alembic_version")
            await connection.execute(damage)
        finally:
            await connection.close()
        with pytest.raises(MigrationError, match="baseline differs"):
            await migrate(database, "adopt")
        connection = await asyncpg.connect(database)
        assert not await connection.fetchval("select to_regclass('alembic_version')")
        await connection.close()
    asyncio.run(run())


def test_upgrade_failure_rolls_back_revision_and_preserves_duplicates(database):
    async def run():
        await migrate(database, revision=BASELINE)
        connection = await asyncpg.connect(database)
        await connection.execute("insert into whatsapp_messages(id,phone_number,role,wa_message_id) "
                                 "values('a','+1','user','dup'),('b','+1','user','dup')")
        await connection.close()
        with pytest.raises(MigrationError, match="Duplicate inbound"):
            await migrate(database)
        assert await revision(database) == BASELINE
        connection = await asyncpg.connect(database)
        assert await connection.fetchval("select count(*) from whatsapp_messages") == 2
        assert not await connection.fetchval("select to_regclass('idx_wamsg_wa_message_id')")
        await connection.close()
    asyncio.run(run())


def test_explicit_rollback_keeps_existing_application_data(database):
    async def run():
        await migrate(database, revision="0003_operator_console")
        connection = await asyncpg.connect(database)
        await connection.execute("insert into orders(id,phone_number,note) values('a','+1','retained')")
        await connection.close()
        await migrate(database, "downgrade", BASELINE)
        assert await revision(database) == BASELINE
        connection = await asyncpg.connect(database)
        assert await connection.fetchval("select note from orders where id='a'") == "retained"
        assert not await connection.fetchval("select to_regclass('operator_access')")
        await connection.close()
        with pytest.raises(MigrationError, match="rollback floor"):
            await migrate(database, "downgrade", "base")
        await migrate(database)
        assert await revision(database) == head_revision()
    asyncio.run(run())


def test_rollback_refuses_loss_of_operator_audit(database):
    async def run():
        await migrate(database, revision="0003_operator_console")
        connection = await asyncpg.connect(database)
        await connection.execute("insert into operator_audit(actor_email,session_id,environment,tenant_slug,"
            "action,target_id,outcome,request_id) "
            "values('x@example.invalid','s','development','t','read','t','ok','r')")
        await connection.close()
        with pytest.raises(MigrationError, match="retention"):
            await migrate(database, "downgrade", "0002_inbound_idempotency")
        assert await revision(database) == "0003_operator_console"
    asyncio.run(run())


def test_read_only_role_can_boot_twice_concurrently(database):
    async def prepare():
        await migrate(database)
        connection = await asyncpg.connect(database)
        role = "boot_" + uuid.uuid4().hex[:12]
        await connection.execute(f"create role {role} login password 'disposable-test-password'")
        await connection.execute(f"grant usage on schema public to {role}")
        await connection.execute(f"grant select on alembic_version to {role}")
        await connection.close()
        parsed = urlsplit(database)
        return role, urlunsplit((parsed.scheme,
            f"{role}:disposable-test-password@{parsed.hostname}:{parsed.port}", parsed.path, '', ''))
    role, readonly = asyncio.run(prepare())
    env = {**os.environ, "DATABASE_URL": readonly, "RUNTIME_DATABASE_URL": "",
           "CONTROL_DATABASE_URL": "", "ROCOTO_REQUIRE_RLS": "false"}
    script = "import asyncio,db; asyncio.run(db.init())"
    processes = [subprocess.Popen([sys.executable, "-c", script], cwd=BACKEND, env=env,
                                 stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True) for _ in range(2)]
    for process in processes:
        stdout, stderr = process.communicate(timeout=30)
        assert process.returncode == 0, stdout + stderr
    # DROP ROLE belongs to the parent test cluster cleanup; it owns every transient role.
    assert role.startswith("boot_")


def test_current_check_refuses_old_or_future_revision(database):
    async def run():
        await migrate(database, revision=BASELINE)
        connection = await asyncpg.connect(database)
        try:
            with pytest.raises(MigrationError, match="differs"):
                await assert_current(connection)
            await connection.execute("update alembic_version set version_num='future_revision'")
            with pytest.raises(MigrationError, match="differs"):
                await assert_current(connection)
        finally:
            await connection.close()
    asyncio.run(run())


def test_application_modules_contain_no_schema_mutation_literals():
    # Test-owned lifecycle markers and migration files are explicit provisioning operations.
    allowed = {BACKEND / "seed/testdata.py", BACKEND / "seed/authenticated.py",
               BACKEND / "schema_migrations.py"}
    found = []
    for path in BACKEND.rglob("*.py"):
        if "tests" in path.parts or "migrations" in path.parts or path in allowed:
            continue
        for node in ast.walk(ast.parse(path.read_text())):
            if isinstance(node, ast.Constant) and isinstance(node.value, str):
                text = node.value.strip().lower()
                if text.startswith(("create table", "alter table", "drop table", "create index",
                                    "create unique index", "create extension")):
                    found.append(str(path.relative_to(BACKEND)))
    assert found == []


def test_additive_upgrade_allows_declared_previous_release_but_contract_break_refuses(database, monkeypatch):
    import schema_migrations

    async def run():
        await migrate(database)
        connection = await asyncpg.connect(database)
        monkeypatch.setattr(schema_migrations, "head_revision", lambda: BASELINE)
        try:
            await assert_current(connection)
            await connection.execute("update schema_compatibility "
                                     "set compatible_revisions='[\"contract_break\"]'")
            with pytest.raises(MigrationError, match="differs"):
                await assert_current(connection)
        finally:
            await connection.close()
    asyncio.run(run())


def test_preflight_selects_blank_upgrade_and_validated_legacy_adoption(database):
    from schema_migrations import preflight

    async def run():
        assert (await preflight(database))["action"] == "upgrade"
        await migrate(database, revision=BASELINE)
        connection = await asyncpg.connect(database)
        await connection.execute("drop table alembic_version")
        await connection.close()
        plan = await preflight(database)
        assert plan["action"] == "adopt"
        assert plan["backward_compatible"] is True
        await migrate(database, "adopt")
        assert (await preflight(database))["action"] == "check"
    asyncio.run(run())
