"""vital_assemble.py — the bounded-turn vitals (BUILD-PLAN 3.1 DoD).

Asserts: assembly is byte-reproducible (same pinned inputs → same why_hash); context stays BOUNDED
by construction as history grows (300 events → still ≤ budget, with an elision sentinel); the §4.1
RECENCY WINDOW is a real TIME bound (events older than the 7-day span simply are not there — B1);
the card, recent window, and open tabs are all present. Rehearsal clone only; refuses the live DB.
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncpg  # noqa: E402

import assemble  # noqa: E402

DSN = os.environ.get("REHEARSAL_DSN") or (sys.argv[1] if len(sys.argv) > 1 else "")
SCOPE = "t.asmtest.c.1"
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
    # set the RLS scope GUC (cr-auth forced RLS on scope_node) so raw-conn inserts pass
    await con.execute("select set_config('rocoto.scope', $1, false)", SCOPE)
    try:
        if await con.fetchval("select current_database()") == "rocoto":
            raise SystemExit("REFUSING to run against the live rocoto DB")
        for tbl in ("event", "open_loop", "timer", "card", "contact", "scope_node"):
            await con.execute(f"delete from {tbl} where scope=$1::ltree", SCOPE)

        await con.execute("insert into scope_node(scope,tier,tenant_slug) values($1::ltree,'customer','asmtest') on conflict do nothing", SCOPE)
        await con.execute("insert into card(scope,body,version) values($1::ltree,$2,3)", SCOPE,
                          "FICHA · Bar Prueba · customer\n— Seguridad: sin gluten [fijo]\n— Comercial: jamón 3,00 €/kg [fijo]")
        # a heavy history — 300 hourly events ENDING at the pinned clock (12.5 days of history, so
        # the last ~168 fall inside the §4.1 7-day window and the rest are outside it: the same seed
        # stresses BOTH the token budget and the time bound).
        pinned = datetime(2026, 6, 1, tzinfo=timezone.utc)
        base = pinned - timedelta(hours=300)
        for i in range(300):
            await con.execute(
                "insert into event(scope,ts,type,source,payload) values($1::ltree,$2,'message','wa',$3)",
                SCOPE, base + timedelta(hours=i), {"text": f"mensaje número {i} sobre el pedido de esta semana"})
        # one open tab with a pre-armed contingency.
        loop_id = await con.fetchval(
            "insert into open_loop(scope,kind,text,entity_key,contingencies,due_at) "
            "values($1::ltree,'order','pedido de jamón pendiente de confirmar','order:A1',$2,$3) returning id",
            SCOPE, [{"branch_id": "confirma", "trigger": "sí"}], base + timedelta(days=2))

        # V1 — byte-reproducible with the SAME pinned assembled_at.
        a1 = await assemble.assemble(con, SCOPE, burst_text="¿me lo confirmas?", assembled_at=pinned)
        a2 = await assemble.assemble(con, SCOPE, burst_text="¿me lo confirmas?", assembled_at=pinned)
        check("assembly is byte-reproducible (same why_hash)", a1["why_hash"] == a2["why_hash"],
              f"h1={a1['why_hash'][:12]} h2={a2['why_hash'][:12]}")

        # V2 — bounded by construction: 300 events in the store, assembled context still capped at
        # ~(card+window+tabs) budgets and elided — it does NOT grow with history.
        total_events = await con.fetchval("select count(*) from event where scope=$1::ltree", SCOPE)
        budget_ceiling = assemble.CARD_BUDGET + assemble.WINDOW_BUDGET + assemble.TABS_BUDGET + 200
        elided = any("no mostrados" in x for x in a1["window"])
        check("context BOUNDED by construction as history grows",
              total_events == 300 and a1["tokens"] <= budget_ceiling and elided,
              f"store_events={total_events} tokens={a1['tokens']} ceiling={budget_ceiling} elided={elided}")

        # V2b (B1) — the window is a TIME bound, not just a tail: nothing older than the 7-day span
        # is in the fold at all (no open tab here reaches further back, so the plain span binds).
        shown_idx = [int(x.split("mensaje número ")[1].split(" ")[0])
                     for x in a1["window"] if "mensaje número" in x]
        oldest_in_window = 300 - 168      # events at index < this are >7 days before the pinned clock
        check("§4.1 window is a real 7-DAY TIME bound (older events are absent, not merely trimmed)",
              bool(shown_idx) and min(shown_idx) >= oldest_in_window,
              f"oldest_shown={min(shown_idx) if shown_idx else '-'} bound_index={oldest_in_window}")

        # V3 — the card, the recent window, and the open tab are all present.
        r = a1["rendered"]
        check("card + window + open tab all present in the payload",
              "Bar Prueba" in r and "sin gluten" in r and "RECENT HISTORY" in r
              and "order:A1" in r and "confirma" in r)

        # V4 — the window is chronological (older message index before newer) among what's shown.
        shown = [x for x in a1["window"] if "mensaje número" in x]
        idxs = [int(x.split("mensaje número ")[1].split(" ")[0]) for x in shown]
        check("window is chronological (oldest-first among shown)", idxs == sorted(idxs),
              f"first={idxs[0] if idxs else '-'} last={idxs[-1] if idxs else '-'}")

    finally:
        await con.close()

    passed = sum(1 for _, ok, _ in _results if ok)
    total = len(_results)
    print(f"\nAssembly vitals: {passed}/{total} passed")
    return 0 if passed == total else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(run()))
