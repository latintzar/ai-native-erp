"""vital_demo_lineage.py — A DEMO TURN LEAVES NOTHING FOR THE LIVE MACHINERY TO EAT.

THE BUG THIS GATES (2026-08-09 adversarial verification of the live /demo, BUG 2). `lineage` was a
kwarg on `spine.append_event` defaulting to `'live'`, so all 155 call sites had to remember to pass
it on a test scope. Two did not — `lifecycle.py`'s STAGE_CHANGED and `duties.py`'s `tab.brief` — so
TWO OF EVERY EIGHT events one /demo turn wrote were tagged `lineage='live'`. `sweep.py`'s candidate
scan is `lane='world' and lineage='live'`, which made a stranger's throwaway world a production
fact-sweep candidate: `sweep_scope` on a demo scope returned `{'events': 6, 'facts_written': 3}` —
a Haiku call and three `fact` rows distilled out of a prospect's message, their drafted order and
the reply. Unmetered spend outside the 24 h ceiling, and retained text about somebody we never
promised to retain anything about.

The fix is structural, so the vital is too: it does not re-check the two call sites that happened to
be wrong (they will be right and stay right for the wrong reason), it checks the DERIVATION and the
CONSUMER.

  ① THE DERIVATION, at the spine. A `test.` scope writes `lineage='test'` — with no kwarg, with an
    explicit `lineage='live'`, and on the reasoning lane. A live scope is untouched by the change.
  ② THE TWO CALL SITES THAT WERE WRONG, driven for real: `lifecycle.observe` and a `duties` tab
    brief on a demo scope. Named because they are the regression, not because they are special.
  ③ A FULL DEMO TURN — the real mind, the real matcher — writes ZERO `lineage='live'` events.
    This is the assertion the finding is actually about: it counts what the turn WROTE rather than
    what any one module intended.
  ④ THE CONSUMER: `sweep_scope` on a demo scope is a NO-OP (skipped_test, not one fact, not one
    summary, no model call), and `sweep_once`'s candidate scan never offers it.
  ⑤ THE FENCE DOES NOT OVER-REACH: a live scope is still swept, and its events are still 'live'.

SAFETY: refuses the live `rocoto` DB. Point it at a rehearsal clone.
Run on prod as root:  PYTHONPATH=. venv/bin/python tests/vital_demo_lineage.py
"""
import asyncio
import os
import secrets
import sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

_DSN = os.environ.get("REHEARSAL_DSN")
if _DSN:
    for _k in ("DATABASE_URL", "RUNTIME_DATABASE_URL", "CONTROL_DATABASE_URL"):
        os.environ.setdefault(_k, _DSN)

for _l in Path("/opt/rocoto/.env").read_text().splitlines() if Path("/opt/rocoto/.env").exists() else []:
    _l = _l.strip()
    if _l and not _l.startswith("#") and "=" in _l:
        _k, _, _v = _l.partition("=")
        os.environ.setdefault(_k.strip(), _v.strip())

import config  # noqa: E402
import db  # noqa: E402
import demo_flow  # noqa: E402
import lifecycle  # noqa: E402
import spine  # noqa: E402
import sweep  # noqa: E402
import tenancy  # noqa: E402
from brain import golive  # noqa: E402

TEN = "vitaldemolineage"           # ltree label — letters only, no hyphen
LIVE_SCOPE = f"t.{TEN}.c.999001"   # the control: a NON-test scope in the same world
R = []


def ck(name, ok, detail=""):
    R.append(bool(ok))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


def guard_clone() -> None:
    """NEVER against production. This vital WRITES events and runs a real turn."""
    dsn = config.DATABASE_URL or ""
    tail = dsn.rsplit("/", 1)[-1].split("?")[0]
    if tail == "rocoto" or "rehearsal" not in tail:
        print(f"REFUSED: DATABASE_URL is not a rehearsal clone (db={tail!r}). "
              "source deploy/harness/rehearsal_env.sh first.")
        sys.exit(2)


