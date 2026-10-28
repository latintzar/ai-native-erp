"""test_join.py — the /join doors (JOIN-PAGE-SPEC-2026-09-04.md §2 Verification).

    cd backend && python3 -m pytest test_join.py -q

Every seam join.py owns is replaced here, so the suite runs with no Postgres, no Deepgram key, no
Resend and no Dover: `_transcribe` (the ASR), `_db_insert` / `_db_set_dover` (the row), `_mail_send`
(Resend) and `_http_post` (Dover). `MEDIA_ROOT` is pointed at a tmp directory, so a test never goes
near `/opt/rocoto/media`.

The router is mounted on a bare FastAPI app rather than importing `app.py`: these three endpoints
are the unit, and importing the whole service would drag in Postgres, the model clients and the
boot-time media mkdir that caused the 2026-08-13 incident in the first place.

WHAT IS ACTUALLY GUARDED HERE — the four sentences the product makes to a stranger:
  · a recording that arrives is STORED and comes back byte-for-byte on its own URL
  · a recording too big to be honest never lands
  · a finished application reaches the row AND Peter's inbox, with the audio link in it
  · a transcription outage costs the transcript, never the application
"""
from __future__ import annotations

import os
import re
import sys

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import join  # noqa: E402

# A minimal Ogg header: 'OggS' is what `_sniff_audio` reads, and ffprobe reads the rest and refuses
# — which is the point of the fixture. Real containers are exercised in the live E2E, not here.
OGG = b"OggS" + b"\x00" * 60
WEBM = b"\x1a\x45\xdf\xa3" + b"\x00" * 60


@pytest.fixture()
def rig(tmp_path, monkeypatch):
    """A clean process state, a private media root, and every outbound rail replaced."""
    join._HITS.clear()
    monkeypatch.setattr(join, "MEDIA_ROOT", tmp_path / "join")
    monkeypatch.setattr(join, "_client_ip", lambda request: "203.0.113.7")
    monkeypatch.setattr(join, "PUBLIC_API_BASE", "https://api.soyrocoto.com")

    rows: list[dict] = []
    mails: list[tuple] = []
    posts: list[tuple] = []
    dover_updates: list[tuple] = []
    said = {"text": "I built the order pipeline for a fish market and it never lost a line."}

    async def fake_insert(row):
        rows.append(row)

    async def fake_mail(to, subject, html):
        mails.append((to, subject, html))
        return {"ok": True, "id": "test"}

    async def fake_post(url, headers, payload):
        posts.append((url, headers, payload))
        return 200, '{"id": "dover_abc"}'

    async def fake_set_dover(row_id, dover_id, dover_error):
        dover_updates.append((row_id, dover_id, dover_error))

    async def fake_transcribe(audio, mime):
        if said.get("raises"):
            raise RuntimeError("deepgram is down")
        return said["text"]

    monkeypatch.setattr(join, "_db_insert", fake_insert)
    monkeypatch.setattr(join, "_mail_send", fake_mail)
    monkeypatch.setattr(join, "_http_post", fake_post)
    monkeypatch.setattr(join, "_db_set_dover", fake_set_dover)
    monkeypatch.setattr(join, "_transcribe", fake_transcribe)
    monkeypatch.setattr(join.config, "DOVER_API_KEY", "", raising=False)
    monkeypatch.setattr(join.config, "DOVER_JOB_ID", "", raising=False)
    monkeypatch.setattr(join.config, "NOTIFY_EMAIL", "peter@leo.casa", raising=False)

    app = FastAPI()
    app.include_router(join.router)
    with TestClient(app) as client:
        yield {"client": client, "rows": rows, "mails": mails, "posts": posts,
               "dover": dover_updates, "said": said, "media": tmp_path / "join"}


def _upload(client, data=OGG, field="proud", duration_ms="4200"):
    return client.post("/api/join/voice",
                       data={"session_id": "s_test", "field": field, "lang": "en",
                             "duration_ms": duration_ms},
                       files={"audio": ("note.ogg", data, "audio/ogg")})


GOOD = {
    "name": "Test Applicant",
    "github": "https://github.com/testapplicant",
    "linkedin": "https://www.linkedin.com/in/testapplicant",
    "other": "",
    "proud": "",
    "location": "Lisbon, and Barcelona works for me.",
    "email": "test-join@leo.casa",
    "phone": "+34 600 000 000",
}


def _submit(client, *, answers=None, voices=None, transcripts=None):
    body = {"session_id": "s_test", "lang": "en",
            "answers": dict(GOOD, **(answers or {})),
            "voices": voices or {}, "transcripts": transcripts or {}}
    return client.post("/api/join/submit", json=body)


