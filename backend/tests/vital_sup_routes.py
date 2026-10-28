"""vital_sup_routes.py — Wave-3 routes: the day gather + the VROOM organ, with a MOCKED VROOM.

No real solver anywhere near this vital: a localhost http.server plays VROOM (canned solution,
then a 500, then it's simply absent) so every honest failure mode is exercised:

  1. build_problem — one vehicle, depot start AND end, jobs [lng,lat], service defaults,
     'HH:MM' service windows → VROOM time_windows; unlocated stop / missing depot → typed 400s.
  2. decode_polyline — a locally-encoded polyline round-trips to [lng,lat] pairs.
  3. solve+map — the mocked VROOM's solution maps to the contract wire (ordered stops with
     1-based positions + arrival_s, totals, decoded geometry, unassigned surfaced).
  4. typed errors — env unset → vroom_no_configurado · connection refused → vroom_caido ·
     HTTP 500 → vroom_error. Never a fabricated route.
  5. the sup surface — _day_stops joins approved/sent orders for the date with
     customer_profiles.stats.location (tenant-filtered), falls back to calls.location, flags
     «sin dirección» (lat/lng null); sup_routes_optimize({date}) gathers server-side, optimises
     only the located stops through the mock, and refuses non-owner tenants LOUD (403).

SAFETY: refuses the live `rocoto` DB. Point it at rocoto_rehearsal (source rehearsal_env.sh).
"""
import asyncio
import json
import os
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

for _l in Path("/opt/rocoto/.env").read_text().splitlines() if Path("/opt/rocoto/.env").exists() else []:
    _l = _l.strip()
    if _l and not _l.startswith("#") and "=" in _l:
        k, _, v = _l.partition("=")
        os.environ.setdefault(k.strip(), v.strip())

import config  # noqa: E402
import db  # noqa: E402
import sup_api  # noqa: E402
import vroom  # noqa: E402

R = []


def ck(n, ok, d=""):
    R.append(bool(ok)); print(f"  [{'PASS' if ok else 'FAIL'}] {n}" + (f" — {d}" if d else ""))


# ── a tiny polyline ENCODER (precision 5) so decode is tested against an independent source ──────
def _enc_val(v: int) -> str:
    v = ~(v << 1) if v < 0 else (v << 1)
    out = ""
    while v >= 0x20:
        out += chr((0x20 | (v & 0x1F)) + 63)
        v >>= 5
    return out + chr(v + 63)


def encode_polyline(coords_latlng, precision=5):
    f = 10 ** precision
    out, plat, plng = "", 0, 0
    for lat, lng in coords_latlng:
        ilat, ilng = round(lat * f), round(lng * f)
        out += _enc_val(ilat - plat) + _enc_val(ilng - plng)
        plat, plng = ilat, ilng
    return out


# ── the mock VROOM ────────────────────────────────────────────────────────────────────────────────
GEOM_LATLNG = [(41.38, 2.17), (41.39, 2.18), (41.40, 2.16)]
MOCK_SOLUTION = {
    "code": 0,
    "summary": {"distance": 6800, "duration": 1900},
    "unassigned": [{"id": 3}],
    "routes": [{
        "vehicle": 1,
        "distance": 6800,
        "duration": 1900,
        "geometry": encode_polyline(GEOM_LATLNG),
        "steps": [
            {"type": "start", "arrival": 0},
            {"type": "job", "id": 2, "arrival": 540},
            {"type": "job", "id": 1, "arrival": 1300},
            {"type": "end", "arrival": 1900},
        ],
    }],
}


class MockVroom(BaseHTTPRequestHandler):
    mode = "ok"           # ok | error
    last_problem = None

    def do_POST(self):
        body = self.rfile.read(int(self.headers.get("Content-Length") or 0))
        MockVroom.last_problem = json.loads(body or b"{}")
        if MockVroom.mode == "error":
            self.send_response(500); self.end_headers(); self.wfile.write(b"boom"); return
        out = json.dumps(MOCK_SOLUTION).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(out)))
        self.end_headers()
        self.wfile.write(out)

    def log_message(self, *a):   # quiet
        pass


PH_PROF, PH_CALL, PH_NONE = "+34600222001", "+34600222002", "+34600222003"
DATE = "2031-01-15"   # far-future date → never collides with real rows


