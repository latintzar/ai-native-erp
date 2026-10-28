"""test_ai_disclosure.py — the notices a caller hears, and when each one is owed.

Two duties with two different triggers, and the failure modes point in opposite directions:
announcing an AI that never speaks is a FALSE statement about the call; failing to announce one
that does is an Art. 50 breach. Both are tested, in both directions.
"""
from datetime import datetime, timezone

import ai_disclosure as d

BIZ = "Frutas Sitjar"
URL = "soyrocoto.com/privacidad"


def test_listening_never_claims_an_ai_is_speaking():
    """The default posture. A human answers their own phone; Rocoto transcribes. Saying «le atiende
    un asistente con inteligencia artificial» here would describe a call that is not happening."""
    out = d.opening(BIZ, privacy_url=URL, speaking=False, recording=True)
    assert "inteligencia artificial" not in out
    assert "Grabamos" in out and BIZ in out


def test_answering_discloses_the_ai_first():
    """Art. 50(5): «at the latest at the time of the first interaction». First means first."""
    out = d.opening(BIZ, privacy_url=URL, speaking=True, recording=True)
    assert out.index("inteligencia artificial") < out.index("Grabamos")


def test_the_ai_line_is_not_the_ambiguous_word_alone():
    """The Commission's guidelines name «generic references to 'assistant'» as INSUFFICIENT, so the
    disclosure must say what it is in full."""
    out = d.opening(BIZ, privacy_url=URL, speaking=True, recording=False)
    assert "inteligencia artificial" in out


def test_recording_notice_carries_what_lopdgdd_asks_of_a_first_layer():
    """Who is responsible, what for, the basis, where the rest lives — and the Art. 21(4) right to
    object as its own sentence rather than a subclause."""
    out = d.opening(BIZ, privacy_url=URL, speaking=False, recording=True)
    assert BIZ in out                       # who
    assert "pedido" in out                  # what for
    assert "interés legítimo" in out        # the basis — NOT consent
    assert URL in out                       # where the rest lives
    assert "Puede oponerse diciendo «sin grabar»." in out


def test_never_claims_processing_that_is_not_happening():
    out = d.opening(BIZ, privacy_url=URL, speaking=False, recording=False)
    assert out == "", "a call that neither speaks nor records owes no notice at all"
    quiet = d.opening(BIZ, privacy_url=URL, speaking=True, recording=False)
    assert "Grabamos" not in quiet


def test_objection_matcher_is_narrow_on_purpose():
    """A false positive silently loses the record of what was agreed on an order. A false negative
    just means they say it again and a human hears it. The asymmetry decides the width."""
    assert d.objects_to_recording("oye, sin grabar por favor")
    assert d.objects_to_recording("no me grabes")
    assert d.objects_to_recording("don't record this", lang="en")
    assert not d.objects_to_recording("quiero 20 kg de tomate")
    assert not d.objects_to_recording("me lo apuntas y ya está")


# ── the hours resolver: three states, not two ──────────────────────────────────────────────────
def _at(hhmm: str, day: int = 0):
    """A UTC instant on a chosen weekday. Monday=0."""
    return datetime(2026, 8, 17 + day, int(hhmm[:2]), int(hhmm[3:]), tzinfo=timezone.utc)


def test_hours_unknown_is_its_own_answer(monkeypatch):
    """The state that matters. «They chose after_hours but never set hours» must not be read as
    night — that would put a robot in front of a customer at 11:00 on a Tuesday."""
    import db
    async def _none(_):
        return {}
    monkeypatch.setattr(db, "settings_get", _none)
    import asyncio
    assert asyncio.run(d._within_hours("t", now=_at("11:00"))) is None


def test_a_day_with_no_hours_is_closed(monkeypatch):
    import asyncio

    import db
    async def _sun_only(_):
        return {"call_hours": {"tz": "UTC", "days": {"sun": ["09:00", "14:00"]}}}
    monkeypatch.setattr(db, "settings_get", _sun_only)
    # Monday: the day is absent from `days`, which is a real answer (closed), not unknown.
    assert asyncio.run(d._within_hours("t", now=_at("11:00"))) is False


def test_inside_and_outside_the_span(monkeypatch):
    import asyncio

    import db
    async def _weekday(_):
        return {"call_hours": {"tz": "UTC", "days": {"mon": ["08:00", "18:00"]}}}
    monkeypatch.setattr(db, "settings_get", _weekday)
    assert asyncio.run(d._within_hours("t", now=_at("11:00"))) is True
    assert asyncio.run(d._within_hours("t", now=_at("21:40"))) is False
    assert asyncio.run(d._within_hours("t", now=_at("18:00"))) is False, \
        "closing time is closed — the span is half-open"


