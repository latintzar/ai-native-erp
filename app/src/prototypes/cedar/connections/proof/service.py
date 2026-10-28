"""An isolated Cedar demo/development proof for real Meta coexistence onboarding and history.

Source lineage: backend/wa_onboard.py and backend/wa_coexistence.py. No backend configuration,
provider credentials, tenant runtime, outgoing messages or order processing are imported.
"""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import logging
import os
import re
import secrets
import time
from contextlib import asynccontextmanager, suppress
from dataclasses import dataclass
from pathlib import Path
from typing import Literal
from urllib.parse import urlsplit

import httpx
from accounts import AccountRegistry
from cryptography.fernet import Fernet
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, Field
from storage import Store

COOKIE = "__Host-cedar_session"
COEXISTENCE = "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING"
PREFIX = "CEDAR_PROOF_"
MODULE_PATH = Path(__file__).resolve()
SOURCE_ROOT = next(
    (parent for parent in MODULE_PATH.parents if (parent / ".git").exists()),
    MODULE_PATH.parent.parent,
)


@dataclass(frozen=True)
class Config:
    app_id: str = ""
    app_secret: str = ""
    config_id: str = ""
    graph_version: str = "v26.0"
    public_origin: str = ""
    verify_token: str = ""
    encryption_key: str = ""
    state_dir: str = ""
    static_dir: str = ""
    workspace_bindings: str = "{}"
    sender_bindings: str = "{}"

    @classmethod
    def from_env(cls):
        return cls(
            **{
                name: os.environ.get(PREFIX + name.upper(), field.default)
                for name, field in cls.__dataclass_fields__.items()
            }
        )

    @property
    def callback(self):
        return self.public_origin + "/webhooks/whatsapp"

    def workspace_for(self, waba_id: str, phone_id: str) -> str:
        """Resolve an operator-configured exact provider identity to one Cedar workspace."""
        try:
            bindings = json.loads(self.workspace_bindings or "{}")
        except (TypeError, ValueError):
            return ""
        workspace = bindings.get(f"{waba_id}:{phone_id}") if isinstance(bindings, dict) else None
        valid = isinstance(workspace, str) and re.fullmatch(
            r"[a-z0-9][a-z0-9_-]{0,63}", workspace
        )
        return workspace if valid else ""

    def customer_for(self, waba_id: str, phone_id: str, sender: str, workspace: str) -> str:
        """Resolve one privately configured sender inside one exact provider/workspace scope."""
        try:
            bindings = json.loads(self.sender_bindings or "{}")
        except (TypeError, ValueError):
            return ""
        normalized_sender = "".join(char for char in sender if char.isdigit())
        if not re.fullmatch(r"\d{5,32}", normalized_sender):
            return ""
        key = f"{waba_id}:{phone_id}:{normalized_sender}"
        value = bindings.get(key) if isinstance(bindings, dict) else None
        if not isinstance(value, dict) or value.get("workspace") != workspace:
            return ""
        customer = value.get("customerId")
        valid = isinstance(customer, str) and re.fullmatch(
            r"[a-z0-9][a-z0-9_-]{0,63}", customer
        )
        return customer if valid else ""

    def blockers(self):
        required = (
            "app_id",
            "app_secret",
            "config_id",
            "public_origin",
            "verify_token",
            "encryption_key",
            "state_dir",
        )
        missing = {PREFIX + name.upper() for name in required if not getattr(self, name)}
        for name in ("app_id", "config_id"):
            if getattr(self, name) and not re.fullmatch(r"\d+", getattr(self, name)):
                missing.add(PREFIX + name.upper())
        if not re.fullmatch(r"v\d+\.\d+", self.graph_version):
            missing.add(PREFIX + "GRAPH_VERSION")
        try:
            origin = urlsplit(self.public_origin)
        except ValueError:
            origin = urlsplit("")
        if self.public_origin and (
            origin.scheme != "https"
            or not origin.hostname
            or origin.path
            or origin.query
            or origin.fragment
            or origin.username
            or len(self.callback) > 200
        ):
            missing.add(PREFIX + "PUBLIC_ORIGIN")
        for name in ("verify_token",):
            if getattr(self, name) and len(getattr(self, name)) < 16:
                missing.add(PREFIX + name.upper())
        if self.encryption_key:
            try:
                Fernet(self.encryption_key.encode())
            except Exception:
                missing.add(PREFIX + "ENCRYPTION_KEY")
        for field_name in ("workspace_bindings", "sender_bindings"):
            try:
                value = json.loads(getattr(self, field_name) or "{}")
                if not isinstance(value, dict):
                    raise ValueError
            except (TypeError, ValueError):
                missing.add(PREFIX + field_name.upper())
        if self.state_dir:
            location = Path(self.state_dir).expanduser()
            if not location.is_absolute() or location.is_symlink():
                missing.add(PREFIX + "STATE_DIR")
            resolved = location.resolve()
            if (
                resolved == SOURCE_ROOT
                or SOURCE_ROOT in resolved.parents
                or any((parent / ".git").exists() for parent in [resolved, *resolved.parents])
            ):
                missing.add(PREFIX + "STATE_DIR")
        if self.static_dir and not Path(self.static_dir).is_dir():
            missing.add(PREFIX + "STATIC_DIR")
        return sorted(missing)