async def _seed(tenant: str):
    async with db.get_pool().acquire() as con:
        await con.execute(
            "insert into tenants (slug, name, status, lat, lng, address, seeded) "
            "values ($1,'Vital Routes SL','test',41.3800,2.1700,'Calle Deposito 1',true) "
            "on conflict (slug) do update set lat=41.3800, lng=2.1700, address='Calle Deposito 1'",
            tenant)
        for oid, phone, name in (("vitalroute-o1", PH_PROF, "Bar Perfil"),
                                 ("vitalroute-o2", PH_CALL, "Bar Llamada"),
                                 ("vitalroute-o3", PH_NONE, "Bar Sin Dir")):
            await con.execute(
                # `orders.tenant_id` since 2026-07-27: an order has to say whose it is, and this
                # vital repoints config.BRAIN_TENANT at its own slug AFTER db.init() set the
                # column default — so the fixture must name the tenant, exactly like the
                # product now does. Without it the route's tenant predicate finds no stops.
                "insert into orders (id, phone_number, customer_name, status, delivery_date, seeded, tenant_id) "
                "values ($1,$2,$3,'approved',$4,true,$5) on conflict (id) do update "
                "  set status='approved', delivery_date=$4, tenant_id=$5",
                oid, phone, name, DATE, tenant)
        await con.execute(
            "insert into customer_profiles (phone_number, tenant_id, display_name, stats, seeded) "
            "values ($1,$2,'Bar Perfil',$3,true) on conflict (tenant_id, phone_number) do update "
            "  set tenant_id=$2, stats=$3",
            PH_PROF, tenant,
            {"location": {"lat": 41.39, "lng": 2.18, "address": "Calle Uno 1", "business": "Bar Perfil"}})
        await con.execute(
            "insert into calls (id, phone_number, status, location, seeded) "
            "values ('vitalroute-c1',$1,'ended',$2,true) on conflict (id) do update "
            "  set location=$2",
            PH_CALL, {"lat": 41.40, "lng": 2.16, "address": "Calle Dos 2"})


async def _cleanup(tenant: str):
    async with db.get_pool().acquire() as con:
        await con.execute("delete from orders where id like 'vitalroute-%'")
        await con.execute("delete from calls where id like 'vitalroute-%'")
        await con.execute("delete from customer_profiles where phone_number in ($1,$2,$3)",
                          PH_PROF, PH_CALL, PH_NONE)
        await con.execute("delete from tenants where slug = $1 and seeded", tenant)


