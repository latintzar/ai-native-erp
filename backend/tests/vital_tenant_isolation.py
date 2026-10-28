"""vital_tenant_isolation.py — THE APP RAIL'S ISOLATION FLOOR (app-auth pass, 2026-07-27).

WHAT THIS EXISTS TO PROVE. The Android app used to authenticate every `/api/*` call with ONE shared
machine key (`ROCOTO_API_KEY`), stamped by `ApiClient`'s OkHttp interceptor and baked into the APK as
a `buildConfigField` string literal — so it is a plain string inside `classes3.dex`, R8 or no R8, and
the release build carries the LIVE production key. An APK is a file that gets forwarded. The rail now
authenticates the USER (a Supabase bearer → `brain_auth.app_scope` → a tenant resolved server-side),
and this vital is the assertion that the fence actually holds when you push on it.

IT TRIES TO BREAK IT FIRST, then asserts. Every check below is an attack that used to work:
  B1 the key alone on a data route              → 401 (it is not an identity any more)
  B2 tenant B's bearer on tenant A's rows       → filtered out / 403, never A's data
  B3 a CLIENT-SUPPLIED tenant id                → ignored (self-tenant served) or refused
  B4 a client-supplied SCOPE naming a tenant    → 403 (`t.<other>.c.…` is a tenant id in a costume)
  B5 forged / expired / absent / malformed bearer → 401 and NO partial body
  B6 the cap matrix                             → staff cannot do an admin write
  B7 founder-only surfaces                      → refused for a non-founder AND for the key
  B8 `/media` is PER-USER ONLY                   → bearer yes, machine key NO, anon NO
  B9 …and the other half of the claim: the routes that KEPT the machine key, and the storefront's
     public reads, still authenticate exactly as they did. A hole closed by breaking the storefront
     or the deploy scripts is a worse outcome than the hole.

HOW IT RUNS. Real HTTP against a real uvicorn (`127.0.0.1:<free port>`) serving the real `app.py`
against the rehearsal clone — not an in-process shortcut, because "which dependency fired" is exactly
the thing under test and only the wire proves it. The ONE thing stubbed is
`brain_auth.verify_token{,_cached}`, which would otherwise call Supabase: the child process maps three
opaque strings to three crafted user dicts. Everything downstream of that — `has_matching_oauth`,
`sup_session.resolve_membership`, the caps, the runtime fence, the routing — is the production code.

SAFETY: refuses the live `rocoto` DB. Point it at rocoto_rehearsal (source rehearsal_env.sh).
Standalone: `PYTHONPATH=. python tests/vital_tenant_isolation.py`. Nonzero exit on any failure.
"""
import asyncio
import json
import os
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path

for _l in Path("/opt/rocoto/.env").read_text().splitlines() if Path("/opt/rocoto/.env").exists() else []:
    _l = _l.strip()
    if _l and not _l.startswith("#") and "=" in _l:
        k, _, v = _l.partition("=")
        os.environ.setdefault(k.strip(), v.strip())

# Off the box there is no .env, so ROCOTO_API_KEY is empty and httpx refuses the header `Bearer `
# before the request leaves the process — B1's first attack could not even be made. WHICH key it is
# does not matter to a single claim here (the key is not an identity; the routes that kept it still
# authenticate); that there IS one does. The child uvicorn inherits this, so both sides agree.
os.environ.setdefault("ROCOTO_API_KEY", "vital-machine-key")

import httpx  # noqa: E402

import config  # noqa: E402
import db  # noqa: E402

R = []


def ck(n, ok, d=""):
    R.append(bool(ok))
    print(f"  [{'PASS' if ok else 'FAIL'}] {n}" + (f" — {d}" if d else ""))


# ── the cast ──────────────────────────────────────────────────────────────────────────────────────
# TEN_R is the tenant this deployment's RUNTIME serves (orders / whatsapp_messages / calls carry no
# tenant_id, so they belong to exactly one tenant — see brain_auth.owns_runtime). A and B are two
# ordinary tenants that do NOT own it: between them we prove row filtering, and against R we prove the
# fence. Three tenants is the minimum that can tell "filtered" apart from "there is only one tenant".
TEN_R = config.BRAIN_TENANT
TEN_A, TEN_B = "vital-iso-a", "vital-iso-b"
MAIL_R, MAIL_A, MAIL_B, MAIL_S = ("iso-r@vitaliso.test", "iso-a@vitaliso.test",
                                  "iso-b@vitaliso.test", "iso-staff-b@vitaliso.test")
