"""backfill.py — REPLAYING A CUSTOMER'S PAST THROUGH THE MIND THAT WOULD HAVE LIVED IT.

Peter, 2026-08-17: «for each number it should create a summary of the session… we should be doing
that summary for that session history too, for the WhatsApp history, because then from day zero
we're going to have full behaviours of this AI as if it was in the conversation the whole time.
We're sort of backdating all of this stuff.»

That is exactly right, and the way to honour it is NOT to invent a second pipeline. Coexistence
hands us up to 180 days of real conversation; this module walks it through the SAME organs a live
day goes through — `spine.append_event` → `sweep`'s distil → `memory.write_fact` — one historical
day at a time, so that what the mind ends up holding is indistinguishable from having been there.

── THE FINDING THAT SHAPES EVERYTHING BELOW ─────────────────────────────────────────────────────
**Backfilling raw messages alone buys nothing.** Recall is θ-floored and recency-weighted
(`memory.search`: THETA=0.015, half-life 90d, a 14-day raw boost, and the raw shelf has only ONE
arm so its best possible RRF is 1/61). Run the arithmetic and a raw event crosses below the floor
at roughly TWELVE DAYS. A message from March is 44× under it — invisible to search no matter how
perfectly it matches what the customer just said. Summaries fade too, at about seventy days.

The only things that survive indefinitely are FACTS of kind CONSTRAINT · COMMERCIAL · RHYTHM ·
PREFERENCE, which `memory._recency` exempts from decay by kind.

So: **the events are transport, the summaries are the audit trail, and the FACTS are the payload.**
A replay that stops at «we imported the messages» has imported nothing the mind can use. This
module exists to produce facts, and everything else it writes is the provenance that makes those
facts defensible — `source_event_ids` on every one, so §15.2 can expand any of them back to the
actual sentences a restaurant actually sent.

── WHAT IS TRUE, AND WHAT PETER ASSUMED ─────────────────────────────────────────────────────────
Peter described recall as «we check the summary, and then we grab the full data of the top result
summary». **The runtime does not do that.** `memory.search` puts facts, summaries and raw events in
ONE flat RRF pool as peers; a winning summary pulls nothing in behind it. The expand-to-detail
machinery exists — `control_room.summary_sources` — but only as a human read in the Control Room,
never on a turn. This module is written against what the runtime actually does; the two-step is
worth building, and it is a separate change to `memory.search`, not something to assume here.

── THE SIX WAYS THIS COULD HURT A REAL CUSTOMER, AND WHAT STOPS EACH ───────────────────────────
1. **Speaking to somebody about a two-year-old message.** `spine.ingest_chat` arms the debounce,
   and `worker.run_pending_backstop` would later fire a real WhatsApp reply at the last backfilled
   line. → This module NEVER calls ingest_chat. It appends events directly, and it runs the whole
   replay under **MODO SOMBRA** (`scope_state.mode='sombra'`), which is the codebase's own
   kill-switch: the mind runs fully and the mouth is shut, with `sombra.held` written for audit.
2. **The 12:00 sweep re-distilling the replay as «EVENTOS DE HOY».** Its candidate scan keys on
   `event.id > watermark` — ID, not ts — and backfilled rows own the highest ids in the table. →
   The watermark is advanced past the whole replay as the last step, inside the same transaction
   discipline, so the nightly sweep sees nothing new.
3. **Dating the past as the present.** `write_summary` now takes a `ts`; each day's summary is
   stamped with THAT day. It costs the summary its recall weight (see above) and that is the
   correct trade: a summary that surfaces by lying about its age would tell the mind «ayer
   hablamos de los mangos» about March.
4. **Poisoning every future live turn.** `runtime._window_msgs` ordered by `id desc`, so backfilled
   rows would have become the mind's «last nine messages» for ever. Fixed to order by `ts`.
5. **Arming timers and chasing tabs in the past.** Only non-`message` events reach the duty binder,
   so a message-only replay cannot open a tab or arm a chase. This module writes ONLY `message` and
   `msg.sent`, deliberately, and that restraint is the safety property — not an omission.
6. **Re-running it twice.** Every event carries a namespaced `dedupe_key`
   (`backfill:<tenant>:<phone>:<wamid|index>`), so a second pass is swallowed by
   `ux_event_dedupe` and writes nothing.
"""
from __future__ import annotations

import json
import logging
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Iterable, Optional

import config
import db

log = logging.getLogger("rocoto.backfill")

