"""CALL CUSTODY — one durable record per call, on this box (FEED-IA §196.6).

VOICE-00.4: «Every call has one durable lifecycle and one place in Messages, even when it uses
several provider legs.» Three webhooks and a REST creation all touch the same call, arriving in any
order and sometimes after a restart, so the record is a FILE keyed by the call SID and every writer
merges into it. In-memory maps were the Hermes caller's known weakness — its own comment says a
deploy between the TwiML and the recording webhook wiped the dialled number.

`recordingCustody` is the kit's word for where the audio is, and it is only ever raised by evidence:
  none     · no recording exists (or the call never answered)
  provider · Twilio reported a recording and we have not fetched it yet
  ours     · the bytes are on this disk, at a path this file knows
"""
from __future__ import annotations

import contextlib
import fcntl
import json
import logging
import os
import threading
import time
from typing import Any

from .config import settings

logger = logging.getLogger("rocoto.runtime.store")

# ── THE STORE'S WRITE LOCK, AND WHY IT IS NOT A `threading.Lock` (E195.40) ────────────────────
# A threading lock locks one PROCESS, and this store has two writers that are two processes: the
# uvicorn service under `rocoto-kit-runtime.service`, and the nightly sweep under
# `rocoto-kit-retention.service`. A recording webhook's `save()` landing inside the sweep's
# read-modify-write would put `recordingPath` back on a record whose wav had just been deleted —
# a record naming a file this box no longer holds, which is the exact claim RUN-00 forbids and the
# one `retention.py` exists to prevent. So the lock is an `fcntl.flock` on `calls/.lock`, which
# every process on this box respects, wrapped in an RLock so this process's own nested writers
# (retention holds it across delete-then-revise) meet it re-entrantly instead of deadlocking.
_reentrant = threading.RLock()
_depth = 0
_lock_fd: int | None = None


@contextlib.contextmanager
def hold():
    """The store's write lock: exclusive ACROSS processes, re-entrant INSIDE this one.

    Taken by every writer, and by any caller that must read and then write as one act. It creates
    `calls/` because it is the lock you take to WRITE — a reader never needs it, and a dry run
    never takes it, which is what keeps «the sweep creates nothing» true.
    """
    global _depth, _lock_fd
    with _reentrant:
        if _depth == 0:
            settings.calls_dir().mkdir(parents=True, exist_ok=True)
            _lock_fd = os.open(settings.calls_dir() / ".lock", os.O_CREAT | os.O_RDWR, 0o600)
            fcntl.flock(_lock_fd, fcntl.LOCK_EX)
        _depth += 1
        try:
            yield
        finally:
            _depth -= 1
            if _depth == 0 and _lock_fd is not None:
                fcntl.flock(_lock_fd, fcntl.LOCK_UN)
                os.close(_lock_fd)
                _lock_fd = None


def _path(sid: str):
    safe = "".join(c for c in (sid or "") if c.isalnum() or c in "-_")
    if not safe:
        raise ValueError("a call needs a sid")
    return settings.calls_dir() / f"{safe}.json"


def _write(path, record: dict[str, Any]) -> None:
    """Whole file or nothing.

    `write_text` truncates and then writes: a box that loses power in that window keeps a record
    that never parses again, which every later sweep counts as `unreadable` forever. The bytes go
    to a temp file beside it, are flushed to the disk, and `os.replace()` swaps them in — an atomic
    rename on the same filesystem, so a concurrent reader sees the old record or the new one and
    never half of either. The temp name deliberately ends in the pid rather than `.json`, so the
    sweep's own `glob('*.json')` cannot pick a half-written file up.
    """
    settings.calls_dir().mkdir(parents=True, exist_ok=True)
    temp = path.with_name(f"{path.name}.tmp-{os.getpid()}")
    try:
        with open(temp, "w", encoding="utf-8") as handle:
            handle.write(json.dumps(record, ensure_ascii=False, indent=1))
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp, path)
    finally:
        if temp.exists():
            temp.unlink()


def save(call: dict[str, Any]) -> dict[str, Any]:
    """Merge a partial call into its record, creating it when this is the first leg to arrive."""
    sid = call.get("sid") or ""
    path = _path(sid)
    with hold():
        current: dict[str, Any] = {}
        if path.exists():
            try:
                current = json.loads(path.read_text())
            except Exception:
                logger.warning("call record unreadable, rewriting", extra={"call_sid": sid})
        current.update({k: v for k, v in call.items() if v is not None})
        _write(path, current)
    return current


