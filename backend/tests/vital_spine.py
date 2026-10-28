"""vital_spine.py — the Stream A liveness vitals (BUILD-PLAN §0.6 ingest/apply_world_update rows).

Runs the event-spine organ vitals against a DB and prints PASS/FAIL per vital. Exit != 0 on any
failure — this is the CI gate for the sensing→append organ. SAFETY: refuses to run on the live
`rocoto` DB (it truncates the runtime tables to start clean); point it at rocoto_rehearsal.

Usage:  REHEARSAL_DSN=postgresql://…/rocoto_rehearsal  python tests/vital_spine.py
"""
from __future__ import annotations

import asyncio
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncpg  # noqa: E402

import spine  # noqa: E402


async def _prep(con: "asyncpg.Connection") -> None:
    """Register the SAME codecs the runtime pool uses (db._init_conn) so spine.py's dict→jsonb
    path is exercised exactly as in production."""
    await con.set_type_codec("jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog")
    try:
        from pgvector.asyncpg import register_vector
        await register_vector(con)
    except Exception:
        pass

DSN = os.environ.get("REHEARSAL_DSN") or (sys.argv[1] if len(sys.argv) > 1 else "")

RUNTIME_TABLES = [
    "timer", "open_loop", "pending_turn", "action", "fact", "card", "summary", "sweep_state",
    "endpoint", "contact_role", "contact", "scope_node", "scope_state", "dead_letter", "event",
]

_results: list[tuple[str, bool, str]] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    _results.append((name, ok, detail))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


async def _clean(con: asyncpg.Connection) -> None:
    dbname = await con.fetchval("select current_database()")
    if dbname == "rocoto":
        raise SystemExit("REFUSING to run vitals against the LIVE 'rocoto' DB — use rocoto_rehearsal")
    await con.execute("truncate " + ", ".join(RUNTIME_TABLES) + " restart identity cascade")


