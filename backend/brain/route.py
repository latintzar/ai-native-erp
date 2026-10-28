"""Route optimization for the Delivery Manager (deliveries.md) — sequences the day's stops into the
fastest round and reports the km/time saved + freed capacity.

Two paths, by design (the plan): a real solver (VROOM + a pre-baked OSRM Madrid graph, dockerized,
health-checked, behind a flag) for production, and a **pure-Python nearest-neighbour + 2-opt fallback**
that runs anywhere with no infra. This module is the fallback (always available) + the seam the VROOM
client plugs into. Results over the seeded Alcalá round are DETERMINISTIC, so Roborazzi renders and the
console read the same optimized sequence every time (cached fixtures, not a live solver, on the render
path). The consolidation strategy (`delivery.consolidation`) consumes the freed-capacity signal.
"""
from __future__ import annotations

import math
from typing import Dict, List

# The seeded 8-stop Alcalá de Henares charcutería round (lat, lng) — depot first. Mirrors the Android
# DeliveryMap STOPS exactly so the console map and the optimizer agree.
SEED_STOPS: List[Dict] = [
    {"name": "Gil Butchers (depot)", "lat": 40.48620, "lng": -3.37120, "depot": True},
    {"name": "Bar Manolo", "lat": 40.48380, "lng": -3.36450},
    {"name": "Horno La Espiga", "lat": 40.48280, "lng": -3.36180},
    {"name": "Casa Nieto", "lat": 40.47950, "lng": -3.36020},
    {"name": "Marisol Ultramarinos", "lat": 40.47680, "lng": -3.35780},
    {"name": "El Rincón de Goya", "lat": 40.48560, "lng": -3.36480},
    {"name": "Taberna Sur", "lat": 40.48060, "lng": -3.36900},
    {"name": "Mercado 7 — Puesto 12", "lat": 40.47600, "lng": -3.36940},
]

AVG_SPEED_KMH = 22.0  # urban delivery van average incl. stops-approach
SERVICE_MIN_PER_STOP = 6.0


def _haversine_km(a: Dict, b: Dict) -> float:
    R = 6371.0
    p1, p2 = math.radians(a["lat"]), math.radians(b["lat"])
    dphi = math.radians(b["lat"] - a["lat"])
    dl = math.radians(b["lng"] - a["lng"])
    h = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def _path_km(order: List[int], stops: List[Dict], return_to_depot: bool = True) -> float:
    total = 0.0
    for i in range(len(order) - 1):
        total += _haversine_km(stops[order[i]], stops[order[i + 1]])
    if return_to_depot and order:
        total += _haversine_km(stops[order[-1]], stops[order[0]])
    return total


def _nearest_neighbour(stops: List[Dict], start: int = 0) -> List[int]:
    n = len(stops)
    unvisited = set(range(n)) - {start}
    order = [start]
    cur = start
    while unvisited:
        nxt = min(unvisited, key=lambda j: _haversine_km(stops[cur], stops[j]))
        order.append(nxt)
        unvisited.remove(nxt)
        cur = nxt
    return order


def _two_opt(order: List[int], stops: List[Dict]) -> List[int]:
    """2-opt local search (keeps index 0 = depot fixed). Deterministic — improves until no swap helps."""
    best = order[:]
    improved = True
    while improved:
        improved = False
        for i in range(1, len(best) - 1):
            for k in range(i + 1, len(best)):
                cand = best[:i] + best[i:k + 1][::-1] + best[k + 1:]
                if _path_km(cand, stops) + 1e-9 < _path_km(best, stops):
                    best = cand
                    improved = True
    return best


def optimize(stops: List[Dict] | None = None) -> Dict:
    """Optimize the round. Returns the sequence + km + time + the saving vs the naive as-listed order."""
    stops = stops or SEED_STOPS
    naive = list(range(len(stops)))
    naive_km = _path_km(naive, stops)
    order = _two_opt(_nearest_neighbour(stops, 0), stops)
    opt_km = _path_km(order, stops)
    saved_km = max(0.0, naive_km - opt_km)
    drive_min = opt_km / AVG_SPEED_KMH * 60.0
    service_min = SERVICE_MIN_PER_STOP * (len(stops) - 1)
    return {
        "sequence": [{"name": stops[i]["name"], "lat": stops[i]["lat"], "lng": stops[i]["lng"]} for i in order],
        "order_index": order,
        "total_km": round(opt_km, 1),
        "naive_km": round(naive_km, 1),
        "km_saved": round(saved_km, 1),
        "drive_minutes": round(drive_min),
        "total_minutes": round(drive_min + service_min),
        "stops": len(stops) - 1,
        "source": "python_nn_2opt",  # vs "vroom_osrm" when the solver is up (deliveries.md ops note)
    }


# A frozen fixture for deterministic Roborazzi/console renders (the live solver only on the on-demand path).
ROUTE_FIXTURE: Dict = optimize(SEED_STOPS)
