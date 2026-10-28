"""Cedar phone contract proof: deterministic HTTP/stream fixtures, zero external calls."""

from pathlib import Path

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from twilio.request_validator import RequestValidator

from app import cedar_access, config, errors
from app import phone_runtime as phone
from app.phone_stream import TrackClock, update_transcript

ACCOUNT = "AC" + "a" * 32
CALL = "CA" + "1" * 32
CHILD = "CA" + "2" * 32
OTHER = "CA" + "3" * 32
SOURCE = "+51999999991"
DEST = "+51999999992"
SECOND_SOURCE = "+51999999993"
SECOND_DEST = "+51999999994"
PREFIX = "/api/cedar/phone"


@pytest.fixture
def client(monkeypatch, tmp_path: Path):
    monkeypatch.setenv("CEDAR_CHANNEL_OPERATOR_KEY", "operator-" + "x" * 40)
    for key, value in {
        "state_dir": tmp_path,
        "twilio_account_sid": ACCOUNT,
        "twilio_auth_token": "fixture-token",
        "twilio_api_key_sid": "SK" + "b" * 32,
        "twilio_api_key_secret": "fixture-key-secret-" + "x" * 32,
        "twilio_twiml_app_sid": "AP" + "c" * 32,
        "public_base": "https://demo.soyrocoto.com",
        "deepgram_key": "fixture-deepgram",
    }.items():
        monkeypatch.setattr(config.settings, key, value)
    real_client = httpx.AsyncClient
    traffic = []
    flags: dict[str, bool] = {}

    def transport(request: httpx.Request) -> httpx.Response:
        traffic.append((request.method, request.url.path))
        assert request.url.host in {"api.twilio.com", "api.eu.deepgram.com"}
        path = request.url.path
        if path.endswith("/" + ACCOUNT + ".json"):
            return httpx.Response(200, json={"sid": ACCOUNT, "status": "active"})
        if path.endswith("/IncomingPhoneNumbers.json"):
            selected = request.url.params.get("PhoneNumber", SOURCE)
            return httpx.Response(
                200,
                json={
                    "incoming_phone_numbers": [
                        {
                            "sid": "PN" + "d" * 32,
                            "phone_number": selected,
                            "capabilities": {"voice": True},
                            "voice_url": config.settings.public_base + PREFIX + "/twilio/inbound",
                            "voice_method": "POST",
                        }
                    ]
                },
            )
        if "/IncomingPhoneNumbers/" in path:
            return httpx.Response(
                200,
                json={
                    "sid": path.rsplit("/", 1)[1].removesuffix(".json"),
                    "voice_url": "",
                    "status_callback": "",
                },
            )
        if "/Applications/" in path:
            return httpx.Response(
                200,
                json={
                    "voice_url": config.settings.public_base + PREFIX + "/twilio/browser",
                    "voice_method": "POST",
                },
            )
        if path.endswith("/Calls.json"):
            if flags.get("outbound_timeout"):
                raise httpx.ReadTimeout("fixture uncertainty", request=request)
            return httpx.Response(200, json={"sid": CALL})
        if "/Calls/" in path:
            return httpx.Response(200, json={"sid": path.rsplit("/", 1)[1].removesuffix(".json")})
        if "/Recordings/" in path:
            if request.method == "DELETE":
                if flags.get("deletion_failure"):
                    return httpx.Response(503, json={})
                return httpx.Response(204)
            assert request.url.params["RequestedChannels"] == "2"
            return httpx.Response(200, content=b"fixture-WAV-two-channels")
        if request.url.host == "api.eu.deepgram.com":
            if flags.get("transcription_failure"):
                return httpx.Response(503, json={})
            assert request.url.params["mip_opt_out"] == "true"
            assert request.url.params["language"] == "es"
            return httpx.Response(
                200,
                json={
                    "results": {
                        "channels": [
                            {"alternatives": [{"transcript": "Hola"}]},
                            {"alternatives": [{"transcript": "Buenos días"}]},
                        ],
                        "utterances": [
                            {"channel": 0, "start": 0, "end": 1, "transcript": "Hola"},
                            {"channel": 1, "start": 1, "end": 2, "transcript": "Buenos días"},
                        ],
                    }
                },
            )
        raise AssertionError("unexpected provider operation")

    monkeypatch.setattr(
        phone.httpx,
        "AsyncClient",
        lambda **kwargs: real_client(transport=httpx.MockTransport(transport), **kwargs),
    )
    app = FastAPI()
    errors.install(app)
    app.include_router(cedar_access.router)
    app.include_router(phone.router)
    with TestClient(app) as client:
        client.traffic = traffic
        client.provider_flags = flags
        yield client


def workspace(client):
    body = client.post("/api/cedar/access/workspaces", json={}).json()
    return body["workspace_id"], {"Authorization": "Bearer " + body["access_token"]}


