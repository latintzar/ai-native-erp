"""Governed support operations: exact grants, bounded reads, atomic audit and repeatable writes.

Uses the product owner pool for control-plane tables; never changes the runtime RLS scope. Browser
requests cannot grant access, impersonate a user, execute SQL, run shell commands or enable providers.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import datetime
from uuid import UUID, uuid4

import db

CAPABILITIES = frozenset({"accounts.read", "accounts.edit", "sessions.revoke", "audit.read"})
PROFILE_FIELDS = frozenset({"name", "address", "city", "region", "country"})


@dataclass(frozen=True)
class Actor:
    email: str
    session_id: str
    environment: str


async def audit(
    con,
    actor: Actor,
    tenant: str,
    action: str,
    target: str,
    outcome: str,
    request_id: str,
    detail: dict | None = None,
) -> None:
    await con.execute(
        "insert into operator_audit(actor_email,session_id,environment,tenant_slug,action,"
        "target_id,outcome,request_id,detail) values($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        actor.email,
        actor.session_id,
        actor.environment,
        tenant,
        action,
        target,
        outcome,
        request_id,
        detail or {},
    )


async def allowed(con, actor: Actor, tenant: str, capability: str) -> bool:
    # The row lock serializes revocation with writes. Membership/founder status never grants support.
    return bool(
        await con.fetchval(
            "select a.operator_id from operator_access a join operators o on o.id=a.operator_id "
            "where lower(o.email)=$1 and a.environment=$2 and a.tenant_slug=$3 "
            "and a.capability=$4 and a.expires_at>now() for share of a,o",
            actor.email,
            actor.environment,
            tenant,
            capability,
        )
    )


async def accounts(actor: Actor, after: str = "", limit: int = 50) -> dict:
    async with db.get_pool().acquire() as con, con.transaction():
        rows = await con.fetch(
            "select t.slug,t.name,t.status,t.seeded,t.updated_at from tenants t "
            "where t.slug>$3 and exists (select 1 from operator_access a "
            "join operators o on o.id=a.operator_id where lower(o.email)=$1 "
            "and a.environment=$2 and a.tenant_slug=t.slug and a.capability='accounts.read' "
            "and a.expires_at>now()) order by t.slug limit $4",
            actor.email,
            actor.environment,
            after,
            min(max(limit, 1), 100) + 1,
        )
        more = len(rows) > limit
        selected = [dict(r) for r in rows[:limit]]
        await audit(con, actor, "", "accounts.list", "", "ok", str(uuid4()), {"count": len(selected)})
    return {"accounts": selected, "next": selected[-1]["slug"] if more and selected else None}


async def read_account(
    actor: Actor, tenant: str, *, audit_log: bool = False, before: int = 9223372036854775807
) -> tuple[int, dict]:
    result: dict
    cap = "audit.read" if audit_log else "accounts.read"
    action = "audit.list" if audit_log else "account.read"
    async with db.get_pool().acquire() as con, con.transaction():
        if not await allowed(con, actor, tenant, cap):
            await audit(con, actor, tenant, action, tenant, "denied", str(uuid4()))
            return 403, {"error": "operator_scope_required"}
        if audit_log:
            rows = await con.fetch(
                "select id,created_at,actor_email,action,target_id,outcome,request_id,detail "
                "from operator_audit where environment=$1 and tenant_slug=$2 and id<$3 "
                "order by id desc limit 100",
                actor.environment,
                tenant,
                before,
            )
            result = {"audit": [dict(r) for r in rows]}
        else:
            row = await con.fetchrow(
                "select slug,name,status,seeded,address,city,region,country,plan,updated_at "
                "from tenants where slug=$1",
                tenant,
            )
            if row is None:
                return 404, {"error": "account_unavailable"}
            members = await con.fetch(
                "select o.id,o.name,o.email,tm.role from team_members tm "
                "join operators o on o.id=tm.operator_id where tm.tenant_slug=$1 "
                "order by o.id limit 100",
                tenant,
            )
            connections = await con.fetch(
                "select id,kind,provider,status,connected_at,updated_at "
                "from channel_connection where tenant_id=$1 order by id limit 100",
                tenant,
            )
            runs = await con.fetch(
                "select run_id,scenario_id,source_sha256,phase,effects,updated_at "
                "from operator_synthetic_run where environment=$1 and tenant_slug=$2 "
                "order by updated_at desc limit 100",
                actor.environment,
                tenant,
            )
            caps = [
                capability
                for capability in sorted(CAPABILITIES)
                if await allowed(con, actor, tenant, capability)
            ]
            result = {
                "account": dict(row),
                "members": [dict(r) for r in members],
                "connections": [dict(r) for r in connections],
                "synthetic_runs": [dict(r) for r in runs],
                "capabilities": caps,
                "lifecycle": {"interface": "company-testdata", "web_execution": False},
            }
        await audit(con, actor, tenant, action, tenant, "ok", str(uuid4()))
    return 200, result


def valid_request(body: dict, action: str) -> bool:
    if action == "account.edit":
        if set(body) != {"revision", "changes", "reason"} or not isinstance(body["changes"], dict):
            return False
        changes = body["changes"]
        if not changes or not set(changes) <= PROFILE_FIELDS or not isinstance(body["revision"], str):
            return False
        if any(not isinstance(v, str) or len(v) > 300 for v in changes.values()):
            return False
        if "name" in changes and not changes["name"].strip():
            return False
        if "country" in changes and (len(changes["country"]) != 2 or not changes["country"].isalpha()):
            return False
        try:
            if datetime.fromisoformat(body["revision"]).tzinfo is None:
                return False
        except ValueError:
            return False
    elif action == "sessions.revoke":
        if set(body) != {"operator_id", "reason"} or not isinstance(body["operator_id"], str):
            return False
        if not 1 <= len(body["operator_id"]) <= 120:
            return False
    else:
        return False
    return isinstance(body.get("reason"), str) and 3 <= len(body["reason"].strip()) <= 500


async def mutate(actor: Actor, tenant: str, action: str, body: dict, request_id: str) -> tuple[int, dict]:
    result: dict
    capability = {"account.edit": "accounts.edit", "sessions.revoke": "sessions.revoke"}.get(action, "")
    try:
        UUID(request_id)
    except (ValueError, AttributeError):
        return 400, {"error": "idempotency_key_required"}
    fingerprint = hashlib.sha256(
        json.dumps({"action": action, "body": body}, sort_keys=True).encode()
    ).hexdigest()
    async with db.get_pool().acquire() as con, con.transaction():
        if not await allowed(con, actor, tenant, capability):
            await audit(con, actor, tenant, action, tenant, "denied", request_id)
            return 403, {"error": "operator_scope_required"}
        # Advisory transaction lock serializes first use of this absent-or-present request row.
        key = "\0".join([actor.email, actor.environment, tenant, request_id])
        lock = int.from_bytes(hashlib.sha256(key.encode()).digest()[:8], "big", signed=True)
        await con.execute("select pg_advisory_xact_lock($1)", lock)
        previous = await con.fetchrow(
            "select fingerprint,status,response from operator_request where actor_email=$1 "
            "and environment=$2 and tenant_slug=$3 and request_id=$4",
            actor.email,
            actor.environment,
            tenant,
            request_id,
        )
        if previous:
            if previous["fingerprint"] != fingerprint:
                await audit(con, actor, tenant, action, tenant, "request_conflict", request_id)
                return 409, {"error": "idempotency_conflict"}
            await audit(con, actor, tenant, action, tenant, "replayed", request_id)
            return previous["status"], previous["response"]
        detail: dict = {}
        if not valid_request(body, action):
            status, result = 422, {"error": "invalid_operation"}
        elif action == "account.edit":
            row = await con.fetchrow("select updated_at from tenants where slug=$1 for update", tenant)
            if row is None:
                status, result = 404, {"error": "account_unavailable"}
            elif row["updated_at"] != datetime.fromisoformat(body["revision"]):
                status, result = 409, {"error": "revision_conflict"}
            else:
                fields = sorted(body["changes"])
                # Identifiers are the fixed PROFILE_FIELDS allowlist; values are bound parameters.
                clauses = ",".join(f"{field}=${i + 2}" for i, field in enumerate(fields))
                revision = await con.fetchval(
                    f"update tenants set {clauses},updated_at=clock_timestamp() where slug=$1 "
                    "returning updated_at",
                    tenant,
                    *(body["changes"][field].strip() for field in fields),
                )
                status, result = 200, {"ok": True, "revision": revision.isoformat()}
                detail = {"fields": fields}
        else:
            target = await con.fetchval(
                "select lower(o.email) from team_members tm join operators o on o.id=tm.operator_id "
                "where tm.tenant_slug=$1 and tm.operator_id=$2 for share of tm,o",
                tenant,
                body["operator_id"],
            )
            if target is None:
                status, result = 404, {"error": "member_unavailable"}
            else:
                rows = await con.fetch(
                    "update sup_session set revoked_at=now() where lower(actor_email)=$1 "
                    "and tenant_slug=$2 and revoked_at is null returning session_id",
                    target,
                    tenant,
                )
                status, result = 200, {"ok": True, "revoked": len(rows)}
                detail = {"operator_id": body["operator_id"], "count": len(rows)}
        # Reason is retained in the private audit; customer field values and credentials are omitted.
        if status == 200:
            detail["reason"] = body["reason"]
        await audit(
            con,
            actor,
            tenant,
            action,
            body["operator_id"]
            if isinstance(body.get("operator_id"), str) and 1 <= len(body["operator_id"]) <= 120
            else tenant,
            "ok" if status == 200 else result["error"],
            request_id,
            detail,
        )
        await con.execute(
            "insert into operator_request(actor_email,environment,tenant_slug,request_id,"
            "fingerprint,status,response) values($1,$2,$3,$4,$5,$6,$7)",
            actor.email,
            actor.environment,
            tenant,
            request_id,
            fingerprint,
            status,
            result,
        )
        return status, result
