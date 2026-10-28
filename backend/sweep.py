"""sweep.py — THE DAILY SUMMARY SWEEP (SPEC §4.3, with the §4.1 roll-off it enables).

Once a party's day is closed, distil it: read the raw event span since the party's watermark, run
ONE Haiku summarize call, persist the durable summary (embedded) + any facts it surfaced, and advance
the watermark. The summary now CARRIES the day — future turns recall it. The raw events stay in the
immutable event log forever (SPEC §3), but with the day summarized a party that has no open tab is
'closed', so assemble()'s token-budgeted window (SPEC §4.1) naturally rolls those raw rows off the
prompt tail: the mind sees the summary, not 200 stale lines. This is the memory hygiene that keeps the
per-turn envelope bounded however far history grows.

The organ is DETERMINISTIC in its bookkeeping (watermark → summarize → write → advance) and IDEMPOTENT
per watermark: re-running a swept scope reads zero new events and saves nothing (no double summaries,
no duplicated facts). It is safe to run on a cron, on demand, or twice by accident.

Two guards keep it from stepping on a live conversation or an already-swept scope:
  * skip-if-busy — a scope whose pending_turn is state='armed' is MID-CONVERSATION (the §4.6 debounce
    window is open); we skip it and catch it on the next sweep once the turn has fired.
  * skip-if-empty — no new events beyond the watermark → nothing to distil, skip.

Contracts mirrored (do NOT reinvent):
  * memory.write_summary(con, scope, text, source_event_ids)  — embeds (rt_embed) + inserts the summary row.
  * memory.write_fact(con, scope, kind, text, key, ...)       — the bi-temporal fact writer.
  * memory.search(con, scope, query, k)                       — the §4.4 hybrid recurrence pre-pass.
  * brain.llm.call_tool(model, system, user, tool, tool_name) — the ONE forced-tool Haiku call.
  * db.scoped_tx(scope) / db.get_pool()                       — RLS-bound writes / owner-pool read scan.

All scope params are cast ::ltree (asyncpg has no native ltree codec). jsonb is never touched here.
Fail-soft throughout: one bad scope logs and is skipped; the sweep as a whole never crashes the box.
"""
from __future__ import annotations

import logging
from typing import Any

import asyncpg

import config
import db
import memory

log = logging.getLogger("rocoto.sweep")

# The event-window read budget for one day's span (SPEC §4.3). Bounds the summarize input the same way
# assemble()'s window is bounded — a runaway thread can't blow the Haiku call's context. The watermark
# still advances to the true last id, so a span longer than this is summarized in successive sweeps.
SWEEP_SPAN_LIMIT = 400
# How many similar past summaries/facts to pull as recurrence context for the summarize call.
RECURRENCE_K = 6

# The structured-output tool the ONE Haiku call is forced into (SPEC §4.3): a durable day summary plus
# the durable facts worth keeping. `key` is OPTIONAL and only for keyed facts (an invoice, a price); a
# COMMERCIAL fact without a key is rejected downstream by memory.write_fact (never mint an unkeyed money
# fact), so the model is told to supply one for money facts.
_SUMMARIZE_TOOL: dict[str, Any] = {
    "name": "record_day",
    "description": (
        "Registra el resumen duradero del día de esta persona y los hechos que merece la pena "
        "recordar a largo plazo. El resumen es lo que el sistema recordará mañana; los hechos son "
        "afirmaciones estables (una restricción, un precio, un ritmo, una preferencia, una relación)."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "summary_text": {
                "type": "string",
                "description": (
                    "Un resumen conciso (2-5 frases) de lo que pasó hoy con esta persona: pedidos, "
                    "decisiones, dudas, tono. En español. Nada de relleno; sólo lo que ayudará a "
                    "atenderla mejor la próxima vez."
                ),
            },
            "facts": {
                "type": "array",
                "description": "Hechos duraderos surgidos hoy. Vacío si no hay ninguno nuevo.",
                "items": {
                    "type": "object",
                    "properties": {
                        "kind": {
                            "type": "string",
                            "enum": ["CONSTRAINT", "COMMERCIAL", "RHYTHM", "PREFERENCE",
                                     "RELATION", "EVENT_FACT"],
                            "description": (
                                "CONSTRAINT=seguridad/límite duro · COMMERCIAL=dinero/precio/factura "
                                "(REQUIERE key) · RHYTHM=cadencia/horario · PREFERENCE=gusto · "
                                "RELATION=quién es respecto a quién · EVENT_FACT=hecho puntual."
                            ),
                        },
                        "text": {"type": "string", "description": "El hecho, una frase en español."},
                        "key": {
                            "type": "string",
                            "description": (
                                "Clave canónica exacta para lookup ('invoice:221', 'price:jamon'). "
                                "OBLIGATORIA para COMMERCIAL; omítela si no aplica."
                            ),
                        },
                    },
                    "required": ["kind", "text"],
                },
            },
        },
        "required": ["summary_text", "facts"],
    },
}