def commission(client, wid, auth, recording=False, expected_status=200):
    client.post(
        PREFIX + "/setup",
        headers=auth,
        json={
            "source_number": SOURCE,
            "fallback_number": DEST,
            "recording": "notice" if recording else "off",
            "live_transcription": recording,
        },
    )
    response = client.post(
        PREFIX + "/operator/" + wid + "/commission",
        headers={"Authorization": "Bearer operator-" + "x" * 40},
        json={
            "inbound_number": SOURCE,
            "caller_id": SOURCE,
            "allowed_destinations": [SOURCE, DEST],
            "region": "us1",
            "deepgram_region": "eu",
            "account_owner": "Fixture Rocoto account",
            "operations_approved": True,
            "recording_policy_approved": recording,
        },
    )
    assert response.status_code == expected_status, response.text


def webhook(client, path, body):
    body = {"AccountSid": ACCOUNT, **body}
    url = config.settings.public_base + PREFIX + path
    signature = RequestValidator("fixture-token").compute_signature(url, body)
    return client.post(PREFIX + path, data=body, headers={"X-Twilio-Signature": signature})


def test_scoped_setup_and_uncommissioned_calls_spend_nothing(client):
    wid, auth = workspace(client)
    assert client.get(PREFIX + "/setup").status_code == 401
    assert client.get(PREFIX + "/setup", headers=auth).json()["mode"] == "sample"
    assert (
        client.post(PREFIX + "/calls", headers=auth, json={"to": DEST, "idempotency_key": "a"}).status_code
        == 503
    )
    assert client.traffic == []
    assert client.post(PREFIX + "/operator/" + wid + "/commission", headers=auth, json={}).status_code in {
        403,
        422,
    }


def test_verified_account_browser_intent_and_first_answer(client):
    wid, auth = workspace(client)
    commission(client, wid, auth)
    _, outsider = workspace(client)
    device = client.post(PREFIX + "/token", headers=auth, json={"device_id": "desktop"}).json()
    assert device["workspaceId"] == wid and "token" in device
    create = {"to": DEST, "mode": "browser", "idempotency_key": "one"}
    intent = client.post(PREFIX + "/calls", headers=auth, json=create).json()
    assert client.post(PREFIX + "/calls", headers=auth, json=create).json() == intent
    assert (
        client.post(PREFIX + "/calls", headers=auth, json={**create, "to": "+51999999993"}).status_code == 409
    )
    body = {"CallSid": CALL, "From": "client:" + device["identity"], **intent["params"]}
    response = webhook(client, "/twilio/browser", body)
    assert response.status_code == 200 and DEST in response.text and "do-not-record" in response.text
    assert webhook(client, "/twilio/browser", {**body, "CallSid": OTHER}).status_code == 403
    assert client.get(PREFIX + "/calls/" + CALL, headers=outsider).status_code == 404
    assert client.post(PREFIX + "/twilio/status", data={"CallSid": CALL}).status_code == 403
    webhook(
        client,
        "/twilio/status",
        {"CallSid": CHILD, "ParentCallSid": CALL, "CallStatus": "in-progress", "To": DEST},
    )
    webhook(client, "/twilio/status", {"CallSid": OTHER, "ParentCallSid": CALL, "CallStatus": "canceled"})
    row = client.get(PREFIX + "/calls/" + CALL, headers=auth).json()
    assert row["status"] == "in-progress" and row["answeredBy"] == CHILD
    assert row["sessionId"] == intent["intentId"]
    webhook(
        client,
        "/twilio/complete",
        {"CallSid": CALL, "DialCallSid": CHILD, "DialCallStatus": "completed", "DialCallDuration": "31"},
    )
    webhook(client, "/twilio/status", {"CallSid": CHILD, "ParentCallSid": CALL, "CallStatus": "ringing"})
    row = client.get(PREFIX + "/calls/" + CALL, headers=auth).json()
    assert row["status"] == "completed" and row["durationSeconds"] == 31
    assert client.get(PREFIX + "/calls/active", headers=auth).json() == []
    assert "stream_token" not in row


def test_inbound_fanout_forwarding_and_scoped_saved_transcript(client):
    wid, auth = workspace(client)
    commission(client, wid, auth, recording=True)
    device = client.post(PREFIX + "/token", headers=auth, json={}).json()
    assert (
        client.post(PREFIX + "/forwarding-test", headers=auth, json={"expected_from": DEST}).status_code
        == 200
    )
    incoming = webhook(
        client, "/twilio/inbound", {"CallSid": CALL, "From": DEST, "To": SOURCE, "ForwardedFrom": SOURCE}
    )
    assert incoming.status_code == 200 and "<Client" in incoming.text and "<Number" in incoming.text
    assert device["identity"] in incoming.text and 'track="both_tracks"' in incoming.text
    assert f'<Parameter name="ParentCallSid" value="{CALL}"/>' in incoming.text
    assert client.get(PREFIX + "/setup", headers=auth).json()["readiness"]["forwarding_state"] == "verified"
    recording = {
        "CallSid": CALL,
        "RecordingSid": "RE" + "e" * 32,
        "RecordingStatus": "completed",
        "RecordingUrl": "https://attacker.invalid/steal",
    }
    assert webhook(client, "/twilio/recording", recording).status_code == 200
    row = client.get(PREFIX + "/calls/" + CALL, headers=auth).json()
    assert row["transcript"]["utterances"][0]["speaker"] == 1
    assert row["transcript"]["utterances"][1]["speaker"] == 0
    assert row["recordingCustody"] == "none" and row["recordingRemovedAt"]
    count = len(client.traffic)
    assert webhook(client, "/twilio/recording", recording).status_code == 200
    assert len(client.traffic) == count
    assert list(config.settings.state_dir.glob("recordings/*")) == []
    assert "fixture-key-secret" not in str(row)


