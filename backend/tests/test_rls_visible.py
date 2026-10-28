"""WP-E — the database's own wall is visible from outside, and can be made mandatory.

Two facts this proves. First, ROCOTO_REQUIRE_RLS turns the silent fallback into a refusal: with no
RUNTIME_DATABASE_URL the employee-runtime pool would connect as the OWNER, and the owner BYPASSES
FORCE ROW LEVEL SECURITY — so tenant isolation would be app-code-only, which used to be announced by
one line on stderr and nothing else. Second, /healthz publishes what the runtime pool actually
connects as, so the answer to "is the wall up" is readable without ssh.

Needs the test Postgres (DATABASE_URL), like every other DB-backed gate here. It saves and restores
db's module-level pools so the pools it opens cannot outlive it into another test's event loop.
"""
from __future__ import annotations

import asyncio
import json
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("ROCOTO_MEDIA_DIR", "/tmp/rocoto-test-media")

import config  # noqa: E402
import db  # noqa: E402


async def _restore(saved) -> None:
    """Close whatever this test opened and put db's globals back the way it found them."""
    opened = db._pool
    db._pool, db._rt_pool, db._ctrl_pool = saved
    if opened is not None and opened is not saved[0]:
        await opened.close()


def test_init_refuses_the_owner_pool_when_rls_is_required(monkeypatch):
    monkeypatch.setattr(config, "REQUIRE_RLS", True)
    monkeypatch.setattr(config, "RUNTIME_DATABASE_URL", "")

    async def _run():
        saved = (db._pool, db._rt_pool, db._ctrl_pool)
        try:
            with pytest.raises(RuntimeError) as e:
                await db.init()
            msg = str(e.value)
            assert "ROCOTO_REQUIRE_RLS" in msg, msg
            assert "RUNTIME_DATABASE_URL" in msg, msg
        finally:
            await _restore(saved)

    asyncio.run(_run())


def test_without_the_flag_it_boots_and_says_so(monkeypatch):
    """The default posture is unchanged — a warning, not a refusal — so this lands on a live box."""
    monkeypatch.setattr(config, "REQUIRE_RLS", False)
    monkeypatch.setattr(config, "RUNTIME_DATABASE_URL", "")

    async def _run():
        saved = (db._pool, db._rt_pool, db._ctrl_pool)
        try:
            await db.init()
            assert db._rt_pool is db._pool, "the runtime pool falls back to the owner pool"
        finally:
            await _restore(saved)

    asyncio.run(_run())


def test_healthz_publishes_the_runtime_role(monkeypatch):
    monkeypatch.setattr(config, "REQUIRE_RLS", False)
    monkeypatch.setattr(config, "RUNTIME_DATABASE_URL", "")
    import app

    async def _run():
        saved = (db._pool, db._rt_pool, db._ctrl_pool)
        try:
            await db.init()
            # /healthz also asks the background units and the model — neither is this test's subject,
            # and one of them would page a human. Answer for them.
            import mindcheck
            import ops
            import voice_toggle
            monkeypatch.setattr(ops, "heartbeats", _async({}))
            monkeypatch.setattr(mindcheck, "status", _async({"state": "ok"}))
            monkeypatch.setattr(voice_toggle, "available", lambda: True)
            body = json.loads(bytes((await app.healthz()).body))
        finally:
            await _restore(saved)
        return body

    body = asyncio.run(_run())
    assert "rls" in body, body
    assert body["rls"]["forced"] is False, "the owner pool is not a forced-RLS posture"
    assert body["rls"]["runtime_role"], "the role comes from the database, not from configuration"
    assert "rls-owner-pool" in body["degraded"], body["degraded"]


def _async(value):
    async def _fn(*a, **k):
        return value
    return _fn
