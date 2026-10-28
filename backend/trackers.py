"""trackers.py — THE TRACKER REGISTRY (BLOCK C; SPEC §5.6 "Vigilancias", product name **Trackers**).

A tracker is a standing WATCH the supplier gets by TALKING: *"cada lunes repásame los clientes que no
piden hace dos semanas"*, *"vigílame el precio del aguacate"*. It is **not a new system** — it is the
machinery that already exists, exposed:

    a tracker  ==  ONE `manifest_duty` ROW  (§16.6: situations are DATA)
    its watch  ==  that row's `opens_on` sense hook + its rungs' timer cadence
    its state  ==  the ordinary tabs (`open_loop`) the generic binder opens from it
    building it == an ordinary `open_loop` of kind `creation` (§5.6: CREATION SESSIONS ARE TABS)

**THIS MODULE IS NOT A SITUATION MODULE.** It knows no situation: it enumerates the hooks that really
exist, renders/validates a DRAFT, writes a ROW through `install.py`, and READS the registry back for
the surfaces. Every tracker anyone ever creates binds through `duties.py`'s one generic binder — zero
Python per tracker, which is the whole point (`vital_trackers` locks it: no `<tracker>.py` may appear).

THE FOUR THINGS BLOCK C SHIPS, all of them here or one call away:

1. **THE MIND DESIGNS THE WATCH FROM REAL HOOKS.** `hooks()` introspects what this world can actually
   watch — the sense event types it has really emitted + the ones its manifest rows already bind + the
   wired `manifest_sense` doors — plus the timer cadence vocabulary the worker really parses and the
   scopes a watch may sit on. `hooks_note()` renders that INTO the tool description, so the mind picks
   from what exists instead of inventing an event type that will never arrive.

2. **CREATION SESSIONS ARE TABS.** `open_session` opens a goal-bearing `open_loop` (kind `creation`)
   carrying the DRAFT in `resume_ref`; `update_draft` re-renders the playback onto the tab's own line
   (a `tracker.draft` reasoning event bound by `loop_id` — exactly what `assemble.tab_reasoning` reads,
   so B1's fold shows it on BOTH mouths for free). `create()` RESOLVES the session the instant the row
   binds, with the row's id as the resolution. "Edit" = `open_session(..., parent_loop_id=<the old
   one>)` — the ticket reopen chain. `splice_line()` is the ONE situation line the MARCO frame carries
   **while and only while** such a tab is open: the tab IS the mode — no mode flag, no second pipeline.

3. **TWO SOURCES, ONE REGISTRY.** `tracker.source` ∈ {user, rocoto}. A **user** tracker is visible from
   birth (he asked for it; he must see it exists). A **rocoto** tracker — one the runtime decided to
   watch on its own — stays INVISIBLE until it reaches something decidable: a resolved tab or a parked
   needs_human action. Then, and only then, it surfaces as a SUGGESTION carrying its action verbs
   (Escribir · Comprar · Ver · Ignorar). Unresolved rocoto watches are reported as a COUNT only
   ("en marcha, todavía sin nada que decidir: 4 vigilancias"), never as a list of noise.

4. **ONE REGISTRY, BOTH WINDOWS.** `registry()` is the single read behind the app's Trackers screen and
   the CR's Vigilancias pane (SPEC §5.6). `set_enabled` pauses/enables. `session` is the draft read the
   co-presence widget card renders.

Conventions inherited, not reinvented: every write takes/opens a scoped connection (RLS binds it to the
world it belongs to); config reads go through the CTRL pool (the manifest is installed configuration —
`duties.load_duties` does the same); fail-soft on reads (a hiccup here must never take a live turn
down), fail-LOUD on a write that cannot happen.
"""
from __future__ import annotations

import json
import logging
import re
import time
from datetime import datetime, timezone
from typing import Any, Optional

log = logging.getLogger("rocoto.trackers")

# ── the vocabulary the surfaces and the mind share ────────────────────────────────────────────
# THE CADENCE FLOOR (2026-07-27). A tracker is created BY TALKING (§5.6), so `every` arrives as a
# sentence a person said and a model parsed. «avísame cada segundo» is a plausible first-day joke, and
# `build_policy` puts `every` straight into a rung that RE-ARMS ITSELF — so without a floor that is a
# self-perpetuating timer firing every second, forever, on the live worker.
# Clamped HERE, at creation, rather than only in the worker, because this is the one place the boss can
# be TOLD what he actually got: `playback()` reads back the clamped cadence, and he confirms that
# sentence before the row is written. Silently accepting «cada segundo» and quietly running it hourly
# would be worse than either extreme.
# 15 minutes is the floor because nothing in this trade is watched tighter than that — the real watches
# are «una semana sin pedir» and «abre un restaurante nuevo». `worker.REARM_MIN_SEC` is a second,
# lower floor for rows that reach the database by any other path.
MIN_CADENCE_SEC = 900

