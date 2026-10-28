"""spine.py — the event spine's sensing→append organ (SPEC §4.5 ①, §3, §6).

The universal ingest path for the employee runtime. Two lanes (SPEC §4.5 ① / §5.0.1 T0):
  * CHAT (conversational): endpoint→contact resolution; a miss atomically bootstraps a provisional
    party (contact + scope_node + card v0 + endpoint + the first event, one commit, race-safe).
    Only chat opens a debounce window (upsert_pending_turn).
  * WEBHOOK (non-conversational): resolve scope by ENTITY-KEY join (provider id → canonical key →
    owning fact/loop's scope). An unresolvable key DEAD-LETTERS with a problem — never a ghost
    contact, never a silent drop. A webhook NEVER opens a debounce window and runs a deterministic
    apply_world_update (no LLM on the webhook lane, SPEC §4.2).

Every function takes an asyncpg connection so it's testable against any DB (the rehearsal clone runs
the vitals; the live service passes a pool connection). Idempotent on dedupe_key (SPEC delivery
contract §5.0): a replayed webhook writes zero new rows. All scope params cast ::ltree explicitly
(asyncpg has no native ltree codec).
"""
from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Any, Optional

import asyncpg

log = logging.getLogger("rocoto.spine")

# NOTE ON jsonb: every connection passed in MUST have asyncpg's jsonb codec registered
# (db._init_conn / db.prepare_conn does this on pool + standalone connections). We pass Python
# dicts DIRECTLY as jsonb params — never json.dumps()+"::jsonb", which DOUBLE-ENCODES under the
# codec (verified: stored as a JSON string, not an object). Scope params are cast ::ltree.


# ── scope path builders (ltree labels are [A-Za-z0-9_]; SPEC §3 canonical paths) ────────────
def _lbl(s: str) -> str:
    """Sanitize an arbitrary string into ONE valid ltree label."""
    lab = re.sub(r"[^A-Za-z0-9_]", "_", (s or "").strip())
    lab = re.sub(r"_+", "_", lab).strip("_").lower()
    return lab or "x"


def scope_creator() -> str:
    return "peter"


def scope_tenant(slug: str) -> str:
    return f"t.{_lbl(slug)}"


def scope_customer(slug: str, contact_id: int) -> str:
    return f"t.{_lbl(slug)}.c.{int(contact_id)}"


def scope_prospect(contact_id: int) -> str:
    return f"prospect.{int(contact_id)}"


# ── lineage — DERIVED FROM THE SCOPE, never from whether a call site remembered ─────────────
# THE BUG THIS KILLS (2026-08-09 adversarial verification of /demo, BUG 2). `lineage` was a kwarg
# defaulting to 'live', so every one of the 155 `append_event` call sites in this codebase had to
# pass it correctly on a test scope or silently mistag the row. Two did not — `lifecycle.py`'s
# STAGE_CHANGED and `duties.py`'s `tab.brief` — so two of every eight events one /demo turn wrote
# landed `lineage='live'`. `sweep.py`'s candidate scan is `lane='world' and lineage='live'`, which
# made a stranger's throwaway demo world a production fact-sweep candidate: reproduced as
# `{'events': 6, 'facts_written': 3}` — a Haiku call and three `fact` rows distilled out of a
# prospect's message, their drafted order and the reply. Unmetered spend outside the 24h ceiling,
# and retained text about a person nobody promised to retain.
#
# A default that must be passed correctly at every call site is a bug generator, so the derivation
# moved HERE, to the one statement that writes the column. The `test.` prefix is already load-bearing
# everywhere else (runtime.run_turn's `is_test`, tenancy.demo_scope's docstring, orders_tool's
# `_lineage_of`) — this makes it structural rather than a convention 155 places have to honour.
# It OVERRIDES an explicit kwarg on purpose: on a `test.` scope there is no legitimate 'live' row,
# so a caller that asks for one is wrong and the spine does not help it be wrong quietly.
#
# THIS IS ONE OF THREE INSTANCES OF THE SAME SHAPE found on 2026-08-09 — a rule expressed somewhere
# that can silently drift from the thing it describes, failing by ABSENCE with nothing raised. The
# other two (a slug pattern deciding which tenants are demo tenants; a comment deciding which routes
# are expensive) and the general lesson are written out in full in `demo_flow.py`, above `reap()`.
# Read that box before you add a rule that lives away from the thing it governs.
def lineage_of(scope: str) -> str:
    """'test' for any `test.`-prefixed scope, else 'live'. THE one derivation (SPEC §13 / WP-E)."""
    return "test" if (scope or "").startswith("test.") else "live"


