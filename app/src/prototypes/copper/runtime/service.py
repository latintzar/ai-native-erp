from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import secrets
import time
from contextlib import asynccontextmanager, suppress
from pathlib import Path
from typing import Any, Callable, Literal
from urllib.parse import urlsplit

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse, Response
from pydantic import BaseModel, ConfigDict, Field, StrictInt, field_validator

from .config import Settings
from .contracts import Checkout, PaymentIntent, ProviderError
from .store import Store, StoreError

PROVIDERS = {
    "flow": {"label": "Flow", "required": ["api_key", "secret_key"],
             "optional": ["merchant_id", "payment_method"], "registration": "https://dashboard.sandbox.flow.cl/register"},
    "izipay": {"label": "Izipay", "required": ["merchant_code", "api_key", "hash_key"],
               "optional": ["terms_url"], "registration": "https://developers.izipay.pe/getting-started/"},
    "mercadopago": {"label": "Mercado Pago", "required": ["access_token", "collector_id", "webhook_secret"],
                    "optional": ["public_key", "refresh_token", "expires_at"], "registration": "https://www.mercadopago.com.pe/developers/panel/app"},
}
WEB = Path(__file__).parent / "web"


class SellerInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=100)
    provider: Literal["flow", "izipay", "mercadopago"]
    environment: Literal["sandbox", "live"] = "sandbox"
    credentials: dict[str, str]

    @field_validator("credentials")
    @classmethod
    def bounded_credentials(cls, value: dict[str, str]) -> dict[str, str]:
        if len(value) > 16 or any(len(k) > 50 or len(v) > 8192 for k, v in value.items()):
            raise ValueError("credential_size")
        return value


class RequestInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    seller_id: str = Field(min_length=36, max_length=36)
    document_id: str = Field(min_length=1, max_length=100)
    description: str = Field(min_length=1, max_length=100)
    amount_minor: StrictInt = Field(gt=0, le=200000)
    currency: Literal["PEN"] = "PEN"
    payer_email: str = Field(min_length=5, max_length=100)
    checkout_mode: Literal["hosted", "yape"] = "hosted"
    billing: dict[str, str] = Field(default_factory=dict)
    shipping: dict[str, str] = Field(default_factory=dict)

    @field_validator("payer_email")
    @classmethod
    def valid_email(cls, value: str) -> str:
        if value.count("@") != 1 or any(c.isspace() for c in value):
            raise ValueError("email")
        return value


class YapeInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    token: str = Field(min_length=1, max_length=4096)


class OAuthInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=100)
    environment: Literal["sandbox", "live"] = "sandbox"


class RecoveryInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    provider_id: str = Field(min_length=1, max_length=150)
    url: str = Field(min_length=1, max_length=4096)
    recovery_token: str = Field(default="", max_length=4096)


def adapter_for(credentials: dict[str, str], environment: str, client: httpx.AsyncClient,
                provider: str) -> Any:
    if provider == "flow":
        from .providers.flow import FlowAdapter
        return FlowAdapter(credentials, environment, client)
    if provider == "izipay":
        from .providers.izipay import IzipayAdapter
        return IzipayAdapter(credentials, environment, client)
    from .providers.mercadopago import MercadoPagoAdapter
    return MercadoPagoAdapter(credentials, environment, client)


