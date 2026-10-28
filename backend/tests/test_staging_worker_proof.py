"""Real PostgreSQL proof of owned worker lifecycle and captured transport boundaries."""

from __future__ import annotations

import asyncio
from unittest.mock import Mock
from uuid import uuid4

import asyncpg
import pytest

import config
import db
from seed import staging_worker as proof
from seed.testdata import close_pools, open_pools


def configure(monkeypatch):
    monkeypatch.setattr(config, "ENVIRONMENT", "staging", raising=False)
    monkeypatch.setattr(config, "IS_PROD", False)
    monkeypatch.setattr(config, "EGRESS_SANDBOX", True)
    monkeypatch.setattr(config, "WORKER_EFFECT_MODE", "paused", raising=False)
    monkeypatch.setattr(config, "RELEASE_COMMIT", "a" * 40, raising=False)
    monkeypatch.setattr(config, "RELEASE_PRODUCT_SHA256", "b" * 64, raising=False)
    return {
        "schema": 1,
        "run_id": uuid4().hex,
        "environment": "staging",
        "scenario_id": proof.SCENARIO,
        "source_commit": "a" * 40,
        "product_sha256": "b" * 64,
    }


@pytest.mark.parametrize("case", ["complete", "capture_failure", "foreign_ownership"])
def test_owned_staging_worker_lifecycle(monkeypatch, case):
    import httpx

    import actions
    from brain import llm

    manifest = configure(monkeypatch)
    tenant, scope = proof.validate(manifest)
    provider = Mock(side_effect=AssertionError("proof reached real provider"))
    monkeypatch.setattr(httpx, "AsyncClient", provider)
    monkeypatch.setattr(llm, "_client", provider)
    monkeypatch.setattr(actions, "send_email", provider)
    monkeypatch.setattr(config, "ANTHROPIC_API_KEY", "fixture-configured")
    monkeypatch.setattr(config, "RESEND_API_KEY", "fixture-configured")

    async def scenario():
        await open_pools()
        # The disposable harness owner is a superuser; use a dedicated ordinary maintenance role
        # so the real FORCE-RLS policies fence the proof's single transaction as on staging.
        maintenance = "proof_" + manifest["run_id"]
        admin = await asyncpg.connect(config.DATABASE_URL)
        await admin.execute(f"create role {maintenance} nologin nosuperuser nobypassrls")
        await admin.execute(f"grant rocoto_rt to {maintenance}")
        await admin.execute(
            "grant select,insert,update,delete on tenants,operator_synthetic_run,"
            f"operator_audit to {maintenance}"
        )
        await admin.execute(f"grant select on team_members to {maintenance}")
        await admin.execute(f"grant usage,select on all sequences in schema public to {maintenance}")

        async def maintenance_init(con):
            await db._init_conn(con)
            await con.execute(f"set role {maintenance}")

        await db._pool.close()
        db._pool = await asyncpg.create_pool(
            config.DATABASE_URL, min_size=1, max_size=2, init=maintenance_init
        )
        try:
            plan = await proof.execute(manifest, "create")
            assert plan["applied"] is False
            async with db.get_pool().acquire() as con:
                assert not await con.fetchval("select exists(select 1 from tenants where slug=$1)", tenant)
            created = await proof.execute(manifest, "create", apply=True)
            assert created["phase"] == "populated"
            if case == "foreign_ownership":
                async with db.get_pool().acquire() as con:
                    await con.execute(
                        "update operator_synthetic_run set source_sha256=$2 where run_id=$1",
                        manifest["run_id"],
                        "c" * 64,
                    )
                with pytest.raises(ValueError, match="marker"):
                    await proof.execute(manifest, "delete", apply=True)
                async with db.get_pool().acquire() as con:
                    assert await con.fetchval("select exists(select 1 from tenants where slug=$1)", tenant)
                    await con.execute(
                        "update operator_synthetic_run set source_sha256=$2 where run_id=$1",
                        manifest["run_id"],
                        manifest["product_sha256"],
                    )
            elif case == "capture_failure":
                async with db.scoped_tx(scope) as con:
                    await con.execute(
                        "update endpoint set addr='another@example.invalid' where contact_id in "
                        "(select id from contact where scope=$1::ltree)",
                        scope,
                    )
                with pytest.raises(ValueError, match="destination"):
                    await proof.execute(manifest, "exercise", apply=True)
                async with db.scoped_tx(scope) as con:
                    assert (
                        await con.fetchval("select state from timer where scope=$1::ltree", scope) == "armed"
                    )
                    assert await con.fetchval("select count(*) from event where scope=$1::ltree", scope) == 0
            else:
                # A sibling run has its own overdue job. The selected proof must leave it armed.
                sibling = {**manifest, "run_id": uuid4().hex}
                await proof.execute(sibling, "create", apply=True)
                try:
                    receipt = await proof.execute(manifest, "exercise", apply=True)
                    assert receipt["phase"] == "verified"
                    assert receipt["worker"]["processed_objects"] == 1
                    assert receipt["effects"]["provider_deliveries"] == 0
                    assert len(receipt["effects"]["records"]) == 2
                    assert {r["operation"] for r in receipt["effects"]["records"]} == {
                        "llm.verify_branch",
                        "email.send",
                    }
                    replay = await proof.execute(manifest, "exercise", apply=True)
                    assert replay["effects"] == receipt["effects"]
                    assert replay["verified_at"] == receipt["verified_at"]
                    assert (await proof.execute(manifest, "create", apply=True))["phase"] == "verified"
                    _, other_scope = proof.validate(sibling)
                    async with db.scoped_tx(other_scope) as con:
                        assert (
                            await con.fetchval("select state from timer where scope=$1::ltree", other_scope)
                            == "armed"
                        )
                finally:
                    await proof.execute(sibling, "delete", apply=True)
            await proof.execute(manifest, "reset", apply=True)
            reset_proof = await proof.execute(manifest, "exercise", apply=True)
            assert reset_proof["phase"] == "verified"
            status = await proof.execute(manifest, "status")
            assert status["phase"] == "verified"
            assert status["effects"] == reset_proof["effects"]
            assert status["verified_at"] == reset_proof["verified_at"]
            provider.assert_not_called()
            await proof.execute(manifest, "delete", apply=True)
            assert (await proof.execute(manifest, "delete", apply=True))["phase"] == "deleted"
            with pytest.raises(ValueError, match="retired"):
                await proof.execute(manifest, "create", apply=True)
            async with db.get_pool().acquire() as con:
                assert not await con.fetchval("select exists(select 1 from tenants where slug=$1)", tenant)
                assert (
                    await con.fetchval("select count(*) from operator_audit where tenant_slug=$1", tenant) > 0
                )
            async with db.scoped_tx(scope) as con:
                assert await con.fetchval("select count(*) from event where scope=$1::ltree", scope) == 0
        finally:
            await close_pools()
            await admin.execute(f"drop owned by {maintenance}")
            await admin.execute(f"drop role {maintenance}")
            await admin.close()

    asyncio.run(scenario())


def test_staging_proof_refuses_wrong_source_environment_and_production(monkeypatch):
    manifest = configure(monkeypatch)
    for field, value in (
        ("source_commit", "f" * 40),
        ("product_sha256", "f" * 64),
        ("environment", "production"),
    ):
        with pytest.raises(ValueError):
            proof.validate({**manifest, field: value})
    monkeypatch.setattr(config, "IS_PROD", True)
    with pytest.raises(ValueError):
        proof.validate(manifest)