# ── the recording ──────────────────────────────────────────────────────────────────────────────────
def test_voice_upload_stores_and_serves(rig):
    client = rig["client"]
    r = _upload(client)
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["ok"] is True
    assert re.fullmatch(r"[0-9a-f]{32}", out["voice_id"]), out
    assert out["transcript"] == rig["said"]["text"]
    # ffprobe cannot read the fixture's fake container, so the client's own claim carries — the
    # documented fallback, and the one that fires for a streaming MediaRecorder webm.
    assert out["duration_ms"] == 4200
    assert out["url"] == f"/api/join/audio/{out['voice_id']}"

    stored = rig["media"] / f"{out['voice_id']}.ogg"
    assert stored.is_file() and stored.read_bytes() == OGG

    got = client.get(out["url"])
    assert got.status_code == 200
    assert got.content == OGG
    assert got.headers["content-type"].startswith("audio/ogg")
    assert "private" in got.headers.get("cache-control", "")


def test_voice_oversize_refused(rig):
    client = rig["client"]
    fat = WEBM + b"\x00" * (join.MAX_AUDIO_BYTES + 1024)
    r = client.post("/api/join/voice",
                    data={"session_id": "s_test", "field": "proud", "lang": "en",
                          "duration_ms": "9000"},
                    files={"audio": ("note.webm", fat, "audio/webm")})
    assert r.status_code == 413, r.text
    assert not list((rig["media"]).glob("*")) if rig["media"].exists() else True


def test_voice_over_three_minutes_refused(rig):
    """No probe-able duration in the container, so the client's claim is what there is to check —
    and a claim over the cap is refused, with the bytes removed again."""
    client = rig["client"]
    r = _upload(client, duration_ms=str(181 * 1000))
    assert r.status_code == 413, r.text
    assert r.json()["error"] == "audio_long"
    assert not list(rig["media"].glob("*"))


def test_deepgram_failure_still_returns_ok(rig):
    client = rig["client"]
    rig["said"]["raises"] = True
    r = _upload(client)
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["ok"] is True and out["transcript"] == ""
    # the answer survives as audio: the file is there and it serves
    assert client.get(out["url"]).status_code == 200


def test_unknown_audio_type_refused(rig):
    client = rig["client"]
    r = client.post("/api/join/voice",
                    data={"session_id": "s_test", "field": "proud", "lang": "en",
                          "duration_ms": "1000"},
                    files={"audio": ("note.exe", b"MZ" + b"\x00" * 60, "audio/ogg")})
    assert r.status_code == 415, r.text


# ── the application ────────────────────────────────────────────────────────────────────────────────
def test_submit_happy_path_writes_row_and_mails_the_audio_link(rig):
    client = rig["client"]
    up = _upload(client).json()

    r = _submit(client, voices={"proud": up["voice_id"]},
                transcripts={"proud": rig["said"]["text"]})
    assert r.status_code == 200, r.text
    assert r.json()["ok"] is True and r.json()["id"].startswith("join_")

    assert len(rig["rows"]) == 1
    row = rig["rows"][0]
    assert row["name"] == "Test Applicant"
    assert row["phone"] == "+34 600 000 000"
    assert row["github"] == GOOD["github"] and row["linkedin"] == GOOD["linkedin"]
    # the voices json carries the four things Peter needs per recording
    assert set(row["voices"]) == {"proud"}
    v = row["voices"]["proud"]
    assert v["voice_id"] == up["voice_id"]
    assert v["url"] == f"/api/join/audio/{up['voice_id']}"
    assert v["transcript"] == rig["said"]["text"]
    # the duration comes from the note written beside the file at upload time — ffprobe cannot
    # read a streaming MediaRecorder webm, and /submit is handed voice ids, never durations
    assert v["duration_ms"] == 4200
    # the ordered Q/A list, questions included, text and voice distinguished
    sheet = row["transcript"]
    assert [i["field"] for i in sheet] == ["name", "github", "linkedin", "proud", "location",
                                           "email", "phone"]
    assert sheet[3]["kind"] == "voice" and sheet[3]["answer"] == rig["said"]["text"]
    assert sheet[4]["kind"] == "text"
    # §1's columns stay filled, so anything reading the old shape still sees the application
    assert row["why"] == rig["said"]["text"] and row["link"] == GOOD["github"]

    to, subject, html = rig["mails"][0]
    assert to == "peter@leo.casa"
    assert subject == "Technical co-founder application: Test Applicant"
    assert f"https://api.soyrocoto.com/api/join/audio/{up['voice_id']}" in html
    assert "Listen (0:04)" in html
    assert rig["said"]["text"] in html
    assert GOOD["location"] in html


def test_submit_keeps_the_uploads_transcript_when_the_person_clears_it(rig):
    client = rig["client"]
    up = _upload(client).json()
    r = _submit(client, voices={"proud": up["voice_id"]}, transcripts={"proud": ""})
    assert r.status_code == 200, r.text
    assert rig["rows"][0]["voices"]["proud"]["transcript"] == rig["said"]["text"]


def test_submit_missing_phone_refused(rig):
    client = rig["client"]
    r = _submit(client, answers={"phone": ""}, voices={},
                transcripts={})
    assert r.status_code == 400, r.text
    assert r.json()["error"] == "missing_phone"
    assert rig["rows"] == [] and rig["mails"] == []