class Engine:
    def __init__(self, store: Store, settings: Settings, client: httpx.AsyncClient,
                 factory: Callable | None = None) -> None:
        self.store, self.settings, self.client, self.factory = store, settings, client, factory
        self.locks: dict[str, asyncio.Lock] = {}
        self.seller_locks: dict[str, asyncio.Lock] = {}
        self.last_worker_success: float | None = None
        self.worker_error = ""

    def lock(self, request_id: str) -> asyncio.Lock:
        return self.locks.setdefault(request_id, asyncio.Lock())

    def intent(self, item: dict[str, Any]) -> PaymentIntent:
        root = self.settings.public_origin
        return PaymentIntent(
            reference=item["id"], amount_minor=item["amount_minor"], currency=item["currency"],
            description=item["description"], payer_email=item["payer_email"],
            billing=item.get("billing", {}), shipping=item.get("shipping", {}),
            notify_url=f"{root}/webhooks/{item['id']}/{item['webhook_token']}",
            return_url=f"{root}/pay/{item['id']}/{item['public_token']}",
        )

    def raw_adapter(self, seller: dict[str, Any]) -> Any:
        if seller["environment"] == "live" and not self.settings.allow_live:
            raise ProviderError("live_connection_disabled")
        if self.factory:
            return self.factory(seller["credentials"], seller["environment"], self.client)
        return adapter_for(seller["credentials"], seller["environment"], self.client, seller["provider"])

    async def adapter(self, seller_id: str) -> Any:
        async with self.seller_locks.setdefault(seller_id, asyncio.Lock()):
            seller = self.store.seller(seller_id)
            credentials = seller["credentials"]
            expiry = credentials.get("expires_at")
            if seller["provider"] == "mercadopago" and expiry and float(expiry) < time.time() + 300:
                if not (credentials.get("refresh_token") and self.settings.mp_client_id
                        and self.settings.mp_client_secret):
                    raise ProviderError("seller_reconnection_required")
                from .providers.mercadopago import refresh_tokens
                tokens = await refresh_tokens(
                    self.client, client_id=self.settings.mp_client_id,
                    client_secret=self.settings.mp_client_secret,
                    refresh_token=credentials["refresh_token"], environment=seller["environment"])
                if str(tokens.get("collector_id")) != str(credentials.get("collector_id")):
                    raise ProviderError("seller_refresh_mismatch")
                credentials.update({k: str(v) for k, v in tokens.items()})
                self.store.update_credentials(seller_id, credentials)
                seller["credentials"] = credentials
            return self.raw_adapter(seller)

    async def create(self, item: dict[str, Any]) -> None:
        if not self.store.claim_creation(item["id"]):
            return
        try:
            adapter = await self.adapter(item["seller_id"])
            if item["checkout_mode"] == "yape":
                seller = self.store.seller(item["seller_id"])
                if seller["provider"] != "mercadopago" or not seller["credentials"].get("public_key"):
                    raise ProviderError("custom_yape_configuration_required")
                checkout = Checkout(item["id"], self.intent(item).return_url)
            else:
                checkout = await adapter.create_checkout(self.intent(item))
            self.store.set_checkout(item["id"], checkout)
        except ProviderError as exc:
            self.store.creation_failed(item["id"], exc.code,
                                       uncertain=exc.retryable or "uncertain" in exc.code)
        except Exception:
            self.store.creation_failed(item["id"], "creation_uncertain", uncertain=True)

    async def refresh(self, request_id: str, event_id: str = "") -> None:
        async with self.lock(request_id):
            item = self.store.request(request_id)
            if not item["checkout"]:
                raise ProviderError("checkout_recovery_required")
            adapter = await self.adapter(item["seller_id"])
            observed = await adapter.get_payment(Checkout(**item["checkout"]), self.intent(item), event_id)
            self.store.apply(request_id, observed)

    async def process_jobs(self) -> None:
        for job in self.store.jobs():
            try:
                event = json.loads(job["payload"])
                await self.refresh(job["request_id"], event.get("event_id", ""))
                self.store.finish_job(job["id"])
            except (ProviderError, StoreError) as exc:
                code = exc.code if isinstance(exc, ProviderError) else str(exc)
                self.store.fail_job(job["id"], code)
                self.store.sync_failed(job["request_id"], code)
            except Exception:
                self.store.fail_job(job["id"], "confirmation_retry_required")

    async def sweep(self) -> None:
        for item in self.store.requests(limit=None):
            if item["phase"] != "ready" or item["status"] == "refunded":
                continue
            interval = 3600 if item["status"] == "paid" else self.settings.poll_seconds
            if time.time() - (item["last_sync"] or item["created"]) < interval:
                continue
            try:
                await self.refresh(item["id"])
            except (ProviderError, StoreError) as exc:
                self.store.sync_failed(item["id"], exc.code if isinstance(exc, ProviderError) else str(exc))
            except Exception:
                self.store.sync_failed(item["id"], "confirmation_retry_required")

    async def work(self) -> None:
        while True:
            try:
                await self.process_jobs()
                await self.sweep()
                self.last_worker_success = time.time()
                self.worker_error = ""
            except Exception:
                # Keep the durable worker alive; per-request errors are recorded above.
                self.worker_error = "worker_cycle_failed"
            await asyncio.sleep(self.settings.poll_seconds)


