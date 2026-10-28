"""THE RETENTION CLOCK, against a fake store tree (VOICE-21 · E195.40).

RELEASE-193's honest boundary was «Recordings' retention sweeper and the tenant notice are
specified, not yet running». These tests are what «running» means: expired artefacts go, fresh ones
stay, a dry run touches nothing, a missing store is a clean no-op, and the journal carries counts
and never contents.

Nothing here reaches a provider or a network. The tree is built by hand in `tmp_path`, in exactly
the two shapes RUN-09.2 says the box holds: `calls/<sid>.json` and `recordings/<sid>.wav`.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import pathlib
import subprocess
import sys
import textwrap
import time
from datetime import datetime, timedelta, timezone

import pytest

from app import config, logging_setup, retention, store

NOW = datetime(2026, 9, 4, 12, 0, 0, tzinfo=timezone.utc)

TRANSCRIPT = {
    "transcript": "Peix Vilalta, dígame. ¿Me puedes añadir cuatro kilos de merluza para mañana?",
    "utterances": [
        {"speaker": 0, "start": 0.4, "end": 2.1, "text": "Peix Vilalta, dígame."},
        {"speaker": 1, "start": 2.6, "end": 6.9, "text": "¿Me puedes añadir cuatro kilos de merluza para mañana?"},
    ],
    "language": "es",
    "provider": "deepgram nova-3",
}


@pytest.fixture()
def box(tmp_path, monkeypatch):
    """A state directory shaped like the box, with the shipped retention numbers."""
    monkeypatch.setattr(config.settings, "state_dir", tmp_path, raising=False)
    monkeypatch.setattr(config.settings, "audio_retention_days", 30, raising=False)
    monkeypatch.setattr(config.settings, "transcript_retention_days", 365, raising=False)
    monkeypatch.setattr(config.settings, "call_record_retention_days", 0, raising=False)
    (tmp_path / "calls").mkdir()
    (tmp_path / "recordings").mkdir()
    return tmp_path


def call(box: pathlib.Path, sid: str, *, days_ago: float = 1, transcript=None,
         custody: str = "ours", recording_sid: str | None = None, **extra) -> pathlib.Path:
    """One durable call record, exactly as twilio_voice writes it."""
    started = (NOW - timedelta(days=days_ago)).isoformat(timespec="seconds").replace("+00:00", "Z")
    record = {
        "sid": sid, "direction": "inbound", "from": "+34932211000", "to": "+34932102244",
        "startedAt": started, "durationSeconds": 96, "recordingCustody": custody,
    }
    if recording_sid:
        record["recordingSid"] = recording_sid
        record["recordingPath"] = str(box / "recordings" / f"{recording_sid}.wav")
    if transcript is not None:
        record["transcript"] = transcript
    record.update(extra)
    path = box / "calls" / f"{sid}.json"
    path.write_text(json.dumps(record, ensure_ascii=False, indent=1))
    age = (NOW - timedelta(days=days_ago)).timestamp()
    os.utime(path, (age, age))
    return path


def audio(box: pathlib.Path, name: str, *, days_ago: float = 1, size: int = 2048) -> pathlib.Path:
    path = box / "recordings" / f"{name}.wav"
    path.write_bytes(b"\0" * size)
    age = (NOW - timedelta(days=days_ago)).timestamp()
    os.utime(path, (age, age))
    return path


def read(path: pathlib.Path) -> dict:
    return json.loads(path.read_text())


# ── the audio, once its transcript is ready ────────────────────────────────────────────────────

def test_audio_goes_as_soon_as_its_transcript_is_ready(box):
    record = call(box, "CA1", transcript=TRANSCRIPT, recording_sid="RE1")
    wav = audio(box, "RE1")

    report = retention.sweep(apply=True, now=NOW)

    assert not wav.exists()
    assert report.audio_transcribed == 1 and report.audio_expired == 0
    assert report.bytes_freed == 2048
    kept = read(record)
    assert kept["transcript"] == TRANSCRIPT, "the words stay; only the audio goes"
    assert kept["recordingCustody"] == "provider", "custody falls back once the bytes are gone"
    assert kept["audioRemovedReason"] == retention.TRANSCRIPT_READY
    assert kept["audioRemovedAt"].endswith("Z")
    assert "recordingPath" not in kept, "a record may not name a file this box no longer holds"


def test_an_empty_transcript_keeps_the_audio_on_the_thirty_day_clock(box):
    """A silent leg is a finished REQUEST, never a finished transcript (decision 2)."""
    empty = {"transcript": "  ", "utterances": [], "language": "es", "provider": "deepgram nova-3"}
    call(box, "CA1", transcript=empty, recording_sid="RE1", days_ago=2)
    wav = audio(box, "RE1", days_ago=2)

    fresh = retention.sweep(apply=True, now=NOW)
    assert wav.exists() and fresh.audio_kept == 1 and fresh.audio_transcribed == 0

    os.utime(wav, ((NOW - timedelta(days=31)).timestamp(),) * 2)
    later = retention.sweep(apply=True, now=NOW)
    assert not wav.exists() and later.audio_expired == 1


# ── the audio, where no transcript succeeded ───────────────────────────────────────────────────

def test_audio_without_a_transcript_lives_thirty_days(box):
    call(box, "CA-young", days_ago=29, recording_sid="RE-young")
    call(box, "CA-old", days_ago=31, recording_sid="RE-old")
    young = audio(box, "RE-young", days_ago=29)
    old = audio(box, "RE-old", days_ago=31)

    report = retention.sweep(apply=True, now=NOW)

    assert young.exists(), "day 29 is inside the window"
    assert not old.exists(), "day 31 is past it"
    assert report.audio_expired == 1 and report.audio_kept == 1


def test_orphan_audio_follows_the_same_clock(box):
    """A wav with no call record is audio no transcript ever succeeded for."""
    young = audio(box, "RE-orphan-young", days_ago=10)
    old = audio(box, "RE-orphan-old", days_ago=45)

    report = retention.sweep(apply=True, now=NOW)

    assert young.exists() and not old.exists()
    assert report.audio_expired == 1 and report.audio_kept == 1


def test_the_audio_deadline_follows_the_configured_number(box, monkeypatch):
    monkeypatch.setattr(config.settings, "audio_retention_days", 7, raising=False)
    call(box, "CA1", days_ago=10, recording_sid="RE1")
    wav = audio(box, "RE1", days_ago=10)

    assert retention.sweep(apply=True, now=NOW).audio_expired == 1
    assert not wav.exists()


# ── the transcript text, and the record under it ───────────────────────────────────────────────

def test_a_transcript_expires_at_twelve_months_and_the_call_record_stays(box):
    record = call(box, "CA-old", days_ago=400, transcript=TRANSCRIPT, custody="provider")

    report = retention.sweep(apply=True, now=NOW)

    kept = read(record)
    assert record.exists(), "the call record is business metadata and stays"
    assert "transcript" not in kept
    assert kept["transcriptRemovedAt"].endswith("Z")
    assert kept["sid"] == "CA-old" and kept["durationSeconds"] == 96
    assert report.transcripts_expired == 1 and report.records_kept == 1


def test_a_transcript_inside_its_year_is_left_alone(box):
    record = call(box, "CA1", days_ago=364, transcript=TRANSCRIPT, custody="provider")
    report = retention.sweep(apply=True, now=NOW)
    assert read(record)["transcript"] == TRANSCRIPT
    assert report.transcripts_kept == 1 and report.transcripts_expired == 0


def test_a_call_record_is_kept_until_the_tenant_states_a_period(box, monkeypatch):
    record = call(box, "CA-ancient", days_ago=1200, custody="none")
    assert retention.sweep(apply=True, now=NOW).records_expired == 0
    assert record.exists(), "0 means keep — the business-record period is the tenant's to state"

    monkeypatch.setattr(config.settings, "call_record_retention_days", 730, raising=False)
    report = retention.sweep(apply=True, now=NOW)
    assert report.records_expired == 1 and not record.exists()


def test_an_expired_record_takes_its_audio_with_it(box, monkeypatch):
    monkeypatch.setattr(config.settings, "call_record_retention_days", 365, raising=False)
    record = call(box, "CA1", days_ago=400, recording_sid="RE1")
    wav = audio(box, "RE1", days_ago=10)   # fresh bytes, expired record

    report = retention.sweep(apply=True, now=NOW)

    assert not record.exists() and not wav.exists()
    assert report.records_expired == 1
    # The wav was INSIDE its own 30-day window. It goes under the record's rule, and it is counted
    # under that rule rather than left in `audio_kept` — see the dry-run parity test below.
    assert report.audio_with_record == 1 and report.audio_kept == 0
    assert report.bytes_freed == 2048
    assert report.rules[retention.RECORD_EXPIRED] == 2, "two artefacts went under one rule"


def test_a_swept_record_keeps_its_transcript_clock(box):
    """The sweep rewrites a record when it releases audio — that write may not restart the year.

    Aging a record by its mtime would do exactly that: sweep one deletes the audio and touches the
    file, and sweep two would read a record «written today» and hold a two-year-old transcript for
    another twelve months. The record is aged by the CALL's own instant, so it cannot happen.
    """
    record = call(box, "CA1", days_ago=400, transcript=TRANSCRIPT, recording_sid="RE1")
    audio(box, "RE1", days_ago=400)

    first = retention.sweep(apply=True, now=NOW)
    assert first.audio_transcribed == 1 and first.transcripts_expired == 1
    assert "transcript" not in read(record)
    assert read(record)["startedAt"].startswith("2025-"), "the call's own instant survives the sweep"


# ── the two postures: a plan, and a missing store ──────────────────────────────────────────────

def test_a_dry_run_touches_nothing(box):
    record = call(box, "CA1", transcript=TRANSCRIPT, recording_sid="RE1")
    wav = audio(box, "RE1")
    old = call(box, "CA2", days_ago=90, recording_sid="RE2")
    stale = audio(box, "RE2", days_ago=90)
    before = {path: path.read_bytes() for path in (record, wav, old, stale)}
    stamps = {path: path.stat().st_mtime for path in before}

    report = retention.sweep(apply=False, now=NOW)

    assert report.mode == "dry-run"
    assert report.audio_transcribed == 1 and report.audio_expired == 1
    for path, content in before.items():
        assert path.exists() and path.read_bytes() == content, f"{path.name} was rewritten"
        assert path.stat().st_mtime == stamps[path], f"{path.name} was touched"


def every_rule(box: pathlib.Path) -> None:
    """One store that trips all four rules at once, with a 730-day record deadline in force.

    CA1 · a transcript came back, so its audio goes and the words stay (1 day old).
    CA2 · 400 days: past the twelve months, inside the two-year record period → the text goes.
    CA3 · 45 days with no transcript → the audio goes at the 30-day deadline.
    CA4 · 1000 days → the record itself goes, and takes a wav born YESTERDAY with it.
    """
    call(box, "CA1", transcript=TRANSCRIPT, recording_sid="RE1")
    audio(box, "RE1")
    call(box, "CA2", days_ago=400, transcript=TRANSCRIPT, custody="provider")
    call(box, "CA3", days_ago=45, recording_sid="RE3")
    audio(box, "RE3", days_ago=45)
    call(box, "CA4", days_ago=1000, recording_sid="RE4")
    audio(box, "RE4", days_ago=1, size=8192)


def test_a_dry_run_counts_exactly_what_the_apply_removes(box, monkeypatch):
    """Every rule at once, INCLUDING the record deadline — which the old fixture pinned at 0.

    That gap hid a real defect: `sweep()` only reached a due record's audio under `apply`, so a
    100-day-old record holding a one-day-old wav planned «audio_kept=1 … bytes_freed=0» and then
    deleted the bytes. deploy.sh step 4b's guard and the nightly journal are both this number.
    """
    monkeypatch.setattr(config.settings, "call_record_retention_days", 730, raising=False)
    every_rule(box)

    planned = retention.sweep(apply=False, now=NOW)
    freed_on_disk = sum(path.stat().st_size for path in (box / "recordings").glob("*.wav"))
    done = retention.sweep(apply=True, now=NOW)

    for name in ("audio_transcribed", "audio_expired", "audio_with_record", "audio_kept",
                 "transcripts_expired", "transcripts_kept", "records_expired", "records_kept",
                 "bytes_freed"):
        assert getattr(planned, name) == getattr(done, name), f"the plan and the apply differ on {name}"
    assert (planned.audio_transcribed, planned.audio_expired, planned.audio_with_record) == (1, 1, 1)
    assert planned.transcripts_expired == 1 and planned.records_expired == 1
    assert planned.audio_kept == 0, "the due record's fresh wav is never planned as «kept»"
    assert planned.bytes_freed == freed_on_disk == 2048 + 2048 + 8192
    assert not list((box / "recordings").glob("*.wav")), "and the apply took exactly those bytes"


def test_a_dry_run_prices_the_audio_the_glob_never_sees(box, monkeypatch):
    """The RECORD rule's own bytes, in BOTH modes (E194 integration · the verifier's residual).

    `sweep()` enumerates audio with `recordings/*.wav`. A record whose `recordingPath` names a file
    that glob never reaches — a subdirectory, another extension — was reached only by
    `forget_audio()` under `--apply`, so the PLAN said `bytes_freed=0` and the apply then took the
    bytes. deploy.sh step 4b's guard and the nightly journal both quote that number, so a plan that
    under-reports makes both of them lie.
    """
    monkeypatch.setattr(config.settings, "call_record_retention_days", 30, raising=False)
    nested = box / "recordings" / "archive"
    nested.mkdir()
    hidden = nested / "RE-deep.wav"
    hidden.write_bytes(b"\0" * 4096)
    call(box, "CA-old", days_ago=100, recording_sid="RE-deep",
         recordingPath=str(hidden))

    planned = retention.sweep(apply=False, now=NOW)
    done = retention.sweep(apply=True, now=NOW)

    assert planned.bytes_freed == 4096, "the plan prices the file the glob never saw"
    assert planned.bytes_freed == done.bytes_freed, "the plan and the apply agree on the bytes"
    assert planned.records_expired == done.records_expired == 1
    assert not hidden.exists(), "and the apply took exactly those bytes"


def test_a_record_stating_zero_keeps_its_transcript(box):
    """The SAME meaning for 0 on the fourth surface of the number (decision 5 · decision 6).

    `ROCOTO_AUDIO_RETENTION_DAYS`, `ROCOTO_TRANSCRIPT_RETENTION_DAYS` and
    `ROCOTO_CALL_RECORD_RETENTION_DAYS` all read 0 as «the clock is off»
    (`test_zero_turns_a_clock_off_rather_than_destroying_everything`). A record may state its own
    transcript period, and one number cannot mean «off» on a box knob and «delete now» on a record.
    """
    record = call(box, "CA1", days_ago=400, transcript=TRANSCRIPT, custody="provider",
                  transcriptRetentionDays=0)

    report = retention.sweep(apply=True, now=NOW)

    assert read(record)["transcript"] == TRANSCRIPT, "a record's own 0 is «off», exactly as the knob's is"
    assert report.transcripts_kept == 1 and report.transcripts_expired == 0


def test_every_rule_counted_adds_up_to_what_was_removed(box, monkeypatch):
    """`sum(rules.values())` is the artefact count, so a rule that fired without a counter shows."""
    monkeypatch.setattr(config.settings, "call_record_retention_days", 730, raising=False)
    every_rule(box)

    report = retention.sweep(apply=False, now=NOW)

    assert sum(report.rules.values()) == report.removed == 5
    assert report.rules == {retention.TRANSCRIPT_READY: 1, retention.AUDIO_EXPIRED: 1,
                            retention.TRANSCRIPT_EXPIRED: 1, retention.RECORD_EXPIRED: 2}


def test_a_missing_store_is_a_clean_no_op(box, monkeypatch, tmp_path):
    nowhere = tmp_path / "no-calls-were-ever-taken"
    monkeypatch.setattr(config.settings, "state_dir", nowhere, raising=False)

    report = retention.sweep(apply=True, now=NOW)

    assert report.removed == 0 and report.audio_kept == 0 and report.records_kept == 0
    assert not nowhere.exists(), "the sweep creates nothing — a swept box stays swept"


def test_the_sweep_is_idempotent(box):
    call(box, "CA1", transcript=TRANSCRIPT, recording_sid="RE1")
    audio(box, "RE1")
    call(box, "CA2", days_ago=90, recording_sid="RE2")
    audio(box, "RE2", days_ago=90)
    call(box, "CA3", days_ago=400, transcript=TRANSCRIPT, custody="provider")

    first = retention.sweep(apply=True, now=NOW)
    assert first.removed == 3

    second = retention.sweep(apply=True, now=NOW)
    assert second.removed == 0 and second.bytes_freed == 0
    third = retention.sweep(apply=True, now=NOW)
    assert third.removed == 0


def test_an_unreadable_record_is_counted_and_left_alone(box):
    broken = box / "calls" / "CA-broken.json"
    broken.write_text("{ this was half-written when the box lost power")
    audio(box, "RE-orphan", days_ago=2)

    report = retention.sweep(apply=True, now=NOW)

    assert report.unreadable == 1 and broken.exists()
    assert report.records_kept == 0


# ── the journal ────────────────────────────────────────────────────────────────────────────────

def test_the_journal_carries_counts_and_never_contents(box, caplog):
    call(box, "CA1", transcript=TRANSCRIPT, recording_sid="RE1")
    audio(box, "RE1")
    call(box, "CA2", days_ago=400, transcript=TRANSCRIPT, custody="provider")

    with caplog.at_level(logging.INFO, logger="rocoto.runtime.retention"):
        report = retention.sweep(apply=True, now=NOW)

    # THE LINE THE BOX ACTUALLY EMITS, never just its message. `logging_setup.JsonLine` copies
    # `call_sid`, `outcome`, `provider`, `kind`, `route` and the rest OUT OF `extra=` into the
    # journal, so a writer that put a phone number or a sentence of the transcript in an `extra`
    # would sail past a `getMessage()` scan and publish it anyway. The claim is «absent from every
    # emitted line», so the scan reads the formatted line — which is what journald stores.
    formatter = logging_setup.JsonLine()
    lines = [formatter.format(record) for record in caplog.records]
    written = "\n".join(lines)
    assert "merluza" not in written and "Peix Vilalta" not in written, "no transcript text"
    assert "+34932211000" not in written and "932211000" not in written, "no phone number"
    assert "34932102244" not in written and "932102244" not in written, "and no house number"
    assert "audio_transcribed=1" in written and "transcripts_expired=1" in written
    assert report.line() in written
    assert any(getattr(record, "call_sid", "") == "CA1" for record in caplog.records)

    # And the SHAPE is closed: only the contract's own keys reach the journal, so a new `extra`
    # carrying a customer's words could not ride in under a name nobody scans for.
    allowed = {"ts", "level", "logger", "msg", "request_id", "route", "status", "ms",
               "provider", "kind", "call_sid", "outcome"}
    for line in lines:
        payload = json.loads(line)
        assert set(payload) <= allowed, f"an unscanned key reached the journal: {set(payload) - allowed}"


# ── the custody path, which is where «as soon as» is kept ──────────────────────────────────────

def test_forget_audio_removes_one_call_s_bytes_and_says_so(box):
    record = call(box, "CA1", transcript=TRANSCRIPT, recording_sid="RE1")
    wav = audio(box, "RE1", size=4096)

    freed = retention.forget_audio("CA1", "RE1", now=NOW)

    assert freed == 4096 and not wav.exists()
    kept = read(record)
    assert kept["recordingCustody"] == "provider" and "recordingPath" not in kept
    assert kept["audioRemovedReason"] == retention.TRANSCRIPT_READY


def test_forget_audio_on_a_call_with_no_bytes_is_a_clean_no_op(box):
    record = call(box, "CA1", custody="none")
    assert retention.forget_audio("CA1", "RE-nothing", now=NOW) == 0
    assert read(record)["recordingCustody"] == "none"


def test_forget_audio_leaves_a_path_outside_the_recordings_directory_alone(box, tmp_path):
    """A record naming a file elsewhere on the disk is a record this sweep refuses to act on."""
    outside = tmp_path / "somebody-elses.wav"
    outside.write_bytes(b"\0" * 16)
    call(box, "CA1", transcript=TRANSCRIPT, recordingPath=str(outside))

    retention.forget_audio("CA1", now=NOW)

    assert outside.exists(), "retention deletes inside its own store and nowhere else"


class _Fetched:
    """Twilio's answer to a recording download, with bytes and nothing else."""

    status_code = 200
    content = b"RIFF" + b"\0" * 1020