TAB_KIND = "watch"            # the tabs a tracker's duty row opens
CREATION_KIND = "creation"    # the creation SESSION tab (§5.6 — a tab, not a mode)
KEY_PREFIX = "tracker:"       # entity-key namespace: `tracker:<name>` (+ ':{slot}' when keyed)
ARM_EVENT = "tracker.armed"      # the bootstrap sense a CADENCE tracker opens on (emitted at create)
DISARM_EVENT = "tracker.disarmed"  # its counterpart (emitted on delete/disable — closes the tab)
SOURCES = ("user", "rocoto")
# the four verbs a surfaced suggestion may carry (SPEC §5.6 / the app mockup). Data, not code: a row
# may narrow them; nothing here branches on which one a surface renders.
DEFAULT_ACTIONS = ("escribir", "comprar", "ver", "ignorar")
# the cadence vocabulary the WORKER really parses (worker._rearm_seconds / duties._after_seconds) —
# stated once, here, so the tool description can never promise a cadence the clock cannot honour.
CADENCE_VOCAB = "30m · 2h · 1d · 7d · 30d (Ns/Nm/Nh/Nd, o un número = segundos)"
MAX_NAME = 48


def _slug(s: str) -> str:
    """A tracker NAME is a stable identifier (it keys the manifest row, the entity keys and the
    `when` predicate) — so it is slugged, never free text."""
    s = (s or "").strip().lower()
    s = re.sub(r"[^a-z0-9]+", "_", s).strip("_")
    return (s or "tracker")[:MAX_NAME]


def _iso(v) -> Optional[str]:
    return v.isoformat() if isinstance(v, datetime) else None


def _asjson(v, default):
    if isinstance(v, (dict, list)):
        return v
    if isinstance(v, str):
        try:
            return json.loads(v)
        except Exception:
            return default
    return default


# ══════════════════════════════════════════════════════════════════════════════════════════════
# 1. THE HOOKS — what this world can ACTUALLY watch
# ══════════════════════════════════════════════════════════════════════════════════════════════
_HOOKS_TTL = 60.0
_hooks_cache: dict[str, tuple[float, dict]] = {}

# Hooks that exist for every world because the runtime itself emits them (the spine's own vocabulary).
# Listed explicitly so a brand-new tenant — whose event log is empty — still gets a real menu instead
# of an empty one. Each MUST be an event type the runtime genuinely appends.
_ALWAYS: tuple[tuple[str, str], ...] = (
    ("message", "cada mensaje que entra de esta parte"),
    ("call.ended", "cuando termina una llamada"),
    ("order.placed", "cuando se coloca un pedido"),
    ("order.drafted", "cuando se cuadra un borrador de pedido"),
    ("lifecycle.stage_changed", "cuando la relación cambia de fase (alta, activación…)"),
    (ARM_EVENT, "el arranque de una vigilancia por CADENCIA (lo emite el propio alta)"),
)


async def hooks(scope: str) -> dict[str, Any]:
    """The REAL hook menu for `scope`, introspected (never a hand-written list):

      · `senses`   — event types this world can open on: the runtime's own vocabulary (`_ALWAYS`) ∪ the
                     types this scope + the creator scope have actually emitted ∪ the types the visible
                     manifest_duty rows already bind ∪ the wired `manifest_sense` doors' kinds.
      · `cadences` — the worker's real timer vocabulary + the fact that a rung may repeat (`every`).
      · `scopes`   — where a watch may sit: this conversation's own scope, and the app/tenant scope
                     that covers the whole business.

    Cached ~60s (the manifest is configuration). Fail-soft: on any error the `_ALWAYS` core still
    answers, so the mind is never handed an empty menu."""
    hit = _hooks_cache.get(scope)
    if hit and (time.monotonic() - hit[0]) < _HOOKS_TTL:
        return hit[1]
    senses: dict[str, str] = {k: v for k, v in _ALWAYS}
    try:
        import db
        import gate
        import spine
        creator = spine.scope_creator()
        pool = db.control_pool()
        async with pool.acquire() as con:
            await con.set_type_codec("jsonb", encoder=json.dumps, decoder=json.loads,
                                     schema="pg_catalog")
            seen = await con.fetch(
                "select type, count(*) n from event where scope=$1::ltree and lane='world' "
                "group by type order by n desc, type limit 40", scope)
            for r in seen:
                senses.setdefault(r["type"], f"ya ha ocurrido aquí {int(r['n'])} vez/veces")
            rows = await con.fetch(
                "select gate_policy from manifest_duty where enabled "
                "and (scope=$1::ltree or scope=$2::ltree)", scope, creator)
            for r in rows:
                cfg = _asjson(r["gate_policy"], {}) or {}
                for side in ("opens_on", "resolves_on"):
                    ev = (cfg.get(side) or {}).get("event") if isinstance(cfg.get(side), dict) else None
                    if ev:
                        senses.setdefault(ev, "ya usado por otra rutina instalada")
            doors = await con.fetch(
                "select distinct kind from manifest_sense where enabled "
                "and (scope=$1::ltree or scope=$2::ltree)", scope, creator)
            for r in doors:
                senses.setdefault(f"{r['kind']}.*", "puerta conectada (webhook) — sus eventos entran aquí")
        app = gate.app_scope(scope)
    except Exception:
        log.debug("trackers.hooks introspection fail-soft for %s", scope, exc_info=True)
        app = scope
    out = {
        "senses": [{"event": k, "note": v} for k, v in sorted(senses.items())],
        "cadences": {"vocab": CADENCE_VOCAB,
                     "repeats": "una vigilancia con `every` se REPITE sola (el rung se re-arma a sí mismo)",
                     "one_shot": "sin `every` salta una vez y se cierra"},
        "scopes": [{"scope": scope, "note": "solo esta conversación / este cliente"},
                   {"scope": app, "note": "todo el negocio (por defecto para una vigilancia del jefe)"}],
    }
    _hooks_cache[scope] = (time.monotonic(), out)
    return out