# One historical DAY per distil call, which is what makes the replay legible: the summaries read
# like a diary and each one's provenance is that day's own messages. The cap is a runaway guard,
# not a design parameter — a real day of one restaurant's chat is tens of lines.
MAX_EVENTS_PER_DAY = 400
# A conversation with fewer than this many lines in a day is not a day worth a Haiku call: the
# facts it could yield are already in the card, and the summary would be «dijo hola».
MIN_LINES_FOR_DISTIL = 3


# ── ① reading what Meta sent ────────────────────────────────────────────────────────────────────
def parse_history_chunk(payload: dict[str, Any]) -> list[dict[str, Any]]:
    """One `history` webhook → a flat list of {phone, direction, text, ts, wamid}.

    PURE, so it is testable without Meta or a database — the shape of their payload is the thing
    most likely to change under us, and a pure parser is the cheapest place to absorb that.

    Meta nests: value.history[].threads[].messages[]. Media arrives as `type: media_placeholder`
    with contents omitted and a SECOND webhook carrying the real object later, so a placeholder is
    kept as a line with no text rather than dropped — «mandó una foto» is itself a fact about how
    this customer orders."""
    out: list[dict[str, Any]] = []
    for h in (payload.get("history") or []):
        for th in (h.get("threads") or []):
            for m in (th.get("messages") or []):
                wamid = str(m.get("id") or "")
                try:
                    ts = datetime.fromtimestamp(int(m.get("timestamp") or 0), tz=timezone.utc)
                except (TypeError, ValueError):
                    continue
                if ts.year < 2015:            # a zero/garbage timestamp is not a date
                    continue
                # `from` is the customer on an inbound and the BUSINESS on an outbound. Meta marks
                # the direction on history_context; absent it, an echoed message is one we sent.
                ctx = m.get("history_context") or {}
                outbound = str(ctx.get("from_me") or m.get("from_me") or "").lower() in ("true", "1")
                text = ((m.get("text") or {}).get("body") or "").strip()
                kind = str(m.get("type") or "")
                if not text and kind not in ("media_placeholder", "image", "audio", "document", "video"):
                    continue
                out.append({
                    "phone": str(th.get("id") or m.get("from") or ""),
                    "direction": "out" if outbound else "in",
                    "text": text,
                    "kind": kind,
                    "ts": ts,
                    "wamid": wamid,
                })
    return out