def _fake_http(asked: list[str]):
    class Client:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc):
            return False

        async def get(self, url, **kwargs):
            asked.append(url)
            return _Fetched()

    return Client


def test_the_custody_ladder_deletes_the_audio_it_just_transcribed(box, monkeypatch, caplog):
    """`twilio_voice.take_custody` itself, awaited, with the two providers replaced.

    THE OLD VERSION OF THIS TEST PROVED NOTHING. It asserted `twilio_voice.retention is retention`
    and then re-implemented the branch in its own body, so deleting

        if retention.has_words(transcript):
            retention.forget_audio(call_sid, recording_sid)

    from `take_custody` left the suite green — and «the audio goes as soon as the transcript is
    ready» is E195.40's headline claim. This one walks the real ladder: download → keep → transcribe
    → attach → forget, and asserts the disk at the end of it.
    """
    from app import deepgram, twilio_voice

    asked: list[str] = []
    monkeypatch.setattr(twilio_voice.httpx, "AsyncClient", _fake_http(asked))
    monkeypatch.setattr(config.settings, "places_key", "", raising=False)
    monkeypatch.setattr(deepgram, "to_wav_multichannel",
                        lambda payload, suffix: (payload, "audio/wav", True))

    async def transcribe(*args, **kwargs):
        return TRANSCRIPT

    monkeypatch.setattr(deepgram, "transcribe", transcribe)
    store.save({"sid": "CA1", "direction": "inbound", "to": "+34932102244",
                "startedAt": "2026-09-04T07:42:00Z"})

    with caplog.at_level(logging.INFO):
        asyncio.run(twilio_voice.take_custody("CA1", "RE1", "https://api.twilio.com/2010-04-01/RE1"))

    assert "custody failed" not in caplog.text, caplog.text
    assert asked and asked[0].endswith(".wav"), "the wav, by its own extension"
    kept = store.get("CA1")
    assert kept["transcript"] == TRANSCRIPT, "the words were attached"
    assert not (box / "recordings" / "RE1.wav").exists(), "and the bytes went the moment they were read"
    assert kept["recordingCustody"] == "provider" and "recordingPath" not in kept
    assert kept["audioRemovedReason"] == retention.TRANSCRIPT_READY