async def main():
    await db.init()
    async with db.get_pool().acquire() as con:
        dbname = await con.fetchval("select current_database()")
    if dbname == "rocoto":
        raise SystemExit("REFUSING to run vitals against the LIVE 'rocoto' DB — use rocoto_rehearsal")
    print(f"  (db={dbname})")

    # the runtime-owner tenant for THIS deployment (orders live in its world). We use a dedicated
    # vital slug and point config.BRAIN_TENANT at it for the duration (process-local).
    tenant = "vital-routes-rt"
    real_brain_tenant = config.BRAIN_TENANT
    config.BRAIN_TENANT = tenant
    await _seed(tenant)

    srv = HTTPServer(("127.0.0.1", 0), MockVroom)
    port = srv.server_address[1]
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    real_vroom_url = config.ROCOTO_VROOM_URL

    try:
        # ── 1 · build_problem ────────────────────────────────────────────────────────────────────
        depot = {"lat": 41.38, "lng": 2.17}
        stops = [
            {"order_id": "vitalroute-o1", "lat": 41.39, "lng": 2.18,
             "service_window": {"start": "06:30", "end": "09:00"}},
            {"order_id": "vitalroute-o2", "lat": 41.40, "lng": 2.16, "service_s": 120},
        ]
        problem, id_map = vroom.build_problem(depot, stops)
        v = problem["vehicles"][0]
        ck("one vehicle, depot start AND end, [lng,lat]",
           v["start"] == [2.17, 41.38] and v["end"] == [2.17, 41.38] and len(problem["vehicles"]) == 1)
        j1, j2 = problem["jobs"]
        ck("jobs carry [lng,lat] + service default/explicit",
           j1["location"] == [2.18, 41.39] and j1["service"] == vroom.DEFAULT_SERVICE_S
           and j2["service"] == 120)
        ck("'HH:MM' window → VROOM time_windows seconds",
           j1.get("time_windows") == [[6 * 3600 + 30 * 60, 9 * 3600]] and "time_windows" not in j2)
        ck("geometry requested (options.g)", problem.get("options", {}).get("g") is True)
        ck("id_map: job ids → order ids", id_map == {1: "vitalroute-o1", 2: "vitalroute-o2"})
        try:
            vroom.build_problem(depot, [{"order_id": "x", "lat": None, "lng": 2.0}])
            ck("unlocated stop → typed 400", False)
        except vroom.RoutingError as e:
            ck("unlocated stop → typed 400", e.status == 400 and e.code == "unlocated_stop")
        try:
            vroom.build_problem({"lat": None, "lng": None}, stops)
            ck("missing depot → typed 400", False)
        except vroom.RoutingError as e:
            ck("missing depot → typed 400", e.status == 400 and e.code == "no_depot")

        # ── 2 · polyline decode round-trip ───────────────────────────────────────────────────────
        decoded = vroom.decode_polyline(encode_polyline(GEOM_LATLNG))
        ck("polyline decodes to [lng,lat] pairs",
           len(decoded) == 3 and abs(decoded[0][0] - 2.17) < 1e-5 and abs(decoded[0][1] - 41.38) < 1e-5)
        ck("garbage polyline → [] (never a crash)", vroom.decode_polyline("") == []
           and vroom.decode_polyline(None) == [])

        # ── 3 · typed errors: unset · down · solver error ────────────────────────────────────────
        config.ROCOTO_VROOM_URL = ""
        try:
            await vroom.optimize(depot, stops)
            ck("URL unset → vroom_no_configurado", False)
        except vroom.RoutingError as e:
            ck("URL unset → vroom_no_configurado (typed, es-ES)",
               e.code == "vroom_no_configurado" and e.status == 503 and bool(e.message))
        config.ROCOTO_VROOM_URL = "http://127.0.0.1:1"     # nothing listens on port 1
        try:
            await vroom.optimize(depot, stops)
            ck("VROOM down → vroom_caido", False)
        except vroom.RoutingError as e:
            ck("VROOM down → vroom_caido (typed)", e.code == "vroom_caido" and e.status == 503)
        config.ROCOTO_VROOM_URL = f"http://127.0.0.1:{port}"
        MockVroom.mode = "error"
        try:
            await vroom.optimize(depot, stops)
            ck("VROOM 500 → vroom_error", False)
        except vroom.RoutingError as e:
            ck("VROOM 500 → vroom_error (typed)", e.code == "vroom_error")

        # ── 3b · the happy path against the MOCK ─────────────────────────────────────────────────
        MockVroom.mode = "ok"
        res = await vroom.optimize(depot, stops + [{"order_id": "vitalroute-o3", "lat": 41.41, "lng": 2.19}])
        ck("stops come back in DRIVING order with 1-based positions",
           [s["order_id"] for s in res["stops"]] == ["vitalroute-o2", "vitalroute-o1"]
           and [s["position"] for s in res["stops"]] == [1, 2])
        ck("arrival_s carried per stop", [s["arrival_s"] for s in res["stops"]] == [540, 1300])
        ck("totals from the solver", res["total_distance_m"] == 6800 and res["total_duration_s"] == 1900)
        ck("geometry decoded ([lng,lat] triplet)", len(res["geometry"]) == 3
           and abs(res["geometry"][1][0] - 2.18) < 1e-5)
        ck("unassigned jobs surfaced as order ids", res["unassigned_order_ids"] == ["vitalroute-o3"])
        ck("the mock actually received OUR problem",
           MockVroom.last_problem and len(MockVroom.last_problem.get("jobs", [])) == 3)

        # ── 5 · the sup surface: day gather + optimize-by-date ──────────────────────────────────
        ctx_rt = {"tenant_slug": tenant, "actor_email": "vital@vitalsup.test", "role": "founder",
                  "csrf": "x", "ip": "1.1.1.1"}
        day = await sup_api._day_stops(ctx_rt, DATE)
        ck("depot from the tenants row", day["depot"] and abs(day["depot"]["lat"] - 41.38) < 1e-6
           and day["depot"]["address"] == "Calle Deposito 1")
        by_id = {s["order_id"]: s for s in day["stops"]}
        ck("stop located from customer_profiles.stats.location",
           by_id.get("vitalroute-o1", {}).get("lat") == 41.39
           and by_id["vitalroute-o1"]["business"] == "Bar Perfil")
        ck("stop falls back to calls.location",
           by_id.get("vitalroute-o2", {}).get("lat") == 41.40
           and by_id["vitalroute-o2"]["address"] == "Calle Dos 2")
        ck("«sin dirección» stays flagged (lat/lng null), still listed",
           "vitalroute-o3" in by_id and by_id["vitalroute-o3"]["lat"] is None)

        out = await sup_api.sup_routes_optimize({"date": DATE}, ctx=ctx_rt)
        ck("optimize-by-date gathers server-side and optimises the LOCATED stops",
           {s["order_id"] for s in out["stops"]} <= {"vitalroute-o1", "vitalroute-o2"}
           and len(MockVroom.last_problem.get("jobs", [])) == 2)

        # A1 tail (2026-08-07): another tenant is SERVED, tenant-filtered — its routes day is
        # an honest empty, and none of THIS tenant's stops may appear. The optimize leg either
        # refuses for want of stops (4xx) or returns zero — a foreign stop in its output is the
        # only failure that matters.
        ctx_other = {**ctx_rt, "tenant_slug": "vital-sup-other"}
        day_other = await sup_api.sup_routes_day(DATE, ctx=ctx_other)
        ck("routes/day for another tenant → served, EMPTY (no foreign stops)",
           isinstance(day_other, dict) and not (day_other.get("stops") or []),
           f"stops={day_other.get('stops') if isinstance(day_other, dict) else day_other}")
        try:
            opt_other = await sup_api.sup_routes_optimize({"date": DATE}, ctx=ctx_other)
            foreign = {s_["order_id"] for s_ in (opt_other.get("stops") or [])}
            ck("routes/optimize for another tenant carries NO foreign stop",
               not (foreign & {"vitalroute-o1", "vitalroute-o2", "vitalroute-o3"}),
               f"stops={sorted(foreign)}")
        except sup_api.SupApiError as e:
            ck("routes/optimize for another tenant refuses for want of stops (4xx), never leaks",
               400 <= e.status < 500, f"status={e.status} {e.error}")
    finally:
        config.ROCOTO_VROOM_URL = real_vroom_url
        config.BRAIN_TENANT = real_brain_tenant
        srv.shutdown()
        await _cleanup(tenant)

    print(f"\nvital_sup_routes: {sum(R)}/{len(R)} PASS")
    if not all(R):
        raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())
