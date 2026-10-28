"""vital_demo_resume.py — a returning operator resumes their workspace, and is never asked to
upload a price list they already uploaded.

Carlos, 2026-08-17, mid-demo: he signed back in and /demo asked for his catalogue again. His 308
SKUs were in `catalogue_skus` under `xaviersitjar` the entire time, his operator row was linked,
and `active_tenant` was set. Nothing was lost and nothing was reaped.

THE DEFECT WAS A QUESTION ASKED OF THE WRONG ROW. `demo_sessions.catalog_ready` is keyed by TOKEN,
so it answers «did THIS browser session finish an upload». The app was using it for «does this
company have a catalogue». Those are the same thing only while /demo is an anonymous scratch world
— and they came apart the moment it started resuming a real tenant (§17.56c).

Proves, against the real schema:
  1. an authed session whose tenant holds SKUs reads catalog_ready TRUE even when its own row says
     false — the resume path;
  2. an authed session whose tenant holds NO SKUs still reads false — a first upload is still asked
     for, so a genuinely new operator is unaffected;
  3. an ANONYMOUS session never probes a tenant and never claims readiness it cannot have.

Usage:  REHEARSAL_DSN=… python tests/vital_demo_resume.py
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import db  # noqa: E402
import demo_flow  # noqa: E402

fails = []

def check(ok, label, detail=""):
    print(f"  {'ok  ' if ok else 'FAIL'}  {label}")
    if not ok:
        fails.append(label)
        if detail: print(f"        {detail}")

async def main() -> int:
    dsn = os.environ.get("REHEARSAL_DSN") or os.environ.get("DATABASE_URL") or ""
    if "rocoto" in dsn and "rehearsal" not in dsn and not os.environ.get("ALLOW_LIVE"):
        print("refusing to run against what looks like the live DB", file=sys.stderr); return 2
    await db.init()
    await demo_flow.ensure_demo_schema()
    pool = db.get_pool()
    slug = "vital_resume_tenant"
    tok_ready, tok_empty, tok_anon = "vr_tok_ready", "vr_tok_empty", "vr_tok_anon"
    async with pool.acquire() as con:
        await con.execute("delete from catalogue_skus where tenant_id=$1", slug)
        await con.execute("delete from demo_sessions where token = any($1::text[])",
                          [tok_ready, tok_empty, tok_anon])
        await con.execute("delete from tenants where slug=$1", slug)
        await con.execute("insert into tenants (slug, name, status) values ($1,$1,'test')", slug)
        # one SKU is enough: the probe asks EXISTS, never a count
        await con.execute(
            "insert into catalogue_skus (id, tenant_id, name) values ($1,$2,$3)",
            "vital-resume-sku", slug, "tomate pera")

    async def mk(token, tenant, email):
        async with pool.acquire() as con:
            await con.execute(
                "insert into demo_sessions (token, sid, tenant_slug, email, operator_email, catalog_ready) "
                "values ($1,$1,$2,$3,$3,false)", token, tenant, email)

    await mk(tok_ready, slug, "vr@example.com")
    await mk(tok_empty, slug + "_none", "vr2@example.com")
    await mk(tok_anon, None, None)
    async with pool.acquire() as con:
        await con.execute("insert into tenants (slug,name,status) values ($1,$1,'test') "
                          "on conflict do nothing", slug + "_none")

    print("1 · a workspace with a catalogue resumes")
    b = await demo_flow.session_view(tok_ready)
    check(b is not None and b["catalog_ready"] is True,
          "authed + tenant has SKUs → catalog_ready TRUE despite a false session row",
          f"got {b and b.get('catalog_ready')}")

    print("\n2 · a workspace with nothing still asks for the first upload")
    b2 = await demo_flow.session_view(tok_empty)
    check(b2 is not None and b2["catalog_ready"] is False,
          "authed + tenant has no SKUs → still false", f"got {b2 and b2.get('catalog_ready')}")

    print("\n3 · an anonymous session claims nothing")
    b3 = await demo_flow.session_view(tok_anon)
    check(b3 is None or b3["catalog_ready"] is False,
          "no tenant → false", f"got {b3 and b3.get('catalog_ready')}")

    async with pool.acquire() as con:
        await con.execute("delete from demo_sessions where token = any($1::text[])",
                          [tok_ready, tok_empty, tok_anon])
        await con.execute("delete from catalogue_skus where tenant_id=$1", slug)
        await con.execute("delete from tenants where slug = any($1::text[])", [slug, slug+"_none"])

    print()
    if fails:
        print(f"❌ vital_demo_resume: {len(fails)} failure(s)"); return 1
    print("✅ vital_demo_resume: a returning operator resumes; a new one still uploads")
    return 0

raise SystemExit(asyncio.run(main()))
