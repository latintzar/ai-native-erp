"""presence.py — WP-8b person-layer (R6 pacing + R8 relationship stage). Deterministic, no LLM.

R6 PACING: a SELF-STARTED touch keeps human hours — it HOLDS in the night (22:00–08:30) or the siesta
(15:00–17:00, local Madrid) and fires at the next reasonable window. Reactive replies are instant; only
the worker's proactive timers are paced. R8 STAGE: the dyad's relationship_stage (new→courting→settled)
from the interaction count — colours the register + restraint.
"""
from __future__ import annotations

from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

TZ = ZoneInfo("Europe/Madrid")
NIGHT_START, MORNING = time(22, 0), time(8, 30)
SIESTA_START, SIESTA_END = time(15, 0), time(17, 0)


def _local(now: datetime | None = None) -> datetime:
    return (now or datetime.now(TZ)).astimezone(TZ)


def quiet_now(now: datetime | None = None) -> bool:
    """True in the night (22:00–08:30) or the siesta (15:00–17:00), local Madrid."""
    t = _local(now).time()
    night = (t >= NIGHT_START) or (t < MORNING)
    siesta = SIESTA_START <= t < SIESTA_END
    return night or siesta


def next_ok_time(now: datetime | None = None) -> datetime:
    """The next non-quiet local instant — where a paced proactive send is re-armed to fire."""
    n = _local(now)
    for _ in range(60):
        if not quiet_now(n):
            return n
        n = n + timedelta(minutes=30)
    return n


async def relationship_stage(con, scope: str) -> str:
    """R8: new (few exchanges) → courting → settled (many), from the two-way message count."""
    n = await con.fetchval(
        "select count(*) from event where scope=$1::ltree and lane='world' "
        "and type in ('message','msg.sent')", scope) or 0
    if n < 6:
        return "new"
    if n < 30:
        return "courting"
    return "settled"
