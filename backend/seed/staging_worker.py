"""Explicit staging proof of one owned timer through real domain processing and captured effects.

Run as the target's database maintenance identity. This creates a synthetic tenant, not an identity
provider account or support grant. Normal IdP authentication is commissioned and verified separately.
"""

from __future__ import annotations

import argparse
import asyncio
import getpass
import json
import re
import socket
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import config
import db
import worker
from operator_service import Actor, audit
from seed.testdata import close_pools, open_pools
from testdata_adapter import read_private, write_private
from worker_capture import TimerCapture

SCENARIO = "worker-email-v1"
BRANCH = {
    "branch_id": "follow-up",
    "channel": "email",
    "trigger": "silence",
    "action": {"sentence": "Your order is ready for review."},
    "email_subject": "Synthetic order review",
    "email_html": "<p>Your order is ready for review.</p>",
    "pacing_deadline": "2000-01-01T00:00:00+00:00",
}


def validate(manifest: dict) -> tuple[str, str]:
    if set(manifest) != {"schema", "run_id", "environment", "source_commit", "product_sha256", "scenario_id"}:
        raise ValueError("staging proof manifest has an unexpected shape")
    if (
        manifest["schema"] != 1
        or manifest["environment"] != "staging"
        or manifest["scenario_id"] != SCENARIO
        or not re.fullmatch(r"[a-f0-9]{32}", manifest["run_id"])
        or not re.fullmatch(r"[a-f0-9]{40}", manifest["source_commit"])
        or not re.fullmatch(r"[a-f0-9]{64}", manifest["product_sha256"])
    ):
        raise ValueError("staging proof requires exact run, scenario and source identities")
    if (
        getattr(config, "ENVIRONMENT", "development") != "staging"
        or config.IS_PROD
        or not config.EGRESS_SANDBOX
        or getattr(config, "WORKER_EFFECT_MODE", "paused") != "paused"
        or getattr(config, "RELEASE_COMMIT", "") != manifest["source_commit"]
        or getattr(config, "RELEASE_PRODUCT_SHA256", "") != manifest["product_sha256"]
    ):
        raise ValueError("staging proof target, captured effects and installed source must match")
    tenant = "synthetic_" + manifest["run_id"]
    return tenant, "test." + tenant + ".worker"


async def clear_scope(con, scope: str) -> None:
    # Only this generated scope is eligible. Foreign references cause transactional refusal.
    await con.execute("delete from timer where scope=$1::ltree", scope)
    await con.execute("delete from open_loop where scope=$1::ltree", scope)
    await con.execute(
        "delete from endpoint where contact_id in (select id from contact where scope=$1::ltree)", scope
    )
    await con.execute("delete from contact where scope=$1::ltree", scope)
    await con.execute("delete from scope_state where scope=$1::ltree", scope)
    await con.execute("delete from event where scope=$1::ltree", scope)
    await con.execute("delete from scope_node where scope=$1::ltree", scope)


async def populate(con, tenant: str, scope: str, manifest: dict) -> None:
    await con.execute(
        "insert into scope_node(scope,tier,tenant_slug,label,lineage) values($1::ltree,'test',$2,$3,'test')",
        scope,
        tenant,
        manifest["run_id"],
    )
    await con.execute("insert into scope_state(scope,mode) values($1::ltree,'auto')", scope)
    contact = await con.fetchval(
        "insert into contact(scope,tenant_slug,display_name,lineage) "
        "values($1::ltree,$2,'Synthetic recipient','test') returning id",
        scope,
        tenant,
    )
    await con.execute(
        "insert into endpoint(contact_id,kind,addr,tenant_slug) values($1,'email',$2,$3)",
        contact,
        "worker-" + manifest["run_id"] + "@example.invalid",
        tenant,
    )
    loop = await con.fetchval(
        "insert into open_loop(scope,kind,text,contingencies,lineage) "
        "values($1::ltree,'question','Synthetic order review',$2,'test') returning id",
        scope,
        [BRANCH],
    )
    await con.execute(
        "insert into timer(scope,loop_id,fires_at,branch_id,lineage) "
        "values($1::ltree,$2,now()-interval '1 minute','follow-up','test')",
        scope,
        loop,
    )


