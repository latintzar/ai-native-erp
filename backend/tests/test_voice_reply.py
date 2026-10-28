"""Unit tests for the WhatsApp auto-reply rails (voice_reply.py) — review F17.

These are BOUNDARY-MOCKED and DB-FREE: every external edge (Anthropic, Twilio, ElevenLabs, the DB
helpers) is monkeypatched, so the suite runs anywhere without a Postgres/Medusa. An autouse fixture
resets all module state (_DEBOUNCE_INFLIGHT / _PHONE_LOCKS / _LAST_REPLY_AT / _REPLY_SENT_AT) and forces
ROCOTO_REPLY_DEBOUNCE_SEC=0 between tests unless a test opts in.

Covers the review's asked-for surface:
  • pure predicates _superseded / _text_superseded (incl. the voice-rail asymmetry);
  • _inbound_sid normaliser;
  • _debounce_wait pile-up cap;
  • cooldown shared across BOTH rails + a FAILED send does not mark;
  • the global daily cap (F3);
  • _sweep_outbound_media_sync with tmp_path (old deleted / fresh kept / subdir skipped / ttl<=0 off)
    + inbound-dir coverage (A9a);
  • send_typing_indicator negative paths + _fire_typing flag gating;
  • the supersede fail-open/fail-closed fix (F4): get_messages raising → at most one send; unparseable
    'after' → treated as no-newer, NOT a permanent mute;
  • webhook-level F1 (multi-media dup retry stores the missing item) + MessageSid dedupe (one row, 200).
"""
import asyncio
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("ROCOTO_MEDIA_DIR", "/tmp/rocoto-test-media")

import config  # noqa: E402
import voice_reply as vr  # noqa: E402


# ─────────────────────────── fixtures ───────────────────────────
@pytest.fixture(autouse=True)
def _reset_state():
    """Reset every piece of module-level state + force debounce OFF (a test opts in via monkeypatch)."""
    vr._DEBOUNCE_INFLIGHT.clear()
    vr._PHONE_LOCKS.clear()
    vr._LAST_REPLY_AT.clear()
    vr._REPLY_SENT_AT.clear()
    _saved = (config.ROCOTO_REPLY_DEBOUNCE_SEC,
              config.ROCOTO_VOICE_REPLY_COOLDOWN_SEC,
              config.ROCOTO_REPLY_DAILY_CAP)
    config.ROCOTO_REPLY_DEBOUNCE_SEC = 0.0
    config.ROCOTO_VOICE_REPLY_COOLDOWN_SEC = 0
    config.ROCOTO_REPLY_DAILY_CAP = 0            # cap off unless a test sets it
    yield
    (config.ROCOTO_REPLY_DEBOUNCE_SEC,
     config.ROCOTO_VOICE_REPLY_COOLDOWN_SEC,
     config.ROCOTO_REPLY_DAILY_CAP) = _saved
    vr._DEBOUNCE_INFLIGHT.clear()
    vr._PHONE_LOCKS.clear()
    vr._LAST_REPLY_AT.clear()
    vr._REPLY_SENT_AT.clear()


def run(coro):
    return asyncio.run(coro)


# ─────────────────────────── _superseded (voice rail) ───────────────────────────
def test_superseded_empty():
    assert vr._superseded([], "m1") is False


def test_superseded_only_self():
    assert vr._superseded([{"id": "m1", "role": "user", "message_type": "audio"}], "m1") is False


def test_superseded_newer_assistant():
    newer = [{"id": "a1", "role": "assistant", "message_type": "text"}]
    assert vr._superseded(newer, "m1") is True


def test_superseded_newer_voice_note():
    newer = [{"id": "m2", "role": "user", "message_type": "audio"}]
    assert vr._superseded(newer, "m1") is True


def test_superseded_newer_text_does_NOT_supersede_voice():
    # Voice-rail asymmetry: a newer user TEXT must NOT suppress a voice reply (it's folded into context).
    newer = [{"id": "m2", "role": "user", "message_type": "text"}]
    assert vr._superseded(newer, "m1") is False


