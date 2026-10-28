"""brain/range.py — WHERE THEY DELIVER, STORED AS A RULE (SPEC §5.8a item 2).

Decision: `decisions/delivery-range-radius-2026-07-26.md` in Rocoto-Labs/company. **LOCKED: a radius in
kilometres from the depot**, one number, set at onboarding. It does three jobs, not one: an order to
a delivery point outside it goes to REVIEW instead of being silently accepted; it feeds the
Rutas/Reparto surface; and it is what makes a NEW customer's first order answerable at all.

THE ACCEPTED TRADE-OFF, written down because it is the thing that must not be forgotten:
  · A radius answers **"too far"**, not "we don't go there". Real delivery areas are not circles —
    they are the roads a van actually takes, and a river or a ring road makes 8 km further than 20.
  · **So the reason must read as DISTANCE** — «fuera de tu radio de reparto: ~34 km» — and must NEVER
    claim anything about a zone. We know how far away they are. We do not know whether the boss
    "goes there", and the review reason must not pretend otherwise: the comercial decides, we brief.
  · ZONES are the likely refinement (they match how these firms talk — «Chamberí, Salamanca, centro»
    — and match the `ruta` field already printed on their delivery documents). They are additive BY
    CONSTRUCTION: the row stores `range_kind`, so `range_kind='zones'` reads `zones` instead of
    `range_km` and no tenant already on 'radius' migrates. That is the whole reason this module
    stores a RULE and never a bare number.

THE THREE HONEST STATES — this is the point of the module. `check()` answers with one of:
  1. **the tenant never gave us a range** → known=False, servable=True. We invent no limit. A
     distributor who has not told us where he delivers must never see an order held for being "out
     of range" — that is a limit we made up, and the first one costs him a customer.
  2. **we don't know where the customer is** → known=False, servable=True. We cannot claim a distance
     we do not have. An unlocated customer is a gap in OUR data, never a fact about him.
  3. **both known** → servable = distance ≤ range_km, and only then is there a reason to give.
Silence is the safe answer twice out of three times, and that is by design (§5.8: the queue is
near-EMPTY, and a false «fuera de radio» is exactly the fourth-reason smell the review rule exists
to prevent).

DISPATCH: the range also feeds the Reparto/Rutas surface — `servable_customers()` is the read the
delivery list uses (who is inside the radius, who is outside, who we cannot place). **Route
OPTIMISATION is explicitly OUT OF SCOPE** (WP-5): the list is a day's work, optimisation is a
month's, and the existing `/api/sup/routes/optimize` (VROOM) stays the only thing that orders stops.
This module produces a LIST and a distance, never a route.

Fail-soft on the READ path (a live turn is never taken down by a settings table), never fail-soft on
the RULE: `set_range` RAISES on a range that is not a range.
"""
from __future__ import annotations

import json
import logging
import math
from typing import Any, Dict, List, Optional

log = logging.getLogger("rocoto.brain.range")

RADIUS = "radius"
ZONES = "zones"
KINDS: tuple[str, ...] = (RADIUS, ZONES)

# Mean Earth radius (IUGG). Haversine on a sphere is ~0.3% off the ellipsoid at these distances —
# a metre or two over 30 km, and the reason rounds to whole kilometres anyway.
EARTH_KM = 6371.0088
# A delivery radius bigger than this is a typo, not a rule — a boss typing 3000 for 30. These are
# vans doing a fresh round before the kitchens open; 300 km is already the whole of Madrid + reach.
MAX_RANGE_KM = 300.0