def invalidate_hooks(scope: Optional[str] = None) -> None:
    if scope is None:
        _hooks_cache.clear()
    else:
        _hooks_cache.pop(scope, None)


def hooks_note(h: dict) -> str:
    """The hook menu as ONE compact block for the tool description — the mind picks from what EXISTS.
    Deterministic (sorted upstream), bounded (the sense list is capped), and safe to embed in a prompt."""
    senses = h.get("senses") or []
    lines = [f"  · {s['event']} — {s['note']}" for s in senses[:24]]
    if len(senses) > 24:
        lines.append(f"  · (+{len(senses) - 24} más)")
    sc = "; ".join(f"{s['scope']} ({s['note']})" for s in (h.get("scopes") or []))
    cad = h.get("cadences") or {}
    return ("GANCHOS DISPONIBLES DE VERDAD (elige de aquí; NO inventes un evento que no exista):\n"
            + "\n".join(lines)
            + f"\nCADENCIAS: {cad.get('vocab', CADENCE_VOCAB)} — {cad.get('repeats', '')}. "
            f"{cad.get('one_shot', '')}"
            + f"\nÁMBITOS: {sc}")


async def hooks_note_for(scope: str) -> str:
    """`hooks_note(await hooks(scope))`, fail-soft to '' (a turn never dies over a tool description)."""
    try:
        return hooks_note(await hooks(scope))
    except Exception:
        log.debug("trackers.hooks_note_for fail-soft", exc_info=True)
        return ""


# ══════════════════════════════════════════════════════════════════════════════════════════════
# 2. THE DRAFT + THE CREATION SESSION (a TAB — SPEC §5.6)
# ══════════════════════════════════════════════════════════════════════════════════════════════
_CADENCE_UNIT_SEC = {"s": 1, "m": 60, "h": 3600, "d": 86400, "w": 604800}


def cadence_seconds(every: Optional[str]) -> Optional[int]:
    """A cadence string ('30m' / '2d' / '1w' / '90s' / a bare number of seconds) in seconds, or None
    when it is absent or unreadable. Never raises — an unreadable cadence is not a crash, it is a
    draft that is still missing something, and `missing()` owns that."""
    if not every:
        return None
    t = str(every).strip().lower()
    try:
        if t and t[-1] in _CADENCE_UNIT_SEC:
            return int(float(t[:-1]) * _CADENCE_UNIT_SEC[t[-1]])
        return int(float(t))
    except (TypeError, ValueError):
        return None


def _render_cadence(secs: int) -> str:
    """Seconds back to the shortest honest string, so the playback reads like a person wrote it."""
    for unit, size in (("d", 86400), ("h", 3600), ("m", 60)):
        if secs % size == 0 and secs >= size:
            return f"{secs // size}{unit}"
    return f"{secs}s"


def _clamp_cadence(every: Optional[str]) -> Optional[str]:
    """Hold the cadence at or above MIN_CADENCE_SEC. Returns the (possibly rewritten) string, so
    everything downstream — the playback the boss confirms, the rung, the re-arm — sees the SAME
    number. An unreadable cadence passes through untouched: `missing()` is what tells him it is not
    yet a watch."""
    secs = cadence_seconds(every)
    if secs is None or secs >= MIN_CADENCE_SEC:
        return every
    log.info("trackers: cadence %r is below the %ss floor — clamped (the playback will say so)",
             every, MIN_CADENCE_SEC)
    return _render_cadence(MIN_CADENCE_SEC)


def normalize_draft(d: dict) -> dict:
    """The draft watch, normalized to the shape `create()` consumes. Every field optional while the
    conversation is still happening — a draft is allowed to be incomplete; only `create()` demands."""
    d = d or {}
    every = _clamp_cadence(str(d.get("every") or "").strip() or None)
    out = {
        "title": (str(d.get("title") or "").strip())[:160],
        "hook": (str(d.get("hook") or "").strip())[:120],       # the sense event, or '' for a cadence watch
        "when": d.get("when") if isinstance(d.get("when"), dict) else None,
        "every": every,
        "scope": (str(d.get("scope") or "").strip() or None),
        "say": (str(d.get("say") or "").strip())[:600],          # what he gets told when it fires
        "actions": [a for a in (d.get("actions") or []) if isinstance(a, str)] or list(DEFAULT_ACTIONS),
        "name": _slug(d.get("name") or d.get("title") or ""),
    }
    return out


