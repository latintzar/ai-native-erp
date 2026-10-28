"""vroom.py — the route-optimisation client organ (Wave-3 §2d/§3, ONE kernel organ).

Builds a VROOM problem from (depot, stops), posts it to the VROOM HTTP solver (which sits on
loopback next to a self-hosted OSRM — deploy/route-stack/), and maps the solution back to the
supplier-web wire (contract.ts OptimizedRoute): ordered stops with 1-based positions + arrival
offsets, totals, and the route geometry decoded from VROOM's polyline into GeoJSON-style
[lng,lat] pairs.

HONESTY RULES: the solver URL comes from env (config.ROCOTO_VROOM_URL); when it is unset or the
solver is down/refusing, callers get a TYPED RoutingError (code + es-ES user message) — never a
fabricated fallback route dressed as an optimisation. (brain/route.py's NN+2-opt stays what it
always was: the demo/console seam, not this wire.)

No credentials: VROOM/OSRM are loopback-bound containers; nothing new is exposed through Caddy.
"""
from __future__ import annotations

import logging
from typing import Any, Optional

import httpx

import config

log = logging.getLogger("rocoto.vroom")

DEFAULT_SERVICE_S = 300           # 5 min per stop unless the caller states one
TIMEOUT_S = 30                    # a Cataluña-sized matrix solves in well under this


class RoutingError(Exception):
    """Typed, honest routing failure. `code` is machine-readable (en); `message` is the es-ES
    user-facing copy the web app shows verbatim."""

    def __init__(self, code: str, message: str, status: int = 503):
        super().__init__(code)
        self.code = code
        self.message = message
        self.status = status


def _hhmm_to_s(v: str) -> Optional[int]:
    """Local 'HH:MM' → seconds since midnight (VROOM relative time). None on a bad shape."""
    try:
        hh, _, mm = (v or "").partition(":")
        s = int(hh) * 3600 + int(mm) * 60
        return s if 0 <= s < 24 * 3600 else None
    except (TypeError, ValueError):
        return None


def decode_polyline(encoded: str, precision: int = 5) -> list[list[float]]:
    """Decode a Google-encoded polyline (VROOM/OSRM geometry, precision 5) → [[lng,lat], ...]
    (the contract's GeoJSON-style pair order). Empty/garbage → []."""
    if not encoded or not isinstance(encoded, str):
        return []
    factor = 10 ** precision
    coords: list[list[float]] = []
    lat = lng = 0
    i = 0
    try:
        while i < len(encoded):
            for which in (0, 1):
                shift = result = 0
                while True:
                    b = ord(encoded[i]) - 63
                    i += 1
                    result |= (b & 0x1F) << shift
                    shift += 5
                    if b < 0x20:
                        break
                delta = ~(result >> 1) if (result & 1) else (result >> 1)
                if which == 0:
                    lat += delta
                else:
                    lng += delta
            coords.append([lng / factor, lat / factor])
    except IndexError:
        log.warning("vroom: truncated polyline (decoded %d points)", len(coords))
    return coords


def build_problem(depot: dict, stops: list[dict]) -> tuple[dict, dict[int, str]]:
    """(depot {lat,lng}, stops [{order_id, lat, lng, service_s?, service_window?{start,end}}]) →
    (the VROOM problem json, job_id → order_id map). One vehicle, depot start AND end (the market
    round shape — the schema supports more vehicles later). Only located stops belong here; the
    caller excludes «sin dirección» rows before building."""
    if depot is None or depot.get("lat") is None or depot.get("lng") is None:
        raise RoutingError("no_depot", "Falta la ubicación del almacén. Añádela en Ajustes.", 400)
    jobs = []
    id_map: dict[int, str] = {}
    for i, s in enumerate(stops, start=1):
        if s.get("lat") is None or s.get("lng") is None:
            raise RoutingError("unlocated_stop",
                               "Hay paradas sin dirección — corrígelas antes de optimizar.", 400)
        job: dict[str, Any] = {
            "id": i,
            "location": [float(s["lng"]), float(s["lat"])],
            "service": int(s.get("service_s") or DEFAULT_SERVICE_S),
        }
        w = s.get("service_window") or {}
        a, b = _hhmm_to_s(w.get("start", "")), _hhmm_to_s(w.get("end", ""))
        if a is not None and b is not None and a < b:
            job["time_windows"] = [[a, b]]
        jobs.append(job)
        id_map[i] = str(s.get("order_id") or "")
    problem = {
        "vehicles": [{
            "id": 1,
            "profile": "car",
            "start": [float(depot["lng"]), float(depot["lat"])],
            "end": [float(depot["lng"]), float(depot["lat"])],
        }],
        "jobs": jobs,
        "options": {"g": True},   # ask for the route geometry (polyline) alongside the plan
    }
    return problem, id_map


