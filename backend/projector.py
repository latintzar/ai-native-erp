"""projector.py — WP-9 P0: the OUTBOUND projector. Every spine `msg.sent` becomes a whatsapp_messages
row so the SyP app SEES the employee's proactive chases/wakes — which were INVISIBLE before (the worker
sends never projected). The spine is the source of truth; whatsapp_messages is a projection.

Best-effort + fail-soft + its OWN owner connection (whatsapp_messages is not scope-RLS'd; the worker's
scoped_tx role has no grant on it). Idempotent on event_id. The reconciler asserts zero divergence.
"""
from __future__ import annotations

import logging
import uuid

import config
import tenancy

log = logging.getLogger("rocoto.projector")


async def _phone_for_scope(con, scope: str) -> str:
    ph = tenancy.phone_of_scope(scope)             # both scope shapes (WP-A1)
    if ph:
        return ph
    return await con.fetchval(
        "select e.addr from endpoint e join contact c on c.id=e.contact_id "
        "where c.scope=$1::ltree and e.kind='wa' order by e.id desc limit 1", scope) or ""


async def project_msg_sent(scope: str, text: str, sid: str | None = None, event_id: int | None = None,
                           kind: str = "text", reply_to_wa_id: str | None = None) -> None:
    """Project one outbound msg.sent into whatsapp_messages (role=assistant). Idempotent on event_id.
    `kind` is the row's message_type (presence suite 2026-07-25: 'reaction' projects the emoji with
    reply_to_wa_id=the reacted wamid, so the app shows the gesture on the right bubble)."""
    import asyncpg
    try:
        con = await asyncpg.connect(config.DATABASE_URL)
        try:
            if event_id is not None:
                if await con.fetchval("select 1 from whatsapp_messages where event_id=$1", int(event_id)):
                    return
            phone = await _phone_for_scope(con, scope)
            if not phone:
                return
            await con.execute(
                "insert into whatsapp_messages(id,phone_number,role,message_text,message_type,"
                "wa_message_id,reply_to_wa_id,event_id) values($1,$2,'assistant',$3,$4,$5,$6,$7)",
                str(uuid.uuid4()), phone, text, kind or "text", sid, reply_to_wa_id, event_id)
        finally:
            await con.close()
    except Exception:
        # a projection failure must never break the send — but it is never SILENT either: the
        # reconciler counts the divergence and this line names it in the journal.
        log.warning("projection of msg.sent event_id=%s on %s failed (send stands)", event_id, scope,
                    exc_info=True)


async def unproject(event_id: int) -> bool:
    """ROLL BACK one projected row (2026-07-26). The rail can accept a send with a 200 and refuse it
    later on the status webhook (a reaction to a >30-day-old/deleted target → error 131009). When that
    happens the projection is a PHANTOM: the app would show the customer a gesture they never saw. The
    spine is append-only, so the msg.sent event stays and an `ops.reaction_failed` event corrects it —
    but the projection, which IS the app's view, is removed. Returns True if a row was removed."""
    import asyncpg
    if event_id is None:
        return False
    try:
        con = await asyncpg.connect(config.DATABASE_URL)
        try:
            res = await con.execute("delete from whatsapp_messages where event_id=$1", int(event_id))
            removed = not res.endswith(" 0")
            log.info("unproject event_id=%s → %s", event_id, "row removed" if removed else "nothing to remove")
            return removed
        finally:
            await con.close()
    except Exception:
        log.warning("unproject of event_id=%s failed", event_id, exc_info=True)
        return False


async def reconcile(scope: str) -> dict:
    """Zero-divergence check (WP-9): every outbound msg.sent event on `scope` has a projected row —
    EXCEPT the ones the rail failed after the fact, which were rolled back on purpose (`unproject`,
    recorded as an ops.*_failed event whose caused_by names the msg.sent). Those are counted, not
    silently ignored. Owner connection + the scope GUC (event is RLS'd; whatsapp_messages is not)."""
    import asyncpg
    con = await asyncpg.connect(config.DATABASE_URL)
    try:
        await con.execute("select set_config('rocoto.scope', $1, false)", scope)
        ev = await con.fetch("select id from event where scope=$1::ltree and type='msg.sent'", scope)
        rb = await con.fetch(
            "select distinct caused_by from event where scope=$1::ltree and caused_by is not null "
            "and type like 'ops.%' and payload->>'rolled_back' = 'true'", scope)
        rolled = {int(r["caused_by"]) for r in rb}
        ids = [int(e["id"]) for e in ev if int(e["id"]) not in rolled]
        proj = await con.fetchval(
            "select count(*) from whatsapp_messages where event_id = any($1::bigint[])", ids) if ids else 0
        return {"events": len(ev), "expected": len(ids), "projected": int(proj or 0),
                "rolled_back": len(rolled), "divergence": len(ids) - int(proj or 0)}
    finally:
        await con.close()
