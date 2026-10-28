"""Cedar's native collection development API. Bank evidence has an operator-only boundary."""

from __future__ import annotations

import asyncio
import base64
import binascii
import hashlib
import hmac
import re
import time
from contextlib import asynccontextmanager, suppress
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from io import BytesIO
from pathlib import Path
from typing import Any, Callable, Literal

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, Response
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, ConfigDict, Field, StrictInt, field_validator

from .cedar_amounts import amount_candidate, payer_name, quoted_rounding
from .cedar_commercial import CommercialDocument, attach_fiscal, revise_commercial, validate_commercial
from .cedar_fiscal import BillingDraft, FiscalEngine, validate_binding
from .cedar_store import CedarStore, fingerprint, now_iso
from .config import Settings
from .contracts import ProviderError
from .providers import sample_bank
from .providers.nubefact import NubeFactClient
from .providers.prometeo import PrometeoClient
from .store import StoreError

WEB = Path(__file__).parent / "web"


def fixture_anchor(fixture_day: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")) -> str | None:
    """A private sample read follows the browser's persisted ledger date, within 2000–2099."""
    if fixture_day is None:
        return None
    try:
        parsed = date.fromisoformat(fixture_day)
        if parsed.year < 2000 or parsed.year > 2099:
            raise ValueError("fixture_day_range")
    except ValueError as exc:
        raise HTTPException(422, "Choose a sample calendar date from 2000 through 2099.") from exc
    return parsed.isoformat()


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class ReceiptInput(Input):
    amount_minor: StrictInt = Field(gt=0, le=1_000_000_000_000)
    currency: Literal["PEN", "USD", "EUR"] = "PEN"
    reference: str = Field(min_length=1, max_length=120)
    method: Literal["yape", "plin", "transfer", "cash"] = "transfer"
    source: Literal["sample", "manual"]
    created_at: datetime | None = None


class OpeningReceiptInput(ReceiptInput):
    """A carried sample/manual receipt retains the original split of cash and rounding."""
    rounding_minor: StrictInt = Field(default=0, ge=0, le=99)


class CollectionInput(Input):
    invoice_id: str = Field(min_length=1, max_length=120)
    document_id: str = Field(min_length=1, max_length=120)
    seller_name: str = Field(min_length=1, max_length=160)
    seller_ruc: str = Field(default="", pattern=r"^\d{0,11}$", max_length=11)
    customer_name: str = Field(default="", max_length=160)
    description: str = Field(min_length=1, max_length=200)
    amount_minor: StrictInt = Field(ge=0, le=1_000_000_000_000)
    invoice_amount_minor: StrictInt = Field(gt=0, le=1_000_000_000_000)
    currency: Literal["PEN"] = "PEN"
    receiving_bank: Literal["bbva", "interbank", "scotiabank"]
    account_label: str = Field(min_length=1, max_length=100)
    reference: str = Field(min_length=1, max_length=120)
    idempotency_key: str = Field(min_length=1, max_length=160)
    initial_receipts: list[OpeningReceiptInput] = Field(default_factory=list, max_length=500)
    sample_clock: datetime | None = None
    billing_draft: BillingDraft | None = None
    commercial_document: CommercialDocument | None = None
    fixture_owned: bool = False
    fixture_day: date | None = None


class FiscalAttachment(Input):
    billing_draft: BillingDraft


class CommercialRevision(Input):
    expected_fingerprint: str = Field(pattern=r"^[a-f0-9]{64}$")
    commercial_document: CommercialDocument


class FixtureRollover(Input):
    from_day: date
    to_day: date


class PaymentDispatchInput(Input):
    by: Literal["auto", "manual"]


class CollectionBatch(Input):
    requests: list[CollectionInput] = Field(min_length=1, max_length=25)


class WorkspaceInput(Input):
    """The house this workspace belongs to, so the seeded bank answers that house's own ledger."""

    scope: str = Field(default="", max_length=32, pattern=r"^[a-z0-9-]{0,32}$")


class SetupInput(Input):
    seller_name: str = Field(default="", max_length=160)
    ruc: str = Field(default="", max_length=11, pattern=r"^\d{0,11}$")
    invoice_series: str = Field(default="F001", pattern=r"^F[A-Z0-9]{3}$")
    receiving_bank: Literal["bbva", "interbank", "scotiabank"] = "bbva"
    account_label: str = Field(default="", max_length=100)


class ProviderInput(Input):
    provider: Literal["prometeo", "nubefact"]
    environment: Literal["sandbox", "live"] = "sandbox"
    credentials: dict[str, str]

    @field_validator("credentials")
    @classmethod
    def bound_credentials(cls, value: dict[str, str]) -> dict[str, str]:
        if len(value) > 8 or any(len(k) > 50 or len(v) > 8192 for k, v in value.items()):
            raise ValueError("credentials_size")
        return value


class BankLogin(Input):
    provider: str = Field(pattern=r"^(bbva|interbank|scotia|telebanking)_[a-z_]+_pe$", max_length=60)
    username: str = Field(min_length=1, max_length=200)
    password: str = Field(min_length=1, max_length=200)
    extra: dict[str, str] = Field(default_factory=dict, max_length=12)
    resume: bool = False


class BankRead(Input):
    account_number: str = Field(min_length=1, max_length=100)
    currency: Literal["PEN", "USD"] = "PEN"
    date_start: date
    date_end: date


class BankMatch(Input):
    movement_id: str = Field(min_length=1, max_length=64)
    request_id: str = Field(min_length=1, max_length=36)


class BankAccount(Input):
    account_number: str = Field(min_length=1, max_length=100)
    currency: Literal["PEN", "USD"] = "PEN"


class BankClient(Input):
    client_id: str = Field(min_length=1, max_length=100)


class BankMonitor(Input):
    enabled: bool
    interval_seconds: StrictInt = Field(default=300, ge=300, le=3600)


class DocumentInput(Input):
    request_id: str = Field(min_length=36, max_length=36)
    payload: dict[str, Any]


class FiscalCommission(Input):
    seller_ruc: str = Field(pattern=r"^\d{11}$")
    series: str = Field(pattern=r"^F[A-Z0-9]{3}$")
    next_number: StrictInt = Field(ge=1, le=99999999)
    unit_codes: dict[str, str] = Field(min_length=1, max_length=30)
    seller_authorization_confirmed: Literal[True]
    numbering_exclusive_confirmed: Literal[True]

    @field_validator("unit_codes")
    @classmethod
    def units(cls, value: dict[str, str]) -> dict[str, str]:
        if any(
            not 1 <= len(unit) <= 30 or not re.fullmatch(r"[A-Z0-9]{2,5}", code)
            for unit, code in value.items()
        ):
            raise ValueError("invoice_unit_mapping_invalid")
        return value


class FiscalAuthorization(Input):
    draft_fingerprint: str = Field(pattern=r"^[a-f0-9]{64}$")
    real_document_confirmed: Literal[True]
    seller_authorization_confirmed: Literal[True]
    auto_issue_after_payment: bool = False
    zero_tax_category: Literal["exempt", "unaffected"] | None = None
    issue_date_policy: Literal["server-on-first-submission"] = "server-on-first-submission"


class ApprovalInput(Input):
    """The buyer's own Yape phone and approval code, as the checkout's six boxes collect them."""

    phone: str = Field(pattern=r"^9\d{8}$")
    code: str = Field(pattern=r"^\d{6}$")
    quote_id: str | None = Field(default=None, min_length=1, max_length=64)


class DestinationInput(Input):
    method: Literal["yape", "plin"]
    account_number: str = Field(min_length=1, max_length=100)
    currency: Literal["PEN"] = "PEN"
    phone: str = Field(default="", pattern=r"^(?:9\d{8})?$")
    qr_base64: str = Field(min_length=1, max_length=175_000)
    account_ownership_confirmed: Literal[True]
    request_ids: list[str] = Field(min_length=1, max_length=50)
    real_documents_confirmed: Literal[True]

    @field_validator("request_ids")
    @classmethod
    def request_identifiers(cls, value: list[str]) -> list[str]:
        if len(value) != len(set(value)) or any(len(item) != 36 for item in value):
            raise ValueError("request_identifiers")
        return value


def raster_qr(value: str) -> str:
    try:
        raw = base64.b64decode(value, validate=True)
        if len(raw) > 131_072:
            raise ValueError("image_size")
        with Image.open(BytesIO(raw)) as source:
            if source.format not in {"PNG", "JPEG"} or not all(128 <= n <= 2048 for n in source.size):
                raise ValueError("image_format")
            source.load()
            clean = Image.new("RGB", source.size)
            clean.paste(source.convert("RGB"))
            output = BytesIO()
            clean.save(output, format="PNG")
        if output.tell() > 200_000:
            raise ValueError("image_size")
        return base64.b64encode(output.getvalue()).decode()
    except (ValueError, binascii.Error, OSError, UnidentifiedImageError, Image.DecompressionBombError):
        raise HTTPException(422, detail="merchant_qr_invalid") from None


def create_app(
    settings: Settings,
    *,
    http_client: httpx.AsyncClient | None = None,
    clock: Callable[[], float] = time.time,
) -> FastAPI:
    store = CedarStore(settings.state_dir / "cedar.sqlite", settings.encryption_key)
    client = http_client or httpx.AsyncClient(follow_redirects=False, timeout=20)
    fiscal = FiscalEngine(store, client, settings.allow_live)
    origins = list(
        dict.fromkeys(
            [
                settings.public_origin,
                "https://demo.soyrocoto.com",
                "https://cedar-demo.soyrocoto.com",
                *settings.cedar_allowed_origins,
            ]
        )
    )

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        worker = asyncio.create_task(monitor_loop())
        try:
            yield
        finally:
            worker.cancel()
            with suppress(asyncio.CancelledError):
                await worker
            if http_client is None:
                await client.aclose()

    app = FastAPI(
        title="Cedar collections", docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan
    )
    app.state.store = store
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
        allow_credentials=False,
    )
    rate: dict[str, tuple[int, float, int]] = {}

    @app.middleware("http")
    async def boundary(request: Request, call_next: Callable) -> Response:
        origin = request.headers.get("origin")
        if origin and origin not in origins:
            return JSONResponse({"error": "origin_mismatch"}, status_code=403)
        if request.method == "POST":
            body = bytearray()
            async for chunk in request.stream():
                body.extend(chunk)
                if len(body) > 250_000:
                    return JSONResponse({"error": "request_too_large"}, status_code=413)
            request._body = bytes(body)
        bucket = hashlib.sha256(
            (
                (request.client.host if request.client else "")
                + ("workspace" if request.url.path == "/api/cedar/workspaces" else "api")
            ).encode()
        ).hexdigest()
        stamp = time.time()
        interval = 3600 if request.url.path == "/api/cedar/workspaces" else 60
        if len(rate) >= 1000:
            expired = [key for key, (_, started, duration) in rate.items() if stamp - started > duration]
            for key in expired:
                del rate[key]
        count, since, _ = rate.get(bucket, (0, stamp, interval))
        count, since = (0, stamp) if stamp - since > interval else (count, since)
        if request.url.path != "/health" and count >= (100 if interval == 3600 else 600):
            return JSONResponse({"error": "retry_later"}, status_code=429)
        if request.url.path != "/health" and len(rate) >= 10000 and bucket not in rate:
            return JSONResponse({"error": "retry_later"}, status_code=429)
        if request.url.path != "/health":
            rate[bucket] = count + 1, since, interval
        response = await call_next(request)
        response.headers.update(
            {
                "Cache-Control": "no-store",
                "Referrer-Policy": "no-referrer",
                "X-Content-Type-Options": "nosniff",
                "X-Frame-Options": "DENY",
                "X-Robots-Tag": "noindex, nofollow",
                "Content-Security-Policy": (
                    "default-src 'self'; script-src 'self'; connect-src 'self'; style-src 'self'; "
                    "img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
                ),
            }
        )
        return response

    @app.exception_handler(RequestValidationError)
    async def invalid_input(_: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse({"error": "invalid_input"}, status_code=422)

    @app.exception_handler(StoreError)
    async def store_error(_: Request, exc: StoreError) -> JSONResponse:
        code = str(exc)
        status = (
            401
            if code == "workspace_access_required"
            else 404
            if code.endswith("_missing")
            else 429
            if code.endswith("_capacity")
            else 409
        )
        return JSONResponse({"error": code}, status_code=status)

    @app.exception_handler(ProviderError)
    async def provider_error(_: Request, exc: ProviderError) -> JSONResponse:
        return JSONResponse({"error": exc.code, "retryable": exc.retryable}, status_code=502)

    def operator(authorization: str = Header(default="")) -> None:
        if not hmac.compare_digest(authorization.encode(), ("Bearer " + settings.admin_token).encode()):
            raise HTTPException(401, detail="operator_access_required")

    session_locks: dict[str, asyncio.Lock] = {}

    def bank_lock(workspace_id: str) -> asyncio.Lock:
        store.read(workspace_id)
        return session_locks.setdefault(workspace_id, asyncio.Lock())

    async def bank_guard(workspace_id: str, _: None = Depends(operator)):
        async with bank_lock(workspace_id):
            yield

    def owner(authorization: str = Header(default="")) -> str:
        if not authorization.startswith("Bearer "):
            raise HTTPException(401, detail="workspace_access_required")
        return store.authenticate(authorization[7:])

    def safe(item: dict[str, Any]) -> dict[str, Any]:
        if "quote_history" not in item:
            item = store.quoted_request(item["workspace_id"], item["id"])
        result = store.safe_request(item, settings.public_origin)
        result["fiscal"] = fiscal.projection(store.read(item["workspace_id"]), item)
        return result

    def connection(workspace_id: str, provider: str) -> dict[str, Any]:
        cfg = store.read(workspace_id)["providers"].get(provider)
        if not cfg:
            raise StoreError("provider_configuration_required")
        if cfg["environment"] == "live" and not settings.allow_live:
            raise StoreError("live_activation_required")
        return cfg

    def sample(state: dict[str, Any], provider: str) -> bool:
        """THE SEEDED ANSWER STANDS EXACTLY WHERE A COMMISSIONED ACCOUNT HAS YET TO (§251). Sample
        mode is a deployment switch, and it never speaks over a provider this workspace holds."""
        return settings.sample_bank and provider not in state["providers"] and sample_bank.available()

    def prometeo(workspace_id: str) -> PrometeoClient:
        cfg = connection(workspace_id, "prometeo")
        return PrometeoClient(cfg["credentials"]["api_key"], cfg["environment"], client)

    def bank_state(workspace_id: str) -> dict[str, Any]:
        state = store.read(workspace_id)["bank"]
        if state.get("status") != "logged_in":
            raise StoreError("bank_authorization_required")
        return state

    def readiness(state: dict[str, Any]) -> dict[str, Any]:
        bank_sample, invoice_sample = sample(state, "prometeo"), sample(state, "nubefact")
        return {
            "prometeo": {
                "configured": "prometeo" in state["providers"] or bank_sample,
                "bank_authorized": state["bank"].get("status") == "logged_in" or bank_sample,
                "last_read": state["bank"].get("last_read"),
                "mode": state["providers"].get("prometeo", {}).get("environment")
                or ("sample" if bank_sample else None),
                "monitor": state["bank"].get("monitor", {"enabled": False, "status": "off"}),
            },
            "nubefact": {
                "configured": "nubefact" in state["providers"] or invoice_sample,
                "mode": state["providers"].get("nubefact", {}).get("environment")
                or ("sample" if invoice_sample else None),
                "documents": len(state["documents"]),
            },
        }

    def apply_movement(state: dict[str, Any], evidence: dict[str, Any]) -> dict[str, Any] | None:
        if evidence["allocated_to"]:
            return store.item(state, evidence["allocated_to"])
        row = evidence["movement"]
        candidates = amount_candidate(state, row)
        if len(candidates) != 1 or row["debit_minor"] or row["credit_minor"] <= 0:
            evidence.update(match_status="review", reason="bank_account_reference_review_required")
            return None
        item = candidates[0]
        if row["credit_minor"] - quoted_rounding(item, row["credit_minor"], row["currency"]) > store.totals(item)["balance_minor"]:
            evidence.update(match_status="review", reason="bank_amount_review_required")
            return None
        cfg = state["providers"].get("prometeo")
        if not cfg:
            evidence.update(match_status="review", reason="bank_authorization_required")
            return None
        if cfg["environment"] == "live" and not item.get("commissioned_at"):
            evidence.update(match_status="review", reason="real_document_review_required")
            return None
        # Only a live provider read confirms a payment; every other read stays sample evidence, so
        # a commissioned sandbox account under sample mode allocates with sample provenance (§251).
        source = "prometeo" if cfg["environment"] == "live" else "sample"
        store.add_receipt(
            state,
            item,
            {
                "amount_minor": row["credit_minor"],
                "currency": row["currency"],
                "reference": f"PROMETEO-{evidence['id']}",
                "method": "transfer",
                "source": source,
                "created_at": row["date"] + "T00:00:00-05:00",
                "bank_reference": row["reference"],
                "bank_account": row["account_number"],
                "verification": f"prometeo-{cfg['environment']}",
            },
        )
        evidence.update(
            allocated_to=item["id"], allocated_minor=row["credit_minor"], match_status="matched", reason="",
            match_key="reference" if row["reference"] else "amount"
        )
        return item

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok", "environment": "development/demo", "experience": "cedar-collections"}

    @app.get("/")
    async def index() -> HTMLResponse:
        return HTMLResponse((WEB / "cedar-operator.html").read_text())

    @app.get("/assets/{name}")
    async def asset(name: str) -> Response:
        if name == "rocoto-mark.svg":
            return Response((WEB / name).read_bytes(), media_type="image/svg+xml")
        if name in {"yape.png", "plin.png"}:
            return Response((WEB / name).read_bytes(), media_type="image/png")
        if name not in {"cedar-operator.js", "cedar-buyer.js", "style.css", "cedar-buyer.css"}:
            raise HTTPException(404)
        return Response(
            (WEB / name).read_text(),
            media_type="text/css" if name.endswith(".css") else "application/javascript",
        )

    @app.post("/api/cedar/workspaces", status_code=201)
    async def new_workspace(data: WorkspaceInput) -> dict[str, str]:
        return store.create_workspace(data.scope)

    @app.get("/api/cedar/setup")
    async def get_setup(workspace_id: str = Depends(owner)) -> dict[str, Any]:
        state = store.read(workspace_id)
        return {"id": workspace_id, "mode": "sample", "setup": state["setup"], "readiness": readiness(state)}

    @app.post("/api/cedar/setup")
    async def set_setup(data: SetupInput, workspace_id: str = Depends(owner)) -> dict[str, Any]:
        store.mutate(workspace_id, lambda state: state.update(setup=data.model_dump()))
        return await get_setup(workspace_id)

    @app.get("/api/cedar/bank")
    async def bank_snapshot(workspace_id: str = Depends(owner), fixture_day: str | None = Depends(fixture_anchor),
                            fixture_revision: int = Query(default=2, ge=1, le=2)) -> dict[str, Any]:
        state = store.read(workspace_id)
        account = state["bank"].get("receiving_account")
        if not account:
            if sample(state, "prometeo"):
                return sample_bank.snapshot({**state, "fixture_day": fixture_day, "fixture_revision": fixture_revision})
            return {"ready": False, "mode": "sample"}
        return {
            "ready": True,
            "bank": account["bank"],
            "account_label": account["name"],
            "account_mask": "•••• " + account["number"][-4:],
            "balance_minor": account["balance_minor"],
            "currency": account["currency"],
            "as_of": account["as_of"],
            "mode": state["providers"]["prometeo"]["environment"],
            "source": "prometeo",
            "monitor": state["bank"].get("monitor", {"enabled": False, "status": "off"}),
        }

    @app.post("/api/cedar/workspace/fixture-rollover")
    async def rollover_fixture(data: FixtureRollover, workspace_id: str = Depends(owner)) -> dict[str, str]:
        if not settings.sample_bank or not 2000 <= data.to_day.year <= 2099 or data.to_day <= data.from_day:
            raise StoreError("fixture_calendar_retained")
        return store.rollover_fixture(workspace_id, data.from_day.isoformat(), data.to_day.isoformat())

    @app.post("/api/cedar/requests/{request_id}/dispatch")
    async def record_dispatch(request_id: str, data: PaymentDispatchInput, workspace_id: str = Depends(owner)) -> dict[str, Any]:
        def change(state: dict[str, Any]) -> dict[str, Any]:
            item = store.item(state, request_id)
            if data.by == "manual":
                item["merchant_action_at"] = item.get("merchant_action_at") or now_iso()
            return item
        return safe(store.mutate(workspace_id, change))

    @app.post("/api/cedar/requests", status_code=201)
    async def new_request(data: CollectionInput, workspace_id: str = Depends(owner)) -> dict[str, Any]:
        return safe(store.create_request(workspace_id, collection_snapshot(data)))

    def collection_snapshot(data: CollectionInput) -> dict[str, Any]:
        snapshot = data.model_dump(mode="json", exclude_none=True)
        if not data.fixture_owned:
            snapshot.pop("fixture_owned", None)
        if data.fixture_owned and (data.fixture_day is None or not 2000 <= data.fixture_day.year <= 2099):
            raise StoreError("fixture_day_required")
        if snapshot.get("commercial_document"):
            validate_commercial(snapshot, snapshot["commercial_document"])
            if snapshot.get("billing_draft"):
                raise StoreError("billing_draft_separate_review_required")
        if snapshot.get("billing_draft"):
            validate_binding(snapshot, snapshot["billing_draft"])
        return snapshot

    @app.post("/api/cedar/requests/batch", status_code=201)
    async def hydrate_requests(data: CollectionBatch, workspace_id: str = Depends(owner)) -> list[dict[str, Any]]:
        rows = store.create_requests(workspace_id, [collection_snapshot(row) for row in data.requests])
        state = store.read(workspace_id)
        return [{**store.safe_request(item, settings.public_origin), "fiscal": fiscal.projection(state, item)} for item in rows]

    @app.post("/api/cedar/requests/{request_id}/billing-draft")
    async def prepare_fiscal(request_id: str, data: FiscalAttachment, workspace_id: str = Depends(owner)) -> dict[str, Any]:
        draft = data.billing_draft.model_dump(mode="json")
        return safe(store.mutate(workspace_id, lambda state: attach_fiscal(state, store.item(state, request_id), draft)))

    @app.post("/api/cedar/requests/{request_id}/commercial-document")
    async def revise_order(request_id: str, data: CommercialRevision, workspace_id: str = Depends(owner)) -> dict[str, Any]:
        document = data.commercial_document.model_dump(mode="json")
        return safe(store.mutate(workspace_id, lambda state: revise_commercial(state, store.item(state, request_id), document, data.expected_fingerprint)))

    @app.get("/api/cedar/bank/movements")
    async def owner_movements(workspace_id: str = Depends(owner), fixture_day: str | None = Depends(fixture_anchor),
                             fixture_revision: int = Query(default=2, ge=1, le=2)) -> dict[str, Any]:
        state = store.read(workspace_id)
        if sample(state, "prometeo") and not state["bank"].get("receiving_account"):
            state = {**state, "fixture_day": fixture_day, "fixture_revision": fixture_revision}
            return {
                "ready": True,
                "mode": "sample",
                "as_of": sample_bank.clock(state),
                "movements": sample_bank.movements(state, fingerprint),
            }
        mode = state["providers"].get("prometeo", {}).get("environment")
        result = []
        for evidence in state["movements"].values():
            row = evidence["movement"]
            item = state["requests"].get(evidence.get("allocated_to"))
            allocated = evidence.get("allocated_minor", row["credit_minor"] if item else 0)
            result.append(
                {
                    "id": evidence["id"],
                    "source": "prometeo",
                    "mode": evidence.get("mode", mode),
                    "date": row["date"],
                    "detail": row["detail"][:500],
                    "reference": row["reference"][:120],
                    "payer_name": payer_name(row),
                    "match_key": evidence.get("match_key"),
                    "currency": row["currency"],
                    "account_mask": "•••• " + row["account_number"][-4:],
                    "debit_minor": row["debit_minor"],
                    "credit_minor": row["credit_minor"],
                    "allocated_minor": allocated,
                    "unallocated_minor": row["credit_minor"] - allocated,
                    "status": "matched" if item else "review",
                    "reason": evidence.get("reason", "review_required"),
                    "request_id": item["id"] if item else None,
                    "invoice_id": item["invoice_id"] if item else None,
                    "document_id": item["document_id"] if item else None,
                }
            )
        return {
            "ready": bool(state["bank"].get("receiving_account")),
            "mode": mode,
            "as_of": state["bank"].get("last_read"),
            "movements": sorted(result, key=lambda row: (row["date"], row["id"]), reverse=True),
        }

    @app.get("/api/cedar/request-updates")
    async def request_updates(cursor: str = "", workspace_id: str = Depends(owner)) -> dict[str, Any]:
        if cursor and not re.fullmatch(r"[a-f0-9]{64}", cursor):
            raise HTTPException(422, detail="collection_cursor_required")
        state = store.read(workspace_id)
        rows = []
        for item in sorted(state["requests"].values(), key=lambda row: row["id"]):
            row = store.safe_request(item, settings.public_origin)
            row["fiscal"] = fiscal.projection(state, item)
            rows.append(row)
        current = fingerprint({"workspace": workspace_id, "requests": rows})
        changed = current != cursor
        return {"cursor": current, "changed": changed, "requests": rows if changed else []}

    @app.get("/api/cedar/requests")
    async def requests(workspace_id: str = Depends(owner)) -> list[dict[str, Any]]:
        return [safe(item) for item in store.read(workspace_id)["requests"].values()]

    @app.get("/api/cedar/requests/{request_id}")
    async def get_request(request_id: str, workspace_id: str = Depends(owner)) -> dict[str, Any]:
        return safe(store.quoted_request(workspace_id, request_id))

    @app.post("/api/cedar/requests/{request_id}/receipts")
    async def receipt(
        request_id: str, data: ReceiptInput, workspace_id: str = Depends(owner)
    ) -> dict[str, Any]:
        return safe(store.receipt(workspace_id, request_id, data.model_dump(mode="json", exclude_none=True)))

    def approval_open(state: dict[str, Any], item: dict[str, Any]) -> bool:
        """WHO COMPLETES THIS PAYMENT (FEED-IA §252). The seeded workspace accepts the approval
        code itself and records the receipt; a workspace with a commissioned account or a bound
        live destination leaves the payment to the buyer's own Yape app, and the page says so."""
        return sample(state, "prometeo") and not item.get("destination") and not item.get("commissioned_at")

    def buyer_view(item: dict[str, Any], state: dict[str, Any]) -> dict[str, Any]:
        result = store.safe_request(item, settings.public_origin, public=True)
        result["approval_code"] = approval_open(state, item)
        return result

    approvals: dict[str, tuple[int, float]] = {}

    def approval_allowed(request_id: str) -> bool:
        """One request id accepts eight approval attempts a minute; the page needs two."""
        stamp = time.time()
        if len(approvals) >= 2000:
            for key in [key for key, (_, since) in approvals.items() if stamp - since > 60]:
                del approvals[key]
        count, since = approvals.get(request_id, (0, stamp))
        count, since = (0, stamp) if stamp - since > 60 else (count, since)
        approvals[request_id] = count + 1, since
        return count < 8

    @app.get("/collect/{request_id}/{token}")
    async def buyer(request_id: str, token: str) -> HTMLResponse:
        store.public_request(request_id, token)
        return HTMLResponse((WEB / "cedar-buyer.html").read_text())

    @app.get("/collect/{request_id}/{token}/status")
    async def buyer_status(request_id: str, token: str) -> dict[str, Any]:
        item = store.public_request(request_id, token)
        item = store.quoted_request(item["workspace_id"], request_id)
        return buyer_view(item, store.read(item["workspace_id"]))

    @app.post("/collect/{request_id}/{token}/approve")
    async def buyer_approve(request_id: str, token: str, data: ApprovalInput) -> dict[str, Any]:
        """THE ONE PUBLIC WRITE (FEED-IA §252). Every other buyer route reads; this one records the
        payment the checkout's own act just made, under the buyer's capability, in sample mode."""
        item = store.public_request(request_id, token)
        if not approval_open(store.read(item["workspace_id"]), item):
            raise HTTPException(409, detail="wallet_app_completes_payment")
        if not approval_allowed(request_id):
            raise HTTPException(429, detail="retry_later")
        updated = store.approve_payment(item["workspace_id"], request_id, data.phone, data.code, data.quote_id)
        return buyer_view(updated, store.read(item["workspace_id"]))

    @app.get("/collect/{request_id}/{token}/qr")
    async def buyer_qr(request_id: str, token: str) -> Response:
        item = store.public_request(request_id, token)
        destination = item.get("destination")
        if not destination:
            raise HTTPException(404)
        return Response(base64.b64decode(destination["qr_base64"]), media_type="image/png")

    @app.post("/api/operator/workspaces/{workspace_id}/destination", dependencies=[Depends(operator)])
    async def configure_destination(workspace_id: str, data: DestinationInput) -> dict[str, Any]:
        cfg = connection(workspace_id, "prometeo")
        if cfg["environment"] != "live":
            raise StoreError("live_account_required")
        clean = raster_qr(data.qr_base64)

        def bind(state: dict[str, Any]) -> dict[str, Any]:
            account = state["bank"].get("receiving_account", {})
            if account.get("number") != data.account_number or account.get("currency") != data.currency:
                raise StoreError("bank_account_mismatch")
            destination = {
                "method": data.method,
                "phone": data.phone,
                "qr_base64": clean,
                "account_number": data.account_number,
                "currency": data.currency,
                "account_mask": "•••• " + data.account_number[-4:],
                "mode": "live",
                "bank": account["bank"],
            }
            prior = state.get("destination")
            if prior and prior != destination:
                raise StoreError("destination_already_bound")
            state["destination"] = destination
            for request_id in data.request_ids:
                item = store.item(state, request_id)
                if (
                    item.get("receiving_account_number") != data.account_number
                    or item["currency"] != data.currency
                    or (item["receipts"] and not item.get("destination"))
                ):
                    raise StoreError("real_document_review_required")
                item.setdefault("destination", destination)
                item.setdefault("commissioned_at", now_iso())
            return {key: destination[key] for key in ("method", "phone", "account_mask", "mode")}

        return store.mutate(workspace_id, bind)

    @app.get("/api/config", dependencies=[Depends(operator)])
    async def config() -> dict[str, Any]:
        return {
            "experience": "cedar-collections",
            "environment": "development/demo",
            "providers": ["prometeo", "nubefact"],
            "payment_methods": ["yape", "plin", "bank-transfer"],
            "live_enabled": settings.allow_live,
            "sample_bank": settings.sample_bank,
            "origin": settings.public_origin,
            "workspace_mode": "sample",
            "evidence": "Persistent collection ledger; provider accounts require commissioning",
        }

    @app.get("/api/operator/workspaces", dependencies=[Depends(operator)])
    async def workspaces() -> list[dict[str, Any]]:
        return [{**row, "readiness": readiness(store.read(row["id"]))} for row in store.workspaces()]

    @app.post("/api/operator/workspaces/{workspace_id}/providers", dependencies=[Depends(operator)])
    async def configure(workspace_id: str, data: ProviderInput) -> dict[str, Any]:
        if data.environment == "live" and not settings.allow_live:
            raise StoreError("live_activation_required")
        if data.provider == "prometeo":
            if set(data.credentials) != {"api_key"}:
                raise StoreError("provider_credentials_invalid")
            PrometeoClient(data.credentials["api_key"], data.environment, client)
        else:
            if (
                set(data.credentials) != {"api_url", "token", "seller_ruc"}
                or len(data.credentials["seller_ruc"]) != 11
                or not data.credentials["seller_ruc"].isdigit()
            ):
                raise StoreError("provider_credentials_invalid")
            NubeFactClient(data.credentials["api_url"], data.credentials["token"], client)

        def change(state: dict[str, Any]) -> None:
            if data.provider in state["providers"] and state["providers"][data.provider] != data.model_dump():
                raise StoreError("provider_already_bound")
            state["providers"][data.provider] = data.model_dump()

        store.mutate(workspace_id, change)
        return readiness(store.read(workspace_id))

    @app.post("/api/operator/workspaces/{workspace_id}/bank/login", dependencies=[Depends(bank_guard)])
    async def login(workspace_id: str, data: BankLogin) -> dict[str, Any]:
        adapter = prometeo(workspace_id)
        existing = store.read(workspace_id)["bank"]
        if existing.get("provider") and existing["provider"] != data.provider:
            raise StoreError("bank_binding_conflict")
        result = await adapter.login(
            data.provider,
            data.username,
            data.password,
            data.extra,
            session_key=existing.get("key") if data.resume else None,
        )
        store.mutate(
            workspace_id, lambda state: state.update(bank={**existing, **result, "provider": data.provider})
        )
        return {k: v for k, v in result.items() if k != "key"}

    @app.get("/api/operator/workspaces/{workspace_id}/bank/accounts", dependencies=[Depends(bank_guard)])
    async def bank_accounts(workspace_id: str) -> list[dict[str, Any]]:
        bank = bank_state(workspace_id)
        result = await prometeo(workspace_id).accounts(bank["key"])
        store.mutate(workspace_id, lambda state: state["bank"].update(accounts=result))
        return result

    @app.get("/api/operator/workspaces/{workspace_id}/bank/clients", dependencies=[Depends(bank_guard)])
    async def bank_clients(workspace_id: str) -> list[dict[str, Any]]:
        bank = store.read(workspace_id)["bank"]
        if bank.get("status") != "select_client":
            raise StoreError("bank_client_selection_required")
        return await prometeo(workspace_id).clients(bank["key"])

    @app.post("/api/operator/workspaces/{workspace_id}/bank/client", dependencies=[Depends(bank_guard)])
    async def bank_client(workspace_id: str, data: BankClient) -> dict[str, str]:
        bank = store.read(workspace_id)["bank"]
        if bank.get("status") != "select_client":
            raise StoreError("bank_client_selection_required")
        adapter = prometeo(workspace_id)
        available = await adapter.clients(bank["key"])
        if not any(item["id"] == data.client_id for item in available):
            raise StoreError("bank_client_mismatch")
        await adapter.select_client(bank["key"], data.client_id)
        accounts = await adapter.accounts(bank["key"])
        store.mutate(
            workspace_id,
            lambda state: state["bank"].update(
                status="logged_in", client_id=data.client_id, accounts=accounts
            ),
        )
        return {"status": "logged_in"}

    @app.post("/api/operator/workspaces/{workspace_id}/bank/logout", dependencies=[Depends(bank_guard)])
    async def bank_logout(workspace_id: str) -> dict[str, str]:
        bank = store.read(workspace_id)["bank"]
        if bank.get("key"):
            await prometeo(workspace_id).logout(bank["key"])

        def clear(state: dict[str, Any]) -> None:
            state["bank"].pop("key", None)
            state["bank"]["status"] = "logged_out"
            state["bank"]["monitor"] = {"enabled": False, "status": "off"}

        store.mutate(workspace_id, clear)
        return {"status": "logged_out"}

    @app.post(
        "/api/operator/workspaces/{workspace_id}/bank/select-account", dependencies=[Depends(bank_guard)]
    )
    async def select_account(workspace_id: str, data: BankAccount) -> dict[str, Any]:
        bank = bank_state(workspace_id)
        accounts = await prometeo(workspace_id).accounts(bank["key"])
        matches = [
            row
            for row in accounts
            if row["number"] == data.account_number and row["currency"] == data.currency
        ]
        if len(matches) != 1:
            raise StoreError("bank_account_mismatch")
        name = (
            "scotiabank"
            if bank["provider"].startswith(("scotia", "telebanking"))
            else bank["provider"].split("_")[0]
        )
        selected = {**matches[0], "bank": name, "as_of": now_iso()}

        def bind(state: dict[str, Any]) -> None:
            state["bank"]["receiving_account"] = selected
            for item in state["requests"].values():
                if item["receiving_bank"] == name and item["currency"] == data.currency:
                    item.setdefault("receiving_account_number", data.account_number)

        store.mutate(workspace_id, bind)
        return await bank_snapshot(workspace_id)

    @app.post("/api/operator/workspaces/{workspace_id}/bank/movements", dependencies=[Depends(bank_guard)])
    async def movements(workspace_id: str, data: BankRead) -> list[dict[str, Any]]:
        bank = bank_state(workspace_id)
        if data.date_end < data.date_start or (data.date_end - data.date_start).days > 31:
            raise StoreError("bank_date_range_invalid")
        accounts = await prometeo(workspace_id).accounts(bank["key"])
        if not any(
            row["number"] == data.account_number and row["currency"] == data.currency for row in accounts
        ):
            raise StoreError("bank_account_mismatch")
        rows = await prometeo(workspace_id).movements(
            bank["key"], data.account_number, data.currency, data.date_start, data.date_end
        )

        def change(state: dict[str, Any]) -> list[dict[str, Any]]:
            result = []
            for row in rows:
                identity = fingerprint(
                    [workspace_id, bank["provider"], data.account_number, data.currency, row["id"]]
                )
                prior = state["movements"].get(identity)
                if prior and prior["movement"] != row:
                    raise StoreError("bank_movement_changed")
                saved = prior or {
                    "id": identity,
                    "provider": bank["provider"],
                    "mode": state["providers"]["prometeo"]["environment"],
                    "movement": row,
                    "received_at": now_iso(),
                    "allocated_to": None,
                }
                state["movements"][identity] = saved
                apply_movement(state, saved)
                result.append(saved)
            if len(state["movements"]) > 2000:
                raise StoreError("movement_capacity")
            state["bank"]["last_read"] = now_iso()
            selected = state["bank"].get("receiving_account")
            if selected:
                fresh = next(
                    (
                        account
                        for account in accounts
                        if account["number"] == selected["number"]
                        and account["currency"] == selected["currency"]
                    ),
                    None,
                )
                if fresh:
                    selected.update(balance_minor=fresh["balance_minor"], as_of=now_iso())
            return result

        result = store.mutate(workspace_id, change)
        await fiscal.after_payments(workspace_id)
        return result

    @app.post("/api/operator/workspaces/{workspace_id}/bank/match", dependencies=[Depends(bank_guard)])
    async def match(workspace_id: str, data: BankMatch) -> dict[str, Any]:
        def change(state: dict[str, Any]) -> dict[str, Any]:
            item = store.item(state, data.request_id)
            evidence = state["movements"].get(data.movement_id)
            if not evidence:
                raise StoreError("bank_movement_missing")
            if evidence["allocated_to"] and evidence["allocated_to"] != item["id"]:
                raise StoreError("bank_movement_already_allocated")
            row = evidence["movement"]
            if item.get("receiving_account_number") != row["account_number"]:
                raise StoreError("bank_reference_review_required")
            matched = apply_movement(state, evidence)
            if not matched or matched["id"] != item["id"]:
                raise StoreError("bank_reference_review_required")
            return matched

        item = store.mutate(workspace_id, change)
        await fiscal.after_payments(workspace_id)
        return safe(item)

    @app.post("/api/cedar/bank/match")
    async def owner_match(data: BankMatch, workspace_id: str = Depends(owner)) -> dict[str, Any]:
        store.item(store.read(workspace_id), data.request_id)
        if connection(workspace_id, "prometeo")["environment"] != "live":
            raise StoreError("live_account_required")
        async with bank_lock(workspace_id):
            return await match(workspace_id, data)

    @app.post("/api/operator/workspaces/{workspace_id}/invoices/commission", dependencies=[Depends(operator)])
    async def commission_invoices(workspace_id: str, data: FiscalCommission) -> dict[str, Any]:
        return fiscal.commission(workspace_id, data.model_dump())

    @app.post(
        "/api/operator/workspaces/{workspace_id}/requests/{request_id}/invoice/authorize",
        dependencies=[Depends(operator)],
    )
    async def authorize_invoice(
        workspace_id: str, request_id: str, data: FiscalAuthorization
    ) -> dict[str, Any]:
        item = fiscal.authorize(workspace_id, request_id, data.model_dump())
        await fiscal.after_payments(workspace_id)
        return safe(item)

    @app.post("/api/cedar/requests/{request_id}/invoice")
    async def owner_issue(request_id: str, _: Input, workspace_id: str = Depends(owner)) -> dict[str, Any]:
        return safe(await fiscal.issue(workspace_id, request_id))

    @app.post("/api/cedar/requests/{request_id}/invoice/query")
    async def owner_query(request_id: str, _: Input, workspace_id: str = Depends(owner)) -> dict[str, Any]:
        return safe(await fiscal.query(workspace_id, request_id))

    @app.post("/api/operator/workspaces/{workspace_id}/invoices", dependencies=[Depends(operator)])
    async def issue(workspace_id: str, data: DocumentInput) -> dict[str, Any]:
        cfg = connection(workspace_id, "nubefact")
        item = store.item(store.read(workspace_id), data.request_id)
        if cfg["environment"] == "live" or item.get("billing_draft"):
            record = fiscal.record(store.read(workspace_id), data.request_id)
            if record["fingerprint"] != fingerprint(data.payload):
                raise StoreError("invoice_identity_conflict")
            await fiscal.issue(workspace_id, data.request_id)
            record = store.read(workspace_id)["documents"][record["id"]]
            return {k: v for k, v in record.items() if k not in {"payload", "fingerprint"}}
        if item.get("seller_ruc") != cfg["credentials"]["seller_ruc"]:
            raise StoreError("invoice_seller_mismatch")
        series, separator, number = item["reference"].partition("-")
        if (
            not separator
            or not number.isdigit()
            or series != data.payload.get("serie")
            or int(number) != data.payload.get("numero")
        ):
            raise StoreError("invoice_document_mismatch")
        try:
            total = Decimal(str(data.payload.get("total"))) * 100
        except (InvalidOperation, ValueError):
            raise StoreError("invoice_amount_invalid") from None
        if not total.is_finite() or total != item["invoice_amount_minor"] or data.payload.get("moneda") != 1:
            raise StoreError("invoice_amount_mismatch")
        identity = [data.payload.get(k) for k in ("tipo_de_comprobante", "serie", "numero")]
        record_id = fingerprint(identity)
        digest = fingerprint(data.payload)

        def reserve(state: dict[str, Any]) -> bool:
            previous = state["documents"].get(record_id)
            if previous:
                if previous["fingerprint"] != digest or previous["request_id"] != data.request_id:
                    raise StoreError("invoice_identity_conflict")
                return False
            state["documents"][record_id] = {
                "id": record_id,
                "request_id": data.request_id,
                "fingerprint": digest,
                "payload": data.payload,
                "seller_ruc": cfg["credentials"]["seller_ruc"],
                "phase": "submitting",
                "created_at": now_iso(),
            }
            return True

        fresh = store.mutate(workspace_id, reserve)
        if fresh:
            adapter = NubeFactClient(cfg["credentials"]["api_url"], cfg["credentials"]["token"], client)
            try:
                result = await adapter.submit(data.payload)
                outcome = {"phase": result["acceptance"], "evidence": result, "checked_at": now_iso()}
            except ProviderError as exc:
                outcome = {"phase": "query-required", "error": exc.code}
            store.mutate(workspace_id, lambda state: state["documents"][record_id].update(outcome))
        record = store.read(workspace_id)["documents"][record_id]
        return {k: v for k, v in record.items() if k not in {"payload", "fingerprint"}}

    @app.post(
        "/api/operator/workspaces/{workspace_id}/invoices/{record_id}/query", dependencies=[Depends(operator)]
    )
    async def query(workspace_id: str, record_id: str) -> dict[str, Any]:
        cfg = connection(workspace_id, "nubefact")
        record = store.read(workspace_id)["documents"].get(record_id)
        if not record:
            raise StoreError("invoice_missing")
        if record.get("owner_authorized"):
            await fiscal.query(workspace_id, record["request_id"])
            record = store.read(workspace_id)["documents"][record_id]
            return {k: v for k, v in record.items() if k not in {"payload", "fingerprint"}}
        payload = record["payload"]
        result = await NubeFactClient(
            cfg["credentials"]["api_url"], cfg["credentials"]["token"], client
        ).query(payload["tipo_de_comprobante"], payload["serie"], payload["numero"])
        store.mutate(
            workspace_id,
            lambda state: state["documents"][record_id].update(
                phase=result["acceptance"], evidence=result, checked_at=now_iso()
            ),
        )
        return {
            k: v
            for k, v in store.read(workspace_id)["documents"][record_id].items()
            if k not in {"payload", "fingerprint"}
        }

    @app.post("/api/operator/workspaces/{workspace_id}/bank/monitor", dependencies=[Depends(bank_guard)])
    async def configure_monitor(workspace_id: str, data: BankMonitor) -> dict[str, Any]:
        if data.enabled:
            cfg = connection(workspace_id, "prometeo")
            if cfg["environment"] != "live":
                raise StoreError("live_account_required")
            bank = bank_state(workspace_id)
            if not bank.get("receiving_account"):
                raise StoreError("bank_account_selection_required")
        monitor = {
            **store.read(workspace_id)["bank"].get("monitor", {}),
            "enabled": data.enabled,
            "interval_seconds": data.interval_seconds,
            "status": "scheduled" if data.enabled else "off",
            "next_due": clock() if data.enabled else None,
            "failures": 0,
            "last_error": "",
        }
        store.mutate(workspace_id, lambda state: state["bank"].update(monitor=monitor))
        return monitor

    monitor_slots = asyncio.Semaphore(3)

    async def run_bank_monitor(workspace_id: str) -> None:
        async with monitor_slots:
            lock = bank_lock(workspace_id)
            if lock.locked():
                return
            async with lock:
                stamp = clock()
                observed = datetime.fromtimestamp(stamp, timezone.utc).isoformat()

                def claim(state: dict[str, Any]) -> bool:
                    monitor = state["bank"].get("monitor", {})
                    if not monitor.get("enabled") or monitor.get("next_due", stamp + 1) > stamp:
                        return False
                    # Durable lease also protects another process opening the same database.
                    monitor.update(status="running", last_attempt=observed, next_due=stamp + 90)
                    return True

                if not store.mutate(workspace_id, claim):
                    return
                bank = store.read(workspace_id)["bank"]
                monitor = bank["monitor"]
                try:
                    cfg = connection(workspace_id, "prometeo")
                    if cfg["environment"] != "live":
                        raise StoreError("live_account_required")
                    account = bank_state(workspace_id).get("receiving_account")
                    if not account:
                        raise StoreError("bank_account_selection_required")
                    today = datetime.fromtimestamp(stamp, timezone.utc).date()
                    await asyncio.wait_for(
                        movements(
                            workspace_id,
                            BankRead(
                                account_number=account["number"],
                                currency=account["currency"],
                                date_start=today - timedelta(days=6),
                                date_end=today,
                            ),
                        ),
                        timeout=50,
                    )
                    outcome = {
                        "status": "scheduled",
                        "last_success": observed,
                        "last_error": "",
                        "failures": 0,
                        "next_due": clock() + monitor["interval_seconds"],
                    }
                except Exception as exc:
                    error = (
                        exc.code
                        if isinstance(exc, ProviderError)
                        else str(exc)
                        if isinstance(exc, StoreError)
                        else "bank_refresh_failed"
                    )
                    failures = monitor.get("failures", 0) + 1
                    pause = error in {
                        "prometeo_session_expired",
                        "prometeo_wrong_credentials",
                        "prometeo_access_rejected",
                        "bank_authorization_required",
                        "bank_account_selection_required",
                        "live_activation_required",
                        "live_account_required",
                        "provider_configuration_required",
                    }
                    delay = min(3600, monitor["interval_seconds"] * 2 ** min(failures, 4))
                    outcome = {
                        "enabled": not pause,
                        "status": "reauthorization-required" if pause else "retrying",
                        "last_error": error,
                        "failures": failures,
                        "next_due": None if pause else clock() + delay,
                    }
                store.mutate(workspace_id, lambda state: state["bank"]["monitor"].update(outcome))

    async def run_bank_monitors() -> None:
        await asyncio.gather(*(run_bank_monitor(wid) for wid in store.due_monitors(clock())))

    async def monitor_loop() -> None:
        while True:
            # A temporary local store failure is retried; provider exceptions are recorded above.
            with suppress(Exception):
                await run_bank_monitors()
            with suppress(Exception):
                await fiscal.run_pending()
            await asyncio.sleep(5)

    app.state.run_bank_monitors = run_bank_monitors
    app.state.run_fiscal_pending = fiscal.run_pending
    return app