def test_recording_policy_reaches_inbound_browser_and_mobile_call_entries(client):
    wid, auth = workspace(client)
    commission(client, wid, auth, recording=True)
    device = client.post(PREFIX + "/token", headers=auth, json={"device_id": "recording-entries"}).json()

    browser_intent = client.post(
        PREFIX + "/calls",
        headers=auth,
        json={"to": DEST, "mode": "browser", "idempotency_key": "record-browser"},
    ).json()
    browser = webhook(
        client,
        "/twilio/browser",
        {"CallSid": OTHER, "From": "client:" + device["identity"], **browser_intent["params"]},
    )
    inbound = webhook(client, "/twilio/inbound", {"CallSid": CHILD, "From": DEST, "To": SOURCE})

    mobile_intent = client.post(
        PREFIX + "/calls",
        headers=auth,
        json={"to": DEST, "mode": "phone", "idempotency_key": "record-mobile"},
    ).json()
    query = f"workspace={wid}&intent={mobile_intent['intentId']}"
    form = {"AccountSid": ACCOUNT, "CallSid": CALL}
    signature = RequestValidator("fixture-token").compute_signature(
        config.settings.public_base + PREFIX + "/twilio/bridge?" + query, form
    )
    mobile = client.post(
        PREFIX + "/twilio/bridge?" + query,
        data=form,
        headers={"X-Twilio-Signature": signature},
    )
    for response in (browser, inbound, mobile):
        assert response.status_code == 200
        assert "record-from-answer-dual" in response.text
        assert 'track="both_tracks"' in response.text


def test_track_timestamps_duplicates_and_final_deltas(client):
    clock = TrackClock()
    assert clock.media(0, b"abc") == b"abc"
    assert clock.media(0, b"abc") == b""
    assert clock.media(1, b"z") == b"\xff" * 5 + b"z"
    with pytest.raises(ValueError):
        clock.media(60000, b"x")
    wid, auth = workspace(client)
    phone.ensure_call(wid, CALL, "inbound", DEST, SOURCE)
    event = {
        "type": "Results",
        "start": 0,
        "duration": 1,
        "is_final": False,
        "channel": {"alternatives": [{"transcript": "Hola"}]},
    }
    update_transcript(wid, CALL, "inbound", event)
    update_transcript(
        wid,
        CALL,
        "inbound",
        {**event, "is_final": True, "channel": {"alternatives": [{"transcript": "Hola Rocoto"}]}},
    )
    update_transcript(wid, CALL, "inbound", event)
    row = client.get(PREFIX + "/calls/" + CALL, headers=auth).json()
    assert len(row["liveTranscript"]["utterances"]) == 1
    assert row["liveTranscript"]["utterances"][0]["text"] == "Hola Rocoto"
    assert row["liveTranscript"]["utterances"][0]["final"] is True
    outbox = client.get(PREFIX + "/calls/" + CALL + "/intake", headers=auth).json()
    assert len(outbox["events"]) == 1
    event = outbox["events"][0]
    assert event["kind"] == "final_delta" and event["mode"] == "incremental"
    assert event["evidence"][0]["text"] == "Hola Rocoto"
    assert event["proposal"] == {"kind": "order-intake", "customer_id": None, "lines": []}


def test_uncertain_phone_creation_has_one_external_effect(client):
    wid, auth = workspace(client)
    commission(client, wid, auth)
    client.provider_flags["outbound_timeout"] = True
    data = {"to": DEST, "mode": "phone", "idempotency_key": "one-only"}
    assert client.post(PREFIX + "/calls", headers=auth, json=data).status_code == 502
    assert client.post(PREFIX + "/calls", headers=auth, json=data).status_code == 409
    assert sum(path.endswith("/Calls.json") for _, path in client.traffic) == 1


def test_connection_is_bound_to_exact_account_and_receiving_number(client, monkeypatch):
    wid, auth = workspace(client)
    commission(client, wid, auth)
    other_wid, other_auth = workspace(client)
    operations = len(client.traffic)
    commission(client, other_wid, other_auth, expected_status=409)
    assert len(client.traffic) == operations
    monkeypatch.setattr(config.settings, "twilio_account_sid", "AC" + "b" * 32)
    assert client.get(PREFIX + "/setup", headers=auth).json()["readiness"]["account_verified"] is False
    assert client.post(PREFIX + "/token", headers=auth, json={}).status_code == 503
    assert len(client.traffic) == operations