# ── append (idempotent on dedupe_key) ───────────────────────────────────────────────────────
async def append_event(con: asyncpg.Connection, scope: str, type: str, source: str = "runtime",
                        payload: Optional[dict] = None, caused_by: Optional[int] = None,
                        lane: str = "world", dedupe_key: Optional[str] = None,
                        actor: str = "system", lineage: str = "live",
                        ts: Optional[datetime] = None) -> tuple[int, bool]:
    """Append one event; return (event_id, is_new). A duplicate dedupe_key returns the existing
    id with is_new=False (SPEC §4.5 ①: a replayed webhook is dedup-swallowed, zero new rows).

    `lineage` is DERIVED from the scope whenever the scope is `test.`-prefixed — see `lineage_of`
    above. Passing it explicitly still works for the live half (a caller may tag a non-test scope),
    but no call site can put a 'live' row on a test world any more, deliberately or by omission.

    `ts` OVERRIDES THE CLOCK, and exists for exactly one caller: the history REPLAY (`backfill.py`).
    Every live path leaves it None and takes the column default, which is what keeps «when did this
    happen» honest for everything that actually happened here. A replayed conversation from March
    must carry March's timestamp — a backfill that stamps today would tell the fold that a
    two-year-old order arrived this morning, and the whole point of replaying is that the dates are
    the information."""
    payload = payload or {}
    if (scope or "").startswith("test."):
        lineage = "test"
    if dedupe_key:
        existing = await con.fetchval("select id from event where dedupe_key=$1", dedupe_key)
        if existing is not None:
            return int(existing), False
    try:
        if ts is None:
            eid = await con.fetchval(
                "insert into event(scope,type,source,payload,caused_by,lane,dedupe_key,actor,lineage) "
                "values($1::ltree,$2,$3,$4,$5,$6,$7,$8,$9) returning id",
                scope, type, source, payload, caused_by, lane, dedupe_key, actor, lineage,
            )
        else:
            eid = await con.fetchval(
                "insert into event(scope,ts,type,source,payload,caused_by,lane,dedupe_key,actor,lineage) "
                "values($1::ltree,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id",
                scope, ts, type, source, payload, caused_by, lane, dedupe_key, actor, lineage,
            )
        return int(eid), True
    except asyncpg.UniqueViolationError:
        # race on dedupe_key — the other writer won; return its row. Guard the None case: the only
        # unique index on event is partial (WHERE dedupe_key IS NOT NULL), so a null key can't raise
        # this today — but if a future constraint does, don't int(None): re-raise the real error.
        if not dedupe_key:
            raise
        eid = await con.fetchval("select id from event where dedupe_key=$1", dedupe_key)
        if eid is None:
            raise
        return int(eid), False


