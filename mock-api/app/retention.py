"""RETENTION — the clock the product keeps, run as a sweep (VOICE-21 · RUN-09.2 · RUN-11.5).

THE-VOICE-CONNECTION-SPEC VOICE-21 states retention as a clock rather than a promise, and
VOICE-09B states the custody class this box has to return to:

    | Object                              | Default retention            | What ends it            |
    | Call metadata and events            | the business-record period   | tenant deletion policy  |
    | Provider audio                      | deleted as soon as the       | verified deletion       |
    |                                     | transcript is `ready`        |                         |
    | Audio where no transcript succeeded | 30 days, then deleted        | THE RETENTION WORKER    |
    | Transcript text                     | tenant-set, default 12 months| THE RETENTION WORKER    |
    | Derived reviewed order facts        | business-record retention    | they cite a locator     |

    | Raw recording audio | **No Rocoto blob/file** | Twilio only while policy permits |
    |                     | Delete after successful transcript / retention deadline |

THIS FILE IS «the retention worker». It is the half RELEASE-193 recorded as owed: «Recordings'
retention sweeper and the tenant notice are specified, not yet running.»

What is on the box (RUN-09.2 — nothing else is written, and this sweep checked):

    /srv/rocoto-kit-runtime/calls/<call sid>.json        the durable call record
    /srv/rocoto-kit-runtime/recordings/<recording sid>.wav   audio in OUR custody

Google Places answers and Parsewise projects leave nothing here to sweep: `places.py` holds its
answer in the response only, `parsewise.py` DELETES the project at the provider (RUN-04.5), and
`deepgram.py` transcodes inside a `TemporaryDirectory` the unit already makes private.

SIX DECISIONS THE SPEC LEFT TO THE IMPLEMENTATION, MADE HERE AND STATED RATHER THAN IMPLIED:

1. **«Provider audio» is read as ALL audio, including our own copy.** VOICE-09B wants no Rocoto
   blob at all; the runtime keeps one only long enough to transcribe it (`twilio_voice.take_custody`).
   So the copy on this disk inherits the provider copy's clock — gone as soon as the transcript is
   ready — and `retention.forget_audio()` is called on that path directly, so «as soon as» is true
   rather than «within a day». The sweep is the net underneath it: a crash between the transcript
   and the deletion, a file from before this module existed, an orphan with no record at all.
2. **A transcript counts as `ready` when it carries WORDS.** An empty result — Deepgram answering a
   silent leg — is a finished request, and treating it as `ready` would delete the only evidence
   the call left. So an empty transcript keeps the audio on the 30-day clock instead.
3. **Each artefact is aged by its OWN clock, and they are different clocks.** A call record is aged
   by the call's `startedAt`, because the file is rewritten by every later leg and by this sweep —
   its mtime is the age of the last WRITE, and aging a record by it would restart the transcript's
   twelve months every time the sweep touched the record. Audio is aged by the wav's own mtime,
   which is the instant the bytes landed on this disk and is never touched again. A record with no
   `startedAt` falls back to its mtime; an artefact with no clock at all is KEPT, because an age
   nobody can state is never grounds to delete.
4. **The call record's own deadline is OFF by default** (`ROCOTO_CALL_RECORD_RETENTION_DAYS=0`),
   because «the tenant's business-record period» is the tenant's to state and this service must not
   invent one. Set the number and the sweep enforces it, taking the record's audio and transcript
   with it.
5. **0 MEANS THE CLOCK IS OFF, AND IT MEANS THAT ON ALL THREE KNOBS.** One number, one meaning.
   The other reading is a disaster with a plausible motive: an operator who sets
   `ROCOTO_AUDIO_RETENTION_DAYS=0` meaning «hold no audio» would, under an `age >= 0` rule, watch
   every wav and every transcript on the box go on the next sweep, this morning's included. So each
   rule is guarded `if <days> and age >= <days>`. A house that wants audio gone at once already has
   that: it goes the moment its transcript is ready.
6. **A record may carry its OWN transcript period, and it wins.** `ROCOTO_TRANSCRIPT_RETENTION_DAYS`
   is the BOX's number, and a box serves one house today — but the period is the tenant's choice
   (the kit's dial, `RETENTIONS` in `company.ts`), so the sweep reads `transcriptRetentionDays` off
   the record when the record states one and falls back to the box knob when it does not. That is
   the seat a per-tenant deadline needs. NOTHING WRITES IT YET: the kit's dial is local state and a
   runtime write would be an endpoint the kit does not name (RUN-02), so on today's box the knob
   governs and the unit sets 365 — the same twelve months the dial's shipped default states. The
   writer is owed, and RUN-11 says so.

THE JOURNAL CARRIES COUNTS, NEVER CONTENTS (VOICE-09C): one line per artefact naming the call sid,
the rule and the bytes, and one summary line of counts. No transcript text, no phone number, no
path outside the state directory ever reaches it.

THE PLAN COUNTS EXACTLY WHAT THE APPLY REMOVES. Both modes walk the same decisions in the same
order — including the audio that goes because the RECORD holding it passed the house's period,
which is audio inside its own window and would otherwise be planned as `audio_kept` and then
deleted. `deploy.sh` step 4b's guard and the nightly journal are both that number, so a plan that
under-reported would make both of them lie.

    python -m app.retention              # a dry run: says what it WOULD remove, touches nothing
    python -m app.retention --apply      # the sweep, for real
    python -m app.retention --apply --json   # the report as one JSON object, for the timer's log
"""
from __future__ import annotations