def test_additional_line_keeps_first_default_until_explicit_selection(client):
    wid, auth = workspace(client)
    commission(client, wid, auth)
    original = client.get(PREFIX + "/setup", headers=auth).json()
    first_line = original["default_line_id"]
    added = client.post(
        PREFIX + "/lines",
        headers=auth,
        json={
            "source_number": SECOND_SOURCE,
            "fallback_number": SECOND_DEST,
            "recording": "notice",
            "live_transcription": True,
        },
    ).json()
    assert added["mode"] == "prepared" and added["line_id"] != first_line
    response = client.post(
        PREFIX + "/operator/" + wid + "/commission",
        headers={"Authorization": "Bearer operator-" + "x" * 40},
        json={
            "line_id": added["line_id"],
            "inbound_number": SECOND_SOURCE,
            "caller_id": SECOND_SOURCE,
            "allowed_destinations": [SECOND_SOURCE, SECOND_DEST],
            "region": "us1",
            "deepgram_region": "eu",
            "account_owner": "Fixture Rocoto account",
            "operations_approved": True,
            "recording_policy_approved": True,
        },
    )
    assert response.status_code == 200, response.text
    setup = response.json()
    assert setup["default_line_id"] == first_line
    assert len(setup["lines"]) == 2

    device = client.post(PREFIX + "/token", headers=auth, json={"device_id": "two-lines"}).json()
    intent = client.post(
        PREFIX + "/calls",
        headers=auth,
        json={"to": DEST, "mode": "browser", "idempotency_key": "first-default"},
    ).json()
    selected = client.post(
        PREFIX + f"/lines/{added['line_id']}/default", headers=auth, json={}
    ).json()
    assert selected["default_line_id"] == added["line_id"]
    first = webhook(
        client,
        "/twilio/browser",
        {"CallSid": CALL, "From": "client:" + device["identity"], **intent["params"]},
    )
    assert f'callerId="{SOURCE}"' in first.text
    assert client.get(PREFIX + "/calls/" + CALL, headers=auth).json()["lineId"] == first_line
    intent = client.post(
        PREFIX + "/calls",
        headers=auth,
        json={"to": SECOND_DEST, "mode": "browser", "idempotency_key": "second-default"},
    ).json()
    second = webhook(
        client,
        "/twilio/browser",
        {"CallSid": OTHER, "From": "client:" + device["identity"], **intent["params"]},
    )
    assert f'callerId="{SECOND_SOURCE}"' in second.text
    assert "record-from-answer-dual" in second.text and 'track="both_tracks"' in second.text

    incoming = webhook(
        client,
        "/twilio/inbound",
        {"CallSid": CHILD, "From": DEST, "To": SOURCE, "ForwardedFrom": SOURCE},
    )
    assert incoming.status_code == 200 and f'callerId="{SOURCE}"' in incoming.text
    assert client.get(PREFIX + "/calls/" + CHILD, headers=auth).json()["lineId"] == first_line


def test_duplicate_inbound_line_is_rejected_before_provider_work(client):
    wid, auth = workspace(client)
    commission(client, wid, auth)
    added = client.post(
        PREFIX + "/lines",
        headers=auth,
        json={
            "source_number": SECOND_SOURCE,
            "fallback_number": SECOND_DEST,
            "recording": "off",
            "live_transcription": False,
        },
    ).json()
    operations = len(client.traffic)
    response = client.post(
        PREFIX + "/operator/" + wid + "/commission",
        headers={"Authorization": "Bearer operator-" + "x" * 40},
        json={
            "line_id": added["line_id"],
            "inbound_number": SOURCE,
            "caller_id": SECOND_SOURCE,
            "allowed_destinations": [SECOND_SOURCE, SECOND_DEST],
            "region": "us1",
            "deepgram_region": "eu",
            "account_owner": "Fixture Rocoto account",
            "operations_approved": True,
        },
    )
    assert response.status_code == 409
    assert len(client.traffic) == operations


