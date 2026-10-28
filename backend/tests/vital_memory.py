"""vital_memory.py — the Stream B deterministic-memory vitals (BUILD-PLAN 2.1/2.2 DoD).

Asserts: a said-once fact is recalled; an outdated value is NEVER served; a restatement drops;
a keyless COMMERCIAL fact is rejected; the card is byte-reproducible, capped, and excludes
non-eligible/invalidated facts. Runs against the rehearsal clone; refuses the live DB.
"""
from __future__ import annotations

import asyncio
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncpg  # noqa: E402

import memory  # noqa: E402

DSN = os.environ.get("REHEARSAL_DSN") or (sys.argv[1] if len(sys.argv) > 1 else "")
SCOPE = "t.memtest.c.1"
_results: list[tuple[str, bool, str]] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    _results.append((name, ok, detail))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


async def _prep(con):
    await con.set_type_codec("jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog")
    try:
        from pgvector.asyncpg import register_vector
        await register_vector(con)
    except Exception:
        pass


async def run() -> int:
    if not DSN:
        print("no DSN (set REHEARSAL_DSN)", file=sys.stderr)
        return 2
    con = await asyncpg.connect(DSN)
    await _prep(con)
    try:
        if await con.fetchval("select current_database()") == "rocoto":
            raise SystemExit("REFUSING to run against the live rocoto DB")
        await con.execute("delete from fact where scope=$1::ltree", SCOPE)
        await con.execute("delete from card where scope=$1::ltree", SCOPE)
        await con.execute("delete from dead_letter where source='extractor'")
        await con.execute("insert into scope_node(scope,tier,tenant_slug) values($1::ltree,'customer','memtest') on conflict do nothing", SCOPE)
        await con.execute("delete from contact where scope=$1::ltree", SCOPE)
        await con.execute("insert into contact(scope,tenant_slug,tier,display_name) values($1::ltree,'memtest','customer','Bar Manolo')", SCOPE)

        # V1 — a said-once fact is saved and recalled by exact key.
        r = await memory.write_fact(con, SCOPE, "COMMERCIAL", "jamón 3,20 €/kg", key="price:jamon")
        got = await memory.lookup_fact(con, SCOPE, "price:jamon")
        check("said-once fact saved + recalled by exact key", r["action"] == "inserted" and got == "jamón 3,20 €/kg")

        # V2 — an outdated value is NEVER served: a new value versions the fact, lookup serves current.
        r2 = await memory.write_fact(con, SCOPE, "COMMERCIAL", "jamón 3,00 €/kg", key="price:jamon")
        got2 = await memory.lookup_fact(con, SCOPE, "price:jamon")
        hist = await con.fetchval("select count(*) from fact where scope=$1::ltree and key='price:jamon' and invalid_at is not null", SCOPE)
        check("outdated value never served (versioned; old kept as history)",
              r2["action"] == "versioned" and got2 == "jamón 3,00 €/kg" and hist == 1,
              f"action={r2['action']} current={got2!r} history_rows={hist}")

        # V3 — a restatement (same value again) DROPS, no new row.
        n_before = await con.fetchval("select count(*) from fact where scope=$1::ltree and key='price:jamon'", SCOPE)
        r3 = await memory.write_fact(con, SCOPE, "COMMERCIAL", "jamón 3,00 €/kg", key="price:jamon")
        n_after = await con.fetchval("select count(*) from fact where scope=$1::ltree and key='price:jamon'", SCOPE)
        check("restatement drops (no duplicate row)", r3["action"] == "restated_drop" and n_before == n_after)

        # V4 — a COMMERCIAL fact WITHOUT a key is rejected to the dead-letter, never inserted.
        dl_before = await con.fetchval("select count(*) from dead_letter")
        r4 = await memory.write_fact(con, SCOPE, "COMMERCIAL", "le debe algo, no sé cuánto")
        dl_after = await con.fetchval("select count(*) from dead_letter")
        check("keyless COMMERCIAL rejected (never mint an unkeyed money fact)",
              r4["action"] == "rejected" and dl_after == dl_before + 1)

        # seed the rest of a real card + a non-eligible EVENT_FACT + an invalidated fact.
        await memory.write_fact(con, SCOPE, "CONSTRAINT", "el hijo es celíaco — nada con gluten", key="allergen:gluten")
        await memory.write_fact(con, SCOPE, "RHYTHM", "reparto los martes")
        await memory.write_fact(con, SCOPE, "PREFERENCE", "pide por nota de voz")
        await memory.write_fact(con, SCOPE, "EVENT_FACT", "un catering raro en marzo (40 kg)")
        old = await memory.write_fact(con, SCOPE, "PREFERENCE", "antes pedía por email")
        await con.execute("update fact set invalid_at=now() where id=$1", old["fact_id"])

        # V5 — the card is byte-reproducible + capped + excludes EVENT_FACT and invalidated facts.
        c1 = await memory.regen_card(con, SCOPE)
        c2 = await memory.regen_card(con, SCOPE)
        excludes_eventfact = "catering raro" not in c1["body"]
        excludes_invalid = "por email" not in c1["body"]
        has_pinned = "celíaco" in c1["body"] and "3,00" in c1["body"]
        check("card is byte-reproducible (same body, version increments)",
              c1["body"] == c2["body"] and c2["version"] == c1["version"] + 1)
        check("card ≤ budget (24 lines / 800 tok), no pinned overflow",
              c1["lines"] <= memory.CARD_LINE_CAP and c1["tokens"] <= memory.CARD_TOK_CAP and not c1["pinned_overflow"],
              f"lines={c1['lines']} tokens={c1['tokens']}")
        check("card excludes EVENT_FACT + invalidated facts, keeps pinned",
              excludes_eventfact and excludes_invalid and has_pinned)

    finally:
        await con.close()

    passed = sum(1 for _, ok, _ in _results if ok)
    total = len(_results)
    print(f"\nMemory vitals: {passed}/{total} passed")
    return 0 if passed == total else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(run()))