_SUMMARIZE_SYSTEM = (
    "Eres la memoria de un empleado de IA que atiende a clientes de un proveedor de alimentación por "
    "WhatsApp. Al cerrar el día, destilas lo ocurrido con UNA persona en un resumen duradero y extraes "
    "los hechos estables que conviene recordar. Sé fiel a lo que dicen los eventos: no inventes, no "
    "supongas cifras. Si algo ya se sabía (aparece en el contexto de recurrencia), no lo repitas como "
    "hecho nuevo salvo que haya cambiado. Responde SIEMPRE llamando a la herramienta record_day."
)


def _render_event(e: asyncpg.Record) -> str:
    """One raw event → one dated prompt line for the summarize span. World-lane text lives in
    payload.text/body (mirrors assemble._render_event); non-text events are named by their type."""
    ts = e["ts"]
    stamp = ts.strftime("%Y-%m-%d %H:%M") if ts is not None else "?"
    payload = e["payload"] or {}
    text = (payload.get("text") or payload.get("body") or "").strip()
    actor = e["actor"] or "system"
    if text:
        return f"[{stamp}] {actor}/{e['type']}: {text}"
    return f"[{stamp}] {actor}/{e['type']}"


async def sweep_scope(pool: asyncpg.Pool, scope: str) -> dict[str, Any]:
    """Sweep ONE party's closed day (SPEC §4.3). Returns a status dict:
      {scope, status, events?, facts_written?, summary_id?, watermark?}
    status ∈ {swept, skipped_empty, skipped_busy, skipped_test, error}. Idempotent per watermark: a
    re-run reads zero new events → skipped_empty → no double-save. All work runs inside db.scoped_tx
    so the write is RLS-bound to this scope (SPEC §12.2); the read rides the same connection.

    A TEST WORLD IS NEVER SWEPT (2026-08-09, BUG 2). The candidate scan in `sweep_once` filters on
    `lineage='live'`, but `sweep_scope` is also called DIRECTLY (by hand, by a vital, and by anything
    that learns this function's name), and when it was, it happily distilled a /demo visitor's
    conversation into `fact` rows — measured: `{'events': 6, 'facts_written': 3}` on a demo scope.
    The refusal lives HERE, at the function that does the work, because a guard that only exists in
    one of two callers is a guard that is one call site away from not existing."""
    if (scope or "").startswith("test."):
        return {"scope": scope, "status": "skipped_test"}
    try:
        async with db.scoped_tx(scope) as con:
            # 0) the OTHER shape of a test world: a `t.test_<n>` scope the control room minted, whose
            # `scope_node.lineage` says 'test' though its path does not. One cheap read, and it means
            # «test» has exactly one meaning to this organ regardless of how the world was spelled.
            if (await con.fetchval(
                    "select lineage from scope_node where scope=$1::ltree", scope)) == "test":
                return {"scope": scope, "status": "skipped_test"}

            # 1) watermark — everything strictly beyond it is this day's un-swept span. Default 0.
            watermark = await con.fetchval(
                "select coalesce(watermark_event_id, 0) from sweep_state where scope=$1::ltree", scope)
            watermark = int(watermark or 0)

            # 2) skip-if-busy — an armed pending_turn means the §4.6 debounce window is open (a live
            # conversation mid-flight). Don't summarize a day that's still being written; the next
            # sweep catches it once the turn has fired.
            busy = await con.fetchval(
                "select 1 from pending_turn where scope=$1::ltree and state='armed'", scope)
            if busy:
                return {"scope": scope, "status": "skipped_busy"}

            # 3) read the span — new world-lane events beyond the watermark, chronological. Reasoning-
            # lane rows carry no durable content (no fts, SPEC §4.4) and are excluded from the distil.
            # `lineage='live'` matches the candidate scan in `sweep_once` exactly: a scope is selected
            # for its LIVE rows, so its live rows are what it may distil. Without it a world that is
            # live today but carried a test turn yesterday would feed the test turn to the model.
            rows = await con.fetch(
                "select id, ts, type, actor, payload from event "
                "where scope=$1::ltree and lane='world' and lineage='live' and id > $2 "
                "order by id asc limit $3",
                scope, watermark, SWEEP_SPAN_LIMIT)
            if not rows:
                return {"scope": scope, "status": "skipped_empty"}

            source_event_ids = [int(r["id"]) for r in rows]
            last_id = source_event_ids[-1]
            span_text = "\n".join(_render_event(r) for r in rows)

            # 4) the card + live facts — the standing context the summarize call reasons against.
            card_body = await con.fetchval(
                "select body from card where scope=$1::ltree", scope) or ""
            live_facts = await con.fetch(
                "select kind, text from fact where scope=$1::ltree and invalid_at is null "
                "order by id desc limit 40", scope)
            facts_block = "\n".join(f"- {f['kind']}: {f['text']}" for f in live_facts) or "(ninguno)"

            # 5) recurrence search — embed the span text (via memory.search → rt_embed) and pull similar
            # past summaries/facts so the model knows what's already known / recurring (SPEC §4.3/§4.4).
            try:
                recurrence = await memory.search(con, scope, span_text, k=RECURRENCE_K)
            except Exception:
                log.exception("sweep: recurrence search failed for %s (fail-soft, no context)", scope)
                recurrence = []
            recurrence_block = "\n".join(
                f"- [{r.get('shelf')}] {r.get('text')}" for r in recurrence) or "(nada previo)"

            # 6) THE ONE Haiku call — structured tool output. Fail-soft: a model/API failure logs and
            # LEAVES THE WATERMARK where it is, so the day is re-attempted on the next sweep (never a
            # silent data-loss advance past an un-summarized span).
            user = (
                "FICHA:\n" + (card_body or "(vacía)") +
                "\n\nHECHOS VIGENTES:\n" + facts_block +
                "\n\nCONTEXTO DE RECURRENCIA (lo que ya se sabía / patrones):\n" + recurrence_block +
                "\n\nEVENTOS DE HOY (en orden):\n" + span_text +
                "\n\nDestila el día en record_day."
            )
            out = None
            try:
                import brain.llm as llm
                out = await llm.call_tool(
                    config.VOICE_CHAT_MODEL, _SUMMARIZE_SYSTEM, user,
                    _SUMMARIZE_TOOL, "record_day",
                    max_tokens=1024, fallback=None)
            except Exception:
                log.exception("sweep: summarize call failed for %s (watermark held, will retry)", scope)
                return {"scope": scope, "status": "error", "reason": "summarize_failed"}
            if not out or not (out.get("summary_text") or "").strip():
                # No usable summary → do NOT advance (retry next sweep). An empty span already returned
                # above, so this is a genuine model miss, not an empty day.
                log.warning("sweep: empty summary for %s (watermark held)", scope)
                return {"scope": scope, "status": "error", "reason": "empty_summary"}

            summary_text = out["summary_text"].strip()

            # 7) persist the summary (memory.write_summary embeds via rt_embed + inserts), carrying the
            # provenance span so §15.2 can expand it back to the raw events it distilled.
            summary_id = await memory.write_summary(con, scope, summary_text, source_event_ids)

            # 8) persist each surfaced fact through the deterministic writer (its own dedupe/versioning
            # + the keyless-COMMERCIAL rejection apply). source_event_ids give every fact its why-trace.
            facts_written = 0
            for f in (out.get("facts") or []):
                kind = (f.get("kind") or "").strip().upper()
                text = (f.get("text") or "").strip()
                key = (f.get("key") or "").strip() or None
                if not kind or not text:
                    continue
                try:
                    res = await memory.write_fact(
                        con, scope, kind, text, key=key, source_event_ids=source_event_ids)
                    if res.get("action") in ("inserted", "versioned"):
                        facts_written += 1
                except Exception:
                    log.exception("sweep: write_fact failed for %s (kind=%s) — skipping fact", scope, kind)

            # 9) advance the watermark to the last event id we summarized (upsert). This is the idempotency
            # gate: the next sweep reads only events beyond last_id, so re-running saves nothing.
            await con.execute(
                "insert into sweep_state(scope, watermark_event_id, last_swept_at, updated_at) "
                "values($1::ltree, $2, now(), now()) "
                "on conflict (scope) do update set "
                "  watermark_event_id=excluded.watermark_event_id, last_swept_at=now(), updated_at=now()",
                scope, last_id)

            # 10) WP-5 / R11 de-silting: GC facts invalidated longer than the retention window ago, so
            # recall never wades through years of dead versions (the bi-temporal history stays within it).
            gc = 0
            try:
                gc = await memory.gc_facts(con, scope, int(config._env("ROCOTO_FACT_KEEP_DAYS", "90")))
            except Exception:
                log.debug("gc_facts fail-soft for %s", scope, exc_info=True)

            return {"scope": scope, "status": "swept", "events": len(source_event_ids),
                    "facts_written": facts_written, "summary_id": int(summary_id),
                    "watermark": int(last_id), "facts_gc": gc}
    except Exception:
        # A single party's failure must never abort the whole sweep (fail-soft, SPEC §4.3).
        log.exception("sweep_scope failed hard for %s", scope)
        return {"scope": scope, "status": "error", "reason": "exception"}