# ── pure geometry (no DB, no config, no I/O — the vital runs this with nothing installed) ────────
def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in km. Pure; no dependency (not even numpy) on purpose — this is the
    arithmetic a review reason is built on and it must be readable by anyone auditing the reason."""
    p1, p2 = math.radians(float(lat1)), math.radians(float(lat2))
    dp = p2 - p1
    dl = math.radians(float(lon2) - float(lon1))
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_KM * math.asin(math.sqrt(a))


def _coord(v: Any) -> Optional[float]:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(f) else f


def _located(lat: Any, lon: Any) -> Optional[tuple[float, float]]:
    """A pair of coordinates, or None. (0, 0) is rejected: it is the Gulf of Guinea, and in practice
    it is a null that lost its way — accepting it would put every customer 5.000 km outside."""
    la, lo = _coord(lat), _coord(lon)
    if la is None or lo is None:
        return None
    if not (-90.0 <= la <= 90.0) or not (-180.0 <= lo <= 180.0):
        return None
    if abs(la) < 1e-9 and abs(lo) < 1e-9:
        return None
    return la, lo


def _km_es(v: float) -> str:
    """A number of kilometres the way it is written in Spain — «34», «12,5», «1.240».

    THE SENTENCES BELOW ARE READ BY A SPANIARD, so the separators are his, not Python's. `f"{x:g}"`
    and `f"{x:d}"` render through the C locale whatever the process locale is: a boss who typed a
    radius of 12.5 was told «Un radio de 12.5 km no parece…» and a customer 1240 km away produced
    «~1240 km». Both are the English convention with the roles of the point and the comma swapped —
    the exact class of bug the `Locale.ENGLISH` date formatter was.

    Formatted BY HAND rather than through the `locale` module on purpose: `locale.setlocale` is
    PROCESS-GLOBAL and this runs inside a live async server, so setting it here would quietly change
    number parsing for every other module in the worker. Mirrors `brain/stock._es` (whole numbers
    lose the decimal — nobody says «34,0 km») and adds the thousands point that a distance, unlike a
    kilo count, can actually reach."""
    f = float(v)
    # `,` grouping + one decimal gives the en-US shape («1,240.5»); dropping a trailing «.0» is safe
    # because the format always writes the point, so the rstrip can never eat a significant zero
    # («1,240.0» → «1,240», «300.0» → «300», never «3»).
    body = f"{f:,.1f}".rstrip("0").rstrip(".")
    # Then swap the two separators into es-ES in ONE pass — sequential replaces would collide.
    return body.translate(str.maketrans({",": ".", ".": ","})) or "0"


def distance_reason(distance_km: float) -> str:
    """The ONE reason this order is in front of the comercial. es-ES, boss-facing, and it says
    DISTANCE and nothing else — no zone, no "no repartimos ahí", no list."""
    return f"fuera de tu radio de reparto: ~{_km_es(round(float(distance_km)))} km"


def point_in_ring(lat: float, lon: float, ring: List[Any]) -> bool:
    """Ray casting on a [[lat,lon], …] ring. No deps, no projection: at a city's scale the error
    is far below the precision a hand-drawn delivery zone has anyway."""
    inside = False
    n = len(ring)
    if n < 3:
        return False
    j = n - 1
    for i in range(n):
        pi, pj = ring[i], ring[j]
        try:
            yi, xi = float(pi[0]), float(pi[1])
            yj, xj = float(pj[0]), float(pj[1])
        except (TypeError, ValueError, IndexError):
            j = i
            continue
        if (yi > lat) != (yj > lat) and lon < (xj - xi) * (lat - yi) / ((yj - yi) or 1e-12) + xi:
            inside = not inside
        j = i
    return inside


def drawable(zones: Any) -> bool:
    """Is there at least one zone we can actually TEST A POINT AGAINST — a dict carrying a ring?

    A list of NAMES is not a drawing. `zones=["centro","norte"]` is a perfectly reasonable thing to
    find in the column (a firm typed its areas before anyone drew them, or an import brought the
    words across), and `zone_at` correctly matches none of them — but «matched no zone» and «cannot
    evaluate» are different answers, and only the first may become «fuera de tus zonas». Without
    this, a named-but-undrawn rule holds every order in the country on a claim we cannot support,
    which is the exact «inventing a limit» this module's docstring forbids. Caught by
    vital_range R7/db, which is older than the zone evaluator and was right to keep failing."""
    for z in zones or []:
        if isinstance(z, dict) and (z.get("ring") or []):
            return True
    return False


def zone_at(zones: List[Any], lat: float, lon: float) -> Optional[str]:
    """The NAME of the first zone containing the point, or None. The name is the whole point:
    these firms already say «Chamberí, Salamanca, centro» and print a `ruta` on their albaranes,
    so a zone hit gives the document a word it already uses."""
    for z in zones or []:
        if not isinstance(z, dict):
            continue
        if point_in_ring(lat, lon, z.get("ring") or []):
            return str(z.get("name") or "").strip() or "zona"
    return None


def verdict(rng: Dict[str, Any], lat: Any, lon: Any) -> Dict[str, Any]:
    """The rule, evaluated. Pure: `rng` is a `get_range()` row, `lat`/`lon` are the delivery point.

    TWO KINDS NOW (Peter, 2026-08-07: «zonas de reparto is super important»). A radius answers
    «too far»; ZONES answer «we go there», which is the thing a comercial actually decides — and
    they carry a NAME the albarán already prints. The three honest states are unchanged: a rule we
    cannot evaluate (no zones drawn, no geo) still says nothing rather than inventing a limit."""
    out: Dict[str, Any] = {"known": False, "servable": True, "distance_km": None, "reason": "",
                           "zone": None}
    if rng and rng.get("set") and rng.get("range_kind") == ZONES:
        here = _located(lat, lon)
        zones = rng.get("zones") or []
        if not here or not drawable(zones):
            return out                               # 1/2 · no drawing or no geo → no claim
        name = zone_at(zones, here[0], here[1])
        out["known"] = True
        out["zone"] = name
        out["servable"] = name is not None
        depot = _located(rng.get("depot_lat"), rng.get("depot_lon"))
        if depot:
            out["distance_km"] = round(haversine_km(depot[0], depot[1], here[0], here[1]), 2)
        if not out["servable"]:
            # NEVER a distance sentence here: with zones the answer is about the AREA, and
            # saying «~34 km» would claim the wrong thing (the trade-off note above, inverted).
            out["reason"] = "fuera de tus zonas de reparto"
        return out
    if not rng or not rng.get("set") or rng.get("range_kind") != RADIUS:
        return out                                   # 1 · no rule → we invent no limit
    depot = _located(rng.get("depot_lat"), rng.get("depot_lon"))
    here = _located(lat, lon)
    if not depot or not here:
        return out                                   # 2 · no geo → we claim no distance
    km = haversine_km(depot[0], depot[1], here[0], here[1])
    limit = float(rng.get("range_km") or 0)
    out["known"] = True
    out["distance_km"] = round(km, 2)
    out["servable"] = km <= limit
    if not out["servable"]:
        out["reason"] = distance_reason(km)          # 3 · both known → a distance, and only that
    return out


# ── the rule, on disk ────────────────────────────────────────────────────────────────────────────
def _row(tenant: str, r: Any) -> Dict[str, Any]:
    """Normalise a `tenant_range` row (or its absence) into the one shape callers read. `set` means
    EVALUABLE — the tenant gave us a rule AND the depot we measure it from. A half-filled row (a
    radius with no depot) is not a rule yet, and a settings screen can still see the parts."""
    d = dict(r) if r else {}
    kind = (d.get("range_kind") or RADIUS) if r else RADIUS
    km = _coord(d.get("range_km"))
    depot = _located(d.get("depot_lat"), d.get("depot_lon"))
    zones = d.get("zones")
    if isinstance(zones, str):
        try:
            zones = json.loads(zones or "[]")
        except ValueError:
            zones = []
    return {
        "tenant_id": tenant,
        "range_kind": kind,
        "range_km": km,
        "depot_lat": depot[0] if depot else None,
        "depot_lon": depot[1] if depot else None,
        "depot_label": d.get("depot_label") or "",
        "zones": zones or [],
        # EVALUABLE, per kind (2026-08-07): a radius needs a number AND the depot it is measured
        # from; ZONES need a closed drawing and nothing else — a firm that works by areas may
        # never have told us where the nave is, and that must not silently disable its rule.
        # `set` means EVALUABLE, not «somebody typed something»: a list of zone NAMES with no ring
        # is a rule we cannot apply, and calling it set makes every caller believe there is a limit
        # to enforce. `drawable()` is the same test `verdict()` uses, so the two can never disagree
        # about whether this rule exists.
        "set": bool(
            (kind == RADIUS and km and km > 0 and depot)
            or (kind == ZONES and drawable(zones))
        ),
    }


async def get_range(con, tenant: str) -> Dict[str, Any]:
    """The tenant's delivery rule. Never raises: an unreadable settings table means "no rule", which
    is the honest and harmless answer (state 1), not a broken order turn."""
    try:
        r = await con.fetchrow(
            "select tenant_id, range_kind, range_km::float8 as range_km, depot_lat, depot_lon, "
            "       depot_label, zones from tenant_range where tenant_id = $1", tenant)
    except Exception:
        log.exception("range: could not read tenant_range for %s — treating as NOT SET", tenant)
        r = None
    return _row(tenant, r)


async def set_range(con, tenant: str, *, range_km: Any, depot_lat: Any, depot_lon: Any,
                    depot_label: str = "") -> Dict[str, Any]:
    """Set the radius rule. RAISES ValueError (es-ES, boss-facing) on anything that is not a range —
    the write path is a settings save by a human, not a live turn, and a silently-swallowed bad
    radius would hold real orders for a reason nobody could explain.

    `range_kind` is written explicitly even though it is the only kind today: the column is the seam,
    and a row that never states its kind is a bare number wearing a rule's clothes."""
    km = _coord(range_km)
    if km is None or km <= 0:
        raise ValueError("El radio de reparto tiene que ser un número de kilómetros mayor que cero.")
    if km > MAX_RANGE_KM:
        raise ValueError(f"Un radio de {_km_es(km)} km no parece un radio de reparto "
                         f"(el máximo es {_km_es(MAX_RANGE_KM)} km).")
    depot = _located(depot_lat, depot_lon)
    if not depot:
        raise ValueError("Falta la ubicación del almacén: sin ella no se puede medir la distancia.")
    await con.execute(
        "insert into tenant_range (tenant_id, range_kind, range_km, depot_lat, depot_lon, "
        "                          depot_label, updated_at) "
        "values ($1, $2, $3, $4, $5, $6, now()) "
        "on conflict (tenant_id) do update set range_kind = excluded.range_kind, "
        "  range_km = excluded.range_km, depot_lat = excluded.depot_lat, "
        "  depot_lon = excluded.depot_lon, depot_label = excluded.depot_label, updated_at = now()",
        tenant, RADIUS, km, depot[0], depot[1], (depot_label or "").strip()[:120])
    return await get_range(con, tenant)