def test_superseded_none_role_row_ignored():
    newer = [{"id": "m2", "role": None, "message_type": "audio"}]
    assert vr._superseded(newer, "m1") is False


# ─────────────────────────── _text_superseded (text rail) ───────────────────────────
def test_text_superseded_empty():
    assert vr._text_superseded([], "m1") is False


def test_text_superseded_only_self():
    assert vr._text_superseded([{"id": "m1", "role": "user"}], "m1") is False


def test_text_superseded_newer_text_DOES_supersede():
    # Text-rail: a newer user TEXT MUST supersede a text reply (the text hook yields to a newer text).
    newer = [{"id": "m2", "role": "user", "message_type": "text"}]
    assert vr._text_superseded(newer, "m1") is True


def test_text_superseded_newer_assistant():
    newer = [{"id": "a1", "role": "assistant"}]
    assert vr._text_superseded(newer, "m1") is True


def test_text_superseded_none_role_ignored():
    assert vr._text_superseded([{"id": "m2", "role": None}], "m1") is False


# ─────────────────────────── _inbound_sid ───────────────────────────
@pytest.mark.parametrize("raw,want", [
    (None, ""),
    ("", ""),
    ("SM-0", "SM"),        # trailing -<digit> stripped
    ("SM-12", "SM"),
    ("abc-1a", "abc-1a"),  # tail not all digits → unchanged
    ("-1", ""),            # head empty → not stripped-to-head, returns as-is minus? head empty so unchanged
    ("SM123", "SM123"),    # no suffix
    ("MMabc-3", "MMabc"),
])
def test_inbound_sid(raw, want):
    # Special-case the "-1" row: head is "" so the guard (head and tail.isdigit()) is False → returns "-1".
    if raw == "-1":
        assert vr._inbound_sid(raw) == "-1"
    else:
        assert vr._inbound_sid(raw) == want


# ─────────────────────────── _debounce_wait pile-up cap ───────────────────────────
def test_debounce_pileup_cap():
    config.ROCOTO_REPLY_DEBOUNCE_SEC = 0.05   # small but non-zero → hooks actually park
    config.ROCOTO_MAX_DEBOUNCE_INFLIGHT = 3

    async def main():
        # Launch more than the cap concurrently; exactly cap should PROCEED (return True), rest bail.
        results = await asyncio.gather(*[vr._debounce_wait("+34600") for _ in range(8)])
        return results

    results = run(main())
    proceeded = sum(1 for r in results if r is True)
    assert proceeded == 3, f"expected exactly cap(3) to proceed, got {proceeded}"
    # Counter must empty out after all hooks finish.
    assert vr._DEBOUNCE_INFLIGHT.get("+34600", 0) == 0


def test_debounce_disabled_proceeds():
    config.ROCOTO_REPLY_DEBOUNCE_SEC = 0.0
    assert run(vr._debounce_wait("+34600")) is True
    assert vr._DEBOUNCE_INFLIGHT == {}   # never parked when disabled


# ─────────────────────────── cooldown shared across both rails ───────────────────────────
def test_cooldown_shared_across_rails():
    config.ROCOTO_VOICE_REPLY_COOLDOWN_SEC = 30
    # A voice reply marks _LAST_REPLY_AT for the phone…
    vr._mark_replied("+34600")
    # …and the text rail sees the same cooldown (shared map).
    assert vr._cooldown_active("+34600") is True
    # A different phone is unaffected.
    assert vr._cooldown_active("+34999") is False


def test_cooldown_off_by_default_never_blocks():
    config.ROCOTO_VOICE_REPLY_COOLDOWN_SEC = 0   # A1 default
    vr._mark_replied("+34600")
    assert vr._cooldown_active("+34600") is False


def test_failed_send_does_not_set_last_reply(monkeypatch):
    # A FAILED send must NOT mark _LAST_REPLY_AT (only a successful send calls _mark_replied).
    async def boom(*a, **k):
        raise RuntimeError("twilio down")

    monkeypatch.setattr(vr.twa, "send_whatsapp", boom)
    out = run(vr.send_text_reply("+34600", "hola"))
    assert out is None
    assert "+34600" not in vr._LAST_REPLY_AT
    assert vr._REPLY_SENT_AT == []


