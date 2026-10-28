"""duties.py — the ONE generic duty-binder (L0 kernel; SPEC §16.6 LAW: situations are DATA).

There are no situation-named modules in this runtime. A "situation" (dunning a late salary, chasing a
quote, a delivery dispute, a reorder reminder, holiday cover…) is not code — it is a `manifest_duty`
ROW (§3.2) carrying its whole self as data:

    gate_policy = {
      "opens_on":    {"event": "<sense event type>", "key": "<entity-key template>",
                      "when": {"<payload key>": "<value>" | [<values>]}},      -- optional predicate
      "resolves_on": {"event": "<sense event type>", "branch_id": "<resolution label>",
                      "when": {...}, "key": "<override template>", "by": "key" | "kind"},
      "tab":  {"kind": "pending", "answer_shape": "money", "money": true, "text": "<tab text template>",
               "brief": "<open-time standing assessment>", "brief_label": "<who says it, in the fold>"},
      "rungs": [ {branch_id, after, gated, channel?, email_subject?, email_html?, trigger, sentence}, … ],
      "lifecycle": {"prefix": "<event family>.", "initial": "<state>", "terminal": [...],
                    "transitions": {"<event type>": "<state>" | {"from","to"} | null}},
      "soul": {"tier": "<boss|customer|…>", "label": "<SOUL line label>"}
    }

FOUR GENERIC CAPABILITIES (added in BLOCK B2 for the lead-pursuit tab; all four are row-level knobs,
none of them knows the word "pursuit"):
  · `when`  — a payload EQUALITY predicate on either side, so ONE event type can drive N rows that
              differ only by which value they care about (a `lifecycle.stage_changed` carrying
              stage=prospect opens the prospect row and nothing else). A scalar or a list (any-of).
  · `by: "kind"` on resolves_on — resolve THE open tab of this row's `tab.kind` on the scope, instead
              of matching an entity_key. That is the singleton semantic: a standing per-relationship
              tab is closed by identity, so it can never survive because a key template drifted.
  · RESOLVE-BEFORE-OPEN — react_to_sense runs the resolve pass over ALL rows first, then the open
              pass. One event may legitimately close one tab and open its successor; doing it in the
              other order trips a singleton index. Ordering is generic, not situational.
  · SAME-KIND CHILD LINK — a tab opened by the SAME event that resolved a tab of the SAME kind is
              child-linked to it (`parent_loop_id`), so a respawning chain is inspectable end to end.

A FIFTH was added in BLOCK C (the trackers), and it is one line of the same shape:
  · EXPLICIT `rearm` on a rung, overriding the derived next-rung one. A rung whose rearm names ITSELF
              is a RECURRING watch ("cada lunes…") — the whole of recurrence, as row data. Nothing in
              this module knows what is being watched, or that "trackers" exist.

This module BINDS any such row to the runtime primitives — nothing here knows the word "salary":
  · react_to_sense  — a sense event arrives → the duty whose `opens_on` matches OPENS its tab (pre-armed
                      contingencies from `rungs`, arm-together first-rung timer, §3.1); the duty whose
                      `resolves_on` matches RESOLVES the tab + cancels its timers.
  · lifecycle_state — folds the duty's state from its events via the GENERIC spine.fold_lifecycle.
  · soul_lines      — the duty's folded state as a SOUL line, for the tier its `soul.tier` names.

THE LITMUS (§16.6): a brand-new situation is added by inserting a row — zero Python. Adding a
`<situation>.py` is a design error. The ONLY code-earning exception is a perception REFLEX (§3.2),
which is itself manifest-registered.

Sentences carry {slot} placeholders resolved AT OPEN TIME from the sense payload (SPEC §3.1: literal
ready-to-send sentences — never templates the model expands). `{amt}` is derived from payload.amount.

Security (SPEC §16.6): because outbound sentences now live in rows, the L1 write channel IS the
outbound-policy boundary. The structural guards are unchanged — the worker crosses gate.check_outbound
on EVERY fired sentence unconditionally, `gated` is only an advisory UI hint, and any money-shaped
sentence PARKS for a human (§5). A row cannot exempt anything from the gate.

Everything takes an asyncpg connection where it writes (codec-registered, ::ltree cast). jsonb params
are Python dicts (NEVER json.dumps()+::jsonb — double-encodes under db's codec). Fail-soft: a hiccup
here must never take a live turn down — but a MISSING duty row on an open PARKS a needs_human action
(§5: nothing dies silently). Config reads go through the CTRL pool (cross-scope; the manifest is
installed configuration, not per-party memory — RLS lets rocoto_ctrl read every scope, §15.7).
"""
from __future__ import annotations

