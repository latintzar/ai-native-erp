"""Canonical synthetic account/data and bounded application proofs in an owned database."""

from __future__ import annotations

import json
from datetime import datetime, timedelta

import asyncpg

import config
import db
from testdata_adapter import OWNER_FILE, Refusal, resources_for, write_private


async def verify_database(con: asyncpg.Connection, owner: dict) -> None:
    marker = await con.fetchval("select to_regclass('testdata_lifecycle.owner')")
    if marker is None:
        raise Refusal("database ownership marker is missing")
    rows = await con.fetch("select identity from testdata_lifecycle.owner")
    if len(rows) != 1 or json.loads(rows[0]["identity"]) != resources_for(owner):
        raise Refusal("database ownership marker differs from this run")


async def initialize(owner: dict, previous_phase: str, *, reset: bool = False) -> None:
    """Only the local cluster selected by the adapter is reachable at this point."""
    from pathlib import Path

    admin_dsn = config.DATABASE_URL.rsplit("/", 1)[0] + "/postgres"
    admin = await asyncpg.connect(admin_dsn)
    try:
        exists = await admin.fetchval("select exists(select 1 from pg_database where datname='testdata')")
        if exists:
            con = await asyncpg.connect(config.DATABASE_URL)
            try:
                marker = await con.fetchval("select to_regclass('testdata_lifecycle.owner')")
                if marker:
                    await verify_database(con, owner)
                else:
                    tables = await con.fetchval(
                        "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace "
                        "where n.nspname not in ('pg_catalog','information_schema') "
                        "and n.nspname not like 'pg_toast%' and c.relkind in ('r','p','v','m','S')"
                    )
                    if previous_phase not in {"reserved", "initializing", "resetting"} or tables:
                        raise Refusal("existing database has ambiguous ownership")
            finally:
                await con.close()
        elif previous_phase == "ready":
            raise Refusal("owned database is missing")
        if reset:
            owner["phase"] = "resetting"
            write_private(Path(owner["state_dir"]) / OWNER_FILE, owner)
            if exists:
                await admin.execute("drop database testdata with (force)")
                exists = False
        if not exists:
            await admin.execute("create database testdata")
    finally:
        await admin.close()

    con = await asyncpg.connect(config.DATABASE_URL)
    try:
        async with con.transaction():
            await con.execute("create schema if not exists testdata_lifecycle")
            await con.execute("create table if not exists testdata_lifecycle.owner (identity text not null)")
            if not await con.fetchval("select count(*) from testdata_lifecycle.owner"):
                await con.execute(
                    "insert into testdata_lifecycle.owner values ($1)",
                    json.dumps(resources_for(owner), sort_keys=True),
                )
            await verify_database(con, owner)
        # The owner marker is durable first; migration uses this verified isolated database.
        from schema_migrations import migrate

        await migrate(config.DATABASE_URL, tenant=owner["tenant_slug"])
        for role, key in (("rocoto_rt", "runtime"), ("rocoto_ctrl", "control")):
            # Role names are constants and private generated passwords were validated as hex.
            await con.execute(f"alter role {role} login password '{owner['passwords'][key]}'")
            await con.execute(f"grant connect on database testdata to {role}")
    finally:
        await con.close()


async def open_pools() -> None:
    # The schema bootstrap above is separate from ordinary operation. Status opens pools and
    # reads existing data; startup and routine operations never apply schema changes.
    db._pool = await asyncpg.create_pool(config.DATABASE_URL, min_size=1, max_size=2, init=db._init_conn)
    await db._open_runtime_pool()
    await db._open_control_pool()


async def close_pools() -> None:
    for name in ("_ctrl_pool", "_rt_pool", "_pool"):
        pool = getattr(db, name)
        if pool is not None:
            await pool.close()
            setattr(db, name, None)


def at(scenario: dict) -> datetime:
    return datetime.fromisoformat(scenario["clock"].replace("Z", "+00:00"))