def missing(d: dict) -> list[str]:
    """What a draft still needs before it can become a row. The mind reads this back to the boss."""
    d = normalize_draft(d)
    gaps = []
    if not d["title"]:
        gaps.append("título")
    if not d["hook"] and not d["every"]:
        gaps.append("gancho (un evento) o cadencia (cada cuánto)")
    if not d["say"]:
        gaps.append("qué te digo cuando salte")
    return gaps


def playback(d: dict) -> str:
    """The mind's understanding, rendered — the line it reads back and the widget card shows.
    One deterministic sentence; the surfaces never re-phrase it."""
    d = normalize_draft(d)
    when = ""
    if d["hook"] and d["every"]:
        when = f"cuando pase «{d['hook']}» y además cada {d['every']}"
    elif d["hook"]:
        when = f"cuando pase «{d['hook']}»"
    elif d["every"]:
        when = f"cada {d['every']}"
    else:
        when = "(falta el gancho o la cadencia)"
    pred = ""
    if d["when"]:
        pred = " (solo si " + ", ".join(f"{k}={v}" for k, v in list(d["when"].items())[:4]) + ")"
    return (f"«{d['title'] or 'sin título'}» — {when}{pred}"
            + (f", ámbito {d['scope']}" if d["scope"] else "")
            + (f" → te digo: «{d['say']}»" if d["say"] else " → (falta qué decirte)"))


async def open_session(scope: str, goal: str, *, draft: Optional[dict] = None,
                       duty_name: str = "", parent_loop_id: Optional[int] = None,
                       opened_by_event: Optional[int] = None) -> dict:
    """Open a CREATION SESSION as a TAB (SPEC §5.6). Goal-bearing (`text` IS the goal), carrying the
    draft watch as its state (`resume_ref`), child-linked to the session it reopens (`parent_loop_id`)
    — "Edit" on a tracker is exactly this call with the old session's id and the same `duty_name`.

    No timer is armed and `due_at` stays NULL, deliberately: a creation session is not a promise the
    clock must keep (so the stuck-tab sweep, which only looks at overdue tabs, correctly ignores it) —
    it is visible because it is an OPEN TAB in the fold every turn and a live row in the registry.
    Idempotent per (scope, duty_name): a second «vamos a crear una vigilancia» resumes the open one."""
    import db
    import spine
    d = normalize_draft(draft or {})
    goal = (goal or "").strip() or "definir una vigilancia nueva"
    async with db.scoped_tx(scope) as con:
        existing = await con.fetchrow(
            "select id, text, resume_ref from open_loop where scope=$1::ltree and kind=$2 "
            "and status='open' and coalesce(resume_ref->>'duty_name','') = $3 "
            "order by id desc limit 1", scope, CREATION_KIND, duty_name or "")
        if existing is not None:
            return {"ok": True, "loop_id": int(existing["id"]), "resumed": True,
                    "draft": (_asjson(existing["resume_ref"], {}) or {}).get("draft") or {}}
        state = {"draft": d, "duty_name": duty_name or "", "goal": goal,
                 "opened_at": datetime.now(timezone.utc).isoformat()}
        loop_id = await con.fetchval(
            "insert into open_loop(scope,kind,text,status,answer_shape,resume_ref,notes,"
            "opened_by_event,parent_loop_id) "
            "values($1::ltree,$2,$3,'open','free',$4,$5,$6,$7) returning id",
            scope, CREATION_KIND, f"sesión de vigilancia — objetivo: {goal}", state,
            [{"event_id": int(opened_by_event) if opened_by_event else None,
              "text": f"creation session opened ({duty_name or 'new'})"}],
            opened_by_event, int(parent_loop_id) if parent_loop_id else None)
        await spine.append_event(con, scope, "tracker.session_opened", "runtime",
                                 {"loop_id": int(loop_id), "duty_name": duty_name or "", "goal": goal,
                                  "parent_loop_id": int(parent_loop_id) if parent_loop_id else None},
                                 caused_by=opened_by_event, lane="reasoning")
        if d.get("title") or d.get("hook") or d.get("every"):
            await _write_playback(con, scope, int(loop_id), d)
    log.info("trackers: creation session %s opened on %s (duty=%s parent=%s)",
             loop_id, scope, duty_name or "-", parent_loop_id)
    return {"ok": True, "loop_id": int(loop_id), "resumed": False, "draft": d}


async def _write_playback(con, scope: str, loop_id: int, d: dict) -> None:
    """The draft's playback as a REASONING-lane event bound to the tab by `loop_id` — the same channel
    `duties._open` writes its open-time brief on, so `assemble.tab_reasoning` renders the CURRENT draft
    on the session tab's own line, in both folds, with zero new fold machinery (B1)."""
    import spine
    await spine.append_event(con, scope, "tracker.draft", "runtime",
                             {"loop_id": int(loop_id), "verdict": playback(d),
                              "process": "borrador de vigilancia", "draft": d},
                             lane="reasoning")