class GraphError(RuntimeError):
    def __init__(self, code="transport"):
        self.code = str(code)[:40]
        super().__init__("Meta connection step requires review")


class Graph:
    def __init__(self, config):
        self.config = config

    async def request(self, method, path, token="", params=None, body=None):
        try:
            async with httpx.AsyncClient(timeout=35, follow_redirects=False) as client:
                response = await client.request(
                    method,
                    f"https://graph.facebook.com/{self.config.graph_version}/{path}",
                    params=params,
                    json=body,
                    headers={"Authorization": f"Bearer {token}"} if token else {},
                )
                data = response.json()
        except Exception:
            raise GraphError() from None
        if not isinstance(data, dict) or response.status_code >= 400 or "error" in data:
            error = data.get("error", {}) if isinstance(data, dict) else {}
            code = (
                error.get("code", response.status_code) if isinstance(error, dict) else response.status_code
            )
            # Store provider code, never raw error text, request URLs, bodies, codes or tokens.
            raise GraphError(str(code))
        return data

    async def exchange(self, code, redirect_uri=None):
        params = {
            "client_id": self.config.app_id,
            "client_secret": self.config.app_secret,
            "code": code,
        }
        if redirect_uri is not None:
            params["redirect_uri"] = redirect_uri
        data = await self.request(
            "GET",
            "oauth/access_token",
            params=params,
        )
        token = data.get("access_token")
        if not isinstance(token, str) or not token:
            raise GraphError("access_token")
        return token

    async def collection(self, path, token, fields=None):
        output, params = [], ({"fields": fields} if fields else {})
        params["limit"] = "100"
        seen = set()
        for _ in range(100):
            data = await self.request("GET", path, token, params)
            rows = data.get("data")
            if not isinstance(rows, list):
                raise GraphError("collection")
            output.extend(rows)
            paging = data.get("paging") or {}
            if not paging.get("next"):
                return output
            after = (paging.get("cursors") or {}).get("after")
            if not after or after in seen:
                raise GraphError("pagination")
            seen.add(after)
            params["after"] = after
        raise GraphError("pagination_limit")


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Code(Input):
    code: str = Field(min_length=1, max_length=8192)


class Connect(Input):
    authorizationId: str = Field(min_length=20, max_length=200)
    wabaId: str = Field(pattern=r"^\d{1,40}$")
    phoneNumberId: str | None = Field(default=None, pattern=r"^\d{1,40}$")
    event: str = Field(max_length=100)
    historyRequested: bool