# ─────────────────────────── global daily cap (F3) ───────────────────────────
def test_daily_cap_exceeded_skips():
    config.ROCOTO_REPLY_DAILY_CAP = 2
    assert vr._daily_cap_exceeded() is False
    vr._record_reply_sent()
    assert vr._daily_cap_exceeded() is False   # 1 < 2
    vr._record_reply_sent()
    assert vr._daily_cap_exceeded() is True     # 2 >= 2


def test_daily_cap_zero_disables():
    config.ROCOTO_REPLY_DAILY_CAP = 0
    for _ in range(50):
        vr._record_reply_sent()
    assert vr._daily_cap_exceeded() is False


def test_daily_cap_prunes_old_sends(monkeypatch):
    config.ROCOTO_REPLY_DAILY_CAP = 1
    # Plant a stale send (>24h ago) then a fresh one; only the fresh one counts.
    import time as _t
    now = _t.monotonic()
    vr._REPLY_SENT_AT.append(now - (vr._DAY_SEC + 100))
    assert vr._daily_cap_exceeded() is False   # stale pruned → 0 sends
    vr._record_reply_sent()
    assert vr._daily_cap_exceeded() is True


# ─────────────────────────── media sweep ───────────────────────────
def _touch(p, age_sec):
    p.write_bytes(b"x")
    import time as _t
    t = _t.time() - age_sec
    os.utime(p, (t, t))


def test_sweep_outbound_media_sync(tmp_path, monkeypatch):
    out = tmp_path / "out"
    out.mkdir()
    monkeypatch.setattr(vr, "_OUTBOUND_DIR", out)
    monkeypatch.setattr(vr, "_INBOUND_DIR", tmp_path)   # inbound root = tmp_path (A9a)

    old_out = out / "old.ogg"; _touch(old_out, 3600 * 100)     # very old
    fresh_out = out / "fresh.ogg"; _touch(fresh_out, 10)       # brand new
    old_in = tmp_path / "in_old.oga"; _touch(old_in, 3600 * 100)
    fresh_in = tmp_path / "in_fresh.oga"; _touch(fresh_in, 10)
    subdir = tmp_path / "keepdir"; subdir.mkdir()              # dirs never touched

    removed = vr._sweep_outbound_media_sync(48)                # TTL 48h
    assert not old_out.exists()      # old outbound deleted
    assert fresh_out.exists()        # fresh outbound kept
    assert not old_in.exists()       # old inbound deleted (A9a)
    assert fresh_in.exists()         # fresh inbound kept
    assert subdir.exists()           # subdir skipped
    assert removed == 2


def test_sweep_ttl_zero_disables(tmp_path, monkeypatch):
    out = tmp_path / "out"; out.mkdir()
    monkeypatch.setattr(vr, "_OUTBOUND_DIR", out)
    monkeypatch.setattr(vr, "_INBOUND_DIR", tmp_path)
    old = out / "old.ogg"; _touch(old, 3600 * 100)
    assert vr._sweep_outbound_media_sync(0) == 0
    assert old.exists()   # nothing deleted when TTL <= 0


def test_sweep_skips_out_subdir_when_sweeping_inbound(tmp_path, monkeypatch):
    # The inbound sweep must skip the 'out' child so the out-dir file isn't double-counted / clobbered
    # via the inbound pass. Give the out subdir an OLD file and assert the outbound pass owns it.
    out = tmp_path / "out"; out.mkdir()
    monkeypatch.setattr(vr, "_OUTBOUND_DIR", out)
    monkeypatch.setattr(vr, "_INBOUND_DIR", tmp_path)
    old_out = out / "old.ogg"; _touch(old_out, 3600 * 100)
    removed = vr._sweep_outbound_media_sync(48)
    assert removed == 1   # counted exactly once (outbound pass), not twice


