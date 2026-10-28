"""Reverse-phone location enrichment (Stage 7, the founder-hermes way).

A PSTN call exposes no GPS, so we enrich number → business → coordinates: a known customer's
stored location if we have one, else (for the demo) the reverse-location SEED — a real restaurant
the map lands on. Toggleable at runtime in Founder Settings (off before demoing to a real business).
"""
from __future__ import annotations

from typing import Any, Dict, Optional

import config
import db

_SETTINGS_KEY = "location_seed"


async def _seed_state() -> Dict[str, Any]:
    """Runtime override of the LOCATION_SEED_* config, set from Founder Settings."""
    s = await db.settings_get(_SETTINGS_KEY) or {}
    return {
        "enabled": s.get("enabled", config.LOCATION_SEED_ENABLED),
        "name": s.get("name", config.LOCATION_SEED_NAME),
        "lat": s.get("lat", config.LOCATION_SEED_LAT),
        "lng": s.get("lng", config.LOCATION_SEED_LNG),
    }


async def set_seed(enabled: bool, name: Optional[str] = None,
                   lat: Optional[float] = None, lng: Optional[float] = None) -> Dict[str, Any]:
    cur = await _seed_state()
    cur["enabled"] = bool(enabled)
    if name is not None:
        cur["name"] = name
    if lat is not None:
        cur["lat"] = lat
    if lng is not None:
        cur["lng"] = lng
    await db.settings_set(_SETTINGS_KEY, cur)
    return cur


async def enrich_location(phone: str, tenant: Optional[str] = None) -> Dict[str, Any]:
    tenant = tenant or config.BRAIN_TENANT
    pool = db.get_pool()
    # 1) a known customer with a stored location
    async with pool.acquire() as con:
        prof = await con.fetchrow(
            "select stats, display_name from customer_profiles where tenant_id=$1 and phone_number=$2",
            tenant, phone)
    if prof:
        stats = prof["stats"]
        if isinstance(stats, dict):
            loc = stats.get("location")
            if isinstance(loc, dict) and loc.get("lat"):
                return {"lat": loc["lat"], "lng": loc["lng"], "source": "profile",
                        "business": loc.get("business") or prof["display_name"],
                        "address": loc.get("address", "")}
    # 2) reverse-location demo seed — land on a real restaurant
    seed = await _seed_state()
    if seed["enabled"]:
        return {"lat": seed["lat"], "lng": seed["lng"], "business": seed["name"],
                "address": seed["name"], "source": "seed", "seeded": True}
    # 3) nothing we can place
    return {}