async def account(owner: dict, scenario: dict) -> None:
    tenant = owner["tenant_slug"]
    person = scenario["account"]
    clock = at(scenario)
    async with db.get_pool().acquire() as con, con.transaction():
        await con.execute(
            "insert into tenants(slug,name,status,seeded,created_at,updated_at) "
            "values($1,$2,'test',true,$3,$3) on conflict(slug) do nothing",
            tenant,
            person["name"],
            clock,
        )
        await con.execute(
            "insert into operators(id,email,name,is_founder,active_tenant,seeded,created_at,updated_at) "
            "values($1,$2,$3,false,$4,true,$5,$5) on conflict(id) do nothing",
            "op_" + tenant,
            person["operator_email"],
            person["operator_name"],
            tenant,
            clock,
        )
        await con.execute(
            "insert into team_members(operator_id,tenant_slug,role,seeded,created_at) "
            "values($1,$2,'owner',true,$3) on conflict(operator_id,tenant_slug) do nothing",
            "op_" + tenant,
            tenant,
            clock,
        )
        await con.execute(
            "insert into scope_node(scope,tier,tenant_slug,label,lineage,created_at) "
            "values($1::ltree,'boss',$2,$3,'test',$4) on conflict(scope) do nothing",
            "t." + tenant,
            tenant,
            person["name"],
            clock,
        )


async def populate(owner: dict, scenario: dict) -> None:
    tenant = owner["tenant_slug"]
    clock = at(scenario)
    products = {p["code"]: p for p in scenario["catalogue"]}
    customers = {c["id"]: c for c in scenario["customers"]}
    async with db.get_pool().acquire() as con, con.transaction():
        for product in products.values():
            await con.execute(
                "insert into catalogue_skus(id,tenant_id,code,name,family,base_unit,price,seeded,"
                "created_at,search_text) "
                "values($1,$2,$3,$4,$5,$6,$7,true,$8,to_tsvector('simple',$4)) on conflict(id) do nothing",
                tenant + ":" + product["code"],
                tenant,
                product["code"],
                product["name"],
                product["family"],
                product["base_unit"],
                product["price"],
                clock,
            )
        for customer in customers.values():
            scope = "t." + tenant + ".c." + customer["id"]
            await con.execute(
                "insert into scope_node(scope,tier,tenant_slug,label,lineage,created_at) "
                "values($1::ltree,'customer',$2,$3,'test',$4) on conflict(scope) do nothing",
                scope,
                tenant,
                customer["name"],
                clock,
            )
            cid = await con.fetchval("select id from contact where scope=$1::ltree", scope)
            if cid is None:
                cid = await con.fetchval(
                    "insert into contact(scope,tenant_slug,display_name,flags,provisional,lineage,"
                    "created_at) "
                    "values($1::ltree,$2,$3,$4,false,'test',$5) returning id",
                    scope,
                    tenant,
                    customer["name"],
                    {"synthetic": True},
                    clock,
                )
            for kind, address in (("wa", customer["phone"]), ("email", customer["email"])):
                await con.execute(
                    "insert into endpoint(contact_id,kind,addr,tenant_slug,created_at) "
                    "values($1,$2,$3,$4,$5) on conflict(tenant_slug,kind,addr) do nothing",
                    cid,
                    kind,
                    address,
                    tenant,
                    clock,
                )
            await con.execute(
                "insert into customer_profiles(tenant_id,phone_number,display_name,seeded,updated_at) "
                "values($1,$2,$3,true,$4) on conflict(tenant_id,phone_number) do nothing",
                tenant,
                customer["phone"],
                customer["name"],
                clock,
            )
        for order in scenario["orders"]:
            customer = customers[order["customer"]]
            lines = [
                {
                    "sku_id": tenant + ":" + line["code"],
                    "item": products[line["code"]]["name"],
                    "qty": line["qty"],
                    "unit": products[line["code"]]["base_unit"],
                    "price": None,
                }
                for line in order["lines"]
            ]
            created = clock - timedelta(days=order["days_ago"])
            delivery = (clock + timedelta(days=order["delivery_days"])).date().isoformat()
            await con.execute(
                "insert into orders(id,tenant_id,phone_number,customer_name,status,lines,seeded,"
                "created_at,updated_at,delivery_date,note) values($1,$2,$3,$4,$5,$6,true,$7,$7,$8,$9) "
                "on conflict(id) do nothing",
                tenant + ":order:" + order["id"],
                tenant,
                customer["phone"],
                customer["name"],
                order["status"],
                lines,
                created,
                delivery,
                "Synthetic scenario " + scenario["id"],
            )