def revise(sid: str, patch: dict[str, Any], drop: tuple[str, ...] = ()) -> dict[str, Any] | None:
    """Merge in fields AND take fields away, on a record that already exists.

    `save()` can only add, because every webhook writer must be additive — a leg arriving late may
    not erase what an earlier leg established. Retention is the one writer that REMOVES: when the
    audio is deleted, a record still carrying `recordingPath: /srv/…/RE….wav` is a claim about a
    file this box no longer holds, and RUN-00 forbids the runtime to state something that is not
    so. This never creates a record — a missing one answers None — so a swept store stays swept.
    """
    path = _path(sid)
    with hold():
        if not path.exists():
            return None
        try:
            current: dict[str, Any] = json.loads(path.read_text())
        except Exception:
            logger.warning("call record unreadable, left alone", extra={"call_sid": sid})
            return None
        current.update({k: v for k, v in patch.items() if v is not None})
        for key in drop:
            current.pop(key, None)
        _write(path, current)
    return current


def get(sid: str) -> dict[str, Any] | None:
    path = _path(sid)
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text())
    except Exception:
        return None


def _digits(value: str) -> str:
    return "".join(c for c in (value or "") if c.isdigit())


def by_number(number: str) -> list[dict[str, Any]]:
    """Every call with this counterpart, newest first, matched on the nine significant digits."""
    wanted = _digits(number)[-9:]
    if not wanted:
        return []
    out = []
    directory = settings.calls_dir()
    if not directory.exists():
        return []
    for path in directory.glob("*.json"):
        try:
            call = json.loads(path.read_text())
        except Exception:
            continue
        if wanted in (_digits(call.get("to", ""))[-9:], _digits(call.get("from", ""))[-9:]):
            out.append(call)
    out.sort(key=lambda c: c.get("startedAt") or "", reverse=True)
    return out


def recording_path(recording_sid: str):
    safe = "".join(c for c in (recording_sid or "") if c.isalnum() or c in "-_")
    return settings.recordings_dir() / f"{safe}.wav"


# ── PAPER MANIFEST CUSTODY (PAR-10) ─────────────────────────────────────────────────────────
# A packing sheet records WHERE every cell it printed sits on the page, and hands that record here
# at print time. A photograph of that sheet then has an address for every box on it, which is the
# whole reason the read is exact rather than an OCR guess.
#
# The record is keyed by the QR's token, because the token is the only thing the paper itself
# carries (THE-QR-SPEC QR-01) — so the photo names its own manifest.
#
# ⚠ THE PHOTO IS NEVER WRITTEN HERE. `/api/paper/read` holds the bytes in memory for one request
# and drops them; the crops it answers with live in the response and nowhere else. This directory
# holds GEOMETRY and the printed values that geometry describes, and nothing that arrived from a
# camera (SRC-PRIV-01's «direct operator upload» line is exactly what is being kept out).

def _token_path(token: str):
    safe = "".join(c for c in (token or "").lower() if c.isalnum())[:13]
    if not safe:
        raise ValueError("a manifest needs a token")
    return settings.manifests_dir() / f"{safe}.json"


def save_manifest(token: str, manifest: dict[str, Any]) -> dict[str, Any]:
    """Keep one sheet's geometry, stamped with the hour it arrived, and sweep what has expired."""
    path = _token_path(token)
    record = {"token": token, "storedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "manifest": manifest}
    # ⚠ THE STORE'S WRITE LOCK IS `hold()`, ACROSS PROCESSES (resolved at RELEASE-195). E196 wrote
    # this against a plain `_lock` that its own base carried; E195's retention work replaced that
    # with an `fcntl.flock` on `calls/.lock` so the nightly sweep and the service meet each other.
    # A manifest write is a writer like any other and takes the same lock.
    with hold():
        settings.manifests_dir().mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(record, ensure_ascii=False, separators=(",", ":")))
    sweep_manifests()
    return record


def get_manifest(token: str) -> dict[str, Any] | None:
    """The stored manifest, or nothing at all. An unreadable file is nothing, and says so."""
    try:
        path = _token_path(token)
    except ValueError:
        return None
    if not path.exists():
        return None
    try:
        record = json.loads(path.read_text())
    except Exception:
        logger.warning("manifest record unreadable", extra={"outcome": "unreadable"})
        return None
    return record.get("manifest") if isinstance(record, dict) else None


def sweep_manifests(now: float | None = None) -> int:
    """RETENTION, and it runs on its own rather than waiting for a person (THE-RUNTIME-SPEC RUN-11.5).

    A manifest describes a sheet of paper somebody is holding this week. `paper_manifest_days` after
    it was recorded that sheet is history, and the geometry goes with it. The sweep is by FILE
    MTIME, so a manifest re-recorded by a re-print starts its life again — which is what a reprinted
    sheet is.
    """
    directory = settings.manifests_dir()
    if not directory.exists():
        return 0
    cutoff = (now if now is not None else time.time()) - settings.paper_manifest_days * 86400
    removed = 0
    for path in directory.glob("*.json"):
        try:
            if path.stat().st_mtime < cutoff:
                path.unlink()
                removed += 1
        except OSError:
            continue
    if removed:
        logger.info("manifests swept", extra={"outcome": f"{removed} expired"})
    return removed