async def update_draft(scope: str, draft: dict, *, goal: str = "",
                       loop_id: Optional[int] = None) -> dict:
    """Merge new understanding into the open session's DRAFT and re-render the playback. Opens the
    session first if none is open (the mind may start drafting mid-sentence — the tab is the mode, so
    the mode begins the moment there is something to draft)."""
    import db
    cur = await session(scope, loop_id=loop_id)
    if cur is None:
        r = await open_session(scope, goal or (draft or {}).get("title") or "", draft=draft)
        loop_id = int(r["loop_id"])
        cur = await session(scope, loop_id=loop_id)
        if cur is None:
            return {"ok": False, "reason": "no_session"}
        return {"ok": True, "loop_id": loop_id, "draft": cur["draft"],
                "playback": playback(cur["draft"]), "missing": missing(cur["draft"]),
                "opened": True}
    merged = dict(cur["draft"] or {})
    for k, v in (draft or {}).items():
        if v not in (None, "", [], {}):
            merged[k] = v
    merged = normalize_draft(merged)
    lid = int(cur["loop_id"])
    async with db.scoped_tx(scope) as con:
        state = {"draft": merged, "duty_name": cur.get("duty_name") or "",
                 "goal": goal or cur.get("goal") or "", "updated_at": datetime.now(timezone.utc).isoformat()}
        await con.execute("update open_loop set resume_ref=$2 where id=$1 and status='open'", lid, state)
        await _write_playback(con, scope, lid, merged)
    return {"ok": True, "loop_id": lid, "draft": merged, "playback": playback(merged),
            "missing": missing(merged), "opened": False}


async def session(scope: str, *, loop_id: Optional[int] = None) -> Optional[dict]:
    """THE DRAFT-STATE READ the co-presence widget card renders (SPEC §5.6). The open creation tab on
    this scope + its draft + what it still needs, or None. Fail-soft None."""
    import db
    try:
        async with db.scoped_tx(scope) as con:
            if loop_id:
                row = await con.fetchrow(
                    "select id, text, resume_ref, parent_loop_id, opened_at from open_loop "
                    "where id=$1 and scope=$2::ltree and status='open'", int(loop_id), scope)
            else:
                row = await con.fetchrow(
                    "select id, text, resume_ref, parent_loop_id, opened_at from open_loop "
                    "where scope=$1::ltree and kind=$2 and status='open' order by id desc limit 1",
                    scope, CREATION_KIND)
    except Exception:
        log.debug("trackers.session fail-soft", exc_info=True)
        return None
    if row is None:
        return None
    st = _asjson(row["resume_ref"], {}) or {}
    d = normalize_draft(st.get("draft") or {})
    return {"loop_id": int(row["id"]), "goal": st.get("goal") or row["text"],
            "duty_name": st.get("duty_name") or "", "draft": d, "playback": playback(d),
            "missing": missing(d), "parent_loop_id": row["parent_loop_id"],
            "opened_at": _iso(row["opened_at"])}


async def splice_line(scope: str) -> str:
    """THE ONE SPLICED SITUATION LINE (SPEC §5.6). Present in the MARCO frame **while and only while** a
    creation tab is open on this thread; gone the instant it resolves. No mode flag, no branch anywhere
    else in the pipeline — the tab IS the mode. Fail-soft '' (never break a turn over a splice)."""
    try:
        s = await session(scope)
    except Exception:
        return ""
    if not s:
        return ""
    gaps = s["missing"]
    return ("estás en una sesión de creación/edición de una VIGILANCIA (tracker) — objetivo: "
            f"{s['goal']}; borrador actual: {s['playback']}"
            + (f"; te falta por acordar: {', '.join(gaps)}" if gaps else
               "; está completo: léeselo y, si te lo confirma, instálalo con create_tracker"))