def test_the_custody_ladder_keeps_the_audio_of_a_silent_leg(box, monkeypatch):
    """The same ladder, with an empty result: the bytes stay, on the 30-day clock (decision 2)."""
    from app import deepgram, twilio_voice

    silent = {"transcript": "", "utterances": [], "language": "es", "provider": "deepgram nova-3"}
    monkeypatch.setattr(twilio_voice.httpx, "AsyncClient", _fake_http([]))
    monkeypatch.setattr(config.settings, "places_key", "", raising=False)
    monkeypatch.setattr(deepgram, "to_wav_multichannel",
                        lambda payload, suffix: (payload, "audio/wav", True))

    async def transcribe(*args, **kwargs):
        return silent

    monkeypatch.setattr(deepgram, "transcribe", transcribe)
    store.save({"sid": "CA1", "startedAt": "2026-09-04T07:42:00Z"})

    asyncio.run(twilio_voice.take_custody("CA1", "RE1", "https://api.twilio.com/2010-04-01/RE1"))

    assert (box / "recordings" / "RE1.wav").exists()
    assert store.get("CA1")["recordingCustody"] == "ours"


# ── the CLI the timer runs ─────────────────────────────────────────────────────────────────────

def test_the_cli_defaults_to_a_dry_run(box, capsys):
    call(box, "CA1", transcript=TRANSCRIPT, recording_sid="RE1")
    wav = audio(box, "RE1")

    assert retention.main([]) == 0

    assert wav.exists(), "the default plans, it does not act"
    out = capsys.readouterr().out
    assert "dry-run" in out and "audio_transcribed=1" in out


