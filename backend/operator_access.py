"""Database-owner maintenance CLI for explicit, expiring support grants; plans unless --apply.

Credentials use DATABASE_URL through the normal deployment secret store. Run only from the target's
controlled administration context. The browser has no privilege-management endpoint.
"""

from __future__ import annotations

import argparse
import asyncio
import getpass
import json
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import asyncpg

import config
import db
from operator_service import CAPABILITIES, Actor, audit


async def manage(args) -> dict:
    if args.environment not in {"development", "staging", "production"}:
        raise ValueError("explicit deployment environment required")
    expected = getattr(config, "ENVIRONMENT", "production" if config.IS_PROD else "development")
    if args.environment != expected or (args.environment == "production") != config.IS_PROD:
        raise ValueError("deployment environment mismatch")
    email = args.email.strip().lower()
    if not email or not 3 <= len(args.reason.strip()) <= 500:
        raise ValueError("operator email and a specific reason are required")
    if args.capability not in CAPABILITIES or not 1 <= args.hours <= 720:
        raise ValueError("valid capability and bounded grant lifetime required")
    expires = datetime.now(timezone.utc) + timedelta(hours=args.hours)
    result = {
        "operation": args.operation,
        "email": email,
        "tenant": args.tenant,
        "environment": args.environment,
        "capability": args.capability,
        "expires_at": expires.isoformat(),
        "applied": False,
    }
    con = await asyncpg.connect(config.DATABASE_URL)
    try:
        await db.prepare_conn(con)
        async with con.transaction():
            # This privilege is granted through the database owner's administration, not customer roles.
            db_role = await con.fetchval("select current_user")
            if not await con.fetchval(
                "select has_table_privilege(current_user,'operator_access','INSERT,DELETE')"
            ):
                raise ValueError("database administration role required")
            operator = await con.fetchval("select id from operators where lower(email)=$1 for share", email)
            tenant = await con.fetchval("select slug from tenants where slug=$1 for share", args.tenant)
            if not operator or not tenant:
                raise ValueError("existing exact operator and account required")
            if args.apply:
                actor = Actor(
                    "db:" + db_role + "/os:" + getpass.getuser(), "maintenance-cli", args.environment
                )
                if args.operation == "grant":
                    await con.execute(
                        "insert into operator_access(operator_id,environment,tenant_slug,capability,"
                        "granted_by,reason,expires_at) values($1,$2,$3,$4,$5,$6,$7) "
                        "on conflict(operator_id,environment,tenant_slug,capability) do update set "
                        "granted_by=excluded.granted_by,reason=excluded.reason,granted_at=now(),"
                        "expires_at=excluded.expires_at",
                        operator,
                        args.environment,
                        args.tenant,
                        args.capability,
                        actor.email,
                        args.reason,
                        expires,
                    )
                else:
                    await con.execute(
                        "delete from operator_access where operator_id=$1 and environment=$2 "
                        "and tenant_slug=$3 and capability=$4",
                        operator,
                        args.environment,
                        args.tenant,
                        args.capability,
                    )
                await audit(
                    con,
                    actor,
                    args.tenant,
                    "access." + args.operation,
                    operator,
                    "ok",
                    str(uuid4()),
                    {"capability": args.capability, "reason": args.reason, "expires_at": expires.isoformat()},
                )
                result["applied"] = True
        return result
    finally:
        await con.close()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("operation", choices=["grant", "revoke"])
    parser.add_argument("--environment", required=True, choices=["development", "staging", "production"])
    parser.add_argument("--email", required=True)
    parser.add_argument("--tenant", required=True)
    parser.add_argument("--capability", required=True, choices=sorted(CAPABILITIES))
    parser.add_argument("--reason", required=True)
    parser.add_argument("--hours", type=int, choices=range(1, 721), default=8, metavar="1..720")
    parser.add_argument("--apply", action="store_true")
    try:
        result = asyncio.run(manage(parser.parse_args()))
    except Exception as exc:
        # Drivers can include DSNs in errors. Keep raw exceptions out of terminal and audit output.
        print(json.dumps({"ok": False, "error": type(exc).__name__}))
        return 1
    print(json.dumps({"ok": True, **result}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
