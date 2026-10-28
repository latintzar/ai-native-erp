"""vital_pursuit.py — BLOCK B2: THE LEAD-PURSUIT TAB (SPEC §4.1.1 "the lead-pursuit tab", §6, §16.6).

The 2026-07-25 call-bullshit audit's gap-1, in its own words: "All 5 live open tabs are matter-level;
no pursuit-shaped duty row; lifecycle stage transitions emit NO event a duty could open on; no respawn
machinery. Stage awareness = SOUL text only." This vital is the standing proof that all four are now
real, and that they are real AS DATA — there is no pursuit.py.

What it locks, in the order the machinery runs:
  P1  situations are DATA        — no pursuit.py; the pursuit is manifest_duty rows (kind='pursuit')
  P2  fresh contact -> pursuit   — the FIRST observation of a real relationship emits
                                   `lifecycle.stage_changed` and opens the standing tab, rungs armed
  P3  never on every turn        — re-observing an unmoved relationship emits NOTHING
  P4  stage flip -> resolve+open — the old pursuit resolves WITH the transition as its resolution,
                                   its armed rungs are cancelled, a fresh one opens, child-linked
  P5  exactly ONE open pursuit   — enforced by the DATABASE; a leak attempt fails LOUD (a raw insert
                                   raises; the binder parks needs_human and opens nothing)
  P6  the fold                   — the pursuit's reasoning output rides ON its tab line, BOTH mouths
  P7  the chain                  — parent_loop_id walks the whole respawn history

WHAT THIS VITAL DOES NOT OWN: whether `lifecycle.status()` derives the right stage from real state —
that is vital_lifecycle's contract, and P2 exercises it end to end through the real producer. The
later transitions are driven by handing `observe()` a derived-state object directly, because what B2
must prove is what happens when the derived state MOVES, not how it is derived.

Run on prod as root, against the rehearsal clone (phase 2, RLS-ON):
    source deploy/harness/rehearsal_env.sh
    PYTHONPATH=. venv/bin/python tests/vital_pursuit.py
"""
import asyncio
import json
import os
from pathlib import Path

for _l in Path("/opt/rocoto/.env").read_text().splitlines() if Path("/opt/rocoto/.env").exists() else []:
    _l = _l.strip()
    if _l and not _l.startswith("#") and "=" in _l:
        _k, _, _v = _l.partition("=")
        os.environ.setdefault(_k.strip(), _v.strip())

import asyncpg  # noqa: E402

import agent_reply  # noqa: E402
import assemble
import db
import duties
import lifecycle
import runtime
import spine
import voice_protocol

PHONE = "+34999002020"
SCOPE = runtime.scope_of(PHONE)
R = []


def ck(name, ok, detail=""):
    R.append(bool(ok))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


def _js(v):
    return v if isinstance(v, (list, dict)) else json.loads(v or "null")


def _boxes(**ticked):
    """A §6 checkbox set with the named boxes ticked (everything else false)."""
    return {b: bool(ticked.get(b)) for b in lifecycle.BOXES}


async def _tabs(con, status="open"):
    return await con.fetch(
        "select id, kind, text, status, entity_key, contingencies, parent_loop_id, resolution, "
        "       opened_at from open_loop where scope=$1::ltree and kind='pursuit' and status=$2 "
        "order by id", SCOPE, status)