async def execute(manifest: dict, operation: str, *, apply=False) -> dict:
    tenant, scope = validate(manifest)
    if operation not in {"create", "exercise", "status", "reset", "delete"}:
        raise ValueError("unknown staging proof operation")
    result = {
        "environment": "staging",
        "run_id": manifest["run_id"],
        "tenant_id": tenant,
        "source_commit": manifest["source_commit"],
        "product_sha256": manifest["product_sha256"],
        "operation": operation,
        "applied": False,
    }
    if not apply and operation != "status":
        return result
    async with db.get_pool().acquire() as owner, owner.transaction():
        await owner.execute(
            "select pg_advisory_xact_lock(hashtextextended($1,0))", "worker-proof:" + manifest["run_id"]
        )
        record = await owner.fetchrow(
            "select * from operator_synthetic_run where run_id=$1 for update", manifest["run_id"]
        )
        account = await owner.fetchrow("select status,seeded from tenants where slug=$1 for update", tenant)
        role = await owner.fetchval("select current_user")
        if await owner.fetchval("select rolsuper or rolbypassrls from pg_roles where rolname=current_user"):
            raise ValueError("staging proof requires the ordinary RLS-bound database maintenance role")
        actor = Actor("db:" + role + "/os:" + getpass.getuser(), "staging-worker-proof", "staging")
        if record is None:
            retired = await owner.fetchval(
                "select exists(select 1 from operator_audit where action='synthetic.delete' "
                "and target_id=$1 and detail->>'product_sha256'=$2)",
                manifest["run_id"],
                manifest["product_sha256"],
            )
            if operation == "delete" and retired and not account:
                return {**result, "applied": True, "phase": "deleted"}
            if retired:
                raise ValueError("retired run identity is permanent; create a new manifest")
            if operation != "create" or account:
                raise ValueError("staging synthetic ownership is absent or collides with an existing account")
            await owner.execute(
                "insert into tenants(slug,name,status,seeded) "
                "values($1,'Synthetic worker proof','test',true)",
                tenant,
            )
            await owner.execute(
                "insert into operator_synthetic_run(run_id,tenant_slug,environment,scenario_id,"
                "source_sha256,phase,effects) values($1,$2,'staging',$3,$4,'created','capture')",
                manifest["run_id"],
                tenant,
                SCENARIO,
                manifest["product_sha256"],
            )
        elif (
            record["tenant_slug"] != tenant
            or record["environment"] != "staging"
            or record["source_sha256"] != manifest["product_sha256"]
            or record["scenario_id"] != SCENARIO
            or record["effects"] != "capture"
            or not account
            or account["status"] != "test"
            or not account["seeded"]
        ):
            raise ValueError("staging synthetic marker or tenant identity differs from this manifest")

        await owner.execute("select set_config('rocoto.scope', $1, true)", scope)
        con = owner  # Same transaction: ownership, domain state, captures and audit commit together.
        node = await con.fetchrow(
            "select tenant_slug,label,lineage from scope_node where scope=$1::ltree", scope
        )
        if node and (
            node["tenant_slug"] != tenant or node["label"] != manifest["run_id"] or node["lineage"] != "test"
        ):
            raise ValueError("generated scope ownership differs from the manifest")
        if operation == "create" and record is None:
            if node:
                raise ValueError("new run cannot adopt an existing scope")
            await populate(con, tenant, scope, manifest)
        elif operation in {"reset", "delete"}:
            if not node:
                raise ValueError("owned scope missing; inspect the retained run before cleanup")
            await clear_scope(con, scope)
            if operation == "reset":
                await populate(con, tenant, scope, manifest)
        elif not node:
            raise ValueError("owned scope is missing")
        if operation == "exercise":
            jobs = await con.fetch(
                "select id,scope::text as scope,state from timer where scope=$1::ltree order by id", scope
            )
            if len(jobs) != 1:
                raise ValueError("proof requires exactly its one generated timer")
            job = jobs[0]
            if job["state"] == "armed":
                await worker._fire_one(con, job, capture=TimerCapture(manifest, job["id"], BRANCH))
            completed = await con.fetchval("select state='fired' from timer where id=$1", job["id"])
            rows = await con.fetch(
                "select id,payload,lineage,ts from event where scope=$1::ltree "
                "and type='effect.captured' order by id",
                scope,
            )
            sent = await con.fetchval(
                "select count(*) from event where scope=$1::ltree and type='msg.sent'", scope
            )
            if (
                not completed
                or len(rows) != 2
                or sent
                or {r["payload"].get("operation") for r in rows} != {"llm.verify_branch", "email.send"}
                or any(
                    r["lineage"] != "test"
                    or r["payload"].get("run_id") != manifest["run_id"]
                    or r["payload"].get("job_id") != str(job["id"])
                    or r["payload"].get("source_commit") != manifest["source_commit"]
                    or r["payload"].get("provider_delivered") is not False
                    for r in rows
                )
            ):
                raise ValueError("worker did not produce its complete captured effect proof")
            common = {
                "source_commit": manifest["source_commit"],
                "environment": "staging",
                "tenant_id": tenant,
                "job_id": str(job["id"]),
            }
            result["worker"] = {
                **common,
                "status": "completed",
                "processed_objects": 1,
                "effect_mode": "capture",
            }
            result["effects"] = {
                **common,
                "attempted_count": 2,
                "captured_count": 2,
                "provider_deliveries": 0,
                "records": [{"event_id": r["id"], **r["payload"]} for r in rows],
                "model_verification": "explicit-confirmed-fixture",
            }
            result["verified_at"] = rows[-1]["ts"].isoformat()
        if operation == "delete":
            # IdP account/member commissioning is a separate resource owner; preserve its authority.
            if await owner.fetchval("select exists(select 1 from team_members where tenant_slug=$1)", tenant):
                raise ValueError("remove this account's separately commissioned membership before teardown")
            await owner.execute("delete from operator_synthetic_run where run_id=$1", manifest["run_id"])
            await owner.execute("delete from tenants where slug=$1", tenant)
            phase = "deleted"
        else:
            phase = (
                "verified"
                if operation == "exercise"
                else "populated"
                if operation == "reset" or (operation == "create" and record is None)
                else record["phase"]
            )
            if operation != "status":
                await owner.execute(
                    "update operator_synthetic_run set phase=$2,updated_at=now() where run_id=$1",
                    manifest["run_id"],
                    phase,
                )
        if operation != "status":
            await audit(
                owner,
                actor,
                tenant,
                "synthetic." + operation,
                manifest["run_id"],
                "ok",
                uuid4().hex,
                {
                    "product_sha256": manifest["product_sha256"],
                    "source_commit": manifest["source_commit"],
                    "phase": phase,
                    "proof": {
                        key: result[key] for key in ("worker", "effects", "verified_at") if key in result
                    },
                },
            )
        elif phase == "verified":
            retained = await owner.fetchval(
                "select detail->'proof' from operator_audit where action='synthetic.exercise' "
                "and target_id=$1 order by id desc limit 1",
                manifest["run_id"],
            )
            if retained:
                result.update(retained)
    return {
        **result,
        "applied": operation != "status",
        "phase": phase,
        "verified_at": result.get("verified_at", datetime.now(timezone.utc).isoformat()),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("operation", choices=["new", "create", "exercise", "status", "reset", "delete"])
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--receipt", type=Path)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    if socket.gethostname() != "rocoto-staging":
        raise ValueError("staging proof CLI runs only on the named staging host")
    if args.operation == "new":
        if args.manifest.exists():
            raise ValueError("manifest already exists")
        manifest = {
            "schema": 1,
            "run_id": uuid4().hex,
            "environment": "staging",
            "scenario_id": SCENARIO,
            "source_commit": getattr(config, "RELEASE_COMMIT", ""),
            "product_sha256": getattr(config, "RELEASE_PRODUCT_SHA256", ""),
        }
        validate(manifest)
        write_private(args.manifest, manifest)
        print(json.dumps(manifest))
        return
    manifest = read_private(args.manifest)

    async def run():
        await open_pools()  # Explicit existing-schema connections; no startup migration/global backfill.
        try:
            return await execute(manifest, args.operation, apply=args.apply)
        finally:
            await close_pools()

    result = asyncio.run(run())
    if args.receipt:
        write_private(args.receipt, result)
    print(json.dumps(result, sort_keys=True))


if __name__ == "__main__":
    main()
