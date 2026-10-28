"""vital_demo_reap.py — THE RETENTION SWEEP DELETES TENANTS. THIS IS WHAT KEEPS IT HONEST.

soyrocoto.com/privacy.html and /datos-seguridad.html both state, live and in Spanish, «los datos de
una demo se conservan un máximo de 90 días si no llegamos a trabajar juntos». Two things can make
that sentence false, and they fail in opposite directions:

  · THE SWEEP REACHES NOTHING → the promise goes unperformed. This is what was actually true on
    2026-08-09: the reaper matched a `demo_`-prefixed slug that was also marked `seeded`, while the
    only thing that mints a demo tenant (`provisioning.provision`) derives the slug from the EMAIL
    and never sets `seeded`. Zero rows, forever. Prod held five orphan worlds and 76 orphan intake
    directories to prove it.
  · THE SWEEP REACHES TOO FAR → it deletes a paying customer's workspace. There is no undo.

So this vital builds a FIXTURE OF WORLDS that sit on both sides of every clause and asserts the
selection SLUG BY SLUG before anything is deleted, then runs the real `reap()` and asserts who
survived. The rule under test, in one line:

    a tenant that went through the demo and NEVER WENT LIVE is reapable;
    a tenant a real customer went live with is NEVER reapable, however it was created.

  ① THE DRY RUN IS THE SWEEP. `reap_preview()` and `reap()` call the SAME `_reapable_tenants`, and
    the selected set is asserted as an exact set — not a count, which is not checkable by a human
    about to press a delete button.
  ② EVERY REFUSAL, one world each: live status · golive_at · onboarded_at · a bound number · a
    bound wa_phone_number_id · a Stripe subscription · a live tenant_product · an open session ·
    an unexpired demo session · too young · minted by the ALTA door · seeded · BRAIN_TENANT.
  ③ THE DELETE. The reapable world goes — with its conversation, its uploaded price list, its
    intake bytes, its operator row and its magic links — and every survivor is still there,
    intact, with its catalogue untouched.
  ④ THE LEGACY RUNG still works (the five orphan `demo_*` worlds on prod are what it is for).
  ⑤ THE INTAKE PASSES reach what TODAY's code writes: an expired `catalogue_intake` row loses its
    row AND the directory `brain.onboarding.create_intake` actually creates, and an orphan
    directory that no row names is swept.
  ⑥ COMPLETENESS: the ordered scope-table list still covers every `scope ltree` table in the
    schema, so a new organ table cannot be quietly left behind in a world we said we deleted.

SAFETY: refuses anything but a rehearsal clone, and refuses to run if the fixture cannot be built.
Run on prod as root:  PYTHONPATH=. venv/bin/python tests/vital_demo_reap.py
"""
import asyncio
import os
import re
import secrets
import sys
import time
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

_DSN = os.environ.get("REHEARSAL_DSN")
if _DSN:
    for _k in ("DATABASE_URL", "RUNTIME_DATABASE_URL", "CONTROL_DATABASE_URL"):
        os.environ.setdefault(_k, _DSN)

for _l in Path("/opt/rocoto/.env").read_text().splitlines() if Path("/opt/rocoto/.env").exists() else []:
    _l = _l.strip()
    if _l and not _l.startswith("#") and "=" in _l:
        _k, _, _v = _l.partition("=")
        os.environ.setdefault(_k.strip(), _v.strip())

import config  # noqa: E402
import db  # noqa: E402
import demo_flow  # noqa: E402
import provisioning  # noqa: E402
import spine  # noqa: E402
import tenancy  # noqa: E402

R = []
STAMP = secrets.token_hex(3)
PFX = f"vitalreap{STAMP}"          # every world this vital makes starts with this


def ck(name, ok, detail=""):
    R.append(bool(ok))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


def guard_clone() -> None:
    """NEVER against production. THIS VITAL DELETES TENANTS."""
    dsn = config.DATABASE_URL or ""
    tail = dsn.rsplit("/", 1)[-1].split("?")[0]
    if tail == "rocoto" or "rehearsal" not in tail:
        print(f"REFUSED: DATABASE_URL is not a rehearsal clone (db={tail!r}). "
              "source deploy/harness/rehearsal_env.sh first.")
        sys.exit(2)