# ─────────────────────────── _fire_typing gating + send_typing_indicator negatives ───────────────
def test_fire_typing_gated_off_when_flag_false(monkeypatch):
    calls = []

    async def spy(sid):
        calls.append(sid)
        return True

    monkeypatch.setattr(config, "ROCOTO_TYPING_INDICATOR_ENABLED", False)
    monkeypatch.setattr(vr.twa, "send_typing_indicator", spy)
    run(vr._fire_typing("SM123"))
    assert calls == []   # flag off → never calls the endpoint


def test_fire_typing_fires_when_flag_on(monkeypatch):
    calls = []

    async def spy(sid):
        calls.append(sid)
        return True

    monkeypatch.setattr(config, "ROCOTO_TYPING_INDICATOR_ENABLED", True)
    monkeypatch.setattr(vr.twa, "send_typing_indicator", spy)
    run(vr._fire_typing("SM123-2"))    # multi-media suffix → normalised to bare SID
    assert calls == ["SM123"]


def test_send_typing_indicator_negatives(monkeypatch):
    import httpx

    import twilio_wa as twa

    monkeypatch.setattr(config, "EGRESS_SANDBOX", False)

    # empty sid → False, no HTTP
    assert run(twa.send_typing_indicator("")) is False

    class _Resp:
        def __init__(self, code):
            self.status_code = code

        def raise_for_status(self):
            if self.status_code >= 400:
                raise httpx.HTTPStatusError("boom", request=None, response=None)

    class _Client:
        def __init__(self, code=None, exc=None):
            self._code = code
            self._exc = exc

        async def post(self, *a, **k):
            if self._exc:
                raise self._exc
            return _Resp(self._code)

    # 4xx → False (no raise out)
    monkeypatch.setattr(twa, "_get_typing_client", lambda: _Client(code=404))
    assert run(twa.send_typing_indicator("SM1")) is False
    # 5xx → False
    monkeypatch.setattr(twa, "_get_typing_client", lambda: _Client(code=503))
    assert run(twa.send_typing_indicator("SM1")) is False
    # ConnectError → False
    monkeypatch.setattr(twa, "_get_typing_client",
                        lambda: _Client(exc=httpx.ConnectError("no route")))
    assert run(twa.send_typing_indicator("SM1")) is False


# ─────────────────────────── F4 fail-open / fail-closed supersede ───────────────────────────
def test_newer_msgs_fail_open_on_falsy_anchor(monkeypatch):
    called = {"n": 0}

    async def spy_get_messages(phone, after=None, after_id=None):
        called["n"] += 1
        # If we ever get here with after=None it would return the WHOLE thread (the old bug).
        return [{"id": "old_assistant", "role": "assistant"}]

    monkeypatch.setattr(vr.supa, "get_messages", spy_get_messages)
    # Falsy anchor (None / "") must NOT fetch the whole thread — returns [] → not a permanent mute.
    assert run(vr._newer_msgs("+34600", None, "m1")) == []
    assert run(vr._newer_msgs("+34600", "", "m1")) == []
    assert called["n"] == 0   # never queried the DB with a bad anchor


def test_newer_msgs_fail_open_on_unparseable_anchor(monkeypatch):
    called = {"n": 0}

    async def spy_get_messages(phone, after=None, after_id=None):
        called["n"] += 1
        return [{"id": "old_assistant", "role": "assistant"}]

    monkeypatch.setattr(vr.supa, "get_messages", spy_get_messages)
    # An unparseable timestamp must be treated as "no newer", NOT fetch-everything.
    assert run(vr._newer_msgs("+34600", "not-a-timestamp", "m1")) == []
    assert called["n"] == 0
    # And _superseded on that [] is False → the rail proceeds (not permanently muted).
    assert vr._superseded(run(vr._newer_msgs("+34600", "not-a-timestamp", "m1")), "m1") is False


