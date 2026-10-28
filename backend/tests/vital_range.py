"""vital_range.py — THE DELIVERY RANGE IS A RULE, AND IT ONLY EVER CLAIMS A DISTANCE (SPEC §5.8a).

Decision: `decisions/delivery-range-radius-2026-07-26.md` in Rocoto-Labs/company — LOCKED as a radius in
km from the depot. Each check below is a product promise, not arithmetic:

  R1  THE MATHS IS THE MATHS      — haversine agrees with the world (Madrid→Barcelona ≈ 505 km).
  R2  NO RANGE → NO CLAIM         — a tenant who never gave us a radius holds NOTHING. known=False,
                                    servable=True. We never invent a limit; an invented limit costs
                                    him a customer the first time it fires.
  R3  NO GEO → NO CLAIM           — a customer we cannot place is a gap in OUR data, never a fact
                                    about him. known=False, servable=True even with a radius set.
  R4  THE RADIUS IS HONOURED      — inside is servable, outside is not, and the boundary is inside.
  R5  THE REASON READS AS DISTANCE— «fuera de tu radio de reparto: ~34 km», rounded, with «~», and it
                                    NEVER says anything about a zone, a postcode or "no vamos ahí".
                                    A radius answers "too far", not "we don't go there".
  R6  ONE REASON, NEVER A LIST    — one sentence, no bullets, no second clause.
  R7  IT IS A RULE, NOT A NUMBER  — `range_kind` decides which rule applies, so `range_kind='zones'`
                                    is a WRITE, not a migration: the same row stores it today and the
                                    radius tenants do not move. An unevaluable kind claims nothing.
  R8  A RANGE THAT ISN'T ONE RAISES — the settings write refuses 0, negatives, absurdities and a
                                    missing depot. Fail-soft on the read, never on the rule.
  R9  THE DISPATCH LIST           — servable_customers splits inside/outside/unplaced for Reparto.
                                    ROUTE OPTIMISATION IS OUT OF SCOPE: this is a day, not a route.

The R1–R8 checks are PURE — no database, no config, no network. R9 and the round-trip need a clone:
    REHEARSAL_DSN=postgresql://…/rocoto_rehearsal PYTHONPATH=. python3 tests/vital_range.py
Without REHEARSAL_DSN they SKIP cleanly (and the vital still fails on any pure regression).
SAFETY: refuses the live `rocoto` DB — it writes and deletes its own test tenant's rows.
Run: PYTHONPATH=. python3 tests/vital_range.py
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from brain import range as rng  # noqa: E402  (shadows the builtin ON PURPOSE — the module is a rule)

R = []
SKIPPED = []
TENANT = "vitalrange"          # invented; never a real company (LOCKED LAW)


def ck(name, ok, detail=""):
    R.append(bool(ok))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


def skip(name, why):
    SKIPPED.append(name)
    print(f"  [SKIP] {name} — {why}")


# ── depot + points (Madrid; invented customers, never a real company) ────────────────────────────
DEPOT = (40.3900, -3.6600)            # a warehouse south-east of the centre
BAR_LUMBRE = (40.4168, -3.7038)       # ~5 km — inside any real radius
CAFE_SOTILLO = (40.6500, -3.9000)     # ~34 km — the reason in the spec
BARCELONA = (41.3874, 2.1686)         # ~505 km — nobody's radius

RULE = {"tenant_id": TENANT, "range_kind": "radius", "range_km": 20.0,
        "depot_lat": DEPOT[0], "depot_lon": DEPOT[1], "depot_label": "", "zones": [], "set": True}
NO_RULE = {**RULE, "range_km": None, "set": False}


# ══ R1 · the maths is the maths ══════════════════════════════════════════════════════════════════
d_bcn = rng.haversine_km(DEPOT[0], DEPOT[1], BARCELONA[0], BARCELONA[1])
ck("R1 haversine agrees with the world (Madrid→Barcelona ≈ 505 km)", 495 < d_bcn < 515, f"{d_bcn:.1f} km")
ck("R1 a point is zero km from itself", rng.haversine_km(*DEPOT, *DEPOT) == 0.0)
ck("R1 distance is symmetric",
   abs(rng.haversine_km(*DEPOT, *CAFE_SOTILLO) - rng.haversine_km(*CAFE_SOTILLO, *DEPOT)) < 1e-9)

# ══ R2 · no range → no claim ═════════════════════════════════════════════════════════════════════
v = rng.verdict(NO_RULE, *BARCELONA)
ck("R2 no radius set → known=False, servable=True (we invent no limit)",
   v["known"] is False and v["servable"] is True and v["reason"] == "")
ck("R2 …and Barcelona is STILL not held when there is no rule", v["servable"] is True)
ck("R2 an empty/absent row is not a rule", rng._row(TENANT, None)["set"] is False)

# ══ R3 · no geo → no claim ═══════════════════════════════════════════════════════════════════════
for label, lat, lon in (("no coordinates", None, None), ("half a pair", 40.4, None),
                        ("(0,0) is a lost null, not the Gulf of Guinea", 0.0, 0.0)):
    v = rng.verdict(RULE, lat, lon)
    ck(f"R3 {label} → known=False, servable=True (never a false «fuera de radio»)",
       v["known"] is False and v["servable"] is True and v["reason"] == "")

# ══ R4 · the radius is honoured ══════════════════════════════════════════════════════════════════
v_in = rng.verdict(RULE, *BAR_LUMBRE)
ck("R4 inside the radius is servable, with the distance known",
   v_in["known"] is True and v_in["servable"] is True and v_in["reason"] == ""
   and v_in["distance_km"] is not None, f"{v_in['distance_km']} km")
v_out = rng.verdict(RULE, *CAFE_SOTILLO)
ck("R4 outside the radius is NOT servable", v_out["known"] is True and v_out["servable"] is False,
   f"{v_out['distance_km']} km > 20")
_edge = rng.verdict({**RULE, "range_km": round(rng.haversine_km(*DEPOT, *CAFE_SOTILLO), 6)},
                    *CAFE_SOTILLO)
ck("R4 exactly at the radius is INSIDE (≤, not <) — a boundary customer is not a review",
   _edge["servable"] is True)

# ══ R5 · the reason reads as DISTANCE, and never as a zone ═══════════════════════════════════════
reason = v_out["reason"]
ck("R5 the reason is the spec's sentence", reason.startswith("fuera de tu radio de reparto:"), reason)
ck("R5 it carries «~» and whole kilometres", "~" in reason and reason.endswith(" km")
   and reason.split("~")[1].split(" ")[0].isdigit(), reason)
ck("R5 it matches the real distance", f"~{round(v_out['distance_km'])} km" in reason)
_forbidden = ("zona", "zonas", "postal", "código", "codigo", "barrio", "distrito", "ruta",
              "no repartimos", "no vamos", "no llegamos")
ck("R5 it claims NOTHING about a zone (a radius answers «too far», not «we don't go there»)",
   not any(w in reason.lower() for w in _forbidden), reason)
ck("R5 a servable order carries no reason at all", v_in["reason"] == "")
ck("R5 the reason builder is pure and rounds to whole km",
   rng.distance_reason(33.6) == "fuera de tu radio de reparto: ~34 km", rng.distance_reason(33.6))

# ══ R6 · one reason, never a list ════════════════════════════════════════════════════════════════
ck("R6 ONE reason — one sentence, no list, no second clause",
   isinstance(reason, str) and "\n" not in reason and ";" not in reason
   and " y además" not in reason and reason.count(",") <= 1, reason)

# ══ R7 · it is a RULE, not a bare number ═════════════════════════════════════════════════════════
ck("R7 the row names WHICH rule applies", rng._row(TENANT, {"range_km": 12, **dict(
    depot_lat=DEPOT[0], depot_lon=DEPOT[1])})["range_kind"] == rng.RADIUS)
_zones = rng._row(TENANT, {"range_kind": "zones", "range_km": None, "depot_lat": DEPOT[0],
                           "depot_lon": DEPOT[1], "zones": ["centro", "norte"]})
ck("R7 a zones rule is storable TODAY in the same row (additive, no migration)",
   _zones["range_kind"] == "zones" and _zones["zones"] == ["centro", "norte"])
ck("R7 an unevaluable kind claims nothing (names are not a drawing → no false «fuera de zonas»)",
   rng.verdict(_zones, *BARCELONA) == {"known": False, "servable": True,
                                       "distance_km": None, "reason": "", "zone": None})
ck("R7 both kinds are declared, so the seam is visible in code", rng.KINDS == ("radius", "zones"))

# ══ R8 · a range that isn't one RAISES (never fail-soft on the rule) ═════════════════════════════
async def _refuses(**kw):
    try:
        await rng.set_range(None, TENANT, **{"range_km": 20, "depot_lat": DEPOT[0],
                                             "depot_lon": DEPOT[1], **kw})
    except ValueError as e:
        return str(e)
    except Exception as e:                       # reached the DB → the validation did NOT refuse
        return f"__WRONG__{type(e).__name__}: {e}"
    return ""


async def _all_refusals():
    return [await _refuses(range_km=0), await _refuses(range_km=-5),
            await _refuses(range_km="nada"), await _refuses(range_km=5000),
            await _refuses(depot_lat=None), await _refuses(depot_lat=0.0, depot_lon=0.0)]


_bad = asyncio.run(_all_refusals())
ck("R8 zero / negative / non-numeric / absurd radius and a missing depot all RAISE, in es-ES",
   all(m and not m.startswith("__WRONG__") for m in _bad),
   " | ".join(m or "(accepted!)" for m in _bad)[:180])


# ══ R9 · the round-trip + the dispatch list (needs a clone) ══════════════════════════════════════
async def _db_checks(dsn):
    import db
    await db.init()
    async with db.get_pool().acquire() as con:
        name = await con.fetchval("select current_database()")
        if name == "rocoto":
            raise SystemExit("REFUSING to run vital_range against the LIVE 'rocoto' DB "
                             "— use rocoto_rehearsal")
        print(f"  (db={name})")
        try:
            await con.execute("delete from tenant_range where tenant_id=$1", TENANT)
            await con.execute("delete from customer_profiles where tenant_id=$1", TENANT)

            ck("R2/db a tenant with no row at all → known=False, servable=True",
               (await rng.check(con, TENANT, lat=BARCELONA[0], lon=BARCELONA[1]))
               == {"known": False, "servable": True, "distance_km": None, "reason": "",
                   "zone": None})

            saved = await rng.set_range(con, TENANT, range_km=20, depot_lat=DEPOT[0],
                                        depot_lon=DEPOT[1], depot_label="nave sur")
            got = await rng.get_range(con, TENANT)
            ck("R7/db the RULE round-trips (kind + km + depot + label)",
               got["set"] is True and got["range_kind"] == "radius" and got["range_km"] == 20.0
               and got["depot_label"] == "nave sur" and saved == got, str(got))

            far = await rng.check(con, TENANT, lat=CAFE_SOTILLO[0], lon=CAFE_SOTILLO[1])
            near = await rng.check(con, TENANT, lat=BAR_LUMBRE[0], lon=BAR_LUMBRE[1])
            ck("R4/db the stored radius holds a far order and not a near one",
               far["servable"] is False and near["servable"] is True, far["reason"])
            ck("R3/db a located tenant + an UNLOCATED customer still claims nothing",
               (await rng.check(con, TENANT, lat=None, lon=None))["known"] is False)

            for phone, disp, geo in (("+34900000001", "Bar Lumbre", BAR_LUMBRE),
                                     ("+34900000002", "Café Sotillo", CAFE_SOTILLO),
                                     ("+34900000003", "Mesón Peral", None)):
                await con.execute(
                    "insert into customer_profiles (phone_number, tenant_id, display_name, "
                    "  address, lat, lon) values ($1,$2,$3,$4,$5,$6) "
                    "on conflict (tenant_id, phone_number) do update set tenant_id=excluded.tenant_id, "
                    "  display_name=excluded.display_name, lat=excluded.lat, lon=excluded.lon",
                    phone, TENANT, disp, "", geo[0] if geo else None, geo[1] if geo else None)
            day = await rng.servable_customers(con, TENANT)
            ck("R9/db the dispatch list splits inside · outside · unplaced (Reparto reads a DAY)",
               [c["name"] for c in day["inside"]] == ["Bar Lumbre"]
               and [c["name"] for c in day["outside"]] == ["Café Sotillo"]
               and [c["name"] for c in day["unplaced"]] == ["Mesón Peral"],
               f"in={len(day['inside'])} out={len(day['outside'])} none={len(day['unplaced'])}")
            ck("R9/db an unplaced customer is kept, never dropped from the day",
               day["unplaced"] and day["unplaced"][0]["distance_km"] is None)

            await con.execute(
                "update tenant_range set range_kind='zones', zones=$2::jsonb where tenant_id=$1",
                TENANT, '["centro","norte"]')
            z = await rng.get_range(con, TENANT)
            ck("R7/db range_kind='zones' is a WRITE, not a migration — the same row takes it",
               z["range_kind"] == "zones" and z["zones"] == ["centro", "norte"] and z["set"] is False)
            ck("R7/db …and the unevaluable kind holds NO order",
               (await rng.check(con, TENANT, lat=BARCELONA[0], lon=BARCELONA[1]))["servable"] is True)
        finally:
            await con.execute("delete from tenant_range where tenant_id=$1", TENANT)
            await con.execute("delete from customer_profiles where tenant_id=$1", TENANT)


_dsn = os.environ.get("REHEARSAL_DSN")
if _dsn:
    for _k in ("DATABASE_URL", "RUNTIME_DATABASE_URL", "CONTROL_DATABASE_URL"):
        os.environ.setdefault(_k, _dsn)
    asyncio.run(_db_checks(_dsn))
else:
    skip("R9 the round-trip + the dispatch list", "no REHEARSAL_DSN (pure checks still ran)")

passed = sum(R)
print(f"vital_range: {passed}/{len(R)}" + (f" (+{len(SKIPPED)} skipped)" if SKIPPED else "")
      + (" — A RULE, AND IT ONLY EVER CLAIMS A DISTANCE" if passed == len(R) else " — BROKEN"))
sys.exit(0 if passed == len(R) else 1)
