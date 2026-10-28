"""vital_cr_read.py — WP-9 cr-read: the summary→source expansion + the chat-surface columns.

Deterministic, no LLM. Seeds a scope with two events + a summary that distilled them (source_event_ids),
and a voice-note whatsapp_messages row; asserts control_room.summary_sources returns exactly those source
events, and that drill_data surfaces the voice-note transcript (proving the whatsapp_messages column
additions reached the rehearsal clone — the chat surface was silently empty on the clone before).
"""
import asyncio
import os
from pathlib import Path

for _l in Path("/opt/rocoto/.env").read_text().splitlines() if Path("/opt/rocoto/.env").exists() else []:
    _l = _l.strip()
    if _l and not _l.startswith("#") and "=" in _l:
        k, _, v = _l.partition("="); os.environ.setdefault(k.strip(), v.strip())
import control_room  # noqa: E402
import db
import spine

SCOPE = "wa.34977000333"; PHONE = "+34977000333"; R = []
def ck(n, ok, d=""):
    R.append(bool(ok)); print(f"  [{'PASS' if ok else 'FAIL'}] {n}" + (f" — {d}" if d else ""))

async def _clean():
    async with db.scoped_tx(SCOPE) as con:
        for t in ("summary", "event"):
            await con.execute(f"delete from {t} where scope=$1::ltree", SCOPE)
    async with db.get_pool().acquire() as con:
        await con.execute("delete from whatsapp_messages where phone_number=$1", PHONE)

async def main():
    await db.init(); await _clean()
    # two events + a summary that distilled them
    async with db.scoped_tx(SCOPE) as con:
        e1, _ = await spine.append_event(con, SCOPE, "message", "twilio_wa", {"text": "hola, quiero 3 cajas"}, lane="world", actor="human")
        e2, _ = await spine.append_event(con, SCOPE, "message", "runtime", {"text": "claro, 3 cajas anotadas"}, lane="world")
        sid = await con.fetchval(
            "insert into summary(scope, ts, text, source_event_ids, lineage) "
            "values($1::ltree, now(), $2, $3::bigint[], 'live') returning id",
            SCOPE, "pidió 3 cajas", [int(e1), int(e2)])
    d = await control_room.summary_sources(SCOPE, sid)
    ck("summary_sources ok", d.get("ok"), str(d.get("error")))
    ck("returns exactly the 2 source events", len(d.get("events", [])) == 2, f"n={len(d.get('events',[]))}")
    ck("source event text preserved", any("3 cajas" in (e.get("text") or "") for e in d.get("events", [])))
    ck("unknown summary id → not_found", not (await control_room.summary_sources(SCOPE, 999999999)).get("ok"))

    # chat surface: a voice note (empty text, transcript set + media/seeded columns) must round-trip
    async with db.get_pool().acquire() as con:
        await con.execute(
            "insert into whatsapp_messages(id, phone_number, role, message_text, message_type, transcript, "
            "  transcript_status, media_urls, media_types, seeded, created_at) "
            "values($1,$2,'user','',$3,$4,'done','[]'::jsonb,'[]'::jsonb,true, now())",
            "vtest-cr-1", PHONE, "audio", "me llamo Ana y quiero pedir")
    dr = await control_room.drill_data(SCOPE)
    tx = dr.get("transcript", [])
    ck("drill_data returns a transcript list (chat surface reads the fuller table)", isinstance(tx, list) and len(tx) >= 1)
    ck("voice-note transcript surfaced (whatsapp_messages.transcript column on the clone)",
       any("Ana" in (m.get("text") or "") for m in tx))

    await _clean()
    print(f"\nvital_cr_read: {sum(R)}/{len(R)} green")
    if not all(R):
        raise SystemExit(1)

if __name__ == "__main__":
    asyncio.run(main())
