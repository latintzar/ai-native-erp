"""memory.py — the deterministic memory organs (SPEC §4.1, §4.3; BUILD-PLAN 2.1–2.2).

Two organs, both DETERMINISTIC (no LLM), the safety-critical half of memory:
  * write_fact — the bi-temporal fact writer with the three dedupe semantics (SPEC §3.1/§4.3 WRITE):
      exact-key restatement → DROP · exact-key contradiction → invalidate prior + insert (new version,
      old kept as history) · COMMERCIAL without a key → REJECT+dead-letter (never mint an unkeyed
      money fact). The cosine 0.75–0.88 band (flag-never-kill) rides on embeddings — deferred to the
      recall organ; documented, not silently skipped.
  * regen_card — the templated, byte-reproducible card (SPEC §4.1): one line per eligible CURRENT
      fact by kind priority, pinned kinds never evicted, capped at 24 lines / 800 tok. NO LLM, so the
      injected card is a pure function of the fact rows (the why-hash holds).

Every function takes an asyncpg connection (codec-registered). Scope params cast ::ltree.
"""
from __future__ import annotations

import logging
import math
from datetime import datetime, timezone
from typing import Any, Optional

import asyncpg

log = logging.getLogger("rocoto.memory")


async def _embed(text: str) -> Optional[list[float]]:
    """384-d multilingual embedding for a fact/summary (SPEC §5). Fail-soft: None → FTS-only recall."""
    try:
        import rt_embed
        return await rt_embed.aembed(text or "")
    except Exception:
        return None

# card eligibility + ordering (SPEC §4.1 kind_prior). CONSTRAINT/COMMERCIAL/RHYTHM/PREFERENCE and
# flagged RELATION earn a line; EVENT_FACT never does (an open one rides as a tab, not the card).
_CARD_KINDS = ("CONSTRAINT", "COMMERCIAL", "RHYTHM", "PREFERENCE", "RELATION")
_KIND_ORDER = {k: i for i, k in enumerate(_CARD_KINDS)}
_PINNED = {"CONSTRAINT", "COMMERCIAL", "RHYTHM", "PREFERENCE"}  # never evicted, never recency-decayed
_LABEL = {
    "CONSTRAINT": "Seguridad",
    "COMMERCIAL": "Comercial",
    "RHYTHM": "Ritmo",
    "PREFERENCE": "Prefiere",
    "RELATION": "Relación",
}
CARD_LINE_CAP = 24
CARD_TOK_CAP = 800  # ~4 chars/token heuristic for the deterministic budget check


def _norm(s: str) -> str:
    return " ".join((s or "").lower().split())


async def write_fact(con: asyncpg.Connection, scope: str, kind: str, text: str,
                     key: Optional[str] = None, valid_at=None,
                     source_event_ids: Optional[list[int]] = None,
                     confidence: Optional[str] = None) -> dict:
    """Deterministic bi-temporal fact write. Returns {action, fact_id?}. action ∈
    {inserted, restated_drop, versioned, rejected}. A COMMERCIAL fact with no key is REJECTED to the
    dead-letter (SPEC §4.3: keyless COMMERCIAL rejected+escalated — never guess a money key)."""
    source_event_ids = source_event_ids or []
    if kind == "COMMERCIAL" and not key:
        await con.execute(
            "insert into dead_letter(source,reason,raw,problem) values('extractor','malformed',$1,$2)",
            {"scope": scope, "kind": kind, "text": text},
            "COMMERCIAL fact without a canonical key — rejected (never mint an unkeyed money fact)")
        return {"action": "rejected", "reason": "commercial_without_key"}

    if key:
        cur = await con.fetchrow(
            "select id, text from fact where scope=$1::ltree and key=$2 and invalid_at is null "
            "order by id desc limit 1", scope, key)
        if cur is not None:
            if _norm(cur["text"]) == _norm(text):
                return {"action": "restated_drop", "fact_id": int(cur["id"])}   # said again → drop
            # contradiction / new value → invalidate prior (kept as history), insert the current one.
            await con.execute("update fact set invalid_at=now() where id=$1", cur["id"])
            nid = await con.fetchval(
                "insert into fact(scope,kind,text,key,embedding,valid_at,source_event_ids,confidence) "
                "values($1::ltree,$2,$3,$4,$5,coalesce($6,now()),$7,$8) returning id",
                scope, kind, text, key, await _embed(text), valid_at, source_event_ids, confidence)
            return {"action": "versioned", "fact_id": int(nid), "invalidated": int(cur["id"])}

    emb = await _embed(text)
    # WP-5 the cosine FLAG-BAND (SPEC §4.3, 0.75–0.88): a keyless new fact that is a NEAR-duplicate of an
    # existing same-kind fact is FLAGGED (disputed=true) for review — never killed (flag-never-kill).
    disputed = False
    if emb is not None:
        try:
            near = await con.fetchval(
                "select 1 - (embedding <=> $2::vector) from fact where scope=$1::ltree and kind=$3 "
                "and invalid_at is null and embedding is not null order by embedding <=> $2::vector limit 1",
                scope, emb, kind)
            if near is not None and 0.75 <= float(near) <= 0.88:
                disputed = True
        except Exception:
            pass
    nid = await con.fetchval(
        "insert into fact(scope,kind,text,key,embedding,valid_at,source_event_ids,confidence,disputed) "
        "values($1::ltree,$2,$3,$4,$5,coalesce($6,now()),$7,$8,$9) returning id",
        scope, kind, text, key, emb, valid_at, source_event_ids, confidence, disputed)
    return {"action": "inserted", "fact_id": int(nid), "disputed": disputed}


