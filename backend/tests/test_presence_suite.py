"""Unit tests for THE PRESENCE SUITE (2026-07-25) — channel mechanics on the Meta CLOUD rail.

BOUNDARY-MOCKED and DB-FREE (same discipline as test_voice_reply.py): the Graph API is a fake
httpx.AsyncClient, the DB helpers are monkeypatched — runs anywhere without a Postgres.

Covers the suite's vitals:
  • TYPING on the cloud rail: send_typing_indicator POSTs /{phone_id}/messages with
    {status:'read', message_id:<inbound wamid>, typing_indicator:{type:'text'}} — endpoint AND
    payload asserted; fail-soft on 4xx/exception; empty wamid → no HTTP at all.
  • _fire_typing RAIL DISPATCH: a wamid.* inbound goes to the CLOUD indicator VERBATIM (no
    suffix-strip — base64url ids can end in '-<digits>'), never to Twilio's Typing.json (which
    400s on wamids — the journal bug); an SM… SID still rides Twilio's beta endpoint.
  • REACTION send: type=reaction payload (message_id + emoji), empty emoji = removal (Meta's
    contract), missing target raises; actions.send_reaction_as_rocoto events msg.sent
    kind=reaction + projects kind='reaction' and refuses non-wamid targets.
  • REACTION HONESTY (2026-07-26) — the 200 is not delivery. PRE-FLIGHT: a stale (>30d) / unknown /
    itself-a-reaction target is refused typed + evented with ZERO egress, while a DB fault is NOT a
    refusal. POST-FLIGHT: a 131009 delivery-status webhook events ops.reaction_failed, rolls the
    phantom projection back, and does NOT page a human (any other code still does). And the rail
    never invents a wamid: a 200 with no id raises CloudSendError instead of 'wamid.unknown'.
  • REACTION ingest: app._meta_inbound_reaction stores the projection row (message_type='reaction',
    reply_to_wa_id=<reacted wamid>) and emits the msg.reaction sense (dedupe on the reaction wamid);
    a target-less payload is a no-op.
  • MEDIA OUT: extension→type map stays honest (ogg=audio — the 131053 regression guard).
"""
import asyncio
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("ROCOTO_MEDIA_DIR", "/tmp/rocoto-test-media")

import config  # noqa: E402
import voice_reply as vr  # noqa: E402
import whatsapp_cloud as wc  # noqa: E402


def run(coro):
    return asyncio.run(coro)


# ─────────────────────────── fake Graph client ───────────────────────────
class _FakeResp:
    def __init__(self, code=200, body=None):
        self.status_code = code
        self._body = body or {"messages": [{"id": "wamid.OUT1"}]}
        self.text = str(self._body)

    def json(self):
        return self._body


class _FakeClient:
    """Captures every POST; class-level so tests read _FakeClient.calls after the context exits."""
    calls: list = []
    code = 200

    def __init__(self, *a, **k):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    async def post(self, url, headers=None, json=None, data=None, files=None):
        _FakeClient.calls.append({"url": url, "headers": headers, "json": json})
        return _FakeResp(_FakeClient.code)


@pytest.fixture(autouse=True)
def _graph_env(monkeypatch):
    _FakeClient.calls = []
    _FakeClient.code = 200
    monkeypatch.setattr(config, "EGRESS_SANDBOX", False)
    monkeypatch.setattr(config, "WA_CLOUD_TOKEN", "test-token")
    monkeypatch.setattr(config, "WA_CLOUD_PHONE_ID", "555000111")
    yield
    _FakeClient.calls = []


# ─────────────────────────── 1. typing indicator, cloud rail ───────────────────────────
def test_cloud_typing_posts_meta_endpoint_and_payload(monkeypatch):
    monkeypatch.setattr(wc.httpx, "AsyncClient", _FakeClient)
    ok = run(wc.send_typing_indicator("wamid.INBOUND123=="))
    assert ok is True
    assert len(_FakeClient.calls) == 1
    call = _FakeClient.calls[0]
    # THE endpoint: the phone-number's /messages (Meta's mark-read+typing contract), not Twilio's.
    assert call["url"] == f"{wc.GRAPH}/555000111/messages"
    assert "Typing.json" not in call["url"]
    assert call["json"] == {
        "messaging_product": "whatsapp",
        "status": "read",
        "message_id": "wamid.INBOUND123==",
        "typing_indicator": {"type": "text"},
    }
    assert call["headers"]["Authorization"] == "Bearer test-token"