import json
import logging
import time
from typing import Any, Optional

import asyncpg

import spine

log = logging.getLogger("rocoto.duties")

# Config cache: the manifest is configuration, not memory — a brief per-scope TTL keeps a hot turn
# from re-reading it every time while staying near-live to edits.
_TTL = 60.0
_cache: dict[str, tuple[float, dict]] = {}


def _asjson(v: Any) -> Optional[dict]:
    """gate_policy comes back as a dict (codec conn) or text (non-codec conn) — normalize to dict."""
    if isinstance(v, dict):
        return v
    if isinstance(v, str):
        try:
            return json.loads(v)
        except Exception:
            return None
    return None


async def load_duties(scope: str) -> dict[str, dict]:
    """Every duty config applicable to `scope`, with THE NEARER ROW WINNING (by name).

    The ladder, farthest to nearest: the L1 creator-scope defaults → every ANCESTOR of `scope` →
    `scope`'s own rows. "Nearer wins" is the same law B6 pinned for the mode field, applied to the
    manifest: a watch installed on a whole business (`t.<slug>`) binds inside every conversation in
    that business (`t.<slug>.c.<id>`), and that customer's own row overrides it. Before BLOCK C only
    {creator, exact scope} were read, so a business-wide row bound nowhere but its own scope — the
    column looked hierarchical and behaved flat. Every row that exists today sits at the creator scope
    or a leaf party scope, so the ladder changes nothing that already ships and unlocks what §5.6's
    "ámbito: todo el negocio" promises.

    Read via the CTRL pool — rocoto_ctrl sees every scope (the RLS policy allows it unconditionally),
    so this works under FORCE RLS on prod AND on the no-RLS test DB. Cached ~60s. Returns
    {name: config}. Fail-soft: on any error → {} (no duty binds, a live turn is never taken down; an
    open that finds no duty simply doesn't fire)."""
    hit = _cache.get(scope)
    if hit and (time.monotonic() - hit[0]) < _TTL:
        return hit[1]
    creator = spine.scope_creator()
    merged: dict[str, dict] = {}
    try:
        import db
        pool = db.control_pool()
        async with pool.acquire() as con:
            await con.set_type_codec("jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog")
            # `$1 <@ scope` = the row's scope is an ancestor-or-self of this one (ltree containment).
            rows = await con.fetch(
                "select scope::text as sc, nlevel(scope) lvl, name, gate_policy from manifest_duty "
                "where enabled and ($1::ltree <@ scope or scope = $2::ltree) "
                "order by (scope = $2::ltree) desc, nlevel(scope)", scope, creator)
        # rows arrive creator-first, then ancestors shallow→deep, so a later (nearer) row overwrites.
        for r in rows:
            cfg = _asjson(r["gate_policy"])
            if cfg:
                merged[r["name"]] = cfg
    except Exception:
        log.exception("load_duties failed (fail-soft → {}) for %s", scope)
        merged = {}
    _cache[scope] = (time.monotonic(), merged)
    return merged


def invalidate_cache(scope: Optional[str] = None) -> None:
    """Drop cached duty config (a test or an L1 edit that must be seen immediately)."""
    if scope is None:
        _cache.clear()
    else:
        _cache.pop(scope, None)


# ── slot filling + rung binding (SPEC §3.1) ──────────────────────────────────────────────────
def _slots(payload: dict) -> dict[str, str]:
    """The substitution table for {slot} placeholders: every scalar payload key, plus the derived
    {amt} money slot (a leading space + parenthesised euros, or empty). Unknown slots stay literal
    (visible), never crash."""
    out: dict[str, str] = {}
    for k, v in (payload or {}).items():
        if isinstance(v, (str, int, float)):
            out["{" + k + "}"] = str(v)
    amount = (payload or {}).get("amount")
    out["{amt}"] = f" ({amount:.2f} €)" if isinstance(amount, (int, float)) else ""
    return out