async def gc_facts(con: asyncpg.Connection, scope: str, keep_days: int = 90) -> int:
    """WP-5 / R11 de-silting (SPEC §4.3): the nightly consolidation GCs facts that were INVALIDATED
    (versioned out / expired) longer than keep_days ago — the bi-temporal history stays queryable within
    the window, then the silt clears so recall never wades through years of dead versions. Returns count."""
    r = await con.execute(
        "delete from fact where scope=$1::ltree and invalid_at is not null "
        "and invalid_at < now() - ($2 || ' days')::interval", scope, str(int(keep_days)))
    try:
        return int(r.split()[-1])
    except Exception:
        return 0


async def lookup_fact(con: asyncpg.Connection, scope: str, key: str) -> Optional[str]:
    """Exact keyed lookup over CURRENT COMMERCIAL/facts — the must-not-miss path (SPEC §4.4), zero
    fuzziness. Returns the current fact text or None."""
    return await con.fetchval(
        "select text from fact where scope=$1::ltree and key=$2 and invalid_at is null "
        "order by id desc limit 1", scope, key)


async def regen_card(con: asyncpg.Connection, scope: str, display_name: str = "",
                     tier: str = "") -> dict:
    """Regenerate the templated card from CURRENT eligible facts (SPEC §4.1). Deterministic — the
    injected body is a pure function of the fact rows. Returns {version, lines, tokens, overflow}."""
    rows = await con.fetch(
        "select kind, text from fact where scope=$1::ltree and invalid_at is null and kind = any($2::text[])",
        scope, list(_CARD_KINDS))
    # stable order: kind priority, then text (byte-reproducible).
    facts = sorted(rows, key=lambda r: (_KIND_ORDER.get(r["kind"], 99), r["text"]))

    # existing header info (name/tier) if not supplied.
    if not display_name or not tier:
        c = await con.fetchrow("select display_name, tier from contact where scope=$1::ltree "
                               "order by id limit 1", scope)
        if c is not None:
            display_name = display_name or (c["display_name"] or "")
            tier = tier or (c["tier"] or "")

    header = f"FICHA · {display_name or '(sin nombre)'}" + (f" · {tier}" if tier else "")
    lines = [header]
    pinned_lines, evictable_lines = [], []
    for r in facts:
        pin = r["kind"] in _PINNED
        line = f"— {_LABEL.get(r['kind'], r['kind'])}: {r['text']}" + (" [fijo]" if pin else "")
        (pinned_lines if pin else evictable_lines).append(line)

    # pinned never dropped; evictable trimmed to the line/token cap.
    body_lines = [header] + pinned_lines
    overflow = False
    for line in evictable_lines:
        candidate = body_lines + [line]
        toks = sum(len(x) for x in candidate) // 4
        if len(candidate) > CARD_LINE_CAP or toks > CARD_TOK_CAP:
            overflow = True
            break
        body_lines.append(line)

    # pinned-overflow is a design bug, not a runtime cut (SPEC §4.1) — surface it, never drop pinned.
    pinned_tokens = (len(header) + sum(len(x) for x in pinned_lines)) // 4
    pinned_overflow = len(pinned_lines) + 1 > CARD_LINE_CAP or pinned_tokens > CARD_TOK_CAP

    body = "\n".join(body_lines)
    ver = await con.fetchval(
        "insert into card(scope,body,version,regenerated_at) values($1::ltree,$2,1,now()) "
        "on conflict (scope) do update set body=excluded.body, version=card.version+1, "
        "regenerated_at=now() returning version", scope, body)
    return {"version": int(ver), "lines": len(body_lines), "tokens": len(body) // 4,
            "overflow": overflow, "pinned_overflow": pinned_overflow, "body": body}


