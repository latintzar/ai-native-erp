"""§2b.2 (WEB-PRODUCT-BUILD-PLAN) — the customer-coordinate WRITER that never existed.

`customer_profiles.lat/lon` have been first-class columns since §5.8a, `brain/range.py` reads
them honestly (`known=False` when NULL) — and nothing in the live path has ever written them
(PRODUCT-SPEC §0.13 row 6). This module is the writer:

  · `geocode_one(address)` — Nominatim (OSM), es-biased, 1 req/s per their usage policy.
  · `geocode_missing(tenant?, limit)` — the sweep: profiles WITH an address and WITHOUT a point.
    Idempotent; a failed lookup marks `geocode_failed_at` in stats so the sweep never hammers
    the same bad address (retried only after 7 days).

Run by hand (backfill) or from the worker:  python -m brain.geocode [tenant] [limit]
LAW: a coordinate is DERIVED from the address the supplier gave — never guessed, never typed by
us. No result → the profile stays NULL and range keeps saying «no lo sé» (§0.13).
"""
from __future__ import annotations

import asyncio
import json
import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple

import httpx

import db

NOMINATIM = "https://nominatim.openstreetmap.org/search"
UA = "Rocoto/1.0 (ops@soyrocoto.com)"          # Nominatim policy: identify yourself
MIN_INTERVAL_S = 1.1                            # policy: max 1 req/s
RETRY_FAILED_AFTER_S = 7 * 24 * 3600

_last_call = 0.0


def parse_hit(payload: Any) -> Optional[Tuple[float, float]]:
    """Pure: Nominatim JSON → (lat, lon) or None. First hit wins; junk shapes return None."""
    try:
        if not payload:
            return None
        hit = payload[0]
        return (float(hit["lat"]), float(hit["lon"]))
    except (KeyError, TypeError, ValueError, IndexError):
        return None


async def geocode_one(address: str) -> Optional[Tuple[float, float]]:
    global _last_call
    address = (address or "").strip()
    if len(address) < 6:                        # «c/» alone is not an address
        return None
    wait = MIN_INTERVAL_S - (time.monotonic() - _last_call)
    if wait > 0:
        await asyncio.sleep(wait)
    _last_call = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=10.0, headers={"User-Agent": UA}) as cli:
            r = await cli.get(NOMINATIM, params={
                "q": address, "format": "json", "limit": 1, "countrycodes": "es"})
            r.raise_for_status()
            return parse_hit(r.json())
    except Exception:
        return None


async def geocode_missing(tenant: Optional[str] = None, limit: int = 40) -> Dict[str, int]:
    """The sweep. Returns {seen, written, failed, skipped_recent}."""
    pool = db.get_pool()
    out = {"seen": 0, "written": 0, "failed": 0, "skipped_recent": 0}
    now = datetime.now(timezone.utc)
    async with pool.acquire() as con:
        q = """select phone_number, tenant_id, address, stats
                 from customer_profiles
                where address <> '' and lat is null
                  and ($1::text is null or tenant_id = $1)
                order by updated_at desc limit $2"""
        rows = await con.fetch(q, tenant, limit)
        for r in rows:
            out["seen"] += 1
            stats = r["stats"] if isinstance(r["stats"], dict) else json.loads(r["stats"] or "{}")
            failed_at = stats.get("geocode_failed_at")
            if failed_at:
                try:
                    age = (now - datetime.fromisoformat(failed_at)).total_seconds()
                    if age < RETRY_FAILED_AFTER_S:
                        out["skipped_recent"] += 1
                        continue
                except ValueError:
                    pass
            pt = await geocode_one(r["address"])
            if pt:
                await con.execute(
                    """update customer_profiles
                          set lat=$3, lon=$4, stats = stats - 'geocode_failed_at',
                              updated_at=now()
                        where phone_number=$1 and tenant_id=$2""",
                    r["phone_number"], r["tenant_id"], pt[0], pt[1])
                out["written"] += 1
            else:
                await con.execute(
                    """update customer_profiles
                          set stats = stats || jsonb_build_object('geocode_failed_at', $3::text)
                        where phone_number=$1 and tenant_id=$2""",
                    r["phone_number"], r["tenant_id"], now.isoformat())
                out["failed"] += 1
    return out


if __name__ == "__main__":
    import sys
    t = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] != "-" else None
    lim = int(sys.argv[2]) if len(sys.argv) > 2 else 40

    async def _main():
        await db.init()
        print(json.dumps(await geocode_missing(t, lim)))

    asyncio.run(_main())
