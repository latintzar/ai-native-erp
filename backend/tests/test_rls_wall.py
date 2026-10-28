"""test_rls_wall.py — the wall is standing, or the suite behind it proves nothing.

`tests/rls_wall.py` builds the isolation floor off the box (see tests/README.md). These are the
assertions that the pools the runtime actually uses are the FENCED ones, and that the fence REFUSES
— a policy that quietly let a cross-tenant write through would leave every other test in this
directory green and the product's central promise broken.

Skipped, loudly, when the wall is down: `RUNTIME_DATABASE_URL` unset is exactly the state db.py
warns about (`FORCE RLS is BYPASSED (isolation app-code-only)`), and a refusal test that cannot see
a refusal must say so rather than pass.
"""
from __future__ import annotations

import asyncio
import os
import sys

import asyncpg
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import db  # noqa: E402

pytestmark = pytest.mark.skipif(
    not os.getenv("RUNTIME_DATABASE_URL"),
    reason='the RLS wall is down (RUNTIME_DATABASE_URL unset) — eval "$(python3 tests/rls_wall.py)"')

SCOPE_A = "t.walltest.a"
SCOPE_B = "t.walltest.b"

_loop: asyncio.AbstractEventLoop | None = None


@pytest.fixture(scope="module", autouse=True)
def wall():
    """ONE loop and ONE db.init() for the module — asyncpg pools belong to the loop that made them."""
    global _loop
    _loop = asyncio.new_event_loop()
    db._pool = db._rt_pool = db._ctrl_pool = None
    _loop.run_until_complete(db.init())
    yield
    _loop.run_until_complete(_loop.shutdown_asyncgens())
    _loop.close()
    _loop = None
    db._pool = db._rt_pool = db._ctrl_pool = None   # the next module builds its own


def run(coro):
    return _loop.run_until_complete(coro)


def test_the_runtime_pool_is_the_fenced_role():
    """The owner bypasses FORCE RLS, so the ROLE is the wall: scoped_tx must be rocoto_rt."""
    async def go():
        async with db.scoped_tx(SCOPE_A) as con:
            rt = await con.fetchval("select current_user")
        return rt, await db.control_pool().fetchval("select current_user")

    rt, ctrl = run(go())
    assert rt == "rocoto_rt"
    assert ctrl == "rocoto_ctrl"


def test_a_cross_scope_write_is_refused_by_the_policy():
    """The refusal, shown: inside A, a row addressed to B is rejected.

    The message must name the row-level security policy. A missing grant refuses too, and would let
    a database with no policies at all read as fenced.
    """
    async def go():
        async with db.scoped_tx(SCOPE_A) as con:
            await con.execute("insert into event(scope, type, source) "
                              f"values('{SCOPE_B}'::ltree, 'message', 'wa')")

    with pytest.raises(asyncpg.PostgresError) as caught:
        run(go())
    assert "row-level security policy" in str(caught.value)


def test_a_neighbours_row_is_invisible():
    """Written under one scope, unreadable under its sibling — the database refuses, not the query."""
    async def go():
        async with db.scoped_tx(SCOPE_A) as con:
            await con.execute("delete from fact where key = 'wall:a'")
            await con.execute("insert into fact(scope, kind, text, key) "
                              f"values('{SCOPE_A}'::ltree, 'COMMERCIAL', 'A secret', 'wall:a')")
            mine = await con.fetchval("select count(*) from fact where key = 'wall:a'")
        async with db.scoped_tx(SCOPE_B) as con:
            neighbours = await con.fetchval("select count(*) from fact where key = 'wall:a'")
        # tier-P sees it, which is what makes the neighbour's zero a fence and not an empty table.
        tier_p = await db.control_pool().fetchval("select count(*) from fact where key = 'wall:a'")
        async with db.scoped_tx(SCOPE_A) as con:
            await con.execute("delete from fact where key = 'wall:a'")
        return mine, neighbours, tier_p

    mine, neighbours, tier_p = run(go())
    assert (mine, neighbours, tier_p) == (1, 0, 1)


def test_tier_p_cannot_forge_a_fact():
    """rocoto_ctrl sees every scope and may append override.* events — it may NOT write memory."""
    async def go():
        await db.control_pool().execute("insert into fact(scope, kind, text) "
                                        f"values('{SCOPE_A}'::ltree, 'COMMERCIAL', 'forged')")

    with pytest.raises(asyncpg.PostgresError) as caught:
        run(go())
    assert "permission denied" in str(caught.value).lower()


def test_a_blank_scope_is_refused_before_it_reaches_the_database():
    """The empty ltree is an ancestor of every path, so a blank scope would fail OPEN. It raises."""
    with pytest.raises(ValueError):
        db.scoped_tx("")
