"""Factory routing preserves registered lifecycle hooks and authentication boundaries."""
from __future__ import annotations

import asyncio

import httpx
import pytest

import app as backend_app


def test_each_factory_instance_has_the_same_http_contract():
    first, second = backend_app.create_app(), backend_app.create_app()
    assert first is not second

    assert first.openapi() == second.openapi() == backend_app.app.openapi()
    assert "/api/operator/accounts" in first.openapi()["paths"]
    assert "/api/crm/me" in first.openapi()["paths"]


def test_factory_lifespan_runs_registered_startup_and_shutdown_once(monkeypatch):
    events = []

    async def startup():
        events.append("startup")

    async def shutdown():
        events.append("shutdown")

    monkeypatch.setattr(backend_app, "_startup", startup)
    monkeypatch.setattr(backend_app, "_shutdown", shutdown)
    application = backend_app.create_app()

    async def run():
        async with application.router.lifespan_context(application):
            assert events == ["startup"]
            events.append("serving")
        assert events == ["startup", "serving", "shutdown"]

    asyncio.run(run())


def test_schema_failure_prevents_factory_from_serving(monkeypatch):
    events = []

    def ready():
        events.append("configuration")

    async def migrate_check():
        events.append("schema-check")
        raise RuntimeError("test incompatible schema")

    monkeypatch.setattr(backend_app.config, "assert_prod_ready", ready)
    monkeypatch.setattr(backend_app.supa, "get_pool", lambda: None)
    monkeypatch.setattr(backend_app.supa, "init", migrate_check)
    application = backend_app.create_app()

    async def run():
        with pytest.raises(RuntimeError, match="test incompatible schema"):
            async with application.router.lifespan_context(application):
                pytest.fail("an incompatible schema reached the serving phase")

    asyncio.run(run())
    assert events == ["configuration", "schema-check"]


def test_shutdown_closes_second_client_after_first_cleanup_failure(monkeypatch):
    events = []

    async def first():
        events.append("http")
        raise RuntimeError("fixture cleanup failure")

    def second():
        events.append("model")

    monkeypatch.setattr(backend_app.twa, "aclose_shared_client", first)
    monkeypatch.setattr(backend_app.voice_reply, "aclose_llm_clients", second)
    asyncio.run(backend_app._shutdown())
    assert events == ["http", "model"]


def test_factory_keeps_control_room_and_operator_authentication():
    async def run():
        application = backend_app.create_app()
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=application), base_url="https://review.example.invalid"
        ) as client:
            control = await client.get("/api/crm/me")
            assert control.status_code == 401
            assert "cr_sid=" in control.headers["set-cookie"]
            operator = await client.get("/api/operator/accounts")
            assert operator.status_code == 401

    asyncio.run(run())


def test_partial_startup_cancels_owned_tasks_and_closes_distinct_pools(monkeypatch):
    closed = []
    cancelled = []

    class Pool:
        async def close(self):
            closed.append("pool")

    async def background():
        try:
            await asyncio.Event().wait()
        finally:
            cancelled.append("task")

    async def partial_startup():
        shared = Pool()
        monkeypatch.setattr(backend_app.supa, "_pool", shared)
        monkeypatch.setattr(backend_app.supa, "_rt_pool", shared)
        monkeypatch.setattr(backend_app.supa, "_ctrl_pool", shared)
        backend_app._spawn_background(background())
        await asyncio.sleep(0)
        raise RuntimeError("partial startup failed")

    monkeypatch.setattr(backend_app, "_startup", partial_startup)
    application = backend_app.create_app()

    async def run():
        with pytest.raises(RuntimeError, match="partial startup failed"):
            async with application.router.lifespan_context(application):
                pytest.fail("partially initialized application served requests")
        assert closed == ["pool"]
        assert cancelled == ["task"]
        assert backend_app.supa._pool is None
        assert not backend_app._STARTUP_TASKS

    asyncio.run(run())
