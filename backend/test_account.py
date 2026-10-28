"""test_account.py — THE FOUNDER VERB: mint a whole working account, end to end.

    python -m test_account create <email> [--name "Cárnicas Aldonza"] [--slug aldonza-3]
                                         [--role owner] [--no-seed] [--session]
    python -m test_account list
    python -m test_account drop <slug>

WHY THIS EXISTS (BUILD-PROMPT-WEB.md, «Test accounts»). Peter wants to create a BUNCH of these and
walk signup → alta → panel repeatedly, so **reset has to be cheap**. Clicking through Google OAuth
to get a session every time is not cheap, and worse, it makes the developer's loop depend on an
external service that has nothing to do with what is being built.

WHAT IT CREATES — the real rows the product itself reads, never a special dev path:
    operators           the person          (id 'op_<handle>', email, is_founder=false)
    tenants             the org             (slug, name, status='test')
    team_members        the membership      (operator × tenant × role — §17.41's account model)
    + a FRESH Cárnicas-Aldonza-seeded world for that tenant (brain.seed.reset_demo_seed)

`--session` additionally mints a REAL `sup_session` row via `sup_session.mint` and prints the cookie.
That is the same table, the same TTL, the same rotation and the same CSRF discipline the OAuth door
produces — the ONLY thing skipped is proving to Supabase who you are, which is exactly the part that
cannot run on a dev box. It is not a bypass in the product: `/api/sup/session/login` is untouched
and still demands a verified bearer.

SAFETY — three fences, because a verb that mints sessions is a verb that must never point at prod:
  1. refuses any DSN whose database is exactly `rocoto` (the live one), by name;
  2. `--session` additionally refuses unless ROCOTO_ALLOW_TEST_SESSION=1 is set;
  3. every row it writes is marked `seeded=true`, so `drop` can only ever eat its own.

THE RESET IS CHEAP AND IT IS BOUNDED. `drop <slug>` deletes exactly the tenant it made and the rows
that carry its slug — the §17.30q law («the reset can only eat its own»), which `vital_seedworld`
already guards with 180 checks for the demo world.
"""
from __future__ import annotations

import argparse
import asyncio
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import config  # noqa: E402
import db  # noqa: E402


def _die(msg: str) -> None:
    print(f"test_account: FATAL: {msg}", file=sys.stderr)
    raise SystemExit(2)


def _guard_not_prod() -> str:
    """Refuse the live database BY NAME — the same posture vital_cold_tenant.guard_clone() takes."""
    dsn = config.DATABASE_URL or ""
    dbname = re.sub(r"\?.*$", "", dsn.rsplit("/", 1)[-1]) if "/" in dsn else ""
    if dbname == "rocoto":
        _die("refusing to run against the LIVE database `rocoto`. Point DATABASE_URL at a clone "
             "(deploy/harness/rehearsal_env.sh, or the rocoto_devloop clone).")
    if not dbname:
        _die("could not read a database name out of DATABASE_URL")
    return dbname


