"""vital_cr_auth.py — WP-9 cr-auth: Control Room real auth + server-side sessions.

The security floor for the CR control surfaces, hardened per the 7-lens threat model. Deterministic, no
network (brain.auth.resolve_role/has_matching_oauth are pure; Supabase verify_token is NEVER called).
Asserts: the role gate (only an owner/admin whose OAuth identity EMAIL matches elevates — the linkIdentity
escalation is blocked); the cookie's secret is NOT stored (only sha256); stable session_id across rotation;
expiry; revoke; wrong-secret rejection; CSRF double-submit; the least-privilege cap matrix; the sliding
rotation + prev-secret grace; per-bucket rate-limit; the append-only cr_audit row AND that a UPDATE/DELETE
against cr_audit is blocked at the DB level.
"""
import asyncio
import os
from pathlib import Path

for _l in Path("/opt/rocoto/.env").read_text().splitlines() if Path("/opt/rocoto/.env").exists() else []:
    _l = _l.strip()
    if _l and not _l.startswith("#") and "=" in _l:
        k, _, v = _l.partition("="); os.environ.setdefault(k.strip(), v.strip())
import cr_session  # noqa: E402
import db

R = []
def ck(n, ok, d=""):
    R.append(bool(ok)); print(f"  [{'PASS' if ok else 'FAIL'}] {n}" + (f" — {d}" if d else ""))

def _goog(email):
    return {"provider": "google", "identity_data": {"email": email, "email_verified": True}}
OWNER    = {"id": "u-o", "email": "peter@leo.casa", "identities": [_goog("peter@leo.casa")]}   # matching OAuth
NOAUTH   = {"id": "u-n", "email": "peter@leo.casa", "identities": [{"provider": "email"}]}      # password only
FORGED   = {"id": "u-f", "email": "peter@leo.casa",                                            # linkIdentity attack
            "identities": [{"provider": "email"}, _goog("attacker@gmail.com")]}
CUSTOMER = {"id": "u-c", "email": "someone@gmail.com", "identities": [_goog("someone@gmail.com")]}