# ── the generic lifecycle fold (SPEC §16.6: a situation's STATE is a fold over events, driven
# by a DATA spec — never a per-situation state machine in code) ─────────────────────────────
async def fold_lifecycle(con: asyncpg.Connection, scope: str, prefix: str,
                         spec: Optional[dict]) -> dict:
    """Fold the current state of a situation from its events on a scope. `prefix` selects the event
    family ('employment.' → type like 'employment.%'); `spec` is pure data (a manifest row, §3.2):
      {"initial": "trial", "terminal": ["offboarded"],
       "transitions": {"<type>": "state"                    -- unconditional
                       | {"from": "strike", "to": "active"}  -- only if the current state matches
                       | null }}                             -- explicit no-op
    An event type absent from the map is a no-op (an unknown sense never corrupts the state).
    Deterministic: ordered by event id (the spine is append-only, id-monotonic), world-lane only.
    Returns {state, since, last_event}. Fail-soft: on any error → the spec's initial state."""
    spec = spec or {}
    initial = spec.get("initial") or "unknown"
    terminal = set(spec.get("terminal") or [])
    transitions = spec.get("transitions") or {}
    default = {"state": initial, "since": None, "last_event": None}
    try:
        rows = await con.fetch(
            "select id, ts, type from event where scope=$1::ltree and type like $2 "
            "and lane='world' order by id", scope, prefix + "%")
    except Exception:
        log.exception("fold_lifecycle failed (fail-soft → %s) for %s", initial, scope)
        return default
    state, since, last_type = initial, None, None
    for r in rows:
        if state in terminal:
            break
        prev = state
        t = transitions.get(r["type"])   # absent OR explicit null → no-op
        if isinstance(t, str):
            state = t
        elif isinstance(t, dict):
            if state == t.get("from"):
                state = t.get("to") or state
        if state != prev or since is None:
            since = r["ts"]
        last_type = r["type"]
    return {"state": state, "since": since, "last_event": last_type}


# ── identity resolution ─────────────────────────────────────────────────────────────────────
def _bootstrap_card(display_name: str, tier: str) -> str:
    """The templated version-0 card body — first assembly never reads a hole (SPEC §4.1/§6)."""
    who = display_name or "(sin nombre todavía)"
    return f"FICHA · {who} · {tier} · (recién conocido — aún no sé casi nada)"