# ── THE POSTURE GATE: the switch must decide whether the MOUTH EXISTS ─────────────────────────────
def test_the_posture_actually_gates_answering_not_just_the_greeting():
    """THE regression that was live on prod (2026-08-18).

    `behaviour["calls"]` defaults to «listen», which means «a person answers; Rocoto only hears it».
    But nothing gated ANSWERING on it — the posture's only reader chose whether to PREPEND the
    disclosure sentence. So in the default posture Rocoto answered, spoke and conversed while
    omitting the one sentence saying it is a machine: worse than either state the switch offers, and
    an Art. 50(1) exposure on every call.

    Checked structurally, against the syntax tree, because the failure was invisible in behaviour —
    the call sounded fine. What must hold is that `voice_incoming` RETURNS before building the
    ElevenLabs bridge when the posture is not speaking.
    """
    import ast
    import os
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    src = open(os.path.join(here, "app.py")).read()
    fn = next((n for n in ast.walk(ast.parse(src))
               if isinstance(n, ast.AsyncFunctionDef) and n.name == "voice_incoming"), None)
    assert fn is not None, "voice_incoming vanished"
    body = ast.dump(fn)
    assert "call_posture" in body, "voice_incoming must ASK the posture, not just announce it"

    # the listening return must come BEFORE the bridge is built
    listen_at = src.index("listening_twiml(", fn.lineno)
    bridge_at = src.index("incoming_twiml(", listen_at)
    assert listen_at < bridge_at, "the listening branch must return before the mind is bridged"


def test_listening_never_emits_a_synthetic_voice():
    """A listening call answers like an answering machine — a beep and a recorder. `<Say>` or a
    connected media stream to the agent would both be Rocoto speaking, which is the whole bug."""
    import voice
    xml = voice.listening_twiml(stream_wss_url="wss://x/stream", caller="+34600111222",
                                recording_cb="https://x/rec")
    assert "<Say" not in xml and "<Connect" not in xml, xml
    assert "<Record" in xml and 'playBeep="true"' in xml
    assert "<Start><Stream" in xml, "the mind must still HEAR the call"


# ── the hours WRITER, without which `after_hours` can never fire ──────────────────────────────────
def test_hours_have_a_writer_that_matches_the_reader():
    """`_within_hours` read `call_hours` since the day it was written and NOTHING wrote it, so the
    middle position of the switch resolved to «no hours configured, so a person answers» forever.
    A setting with a reader and no writer is a setting that does not exist."""
    out = d.parse_hours({"tz": "Europe/Madrid", "days": {"mon": ["5:00", "14:00"], "SAT": ["06:00", "12:00"]}})
    assert out["days"]["mon"] == ["05:00", "14:00"], "times must normalise to HH:MM"
    assert out["days"]["sat"] == ["06:00", "12:00"], "day names must normalise"
    assert set(out) == {"tz", "days"}


def test_hours_reject_what_would_silently_never_fire():
    for bad, why in [
        ({"days": {}}, "no days at all"),
        ({"days": {"mon": ["18:00", "08:00"]}}, "an overnight span is always closed"),
        ({"days": {"xyz": ["01:00", "02:00"]}}, "a day nobody has"),
        ({"tz": "Mars/Olympus", "days": {"mon": ["01:00", "02:00"]}}, "an unknown timezone"),
        ({"days": {"mon": ["8am", "6pm"]}}, "not HH:MM"),
        ({"days": {"mon": ["08:00"]}}, "a half-written range"),
    ]:
        try:
            d.parse_hours(bad)
            raise AssertionError(f"accepted {why}: {bad}")
        except ValueError:
            pass


def test_written_hours_are_readable_by_the_posture(monkeypatch):
    """The round trip is the point: what the endpoint stores must be what `_within_hours` reads."""
    import asyncio

    import db
    stored = d.parse_hours({"tz": "UTC", "days": {"mon": ["08:00", "18:00"]}})

    async def _get(_):
        return {d.HOURS_SETTING_KEY: stored}
    monkeypatch.setattr(db, "settings_get", _get)
    assert asyncio.run(d._within_hours("t", now=_at("11:00"))) is True
    assert asyncio.run(d._within_hours("t", now=_at("21:00"))) is False


# ── the text rail (WhatsApp), added 2026-08-19 ───────────────────────────────────────────────────
# The voice line is spoken once per call; a WhatsApp thread has no calls, so the notice goes on the
# first message Rocoto ever sends to a number and never again. Peter's shape, verbatim: «the first
# time it ever messages a specific number, the first message it always says something really short,
# like "Hey, I'm an AI helper", and then the salesperson's name.»


def test_whatsapp_line_says_ai_and_names_the_business():
    """Guidelines C(2026) 5054 pt (31): an agent discloses «both their artificial nature and the
    person on whose behalf they are acting»."""
    out = d.whatsapp_line(BIZ)
    assert "IA" in out
    assert BIZ in out


def test_whatsapp_line_never_leaves_assistant_travelling_alone():
    """The guidelines reject «unclear or ambiguous signals (e.g. generic references to
    "assistant")». «asistente» may appear, but never without «IA» beside it."""
    out = d.whatsapp_line(BIZ)
    assert "asistente" in out.lower()
    assert "IA" in out


def test_whatsapp_line_still_discloses_without_a_business_name():
    """A missing tenant name must not cost the disclosure. Half a notice beats none."""
    out = d.whatsapp_line("")
    assert "IA" in out
    assert out.endswith(".")


def test_whatsapp_line_stays_short_enough_to_be_read():
    """Raquel, 2026-08-19: «no se van a parar a leer una biblia, ni de coña». A disclosure nobody
    reads discharges nothing, so the sentence is capped at something a person takes in at a glance."""
    assert len(d.whatsapp_line(BIZ)) <= 60


def test_whatsapp_line_english():
    out = d.whatsapp_line(BIZ, "en")
    assert "AI" in out and BIZ in out