def _handle(email: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", (email or "").strip().lower().split("@")[0]).strip("_")[:24] or "test"


def _slug_for(email: str, given: str | None) -> str:
    """ltree-safe by construction. The scope path carries the slug (`t.<slug>.wa.<digits>`), and
    while PG16 tolerates a hyphen in a label, a slug is minted ONCE and lives in URLs forever —
    so normalise here rather than discover the constraint later (A1-TENANT-SCOPE-CUTOVER §3b)."""
    raw = (given or f"test-{_handle(email)}").strip().lower()
    s = re.sub(r"[^a-z0-9_]+", "_", raw).strip("_")[:40]
    if not s:
        _die("could not derive a usable slug")
    # NOT a refusal. `_guard_not_prod()` has already proved this is a clone, and mirroring the
    # deployment tenant on a clone is the dev loop's normal case — today it is the ONLY case that
    # can see orders at all, because `owns_runtime` still fences the legacy runtime tables to
    # BRAIN_TENANT (that fence is what WP-A1 phase C retires). Refusing here would block the one
    # thing that works. Say it out loud instead.
    if s == config.BRAIN_TENANT:
        print(f"  note        slug '{s}' IS the deployment tenant — on a clone, that is the dev "
              f"loop mirroring prod.\n"
              f"              Other slugs get 403 on /orders until A1 retires owns_runtime.")
    return s


async def create(email: str, *, name: str, slug: str | None, role: str, seed_world: bool,
                 want_session: bool) -> None:
    dbname = _guard_not_prod()
    email = (email or "").strip().lower()
    if "@" not in email:
        _die("give a real email address — it is the identity the membership resolves on")
    if role not in ("owner", "staff", "repartidor"):
        _die("role must be owner | staff | repartidor (§17.34's three roles)")

    slug = _slug_for(email, slug)
    op_id = f"op_{_handle(email)}"

    await db.init()
    pool = db.get_pool()
    async with pool.acquire() as con, con.transaction():
        await con.execute(
            "insert into tenants(slug, name, status, seeded) values($1,$2,'test',true) "
            "on conflict (slug) do update set name=excluded.name, updated_at=now()",
            slug, name)
        await con.execute(
            "insert into operators(id, email, name, is_founder, active_tenant, seeded) "
            "values($1,$2,$3,false,$4,true) "
            "on conflict (id) do update set email=excluded.email, active_tenant=excluded.active_tenant, "
            "  updated_at=now()",
            op_id, email, _handle(email).replace("_", " ").title(), slug)
        await con.execute(
            "insert into team_members(operator_id, tenant_slug, role, seeded) values($1,$2,$3,true) "
            "on conflict (operator_id, tenant_slug) do update set role=excluded.role",
            op_id, slug, role)

    print(f"  db          {dbname}")
    print(f"  org         {name}  (slug: {slug})")
    print(f"  person      {email}  →  {op_id}")
    print(f"  membership  {role}")

    if seed_world:
        # `reset_demo_seed` refuses any tenant that is not DEMO_TENANT — «never "helpfully" falls
        # back, because the fallback is the failure» — and vital_seedworld holds that with 180
        # checks. So we do NOT weaken it. It already carries the seam for exactly this:
        #     DEMO_TENANT = os.environ.get("ROCOTO_DEMO_TENANT", "") or config.BRAIN_TENANT
        # Pointing that at the tenant we just minted is explicit, per-process, and leaves the guard
        # doing its real job (refusing to run against a world it was not aimed at). It must be set
        # BEFORE the import: DEMO_TENANT is read once, at module load.
        os.environ["ROCOTO_DEMO_TENANT"] = slug
        from brain import seed as _seed
        r = await _seed.reset_demo_seed(slug, strict=False)
        made = (r or {}).get("created", {}) if isinstance(r, dict) else {}
        print(f"  world       Cárnicas Aldonza — {made.get('contacts', 0)} clientes · "
              f"{made.get('orders', 0)} pedidos · {made.get('messages', 0)} mensajes")
    else:
        print("  world       (skipped: --no-seed) — the panel's empty states are what you will see")

    if want_session:
        if os.environ.get("ROCOTO_ALLOW_TEST_SESSION") != "1":
            print("\n  session     REFUSED — set ROCOTO_ALLOW_TEST_SESSION=1 to mint one.\n"
                  "              (A real sup_session cookie is a real key; it is opt-in on purpose.)")
        else:
            import sup_session
            s = await sup_session.mint(email, slug, role, "127.0.0.1", "test_account/dev-loop")
            print("\n  A REAL session row — same table, TTL, rotation and CSRF as the OAuth door.")
            print(f"  cookie      sup_session={s['raw']}")
            print(f"  csrf        {s['csrf']}")
            print("\n  Paste into the dev browser's console on http://127.0.0.1:5199 :")
            print(f"    document.cookie = 'sup_session={s['raw']}; path=/'")


async def do_list() -> None:
    _guard_not_prod()
    await db.init()
    pool = db.get_pool()
    async with pool.acquire() as con:
        rows = await con.fetch(
            "select t.slug, t.name, t.status, tm.role, o.email "
            "from tenants t left join team_members tm on tm.tenant_slug = t.slug "
            "left join operators o on o.id = tm.operator_id "
            "where t.seeded is true order by t.created_at desc")
    if not rows:
        print("  (no test accounts)")
        return
    for r in rows:
        print(f"  {r['slug']:<24} {r['name']:<30} {r['status']:<6} {r['role'] or '-':<11} {r['email'] or '-'}")


async def drop(slug: str) -> None:
    """Delete exactly what `create` made. §17.30q: the reset can only eat its own."""
    _guard_not_prod()
    if slug == config.BRAIN_TENANT:
        _die(f"refusing to drop the deployment tenant '{slug}'")
    await db.init()
    pool = db.get_pool()
    async with pool.acquire() as con:
        seeded = await con.fetchval("select seeded from tenants where slug=$1", slug)
        if seeded is None:
            _die(f"no such tenant '{slug}'")
        if not seeded:
            _die(f"tenant '{slug}' is NOT marked seeded — refusing to touch a real org")
        async with con.transaction():
            await con.execute("delete from sup_session where tenant_slug=$1", slug)
            await con.execute("delete from team_members where tenant_slug=$1", slug)
            await con.execute("delete from tenants      where slug=$1 and seeded is true", slug)
            await con.execute("update operators set active_tenant=null where active_tenant=$1", slug)
    print(f"  dropped {slug} (its seeded world is reclaimed by reset_demo_seed's own bookkeeping)")


def main() -> int:
    ap = argparse.ArgumentParser(prog="test_account", description=__doc__.split("\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)

    c = sub.add_parser("create", help="user + org + membership + a fresh seeded world")
    c.add_argument("email")
    c.add_argument("--name", default="Cárnicas Aldonza")
    c.add_argument("--slug", default=None)
    c.add_argument("--role", default="owner")
    c.add_argument("--no-seed", action="store_true", help="skip the demo world (see the empty states)")
    c.add_argument("--session", action="store_true", help="also mint a real sup_session cookie")

    sub.add_parser("list", help="every test account in this database")
    d = sub.add_parser("drop", help="delete a test account (seeded rows only)")
    d.add_argument("slug")

    a = ap.parse_args()
    if a.cmd == "create":
        asyncio.run(create(a.email, name=a.name, slug=a.slug, role=a.role,
                           seed_world=not a.no_seed, want_session=a.session))
    elif a.cmd == "list":
        asyncio.run(do_list())
    else:
        asyncio.run(drop(a.slug))
    return 0


if __name__ == "__main__":
    sys.exit(main())