async def resolve_chat_scope(con: asyncpg.Connection, tenant_slug: Optional[str], kind: str,
                             addr: str, dest_is_sales: bool = False,
                             display_name: str = "", scope_override: Optional[str] = None,
                             tier_override: Optional[str] = None) -> tuple[str, int, bool]:
    """endpoint→contact; a miss atomically bootstraps a provisional party. Returns
    (scope, contact_id, is_new_party). Race-safe via a per-endpoint advisory xact lock so two
    racing first-events can't mint two parties (SPEC §3 endpoint UNIQUE + upsert).

    `scope_override` pins a DETERMINISTIC scope path for a channel (WhatsApp uses `wa.<digits>` so a
    party's scope is stable and human-legible and existing memory carries over) — the identity graph
    (contact+endpoint+scope_node+card) is still populated so the fold + the worker's address resolve
    work. `tier_override` forces the boot tier (e.g. 'creator' for Peter's own number).

    AN ADDRESS BELONGS TO A TENANT, NOT TO THE BOX (WP-A1 phase C). This lookup used to key on
    `(kind, addr)` alone — the only unique key `endpoint` had — so two distributors who shared a
    customer shared ONE party: the second tenant asked for a party by phone number and got the
    first tenant's, with no error raised anywhere. Measured, not theorised
    (A1-TENANT-SCOPE-CUTOVER §7.1). The key is now `(tenant_slug, kind, addr)` and so is this
    query. `tenant_slug=None` still matches the unowned row, which is what the try-chat rail and
    any pre-tenancy party want.
    """
    row = await con.fetchrow(
        "select c.id, c.scope::text as scope from endpoint e join contact c on c.id=e.contact_id "
        "where e.kind=$1 and e.addr=$2 and e.tenant_slug is not distinct from $3",
        kind, addr, tenant_slug)
    if row:
        return row["scope"], int(row["id"]), False

    async with con.transaction():
        # Serialize the bootstrap for THIS endpoint; released at commit. THE LOCK IS TENANT-KEYED
        # for the same reason the lookup is: an unkeyed lock would serialise two tenants' unrelated
        # bootstraps, and — far worse — the loser would re-read, find the winner's row under the old
        # address-only predicate, and ATTACH to another tenant's contact.
        await con.execute("select pg_advisory_xact_lock(hashtext($1))",
                          f"{tenant_slug or '-'}:{kind}:{addr}")
        row = await con.fetchrow(
            "select c.id, c.scope::text as scope from endpoint e join contact c on c.id=e.contact_id "
            "where e.kind=$1 and e.addr=$2 and e.tenant_slug is not distinct from $3",
            kind, addr, tenant_slug)
        if row:  # the racer beat us here — attach, don't mint
            return row["scope"], int(row["id"]), False

        # ── EXPAND-WINDOW SHIM (WP-A1 phase C; delete with the contract migration) ──────────────
        # Between the expand migration and the contract one, BOTH keys exist: the new
        # (tenant_slug, kind, addr) AND the legacy global (kind, addr). That is deliberate — the
        # deploy harness restarts ~10 minutes after it migrates, so the old code, which says
        # `on conflict (kind, addr)`, has to keep working for the whole regression. The cost is that
        # a SECOND tenant cannot yet hold the same address: the legacy key rejects the row, and
        # because our insert names the other constraint, the violation is raised rather than
        # absorbed — which surfaced as a silent `events=0` (vital_sombra), the ingest being
        # fail-soft. So while the legacy key is still standing, fall back to the pre-tenancy
        # behaviour and ATTACH to whatever party owns this address. It is the old answer, which is
        # the correct one to give in the old state; once `endpoint_kind_addr_key` is dropped this
        # lookup finds nothing and a genuinely separate party is minted.
        legacy_key = await con.fetchval(
            "select 1 from pg_constraint where conrelid='endpoint'::regclass "
            "and conname='endpoint_kind_addr_key'")
        if legacy_key:
            row = await con.fetchrow(
                "select c.id, c.scope::text as scope from endpoint e join contact c on c.id=e.contact_id "
                "where e.kind=$1 and e.addr=$2", kind, addr)
            if row:
                return row["scope"], int(row["id"]), False

        tier = tier_override or ("prospect" if dest_is_sales else "customer")
        if scope_override:
            # Scope is known up-front (WhatsApp/voice = wa.<digits>) → insert the contact ON its real
            # scope directly. The 'tmp'-then-update dance is only for the cid-derived path, and 'tmp'
            # would violate `contact` RLS (tmp is not <@ the runtime scope GUC) — the closed liveness bug.
            scope = scope_override
            cid = await con.fetchval(
                "insert into contact(scope,tenant_slug,tier,display_name,provisional) "
                "values($1::ltree,$2,$3,$4,true) returning id", scope, tenant_slug, tier, display_name)
        else:
            cid = await con.fetchval(
                "insert into contact(scope,tenant_slug,tier,display_name,provisional) "
                "values('tmp'::ltree,$1,$2,$3,true) returning id", tenant_slug, tier, display_name)
            scope = scope_prospect(cid) if dest_is_sales else scope_customer(tenant_slug or "unknown", cid)
            await con.execute("update contact set scope=$1::ltree where id=$2", scope, cid)
        await con.execute(
            "insert into scope_node(scope,tier,tenant_slug,label) values($1::ltree,$2,$3,$4) "
            "on conflict (scope) do nothing", scope, tier, tenant_slug, display_name)
        await con.execute("insert into endpoint(contact_id,kind,addr,tenant_slug) values($1,$2,$3,$4) "
                          "on conflict (tenant_slug,kind,addr) do nothing", cid, kind, addr, tenant_slug)
        await con.execute("insert into card(scope,body,version) values($1::ltree,$2,0) "
                          "on conflict (scope) do nothing", scope, _bootstrap_card(display_name, tier))
    return scope, int(cid), True


async def record_entity_mapping(con: asyncpg.Connection, provider: str, provider_id: str,
                                scope: str, canonical_key: str) -> None:
    """Record the creation-time mapping (SPEC §4.5 ①): when WE create a provider object we bind its
    globally-unique provider_id to the ONE owning scope + our canonical key. Webhooks resolve by this."""
    await con.execute(
        "insert into entity_map(provider,provider_id,scope,canonical_key) values($1,$2,$3::ltree,$4) "
        "on conflict (provider,provider_id) do update set scope=excluded.scope, canonical_key=excluded.canonical_key",
        provider, provider_id, scope, canonical_key)