async def sweep_once(pool: asyncpg.Pool) -> dict[str, Any]:
    """One full pass (SPEC §4.3): find every party scope with events beyond its watermark, sweep each.
    Returns roll-up counts {scopes, swept, skipped_busy, skipped_empty, errors, facts_written}.
    Idempotent per watermark — a pass over an already-swept world does no work.

    The candidate scan runs on the OWNER pool (a cross-scope aggregate the per-scope RLS role can't
    see); each individual sweep_scope then re-enters db.scoped_tx so every WRITE is RLS-bound to its
    own scope. sweep_state defaults the watermark to 0 for a party never swept, so a LEFT JOIN with
    coalesce surfaces brand-new parties too."""
    scopes: list[str] = []
    try:
        async with pool.acquire() as con:
            # `n.lineage is distinct from 'test'` is the belt to `e.lineage='live'`'s braces: it
            # excludes a control-room test world (`t.test_<n>`), whose path is not `test.`-prefixed
            # and whose rows a pre-2026-08-09 append therefore tagged 'live'. LEFT JOIN, so a scope
            # with no scope_node row (a party mid-bootstrap) is still a candidate.
            rows = await con.fetch(
                "select distinct e.scope::text as scope from event e "
                "left join sweep_state s on s.scope = e.scope "
                "left join scope_node n on n.scope = e.scope "
                "where e.lane='world' and e.lineage='live' "
                "  and n.lineage is distinct from 'test' "
                "  and e.id > coalesce(s.watermark_event_id, 0)")
            scopes = [r["scope"] for r in rows]
    except Exception:
        log.exception("sweep_once: candidate scan failed")
        return {"scopes": 0, "swept": 0, "skipped_busy": 0, "skipped_empty": 0,
                "skipped_test": 0, "errors": 1, "facts_written": 0}

    counts = {"scopes": len(scopes), "swept": 0, "skipped_busy": 0, "skipped_empty": 0,
              "skipped_test": 0, "errors": 0, "facts_written": 0}
    for scope in scopes:
        res = await sweep_scope(pool, scope)
        status = res.get("status")
        if status == "swept":
            counts["swept"] += 1
            counts["facts_written"] += int(res.get("facts_written", 0))
        elif status == "skipped_busy":
            counts["skipped_busy"] += 1
        elif status == "skipped_empty":
            counts["skipped_empty"] += 1
        elif status == "skipped_test":
            counts["skipped_test"] += 1
        else:
            counts["errors"] += 1
    log.info("sweep_once done: %s", counts)
    try:  # WP-0.5 heartbeat: /healthz catches a silently-dead sweep
        import ops
        await ops.stamp("sweep", {"scopes": counts["scopes"], "swept": counts["swept"]})
    except Exception:
        pass
    return counts


if __name__ == "__main__":
    import asyncio

    import logging_setup
    logging_setup.configure()   # the redacting formatter, same as the backend's (logging_setup.py)
    try:
        from dotenv import load_dotenv
        load_dotenv("/opt/rocoto/.env")
    except Exception:
        pass

    async def _main() -> None:
        await db.init()
        result = await sweep_once(db.control_pool())   # tier-P: cross-scope scan sees all scopes
        print(result)

    asyncio.run(_main())
