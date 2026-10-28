"""Cedar's scoped human phone rail. Provider facts, intents and transcript custody stay server-side."""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import logging
import re
import secrets
import time
from contextlib import suppress
from datetime import datetime, timezone
from typing import Any, Literal
from urllib.parse import urlencode, urlsplit
from xml.sax.saxutils import escape

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request, WebSocket
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict, Field
from twilio.jwt.access_token import AccessToken
from twilio.jwt.access_token.grants import VoiceGrant

from . import cedar_access, deepgram, retention, twilio_voice
from .config import settings
from .errors import RuntimeError_
from .phone_store import PhoneStore, append_intake

router = APIRouter(prefix="/api/cedar/phone")
PREFIX = "/api/cedar/phone"
logger = logging.getLogger("rocoto.runtime.cedar_phone")
E164 = re.compile(r"^\+[1-9]\d{7,14}$")
SID = re.compile(r"^CA[0-9a-fA-F]{32}$")
HOSTS = {"us1": "api.twilio.com", "ie1": "api.dublin.ie1.twilio.com", "au1": "api.sydney.au1.twilio.com"}
TERMINAL = {"completed", "busy", "failed", "no-answer", "canceled"}
_jobs: set[asyncio.Task] = set()


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def db() -> PhoneStore:
    return PhoneStore(settings.state_dir)


def fail(code: str, status: int = 409) -> RuntimeError_:
    return RuntimeError_(
        code, "Review the phone connection and its current readiness, then try again.", status
    )


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Setup(Input):
    source_number: str = Field(default="", max_length=16)
    fallback_number: str = Field(default="", max_length=16)
    recording: Literal["off", "notice"] = "off"
    live_transcription: bool = False


COUNTRY = re.compile(r"^[A-Z]{2}$")
COMPLIANCE_KEYS = {
    "BundleSid": re.compile(r"^BU[0-9a-fA-F]{32}$"),
    "AddressSid": re.compile(r"^AD[0-9a-fA-F]{32}$"),
}
NOTICE_TEXT = "Esta llamada se grabará para gestionar tu pedido."


class Commission(Input):
    """Operator authority for one workspace: an owned number, or the right to issue one.

    `inbound_number` binds a number the account already owns. `issue_number` instead grants the
    workspace the right to have Rocoto buy its number the moment the business enters its own
    number (the setup step), trying `number_countries` in order; the issued number is the caller
    ID, so no caller-ID verification step remains. `notice` decides what a recorded call hears
    first: nothing, the spoken Spanish sentence, or an audio file at `notice_audio_url`.
    """

    line_id: str | None = Field(default=None, pattern=r"^line_[A-Za-z0-9_-]{16,64}$")
    inbound_number: str = Field(default="", max_length=16)
    caller_id: str = Field(default="", max_length=16)
    issue_number: bool = False
    number_countries: list[str] = Field(default_factory=list, max_length=6)
    compliance: dict[str, dict[str, str]] = Field(default_factory=dict)
    allowed_destinations: list[str] = Field(min_length=1, max_length=20)
    region: Literal["us1", "ie1", "au1"]
    deepgram_region: Literal["eu", "us"]
    account_owner: str = Field(min_length=1, max_length=120)
    operations_approved: Literal[True]
    recording_policy_approved: bool = False
    notice: Literal["none", "spoken", "audio"] = "none"
    notice_audio_url: str = Field(default="", max_length=400)
    configure_webhooks: bool = False


class NumberInput(Input):
    number: str = Field(pattern=E164.pattern)


class ForwardingInput(Input):
    expected_from: str = Field(pattern=E164.pattern)


class DeviceInput(Input):
    device_id: str = Field(default="browser", pattern=r"^[A-Za-z0-9_-]{1,64}$")


class CallInput(Input):
    to: str = Field(pattern=E164.pattern)
    mode: Literal["browser", "phone"] = "browser"
    idempotency_key: str = Field(min_length=1, max_length=120)


async def owner(request: Request) -> str:
    return cedar_access.authorize(request)


async def operator(request: Request) -> None:
    cedar_access.require_operator(request)


def public(path: str) -> str:
    base = settings.public_base
    parsed = urlsplit(base)
    if parsed.scheme != "https" or not parsed.hostname or parsed.query or parsed.fragment:
        raise fail("phone_public_origin_required", 503)
    return base + PREFIX + path


def selected_line(state: dict[str, Any], line_id: str | None = None) -> dict[str, Any]:
    selected = line_id or state.get("default_line")
    line = state.get("lines", {}).get(selected) if selected else None
    if not line:
        raise fail(
            "phone_commissioning_required" if line_id is None else "phone_line_missing",
            503 if line_id is None else 404,
        )
    return line


def connection(state: dict[str, Any], line_id: str | None = None) -> dict[str, Any]:
    if state.get("lines"):
        selected = line_id or state.get("default_line")
        line = state["lines"].get(selected) if selected else None
        if not line:
            raise fail(
                "phone_commissioning_required" if line_id is None else "phone_line_missing",
                503 if line_id is None else 404,
            )
        if line.get("disconnecting"):
            raise fail("phone_line_disconnecting")
        result = line.get("connection")
    else:
        result = state.get("connection")
    if not result or not result.get("account_verified"):
        raise fail("phone_commissioning_required", 503)
    if result.get("account_sid") != settings.twilio_account_sid:
        raise fail("phone_account_commissioning_changed", 503)
    return result


def line_projection(state: dict[str, Any], line: dict[str, Any]) -> dict[str, Any]:
    conn = line.get("connection") or {}
    setup = line["setup"]
    verified = bool(conn.get("account_verified") and conn.get("account_sid") == settings.twilio_account_sid)
    return {
        "line_id": line["id"],
        "mode": "commissioned" if conn else "prepared",
        "setup": setup,
        "readiness": {
            "configured": twilio_voice.configured(),
            "account_verified": verified,
            "inbound_number": conn.get("inbound_number", ""),
            "caller_id": conn.get("caller_id", ""),
            "caller_id_verified": verified and (
                conn.get("caller_id_verified", False) or conn.get("caller_id") == conn.get("inbound_number")
            ),
            "browser_ready": bool(
                verified and conn.get("app_verified") and settings.twilio_api_key_sid
                and settings.twilio_api_key_secret
            ),
            "forwarding_state": line["checks"].get("forwarding_state", "not-run"),
            "transcription_ready": bool(
                verified and settings.deepgram_key and conn.get("recording_policy_approved")
            ),
        },
        "checks": line["checks"],
    }


