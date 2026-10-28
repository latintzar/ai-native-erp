"""Operational alerts and unit heartbeats.

Alerts are persisted for the control-room inbox and emitted as structured metadata logs.
External operational notifications belong to monitoring. Customer content stays in the database.
Legacy callers retain their result shape while older deployment scripts migrate.
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Optional

from narrate import _load_env_file  # reuse the exact env loader

_load_env_file()

import config  # noqa: E402

log = logging.getLogger(__name__)

async def _conn():
    import asyncpg
    return await asyncpg.connect(config.DATABASE_URL)


async def _alert_open(kind: str, detail: str, ref_scope: Optional[str]) -> Optional[int]:
    try:
        con = await _conn()
        try:
            return await con.fetchval(
                "insert into alert(kind, detail, ref_scope) values($1,$2,$3) returning id",
                kind, detail, ref_scope)
        finally:
            await con.close()
    except Exception as e:
        log.error("alert persistence failed: %s", type(e).__name__)
        return None


async def record_alert(kind: str, detail: str, ref_scope: Optional[str] = None) -> dict:
    """Persist an unresolved inbox alert and log metadata; return the legacy result shape.

    Fail-soft for operational callers. Product callers must require alert_id before recording
    internal delivery. The surfaced flag records external delivery; operator resolution uses resolved_at.
    """
    alert_id = await _alert_open(kind, detail, ref_scope)
    via = "inbox" if alert_id is not None else "log"
    log.log(logging.INFO if kind == "report" else logging.ERROR,
            "runtime alert id=%s", alert_id,
            extra={"kind": kind, "outcome": via})
    return {"class": kind, "via": via, "alert_id": alert_id}


async def surface_to_peter(cls: str, detail: str, ref_scope: Optional[str] = None) -> dict:
    """Compatibility for older deployed scripts: records locally, with no external transport."""
    return await record_alert(cls, detail, ref_scope)


async def stamp(unit: str, detail: Optional[dict] = None) -> None:
    """Heartbeat: a background unit records liveness (upsert). Fail-soft — a stamp never breaks a tick."""
    try:
        con = await _conn()
        try:
            await con.execute(
                "insert into heartbeat(unit, ts, detail) values($1, now(), $2) "
                "on conflict (unit) do update set ts=now(), detail=$2",
                unit, json.dumps(detail or {}))
        finally:
            await con.close()
    except Exception:
        pass


async def heartbeats() -> dict:
    """Read every unit's heartbeat age in seconds (for /healthz). Fail-soft → {} on any error."""
    try:
        con = await _conn()
        try:
            rows = await con.fetch("select unit, extract(epoch from now()-ts)::int as age from heartbeat")
            return {r["unit"]: r["age"] for r in rows}
        finally:
            await con.close()
    except Exception:
        return {}


if __name__ == "__main__":
    import sys
    if len(sys.argv) >= 3 and sys.argv[1] == "surface":
        print(asyncio.run(surface_to_peter(sys.argv[2], " ".join(sys.argv[3:]) or "(no detail)")))
    else:
        print("usage: ops.py surface <class> <detail…>")