SKUS = [
    {"code": "CH-01", "name": "Chorizo picante casero", "family": "embutidos", "unit": "kg", "price": 9.5},
    {"code": "QM-02", "name": "Queso manchego curado", "family": "quesos", "unit": "ud", "price": 12.0},
]
SENTENCE = "ponme 3 kg de chorizo picante casero y 2 quesos manchego curado"


async def _cleanup(scopes):
    async with db.get_pool().acquire() as con:
        sids = [r["sid"] for r in await con.fetch(
            "select sid from demo_sessions where tenant_slug=$1", TEN)]
        await con.execute("delete from demo_sessions where tenant_slug=$1", TEN)
    for s in sids:
        scopes = list(scopes) + [tenancy.demo_scope(s, TEN)]
    for scope in scopes:
        try:
            async with db.scoped_tx(scope) as con:
                for t in ("timer", "action", "open_loop", "fact", "card", "summary",
                          "sweep_state", "scope_state", "pending_turn", "event", "scope_node"):
                    await con.execute(f"delete from {t} where scope=$1::ltree", scope)
        except Exception:
            pass


async def _lineages(scope: str) -> dict[str, int]:
    """{lineage: count} for every event on a scope — both lanes. The whole assertion in ③ is a
    reading of this dict, so it deliberately does NOT filter anything."""
    async with db.scoped_tx(scope) as con:
        rows = await con.fetch(
            "select lineage, count(*) as n from event where scope=$1::ltree group by lineage", scope)
    return {str(r["lineage"]): int(r["n"]) for r in rows}