def test_disconnect_ends_line_calls_clears_webhook_and_preserves_history(client):
    wid, auth = workspace(client)
    commission(client, wid, auth)
    line_id = client.get(PREFIX + "/setup", headers=auth).json()["default_line_id"]
    device = client.post(PREFIX + "/token", headers=auth, json={"device_id": "disconnect"}).json()
    intent = client.post(
        PREFIX + "/calls",
        headers=auth,
        json={"to": DEST, "mode": "browser", "idempotency_key": "disconnect-call"},
    ).json()
    assert webhook(
        client,
        "/twilio/browser",
        {"CallSid": CALL, "From": "client:" + device["identity"], **intent["params"]},
    ).status_code == 200
    _, outsider = workspace(client)
    endpoint = PREFIX + "/lines/" + line_id
    assert client.delete(endpoint, headers=outsider).status_code == 404
    result = client.delete(endpoint, headers=auth)
    assert result.status_code == 200 and result.json()["lines"] == []
    saved = client.get(PREFIX + "/calls/" + CALL, headers=auth).json()
    assert saved["status"] == "completed" and saved["endedAt"]
    assert client.post(PREFIX + "/token", headers=auth, json={}).status_code == 503
    assert phone.db().number_workspace(SOURCE) is None
    assert (
        webhook(client, "/twilio/inbound", {"CallSid": OTHER, "From": DEST, "To": SOURCE}).status_code
        == 404
    )
    assert ("POST", f"/2010-04-01/Accounts/{ACCOUNT}/Calls/{CALL}.json") in client.traffic
    assert (
        "POST",
        f"/2010-04-01/Accounts/{ACCOUNT}/IncomingPhoneNumbers/{'PN' + 'd' * 32}.json",
    ) in client.traffic


def test_single_line_saved_state_upgrades_without_changing_its_default():
    from app.phone_store import PhoneStore

    legacy = PhoneStore.empty("legacy-workspace")
    legacy.pop("lines")
    legacy.pop("default_line")
    legacy["setup"] = {
        "source_number": SOURCE,
        "fallback_number": DEST,
        "recording": "notice",
        "live_transcription": True,
    }
    legacy["connection"] = {
        "inbound_number": SOURCE,
        "caller_id": SOURCE,
        "account_sid": ACCOUNT,
        "account_verified": True,
    }
    legacy["checks"] = {"forwarding_state": "verified"}
    upgraded = PhoneStore.upgrade(legacy)
    assert upgraded["default_line"] in upgraded["lines"]
    line = upgraded["lines"][upgraded["default_line"]]
    assert line["setup"] == upgraded["setup"]
    assert line["connection"] == upgraded["connection"]
    assert line["checks"] == upgraded["checks"]


def test_recording_retry_recovers_durably_and_preserves_historical_intake(client):
    import asyncio
    import time

    from app.phone_store import PhoneStore

    wid, auth = workspace(client)
    commission(client, wid, auth, recording=True)
    webhook(client, "/twilio/inbound", {"CallSid": CALL, "From": DEST, "To": SOURCE})
    update_transcript(
        wid,
        CALL,
        "inbound",
        {
            "type": "Results",
            "start": 0,
            "duration": 1,
            "is_final": True,
            "channel": {"alternatives": [{"transcript": "Dos cajas"}]},
        },
    )
    client.provider_flags["transcription_failure"] = True
    recording = {"CallSid": CALL, "RecordingSid": "RE" + "e" * 32, "RecordingStatus": "completed"}
    assert webhook(client, "/twilio/recording", recording).status_code == 200
    rebuilt = PhoneStore(config.settings.state_dir)
    assert rebuilt.read(wid)["calls"][CALL]["recording_job"] == "retry"
    attempts = len(client.traffic)
    assert webhook(client, "/twilio/recording", recording).status_code == 200
    assert len(client.traffic) == attempts
    client.provider_flags["transcription_failure"] = False
    # A crashed worker's persisted lease expires; the fresh worker completes the same job.
    rebuilt.change(
        wid,
        lambda s: s["calls"][CALL].update(
            recording_job="processing",
            recording_started=time.time() - 200,
            recording_retry_at=time.time() - 1,
        ),
    )
    assert rebuilt.due_recordings(time.time()) == [(wid, CALL)]
    asyncio.run(phone.retry_due_recordings())
    assert rebuilt.read(wid)["calls"][CALL]["recording_job"] == "done"
    assert rebuilt.due_recordings(time.time()) == []
    first = client.get(PREFIX + "/calls/" + CALL + "/intake?limit=1", headers=auth).json()
    assert first["has_more"] and first["events"][0]["kind"] == "final_delta"
    second = client.get(PREFIX + "/calls/" + CALL + "/intake?after=1", headers=auth).json()
    assert second["events"][0]["mode"] == "historical"
    assert second["events"][0]["kind"] == "full_transcript"
    assert second["events"][0]["evidence"][0]["speaker"] == 1
    assert second["next_cursor"] == 2 and not second["has_more"]
    _, outsider = workspace(client)
    assert client.get(PREFIX + "/calls/" + CALL + "/intake", headers=outsider).status_code == 404


