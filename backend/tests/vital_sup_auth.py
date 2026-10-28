"""vital_sup_auth.py — Wave-3 sup-auth: the supplier web-app session world + ABSOLUTE tenant isolation.

Deterministic, no network (brain.auth.has_matching_oauth is pure; Supabase verify_token is NEVER
called). Two halves:

  A. SESSION MECHANICS (the cr_session mirror, on its OWN table): Google-only elevation via
     membership (a password signup / linkIdentity forgery / non-member Google all refused);
     secret-not-stored (sha256 only); verify/tamper/expiry/revoke; CSRF double-submit; the
     owner|founder|staff cap matrix; sliding rotation + prev-secret grace; rate limit; the
     append-only sup_audit (UPDATE/DELETE blocked at the DB level).

  B. TENANT ISOLATION — the A1-tail contract (2026-08-07): a tenant-B session (i) sees ONLY
     tenant-B rows on the tenant_id-keyed surfaces (customers, catalogue), (ii) 404s on
     tenant-A's customer detail/erp-code (no write lands), and (iii) is SERVED the runtime
     surfaces (orders/chats/routes) TENANT-FILTERED — its own honest world, never a foreign
     row, and a foreign order id 404s without leaking existence. The old 403 fence survives
     only where it should: dispatch and the demo pair.

SAFETY: refuses the live `rocoto` DB. Point it at rocoto_rehearsal (source rehearsal_env.sh).
"""
import asyncio
import os
from pathlib import Path

for _l in Path("/opt/rocoto/.env").read_text().splitlines() if Path("/opt/rocoto/.env").exists() else []:
    _l = _l.strip()
    if _l and not _l.startswith("#") and "=" in _l:
        k, _, v = _l.partition("=")
        os.environ.setdefault(k.strip(), v.strip())

import config  # noqa: E402
import db  # noqa: E402
import sup_api  # noqa: E402
import sup_session  # noqa: E402

R = []


def ck(n, ok, d=""):
    R.append(bool(ok)); print(f"  [{'PASS' if ok else 'FAIL'}] {n}" + (f" — {d}" if d else ""))


def _goog(email):
    return {"provider": "google", "identity_data": {"email": email, "email_verified": True}}


TEN_A, TEN_B = "vital-sup-a", "vital-sup-b"
EMAIL_A, EMAIL_B = "owner-a@vitalsup.test", "staff-b@vitalsup.test"
PHONE_A, PHONE_B = "+34600111001", "+34600111002"
ORDER_A = "vitalsup-order-a"          # tenant A's seeded order — the row that must never cross

MEMBER_A  = {"id": "u-a", "email": EMAIL_A, "identities": [_goog(EMAIL_A)]}          # founder, tenant A
MEMBER_B  = {"id": "u-b", "email": EMAIL_B, "identities": [_goog(EMAIL_B)]}          # staff, tenant B
PASSWORD  = {"id": "u-p", "email": EMAIL_A, "identities": [{"provider": "email"}]}    # password only
FORGED    = {"id": "u-f", "email": EMAIL_A,                                          # linkIdentity attack
             "identities": [{"provider": "email"}, _goog("attacker@gmail.com")]}
OUTSIDER  = {"id": "u-o", "email": "nobody@gmail.com", "identities": [_goog("nobody@gmail.com")]}