async def status(owner: dict, scenario: dict) -> dict:
    tenant = owner["tenant_slug"]
    async with db.get_pool().acquire() as con:
        counts = {
            key: await con.fetchval(query, tenant)
            for key, query in {
                "tenants": "select count(*) from tenants where slug=$1",
                "operators": "select count(*) from operators where active_tenant=$1",
                "memberships": "select count(*) from team_members where tenant_slug=$1",
                "catalogue": "select count(*) from catalogue_skus where tenant_id=$1",
                "customers": "select count(*) from contact where tenant_slug=$1 and tier='customer'",
                "orders": "select count(*) from orders where tenant_id=$1",
            }.items()
        }
        authentication = None
        if await con.fetchval("select to_regclass('testdata_lifecycle.proof')"):
            authentication = await con.fetchval(
                "select result from testdata_lifecycle.proof where kind='authentication'"
            )
        snapshots = await con.fetchval(
            "select count(*) from orders where tenant_id=$1 and value_snapshot_cents is not null", tenant
        )
    return {
        "state": "populated" if counts["orders"] else "created",
        "counts": counts,
        "value_snapshots": snapshots,
        "scenario": scenario["id"],
        "clock": scenario["clock"],
        "effects": "capture",
        "rls": await db.rls_status(),
        "proof_scope": {
            "canonical_account": "persisted",
            "authentication": authentication or "unexercised",
            "ingestion": "unexercised",
            "model": "unexercised",
            "provider": "unexercised",
        },
    }