async def provider_try(
    conn: dict[str, Any], path: str, *, data: dict[str, str] | None = None, account_auth: bool = False
) -> tuple[int, dict[str, Any]]:
    """One provider request whose 4xx answer is a fact to record rather than a failure to raise.

    Measured 2026-09-11 on the selected account: a Standard API key answers 401 on the Account
    resource itself and 200 everywhere else, so the account-status read (`account_auth`) uses the
    account SID and token while every other call keeps the rotatable key.
    """
    if not twilio_voice.configured():
        raise fail("phone_credentials_required", 503)
    if (not path.startswith("/") and path != ".json") or ".." in path:
        raise fail("phone_provider_path")
    url = f"https://{HOSTS[conn['region']]}/2010-04-01/Accounts/{settings.twilio_account_sid}{path}"
    auth = (
        (settings.twilio_account_sid, settings.twilio_auth_token) if account_auth else twilio_voice._auth()
    )
    try:
        async with httpx.AsyncClient(timeout=20, follow_redirects=False) as client:
            response = await client.request("POST" if data is not None else "GET", url, data=data, auth=auth)
        body = response.json() if response.content else {}
        if not isinstance(body, dict):
            raise ValueError()
        if response.status_code >= 400:
            logger.warning(
                "provider rejected",
                extra={
                    "route": path.split("?")[0],
                    "status": response.status_code,
                    "outcome": str(body.get("code", "")),
                },
            )
        return response.status_code, body
    except (httpx.HTTPError, ValueError):
        raise fail("phone_provider_unavailable", 502) from None


async def provider(
    conn: dict[str, Any], path: str, *, data: dict[str, str] | None = None, account_auth: bool = False
) -> dict[str, Any]:
    status, body = await provider_try(conn, path, data=data, account_auth=account_auth)
    if status >= 400:
        raise fail("phone_provider_rejected", 502)
    return body


def projection(state: dict[str, Any]) -> dict[str, Any]:
    lines = [line_projection(state, line) for line in state.get("lines", {}).values()]
    default = next((line for line in lines if line["line_id"] == state.get("default_line")), None)
    if default:
        return {
            "workspace_id": state["id"],
            "default_line_id": default["line_id"],
            "lines": lines,
            **{key: default[key] for key in ("mode", "setup", "readiness", "checks")},
        }
    return {
        "workspace_id": state["id"],
        "mode": "sample",
        "setup": state["setup"],
        "readiness": {
            "configured": twilio_voice.configured(),
            "account_verified": False,
            "inbound_number": "",
            "caller_id": "",
            "caller_id_verified": False,
            "browser_ready": False,
            "forwarding_state": "not-run",
            "transcription_ready": False,
        },
        "checks": {},
        "default_line_id": None,
        "lines": lines,
    }


@router.get("/setup")
async def get_setup(workspace: str = Depends(owner)) -> dict[str, Any]:
    return projection(db().read(workspace))


@router.post("/setup")
async def set_setup(data: Setup, workspace: str = Depends(owner)) -> dict[str, Any]:
    for number in (data.source_number, data.fallback_number):
        if number and not E164.fullmatch(number):
            raise fail("phone_number_invalid", 422)

    def change(state: dict[str, Any]) -> None:
        if state.get("lines") and state["setup"] != data.model_dump():
            raise fail("phone_setup_already_commissioned")
        if state["setup"]["source_number"] != data.source_number:
            state["checks"] = {}
        state["setup"] = data.model_dump()

    db().change(workspace, change)
    return await get_setup(workspace)


@router.post("/lines")
async def add_line(data: Setup, workspace: str = Depends(owner)) -> dict[str, Any]:
    for number in (data.source_number, data.fallback_number):
        if not E164.fullmatch(number):
            raise fail("phone_number_invalid", 422)
    if data.source_number == data.fallback_number:
        raise fail("phone_distinct_fallback_required", 422)

    def add(state: dict[str, Any]) -> str:
        for line in state["lines"].values():
            if line["setup"]["source_number"] == data.source_number:
                return line["id"]
        if len(state["lines"]) >= 5:
            raise fail("phone_line_capacity")
        identity = "line_" + secrets.token_urlsafe(18)
        state["lines"][identity] = {
            "id": identity, "setup": data.model_dump(), "connection": None, "checks": {}
        }
        return identity

    identity = db().change(workspace, add)
    state = db().read(workspace)
    if state.get("issue") and not selected_line(state, identity).get("connection"):
        await issue_line_number(workspace, identity)
    current = db().read(workspace)
    return line_projection(current, selected_line(current, identity))


def number_tag(workspace: str) -> str:
    return "rocoto-" + workspace[:12]


async def issue_line_number(workspace: str, line_id: str) -> None:
    """Buy this workspace's number at setup time, once, and bind it as the line's connection.

    The purchase is the one external effect: it is guarded by the runtime-wide
    `TWILIO_NUMBER_ISSUE_LIMIT`, tagged with the workspace so an interrupted run reuses the number
    it already bought, and tried country by country in the operator's order. A country whose
    regulation the account cannot satisfy answers 4xx and is recorded, then skipped.
    """
    state = db().read(workspace)
    grant = state["issue"]
    if grant.get("account_sid") != settings.twilio_account_sid:
        raise fail("phone_account_commissioning_changed", 503)
    if db().issued_count() >= settings.twilio_number_issue_limit:
        raise fail("phone_number_issue_limit", 503)
    public("/twilio/inbound")

    def reserve(s: dict[str, Any]) -> bool:
        line = selected_line(s, line_id)
        if line.get("issuing"):
            raise fail("phone_number_issuing")
        if line.get("connection"):
            return False
        line["issuing"] = True
        return True

    if not db().change(workspace, reserve):
        return
    tag = number_tag(workspace)
    hooks = {
        "VoiceUrl": public("/twilio/inbound"),
        "VoiceMethod": "POST",
        "StatusCallback": public("/twilio/status"),
        "StatusCallbackMethod": "POST",
    }
    try:
        owned = await provider(
            grant, "/IncomingPhoneNumbers.json?" + urlencode({"FriendlyName": tag, "PageSize": 5})
        )
        chosen = next(
            (
                row for row in owned.get("incoming_phone_numbers", [])
                if row.get("friendly_name") == tag and row.get("capabilities", {}).get("voice")
                and E164.fullmatch(str(row.get("phone_number", "")))
            ),
            None,
        )
        attempts: list[dict[str, Any]] = []
        issued_country = str(chosen.get("iso_country") or "") if chosen else ""
        for country in grant["number_countries"] if not chosen else []:
            for kind in ("Local", "Mobile"):
                status, page = await provider_try(
                    grant,
                    f"/AvailablePhoneNumbers/{country}/{kind}.json?"
                    + urlencode({"VoiceEnabled": "true", "PageSize": 3}),
                )
                candidates = [
                    str(row.get("phone_number", ""))
                    for row in page.get("available_phone_numbers", [])
                    if status == 200 and E164.fullmatch(str(row.get("phone_number", "")))
                ]
                if not candidates:
                    attempts.append(
                        {"country": country, "kind": kind, "status": status, "code": page.get("code")}
                    )
                for candidate in candidates[:2]:
                    status, body = await provider_try(
                        grant,
                        "/IncomingPhoneNumbers.json",
                        data={
                            "PhoneNumber": candidate,
                            "FriendlyName": tag,
                            **hooks,
                            **grant.get("compliance", {}).get(country, {}),
                        },
                    )
                    if status in (200, 201) and E164.fullmatch(str(body.get("phone_number", ""))):
                        chosen, issued_country = body, country
                        break
                    attempts.append(
                        {"country": country, "kind": kind, "status": status, "code": body.get("code")}
                    )
                if chosen:
                    break
            if chosen:
                break
        if not chosen:
            db().change(
                workspace,
                lambda s: selected_line(s, line_id)["checks"].update(
                    number={"issued": False, "attempts": attempts[:12], "at": now()}
                ),
            )
            raise fail("phone_number_unavailable", 502)
        if (
            chosen.get("voice_url") != hooks["VoiceUrl"]
            or chosen.get("status_callback") != hooks["StatusCallback"]
        ):
            chosen = await provider(grant, f"/IncomingPhoneNumbers/{chosen['sid']}.json", data=hooks)
        if chosen.get("voice_url") != hooks["VoiceUrl"]:
            raise fail("phone_inbound_webhook_required")
        number = str(chosen["phone_number"])
        bound = db().number_workspace(number)
        if bound and bound != workspace:
            raise fail("phone_number_bound")
        conn = {
            key: grant[key]
            for key in (
                "allowed_destinations", "region", "deepgram_region", "account_owner",
                "operations_approved", "recording_policy_approved", "notice", "notice_audio_url",
            )
        }
        conn.update(
            inbound_number=number,
            caller_id=number,
            caller_id_verified=True,
            issue_number=True,
            number_countries=grant["number_countries"],
            configure_webhooks=True,
            account_verified=True,
            account_sid=settings.twilio_account_sid,
            app_verified=True,
            inbound_sid=chosen["sid"],
            issued=True,
            commissioned_at=now(),
        )

        def bind(s: dict[str, Any]) -> None:
            line = selected_line(s, line_id)
            if line.get("connection"):
                raise fail("phone_connection_already_bound")
            line["connection"] = conn
            line["checks"]["number"] = {
                "issued": True,
                "number": number,
                "country": issued_country,
                "at": conn["commissioned_at"],
            }
            if not s.get("default_line"):
                s["default_line"] = line_id

        db().change(workspace, bind)
        db().record_issued(number, workspace, line_id, str(chosen["sid"]))
    finally:
        def release(s: dict[str, Any]) -> None:
            current = s.get("lines", {}).get(line_id)
            if current:
                current.pop("issuing", None)

        db().change(workspace, release)