# ── THE FIXTURE ───────────────────────────────────────────────────────────────────────────────────
# name → (provisioned_via, seeded, age_days, extra column patch, note). One world per REASON, so a
# red line names the clause that broke rather than «the selection changed».
OLD = 200          # comfortably past both windows (14 legacy / 90 provisioned)
WORLDS: list[tuple[str, dict, str]] = [
    ("reapable",        {"via": "demo", "age": OLD},
     "the whole point: a demo world, old, cold, never live"),
    ("reapable2",       {"via": "demo", "age": OLD},
     "a second one, so ③ can prove the sweep is not single-shot"),
    ("young",           {"via": "demo", "age": 3},
     "inside the window"),
    ("wentlive",        {"via": "demo", "age": OLD, "patch": "status='live'"},
     "status flipped to live — we bill this one"),
    ("golive",          {"via": "demo", "age": OLD, "patch": "golive_at=now()"},
     "activated (§6's `live` box)"),
    ("onboarded",       {"via": "demo", "age": OLD, "patch": "onboarded_at=now()"},
     "the wizard ran — a person did real work in here"),
    ("numbered",        {"via": "demo", "age": OLD, "patch": "number='+34600111222'"},
     "a WhatsApp line is bound"),
    ("waid",            {"via": "demo", "age": OLD, "patch": "wa_phone_number_id='999000111'"},
     "…the other way a line is recorded"),
    ("alta",            {"via": "alta", "age": OLD},
     "minted by the PANEL door, not the demo"),
    ("legacyunmarked",  {"via": None, "age": OLD},
     "predates the marker — NULL is never reapable by the new rung"),
    ("seededworld",     {"via": "demo", "age": OLD, "seeded": True},
     "a seeded world is the deployment's"),
    ("subscribed",      {"via": "demo", "age": OLD, "subscription": True},
     "has a Stripe subscription row"),
    ("armedproduct",    {"via": "demo", "age": OLD, "product": True},
     "has a tenant_product past 'off'"),
    ("signedin",        {"via": "demo", "age": OLD, "session": True},
     "somebody holds a live panel session on it"),
    ("demosession",     {"via": "demo", "age": OLD, "demo_session": True},
     "an unexpired demo session still names it"),
]
LEGACY = f"demo_{PFX}legacy"       # the legacy rung matches a `demo_`-prefixed, seeded slug
EXPECTED = {f"{PFX}reapable", f"{PFX}reapable2", LEGACY}


async def _mk(con, name: str, spec: dict) -> str:
    """One world. THE DATES ARE SET LAST, on purpose: a `patch` that also moved `updated_at` would
    make its world unreapable for the AGE clause instead of for the clause the case is about, and
    the assertion would pass while proving nothing. Every refusal here must be non-vacuous."""
    slug = PFX + name
    await con.execute(
        "insert into tenants(slug,name,status,seeded,provisioned_via) values($1,$2,'test',$3,$4)",
        slug, f"Vital {name}", bool(spec.get("seeded")), spec.get("via"))
    if spec.get("patch"):
        await con.execute(f"update tenants set {spec['patch']} where slug=$1", slug)
    if spec.get("subscription"):
        await con.execute("insert into employee_subscriptions(tenant_id) values($1) "
                          "on conflict (tenant_id) do nothing", slug)
    if spec.get("product"):
        await con.execute("insert into tenant_product(tenant_id,product,state) "
                          "values($1,'pedidos','live') on conflict do nothing", slug)
    if spec.get("session"):
        await con.execute(
            "insert into sup_session(session_id,secret_hash,actor_email,tenant_slug,role,"
            "csrf_token,expires_at) values($1,'x',$2,$3,'owner','x', now() + interval '1 day')",
            f"s_{slug}", f"{slug}@vital.es", slug)
    if spec.get("demo_session"):
        await con.execute(
            "insert into demo_sessions(token,sid,operator_email,tenant_slug,expires_at) "
            "values($1,$2,$3,$4, now() + interval '1 day')",
            f"tok_{slug}", f"sid{slug}", f"{slug}@vital.es", slug)
    await con.execute(
        "update tenants set created_at = now() - ($2 || ' days')::interval, "
        "                   updated_at = now() - ($2 || ' days')::interval where slug = $1",
        slug, str(int(spec.get("age", 0))))
    return slug