async def solve(problem: dict) -> dict:
    """POST the problem to the VROOM endpoint. Typed errors on every honest failure mode:
    vroom_no_configurado (env unset) · vroom_caido (unreachable/timeout) · vroom_error (solver
    refused / non-zero code)."""
    url = (config.ROCOTO_VROOM_URL or "").strip()
    if not url:
        raise RoutingError("vroom_no_configurado",
                           "La optimización de rutas aún no está activada en este servidor.")
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_S) as client:
            r = await client.post(url, json=problem)
    except (httpx.HTTPError, OSError) as e:
        log.warning("vroom unreachable at %s: %s", url, e)
        raise RoutingError("vroom_caido",
                           "El optimizador de rutas no responde. Inténtalo de nuevo en unos minutos.")
    if r.status_code != 200:
        log.warning("vroom HTTP %s: %s", r.status_code, r.text[:400])
        raise RoutingError("vroom_error",
                           "El optimizador de rutas ha devuelto un error. Inténtalo de nuevo.")
    try:
        out = r.json()
    except ValueError:
        raise RoutingError("vroom_error",
                           "El optimizador de rutas ha devuelto una respuesta ilegible.")
    if out.get("code") not in (0, None) and not out.get("routes"):
        log.warning("vroom solver code=%s error=%s", out.get("code"), out.get("error"))
        raise RoutingError("vroom_error",
                           "No se ha podido calcular la ruta con esas paradas.")
    return out


def map_solution(solution: dict, id_map: dict[int, str]) -> dict:
    """VROOM solution → the OptimizedRoute wire (contract.ts): stops [{order_id, position,
    arrival_s}] in driving order, total_distance_m, total_duration_s, geometry [[lng,lat],…].
    Unassigned jobs (unreachable within windows) are reported honestly."""
    routes = solution.get("routes") or []
    if not routes:
        raise RoutingError("vroom_error", "El optimizador no ha encontrado ninguna ruta.")
    route = routes[0]                                   # one vehicle today
    stops = []
    pos = 0
    for step in route.get("steps") or []:
        if step.get("type") != "job":
            continue
        pos += 1
        stops.append({
            "order_id": id_map.get(int(step.get("id") or 0), ""),
            "position": pos,
            "arrival_s": int(step.get("arrival") or 0),
        })
    summary = solution.get("summary") or {}
    unassigned = [id_map.get(int(u.get("id") or 0), "") for u in (solution.get("unassigned") or [])]
    return {
        "stops": stops,
        "total_distance_m": int(summary.get("distance") or route.get("distance") or 0),
        "total_duration_s": int(summary.get("duration") or route.get("duration") or 0),
        "geometry": decode_polyline(route.get("geometry") or ""),
        "unassigned_order_ids": [u for u in unassigned if u],
    }


async def optimize(depot: dict, stops: list[dict]) -> dict:
    """The one-call façade: build → solve → map. Raises RoutingError on every honest failure."""
    problem, id_map = build_problem(depot, stops)
    solution = await solve(problem)
    return map_solution(solution, id_map)
