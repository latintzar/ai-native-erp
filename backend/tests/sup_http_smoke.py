"""sup_http_smoke.py — Wave-3: ASGI-level smoke of the /api/sup/* wire (cookie gate, machine-key
refusal, CSRF, tenant fence) against the rehearsal clone. Not a vital — a deploy-gate adjunct.
Run after backend/README.md's isolated database setup, with all three DSNs explicitly selecting
rocoto_rehearsal and ROCOTO_EGRESS_SANDBOX=1:
  PYTHONPATH=backend .venv/bin/python backend/tests/sup_http_smoke.py
"""
import asyncio

from rehearsal_config import require_rehearsal

require_rehearsal(database_name="rocoto_rehearsal")

import httpx  # noqa: E402


async def main():
    require_rehearsal(database_name="rocoto_rehearsal")
    import app
    import config
    import db
    import sup_session
    await db.init()
    async with db.get_pool().acquire() as con:
        dbname = await con.fetchval("select current_database()")
    assert dbname == "rocoto_rehearsal", dbname
    async with db.get_pool().acquire() as con:
        await con.execute("insert into tenants (slug,name,status,seeded) values ($1,$2,'test',true) "
                          "on conflict (slug) do nothing", "vital-http-t", "Vital HTTP SL")
        await con.execute("insert into operators (id,email,name,is_founder,seeded) values "
                          "('op_vital_http',$1,'V',false,true) on conflict (id) do nothing",
                          "http@vitalsup.test")
        await con.execute("insert into team_members (operator_id,tenant_slug,role,seeded) values "
                          "('op_vital_http',$1,'owner',true) on conflict do nothing", "vital-http-t")
    user = {"id": "u-h", "email": "http@vitalsup.test",
            "identities": [{"provider": "google",
                            "identity_data": {"email": "http@vitalsup.test", "email_verified": True}}]}
    s = await sup_session.session_for_user(user, "1.2.3.4", "smoke")
    assert s.get("ok"), s

    tr = httpx.ASGITransport(app=app.app)
    async with httpx.AsyncClient(transport=tr, base_url="https://t") as c:
        r = await c.get("/api/sup/session/me")
        print("no-cookie /me:", r.status_code, r.json())
        assert r.status_code == 401 and r.json().get("error") == "session_required"

        r = await c.get("/api/sup/orders",
                        headers={"authorization": f"Bearer {config.ROCOTO_API_KEY}"})
        print("machine-key on /api/sup:", r.status_code, r.json().get("error"))
        assert r.status_code == 401, "machine key must NEVER be valid on /api/sup/*"

        cookies = {"sup_session": s["raw"]}
        r = await c.get("/api/sup/session/me", cookies=cookies)
        j = r.json()
        print("cookie /me:", r.status_code,
              {k: j.get(k) for k in ("email", "tenant_slug", "tenant_name", "role", "caps")})
        assert r.status_code == 200 and j["tenant_slug"] == "vital-http-t" and j["csrf"]

        r = await c.post("/api/sup/settings/ecommerce", cookies=cookies, json={"enabled": True})
        print("POST without CSRF:", r.status_code, r.json())
        assert r.status_code == 403 and r.json().get("error") == "csrf_invalid"

        r = await c.get("/api/sup/customers", cookies=cookies)
        print("customers (empty tenant):", r.status_code, r.json())
        assert r.status_code == 200 and r.json() == {"customers": []}

        r = await c.get("/api/sup/orders", cookies=cookies)
        print("orders for non-runtime tenant:", r.status_code, r.json())
        assert r.status_code == 403 and r.json().get("error") == "tenant_scope_unavailable"

        r = await c.post("/api/sup/routes/optimize", cookies=cookies,
                         headers={"x-sup-csrf": s["csrf"]}, json={"date": "2031-01-01"})
        print("optimize (fenced tenant):", r.status_code, r.json())
        assert r.status_code == 403

    async with db.get_pool().acquire() as con:
        await con.execute("delete from sup_session where actor_email = $1", "http@vitalsup.test")
        await con.execute("delete from team_members where operator_id = 'op_vital_http'")
        await con.execute("delete from operators where id = 'op_vital_http'")
        await con.execute("delete from tenants where slug = $1", "vital-http-t")
    print("HTTP SMOKE: ALL PASS")

asyncio.run(main())