# ══════════════════════════════════════════════════════════════════════════════════════════════
# 3. CREATE — the draft becomes a ROW (and the session closes itself)
# ══════════════════════════════════════════════════════════════════════════════════════════════
def build_policy(d: dict, *, source: str = "user") -> dict:
    """The draft → a `manifest_duty.gate_policy`, in the SAME vocabulary every hand-written row uses
    (duties.py's docstring is the contract). Nothing here is tracker-specific machinery: it is one row
    the generic binder reads like any other.

      · CADENCE watch (`every`, no hook) — opens on the `tracker.armed` bootstrap the create emits,
        with a `when` predicate naming itself, and ONE rung that re-arms ITSELF: that self-referencing
        `rearm` IS the recurrence (duties._contingencies passes an explicit rearm through; the worker
        re-arms whatever branch it names — including the same one).
      · SENSE watch (`hook`) — opens on that event, fires its report on the next tick (`0s`), and the
        worker's boss-channel one-shot resolves the tab when it has been delivered.
      · Both report on `channel: 'boss'` — a tracker talks to the BOSS, never to a customer, so no
        tracker can ever become an unreviewed outbound to a third party.
    """
    d = normalize_draft(d)
    name = d["name"]
    hook = d["hook"]
    every = d["every"]
    # ONE key per tracker — so ONE live alert at a time (a second complaint while the first is still
    # unread no-ops on the binder's own idempotence) and so every registry read is an exact lookup.
    # It also keeps the resolve keyed rather than by-kind: `by: "kind"` would close whichever `watch`
    # tab happens to be newest, i.e. some OTHER tracker's.
    key = f"{KEY_PREFIX}{name}"
    opens: dict[str, Any] = {"event": hook or ARM_EVENT, "key": key}
    when = dict(d["when"] or {})
    if not hook:
        when["tracker"] = name          # a cadence watch opens on ITS OWN arm event, never a sibling's
    if when:
        opens["when"] = when
    rung: dict[str, Any] = {"branch_id": "check", "after": every or "0s", "gated": False,
                            "channel": "boss",
                            "trigger": d["title"] or name,
                            "sentence": d["say"] or d["title"] or name}
    if every:
        # THE RECURRENCE: the rung re-arms itself. One row-level knob, zero scheduler.
        rung["rearm"] = {"after": every, "branch_id": "check"}
    return {
        "opens_on": opens,
        "resolves_on": {"event": DISARM_EVENT, "when": {"tracker": name}, "key": key,
                        "branch_id": "disarmed"},
        "tab": {"kind": TAB_KIND, "answer_shape": "free", "money": False,
                "text": d["title"] or name, "brief": playback(d), "brief_label": "vigilancia"},
        "rungs": [rung],
        "lifecycle": {"prefix": f"tracker.{name}.", "initial": "watching",
                      "terminal": ["disarmed"], "transitions": {DISARM_EVENT: "disarmed"}},
        "soul": {"tier": "boss", "label": f"VIGILANCIA · {(d['title'] or name)[:60]}"},
        "tracker": {"source": source if source in SOURCES else "user", "title": d["title"] or name,
                    "hook": hook, "every": every, "when": d["when"], "say": d["say"],
                    "actions": d["actions"], "name": name,
                    "created_at": datetime.now(timezone.utc).isoformat()},
    }


async def create(scope: str, draft: dict, *, source: str = "user",
                 loop_id: Optional[int] = None) -> dict:
    """Install the drafted watch as a `manifest_duty` ROW and CLOSE the creation session on it.

    Order matters and is deliberate: the row is written first (through `install.py` — the same write
    WP-10 proved), then the arm event is emitted so a cadence watch's tab opens and its clock starts,
    then the session RESOLVES with the row id as its resolution (SPEC §5.6: "closes itself the instant
    install_duty binds the row"). A refused write leaves the session OPEN — the boss keeps his draft.

    `scope` here is the scope the SESSION lives on; `draft.scope` (when the boss chose the wider one)
    is where the ROW is installed."""
    import db
    import duties
    import install
    import spine
    d = normalize_draft(draft or {})
    gaps = missing(d)
    if gaps:
        return {"ok": False, "reason": "incomplete", "missing": gaps, "playback": playback(d)}
    target = d["scope"] or scope
    cfg = build_policy(d, source=source)
    name = cfg["tracker"]["name"]
    r = await install.install_duty_row(target, name, cfg, created_by="L2")
    if not r.get("ok"):
        return {"ok": False, "reason": r.get("reason") or "write_failed", "playback": playback(d)}
    duties.invalidate_cache(target)
    invalidate_hooks(target)
    # ARM: a cadence watch has no natural sense to wait for — its own arm event opens the tab and
    # starts the clock. A sense watch waits for the real world, so nothing is emitted for it.
    armed_tab = None
    if not d["hook"]:
        async with db.scoped_tx(target) as con:
            eid, _ = await spine.append_event(con, target, ARM_EVENT, "runtime",
                                              {"tracker": name, "title": d["title"]}, lane="world")
            react = await duties.react_to_sense(con, target, ARM_EVENT, {"tracker": name,
                                                                        "title": d["title"]},
                                                opened_by_event=eid)
        for x in react.get("reacted") or []:
            if x.get("duty") == name and x.get("tab_id"):
                armed_tab = int(x["tab_id"])
    closed = await close_session(scope, name, manifest_scope=target, loop_id=loop_id)
    log.info("trackers: CREATED %s on %s (source=%s tab=%s session=%s)",
             name, target, source, armed_tab, closed.get("loop_id"))
    return {"ok": True, "name": name, "scope": target, "source": source,
            "tab_id": armed_tab, "session_closed": closed.get("ok", False),
            "session_loop_id": closed.get("loop_id"), "playback": playback(d)}


async def close_session(scope: str, duty_name: str, *, manifest_scope: str = "",
                        loop_id: Optional[int] = None) -> dict:
    """Resolve the creation tab — resolution = the row it produced (SPEC §5.6).

    It closes THIS watch's session and no other: either the tab id the caller names, or the open
    session whose draft is actually about `duty_name`. A watch Rocoto decides to install on its own
    must never close the session the boss has open about a different one — the session belongs to the
    conversation, not to the act of installing. No-op when there is none (a rocoto-created watch)."""
    import db
    try:
        async with db.scoped_tx(scope) as con:
            rid = await con.fetchval(
                "update open_loop set status='resolved', resolved_at=now(), resolution=$3 "
                "where id = (select id from open_loop where scope=$1::ltree and kind=$2 "
                "            and status='open' "
                "            and ($4::bigint is null or id=$4) "
                "            and ($4::bigint is not null "
                "                 or coalesce(resume_ref->'draft'->>'name','') = $5 "
                "                 or coalesce(resume_ref->>'duty_name','') = $5) "
                "            order by id desc limit 1) returning id",
                scope, CREATION_KIND,
                {"branch_id": "installed", "duty": duty_name,
                 "manifest_scope": manifest_scope or scope,
                 "note": "creation session resolved by install_duty binding the row"},
                int(loop_id) if loop_id else None, duty_name)
    except Exception:
        log.exception("trackers.close_session failed for %s", scope)
        return {"ok": False}
    return {"ok": rid is not None, "loop_id": int(rid) if rid else None}