@router.post("/lines/{line_id}/default")
async def set_default_line(line_id: str, workspace: str = Depends(owner)) -> dict[str, Any]:
    def choose(state: dict[str, Any]) -> None:
        line = selected_line(state, line_id)
        if not line.get("connection"):
            raise fail("phone_commissioning_required", 503)
        state["default_line"] = line_id

    db().change(workspace, choose)
    return await get_setup(workspace)


@router.post("/lines/{line_id}/setup")
async def set_line_setup(
    line_id: str, data: Setup, workspace: str = Depends(owner)
) -> dict[str, Any]:
    for number in (data.source_number, data.fallback_number):
        if not E164.fullmatch(number):
            raise fail("phone_number_invalid", 422)
    if data.source_number == data.fallback_number:
        raise fail("phone_distinct_fallback_required", 422)

    def save(state: dict[str, Any]) -> None:
        line = selected_line(state, line_id)
        current = line["setup"]
        if line.get("connection") and (
            current["source_number"] != data.source_number
            or current["fallback_number"] != data.fallback_number
        ):
            raise fail("phone_connection_already_bound")
        if (
            data.recording == "notice"
            and line.get("connection")
            and not line["connection"].get("recording_policy_approved")
        ):
            raise fail("phone_recording_policy_required")
        line["setup"] = data.model_dump()

    db().change(workspace, save)
    current = db().read(workspace)
    return line_projection(current, selected_line(current, line_id))


@router.delete("/lines/{line_id}")
async def disconnect_line(line_id: str, workspace: str = Depends(owner)) -> dict[str, Any]:
    state = db().read(workspace)
    selected_line(state, line_id)
    conn = connection(state, line_id)

    def reserve(value: dict[str, Any]) -> None:
        selected = selected_line(value, line_id)
        if selected.get("disconnecting"):
            raise fail("phone_line_disconnecting")
        selected["disconnecting"] = True

    db().change(workspace, reserve)
    try:
        reserved = db().read(workspace)
        active_calls = [
            row for row in reserved["calls"].values()
            if row.get("lineId") == line_id and row.get("status") not in TERMINAL
        ]
        for row in active_calls:
            result = await provider(
                conn, f"/Calls/{row['sid']}.json", data={"Status": "completed"}
            )
            if result.get("sid") != row["sid"]:
                raise fail("phone_call_mismatch")
        cleared = await provider(
            conn,
            f"/IncomingPhoneNumbers/{conn['inbound_sid']}.json",
            data={
                "VoiceUrl": "",
                "VoiceMethod": "POST",
                "StatusCallback": "",
                "StatusCallbackMethod": "POST",
            },
        )
        if (
            cleared.get("sid") != conn["inbound_sid"]
            or cleared.get("voice_url")
            or cleared.get("status_callback")
        ):
            raise fail("phone_provider_rejected", 502)
    except Exception:
        def restore(value: dict[str, Any]) -> None:
            current = value.get("lines", {}).get(line_id)
            if current:
                current.pop("disconnecting", None)

        db().change(workspace, restore)
        raise

    stamp = now()

    def remove(value: dict[str, Any]) -> None:
        current = selected_line(value, line_id)
        if current.get("connection", {}).get("inbound_sid") != conn["inbound_sid"]:
            raise fail("phone_connection_already_bound")
        for row in value["calls"].values():
            if row.get("lineId") == line_id and row.get("status") not in TERMINAL:
                row.update(status="completed", endedAt=stamp)
        value["intents"] = {
            key: intent for key, intent in value["intents"].items()
            if intent.get("line_id") != line_id
        }
        del value["lines"][line_id]
        if value.get("default_line") == line_id:
            value["default_line"] = None
            value["connection"] = None
            value["checks"] = {}
            value["setup"] = {
                "source_number": "",
                "fallback_number": "",
                "recording": "off",
                "live_transcription": False,
            }
        if not any(item.get("connection") for item in value["lines"].values()):
            value["devices"] = {}

    db().change(workspace, remove)
    return await get_setup(workspace)