def test_scoped_audio_deletion_retry_and_transcript_expiry(client, monkeypatch):
    import asyncio
    from datetime import datetime, timedelta, timezone

    from app.phone_retention import cleanup_workspace

    wid, auth = workspace(client)
    commission(client, wid, auth, recording=True)
    webhook(client, "/twilio/inbound", {"CallSid": CALL, "From": DEST, "To": SOURCE})
    client.provider_flags["deletion_failure"] = True
    recording = {"CallSid": CALL, "RecordingSid": "RE" + "e" * 32, "RecordingStatus": "completed"}
    assert webhook(client, "/twilio/recording", recording).status_code == 200
    row = phone.find_call(wid, CALL)
    assert row["recording_job"] == "done" and row["recordingCustody"] == "provider"
    transcription_count = sum(path == "/v1/listen" for _, path in client.traffic)
    client.provider_flags["deletion_failure"] = False
    asyncio.run(cleanup_workspace(wid))
    assert phone.find_call(wid, CALL)["recordingCustody"] == "none"
    assert sum(path == "/v1/listen" for _, path in client.traffic) == transcription_count
    assert client.post(PREFIX + "/calls/" + CALL + "/transcribe", headers=auth).status_code == 409
    phone.db().change(
        wid,
        lambda s: s["calls"][CALL].update(
            startedAt=(datetime.now(timezone.utc) - timedelta(days=366)).isoformat(),
        ),
    )
    asyncio.run(cleanup_workspace(wid))
    row = phone.find_call(wid, CALL)
    assert "transcript" not in row and row["transcriptRemovedAt"]
    assert row["intake_events"][0]["evidence"] == []
    assert row["intake_events"][0]["source_ids"]
    monkeypatch.setattr(config.settings, "call_record_retention_days", 365)
    asyncio.run(cleanup_workspace(wid))
    assert client.get(PREFIX + "/calls/" + CALL, headers=auth).status_code == 404
    assert webhook(client, "/twilio/recording", recording).status_code == 200
    assert phone.db().read(wid)["calls"][CALL]["deletedAt"]


def test_recording_without_transcript_expires_on_audio_clock(client):
    import asyncio
    from datetime import datetime, timedelta, timezone

    from app.phone_retention import cleanup_workspace

    wid, auth = workspace(client)
    commission(client, wid, auth, recording=True)
    phone.ensure_call(wid, CALL, "inbound", DEST, SOURCE)
    phone.db().change(
        wid,
        lambda s: s["calls"][CALL].update(
            startedAt=(datetime.now(timezone.utc) - timedelta(days=31)).isoformat(),
            recording_id="RE" + "e" * 32,
            recording_job="failed",
            recordingCustody="provider",
        ),
    )
    asyncio.run(cleanup_workspace(wid))
    row = phone.find_call(wid, CALL)
    assert row["recordingCustody"] == "none" and row["recordingRemovedAt"]
    assert all(path != "/v1/listen" for _, path in client.traffic)


def test_authenticated_live_websocket_two_tracks_and_final_updates(client, monkeypatch):
    import asyncio
    import base64
    import json

    from starlette.websockets import WebSocketDisconnect

    from app import phone_stream

    sockets = []

    class FixtureStream:
        def __init__(self):
            self.events = asyncio.Queue()
            self.audio = []

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        def __aiter__(self):
            return self

        async def __anext__(self):
            result = await self.events.get()
            if result is None:
                raise StopAsyncIteration
            return result

        async def send(self, value):
            if isinstance(value, bytes):
                self.audio.append(value)
                await self.events.put(
                    json.dumps(
                        {
                            "type": "Results",
                            "start": 0,
                            "duration": 1,
                            "is_final": True,
                            "channel": {"alternatives": [{"transcript": "Hola en directo"}]},
                        }
                    )
                )
            elif json.loads(value)["type"] == "CloseStream":
                await self.events.put(None)

    def connect(url, **kwargs):
        assert url.startswith("wss://api.eu.deepgram.com/v1/listen?") and "mip_opt_out=true" in url
        assert kwargs["additional_headers"]["Authorization"] == "Token fixture-deepgram"
        socket = FixtureStream()
        sockets.append(socket)
        return socket

    monkeypatch.setattr(phone_stream, "connect", connect)
    with pytest.raises(WebSocketDisconnect), client.websocket_connect(PREFIX + "/twilio/media"):
        pass
    assert sockets == []
    wid, auth = workspace(client)
    commission(client, wid, auth, recording=True)
    webhook(client, "/twilio/inbound", {"CallSid": CALL, "From": DEST, "To": SOURCE})
    token = phone.db().read(wid)["calls"][CALL]["stream_token"]
    signature = RequestValidator("fixture-token").compute_signature(
        config.settings.public_base + PREFIX + "/twilio/media", {}
    )
    with client.websocket_connect(
        PREFIX + "/twilio/media", headers={"X-Twilio-Signature": signature}
    ) as websocket:
        websocket.send_json({"event": "connected"})
        websocket.send_json(
            {
                "event": "start",
                "start": {
                    "accountSid": ACCOUNT,
                    "callSid": CALL,
                    "streamSid": "MZfixture",
                    "customParameters": {"workspace": wid, "token": token},
                    "mediaFormat": {"encoding": "audio/x-mulaw", "sampleRate": 8000, "channels": 1},
                },
            }
        )
        for track in ("inbound", "outbound"):
            websocket.send_json(
                {
                    "event": "media",
                    "streamSid": "MZfixture",
                    "media": {
                        "track": track,
                        "timestamp": "0",
                        "payload": base64.b64encode(b"\xff" * 160).decode(),
                    },
                }
            )
        websocket.send_json({"event": "stop"})
        with pytest.raises(WebSocketDisconnect):
            websocket.receive_text()
    result = client.get(PREFIX + "/calls/" + CALL, headers=auth).json()
    turns = result["liveTranscript"]["utterances"]
    assert len(turns) == 2 and all(turn["final"] for turn in turns)
    assert {turn["speaker"] for turn in turns} == {0, 1}
    assert "transcript" not in result
    assert len(sockets) == 2 and all(len(socket.audio) == 1 for socket in sockets)