async def main():
    guard_clone()
    print("VITAL: demo lineage (a demo turn leaves nothing live behind)")
    await db.init()
    async with db.get_pool().acquire() as con:
        dbname = await con.fetchval("select current_database()")
    if dbname == "rocoto":
        raise SystemExit("REFUSING to run vitals against the LIVE 'rocoto' DB")
    print(f"  (db={dbname})")

    await demo_flow.ensure_demo_schema()
    await _cleanup([LIVE_SCOPE])
    async with db.get_pool().acquire() as con:
        await con.execute(
            "insert into tenants(slug,name,status,seeded,country) "
            "values($1,$2,'test',true,'ES') on conflict (slug) do nothing",
            TEN, "Vital — demo lineage")
    seeded = await golive.seed_catalogue(TEN, SKUS)
    ck("setup: the vital catalogue is in", bool(seeded.get("ok")), str(seeded)[:120])

    # ══ ① THE DERIVATION, AT THE SPINE ═══════════════════════════════════════════════════════════
    print("\n① lineage is derived from the scope, not from a kwarg")
    ck("spine.lineage_of: a `test.` scope is test",
       spine.lineage_of("test.demo.t.acme.abc") == "test")
    ck("spine.lineage_of: everything else is live",
       spine.lineage_of("t.acme.c.7") == "live" and spine.lineage_of("wa.34600") == "live"
       and spine.lineage_of("") == "live")
    ck("spine.lineage_of: 'testing.…' is NOT a test scope (the prefix is `test.`, with the dot)",
       spine.lineage_of("testing.acme") == "live")

    probe = f"test.demo.t.{TEN}.probe{secrets.token_hex(3)}"
    async with db.scoped_tx(probe) as con:
        await con.execute("insert into scope_node(scope,tier,tenant_slug,lineage) "
                          "values($1::ltree,'customer',$2,'test') on conflict do nothing", probe, TEN)
        a, _ = await spine.append_event(con, probe, "probe.default", "vital", {})
        b, _ = await spine.append_event(con, probe, "probe.explicit_live", "vital", {},
                                        lineage="live")
        c, _ = await spine.append_event(con, probe, "probe.reasoning", "vital", {},
                                        lane="reasoning", lineage="live")
        got = {int(r["id"]): str(r["lineage"]) for r in await con.fetch(
            "select id, lineage from event where scope=$1::ltree", probe)}
    ck("a no-kwarg append on a test scope is lineage='test'", got.get(a) == "test", str(got.get(a)))
    ck("AN EXPLICIT lineage='live' ON A TEST SCOPE IS OVERRIDDEN TO 'test' — the class of bug is "
       "gone, not the two instances of it", got.get(b) == "test", str(got.get(b)))
    ck("the reasoning lane is covered too", got.get(c) == "test", str(got.get(c)))

    async with db.scoped_tx(LIVE_SCOPE) as con:
        await con.execute("insert into scope_node(scope,tier,tenant_slug,lineage) "
                          "values($1::ltree,'customer',$2,'live') on conflict do nothing",
                          LIVE_SCOPE, TEN)
        lid, _ = await spine.append_event(con, LIVE_SCOPE, "message", "vital",
                                          {"text": "necesito 2 kg de chorizo picante casero"})
        llin = await con.fetchval("select lineage from event where id=$1", lid)
    ck("⑤ a LIVE scope is untouched: still lineage='live'", llin == "live", str(llin))

    # ══ ② THE TWO CALL SITES THAT WERE WRONG ═════════════════════════════════════════════════════
    print("\n② the two call sites the finding named")
    obs = await lifecycle.observe(probe)          # the REAL lifecycle.py:360, not a stand-in
    async with db.scoped_tx(probe) as con:
        stage = await con.fetchrow(
            "select id, lineage from event where scope=$1::ltree and type=$2 "
            "order by id desc limit 1", probe, lifecycle.STAGE_CHANGED)
    ck("lifecycle.observe emitted a stage change on the demo scope (the call site really ran)",
       bool(obs.get("changed")) and stage is not None, str(obs)[:120])
    ck("…and lifecycle.py:360's STAGE_CHANGED is lineage='test'",
       stage is not None and str(stage["lineage"]) == "test",
       str(stage and stage["lineage"]))

    # duties.py:361 needs a whole manifest row + a matching sense to reach for real (that is
    # vital_duties' job). What is asserted here is the STATEMENT that line executes, verbatim —
    # same type, same lane, same caused_by, same absent kwarg — because after the fix the call site
    # is no longer what decides. ① is the real gate; this is the named regression, kept nameable.
    async with db.scoped_tx(probe) as con:
        eid, _ = await spine.append_event(con, probe, "message", "vital", {"text": "hola"})
        brief_id, _ = await spine.append_event(
            con, probe, "tab.brief", "runtime",
            {"loop_id": 0, "verdict": "vigilar", "process": "vital"},
            caused_by=eid, lane="reasoning")
        blin = await con.fetchval("select lineage from event where id=$1", brief_id)
        bad = int(await con.fetchval(
            "select count(*) from event where scope=$1::ltree and lineage='live'", probe) or 0)
    ck("…and duties.py:361's tab.brief statement is lineage='test'", blin == "test", str(blin))
    ck("nothing at all on that demo scope is lineage='live'", bad == 0, f"{bad} live rows")

    # ══ ③ A FULL DEMO TURN ═══════════════════════════════════════════════════════════════════════
    print("\n③ a full demo turn (real mind, real matcher)")
    email = f"vital.lineage.{secrets.token_hex(4)}@{TEN}.es"
    out = await demo_flow.session_for_operator(email, TEN)
    async with db.get_pool().acquire() as con:
        await con.execute("update demo_sessions set catalog_ready=true where token=$1",
                          out["token"])
    row = await demo_flow.resolve(out["token"])
    scope = demo_flow.scope_of_row(row)
    turn = await demo_flow.chat(token=row["token"], text=SENTENCE, ip="10.0.0.9")

    # WHAT IS AND IS NOT A GATE HERE. The turn is REAL — real mind, real matcher, real writes — and
    # that is the point of ③: it counts what the turn actually WROTE rather than what any module
    # intended. But whether the model DRAFTS on a given call is a live-model coin flip (the same one
    # `eval_golden_call` is marked advisory for), and THE CLAIM UNDER TEST IS LINEAGE, NOT MATCHING.
    # So the draft is reported and not gated; the lineage properties are gated and hold either way,
    # because even a fallback turn writes the inbound message, the reasoning row and the reply.
    drafted = bool(turn.get("order"))
    _drew = ("drafted an order" if drafted else
             "did NOT draft this run — the lineage claims below do not depend on it")
    print(f"       (the model {_drew}: {str(turn.get('reply'))[:60]!r})")
    ck("the turn ran and the mind answered", bool((turn.get("reply") or "").strip()),
       str(turn)[:140])
    lin = await _lineages(scope)
    ck(f"THE CLAIM: a full demo turn writes ZERO lineage='live' events "
       f"(it wrote {sum(lin.values())} events in total)",
       lin.get("live", 0) == 0, str(lin))
    ck("…and it really did write some (a vacuous zero would pass the line above)",
       lin.get("test", 0) >= 2, str(lin))

    # THE `action` TABLE IS THE ONE THE SPINE DOES NOT COVER. `orders_tool.place_order` writes the
    # `lineage` column with its own INSERT, so the derivation moving into `append_event` does
    # nothing for it — `_lineage_of` (now delegating to `spine.lineage_of`) is what keeps it honest.
    # Only meaningful when the turn drafted, so it is asserted conditionally rather than skipped
    # silently: a park with lineage='live' would put a stranger's order on a real review sheet.
    async with db.scoped_tx(scope) as con:
        acts = [str(r["lineage"]) for r in await con.fetch(
            "select lineage from action where scope=$1::ltree", scope)]
    if acts:
        ck("every `action` row the turn opened is lineage='test' (orders_tool writes that column "
           "itself — the spine's derivation does not reach it)",
           all(a == "test" for a in acts), str(acts))
    else:
        print("       (no action rows this run — nothing was parked, so nothing to check)")

    # ══ ④ THE CONSUMER ═══════════════════════════════════════════════════════════════════════════
    print("\n④ the sweep cannot reach it")
    async with db.scoped_tx(scope) as con:
        facts_before = int(await con.fetchval(
            "select count(*) from fact where scope=$1::ltree", scope) or 0)
    res = await sweep.sweep_scope(db.control_pool(), scope)
    ck("sweep_scope on a demo scope is a NO-OP (status=skipped_test)",
       res.get("status") == "skipped_test", str(res))
    ck("…it did not distil anything (no `events`, no `facts_written` in the answer)",
       "facts_written" not in res and "events" not in res, str(res))
    async with db.scoped_tx(scope) as con:
        facts_after = int(await con.fetchval(
            "select count(*) from fact where scope=$1::ltree", scope) or 0)
        summaries = int(await con.fetchval(
            "select count(*) from summary where scope=$1::ltree", scope) or 0)
        watermark = await con.fetchval(
            "select watermark_event_id from sweep_state where scope=$1::ltree", scope)
    ck("…no fact row was written about the prospect's conversation",
       facts_after == facts_before, f"{facts_before} → {facts_after}")
    ck("…and no summary either", summaries == 0, str(summaries))
    ck("…and no watermark was advanced (nothing was consumed)", watermark is None, str(watermark))

    # the candidate scan: sweep_scope is replaced by a recorder so this costs no model calls
    seen: list[str] = []
    real_scope_sweep = sweep.sweep_scope

    async def _recorder(pool, sc):
        seen.append(sc)
        return {"scope": sc, "status": "skipped_empty"}

    sweep.sweep_scope = _recorder
    try:
        await sweep.sweep_once(db.control_pool())
    finally:
        sweep.sweep_scope = real_scope_sweep
    ck("sweep_once's candidate scan never OFFERS the demo scope",
       scope not in seen, f"{len(seen)} candidates")
    ck("⑤ …while the live scope in the same tenant IS still a candidate (the fence did not "
       "over-reach)", LIVE_SCOPE in seen, f"{len(seen)} candidates")

    await _cleanup([LIVE_SCOPE, probe, scope])
    print(f"\nvital_demo_lineage: {sum(R)}/{len(R)} green")
    if not all(R):
        raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())
