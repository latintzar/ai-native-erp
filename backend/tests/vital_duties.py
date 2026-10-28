"""vital_duties.py — the generic duty-binder organ vitals (SPEC §16.6 LAW: situations are DATA).

Proves the dissolution is REAL: there is no employment.py; the whole `chase_salary` situation lives in
a manifest_duty ROW; the generic binder (duties.py) opens/resolves its tab and folds its lifecycle via
the GENERIC spine.fold_lifecycle. The load-bearing vital is D7 — THE LITMUS: a BRAND-NEW situation
('chase_quote'), added as a row with ZERO Python, binds and fires exactly like the built-in one.

Runs against a DB; prints PASS/FAIL per vital; exit != 0 on any failure. SAFETY: refuses the live
`rocoto` DB (it truncates runtime tables). Point it at rocoto_rehearsal with schema_runtime.sql applied
(the chase_salary seed row must be present).

Usage:  REHEARSAL_DSN=postgresql://…/rocoto_rehearsal  python tests/vital_duties.py
"""
from __future__ import annotations

import asyncio
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncpg  # noqa: E402

import duties  # noqa: E402
import spine  # noqa: E402


async def _prep(con: "asyncpg.Connection") -> None:
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

TENANT = "t.vitalduty"
CREATOR = spine.scope_creator()

_results: list[tuple[str, bool, str]] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    _results.append((name, ok, detail))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


def _js(v):
    return v if isinstance(v, (list, dict)) else json.loads(v or "null")


async def _clean(con: asyncpg.Connection) -> None:
    if await con.fetchval("select current_database()") == "rocoto":
        raise SystemExit("REFUSING to run vitals against the LIVE 'rocoto' DB — use rocoto_rehearsal")
    await con.execute("truncate " + ", ".join(RUNTIME_TABLES) + " restart identity cascade")
    # manifest rows survive the truncate (config, not per-party memory) — but clean up test-added rows.
    await con.execute("delete from manifest_duty where scope=$1::ltree or name='chase_quote'", TENANT)
    duties.invalidate_cache()


# Patch the config pool for the standalone harness: duties.load_duties reads via db.control_pool();
# here we give it a pool that behaves like ctrl (the test DB has no RLS, so a plain pool sees all).
class _FakeDB:
    def __init__(self, pool):
        self._pool = pool

    def control_pool(self):
        return self._pool