async def resolve_webhook_scope(con: asyncpg.Connection, provider: str, provider_id: Optional[str],
                                canonical_key: Optional[str] = None) -> tuple[Optional[str], Optional[str]]:
    """Resolve a webhook's scope deterministically (SPEC §4.5 ①). Returns (scope, canonical_key);
    scope is None → caller DEAD-LETTERS (never a ghost contact, never an arbitrary tenant).
      1) AUTHORITATIVE: the creation-time entity_map keyed on the globally-unique provider_id.
      2) FALLBACK: the canonical key — but ONLY if it resolves to EXACTLY ONE scope (0 or >1 distinct
         scopes → ambiguous → dead-letter). The human key is per-tenant, so an unqualified LIMIT 1
         would leak across tenants (the closed bug)."""
    if provider_id:
        row = await con.fetchrow(
            "select scope::text as scope, canonical_key from entity_map where provider=$1 and provider_id=$2",
            provider, provider_id)
        if row:
            return row["scope"], row["canonical_key"]
    if canonical_key:
        rows = await con.fetch(
            "select distinct scope::text as scope from fact where key=$1 and invalid_at is null "
            "order by scope", canonical_key)
        if len(rows) == 0:
            rows = await con.fetch(
                "select distinct scope::text as scope from open_loop where entity_key=$1 and status='open' "
                "order by scope", canonical_key)
        if len(rows) == 1:                         # unambiguous
            return rows[0]["scope"], canonical_key
        # 0 rows (unknown) or >1 (ambiguous, per-tenant key collision) → unresolvable
    return None, canonical_key


# ── deterministic world-update (SPEC §4.2 / §4.3 — webhook→fact, ZERO model calls) ──────────
async def apply_world_update(con: asyncpg.Connection, scope: str, wtype: str, entity_key: str,
                             payload: dict) -> list[int]:
    """The no-LLM deterministic write path. Returns ids of facts touched. Extended per emitter in
    later WPs; the canonical case here is a payment flipping its keyed COMMERCIAL fact (SPEC §0.6
    apply_world_update vital)."""
    touched: list[int] = []
    if wtype in ("stripe.payment", "medusa.paid", "payment") and entity_key:
        # IDEMPOTENT ON OUTCOME (SPEC §4.2 / §3.1 restatement→drop): if a current paid fact already
        # exists for this key, a redelivered/second-provider payment is a no-op — never invalidate the
        # fresh 'pagada' and duplicate it.
        already = await con.fetchval(
            "select 1 from fact where scope=$1::ltree and key=$2 and invalid_at is null "
            "and text like '%pagada%' limit 1", scope, entity_key)
        if already:
            return touched
        # flip the standing (unpaid) COMMERCIAL fact → history.
        cur = await con.fetchval(
            "update fact set invalid_at=now() where scope=$1::ltree and key=$2 and invalid_at is null "
            "and text not like '%pagada%' returning id", scope, entity_key)
        if cur is not None:
            touched.append(int(cur))
            # only mint 'pagada' when there WAS a prior fact — a stray payment for an unknown invoice
            # must not orphan-insert a fact (it is still recorded as an event on the resolved scope).
            nid = await con.fetchval(
                "insert into fact(scope,kind,text,key,valid_at) values($1::ltree,'COMMERCIAL',$2,$3,now()) "
                "returning id", scope, f"{entity_key} pagada", entity_key)
            touched.append(int(nid))
    return touched


