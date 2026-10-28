"""vital_presence.py — THE PRESENCE SUITE contract on the DB (2026-07-25).

  A. reaction WEBHOOK ingest (app._meta_inbound_reaction — the exact coroutine the Meta webhook
     dispatches): ONE whatsapp_messages row (message_type='reaction', message_text=emoji,
     reply_to_wa_id=<reacted wamid>) + ONE msg.reaction spine event on the party's scope;
     a Meta RE-DELIVERY writes ZERO new rows (unique wamid index + event dedupe key).
  B. reaction SEND path (actions.send_reaction_as_rocoto): msg.sent kind=reaction event + the
     assistant projection row (message_type='reaction', tied to the target wamid) — under the
     egress sandbox NOTHING reaches Meta; with the sandbox off and the Graph edge stubbed, the
     cloud rail receives (addr, target, emoji) exactly.
  C. THE 200 IS NOT DELIVERY (2026-07-26) — the async-failure contract. WhatsApp accepts a reaction
     to a >30-day-old / deleted / non-reactable message with a 200 + a wamid and refuses it LATER on
     the delivery-status webhook (error 131009), so we used to record a gesture the customer never
     saw. Both halves are proven on the DB here:
       · PRE-FLIGHT — a stale target and an unknown target are refused with a typed reason, ZERO
         egress, ZERO msg.sent, ZERO projection, and an ops.reaction_refused event (never silent).
       · POST-FLIGHT — a 131009 status webhook produces ONE ops.reaction_failed event (caused_by =
         the msg.sent it corrects), DELETES the phantom projection row, pages NO human, and leaves
         the reconciler at zero divergence. A failed PLAIN message still parks the WP-0 action.

Run on the rehearsal clone (prod box):
  source deploy/harness/rehearsal_env.sh && PYTHONPATH=. $PY tests/vital_presence.py
SAFETY: hard-refuses a live `rocoto` DATABASE_URL — this vital writes rows.

ISOLATION (2026-07-27, after a red nobody could explain). Every assertion below is a COUNT — one
row, one event, zero egress — on ONE phone (+34999001077), ONE scope, and seven fixed wamids. That
only means anything if this process is the only one writing them. It was not: `rocoto_rehearsal` was
a single fixed-name database shared by every vital anyone started on the box, and a second run's
`_cleanup()` (which deletes by scope and by phone) landing mid-run deletes exactly the rows one
check is about. Four concurrent runs on one clone measured 5/12, 9/12, 10/12, 11/12 and a crash;
the same file alone is 12/12 every time. The harness now gives each regression run a private clone
(`run_all_vitals.sh`), and this file claims its own territory below — so a collision is either
impossible or NAMED, never an unexplainable count.
"""
import asyncio
import json
import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse

for _l in Path("/opt/rocoto/.env").read_text().splitlines() if Path("/opt/rocoto/.env").exists() else []:
    _l = _l.strip()
    if _l and not _l.startswith("#") and "=" in _l:
        _k, _, _v = _l.partition("=")
        os.environ.setdefault(_k.strip(), _v.strip())

_dbname = (urlparse(os.environ.get("DATABASE_URL", "")).path or "").lstrip("/")
if _dbname == "rocoto":
    raise SystemExit("REFUSED: DATABASE_URL points at the LIVE rocoto DB — source rehearsal_env.sh first.")

import gatelib  # noqa: E402

import config  # noqa: E402
import db
import projector
import runtime
import spine  # noqa: E402,F401

PHONE = "+34999001077"
SCOPE = runtime.scope_of(PHONE)
# every wamid this file asserts on. `db.message_by_wamid` — the reaction pre-flight — looks a wamid
# up across the WHOLE table, not this phone's thread, so C2's «unknown target» is only true while
# nobody anywhere holds one of these ids. Listed so the claim below can say so out loud.
FIXTURE_WAMIDS = ["wamid.REACT.A1", "wamid.OURMSG.7", "wamid.STALE.C1", "wamid.NEVER.SEEN",
                  "wamid.OURMSG.C3", "wamid.RX.C3", "wamid.PLAIN.C4"]