def test_the_cli_applies_when_it_is_told_to(box, capsys):
    call(box, "CA1", transcript=TRANSCRIPT, recording_sid="RE1")
    wav = audio(box, "RE1")

    assert retention.main(["--apply", "--json"]) == 0

    assert not wav.exists()
    body = json.loads(capsys.readouterr().out.strip().splitlines()[-1])
    assert body["mode"] == "apply" and body["audio_transcribed"] == 1
    assert body["rules"] == {retention.TRANSCRIPT_READY: 1}


def test_the_cli_refuses_two_contradictory_flags(box):
    with pytest.raises(SystemExit):
        retention.main(["--apply", "--dry-run"])


def test_a_sweep_of_a_live_shaped_tree_reads_the_wall_clock(box):
    """No `now` argument: the sweep uses the real clock, and fresh artefacts survive it."""
    wav = box / "recordings" / "RE-now.wav"
    wav.write_bytes(b"\0" * 8)
    os.utime(wav, (time.time(), time.time()))
    report = retention.sweep(apply=True)
    assert wav.exists() and report.audio_kept == 1


# ── 0 MEANS THE CLOCK IS OFF, ON ALL THREE KNOBS (decision 5) ──────────────────────────────────

PROBE = textwrap.dedent("""
    import fcntl, os, sys
    fd = os.open(sys.argv[1], os.O_CREAT | os.O_RDWR, 0o600)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        print("TOOK")
    except BlockingIOError:
        print("BLOCKED")
""")