# ── debounce (SPEC §4.6 — conversational ONLY) ──────────────────────────────────────────────
async def upsert_pending_turn(con: asyncpg.Connection, scope: str, debounce_seconds: int = 8) -> None:
    await con.execute(
        "insert into pending_turn(scope,deadline,state) "
        "values($1::ltree, now() + ($2 || ' seconds')::interval, 'armed') "
        "on conflict (scope) do update set deadline=excluded.deadline, state='armed', updated_at=now()",
        scope, str(int(debounce_seconds)))


# ── the two-lane ingest orchestrators ───────────────────────────────────────────────────────
async def ingest_chat(con: asyncpg.Connection, tenant_slug: Optional[str], kind: str, addr: str,
                      text: str, dedupe_key: Optional[str] = None, dest_is_sales: bool = False,
                      display_name: str = "", media: Optional[list] = None,
                      scope_override: Optional[str] = None, tier_override: Optional[str] = None,
                      source: Optional[str] = None, debounce_seconds: int = 8,
                      extra: Optional[dict] = None) -> dict:
    """A conversational message: resolve/bootstrap scope → append ONE event → arm the debounce.

    `extra` merges EXTRA payload keys onto the event without forking this path (the one-tap answer
    carries {"interactive": {option_id, asked_wamid, …}} here). The core {text, addr, kind} keys
    always win — an extra can enrich an inbound, never rewrite what was said."""
    scope, cid, new_party = await resolve_chat_scope(
        con, tenant_slug, kind, addr, dest_is_sales, display_name,
        scope_override=scope_override, tier_override=tier_override)
    payload: dict[str, Any] = dict(extra or {})
    payload.update({"text": text, "addr": addr, "kind": kind})
    if media:
        payload["media"] = media
    eid, new_event = await append_event(con, scope, "message", source or kind, payload, dedupe_key=dedupe_key)
    if new_event:
        await upsert_pending_turn(con, scope, debounce_seconds)  # conversational ONLY
    return {"scope": scope, "contact_id": cid, "event_id": eid,
            "is_new_event": new_event, "is_new_party": new_party}


# ── turn helpers (SPEC §4.5 ② turn fires) ────────────────────────────────────────────────────
async def read_burst(con: asyncpg.Connection, scope: str, since_event_id: Optional[int] = None,
                     limit: int = 20) -> list[asyncpg.Record]:
    """The unanswered inbound burst — world-lane inbound 'message' events since the last watermark
    (or the recent tail). The turn reasons over the burst; assembly supplies the deep window."""
    if since_event_id:
        return await con.fetch(
            "select id, ts, type, source, payload from event where scope=$1::ltree and lane='world' "
            "and type='message' and id>$2 order by id asc limit $3", scope, int(since_event_id), limit)
    return list(reversed(await con.fetch(
        "select id, ts, type, source, payload from event where scope=$1::ltree and lane='world' "
        "and type='message' order by id desc limit $2", scope, limit)))


async def claim_turn(con: asyncpg.Connection, scope: str) -> bool:
    """Claim a due debounce turn (SPEC §4.5 ②): flip pending_turn armed→fired atomically. Returns True
    to exactly ONE claimant per burst (later inbounds re-arm it; the loser no-ops). The per-scope
    advisory lock is taken by the caller AROUND SQL ONLY, never across the LLM (pool-exhaustion trap)."""
    row = await con.fetchrow(
        "update pending_turn set state='fired', updated_at=now() "
        "where scope=$1::ltree and state='armed' and deadline<=now() returning watermark_event_id", scope)
    return row is not None


async def retire_pending_turn(con: asyncpg.Connection, scope: str) -> None:
    """WP-1 double-fire fix — the HAPPY path: the live handler has answered this burst, so flip the
    debounce row to 'fired' so the worker's durability backstop never re-fires an already-answered turn.
    (The backstop only fires rows still 'armed' past a MARGIN with no msg.sent since.)"""
    await con.execute("update pending_turn set state='fired', updated_at=now() "
                      "where scope=$1::ltree and state in ('armed','suspended')", scope)