def test_cloud_typing_fail_soft(monkeypatch):
    monkeypatch.setattr(wc.httpx, "AsyncClient", _FakeClient)
    # empty wamid → False, zero HTTP
    assert run(wc.send_typing_indicator("")) is False
    assert _FakeClient.calls == []
    # Graph 400 → False, never raises (presence must not crash the reply path)
    _FakeClient.code = 400
    assert run(wc.send_typing_indicator("wamid.X")) is False


def test_fire_typing_dispatches_wamid_to_cloud_verbatim(monkeypatch):
    cloud, twilio = [], []

    async def cloud_spy(wamid):
        cloud.append(wamid)
        return True

    async def twilio_spy(sid):
        twilio.append(sid)
        return True

    monkeypatch.setattr(config, "ROCOTO_TYPING_INDICATOR_ENABLED", True)
    monkeypatch.setattr(wc, "send_typing_indicator", cloud_spy)
    monkeypatch.setattr(vr.twa, "send_typing_indicator", twilio_spy)
    # a wamid ending in '-<digits>' must NOT be suffix-stripped (base64url can end that way)
    run(vr._fire_typing("wamid.ABC-42"))
    assert cloud == ["wamid.ABC-42"]
    assert twilio == []  # the 400ing Twilio POST for cloud chats is DEAD


def test_fire_typing_dispatches_sid_to_twilio(monkeypatch):
    cloud, twilio = [], []

    async def cloud_spy(wamid):
        cloud.append(wamid)
        return True

    async def twilio_spy(sid):
        twilio.append(sid)
        return True

    monkeypatch.setattr(config, "ROCOTO_TYPING_INDICATOR_ENABLED", True)
    monkeypatch.setattr(wc, "send_typing_indicator", cloud_spy)
    monkeypatch.setattr(vr.twa, "send_typing_indicator", twilio_spy)
    run(vr._fire_typing("SM123-2"))  # twilio multi-media suffix → normalised bare SID
    assert twilio == ["SM123"]
    assert cloud == []


# ─────────────────────────── 2. reaction SEND ───────────────────────────
def test_send_reaction_payload(monkeypatch):
    monkeypatch.setattr(wc.httpx, "AsyncClient", _FakeClient)
    sid = run(wc.send_reaction("+34600111222", "wamid.TARGET", "👍"))
    assert sid == "wamid.OUT1"
    call = _FakeClient.calls[0]
    assert call["url"] == f"{wc.GRAPH}/555000111/messages"
    assert call["json"] == {
        "messaging_product": "whatsapp", "recipient_type": "individual",
        "to": "34600111222", "type": "reaction",
        "reaction": {"message_id": "wamid.TARGET", "emoji": "👍"},
    }


def test_send_reaction_empty_emoji_removes(monkeypatch):
    monkeypatch.setattr(wc.httpx, "AsyncClient", _FakeClient)
    run(wc.send_reaction("+34600111222", "wamid.TARGET", ""))
    assert _FakeClient.calls[0]["json"]["reaction"] == {"message_id": "wamid.TARGET", "emoji": ""}


def test_send_reaction_requires_target():
    with pytest.raises(ValueError):
        run(wc.send_reaction("+34600111222", "", "👍"))


class _RCon:
    """A connection stub for the reaction path: no endpoint row → the wa.<digits> scope IS the addr."""

    async def fetchval(self, *a, **k):
        return None