PH_A, PH_B = "+34600990001", "+34600990002"
SKU_A, SKU_B = "vitaliso-sku-a", "vitaliso-sku-b"

TOK = {"R": "tok-iso-r", "A": "tok-iso-a", "B": "tok-iso-b", "S": "tok-iso-staff-b",
       "PWD": "tok-iso-password-only", "FORGED": "tok-iso-forged", "NOBODY": "tok-iso-nobody"}


def _goog(email):
    return {"provider": "google", "identity_data": {"email": email, "email_verified": True}}


USERS = {
    TOK["R"]: {"id": "u-iso-r", "email": MAIL_R, "identities": [_goog(MAIL_R)]},
    TOK["A"]: {"id": "u-iso-a", "email": MAIL_A, "identities": [_goog(MAIL_A)]},
    TOK["B"]: {"id": "u-iso-b", "email": MAIL_B, "identities": [_goog(MAIL_B)]},
    TOK["S"]: {"id": "u-iso-s", "email": MAIL_S, "identities": [_goog(MAIL_S)]},
    # a password-only signup of a MEMBER's address: with Supabase email-confirmation OFF this is
    # auto-confirmed, so it must NOT resolve a membership (that is the takeover this gate closes)
    TOK["PWD"]: {"id": "u-iso-p", "email": MAIL_A, "identities": [{"provider": "email"}]},
    # linkIdentity forgery: a member's address with an ATTACKER's Google identity linked
    TOK["FORGED"]: {"id": "u-iso-f", "email": MAIL_A,
                    "identities": [{"provider": "email"}, _goog("attacker@gmail.com")]},
    # a real Google user who simply belongs to nothing
    TOK["NOBODY"]: {"id": "u-iso-n", "email": "nobody@vitaliso.test",
                    "identities": [_goog("nobody@vitaliso.test")]},
}


async def _seed():
    async with db.get_pool().acquire() as con:
        for slug, name in ((TEN_A, "Vital Iso A SL"), (TEN_B, "Vital Iso B SL")):
            await con.execute("insert into tenants (slug, name, status, seeded) values ($1,$2,'test',true) "
                              "on conflict (slug) do nothing", slug, name)
        await con.execute(
            "insert into operators (id, email, name, is_founder, seeded) values "
            "('op_iso_r',$1,'Iso R',false,true), ('op_iso_a',$2,'Iso A',false,true), "
            "('op_iso_b',$3,'Iso B',false,true), ('op_iso_s',$4,'Iso Staff',false,true) "
            "on conflict (id) do nothing", MAIL_R, MAIL_A, MAIL_B, MAIL_S)
        await con.execute(
            "insert into team_members (operator_id, tenant_slug, role, seeded) values "
            "('op_iso_r',$1,'owner',true), ('op_iso_a',$2,'owner',true), "
            "('op_iso_b',$3,'owner',true), ('op_iso_s',$3,'staff',true) "
            "on conflict (operator_id, tenant_slug) do nothing", TEN_R, TEN_A, TEN_B)
        # tenant_id-keyed rows on BOTH sides, so "sees only its own" is a real statement
        for phone, tenant, name in ((PH_A, TEN_A, "Bar Iso A"), (PH_B, TEN_B, "Bar Iso B")):
            await con.execute(
                "insert into customer_profiles (phone_number, tenant_id, display_name, seeded) "
                "values ($1,$2,$3,true) on conflict (tenant_id, phone_number) do update "
                "set tenant_id=excluded.tenant_id, display_name=excluded.display_name",
                phone, tenant, name)
        for sid, tenant in ((SKU_A, TEN_A), (SKU_B, TEN_B)):
            await con.execute(
                "insert into catalogue_skus (id, tenant_id, name, in_assortment, live_on_ecom, seeded) "
                "values ($1,$2,$3,true,true,true) on conflict (id) do update "
                "set tenant_id=excluded.tenant_id, live_on_ecom=true", sid, tenant, f"Chorizo {tenant}")
        await con.execute(
            "insert into tenant_range (tenant_id, range_kind, range_km) values ($1,'radius',11) "
            "on conflict (tenant_id) do update set range_km=11", TEN_A)
        await con.execute(
            "insert into tenant_range (tenant_id, range_kind, range_km) values ($1,'radius',77) "
            "on conflict (tenant_id) do update set range_km=77", TEN_B)
        # a DISTINCTIVE payout account for B, so "did the client-supplied ?tenant= win?" has a
        # visible answer rather than an absence we have to trust.
        await con.execute(
            "insert into shop_connect (tenant_id, stripe_account_id, charges_enabled) "
            "values ($1,'acct_VITALISO_B',true) on conflict (tenant_id) do update "
            "set stripe_account_id=excluded.stripe_account_id", TEN_B)
        for sid, tenant, qty in ((SKU_A, TEN_A, 11), (SKU_B, TEN_B, 77)):
            await con.execute(
                "insert into stock_levels (tenant_id, sku_id, qty, unit) values ($1,$2,$3,'kg') "
                "on conflict (tenant_id, sku_id) do update set qty=excluded.qty", tenant, sid, qty)


