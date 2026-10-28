"""The actual worker loop respects deployment policy before claiming any queued work."""

from __future__ import annotations

import asyncio
import json
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest

import config
import ops
import worker


def policy(monkeypatch, environment="staging", mode="paused"):
    monkeypatch.setattr(config, "ENVIRONMENT", environment, raising=False)
    monkeypatch.setattr(config, "IS_PROD", environment == "production")
    monkeypatch.setattr(config, "WORKER_EFFECT_MODE", mode, raising=False)
    monkeypatch.setattr(config, "EGRESS_SANDBOX", environment != "production")
    # Presence of configured providers never changes the worker policy.
    monkeypatch.setattr(config, "ANTHROPIC_API_KEY", "configured-fixture")
    monkeypatch.setattr(config, "STRIPE_SECRET_KEY", "configured-fixture", raising=False)


def one_iteration(monkeypatch):
    async def stop_after_tick(seconds):
        raise asyncio.CancelledError()

    monkeypatch.setattr(worker.asyncio, "sleep", stop_after_tick)
    stamp = AsyncMock()
    monkeypatch.setattr(ops, "stamp", stamp)
    return stamp


@pytest.mark.parametrize("environment", ["development", "staging", "production"])
def test_paused_worker_preserves_queued_jobs_and_reports_policy(monkeypatch, environment):
    policy(monkeypatch, environment)
    stamp = one_iteration(monkeypatch)
    pending = {"timer": "armed", "billing": "debited", "meta_attempts": 0}

    async def unwanted_job(*args):
        pending.update(timer="fired", billing="invoiced", meta_attempts=1)
        raise AssertionError("paused worker executed a job")

    sweeps = []
    for name in (
        "run_once", "run_wake_once", "run_pending_backstop", "run_billing_once",
        "run_stuck_scan", "run_pin_probe_once",
    ):
        method = AsyncMock(side_effect=unwanted_job)
        monkeypatch.setattr(worker, name, method)
        sweeps.append(method)
    pool = Mock(side_effect=AssertionError("paused worker acquired job pool"))
    monkeypatch.setattr(worker.db, "control_pool", pool)
    with pytest.raises(asyncio.CancelledError):
        asyncio.run(worker.run_forever())
    assert pending == {"timer": "armed", "billing": "debited", "meta_attempts": 0}
    for method in sweeps:
        method.assert_not_awaited()
    pool.assert_not_called()
    stamp.assert_awaited_once_with(
        "worker", {"environment": environment, "mode": "paused", "processing_enabled": False}
    )


@pytest.mark.parametrize("environment", ["development", "staging"])
def test_nonproduction_enable_fails_before_sweeps(monkeypatch, environment):
    policy(monkeypatch, environment, "enabled")
    pool = Mock(side_effect=AssertionError("policy must run before job pool"))
    monkeypatch.setattr(worker.db, "control_pool", pool)
    with pytest.raises(ValueError, match="production"):
        asyncio.run(worker.run_forever())
    pool.assert_not_called()


def test_production_requires_explicit_enable_and_sandbox_consistency(monkeypatch):
    import worker_policy

    policy(monkeypatch, "production")
    monkeypatch.delattr(config, "WORKER_EFFECT_MODE")
    assert worker_policy.state()["processing_enabled"] is False
    monkeypatch.setattr(config, "WORKER_EFFECT_MODE", "enabled", raising=False)
    monkeypatch.setattr(config, "EGRESS_SANDBOX", True)
    with pytest.raises(ValueError, match="sandbox"):
        worker_policy.state()