@router.post("/operator/{workspace}/commission", dependencies=[Depends(operator)])
async def commission(workspace: str, data: Commission) -> dict[str, Any]:
    if not cedar_access.workspace_exists(workspace):
        raise fail("phone_workspace_missing", 404)
    if any(not E164.fullmatch(number) for number in data.allowed_destinations):
        raise fail("phone_number_invalid", 422)
    if data.issue_number == bool(data.inbound_number):
        raise fail("phone_inbound_or_issue_required", 422)
    if data.inbound_number and not E164.fullmatch(data.inbound_number):
        raise fail("phone_number_invalid", 422)
    if data.caller_id and not E164.fullmatch(data.caller_id):
        raise fail("phone_number_invalid", 422)
    if data.issue_number and (
        not data.number_countries or any(not COUNTRY.fullmatch(code) for code in data.number_countries)
    ):
        raise fail("phone_number_countries_required", 422)
    for country, values in data.compliance.items():
        if not COUNTRY.fullmatch(country) or any(
            key not in COMPLIANCE_KEYS or not COMPLIANCE_KEYS[key].fullmatch(value)
            for key, value in values.items()
        ):
            raise fail("phone_compliance_invalid", 422)
    audio = urlsplit(data.notice_audio_url) if data.notice_audio_url else None
    if data.notice == "audio" and (
        audio is None or audio.scheme != "https" or not audio.hostname or audio.username
    ):
        raise fail("phone_notice_audio_required", 422)
    if data.notice != "audio" and data.notice_audio_url:
        raise fail("phone_notice_audio_required", 422)
    public("/twilio/inbound")
    if data.issue_number:
        return await grant_issuance(workspace, data)
    if not data.caller_id:
        data.caller_id = data.inbound_number
    bound = db().number_workspace(data.inbound_number)
    if bound and bound != workspace:
        raise fail("phone_number_bound")
    conn = data.model_dump(exclude={"line_id"})
    state = db().read(workspace)
    if data.line_id:
        line = selected_line(state, data.line_id)
    elif state.get("default_line"):
        line = selected_line(state)
    else:
        identity = "line_" + secrets.token_urlsafe(18)
        line = {"id": identity, "setup": state["setup"], "connection": None, "checks": state["checks"]}
    if any(
        item["id"] != line["id"]
        and (item.get("connection") or {}).get("inbound_number") == data.inbound_number
        for item in state["lines"].values()
    ):
        raise fail("phone_number_bound")
    prior = line.get("connection")
    if prior and (
        prior.get("account_sid") != settings.twilio_account_sid
        or any(prior.get(key) != value for key, value in conn.items())
    ):
        raise fail("phone_connection_already_bound")
    setup = line["setup"]
    if setup["fallback_number"] and setup["fallback_number"] in {
        setup["source_number"],
        data.inbound_number,
    }:
        raise fail("phone_distinct_fallback_required")
    if (
        setup["fallback_number"]
        and setup["fallback_number"] not in data.allowed_destinations
    ):
        raise fail("phone_fallback_authorization_required")
    if setup["recording"] == "notice" and not data.recording_policy_approved:
        raise fail("phone_recording_policy_required")
    account = await provider(conn, ".json", account_auth=True)
    if account.get("sid") != settings.twilio_account_sid or account.get("status") != "active":
        raise fail("phone_account_inactive")
    numbers = await provider(
        conn, "/IncomingPhoneNumbers.json?" + urlencode({"PhoneNumber": data.inbound_number, "PageSize": 20})
    )
    owned = [
        row
        for row in numbers.get("incoming_phone_numbers", [])
        if row.get("phone_number") == data.inbound_number
    ]
    if len(owned) != 1 or not owned[0].get("capabilities", {}).get("voice"):
        raise fail("phone_inbound_number_required")
    if data.configure_webhooks:
        owned[0] = await provider(
            conn,
            f"/IncomingPhoneNumbers/{owned[0]['sid']}.json",
            data={
                "VoiceUrl": public("/twilio/inbound"),
                "VoiceMethod": "POST",
                "StatusCallback": public("/twilio/status"),
                "StatusCallbackMethod": "POST",
            },
        )
    if owned[0].get("voice_url") != public("/twilio/inbound") or owned[0].get("voice_method") != "POST":
        raise fail("phone_inbound_webhook_required")
    if not settings.twilio_twiml_app_sid:
        raise fail("phone_twiml_application_required")
    application = await provider(conn, f"/Applications/{settings.twilio_twiml_app_sid}.json")
    if data.configure_webhooks:
        application = await provider(
            conn,
            f"/Applications/{settings.twilio_twiml_app_sid}.json",
            data={"VoiceUrl": public("/twilio/browser"), "VoiceMethod": "POST"},
        )
    if application.get("voice_url") != public("/twilio/browser") or application.get("voice_method") != "POST":
        raise fail("phone_browser_webhook_required")
    conn.update(
        account_verified=True,
        account_sid=settings.twilio_account_sid,
        app_verified=True,
        caller_id_verified=data.caller_id == data.inbound_number,
        inbound_sid=owned[0]["sid"],
        commissioned_at=now(),
    )

    def bind(value: dict[str, Any]) -> None:
        if any(
            item["id"] != line["id"]
            and (item.get("connection") or {}).get("inbound_number") == data.inbound_number
            for item in value["lines"].values()
        ):
            raise fail("phone_number_bound")
        target = value["lines"].setdefault(
            line["id"], {"id": line["id"], "setup": setup, "connection": None, "checks": {}}
        )
        prior = target.get("connection")
        if prior and any(prior.get(k) != value for k, value in conn.items()):
            raise fail("phone_connection_already_bound")
        target["connection"] = conn
        if not value.get("default_line"):
            value["default_line"] = line["id"]

    db().change(workspace, bind)
    return await get_setup(workspace)


async def grant_issuance(workspace: str, data: Commission) -> dict[str, Any]:
    """Verify the account and browser application once, then record the right to issue."""
    grant = data.model_dump(exclude={"line_id", "inbound_number", "caller_id"})
    if settings.twilio_number_issue_limit < 1:
        raise fail("phone_number_issue_limit", 503)
    account = await provider(grant, ".json", account_auth=True)
    if account.get("sid") != settings.twilio_account_sid or account.get("status") != "active":
        raise fail("phone_account_inactive")
    if not settings.twilio_twiml_app_sid:
        raise fail("phone_twiml_application_required")
    application = await provider(grant, f"/Applications/{settings.twilio_twiml_app_sid}.json")
    if data.configure_webhooks:
        application = await provider(
            grant,
            f"/Applications/{settings.twilio_twiml_app_sid}.json",
            data={"VoiceUrl": public("/twilio/browser"), "VoiceMethod": "POST"},
        )
    if application.get("voice_url") != public("/twilio/browser") or application.get("voice_method") != "POST":
        raise fail("phone_browser_webhook_required")
    grant.update(account_sid=settings.twilio_account_sid, app_verified=True, granted_at=now())

    def record(s: dict[str, Any]) -> None:
        prior = s.get("issue")
        if prior and any(prior.get(key) != value for key, value in grant.items() if key != "granted_at"):
            raise fail("phone_connection_already_bound")
        s["issue"] = prior or grant

    db().change(workspace, record)
    return await get_setup(workspace)


@router.post("/caller-id/start")
async def caller_start(data: NumberInput, workspace: str = Depends(owner)) -> dict[str, str]:
    return await start_caller_for_line(data, workspace)


@router.post("/lines/{line_id}/caller-id/start")
async def line_caller_start(
    line_id: str, data: NumberInput, workspace: str = Depends(owner)
) -> dict[str, str]:
    return await start_caller_for_line(data, workspace, line_id)