async def _cleanup(con) -> None:
    slugs = [r["slug"] for r in await con.fetch(
        "select slug from tenants where slug like $1 or slug like $2",
        PFX + "%", f"demo_{PFX}%")]
    for t in ("sup_session", "demo_sessions", "team_members"):
        await con.execute(f"delete from {t} where tenant_slug = any($1::text[])", slugs or [""])
    for t in ("employee_subscriptions", "tenant_product", "catalogue_skus", "sku_aliases",
              "catalogue_directory", "catalogue_intake"):
        try:
            await con.execute(f"delete from {t} where tenant_id = any($1::text[])", slugs or [""])
        except Exception:
            pass
    await con.execute("delete from operators where email like $1", f"%@{PFX}.es")
    await con.execute("delete from tenants where slug like $1 or slug like $2",
                      PFX + "%", f"demo_{PFX}%")


async def main():
    guard_clone()
    print("VITAL: demo reap (the retention sweep — it deletes tenants)")
    await db.init()
    async with db.get_pool().acquire() as con:
        dbname = await con.fetchval("select current_database()")
    if dbname == "rocoto":
        raise SystemExit("REFUSING to run vitals against the LIVE 'rocoto' DB")
    print(f"  (db={dbname})")
    await demo_flow.ensure_demo_schema()
    from brain import onboarding as ob
    await ob.ensure_intake_schema()

    # ⚠️ THIS VITAL GETS ITS OWN MEDIA DIRECTORY, and the reason is the hazard it exists to test.
    # `MEDIA_DIR` belongs to the BOX; `catalogue_intake` belongs to the DATABASE. Run the orphan
    # pass against a clone (whose intake table is empty by construction) with the LIVE media dir in
    # place and every production intake on disk answers «no row names me». `demo_flow` now refuses
    # that combination on its own (`_orphan_pass_sound`) — this is the second fence, so the vital is
    # safe even if somebody loosens the first, and so ⑤ can actually exercise the orphan sweep.
    real_intake_dir = ob._INTAKE_DIR
    ob._INTAKE_DIR = Path(f"/tmp/vital_reap_{STAMP}/intake")
    ob._INTAKE_DIR.mkdir(parents=True, exist_ok=True)
    ck("setup: this run has its OWN intake directory (never the box's)",
       str(ob._INTAKE_DIR) != str(real_intake_dir), str(ob._INTAKE_DIR))

    async with db.get_pool().acquire() as con:
        await _cleanup(con)
        for name, spec, _why in WORLDS:
            await _mk(con, name, spec)
        # ④ the LEGACY anonymous rung: `demo_<sid>`, seeded, no demo_sessions row
        await con.execute(
            "insert into tenants(slug,name,status,seeded,created_at) "
            "values($1,'Vital legacy','test',true, now() - interval '200 days')", LEGACY)
        # …and its counterpart that a LIVE demo session still names — right(slug,-5) is the sid
        await con.execute(
            "insert into tenants(slug,name,status,seeded,created_at) "
            "values($1,'Vital legacy live','test',true, now() - interval '200 days')",
            f"demo_{PFX}held")
        await con.execute(
            "insert into demo_sessions(token,sid,operator_email,tenant_slug,expires_at) "
            "values($1,$2,$3,$4, now() + interval '1 day')",
            f"tok_held_{STAMP}", f"{PFX}held", f"held@{PFX}.es", f"{PFX}held")

    # THE REAPABLE WORLD GETS A REAL LIFE: a conversation, a catalogue, an intake with bytes on
    # disk, an operator and a magic link. ③ is only meaningful if there is something to lose.
    reap_slug = f"{PFX}reapable"
    scope = tenancy.demo_scope("sid" + STAMP, reap_slug)
    async with db.scoped_tx(scope) as con:
        await con.execute("insert into scope_node(scope,tier,tenant_slug,lineage) "
                          "values($1::ltree,'customer',$2,'test') on conflict do nothing",
                          scope, reap_slug)
        await con.execute("insert into card(scope,body,version,lineage) "
                          "values($1::ltree,'FICHA',0,'test') on conflict do nothing", scope)
        eid, _ = await spine.append_event(con, scope, "message", "vital",
                                          {"text": "3 kg de chorizo para el viernes"})
        await con.execute(
            "insert into open_loop(scope,kind,text,opened_by_event) "
            "values($1::ltree,'pedido','confirmar',$2)", scope, eid)
    async with db.get_pool().acquire() as con:
        await con.execute(
            "insert into catalogue_skus(id,tenant_id,code,name,price) "
            "values($1,$2,'X-1','Chorizo',9.5) on conflict do nothing",
            f"sku_{PFX}", reap_slug)
        op = f"op_{PFX}"
        await con.execute(
            "insert into operators(id,email,name,active_tenant) values($1,$2,'V',$3)",
            op, f"visitor@{PFX}.es", reap_slug)
        await con.execute(
            "insert into team_members(operator_id,tenant_slug,role) values($1,$2,'owner')",
            op, reap_slug)
    mk = await ob.create_intake(reap_slug, f"visitor@{PFX}.es", source_kind="paste",
                                source_name="tarifa", text="chorizo 9,50")
    intake_id = str(mk.get("id") or "")
    intake_dir = ob._INTAKE_DIR / intake_id
    ck("setup: the reapable world has an intake with bytes on disk",
       bool(mk.get("ok")) and intake_dir.is_dir(), str(mk)[:100])

    # ══ ① THE SELECTION, SLUG BY SLUG, BEFORE ANYTHING IS DELETED ════════════════════════════════
    print("\n① the dry run IS the sweep")
    async with db.get_pool().acquire() as con:
        picked = await demo_flow._reapable_tenants(con, limit=500)
    mine = {w["slug"] for w in picked
            if w["slug"].startswith(PFX) or w["slug"].startswith(f"demo_{PFX}")}
    ck("the selection is EXACTLY the worlds that should go", mine == EXPECTED,
       f"selected={sorted(mine)}  expected={sorted(EXPECTED)}  "
       f"extra={sorted(mine - EXPECTED)}  missing={sorted(EXPECTED - mine)}")
    rungs = {w["slug"]: w["rung"] for w in picked}
    ck("…and each one says WHY it was chosen",
       rungs.get(f"{PFX}reapable") == "provisioned_demo"
       and rungs.get(LEGACY) == "legacy_anonymous", str(rungs)[:160])
    ck("the deployment's own tenant is never in the set, whatever any column says",
       config.BRAIN_TENANT not in rungs, config.BRAIN_TENANT)

    preview = await demo_flow.reap_preview()
    pv = {w.split(" ")[0] for w in preview.get("worlds", [])
          if w.startswith(PFX) or w.startswith(f"demo_{PFX}")}
    ck("reap_preview() names the SAME worlds (one selection, two consumers)", pv == mine,
       f"preview={sorted(pv)}")
    ck("…and a human can read them: the dry run lists slugs, not a bare count",
       isinstance(preview.get("worlds"), list) and preview["tenants"] >= len(mine),
       str(preview.get("worlds"))[:120])

    # ══ ② EVERY REFUSAL, NAMED ═══════════════════════════════════════════════════════════════════
    print("\n② every refusal, one world each")
    for name, spec, why in WORLDS:
        slug = PFX + name
        should_go = slug in EXPECTED
        got = slug in mine
        ck(f"{'REAPED' if should_go else 'kept':>6}: {name} — {why}", got == should_go,
           "" if got == should_go else f"selected={got}")

    # ══ ③ THE DELETE ═════════════════════════════════════════════════════════════════════════════
    print("\n③ the sweep runs for real")
    out = await demo_flow.reap(sweep_orphans=False)
    ck("reap() reports the worlds it took", int(out.get("tenants", 0)) >= len(EXPECTED),
       str(out))
    async with db.get_pool().acquire() as con:
        left = {r["slug"] for r in await con.fetch(
            "select slug from tenants where slug like $1 or slug like $2",
            PFX + "%", f"demo_{PFX}%")}
        survivors = ({PFX + n for n, _s, _w in WORLDS} | {f"demo_{PFX}held"}) - EXPECTED
        ck("every world that should have gone IS GONE", not (EXPECTED & left),
           f"still here: {sorted(EXPECTED & left)}")
        ck("every world that should have survived IS STILL HERE", survivors <= left,
           f"lost: {sorted(survivors - left)}")
        ck("④ the legacy anonymous world went, and the one a live session names did NOT",
           LEGACY not in left and bool(await con.fetchval(
               "select 1 from tenants where slug=$1", f"demo_{PFX}held")))
        # the reaped world's DATA, not just its row
        n_sku = await con.fetchval(
            "select count(*) from catalogue_skus where tenant_id=$1", reap_slug)
        n_op = await con.fetchval(
            "select count(*) from operators where email=$1", f"visitor@{PFX}.es")
        n_tm = await con.fetchval(
            "select count(*) from team_members where tenant_slug=$1", reap_slug)
        n_intake = await con.fetchval(
            "select count(*) from catalogue_intake where tenant_id=$1", reap_slug)
        # a survivor's catalogue must be untouched — the sweep may not graze
        n_alive = await con.fetchval(
            "select count(*) from tenants where slug=$1", f"{PFX}wentlive")
    # ⚠️ READ THE RUNTIME TABLES THROUGH `scoped_tx`, NEVER THE OWNER POOL. `event`, `open_loop`,
    # `card` and friends are ENABLE + FORCE row level security and the `rocoto` owner does NOT carry
    # BYPASSRLS — so an owner-pool `select count(*)` on them returns 0 whether or not anything was
    # deleted. This assertion read that way once and passed while the delete it was checking had
    # matched zero rows. Measured, both directions, before this line was rewritten.
    async with db.scoped_tx(f"test.demo.t.{reap_slug}") as sc:
        n_ev = await sc.fetchval(
            "select count(*) from event where scope <@ $1::ltree", f"test.demo.t.{reap_slug}")
        n_loop = await sc.fetchval(
            "select count(*) from open_loop where scope <@ $1::ltree", f"test.demo.t.{reap_slug}")
        n_card = await sc.fetchval(
            "select count(*) from card where scope <@ $1::ltree", f"test.demo.t.{reap_slug}")
        n_node = await sc.fetchval(
            "select count(*) from scope_node where scope <@ $1::ltree", f"test.demo.t.{reap_slug}")
    ck("…its uploaded price list went with it", int(n_sku or 0) == 0, str(n_sku))
    ck("…its conversation went with it — read back through the RLS role that can actually SEE it "
       "(events · the open tab · the ficha · the scope itself)",
       int(n_ev or 0) == 0 and int(n_loop or 0) == 0 and int(n_card or 0) == 0
       and int(n_node or 0) == 0,
       f"events={n_ev} loops={n_loop} cards={n_card} nodes={n_node}")
    ck("…its intake row went with it", int(n_intake or 0) == 0, str(n_intake))
    ck("…and the intake BYTES on disk", not intake_dir.is_dir(), str(intake_dir))
    ck("…its operator row (the email — the thing the promise is most obviously about)",
       int(n_op or 0) == 0, str(n_op))
    ck("…and its membership", int(n_tm or 0) == 0, str(n_tm))
    ck("the live world is still there", int(n_alive or 0) == 1, str(n_alive))

    # a second pass must be a no-op — the sweep is idempotent and must never find work twice
    again = await demo_flow.reap(sweep_orphans=False)
    async with db.get_pool().acquire() as con:
        still = {r["slug"] for r in await con.fetch(
            "select slug from tenants where slug like $1 or slug like $2",
            PFX + "%", f"demo_{PFX}%")}
    ck("running it twice takes nothing more (idempotent)", still == left, str(sorted(still - left)))

    # ══ ⑤ THE INTAKE PASSES REACH WHAT TODAY'S CODE WRITES ═══════════════════════════════════════
    print("\n⑤ the intake byte + orphan passes")
    keep_slug = f"{PFX}wentlive"
    mk2 = await ob.create_intake(keep_slug, f"x@{PFX}.es", source_kind="paste",
                                 source_name="tarifa2", text="queso 12,00")
    iid2 = str(mk2.get("id") or "")
    dir2 = ob._INTAKE_DIR / iid2
    ck("an intake writes its bytes under MEDIA_DIR/intake/<id>/ (what the reaper walks)",
       dir2.is_dir() and any(dir2.iterdir()), str(dir2))
    async with db.get_pool().acquire() as con:
        row = await con.fetchrow(
            "select raw_ref, expires_at from catalogue_intake where id=$1", iid2)
    ck("…with an expires_at set (the row pass reads exactly this column)",
       row is not None and row["expires_at"] is not None, str(row and row["expires_at"]))
    ck("…and raw_ref pointing INSIDE that directory (the unlink guard's precondition)",
       row is not None and Path(str(row["raw_ref"])).resolve().parent == dir2.resolve(),
       str(row and row["raw_ref"]))
    async with db.get_pool().acquire() as con:
        await con.execute("update catalogue_intake set expires_at = now() - interval '1 day' "
                          "where id=$1", iid2)
    await demo_flow.reap(sweep_orphans=False)
    async with db.get_pool().acquire() as con:
        gone = await con.fetchval("select count(*) from catalogue_intake where id=$1", iid2)
    ck("an EXPIRED intake loses its row…", int(gone or 0) == 0, str(gone))
    ck("…and its bytes", not dir2.is_dir(), str(dir2))

    orphan = ob._INTAKE_DIR / f"ing_orphan_{STAMP}"
    orphan.mkdir(parents=True, exist_ok=True)
    (orphan / "tarifa.csv").write_text("chorizo,9.5\n", encoding="utf-8")
    old = time.time() - (int(ob.INTAKE_TTL_DAYS) + 2) * 86400
    os.utime(orphan, (old, old))
    ck("setup: an orphan directory no row names, older than the TTL", orphan.is_dir())

    # THE GUARD FIRST, AND AS A PURE READ. `_orphan_pass_sound` is asked directly, with `_INTAKE_DIR`
    # pointed at the BOX's real directory, because the only honest way to prove «it would refuse» is
    # to ask it — driving `reap(sweep_orphans=True)` at the live media dir to see whether it deletes
    # production's bytes is a test whose failure mode is destroying production's bytes. Never write
    # that test.
    async with db.get_pool().acquire() as con:
        ours = ob._INTAKE_DIR
        ob._INTAKE_DIR = real_intake_dir
        try:
            refuses = await demo_flow._orphan_pass_sound(con)
        finally:
            ob._INTAKE_DIR = ours
        allows_here = await demo_flow._orphan_pass_sound(con)
    ck("the orphan pass REFUSES the dangerous pair — somebody else's DATABASE, the box's BYTES",
       refuses is False, str(refuses))
    ck("…and ALLOWS a directory that is not the box's (this run's own), which is the only reason "
       "⑤ can exercise the sweep at all", allows_here is True, str(allows_here))

    # the sweep itself, over this run's own directory
    await demo_flow.reap(sweep_orphans=True)
    ck("the orphan pass reaches an orphan (this is the 76 directories measured on prod)",
       not orphan.is_dir(), str(orphan))

    # …and the third case: the box's own database, which is what the systemd unit actually runs as.
    fake_env = Path(f"/tmp/vital_reap_{STAMP}/env")
    fake_env.write_text(f"DATABASE_URL={config.DATABASE_URL}\n", encoding="utf-8")
    os.environ["ROCOTO_ENV_FILE"] = str(fake_env)
    try:
        async with db.get_pool().acquire() as con:
            ob._INTAKE_DIR, ours = real_intake_dir, ob._INTAKE_DIR
            try:
                unit_case = await demo_flow._orphan_pass_sound(con)
            finally:
                ob._INTAKE_DIR = ours
    finally:
        os.environ.pop("ROCOTO_ENV_FILE", None)
    ck("…and ALLOWS the systemd unit's case: this database IS the box's, so its MEDIA_DIR is ours",
       unit_case is True, str(unit_case))

    # ══ ⑥ COMPLETENESS ═══════════════════════════════════════════════════════════════════════════
    print("\n⑥ the world-delete still covers the schema")
    sql = Path(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                            "schema_runtime.sql")).read_text()
    scope_tables = set()
    for m in re.finditer(r"create table if not exists (\w+)\s*\((.*?)\n\);", sql, re.S):
        if re.search(r"^\s*scope\s+ltree", m.group(2), re.M):
            scope_tables.add(m.group(1))
    covered = (set(demo_flow._DEMO_SCOPE_TABLES_ORDERED) | {"contact", "scope_node"})
    missing = scope_tables - covered
    ck("every `scope ltree` table in the schema is in the ordered delete list",
       not missing, f"NOT covered: {sorted(missing)}")
    ck("…and the list names nothing that does not exist",
       not (covered - scope_tables), f"phantom: {sorted(covered - scope_tables)}")
    ck("`event` is deleted AFTER everything that references it (FK order is load-bearing)",
       all(demo_flow._DEMO_SCOPE_TABLES_ORDERED.index(t)
           < demo_flow._DEMO_SCOPE_TABLES_ORDERED.index("event")
           for t in ("timer", "action", "open_loop")))

    # WHICH CONNECTION MAY DELETE WHAT. A table under FORCE RLS cannot be deleted from the owner
    # pool (the `rocoto` role has no BYPASSRLS, on purpose) — the DELETE reports success and matches
    # zero rows. So `_RLS_FENCED` must stay equal to schema_rls.sql's own array: a table that gains
    # a policy later and stays on the owner path goes silently back to deleting nothing.
    rls_sql = Path(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                                "schema_rls.sql")).read_text()
    m = re.search(r"tables text\[\] := array\[(.*?)\]", rls_sql, re.S)
    declared = set(re.findall(r"'([a-z_]+)'", m.group(1))) if m else set()
    ck("`_RLS_FENCED` still equals the FORCE-RLS table list in schema_rls.sql",
       declared and declared == set(demo_flow._RLS_FENCED),
       f"only in schema: {sorted(declared - set(demo_flow._RLS_FENCED))}  "
       f"only in code: {sorted(set(demo_flow._RLS_FENCED) - declared)}")
    async with db.get_pool().acquire() as con:
        forced = {r["relname"] for r in await con.fetch(
            "select relname from pg_class where relkind='r' and relforcerowsecurity")}
    ck("…and equals what the DATABASE actually enforces on this clone",
       not (forced - set(demo_flow._RLS_FENCED)),
       f"forced but not fenced in code: {sorted(forced - set(demo_flow._RLS_FENCED))}")

    # the marker itself: the door writes it, which is the whole discriminator
    print("\n⑦ the marker is written by the door")
    async with db.get_pool().acquire() as con:
        await con.execute("delete from tenants where slug like $1", f"{PFX}door%")
        got = await provisioning.provision(con, f"doorcheck.{STAMP}@{PFX}.es",
                                           company="Vital Door SL",
                                           via=provisioning.VIA_DEMO)
        via = await con.fetchval("select provisioned_via from tenants where slug=$1", got["slug"])
        ck("provisioning.provision(via='demo') marks the tenant", via == "demo", str(via))
        got2 = await provisioning.provision(con, f"altacheck.{STAMP}@{PFX}.es",
                                            via=provisioning.VIA_ALTA)
        via2 = await con.fetchval("select provisioned_via from tenants where slug=$1", got2["slug"])
        ck("…and the alta door marks its own", via2 == "alta", str(via2))
        for g in (got, got2):
            await con.execute("delete from team_members where tenant_slug=$1", g["slug"])
            await con.execute("delete from tenants where slug=$1", g["slug"])
        await con.execute("delete from operators where email like $1", f"%@{PFX}.es")

    async with db.get_pool().acquire() as con:
        await con.execute("delete from demo_sessions where tenant_slug like $1", PFX + "%")
        await con.execute("delete from tenants where slug like $1", f"demo_{PFX}%")
        await _cleanup(con)
    import shutil as _sh
    _sh.rmtree(f"/tmp/vital_reap_{STAMP}", ignore_errors=True)
    ob._INTAKE_DIR = real_intake_dir

    print(f"\nvital_demo_reap: {sum(R)}/{len(R)} green")
    if not all(R):
        raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())