CLAIM_KEY = 780425          # this vital's advisory-lock key on the clone ("presence owns +34999001077")
CLAIM_WAIT_S = 60
R = []


def ck(name, ok, detail=""):
    R.append(bool(ok)); print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


async def _claim_clone():
    """CLAIM THE FIXTURES, DO NOT ASSUME THEM. A session-level advisory lock on this database: while
    it is held no other `vital_presence` can be inside its checks, so two runs can no longer delete
    each other's rows. Waits (this is a queue, not a race), and if the wait runs out it says WHO is
    in the way — a precondition that is not met must never look like a product failure, and must
    never quietly pass either. Returns the connection that HOLDS the lock; closing it releases."""
    import asyncpg
    con = await asyncpg.connect(config.DATABASE_URL)
    for _ in range(CLAIM_WAIT_S):
        if await con.fetchval("select pg_try_advisory_lock($1)", CLAIM_KEY):
            return con
        await asyncio.sleep(1)
    holder = await con.fetchval(
        "select string_agg(distinct coalesce(a.application_name, 'pid ' || a.pid), ', ') "
        "from pg_locks l join pg_stat_activity a on a.pid = l.pid "
        "where l.locktype='advisory' and l.objid=$1 and l.granted", CLAIM_KEY)
    await con.close()
    raise SystemExit(
        f"REFUSED: another vital_presence has held {_dbname} for {CLAIM_WAIT_S}s (holder: "
        f"{holder or 'unknown'}). This file owns {PHONE} / {SCOPE} exclusively — two runs on one "
        "clone delete each other's fixtures and produce a red nobody can explain. Wait for it, or "
        "give this run its own clone: REHEARSAL_DB=rocoto_rehearsal_mine deploy/harness/"
        "rehearsal_rebuild.sh --with-rls && source deploy/harness/rehearsal_env.sh")


async def _assert_territory_clear() -> None:
    """After our own cleanup the territory MUST be empty. If it is not, something outside this
    process is writing our phone, our scope or our wamids — and every count below would be measuring
    it as well as us. Name it and stop; never measure through it."""
    async with db.get_pool().acquire() as con:
        stray = await con.fetch(
            "select phone_number, wa_message_id from whatsapp_messages "
            "where phone_number=$1 or wa_message_id = any($2::text[])", PHONE, FIXTURE_WAMIDS)
    async with db.scoped_tx(SCOPE) as con:
        n_ev = int(await con.fetchval("select count(*) from event where scope=$1::ltree", SCOPE) or 0)
        n_ac = int(await con.fetchval("select count(*) from action where scope=$1::ltree", SCOPE) or 0)
    if stray or n_ev or n_ac:
        raise SystemExit(
            f"REFUSED: {_dbname} is not ours to measure — after cleanup it still holds "
            f"{len(stray)} whatsapp_messages row(s) on {PHONE}/our wamids "
            f"({', '.join(sorted({(r['wa_message_id'] or r['phone_number']) for r in stray})) or '—'}), "
            f"{n_ev} event(s) and {n_ac} action(s) on {SCOPE}. Either another process is writing "
            "this clone right now, or a previous run died before its cleanup. Both make every count "
            "below meaningless.")


async def _cleanup():
    async with db.scoped_tx(SCOPE) as con:
        # actions FIRST: action.opened_by_event references event(id).
        await con.execute("delete from action where scope=$1::ltree", SCOPE)
        await con.execute("delete from event where scope=$1::ltree", SCOPE)
    async with db.get_pool().acquire() as con:
        await con.execute("delete from whatsapp_messages where phone_number=$1", PHONE)


