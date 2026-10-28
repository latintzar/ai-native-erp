"""business_day.py — the working day of a market that starts before dawn.

Raquel (Julio Pérez), 2026-08-19, describing a bug we would have shipped:

    «Un cliente me escribe a las doce y media de la noche… el programa recoge la hora, pero como me
    pone "para mañana" lo va a recoger para el día 21. Y cuando voy a imprimir no lo tengo. Me
    vuelvo loca.»

She is serving at 21:30 and at the market buying at midnight. At 00:30 her working day has NOT
turned over — «hoy» is still the day she has been working, so «mañana» is the day she will deliver.
The calendar disagrees with her by one, and the consequence is not cosmetic: the order is filed for
a day she is not printing, so it is not on the sheet, so it does not go on the van.

Her own guess at the boundary, and it is the right shape: «habrá algún, por ejemplo las seis, en las
que ya es un día nuevo».

So the business day rolls at a per-tenant hour (default 06:00), and EVERY relative date — hoy,
mañana, pasado, el jueves — is resolved against it rather than against midnight.
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timedelta
from typing import Optional
from zoneinfo import ZoneInfo

log = logging.getLogger("rocoto.business_day")

SETTING_KEY = "business_day"
DEFAULT_ROLLOVER_HOUR = 6
DEFAULT_TZ = "Europe/Madrid"


def parse_settings(raw: Optional[dict]) -> dict:
    """Validate a `business_day` setting → {tz, rollover_hour}. Never raises; falls back."""
    raw = raw or {}
    tz = str(raw.get("tz") or DEFAULT_TZ).strip() or DEFAULT_TZ
    try:
        ZoneInfo(tz)
    except Exception:
        log.warning("business_day: unknown timezone %r — using %s", tz, DEFAULT_TZ)
        tz = DEFAULT_TZ
    try:
        hour = int(raw.get("rollover_hour", DEFAULT_ROLLOVER_HOUR))
    except (TypeError, ValueError):
        hour = DEFAULT_ROLLOVER_HOUR
    if not 0 <= hour <= 12:
        # past midday it is not a "day boundary" any more, it is a shift — refuse rather than
        # silently file every afternoon order on yesterday
        log.warning("business_day: rollover_hour %r out of range — using %d", hour, DEFAULT_ROLLOVER_HOUR)
        hour = DEFAULT_ROLLOVER_HOUR
    return {"tz": tz, "rollover_hour": hour}


def today(now: Optional[datetime] = None, *, tz: str = DEFAULT_TZ,
          rollover_hour: int = DEFAULT_ROLLOVER_HOUR) -> date:
    """The date SHE would call «hoy» at this instant.

    Before the rollover hour the working day has not turned over yet, so the business day is still
    the previous calendar date. At or after it, the two agree."""
    zone = ZoneInfo(tz)
    n = (now or datetime.now(zone)).astimezone(zone)
    return (n.date() - timedelta(days=1)) if n.hour < rollover_hour else n.date()


async def for_tenant(tenant: str, now: Optional[datetime] = None) -> date:
    """`today()` with this tenant's own boundary. Fail-soft to the defaults — a settings hiccup
    must not move everybody's orders by a day."""
    cfg = {"tz": DEFAULT_TZ, "rollover_hour": DEFAULT_ROLLOVER_HOUR}
    try:
        import db
        cfg = parse_settings((await db.settings_get(tenant) or {}).get(SETTING_KEY))
    except Exception:
        log.debug("business_day: settings unavailable for %s (fail-soft)", tenant, exc_info=True)
    return today(now, tz=cfg["tz"], rollover_hour=cfg["rollover_hour"])