async def run() -> int:
    if not DSN:
        print("no DSN (set REHEARSAL_DSN)", file=sys.stderr)
        return 2
    con = await asyncpg.connect(DSN)
    await _prep(con)
    pool = await asyncpg.create_pool(DSN, min_size=1, max_size=4, init=_prep)
    # duties imports `db` lazily inside load_duties; inject a stand-in so control_pool() → our pool.
    sys.modules["db"] = _FakeDB(pool)
    try:
        await _clean(con)

        # D1 — the situation is INSTALLED as data: the L1 seed row is present + shaped.
        seed = _js(await con.fetchval(
            "select gate_policy from manifest_duty where scope=$1::ltree and name='chase_salary'", CREATOR))
        ok_shape = bool(seed) and seed.get("opens_on", {}).get("event") == "employment.salary_failed" \
            and len(seed.get("rungs", [])) == 4 and seed.get("lifecycle", {}).get("transitions") \
            and seed.get("soul", {}).get("tier") == "boss"
        check("chase_salary installed as a DATA row (opens_on+rungs+lifecycle+soul)", ok_shape,
              f"present={bool(seed)}")

        # D2 — no employment.py exists (the module dissolved).
        import importlib.util
        check("employment.py is GONE (situation-named module forbidden)",
              importlib.util.find_spec("employment") is None
              and not os.path.exists(os.path.join(os.path.dirname(os.path.dirname(__file__)), "employment.py")))

        # D3 — the binder OPENS the tab from the row on the matching sense: contingencies from rungs,
        # first rung armed (arm-together), rearm chain derived from the rungs' own cadence.
        eid, _ = await spine.append_event(con, TENANT, "employment.salary_failed", "stripe",
                                          {"invoice_key": "F-1", "amount": 123.45})
        r = await duties.react_to_sense(con, TENANT, "employment.salary_failed",
                                        {"invoice_key": "F-1", "amount": 123.45}, opened_by_event=eid)
        tab = await con.fetchrow(
            "select id, contingencies, money, entity_key, answer_shape from open_loop "
            "where scope=$1::ltree and status='open'", TENANT)
        cont = _js(tab["contingencies"]) if tab else []
        by = {c.get("branch_id"): c for c in cont}
        timer = await con.fetchrow("select branch_id from timer where loop_id=$1 and state='armed'",
                                   tab["id"] if tab else 0)
        chain_ok = (by.get("r1_friendly", {}).get("rearm", {}).get("branch_id") == "r2_email"
                    and by.get("r2_email", {}).get("rearm", {}).get("after") == "10d"
                    and "rearm" not in by.get("r4_strike", {}))
        check("binder OPENS the tab from the row (4 contingencies, money, keyed, answer_shape)",
              tab is not None and len(cont) == 4 and tab["money"]
              and tab["entity_key"] == "salary:F-1" and tab["answer_shape"] == "money",
              f"contingencies={len(cont)}")
        check("first rung armed (arm-together) + rearm chain derived from row cadence",
              timer is not None and timer["branch_id"] == "r1_friendly" and chain_ok)
        check("personality rides the ROW: {amt} resolved, r2 email, r3/r4 gated",
              "(123.45 €)" in (by.get("r1_friendly", {}).get("action", {}).get("sentence") or "")
              and by.get("r2_email", {}).get("channel") == "email"
              and by.get("r3_final", {}).get("gated") is True and by.get("r4_strike", {}).get("gated") is True)

        # D4 — idempotent: a re-delivered failure re-finds the open tab (no 2nd ladder).
        r2 = await duties.react_to_sense(con, TENANT, "employment.salary_failed",
                                         {"invoice_key": "F-1", "amount": 123.45}, opened_by_event=eid)
        n_tabs = await con.fetchval(
            "select count(*) from open_loop where scope=$1::ltree and entity_key='salary:F-1'", TENANT)
        check("re-delivered sense = no-op (one tab per keyed matter)",
              r2["reacted"][0].get("already_open") is True and n_tabs == 1, f"tabs={n_tabs}")

        # D5 — the resolves_on sense resolves the tab + cancels every armed rung.
        peid, _ = await spine.append_event(con, TENANT, "employment.invoice_paid", "stripe",
                                           {"invoice_key": "F-1"})
        rr = await duties.react_to_sense(con, TENANT, "employment.invoice_paid",
                                         {"invoice_key": "F-1"}, opened_by_event=peid)
        armed_left = await con.fetchval("select count(*) from timer where loop_id=$1 and state='armed'",
                                        tab["id"])
        status = await con.fetchval("select status from open_loop where id=$1", tab["id"])
        check("resolves_on sense resolves the tab + cancels all armed rungs",
              rr["reacted"][0].get("resolved") is True and armed_left == 0 and status == "resolved",
              f"armed_left={armed_left} status={status}")

        # D6 — the lifecycle folds via the GENERIC spine.fold_lifecycle from the ROW's map:
        # trial → active → strike → (invoice_paid un-strikes) active → offboarded (terminal sticks).
        st0 = await duties.lifecycle_state(con, TENANT, "chase_salary")
        for t in ("employment.activated", "employment.struck"):
            await spine.append_event(con, TENANT, t, "test", {})
        st_strike = await duties.lifecycle_state(con, TENANT, "chase_salary")
        await spine.append_event(con, TENANT, "employment.invoice_paid", "test", {})
        st_back = await duties.lifecycle_state(con, TENANT, "chase_salary")
        await spine.append_event(con, TENANT, "employment.offboarded", "test", {})
        await spine.append_event(con, TENANT, "employment.activated", "test", {})  # ignored (terminal)
        st_end = await duties.lifecycle_state(con, TENANT, "chase_salary")
        check("lifecycle folds from the ROW map (trial→active→strike→active; terminal sticks)",
              st0["state"] == "trial" and st_strike["state"] == "strike"
              and st_back["state"] == "active" and st_end["state"] == "offboarded",
              f"{st0['state']}→{st_strike['state']}→{st_back['state']}→{st_end['state']}")

        # D7 — ⚑ THE §16.6 LITMUS ⚑ — a BRAND-NEW situation, added as a ROW with ZERO Python, binds
        # and fires exactly like the built-in one. 'chase_quote': a quote we sent, chased twice, closed
        # when the customer replies. No code names 'quote' anywhere in the runtime.
        await con.execute(
            "insert into manifest_duty(scope,name,gate_policy,created_by) values($1::ltree,'chase_quote',$2,'L1')",
            CREATOR,
            {"opens_on": {"event": "quote.sent", "key": "quote:{quote_id}"},
             "resolves_on": {"event": "quote.answered", "branch_id": "answered"},
             "tab": {"kind": "pending", "answer_shape": "yesno", "money": False,
                     "text": "Presupuesto {quote_id} enviado — esperando respuesta"},
             "rungs": [
                {"branch_id": "q1", "after": "2d", "gated": False, "trigger": "no reply +2d",
                 "sentence": "¿Pudiste ver el presupuesto {quote_id}? Cualquier duda te la resuelvo."},
                {"branch_id": "q2", "after": "3d", "gated": False, "trigger": "no reply +5d",
                 "sentence": "Te doy un toque por si acaso — sigo teniendo el presupuesto {quote_id} listo cuando quieras."}],
             "lifecycle": {"prefix": "quote.", "initial": "sent",
                           "transitions": {"quote.answered": "closed"}, "terminal": ["closed"]}})
        duties.invalidate_cache()
        qeid, _ = await spine.append_event(con, TENANT, "quote.sent", "app", {"quote_id": "Q-9"})
        await duties.react_to_sense(con, TENANT, "quote.sent", {"quote_id": "Q-9"}, opened_by_event=qeid)
        qtab = await con.fetchrow(
            "select id, contingencies, entity_key, money from open_loop where scope=$1::ltree "
            "and entity_key='quote:Q-9' and status='open'", TENANT)
        qcont = _js(qtab["contingencies"]) if qtab else []
        qby = {c.get("branch_id"): c for c in qcont}
        qtimer = await con.fetchval("select branch_id from timer where loop_id=$1 and state='armed'",
                                    qtab["id"] if qtab else 0)
        litmus_open = (qtab is not None and len(qcont) == 2 and qtab["money"] is False
                       and qby.get("q1", {}).get("rearm", {}).get("branch_id") == "q2"
                       and "{quote_id}" not in (qby.get("q1", {}).get("action", {}).get("sentence") or "")
                       and "Q-9" in (qby.get("q1", {}).get("action", {}).get("sentence") or "")
                       and qtimer == "q1")
        check("⚑ LITMUS: a NEW situation ('chase_quote') binds from a ROW alone — ZERO Python",
              litmus_open, f"tab={bool(qtab)} rungs={len(qcont)} timer={qtimer}")
        aeid, _ = await spine.append_event(con, TENANT, "quote.answered", "wa", {"quote_id": "Q-9"})
        await duties.react_to_sense(con, TENANT, "quote.answered", {"quote_id": "Q-9"}, opened_by_event=aeid)
        qstatus = await con.fetchval("select status from open_loop where id=$1", qtab["id"])
        qlife = await duties.lifecycle_state(con, TENANT, "chase_quote")
        check("⚑ LITMUS: the NEW situation resolves + folds its own lifecycle (row-only)",
              qstatus == "resolved" and qlife["state"] == "closed",
              f"status={qstatus} life={qlife['state']}")

        # D8 — a tenant-scoped row OVERRIDES the L1 default by name (per-tenant situation policy).
        await con.execute(
            "insert into manifest_duty(scope,name,gate_policy,created_by) values($1::ltree,'chase_salary',$2,'L1')",
            TENANT,
            {"opens_on": {"event": "employment.salary_failed", "key": "salary:{invoice_key}"},
             "resolves_on": {"event": "employment.invoice_paid", "branch_id": "paid"},
             "tab": {"kind": "pending", "text": "override"},
             "rungs": [{"branch_id": "solo", "after": "0s", "gated": False, "trigger": "t",
                        "sentence": "escalera del tenant{amt}"}],
             "lifecycle": {"prefix": "employment.", "initial": "trial",
                           "transitions": {"employment.activated": "active"}}})
        duties.invalidate_cache()
        oeid, _ = await spine.append_event(con, TENANT, "employment.salary_failed", "stripe",
                                           {"invoice_key": "F-2", "amount": 1.0})
        await duties.react_to_sense(con, TENANT, "employment.salary_failed",
                                    {"invoice_key": "F-2", "amount": 1.0}, opened_by_event=oeid)
        ocont = _js(await con.fetchval(
            "select contingencies from open_loop where scope=$1::ltree and entity_key='salary:F-2'", TENANT))
        check("tenant row OVERRIDES the L1 default by name",
              len(ocont) == 1 and ocont[0].get("branch_id") == "solo", f"rungs={len(ocont)}")
        await con.execute("delete from manifest_duty where scope=$1::ltree", TENANT)
        duties.invalidate_cache()

        # D9 — a duty whose row has NO rungs is a CONFIG HOLE → park needs_human (nothing dies silently).
        await con.execute(
            "insert into manifest_duty(scope,name,gate_policy,created_by) values($1::ltree,'broken_duty',$2,'L1')",
            CREATOR, {"opens_on": {"event": "broken.sense", "key": "b:{id}"}, "rungs": []})
        duties.invalidate_cache()
        beid, _ = await spine.append_event(con, TENANT, "broken.sense", "test", {"id": "x"})
        await duties.react_to_sense(con, TENANT, "broken.sense", {"id": "x"}, opened_by_event=beid)
        parked = await con.fetchval(
            "select count(*) from action where scope=$1::ltree and kind='duty_open' and needs_human "
            "and state='pending'", TENANT)
        await con.execute("delete from manifest_duty where name='broken_duty'")
        duties.invalidate_cache()
        check("a rungless duty row parks needs_human (nothing dies silently, §5)", parked == 1,
              f"parked={parked}")

    finally:
        await con.close()
        await pool.close()

    passed = sum(1 for _, ok, _ in _results if ok)
    total = len(_results)
    print(f"\nDuty-binder vitals: {passed}/{total} passed")
    return 0 if passed == total else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(run()))