def group_by_day(lines: Iterable[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    """Lines → {YYYY-MM-DD: [line, …]}, each day sorted. A day is the unit because it is the unit
    the live sweep already uses, and reusing it means the backfilled summaries and the live ones
    are the same kind of object rather than two shapes that happen to share a table."""
    days: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for ln in lines:
        days[ln["ts"].date().isoformat()].append(ln)
    for d in days.values():
        d.sort(key=lambda x: (x["ts"], x.get("wamid") or ""))
    return dict(days)


# ── ② writing the past, without waking anything ────────────────────────────────────────────────
async def replay_day(con, scope: str, tenant: str, phone: str, day: str,
                     lines: list[dict[str, Any]]) -> dict[str, Any]:
    """Append one historical day as backdated events, then distil it exactly as the sweep would.

    Returns {events, summary_id, facts} — the facts count is the number that matters, because the
    facts are the only part of this that a turn will ever see."""
    import memory
    import spine

    ids: list[int] = []
    for i, ln in enumerate(lines[:MAX_EVENTS_PER_DAY]):
        text = ln.get("text") or ""
        if not text and ln.get("kind"):
            # A media line with no text still says something about how this customer orders.
            text = f"[{ln['kind']}]"
        # 'message' = they wrote; 'msg.sent' = the business did. Getting this wrong turns a
        # two-way relationship into a monologue, which is exactly the thing the replay is for.
        etype = "msg.sent" if ln["direction"] == "out" else "message"
        eid, is_new = await spine.append_event(
            con, scope, etype, source="wa_history",
            payload={"text": text, "addr": phone, "kind": "wa", "backfilled": True},
            lane="world",
            dedupe_key=f"backfill:{tenant}:{phone}:{ln.get('wamid') or f'{day}:{i}'}",
            ts=ln["ts"])
        if is_new:
            ids.append(int(eid))

    if not ids:
        return {"day": day, "events": 0, "summary_id": None, "facts": 0, "status": "already_done"}
    if len(lines) < MIN_LINES_FOR_DISTIL:
        return {"day": day, "events": len(ids), "summary_id": None, "facts": 0, "status": "too_thin"}

    distilled = await _distil_day(con, scope, day, lines)
    if not distilled.get("summary_text"):
        return {"day": day, "events": len(ids), "summary_id": None, "facts": 0,
                "status": distilled.get("status", "no_summary")}

    # Dated as the day it describes. See the header: this costs recall weight and buys the truth.
    when = datetime.fromisoformat(day).replace(tzinfo=timezone.utc)
    summary_id = await memory.write_summary(
        con, scope, distilled["summary_text"], source_event_ids=ids, ts=when)

    facts = 0
    for f in (distilled.get("facts") or []):
        kind = (f.get("kind") or "").strip().upper()
        text = (f.get("text") or "").strip()
        if not kind or not text:
            continue
        try:
            # `valid_at` is the historical day, not now: a fact learned in March was TRUE from
            # March, and the bi-temporal writer is built to hold exactly that distinction.
            res = await memory.write_fact(con, scope, kind, text,
                                          key=(f.get("key") or "").strip() or None,
                                          source_event_ids=ids, valid_at=when)
            if res.get("action") in ("inserted", "versioned"):
                facts += 1
        except Exception:
            log.exception("backfill: write_fact failed on %s (%s)", scope, kind)

    return {"day": day, "events": len(ids), "summary_id": summary_id, "facts": facts,
            "status": "ok"}


async def _distil_day(con, scope: str, day: str, lines: list[dict[str, Any]]) -> dict[str, Any]:
    """The same distil the nightly sweep runs, pointed at a historical day.

    Deliberately reuses `sweep`'s tool schema and system prompt rather than defining its own: two
    prompts producing rows into one `fact` table is two vocabularies drifting apart, and the whole
    claim of this module is that a replayed day is the same kind of object as a lived one. What
    changes is the framing — the model is told this is a PAST day, so it does not write «hoy»."""
    import sweep
    span = "\n".join(
        f"- [{ln['ts'].strftime('%H:%M')}] "
        f"{'NEGOCIO' if ln['direction'] == 'out' else 'CLIENTE'}: {ln.get('text') or '[' + str(ln.get('kind')) + ']'}"
        for ln in lines[:MAX_EVENTS_PER_DAY])
    card_body = ""
    try:
        card_body = await con.fetchval("select body from card where scope=$1::ltree", scope) or ""
    except Exception:
        pass

    user = (
        "FICHA:\n" + (card_body or "(vacía)") +
        f"\n\nCONVERSACIÓN DEL DÍA {day} (histórico importado, en orden):\n" + span +
        "\n\nEsto NO es hoy: es un día pasado que estamos incorporando. Escribe el resumen en "
        "pasado y no digas «hoy». Los hechos que saques deben ser los que SIGUEN siendo verdad "
        "(cómo pide, qué no puede llevar, su ritmo, sus precios, cómo llama a las cosas), no lo "
        "que pasó ese día en concreto.\n\nDestila el día en record_day.")
    try:
        import brain.llm as llm
        out = await llm.call_tool(
            config.VOICE_CHAT_MODEL, sweep._SUMMARIZE_SYSTEM, user,
            sweep._SUMMARIZE_TOOL, "record_day", max_tokens=1024, fallback=None)
    except Exception:
        log.exception("backfill: distil failed for %s %s", scope, day)
        return {"status": "distil_failed"}
    if not out or not (out.get("summary_text") or "").strip():
        return {"status": "empty_summary"}
    return {"summary_text": out["summary_text"].strip(), "facts": out.get("facts") or []}


# ── ③ the whole replay for one party ───────────────────────────────────────────────────────────
async def replay_party(tenant: str, phone: str, lines: list[dict[str, Any]]) -> dict[str, Any]:
    """Every historical day for one customer, oldest first, under sombra.

    OLDEST FIRST is not cosmetic: `memory.write_fact` versions a contradicted fact rather than
    duplicating it, so replaying in order means «pagaba 2,10» is superseded by «ahora 2,40» and
    the drawer ends up holding the CURRENT truth with the old one kept as history. Replayed
    backwards it would end up holding the oldest price as current."""
    import gate
    import runtime

    scope = runtime.scope_of(phone, tenant)
    days = group_by_day(lines)
    if not days:
        return {"scope": scope, "days": 0, "facts": 0, "status": "nothing_to_replay"}

    # MODO SOMBRA for the duration — the codebase's own kill-switch, and far safer than trying to
    # neutralise each side effect individually. The mind may run; the mouth may not.
    # The OWN override is read first and restored after, so a scope a human deliberately put in
    # sombra stays there, and a scope with no override goes back to having none rather than being
    # left pinned to whatever it inherited during the replay.
    restore: Optional[str] = None
    had_override = False
    try:
        async with db.scoped_tx(scope) as con:
            restore = await con.fetchval("select mode from scope_state where scope=$1::ltree", scope)
        had_override = restore is not None
        await gate.set_mode(scope, gate.SOMBRA)
    except Exception:
        log.debug("backfill: could not set sombra on %s — replay writes events only", scope,
                  exc_info=True)

    totals = {"days": 0, "events": 0, "facts": 0, "summaries": 0}
    try:
        for day in sorted(days):
            async with db.scoped_tx(scope) as con:
                r = await replay_day(con, scope, tenant, phone, day, days[day])
            totals["days"] += 1
            totals["events"] += int(r.get("events") or 0)
            totals["facts"] += int(r.get("facts") or 0)
            if r.get("summary_id"):
                totals["summaries"] += 1
    finally:
        # THE WATERMARK, ALWAYS — even on a partial replay. The nightly sweep keys on event ID, and
        # the replay owns the highest ids in the table; leaving the watermark behind them would
        # have the 12:00 run distil two years of history as «EVENTOS DE HOY».
        try:
            await _advance_watermark(scope)
        except Exception:
            log.exception("backfill: COULD NOT ADVANCE THE SWEEP WATERMARK for %s — the nightly "
                          "sweep may re-distil this history as today", scope)
        try:
            # `None` CLEARS the override (back to inheriting), which is the correct restore for a
            # scope that never had one — leaving it pinned would silently change how it behaves.
            await gate.set_mode(scope, restore if had_override else None)
        except Exception:
            log.exception("backfill: could not restore mode on %s — IT IS STILL IN SOMBRA and will "
                          "not speak until that is cleared", scope)

    # The card is regenerated ONCE at the end rather than per day: it is a pure function of the
    # current facts, so N regenerations would produce N-1 throwaway versions.
    try:
        import memory
        async with db.scoped_tx(scope) as con:
            await memory.regen_card(con, scope)
    except Exception:
        log.exception("backfill: card regen failed for %s", scope)

    log.info("backfill: %s replayed %d day(s) → %d event(s), %d summary(ies), %d fact(s)",
             scope, totals["days"], totals["events"], totals["summaries"], totals["facts"])
    return {"scope": scope, **totals, "status": "ok"}


async def _advance_watermark(scope: str) -> None:
    async with db.scoped_tx(scope) as con:
        last = await con.fetchval(
            "select max(id) from event where scope=$1::ltree and lane='world'", scope)
        if last:
            await con.execute(
                "insert into sweep_state(scope, watermark_event_id, last_swept_at, updated_at) "
                "values($1::ltree,$2,now(),now()) on conflict (scope) do update "
                "set watermark_event_id = greatest(sweep_state.watermark_event_id, excluded.watermark_event_id), "
                "    updated_at = now()", scope, int(last))


# ── ④ the consumer the capture has been missing ────────────────────────────────────────────────
async def run_pending_chunks(limit: int = 20) -> dict[str, int]:
    """Drain `wa_history_chunk` — the table coexistence has been filling with nothing reading it.

    `processed_at` is the idempotency gate, and it is stamped ONLY after the party replays cleanly,
    so a crash mid-chunk re-runs it and the event dedupe keys swallow whatever already landed."""
    done = failed = parties = 0
    async with db.get_pool().acquire() as con:
        rows = await con.fetch(
            "select id, tenant_id, payload from wa_history_chunk "
            "where processed_at is null order by received_at limit $1", int(limit))
    for row in rows:
        payload = row["payload"]
        if isinstance(payload, str):
            try:
                payload = json.loads(payload)
            except ValueError:
                payload = {}
        try:
            lines = parse_history_chunk((payload or {}).get("value") or payload or {})
            by_party: dict[str, list[dict[str, Any]]] = defaultdict(list)
            for ln in lines:
                if ln.get("phone"):
                    by_party[ln["phone"]].append(ln)
            for phone, party_lines in by_party.items():
                await replay_party(str(row["tenant_id"]), phone, party_lines)
                parties += 1
            async with db.get_pool().acquire() as con:
                await con.execute(
                    "update wa_history_chunk set processed_at = now() where id = $1", int(row["id"]))
            done += 1
        except Exception:
            failed += 1
            log.exception("backfill: chunk %s failed (left unprocessed for retry)", row["id"])
    if done or failed:
        log.info("backfill: %d chunk(s) replayed, %d parties, %d failed", done, parties, failed)
    return {"chunks": done, "parties": parties, "failed": failed}