async def run() -> int:
    if not DSN:
        print("no DSN (set REHEARSAL_DSN)", file=sys.stderr)
        return 2
    con = await asyncpg.connect(DSN)
    await _prep(con)
    try:
        await _clean(con)

        # V1 — one inbound message = exactly ONE event + a pending_turn armed.
        r = await spine.ingest_chat(con, "vitaltest", "wa", "+34600000001", "hola, ¿tenéis jamón?")
        n_events = await con.fetchval("select count(*) from event where scope=$1::ltree", r["scope"])
        pend = await con.fetchval("select state::text from pending_turn where scope=$1::ltree", r["scope"])
        check("one inbound = exactly one event row", n_events == 1, f"events={n_events}")
        check("a conversational message arms the debounce", pend == "armed", f"pending={pend}")
        check("first contact bootstrapped as a new party", r["is_new_party"] is True)

        # V2 — atomic bootstrap wrote contact + scope_node + card + endpoint in one commit.
        c_ok = await con.fetchval("select count(*) from contact where scope=$1::ltree", r["scope"])
        sn_ok = await con.fetchval("select count(*) from scope_node where scope=$1::ltree", r["scope"])
        card_ok = await con.fetchval("select count(*) from card where scope=$1::ltree", r["scope"])
        ep_ok = await con.fetchval("select count(*) from endpoint where kind='wa' and addr='+34600000001'")
        check("bootstrap: contact+scope_node+card+endpoint all present",
              c_ok == 1 and sn_ok == 1 and card_ok == 1 and ep_ok == 1,
              f"contact={c_ok} scope_node={sn_ok} card={card_ok} endpoint={ep_ok}")

        # V3 — a second message on the same endpoint ATTACHES (no new party, no new contact).
        r2 = await spine.ingest_chat(con, "vitaltest", "wa", "+34600000001", "sí, 12 kg")
        check("repeat message attaches, never mints a second party",
              r2["is_new_party"] is False and r2["scope"] == r["scope"])

        # ── WEBHOOK LANE — scope resolved by the globally-unique provider_id via entity_map ──
        cust_scope = r["scope"]
        # WE created the invoice → record the creation-time mapping + seed the standing (unpaid) fact.
        await spine.record_entity_mapping(con, "stripe", "pi_221", cust_scope, "invoice:221")
        await con.execute(
            "insert into fact(scope,kind,text,key) values($1::ltree,'COMMERCIAL','factura 221 · 289€ · pendiente','invoice:221')",
            cust_scope)

        # V4 — a replayed webhook (same dedupe_key) writes ZERO new rows.
        w1 = await spine.ingest_webhook(con, "stripe", "stripe.payment", "pi_221",
                                        {"amount": 289}, canonical_key="invoice:221", dedupe_key="evt_pay_221")
        before = await con.fetchval("select count(*) from event")
        w2 = await spine.ingest_webhook(con, "stripe", "stripe.payment", "pi_221",
                                        {"amount": 289}, canonical_key="invoice:221", dedupe_key="evt_pay_221")
        after = await con.fetchval("select count(*) from event")
        check("replayed webhook (same dedupe_key) writes zero new rows",
              w1["is_new_event"] is True and w2["is_new_event"] is False and before == after,
              f"before={before} after={after}")

        # V5 — apply_world_update flipped the keyed invoice fact (bi-temporal, no LLM).
        old_fact = await con.fetchval(
            "select invalid_at is not null from fact where scope=$1::ltree and key='invoice:221' and text like '%pendiente%'",
            cust_scope)
        paid_fact = await con.fetchval(
            "select count(*) from fact where scope=$1::ltree and key='invoice:221' and invalid_at is null and text like '%pagada%'",
            cust_scope)
        check("apply_world_update flips the invoice fact (bi-temporal, no LLM)",
              old_fact is True and paid_fact == 1, f"old_invalidated={old_fact} paid_current={paid_fact}")

        # V6 — a webhook NEVER opens a debounce window.
        pend_before = await con.fetchval("select count(*) from pending_turn")
        await spine.record_entity_mapping(con, "stripe", "pi_777", cust_scope, "invoice:777")
        await con.execute("insert into fact(scope,kind,text,key) values($1::ltree,'COMMERCIAL','f777 pendiente','invoice:777')", cust_scope)
        await spine.ingest_webhook(con, "stripe", "stripe.payment", "pi_777", {"amount": 1}, canonical_key="invoice:777", dedupe_key="evt_777")
        pend_after = await con.fetchval("select count(*) from pending_turn")
        check("a webhook never opens a debounce window", pend_after == pend_before,
              f"pending_turns before={pend_before} after={pend_after}")

        # V7 — an unresolvable webhook (no mapping, unknown key) DEAD-LETTERS, no event.
        dl_before = await con.fetchval("select count(*) from dead_letter")
        ev_before = await con.fetchval("select count(*) from event")
        res = await spine.ingest_webhook(con, "stripe", "stripe.payment", "pi_unknown",
                                        {"amount": 1}, canonical_key="invoice:NOPE", dedupe_key="evt_nope")
        dl_after = await con.fetchval("select count(*) from dead_letter")
        ev_after = await con.fetchval("select count(*) from event")
        check("unresolvable webhook dead-letters, never a ghost contact / silent drop",
              res.get("dead_lettered") is True and dl_after == dl_before + 1 and ev_after == ev_before)

        # V8 — CROSS-TENANT SAFETY (the closed leak): two tenants share the human key 'invoice:500'.
        # The provider_id mapping routes each payment to the RIGHT tenant; an unmapped colliding key is
        # AMBIGUOUS → dead-letter, never leaked into an arbitrary tenant.
        scope_b = "t.vitaltest.c.777001"
        await con.execute("insert into scope_node(scope,tier,tenant_slug) values($1::ltree,'customer','vitaltest') on conflict do nothing", scope_b)
        await con.execute("insert into card(scope,body,version) values($1::ltree,'b',0) on conflict do nothing", scope_b)
        for sc, pid in ((cust_scope, "pi_A500"), (scope_b, "pi_B500")):
            await spine.record_entity_mapping(con, "stripe", pid, sc, "invoice:500")
            await con.execute("insert into fact(scope,kind,text,key) values($1::ltree,'COMMERCIAL','f500 pendiente','invoice:500')", sc)
        wa = await spine.ingest_webhook(con, "stripe", "stripe.payment", "pi_A500", {"amount": 1}, canonical_key="invoice:500", dedupe_key="evt_a500")
        b_still_unpaid = await con.fetchval("select count(*) from fact where scope=$1::ltree and key='invoice:500' and invalid_at is null and text like '%pendiente%'", scope_b)
        dl0 = await con.fetchval("select count(*) from dead_letter")
        amb = await spine.ingest_webhook(con, "stripe", "stripe.payment", None, {"amount": 1}, canonical_key="invoice:500", dedupe_key="evt_amb500")
        dl1 = await con.fetchval("select count(*) from dead_letter")
        check("per-tenant key routes by provider_id to the RIGHT tenant; ambiguous key dead-letters",
              wa["scope"] == cust_scope and b_still_unpaid == 1 and amb.get("dead_lettered") is True and dl1 == dl0 + 1,
              f"A={wa['scope']} B_unpaid={b_still_unpaid} ambiguous_dl={amb.get('dead_lettered')}")

        # V9 — world-update IDEMPOTENT ON OUTCOME: two distinct provider ids for one paid invoice
        # (charge.succeeded + payment_intent.succeeded) leave exactly ONE current 'pagada'.
        await con.execute("insert into fact(scope,kind,text,key) values($1::ltree,'COMMERCIAL','f600 pendiente','invoice:600')", cust_scope)
        await spine.record_entity_mapping(con, "stripe", "pi_600a", cust_scope, "invoice:600")
        await spine.record_entity_mapping(con, "stripe", "pi_600b", cust_scope, "invoice:600")
        await spine.ingest_webhook(con, "stripe", "stripe.payment", "pi_600a", {"amount": 1}, canonical_key="invoice:600", dedupe_key="evt_600a")
        await spine.ingest_webhook(con, "stripe", "stripe.payment", "pi_600b", {"amount": 1}, canonical_key="invoice:600", dedupe_key="evt_600b")
        paid600 = await con.fetchval("select count(*) from fact where scope=$1::ltree and key='invoice:600' and invalid_at is null and text like '%pagada%'", cust_scope)
        check("world-update idempotent on outcome (double payment -> one 'pagada')", paid600 == 1, f"pagada_current={paid600}")

        # V8 — race-safety: two concurrent first-events for the SAME new endpoint mint ONE party.
        pool = await asyncpg.create_pool(DSN, min_size=2, max_size=4, init=_prep)
        try:
            async def boot(c):
                async with pool.acquire() as cc:
                    return await spine.resolve_chat_scope(cc, "vitaltest", "wa", "+34699999999")
            a, b = await asyncio.gather(boot(1), boot(2))
            n_contacts = await con.fetchval("select count(*) from endpoint where kind='wa' and addr='+34699999999'")
            check("concurrent first-events mint exactly one party (race-safe bootstrap)",
                  a[0] == b[0] and n_contacts == 1, f"scopeA={a[0]} scopeB={b[0]} endpoints={n_contacts}")
        finally:
            await pool.close()

    finally:
        await con.close()

    passed = sum(1 for _, ok, _ in _results if ok)
    total = len(_results)
    print(f"\nSpine vitals: {passed}/{total} passed")
    return 0 if passed == total else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(run()))