async def _seed_inbound(wamid: str, age_days: float = 0.0) -> None:
    """A REAL inbound row for `wamid`, `age_days` old — what the reaction pre-flight reads. Reactions
    address messages that exist on the thread; a target we have never seen is refused."""
    async with db.get_pool().acquire() as con:
        await con.execute(
            "insert into whatsapp_messages(id,phone_number,role,message_text,message_type,"
            "wa_message_id,created_at) values($1,$2,'user','hola','text',$3,$4)",
            str(uuid.uuid4()), PHONE, wamid,
            datetime.now(timezone.utc) - timedelta(days=age_days))


class _Req:
    """The minimum FastAPI Request surface meta_wa_webhook touches — signed, the way Meta signs."""

    def __init__(self, payload: dict):
        self._raw = json.dumps(payload).encode()
        self.headers = gatelib.sign_meta(self._raw)

    async def body(self):
        return self._raw


def _status_payload(wamid: str, code: int, status: str = "failed") -> dict:
    """Meta's statuses[] shape for a refused send — the async half of every cloud-rail send."""
    return {"entry": [{"changes": [{"value": {"statuses": [{
        "id": wamid, "status": status, "recipient_id": PHONE.lstrip("+"),
        "errors": [{"code": code, "title": "Parameter value is not valid"}],
    }]}}]}]}


async def main():
    await db.init()
    import app as app_mod  # noqa: E402 — the webhook organ (heavy import; fine on the clone)
    claim = await _claim_clone()          # nobody else inside our fixtures while we measure them
    try:
        return await _run(app_mod)
    finally:
        await claim.close()               # releases the advisory lock with the session