def probe(lock: pathlib.Path) -> str:
    """Another PROCESS trying to take the store's write lock right now."""
    return subprocess.run([sys.executable, "-c", PROBE, str(lock)],
                          capture_output=True, text=True, timeout=30).stdout.strip()


def test_zero_turns_a_clock_off_rather_than_destroying_everything(box, monkeypatch):
    """`ROCOTO_CALL_RECORD_RETENTION_DAYS=0` already meant «off». The other two meant «delete all».

    Proven before the guard existed: with both set to 0, a three-day-old transcript and a
    three-day-old wav were destroyed — «transcripts_expired=2 … bytes_freed=1024». One number
    cannot have two meanings on three knobs an operator sets in the same file.
    """
    monkeypatch.setattr(config.settings, "audio_retention_days", 0, raising=False)
    monkeypatch.setattr(config.settings, "transcript_retention_days", 0, raising=False)
    monkeypatch.setattr(config.settings, "call_record_retention_days", 0, raising=False)
    record = call(box, "CA1", days_ago=3, transcript=TRANSCRIPT, custody="provider")
    quiet = call(box, "CA2", days_ago=3, recording_sid="RE2")
    wav = audio(box, "RE2", days_ago=3, size=1024)

    report = retention.sweep(apply=True, now=NOW)

    assert wav.exists(), "audio with a 0 clock is KEPT"
    assert read(record)["transcript"] == TRANSCRIPT, "a transcript with a 0 clock is KEPT"
    assert quiet.exists() and record.exists()
    assert report.removed == 0 and report.bytes_freed == 0
    assert report.audio_kept == 1 and report.transcripts_kept == 1 and report.records_kept == 2


