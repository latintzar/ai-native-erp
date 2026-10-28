"""AUDIO → SPANISH, DIARISED (FEED-IA §196.6 «with clear speaker diarisation. set to spanish»).

`fixtures/deepgram-dual-result.json` is a REAL nova-3 response for a two-track Spanish recording
(one voice per channel, the shape a Twilio `record-from-answer-dual` call produces).
"""
from __future__ import annotations

from conftest import load

from app import deepgram


def test_two_tracks_become_two_speakers():
    shaped = deepgram.shape(load("deepgram-dual-result.json"), dual_channel=True, language="es")
    speakers = sorted({u["speaker"] for u in shaped["utterances"]})
    assert speakers == [0, 1], "channel 0 is us, channel 1 is them — no heuristics needed"
    assert shaped["utterances"][0]["start"] < shaped["utterances"][1]["start"]
    assert all(u["text"] for u in shaped["utterances"])


def test_the_transcript_reads_in_spanish_and_names_its_provider():
    shaped = deepgram.shape(load("deepgram-dual-result.json"), dual_channel=True, language="es")
    assert shaped["language"] == "es"
    assert shaped["provider"] == "deepgram nova-3"
    assert "pedido" in shaped["transcript"].lower()


def test_utterances_are_chronological_even_when_the_channels_interleave():
    body = {"results": {"channels": [{"alternatives": [{"transcript": "uno dos"}]}], "utterances": [
        {"channel": 1, "start": 4.0, "end": 5.0, "transcript": "dos"},
        {"channel": 0, "start": 1.0, "end": 2.0, "transcript": "uno"},
    ]}}
    shaped = deepgram.shape(body, dual_channel=True, language="es")
    assert [u["text"] for u in shaped["utterances"]] == ["uno", "dos"]
    assert [u["speaker"] for u in shaped["utterances"]] == [0, 1]


def test_a_single_mixed_track_is_read_by_the_diarizer_not_by_channel():
    body = {"results": {"channels": [{"alternatives": [{"transcript": "hola"}]}], "utterances": [
        {"speaker": 2, "channel": 0, "start": 0.0, "end": 1.0, "transcript": "hola"},
    ]}}
    shaped = deepgram.shape(body, dual_channel=False, language="es")
    assert shaped["utterances"][0]["speaker"] == 2


def test_a_transcript_with_no_utterances_still_says_what_was_heard():
    body = {"results": {"channels": [{"alternatives": [{"transcript": "un pedido corto"}]}], "utterances": []}}
    shaped = deepgram.shape(body, dual_channel=False, language="es")
    assert shaped["utterances"] == [{"speaker": 0, "start": 0.0, "end": 0.0, "text": "un pedido corto"}]


def test_silence_shapes_to_nothing_rather_than_to_an_invented_line():
    shaped = deepgram.shape({"results": {"channels": [], "utterances": []}}, dual_channel=False, language="es")
    assert shaped["transcript"] == ""
    assert shaped["utterances"] == []


def test_a_missing_key_is_a_named_refusal(monkeypatch):
    import asyncio

    from app import config
    from app.errors import RuntimeError_

    monkeypatch.setattr(config.settings, "deepgram_key", "", raising=False)
    try:
        asyncio.run(deepgram.transcribe(b"x", language="es"))
    except RuntimeError_ as exc:
        assert exc.code == "deepgram_missing" and exc.status == 503
    else:
        raise AssertionError("a missing key must refuse, never proceed")