class SignupDiagnostic(Input):
    model_config = ConfigDict(extra="forbid", strict=True)
    attemptId: str = Field(pattern=r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
    event: Literal["CANCEL", "ERROR"]
    errorCode: str | None = Field(default=None, pattern=r"^[0-9]{1,12}$")
    currentStep: str | None = Field(default=None, pattern=r"^[A-Z_]{1,64}$")
    sessionId: str | None = Field(default=None, pattern=r"^[a-fA-F0-9-]{8,64}$")
    reportedAt: str | None = Field(default=None, pattern=r"^[0-9]{10,13}$")


def create_app(config=None, graph=None):
    config = config or Config.from_env()
    # httpx INFO can include oauth/access_token query credentials; this private service suppresses it.
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    os.umask(0o077)
    blockers = config.blockers()
    registry = None
    if (
        config.encryption_key
        and config.state_dir
        and not {PREFIX + "ENCRYPTION_KEY", PREFIX + "STATE_DIR"}.intersection(blockers)
    ):
        try:
            registry = AccountRegistry(config)
            registry.root.prune_signup_diagnostics()
            for account in registry.stores():
                pending = account.get("setup")
                if pending and pending["status"] == "pending":
                    account.put(
                        "setup",
                        {
                            **pending,
                            "status": "interrupted",
                            "error": "Setup restarted. Review the saved request outcomes.",
                        },
                    )
        except Exception:
            registry = None
            blockers.extend([PREFIX + "STATE_DIR", PREFIX + "ENCRYPTION_KEY"])
    if registry:
        # A verified account that predates workspace intake receives its one configured association
        # at boot. Once written, reconnects and later configuration changes cannot move it.
        for account in registry.stores():
            connection = account.get("connection")
            if connection and not connection.get("workspace"):
                workspace = config.workspace_for(connection["wabaId"], connection["phoneId"])
                if workspace:
                    account.bind_workspace(workspace)
    graph = graph or Graph(config)
    exchanges = {}
    connect_lock = asyncio.Lock()
    wake = asyncio.Event()

    @asynccontextmanager
    async def lifespan(_):
        async def project():
            next_diagnostic_prune = time.time() + 3600
            while True:
                if registry:
                    if time.time() >= next_diagnostic_prune:
                        await asyncio.to_thread(registry.root.prune_signup_diagnostics)
                        next_diagnostic_prune = time.time() + 3600
                    for account in registry.stores():
                        await asyncio.to_thread(account.drain)
                with suppress(TimeoutError):
                    await asyncio.wait_for(wake.wait(), 2)
                wake.clear()

        task = asyncio.create_task(project())
        try:
            yield
        finally:
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task

    app = FastAPI(
        title="Cedar WhatsApp connections",
        lifespan=lifespan,
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
    )
    app.state.store = registry.root if registry else None
    app.state.registry = registry

    def origin(request):
        if not config.public_origin or request.headers.get("origin") != config.public_origin:
            raise HTTPException(403, "Open Cedar from its configured address.")

    def session(request):
        value = registry.lookup(request.cookies.get(COOKIE, "")) if registry else None
        if not value:
            raise HTTPException(401, "Open WhatsApp setup to continue.")
        return value

    def account_session(request):
        session(request)
        account = registry.store_for_session(request.cookies.get(COOKIE, ""))
        if account is None or not account.authorized():
            raise HTTPException(401, "Connect your WhatsApp Business account to open your chats.")
        return account

    def configured():
        if blockers or registry is None:
            raise HTTPException(503, "WhatsApp connection configuration needs attention.")

    def state(store: Store | None = None):
        return {
            "ready": not blockers and registry is not None,
            "blockers": sorted(set(blockers)),
            "meta": {
                "appId": config.app_id,
                "configId": config.config_id,
                "graphVersion": config.graph_version,
            },
            "connection": store.active_connection() if store else None,
            "setup": store.get("setup") if store else None,
            "history": store.history()
            if store
            else {
                "status": "idle",
                "progress": None,
                "messages": 0,
                "conversations": 0,
                "oldestAt": None,
                "newestAt": None,
            },
        }

    def revoke_current_connection(store: Store) -> JSONResponse:
        """Drop only live provider authority; the account's durable records remain for reconnect."""
        store.disconnect()
        registry.invalidate_account(store)
        response = JSONResponse({"connection": None}, status_code=409)
        response.delete_cookie(COOKIE, path="/", secure=True, httponly=True, samesite="strict")
        return response

    async def fresh_connection(store: Store) -> JSONResponse | dict:
        """Check current Graph access/configuration after lifecycle state has admitted the account."""
        connection = store.connection()
        token = store.get("token")
        if not connection or not token:
            return revoke_current_connection(store)
        try:
            # These prove current provider access and callback configuration. Signed lifecycle events
            # govern coexistence liveness, because an offboarded client can retain these Graph reads.
            # Both calls stay below Bodega's eight-second upstream state read.
            async with asyncio.timeout(6):
                subscriptions = await graph.collection(f"{connection['wabaId']}/subscribed_apps", token)
                verified = await graph.request(
                    "GET", connection["phoneId"], token, {"fields": "webhook_configuration"}
                )
        except TimeoutError:
            return JSONResponse({"connection": None}, status_code=503)
        except GraphError as error:
            # Meta's observed inaccessible-object/revoked-token answers prove this binding ended.
            if error.code in {"100", "190"}:
                return revoke_current_connection(store)
            return JSONResponse({"connection": None}, status_code=503)
        own = [
            item for item in subscriptions
            if str((item.get("whatsapp_business_api_data") or {}).get("id")) == config.app_id
        ]
        routing = verified.get("webhook_configuration") or {}
        effective = (
            routing.get("phone_number")
            or routing.get("whatsapp_business_account")
            or routing.get("application")
        ) if isinstance(routing, dict) else None
        if (
            len(subscriptions) != 1
            or len(own) != 1
            or own[0].get("override_callback_uri") != config.callback
            or not isinstance(routing, dict)
            or routing.get("whatsapp_business_account") != config.callback
            or effective != config.callback
        ):
            return revoke_current_connection(store)
        current = store.active_connection()
        return {"connection": current} if current is not None else revoke_current_connection(store)

    def lifecycle_action(change: dict) -> Literal["disconnect", "suspend", "resume"] | None:
        """Read only the documented signed WABA lifecycle changes for this provider application."""
        if change.get("field") != "account_update":
            return None
        value = change.get("value")
        if not isinstance(value, dict):
            return None
        event = value.get("event")
        if event in {"PARTNER_REMOVED", "ACCOUNT_DELETED"}:
            return "disconnect"
        if event == "PARTNER_APP_UNINSTALLED":
            waba_info = value.get("waba_info")
            if isinstance(waba_info, dict) and str(waba_info.get("partner_app_id")) == config.app_id:
                return "disconnect"
            return None
        if event == "ACCOUNT_OFFBOARDED":
            return "suspend"
        if event == "ACCOUNT_RECONNECTED":
            return "resume"
        return None

    def apply_lifecycle(
        store: Store,
        action: Literal["disconnect", "suspend", "resume"],
        occurred_at: int,
    ):
        changed = store.apply_lifecycle(action, occurred_at)
        if changed and action in {"disconnect", "suspend"}:
            registry.invalidate_account(store)
        return changed

    @app.middleware("http")
    async def private_response(request, call_next):
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["X-Frame-Options"] = "DENY"
        token = getattr(request.state, "customer_cookie", None)
        if token:
            active = registry.lookup(token)
            if active:
                response.set_cookie(
                    COOKIE,
                    token,
                    httponly=True,
                    secure=True,
                    samesite="strict",
                    max_age=max(1, int(active["expiresAt"] - time.time())),
                    path="/",
                )
        return response

    @app.exception_handler(GraphError)
    async def graph_error(_request, error):
        from fastapi.responses import JSONResponse

        if getattr(_request.state, "proof_setup_active", False):
            interrupt_setup(_request, "Meta connection step needs review. The request outcome was saved.")
        return JSONResponse(
            status_code=502,
            content={
                "detail": "Meta connection step needs review. Your connection progress is saved.",
                "providerCode": error.code,
            },
        )

    def interrupt_setup(request, message):
        store = getattr(request.state, "proof_store", None)
        setup = store.get("setup") if store else None
        if setup and setup["status"] == "pending":
            store.put("setup", {**setup, "status": "interrupted", "error": message})

    @app.exception_handler(HTTPException)
    async def request_error(request, error):
        from fastapi.responses import JSONResponse

        if getattr(request.state, "proof_setup_active", False):
            interrupt_setup(request, error.detail)
        return JSONResponse(status_code=error.status_code, content={"detail": error.detail})

    @app.exception_handler(RequestValidationError)
    async def invalid_input(_request, _error):
        from fastapi.responses import JSONResponse

        # Framework validation normally echoes rejected input, including authorization/access codes.
        return JSONResponse(status_code=422, content={"detail": "Check the required fields and try again."})

    @app.get("/download/whatsapp-business")
    async def download_whatsapp_business(request: Request):
        agent = request.headers.get("user-agent", "").lower()
        platform = request.headers.get("sec-ch-ua-platform", "").strip('"').lower()
        if "android" in agent or platform == "android":
            target = "https://play.google.com/store/apps/details?id=com.whatsapp.w4b"
        elif re.search(r"iphone|ipad|ipod|macintosh|mac os x", agent) or platform in {"ios", "macos"}:
            # iPad Safari's desktop mode identifies itself as Macintosh.
            target = "https://apps.apple.com/app/whatsapp-business/id1386412985"
        else:
            target = "/?preview=setup&transfer=1#whatsapp-business"
        return RedirectResponse(target, status_code=302, headers={"Vary": "User-Agent, Sec-CH-UA-Platform"})

    @app.post("/api/proof/session")
    async def begin_session(body: Input, request: Request):
        origin(request)
        if registry is None or PREFIX + "PUBLIC_ORIGIN" in blockers:
            raise HTTPException(503, "WhatsApp session storage configuration needs attention.")
        try:
            request.state.customer_cookie = registry.begin(request.cookies.get(COOKIE, ""))
        except ValueError:
            raise HTTPException(429, "Setup is busy. Continue again shortly.") from None
        return {"ok": True}

    @app.get("/api/proof/state")
    async def get_state(request: Request):
        session(request)
        return state(registry.store_for_session(request.cookies.get(COOKIE, "")))

    @app.post("/api/proof/whatsapp/verify")
    async def verify_current_whatsapp_connection(request: Request):
        """A fresh provider check before another surface trusts the saved browser connection."""
        origin(request)
        configured()
        async with connect_lock:
            return await fresh_connection(account_session(request))

    @app.post("/api/proof/whatsapp/diagnostics")
    async def signup_diagnostic(body: SignupDiagnostic, request: Request):
        origin(request)
        browser = session(request)
        if browser["account"] is not None:
            raise HTTPException(403, "Open a WhatsApp setup session to record this report.")
        result = registry.root.record_signup_diagnostic(
            body.model_dump(exclude_none=True), owner=browser["identity"], config=config,
        )
        if result is None:
            raise HTTPException(429, "Continue with WhatsApp setup again in one minute.")
        return result

    @app.post("/api/proof/whatsapp/code")
    async def exchange(body: Code, request: Request):
        origin(request)
        owner = session(request)["identity"]
        configured()
        now = time.time()
        for identity in list(exchanges):
            if not exchanges[identity] or exchanges[identity][-1] <= now - 60:
                exchanges.pop(identity, None)
        recent = [at for at in exchanges.get(owner, []) if at > now - 60]
        total = [at for at in exchanges.get("all", []) if at > now - 60]
        if len(recent) >= 5 or len(total) >= 100:
            raise HTTPException(429, "Continue with Meta again in one minute.")
        exchanges[owner] = [*recent, now]
        exchanges["all"] = [*total, now]
        # The authorization code is sent here immediately, independently of signup session events.
        token = await graph.exchange(body.code)
        # A concurrent logout or account switch must invalidate a delayed exchange response.
        if session(request)["identity"] != owner:
            raise HTTPException(401, "Open WhatsApp setup again to renew this session.")
        authorization_id = secrets.token_urlsafe(32)
        registry.root.put(
            "authorization:" + registry.root.key(authorization_id),
            {
                "owner": owner,
                "token": token,
                "expiresAt": time.time() + 600,
            },
        )
        return {"authorizationId": authorization_id}

    async def provider_step(store, name, method, path, token, body=None, operation=None):
        operation = operation or name
        previous = store.operation(operation)
        if previous and previous["state"] == "accepted":
            return
        if name in {"contacts", "history"}:
            connection = store.get("connection")
            if not connection or time.time() - connection["connectedAt"] >= 24 * 60 * 60:
                raise HTTPException(
                    409, "The history request window has elapsed. Review the saved connection."
                )
        store.put("setup", {"status": "pending", "step": name, "error": None})
        if not store.claim(operation):
            previous = store.operation(operation)
            raise HTTPException(409, "The saved Meta request needs review before this setup can continue.")
        try:
            result = await graph.request(method, path, token, body=body)
            if result.get("success") is not True and not result.get("request_id"):
                raise GraphError("acceptance")
        except GraphError as error:
            store.outcome(operation, False, error=error.code)
            raise
        store.outcome(operation, True, request_id=str(result.get("request_id") or ""))

    @app.post("/api/proof/whatsapp/connect")
    async def connect(body: Connect, request: Request):
        origin(request)
        session(request)
        configured()
        if body.event != COEXISTENCE:
            raise HTTPException(
                409,
                "Use an existing WhatsApp Business app number for this coexistence proof. "
                "A fresh Cloud API number has a separate commissioning flow.",
            )
        async with connect_lock:
            # Re-read inside the lock: an earlier request may have rotated this browser's cookie.
            owner = session(request)["identity"]
            auth_key = "authorization:" + registry.root.key(body.authorizationId)
            authorization = registry.root.get(auth_key)
            if (
                not authorization
                or authorization["owner"] != owner
                or authorization["expiresAt"] < time.time()
            ):
                raise HTTPException(401, "Start Meta connection again to renew this authorization.")
            if authorization.get("wabaId") and (
                authorization["wabaId"] != body.wabaId
                or (body.phoneNumberId and authorization["phoneId"] != body.phoneNumberId)
            ):
                raise HTTPException(403, "Continue with the WhatsApp account selected in this Meta setup.")
            if authorization.get("connected"):
                store = account_session(request)
                connection = store.connection()
                if connection["wabaId"] != body.wabaId or connection["phoneId"] != authorization.get(
                    "phoneId"
                ):
                    raise HTTPException(403, "Open Meta setup for the account you want to view.")
                return state(store)
            token = authorization["token"]
            waba = await graph.request("GET", body.wabaId, token, {"fields": "id,name"})
            if str(waba.get("id")) != body.wabaId:
                raise HTTPException(403, "Choose a WhatsApp Business account authorized by this Meta login.")
            numbers = await graph.collection(
                f"{body.wabaId}/phone_numbers", token, "id,display_phone_number,verified_name"
            )
            # A WABA override covers every number in this account. Inspect the complete paginated
            # account before applying the browser's selected-number filter.
            if len(numbers) != 1:
                raise HTTPException(
                    409, "Choose a WhatsApp Business account containing only the number for this proof."
                )
            if body.phoneNumberId:
                numbers = [number for number in numbers if str(number.get("id")) == body.phoneNumberId]
            eligible = []
            for number in numbers:
                number_id = str(number.get("id") or "")
                if not re.fullmatch(r"\d{1,40}", number_id):
                    raise GraphError("phone_identity")
                detail = await graph.request(
                    "GET",
                    number_id,
                    token,
                    {
                        "fields": "id,is_on_biz_app,platform_type,webhook_configuration",
                    },
                )
                if str(detail.get("id")) != number_id:
                    raise GraphError("phone_identity")
                if detail.get("is_on_biz_app") is True and detail.get("platform_type") == "CLOUD_API":
                    eligible.append({**number, **detail})
            if len(eligible) != 1:
                raise HTTPException(
                    409,
                    "Select one verified WhatsApp Business app coexistence number. "
                    "Fresh Cloud API numbers use a separate commissioning flow.",
                )
            number = eligible[0]
            number_id = str(number["id"])
            if session(request)["identity"] != owner or authorization["expiresAt"] < time.time():
                raise HTTPException(401, "Open WhatsApp setup again to renew this authorization.")
            if authorization.get("phoneId") and authorization["phoneId"] != number_id:
                raise HTTPException(403, "Continue with the phone selected in this Meta setup.")
            for account in registry.stores():
                binding = account.connection()
                if binding and binding["wabaId"] == body.wabaId and binding["phoneId"] != number_id:
                    raise HTTPException(
                        409, "Review this account's saved phone binding before connecting its replacement."
                    )
            # Browser IDs are hints. Select private storage only after the exchanged token has
            # verified the exact account, its full phone list, and this coexistence phone.
            try:
                store = registry.for_account(body.wabaId, number_id)
            except ValueError:
                raise HTTPException(409, "Review the saved WhatsApp account binding.") from None
            existing = store.get("connection")
            if existing and existing.get("lifecycleEvent") == "ACCOUNT_OFFBOARDED":
                raise HTTPException(
                    409, "Reconnect this WhatsApp Business account in Meta before continuing."
                )
            configured_workspace = config.workspace_for(body.wabaId, number_id)
            if existing and not existing.get("workspace") and configured_workspace:
                store.bind_workspace(configured_workspace)
                existing = store.get("connection")

            def grant_access():
                try:
                    customer_cookie = registry.grant(request.cookies.get(COOKIE, ""), store)
                except ValueError:
                    raise HTTPException(401, "Open WhatsApp setup again to renew this session.") from None
                successor = registry.lookup(customer_cookie)
                authorization.update(owner=successor["identity"], wabaId=body.wabaId, phoneId=number_id)
                registry.root.put(auth_key, authorization)
                request.state.customer_cookie = customer_cookie

            if existing:
                grant_access()
                if store.authorized() and (store.get("setup") or {}).get("status") == "ready":
                    # Reauthorization opens existing chats; setup's once-only calls stay finished.
                    store.reauthorize(token)
                    authorization["connected"] = True
                    registry.root.put(auth_key, authorization)
                    return state(store)
            request.state.proof_store = store
            request.state.proof_setup_active = True
            store.put("setup", {"status": "pending", "step": "verifying", "error": None})
            reusable_operations = [
                "contacts", *(["history"] if existing and existing.get("historyRequested") else [])
            ]
            reusable_import = existing and all(
                (store.operation(name) or {}).get("state") == "accepted"
                for name in reusable_operations
            )
            if existing and time.time() - existing["connectedAt"] >= 24 * 60 * 60 and not reusable_import:
                raise HTTPException(
                    409, "The history request window has elapsed. Review the saved connection."
                )
            subscriptions = await graph.collection(f"{body.wabaId}/subscribed_apps", token)
            own = [
                item
                for item in subscriptions
                if str((item.get("whatsapp_business_api_data") or {}).get("id")) == config.app_id
            ]
            other = [item for item in subscriptions if item not in own]
            routing = number.get("webhook_configuration") or {}
            if not isinstance(routing, dict):
                raise GraphError("callback_audit")
            application_callback = routing.get("application")
            if not isinstance(application_callback, str) or not application_callback.startswith("https://"):
                raise HTTPException(
                    409, "Verify the existing application callback before connecting this account."
                )
            intent = {
                "appId": config.app_id,
                "wabaId": body.wabaId,
                "phoneId": number_id,
                "callback": config.callback,
                "applicationCallback": application_callback,
            }
            saved_intent = store.get("subscription-intent")
            owned_subscription = store.operation("subscription")
            accepted_subscription = (
                existing
                and owned_subscription
                and owned_subscription["state"] == "accepted"
                and saved_intent == intent
            )
            if (saved_intent and saved_intent != intent) or (owned_subscription and not saved_intent):
                raise HTTPException(409, "Review the saved subscription and its original callback binding.")
            overrides = [routing.get("phone_number"), routing.get("whatsapp_business_account")]
            overrides.extend(item.get("override_callback_uri") for item in own)
            if (
                other
                or len(own) > 1
                or any(value and value != config.callback for value in overrides)
                or (own and not accepted_subscription)
            ):
                raise HTTPException(
                    409,
                    "This number has an existing webhook consumer. "
                    "A dedicated connection review is needed before routing its history here.",
                )
            if owned_subscription and owned_subscription["state"] != "accepted":
                raise HTTPException(
                    409, "The saved Meta request needs review before this setup can continue."
                )
            # Commit the exact binding before any callback can race the subscription HTTP response.
            store.bind(
                {
                    "wabaId": body.wabaId,
                    "phoneId": number_id,
                    "number": str(number.get("display_phone_number") or ""),
                    "name": str(number.get("verified_name") or waba.get("name") or ""),
                    "coexistence": True,
                    **({"workspace": configured_workspace} if configured_workspace else {}),
                },
                token,
                body.historyRequested,
                activate=not bool(existing),
            )
            if not existing:
                grant_access()
            if saved_intent is None:
                store.put("subscription-intent", intent)
            store.put(
                "routing-audit",
                {
                    "subscriptions": subscriptions,
                    "phoneRouting": routing,
                    "verifiedAt": time.time(),
                    "accountUpdates": "existing-application-default",
                },
            )
            if not own:
                # The Subscribed Apps API accepts subscription plus WABA override in one request.
                # The intent and once-only claim are durable before sending it. A rejected or
                # uncertain outcome requires review; a bare subscription is never a fallback.
                await provider_step(
                    store,
                    "subscription",
                    "POST",
                    f"{body.wabaId}/subscribed_apps",
                    token,
                    {
                        "override_callback_uri": config.callback,
                        "verify_token": config.verify_token,
                    },
                    operation=(
                        f"subscription:{existing.get('disconnectedAt')}"
                        if existing and existing.get("disconnectedAt") else None
                    ),
                )
            store.put("setup", {"status": "pending", "step": "callback-verification", "error": None})
            verified_subscriptions = await graph.collection(f"{body.wabaId}/subscribed_apps", token)
            if (
                len(verified_subscriptions) != 1
                or str((verified_subscriptions[0].get("whatsapp_business_api_data") or {}).get("id"))
                != config.app_id
                or verified_subscriptions[0].get("override_callback_uri") != config.callback
            ):
                raise HTTPException(
                    409, "Confirm this proof's account subscription before requesting history."
                )
            verified = await graph.request("GET", number_id, token, {"fields": "webhook_configuration"})
            verified_routing = verified.get("webhook_configuration") or {}
            if not isinstance(verified_routing, dict):
                raise GraphError("callback_audit")
            if verified_routing.get("application") != application_callback:
                raise HTTPException(
                    409,
                    "The application callback changed during setup. Review its original routing "
                    "and the saved requests before continuing.",
                )
            effective = (
                verified_routing.get("phone_number")
                or verified_routing.get("whatsapp_business_account")
                or verified_routing.get("application")
            )
            if (
                verified_routing.get("whatsapp_business_account") != config.callback
                or effective != config.callback
            ):
                raise HTTPException(409, "Confirm this proof's effective callback before requesting history.")
            store.put(
                "routing-audit",
                {
                    "subscriptions": verified_subscriptions,
                    "phoneRouting": verified_routing,
                    "verifiedAt": time.time(),
                    "accountUpdates": "existing-application-default",
                },
            )
            await provider_step(
                store,
                "contacts",
                "POST",
                f"{number_id}/smb_app_data",
                token,
                {"messaging_product": "whatsapp", "sync_type": "smb_app_state_sync"},
            )
            if body.historyRequested:
                await provider_step(
                    store,
                    "history",
                    "POST",
                    f"{number_id}/smb_app_data",
                    token,
                    {"messaging_product": "whatsapp", "sync_type": "history"},
                )
            registry.root.put(auth_key, {**authorization, "connected": True})
            if existing:
                store.activate()
            store.put("setup", {"status": "ready", "step": "complete", "error": None})
            wake.set()
            return state(store)

    @app.get("/api/proof/conversations")
    async def conversations(request: Request):
        store = account_session(request)
        return {"conversations": await asyncio.to_thread(store.conversations)}

    @app.get("/api/proof/conversations/{conversation}/messages")
    async def messages(
        conversation: str,
        request: Request,
        before: str | None = None,
        limit: int = Query(default=100, ge=1, le=100),
    ):
        store = account_session(request)
        try:
            return await asyncio.to_thread(store.messages, conversation, before, limit)
        except ValueError:
            raise HTTPException(400, "Use a valid history cursor for this conversation.") from None

    @app.get("/api/proof/intake")
    async def intake(
        request: Request,
        after: str | None = None,
        limit: int = Query(default=50, ge=1, le=100),
    ):
        store = account_session(request)
        if not (store.get("connection") or {}).get("workspace"):
            raise HTTPException(409, "This WhatsApp account is awaiting its Cedar workspace binding.")
        try:
            return await asyncio.to_thread(store.intake, after, limit)
        except ValueError:
            raise HTTPException(400, "Use a valid WhatsApp intake cursor.") from None

    @app.post("/api/proof/whatsapp/disconnect")
    async def disconnect_whatsapp(request: Request):
        origin(request)
        configured()
        async with connect_lock:
            store = account_session(request)
            connection = store.get("connection")
            token = store.get("token")
            siblings = [candidate for candidate in registry.authorized_waba_stores(
                connection["wabaId"]
            ) if candidate is not store]
            if not siblings:
                result = await graph.request(
                    "DELETE", f"{connection['wabaId']}/subscribed_apps", token
                )
                if result.get("success") is not True:
                    raise GraphError("disconnect_acceptance")
            store.disconnect()
            registry.invalidate_account(store)
        response = JSONResponse(state(store))
        response.delete_cookie(COOKIE, path="/", secure=True, httponly=True, samesite="strict")
        return response

    @app.get("/webhooks/whatsapp")
    async def verify_webhook(request: Request):
        query = request.query_params
        if (
            len(config.verify_token) < 16
            or query.get("hub.mode") != "subscribe"
            or not secrets.compare_digest(
                query.get("hub.verify_token", "").encode("utf-8"), config.verify_token.encode("utf-8")
            )
        ):
            raise HTTPException(403, "Webhook verification required.")
        return PlainTextResponse(query.get("hub.challenge", ""))

    @app.post("/webhooks/whatsapp")
    async def webhook(request: Request):
        if not registry or not config.app_secret:
            raise HTTPException(503, "Private webhook storage configuration required.")
        raw = bytearray()
        async for chunk in request.stream():
            raw.extend(chunk)
            if len(raw) > 32 * 1024 * 1024:
                raise HTTPException(413, "Webhook exceeds the private proof capture limit.")
        signature = "sha256=" + hmac.new(config.app_secret.encode(), raw, hashlib.sha256).hexdigest()
        if not secrets.compare_digest(signature, request.headers.get("x-hub-signature-256", "")):
            raise HTTPException(403, "Webhook signature verification required.")
        try:
            payload = json.loads(raw)
            if payload.get("object") != "whatsapp_business_account":
                raise ValueError("Webhook object required")
            entries = payload.get("entry")
            if not isinstance(entries, list) or not entries:
                raise ValueError("Webhook entries required")
            async with connect_lock:
                destinations = []
                lifecycle = []
                for entry in entries:
                    waba = str(entry.get("id"))
                    changes = entry.get("changes")
                    if not isinstance(changes, list) or not changes:
                        raise ValueError("Webhook changes required")
                    routed = {}
                    for change in changes:
                        if not isinstance(change, dict):
                            raise ValueError("Webhook change required")
                        value = change.get("value") or {}
                        if not isinstance(value, dict):
                            raise ValueError("Webhook value required")
                        action = lifecycle_action(change)
                        if action is not None:
                            occurred_at = entry.get("time")
                            if isinstance(occurred_at, bool) or not isinstance(occurred_at, int):
                                raise ValueError("Webhook lifecycle time required")
                            stores = registry.waba_stores(waba)
                            if not stores:
                                raise HTTPException(
                                    503, "Waiting for the authorized WhatsApp account binding."
                                )
                            lifecycle.extend((store, action, occurred_at) for store in stores)
                            continue
                        phone = (value.get("metadata") or {}).get("phone_number_id")
                        if change.get("field") == "account_update" and phone is None:
                            stores = registry.authorized_waba_stores(waba)
                        else:
                            store = registry.webhook_store(waba, str(phone))
                            stores = [store] if store is not None else []
                        if not stores:
                            raise HTTPException(503, "Waiting for the authorized WhatsApp account binding.")
                        for store in stores:
                            routed.setdefault(store, []).append(change)
                    destinations.extend(
                        (store, {**entry, "changes": scoped}) for store, scoped in routed.items()
                    )
                blocked = set()
                for store, action, occurred_at in lifecycle:
                    apply_lifecycle(store, action, occurred_at)
                    if not store.authorized():
                        blocked.add(store)
                # A Meta delivery can contain several customers. Each encrypted capture is scoped
                # to one verified WABA; retries remain idempotent if a later capture fails. Events
                # paired with a lifecycle suspension stay out of the live account after its proof
                # authority has been withdrawn.
                for store, entry in destinations:
                    if store in blocked:
                        continue
                    captured = json.dumps(
                        {"object": payload["object"], "entry": [entry]}, separators=(",", ":")
                    ).encode()
                    await asyncio.to_thread(store.capture, captured)
        except (ValueError, TypeError, AttributeError):
            raise HTTPException(403, "Webhook must match an authorized WhatsApp account and phone.") from None
        wake.set()
        return {"received": True}

    if registry is not None:
        from connection_probe import install as install_connection_probe

        install_connection_probe(app, config, graph, configured)

    if config.static_dir and Path(config.static_dir).is_dir():
        static = Path(config.static_dir).resolve()

        @app.get("/")
        async def index():
            entry = static / "cedar-connections.html"
            if not entry.is_file():
                entry = static / "index.html"
            if not entry.is_file():
                raise HTTPException(503, "Build the Cedar connections entry to open this proof.")
            return FileResponse(entry)

        app.mount("/", StaticFiles(directory=static, html=True), name="cedar-connections")
    return app
