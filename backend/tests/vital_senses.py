"""vital_senses.py — WP-7 SENSES contract (BUILD-PLAN §5 WP-7): each business webhook = exactly ONE
event; an unresolvable/bad one DEAD-LETTERS (never a silent drop, never a crash); a replay writes 0 rows.
(The resolvable-payment path + cascade is proven in vital_stripe_spine; this proves the failure contract.)
"""
import asyncio
import os
from pathlib import Path

for _l in Path("/opt/rocoto/.env").read_text().splitlines() if Path("/opt/rocoto/.env").exists() else []:
    _l = _l.strip()
    if _l and not _l.startswith("#") and "=" in _l:
        _k, _, _v = _l.partition("=")
        os.environ.setdefault(_k.strip(), _v.strip())

import agent_reply
import db
import runtime
import spine  # noqa: E402

PHONE = "+34999001010"
SCOPE = runtime.scope_of(PHONE)
R = []


def ck(name, ok, detail=""):
    R.append(bool(ok)); print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


async def main():
    await db.init()
    async with db.scoped_tx(SCOPE) as con:
        await agent_reply._ensure_scope(con, SCOPE)
        await con.execute("delete from event where scope=$1::ltree", SCOPE)
        await con.execute("delete from entity_map where scope=$1::ltree", SCOPE)
        # a resolvable sense (entity_map seeded) → exactly one event
        await spine.record_entity_mapping(con, "medusa", "ord_1", SCOPE, "order:m1")
        r1 = await spine.ingest_webhook(con, "medusa", "medusa.paid", "ord_1", {"amt": 10}, dedupe_key="m1")
        r1b = await spine.ingest_webhook(con, "medusa", "medusa.paid", "ord_1", {"amt": 10}, dedupe_key="m1")
        n_evt = await con.fetchval("select count(*) from event where scope=$1::ltree and type='medusa.paid'", SCOPE)
    ck("a resolvable business webhook = exactly ONE event; a replay writes 0 new rows",
       r1.get("is_new_event") is True and r1b.get("is_new_event") is False and n_evt == 1, f"n_evt={n_evt}")

    # an UNRESOLVABLE webhook (no entity_map) → dead-letter, no crash, no event
    async with db.control_pool().acquire() as con:
        before = await con.fetchval("select count(*) from dead_letter")
    async with db.scoped_tx(SCOPE) as con:
        r2 = await spine.ingest_webhook(con, "hermes", "hermes.transcript", "unknown_xyz", {"t": "hola"}, dedupe_key="h1")
    async with db.control_pool().acquire() as con:
        after = await con.fetchval("select count(*) from dead_letter")
    ck("an unresolvable webhook DEAD-LETTERS (never a silent drop, never a crash)",
       r2.get("dead_lettered") is True and after == before + 1, f"dl {before}->{after}")

    async with db.scoped_tx(SCOPE) as con:
        await con.execute("delete from event where scope=$1::ltree", SCOPE)
        await con.execute("delete from entity_map where scope=$1::ltree", SCOPE)
        await con.execute("delete from scope_node where scope=$1::ltree", SCOPE)
    passed = sum(R)
    print(f"\nSENSES: {passed}/{len(R)} passed — {'ONE EVENT / DEAD-LETTER ON BAD' if passed == len(R) else 'BROKEN'}")
    return 0 if passed == len(R) else 1


raise SystemExit(asyncio.run(main()))