def _fill(text: str, slots: dict[str, str]) -> str:
    s = str(text or "")
    for slot, val in slots.items():
        s = s.replace(slot, val)
    return s


def _contingencies(rungs: list[dict], slots: dict[str, str]) -> list[dict[str, Any]]:
    """Bind the row's rungs into the tab's pre-armed contingencies (§3.1): resolve each sentence's
    slots, and derive each rung's `rearm` from the NEXT rung's (branch_id, after) — the ladder cadence
    is pure row data; the chain the worker walks is derived here. Pass-throughs (channel, email_*,
    pacing_deadline — WP-0: slot-filled, bounds the worker's human-hours hold) ride straight to the
    worker.

    SIXTH + SEVENTH GENERIC KNOBS (BLOCK D), both pure pass-throughs above:
      · `review_source` — which of the three review sources (review.SOURCES) this rung's park carries.
        Only meaningful on a `channel: 'review'` rung; the binder never reads it.
      · `not_after` — a slot-filled ISO instant this rung must not fire LATER than. `pacing_deadline`
        bounds a HOLD; `not_after` bounds the ARM (duties._open clamps the first rung's clock to it).
        The prep cutoff is the one that matters today: a question window that lands after the order
        sheet has gone out is not a window (§5.8b — the `question_timeout` row's own window is ONE
        HOUR, and a 05:40 van still shortens it).

    FIFTH GENERIC KNOB (BLOCK C) — an EXPLICIT `rearm` on a rung WINS over the derived next-rung one.
    That is all a RECURRENCE is: a rung whose rearm names ITSELF re-arms itself forever at its own
    cadence ("cada lunes…"), because the worker arms whatever branch the rearm names and arm-together
    is satisfied by the rung already being a contingency on the tab. No scheduler, no cron, no repeat
    flag — one row-level knob, and the binder still knows nothing about what is being watched."""
    out: list[dict[str, Any]] = []
    for i, r in enumerate(rungs):
        c: dict[str, Any] = {
            "branch_id": r.get("branch_id") or f"r{i + 1}",
            "trigger": r.get("trigger") or "",
            "gated": bool(r.get("gated")),
            "action": {"sentence": _fill(r.get("sentence") or "", slots)},
        }
        for k in ("channel", "email_subject", "email_html", "pacing_deadline",
                  "review_source", "not_after"):
            if r.get(k):
                c[k] = _fill(r[k], slots) if isinstance(r[k], str) else r[k]
        nxt = rungs[i + 1] if i + 1 < len(rungs) else None
        explicit = r.get("rearm") if isinstance(r.get("rearm"), dict) else None
        if explicit and explicit.get("branch_id") and explicit.get("after"):
            c["rearm"] = {"after": explicit["after"], "branch_id": explicit["branch_id"]}
        elif nxt:
            c["rearm"] = {"after": nxt.get("after") or "1d",
                          "branch_id": nxt.get("branch_id") or f"r{i + 2}"}
        out.append(c)
    return out


# ── the `when` predicate — ONE event type, N rows, selected by DATA (never by an if in the runtime) ──
def _matches(spec: Any, event_type: str, payload: dict) -> bool:
    """Does this `opens_on`/`resolves_on` spec match the event that just landed?

    The event TYPE must match; then every key of the optional `when` map must equal the event
    payload's value for that key (a list means any-of). Compared as STRINGS so a row stays writable
    by a human without worrying whether the payload carried 3 or "3". An absent `when` matches
    everything — every pre-B2 row behaves exactly as before."""
    if not isinstance(spec, dict) or spec.get("event") != event_type:
        return False
    when = spec.get("when")
    if not isinstance(when, dict) or not when:
        return True
    for k, want in when.items():
        got = (payload or {}).get(k)
        if isinstance(want, (list, tuple)):
            if not any(str(got) == str(w) for w in want):
                return False
        elif str(got) != str(want):
            return False
    return True