def test_submit_phone_shape_refused(rig):
    r = _submit(rig["client"], answers={"phone": "call me maybe"})
    assert r.status_code == 400 and r.json()["error"] == "phone"


def test_submit_junk_refused(rig):
    client = rig["client"]
    r = _submit(client, answers={"proud": "..."})
    assert r.status_code == 400, r.text
    assert r.json()["error"] == "junk_proud"
    assert rig["rows"] == [] and rig["mails"] == []


def test_submit_needs_words_or_a_voice_for_proud(rig):
    r = _submit(rig["client"])
    assert r.status_code == 400 and r.json()["error"] == "missing_proud"


def test_submit_ignores_a_voice_id_that_is_not_on_disk(rig):
    """A named recording is only an answer when the bytes are there: nothing else may be asserted
    into the row from the outside."""
    client = rig["client"]
    r = _submit(client, voices={"proud": "f" * 32}, transcripts={"proud": "trust me"})
    assert r.status_code == 400 and r.json()["error"] == "missing_proud"


def test_submit_pushes_dover_when_the_env_is_there(rig, monkeypatch):
    client = rig["client"]
    monkeypatch.setattr(join.config, "DOVER_API_KEY", "k_test", raising=False)
    monkeypatch.setattr(join.config, "DOVER_JOB_ID", "job_test", raising=False)
    up = _upload(client).json()
    r = _submit(client, voices={"proud": up["voice_id"]},
                transcripts={"proud": rig["said"]["text"]})
    assert r.status_code == 200, r.text
    assert len(rig["posts"]) == 1
    url, headers, payload = rig["posts"][0]
    assert url == join.DOVER_URL and headers["Authorization"] == "Bearer k_test"
    assert payload["candidate_first_name"] == "Test" and payload["candidate_last_name"] == "Applicant"
    assert payload["candidate_email"] == "test-join@leo.casa"
    assert payload["candidate_linkedin_url"] == GOOD["linkedin"]
    assert rig["said"]["text"] in payload["additional_comments"]
    assert f"https://api.soyrocoto.com/api/join/audio/{up['voice_id']}" in payload["additional_comments"]
    assert rig["dover"] and rig["dover"][0][1] == "dover_abc"


def test_dover_skipped_without_env(rig):
    client = rig["client"]
    assert _submit(client, answers={"proud": "I shipped a thing that mattered."}).status_code == 200
    assert rig["posts"] == []


def test_health(rig):
    assert rig["client"].get("/api/join/health").json() == {"ok": True}


def test_github_login_parses_the_shapes_people_paste():
    assert join.github_login("ada") == "ada"
    assert join.github_login("@ada") == "ada"
    assert join.github_login("https://github.com/ada/engine") == "ada"
    assert join.github_login("github.com/Ada-L/") == "Ada-L"
    assert join.github_login("not a handle!") is None
    assert join.github_login("") is None


def test_github_readback_returns_the_confirm_facts(rig, monkeypatch):
    join._GH_CACHE.clear()
    calls = []

    async def fake_get(url):
        calls.append(url)
        if url.endswith("/users/ada"):
            return 200, {"login": "ada", "name": "Ada Lovelace", "bio": "engines", "company": "",
                         "location": "London", "public_repos": 3, "followers": 12,
                         "html_url": "https://github.com/ada"}
        return 200, [
            {"name": "engine", "language": "TypeScript", "stargazers_count": 312, "fork": False,
             "html_url": "https://github.com/ada/engine"},
            {"name": "notes", "language": "Python", "stargazers_count": 4, "fork": False,
             "html_url": "https://github.com/ada/notes"},
            {"name": "linux", "language": "C", "stargazers_count": 999, "fork": True,
             "html_url": "https://github.com/ada/linux"},
        ]

    monkeypatch.setattr(join, "_github_get", fake_get)
    client = rig["client"]
    out = client.get("/api/join/github?login=https://github.com/ada").json()
    assert out["ok"] and out["name"] == "Ada Lovelace" and out["public_repos"] == 3
    assert out["top"][0] == {"name": "engine", "language": "TypeScript", "stars": 312,
                             "url": "https://github.com/ada/engine"}
    assert out["languages"] == ["TypeScript", "Python"]  # the fork is not theirs
    out2 = client.get("/api/join/github?login=ada").json()
    assert out2["ok"] and len(calls) == 2  # the second read came from the cache
    assert client.get("/api/join/github?login=%3F%3F").json() == {"ok": False, "error": "bad_login"}


def test_github_unknown_user_is_soft(rig, monkeypatch):
    join._GH_CACHE.clear()

    async def fake_get(url):
        return 404, {"message": "Not Found"}

    monkeypatch.setattr(join, "_github_get", fake_get)
    out = rig["client"].get("/api/join/github?login=nobody-here").json()
    assert out == {"ok": False, "error": "not_found", "login": "nobody-here"}