async def start_caller_for_line(
    data: NumberInput, workspace: str, line_id: str | None = None
) -> dict[str, str]:
    state = db().read(workspace)
    line = selected_line(state, line_id)
    conn = connection(state, line["id"])
    if data.number != conn["caller_id"] or data.number not in conn["allowed_destinations"]:
        raise fail("phone_destination_authorization_required")
    if conn["region"] != "us1":
        raise fail("phone_caller_verification_region")

    def reserve(s: dict[str, Any]) -> None:
        checks = selected_line(s, line["id"])["checks"]
        if time.time() - checks.get("caller_requested_at", 0) < 60:
            raise fail("phone_verification_recent", 429)
        checks["caller_requested_at"] = time.time()

    db().change(workspace, reserve)
    result = await provider(
        conn,
        "/OutgoingCallerIds.json",
        data={"PhoneNumber": data.number, "FriendlyName": "Rocoto verified caller", "CallDelay": "0"},
    )
    return {
        "validation_code": str(result.get("validation_code", "")),
        "call_sid": str(result.get("call_sid", "")),
        "status": "pending",
    }


@router.post("/caller-id/check")
async def caller_check(data: NumberInput, workspace: str = Depends(owner)) -> dict[str, Any]:
    await check_caller_for_line(data, workspace)
    return await get_setup(workspace)


@router.post("/lines/{line_id}/caller-id/check")
async def line_caller_check(
    line_id: str, data: NumberInput, workspace: str = Depends(owner)
) -> dict[str, Any]:
    return await check_caller_for_line(data, workspace, line_id)


async def check_caller_for_line(
    data: NumberInput, workspace: str, line_id: str | None = None
) -> dict[str, Any]:
    state = db().read(workspace)
    line = selected_line(state, line_id)
    conn = connection(state, line["id"])
    if data.number != conn["caller_id"]:
        raise fail("phone_caller_identity_mismatch")
    if data.number == conn["inbound_number"]:
        verified = True
    else:
        result = await provider(
            conn, "/OutgoingCallerIds.json?" + urlencode({"PhoneNumber": data.number, "PageSize": 20})
        )
        verified = any(
            row.get("phone_number") == data.number for row in result.get("outgoing_caller_ids", [])
        )
    db().change(
        workspace,
        lambda s: selected_line(s, line["id"])["connection"].update(caller_id_verified=verified),
    )
    return line_projection(db().read(workspace), selected_line(db().read(workspace), line["id"]))


@router.post("/forwarding-test")
async def forwarding(data: ForwardingInput, workspace: str = Depends(owner)) -> dict[str, Any]:
    await forwarding_for_line(data, workspace)
    return await get_setup(workspace)


@router.post("/lines/{line_id}/forwarding-test")
async def line_forwarding(
    line_id: str, data: ForwardingInput, workspace: str = Depends(owner)
) -> dict[str, Any]:
    return await forwarding_for_line(data, workspace, line_id)


async def forwarding_for_line(
    data: ForwardingInput, workspace: str, line_id: str | None = None
) -> dict[str, Any]:
    state = db().read(workspace)
    line = selected_line(state, line_id)
    conn = connection(state, line["id"])
    if data.expected_from not in conn["allowed_destinations"]:
        raise fail("phone_destination_authorization_required")
    db().change(
        workspace,
        lambda s: selected_line(s, line["id"])["checks"].update(
            forwarding_state="waiting", expected_from=data.expected_from, expires=time.time() + 300
        ),
    )
    current = db().read(workspace)
    return line_projection(current, selected_line(current, line["id"]))


@router.post("/token")
async def token(data: DeviceInput, workspace: str = Depends(owner)) -> dict[str, Any]:
    state = db().read(workspace)
    conn = connection(state)
    if not conn["app_verified"] or not settings.twilio_api_key_sid or not settings.twilio_api_key_secret:
        raise fail("phone_browser_credentials_required", 503)
    identity = "cedar_" + hashlib.sha256((workspace + ":" + data.device_id).encode()).hexdigest()[:32]

    def save_device(s: dict[str, Any]) -> None:
        s["devices"] = {k: expiry for k, expiry in s["devices"].items() if expiry > time.time()}
        if identity not in s["devices"] and len(s["devices"]) >= 8:
            raise fail("phone_device_capacity")
        s["devices"][identity] = time.time() + 600

    db().change(workspace, save_device)
    grant = VoiceGrant(incoming_allow=True, outgoing_application_sid=settings.twilio_twiml_app_sid)
    jwt = AccessToken(
        settings.twilio_account_sid,
        settings.twilio_api_key_sid,
        settings.twilio_api_key_secret,
        identity=identity,
        ttl=600,
        region=conn["region"],
    )
    jwt.add_grant(grant)
    return {
        "token": jwt.to_jwt(),
        "identity": identity,
        "workspaceId": workspace,
        "expiresAt": time.time() + 600,
    }


def safe_call(call: dict[str, Any]) -> dict[str, Any]:
    fields = {
        "sid",
        "direction",
        "from",
        "to",
        "startedAt",
        "answeredAt",
        "endedAt",
        "durationSeconds",
        "status",
        "recordingCustody",
        "transcript",
        "liveTranscript",
        "sessionId",
        "lineId",
        "parentSid",
        "answeredBy",
        "legs",
        "liveTranscriptError",
        "transcriptionError",
        "recordingRemovedAt",
        "transcriptRemovedAt",
    }
    return {key: value for key, value in call.items() if key in fields}


def find_call(workspace: str, sid: str) -> dict[str, Any]:
    state = db().read(workspace)
    row = state["calls"].get(sid) or next(
        (c for c in state["calls"].values() if sid in c.get("legs", {})), None
    )
    if not row or row.get("deletedAt"):
        raise fail("phone_call_missing", 404)
    return row


@router.get("/calls")
async def calls(number: str = "", workspace: str = Depends(owner)) -> list[dict[str, Any]]:
    rows = db().read(workspace)["calls"].values()
    return [
        safe_call(row)
        for row in sorted(rows, key=lambda row: row["startedAt"], reverse=True)
        if not row.get("deletedAt") and (not number or number in {row["from"], row["to"]})
    ][:200]


@router.get("/calls/active")
async def active(workspace: str = Depends(owner)) -> list[dict[str, Any]]:
    return [row for row in await calls(workspace=workspace) if row["status"] not in TERMINAL]


@router.get("/calls/{sid}")
async def call(sid: str, workspace: str = Depends(owner)) -> dict[str, Any]:
    return safe_call(find_call(workspace, sid))


@router.get("/calls/{sid}/intake")
async def intake_events(
    sid: str,
    after: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    workspace: str = Depends(owner),
) -> dict[str, Any]:
    row = find_call(workspace, sid)
    pending = [event for event in row.get("intake_events", []) if event["sequence"] > after]
    batch = pending[:limit]
    return {
        "call_sid": row["sid"],
        "events": batch,
        "next_cursor": batch[-1]["sequence"] if batch else after,
        "has_more": len(pending) > limit,
    }