def _reaction_rig(monkeypatch, *, target_row, sandbox=False, mode=None):
    """Wire the reaction send path to spies. Returns (sent, events, projected).

    `mode` is MODO SOMBRA (B6, SPEC §5.5): the reaction rail now asks the one mode field before it
    speaks, and the resolver fails CLOSED, so a DB-free unit test must SAY which mode it is testing.
    None = no override anywhere = 'auto' (the mouth is open), which is what every mechanics test
    below is about; `mode='sombra'` is exercised by its own test.
    """
    import db
    import gate
    import projector
    import spine

    async def fake_mode(scope, con=None):
        return mode

    monkeypatch.setattr(gate, "_read_mode", fake_mode)

    sent, events, projected = [], [], []

    async def fake_send_reaction(addr, target, emoji):
        sent.append((addr, target, emoji))
        return "wamid.SENT9"

    async def fake_append_event(con, scope, type_, source="runtime", payload=None, **kw):
        events.append({"scope": scope, "type": type_, "payload": payload})
        return 777, True

    async def fake_project(scope, text, sid=None, event_id=None, kind="text", reply_to_wa_id=None):
        projected.append({"scope": scope, "text": text, "sid": sid, "event_id": event_id,
                          "kind": kind, "reply_to_wa_id": reply_to_wa_id})

    async def fake_lookup(wamid):
        return target_row

    monkeypatch.setattr(config, "EGRESS_SANDBOX", sandbox)
    monkeypatch.setattr(wc, "send_reaction", fake_send_reaction)
    monkeypatch.setattr(spine, "append_event", fake_append_event)
    monkeypatch.setattr(projector, "project_msg_sent", fake_project)
    monkeypatch.setattr(db, "message_by_wamid", fake_lookup)
    return sent, events, projected


_FRESH = {"role": "user", "message_type": "text", "phone_number": "+34600111222", "age_days": 0.2}


def test_send_reaction_as_rocoto_events_and_projects(monkeypatch):
    import actions as rt_actions
    sent, events, projected = _reaction_rig(monkeypatch, target_row=_FRESH)

    res = run(rt_actions.send_reaction_as_rocoto("wa.34600111222", "wamid.TARGET", "👍", con=_RCon()))
    assert res == {"ok": True, "sid": "wamid.SENT9", "reason": "accepted",
                   "target_wamid": "wamid.TARGET", "emoji": "👍"}
    assert sent == [("+34600111222", "wamid.TARGET", "👍")]
    assert events == [{"scope": "wa.34600111222", "type": "msg.sent",
                       "payload": {"text": "👍", "kind": "reaction", "emoji": "👍",
                                   "target_wamid": "wamid.TARGET", "sid": "wamid.SENT9"}}]
    assert projected[0]["kind"] == "reaction"
    assert projected[0]["reply_to_wa_id"] == "wamid.TARGET"
    assert projected[0]["event_id"] == 777


def test_send_reaction_held_by_modo_sombra(monkeypatch):
    """B6 (SPEC §5.5): PRESENCE is speech. In sombra the reaction is held BEFORE the pre-flight —
    nothing reaches the rail, nothing is evented as msg.sent, and the reason the boss reads is the
    true one (the mouth is shut), not an incidental complaint about the target."""
    import actions as rt_actions
    sent, events, projected = _reaction_rig(monkeypatch, target_row=_FRESH, mode="sombra")

    res = run(rt_actions.send_reaction_as_rocoto("wa.34600111222", "wamid.TARGET", "👍", con=_RCon()))
    assert res["ok"] is False and res["sid"] is None and res["reason"].startswith("sombra")
    assert sent == []                                  # no rail
    assert projected == []                             # no phantom gesture in the app
    assert [e["type"] for e in events] == ["sombra.held"]   # held, and SAID to be held
    assert events[0]["payload"]["draft"] == "👍"


def test_send_reaction_as_rocoto_refuses_non_wamid(monkeypatch):
    import actions as rt_actions
    called = []

    async def fake_send_reaction(*a):
        called.append(a)
        return "x"

    monkeypatch.setattr(config, "EGRESS_SANDBOX", False)
    monkeypatch.setattr(wc, "send_reaction", fake_send_reaction)
    # a Twilio SM… SID is not reactable — refuse before any HTTP/event/DB lookup
    res = run(rt_actions.send_reaction_as_rocoto("wa.34600111222", "SM123", "👍", con=object()))
    assert res["ok"] is False and res["reason"] == "not_a_wamid" and res["sid"] is None
    assert called == []