async def _run(app_mod):
    await _cleanup()
    await _assert_territory_clear()

    # ── A. reaction webhook → row + event; redelivery = no-op ──────────────────────────────
    m = {"type": "reaction", "id": "wamid.REACT.A1",
         "reaction": {"message_id": "wamid.OURMSG.7", "emoji": "👍"}}
    await app_mod._meta_inbound_reaction(m, PHONE, "wamid.REACT.A1", "Vital Tester")
    await app_mod._meta_inbound_reaction(m, PHONE, "wamid.REACT.A1", "Vital Tester")  # redelivery

    async with db.get_pool().acquire() as con:
        rows = await con.fetch(
            "select role, message_text, message_type, wa_message_id, reply_to_wa_id "
            "from whatsapp_messages where phone_number=$1 and message_type='reaction'", PHONE)
    async with db.scoped_tx(SCOPE) as con:
        evs = await con.fetch(
            "select payload from event where scope=$1::ltree and type='msg.reaction'", SCOPE)
    ok_row = (len(rows) == 1 and rows[0]["role"] == "user" and rows[0]["message_text"] == "👍"
              and rows[0]["wa_message_id"] == "wamid.REACT.A1"
              and rows[0]["reply_to_wa_id"] == "wamid.OURMSG.7")
    ck("A1 reaction webhook → ONE projection row (type=reaction, tied to the reacted wamid); "
       "redelivery writes 0", ok_row, f"rows={len(rows)}")
    ok_ev = (len(evs) == 1 and evs[0]["payload"].get("emoji") == "👍"
             and evs[0]["payload"].get("target_wamid") == "wamid.OURMSG.7")
    ck("A2 reaction webhook → ONE msg.reaction spine event (idempotent on the reaction wamid)",
       ok_ev, f"events={len(evs)}")

    # ── B. reaction send path ───────────────────────────────────────────────────────────────
    import actions as rt_actions
    import whatsapp_cloud as wc

    # the pre-flight reads the thread: give it a REAL, fresh target to react to.
    await _seed_inbound("wamid.OURMSG.7", age_days=0.5)

    # B1 — sandboxed (the rehearsal floor): evented + projected, nothing reaches Meta.
    hit = []

    async def _spy(addr, target, emoji):
        hit.append((addr, target, emoji))
        return "wamid.SENT.B1"

    _orig, wc.send_reaction = wc.send_reaction, _spy
    _sand = config.EGRESS_SANDBOX
    try:
        config.EGRESS_SANDBOX = True
        res = await rt_actions.send_reaction_as_rocoto(SCOPE, "wamid.OURMSG.7", "👍")
        async with db.scoped_tx(SCOPE) as con:
            sent = await con.fetch(
                "select payload from event where scope=$1::ltree and type='msg.sent' "
                "and payload->>'kind'='reaction'", SCOPE)
        async with db.get_pool().acquire() as con:
            proj = await con.fetch(
                "select message_text, reply_to_wa_id from whatsapp_messages "
                "where phone_number=$1 and role='assistant' and message_type='reaction'", PHONE)
        ck("B1 sandboxed send: msg.sent kind=reaction event + assistant projection row, ZERO egress",
           res.get("ok") and res.get("sid") == "SANDBOX-reaction" and len(sent) == 1 and hit == []
           and len(proj) == 1 and proj[0]["reply_to_wa_id"] == "wamid.OURMSG.7",
           f"res={res} events={len(sent)} proj={len(proj)} egress={len(hit)}")

        # B2 — sandbox off, Graph edge stubbed: the cloud rail gets (addr, target, emoji) exactly.
        config.EGRESS_SANDBOX = False
        res2 = await rt_actions.send_reaction_as_rocoto(SCOPE, "wamid.OURMSG.7", "❤️")
        ck("B2 live-path send hits the CLOUD rail with (addr, target, emoji)",
           res2.get("sid") == "wamid.SENT.B1" and hit == [(PHONE, "wamid.OURMSG.7", "❤️")], f"hit={hit}")

        # B3 — a non-wamid target (Twilio SID) is refused before any event/egress.
        n_before = len(hit)
        res3 = await rt_actions.send_reaction_as_rocoto(SCOPE, "SM_NOT_A_WAMID", "👍")
        ck("B3 non-wamid target refused (cloud rail only), typed",
           res3.get("ok") is False and res3.get("reason") == "not_a_wamid" and len(hit) == n_before,
           f"res={res3}")

        # ── C. THE 200 IS NOT DELIVERY ────────────────────────────────────────────────────────
        # C1 — a target past Meta's 30-day window: refused BEFORE the send (Meta would take it and
        # refuse it async with 131009), typed + evented, nothing sent and nothing shown.
        await _cleanup()
        await _seed_inbound("wamid.STALE.C1", age_days=45)
        n_hit = len(hit)
        res4 = await rt_actions.send_reaction_as_rocoto(SCOPE, "wamid.STALE.C1", "👍")
        async with db.scoped_tx(SCOPE) as con:
            refused = await con.fetch(
                "select payload from event where scope=$1::ltree and type='ops.reaction_refused'", SCOPE)
            n_sent = await con.fetchval(
                "select count(*) from event where scope=$1::ltree and type='msg.sent'", SCOPE)
        async with db.get_pool().acquire() as con:
            n_proj = await con.fetchval(
                "select count(*) from whatsapp_messages where phone_number=$1 and role='assistant'", PHONE)
        ck("C1 a target older than 30 days is REFUSED pre-flight (typed reason, ops.reaction_refused "
           "event) — zero egress, zero msg.sent, zero projection",
           res4.get("ok") is False and str(res4.get("reason")).startswith("target_older_than_30d")
           and len(hit) == n_hit and len(refused) == 1
           and refused[0]["payload"].get("target_wamid") == "wamid.STALE.C1"
           and int(n_sent) == 0 and int(n_proj) == 0,
           f"res={res4} refused={len(refused)} sent={n_sent} proj={n_proj} egress={len(hit) - n_hit}")

        # C2 — a target we have never seen is not a real message id: same refusal, no send.
        res5 = await rt_actions.send_reaction_as_rocoto(SCOPE, "wamid.NEVER.SEEN", "👍")
        ck("C2 an unknown wamid (never on this thread) is refused pre-flight",
           res5.get("ok") is False and res5.get("reason") == "unknown_target" and len(hit) == n_hit,
           f"res={res5}")

        # C3 — the real thing: Meta ACCEPTS (200 + wamid), we event + project, and the refusal lands
        # later on the status webhook as 131009.
        await _cleanup()
        await _seed_inbound("wamid.OURMSG.C3", age_days=1)
        hit.clear()

        async def _spy_rx(addr, target, emoji):
            hit.append((addr, target, emoji))
            return "wamid.RX.C3"

        wc.send_reaction = _spy_rx
        res6 = await rt_actions.send_reaction_as_rocoto(SCOPE, "wamid.OURMSG.C3", "👍")
        async with db.get_pool().acquire() as con:
            before = await con.fetchval(
                "select count(*) from whatsapp_messages where phone_number=$1 and role='assistant' "
                "and message_type='reaction'", PHONE)
        ck("C3a the accepted send is evented + projected (this is the phantom, pre-webhook)",
           res6.get("ok") and res6.get("sid") == "wamid.RX.C3" and int(before) == 1,
           f"res={res6} proj={before}")

        await app_mod.meta_wa_webhook(_Req(_status_payload("wamid.RX.C3", 131009)))
        await app_mod.meta_wa_webhook(_Req(_status_payload("wamid.RX.C3", 131009)))  # re-delivery

        async with db.scoped_tx(SCOPE) as con:
            failed = await con.fetch(
                "select id, caused_by, payload from event where scope=$1::ltree "
                "and type='ops.reaction_failed'", SCOPE)
            msg_eid = await con.fetchval(
                "select id from event where scope=$1::ltree and type='msg.sent' "
                "and payload->>'sid'='wamid.RX.C3'", SCOPE)
            n_act = await con.fetchval(
                "select count(*) from action where scope=$1::ltree and kind='wa_delivery_failed'", SCOPE)
        async with db.get_pool().acquire() as con:
            after = await con.fetchval(
                "select count(*) from whatsapp_messages where phone_number=$1 and role='assistant' "
                "and message_type='reaction'", PHONE)
        ck("C3b a 131009 status webhook → ONE ops.reaction_failed event (caused_by = the msg.sent it "
           "corrects, rolled_back=true) and the phantom projection row is GONE; a re-delivery adds none",
           len(failed) == 1 and failed[0]["caused_by"] == msg_eid
           and failed[0]["payload"].get("rolled_back") is True
           and failed[0]["payload"].get("target_wamid") == "wamid.OURMSG.C3"
           and int(after) == 0,
           f"failed={len(failed)} caused_by={failed[0]['caused_by'] if failed else None} "
           f"msg_eid={msg_eid} proj_after={after}")
        ck("C3c a bad reaction TARGET does not page a human (131009 is not a dead mouth)",
           int(n_act) == 0, f"actions={n_act}")

        rec = await projector.reconcile(SCOPE)
        ck("C3d the reconciler stays at ZERO divergence — the rolled-back send is counted, not hidden",
           rec["divergence"] == 0 and rec["rolled_back"] == 1, str(rec))

        # C4 — the WP-0 contract is untouched: a failed PLAIN message still pages a human.
        await app_mod.meta_wa_webhook(_Req(_status_payload("wamid.PLAIN.C4", 131026)))
        async with db.scoped_tx(SCOPE) as con:
            plain = await con.fetchval(
                "select count(*) from event where scope=$1::ltree and type='ops.wa_send_failed'", SCOPE)
            acts = await con.fetchval(
                "select count(*) from action where scope=$1::ltree and kind='wa_delivery_failed' "
                "and needs_human", SCOPE)
        ck("C4 a failed PLAIN message keeps the WP-0 contract (ops.wa_send_failed + parked human action)",
           int(plain) == 1 and int(acts) == 1, f"events={plain} actions={acts}")
    finally:
        wc.send_reaction = _orig
        config.EGRESS_SANDBOX = _sand

    await _cleanup()
    passed = sum(R)
    print(f"\nPRESENCE: {passed}/{len(R)} passed — "
          f"{'REACTIONS SENSED + SENT + NEVER PHANTOM' if passed == len(R) else 'BROKEN'}")
    return 0 if passed == len(R) else 1


raise SystemExit(asyncio.run(main()))