def test_a_record_states_its_own_transcript_period_and_it_wins(box):
    """Decision 6 — the seat a per-tenant deadline needs, under the box's own knob.

    `ROCOTO_TRANSCRIPT_RETENTION_DAYS` is the BOX's number; the period is the house's choice (the
    kit's dial). A record that states `transcriptRetentionDays` is aged by its own number. Nothing
    writes that field today — the kit's dial is local state, and a runtime write would be an
    endpoint the kit does not name (RUN-02) — so the box knob still governs every record on the box.
    """
    ninety = call(box, "CA-90", days_ago=100, transcript=TRANSCRIPT, custody="provider",
                  transcriptRetentionDays=90)
    forever = call(box, "CA-keep", days_ago=1200, transcript=TRANSCRIPT, custody="provider",
                   transcriptRetentionDays=0)
    box_knob = call(box, "CA-box", days_ago=100, transcript=TRANSCRIPT, custody="provider")

    report = retention.sweep(apply=True, now=NOW)

    assert "transcript" not in read(ninety), "its own ninety days ran out"
    assert read(forever)["transcript"] == TRANSCRIPT, "0 on the record is «keep», as everywhere else"
    assert read(box_knob)["transcript"] == TRANSCRIPT, "the box's 365 still governs a silent record"
    assert report.transcripts_expired == 1 and report.transcripts_kept == 2