def test_enabled_production_runs_existing_sweeps(monkeypatch):
    import backfill
    import wa_coexistence

    policy(monkeypatch, "production", "enabled")
    stamp = one_iteration(monkeypatch)
    pool = object()
    monkeypatch.setattr(worker.db, "control_pool", lambda: pool)
    jobs = []
    for name in (
        "run_once", "run_wake_once", "run_pending_backstop", "run_billing_once",
        "run_stuck_scan", "run_pin_probe_once",
    ):
        method = AsyncMock(return_value=0)
        monkeypatch.setattr(worker, name, method)
        jobs.append(method)
    history = AsyncMock(return_value={})
    sync = AsyncMock(return_value={})
    monkeypatch.setattr(backfill, "run_pending_chunks", history)
    monkeypatch.setattr(wa_coexistence, "run_due_syncs", sync)
    with pytest.raises(asyncio.CancelledError):
        asyncio.run(worker.run_forever())
    for method in jobs:
        method.assert_awaited_once_with(pool)
    history.assert_awaited_once()
    sync.assert_awaited_once()
    stamp.assert_awaited_once_with(
        "worker", {"environment": "production", "mode": "enabled", "processing_enabled": True}
    )


def test_paused_staging_leaves_real_database_jobs_unclaimed(monkeypatch):
    """Populate actual queued jobs, run the actual loop, and inspect their retained state."""
    import httpx

    import db
    from brain import llm, setupfee

    policy(monkeypatch)
    client = Mock(side_effect=AssertionError("provider operation reached"))
    monkeypatch.setattr(llm, "_client", client)
    monkeypatch.setattr(setupfee, "_stripe", client)
    monkeypatch.setattr(httpx, "AsyncClient", client)

    async def scenario():
        await db.init()
        slug = "worker-" + uuid4().hex[:12]
        scope = "test." + slug.replace("-", "_")
        connection = loop = None
        try:
            async with db.get_pool().acquire() as con:
                connection = await con.fetchval(
                    "insert into channel_connection(tenant_id,kind,provider,status,coexistence) "
                    "values($1,'whatsapp','meta_cloud','connected',true) returning id", slug,
                )
                await con.execute(
                    "insert into channel_sync_deadline(connection_id,kind,due_at) "
                    "values($1,'coexistence_history',now()-interval '1 minute')", connection,
                )
                await con.execute(
                    "insert into billing_run(tenant_id,period,state,commission_cents) "
                    "values($1,'2026-01','debited',500)", slug,
                )
            async with db.scoped_tx(scope) as con:
                loop = await con.fetchval(
                    "insert into open_loop(scope,kind,contingencies,lineage) "
                    "values($1::ltree,'question',$2::jsonb,'test') returning id", scope,
                    [{"branch_id": "wait", "trigger": "silence", "action": "ask"}],
                )
                await con.execute(
                    "insert into timer(scope,loop_id,fires_at,branch_id,lineage) "
                    "values($1::ltree,$2,now()-interval '1 minute','wait','test')", scope, loop,
                )

            async def stop_after_tick(seconds):
                raise asyncio.CancelledError()

            monkeypatch.setattr(worker.asyncio, "sleep", stop_after_tick)
            with pytest.raises(asyncio.CancelledError):
                await worker.run_forever()
            client.assert_not_called()
            async with db.scoped_tx(scope) as con:
                assert await con.fetchval("select state from timer where loop_id=$1", loop) == "armed"
            async with db.get_pool().acquire() as con:
                assert await con.fetchval(
                    "select attempts from channel_sync_deadline where connection_id=$1", connection,
                ) == 0
                assert await con.fetchval(
                    "select state from billing_run where tenant_id=$1", slug,
                ) == "debited"
                detail = await con.fetchval("select detail from heartbeat where unit='worker'")
                if isinstance(detail, str):
                    detail = json.loads(detail)
                assert detail == {"environment": "staging", "mode": "paused", "processing_enabled": False}
        finally:
            async with db.scoped_tx(scope) as con:
                if loop:
                    await con.execute("delete from timer where loop_id=$1", loop)
                    await con.execute("delete from open_loop where id=$1", loop)
            async with db.get_pool().acquire() as con:
                if connection:
                    await con.execute("delete from channel_connection where id=$1", connection)
                await con.execute("delete from billing_run where tenant_id=$1", slug)
            for candidate in {db._pool, db._rt_pool, db._ctrl_pool} - {None}:
                await candidate.close()
            db._pool = db._rt_pool = db._ctrl_pool = None

    asyncio.run(scenario())