async def set_zones(con, tenant: str, zones: List[Any], *, depot_lat: Any = None,
                    depot_lon: Any = None, depot_label: str = "") -> Dict[str, Any]:
    """Switch the rule to ZONES and store the drawing. RAISES (es-ES) on anything that is not a
    zone — same posture as set_range: a settings save by a human, never a live turn.

    A zone is {name, ring:[[lat,lon], …]}. The depot is kept when it is known (Reparto still times
    every run from the door, and the map still opens there) but it is NOT required: a firm that
    works by areas may never have told us where the nave is."""
    clean: List[Dict[str, Any]] = []
    for z in zones or []:
        if not isinstance(z, dict):
            continue
        name = str(z.get("name") or "").strip()[:60]
        ring = [[float(p[0]), float(p[1])] for p in (z.get("ring") or [])
                if isinstance(p, (list, tuple)) and len(p) >= 2]
        if not name:
            raise ValueError("Cada zona necesita un nombre — es el que sale en el albarán.")
        if len(ring) < 3:
            raise ValueError(f"«{name}» no llega a ser una zona: dibújala con al menos tres puntos.")
        clean.append({"name": name, "ring": ring})
    if not clean:
        raise ValueError("Dibuja al menos una zona, o quédate con el radio en kilómetros.")
    if len({z["name"].lower() for z in clean}) != len(clean):
        raise ValueError("Dos zonas con el mismo nombre — el albarán no sabría cuál imprimir.")
    depot = _located(depot_lat, depot_lon)
    await con.execute(
        "insert into tenant_range (tenant_id, range_kind, zones, depot_lat, depot_lon, "
        "                          depot_label, updated_at) "
        "values ($1, $2, $3::jsonb, $4, $5, $6, now()) "
        "on conflict (tenant_id) do update set range_kind = excluded.range_kind, "
        "  zones = excluded.zones, "
        "  depot_lat = coalesce(excluded.depot_lat, tenant_range.depot_lat), "
        "  depot_lon = coalesce(excluded.depot_lon, tenant_range.depot_lon), "
        "  depot_label = case when excluded.depot_label <> '' then excluded.depot_label "
        "                     else tenant_range.depot_label end, updated_at = now()",
        tenant, ZONES, clean,
        depot[0] if depot else None, depot[1] if depot else None,
        (depot_label or "").strip()[:120])
    return await get_range(con, tenant)