# ── WP-1 the wake spine ──────────────────────────────────────────────────────────────────────
async def arm_wake(con: asyncpg.Connection, scope: str, reason: str, detail: Optional[dict] = None,
                   dedupe_key: str = "", caused_by: Optional[int] = None) -> Optional[int]:
    """Arm a wake — a durable 'come back and reason' signal (escalate | approval | takeover_end). Insert
    this in the SAME tx as the triggering event. (scope,reason,dedupe_key) collapses N producers → EXACTLY
    one armed row (the partial unique index). Returns the new wake id, or None if deduped."""
    import json as _json
    return await con.fetchval(
        "insert into wake(scope,reason,detail,dedupe_key,caused_by) "
        "values($1::ltree,$2,$3::jsonb,$4,$5) on conflict do nothing returning id",
        scope, reason, _json.dumps(detail or {}), dedupe_key or "", caused_by)


async def absorb_wakes(con: asyncpg.Connection, scope: str) -> int:
    """A live chat turn subsumes this party's pending wakes (one party, one voice). Returns count."""
    r = await con.execute("update wake set state='absorbed' where scope=$1::ltree and state='armed'", scope)
    try:
        return int(r.split()[-1])
    except Exception:
        return 0


async def claim_wakes(con: asyncpg.Connection, scope: str) -> list:
    """Claim this scope's armed (or stale-firing >10min) wakes → 'firing' and return them for the
    wake-turn. SKIP LOCKED so two ticks never double-claim."""
    return await con.fetch(
        "update wake set state='firing', fired_at=now() where id in ("
        "  select id from wake where scope=$1::ltree and (state='armed' "
        "    or (state='firing' and fired_at < now() - interval '10 minutes')) "
        "  for update skip locked) returning id, reason, detail, dedupe_key, caused_by", scope)


async def finish_wakes(con: asyncpg.Connection, scope: str, ids: list, state: str = "fired") -> None:
    if not ids:
        return
    await con.execute("update wake set state=$2 where scope=$1::ltree and id = any($3::bigint[])",
                      scope, state, [int(i) for i in ids])


async def ingest_webhook(con: asyncpg.Connection, source: str, wtype: str, provider_id: Optional[str],
                         payload: dict, canonical_key: Optional[str] = None,
                         dedupe_key: Optional[str] = None, provider: Optional[str] = None) -> dict:
    """A business webhook: resolve scope by the globally-unique provider_id (via entity_map) →
    append → deterministic world-update. NEVER opens a debounce window. Ambiguous/unknown → dead-letter
    (a per-tenant key that resolves >1 scope is NEVER guessed — that was the cross-tenant leak)."""
    provider = provider or source
    scope, ck = await resolve_webhook_scope(con, provider, provider_id, canonical_key)
    if scope is None:
        await con.execute(
            "insert into dead_letter(source,reason,raw,problem) "
            "values($1,'unresolvable_entity',$2,$3)",
            source,
            {"provider": provider, "provider_id": provider_id, "canonical_key": canonical_key, "payload": payload},
            f"no unambiguous scope for provider={provider} id={provider_id} key={canonical_key}")
        return {"dead_lettered": True, "reason": "unresolvable_entity"}
    full = {**payload, "entity_key": ck, "provider_id": provider_id}
    eid, new_event = await append_event(con, scope, wtype, source, full, dedupe_key=dedupe_key)
    touched: list[int] = []
    cascade_res: dict = {}
    if new_event:
        touched = await apply_world_update(con, scope, wtype, ck, full)
        # WP-4 UNIFY: the webhook lane runs the SAME tab cascade as emit_sense — a payment matching an
        # open invoice tab RESOLVES it (+ cancels timers); a money tab ESCALATES to R1 (never auto-fires).
        if ck:
            try:
                import cascade
                cascade_res = await cascade.on_nonmessage_event(con, scope, eid, wtype, ck, full)
            except Exception:
                log.debug("cascade on ingest_webhook fail-soft", exc_info=True)
    return {"scope": scope, "event_id": eid, "is_new_event": new_event,
            "dead_lettered": False, "facts_touched": touched, "cascade": cascade_res}