import argparse
import json
import logging
import pathlib
import sys
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any

from . import store
from .config import settings

logger = logging.getLogger("rocoto.runtime.retention")

# The rules, by their spec name. `audio_transcribed` has no number: its deadline is an EVENT.
TRANSCRIPT_READY = "transcript-ready"
AUDIO_EXPIRED = "audio-expired"
TRANSCRIPT_EXPIRED = "transcript-expired"
RECORD_EXPIRED = "record-expired"


@dataclass
class Report:
    """What the sweep did, in counts. Every field is a number or a rule name — never a content."""

    mode: str = "dry-run"
    at: str = ""
    audio_transcribed: int = 0      # audio deleted because its transcript is ready
    audio_expired: int = 0          # audio deleted at the 30-day deadline, no transcript
    audio_with_record: int = 0      # audio deleted with the record that held it, inside its window
    audio_kept: int = 0             # audio still inside its window, on a record still standing
    bytes_freed: int = 0
    transcripts_expired: int = 0    # transcript text dropped at the 12-month deadline
    transcripts_kept: int = 0
    records_expired: int = 0        # whole call records removed, where a tenant deadline is set
    records_kept: int = 0
    unreadable: int = 0             # a record that would not parse: counted, left alone
    rules: dict[str, int] = field(default_factory=dict)

    @property
    def removed(self) -> int:
        """Every ARTEFACT this sweep took away — and `sum(rules.values())` is the same number."""
        return (self.audio_transcribed + self.audio_expired + self.audio_with_record
                + self.transcripts_expired + self.records_expired)

    def line(self) -> str:
        return (
            f"retention sweep · {self.mode} · audio_transcribed={self.audio_transcribed} "
            f"audio_expired={self.audio_expired} audio_with_record={self.audio_with_record} "
            f"audio_kept={self.audio_kept} "
            f"transcripts_expired={self.transcripts_expired} transcripts_kept={self.transcripts_kept} "
            f"records_expired={self.records_expired} records_kept={self.records_kept} "
            f"unreadable={self.unreadable} bytes_freed={self.bytes_freed}"
        )


def _now(now: datetime | None = None) -> datetime:
    return now or datetime.now(timezone.utc)


def _parsed(value: Any) -> datetime | None:
    """An ISO instant from a call record, or nothing. `Z` is what this service writes."""
    if not isinstance(value, str) or not value.strip():
        return None
    text = value.strip().replace("Z", "+00:00")
    try:
        stamp = datetime.fromisoformat(text)
    except ValueError:
        return None
    return stamp if stamp.tzinfo else stamp.replace(tzinfo=timezone.utc)


def _days_since(stamp: datetime | None, now: datetime) -> float:
    """Days between an instant and now. No instant is 0.0 days — young, and therefore KEPT."""
    return 0.0 if stamp is None else (now - stamp).total_seconds() / 86400.0