@router.post("/calls")
async def create_call(data: CallInput, workspace: str = Depends(owner)) -> dict[str, Any]:
    state = db().read(workspace)
    digest = hashlib.sha256(json.dumps(data.model_dump(), sort_keys=True).encode()).hexdigest()
    previous = state["intents"].get(data.idempotency_key)
    line = selected_line(state, previous.get("line_id") if previous else None)
    conn = connection(state, line["id"])
    if data.to not in conn["allowed_destinations"] or not conn["caller_id_verified"]:
        raise fail("phone_destination_authorization_required")

    def reserve(s: dict[str, Any]) -> dict[str, Any]:
        previous = s["intents"].get(data.idempotency_key)
        if previous:
            if previous["digest"] != digest:
                raise fail("phone_intent_conflict")
            return previous
        recent = [i for i in s["intents"].values() if time.time() - i["created"] < 3600]
        if len(recent) >= 20:
            raise fail("phone_hourly_call_limit", 429)
        row = {
            "token": secrets.token_urlsafe(32),
            "created": time.time(),
            "to": data.to,
            "mode": data.mode,
            "digest": digest,
            "used_by": None,
            "phase": "reserved",
            "line_id": line["id"],
        }
        s["intents"][data.idempotency_key] = row
        return row

    intent = db().change(workspace, reserve)
    state = db().read(workspace)
    intent_line = selected_line(state, intent.get("line_id"))
    intent_connection = connection(state, intent_line["id"])
    if (
        data.to not in intent_connection["allowed_destinations"]
        or not intent_connection["caller_id_verified"]
    ):
        raise fail("phone_destination_authorization_required")
    if data.mode == "phone" and intent["phase"] == "reserved":
        fallback = intent_line["setup"]["fallback_number"]
        if fallback not in intent_connection["allowed_destinations"]:
            raise fail("phone_fallback_authorization_required")

        def claim(s: dict[str, Any]) -> bool:
            current = s["intents"][data.idempotency_key]
            if current["phase"] != "reserved":
                return False
            current["phase"] = "submitting"
            return True

        if db().change(workspace, claim):
            try:
                result = await provider(
                    intent_connection,
                    "/Calls.json",
                    data={
                        "From": intent_connection["caller_id"],
                        "To": fallback,
                        "Url": public("/twilio/bridge")
                        + "?"
                        + urlencode(
                            {
                                "workspace": workspace,
                                "intent": hashlib.sha256(intent["token"].encode()).hexdigest()[:32],
                            }
                        ),
                        "StatusCallback": public("/twilio/status"),
                        "StatusCallbackEvent": "initiated ringing answered completed",
                        "Method": "POST",
                        "Timeout": "25",
                        "TimeLimit": "1800",
                    },
                )
                sid = result.get("sid", "")
                if not SID.fullmatch(sid):
                    raise fail("phone_creation_uncertain", 502)
                ensure_call(
                    workspace, sid, "outbound", intent_connection["caller_id"], data.to,
                    intent_line["id"],
                )
                db().change(
                    workspace, lambda s: s["intents"][data.idempotency_key].update(phase="created", sid=sid)
                )
            except RuntimeError_:
                db().change(workspace, lambda s: s["intents"][data.idempotency_key].update(phase="uncertain"))
                raise fail("phone_creation_uncertain", 502) from None
        intent = db().read(workspace)["intents"][data.idempotency_key]
    if intent["phase"] in {"submitting", "uncertain"}:
        raise fail("phone_creation_uncertain")
    return {
        "intentId": hashlib.sha256(intent["token"].encode()).hexdigest()[:32],
        "params": {"Intent": intent["token"], "Workspace": workspace},
        **({"sid": intent["sid"]} if intent.get("sid") else {}),
    }


@router.post("/calls/{sid}/hangup")
async def hangup(sid: str, workspace: str = Depends(owner)) -> dict[str, Any]:
    row = find_call(workspace, sid)
    if row["status"] not in TERMINAL:
        state = db().read(workspace)
        result = await provider(
            connection(state, row.get("lineId")), f"/Calls/{row['sid']}.json", data={"Status": "completed"}
        )
        if result.get("sid") != row["sid"]:
            raise fail("phone_call_mismatch")
    return await call(row["sid"], workspace)


def ensure_call(
    workspace: str, sid: str, direction: str, caller: str, recipient: str, line_id: str | None = None
) -> dict[str, Any]:
    if not SID.fullmatch(sid):
        raise fail("phone_call_invalid", 422)

    def ensure(s: dict[str, Any]) -> dict[str, Any]:
        if s["calls"].get(sid, {}).get("deletedAt"):
            raise fail("phone_call_retention_completed", 410)
        return s["calls"].setdefault(
            sid,
            {
                "sid": sid,
                "direction": direction,
                "from": caller,
                "to": recipient,
                "startedAt": now(),
                "parentSid": sid,
                "lineId": line_id or s.get("default_line"),
                "status": "ringing",
                "recordingCustody": "none",
                "legs": {},
                "stream_token": secrets.token_urlsafe(32),
                "liveTranscript": {"utterances": [], "language": "es", "provider": "deepgram"},
            },
        )

    return db().change(workspace, ensure)


async def signed(request: Request) -> dict[str, str]:
    form = await twilio_voice._require_twilio(request)
    if form.get("AccountSid") != settings.twilio_account_sid:
        raise fail("phone_account_mismatch", 403)
    return form


def notice_xml(conn: dict[str, Any]) -> str:
    """What a recorded call hears first. Connections commissioned before `notice` existed keep
    the spoken sentence they were commissioned with."""
    mode = conn.get("notice", "spoken")
    if mode == "audio" and conn.get("notice_audio_url"):
        return f'<Play>{escape(conn["notice_audio_url"])}</Play>'
    if mode == "spoken":
        return f'<Say language="es-ES">{NOTICE_TEXT}</Say>'
    return ""


def recording_on(line: dict[str, Any], conn: dict[str, Any]) -> bool:
    return line["setup"]["recording"] == "notice" and bool(conn.get("recording_policy_approved"))


def dial_xml(state: dict[str, Any], row: dict[str, Any], nouns: str) -> str:
    line = selected_line(state, row.get("lineId"))
    setup, conn = line["setup"], connection(state, line["id"])
    recording = recording_on(line, conn)
    intro = notice_xml(conn) if recording else ""
    stream = ""
    if recording and setup["live_transcription"] and settings.deepgram_key:
        stream = (
            f'<Start><Stream url="{escape(public("/twilio/media").replace("https://", "wss://", 1))}" '
            'track="both_tracks">'
            f'<Parameter name="workspace" value="{escape(state["id"])}"/>'
            f'<Parameter name="token" value="{escape(row["stream_token"])}"/></Stream></Start>'
        )
    return (
        "<Response>"
        + intro
        + stream
        + f'<Dial answerOnBridge="true" callerId="{escape(conn["caller_id"])}" '
        f'action="{escape(public("/twilio/complete"))}" method="POST" timeout="25" timeLimit="1800" '
        f'record="{"record-from-answer-dual" if recording else "do-not-record"}" '
        f'recordingStatusCallback="{escape(public("/twilio/recording"))}" '
        'recordingStatusCallbackEvent="completed">' + nouns + "</Dial></Response>"
    )


def dial_target(tag: str, value: str, *, notice: bool = False, parent_sid: str = "") -> str:
    attrs = (
        f' statusCallback="{escape(public("/twilio/status"))}" '
        'statusCallbackEvent="initiated ringing answered completed"'
        ' statusCallbackMethod="POST"'
    )
    if notice:
        attrs += f' url="{escape(public("/twilio/notice"))}" method="POST"'
    body = escape(value)
    if tag == "Client" and parent_sid:
        body = f'<Identity>{body}</Identity><Parameter name="ParentCallSid" value="{escape(parent_sid)}"/>'
    return f"<{tag}{attrs}>{body}</{tag}>"