async def _cleanup():
    async with db.get_pool().acquire() as con:
        await con.execute("delete from shop_connect where tenant_id in ($1,$2)", TEN_A, TEN_B)
        await con.execute("delete from stock_levels where sku_id like 'vitaliso-sku-%'")
        await con.execute("delete from tenant_range where tenant_id in ($1,$2)", TEN_A, TEN_B)
        await con.execute("delete from catalogue_skus where id like 'vitaliso-sku-%'")
        await con.execute("delete from customer_profiles where phone_number in ($1,$2)", PH_A, PH_B)
        await con.execute("delete from team_members where operator_id like 'op_iso_%'")
        await con.execute("delete from operators where id like 'op_iso_%'")
        await con.execute("delete from tenants where slug in ($1,$2)", TEN_A, TEN_B)


# ── the server under test ─────────────────────────────────────────────────────────────────────────
_BOOT = r'''
import json, os, sys, asyncio
sys.path.insert(0, os.environ["ROCOTO_BACKEND_DIR"])
USERS = json.load(open(os.environ["ISO_USER_MAP"]))
from brain import auth as brain_auth
async def _fake_verify(tok):
    return USERS.get((tok or "").strip())
# BOTH entry points: require_app_* uses the cached one, require_app_founder the raw one.
brain_auth.verify_token = _fake_verify
brain_auth.verify_token_cached = _fake_verify
# STRIPE, OFF THE BOX. On the box the key comes from /opt/rocoto/.env and this block does nothing.
# Off it, `stripe_connect.configured()` is False and `status()` returns before it ever looks at a
# tenant — so B3's two account_id reads had nothing to read and failed for want of a key, not for
# want of a fence. The child gets a key that is not a key and a `_stripe()` that refuses to leave
# the machine, so `status()` takes its own documented offline branch (the persisted `shop_connect`
# row). B3's question — whose payout account does this route serve? — is then asked and answered,
# with no request to Stripe.
if not os.environ.get("STRIPE_SECRET_KEY"):
    import config as _cfg
    _cfg.STRIPE_SECRET_KEY = os.environ["STRIPE_SECRET_KEY"] = "sk_offline_vital"
    from brain import stripe_connect as _sc
    def _no_stripe():
        raise RuntimeError("offline vital: Stripe is not reachable from here")
    _sc._stripe = _no_stripe
import uvicorn, app
uvicorn.run(app.app, host="127.0.0.1", port=int(os.environ["ISO_PORT"]), log_level="error")
'''


def _free_port() -> int:
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    p = s.getsockname()[1]
    s.close()
    return p


