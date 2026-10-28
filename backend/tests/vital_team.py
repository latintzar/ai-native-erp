"""vital_team.py — GRANTING SOMEBODY ACCESS IS AN ACT, AND IT HAS A DOOR NOW (SPEC §5.11.3).

Until this build `/api/sup/team` was GET-only: nothing in the product could create a second team
member, so the `repartidor` role shipped ungrantable and a driver's login meant two hand-run INSERTs
on prod — no invite, no revocation, no audit row for the act itself. `brain/teams.add · set_role ·
remove` is that door. Each check below is a product promise, not arithmetic:

  T1  AN UNKNOWN ROLE IS REFUSED  — never coerced. Collapsing an unrecognised role to 'staff' (which
                                    carries read+act) is what made adding `repartidor` a privilege
                                    GRANT instead of a restriction; the fix belongs at the door as
                                    well as at the resolvers. Case is not folded either.
  T2  `founder` IS NOT GRANTABLE  — it is Rocoto's OWN seeded identity (`operators.is_founder`,
                                    rewritten by ensure_seed on every boot), not a rank a company
                                    hands out. Cap-for-cap it equals `owner`, so nothing is lost.
  T3  THE EMAIL IS LOWERCASED     — `resolve_membership` matches on lower(o.email) while
                                    `operators.email` is UNIQUE on the raw string, so one casing on
                                    the way in is what keeps the person and the row the same thing.
  T4  ONE LIST, NOT TWO           — the assignable roles are a subset of sup_session.ROLE_CAPS and
                                    the admin set is READ OUT of it, so a future admin-carrying role
                                    is protected by the last-admin guard the day it exists.
  T5  A DRIVER IS A DRIVER ON BOTH CARRIERS — a `repartidor` row yields caps == {deliver} through
                                    sup_session (the desk cookie) AND brain_auth.app_scope (the phone
                                    bearer). One rule, two carriers; a disagreement would BE the hole.
  T6  ADDING AN ADDRESS TWICE IS A ROLE CHANGE — never a second row, never a silently swallowed
                                    conflict that leaves the boss thinking he changed something.
  T7  THE ONLY DOOR IS GOOGLE     — a password identity for a REAL member is refused by both
                                    carriers, typed `oauth_required`, because with Supabase
                                    email-confirmation off a password signup is auto-confirmed and
                                    `email_confirmed_at` proves nothing. There is no second door and
                                    this vital exists partly so nobody builds one.
  T8  THE LAST ADMIN IS PROTECTED — the only owner can be neither demoted nor removed: a tenant with
                                    nobody holding `admin` can never open Ajustes again.
  T9  THE ROCOTO ACCOUNT IS NOT MANAGED FROM HERE — is_founder is refused by all three verbs; the
                                    seeder puts it back on the next boot, so "removing" it would be a
                                    button that undoes itself.
  T10 TENANT ISOLATION IS ABSOLUTE— an operator_id from another company does not resolve, so it 404s
                                    rather than being edited. The tenant is never on the wire.
  T11 REMOVING TAKES THE MEMBERSHIP, NOT THE PERSON — `delivery_stops.delivered_by` and
                                    `delivery_settlements.recorded_by` carry `operators.id`; deleting
                                    the person would orphan the signature on a delivery that happened.

T1–T4 are PURE — no database, no config, no network. T5–T11 need a clone:
    REHEARSAL_DSN=postgresql://…/rocoto_rehearsal PYTHONPATH=. python3 tests/vital_team.py
Without REHEARSAL_DSN they SKIP cleanly (and the vital still fails on any pure regression).
SAFETY: refuses the live `rocoto` DB — it writes and deletes its own test tenants' rows.
Run: PYTHONPATH=. python3 tests/vital_team.py
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import sup_session  # noqa: E402
from brain import auth as brain_auth  # noqa: E402
from brain import teams  # noqa: E402

R = []
SKIPPED = []

# Invented companies and invented people — never a real one, not even in a test (LOCKED LAW).
TEN_A, TEN_B = "vitalteam-a", "vitalteam-b"
DRIVER_TYPED = "Repartidor.Uno@VitalTeam.test"      # as a boss would type it, with capitals
DRIVER = "repartidor.uno@vitalteam.test"            # as it must be stored
JEFE = "jefe@vitalteam.test"                        # the tenant's only owner
SEGUNDO = "segundo@vitalteam.test"                  # the second owner, added mid-test
JEFE_B = "jefe-b@vitalteam.test"                    # another company's owner
ROCOTO = "rocoto-seed@vitalteam.test"               # stands in for the is_founder account


def ck(name, ok, detail=""):
    R.append(bool(ok))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


def skip(name, why):
    SKIPPED.append(name)
    print(f"  [SKIP] {name} — {why}")


def raises(fn, *a, **kw):
    """The es-ES refusal, or '' when the call was ACCEPTED (which is the failure)."""
    try:
        fn(*a, **kw)
    except ValueError as e:
        return str(e)
    except Exception as e:                      # a different exception is not a refusal
        return f"__WRONG__{type(e).__name__}: {e}"
    return ""


async def araises(coro):
    try:
        await coro
    except ValueError as e:
        return str(e)
    except LookupError as e:
        return f"__LOOKUP__{e}"
    except Exception as e:
        return f"__WRONG__{type(e).__name__}: {e}"
    return ""


# ══ T1 · an unknown role is REFUSED, never coerced ═══════════════════════════════════════════════
for good in teams.ASSIGNABLE:
    ck(f"T1 «{good}» is assignable and comes back untouched", teams.check_role(good) == good)
_unknown = {r: raises(teams.check_role, r)
            for r in ("conductor", "chofer", "REPARTIDOR", "Repartidor", "", "admin",
                      "read", "desconocido", "reparto", "owner,staff")}
ck("T1 every unknown role RAISES in es-ES (a typo is never a grant)",
   all(m and not m.startswith("__WRONG__") for m in _unknown.values()),
   " | ".join(f"{k}→{v or '(ACCEPTED!)'}" for k, v in _unknown.items())[:200])
ck("T1 case is not folded — «REPARTIDOR» is refused, not turned into a driver",
   bool(_unknown["REPARTIDOR"]) and bool(_unknown["Repartidor"]),
   _unknown["Repartidor"])
ck("T1 the refusal NAMES THE FIX (it lists the roles that exist)",
   all("repartidor" in m and "owner" in m for m in _unknown.values()))
ck("T1 an empty role asks for one rather than picking one",
   "Dime qué va a ser" in _unknown[""], _unknown[""])
# Surrounding whitespace IS trimmed and that is not a coercion — a pasted value carries it and the
# string underneath is still exactly one of the three. The CASE is what stays untouched, because the
# resolvers compare exactly and «Repartidor» would be stored as a role that reaches nothing.
ck("T1 whitespace around a real role is trimmed, not refused",
   teams.check_role(" repartidor ") == "repartidor" and teams.check_role("owner ") == "owner")

# ══ T2 · `founder` is not a rank a company hands out ═════════════════════════════════════════════
_f = raises(teams.check_role, "founder")
ck("T2 `founder` is REFUSED even though it is a real role", bool(_f) and not _f.startswith("__WRONG__"), _f)
ck("T2 …and it is refused as «not from here», not as «no existe»", "no se da de alta desde aquí" in _f)
ck("T2 refusing it costs a tenant nothing — founder and owner hold the same caps",
   set(sup_session.ROLE_CAPS["founder"]) == set(sup_session.ROLE_CAPS["owner"]))

# ══ T3 · the email is lowercased, and only an address is accepted ════════════════════════════════
ck("T3 a typed address is stored lowercased (the resolver matches on lower(o.email))",
   teams.check_email(DRIVER_TYPED) == DRIVER, f"{DRIVER_TYPED} → {teams.check_email(DRIVER_TYPED)}")
ck("T3 whitespace is trimmed (a pasted address carries it)",
   teams.check_email("  Juan@Gmail.com \n") == "juan@gmail.com")
_bad_mail = {v: raises(teams.check_email, v)
             for v in ("", "   ", "juan", "juan@", "@gmail.com", "juan@gmail", "juan gmail.com",
                       "juan@gmail.com, otro@gmail.com")}
ck("T3 anything that is not an address RAISES in es-ES",
   all(m and not m.startswith("__WRONG__") for m in _bad_mail.values()),
   " | ".join(f"{k!r}→{'ok' if v else 'ACCEPTED!'}" for k, v in _bad_mail.items())[:160])
ck("T3 the refusal says WHICH address it wants (the Google one on his phone)",
   "Google" in _bad_mail["juan"], _bad_mail["juan"])
for real in ("nombre@sudistribuidora.es", "juan+repartos@gmail.com", "j.perez@grupo-aldonza.com"):
    ck(f"T3 a real Spanish address survives the check ({real})", teams.check_email(real) == real)

# ══ T4 · one list, not two ═══════════════════════════════════════════════════════════════════════
ck("T4 every assignable role is a REAL role in the cap table",
   set(teams.ASSIGNABLE) <= set(sup_session.ROLE_CAPS), f"{teams.ASSIGNABLE}")
ck("T4 the admin set is READ OUT of the cap table, never re-listed",
   teams._admin_roles() == frozenset(r for r, c in sup_session.ROLE_CAPS.items() if "admin" in c),
   f"{sorted(teams._admin_roles())}")
ck("T4 a repartidor is NOT an admin (he could otherwise add himself an owner)",
   "repartidor" not in teams._admin_roles())
ck("T4 `is_founder` beats the stored role, exactly as the resolver decides it",
   teams.effective_role({"is_founder": True, "role": "repartidor"}) == "founder"
   and teams.effective_role({"is_founder": False, "role": "repartidor"}) == "repartidor")
ck("T4 the member wire carries the operator_id — without it nobody is addressable",
   teams.member_wire({"id": "op_x", "email": DRIVER, "name": "Uno", "role": "repartidor"})
   == {"operator_id": "op_x", "name": "Uno", "email": DRIVER, "role": "repartidor"})


# ══ T5–T11 · the door itself (needs a clone) ═════════════════════════════════════════════════════
def _goog(email):
    return {"provider": "google", "identity_data": {"email": email, "email_verified": True}}


def _user(email, google=True):
    return {"id": f"u-{email}", "email": email,
            "identities": [_goog(email)] if google else [{"provider": "email"}]}


async def _db_checks():
    import db
    await db.init()
    async with db.get_pool().acquire() as con:
        name = await con.fetchval("select current_database()")
        if name == "rocoto":
            raise SystemExit("REFUSING to run vital_team against the LIVE 'rocoto' DB "
                             "— use rocoto_rehearsal")
        print(f"  (db={name})")
        try:
            await _cleanup(con)
            for slug, nm in ((TEN_A, "Distribuciones Vital A SL"), (TEN_B, "Vital B SL")):
                await con.execute(
                    "insert into tenants (slug, name, status, seeded) values ($1,$2,'test',true) "
                    "on conflict (slug) do nothing", slug, nm)

            # The tenant starts with one owner — the boss who bought Rocoto.
            jefe = await teams.add(con, TEN_A, JEFE, name="Jose", role="owner")
            ck("T5/db the first owner is created from nothing (operator + membership)",
               jefe["ok"] and jefe["created"] and jefe["member"]["role"] == "owner"
               and jefe["member"]["operator_id"].startswith("op_"),
               jefe["member"]["operator_id"])

            # ── T5 · the driver, added by the Google address on his phone ───────────────────────
            got = await teams.add(con, TEN_A, DRIVER_TYPED, name="  Miguel   Ortiz ")
            drv_id = got["member"]["operator_id"]
            ck("T5/db a driver is added with NO role given — the default is the least privilege",
               got["created"] and got["member"]["role"] == "repartidor", got["member"]["role"])
            ck("T5/db the typed address landed lowercased in `operators`",
               await con.fetchval("select email from operators where id=$1", drv_id) == DRIVER)
            ck("T5/db the stored role is the exact string, never a coerced one",
               await con.fetchval("select role from team_members where operator_id=$1 and "
                                  "tenant_slug=$2", drv_id, TEN_A) == "repartidor")
            ck("T5/db the invitation carries the ONE sentence the boss must pass on",
               "Google" in (got.get("note") or ""), got.get("note", "")[:80])
            ck("T5/db the name is normalised, not stored as typed",
               await con.fetchval("select name from operators where id=$1", drv_id) == "Miguel Ortiz")

            # ── T5 · BOTH resolvers agree he holds exactly `deliver` ─────────────────────────────
            m = await sup_session.resolve_membership(DRIVER)
            desk_caps = set(sup_session.ROLE_CAPS.get((m or {}).get("role") or "", frozenset()))
            ck("T5/db DESK resolver: repartidor row → caps == {deliver}",
               m and m["role"] == "repartidor" and m["tenant_slug"] == TEN_A
               and desk_caps == {"deliver"}, f"{(m or {}).get('role')} → {sorted(desk_caps)}")
            scope = await brain_auth.app_scope(_user(DRIVER))
            ck("T5/db PHONE resolver: the same row → caps == ['deliver'], same tenant",
               scope["caps"] == ["deliver"] and scope["role"] == "repartidor"
               and scope["tenant_slug"] == TEN_A, f"{scope['role']} → {scope['caps']} via {scope['via']}")
            s = await sup_session.session_for_user(_user(DRIVER), "1.2.3.4", "ua/1")
            ck("T5/db a real desk session mints AS a repartidor (nothing promotes him on the way in)",
               s.get("ok") and s.get("role") == "repartidor", f"role={s.get('role')}")
            ck("T5/db he satisfies no read/act/admin capability on either carrier",
               not any(sup_session.can("repartidor", c) for c in ("read", "act", "admin"))
               and not any(brain_auth.app_can("repartidor", c) for c in ("read", "act", "admin")))

            # ── T7 · the only door is Google ─────────────────────────────────────────────────────
            pw = await sup_session.session_for_user(_user(DRIVER, google=False), "1.2.3.4", "ua/1")
            ck("T7/db a PASSWORD identity for a real member is refused by the desk, typed",
               pw.get("ok") is not True and pw.get("error") == "oauth_required", str(pw)[:90])
            try:
                await brain_auth.app_scope(_user(DRIVER, google=False))
                _app_err = ""
            except brain_auth.AppScopeError as e:
                _app_err = e.code
            ck("T7/db …and by the phone, with the same typed code (one rule, two carriers)",
               _app_err == "oauth_required", _app_err or "(ACCEPTED!)")

            # ── T6 · adding him again is a ROLE CHANGE, not a second row ────────────────────────
            again = await teams.add(con, TEN_A, DRIVER.upper(), name="Miguel Ortiz", role="staff")
            n_rows = await con.fetchval("select count(*) from team_members where tenant_slug=$1 "
                                        "and operator_id=$2", TEN_A, drv_id)
            n_ops = await con.fetchval("select count(*) from operators where lower(email)=$1", DRIVER)
            ck("T6/db a second add of the same address says created:false and changes the role",
               again["created"] is False and again["member"]["role"] == "staff", str(again["member"]))
            ck("T6/db …and leaves ONE membership and ONE operator, whatever the casing",
               n_rows == 1 and n_ops == 1, f"memberships={n_rows} operators={n_ops}")
            back = await teams.set_role(con, TEN_A, drv_id, "repartidor")
            ck("T6/db set_role reports what the access WAS, so the audit can say it",
               back["was"] == "staff" and back["member"]["role"] == "repartidor", str(back["was"]))

            # ── T1/db · an unknown role never reaches the table ──────────────────────────────────
            before = await con.fetchval("select count(*) from team_members where tenant_slug=$1", TEN_A)
            bad_add = await araises(teams.add(con, TEN_A, "otro@vitalteam.test", role="conductor"))
            bad_set = await araises(teams.set_role(con, TEN_A, drv_id, "conductor"))
            after = await con.fetchval("select count(*) from team_members where tenant_slug=$1", TEN_A)
            ck("T1/db an unknown role is refused at the door and writes NOTHING",
               bad_add and not bad_add.startswith("__") and bad_set and not bad_set.startswith("__")
               and before == after, f"{bad_add[:70]} | rows {before}→{after}")
            ck("T1/db …and no operator row was minted for the refused invitation",
               await con.fetchval("select count(*) from operators where email=$1",
                                  "otro@vitalteam.test") == 0)

            # ── T8 · the last admin is protected ─────────────────────────────────────────────────
            jefe_id = jefe["member"]["operator_id"]
            demote = await araises(teams.set_role(con, TEN_A, jefe_id, "repartidor"))
            drop = await araises(teams.remove(con, TEN_A, jefe_id))
            ck("T8/db the ONLY owner can be neither demoted nor removed",
               all(m and not m.startswith("__") for m in (demote, drop)), demote[:110])
            ck("T8/db …and the refusal names the fix (promote somebody first)",
               "owner" in demote and "Ajustes" in demote)
            ck("T8/db he is still an owner after both refusals (a refusal writes nothing)",
               await con.fetchval("select role from team_members where operator_id=$1 and "
                                  "tenant_slug=$2", jefe_id, TEN_A) == "owner")
            seg = await teams.add(con, TEN_A, SEGUNDO, name="Ana", role="owner")
            ok_demote = await araises(teams.set_role(con, TEN_A, jefe_id, "staff"))
            ck("T8/db with a SECOND owner in place the demotion goes through",
               ok_demote == "", ok_demote[:110] or "demoted")
            last = await araises(teams.remove(con, TEN_A, seg["member"]["operator_id"]))
            ck("T8/db …and now SHE is the last admin, so she cannot be removed either",
               bool(last) and not last.startswith("__"), last[:110])

            # ── T9 · the Rocoto account is not managed from here ─────────────────────────────────
            await con.execute(
                "insert into operators (id, email, name, is_founder, seeded) "
                "values ('op_vitalteam_seed', $1, 'Rocoto', true, true) "
                "on conflict (id) do nothing", ROCOTO)
            await con.execute(
                "insert into team_members (operator_id, tenant_slug, role, seeded) "
                "values ('op_vitalteam_seed', $1, 'founder', true) on conflict do nothing", TEN_B)
            r_add = await araises(teams.add(con, TEN_B, ROCOTO, role="repartidor"))
            r_set = await araises(teams.set_role(con, TEN_B, "op_vitalteam_seed", "staff"))
            r_rm = await araises(teams.remove(con, TEN_B, "op_vitalteam_seed"))
            ck("T9/db all three verbs refuse the is_founder account",
               all(m and not m.startswith("__") for m in (r_add, r_set, r_rm)), r_rm[:110])
            ck("T9/db …because the seeder puts it back — the refusal SAYS so",
               "arranque" in r_rm, r_rm[:110])
            ck("T9/db its membership is untouched by the three refusals",
               await con.fetchval("select role from team_members where operator_id=$1 and "
                                  "tenant_slug=$2", "op_vitalteam_seed", TEN_B) == "founder")

            # ── T10 · tenant isolation ───────────────────────────────────────────────────────────
            jefe_b = await teams.add(con, TEN_B, JEFE_B, name="Bea", role="owner")
            b_id = jefe_b["member"]["operator_id"]
            x_set = await araises(teams.set_role(con, TEN_A, b_id, "repartidor"))
            x_rm = await araises(teams.remove(con, TEN_A, b_id))
            ck("T10/db another company's operator_id does not resolve from this tenant (404, never an edit)",
               x_set == "__LOOKUP__no_such_member" and x_rm == "__LOOKUP__no_such_member",
               f"{x_set} | {x_rm}")
            ck("T10/db …and his membership in his OWN company is intact",
               await con.fetchval("select role from team_members where operator_id=$1 and "
                                  "tenant_slug=$2", b_id, TEN_B) == "owner")
            ck("T10/db a tenant that does not exist is a LookupError, not an orphan row",
               await araises(teams.add(con, "vitalteam-nope", "x@vitalteam.test"))
               == "__LOOKUP__no_such_tenant")
            ck("T10/db …and it minted no operator on the way out",
               await con.fetchval("select count(*) from operators where email=$1",
                                  "x@vitalteam.test") == 0)

            # ── T11 · removing takes the membership, not the person ──────────────────────────────
            gone = await teams.remove(con, TEN_A, drv_id)
            ck("T11/db the membership is deleted",
               gone["ok"] and gone["removed"]["operator_id"] == drv_id
               and await con.fetchval("select count(*) from team_members where operator_id=$1",
                                      drv_id) == 0)
            ck("T11/db the OPERATOR row survives — a delivered_by signature must still name somebody",
               await con.fetchval("select email from operators where id=$1", drv_id) == DRIVER)
            ck("T11/db and the caller is handed the email, because the sessions must be revoked",
               gone.get("email") == DRIVER, str(gone.get("email")))
            ck("T11/db he resolves to nothing now — no team, no session",
               (await sup_session.resolve_membership(DRIVER)) is None)
        finally:
            await _cleanup(con)


async def _cleanup(con):
    # NOTE what is NOT deleted: `sup_audit`. It is append-only at the DB level (a trigger raises on
    # DELETE), which is the point of it — the record of who was granted access to a company outlives
    # the rows it was about, and a test does not get to erase it either.
    await con.execute("delete from sup_session where actor_email like '%@vitalteam.test'")
    await con.execute("delete from team_members where tenant_slug in ($1,$2)", TEN_A, TEN_B)
    await con.execute("delete from operators where lower(email) like '%@vitalteam.test'")
    await con.execute("delete from tenants where slug in ($1,$2)", TEN_A, TEN_B)


_dsn = os.environ.get("REHEARSAL_DSN")
if _dsn:
    for _k in ("DATABASE_URL", "RUNTIME_DATABASE_URL", "CONTROL_DATABASE_URL"):
        os.environ.setdefault(_k, _dsn)
    asyncio.run(_db_checks())
else:
    skip("T5–T11 the door itself", "no REHEARSAL_DSN (pure checks still ran)")

passed = sum(R)
print(f"vital_team: {passed}/{len(R)}" + (f" (+{len(SKIPPED)} skipped)" if SKIPPED else "")
      + (" — THE DOOR EXISTS, AND ONLY GOOGLE OPENS IT" if passed == len(R) else " — BROKEN"))
sys.exit(0 if passed == len(R) else 1)
