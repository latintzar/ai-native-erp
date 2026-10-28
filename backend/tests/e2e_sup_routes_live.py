"""e2e_sup_routes_live.py — Wave-3 route stack E2E: the REAL wire against the REAL solver.

POST /api/sup/routes/optimize (cookie sup session + CSRF, ASGI) -> sup_api -> vroom.py ->
a LIVE VROOM+OSRM/Cataluna rig (reverse-tunneled from leo-dev, ROCOTO_VROOM_URL env) ->
assert the OptimizedRoute wire. Complements vital_sup_routes.py (mock solver, CI floor);
this is the live-stack smoke the runbook's verify step describes.

SAFETY: refuses any DB that is not rocoto_rehearsal. Seeds are seeded=true rows with
e2e- prefixes, cleaned up in finally.
"""
import asyncio
import os
import time
from pathlib import Path

for _l in Path("/opt/rocoto/.env").read_text().splitlines() if Path("/opt/rocoto/.env").exists() else []:
    _l = _l.strip()
    if _l and not _l.startswith("#") and "=" in _l:
        k, _, v = _l.partition("=")
        os.environ.setdefault(k.strip(), v.strip())

VROOM_URL = os.environ.get("ROCOTO_VROOM_URL", "").strip()
assert VROOM_URL, "point ROCOTO_VROOM_URL at a live rig (e.g. reverse tunnel: sudo ssh -f -N -R 13000:127.0.0.1:3000 root@PROD, then http://127.0.0.1:13000)"

import httpx  # noqa: E402

import config  # noqa: E402

config.ROCOTO_VROOM_URL = VROOM_URL
import db  # noqa: E402
import sup_session  # noqa: E402

TENANT = "e2e-routes-rt"
EMAIL = "routes-e2e@vitalsup.test"
DATE = "2031-02-01"
DEPOT = (41.3357, 2.1207)
STOPS = [
    ("o1", "Bar Catalunya",   41.3851, 2.1734),
    ("o2", "Bar Sagrada",     41.4036, 2.1899),
    ("o3", "Bar Gracia",      41.4036, 2.1530),
    ("o4", "Bar Horta",       41.4416, 2.1744),
    ("o5", "Bar Poblenou",    41.4023, 2.2094),
    ("o6", "Bar Les Corts",   41.3762, 2.1111),
    ("o7", "Bar Hospitalet",  41.3220, 2.0997),
    ("o8", "Bar Badalona",    41.4470, 2.2280),
]

R = []


def ck(n, ok, d=""):
    R.append(bool(ok)); print(f"  [{'PASS' if ok else 'FAIL'}] {n}" + (f" — {d}" if d else ""))


async def _seed():
    async with db.get_pool().acquire() as con:
        await con.execute(
            "insert into tenants (slug, name, status, lat, lng, address, seeded) "
            "values ($1,'E2E Routes SL','test',$2,$3,'Deposito E2E',true) "
            "on conflict (slug) do update set lat=$2, lng=$3", TENANT, DEPOT[0], DEPOT[1])
        await con.execute(
            "insert into operators (id,email,name,is_founder,seeded) values "
            "('op_e2e_routes',$1,'E2E',false,true) on conflict (id) do nothing", EMAIL)
        await con.execute(
            "insert into team_members (operator_id,tenant_slug,role,seeded) values "
            "('op_e2e_routes',$1,'owner',true) on conflict do nothing", TENANT)
        for i, (sfx, name, lat, lng) in enumerate(STOPS):
            phone = f"+3460055{i:04d}"
            await con.execute(
                # `orders.tenant_id` since 2026-07-27 — the route read filters on it, so a fixture
                # that does not name its tenant produces a day view with no stops.
                "insert into orders (id, phone_number, customer_name, status, delivery_date, seeded, tenant_id) "
                "values ($1,$2,$3,'approved',$4,true,$5) on conflict (id) do update "
                "  set status='approved', delivery_date=$4, tenant_id=$5",
                f"e2e-route-{sfx}", phone, name, DATE, TENANT)
            await con.execute(
                "insert into customer_profiles (phone_number, tenant_id, display_name, stats, seeded) "
                "values ($1,$2,$3,$4,true) on conflict (tenant_id, phone_number) do update "
                "  set tenant_id=$2, stats=$4", phone, TENANT, name,
                {"location": {"lat": lat, "lng": lng, "address": name, "business": name}})