async def _seed():
    async with db.get_pool().acquire() as con:
        for slug, name in ((TEN_A, "Vital Sup A SL"), (TEN_B, "Vital Sup B SL")):
            await con.execute(
                "insert into tenants (slug, name, status, seeded) values ($1,$2,'test',true) "
                "on conflict (slug) do nothing", slug, name)
        await con.execute(
            "insert into operators (id, email, name, is_founder, seeded) values "
            "('op_vital_a', $1, 'Vital A', true, true), ('op_vital_b', $2, 'Vital B', false, true) "
            "on conflict (id) do nothing", EMAIL_A, EMAIL_B)
        await con.execute(
            "insert into team_members (operator_id, tenant_slug, role, seeded) values "
            "('op_vital_a', $1, 'owner', true), ('op_vital_b', $2, 'staff', true) "
            "on conflict do nothing", TEN_A, TEN_B)
        for phone, tenant, name in ((PHONE_A, TEN_A, "Bar A"), (PHONE_B, TEN_B, "Bar B")):
            await con.execute(
                "insert into customer_profiles (phone_number, tenant_id, display_name, stats, seeded) "
                "values ($1,$2,$3,$4,true) on conflict (tenant_id, phone_number) do update "
                "  set tenant_id=excluded.tenant_id, display_name=excluded.display_name",
                phone, tenant, name, {"lifetime_value": 123.45})
        for sid, tenant in (("vitalsup-sku-a", TEN_A), ("vitalsup-sku-b", TEN_B)):
            await con.execute(
                "insert into catalogue_skus (id, tenant_id, name, seeded) values ($1,$2,$3,true) "
                "on conflict (id) do nothing", sid, tenant, f"Tomate {tenant}")
        # the isolation probe: ONE order for tenant A that must appear for A and never for B
        await con.execute(
            "insert into orders (id, tenant_id, phone_number, customer_name, status, lines, seeded) "
            "values ($1,$2,$3,'Bar A','approved','[]'::jsonb,true) on conflict (id) do nothing",
            ORDER_A, TEN_A, PHONE_A)


async def _cleanup():
    async with db.get_pool().acquire() as con:
        await con.execute("delete from sup_session where actor_email like '%@vitalsup.test'")
        await con.execute("delete from orders where id = $1", ORDER_A)
        await con.execute("delete from customer_profiles where phone_number in ($1,$2)", PHONE_A, PHONE_B)
        await con.execute("delete from catalogue_skus where id like 'vitalsup-sku-%'")
        await con.execute("delete from team_members where operator_id like 'op_vital_%'")
        await con.execute("delete from operators where id like 'op_vital_%'")
        await con.execute("delete from tenants where slug in ($1,$2)", TEN_A, TEN_B)