ISSUED = "+441234567890"


def issuance_transport(client, monkeypatch, *, limit=2, gb_rejects=False):
    """Extend the fixture provider with number search and purchase; every purchase is recorded."""
    from httpx._client import AsyncClient as RealAsyncClient

    monkeypatch.setattr(config.settings, "twilio_number_issue_limit", limit)
    purchases: list[dict] = []
    real_client = RealAsyncClient

    def transport(request: httpx.Request) -> httpx.Response:
        import base64

        client.traffic.append((request.method, request.url.path))
        path = request.url.path
        user = base64.b64decode(request.headers["authorization"].split()[1]).decode().split(":")[0]
        if path.endswith("/" + ACCOUNT + ".json"):
            # The Account resource refuses a Standard API key; the runtime reads it as the account.
            assert user == ACCOUNT, user
            return httpx.Response(200, json={"sid": ACCOUNT, "status": "active"})
        assert user.startswith("SK"), user
        if "/Applications/" in path:
            return httpx.Response(
                200,
                json={
                    "voice_url": config.settings.public_base + PREFIX + "/twilio/browser",
                    "voice_method": "POST",
                },
            )
        if "/AvailablePhoneNumbers/FR/" in path:
            return httpx.Response(200, json={"available_phone_numbers": [{"phone_number": "+33123456789"}]})
        if "/AvailablePhoneNumbers/GB/Local" in path:
            return httpx.Response(200, json={"available_phone_numbers": [{"phone_number": ISSUED}]})
        if "/AvailablePhoneNumbers/" in path:
            return httpx.Response(404, json={"code": 20404})
        if path.endswith("/IncomingPhoneNumbers.json") and request.method == "GET":
            tag = request.url.params.get("FriendlyName", "")
            owned = [p for p in purchases if p["friendly_name"] == tag]
            return httpx.Response(200, json={"incoming_phone_numbers": owned})
        if path.endswith("/IncomingPhoneNumbers.json") and request.method == "POST":
            form = dict(httpx.QueryParams(request.content.decode()))
            rejected = gb_rejects and form["PhoneNumber"].startswith("+44")
            if form["PhoneNumber"].startswith("+33") or rejected:
                return httpx.Response(400, json={"code": 21649, "message": "regulatory bundle required"})
            row = {
                "sid": "PN" + "f" * 32,
                "phone_number": form["PhoneNumber"],
                "friendly_name": form["FriendlyName"],
                "capabilities": {"voice": True},
                "voice_url": form["VoiceUrl"],
                "status_callback": form["StatusCallback"],
            }
            purchases.append(row)
            return httpx.Response(201, json=row)
        if "/IncomingPhoneNumbers/" in path:
            sid = path.rsplit("/", 1)[1].removesuffix(".json")
            return httpx.Response(200, json={"sid": sid, "voice_url": "", "status_callback": ""})
        if path.endswith("/Calls.json"):
            return httpx.Response(200, json={"sid": CALL})
        raise AssertionError("unexpected provider operation " + path)

    monkeypatch.setattr(
        phone.httpx,
        "AsyncClient",
        lambda **kwargs: real_client(transport=httpx.MockTransport(transport), **kwargs),
    )
    return purchases


def grant(client, wid, **extra):
    return client.post(
        PREFIX + "/operator/" + wid + "/commission",
        headers={"Authorization": "Bearer operator-" + "x" * 40},
        json={
            "issue_number": True,
            "number_countries": ["FR", "GB", "US"],
            "allowed_destinations": [DEST, SECOND_DEST],
            "region": "us1",
            "deepgram_region": "eu",
            "account_owner": "Fixture Rocoto account",
            "operations_approved": True,
            "recording_policy_approved": True,
            **extra,
        },
    )