async def _cleanup():
    async with db.get_pool().acquire() as con:
        await con.execute("delete from orders where id like 'e2e-route-%' and seeded")
        await con.execute("delete from customer_profiles where phone_number like '+3460055%' and seeded")
        await con.execute("delete from team_members where operator_id='op_e2e_routes' and seeded")
        await con.execute("delete from operators where id='op_e2e_routes' and seeded")
        await con.execute("delete from tenants where slug=$1 and seeded", TENANT)


def _assert_wire(j, n_stops, label):
    stops = j.get("stops") or []
    ck(f"{label}: all {n_stops} stops assigned", len(stops) == n_stops and
       j.get("unassigned_order_ids") == [], f"{len(stops)} stops, unassigned={j.get('unassigned_order_ids')}")
    ck(f"{label}: positions 1..{n_stops} in driving order",
       [s["position"] for s in stops] == list(range(1, n_stops + 1)))
    arr = [s["arrival_s"] for s in stops]
    ck(f"{label}: arrivals strictly increasing", arr == sorted(arr) and len(set(arr)) == len(arr))
    ck(f"{label}: sane totals", 10_000 < j["total_distance_m"] < 200_000 and
       1_800 < j["total_duration_s"] < 6 * 3600,
       f"{j['total_distance_m']/1000:.1f} km · {j['total_duration_s']/60:.0f} min")
    g = j.get("geometry") or []
    ck(f"{label}: geometry is a real road polyline inside the BCN bbox",
       len(g) > 100 and all(1.9 < lng < 2.4 and 41.2 < lat < 41.6 for lng, lat in g),
       f"{len(g)} points")
    return stops


async def main():
    await db.init()
    async with db.get_pool().acquire() as con:
        dbname = await con.fetchval("select current_database()")
    assert dbname == "rocoto_rehearsal", f"REFUSED: connected to {dbname}"
    print(f"db={dbname} · vroom={VROOM_URL}")

    real_brain = config.BRAIN_TENANT
    config.BRAIN_TENANT = TENANT
    await _seed()
    try:
        import app
        user = {"id": "u-e2e-routes", "email": EMAIL,
                "identities": [{"provider": "google",
                                "identity_data": {"email": EMAIL, "email_verified": True}}]}
        s = await sup_session.session_for_user(user, "10.0.0.1", "e2e")
        assert s.get("ok"), s
        cookies = {"sup_session": s["raw"]}
        hdrs = {"x-sup-csrf": s["csrf"]}
        tr = httpx.ASGITransport(app=app.app)
        async with httpx.AsyncClient(transport=tr, base_url="https://t") as c:
            payload = {"depot": {"lat": DEPOT[0], "lng": DEPOT[1]},
                       "stops": [{"order_id": f"e2e-route-{sfx}", "lat": lat, "lng": lng}
                                 for sfx, _, lat, lng in STOPS]}
            t0 = time.monotonic()
            r = await c.post("/api/sup/routes/optimize", cookies=cookies, headers=hdrs, json=payload)
            ms = (time.monotonic() - t0) * 1000
            ck("explicit stops: HTTP 200", r.status_code == 200, f"{r.status_code} in {ms:.0f} ms")
            stops = _assert_wire(r.json(), 8, "explicit")
            print("    order:", " -> ".join(s_["order_id"].replace("e2e-route-", "") for s_ in stops))

            t0 = time.monotonic()
            r2 = await c.post("/api/sup/routes/optimize", cookies=cookies, headers=hdrs,
                              json={"date": DATE})
            ms2 = (time.monotonic() - t0) * 1000
            ck("bare {date}: HTTP 200 (server-side gather)", r2.status_code == 200,
               f"{r2.status_code} in {ms2:.0f} ms")
            stops2 = _assert_wire(r2.json(), 8, "date-gather")
            ck("both entry shapes agree on the driving order",
               [x["order_id"] for x in stops] == [x["order_id"] for x in stops2])

            async with db.get_pool().acquire() as con:
                n = await con.fetchval(
                    "select count(*) from sup_audit where actor_email=$1 and action='routes.optimize'",
                    EMAIL)
            ck("sup_audit carries routes.optimize", (n or 0) >= 2, f"{n} rows")
    finally:
        config.BRAIN_TENANT = real_brain
        await _cleanup()

    print(f"\n{'ALL PASS' if all(R) else 'FAILURES'} — {sum(R)}/{len(R)}")
    raise SystemExit(0 if all(R) else 1)


asyncio.run(main())