@router.post("/twilio/notice")
async def notice(request: Request) -> Response:
    form = await signed(request)
    root_sid = form.get("ParentCallSid") or form.get("CallSid", "")
    workspace = db().call_workspace(root_sid)
    body = ""
    if workspace:
        state = db().read(workspace)
        row = state["calls"].get(root_sid)
        if row:
            line = selected_line(state, row.get("lineId"))
            conn = connection(state, line["id"])
            body = notice_xml(conn) if recording_on(line, conn) else ""
    return Response("<Response>" + body + "</Response>", media_type="application/xml")


@router.post("/twilio/inbound")
async def inbound(request: Request) -> Response:
    form = await signed(request)
    workspace = db().number_workspace(form.get("To", ""))
    if not workspace:
        raise fail("phone_line_missing", 404)
    state = db().read(workspace)
    line = next(
        (
            item for item in state.get("lines", {}).values()
            if item.get("connection", {}).get("inbound_number") == form.get("To", "")
        ),
        None,
    )
    if not line:
        raise fail("phone_line_missing", 404)
    conn = connection(state, line["id"])
    row = ensure_call(
        workspace, form.get("CallSid", ""), "inbound", form.get("From", ""), conn["inbound_number"],
        line["id"],
    )

    def observe(s: dict[str, Any]) -> None:
        current = selected_line(s, line["id"])
        checks = current["checks"]
        matched = checks.get("expected_from") == form.get("From") and checks.get("expires", 0) > time.time()
        forwarded = form.get("ForwardedFrom", "")
        checks["latest_inbound"] = {
            "sid": row["sid"],
            "from": form.get("From", ""),
            "to": form.get("To", ""),
            "forwarded_from": forwarded,
            "matched_expected": matched,
        }
        if matched:
            checks["forwarding_state"] = (
                "verified" if forwarded == current["setup"]["source_number"] else "received"
            )

    db().change(workspace, observe)
    devices = [identity for identity, expiry in state["devices"].items() if expiry > time.time()]
    notice_on = recording_on(line, conn) and notice_xml(conn) != ""
    nouns = "".join(
        dial_target("Client", identity, notice=notice_on, parent_sid=row["sid"]) for identity in devices[:8]
    )
    fallback = line["setup"]["fallback_number"]
    if fallback and fallback in conn["allowed_destinations"]:
        nouns += dial_target("Number", fallback, notice=notice_on)
    return Response(
        dial_xml(state, row, nouns) if nouns else '<Response><Reject reason="busy"/></Response>',
        media_type="application/xml",
    )


async def bridge(request: Request, browser: bool) -> Response:
    form = await signed(request)
    workspace = form.get("Workspace") if browser else request.query_params.get("workspace")
    intent_token = form.get("Intent") if browser else request.query_params.get("intent")
    if not workspace or not intent_token:
        raise fail("phone_intent_required", 403)
    state = db().read(workspace)
    sid = form.get("CallSid", "")
    if browser:
        identity = form.get("From", "").removeprefix("client:")
        if state["devices"].get(identity, 0) <= time.time():
            raise fail("phone_device_mismatch", 403)

    def consume(s: dict[str, Any]) -> dict[str, Any]:
        intent = next(
            (
                i
                for i in s["intents"].values()
                if hmac.compare_digest(
                    i["token"] if browser else hashlib.sha256(i["token"].encode()).hexdigest()[:32],
                    intent_token,
                )
            ),
            None,
        )
        if (
            not intent
            or time.time() - intent["created"] > 600
            or intent["mode"] != ("browser" if browser else "phone")
        ):
            raise fail("phone_intent_expired", 403)
        if (intent["used_by"] and intent["used_by"] != sid) or (intent.get("sid") and intent["sid"] != sid):
            raise fail("phone_intent_used", 403)
        intent["used_by"] = sid
        return intent

    intent = db().change(workspace, consume)
    state = db().read(workspace)
    line = selected_line(state, intent.get("line_id"))
    conn = connection(state, line["id"])
    row = ensure_call(workspace, sid, "outbound", conn["caller_id"], intent["to"], line["id"])
    session_id = hashlib.sha256(intent["token"].encode()).hexdigest()[:32]
    db().change(workspace, lambda s: s["calls"][sid].update(sessionId=session_id))
    return Response(
        dial_xml(
            state,
            row,
            dial_target("Number", intent["to"], notice=recording_on(line, conn) and notice_xml(conn) != ""),
        ),
        media_type="application/xml",
    )


@router.post("/twilio/browser")
async def browser_voice(request: Request) -> Response:
    return await bridge(request, True)


@router.post("/twilio/bridge")
async def phone_voice(request: Request) -> Response:
    return await bridge(request, False)


@router.post("/twilio/status")
@router.post("/twilio/complete")
async def status(request: Request) -> Response:
    form = await signed(request)
    root_sid = form.get("ParentCallSid") or form.get("CallSid", "")
    workspace = db().call_workspace(root_sid)
    if not workspace:
        raise fail("phone_call_missing", 404)
    complete = request.url.path.endswith("/complete")
    sid = form.get("DialCallSid") if complete else form.get("CallSid")
    phase = (form.get("DialCallStatus") if complete else form.get("CallStatus")) or ""

    def update(s: dict[str, Any]) -> None:
        row = s["calls"][root_sid]
        if row.get("deletedAt"):
            return
        if sid:
            row["legs"][sid] = {"status": phase, "to": form.get("To", "")}
        if (
            sid != root_sid
            and phase in {"in-progress", "answered"}
            and row["status"] not in TERMINAL
            and not row.get("answeredBy")
        ):
            row.update(status="in-progress", answeredAt=now(), answeredBy=sid)
        elif (complete or sid == root_sid) and phase in TERMINAL:
            if row["status"] not in TERMINAL:
                row.update(status=phase, endedAt=now())
            duration = form.get("DialCallDuration") or form.get("CallDuration", "")
            if duration.isdigit():
                row["durationSeconds"] = int(duration)
        elif row["status"] not in TERMINAL and not row.get("answeredAt") and phase in {"queued", "ringing"}:
            row["status"] = phase

    db().change(workspace, update)
    return Response(
        "<Response><Hangup/></Response>" if complete else "{}",
        media_type="application/xml" if complete else "application/json",
    )


@router.post("/twilio/recording")
async def recording(request: Request, background: BackgroundTasks) -> dict[str, bool]:
    form = await signed(request)
    sid, recording_sid = form.get("CallSid", ""), form.get("RecordingSid", "")
    workspace = db().call_workspace(sid)
    if not workspace or not re.fullmatch(r"RE[0-9a-fA-F]{32}", recording_sid):
        raise fail("phone_recording_missing", 404)
    state = db().read(workspace)
    row = state["calls"].get(sid)
    if not row:
        raise fail("phone_recording_missing", 404)
    line = selected_line(state, row.get("lineId"))
    recording_approved = connection(state, line["id"])["recording_policy_approved"]
    if line["setup"]["recording"] != "notice" or not recording_approved:
        raise fail("phone_recording_policy_required", 403)
    if form.get("RecordingStatus") != "completed":
        return {"ok": True}

    def queue(s: dict[str, Any]) -> bool:
        row = s["calls"][sid]
        if row.get("deletedAt") or row.get("transcriptRemovedAt"):
            return False
        if row.get("recording_id"):
            if row["recording_id"] != recording_sid:
                raise fail("phone_recording_conflict")
            return row.get("recording_job") == "retry"
        row.update(recording_id=recording_sid, recordingCustody="provider", recording_job="queued")
        return True

    if db().change(workspace, queue):
        background.add_task(transcribe_recording, workspace, sid)
    return {"ok": True}