# ── react_to_sense — the binder entry point ──────────────────────────────────────────────────
async def react_to_sense(con: asyncpg.Connection, scope: str, event_type: str, payload: dict,
                         *, opened_by_event: Optional[int] = None) -> dict:
    """A sense event landed on `scope`. Resolve every duty whose `resolves_on` matches, THEN open every
    duty whose `opens_on` matches. Deterministic + data-driven. Returns {reacted: [...]}.

    TWO PASSES, resolve first (B2). One event may legitimately close a standing tab and open its
    successor (a lifecycle transition does exactly that); interleaving the verbs in dict order would
    make the outcome depend on row insertion order, and would trip a singleton index by opening the
    successor while the predecessor is still open. Resolve-then-open is the only ordering that is
    correct for every row, so it is the binder's ordering — not a per-situation special case.

    The resolve pass also records which tab it closed PER TAB KIND; the open pass child-links a new tab
    of that same kind to it (`parent_loop_id`), so a respawning chain is inspectable end to end."""
    payload = payload or {}
    duties = await load_duties(scope)
    reacted: list[dict] = []
    resolved_by_kind: dict[str, int] = {}
    for name, cfg in duties.items():                       # PASS 1 — RESOLVE
        if _matches(cfg.get("resolves_on"), event_type, payload):
            r = await _resolve(con, scope, name, cfg, payload, opened_by_event, event_type)
            reacted.append({"duty": name, "verb": "resolve", **r})
            if r.get("tab_id"):
                resolved_by_kind.setdefault(_kind_of(cfg), int(r["tab_id"]))
    for name, cfg in duties.items():                       # PASS 2 — OPEN
        if _matches(cfg.get("opens_on"), event_type, payload):
            r = await _open(con, scope, name, cfg, payload, opened_by_event,
                            parent_loop_id=resolved_by_kind.get(_kind_of(cfg)))
            reacted.append({"duty": name, "verb": "open", **r})
    return {"reacted": reacted}


def _kind_of(cfg: dict) -> str:
    return (cfg.get("tab") or {}).get("kind") or "pending"


