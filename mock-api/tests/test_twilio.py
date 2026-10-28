"""TWILIO, AND WHAT IT REFUSES (FEED-IA §196.6 · VOICE-00's forbidden claims).

No Twilio account is touched here. What is under test is the TwiML this service composes, the
signature it demands, and the four facts it refuses to dial without.
"""
from __future__ import annotations

import asyncio

import pytest

from app import config, store, twilio_voice
from app.errors import RuntimeError_


@pytest.fixture(autouse=True)
def house(monkeypatch, tmp_path):
    monkeypatch.setattr(config.settings, "twilio_account_sid", "ACtest", raising=False)
    monkeypatch.setattr(config.settings, "twilio_auth_token", "a-token-for-tests", raising=False)
    monkeypatch.setattr(config.settings, "twilio_api_key_sid", "", raising=False)
    monkeypatch.setattr(config.settings, "twilio_api_key_secret", "", raising=False)
    monkeypatch.setattr(config.settings, "house_number", "+34600000000", raising=False)
    monkeypatch.setattr(config.settings, "operator_number", "+34611111111", raising=False)
    monkeypatch.setattr(config.settings, "public_base", "https://kit.soyrocoto.com", raising=False)
    monkeypatch.setattr(config.settings, "state_dir", tmp_path, raising=False)


def test_the_twiml_records_both_tracks_and_says_who_is_calling():
    xml = twilio_voice.twiml_dial("+34935563000")
    assert 'callerId="+34600000000"' in xml
    # `record-from-answer-dual` — the suffix IS the dual channel on <Dial>; `recordingChannels`
    # belongs to <Record> and is silently ignored here (the Hermes note, kept).
    assert 'record="record-from-answer-dual"' in xml
    assert "https://kit.soyrocoto.com/api/twilio/recording" in xml
    assert "https://kit.soyrocoto.com/api/twilio/status" in xml
    assert "<Number>+34935563000</Number>" in xml


def test_a_number_that_is_not_e164_gets_no_dial():
    xml = twilio_voice.twiml_dial("935563000")
    assert "<Dial" not in xml
    assert "Say" in xml


def test_only_a_correctly_signed_webhook_is_believed():
    from twilio.request_validator import RequestValidator

    url = "https://kit.soyrocoto.com/api/twilio/voice"
    form = {"CallSid": "CA1", "To": "+34935563000"}
    signature = RequestValidator("a-token-for-tests").compute_signature(url, form)
    assert twilio_voice.validate(url, form, signature) is True
    assert twilio_voice.validate(url, form, "not-the-signature") is False
    assert twilio_voice.validate(url, {**form, "To": "+34999999999"}, signature) is False
    assert twilio_voice.validate("https://kit.soyrocoto.com/api/twilio/status", form, signature) is False


def test_an_unsigned_webhook_is_refused_by_the_endpoint(client):
    for path in ("/api/twilio/voice", "/api/twilio/status", "/api/twilio/recording"):
        response = client.post(path, data={"CallSid": "CA1"})
        assert response.status_code == 403
        assert response.json()["error"]["code"] == "bad_signature"


def test_a_signed_voice_webhook_answers_twiml(client, monkeypatch):
    from twilio.request_validator import RequestValidator

    url = "https://kit.soyrocoto.com/api/twilio/voice"
    form = {"CallSid": "CAsigned", "To": "+34935563000"}
    signature = RequestValidator("a-token-for-tests").compute_signature(url, form)
    response = client.post("/api/twilio/voice", data=form, headers={"X-Twilio-Signature": signature})
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/xml")
    assert "<Dial" in response.text
    assert store.get("CAsigned")["to"] == "+34935563000"


def test_the_call_refuses_every_fact_it_does_not_have(monkeypatch):
    def refusal(**patch):
        for name, value in patch.items():
            monkeypatch.setattr(config.settings, name, value, raising=False)
        with pytest.raises(RuntimeError_) as caught:
            asyncio.run(twilio_voice.place_call("+34935563000"))
        return caught.value

    assert refusal(house_number="").code == "house_number_missing"
    assert refusal(house_number="+34600000000", operator_number="").code == "operator_missing"
    monkeypatch.setattr(config.settings, "operator_number", "+34611111111", raising=False)
    with pytest.raises(RuntimeError_) as caught:
        asyncio.run(twilio_voice.place_call("935563000"))
    assert caught.value.code == "bad_number"
    assert refusal(twilio_account_sid="", twilio_auth_token="").code == "twilio_missing"


def test_custody_is_only_ever_raised_by_evidence(tmp_path, monkeypatch):
    """«The call was recorded» is not said before the recording callback; «ours» not before bytes."""
    monkeypatch.setattr(config.settings, "state_dir", tmp_path, raising=False)
    store.save({"sid": "CAcustody", "to": "+34935563000", "recordingCustody": "none"})
    assert store.get("CAcustody")["recordingCustody"] == "none"
    store.save({"sid": "CAcustody", "recordingCustody": "provider"})
    assert store.get("CAcustody")["recordingCustody"] == "provider"
    store.save({"sid": "CAcustody", "recordingCustody": "ours", "recordingPath": str(tmp_path / "r.wav")})
    assert store.get("CAcustody")["recordingCustody"] == "ours"


def test_a_call_is_found_by_its_counterpart_on_nine_digits(tmp_path, monkeypatch):
    monkeypatch.setattr(config.settings, "state_dir", tmp_path, raising=False)
    store.save({"sid": "CA1", "to": "+34935563000", "startedAt": "2026-09-04T10:00:00Z"})
    store.save({"sid": "CA2", "to": "+34935563000", "startedAt": "2026-09-04T12:00:00Z"})
    store.save({"sid": "CA3", "to": "+34911111111", "startedAt": "2026-09-04T11:00:00Z"})
    found = store.by_number("0034935563000")
    assert [call["sid"] for call in found] == ["CA2", "CA1"], "newest first"
    assert store.by_number("+34999999999") == []


def test_a_restart_cannot_lose_the_dialled_number(tmp_path, monkeypatch):
    """The Hermes caller kept this in memory and lost it on every deploy. Here it is a file."""
    monkeypatch.setattr(config.settings, "state_dir", tmp_path, raising=False)
    store.save({"sid": "CArestart", "to": "+34935563000", "direction": "outbound"})
    store.save({"sid": "CArestart", "durationSeconds": 42})
    call = store.get("CArestart")
    assert call["to"] == "+34935563000" and call["durationSeconds"] == 42


def test_the_query_string_is_part_of_what_twilio_signed(client):
    """THE DEFECT drive-199 FOUND, kept as a test.

    The outbound call's TwiML URL carries `?to=+34…`, and Twilio signs the FULL url. A validator
    built on `request.url.path` alone rejected every voice webhook the runtime itself asked for —
    and the suite did not see it, because every test here posted to a bare path. It does now.
    """
    from twilio.request_validator import RequestValidator

    url = "https://kit.soyrocoto.com/api/twilio/voice?to=%2B34935563000"
    form = {"CallSid": "CAquery", "CallStatus": "ringing"}
    signature = RequestValidator("a-token-for-tests").compute_signature(url, form)
    response = client.post("/api/twilio/voice?to=%2B34935563000", data=form,
                           headers={"X-Twilio-Signature": signature})
    assert response.status_code == 200, response.text
    assert "<Number>+34935563000</Number>" in response.text
    # And the same signature must NOT open the bare path — the query is part of the claim.
    assert client.post("/api/twilio/voice", data=form,
                       headers={"X-Twilio-Signature": signature}).status_code == 403
