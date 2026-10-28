"""cal.com API v2 client for Rocoto onboarding (brain/calbook.py).

A thin, FAIL-SOFT async wrapper over the three cal.com v2 endpoints the onboarding
flow + the ConvAI booking agent need:

  list_slots()      GET  /v2/slots     (cal-api-version 2024-09-04) → open slots
  create_booking()  POST /v2/bookings  (cal-api-version 2024-08-13) → book a call
  ensure_webhook()  GET/POST /v2/webhooks (cal-api-version 2024-08-13) → idempotent hook

EVERY function is total: it NEVER raises to the caller. On any failure (missing key,
network error, cal 4xx/5xx, weird payload) it returns {"ok": False, "error": "..."}.
On success it returns {"ok": True, ...}. This mirrors the additive + fail-soft build
contract — a broken calendar can degrade the wizard, it must never break the service.

Auth: `Authorization: Bearer {config.ROCOTO_CAL_API_KEY}` on every call.
Event type: `config.ROCOTO_CAL_EVENT_ID` (6252480 = rocoto-alta on account leo-casa).

cal.com's v2 responses are versioned + shape-drifty, so both the slots and the booking
parsers dig defensively through the known shapes rather than assuming one.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import httpx

import config

log = logging.getLogger("rocoto.calbook")

_BASE = "https://api.cal.com/v2"
_TZ = "Europe/Madrid"
# cal.com pins behaviour to a date-stamped API version per endpoint family.
_SLOTS_API_VERSION = "2024-09-04"
_BOOKINGS_API_VERSION = "2024-08-13"
_WEBHOOKS_API_VERSION = "2024-08-13"

# Cap on how many slots we hand back (a week of business hours is well under this).
_SLOT_CAP = 30
# Reasonable network timeouts — a slow calendar must not hang a wizard request.
_TIMEOUT = httpx.Timeout(15.0, connect=8.0)


def _auth_headers(api_version: str) -> dict:
    return {
        "Authorization": f"Bearer {config.ROCOTO_CAL_API_KEY}",
        "cal-api-version": api_version,
        "Content-Type": "application/json",
    }


def _have_key() -> bool:
    return bool((config.ROCOTO_CAL_API_KEY or "").strip())


def _err(msg: str) -> dict:
    return {"ok": False, "error": msg}


# ────────────────────────────── defensive parsers ──────────────────────────────

def _collect_slots(data: Any, out: list) -> None:
    """Recursively pull ISO start strings out of cal's slots payload.

    cal.com v2 has shipped several shapes for /slots:
      - {"data": {"2026-07-09": [{"start": "..."}], ...}}   (date → [ {start} ])
      - {"data": {"slots": {"2026-07-09": [{"start": "..."}]}}}
      - {"data": {"2026-07-09": ["2026-07-09T09:00:00Z", ...]}}  (bare iso strings)
      - {"slots": {...}}  (unwrapped)
    We walk dicts/lists generically and grab any 'start' field or bare iso-ish string,
    so a future re-shape still yields slots instead of an empty list.
    """
    if data is None:
        return
    if isinstance(data, str):
        s = data.strip()
        # crude iso check: has a date-time separator and digits
        if s and ("T" in s or " " in s) and s[:4].isdigit():
            out.append(s)
        return
    if isinstance(data, dict):
        start = data.get("start")
        if isinstance(start, str) and start.strip():
            out.append(start.strip())
            return  # this dict IS a slot; don't also recurse into its siblings
        for v in data.values():
            _collect_slots(v, out)
        return
    if isinstance(data, (list, tuple)):
        for v in data:
            _collect_slots(v, out)
        return


def _in_business_hours(iso: str) -> bool:
    """Keep only slots that START within Peter's calling window, 09:00–19:00 Madrid. cal.com returns
    slots already in the requested timeZone (Europe/Madrid), so the HH:MM in the ISO is the local time.
    A 20-min call started ≤18:40 finishes by 19:00; we allow starts 09:00–18:59."""
    import re as _re
    m = _re.search(r"T(\d{2}):(\d{2})", iso or "")
    if not m:
        return True  # can't parse → don't drop it
    h = int(m.group(1))
    return 9 <= h < 19


def _pick_booking_uid(payload: Any) -> Optional[str]:
    """cal wraps the created booking under {"data": {...}} (or returns it bare). Pull the uid."""
    for candidate in (
        payload,
        payload.get("data") if isinstance(payload, dict) else None,
    ):
        if isinstance(candidate, dict):
            uid = candidate.get("uid") or candidate.get("bookingUid") or candidate.get("id")
            if uid:
                return str(uid)
    return None


# ─────────────────────────────────── public API ───────────────────────────────────

async def list_slots(days: int = 7) -> dict:
    """List open booking slots for the rocoto-alta event over the next `days` days.

    GET /v2/slots (cal-api-version 2024-09-04) with eventTypeId, start=today, end=today+days,
    timeZone=Europe/Madrid. Returns {"ok": True, "slots": [iso, ...]} (flattened, de-duped,
    sorted, capped at ~30) on success; {"ok": False, "error": ...} on any failure.
    """
    if not _have_key():
        return _err("cal.com API key not configured (ROCOTO_CAL_API_KEY empty)")

    try:
        now = datetime.now(timezone.utc)
        start = now.date().isoformat()
        end = (now + timedelta(days=max(1, int(days)))).date().isoformat()
        params = {
            "eventTypeId": config.ROCOTO_CAL_EVENT_ID,
            "start": start,
            "end": end,
            "timeZone": _TZ,
        }
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            r = await client.get(
                f"{_BASE}/slots",
                params=params,
                headers=_auth_headers(_SLOTS_API_VERSION),
            )
    except Exception as e:  # network / DNS / timeout / anything
        log.warning("calbook.list_slots network error: %s", e)
        return _err(f"network error: {e}")

    if r.status_code >= 400:
        log.warning("calbook.list_slots HTTP %s: %s", r.status_code, r.text[:300])
        return _err(f"cal.com {r.status_code}: {r.text[:200]}")

    try:
        body = r.json()
    except Exception as e:
        return _err(f"bad json: {e}")

    # cal nests under "data"; some shapes put it at the top level — hand both to the collector.
    root = body.get("data") if isinstance(body, dict) else body
    collected: list = []
    _collect_slots(root, collected)
    # de-dupe + sort (iso strings sort chronologically), keep only 9:00–19:00 Madrid, then cap.
    uniq = sorted(set(s for s in collected if isinstance(s, str) and s.strip()))
    slots = [s for s in uniq if _in_business_hours(s)][:_SLOT_CAP]
    return {"ok": True, "slots": slots}


async def create_booking(
    name: str,
    email: str,
    phone: str,
    start_iso: str,
    tz: str = _TZ,
) -> dict:
    """Book the rocoto-alta call at `start_iso` for the given attendee.

    POST /v2/bookings (cal-api-version 2024-08-13). Returns {"ok": True, "uid": ..., "raw": {...}}
    on success; {"ok": False, "error": ...} on any failure. Never raises.
    """
    if not _have_key():
        return _err("cal.com API key not configured (ROCOTO_CAL_API_KEY empty)")
    if not start_iso:
        return _err("start_iso is required")

    attendee = {
        "name": (name or "").strip() or "Cliente Rocoto",
        "email": (email or "").strip(),
        "timeZone": tz or _TZ,
        "language": "es",
    }
    if (phone or "").strip():
        attendee["phoneNumber"] = phone.strip()

    payload = {
        "start": start_iso,
        "eventTypeId": config.ROCOTO_CAL_EVENT_ID,
        "attendee": attendee,
        "metadata": {"source": "rocoto-onboarding"},
    }

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            r = await client.post(
                f"{_BASE}/bookings",
                json=payload,
                headers=_auth_headers(_BOOKINGS_API_VERSION),
            )
    except Exception as e:
        log.warning("calbook.create_booking network error: %s", e)
        return _err(f"network error: {e}")

    if r.status_code >= 400:
        log.warning("calbook.create_booking HTTP %s: %s", r.status_code, r.text[:400])
        return _err(f"cal.com {r.status_code}: {r.text[:250]}")

    try:
        body = r.json()
    except Exception as e:
        return _err(f"bad json: {e}")

    uid = _pick_booking_uid(body)
    if not uid:
        log.warning("calbook.create_booking: no uid in response %s", str(body)[:300])
        return _err("cal.com returned no booking uid")

    return {"ok": True, "uid": uid, "raw": body}


_RESCHEDULE_API_VERSION = "2024-08-13"


async def reschedule_booking(uid: str, start_iso: str, reason: str = "") -> dict:
    """Move an existing booking to a new start time.

    POST /v2/bookings/{uid}/reschedule (cal-api-version 2024-08-13). cal.com may mint a new uid on a
    reschedule, so we return whatever uid it hands back (falling back to the original). Returns
    {"ok": True, "uid": ..., "start": ...} on success; {"ok": False, "error": ...} on any failure.
    Never raises. Mirrors create_booking's fail-soft style."""
    if not _have_key():
        return _err("cal.com API key not configured (ROCOTO_CAL_API_KEY empty)")
    if not (uid or "").strip() or not (start_iso or "").strip():
        return _err("uid and start_iso are required")
    uid = uid.strip()

    payload = {"start": start_iso}
    if (reason or "").strip():
        payload["reschedulingReason"] = reason.strip()

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            r = await client.post(
                f"{_BASE}/bookings/{uid}/reschedule",
                json=payload,
                headers=_auth_headers(_RESCHEDULE_API_VERSION),
            )
    except Exception as e:
        log.warning("calbook.reschedule_booking network error: %s", e)
        return _err(f"network error: {e}")

    if r.status_code >= 400:
        log.warning("calbook.reschedule_booking HTTP %s: %s", r.status_code, r.text[:400])
        return _err(f"cal.com {r.status_code}: {r.text[:250]}")

    try:
        body = r.json()
    except Exception as e:
        return _err(f"bad json: {e}")

    new_uid = _pick_booking_uid(body) or uid  # cal may mint a new uid on reschedule
    return {"ok": True, "uid": new_uid, "start": start_iso}