# ── the PRE-FLIGHT (2026-07-26): what Meta would accept with a 200 and refuse later (131009) ──
def test_send_reaction_preflight_refuses_stale_target(monkeypatch):
    """A target past Meta's 30-day reaction window: refused HERE, typed, evented, zero egress."""
    import actions as rt_actions
    stale = dict(_FRESH, age_days=31.4)
    sent, events, projected = _reaction_rig(monkeypatch, target_row=stale)

    res = run(rt_actions.send_reaction_as_rocoto("wa.34600111222", "wamid.OLD", "👍", con=_RCon()))
    assert res["ok"] is False and res["sid"] is None
    assert res["reason"].startswith("target_older_than_30d:")
    assert sent == [] and projected == []                    # nothing sent, nothing shown
    assert [e["type"] for e in events] == ["ops.reaction_refused"]   # and never silent
    assert events[0]["payload"]["target_wamid"] == "wamid.OLD"


def test_send_reaction_preflight_refuses_unknown_and_reaction_targets(monkeypatch):
    import actions as rt_actions
    sent, events, _ = _reaction_rig(monkeypatch, target_row=None)     # never seen on any thread
    r1 = run(rt_actions.send_reaction_as_rocoto("wa.34600111222", "wamid.GHOST", "👍", con=_RCon()))
    assert r1["ok"] is False and r1["reason"] == "unknown_target" and sent == []

    # a reaction is not reactable (Meta refuses async with 131009)
    sent2, events2, _ = _reaction_rig(monkeypatch, target_row=dict(_FRESH, message_type="reaction"))
    r2 = run(rt_actions.send_reaction_as_rocoto("wa.34600111222", "wamid.REACT", "👍", con=_RCon()))
    assert r2["ok"] is False and r2["reason"] == "target_is_a_reaction" and sent2 == []


def test_send_reaction_preflight_db_fault_is_not_a_refusal(monkeypatch):
    """The guard is cheap insurance, not a new way to lose a gesture: if we cannot CHECK, we send —
    the status webhook stays the authority."""
    import actions as rt_actions
    import db
    sent, events, _ = _reaction_rig(monkeypatch, target_row=_FRESH)

    async def boom(wamid):
        raise RuntimeError("db.init() has not been called yet")

    monkeypatch.setattr(db, "message_by_wamid", boom)
    res = run(rt_actions.send_reaction_as_rocoto("wa.34600111222", "wamid.TARGET", "👍", con=_RCon()))
    assert res["ok"] is True and len(sent) == 1


def test_send_reaction_rail_error_is_not_a_success(monkeypatch):
    """The Graph raised → NOTHING is evented or projected and the caller is told (no silent success)."""
    import actions as rt_actions
    import projector
    import spine
    _reaction_rig(monkeypatch, target_row=_FRESH)
    events, projected = [], []

    async def boom(*a):
        raise wc.CloudSendError("cloud send returned no wamid (200): {}")

    async def fake_append_event(con, scope, type_, source="runtime", payload=None, **kw):
        events.append(type_)
        return 1, True

    async def fake_project(*a, **k):
        projected.append(a)

    monkeypatch.setattr(wc, "send_reaction", boom)
    monkeypatch.setattr(spine, "append_event", fake_append_event)
    monkeypatch.setattr(projector, "project_msg_sent", fake_project)
    res = run(rt_actions.send_reaction_as_rocoto("wa.34600111222", "wamid.TARGET", "👍", con=_RCon()))
    assert res["ok"] is False and res["reason"] == "send_failed:CloudSendError"
    assert events == [] and projected == []


class _NoIdClient(_FakeClient):
    """A Graph 200 whose body carries no messages[].id (the shape that produced 'wamid.unknown')."""

    async def post(self, url, headers=None, json=None, data=None, files=None):
        _FakeClient.calls.append({"url": url, "headers": headers, "json": json})
        return _FakeResp(200, {"messaging_product": "whatsapp"})