async def main():
    await db.init()
    async with db.get_pool().acquire() as con:
        dbname = await con.fetchval("select current_database()")
    if dbname == "rocoto":
        raise SystemExit("REFUSING to run vitals against the LIVE 'rocoto' DB — use rocoto_rehearsal")
    print(f"  (db={dbname})")
    await _seed()

    # ── A · membership + elevation gate ──────────────────────────────────────────────────────────
    sA = await sup_session.session_for_user(MEMBER_A, "1.2.3.4", "ua/1")
    ck("member (matching Google) → tenant-scoped session minted",
       sA.get("ok") and sA.get("tenant_slug") == TEN_A and sA.get("role") == "founder",
       f"role={sA.get('role')} tenant={sA.get('tenant_slug')}")
    ck("tenant_name resolved from tenants", sA.get("tenant_name") == "Vital Sup A SL")
    sB = await sup_session.session_for_user(MEMBER_B, "1.2.3.4", "ua/1")
    ck("staff member → role staff, THEIR tenant",
       sB.get("ok") and sB.get("tenant_slug") == TEN_B and sB.get("role") == "staff")
    ck("password-only (no OAuth) → refused",
       not (await sup_session.session_for_user(PASSWORD, "1.2.3.4", "ua")).get("ok"))
    ck("FORGED attacker-Google identity → refused (linkIdentity blocked)",
       not (await sup_session.session_for_user(FORGED, "1.2.3.4", "ua")).get("ok"))
    ck("Google user with NO membership → refused",
       not (await sup_session.session_for_user(OUTSIDER, "1.2.3.4", "ua")).get("ok"))

    raw, csrf = sA["raw"], sA["csrf"]
    sid, _, secret = raw.partition(".")

    # ── A · the secret is a bearer: NOT stored; session_id IS the stored PK ─────────────────────
    async with db.get_pool().acquire() as con:
        sid_hit = await con.fetchval("select count(*) from sup_session where session_id=$1", sid)
        raw_hit = await con.fetchval("select count(*) from sup_session where secret_hash=$1", secret)
        h_hit = await con.fetchval("select count(*) from sup_session where secret_hash=$1",
                                   sup_session._hash(secret))
    ck("session_id stored (stable PK)", sid_hit == 1)
    ck("raw secret NOT stored", raw_hit == 0)
    ck("sha256(secret) stored", h_hit == 1)

    # ── A · verify + tamper + CSRF + caps ────────────────────────────────────────────────────────
    ctx = await sup_session.verify(raw)
    ck("verify(raw) → tenant-scoped ctx",
       ctx and ctx.get("actor_email") == EMAIL_A and ctx.get("tenant_slug") == TEN_A)
    ck("verify(sid.WRONGsecret) → None", (await sup_session.verify(sid + ".wrong")) is None)
    ck("verify('') → None (fail-closed)", (await sup_session.verify("")) is None)
    ck("CSRF: matching accepted", sup_session.check_csrf(ctx, csrf) is True)
    ck("CSRF: wrong rejected", sup_session.check_csrf(ctx, "wrong") is False)
    ck("caps: founder has admin", sup_session.can("founder", "admin"))
    ck("caps: owner has admin", sup_session.can("owner", "admin"))
    ck("caps: staff can act but NOT admin",
       sup_session.can("staff", "act") and not sup_session.can("staff", "admin"))
    ck("caps: unknown role can NOTHING", not sup_session.can("customer", "read"))

    # ── A · expiry + revoke + rotation grace ─────────────────────────────────────────────────────
    async with db.get_pool().acquire() as con:
        await con.execute("update sup_session set expires_at = now() - interval '1 minute' "
                          "where session_id=$1", sid)
    ck("expired session → None", (await sup_session.verify(raw)) is None)
    s2 = await sup_session.session_for_user(MEMBER_A, "9.9.9.9", "ua/2"); raw2 = s2["raw"]
    await sup_session.revoke(raw2)
    ck("revoked session → None", (await sup_session.verify(raw2)) is None)
    s3 = await sup_session.session_for_user(MEMBER_A, "5.5.5.5", "ua/3")
    raw3 = s3["raw"]; sid3 = raw3.partition(".")[0]
    async with db.get_pool().acquire() as con:
        await con.execute("update sup_session set last_seen_at = now() - (($1||' seconds')::interval "
                          "+ interval '1 minute') where session_id=$2",
                          str(sup_session.ROTATE_AFTER_S), sid3)
    rc = await sup_session.verify(raw3, rotate=True)
    ck("rotation issues a fresh secret on a stable session_id",
       rc and rc.get("fresh_raw") and rc["fresh_raw"] != raw3
       and rc["fresh_raw"].partition(".")[0] == sid3)
    ck("rotated-in secret verifies", (await sup_session.verify(rc["fresh_raw"])) is not None)
    ck("old secret still verifies during grace", (await sup_session.verify(raw3)) is not None)

    # ── A · rate limit + append-only audit ───────────────────────────────────────────────────────
    allowed = sum(1 for _ in range(20) if sup_session.rate_ok("vitalsup:1.2.3.4", limit=5, window_s=60))
    ck("rate limit caps the burst (5 of 20)", allowed == 5, f"allowed={allowed}")
    await sup_session.audit(EMAIL_A, TEN_A, "1.2.3.4", "order.status",
                            target_id="vitalsup-o1", detail={"status": "approved"})
    async with db.get_pool().acquire() as con:
        a = await con.fetchrow("select actor_email, tenant_slug, action from sup_audit "
                               "where target_id='vitalsup-o1' order by id desc limit 1")
    ck("sup_audit row written (actor+tenant+action)",
       a and a["actor_email"] == EMAIL_A and a["tenant_slug"] == TEN_A and a["action"] == "order.status")
    upd_blocked = del_blocked = False
    async with db.get_pool().acquire() as con:
        try:
            await con.execute("update sup_audit set result='tamper' where target_id='vitalsup-o1'")
        except Exception:
            upd_blocked = True
        try:
            await con.execute("delete from sup_audit where target_id='vitalsup-o1'")
        except Exception:
            del_blocked = True
    ck("sup_audit UPDATE blocked (append-only)", upd_blocked)
    ck("sup_audit DELETE blocked (append-only)", del_blocked)

    # ── B · TENANT ISOLATION — cross-tenant reads FAIL LOUD ─────────────────────────────────────
    ctxA = {"tenant_slug": TEN_A, "actor_email": EMAIL_A, "role": "founder", "csrf": "x", "ip": "1.1.1.1"}
    ctxB = {"tenant_slug": TEN_B, "actor_email": EMAIL_B, "role": "staff", "csrf": "x", "ip": "1.1.1.1"}

    ca = await sup_api.sup_customers(ctx=ctxA)
    cb = await sup_api.sup_customers(ctx=ctxB)
    phones_a = {c["phone_number"] for c in ca["customers"]}
    phones_b = {c["phone_number"] for c in cb["customers"]}
    ck("customers: tenant A sees ITS row, not B's", PHONE_A in phones_a and PHONE_B not in phones_a)
    ck("customers: tenant B sees ITS row, not A's", PHONE_B in phones_b and PHONE_A not in phones_b)

    ka = await sup_api.sup_catalogue(ctx=ctxA)
    kb = await sup_api.sup_catalogue(ctx=ctxB)
    ids_a = {s["id"] for s in ka["skus"]}
    ids_b = {s["id"] for s in kb["skus"]}
    ck("catalogue: tenant-filtered both ways",
       "vitalsup-sku-a" in ids_a and "vitalsup-sku-b" not in ids_a
       and "vitalsup-sku-b" in ids_b and "vitalsup-sku-a" not in ids_b)

    # cross-tenant customer DETAIL → loud 404, never A's data on B's session
    try:
        await sup_api.sup_customer_detail(PHONE_A, ctx=ctxB)
        ck("cross-tenant customer detail → refused", False, "returned data!")
    except sup_api.SupApiError as e:
        ck("cross-tenant customer detail → refused LOUD (404)", e.status == 404)

    # cross-tenant erp-code WRITE → loud 404 AND nothing written
    try:
        await sup_api.sup_customer_erp_code(PHONE_A, {"erp_client_code": "HACK-1"}, ctx=ctxB)
        wrote = True
    except sup_api.SupApiError as e:
        wrote = e.status != 404
    async with db.get_pool().acquire() as con:
        val = await con.fetchval("select erp_client_code from customer_profiles where phone_number=$1",
                                 PHONE_A)
    ck("cross-tenant erp-code write → refused LOUD + no write", (not wrote) and val is None,
       f"val={val}")

    # THE ISOLATION CONTRACT, A1-TAIL EDITION (2026-08-07). The fence used to 403 every
    # non-owner tenant off the legacy surfaces; the tail made those reads TENANT-FILTERED, so
    # the contract this vital guards got STRONGER: a non-owner tenant is SERVED — and served
    # exactly its own world, never a row of anyone else's. A fresh tenant's day is an honest
    # empty, and tenant A's seeded order must never surface in tenant B's reads.
    ck("owns_runtime still names the deployment tenant (dispatch/demo stay fenced on it)",
       sup_session.owns_runtime(config.BRAIN_TENANT) and not sup_session.owns_runtime(TEN_A))
    ordsA = (await sup_api.sup_orders(ctx=ctxA))["orders"]
    ck("tenant A sees ITS seeded order", any(o.get("id") == ORDER_A for o in ordsA),
       f"ids={[o.get('id') for o in ordsA][:4]}")
    ordsB = (await sup_api.sup_orders(ctx=ctxB))["orders"]
    ck("tenant B's order list carries NO foreign row",
       all(o.get("tenant_id") in (None, TEN_B) for o in ordsB)
       and not any(o.get("id") == ORDER_A for o in ordsB),
       f"ids={[o.get('id') for o in ordsB][:4]}")
    chatsB = (await sup_api.sup_chats(ctx=ctxB))["conversations"]
    ck("tenant B's chats roster is its own (empty here — no messages seeded for B)",
       chatsB == [], f"got={chatsB[:2]}")
    dayB = await sup_api.sup_routes_day("2026-07-25", ctx=ctxB)
    ck("tenant B's routes day is served and empty",
       isinstance(dayB, dict) and not (dayB.get("stops") or []),
       f"stops={dayB.get('stops') if isinstance(dayB, dict) else dayB}")
    try:
        detA = await sup_api.sup_order(ORDER_A, ctx=ctxB)
        ck("tenant B reading tenant A's order id → 404 (existence never leaks)", False,
           f"served: {detA.get('id')}")
    except sup_api.SupApiError as e:
        ck("tenant B reading tenant A's order id → 404 (existence never leaks)",
           e.status == 404)

    # the CR world and the sup world share NO secret material: a sup cookie never resolves as CR
    import cr_session
    ck("sup cookie does NOT resolve in the CR session world",
       (await cr_session.verify(rc["fresh_raw"])) is None)

    # ── C · the e-commerce toggle records INTENT + surfaces to Peter (never auto-provisions) ────
    surfaced = []

    async def _fake_surface(cls, detail, ref_scope=None):
        surfaced.append({"cls": cls, "detail": detail, "ref_scope": ref_scope})
        return {"class": cls, "via": "stub", "alert_id": None}

    _real_surface = sup_api.ops.record_alert
    sup_api.ops.record_alert = _fake_surface
    try:
        r1 = await sup_api.sup_settings_ecommerce({"enabled": True}, ctx=ctxA)
        async with db.get_pool().acquire() as con:
            row = await con.fetchrow(
                "select ecommerce_enabled, ecommerce_requested_at from tenants where slug=$1", TEN_A)
        ck("toggle ON → intent recorded (enabled + requested_at)",
           r1["ecommerce_enabled"] is True and row["ecommerce_enabled"] and row["ecommerce_requested_at"])
        ck("toggle ON → surfaced to Peter ONCE, tenant-tagged",
           len(surfaced) == 1 and TEN_A in surfaced[0]["detail"]
           and surfaced[0]["ref_scope"] == f"t.{TEN_A}")
        ck("toggle ON → es-ES copy says it is NOT automatic",
           "No se activa sola" in (r1.get("note") or ""))
        await sup_api.sup_settings_ecommerce({"enabled": True}, ctx=ctxA)   # idempotent re-enable
        ck("re-enable while already ON → no duplicate surfacing", len(surfaced) == 1)
        r0 = await sup_api.sup_settings_ecommerce({"enabled": False}, ctx=ctxA)
        async with db.get_pool().acquire() as con:
            row = await con.fetchrow(
                "select ecommerce_enabled, ecommerce_requested_at from tenants where slug=$1", TEN_A)
        ck("toggle OFF → disabled, intent timestamp KEPT (history)",
           r0["ecommerce_enabled"] is False and not row["ecommerce_enabled"]
           and row["ecommerce_requested_at"] is not None)
        # tenant isolation on the toggle: B's flip never touches A
        await sup_api.sup_settings_ecommerce({"enabled": True}, ctx=ctxB)
        async with db.get_pool().acquire() as con:
            a_still = await con.fetchval("select ecommerce_enabled from tenants where slug=$1", TEN_A)
        ck("toggle is tenant-scoped (B's ON leaves A OFF)", a_still is False)
    finally:
        sup_api.ops.record_alert = _real_surface

    await _cleanup()
    print(f"\nvital_sup_auth: {sum(R)}/{len(R)} PASS")
    if not all(R):
        raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())