# ══════════════════════════════════════════════════════════════════════════════════════════════
# 4. THE REGISTRY — one read, both windows
# ══════════════════════════════════════════════════════════════════════════════════════════════
async def _rows(con, scope: str) -> list:
    """Every tracker row that BINDS for `scope`: its own, every ancestor's (a watch installed on the
    whole business is a tracker of every conversation inside it) and the app scope's — the exact same
    ladder `duties.load_duties` walks, so the registry can never show a watch that does not bind, or
    hide one that does. PAUSED rows are included (a paused tracker must still be listed, to be
    un-paused). Deterministic order."""
    import gate
    app = gate.app_scope(scope)
    return await con.fetch(
        "select id, scope::text as sc, name, gate_policy, enabled from manifest_duty "
        "where ($1::ltree <@ scope or scope=$2::ltree) and gate_policy ? 'tracker' "
        "order by name, id", scope, app)


async def registry(scope: str) -> dict[str, Any]:
    """THE registry read behind the app's Trackers screen and the CR's Vigilancias pane.

    Returns {mine, rocoto, hidden, session}:
      · `mine`   — every USER-created tracker (visible from birth), each with its live tabs, when it
                   last fired and when it fires next.
      · `rocoto` — only those ROCOTO-created trackers that have reached something DECIDABLE (a resolved
                   tab, or a parked needs_human action), each carrying its suggestion + action verbs.
      · `hidden` — how many rocoto watches are running with nothing to decide yet ("no te las enseño aún").
      · `session`— the open creation session's draft, if any (the widget card).
    Fail-soft: an empty registry, never an exception into a surface."""
    import db
    out: dict[str, Any] = {"scope": scope, "mine": [], "rocoto": [], "hidden": 0, "session": None}
    try:
        # THE CTRL POOL, deliberately (the `duties.load_duties` precedent): the manifest is installed
        # CONFIGURATION and the ladder crosses scopes — under FORCE RLS a descendant's own connection
        # cannot see its ancestor's row, so reading the registry through it would silently answer "you
        # have no business-wide watches" (the exact half-truth B6 hit with the app-wide mode row).
        async with db.control_pool().acquire() as con:
            await con.set_type_codec("jsonb", encoder=json.dumps, decoder=json.loads,
                                     schema="pg_catalog")
            rows = await _rows(con, scope)
            for r in rows:
                cfg = _asjson(r["gate_policy"], {}) or {}
                t = cfg.get("tracker") or {}
                name = r["name"]
                entry = {
                    "name": name, "title": t.get("title") or name,
                    "source": t.get("source") if t.get("source") in SOURCES else "user",
                    "enabled": bool(r["enabled"]), "scope": r["sc"],
                    "hook": t.get("hook") or "", "every": t.get("every") or "",
                    "say": t.get("say") or "",
                    "actions": t.get("actions") or list(DEFAULT_ACTIONS),
                    "created_at": t.get("created_at"),
                }
                entry.update(await _live(con, r["sc"], name))
                if entry["source"] == "rocoto":
                    sug = await _suggestion(con, r["sc"], name, entry)
                    if sug is None:
                        out["hidden"] += 1          # running, nothing to decide → invisible BY DESIGN
                        continue
                    entry["suggestion"] = sug
                    out["rocoto"].append(entry)
                else:
                    out["mine"].append(entry)
    except Exception:
        log.exception("trackers.registry fail-soft for %s", scope)
        return out
    out["session"] = await session(scope)
    return out


async def _live(con, scope: str, name: str) -> dict[str, Any]:
    """The living state of ONE tracker: its open tabs, its last fired rung, its next armed timer."""
    key = f"{KEY_PREFIX}{name}"
    tabs = await con.fetch(
        "select id, text, status, opened_at, resolved_at from open_loop "
        "where scope=$1::ltree and (entity_key = $2 or entity_key like $2 || ':%') "
        "order by id desc limit 20", scope, key)
    ids = [int(t["id"]) for t in tabs]
    last_fired = next_at = None
    if ids:
        last_fired = await con.fetchval(
            "select max(fired_at) from timer where loop_id = any($1::bigint[]) and state='fired'", ids)
        next_at = await con.fetchval(
            "select min(fires_at) from timer where loop_id = any($1::bigint[]) and state='armed'", ids)
    return {
        "tabs": [{"id": int(t["id"]), "text": t["text"], "status": t["status"],
                  "opened_at": _iso(t["opened_at"]), "resolved_at": _iso(t["resolved_at"])}
                 for t in tabs if t["status"] == "open"],
        "n_tabs_total": len(tabs),
        "last_fired": _iso(last_fired), "next_timer": _iso(next_at),
    }