def test_post_messages_refuses_to_invent_a_wamid(monkeypatch):
    """A 2xx with no messages[].id is a FAILURE — the old 'wamid.unknown' placeholder was a sid no
    status webhook could ever match, so that phantom could never be rolled back."""
    monkeypatch.setattr(wc.httpx, "AsyncClient", _NoIdClient)
    with pytest.raises(wc.CloudSendError):
        run(wc.send_reaction("+34600111222", "wamid.TARGET", "👍"))
    assert len(_FakeClient.calls) == 1  # it really did POST — the refusal is about the ANSWER


def test_send_reaction_as_rocoto_sandboxed(monkeypatch):
    """EGRESS_SANDBOX: the gesture is evented but never reaches Meta (class-E floor)."""
    import actions as rt_actions
    sent, events, _ = _reaction_rig(monkeypatch, target_row=_FRESH, sandbox=True)
    res = run(rt_actions.send_reaction_as_rocoto("wa.34600111222", "wamid.T", "👍", con=_RCon()))
    assert res["ok"] is True and res["sid"] == "SANDBOX-reaction"
    assert sent == []
    assert events and events[0]["payload"]["kind"] == "reaction"


# ── the POST-FLIGHT: the 131009 status webhook (the async failure this whole pass is about) ──
def _status_rig(monkeypatch, *, reaction_event):
    """Wire app._meta_status_failed to spies. Returns (events, actions_parked, unprojected)."""
    import app
    import db
    import projector
    import spine

    events, parked, unprojected = [], [], []

    class _Con:
        async def fetchrow(self, sql, *a):
            return reaction_event if "kind'='reaction" in sql else None

        async def execute(self, sql, *a):
            parked.append((sql, a))
            return "INSERT 0 1"

    class _Tx:
        async def __aenter__(self):
            return _Con()

        async def __aexit__(self, *a):
            return False

    async def fake_append_event(con, scope, type_, source="runtime", payload=None, **kw):
        events.append({"type": type_, "payload": payload, "caused_by": kw.get("caused_by")})
        return 42, True

    async def fake_unproject(event_id):
        unprojected.append(int(event_id))
        return True

    monkeypatch.setattr(db, "scoped_tx", lambda scope: _Tx())
    monkeypatch.setattr(spine, "append_event", fake_append_event)
    monkeypatch.setattr(projector, "unproject", fake_unproject)
    return app, events, parked, unprojected


def test_status_131009_on_a_reaction_events_failure_and_rolls_back(monkeypatch):
    reaction_event = {"id": 900, "payload": {"kind": "reaction", "emoji": "👍",
                                             "target_wamid": "wamid.OLD", "sid": "wamid.RX"}}
    app, events, parked, unprojected = _status_rig(monkeypatch, reaction_event=reaction_event)
    run(app._meta_status_failed({"id": "wamid.RX", "status": "failed",
                                 "recipient_id": "34600111222",
                                 "errors": [{"code": 131009, "title": "Parameter value is not valid"}]}))
    assert [e["type"] for e in events] == ["ops.reaction_failed"]
    assert events[0]["caused_by"] == 900                      # it CORRECTS the msg.sent it names
    assert events[0]["payload"]["rolled_back"] is True
    assert events[0]["payload"]["target_wamid"] == "wamid.OLD"
    assert unprojected == [900]                               # the phantom is gone from the app
    assert parked == []                                       # a bad target does not page a human


def test_status_other_error_on_a_reaction_still_pages(monkeypatch):
    """Any code that is NOT the target error smells like a dead mouth — park the human action."""
    reaction_event = {"id": 901, "payload": {"kind": "reaction", "emoji": "❤️",
                                             "target_wamid": "wamid.X", "sid": "wamid.RY"}}
    app, events, parked, unprojected = _status_rig(monkeypatch, reaction_event=reaction_event)
    run(app._meta_status_failed({"id": "wamid.RY", "status": "failed",
                                 "recipient_id": "34600111222",
                                 "errors": [{"code": 131047}]}))
    assert [e["type"] for e in events] == ["ops.reaction_failed"]
    assert unprojected == [901]
    assert len(parked) == 1 and "wa_delivery_failed" in parked[0][0]


