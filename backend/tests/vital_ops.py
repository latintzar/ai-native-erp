"""Prove alert durability, outbound isolation, compatibility and heartbeat liveness."""
import asyncio
import os
from unittest.mock import AsyncMock, patch

os.environ.setdefault("ROCOTO_EGRESS_SANDBOX", "1")

import actions  # noqa: E402
import ops  # noqa: E402
import twilio_wa  # noqa: E402


async def main():
    with patch.object(twilio_wa, "send_whatsapp", new_callable=AsyncMock) as wa, \
            patch.object(actions, "send_email", new_callable=AsyncMock) as email, \
            patch.object(twilio_wa, "start_outbound_call", new_callable=AsyncMock) as phone:
        first = await ops.record_alert("F", "vital: synthetic environment fault")
        second = await ops.surface_to_peter("report", "vital: synthetic debrief")
        assert first["via"] == second["via"] == "inbox"
        assert first["alert_id"] and second["alert_id"]
        wa.assert_not_awaited()
        email.assert_not_awaited()
        phone.assert_not_awaited()
        print("[PASS] both interfaces preserve alerts and leave every external transport unused")
    con = await ops._conn()
    try:
        row = await con.fetchrow("select * from alert where id=$1", first["alert_id"])
        assert row["detail"] == "vital: synthetic environment fault"
        assert row["resolved_at"] is None and not row["surfaced"]
        print("[PASS] durable alert remains available to the operator inbox")
        await ops.stamp("vital_unit", {"note": "vital"})
        heartbeat = await ops.heartbeats()
        assert heartbeat["vital_unit"] < 60
        print("[PASS] heartbeat stamp/read remains live")
        with patch.object(ops, "_alert_open", new=AsyncMock(return_value=None)):
            failed = await ops.record_alert("F", "vital: synthetic database failure")
            assert failed["via"] == "log" and failed["alert_id"] is None
        print("[PASS] persistence failure is reported rather than claimed delivered")
    finally:
        await con.execute("delete from alert where detail like 'vital: synthetic%'")
        await con.execute("delete from heartbeat where unit='vital_unit'")
        await con.close()
    print("OPS: durable alerts, transport isolation and heartbeats GREEN")


asyncio.run(main())