def create_app(settings: Settings, *, adapter_factory: Callable | None = None,
               start_worker: bool = True, http_client: httpx.AsyncClient | None = None) -> FastAPI:
    store = Store(settings.state_dir / "payments.sqlite", settings.encryption_key)
    client = http_client or httpx.AsyncClient(follow_redirects=False, timeout=20)
    engine = Engine(store, settings, client, adapter_factory)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        store.recover_inflight()
        task = asyncio.create_task(engine.work()) if start_worker else None
        try:
            yield
        finally:
            if task:
                task.cancel()
                with suppress(asyncio.CancelledError):
                    await task
            if http_client is None:
                await client.aclose()

    app = FastAPI(title="Copper payment prototype", docs_url=None, redoc_url=None,
                  openapi_url=None, lifespan=lifespan)
    app.state.store, app.state.engine = store, engine
    rate: dict[str, tuple[int, float]] = {}

    @app.middleware("http")
    async def boundaries(request: Request, call_next: Callable) -> Response:
        if request.method in {"POST", "PUT", "PATCH"}:
            body = bytearray()
            async for chunk in request.stream():
                body.extend(chunk)
                if len(body) > 65536:
                    return JSONResponse({"error": "request_too_large"}, status_code=413)
            request._body = bytes(body)
            origin = request.headers.get("origin")
            if origin and origin.rstrip("/") != settings.public_origin.rstrip("/"):
                return JSONResponse({"error": "origin_mismatch"}, status_code=403)
        if request.url.path.startswith(("/pay/", "/webhooks/", "/api/oauth/")):
            bucket = hashlib.sha256(((request.client.host if request.client else "") + request.url.path).encode()).hexdigest()
            now = time.time()
            count, since = rate.get(bucket, (0, now))
            count, since = (0, now) if now - since > 60 else (count, since)
            if count > 120:
                return JSONResponse({"error": "retry_later"}, status_code=429)
            if len(rate) > 10000:
                rate.clear()
            rate[bucket] = (count + 1, since)
        result = await call_next(request)
        result.headers["Cache-Control"] = "no-store"
        result.headers["Referrer-Policy"] = "no-referrer"
        result.headers["X-Content-Type-Options"] = "nosniff"
        result.headers["X-Frame-Options"] = "DENY"
        result.headers["X-Robots-Tag"] = "noindex, nofollow"
        result.headers["Content-Security-Policy"] = (
            "default-src 'self'; script-src 'self' https://sdk.mercadopago.com; "
            "connect-src 'self' https://api.mercadopago.com; frame-src https://*.mercadopago.com https://*.mercadopago.com.pe; "
            "style-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'")
        return result

    def operator(authorization: str = Header(default="")) -> None:
        expected = "Bearer " + settings.admin_token
        if not hmac.compare_digest(authorization.encode(), expected.encode()):
            raise HTTPException(401, detail="operator_access_required")

    def public_item(request_id: str, token: str, *, webhook: bool = False) -> dict[str, Any]:
        try:
            item = store.request(request_id)
        except StoreError:
            raise HTTPException(404, detail="payment_request_missing") from None
        field = "webhook_token" if webhook else "public_token"
        if not hmac.compare_digest(item[field].encode(), token.encode()):
            raise HTTPException(404, detail="payment_request_missing")
        return item

    def safe_seller(seller: dict[str, Any]) -> dict[str, Any]:
        return {k: seller[k] for k in ("id", "name", "provider", "environment", "created")}

    def safe_request(item: dict[str, Any]) -> dict[str, Any]:
        data = {k: item[k] for k in ("id", "seller_id", "document_id", "description", "amount_minor",
                                    "currency", "phase", "status", "last_error", "last_sync", "created", "checkout_mode")}
        data["public_url"] = f"{settings.public_origin}/pay/{item['id']}/{item['public_token']}"
        return data

    @app.exception_handler(StoreError)
    async def store_error(_: Request, exc: StoreError) -> JSONResponse:
        status = 404 if str(exc).endswith("_missing") else 409
        return JSONResponse({"error": str(exc)}, status_code=status)

    @app.exception_handler(ProviderError)
    async def provider_error(_: Request, exc: ProviderError) -> JSONResponse:
        return JSONResponse({"error": exc.code, "retryable": exc.retryable}, status_code=502)

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok", "environment": "development/demo"}

    @app.get("/")
    async def index() -> HTMLResponse:
        return HTMLResponse((WEB / "operator.html").read_text())

    @app.get("/assets/{name}")
    async def asset(name: str) -> Response:
        if name not in {"operator.js", "checkout.js", "style.css"}:
            raise HTTPException(404)
        media = "text/css" if name.endswith(".css") else "application/javascript"
        return Response((WEB / name).read_text(), media_type=media)

    @app.get("/api/config", dependencies=[Depends(operator)])
    async def config() -> dict[str, Any]:
        return {"providers": PROVIDERS, "live_enabled": settings.allow_live,
                "oauth_configured": bool(settings.mp_client_id and settings.mp_client_secret and settings.mp_webhook_secret),
                "origin": settings.public_origin, "evidence": "Local contract tests; provider verification pending",
                "worker_last_success": engine.last_worker_success, "worker_error": engine.worker_error}

    @app.get("/api/sellers", dependencies=[Depends(operator)])
    async def sellers() -> list[dict[str, Any]]:
        return [safe_seller(s) for s in store.sellers()]

    @app.post("/api/sellers", status_code=201, dependencies=[Depends(operator)])
    async def add_seller(data: SellerInput) -> dict[str, Any]:
        if data.environment == "live" and not settings.allow_live:
            raise HTTPException(409, detail="live_activation_required")
        required = PROVIDERS[data.provider]["required"]
        if any(not data.credentials.get(key) for key in required):
            raise HTTPException(422, detail="provider_credentials_required")
        allowed = set(required) | set(PROVIDERS[data.provider]["optional"])
        if set(data.credentials) - allowed:
            raise HTTPException(422, detail="unknown_credential_fields")
        return safe_seller(store.add_seller(data.name, data.provider, data.environment, data.credentials))

    @app.get("/api/requests", dependencies=[Depends(operator)])
    async def requests() -> list[dict[str, Any]]:
        return [safe_request(item) for item in store.requests()]

    @app.post("/api/requests", status_code=201, dependencies=[Depends(operator)])
    async def add_request(data: RequestInput, idempotency_key: str = Header(alias="Idempotency-Key", min_length=1, max_length=100)) -> dict[str, Any]:
        seller = store.seller(data.seller_id)
        if seller["environment"] == "live" and not settings.allow_live:
            raise HTTPException(409, detail="live_activation_required")
        payload = data.model_dump(exclude={"seller_id"})
        item = store.add_request(data.seller_id, idempotency_key, payload)
        await engine.create(item)
        return safe_request(store.request(item["id"]))

    @app.get("/api/requests/{request_id}", dependencies=[Depends(operator)])
    async def one_request(request_id: str) -> dict[str, Any]:
        item = store.request(request_id)
        return {**safe_request(item), "observations": store.observations(request_id)}

    @app.post("/api/requests/{request_id}/refresh", dependencies=[Depends(operator)])
    async def refresh(request_id: str) -> dict[str, Any]:
        try:
            await engine.refresh(request_id)
        except (ProviderError, StoreError) as exc:
            store.sync_failed(request_id, exc.code if isinstance(exc, ProviderError) else str(exc))
            raise
        return safe_request(store.request(request_id))

    @app.post("/webhooks/{request_id}/{token}")
    async def webhook(request_id: str, token: str, request: Request) -> dict[str, str]:
        item = public_item(request_id, token, webhook=True)
        if not item["checkout"]:
            raise HTTPException(503, detail="checkout_recovery_required")
        adapter = engine.raw_adapter(store.seller(item["seller_id"]))
        try:
            event_id = adapter.verify_notification(await request.body(), dict(request.headers),
                                                   dict(request.query_params), Checkout(**item["checkout"]))
        except ProviderError:
            raise HTTPException(401, detail="notification_verification_failed") from None
        store.enqueue(request_id, json.dumps({"event_id": event_id}, sort_keys=True))
        return {"received": "queued"}

    @app.post("/webhooks/mercadopago")
    async def marketplace_webhook(request: Request) -> dict[str, str]:
        body = await request.body()
        try:
            notification = json.loads(body)
            collector = str(notification["user_id"])
        except (ValueError, TypeError, KeyError):
            raise HTTPException(401, detail="notification_verification_failed") from None
        matches = [s for s in store.sellers() if s["provider"] == "mercadopago"
                   and str(s["credentials"].get("collector_id")) == collector]
        for seller in matches:
            adapter = engine.raw_adapter(seller)
            try:
                event_id = adapter.verify_notification(body, dict(request.headers), dict(request.query_params), Checkout("", ""))
            except ProviderError:
                continue
            # Resolve only after authenticating the provider's event. The worker then verifies
            # the full seller, amount, currency, environment and document contract.
            await engine.adapter(seller["id"])
            credentials = store.seller(seller["id"])["credentials"]
            try:
                payment = await client.get("https://api.mercadopago.com/v1/payments/" + event_id,
                    headers={"Authorization": "Bearer " + credentials["access_token"]}, timeout=10)
                payment.raise_for_status()
                result = payment.json()
                reference = result.get("external_reference")
                if str(result.get("collector_id")) != collector:
                    raise ProviderError("provider_merchant_mismatch")
                if not isinstance(reference, str):
                    return {"received": "outside_document_requests"}
                try:
                    item = store.request(reference)
                except StoreError:
                    return {"received": "outside_document_requests"}
                if item["seller_id"] != seller["id"]:
                    continue
                store.enqueue(reference, json.dumps({"event_id": event_id}, sort_keys=True))
                return {"received": "queued"}
            except (httpx.HTTPError, ValueError):
                raise HTTPException(503, detail="confirmation_retry_required") from None
        raise HTTPException(401, detail="notification_verification_failed")

    @app.post("/api/requests/{request_id}/recover", dependencies=[Depends(operator)])
    async def recover(request_id: str, data: RecoveryInput) -> dict[str, Any]:
        item = store.request(request_id)
        if item["phase"] not in {"uncertain", "error"}:
            raise HTTPException(409, detail="recovery_state_required")
        seller = store.seller(item["seller_id"])
        allowed = {
            "flow": {"www.flow.cl", "sandbox.flow.cl", "api.flow.cl"},
            "izipay": {"paymentlink.izipay.pe"},
            "mercadopago": {"www.mercadopago.com.pe", "sandbox.mercadopago.com.pe"},
        }
        try:
            url = urlsplit(data.url)
            if (url.scheme != "https" or url.hostname not in allowed[seller["provider"]]
                    or url.username or url.password or url.port not in {None, 443} or url.fragment):
                raise ValueError("url")
        except ValueError:
            raise HTTPException(422, detail="provider_checkout_url_required") from None
        checkout = Checkout(**data.model_dump())
        async with engine.lock(request_id):
            adapter = await engine.adapter(item["seller_id"])
            # Mercado Pago's payment search cannot establish an arbitrary preference's identity.
            if seller["provider"] == "mercadopago":
                if not all(c.isalnum() or c == "-" for c in data.provider_id):
                    raise HTTPException(422, detail="provider_preference_required")
                response = await client.get("https://api.mercadopago.com/checkout/preferences/" + data.provider_id,
                    headers={"Authorization": "Bearer " + store.seller(item["seller_id"])["credentials"]["access_token"]})
                if response.status_code != 200:
                    raise ProviderError("preference_recovery_failed")
                preference = response.json()
                if (preference.get("external_reference") != request_id
                        or str(preference.get("collector_id")) != seller["credentials"]["collector_id"]
                        or data.url not in {preference.get("init_point"), preference.get("sandbox_init_point")}):
                    raise ProviderError("preference_recovery_mismatch")
            observed = await adapter.get_payment(checkout, engine.intent(item))
            store.apply(request_id, observed)
            store.set_checkout(request_id, checkout)
        return safe_request(store.request(request_id))

    @app.get("/pay/{request_id}/{token}")
    async def checkout_page(request_id: str, token: str) -> HTMLResponse:
        public_item(request_id, token)
        return HTMLResponse((WEB / "checkout.html").read_text())

    @app.get("/pay/{request_id}/{token}/status")
    async def checkout_status(request_id: str, token: str) -> dict[str, Any]:
        item = public_item(request_id, token)
        seller = store.seller(item["seller_id"])
        return {"description": item["description"], "document_id": item["document_id"],
                "amount_minor": item["amount_minor"], "currency": item["currency"],
                "status": item["status"], "phase": item["phase"], "provider": seller["provider"],
                "environment": seller["environment"], "seller_name": seller["name"],
                "checkout_mode": item["checkout_mode"],
                "charge_phase": item["charge_phase"],
                "public_key": seller["credentials"].get("public_key", "") if item["checkout_mode"] == "yape" else ""}

    @app.get("/pay/{request_id}/{token}/continue")
    async def continue_checkout(request_id: str, token: str) -> RedirectResponse:
        item = public_item(request_id, token)
        if item["phase"] != "ready" or item["status"] != "pending" or item["checkout_mode"] == "yape":
            raise HTTPException(409, detail="payment_status_review")
        return RedirectResponse(item["checkout"]["url"], status_code=303)

    @app.post("/pay/{request_id}/{token}/yape")
    async def yape(request_id: str, token: str, data: YapeInput) -> dict[str, Any]:
        item = public_item(request_id, token)
        seller = store.seller(item["seller_id"])
        if seller["provider"] != "mercadopago" or item["checkout_mode"] != "yape" or item["phase"] != "ready":
            raise HTTPException(409, detail="yape_checkout_required")
        async with engine.lock(request_id):
            adapter = await engine.adapter(item["seller_id"])
            charge_key = store.claim_charge(request_id)
            try:
                observed = await adapter.create_yape_payment(engine.intent(item), data.token, charge_key)
                store.apply(request_id, observed)
            except (ProviderError, StoreError) as exc:
                store.sync_failed(request_id, exc.code if isinstance(exc, ProviderError) else str(exc))
                raise
        return {"status": store.request(request_id)["status"]}

    @app.post("/api/oauth/mercadopago/start", dependencies=[Depends(operator)])
    async def oauth_start(data: OAuthInput) -> JSONResponse:
        if not (settings.mp_client_id and settings.mp_client_secret and settings.mp_webhook_secret):
            raise HTTPException(409, detail="marketplace_app_configuration_required")
        if data.environment == "live" and not settings.allow_live:
            raise HTTPException(409, detail="live_activation_required")
        from .providers.mercadopago import authorization_url
        verifier, binding = secrets.token_urlsafe(64), secrets.token_urlsafe(32)
        state = store.create_oauth({"name": data.name, "environment": data.environment, "verifier": verifier},
                                   hashlib.sha256(binding.encode()).hexdigest())
        url = authorization_url(settings.mp_client_id, settings.public_origin + "/oauth/mercadopago",
                                state, verifier)
        result = JSONResponse({"url": url})
        result.set_cookie("copper_oauth", binding, max_age=600, httponly=True,
                          secure=settings.public_origin.startswith("https://"), samesite="lax", path="/oauth/mercadopago")
        return result

    @app.get("/oauth/mercadopago")
    async def oauth_callback(request: Request, state: str = "", code: str = "", error: str = "") -> RedirectResponse:
        binding = hashlib.sha256(request.cookies.get("copper_oauth", "").encode()).hexdigest()
        attempt = store.consume_oauth(state, binding)
        if error or not code:
            raise HTTPException(400, detail="seller_authorization_incomplete")
        from .providers.mercadopago import exchange_code
        tokens = await exchange_code(client, client_id=settings.mp_client_id,
                                     client_secret=settings.mp_client_secret,
                                     redirect_uri=settings.public_origin + "/oauth/mercadopago",
                                     code=code, verifier=attempt["verifier"], environment=attempt["environment"])
        credentials = {k: str(v) for k, v in tokens.items()}
        credentials["webhook_secret"] = settings.mp_webhook_secret
        store.add_seller(attempt["name"], "mercadopago", attempt["environment"], credentials)
        result = RedirectResponse("/?connected=mercadopago", status_code=303)
        result.delete_cookie("copper_oauth", path="/oauth/mercadopago")
        return result

    return app
