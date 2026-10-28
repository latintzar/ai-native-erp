"""vital_nudge.py — M1M2 WP-0: THE REVIEW-NUDGE (unreviewed orders approaching the daily cutoff).

SITUATIONS ARE DATA (SPEC §16.6): the situation is the `review_nudge` manifest_duty ROW bound by the
ONE generic binder, plus exactly ONE manifest-registered perception reflex (manifest_reflex row
('boss','review_nudge'); wired code = app._review_nudge_scan in the dispatch organ). This proves:

  1. both rows seed (the duty as an L0 default at 'peter'; the reflex registration row);
  2. NOTHING unreviewed → SILENCE (no sense, no tab, no event);
  3. unreviewed approaching cutoff → ONE `orders.review_pending` sense onto the boss scope with a
     per-cutoff dedupe_key — a second scan emits NOTHING (the whole chain fires once per cutoff);
     the tab's sentence is COUNT-FREE with every slot resolved, and the rung carries
     pacing_deadline = the cutoff ISO;
  4. the PACING WINDOW (worker._pacing_hold_ok): under forced quiet-hours the deadline-carrying rung
     is EXEMPT (a hold would overshoot the cutoff → it sends NOW) while a deadline-less branch still
     holds; firing the rung sends exactly ONE WhatsApp over the standard gate→rail path;
  5. the daily email FLAGS the held count (_run_dispatch → dispatch_async held_count), a scheduled
     run with NOTHING approved but a held set sends the held-only notice, and a truly empty day
     stays silent;
  6. the queue emptying emits `orders.review_clear` → the tab RESOLVES (then silence again).

SAFETY: refuses the live `rocoto` DB. Point it at rocoto_rehearsal (REHEARSAL_DSN or per-role DSNs).
Usage:  REHEARSAL_DSN=… python tests/vital_nudge.py
"""
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# point at the rehearsal clone (never the live rocoto). REHEARSAL_DSN fills any pool DSN not already
# exported — so a caller can still supply the real per-role (rt/ctrl) rehearsal DSNs and have them win.
_DSN = os.environ.get("REHEARSAL_DSN")
if _DSN:
    for _k in ("DATABASE_URL", "RUNTIME_DATABASE_URL", "CONTROL_DATABASE_URL"):
        os.environ.setdefault(_k, _DSN)

for _l in Path("/opt/rocoto/.env").read_text().splitlines() if Path("/opt/rocoto/.env").exists() else []:
    _l = _l.strip()
    if _l and not _l.startswith("#") and "=" in _l:
        _k, _, _v = _l.partition("=")
        os.environ.setdefault(_k.strip(), _v.strip())

import app as app_mod  # noqa: E402  (the dispatch organ owns the reflex emitter)
import db  # noqa: E402
import duties  # noqa: E402
import orders as orders_mod  # noqa: E402
import presence  # noqa: E402
import reach  # noqa: E402
import runtime  # noqa: E402
import spine  # noqa: E402
import twilio_wa  # noqa: E402
import worker  # noqa: E402
from brain import events as brain_events_mod  # noqa: E402

PHONE = "+34999333444"
SCOPE = runtime.scope_of(PHONE)
R = []


def ck(name, ok, detail=""):
    R.append(bool(ok))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


def _js(v):
    import json
    return v if isinstance(v, (list, dict)) else json.loads(v or "null")


async def _events(type_: str) -> int:
    async with db.control_pool().acquire() as con:
        return int(await con.fetchval(
            "select count(*) from event where scope=$1::ltree and type=$2", SCOPE, type_) or 0)