@router.post("/calls/{sid}/transcribe")
async def retry_transcript(
    sid: str, background: BackgroundTasks, workspace: str = Depends(owner)
) -> dict[str, bool]:
    row = find_call(workspace, sid)
    if not row.get("recording_id"):
        raise fail("phone_recording_pending")
    if row.get("recordingRemovedAt"):
        raise fail("phone_recording_retention_completed")

    def queue(s: dict[str, Any]) -> None:
        current = s["calls"][row["sid"]]
        if current.get("recording_job") == "processing":
            raise fail("phone_transcription_processing")
        if time.time() - current.get("transcription_requested_at", 0) < 300:
            raise fail("phone_transcription_recent", 429)
        current.update(
            recording_job="queued",
            recording_attempts=0,
            recording_retry_at=0,
            transcription_requested_at=time.time(),
        )

    db().change(workspace, queue)
    background.add_task(transcribe_recording, workspace, row["sid"])
    return {"ok": True}


async def transcribe_recording(workspace: str, sid: str) -> None:
    state = db().read(workspace)
    current = state["calls"].get(sid)
    if not current:
        return
    conn = connection(state, current.get("lineId"))

    def claim(s: dict[str, Any]) -> bool:
        row = s["calls"][sid]
        if row.get("recording_job") not in {"queued", "retry"}:
            return False
        if row.get("recording_retry_at", 0) > time.time():
            return False
        attempts = row.get("recording_attempts", 0) + 1
        if attempts > 3:
            row.update(recording_job="failed")
            return False
        row.update(
            recording_job="processing",
            recording_started=time.time(),
            recording_attempts=attempts,
            recording_retry_at=time.time() + 180,
        )
        return True

    if not db().change(workspace, claim):
        return
    row = find_call(workspace, sid)
    try:
        async with asyncio.timeout(150):
            url = f"https://{HOSTS[conn['region']]}/2010-04-01/Accounts/{settings.twilio_account_sid}/Recordings/{row['recording_id']}.wav"
            async with httpx.AsyncClient(timeout=60, follow_redirects=False) as client:
                async with client.stream(
                    "GET", url, params={"RequestedChannels": "2"}, auth=twilio_voice._auth()
                ) as audio:
                    if audio.status_code != 200:
                        raise fail("phone_recording_unavailable", 502)
                    content = bytearray()
                    async for chunk in audio.aiter_bytes():
                        content.extend(chunk)
                        if len(content) > 50_000_000:
                            raise fail("phone_recording_too_large", 413)
                if not settings.deepgram_key:
                    raise fail("phone_transcription_key_required", 503)
                endpoint = (
                    "https://api.eu.deepgram.com/v1/listen"
                    if conn["deepgram_region"] == "eu"
                    else "https://api.deepgram.com/v1/listen"
                )
                result = await client.post(
                    endpoint,
                    headers={"Authorization": "Token " + settings.deepgram_key, "Content-Type": "audio/wav"},
                    params={
                        "model": "nova-3",
                        "language": "es",
                        "multichannel": "true",
                        "utterances": "true",
                        "punctuate": "true",
                        "mip_opt_out": "true",
                    },
                    content=bytes(content),
                )
                if result.status_code != 200:
                    raise fail("phone_transcription_failed", 502)
            parsed = result.json()
            if len(parsed.get("results", {}).get("channels", [])) != 2:
                raise fail("phone_recording_channels_required")
            transcript = deepgram.shape(parsed, dual_channel=True, language="es")
            if not retention.has_words(transcript) or any(
                item["speaker"] not in {0, 1} or not 0 <= item["start"] <= item["end"] <= 1800
                for item in transcript["utterances"]
            ):
                raise fail("phone_transcription_review_required")
            if row["direction"] == "inbound":
                for utterance in transcript["utterances"]:
                    utterance["speaker"] = 1 - utterance["speaker"]

            def save(s: dict[str, Any]) -> None:
                current = s["calls"][sid]
                current.update(
                    transcript=transcript,
                    recording_job="done",
                    liveTranscript={
                        "utterances": [],
                        "language": "es",
                        "provider": "deepgram",
                        "replaced": True,
                    },
                )
                current.pop("transcriptionError", None)
                evidence = []
                for index, utterance in enumerate(transcript["utterances"]):
                    source_key = json.dumps([current["recording_id"], index, utterance], sort_keys=True)
                    source_id = "recording:" + hashlib.sha256(source_key.encode()).hexdigest()[:24]
                    evidence.append({**utterance, "id": source_id, "final": True})
                append_intake(current, "full_transcript", evidence)

            db().change(workspace, save)
            from .phone_retention import cleanup_workspace

            with suppress(Exception):
                await cleanup_workspace(workspace)
    except Exception:
        db().change(
            workspace,
            lambda s: s["calls"][sid].update(
                recording_job="retry" if s["calls"][sid].get("recording_attempts", 0) < 3 else "failed",
                recording_retry_at=time.time()
                + min(600, 60 * 2 ** s["calls"][sid].get("recording_attempts", 0)),
                transcriptionError="phone_transcription_retry_required",
            ),
        )


@router.websocket("/twilio/media")
async def media(websocket: WebSocket):
    from .phone_stream import media as receive_media

    await receive_media(websocket)


async def retry_recordings() -> None:
    from .phone_retention import cleanup_workspace

    while True:
        if not (settings.state_dir / "cedar-phone.sqlite").exists():
            await asyncio.sleep(30)
            continue
        with suppress(Exception):
            await retry_due_recordings()
        with suppress(Exception):
            for workspace in db().due_maintenance(time.time()):
                with suppress(Exception):
                    await cleanup_workspace(workspace)
        await asyncio.sleep(30)


async def retry_due_recordings() -> None:
    for workspace, sid in db().due_recordings(time.time()):
        row = find_call(workspace, sid)
        if row.get("recording_job") == "processing":
            if time.time() - row.get("recording_started", 0) < 180:
                continue

            def recover(state: dict[str, Any], call_sid: str = sid) -> None:
                state["calls"][call_sid].update(recording_job="retry")

            db().change(workspace, recover)
        await transcribe_recording(workspace, sid)


async def start() -> None:
    if any(not task.done() for task in _jobs):
        return
    task = asyncio.create_task(retry_recordings())
    _jobs.add(task)


async def stop() -> None:
    for task in _jobs:
        task.cancel()
    await asyncio.gather(*_jobs, return_exceptions=True)
    _jobs.clear()