async def ensure_webhook(callback_url: str) -> dict:
    """Idempotently register a BOOKING_CREATED webhook pointing at `callback_url`.

    GET /v2/webhooks — if a webhook with subscriberUrl == callback_url already exists, no-op.
    Otherwise POST /v2/webhooks to create it. Returns {"ok": True, "created": bool} on success;
    {"ok": False, "error": ...} on any failure. Never raises.
    """
    if not _have_key():
        return _err("cal.com API key not configured (ROCOTO_CAL_API_KEY empty)")
    if not (callback_url or "").strip():
        return _err("callback_url is required")
    callback_url = callback_url.strip()

    # 1) list existing webhooks
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            r = await client.get(
                f"{_BASE}/webhooks",
                headers=_auth_headers(_WEBHOOKS_API_VERSION),
            )
    except Exception as e:
        log.warning("calbook.ensure_webhook list network error: %s", e)
        return _err(f"network error (list): {e}")

    if r.status_code >= 400:
        log.warning("calbook.ensure_webhook list HTTP %s: %s", r.status_code, r.text[:300])
        return _err(f"cal.com {r.status_code} (list): {r.text[:200]}")

    try:
        body = r.json()
    except Exception as e:
        return _err(f"bad json (list): {e}")

    hooks = body.get("data") if isinstance(body, dict) else body
    if isinstance(hooks, dict):
        # some shapes wrap the list one level deeper: {"data": {"webhooks": [...]}}
        hooks = hooks.get("webhooks") if isinstance(hooks.get("webhooks"), list) else [hooks]
    if not isinstance(hooks, list):
        hooks = []
    for h in hooks:
        if isinstance(h, dict) and (h.get("subscriberUrl") or "").strip() == callback_url:
            return {"ok": True, "created": False}

    # 2) not found → create it
    create_payload = {
        "subscriberUrl": callback_url,
        "triggers": ["BOOKING_CREATED"],
        "active": True,
    }
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            r2 = await client.post(
                f"{_BASE}/webhooks",
                json=create_payload,
                headers=_auth_headers(_WEBHOOKS_API_VERSION),
            )
    except Exception as e:
        log.warning("calbook.ensure_webhook create network error: %s", e)
        return _err(f"network error (create): {e}")

    if r2.status_code >= 400:
        log.warning("calbook.ensure_webhook create HTTP %s: %s", r2.status_code, r2.text[:400])
        return _err(f"cal.com {r2.status_code} (create): {r2.text[:250]}")

    return {"ok": True, "created": True}