async def _open(con: asyncpg.Connection, scope: str, name: str, cfg: dict, payload: dict,
                opened_by_event: Optional[int], parent_loop_id: Optional[int] = None) -> dict:
    """Open the duty's tab: the row's rungs as pre-armed contingencies, its first rung armed
    (arm-together). Idempotent on the entity-key (one open tab per keyed matter). A row with no rungs
    is a CONFIG HOLE → park needs_human (§5), never a silent drop.

    `parent_loop_id` child-links this tab to the same-kind tab the SAME event just resolved (the
    respawn chain). The insert runs inside its own SAVEPOINT so a uniqueness constraint (e.g. the
    one-open-pursuit-per-relationship partial index) rolls back only this open and leaves the caller's
    transaction usable — and then PARKS needs_human loudly instead of dying in a log line (§5)."""
    opens = cfg.get("opens_on") or {}
    slots = _slots(payload)
    # {parent} is the chain slot: the row writes the whole sentence, the binder only fills the value —
    # exactly like {amt}. Empty when this tab starts a chain, so the row's text reads clean either way.
    slots["{parent}"] = f" (encadenado con el anterior #{int(parent_loop_id)})" if parent_loop_id else ""
    key_tmpl = opens.get("key") or ""
    entity_key = _fill(key_tmpl, slots) if key_tmpl else None
    try:
        if entity_key:
            existing = await con.fetchval(
                "select id from open_loop where scope=$1::ltree and entity_key=$2 and status='open' limit 1",
                scope, entity_key)
            if existing is not None:
                log.info("duties[%s]: tab already open for %s (%s) — no-op", name, scope, entity_key)
                return {"tab_id": int(existing), "already_open": True}

        rungs = cfg.get("rungs") or []
        if not rungs:
            log.error("duties[%s]: no rungs in the manifest row for %s — parking needs_human", name, scope)
            await con.execute(
                "insert into action(scope,kind,payload,state,reason,needs_human,money,opened_by_event) "
                "values($1::ltree,'duty_open',$2,'pending',$3,true,true,$4)",
                scope, {"duty": name, "entity_key": entity_key, "payload": payload},
                f"duty '{name}' fired but its manifest row has no rungs", opened_by_event)
            return {"no_rungs": True}

        contingencies = _contingencies(rungs, slots)
        tab = cfg.get("tab") or {}
        tab_text = _fill(tab.get("text") or f"{name}", slots)
        answer_shape = tab.get("answer_shape") or "free"
        kind = tab.get("kind") or "pending"
        money = bool(tab.get("money"))

        # ONE expression for both clocks: due_at is the "absence horizon (mirrors the armed timer)"
        # (schema §3.1) — it must be the moment the first rung FIRES, never now(). A due_at of now()
        # made every duty tab look overdue from birth while the real chase sat healthy days out.
        first_secs = str(_after_seconds(rungs[0].get("after", "0s")))
        # SEVENTH KNOB (BLOCK D) — `not_after`: a HARD horizon the first rung may not fire past. The
        # window shrinks to it; it never grows one (max(0, …) — a horizon already behind us means fire
        # now, not "never"). Both clocks (due_at + the armed timer) read this one expression, so the
        # tab's label stays its clock.
        first_secs = str(_clamp_secs(int(first_secs), contingencies[0].get("not_after")))
        try:
            async with con.transaction():        # SAVEPOINT — a constraint trip must not poison the tx
                tab_id = await con.fetchval(
                    "insert into open_loop(scope,kind,text,status,entity_key,answer_shape,contingencies,"
                    "notes,due_at,opened_by_event,money,parent_loop_id) "
                    "values($1::ltree,$2,$3,'open',$4,$5,$6,$7, now() + ($8 || ' seconds')::interval, $9,$10,$11) "
                    "returning id",
                    scope, kind, tab_text, entity_key, answer_shape, contingencies,
                    [{"event_id": int(opened_by_event) if opened_by_event else None,
                      "text": f"{name} opened ({entity_key})"}],
                    first_secs, opened_by_event, money,
                    int(parent_loop_id) if parent_loop_id else None)
        except asyncpg.UniqueViolationError as exc:
            # A STRUCTURAL INVARIANT refused this open (today: one open tab of kind `pursuit` per
            # relationship). Never swallow it — the runtime believes something the DB knows is false.
            log.error("duties[%s]: OPEN REFUSED by a uniqueness invariant on %s (%s) — parking "
                      "needs_human: %s", name, scope, entity_key, exc)
            await con.execute(
                "insert into action(scope,kind,payload,state,reason,needs_human,money,opened_by_event) "
                "values($1::ltree,'duty_open',$2,'pending',$3,true,false,$4)",
                scope, {"duty": name, "entity_key": entity_key, "kind": kind,
                        "parent_loop_id": int(parent_loop_id) if parent_loop_id else None,
                        "constraint": str(getattr(exc, "constraint_name", "") or "")},
                f"duty '{name}' could not open: a uniqueness invariant already holds an open "
                f"'{kind}' tab on this scope", opened_by_event)
            return {"blocked": True, "reason": "uniqueness_invariant", "kind": kind}

        # THE OPEN-TIME BRIEF (§3.1 "WHY is this open", §4.1.1 ④): a row may declare `tab.brief` — the
        # standing assessment this tab exists to carry. It is written as a REASONING-lane event bound to
        # the tab by `loop_id`, which is exactly what `assemble.tab_reasoning` reads, so it renders on
        # the tab's own line in the fold on BOTH mouths. A later T1 / advisor / process verdict on the
        # same tab simply supersedes it (tab_reasoning takes the LATEST by id). Opt-in: a row without a
        # `brief` writes nothing, so no tab gains a line that merely restates its own text.
        brief = _fill((cfg.get("tab") or {}).get("brief") or "", slots).strip()
        if brief:
            await spine.append_event(
                con, scope, "tab.brief", "runtime",
                {"loop_id": int(tab_id), "verdict": brief,
                 "process": (cfg.get("tab") or {}).get("brief_label") or name},
                caused_by=opened_by_event, lane="reasoning")

        first = contingencies[0]
        timer_id = await con.fetchval(
            "insert into timer(scope,loop_id,fires_at,kind,branch_id,state,armed_by_event) "
            "values($1::ltree,$2, now() + ($3 || ' seconds')::interval, 'absence',$4,'armed',$5) "
            "returning id",
            scope, tab_id, first_secs, first["branch_id"],
            opened_by_event)

        log.info("duties[%s]: OPENED tab %s + armed %s timer %s for %s (%s)",
                 name, tab_id, first["branch_id"], timer_id, scope, entity_key)
        return {"tab_id": int(tab_id), "timer_id": int(timer_id), "opened": True}
    except Exception:
        log.exception("duties[%s]._open failed (fail-soft) for %s / %s", name, scope, entity_key)
        return {"error": True}