async def main():
    await db.init()

    # ── role gate ─────────────────────────────────────────────────────────────────────────────────
    s = await cr_session.session_for_user(OWNER, "1.2.3.4", "ua/1")
    ck("owner (matching Google) → session minted", s.get("ok") and s.get("raw") and s.get("role") == "owner")
    raw = s["raw"]; csrf = s["csrf"]; sid, _, secret = raw.partition(".")
    ck("customer → refused", not (await cr_session.session_for_user(CUSTOMER, "1.2.3.4", "ua")).get("ok"))
    ck("owner email, password-only (no OAuth) → refused",
       not (await cr_session.session_for_user(NOAUTH, "1.2.3.4", "ua")).get("ok"))
    ck("owner email + FORGED attacker-Google identity → refused (linkIdentity escalation blocked)",
       not (await cr_session.session_for_user(FORGED, "1.2.3.4", "ua")).get("ok"))

    # ── the secret is a bearer: NOT stored (only its sha256); session_id IS the stored PK ──────────
    async with db.get_pool().acquire() as con:
        sid_hit    = await con.fetchval("select count(*) from cr_session where session_id = $1", sid)
        secret_raw = await con.fetchval("select count(*) from cr_session where secret_hash = $1", secret)
        secret_h   = await con.fetchval("select count(*) from cr_session where secret_hash = $1", cr_session._hash(secret))
    ck("session_id stored (stable PK)", sid_hit == 1)
    ck("raw secret NOT stored", secret_raw == 0)
    ck("sha256(secret) stored", secret_h == 1)

    # ── verify roundtrip + tamper/absent ──────────────────────────────────────────────────────────
    ctx = await cr_session.verify(raw)
    ck("verify(raw) → actor ctx", ctx and ctx.get("actor_email") == "peter@leo.casa" and ctx.get("role") == "owner")
    ck("verify(session_id.WRONGsecret) → None", (await cr_session.verify(sid + ".wrongsecret")) is None)
    ck("verify(no-dot garbage) → None", (await cr_session.verify("not-a-cookie")) is None)
    ck("verify('') → None (fail-closed)", (await cr_session.verify("")) is None)

    # ── CSRF double-submit (constant-time; stable across rotation) ─────────────────────────────────
    ck("CSRF: matching accepted", cr_session.check_csrf(ctx, csrf) is True)
    ck("CSRF: wrong rejected", cr_session.check_csrf(ctx, "wrong") is False)
    ck("CSRF: empty rejected", cr_session.check_csrf(ctx, "") is False)

    # ── caps ──────────────────────────────────────────────────────────────────────────────────────
    ck("owner can data-erase (admin cap)", cr_session.can("owner", "admin"))
    ck("admin CANNOT data-erase", not cr_session.can("admin", "admin"))
    ck("admin can refund (act cap)", cr_session.can("admin", "act"))
    ck("customer can nothing", not cr_session.can("customer", "read"))

    # ── expiry ────────────────────────────────────────────────────────────────────────────────────
    async with db.get_pool().acquire() as con:
        await con.execute("update cr_session set expires_at = now() - interval '1 minute' where session_id = $1", sid)
    ck("expired session → None", (await cr_session.verify(raw)) is None)

    # ── revoke ────────────────────────────────────────────────────────────────────────────────────
    s2 = await cr_session.session_for_user(OWNER, "9.9.9.9", "ua/2"); raw2 = s2["raw"]
    ck("fresh session verifies", (await cr_session.verify(raw2)) is not None)
    await cr_session.revoke(raw2)
    ck("revoked session → None", (await cr_session.verify(raw2)) is None)

    # ── sliding rotation (stable PK, rotating secret, prev-secret grace) ───────────────────────────
    s3 = await cr_session.session_for_user(OWNER, "5.5.5.5", "ua/3"); raw3 = s3["raw"]; sid3 = raw3.partition(".")[0]
    async with db.get_pool().acquire() as con:
        await con.execute("update cr_session set last_seen_at = now() - (($1||' seconds')::interval + interval '1 minute') "
                          "where session_id = $2", str(cr_session.ROTATE_AFTER_S), sid3)
    rc = await cr_session.verify(raw3, rotate=True)
    ck("rotation issues a fresh secret", rc and rc.get("fresh_raw") and rc["fresh_raw"] != raw3)
    ck("session_id is STABLE across rotation", rc and rc["fresh_raw"].partition(".")[0] == sid3)
    ck("rotated-in secret verifies", (await cr_session.verify(rc["fresh_raw"])) is not None)
    ck("old secret still verifies during grace (no dropped session)", (await cr_session.verify(raw3)) is not None)

    # ── audit written + append-only enforced at the DB level ──────────────────────────────────────
    await cr_session.audit("peter@leo.casa", "1.2.3.4", "refund",
                           target_scope="wa.34600000000", target_id="pi_test", detail={"amount": 5000}, result="ok")
    async with db.get_pool().acquire() as con:
        a = await con.fetchrow("select actor_email, action, target_scope, result from cr_audit "
                               "where target_id = 'pi_test' order by id desc limit 1")
    ck("audit row written (actor+action+target)",
       a and a["actor_email"] == "peter@leo.casa" and a["action"] == "refund" and a["target_scope"] == "wa.34600000000")
    upd_blocked = del_blocked = False
    async with db.get_pool().acquire() as con:
        try:
            await con.execute("update cr_audit set result = 'tamper' where target_id = 'pi_test'")
        except Exception:
            upd_blocked = True
        try:
            await con.execute("delete from cr_audit where target_id = 'pi_test'")
        except Exception:
            del_blocked = True
    ck("cr_audit UPDATE blocked (append-only)", upd_blocked)
    ck("cr_audit DELETE blocked (append-only)", del_blocked)

    # ── rate limit ────────────────────────────────────────────────────────────────────────────────
    allowed = sum(1 for _ in range(20) if cr_session.rate_ok("test:1.2.3.4", limit=5, window_s=60))
    ck("rate limit caps the burst (5 of 20)", allowed == 5, f"allowed={allowed}")

    # cleanup — cr_session only (cr_audit is append-only by design; the rehearsal clone is ephemeral)
    async with db.get_pool().acquire() as con:
        await con.execute("update cr_session set revoked_at = now() where actor_email = 'peter@leo.casa' and ua like 'ua/%'")

    print(f"\nvital_cr_auth: {sum(R)}/{len(R)} green")
    if not all(R):
        raise SystemExit(1)

if __name__ == "__main__":
    asyncio.run(main())
