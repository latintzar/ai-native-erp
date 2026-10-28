"""Cedar scoped recording cleanup and text retention, using the voice runtime's existing clocks."""

from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any

import httpx

from . import phone_runtime as phone
from . import retention, twilio_voice
from .config import settings


async def delete_audio(workspace: str, row: dict[str, Any]) -> bool:
    """Only acknowledge provider deletion after its authenticated 204/already-absent response."""
    if row.get("recordingRemovedAt") or not row.get("recording_id"):
        return True
    conn = phone.connection(phone.db().read(workspace))
    if not twilio_voice.configured():
        return False
    path = f"/2010-04-01/Accounts/{settings.twilio_account_sid}/Recordings/{row['recording_id']}.json"
    try:
        async with httpx.AsyncClient(timeout=20, follow_redirects=False) as client:
            result = await client.delete(
                f"https://{phone.HOSTS[conn['region']]}{path}",
                auth=twilio_voice._auth(),
            )
        if result.status_code not in {204, 404}:
            return False
        phone.db().change(
            workspace,
            lambda s: s["calls"][row["sid"]].update(
                recordingRemovedAt=phone.now(),
                recordingCustody="none",
                recording_job="done",
            ),
        )
        return True
    except httpx.HTTPError:
        return False


async def cleanup_workspace(workspace: str) -> None:
    # A persisted schedule keeps restarts useful and checks every workspace, not only recent rows.
    phone.db().schedule_maintenance(workspace, time.time() + 300)
    state = phone.db().read(workspace)
    completed_deletes = 0
    for sid, row in state["calls"].items():
        if row.get("deletedAt"):
            continue
        try:
            started = datetime.fromisoformat(row["startedAt"].replace("Z", "+00:00"))
        except (ValueError, TypeError):
            continue
        age = (datetime.now(timezone.utc) - started).total_seconds() / 86400
        purge = settings.call_record_retention_days > 0 and age >= settings.call_record_retention_days
        text_expired = settings.transcript_retention_days > 0 and age >= settings.transcript_retention_days
        audio_expired = settings.audio_retention_days > 0 and age >= settings.audio_retention_days
        if row.get("recording_job") == "processing" and time.time() - row.get("recording_started", 0) < 180:
            continue
        delete = retention.has_words(row.get("transcript")) or audio_expired or purge
        if row.get("recording_id") and not row.get("recordingRemovedAt") and delete:
            if completed_deletes >= 10:
                break
            completed_deletes += 1
            if not await delete_audio(workspace, row):
                continue
        if purge or text_expired:

            def expire(
                s: dict[str, Any],
                call_sid: str = sid,
                purge_record: bool = purge,
            ) -> None:
                current = s["calls"][call_sid]
                if purge_record:
                    # Keep a tombstone so a delayed signed callback cannot recreate deleted content.
                    s["calls"][call_sid] = {
                        "sid": call_sid,
                        "from": "",
                        "to": "",
                        "direction": current["direction"],
                        "status": "completed",
                        "startedAt": current["startedAt"],
                        "legs": {},
                        "recordingCustody": "none",
                        "deletedAt": phone.now(),
                    }
                    return
                current.pop("transcript", None)
                current["liveTranscript"] = {"utterances": [], "language": "es", "provider": "deepgram"}
                current["transcriptRemovedAt"] = phone.now()
                for event in current.get("intake_events", []):
                    event["evidence"] = []
                    event["source_expired_at"] = current["transcriptRemovedAt"]

            phone.db().change(workspace, expire)