def _boot_server():
    backend = str(Path(__file__).resolve().parent.parent)
    port = _free_port()
    umap = tempfile.NamedTemporaryFile("w", suffix=".json", delete=False)
    json.dump(USERS, umap)
    umap.close()
    boot = tempfile.NamedTemporaryFile("w", suffix=".py", delete=False)
    boot.write(_BOOT)
    boot.close()
    env = dict(os.environ, ROCOTO_BACKEND_DIR=backend, ISO_USER_MAP=umap.name,
               ISO_PORT=str(port), PYTHONPATH=backend)
    # The child's output goes to a FILE, never a PIPE. `app.py`'s startup is chatty (tenant seed,
    # drainers, the embedding warm) and a 64 KB pipe nobody is draining is a deadlock that would look
    # exactly like "the server is slow" — the harness would then blame the code under test for its own
    # plumbing. A file also survives the process, so a real crash is readable afterwards.
    logf = tempfile.NamedTemporaryFile("w+b", suffix=".log", delete=False)
    proc = subprocess.Popen([sys.executable, boot.name], env=env, cwd=backend,
                            stdout=logf, stderr=subprocess.STDOUT)

    def _tail(n=4000):
        try:
            return Path(logf.name).read_bytes()[-n:].decode(errors="replace")
        except OSError:
            return "(no output captured)"

    base = f"http://127.0.0.1:{port}"
    # 180 s, not 60: boot warms the fastembed model off the event loop and ensures the voice runtime
    # agent over the network. On a loaded box that is minutes, and a boot timeout dressed as a
    # security failure is the worst kind of red vital — it teaches you to ignore it.
    deadline = time.time() + 180
    while time.time() < deadline:
        if proc.poll() is not None:
            print(_tail())
            raise SystemExit(f"uvicorn under test died on boot (rc={proc.returncode}, log={logf.name})")
        try:
            httpx.get(base + "/healthz", timeout=2)
            return proc, base, [umap.name, boot.name, logf.name]
        except Exception:
            time.sleep(0.5)
    proc.kill()
    print(_tail())
    raise SystemExit(f"uvicorn under test never came up (log={logf.name})")


def H(tok=None, key=False):
    if key:
        return {"authorization": f"Bearer {config.ROCOTO_API_KEY}"}
    return {"authorization": f"Bearer {tok}"} if tok else {}