async def check(con, tenant: str, *, lat: Any, lon: Any) -> Dict[str, Any]:
    """Is this delivery point inside the tenant's range? Returns
    {known, servable, distance_km, reason} — the three honest states above.

    The live path. It never raises and it never invents: `servable` is True whenever we do not
    genuinely know otherwise, so the only order this can hold is one we can actually measure."""
    return verdict(await get_range(con, tenant), lat, lon)


# ── the dispatch read (Reparto/Rutas) ────────────────────────────────────────────────────────────
def _profile_geo(r: Dict[str, Any]) -> Optional[tuple[float, float]]:
    """A customer's coordinates. The first-class `lat`/`lon` columns win; the legacy
    `stats.location` blob (keyed `lng`, written by the call/location path and read by
    `/api/sup/routes/day`) is the fallback, so nothing that already shipped has to move first."""
    here = _located(r.get("lat"), r.get("lon"))
    if here:
        return here
    stats = r.get("stats")
    if isinstance(stats, str):
        try:
            stats = json.loads(stats or "{}")
        except ValueError:
            stats = {}
    loc = (stats or {}).get("location") if isinstance(stats, dict) else None
    if isinstance(loc, dict):
        return _located(loc.get("lat"), loc.get("lng") if loc.get("lng") is not None else loc.get("lon"))
    return None