def _mtime(path: pathlib.Path) -> datetime | None:
    try:
        return datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)
    except OSError:
        return None


def _record_age(record: dict[str, Any] | None, mtime: datetime | None, now: datetime) -> float:
    """Decision 3, record half: the CALL's own instant, with the file's mtime as the fallback."""
    return _days_since(_parsed((record or {}).get("startedAt")) or mtime, now)


def _days(value: Any) -> int | None:
    """A retention period stated ON a record, or nothing. A negative or unreadable one is nothing."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return int(value) if value >= 0 else None


def transcript_days_for(record: dict[str, Any] | None) -> int:
    """Decision 6: the record's own period when it states one, the box's knob when it does not."""
    stated = _days((record or {}).get("transcriptRetentionDays"))
    return stated if stated is not None else max(0, settings.transcript_retention_days)


def has_words(transcript: Any) -> bool:
    """Decision 2: `ready` means WORDS came back, so a silent leg keeps its audio."""
    if not isinstance(transcript, dict):
        return False
    if str(transcript.get("transcript") or "").strip():
        return True
    utterances = transcript.get("utterances")
    return bool(isinstance(utterances, list) and utterances)


def _audio_files() -> list[pathlib.Path]:
    directory = settings.recordings_dir()
    if not directory.exists():
        return []
    return sorted(path for path in directory.glob("*.wav") if path.is_file())


def _records() -> list[tuple[pathlib.Path, dict[str, Any] | None, datetime | None]]:
    """Every call record, WITH the mtime it had before this sweep wrote anything.

    The mtime is read here and carried, because releasing a record's audio rewrites the file: a
    second reading later in the same pass would report the age of this sweep's own write.
    """
    directory = settings.calls_dir()
    if not directory.exists():
        return []
    out: list[tuple[pathlib.Path, dict[str, Any] | None, datetime | None]] = []
    for path in sorted(directory.glob("*.json")):
        stamp = _mtime(path)
        try:
            out.append((path, json.loads(path.read_text()), stamp))
        except Exception:
            out.append((path, None, stamp))
    return out


def _keys(record: dict[str, Any]) -> list[str]:
    """Every audio-file stem this record could own.

    `take_custody` names the file after the RECORDING sid and falls back to the call sid, so both
    are keys. `recordingPath`'s own stem is taken too, for a record written by a future writer that
    names the file some third way.
    """
    keys = [key for key in (record.get("recordingSid"), record.get("sid"))
            if isinstance(key, str) and key]
    stored = record.get("recordingPath")
    if isinstance(stored, str) and stored:
        keys.append(pathlib.Path(stored).stem)
    return keys


def _index(records: list[tuple[pathlib.Path, dict[str, Any] | None, datetime | None]]) -> dict[str, dict[str, Any]]:
    """Audio file stem → the call record that owns it."""
    index: dict[str, dict[str, Any]] = {}
    for _path, record, _mtime_at in records:
        if not record:
            continue
        for key in _keys(record):
            index.setdefault(key, record)
    return index


def _release_audio(record: dict[str, Any] | None, reason: str, when: datetime, apply: bool) -> None:
    """The record stops claiming bytes this box no longer holds (RUN-00: never fabricate).

    Custody falls from `ours` back to `provider` — Twilio announced a recording and this disk no
    longer carries it — and the record states WHEN the copy went and under WHICH rule. Those two
    fields are additive: `runtime-client.ts` does not type them and ignores them, exactly as
    RUN-02's other additive fields do.
    """
    sid = str((record or {}).get("sid") or "")
    if not apply or not record or not sid:
        return
    patch: dict[str, Any] = {
        "audioRemovedAt": when.isoformat(timespec="seconds").replace("+00:00", "Z"),
        "audioRemovedReason": reason,
    }
    if record.get("recordingCustody") == "ours":
        patch["recordingCustody"] = "provider"
    store.revise(sid, patch, drop=("recordingPath",))


def _owned_audio(record: dict[str, Any] | None, call_sid: str = "", recording_sid: str = "") -> list[pathlib.Path]:
    """Every audio FILE on this disk one call owns — the exact set `forget_audio` deletes.

    ONE enumeration, read by both modes. The sweep's `*.wav` glob sees the top of the recordings
    directory; a record's own `recordingPath` may name a file that glob never reaches (a
    subdirectory, some other extension), and until this helper existed those bytes were counted
    ONLY under `--apply` — so a plan under-reported exactly the bytes deploy.sh's guard and the
    nightly journal quote. The plan counts what the apply removes, or it is not a plan.
    """
    names = [name for name in (recording_sid, call_sid, str((record or {}).get("recordingSid") or "")) if name]
    found: list[pathlib.Path] = []
    seen: set[str] = set()
    for name in dict.fromkeys(names):
        path = store.recording_path(name)
        if path.exists() and path.is_file() and str(path) not in seen:
            seen.add(str(path))
            found.append(path)
    stored = (record or {}).get("recordingPath")
    if isinstance(stored, str) and stored:
        extra = pathlib.Path(stored)
        try:
            inside = extra.resolve().is_relative_to(settings.recordings_dir().resolve())
        except (OSError, ValueError):
            inside = False
        if inside and extra.exists() and extra.is_file() and str(extra) not in seen:
            seen.add(str(extra))
            found.append(extra)
    return found


def forget_audio(call_sid: str, recording_sid: str = "", *, reason: str = TRANSCRIPT_READY,
                 now: datetime | None = None) -> int:
    """Delete ONE call's audio from this disk and say so in its record. Returns bytes freed.

    Decision 1's other half: the custody path calls this the moment a transcript is attached, so
    «deleted as soon as the transcript is ready» is the truth and the daily sweep is only the net.
    Missing bytes are a clean no-op — this is called on a road that may already have swept.

    THE DELETE AND THE REVISE ARE ONE ACT. Both happen inside `store.hold()`, so a recording
    webhook cannot land between them and write `recordingPath` back onto a record whose wav has
    just gone. The record is re-read INSIDE the lock for the same reason.
    """
    if not settings.calls_dir().exists() and not settings.recordings_dir().exists():
        return 0        # a box that has taken no call: nothing to forget, and nothing created
    with store.hold():
        record = store.get(call_sid) if call_sid else None
        freed = 0
        for path in _owned_audio(record, call_sid, recording_sid):
            freed += path.stat().st_size
            path.unlink()
        if freed or (record and record.get("recordingCustody") == "ours"):
            _release_audio(record, reason, _now(now), apply=True)
            logger.info("audio removed · %d bytes", freed, extra={"call_sid": call_sid, "outcome": reason})
    return freed


def sweep(apply: bool = False, now: datetime | None = None) -> Report:
    """The whole clock, in one idempotent pass. `apply=False` plans and touches nothing.

    A missing store is a clean no-op: this function never creates a directory, so a box that has
    taken no call sweeps to a report of zeros and leaves the disk exactly as it found it.
    """
    moment = _now(now)
    report = Report(mode="apply" if apply else "dry-run",
                    at=moment.isoformat(timespec="seconds").replace("+00:00", "Z"))
    records = _records()
    report.unreadable = sum(1 for _path, record, _at in records if record is None)
    owner = _index(records)
    audio_days = max(0, settings.audio_retention_days)
    record_days = max(0, settings.call_record_retention_days)

    # ── which records are past the HOUSE's own period, read BEFORE anything is touched ────────
    # A due record takes its audio with it, even audio inside its own window. That decision has to
    # be made in BOTH modes and made FIRST, because otherwise the plan counts those bytes as
    # `audio_kept` and the apply then deletes them — deploy.sh's guard and the nightly journal are
    # both this number, so a plan that under-reported would make both of them lie.
    due_stems: set[str] = set()
    for path, record, stamp in records:
        if record is None or not record_days:
            continue
        if _record_age(record, stamp, moment) >= record_days:
            due_stems.update(_keys(record))

    # ── the audio ────────────────────────────────────────────────────────────────────────────
    # Every wav this pass COUNTED, by resolved path. The record rule below reads it so a file the
    # glob already priced is never priced twice, in either mode.
    swept: set[str] = set()
    for path in _audio_files():
        record = owner.get(path.stem)
        size = path.stat().st_size
        # Decision 3, audio half: the wav's OWN mtime — the instant the bytes landed here, and the
        # one clock nothing rewrites. An orphan wav with no record is aged the same way.
        age = _days_since(_mtime(path), moment)
        if path.stem in due_stems:
            rule = RECORD_EXPIRED
        elif has_words((record or {}).get("transcript")):
            rule = TRANSCRIPT_READY
        elif audio_days and age >= audio_days:      # decision 5: 0 keeps
            rule = AUDIO_EXPIRED
        else:
            report.audio_kept += 1
            continue
        report.rules[rule] = report.rules.get(rule, 0) + 1
        report.bytes_freed += size
        swept.add(str(path.resolve()))
        if rule == TRANSCRIPT_READY:
            report.audio_transcribed += 1
        elif rule == AUDIO_EXPIRED:
            report.audio_expired += 1
        else:
            report.audio_with_record += 1
        logger.info("audio %s · %d bytes", "removed" if apply else "due", size, extra={
            "call_sid": str((record or {}).get("sid") or ""), "outcome": rule})
        if apply:
            with store.hold():
                path.unlink(missing_ok=True)
                _release_audio(record, rule, moment, apply=True)

    # ── the transcript text, and the record itself ───────────────────────────────────────────
    for path, record, stamp in records:
        if record is None:
            continue
        sid = str(record.get("sid") or path.stem)
        age = _record_age(record, stamp, moment)
        transcript_days = transcript_days_for(record)
        if record_days and age >= record_days:
            report.records_expired += 1
            report.rules[RECORD_EXPIRED] = report.rules.get(RECORD_EXPIRED, 0) + 1
            logger.info("call record %s", "removed" if apply else "due",
                        extra={"call_sid": sid, "outcome": RECORD_EXPIRED})
            # Whatever audio the loop above did not reach — a file the `*.wav` glob missed, a
            # path this record alone knows — goes with the record it belonged to, and its bytes are
            # counted in BOTH MODES. The glob already counted what it enumerated, so only the
            # paths it never saw are added here; that is what keeps plan == apply on this rule.
            missed = [owned for owned in _owned_audio(record, sid, str(record.get("recordingSid") or ""))
                      if str(owned.resolve()) not in swept]
            report.bytes_freed += sum(owned.stat().st_size for owned in missed)
            if apply:
                forget_audio(sid, str(record.get("recordingSid") or ""),
                             reason=RECORD_EXPIRED, now=moment)
                # The FILE this pass actually read, never a name rebuilt from the sid: the two
                # agree today, and deleting the one you enumerated cannot delete a neighbour.
                with store.hold():
                    path.unlink(missing_ok=True)
            continue
        report.records_kept += 1
        if record.get("transcript") is None:
            continue
        if transcript_days and age >= transcript_days:      # decision 5: 0 keeps
            report.transcripts_expired += 1
            report.rules[TRANSCRIPT_EXPIRED] = report.rules.get(TRANSCRIPT_EXPIRED, 0) + 1
            logger.info("transcript %s", "removed" if apply else "due",
                        extra={"call_sid": sid, "outcome": TRANSCRIPT_EXPIRED})
            if apply:
                store.revise(sid, {"transcriptRemovedAt": report.at}, drop=("transcript",))
        else:
            report.transcripts_kept += 1

    logger.info("%s", report.line(), extra={"outcome": report.mode})
    return report


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m app.retention",
        description="Keep VOICE-21's retention clock on this box. A dry run is the default.")
    parser.add_argument("--apply", action="store_true", help="delete what is past its deadline")
    parser.add_argument("--dry-run", action="store_true", help="say what would go, and touch nothing (default)")
    parser.add_argument("--json", action="store_true", help="print the report as one JSON object")
    args = parser.parse_args(argv)
    if args.apply and args.dry_run:
        parser.error("choose one of --apply and --dry-run")

    from . import logging_setup

    logging_setup.configure()
    report = sweep(apply=args.apply)
    if args.json:
        print(json.dumps(asdict(report), ensure_ascii=False))
    else:
        print(report.line())
    return 0


if __name__ == "__main__":  # pragma: no cover — the CLI entry the timer runs
    sys.exit(main())