# ONE asyncio.run for the WHOLE file: one loop, one asyncpg pool. Two `asyncio.run`s against the same
# pool is the cross-loop crash the harness note warns about (tests/gatelib.py). The HTTP client is the
# SYNCHRONOUS httpx one, called from inside that single loop — it talks to a separate PROCESS, so
# blocking this loop for the duration of a request costs nothing and keeps every assertion linear.
async def main() -> int:
    print("── vital_tenant_isolation ────────────────────────────────────────────────────────────")

    await db.init()
    async with db.get_pool().acquire() as con:
        dbname = await con.fetchval("select current_database()")
    if dbname == "rocoto":
        raise SystemExit("REFUSING to run vitals against the LIVE 'rocoto' DB — use rocoto_rehearsal")
    await _seed()
    print(f"  (db={dbname} · runtime tenant={TEN_R} · A={TEN_A} · B={TEN_B})")

    proc, BASE, tmps = _boot_server()
    try:
        # 60 s, generous on purpose. Every assertion in this file is about a STATUS CODE, never about
        # latency, and the box runs several agents' vitals at once — a read timeout here would report
        # itself as a tenant-isolation failure, which is a lie and the fastest way to get a security
        # vital ignored. If a route is genuinely slow that belongs in a performance vital, not this one.
        c = httpx.Client(base_url=BASE, timeout=60)

        # ── B1 · THE MACHINE KEY IS NOT AN IDENTITY ANY MORE ──────────────────────────────────────
        print("\nB1 · the leaked APK key alone")
        key_routes = ["/api/conversations", "/api/orders", "/api/search?q=jam", "/api/calls/active",
                      "/api/stock/levels", "/api/tenant/range", "/api/ecom/catalogue", "/api/reparto",
                      "/api/trackers", "/api/agent/reports", "/api/agent/billing",
                      "/api/customer/%2B34600990001/dossier", "/api/teams", "/api/mode?phone=%2B34600990001"]
        for path in key_routes:
            r = c.get(path, headers=H(key=True))
            ck(f"GET {path} with the machine key → 401", r.status_code == 401, f"got {r.status_code}")
        r = c.post("/api/admin/reset", headers=H(key=True), json={})
        ck("POST /api/admin/reset with the machine key → 401", r.status_code == 401, f"got {r.status_code}")
        r = c.post("/api/shop/admin/tenant", headers=H(key=True), json={"slug": TEN_B, "name": "PWNED"})
        ck("POST /api/shop/admin/tenant with the machine key → 401", r.status_code == 401, f"got {r.status_code}")
        # and nothing was written by the attempt
        wrote = await _tenant_name(TEN_B)
        ck("…and tenant B's name is untouched", wrote == "Vital Iso B SL", f"name={wrote!r}")

        # ── B5 · BAD BEARERS: 401, and NEVER a partial body ───────────────────────────────────────
        print("\nB5 · forged / absent / malformed / non-member bearers")
        for label, hdrs in (("absent", {}),
                            ("garbage", H("not-a-real-token")),
                            ("bare scheme, no token", {"authorization": "Bearer"}),
                            ("the machine key", H(key=True)),
                            ("password-only identity (member's email)", H(TOK["PWD"])),
                            ("linkIdentity forgery (member's email)", H(TOK["FORGED"])),
                            ("real Google user, no membership", H(TOK["NOBODY"]))):
            r = c.get("/api/orders", headers=hdrs)
            body = r.text or ""
            ck(f"GET /api/orders, {label} → 401/403 and no rows",
               r.status_code in (401, 403) and '"orders"' not in body,
               f"{r.status_code} {body[:80]}")

        # ── B2 · CROSS-TENANT: A's bearer never sees B's rows ─────────────────────────────────────
        print("\nB2 · tenant A's token vs tenant B's data")
        ra = c.get("/api/ecom/catalogue", headers=H(TOK["A"]))
        rb = c.get("/api/ecom/catalogue", headers=H(TOK["B"]))
        ids_a = {s["id"] for s in ra.json().get("skus", [])}
        ids_b = {s["id"] for s in rb.json().get("skus", [])}
        ck("catalogue: A 200 and sees ITS sku, not B's",
           ra.status_code == 200 and SKU_A in ids_a and SKU_B not in ids_a, f"{ra.status_code} {sorted(ids_a)}")
        ck("catalogue: B 200 and sees ITS sku, not A's",
           rb.status_code == 200 and SKU_B in ids_b and SKU_A not in ids_b, f"{rb.status_code} {sorted(ids_b)}")

        ra = c.get("/api/stock/levels", headers=H(TOK["A"]))
        rb = c.get("/api/stock/levels", headers=H(TOK["B"]))
        sa = {l["sku_id"] for l in ra.json().get("levels", [])}
        sb = {l["sku_id"] for l in rb.json().get("levels", [])}
        ck("stock: A sees only its level", ra.status_code == 200 and SKU_A in sa and SKU_B not in sa,
           f"{ra.status_code} {sorted(sa)}")
        ck("stock: B sees only its level", rb.status_code == 200 and SKU_B in sb and SKU_A not in sb,
           f"{rb.status_code} {sorted(sb)}")

        ra = c.get("/api/tenant/range", headers=H(TOK["A"]))
        rb = c.get("/api/tenant/range", headers=H(TOK["B"]))
        ck("range: A gets ITS radius (11), B gets ITS radius (77) — never each other's",
           ra.json().get("range_km") == 11 and rb.json().get("range_km") == 77,
           f"A={ra.json().get('range_km')} B={rb.json().get('range_km')}")

        # ── the runtime fence: the legacy no-tenant_id tables ─────────────────────────────────────
        print("\nB2b · the runtime fence (orders / messages / calls carry no tenant_id)")
        fenced = ["/api/orders", "/api/conversations", "/api/search?q=jam", "/api/calls/active",
                  "/api/reparto", "/api/agent/reports", "/api/agent/billing", "/api/teams"]
        for path in fenced:
            for who in ("A", "B"):
                r = c.get(path, headers=H(TOK[who]))
                ck(f"GET {path} as tenant {who} (not the runtime owner) → 403 LOUD",
                   r.status_code == 403, f"got {r.status_code} {r.text[:60]}")
        for path in fenced:
            r = c.get(path, headers=H(TOK["R"]))
            ck(f"GET {path} as the RUNTIME tenant → served (not 401/403)",
               r.status_code not in (401, 403), f"got {r.status_code}")

        # a WRITE across the fence must land nowhere
        r = c.post("/api/customer/" + PH_A.replace("+", "%2B") + "/erp-code",
                   headers=H(TOK["B"]), json={"erp_client_code": "HACK-1"})
        ck("cross-tenant erp-code WRITE → refused", r.status_code in (401, 403, 404), f"got {r.status_code}")
        val = await _erp_of(PH_A)
        ck("…and nothing was written", not val, f"erp={val!r}")

        # ── B3 · A CLIENT-SUPPLIED TENANT ID IS IGNORED ───────────────────────────────────────────
        print("\nB3 · client-supplied tenant id")
        r = c.get(f"/api/shop/connect/status?tenant={TEN_B}", headers=H(TOK["A"]))
        got = (r.json() or {}).get("account_id", "") if r.status_code == 200 else ""
        ck("connect/status?tenant=B with A's bearer → B's payout account NOT served",
           r.status_code == 200 and got != "acct_VITALISO_B", f"{r.status_code} account_id={got!r}")
        rb = c.get(f"/api/shop/connect/status?tenant={TEN_B}", headers=H(TOK["B"]))
        ck("…while B's OWN bearer does resolve B's account (proving the read works at all)",
           rb.status_code == 200 and (rb.json() or {}).get("account_id") == "acct_VITALISO_B",
           f"{rb.status_code} {rb.text[:80]}")
        rk = c.get(f"/api/shop/connect/status?tenant={TEN_B}", headers=H(key=True))
        ck("…and the MACHINE key still honours ?tenant= (the storefront's documented dual path)",
           rk.status_code == 200 and (rk.json() or {}).get("account_id") == "acct_VITALISO_B",
           f"{rk.status_code} {rk.text[:80]}")
        # a FULLY VALID save (brain/range.set_range requires the depot) that also spells out a tenant
        r = c.put("/api/tenant/range", headers=H(TOK["A"]),
                  json={"range_km": 42, "depot_lat": 40.42, "depot_lon": -3.70,
                        "depot_label": "Nave A", "tenant": TEN_B, "tenant_id": TEN_B})
        after_b = await _range_of(TEN_B)
        after_a = await _range_of(TEN_A)
        ck("PUT /api/tenant/range accepted for A", r.status_code == 200, f"{r.status_code} {r.text[:90]}")
        ck("…with `tenant: B` in the body → B's radius UNCHANGED (77)", after_b == 77, f"B={after_b}")
        ck("…and the write landed on A's OWN row (42) — the body's tenant was ignored",
           after_a == 42, f"A={after_a}")

        # ── B4 · A CLIENT-SUPPLIED SCOPE IS A TENANT ID IN A COSTUME ──────────────────────────────
        print("\nB4 · client-supplied runtime scope")
        r = c.get(f"/api/mode?scope=t.{TEN_B}.c.42", headers=H(TOK["A"]))
        ck("GET /api/mode?scope=t.<B>.c.42 with A's bearer → 403", r.status_code == 403,
           f"got {r.status_code}")
        r = c.get(f"/api/mode?scope=t.{TEN_R}.c.42", headers=H(TOK["A"]))
        ck("GET /api/mode?scope=t.<RUNTIME>.c.42 with A's bearer → 403", r.status_code == 403,
           f"got {r.status_code}")
        r = c.get(f"/api/trackers?scope=t.{TEN_B}.c.42", headers=H(TOK["A"]))
        ck("GET /api/trackers?scope=t.<B>.… with A's bearer → 403", r.status_code == 403,
           f"got {r.status_code}")

        # ── B6 · THE CAP MATRIX ───────────────────────────────────────────────────────────────────
        print("\nB6 · caps (staff < owner)")
        r = c.get("/api/tenant/range", headers=H(TOK["S"]))
        ck("staff of B can READ its range", r.status_code == 200, f"got {r.status_code}")
        r = c.put("/api/tenant/range", headers=H(TOK["S"]), json={"range_km": 3})
        ck("staff of B CANNOT write it (admin cap) → 403", r.status_code == 403, f"got {r.status_code}")
        ck("…and B's radius is still 77", (await _range_of(TEN_B)) == 77)

        # ── B7 · FOUNDER-ONLY SURFACES ────────────────────────────────────────────────────────────
        print("\nB7 · founder-only (the seeded world + the destructive admin routes)")
        for path in ("/api/admin/reset", "/api/admin/seed/refresh", "/api/app/seed/reset"):
            r = c.post(path, headers=H(TOK["A"]), json={})
            ck(f"POST {path} as an ordinary tenant owner → 403", r.status_code == 403, f"got {r.status_code}")
        r = c.get("/api/app/gate-mode", headers=H(TOK["A"]))
        ck("GET /api/app/gate-mode as an ordinary tenant owner → 403", r.status_code == 403,
           f"got {r.status_code}")

        # ── /media is PER-USER ONLY now (2026-07-27) ─────────────────────────────────────────────
        # This block used to assert the opposite, and the assertion was correct at the time: /media
        # was the ONE documented dual route, accepting the machine key so images and voice notes did
        # not go blank the moment ApiClient moved to the per-user bearer. The five Kotlin loaders
        # have now moved, the `buildConfigField` is deleted, and the key that shipped in every APK
        # has been rotated on prod. So the dual is gone and this asserts its ABSENCE — an APK is a
        # file people forward, and the whole point of the rotation is that holding an old one buys
        # nothing.
        print("\nB8 · /media is PER-USER ONLY (the dual route is gone)")
        r = c.get("/media/definitely-not-a-real-file.jpg", headers=H(key=True))
        ck("/media REFUSES the machine key — the APK key is gone, per-user only → 401",
           r.status_code == 401, f"got {r.status_code}")
        r = c.get("/media/definitely-not-a-real-file.jpg", headers=H(TOK["A"]))
        ck("/media also accepts a per-user bearer → 404 not 401", r.status_code == 404,
           f"got {r.status_code}")
        r = c.get("/media/definitely-not-a-real-file.jpg")
        ck("/media with NO credential → 401", r.status_code == 401, f"got {r.status_code}")

        # ── B9 · THE OTHER HALF OF THE CLAIM: NOTHING MACHINE-SIDE WAS BROKEN ─────────────────────
        # Closing a hole by breaking the storefront or the deploy scripts is a worse outcome than the
        # hole. `require_key` survives on exactly the routes no phone calls, and the storefront's
        # public reads must stay public — those are its ONLY two ways in.
        print("\nB9 · the machine + public rails still authenticate (regression floor)")
        r = c.get("/api/version", headers=H(key=True))
        ck("/api/version WITH the machine key → 200 (M2M still works)", r.status_code == 200,
           f"got {r.status_code}")
        r = c.get("/api/version")
        ck("/api/version with NO credential → 401 (still gated)", r.status_code == 401,
           f"got {r.status_code}")
        r = c.get("/api/version", headers=H(TOK["A"]))
        ck("/api/version with a per-USER bearer → 401 (the key path is explicitly scoped, "
           "not a second door for phones)", r.status_code == 401, f"got {r.status_code}")
        # NOT called with the key on purpose: a real POST mints a live Stripe AccountSession. The
        # auth claim is the guard, and the guard is proved by the refusal.
        r = c.post("/api/shop/connect/session", json={})
        ck("/api/shop/connect/session with NO credential → 401 (still key-gated for the storefront)",
           r.status_code == 401, f"got {r.status_code}")
        # The Medusa storefront's UNAUTHENTICATED reads (`medusa/storefront/lib/tenant.ts`) — public by
        # design. The assertion is NOT 200: on the clone `SHOP_ENABLED` is off, so 503 «shop disabled»
        # is the correct answer and a green 200 would be the surprising one. What is being asserted is
        # that neither route acquired a CREDENTIAL requirement it did not have — i.e. never 401/403.
        for path in ("/api/shop/directory", f"/api/shop/tenant/{TEN_A}"):
            r = c.get(path)
            ck(f"GET {path} anonymous → not 401/403 (storefront read still uncredentialed)",
               r.status_code not in (401, 403), f"got {r.status_code}")
        r = c.get("/healthz")
        ck("/healthz anonymous → 200 (the watchdog's only probe)", r.status_code == 200,
           f"got {r.status_code}")

    finally:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except Exception:
            proc.kill()
        for f in tmps:
            try:
                os.unlink(f)
            except OSError:
                pass
        await _cleanup()

    ok = sum(1 for x in R if x)
    bad = len(R) - ok
    print(f"\n  {ok}/{len(R)} PASS" + (f", {bad} FAIL" if bad else ""))
    return 1 if bad else 0


async def _tenant_name(slug):
    async with db.get_pool().acquire() as con:
        return await con.fetchval("select name from tenants where slug=$1", slug)


async def _erp_of(phone):
    async with db.get_pool().acquire() as con:
        return await con.fetchval("select erp_client_code from customer_profiles where phone_number=$1", phone)


async def _range_of(slug):
    async with db.get_pool().acquire() as con:
        v = await con.fetchval("select range_km from tenant_range where tenant_id=$1", slug)
    return int(v) if v is not None else None


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