def _scalars(payload: dict, cap: int = 16) -> dict:
    """The event's scalar payload — the auditable record of WHAT closed a tab, small enough to store
    inside `resolution`. Non-scalars (nested boxes maps, lists) are left out: the resolution is a
    receipt, not a second copy of the event."""
    out: dict[str, Any] = {}
    for k, v in (payload or {}).items():
        if isinstance(v, (str, int, float, bool)) and len(out) < cap:
            out[k] = v
    return out


async def _resolve(con: asyncpg.Connection, scope: str, name: str, cfg: dict, payload: dict,
                   resolved_by_event: Optional[int], event_type: str = "") -> dict:
    """Resolve the duty's open tab and cancel every armed rung timer — so a late fire finds the tab
    closed and no-ops. Idempotent.

    TWO WAYS TO FIND THE TAB, chosen by the row (`resolves_on.by`):
      · "key" (default) — the entity key, filled from `resolves_on.key` if the row overrides it, else
        from the SAME `opens_on.key` namespace the tab opened under. Right for keyed matters (one
        invoice, one order): the key IS the matter.
      · "kind" — EVERY open tab of this row's `tab.kind` on the scope. Right where identity, not a key
        template, is what makes it the same matter. It cannot leave a tab open because the key that
        would have matched drifted.
        ALL of them, not the newest (BLOCK D): for a SINGLETON kind (`pursuit`, held to one open tab
        per scope by ux_loop_one_pursuit) "all" and "the newest" are the same row, so nothing that
        shipped changes. For a kind that legitimately stacks — the §5.8 `question` tabs, one per
        question we asked — the resolving event ends the condition for ALL of them at once: ONE reply
        from the customer ends the SILENCE, whichever question it answers. Closing only the newest
        left the earlier question armed and timing out into review after the customer had plainly
        written back, which is the one thing the review rule promises cannot happen.

    The RESOLUTION records the triggering event as the receipt (`by_event` + its scalar payload), so
    "why did this close" is answerable from the tab row alone — no log archaeology."""
    opens = cfg.get("opens_on") or {}
    resolves = cfg.get("resolves_on") or {}
    slots = _slots(payload)
    key_tmpl = resolves.get("key") or opens.get("key") or ""
    entity_key = _fill(key_tmpl, slots) if key_tmpl else None
    branch = resolves.get("branch_id") or "resolved"
    by = str(resolves.get("by") or "key").lower()
    kind = _kind_of(cfg)
    resolution = {"branch_id": branch,
                  "resolved_by_event": int(resolved_by_event) if resolved_by_event else None,
                  "by_event": event_type or None,
                  "transition": _scalars(payload)}
    try:
        tab_id = None
        tab_ids: list[int] = []
        if by == "kind":
            # the identity close: EVERY open tab of this kind the relationship is carrying.
            tab_ids = [int(r["id"]) for r in await con.fetch(
                "update open_loop set status='resolved', resolved_at=now(), resolution=$3 "
                "where scope=$1::ltree and kind=$2 and status='open' returning id",
                scope, kind, resolution)]
            tab_id = max(tab_ids) if tab_ids else None
        elif entity_key:
            tab_id = await con.fetchval(
                "update open_loop set status='resolved', resolved_at=now(), resolution=$3 "
                "where scope=$1::ltree and entity_key=$2 and status='open' returning id",
                scope, entity_key, resolution)
        cancelled = 0
        ids = tab_ids or ([int(tab_id)] if tab_id is not None else [])
        if ids:
            # every clock on every tab we just closed — a resolved tab must never keep a live rung.
            cancelled = int(await con.fetchval(
                "with c as (update timer set state='cancelled' where loop_id = any($1::bigint[]) "
                "and state='armed' returning 1) select count(*) from c", ids) or 0)
        log.info("duties[%s]: RESOLVED %s (by=%s key=%s kind=%s) — tabs=%s, cancelled %d armed rung(s)",
                 name, scope, by, entity_key, kind, ids or None, cancelled)
        return {"resolved": bool(ids), "tab_id": int(tab_id) if tab_id else None,
                "tab_ids": ids, "timers_cancelled": cancelled}
    except Exception:
        log.exception("duties[%s]._resolve failed (fail-soft) for %s / %s", name, scope, entity_key)
        return {"error": True}