async def _suggestion(con, scope: str, name: str, entry: dict) -> Optional[dict]:
    """A ROCOTO-created watch SURFACES only once it has reached a resolution or a decidable action
    (SPEC §5.6 / Peter's brief). Both are real rows, never a flag:
      · a RESOLVED tab under this tracker's key  → the watch concluded something;
      · a pending needs_human `action` carrying one of its tabs' `loop_id` (what the gate and the
        worker really write when a rung parks) → it is asking for a decision.
    Anything else is still just running, and running is INVISIBLE."""
    key = f"{KEY_PREFIX}{name}"
    row = await con.fetchrow(
        "select id, text, resolution, resolved_at from open_loop "
        "where scope=$1::ltree and (entity_key = $2 or entity_key like $2 || ':%') "
        "and status='resolved' order by resolved_at desc nulls last, id desc limit 1", scope, key)
    parked = await con.fetchrow(
        "select a.id, a.reason, coalesce(a.payload->>'sentence','') as sentence, a.created_at "
        "from action a join open_loop l on l.id = (a.payload->>'loop_id')::bigint "
        "where a.scope=$1::ltree and a.needs_human and a.state='pending' "
        "and a.payload ? 'loop_id' "
        "and (l.entity_key = $2 or l.entity_key like $2 || ':%') "
        "order by a.id desc limit 1", scope, key)
    if row is None and parked is None:
        return None
    if parked is not None:
        return {"text": parked["sentence"] or entry.get("title") or name,
                "at": _iso(parked["created_at"]), "resolution": None,
                "action_id": int(parked["id"]), "reason": parked["reason"],
                "actions": entry.get("actions") or list(DEFAULT_ACTIONS)}
    res = _asjson(row["resolution"], {}) or {}
    return {"text": row["text"] or entry.get("title") or name, "at": _iso(row["resolved_at"]),
            "resolution": res.get("branch_id"),
            "actions": entry.get("actions") or list(DEFAULT_ACTIONS)}


async def set_enabled(scope: str, name: str, enabled: bool) -> dict:
    """Pause / enable a tracker. Pausing DISABLES the row (the binder stops opening tabs from it) and
    emits the disarm event, which resolves its open watch tab and cancels its armed rungs through the
    ordinary binder — so a paused tracker has no live clock, and enabling re-arms a cadence watch.

    The row is LOCATED across the same ladder the registry lists (a surface pauses a business-wide
    watch from a customer's screen) and then WRITTEN on its OWN scope's connection: rocoto_ctrl may
    read every scope but may not write the manifest, and a descendant's connection cannot write its
    ancestor's row. One lookup, one honest writer."""
    import db
    import duties
    import spine
    name = _slug(name)
    async with db.control_pool().acquire() as con:
        await con.set_type_codec("jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog")
        row = await con.fetchrow(
            "select scope::text as sc, gate_policy from manifest_duty "
            "where name=$2 and ($1::ltree <@ scope or scope=$3::ltree) and gate_policy ? 'tracker' "
            "order by nlevel(scope) desc limit 1", scope, name, __import__("gate").app_scope(scope))
    if row is None:
        return {"ok": False, "reason": "not_found", "name": name}
    own = row["sc"]
    cfg = _asjson(row["gate_policy"], {}) or {}
    t = cfg.get("tracker") or {}
    # ORDER MATTERS, in opposite directions — the binder only ever sees ENABLED rows:
    #   · PAUSE  — disarm FIRST (the row must still be enabled for `resolves_on` to match and close its
    #              tab + cancel its rungs), and only then flip the flag. Flipping first leaves the tab
    #              open with a live clock that no longer belongs to any duty: a paused watch that keeps
    #              its promise to speak.
    #   · ENABLE — flag first, then arm, for exactly the mirror reason.
    duties.invalidate_cache(own)
    if not enabled:
        async with db.scoped_tx(own) as con:
            eid, _ = await spine.append_event(con, own, DISARM_EVENT, "runtime",
                                              {"tracker": name}, lane="world")
            await duties.react_to_sense(con, own, DISARM_EVENT, {"tracker": name},
                                        opened_by_event=eid)
    async with db.scoped_tx(own) as con:
        n = await con.execute("update manifest_duty set enabled=$3 where scope=$1::ltree and name=$2",
                              own, name, bool(enabled))
    if not str(n).endswith("1"):
        return {"ok": False, "reason": "not_writable", "name": name, "scope": own}
    duties.invalidate_cache(own)
    if enabled and not t.get("hook"):
        async with db.scoped_tx(own) as con:
            eid, _ = await spine.append_event(con, own, ARM_EVENT, "runtime",
                                              {"tracker": name, "title": t.get("title") or name},
                                              lane="world")
            await duties.react_to_sense(con, own, ARM_EVENT,
                                        {"tracker": name, "title": t.get("title") or name},
                                        opened_by_event=eid)
    log.info("trackers: %s %s on %s", name, "ENABLED" if enabled else "PAUSED", own)
    return {"ok": True, "name": name, "enabled": bool(enabled), "scope": own}
