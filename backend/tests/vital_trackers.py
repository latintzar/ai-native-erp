"""vital_trackers.py — BLOCK C: TRACKERS / VIGILANCIAS (SPEC §5.6, §16.6 LAW, BUILD-PLAN C1–C5).

The claim under test, in one line: **the supplier gets a standing watch BY TALKING, and everything
that makes that true is DATA plus machinery that already existed.**

What it locks, in the order the machinery runs:
  T1  SITUATIONS ARE DATA     — a tracker is ONE `manifest_duty` row carrying its whole self; there is
                                no module named after any tracker, and `trackers.py` names none.
  T2  THE TIER GATE           — `draft_tracker` + `create_tracker` are in a BOSS turn's tool set and
                                STRUCTURALLY ABSENT from a customer's — asserted on the tool list the
                                model actually receives, not on a refusal at call time.
  T3  THE HOOKS ARE REAL      — the menu is introspected from what this world really emits / already
                                binds / has wired, and it rides INSIDE the tool description.
  T4  CREATION SESSIONS ARE TABS — an `open_loop` kind='creation', goal-bearing, draft on the tab, its
                                playback rendering on the tab's own line in the fold.
  T5  THE SPLICE              — while that tab is open, ONE session line rides the MARCO frame on BOTH
                                mouths; when it resolves the line is GONE. The tab IS the mode.
  T6  SELF-RESOLVE ON BIND    — the session closes exactly when the row binds (resolution = the row),
                                never before: an incomplete draft is refused and the session stays.
  T7  EDIT = A CHILD TAB      — reopening links to the previous session by `parent_loop_id`, same duty.
  T8  IT BINDS FROM ITS ROW   — the arm opens the watch tab with a live clock, and a REAL worker tick
                                fires it to the BOSS and RE-ARMS ITSELF (the recurrence, as row data).
  T9  TWO SOURCES, ONE REGISTRY — a user watch is visible from birth; a rocoto watch is INVISIBLE while
                                it is merely running (counted, not listed) and SURFACES as a suggestion
                                carrying its action verbs the moment it reaches something decidable.
  T10 THE REGISTRY API        — list (duty + live tabs + last fired + next timer) · pause/enable ·
                                create · the draft-state read the widget card needs.
  T11 THE LADDER              — a watch installed on the whole business BINDS inside a customer's own
                                conversation (nearer row wins), which is what "ámbito: todo el negocio"
                                has to mean to be true.

WHAT THIS VITAL DOES NOT OWN: whether the mind CHOOSES to call the tools (a model judgement — the
golden-call eval's business), and the outbound gate itself (vital_gate). Every LLM here is stubbed:
the mind (to capture the exact system+tools bytes) and the worker's T1 VERIFY (to make the clock's
verdict deterministic) — the machinery under test is not a model.

Run on the RLS-ON clone (phase 2):
    source deploy/harness/rehearsal_env.sh
    PYTHONPATH=. venv/bin/python tests/vital_trackers.py
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

import agent_reply  # noqa: E402
import app as app_mod  # noqa: E402
import assemble as assemble_mod  # noqa: E402
import db  # noqa: E402
import duties  # noqa: E402
import ops  # noqa: E402
import presence  # noqa: E402
import runtime  # noqa: E402
import spine  # noqa: E402
import trackers  # noqa: E402
import worker  # noqa: E402

BOSS_PHONE = "+34999003030"
BOSS_SCOPE = runtime.scope_of(BOSS_PHONE)
CUST_PHONE = "+34999003031"
CUST_SCOPE = runtime.scope_of(CUST_PHONE)
TENANT_SCOPE = "t.vitaltrk"
TENANT_CUST = "t.vitaltrk.c.7001"

R = []


def ck(name, ok, detail=""):
    R.append(bool(ok))
    print("  [%s] %s%s" % ("PASS" if ok else "FAIL", name, (" — " + detail) if detail else ""))


# ── a captured mind: the exact system + tools the model would have received ────────────────────
class FakeMind:
    """Stands in for anthropic.AsyncAnthropic inside agent_reply._run_mind, recording every kwarg."""

    def __init__(self):
        self.calls = []
        outer = self

        class _Blk:
            type = "text"
            text = "Vale, apuntado."

        class _Resp:
            content = [_Blk()]

        class _M:
            async def create(self, **kw):
                outer.calls.append(kw)
                return _Resp()

        self.messages = _M()

    def __call__(self, *a, **kw):
        return self


class _AnthropicShim:
    def __init__(self, fake):
        self.AsyncAnthropic = fake


def _sys_of(kw):
    s = kw.get("system", "")
    if isinstance(s, str):
        return s
    return "\n\n".join(b.get("text", "") if isinstance(b, dict) else str(b) for b in (s or []))


async def _turn(phone, text, dedupe):
    """One REAL run_turn with the mind captured. Returns (system_bytes, tool_names)."""
    fake = FakeMind()
    orig = agent_reply.anthropic
    agent_reply.anthropic = _AnthropicShim(fake)
    try:
        await runtime.run_turn(phone, text, dedupe_key=dedupe)
    finally:
        agent_reply.anthropic = orig
    if not fake.calls:
        return "", []
    kw = fake.calls[0]
    return _sys_of(kw), [t.get("name") for t in (kw.get("tools") or [])]


async def _clean(scope):
    async with db.scoped_tx(scope) as con:
        for t in ("action", "timer", "wake", "pending_turn", "open_loop", "event", "fact", "summary",
                  "card", "scope_state", "assembly_snapshot", "standing_instruction",
                  "manifest_duty"):
            try:
                await con.execute("delete from %s where scope=$1::ltree" % t, scope)
            except Exception:
                pass
    duties.invalidate_cache(scope)
    trackers.invalidate_hooks(scope)
    app_mod._VOICE_PINS.pop(scope, None)


async def _ensure(scope, tier, tenant=""):
    async with db.scoped_tx(scope) as con:
        await agent_reply._ensure_scope(con, scope)
        await con.execute("insert into scope_node(scope,tier,tenant_slug) values($1::ltree,$2,$3) "
                          "on conflict (scope) do update set tier=excluded.tier, "
                          "tenant_slug=coalesce(excluded.tenant_slug, scope_node.tenant_slug)",
                          scope, tier, tenant or None)


async def _tabs(scope, kind=None, status="open"):
    async with db.control_pool().acquire() as con:
        if kind:
            return await con.fetch(
                "select id, kind, text, status, entity_key, resume_ref, resolution, parent_loop_id "
                "from open_loop where scope=$1::ltree and kind=$2 and status=$3 order by id",
                scope, kind, status)
        return await con.fetch(
            "select id, kind, text, status, entity_key, resume_ref, resolution, parent_loop_id "
            "from open_loop where scope=$1::ltree and status=$2 order by id", scope, status)


def _js(v, default=None):
    if isinstance(v, (dict, list)):
        return v
    try:
        return json.loads(v)
    except Exception:
        return default


SPLICE_MARK = "sesión de creación/edición de una VIGILANCIA"

DRAFT_FULL = {"title": "Clientes que dejan de pedir", "every": "7d",
              "say": "Jefe, estos clientes llevan dos semanas sin pedir: repásalos.",
              "name": "clientes_que_dejan_de_pedir"}


async def main():
    await db.init()
    duties.invalidate_cache()
    trackers.invalidate_hooks()
    for sc in (BOSS_SCOPE, CUST_SCOPE, TENANT_SCOPE, TENANT_CUST):
        await _clean(sc)
    await _ensure(BOSS_SCOPE, "boss", "vitaltrk")
    await _ensure(CUST_SCOPE, "customer")
    await _ensure(TENANT_SCOPE, "boss", "vitaltrk")
    await _ensure(TENANT_CUST, "customer", "vitaltrk")

    # ══ T1 · SITUATIONS ARE DATA ════════════════════════════════════════════════════════════════
    print("\n── T1 · situations are DATA (§16.6): a tracker is a ROW, not a module ──")
    import importlib.util
    backend = Path(__file__).resolve().parent.parent
    per_tracker_modules = [p.name for p in backend.glob("*.py")
                           if p.stem in ("vigilancia", "watch", "routine", "reorder_watch",
                                         "price_watch", "clientes_que_dejan_de_pedir")]
    ck("no per-tracker module exists (the litmus: a new watch is a ROW, zero Python)",
       not per_tracker_modules and importlib.util.find_spec("vigilancia") is None,
       str(per_tracker_modules))
    pol = trackers.build_policy(DRAFT_FULL, source="user")
    ck("the ROW carries the whole watch: hook, cadence, tab, rung, lifecycle, soul",
       all(k in pol for k in ("opens_on", "resolves_on", "tab", "rungs", "lifecycle", "soul", "tracker"))
       and pol["rungs"][0]["rearm"]["branch_id"] == pol["rungs"][0]["branch_id"],
       "rearm=%s" % pol["rungs"][0].get("rearm"))
    ck("a tracker's report rides the BOSS channel — a watch can never become an outbound to a customer",
       pol["rungs"][0].get("channel") == "boss")

    # ══ T2 · THE TIER GATE ══════════════════════════════════════════════════════════════════════
    print("\n── T2 · the tier gate: the customer's tool set does not CONTAIN the verbs ──")
    boss_sys, boss_tools = await _turn(BOSS_PHONE, "oye, quiero que vigiles una cosa", "vt-boss-1")
    cust_sys, cust_tools = await _turn(CUST_PHONE, "hola, ¿me traes 2 cajas?", "vt-cust-1")
    ck("BOSS turn: draft_tracker + create_tracker are in the tools the model receives",
       "draft_tracker" in boss_tools and "create_tracker" in boss_tools, str(boss_tools))
    ck("CUSTOMER turn: both verbs are STRUCTURALLY ABSENT (nothing to refuse — they don't exist there)",
       "draft_tracker" not in cust_tools and "create_tracker" not in cust_tools
       and "teach_rule" not in cust_tools, str(cust_tools))
    ck("the customer keeps every ordinary hand (the gate narrows configuration, not the job)",
       {"open_tab", "take_order", "remember"} <= set(cust_tools), str(cust_tools))

    # ══ T3 · THE HOOKS ARE REAL ═════════════════════════════════════════════════════════════════
    print("\n── T3 · the mind designs from hooks that EXIST ──")
    trackers.invalidate_hooks(BOSS_SCOPE)
    h = await trackers.hooks(BOSS_SCOPE)
    ev = [s["event"] for s in h["senses"]]
    ck("the hook menu is INTROSPECTED: it carries an event this world has really emitted",
       "message" in ev and len(ev) >= 4, "%d hooks" % len(ev))
    ck("it names the scopes a watch may sit on (this conversation vs the whole business)",
       len(h["scopes"]) >= 2 and any(s["scope"] == BOSS_SCOPE for s in h["scopes"]), str(h["scopes"]))
    note = trackers.hooks_note(h)
    tool = next((t for t in agent_reply._tools("boss", note) if t["name"] == "draft_tracker"), None)
    ck("the REAL menu rides INSIDE the tool description (cadence vocabulary + hooks + scopes)",
       tool is not None and "message" in tool["description"]
       and trackers.CADENCE_VOCAB in tool["description"], "")
    ck("the boss turn computed a live menu for the model (it is not a static string)",
       "GANCHOS DISPONIBLES" in (next((t["description"] for t in agent_reply._tools("boss", note)
                                       if t["name"] == "draft_tracker"), "")))

    # ══ T4 · CREATION SESSIONS ARE TABS ═════════════════════════════════════════════════════════
    print("\n── T4 · the creation session IS a tab (goal-bearing, draft on the tab) ──")
    part = {"title": "Clientes que dejan de pedir", "every": "7d"}
    r = await trackers.update_draft(BOSS_SCOPE, part, goal="vigilar clientes dormidos")
    ck("drafting OPENS the session tab (kind='creation') and carries the goal", r.get("ok") is True)
    rows = await _tabs(BOSS_SCOPE, trackers.CREATION_KIND)
    ck("exactly ONE open creation tab, goal-bearing, draft stored ON the tab (resume_ref)",
       len(rows) == 1 and "objetivo" in rows[0]["text"]
       and (_js(rows[0]["resume_ref"], {}) or {}).get("draft", {}).get("every") == "7d",
       str(rows[0]["text"])[:80] if rows else "none")
    ck("an INCOMPLETE draft says exactly what is still missing (it does not guess)",
       "qué te digo cuando salte" in " ".join(r.get("missing") or []), str(r.get("missing")))
    async with db.scoped_tx(BOSS_SCOPE) as con:
        fold = await assemble_mod.assemble(con, BOSS_SCOPE, "seguimos con la vigilancia")
    ck("the session rides ### OPEN TABS with its PLAYBACK on its own line (B1's tab_reasoning)",
       "sesión de vigilancia" in fold["rendered"]
       and "Clientes que dejan de pedir" in "\n".join(fold["tabs"]), "\n".join(fold["tabs"])[:200])

    # ══ T5 · THE SPLICE — both mouths, only while open ══════════════════════════════════════════
    print("\n── T5 · one spliced situation line in the MARCO, both mouths ──")
    boss_sys2, _ = await _turn(BOSS_PHONE, "sí, eso mismo", "vt-boss-2")
    ck("CHAT: the MARCO carries the session line while the tab is open",
       SPLICE_MARK in boss_sys2 and boss_sys2.count(SPLICE_MARK) == 1,
       "count=%d" % boss_sys2.count(SPLICE_MARK))
    ck("CHAT: the splice carries the goal AND the current draft (it is the mode, in words)",
       "vigilar clientes dormidos" in boss_sys2 and "Clientes que dejan de pedir" in boss_sys2)
    app_mod._VOICE_PINS.pop(BOSS_SCOPE, None)
    pin = await app_mod._build_voice_pin(BOSS_PHONE, BOSS_SCOPE, "es")
    ck("VOICE: the SAME line rides the ring-time persona (a mode on one mouth only would be drift)",
       SPLICE_MARK in (pin.get("persona") or ""), (pin.get("persona") or "")[:0])
    cust_sys2, _ = await _turn(CUST_PHONE, "¿y el precio?", "vt-cust-2")
    ck("a CUSTOMER's turn never sees the session line (it is not their conversation)",
       SPLICE_MARK not in cust_sys2)

    # ══ T6 · SELF-RESOLVE ON BIND ═══════════════════════════════════════════════════════════════
    print("\n── T6 · the session closes exactly when the row binds — never before ──")
    bad = await trackers.create(BOSS_SCOPE, {"title": "sin frase", "every": "7d"})
    ck("an INCOMPLETE draft is REFUSED (no half-installed watch)",
       bad.get("ok") is False and bad.get("reason") == "incomplete", str(bad.get("missing")))
    ck("…and the session is still OPEN (his draft is not thrown away)",
       len(await _tabs(BOSS_SCOPE, trackers.CREATION_KIND)) == 1)
    sess = await trackers.session(BOSS_SCOPE)
    await trackers.update_draft(BOSS_SCOPE, {"say": DRAFT_FULL["say"]})
    sess = await trackers.session(BOSS_SCOPE)
    ck("the completed draft reports NOTHING missing and reads back as one sentence",
       sess["missing"] == [] and "cada 7d" in sess["playback"], sess["playback"][:120])
    created = await trackers.create(BOSS_SCOPE, sess["draft"], source="user",
                                    loop_id=sess["loop_id"])
    ck("create() writes the ROW and reports it", created.get("ok") is True, str(created))
    async with db.control_pool().acquire() as con:
        nrow = await con.fetchval("select count(*) from manifest_duty where scope=$1::ltree "
                                  "and name=$2 and enabled", BOSS_SCOPE, created["name"])
        closed = await con.fetchrow("select status, resolution from open_loop where id=$1",
                                    sess["loop_id"])
    ck("the manifest_duty ROW exists and is enabled", nrow == 1, "rows=%s" % nrow)
    res = _js(closed["resolution"], {}) or {}
    ck("the creation tab RESOLVED ITSELF, and the resolution IS the row it produced",
       closed["status"] == "resolved" and res.get("duty") == created["name"], str(res))
    boss_sys3, _ = await _turn(BOSS_PHONE, "vale", "vt-boss-3")
    ck("the SPLICE IS GONE the moment the tab resolved (no mode flag to forget to clear)",
       SPLICE_MARK not in boss_sys3)
    app_mod._VOICE_PINS.pop(BOSS_SCOPE, None)
    pin2 = await app_mod._build_voice_pin(BOSS_PHONE, BOSS_SCOPE, "es")
    ck("…on the voice mouth too", SPLICE_MARK not in (pin2.get("persona") or ""))

    # ══ T7 · EDIT = A CHILD TAB ═════════════════════════════════════════════════════════════════
    print("\n── T7 · «Editar» reopens the session as a CHILD of the first ──")
    edit = await trackers.open_session(BOSS_SCOPE, "cambiar la cadencia a 14 días",
                                       draft=sess["draft"], duty_name=created["name"],
                                       parent_loop_id=sess["loop_id"])
    async with db.control_pool().acquire() as con:
        child = await con.fetchrow("select id, kind, status, parent_loop_id, resume_ref "
                                   "from open_loop where id=$1", edit["loop_id"])
    ck("a NEW creation tab, child-linked to the session it reopens (the ticket chain)",
       child["parent_loop_id"] == sess["loop_id"] and child["status"] == "open"
       and child["kind"] == trackers.CREATION_KIND, str(child["parent_loop_id"]))
    ck("…and it references the SAME duty row (an edit is not a second tracker)",
       (_js(child["resume_ref"], {}) or {}).get("duty_name") == created["name"])
    again = await trackers.open_session(BOSS_SCOPE, "otra vez", duty_name=created["name"])
    ck("re-entering the same edit RESUMES it (one session per duty, never a pile)",
       again.get("resumed") is True and again["loop_id"] == edit["loop_id"])
    await trackers.update_draft(BOSS_SCOPE, {"every": "14d"}, loop_id=edit["loop_id"])
    sess2 = await trackers.session(BOSS_SCOPE)
    upd = await trackers.create(BOSS_SCOPE, sess2["draft"], source="user", loop_id=edit["loop_id"])
    async with db.control_pool().acquire() as con:
        pol2 = _js(await con.fetchval("select gate_policy from manifest_duty where scope=$1::ltree "
                                      "and name=$2", BOSS_SCOPE, created["name"]), {}) or {}
        ntrk = await con.fetchval("select count(*) from manifest_duty where scope=$1::ltree "
                                  "and gate_policy ? 'tracker'", BOSS_SCOPE)
    ck("the edit UPDATES the one row (14d), it does not fork a second tracker",
       upd.get("ok") is True and (pol2.get("tracker") or {}).get("every") == "14d" and ntrk == 1,
       "every=%s rows=%s" % ((pol2.get("tracker") or {}).get("every"), ntrk))

    # ══ T8 · IT BINDS FROM ITS ROW ALONE, AND IT RECURS ═════════════════════════════════════════
    print("\n── T8 · the row BINDS: a live clock, a real tick, and it re-arms itself ──")
    async with db.control_pool().acquire() as con:
        tab = await con.fetchrow(
            "select l.id, l.status, l.text, t.id timer_id, t.branch_id, t.state "
            "from open_loop l join timer t on t.loop_id=l.id "
            "where l.scope=$1::ltree and l.entity_key=$2 and l.status='open' and t.state='armed'",
            BOSS_SCOPE, trackers.KEY_PREFIX + created["name"])
    ck("the arm opened the WATCH tab with a live clock — from the row alone, zero Python",
       tab is not None, "" if tab is not None else "no tab/timer")
    if tab is None:
        print("\nvital_trackers: %d/%d green" % (sum(R), len(R)))
        raise SystemExit(1)
    async with db.scoped_tx(BOSS_SCOPE) as con:
        await con.execute("update timer set fires_at = now() - interval '1 minute' where id=$1",
                          tab["timer_id"])
    said = []

    async def _surface(kind, text, ref_scope=None, **kw):
        said.append((kind, text, ref_scope))
        return {"alert_id": 1}

    async def _verify(con, **kw):
        return True

    orig = (worker._verify_branch, ops.record_alert, presence.quiet_now)
    worker._verify_branch = _verify
    ops.record_alert = _surface
    presence.quiet_now = lambda now=None: False
    try:
        fired = await worker.run_once(db.control_pool())
    finally:
        worker._verify_branch, ops.record_alert, presence.quiet_now = orig
    async with db.control_pool().acquire() as con:
        rearmed = await con.fetchrow(
            "select id, branch_id, fires_at from timer where loop_id=$1 and state='armed'", tab["id"])
        still = await con.fetchval("select status from open_loop where id=$1", tab["id"])
    ck("a REAL worker tick fired the watch", fired >= 1, "fired=%s" % fired)
    ck("it reported to the BOSS, with the sentence the row carries",
       any(DRAFT_FULL["say"][:24] in (s[1] or "") for s in said), str(said)[:160])
    ck("THE RECURRENCE: the same rung RE-ARMED itself and the watch stayed open (it is standing)",
       rearmed is not None and rearmed["branch_id"] == "check" and still == "open",
       "rearm=%s status=%s" % (rearmed["branch_id"] if rearmed else None, still))

    # ══ T9 · TWO SOURCES, ONE REGISTRY ══════════════════════════════════════════════════════════
    print("\n── T9 · a Rocoto-created watch is invisible until it has something to decide ──")
    rocoto_draft = {"title": "Taberna Ruano pide menos", "hook": "vital.trk.signal",
                    "say": "Taberna Ruano ha bajado un 40% este mes.", "name": "taberna_ruano_baja"}
    rk = await trackers.create(BOSS_SCOPE, rocoto_draft, source="rocoto")
    ck("Rocoto can install its own watch (same row, same binder — only the source differs)",
       rk.get("ok") is True and rk.get("source") == "rocoto", str(rk))
    reg = await trackers.registry(BOSS_SCOPE)
    ck("it does NOT show while it is merely running — it is COUNTED, not listed",
       reg["hidden"] == 1 and not reg["rocoto"] and len(reg["mine"]) == 1,
       "hidden=%s rocoto=%s mine=%s" % (reg["hidden"], len(reg["rocoto"]), len(reg["mine"])))
    ck("the boss's own watch, by contrast, is visible from birth and carries its clock",
       reg["mine"][0]["name"] == created["name"] and reg["mine"][0]["next_timer"]
       and reg["mine"][0]["last_fired"], str(reg["mine"][0])[:200])
    async with db.scoped_tx(BOSS_SCOPE) as con:
        eid, _ = await spine.append_event(con, BOSS_SCOPE, "vital.trk.signal", "test",
                                          {"entity": "taberna_ruano"}, lane="world")
        await duties.react_to_sense(con, BOSS_SCOPE, "vital.trk.signal", {"entity": "taberna_ruano"},
                                    opened_by_event=eid)
    reg = await trackers.registry(BOSS_SCOPE)
    ck("…and it STILL does not show once its tab merely opened (running is not decidable)",
       reg["hidden"] == 1 and not reg["rocoto"], "hidden=%s" % reg["hidden"])
    async with db.control_pool().acquire() as con:
        wtab = await con.fetchrow(
            "select l.id, t.id timer_id from open_loop l join timer t on t.loop_id=l.id "
            "where l.scope=$1::ltree and l.entity_key=$2 and l.status='open' and t.state='armed'",
            BOSS_SCOPE, trackers.KEY_PREFIX + rk["name"])
    async with db.scoped_tx(BOSS_SCOPE) as con:
        await con.execute("update timer set fires_at = now() - interval '1 minute' where id=$1",
                          wtab["timer_id"])
    worker._verify_branch = _verify
    ops.record_alert = _surface
    presence.quiet_now = lambda now=None: False
    try:
        await worker.run_once(db.control_pool())
    finally:
        worker._verify_branch, ops.record_alert, presence.quiet_now = orig
    reg = await trackers.registry(BOSS_SCOPE)
    sug = (reg["rocoto"][0].get("suggestion") if reg["rocoto"] else None)
    ck("the moment it RESOLVES into something decidable it SURFACES as a suggestion",
       len(reg["rocoto"]) == 1 and reg["hidden"] == 0 and sug is not None,
       "rocoto=%s hidden=%s" % (len(reg["rocoto"]), reg["hidden"]))
    ck("…carrying its ACTION verbs (Escribir · Comprar · Ver · Ignorar)",
       sug is not None and set(trackers.DEFAULT_ACTIONS) <= set(sug.get("actions") or []),
       str(sug))

    # ══ T10 · THE REGISTRY API ══════════════════════════════════════════════════════════════════
    print("\n── T10 · the API the surfaces need: list · pause/enable · create · draft ──")
    entry = reg["mine"][0]
    ck("list carries duty + live tabs + last fired + next timer",
       {"name", "title", "enabled", "source", "tabs", "last_fired", "next_timer", "every"}
       <= set(entry), str(sorted(entry))[:200])
    paused = await trackers.set_enabled(BOSS_SCOPE, created["name"], False)
    async with db.control_pool().acquire() as con:
        armed_after = await con.fetchval(
            "select count(*) from timer t join open_loop l on l.id=t.loop_id "
            "where l.scope=$1::ltree and l.entity_key=$2 and t.state='armed'",
            BOSS_SCOPE, trackers.KEY_PREFIX + created["name"]) or 0
        open_after = await con.fetchval(
            "select count(*) from open_loop where scope=$1::ltree and entity_key=$2 and status='open'",
            BOSS_SCOPE, trackers.KEY_PREFIX + created["name"]) or 0
    ck("PAUSE disables the row AND kills its clock (a paused watch cannot speak)",
       paused.get("ok") and armed_after == 0 and open_after == 0,
       "armed=%s open=%s" % (armed_after, open_after))
    duties.invalidate_cache(BOSS_SCOPE)
    ck("a paused row no longer BINDS (it is gone from the duty ladder, not just greyed out)",
       created["name"] not in await duties.load_duties(BOSS_SCOPE))
    reg_p = await trackers.registry(BOSS_SCOPE)
    ck("…but it is still LISTED, paused — otherwise he could never turn it back on",
       any(e["name"] == created["name"] and e["enabled"] is False for e in reg_p["mine"]))
    await trackers.set_enabled(BOSS_SCOPE, created["name"], True)
    duties.invalidate_cache(BOSS_SCOPE)
    async with db.control_pool().acquire() as con:
        rearm2 = await con.fetchval(
            "select count(*) from timer t join open_loop l on l.id=t.loop_id "
            "where l.scope=$1::ltree and l.entity_key=$2 and t.state='armed'",
            BOSS_SCOPE, trackers.KEY_PREFIX + created["name"]) or 0
        reopen = await con.fetchval(
            "select count(*) from open_loop where scope=$1::ltree and entity_key=$2 and status='open'",
            BOSS_SCOPE, trackers.KEY_PREFIX + created["name"]) or 0
    ck("ENABLE re-arms the cadence watch: a FRESH tab + a live clock, from its own row",
       rearm2 >= 1 and reopen == 1 and created["name"] in await duties.load_duties(BOSS_SCOPE),
       "armed=%s open=%s" % (rearm2, reopen))
    await trackers.update_draft(BOSS_SCOPE, {"title": "Precio del aguacate", "every": "1d",
                                             "say": "El aguacate ha subido.", "name": "precio_aguacate"})
    widget = await trackers.session(BOSS_SCOPE)
    ck("the DRAFT read the widget card needs: goal, draft, playback, what's missing",
       widget and {"goal", "draft", "playback", "missing", "loop_id"} <= set(widget)
       and widget["missing"] == [], str(widget)[:160])
    reg_w = await trackers.registry(BOSS_SCOPE)
    ck("…and the registry hands the open session to the surface in the same read",
       (reg_w.get("session") or {}).get("loop_id") == widget["loop_id"])

    # ══ T11 · THE LADDER ════════════════════════════════════════════════════════════════════════
    print("\n── T11 · a business-wide watch binds INSIDE a customer's conversation ──")
    biz = await trackers.create(TENANT_SCOPE, {"title": "Quejas de clientes", "hook": "vital.trk.queja",
                                               "say": "Un cliente se ha quejado.", "name": "quejas"},
                                source="user")
    duties.invalidate_cache(TENANT_CUST)
    loaded = await duties.load_duties(TENANT_CUST)
    ck("the tenant-scope row is IN the customer scope's duty ladder (nearer wins, ancestors bind)",
       biz.get("ok") and "quejas" in loaded, str(sorted(loaded))[:160])
    async with db.scoped_tx(TENANT_CUST) as con:
        eid, _ = await spine.append_event(con, TENANT_CUST, "vital.trk.queja", "test",
                                          {"entity": "manolo"}, lane="world")
        await duties.react_to_sense(con, TENANT_CUST, "vital.trk.queja", {"entity": "manolo"},
                                    opened_by_event=eid)
    async with db.control_pool().acquire() as con:
        opened = await con.fetchval(
            "select count(*) from open_loop where scope=$1::ltree and entity_key=$2 and status='open'",
            TENANT_CUST, trackers.KEY_PREFIX + "quejas") or 0
    ck("…and it really FIRES there: the customer's event opened the business's watch tab",
       opened == 1, "tabs=%s" % opened)
    reg_c = await trackers.registry(TENANT_CUST)
    ck("one registry, both windows: the customer's screen shows the business-wide watch",
       any(e["name"] == "quejas" and e["scope"] == TENANT_SCOPE for e in reg_c["mine"]),
       str([(e["name"], e["scope"]) for e in reg_c["mine"]]))

    for sc in (BOSS_SCOPE, CUST_SCOPE, TENANT_SCOPE, TENANT_CUST):
        await _clean(sc)
    passed = sum(R)
    print("\nvital_trackers: %d/%d green" % (passed, len(R)))
    if passed != len(R):
        raise SystemExit(1)
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