def test_newer_msgs_db_error_fail_soft(monkeypatch):
    async def boom(phone, after=None, after_id=None):
        raise RuntimeError("db down")

    monkeypatch.setattr(vr.supa, "get_messages", boom)
    # A valid anchor but a DB error → [] (fail-soft), so at most one send, never a crash.
    assert run(vr._newer_msgs("+34600", "2026-07-10T10:00:00+00:00", "m1")) == []


def test_newer_msgs_passes_tuple_tiebreak(monkeypatch):
    seen = {}

    async def spy(phone, after=None, after_id=None):
        seen["after"] = after
        seen["after_id"] = after_id
        return []

    monkeypatch.setattr(vr.supa, "get_messages", spy)
    run(vr._newer_msgs("+34600", "2026-07-10T10:00:00+00:00", "m-anchor"))
    # A7: the id must be threaded through for the (created_at, id) tuple tiebreak.
    assert seen["after_id"] == "m-anchor"
    assert seen["after"] == "2026-07-10T10:00:00+00:00"


# ─────────────────────────── _clamp_reply (F5 output gate) ───────────────────────────
def test_clamp_reply_under_cap_unchanged():
    assert vr._clamp_reply("hola qué tal") == "hola qué tal"


def test_clamp_reply_hard_cap():
    long = "palabra " * 200            # ~1600 chars
    out = vr._clamp_reply(long)
    assert len(out) <= vr._MAX_REPLY_CHARS


# ─────────────────────────── webhook-level: F1 dup retry + MessageSid dedupe ───────────────────────────
class _FakeForm(dict):
    """Mimics starlette's FormData enough for app.twilio_incoming (dict(form) + .get)."""


class _FakeRequest:
    def __init__(self, form, headers=None):
        self._form = form
        self.headers = headers or {}

    async def form(self):
        return self._form


_TWILIO_TEST_TOKEN = "test-twilio-auth-token"


def _signed_twilio_request(monkeypatch, form, path):
    """A request Twilio itself would be the only other party able to produce.

    The webhook door verifies unconditionally now (WP-E): an unset TWILIO_AUTH_TOKEN refuses the
    request instead of waving it through, so a test that blanked the token to "skip signature
    validation" was driving a door the box no longer has. These tests sign instead, which also means
    they exercise the same path prod does."""
    from twilio.request_validator import RequestValidator
    monkeypatch.setattr(config, "TWILIO_AUTH_TOKEN", _TWILIO_TEST_TOKEN)
    sig = RequestValidator(_TWILIO_TEST_TOKEN).compute_signature(
        f"{config.PUBLIC_BASE_URL}{path}", dict(form))
    return _FakeRequest(form, {"X-Twilio-Signature": sig})


def _import_app():
    import app
    return app


def test_webhook_multimedia_dup_retry_stores_missing_item(monkeypatch):
    """F1: a first delivery stored item 0 but crashed before item 1; the Twilio retry re-POSTs both.
    Item 0 raises UniqueViolationError (already stored) → we must CONTINUE and still insert item 1,
    then ACK 200. (The bug was `return` on the dup, permanently dropping item 1.)"""
    app = _import_app()
    import asyncpg

    inserted = []

    async def fake_insert(row):
        # Simulate item-0 (…-0) already present; item-1 (…-1) is new.
        if row.get("wa_message_id", "").endswith("-0"):
            raise asyncpg.UniqueViolationError("dup")
        inserted.append(row["wa_message_id"])
        return row

    async def noop(*a, **k):
        return None

    monkeypatch.setattr(app.supa, "insert_message", fake_insert)
    monkeypatch.setattr(app.supa, "upsert_profile", noop)
    # Neutralise the fire-and-forget background tasks so nothing hits DB/network.
    monkeypatch.setattr(app, "_process_media", lambda *a, **k: noop())
    monkeypatch.setattr(app, "_notify", lambda *a, **k: noop())

    form = _FakeForm({
        "From": "+34600111222", "Body": "two pics", "ProfileName": "Ana",
        "MessageSid": "MMabc", "NumMedia": "2",
        "MediaUrl0": "https://api.twilio.com/x0", "MediaContentType0": "image/jpeg",
        "MediaUrl1": "https://api.twilio.com/x1", "MediaContentType1": "image/jpeg",
    })
    req = _signed_twilio_request(monkeypatch, form, "/twilio/whatsapp/incoming")
    resp = run(app.twilio_incoming(req))
    assert resp.status_code == 200
    # Item 1 must have been inserted despite item 0 being a dup.
    assert inserted == ["MMabc-1"], inserted