def test_issued_number_arrives_at_setup_once_and_is_the_caller_id(client, monkeypatch):
    purchases = issuance_transport(client, monkeypatch)
    wid, auth = workspace(client)
    assert grant(client, wid, inbound_number=SOURCE).status_code == 422
    assert grant(client, wid, number_countries=[]).status_code == 422
    assert grant(client, wid, notice="audio").status_code == 422
    granted = grant(client, wid)
    assert granted.status_code == 200 and granted.json()["mode"] == "sample" and purchases == []
    setup = {
        "source_number": SOURCE, "fallback_number": DEST, "recording": "notice", "live_transcription": False,
    }
    line = client.post(PREFIX + "/lines", headers=auth, json=setup).json()
    assert line["mode"] == "commissioned"
    assert line["readiness"]["inbound_number"] == ISSUED and line["readiness"]["caller_id"] == ISSUED
    assert line["readiness"]["caller_id_verified"] is True and line["readiness"]["browser_ready"] is True
    assert line["checks"]["number"]["issued"] is True and line["checks"]["number"]["country"] == "GB"
    assert [p["phone_number"] for p in purchases] == [ISSUED]
    assert purchases[0]["voice_url"] == config.settings.public_base + PREFIX + "/twilio/inbound"
    # The French attempt was recorded and skipped; the same setup again buys nothing more.
    again = client.post(PREFIX + "/lines", headers=auth, json=setup).json()
    assert again["line_id"] == line["line_id"] and len(purchases) == 1
    evidence = client.get(PREFIX + "/setup", headers=auth).json()
    assert evidence["mode"] == "commissioned" and evidence["default_line_id"] == line["line_id"]
    # Outgoing calls carry the issued number as caller ID without a verification step.
    device = client.post(PREFIX + "/token", headers=auth, json={"device_id": "desk"}).json()
    create = {"to": DEST, "mode": "browser", "idempotency_key": "x"}
    intent = client.post(PREFIX + "/calls", headers=auth, json=create).json()
    leg = {"CallSid": CALL, "From": "client:" + device["identity"], **intent["params"]}
    response = webhook(client, "/twilio/browser", leg)
    assert response.status_code == 200 and f'callerId="{ISSUED}"' in response.text
    # No notice by default, and the call is still recorded on both tracks.
    assert "<Say" not in response.text and "<Play" not in response.text
    assert "record-from-answer-dual" in response.text
    stranger = {"to": "+51999999999", "mode": "browser", "idempotency_key": "y"}
    assert client.post(PREFIX + "/calls", headers=auth, json=stranger).status_code == 409


def test_issuance_respects_the_runtime_limit_and_records_refusals(client, monkeypatch):
    purchases = issuance_transport(client, monkeypatch, limit=0)
    wid, auth = workspace(client)
    assert grant(client, wid).status_code == 503
    monkeypatch.setattr(config.settings, "twilio_number_issue_limit", 1)
    assert grant(client, wid).status_code == 200
    second, second_auth = workspace(client)
    assert grant(client, second).status_code == 200
    setup = {
        "source_number": SOURCE, "fallback_number": DEST, "recording": "off", "live_transcription": False,
    }
    assert client.post(PREFIX + "/lines", headers=auth, json=setup).json()["mode"] == "commissioned"
    second_setup = {**setup, "source_number": SECOND_SOURCE}
    refused = client.post(PREFIX + "/lines", headers=second_auth, json=second_setup)
    assert refused.status_code == 503 and len(purchases) == 1
    assert client.get(PREFIX + "/setup", headers=second_auth).json()["mode"] == "sample"


def test_unavailable_countries_leave_the_line_prepared_with_attempts(client, monkeypatch):
    purchases = issuance_transport(client, monkeypatch, gb_rejects=True)
    wid, auth = workspace(client)
    assert grant(client, wid, number_countries=["FR", "GB"]).status_code == 200
    setup = {
        "source_number": SOURCE, "fallback_number": DEST, "recording": "off", "live_transcription": False,
    }
    assert client.post(PREFIX + "/lines", headers=auth, json=setup).status_code == 502
    evidence = client.get(PREFIX + "/setup", headers=auth).json()
    line = evidence["lines"][0]
    assert line["mode"] == "prepared" and line["checks"]["number"]["issued"] is False
    assert {a["country"] for a in line["checks"]["number"]["attempts"]} == {"FR", "GB"}
    assert purchases == []


def test_notice_modes_reach_every_recorded_leg(client, monkeypatch):
    issuance_transport(client, monkeypatch)
    wid, auth = workspace(client)
    audio = "https://cdn.example/notice.mp3"
    assert grant(client, wid, notice="audio", notice_audio_url=audio).status_code == 200
    setup = {
        "source_number": SOURCE, "fallback_number": DEST, "recording": "notice", "live_transcription": False,
    }
    line = client.post(PREFIX + "/lines", headers=auth, json=setup).json()
    device = client.post(PREFIX + "/token", headers=auth, json={"device_id": "desk"}).json()
    inbound = webhook(client, "/twilio/inbound", {"CallSid": CALL, "From": DEST, "To": ISSUED})
    assert inbound.status_code == 200
    assert "<Play>https://cdn.example/notice.mp3</Play>" in inbound.text and "<Say" not in inbound.text
    assert device["identity"] in inbound.text and PREFIX + "/twilio/notice" in inbound.text
    leg = webhook(client, "/twilio/notice", {"CallSid": CHILD, "ParentCallSid": CALL})
    assert leg.status_code == 200 and "<Play>https://cdn.example/notice.mp3</Play>" in leg.text
    assert line["readiness"]["transcription_ready"] is True