# ── THE STORE'S WRITES, AGAINST THE SERVICE RUNNING BESIDE THE SWEEP ───────────────────────────

def test_a_write_holds_a_lock_no_other_process_can_take(box):
    """A `threading.Lock` locks one process. The sweep and uvicorn are two."""
    lock = box / "calls" / ".lock"
    with store.hold():
        assert probe(lock) == "BLOCKED", "a second process wrote into the middle of this one"
    assert probe(lock) == "TOOK", "and the lock is free again the moment the writer is done"


def test_forget_audio_holds_that_lock_across_the_delete_and_the_revise(box, monkeypatch):
    """The delete and the revise are ONE act.

    The race this closes: a recording webhook's `save()` landing between them puts `recordingPath`
    back on a record whose wav has just gone — a record naming a file the box no longer holds,
    which is the RUN-00 claim this module exists to prevent. The probe runs at the exact instant
    the record is being rewritten, and the wav is already gone by then.
    """
    record = call(box, "CA1", transcript=TRANSCRIPT, recording_sid="RE1")
    wav = audio(box, "RE1")
    lock = box / "calls" / ".lock"
    seen: dict[str, object] = {}
    real = store.revise

    def watched(sid, patch, drop=()):
        seen["probe"] = probe(lock)
        seen["wav_gone"] = not wav.exists()
        return real(sid, patch, drop=drop)

    monkeypatch.setattr(store, "revise", watched)
    retention.forget_audio("CA1", "RE1", now=NOW)

    assert seen["wav_gone"] is True, "the bytes go before the record stops naming them"
    assert seen["probe"] == "BLOCKED", "and no other process may write the record in between"
    assert "recordingPath" not in read(record)