def test_webhook_text_dup_sid_one_row_200(monkeypatch):
    """MessageSid dedupe contract: the same text webhook delivered twice → one stored row, 200 both."""
    app = _import_app()
    import asyncpg

    store = set()

    async def fake_insert(row):
        sid = row.get("wa_message_id", "")
        if sid in store:
            raise asyncpg.UniqueViolationError("dup")
        store.add(sid)
        return row

    async def noop(*a, **k):
        return None

    monkeypatch.setattr(app.supa, "insert_message", fake_insert)
    monkeypatch.setattr(app.supa, "upsert_profile", noop)
    monkeypatch.setattr(app, "_notify", lambda *a, **k: noop())
    monkeypatch.setattr(app, "_maybe_extract_order", lambda *a, **k: noop())
    monkeypatch.setattr(config, "ROCOTO_TEXT_REPLY_ENABLED", False)   # don't spawn the reply hook

    form = _FakeForm({
        "From": "+34600111222", "Body": "hola", "ProfileName": "Ana",
        "MessageSid": "SMtext1", "NumMedia": "0",
    })
    req = _signed_twilio_request(monkeypatch, form, "/twilio/whatsapp/incoming")
    r1 = run(app.twilio_incoming(req))
    r2 = run(app.twilio_incoming(req))   # retry, same SID
    assert r1.status_code == 200 and r2.status_code == 200
    assert store == {"SMtext1"}   # exactly one row


# ─────────────────────────── integration: at most one send under supersede (F4) ───────────────────────────
def test_voice_hook_single_send_when_get_messages_raises(monkeypatch):
    """If the supersede fetch raises, the hook must fail-soft to at most ONE send (never crash, never
    loop). Here get_messages always raises → _newer_msgs returns [] → not superseded → one send."""
    from datetime import datetime, timezone
    fresh = datetime.now(timezone.utc).isoformat()   # inside the age guard window
    sends = []

    async def fake_get_message(mid):
        return {"id": mid, "role": "user", "message_type": "audio",
                "phone_number": "+34600", "transcript": "hola",
                "created_at": fresh, "wa_message_id": "MM1"}

    async def raising_get_messages(phone, after=None, after_id=None):
        raise RuntimeError("db blip")

    # The runtime is the only brain (no legacy fallback): the hook answers through
    # agent_reply.agentic_reply, so that is the seam this test stubs.
    async def fake_agentic(phone, transcript, hist, perception_note=None, **kw):
        return {"text": "respuesta", "actions": []}

    async def fake_send(phone, text, still_current=None):
        if still_current is not None:
            await still_current()   # exercise the F10 closure path
        sends.append((phone, text))
        return {"id": "sent1"}

    async def _posture(phone):
        return "voice"

    async def _no_wait(phone):
        return True

    async def _no_history(phone, limit=10):
        return []

    async def _no_typing(wa_message_id, phone=""):
        return None

    import agent_reply
    monkeypatch.setattr(vr, "configured", lambda: True)
    monkeypatch.setattr(vr.supa, "get_message", fake_get_message)
    monkeypatch.setattr(vr.supa, "get_messages", raising_get_messages)
    monkeypatch.setattr(vr, "voice_posture", _posture)
    monkeypatch.setattr(vr, "_debounce_wait", _no_wait)
    monkeypatch.setattr(vr, "_recent_history", _no_history)
    monkeypatch.setattr(vr, "_fire_typing", _no_typing)
    monkeypatch.setattr(agent_reply, "agentic_reply", fake_agentic)
    monkeypatch.setattr(vr, "send_voice_reply", fake_send)

    run(vr.maybe_reply_to_voice_note("m1"))
    assert len(sends) == 1
