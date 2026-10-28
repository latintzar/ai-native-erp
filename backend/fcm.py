"""Firebase Cloud Messaging (HTTP v1) — push notifications to the Android app.

Mints a short-lived OAuth access token from a service-account JSON and posts a
notification to each registered device token. If the service account isn't present
(credentials not yet provisioned), every call is a graceful no-op.
"""
from __future__ import annotations

import logging
import os
import threading
from typing import Optional

import httpx

import config

log = logging.getLogger("rocoto.fcm")

_SCOPE = "https://www.googleapis.com/auth/firebase.messaging"
_lock = threading.Lock()
_creds = None  # google.oauth2.service_account.Credentials, lazily loaded


def available() -> bool:
    return bool(config.FCM_CREDENTIALS_PATH and os.path.exists(config.FCM_CREDENTIALS_PATH))


def _load_creds():
    global _creds
    if _creds is not None:
        return _creds
    with _lock:
        if _creds is not None:
            return _creds
        try:
            from google.oauth2 import service_account  # type: ignore
            _creds = service_account.Credentials.from_service_account_file(
                config.FCM_CREDENTIALS_PATH, scopes=[_SCOPE]
            )
        except Exception:
            log.exception("FCM: failed to load service account")
            _creds = None
        return _creds


def _access_token() -> Optional[str]:
    creds = _load_creds()
    if creds is None:
        return None
    try:
        from google.auth.transport.requests import Request  # type: ignore
        if not creds.valid:
            creds.refresh(Request())
        return creds.token
    except Exception:
        log.exception("FCM: token refresh failed")
        return None


def _send_one(token: str, access_token: str, title: str, body: str, data: dict) -> Optional[int]:
    url = f"https://fcm.googleapis.com/v1/projects/{config.FCM_PROJECT_ID}/messages:send"
    payload = {
        "message": {
            "token": token,
            "notification": {"title": title, "body": body},
            "data": {k: str(v) for k, v in (data or {}).items()},
            "android": {
                "priority": "HIGH",
                "notification": {"channel_id": "sancho_messages", "sound": "default"},
            },
        }
    }
    try:
        with httpx.Client(timeout=10) as c:
            r = c.post(url, json=payload, headers={"Authorization": f"Bearer {access_token}"})
        if r.status_code == 200:
            return 200
        # 404/UNREGISTERED → token is dead; signal caller to prune it.
        log.warning("FCM send -> %s: %s", r.status_code, r.text[:200])
        return r.status_code
    except Exception:
        log.exception("FCM send failed")
        return None


def push_to_all(tokens: list[str], title: str, body: str, data: Optional[dict] = None) -> list[str]:
    """Send a notification to every token. Returns the list of dead tokens to prune."""
    if not tokens or not available():
        return []
    at = _access_token()
    if not at:
        return []
    dead: list[str] = []
    for tok in tokens:
        code = _send_one(tok, at, title, body, data or {})
        if code in (404, 400, 403):
            dead.append(tok)
    return dead