def test_a_failed_write_leaves_the_record_it_could_not_replace(box, monkeypatch):
    """Whole file or nothing. A truncating write plus a crash leaves a record nothing can parse."""
    record = call(box, "CA1", transcript=TRANSCRIPT, recording_sid="RE1")
    before = record.read_text()

    def gone(*_args, **_kwargs):
        raise OSError("the disk went away mid-write")

    monkeypatch.setattr(store.os, "replace", gone)
    with pytest.raises(OSError):
        store.save({"sid": "CA1", "status": "completed"})

    assert record.read_text() == before, "the record on the disk is the one that was there"
    assert json.loads(record.read_text())["transcript"] == TRANSCRIPT
    assert not list((box / "calls").glob("*.tmp-*")), "and the temp file was cleaned up"


def test_a_half_written_record_is_never_read_as_a_record(box):
    """The temp file `_write` swaps in is named so `glob('*.json')` cannot pick it up."""
    half = box / "calls" / "CA1.json.tmp-999"
    half.write_text("{ this is half a record")
    call(box, "CA1", transcript=TRANSCRIPT, custody="provider")

    report = retention.sweep(apply=True, now=NOW)

    assert report.unreadable == 0, "a half-written file is invisible, never «unreadable»"
    assert report.records_kept == 1 and half.exists()


def test_a_missing_store_makes_forget_audio_a_clean_no_op(box, monkeypatch, tmp_path):
    """It creates nothing — the lock is a WRITE lock, and there is nothing here to write."""
    nowhere = tmp_path / "no-calls-were-ever-taken"
    monkeypatch.setattr(config.settings, "state_dir", nowhere, raising=False)

    assert retention.forget_audio("CA1", "RE1", now=NOW) == 0
    assert not nowhere.exists()