async def main():
    from datetime import datetime

    await db.init()
    duties.invalidate_cache()

    # SAFETY GUARD — never the live rocoto DB.
    async with db.get_pool().acquire() as con:
        dbname = await con.fetchval("select current_database()")
    if dbname == "rocoto":
        raise SystemExit("REFUSING to run vitals against the LIVE 'rocoto' DB — use rocoto_rehearsal")
    print(f"  (db={dbname})")

    # ── setup: a boss party on a clean scope (contact + wa endpoint + scope_node tier=boss) ──
    async with db.scoped_tx(SCOPE) as con:
        for t in ("timer", "open_loop", "event"):
            await con.execute(f"delete from {t} where scope=$1::ltree", SCOPE)
        await spine.resolve_chat_scope(con, None, "wa", PHONE, display_name="Boss Vital",
                                       scope_override=SCOPE, tier_override="boss")
        await con.execute("update scope_node set tier='boss' where scope=$1::ltree", SCOPE)
    async with db.get_pool().acquire() as con:
        await con.execute("delete from orders where id like 'vitalnudge-%'")

    # 1) the rows seed: the duty (L0 default) + the reflex registration.
    async with db.control_pool().acquire() as con:
        duty_ok = await con.fetchval(
            "select count(*) from manifest_duty where scope='peter' and name='review_nudge' and enabled")
        reflex_ok = await con.fetchval(
            "select count(*) from manifest_reflex where scope_tier='boss' and organ='review_nudge' and enabled")
    ck("review_nudge seeds as a manifest_duty ROW (L0 default at 'peter')", duty_ok == 1, f"n={duty_ok}")
    ck("the reflex REGISTRATION row ('boss','review_nudge') seeds in manifest_reflex",
       reflex_ok == 1, f"n={reflex_ok}")

    # the real count read: needs_review rows are what the reflex senses (and what dispatch holds).
    base = await db.orders_pending_review_count()
    await db.order_insert({"id": "vitalnudge-c1", "phone_number": PHONE, "customer_name": "Bar Vital",
                           "status": "needs_review",
                           "lines": [{"item": "tomate", "qty": 2, "unit": "kg", "price": None, "note": ""}]})
    after = await db.orders_pending_review_count()
    ck("db.orders_pending_review_count counts needs_review rows", after == base + 1,
       f"base={base} after={after}")
    async with db.get_pool().acquire() as con:
        await con.execute("delete from orders where id like 'vitalnudge-%'")

    # ── pin the reflex to OUR boss phone (restored in cleanup) + a controllable count ──
    async with db.get_pool().acquire() as con:
        await con.execute(
            "update manifest_reflex set config = config || $1::jsonb "
            "where organ='review_nudge' and scope_tier='boss'", {"boss_phone": PHONE})
    _count = {"n": 0}
    _real_count = db.orders_pending_review_count

    async def _fake_count():
        return _count["n"]

    db.orders_pending_review_count = _fake_count

    # deterministic clock: "now" = today 10:00 Madrid, cutoff 10:30 (inside the 45-min lead window).
    now_fake = datetime.now(presence.TZ).replace(hour=10, minute=0, second=0, microsecond=0)
    cutoff = now_fake.replace(minute=30)
    ST = {"mode": "scheduled", "schedule_time": "10:30"}
    CK = cutoff.strftime("%Y%m%d-%H%M")
    EKEY = f"revnudge:{CK}"

    # 2) NOTHING unreviewed → SILENCE.
    res = await app_mod._review_nudge_scan(ST, now=now_fake)
    n_evt = await _events("orders.review_pending")
    ck("nothing unreviewed → SILENCE (no sense, no tab)",
       not res["emitted"] and res["cleared"] == 0 and n_evt == 0,
       f"res={res} events={n_evt}")

    # 3) unreviewed approaching cutoff → ONE sense (per-cutoff dedupe), count-free sentence, deadline.
    _count["n"] = 2
    r1 = await app_mod._review_nudge_scan(ST, now=now_fake)
    r2 = await app_mod._review_nudge_scan(ST, now=now_fake)   # the dedupe: same cutoff → nothing new
    n_evt = await _events("orders.review_pending")
    async with db.control_pool().acquire() as con:
        tab = await con.fetchrow(
            "select id, contingencies from open_loop where scope=$1::ltree and entity_key=$2 "
            "and status='open'", SCOPE, EKEY)
        armed = await con.fetchval(
            "select branch_id from timer t join open_loop l on l.id=t.loop_id "
            "where l.scope=$1::ltree and l.entity_key=$2 and t.state='armed' limit 1", SCOPE, EKEY)
    cont0 = (_js(tab["contingencies"])[0] if tab else {}) or {}
    sent0 = (cont0.get("action", {}) or {}).get("sentence") or ""
    ck("unreviewed at cutoff → orders.review_pending fires ONCE (per-cutoff dedupe)",
       r1["emitted"] and not r2["emitted"] and n_evt == 1,
       f"r1={r1['emitted']} r2={r2['emitted']} events={n_evt}")
    ck("the duty ROW opens the tab (keyed revnudge:{cutoff_key}) + arms r1_nudge",
       tab is not None and armed == "r1_nudge", f"tab={tab['id'] if tab else None} armed={armed}")
    ck("sentence is COUNT-FREE with every slot resolved (mentions the cutoff, never the count)",
       sent0 and "{" not in sent0 and "10:30" in sent0, sent0[:90])
    ck("the rung carries pacing_deadline = the cutoff ISO",
       cont0.get("pacing_deadline") == cutoff.isoformat(),
       f"deadline={cont0.get('pacing_deadline')}")

    # 4) the PACING WINDOW + the fire: forced quiet-hours must NOT hold the nudge past its cutoff.
    _orig_quiet = presence.quiet_now
    presence.quiet_now = lambda now=None: True                  # 3am forever, as far as pacing knows
    hold_plain = worker._pacing_hold_ok({})                     # no deadline → normal pacing (holds)
    hold_nudge = worker._pacing_hold_ok(cont0)                  # hold would overshoot → send NOW
    ck("pacing window: deadline-less branch still holds; the nudge branch is EXEMPT",
       hold_plain is True and hold_nudge is False, f"plain={hold_plain} nudge={hold_nudge}")

    _sends = []

    async def _fake_verify(con, **kw):
        return True

    async def _fake_send(addr, text, **kw):
        _sends.append((addr, text))
        return "SM_vitalnudge"

    async def _fake_reach(con, scope, intent="nudge", has_email=False):
        return {"channel": "freeform"}

    worker._verify_branch = _fake_verify
    twilio_wa.send_whatsapp = _fake_send
    reach.choose_channel = _fake_reach

    async with db.control_pool().acquire() as con:
        tid = await con.fetchval(
            "select t.id from timer t join open_loop l on l.id=t.loop_id "
            "where l.scope=$1::ltree and l.entity_key=$2 and t.branch_id='r1_nudge' and t.state='armed'",
            SCOPE, EKEY)
    did = False
    if tid is not None:
        async with db.scoped_tx(SCOPE) as con:
            did = await worker._fire_one(con, {"id": int(tid), "scope": SCOPE})
    n_sent = await _events("msg.sent")
    n_held = await _events("pacing.held")
    async with db.control_pool().acquire() as con:
        t_state = await con.fetchval("select state from timer where id=$1", tid) if tid else None
    ck("firing r1_nudge under quiet hours SENDS the WhatsApp anyway (never held past cutoff)",
       did and len(_sends) == 1 and _sends[0][0] == PHONE and n_held == 0 and t_state == "fired",
       f"did={did} sends={len(_sends)} pacing.held={n_held} timer={t_state}")
    ck("the nudge rides the spine outbound path (one msg.sent, the gate-checked rail)",
       n_sent == 1 and "10:30" in (_sends[0][1] if _sends else ""), f"msg.sent={n_sent}")
    presence.quiet_now = _orig_quiet

    # 5) the daily email FLAGS the held count (_run_dispatch → dispatch_async / send_held_notice).
    _emails = []

    async def _fake_email(to, subject, html, attachment_name=None, attachment_bytes=None):
        _emails.append({"to": to, "subject": subject, "html": html, "attached": attachment_bytes is not None})
        return {"ok": True, "id": "vital"}

    _iso = now_fake.isoformat()

    async def _fake_for_dispatch():
        return [{"id": "vitalnudge-a1", "phone_number": PHONE, "customer_name": "Bar Vital",
                 "status": "approved", "created_at": _iso, "note": "",
                 "lines": [{"item": "tomate pera", "qty": 3, "unit": "kg", "price": 2.0, "note": ""}]}]

    async def _fake_mark(ids, delivery_note=None):
        return None

    orders_mod.send_email_async = _fake_email
    _real_for_dispatch = db.orders_for_dispatch
    db.orders_for_dispatch = _fake_for_dispatch
    brain_events_mod.mark_dispatched = _fake_mark
    app_mod._DEFAULT_DISPATCH["recipient_email"] = "vital@rehearsal.local"

    _count["n"] = 2
    d1 = await app_mod._run_dispatch("scheduled")
    ck("daily email flags the held count (subject + body carry '2 sin revisar')",
       d1.get("ok") and d1.get("held") == 2 and len(_emails) == 1
       and "2 sin revisar" in _emails[0]["subject"] and "sin revisar" in _emails[0]["html"]
       and _emails[0]["attached"],
       f"res={ {k: d1.get(k) for k in ('ok', 'count', 'held')} } subject={_emails[0]['subject'] if _emails else None}")

    async def _fake_empty():
        return []

    db.orders_for_dispatch = _fake_empty
    _count["n"] = 3
    d2 = await app_mod._run_dispatch("scheduled")
    ck("NOTHING approved but a held set → the held-only notice still goes out (never a silent day)",
       d2.get("ok") and d2.get("note") == "held-only notice" and len(_emails) == 2
       and "3 sin revisar" in _emails[1]["subject"] and not _emails[1]["attached"],
       f"res={ {k: d2.get(k) for k in ('ok', 'note', 'held')} } subject={_emails[1]['subject'] if len(_emails) > 1 else None}")

    _count["n"] = 0
    d3 = await app_mod._run_dispatch("scheduled")
    ck("a truly empty day stays SILENT (no email at all)",
       d3.get("ok") and d3.get("held") == 0 and len(_emails) == 2, f"res={d3} emails={len(_emails)}")
    db.orders_for_dispatch = _real_for_dispatch

    # 6) the queue emptying → orders.review_clear resolves the tab; then silence again.
    _count["n"] = 0
    c1 = await app_mod._review_nudge_scan(ST, now=now_fake)
    async with db.control_pool().acquire() as con:
        t_status = await con.fetchval(
            "select status from open_loop where scope=$1::ltree and entity_key=$2", SCOPE, EKEY)
    c2 = await app_mod._review_nudge_scan(ST, now=now_fake)
    ck("queue empty → orders.review_clear RESOLVES the tab (then silence)",
       c1["cleared"] == 1 and t_status == "resolved" and c2["cleared"] == 0 and not c2["emitted"],
       f"c1={c1} status={t_status} c2={c2}")

    # ── cleanup: restore the reflex row + drop the test party's rows ──
    db.orders_pending_review_count = _real_count
    async with db.get_pool().acquire() as con:
        await con.execute("update manifest_reflex set config = config - 'boss_phone' "
                          "where organ='review_nudge' and scope_tier='boss'")
        await con.execute("delete from orders where id like 'vitalnudge-%'")
    async with db.scoped_tx(SCOPE) as con:
        for t in ("timer", "open_loop", "event"):
            await con.execute(f"delete from {t} where scope=$1::ltree", SCOPE)
        await con.execute("delete from scope_node where scope=$1::ltree", SCOPE)

    passed = sum(R)
    print(f"\nNUDGE: {passed}/{len(R)} passed — "
          f"{'THE REVIEW-NUDGE IS DATA + ONE REFLEX' if passed == len(R) else 'BROKEN'}")
    return 0 if passed == len(R) else 1


raise SystemExit(asyncio.run(main()))
