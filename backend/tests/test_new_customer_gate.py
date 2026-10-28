"""Issue #12 — the new-customer gate: per-tenant, off by default, first order parks."""
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

from brain import accept


def _con(flag, prior):
    con = MagicMock()
    con.fetchval = AsyncMock(side_effect=[flag, prior])
    return con


def _pool(con):
    pool = MagicMock()
    acq = MagicMock()
    acq.__aenter__ = AsyncMock(return_value=con)
    acq.__aexit__ = AsyncMock(return_value=False)
    pool.acquire = MagicMock(return_value=acq)
    return pool


def _run(flag, prior):
    con = _con(flag, prior)
    with patch.object(accept.db, "get_pool", return_value=_pool(con)):
        return asyncio.run(accept._hold_new_customer("t1", "+34600")), con


def test_off_by_default_never_holds():
    held, con = _run(None, 0)
    assert held is False
    assert con.fetchval.await_count == 1          # the prior-orders query never even runs


def test_first_order_holds_when_on():
    held, _ = _run(True, 1)                        # the order under evaluation is already filed
    assert held is True


def test_second_order_does_not_hold():
    held, _ = _run(True, 2)
    assert held is False
