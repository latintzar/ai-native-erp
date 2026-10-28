"""Gate: scheduled jobs → recommendations → accept → behaviour change; watermark; advisory-lock."""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gatelib  # noqa: E402

gatelib.setup_env()
from brain import tasks as T  # noqa: E402

SKU = "sku-gtskham"


async def _seed_orders(con, n, status, phone, sku, base_qty, note=None):
    for i in range(n):
        ln = {"sku_id": sku, "item": "Gate Ham", "family": "sausages", "qty": base_qty + i, "price": 10.0}
        if note:
            ln["note"] = note
        await con.execute(
            """insert into orders (id,phone_number,customer_name,status,lines,seeded,created_at)
                 values ($1,$2,'Gate Bar',$3,$4,false, now())
               on conflict (id) do update set lines=excluded.lines, status=excluded.status""",
            f"gtsk_{status}_{phone[-3:]}_{i}", phone, status, [ln])


async def main():
    pool = await gatelib.prepare()
    async with pool.acquire() as con:
        await con.execute("delete from orders where id like 'gtsk_%'")
        await con.execute("delete from agent_recommendations where dedupe_key like '%gtsk%' or dedupe_key like 'asap:sku-gtsk%' or dedupe_key like 'autoaccept:sku-gtsk%'")
        await con.execute("delete from accept_rules where created_from not in ('manual','seed')")
        await con.execute("delete from catalogue_skus where id='sku-gtsklomo'")  # fresh customizations
        # reset watermarks so the jobs scan our fresh rows
        await con.execute("update agent_tasks set watermark='{\"cursor_ts\":\"1970-01-01T00:00:00+00:00\"}'")

    # ── ecom.asap_patterns: 3 approved orders same SKU → an asap recommendation ──
    async with pool.acquire() as con:
        await _seed_orders(con, 3, "approved", "+34611900001", SKU, 100)
    res = await T.run_task("ecom.asap_patterns", force=True)
    assert res["status"] == "ok" and res["produced"] >= 1, res
    assert res["scanned"] >= 3, res
    recs = await T.list_recommendations("ecom")
    rec = next(r for r in recs if r["dedupe_key"] == f"asap:{SKU}")
    assert rec["payload"]["pattern"]["skus"] == [SKU]

    # accept → an accept_rules row exists (the deterministic envelope)
    out = await T.accept_recommendation(rec["id"])
    rule_id = out["result"]["accept_rule_id"]
    async with pool.acquire() as con:
        assert await con.fetchval("select count(*) from accept_rules where id=$1", rule_id) == 1
    # idempotent re-accept → same result, no second rule
    out2 = await T.accept_recommendation(rec["id"])
    assert out2.get("idempotent") is True, out2

    # ── watermark advanced: a second run with no new orders → produced 0 ──
    res2 = await T.run_task("ecom.asap_patterns", force=True)
    assert res2["status"] == "ok" and res2["produced"] == 0, ("watermark", res2)

    # ── last_result always written ──
    async with pool.acquire() as con:
        lr = await con.fetchval("select last_result from agent_tasks where task_key='ecom.asap_patterns'")
    assert lr and lr.get("status") == "ok", lr

    # ── advisory lock: hold it externally → run_task is skipped/locked ──
    async with pool.acquire() as hold:
        got = await hold.fetchval("select pg_try_advisory_lock(hashtext($1)::bigint)",
                                  "task:sancho:ecom.asap_patterns")
        assert got
        try:
            res3 = await T.run_task("ecom.asap_patterns", force=True)
            assert res3.get("reason") == "locked", ("should be locked", res3)
        finally:
            await hold.execute("select pg_advisory_unlock(hashtext($1)::bigint)",
                               "task:sancho:ecom.asap_patterns")

    # ── delivery.consolidation: 2 orders same phone → a consolidation rec ──
    async with pool.acquire() as con:
        await con.execute("update agent_tasks set watermark='{\"cursor_ts\":\"1970-01-01T00:00:00+00:00\"}' where task_key='delivery.consolidation'")
        await _seed_orders(con, 2, "approved", "+34611900002", SKU, 20)
    resc = await T.run_task("delivery.consolidation", force=True)
    assert resc["produced"] >= 1, resc
    crecs = await T.list_recommendations("deliveries")
    assert any(r["dedupe_key"] == "consol:+34611900002" for r in crecs)

    # ── ecom.standardize_customizations: 3 orders same note → customization rec; accept → SKU option ──
    async with pool.acquire() as con:
        await con.execute("update agent_tasks set watermark='{\"cursor_ts\":\"1970-01-01T00:00:00+00:00\"}' where task_key='ecom.standardize_customizations'")
        await _seed_orders(con, 3, "approved", "+34611900003", "sku-gtsklomo", 5, note="vac-pack 200g")
    resx = await T.run_task("ecom.standardize_customizations", force=True)
    assert resx["produced"] >= 1, resx
    xrecs = await T.list_recommendations("ecom")
    xrec = next(r for r in xrecs if r["dedupe_key"].startswith("cust:sku-gtsklomo"))
    # need the SKU row to observe the option append
    async with pool.acquire() as con:
        await con.execute("insert into catalogue_skus (id,tenant_id,name) values ('sku-gtsklomo','sancho','Gate Lomo') on conflict (id) do nothing")
    outx = await T.accept_recommendation(xrec["id"])
    assert outx["result"].get("accept_rule_id")
    async with pool.acquire() as con:
        cust = await con.fetchval("select customizations from catalogue_skus where id='sku-gtsklomo'")
        rule = await con.fetchval("select count(*) from accept_rules where kind='customization' and id=$1", outx["result"]["accept_rule_id"])
    assert rule == 1 and any((c or {}).get("value") == "vac-pack 200g" for c in (cust or [])), (cust, rule)

    print("test_scheduled_tasks: jobs→recs→accept + watermark + advisory-lock + behaviour-change GREEN")


def test_scheduled_tasks():
    asyncio.run(main())


if __name__ == "__main__":
    asyncio.run(main())