# ── lifecycle + SOUL (both fold via the GENERIC spine.fold_lifecycle from the row's map) ──────
async def lifecycle_state(con: asyncpg.Connection, scope: str, duty_name: str) -> dict:
    """The current lifecycle state of a duty on a scope, folded by the GENERIC spine.fold_lifecycle
    from the row's `lifecycle` map (adding a state/transition is a row edit, never code). Returns
    {state, since, last_event, open}. Fail-soft: a missing/broken row folds nothing and returns the
    map's initial (or 'unknown')."""
    duties = await load_duties(scope)
    cfg = duties.get(duty_name) or {}
    spec = cfg.get("lifecycle")
    if not isinstance(spec, dict) or not spec:
        return {"state": (spec or {}).get("initial", "unknown") if isinstance(spec, dict) else "unknown",
                "since": None, "last_event": None, "open": False}
    prefix = spec.get("prefix") or ""
    folded = await spine.fold_lifecycle(con, scope, prefix, spec)
    # is there a live open tab for this duty right now? (keyed by its opens_on namespace prefix)
    open_now = False
    opens = cfg.get("opens_on") or {}
    key_ns = (opens.get("key") or "").split("{", 1)[0]  # the literal prefix before the first slot
    if key_ns:
        try:
            open_now = bool(await con.fetchval(
                "select 1 from open_loop where scope=$1::ltree and status='open' and entity_key like $2 limit 1",
                scope, key_ns + "%"))
        except Exception:
            pass
    since = folded.get("since")
    return {"state": folded.get("state"), "since": since.isoformat() if since is not None else None,
            "last_event": folded.get("last_event"), "open": open_now}


async def soul_lines(con: asyncpg.Connection, scope: str, tier: str) -> list[str]:
    """The SOUL lines contributed by every duty whose `soul.tier` matches this relationship tier —
    each the duty's folded lifecycle state (so the employee genuinely knows, e.g., whether it's been
    paid). Data-driven: a new duty with a `soul` block contributes a line with zero code."""
    lines: list[str] = []
    try:
        duties = await load_duties(scope)
    except Exception:
        return lines
    for name, cfg in duties.items():
        soul = cfg.get("soul") or {}
        if not soul or soul.get("tier") != tier or not cfg.get("lifecycle"):
            continue
        try:
            st = await lifecycle_state(con, scope, name)
        except Exception:
            continue
        label = soul.get("label") or name
        lines.append(f"{label}: {st.get('state')}")
    return lines


# ── a rung's `after` ('5d'/'48h'/'30m'/'0s'/int) → seconds (mirrors worker._rearm_seconds) ────
def _after_seconds(after: Any) -> int:
    """Coerce a rung delay into seconds. Mirrors worker._rearm_seconds so the first rung armed here and
    the later rungs the worker arms from `rearm` share one interpretation. Defaults to 1 day on anything
    unparseable — a chase should still fire, never silently vanish. '0s'/0 = fire on the next tick."""
    if isinstance(after, (int, float)):
        return max(int(after), 0)
    s = str(after or "").strip().lower()
    if not s:
        return 86400
    try:
        if s.endswith("d"):
            return max(int(float(s[:-1]) * 86400), 0)
        if s.endswith("h"):
            return max(int(float(s[:-1]) * 3600), 0)
        if s.endswith("m"):
            return max(int(float(s[:-1]) * 60), 0)
        if s.endswith("s"):
            return max(int(float(s[:-1])), 0)
        return max(int(float(s)), 0)
    except (TypeError, ValueError):
        log.warning("duties: unparseable after=%r — defaulting to 1 day", after)
        return 86400


def _clamp_secs(secs: int, not_after: Any) -> int:
    """Shrink a rung's delay to the `not_after` horizon (BLOCK D). Never grows it; an unparseable or
    absent horizon leaves the delay exactly as the row wrote it (fail-soft: a clock we can't clamp is
    still a clock). A horizon already behind us fires on the next tick, never 'never'."""
    if not not_after:
        return secs
    try:
        from datetime import datetime, timezone
        s = str(not_after).strip().replace("Z", "+00:00")
        h = datetime.fromisoformat(s)
        if h.tzinfo is None:
            h = h.replace(tzinfo=timezone.utc)
        room = int((h - datetime.now(timezone.utc)).total_seconds())
        return max(min(secs, room), 0)
    except (TypeError, ValueError):
        log.warning("duties: unparseable not_after=%r — leaving the rung's own delay", not_after)
        return secs
