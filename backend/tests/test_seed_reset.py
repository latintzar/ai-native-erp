"""Gate: clear_all_seeded purges Rocoto AND Medusa metadata.seeded → true empty-state; re-seed works.

Rocoto-side is always asserted. The Medusa purge requires an explicitly configured disposable
service, database and source checkout; its catalogue is re-imported afterwards.
"""
import asyncio
import os
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gatelib  # noqa: E402

gatelib.setup_env()
import config  # noqa: E402
from brain import medusa_client, seed  # noqa: E402


async def _sancho_side():
    pool = await gatelib.prepare()
    async with pool.acquire() as con:
        # seeded + live rows across the new tables
        await con.execute("delete from orders where id like 'gsr_%'")
        await con.execute("delete from medusa_sync where sancho_order_id like 'gsr_%'")
        await con.execute("delete from accept_rules where id like 'acr_gsr%'")
        await con.execute("delete from agent_recommendations where id like 'rec_gsr%'")
        await con.execute("insert into orders (id,phone_number,status,lines,seeded) values ('gsr_s','+34611',  'approved','[]'::jsonb,true)")
        await con.execute("insert into orders (id,phone_number,status,lines,seeded) values ('gsr_live','+34612','approved','[]'::jsonb,false)")
        await con.execute("insert into medusa_sync (tenant_id,sancho_order_id,sancho_seq,op,idem_key,seeded) values ('sancho','gsr_s',1,'create_order','gsr_s:1:create_order',true)")
        await con.execute("insert into accept_rules (id,tenant_id,kind,pattern,created_from,seeded) values ('acr_gsr','sancho','asap','{}'::jsonb,'seed',true)")
        await con.execute("insert into agent_recommendations (id,tenant_id,agent_id,task_key,kind,dedupe_key,seeded) values ('rec_gsr','sancho','ecom','t','asap','gsr',true)")
    # sync OFF so the local purge doesn't touch the live Medusa catalogue here
    sync_was = config.MEDUSA_SYNC_ENABLED
    config.MEDUSA_SYNC_ENABLED = False
    try:
        await seed.clear_all_seeded()
    finally:
        config.MEDUSA_SYNC_ENABLED = sync_was
    async with pool.acquire() as con:
        assert await con.fetchval("select count(*) from orders where id='gsr_s'") == 0, "seeded order survived"
        assert await con.fetchval("select count(*) from orders where id='gsr_live'") == 1, "live order purged!"
        assert await con.fetchval("select count(*) from medusa_sync where sancho_order_id='gsr_s'") == 0
        assert await con.fetchval("select count(*) from accept_rules where id='acr_gsr'") == 0
        assert await con.fetchval("select count(*) from agent_recommendations where id='rec_gsr'") == 0
        await con.execute("delete from orders where id like 'gsr_%'")
    print("test_seed_reset[sancho]: seeded rows purged, live survive GREEN")


async def _medusa_side():
    if not gatelib.medusa_up():
        print("test_seed_reset[medusa]: SKIP (disposable Medusa unconfigured or unavailable)")
        return
    source_dir = os.environ.get("MEDUSA_TEST_SOURCE_DIR", "")
    test_dsn = os.environ.get("MEDUSA_TEST_DATABASE_URL", "")
    if not source_dir or not test_dsn:
        raise RuntimeError("Seed reset needs MEDUSA_TEST_SOURCE_DIR and MEDUSA_TEST_DATABASE_URL")
    source_root = Path(source_dir).expanduser().resolve()
    seed_script = source_root / "src/scripts/import-seed-catalogue.ts"
    if not seed_script.is_file():
        raise RuntimeError("MEDUSA_TEST_SOURCE_DIR must contain src/scripts/import-seed-catalogue.ts")
    medusa_cli = source_root / "node_modules/.bin/medusa"
    if not medusa_cli.is_file() or not os.access(medusa_cli, os.X_OK):
        raise RuntimeError("MEDUSA_TEST_SOURCE_DIR needs an executable node_modules/.bin/medusa")
    config.MEDUSA_SYNC_ENABLED = True
    medusa_client._client = None
    c = medusa_client.get_client()
    from brain import medusa_map
    o = {"id": "gsr_med1", "phone_number": "+34611555000", "customer_name": "Reset Bar", "seeded": True,
         "lines": [{"item": "Reset item", "qty": 1, "price": 5.0}]}
    r = await c.create_order(medusa_map.build_create_order_payload(o))
    assert r.get("id")
    purged = await c.purge_seeded()
    assert (purged.get("orders", 0) >= 1), ("seeded orders purged", purged)
    assert await c.find_order("gsr_med1") is None, "seeded Medusa order survived purge"
    await c.aclose()
    print("test_seed_reset[medusa]: seeded order + products purged %s GREEN" % purged)
    subprocess.run([str(medusa_cli), "exec", "./src/scripts/import-seed-catalogue.ts"],
                   cwd=source_root, env={**os.environ, "DATABASE_URL": test_dsn},
                   check=True, capture_output=True, text=True, timeout=240)
    import asyncpg
    con = await asyncpg.connect(test_dsn)
    try:
        n = await con.fetchval("select count(*) from product where metadata->>'seeded'='true'")
    finally:
        await con.close()
    assert n > 0, "Medusa catalogue re-import left no seeded products"
    print("test_seed_reset[medusa]: catalogue re-imported (%d seeded products)" % n)


async def main():
    await _sancho_side()
    await _medusa_side()


def test_seed_reset():
    asyncio.run(main())


if __name__ == "__main__":
    asyncio.run(main())
