"""Alert privacy and retry regression coverage, independent of provider credentials."""
import asyncio
import logging
from unittest.mock import AsyncMock, patch

import logging_setup
import mindcheck
import ops


def test_alert_log_excludes_customer_content_and_phone_scope(caplog):
    content = "private customer order details"
    scope = "wa.34932211000"
    with (
        patch.object(ops, "_alert_open", new=AsyncMock(return_value=42)) as persist,
        caplog.at_level(logging.INFO, logger="ops"),
    ):
        result = asyncio.run(ops.record_alert("report", content, scope))
    persist.assert_awaited_once_with("report", content, scope)
    assert result["alert_id"] == 42
    rendered = "\n".join(logging_setup.JsonLine().format(record) for record in caplog.records)
    assert "34932211000" not in rendered
    assert content not in rendered
    assert "42" in rendered


def test_outage_persistence_retries_then_suppresses_duplicates():
    failure = {"alert_id": None, "via": "log"}
    success = {"alert_id": 42, "via": "inbox"}
    status = {"state": "down", "terminal": True, "detail": "credit exhausted"}
    with (
        patch.dict(mindcheck._state, {"paged": False}),
        patch.object(ops, "record_alert", new=AsyncMock(side_effect=[failure, success])) as persist,
    ):
        asyncio.run(mindcheck.report_if_down(status))
        assert mindcheck._state["paged"] is False
        asyncio.run(mindcheck.report_if_down(status))
        assert mindcheck._state["paged"] is True
        asyncio.run(mindcheck.report_if_down(status))
        assert persist.await_count == 2