async def main():
    await db.init()
    duties.invalidate_cache()

    # ── a clean relationship to watch grow (the clone is rebuilt per run; this makes reruns honest) ──
    async with db.scoped_tx(SCOPE) as con:
        await agent_reply._ensure_scope(con, SCOPE)
        await con.execute("delete from timer where scope=$1::ltree", SCOPE)
        await con.execute("delete from open_loop where scope=$1::ltree", SCOPE)
        await con.execute("delete from action where scope=$1::ltree", SCOPE)
        await con.execute("delete from event where scope=$1::ltree", SCOPE)
        await con.execute("update scope_state set lifecycle_sig=null where scope=$1::ltree", SCOPE)

    # ── P1 · SITUATIONS ARE DATA ────────────────────────────────────────────────────────────────
    import importlib.util
    backend = Path(__file__).resolve().parent.parent
    ck("no pursuit.py — the situation is not a module (§16.6 LAW)",
       importlib.util.find_spec("pursuit") is None and not (backend / "pursuit.py").exists())

    cfgs = await duties.load_duties(SCOPE)
    pursuits = {n: c for n, c in cfgs.items() if (c.get("tab") or {}).get("kind") == "pursuit"}
    shape_ok = bool(pursuits) and all(
        c.get("opens_on", {}).get("event") == lifecycle.STAGE_CHANGED
        and c.get("opens_on", {}).get("when", {}).get("stage")
        and c.get("resolves_on", {}).get("event") == lifecycle.STAGE_CHANGED
        and c.get("resolves_on", {}).get("by") == "kind"
        and c.get("rungs") and (c.get("tab") or {}).get("brief")
        for c in pursuits.values())
    ck("the pursuit is manifest_duty ROWS keyed on the lifecycle transition (opens/resolves/rungs/brief)",
       shape_ok, f"rows={sorted(pursuits)}")

    # ── P2 · A FRESH CONTACT'S FIRST OBSERVATION OPENS THE PURSUIT (the REAL producer) ──────────
    async with db.scoped_tx(SCOPE) as con:
        await spine.append_event(con, SCOPE, "message", "wa", {"text": "hola, ¿qué sois?"})
    st_real = await lifecycle.status(SCOPE, "prospect")
    res = await lifecycle.observe(SCOPE, "prospect")
    ck("the real derived stage of a new contact that just wrote is 'prospect' (the producer works)",
       st_real.get("stage") == "prospect", f"stage={st_real.get('stage')}")
    ck("the FIRST observation emits `lifecycle.stage_changed` (the family the audit found missing)",
       res.get("changed") is True and res.get("event_id"),
       f"res={ {k: v for k, v in res.items() if k != 'reacted'} }")

    async with db.scoped_tx(SCOPE) as con:
        ev = await con.fetchrow(
            "select id, lane, payload from event where scope=$1::ltree and type=$2 order by id",
            SCOPE, lifecycle.STAGE_CHANGED)
        rows = await _tabs(con)
        first_tab = rows[0] if rows else None
        armed = await con.fetch(
            "select branch_id, state from timer where loop_id=$1", int(first_tab["id"])) if first_tab else []
    p = _js(ev["payload"]) if ev else {}
    ck("the transition event is WORLD-lane and carries the whole transition as flat slots",
       ev is not None and ev["lane"] == "world" and p.get("stage") == "prospect"
       and p.get("first") is True and p.get("objective") and p.get("text"),
       f"lane={(ev or {}).get('lane')} stage={p.get('stage')}")
    conts = _js(first_tab["contingencies"]) if first_tab else []
    ck("⚑ a fresh contact carries a STANDING pursuit tab, opened by the transition",
       first_tab is not None and first_tab["kind"] == "pursuit"
       and first_tab["entity_key"].startswith("pursuit:prospect:"),
       f"tab={first_tab['id'] if first_tab else None} key={(first_tab or {}).get('entity_key')}")
    ck("its text states THE STAGE'S OBJECTIVE (spliced from the §6 checkbox job, not duplicated)",
       first_tab is not None and "SEGUIMIENTO DE LA RELACIÓN" in first_tab["text"]
       and (p.get("objective") or "@@") in first_tab["text"])
    ck("it chases per the stage's cadence: every rung pre-armed, the first rung armed (arm-together)",
       len(conts) == 3 and [t["state"] for t in armed].count("armed") == 1
       and armed[0]["branch_id"] == conts[0]["branch_id"],
       f"rungs={len(conts)} armed={[dict(t) for t in armed]}")

    # ── P3 · NEVER ON EVERY TURN ───────────────────────────────────────────────────────────────
    again = [await lifecycle.observe(SCOPE, "prospect") for _ in range(3)]
    async with db.scoped_tx(SCOPE) as con:
        n_ev = await con.fetchval("select count(*) from event where scope=$1::ltree and type=$2",
                                  SCOPE, lifecycle.STAGE_CHANGED)
        n_open = await con.fetchval("select count(*) from open_loop where scope=$1::ltree "
                                    "and kind='pursuit' and status='open'", SCOPE)
    ck("an UNMOVED relationship emits nothing — idempotent, never once per turn",
       all(a.get("changed") is False for a in again) and n_ev == 1 and n_open == 1,
       f"stage_changed_events={n_ev} open_pursuits={n_open}")

    # ── P4 · STAGE FLIP → OLD RESOLVES, NEW OPENS, CHILD-LINKED ────────────────────────────────
    st_onb = {"tier": "customer", "stage": "onboarded", "is_founder": False, "has_catalogue": True,
              "boxes": _boxes(call_done=True, skus_uploaded=True, flow_done=True)}
    flip = await lifecycle.observe(SCOPE, "customer", st=st_onb)
    async with db.scoped_tx(SCOPE) as con:
        old = await con.fetchrow("select status, resolution, resolved_at from open_loop where id=$1",
                                 int(first_tab["id"]))
        old_armed = await con.fetchval("select count(*) from timer where loop_id=$1 and state='armed'",
                                       int(first_tab["id"]))
        openrows = await _tabs(con)
        new_tab = openrows[-1] if openrows else None
    resn = _js(old["resolution"]) if old else {}
    ck("the stage flip emits a SECOND transition (from_stage recorded)",
       flip.get("changed") is True and flip.get("from"), f"from={flip.get('from')} to={flip.get('sig')}")
    ck("⚑ the OLD pursuit resolves WITH the transition as its resolution",
       old is not None and old["status"] == "resolved"
       and resn.get("by_event") == lifecycle.STAGE_CHANGED
       and (resn.get("transition") or {}).get("from_stage") == "prospect"
       and (resn.get("transition") or {}).get("stage") == "onboarded",
       f"status={(old or {}).get('status')} resolution={resn}")
    ck("resolving cancels its armed rungs (a late fire finds a closed tab)", old_armed == 0,
       f"armed_left={old_armed}")
    ck("⚑ a FRESH pursuit opens for the NEW stage, child-linked to the one it replaced",
       new_tab is not None and int(new_tab["id"]) != int(first_tab["id"])
       and new_tab["parent_loop_id"] == int(first_tab["id"])
       and new_tab["entity_key"].startswith("pursuit:onboarded:"),
       f"new={(new_tab or {}).get('id')} parent={(new_tab or {}).get('parent_loop_id')}")
    ck("still exactly ONE open pursuit after the respawn", len(openrows) == 1, f"open={len(openrows)}")

    # ── P5 · EXACTLY ONE OPEN PURSUIT — ENFORCED, AND A LEAK ATTEMPT FAILS LOUD ─────────────────
    raised = ""
    try:
        async with db.scoped_tx(SCOPE) as con:
            await con.execute(
                "insert into open_loop(scope,kind,text,status) values($1::ltree,'pursuit','leak','open')",
                SCOPE)
    except asyncpg.UniqueViolationError as e:
        raised = getattr(e, "constraint_name", "") or "unique_violation"
    except Exception as e:                     # any other error is NOT the invariant doing its job
        raised = f"WRONG:{type(e).__name__}"
    ck("⚑ a raw second open pursuit is REFUSED by the database (never a leak)",
       raised == "ux_loop_one_pursuit", f"raised={raised or 'nothing — THE INDEX IS MISSING'}")

    # …and the binder's own attempt parks needs_human LOUDLY instead of dying in a log line. A payload
    # that enters 'onboarded' again with a different next box is a NEW key (so the keyed idempotency
    # check lets it through) while declaring no from_stage (so nothing resolves first) — precisely the
    # shape that would otherwise leak a second standing tab.
    leak_payload = {"stage": "onboarded", "next_box": "live", "objective": "x", "from_label": "y"}
    async with db.scoped_tx(SCOPE) as con:
        eid, _ = await spine.append_event(con, SCOPE, lifecycle.STAGE_CHANGED, "test",
                                          {**leak_payload, "text": "leak attempt"})
        leak = await duties.react_to_sense(con, SCOPE, lifecycle.STAGE_CHANGED, leak_payload,
                                           opened_by_event=eid)
        n_open2 = await con.fetchval("select count(*) from open_loop where scope=$1::ltree "
                                     "and kind='pursuit' and status='open'", SCOPE)
        parked = await con.fetchrow(
            "select reason, needs_human, state from action where scope=$1::ltree and kind='duty_open' "
            "order by id desc limit 1", SCOPE)
    blocked = any(x.get("blocked") for x in leak.get("reacted", []))
    ck("⚑ the BINDER's leak attempt opens nothing and PARKS needs_human (nothing dies silently, §5)",
       blocked and n_open2 == 1 and parked is not None and parked["needs_human"]
       and parked["state"] == "pending",
       f"blocked={blocked} open={n_open2} parked={dict(parked) if parked else None}")

    # ── P6 · THE PURSUIT'S REASONING OUTPUT RIDES THE FOLD — BOTH MOUTHS ───────────────────────
    async with db.scoped_tx(SCOPE) as con:
        brief_ev = await con.fetchrow(
            "select lane, payload from event where scope=$1::ltree and type='tab.brief' "
            "order by id desc limit 1", SCOPE)
        verdicts = await assemble.tab_reasoning(con, SCOPE, [int(new_tab["id"])])
        fold = await assemble.assemble(con, SCOPE, "")
        vtabs = await voice_protocol.pinned_tabs(con, SCOPE)
    bp = _js(brief_ev["payload"]) if brief_ev else {}
    ck("the open-time brief is a REASONING-lane event bound to the tab by loop_id",
       brief_ev is not None and brief_ev["lane"] == "reasoning"
       and int(bp.get("loop_id") or 0) == int(new_tab["id"]) and bp.get("verdict"),
       f"lane={(brief_ev or {}).get('lane')} loop_id={bp.get('loop_id')}")
    verdict = verdicts.get(int(new_tab["id"]), "")
    ck("tab_reasoning binds it back to the pursuit (the B1 advisor read)", bool(verdict), verdict[:70])
    rendered = fold.get("rendered", "")
    tabs_slot = rendered.split(assemble.COMPONENTS["tabs"], 1)[-1].split("\n### ", 1)[0]
    ck("⚑ CHAT fold: the verdict renders ON the pursuit's own line, inside ### OPEN TABS",
       f"#{new_tab['id']}" in tabs_slot and "↳ lo que ya has razonado sobre esto" in tabs_slot
       and verdict[:40] in tabs_slot, f"slot_bytes={len(tabs_slot)}")
    vt = next((t for t in vtabs if int(t["id"]) == int(new_tab["id"])), None)
    vblock = voice_protocol._grounding_block("", {}, vtabs)
    ck("⚑ VOICE fold: the same verdict rides the same tab in the pinned grounding (one checklist)",
       vt is not None and (vt.get("verdict") or "") == verdict
       and verdict[:40] in vblock and assemble.COMPONENTS["tabs"] in vblock)
    ck("the pursuit rides alongside the stage it belongs to (LIFECYCLE slot present, no drift)",
       "fase=" in (fold.get("lifecycle_block") or ""))

    # ── P7 · THE CHAIN IS INSPECTABLE ──────────────────────────────────────────────────────────
    async with db.scoped_tx(SCOPE) as con:
        chain = await con.fetch(
            "with recursive c as ("
            "  select id, parent_loop_id, status from open_loop where id=$1 "
            "  union all select l.id, l.parent_loop_id, l.status from open_loop l join c on l.id=c.parent_loop_id"
            ") select id, status from c order by id", int(new_tab["id"]))
    ck("the respawn chain walks back through parent_loop_id (resolved parent, open child)",
       len(chain) == 2 and [r["status"] for r in chain] == ["resolved", "open"],
       f"chain={[dict(r) for r in chain]}")

    passed = sum(1 for x in R if x)
    print(f"\nLead-pursuit vitals: {passed}/{len(R)} passed")
    return 0 if passed == len(R) else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