async def customer_point(con, tenant: str, phone: str) -> Optional[tuple[float, float]]:
    """Where we deliver to THIS customer, or None. The live order path's one geo read.

    It lives here rather than in the caller so that exactly one module knows the two places a
    delivery point can hide (the first-class `lat`/`lon` columns, and the legacy `stats.location`
    blob keyed `lng`) — `_profile_geo` is that knowledge, and a second copy of it in the pipeline is
    how the fallback quietly stops being read.

    None means "we do not know where they are", which `verdict()` turns into state 2: no claim, no
    distance, no review. Fail-soft to None for the same reason — an unreadable profile is a gap in
    OUR data and must never become a held order."""
    try:
        r = await con.fetchrow(
            "select lat, lon, stats from customer_profiles where tenant_id = $1 and phone_number = $2",
            tenant, phone)
    except Exception:
        log.exception("range: could not read the delivery point for %s (%s)", phone, tenant)
        return None
    return _profile_geo(dict(r)) if r else None


async def servable_customers(con, tenant: str) -> Dict[str, Any]:
    """The delivery LIST the Reparto surface reads: every customer of this tenant, split by the rule.

      {"known", "range_km", "depot", "inside": [...], "outside": [...], "unplaced": [...]}

    Each entry carries phone_number · name · address · lat · lon · distance_km, sorted nearest-first
    so the list reads like a round even though nobody optimised it. **Route optimisation is OUT OF
    SCOPE** (WP-5) — the list is a DAY; ordering stops properly is the VROOM organ behind
    `/api/sup/routes/optimize`, and this function must never grow into it. `unplaced` is not a
    failure: it is the honest "we don't know where they are" bucket, and it is what the surface shows
    inline as «sin dirección» instead of dropping the customer off the day.

    When the tenant has no range at all, every located customer lands in `inside` with known=False —
    a delivery list is still a delivery list without a radius; the radius only sorts it."""
    rng = await get_range(con, tenant)
    try:
        rows = await con.fetch(
            "select phone_number, display_name, address, lat, lon, stats from customer_profiles "
            "where tenant_id = $1", tenant)
    except Exception:
        log.exception("range: could not read customer_profiles for %s", tenant)
        rows = []
    depot = (rng["depot_lat"], rng["depot_lon"]) if rng["set"] else None
    inside: List[Dict[str, Any]] = []
    outside: List[Dict[str, Any]] = []
    unplaced: List[Dict[str, Any]] = []
    for r in rows:
        d = dict(r)
        here = _profile_geo(d)
        entry = {
            "phone_number": d.get("phone_number"),
            "name": d.get("display_name") or d.get("phone_number"),
            "address": d.get("address") or "",
            "lat": here[0] if here else None,
            "lon": here[1] if here else None,
            "distance_km": None,
        }
        if not here:
            unplaced.append(entry)
            continue
        # ONE evaluator for both kinds (2026-08-07): the split used to be radius-only arithmetic,
        # so a tenant on zones saw everyone «inside» — the list would have lied on the very
        # surface the zones exist to drive.
        v = verdict(rng, here[0], here[1])
        entry["distance_km"] = v.get("distance_km")
        entry["zone"] = v.get("zone")
        (inside if v.get("servable") else outside).append(entry)
    key = lambda e: (e["distance_km"] is None, e["distance_km"] or 0.0)  # noqa: E731
    inside.sort(key=key)
    outside.sort(key=key)
    return {
        "known": bool(rng["set"]),
        "range_kind": rng.get("range_kind"),
        "range_km": rng["range_km"],
        "zones": rng.get("zones") or [],
        "depot": {"lat": rng["depot_lat"], "lon": rng["depot_lon"], "label": rng["depot_label"]},
        "inside": inside,
        "outside": outside,
        "unplaced": unplaced,
    }