# ── §4.4 recall — hybrid (pgvector ⊎ FTS), RRF-fused, salience-weighted, floor θ, cap k ──────
_KIND_PRIOR = {"CONSTRAINT": 1.6, "COMMERCIAL": 1.5, "RHYTHM": 1.4, "PREFERENCE": 1.2,
               "RELATION": 1.1, "EVENT_FACT": 1.0, "summary": 1.0}
THETA = 0.015          # THE pollution-vs-recall floor (SPEC §4.4)
K_RRF = 60



# ── §4.4 RECENCY + SALIENCE (the two rules that earn their keep against real misses) ────────────
HALF_LIFE_D = 90.0     # events decay with a 90-day half-life (knob)
RAW_BOOST_D = 14.0     # a raw event's prior is age-boosted over ~2 weeks (knob)
_STANDING = {"CONSTRAINT", "COMMERCIAL", "RHYTHM", "PREFERENCE"}   # never recency-decayed


def _days(ts, now) -> float:
    if ts is None:
        return 0.0
    try:
        return max(0.0, (now - ts).total_seconds() / 86400.0)
    except Exception:
        return 0.0


def _recency(kind: str, ts, now) -> float:
    """Standing truths are recency-EXEMPT (a taste or a rhythm describes how the party IS, so a
    5-month-old preference must not decay below theta the way a stale event should); everything else
    decays exp(-dt/HALF_LIFE) with a 0.05 floor."""
    if kind in _STANDING:
        return 1.0
    return max(math.exp(-_days(ts, now) / HALF_LIFE_D), 0.05)


def _kind_prior(kind: str, ts, now) -> float:
    if kind == "raw":
        return 0.8 + 0.7 * math.exp(-_days(ts, now) / RAW_BOOST_D)
    return _KIND_PRIOR.get(kind, 1.0)


async def write_summary(con: asyncpg.Connection, scope: str, text: str,
                        source_event_ids: Optional[list[int]] = None,
                        ts: Optional[datetime] = None) -> int:
    """Persist a daily summary (embedded) — SPEC §4.3. Returns the summary id.

    `ts` OVERRIDES THE CLOCK for the history replay only (`backfill.py`), and it is the honest
    choice even though it costs the summary its recall weight: recency decays a summary under the
    θ floor at roughly seventy days, so a truthfully-dated March summary will not surface in
    search. Dating it `now()` would make it surface — by lying about when it happened, which
    would put «hablamos ayer de los mangos» in front of the mind about a conversation from March.
    The replay's real payload is the FACTS it distils, and those are recency-exempt by kind. The
    summary is the audit trail of how they were derived, so it must say when."""
    if ts is None:
        return int(await con.fetchval(
            "insert into summary(scope,text,embedding,source_event_ids) values($1::ltree,$2,$3,$4) returning id",
            scope, text, await _embed(text), source_event_ids or []))
    return int(await con.fetchval(
        "insert into summary(scope,ts,text,embedding,source_event_ids) "
        "values($1::ltree,$2,$3,$4,$5) returning id",
        scope, ts, text, await _embed(text), source_event_ids or []))