async def exercise(owner: dict, scenario: dict) -> dict:
    from brain import billing

    tenant = owner["tenant_slug"]
    target = scenario["orders"][0]
    oid = tenant + ":order:" + target["id"]
    order = await db.order_get(oid, tenant=tenant)
    if order is None:
        raise Refusal("populate this run before exercising the order workflow")
    if await db.order_get(oid, tenant=tenant + "_other") is not None:
        raise Refusal("application order read crossed the tenant predicate")
    await db.order_set_status(oid, "approved")
    approved = await db.order_get(oid, tenant=tenant)
    if approved is None:
        raise Refusal("order disappeared after application approval")
    batch = await billing.snapshot_dispatch_values([approved])
    if batch["failed"]:
        raise Refusal("application order value calculation failed")
    persisted = await db.order_get(oid, tenant=tenant)
    if persisted is None:
        raise Refusal("order disappeared after application value persistence")
    if (
        persisted["status"] != "approved"
        or persisted["value_snapshot_cents"] != target["expected_value_cents"]
    ):
        raise Refusal("application order approval/value persistence differs from the scenario")
    if not persisted["value_snapshot"] or any(
        line["source"] != "catalogue" for line in persisted["value_snapshot"]["lines"]
    ):
        raise Refusal("application value calculation did not resolve catalogue prices")
    # Prove the actual set-once business invariant with a conflicting second value.
    if await db.order_set_value_snapshot(oid, 1, {"synthetic_retry": True}):
        raise Refusal("application value snapshot was overwritten")
    reloaded = await db.order_get(oid, tenant=tenant)
    if reloaded is None:
        raise Refusal("order disappeared after application retry")
    if reloaded["value_snapshot_cents"] != target["expected_value_cents"]:
        raise Refusal("persisted value snapshot changed after retry")

    # Runtime scope proof is distinct from the legacy order read predicate above. The event
    # written here is an explicit application exercise receipt, never an ingestion claim.
    scope, foreign = "t." + tenant, "t." + tenant + "_other"
    own_key, foreign_key = tenant + ":exercise:own", tenant + ":exercise:other"
    for event_scope, key in ((scope, own_key), (foreign, foreign_key)):
        async with db.scoped_tx(event_scope) as con:
            await con.execute(
                "insert into event(scope,type,source,payload,lineage,dedupe_key,ts) "
                "values($1::ltree,'testdata.exercise','app',$2,'test',$3,$4) "
                "on conflict(dedupe_key) where dedupe_key is not null do nothing",
                event_scope,
                {"operation": "order-value-snapshot", "run_id": owner["run_id"]},
                key,
                at(scenario),
            )
    async with db.scoped_tx(scope) as con:
        visible = await con.fetch(
            "select dedupe_key from event where dedupe_key=any($1::text[])", [own_key, foreign_key]
        )
        if [row["dedupe_key"] for row in visible] != [own_key]:
            raise Refusal("runtime RLS read crossed the tenant wall")
    try:
        async with db.scoped_tx(scope) as con:
            await con.execute(
                "insert into event(scope,type,source) values($1::ltree,'testdata.forbidden','app')", foreign
            )
    except asyncpg.InsufficientPrivilegeError as error:
        if "row-level security policy" not in str(error):
            raise Refusal("runtime write failed without demonstrating the RLS policy") from None
    else:
        raise Refusal("runtime RLS accepted a foreign-scope write")
    runtime_pool = db._rt_pool
    if runtime_pool is None:
        raise Refusal("runtime pool is unavailable for the scope proof")
    async with runtime_pool.acquire() as con:
        await con.execute("reset rocoto.scope")
        if await con.fetchval("select count(*) from event"):
            raise Refusal("runtime RLS exposed rows without scope")
    from seed.authenticated import exercise as exercise_identity

    authentication = await exercise_identity(owner, scenario)
    result = await status(owner, scenario)
    result.update(
        {
            "state": "exercised",
            "proofs": {
                "authentication": authentication,
                "application": {
                    "operation": "order approval and catalogue-backed value snapshot",
                    "order_id": oid,
                    "value_cents": reloaded["value_snapshot_cents"],
                    "set_once_retry": True,
                    "tenant_read_predicate": True,
                },
                "runtime_rls": {
                    "role": "rocoto_rt",
                    "own_scope_read": True,
                    "foreign_scope_hidden": True,
                    "foreign_write_rejected": True,
                    "unscoped_read_empty": True,
                },
                "effects": {"mode": "capture", "external_calls": 0},
            },
        }
    )
    return result


async def operate(operation: str, owner: dict, scenario: dict, port: int, previous_phase: str) -> dict:
    if operation in {"create", "reset"}:
        if operation == "reset" or previous_phase != "ready":
            await initialize(owner, previous_phase, reset=operation == "reset")
    elif previous_phase != "ready":
        raise Refusal("complete create before using this run")
    con = await asyncpg.connect(config.DATABASE_URL)
    try:
        await verify_database(con, owner)
    finally:
        await con.close()
    try:
        await open_pools()
        if operation in {"create", "reset"}:
            await account(owner, scenario)
        if operation in {"populate", "reset"}:
            await populate(owner, scenario)
        result = await exercise(owner, scenario) if operation == "exercise" else await status(owner, scenario)
        if operation in {"create", "populate", "reset", "exercise"}:
            from seed.authenticated import register

            phase = (
                "verified"
                if operation == "exercise"
                else "populated"
                if result["counts"]["orders"]
                else "created"
            )
            await register(owner, scenario, phase)
        # Addresses are local convenience data, separate from the public immutable identity.
        result["database"] = {
            "host": "127.0.0.1",
            "port": port,
            "name": "testdata",
            "container_id": owner["container_id"],
        }
        return result
    finally:
        await close_pools()