def test_status_failure_on_a_plain_message_keeps_the_wp0_contract(monkeypatch):
    app, events, parked, unprojected = _status_rig(monkeypatch, reaction_event=None)
    run(app._meta_status_failed({"id": "wamid.MSG", "status": "undelivered",
                                 "recipient_id": "34600111222", "errors": [{"code": 131026}]}))
    assert [e["type"] for e in events] == ["ops.wa_send_failed"]
    assert unprojected == []                                  # nothing to roll back for a message
    assert len(parked) == 1 and "wa_delivery_failed" in parked[0][0]


# ─────────────────────────── 3. reaction INGEST (webhook helper) ───────────────────────────
def test_meta_inbound_reaction_stores_row_and_emits_sense(monkeypatch):
    import app
    import runtime

    rows, senses = [], []

    async def fake_upsert_profile(phone, name):
        pass

    async def fake_insert_message(row):
        rows.append(row)
        return row

    async def fake_emit_sense(**kw):
        senses.append(kw)
        return "wa.34600111222"

    monkeypatch.setattr(app.supa, "upsert_profile", fake_upsert_profile)
    monkeypatch.setattr(app.supa, "insert_message", fake_insert_message)
    monkeypatch.setattr(runtime, "emit_sense", fake_emit_sense)

    m = {"type": "reaction", "id": "wamid.REACT1",
         "reaction": {"message_id": "wamid.OURMSG", "emoji": "👍"}}
    run(app._meta_inbound_reaction(m, "+34600111222", "wamid.REACT1", "Tester"))

    assert len(rows) == 1
    r = rows[0]
    assert r["message_type"] == "reaction"
    assert r["message_text"] == "👍"
    assert r["role"] == "user"
    assert r["wa_message_id"] == "wamid.REACT1"
    assert r["reply_to_wa_id"] == "wamid.OURMSG"  # tied to the reacted message

    assert len(senses) == 1
    s = senses[0]
    assert s["type"] == "msg.reaction"
    assert s["dedupe_key"] == "react:wamid.REACT1"
    assert s["payload"] == {"emoji": "👍", "target_wamid": "wamid.OURMSG",
                            "wamid": "wamid.REACT1", "removed": False}


def test_meta_inbound_reaction_removal_and_no_target(monkeypatch):
    import app
    import runtime

    rows, senses = [], []

    async def fake_upsert_profile(phone, name):
        pass

    async def fake_insert_message(row):
        rows.append(row)
        return row

    async def fake_emit_sense(**kw):
        senses.append(kw)
        return "s"

    monkeypatch.setattr(app.supa, "upsert_profile", fake_upsert_profile)
    monkeypatch.setattr(app.supa, "insert_message", fake_insert_message)
    monkeypatch.setattr(runtime, "emit_sense", fake_emit_sense)

    # Meta's un-react: reaction without emoji → stored empty + removed=True
    m = {"type": "reaction", "id": "wamid.R2", "reaction": {"message_id": "wamid.OURMSG"}}
    run(app._meta_inbound_reaction(m, "+34600111222", "wamid.R2", ""))
    assert rows[0]["message_text"] == "" and senses[0]["payload"]["removed"] is True

    # no target message_id → nothing sensed, nothing stored
    rows.clear(); senses.clear()
    run(app._meta_inbound_reaction({"type": "reaction", "reaction": {}}, "+34600", "wamid.R3", ""))
    assert rows == [] and senses == []


# ─────────────────────────── 4. media out stays honestly typed ───────────────────────────
def test_outbound_media_kind_map_honest():
    # the 131053 regression guard: a voice note is AUDIO, never 'image' by default
    assert wc._KIND_BY_EXT["ogg"] == "audio"
    assert wc._KIND_BY_EXT["pdf"] == "document"
    assert wc._KIND_BY_EXT.get("jpg", "image") == "image"