async def search(con: asyncpg.Connection, scope: str, query: str, k: int = 8,
                 qv: Optional[list] = None, now: Optional[datetime] = None,
                 shelves: tuple = ("fact", "summary", "raw")) -> list[dict[str, Any]]:
    """The §4.4 pre-pass: ONE query, THREE SHELVES, a floor and a cap.

      candidates : top-50 by pgvector cosine  U  top-50 by FTS ts_rank   (per shelf, `, id` tiebroken)
      fuse (RRF) : rrf = SUM_arm 1/(K_RRF + rank_arm)                     K_RRF = 60
      recency    : x RECENCY[kind] — standing truths (CONSTRAINT/RHYTHM/PREFERENCE/keyed COMMERCIAL)
                   never decay (1.0); events (EVENT_FACT/summary/raw) = max(exp(-dt/HALF_LIFE), 0.05)
      salience   : x KIND_PRIOR[kind]; a RAW event's prior is AGE-BOOSTED (0.8 + 0.7*exp(-dt/14d)) so a
                   price said by voice two days ago and not yet distilled can outrank the stale fact it
                   replaces, instead of sitting under a flat 0.8 penalty
      select     : keep score >= THETA (FLOOR — the result may be EMPTY), then cap at k (BUDGET)

    `now` PINS the clock (SPEC §4.5 determinism rule 3: every recency term binds `assembled_at`, never
    wall-clock) so a replayed turn decays exactly as it did live. `qv` is the turn's one embedding.
    `shelves` selects the corpora; the model's retrieve() widens k (<= 30).

    HONEST BOUND — the RAW-EVENT shelf runs its LEXICAL arm only: `event` carries a generated `fts`
    column but no `embedding` (schema_runtime.sql), so a raw row is found by words, not by vector. That
    is the extractor's safety net at reduced strength; the vector arm lights up the day events carry
    embeddings. Nothing here pretends otherwise. Fail-soft (FTS-only if no embedding at all)."""
    if qv is None:
        qv = await _embed(query)
    now = now or datetime.now(timezone.utc)
    vec_ok = bool(qv is not None and any(qv))
    # $1 scope · $2 query · $3 K_RRF · $4 limit · $5 qv (referenced ONLY by the vector arms)
    arms: list[str] = []
    if "fact" in shelves:
        if vec_ok:
            arms.append("(select 'fact' shelf, kind, text, valid_at ats, "
                        "row_number() over (order by embedding<=>$5, id) rk "
                        "from fact where scope <@ $1::ltree and invalid_at is null and embedding is not null "
                        "order by embedding<=>$5, id limit 50)")
        arms.append("(select 'fact' shelf, kind, text, valid_at ats, "
                    "row_number() over (order by ts_rank(fts, plainto_tsquery('spanish',$2)) desc, id) rk "
                    "from fact where scope <@ $1::ltree and invalid_at is null "
                    "and fts @@ plainto_tsquery('spanish',$2) "
                    "order by ts_rank(fts, plainto_tsquery('spanish',$2)) desc, id limit 50)")
    if "summary" in shelves:
        if vec_ok:
            arms.append("(select 'summary' shelf, 'summary' kind, text, ts ats, "
                        "row_number() over (order by embedding<=>$5, id) rk "
                        "from summary where scope <@ $1::ltree and embedding is not null "
                        "order by embedding<=>$5, id limit 50)")
        arms.append("(select 'summary' shelf, 'summary' kind, text, ts ats, "
                    "row_number() over (order by ts_rank(fts, plainto_tsquery('spanish',$2)) desc, id) rk "
                    "from summary where scope <@ $1::ltree and fts @@ plainto_tsquery('spanish',$2) "
                    "order by ts_rank(fts, plainto_tsquery('spanish',$2)) desc, id limit 50)")
    if "raw" in shelves:
        # THE THIRD SHELF (SPEC §4.4) — every message verbatim; the extractor's safety net.
        arms.append("(select 'raw' shelf, 'raw' kind, "
                    "coalesce(payload->>'text', payload->>'body','') text, ts ats, "
                    "row_number() over (order by ts_rank(fts, plainto_tsquery('spanish',$2)) desc, id) rk "
                    "from event where scope <@ $1::ltree and lane='world' "
                    "and coalesce(payload->>'text', payload->>'body','') <> '' "
                    "and fts @@ plainto_tsquery('spanish',$2) "
                    "order by ts_rank(fts, plainto_tsquery('spanish',$2)) desc, id limit 50)")
    if not arms:
        return []
    sql = ("with arms as (" + " union all ".join(arms) + ") "
           "select shelf, kind, text, max(ats) ats, sum(1.0/($3 + rk)) rrf "
           "from arms group by shelf, kind, text order by rrf desc, text limit $4")
    args = [scope, query, K_RRF, max(k * 3, 24)] + ([qv] if vec_ok else [])
    try:
        rows = await con.fetch(sql, *args)
    except Exception:
        log.exception("memory.search failed (fail-soft empty)")
        return []
    scored = []
    for r in rows:
        txt = (r["text"] or "").strip()
        if not txt:
            continue
        score = (float(r["rrf"]) * _recency(r["kind"], r["ats"], now)
                 * _kind_prior(r["kind"], r["ats"], now))
        if score >= THETA:
            scored.append({"shelf": r["shelf"], "kind": r["kind"], "text": txt,
                           "score": round(score, 6)})
    scored.sort(key=lambda x: (-x["score"], x["text"]))
    return scored[:k]
