"""Exercise synthetic application auth on the suite's owned database, without a provider account."""

from __future__ import annotations

import asyncio
import json
from uuid import uuid4

import pytest

import config
import db
from seed import authenticated
from seed import testdata as data
from testdata_adapter import Refusal, reserve, resources_for, scenario_for, write_private


def test_authenticated_synthetic_account_through_normal_http(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "IS_PROD", False)
    monkeypatch.setattr(config, "EGRESS_SANDBOX", True)
    monkeypatch.setattr(config, "ENVIRONMENT", "development", raising=False)
    tmp_path.chmod(0o700)
    scenario = scenario_for({"id": "harbor-v1"})
    request = {"run_id": uuid4().hex, "environment": "development", "resources": {}, "operation": "create"}
    owner = reserve(request, scenario, tmp_path)
    write_private(
        tmp_path / "run.json", {"run_id": owner["run_id"], "source_hashes": {"fixture.py": "a" * 64}}
    )

    async def run():
        await db.init()
        try:
            async with db.get_pool().acquire() as con:
                assert await con.fetchval("select to_regnamespace('testdata_lifecycle')") is None
                await con.execute("create schema testdata_lifecycle")
                await con.execute("create table testdata_lifecycle.owner(identity text not null)")
                await con.execute(
                    "insert into testdata_lifecycle.owner values($1)",
                    json.dumps(resources_for(owner), sort_keys=True),
                )
            await data.account(owner, scenario)
            await data.populate(owner, scenario)
            proof = await authenticated.exercise(owner, scenario)
            assert proof["normal_identity_verification"] is True
            assert proof["mode"] == "offline-identity-provider"
            assert proof["external_identity_provider"] == "uncommissioned"
            assert proof["external_calls"] == 0 and proof["tenant_read_write_boundary"] is True
            await authenticated.register(owner, scenario, "verified")
            status = await data.status(owner, scenario)
            assert status["counts"]["orders"] == 2
            assert status["proof_scope"]["authentication"] == proof
            async with db.get_pool().acquire() as con:
                assert (
                    await con.fetchval(
                        "select count(*) from sup_session where tenant_slug=$1 and revoked_at is null",
                        owner["tenant_slug"],
                    )
                    == 0
                )
                row = await con.fetchrow(
                    "select * from operator_synthetic_run where run_id=$1", owner["run_id"]
                )
                assert row["phase"] == "verified" and row["environment"] == "development"
                assert row["tenant_slug"] == owner["tenant_slug"]
                assert len(row["source_sha256"]) == 64
                await con.execute("drop schema testdata_lifecycle cascade")
        finally:
            await data.close_pools()

    asyncio.run(run())


@pytest.mark.parametrize(
    "environment,capture", [("production", True), ("staging", True), ("development", False)]
)
def test_offline_identity_fixture_refuses_live_environment_before_connecting(
    monkeypatch, environment, capture
):
    monkeypatch.setattr(config, "ENVIRONMENT", environment, raising=False)
    monkeypatch.setattr(config, "IS_PROD", environment == "production")
    monkeypatch.setattr(config, "EGRESS_SANDBOX", capture)
    with pytest.raises(Refusal, match="owned development"):
        asyncio.run(authenticated.exercise({}, {}))
