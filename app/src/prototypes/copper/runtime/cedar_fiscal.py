"""Reviewed billing snapshots, seller-owned numbering and single-attempt fiscal issuance."""

from __future__ import annotations

import asyncio
import time
from datetime import date, datetime
from decimal import ROUND_FLOOR, ROUND_HALF_UP, Decimal
from typing import Any, Literal
from zoneinfo import ZoneInfo

import httpx
from pydantic import BaseModel, ConfigDict, Field, StrictInt, field_validator, model_validator

from .cedar_store import CedarStore, fingerprint, now_iso
from .contracts import ProviderError
from .providers.nubefact import NubeFactClient
from .store import StoreError


class DraftLine(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    id: str = Field(min_length=1, max_length=120)
    description: str = Field(min_length=1, max_length=250)
    quantity: str = Field(pattern=r"^\d{1,9}(?:\.\d{1,10})?$", max_length=20)
    unit: str = Field(min_length=1, max_length=30)
    total_minor: StrictInt = Field(ge=0, le=1_000_000_000_000)


class BillingDraft(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    version: Literal[1, 2]
    origin: Literal["cedar-draft"]
    customer_id: str = Field(min_length=1, max_length=120)
    customer_name: str = Field(min_length=1, max_length=100)
    customer_ruc: str = Field(pattern=r"^\d{11}$")
    customer_address: str = Field(default="", max_length=100)
    seller_name: str = Field(min_length=1, max_length=160)
    seller_ruc: str = Field(pattern=r"^\d{11}$")
    series: str = Field(pattern=r"^F[A-Z0-9]{3}$")
    issued_date: date
    due_date: date
    currency: Literal["PEN"]
    source_currency: Literal["EUR", "PEN"]
    source_total_minor: StrictInt = Field(gt=0, le=1_000_000_000_000)
    fx_rate: str = Field(pattern=r"^\d{1,3}(?:\.\d{1,10})?$", max_length=14)
    tax_rate: Literal[0, 18]
    net_minor: StrictInt = Field(gt=0, le=1_000_000_000_000)
    tax_minor: StrictInt = Field(ge=0, le=1_000_000_000_000)
    total_minor: StrictInt = Field(gt=0, le=1_000_000_000_000)
    lines: list[DraftLine] = Field(min_length=1, max_length=100)

    @field_validator("version", "tax_rate", mode="before")
    @classmethod
    def integer_choices(cls, value: Any) -> Any:
        if type(value) is not int:
            raise ValueError("billing_draft_integer_required")
        return value

    @model_validator(mode="after")
    def conserved(self) -> BillingDraft:
        rate = Decimal(self.fx_rate)
        converted = (self.source_total_minor * rate).quantize(Decimal(1), rounding=ROUND_HALF_UP)
        net = (Decimal(self.total_minor) / (1 + Decimal(self.tax_rate) / 100)).quantize(
            Decimal(1), rounding=ROUND_HALF_UP
        )
        if (
            not 0 < rate <= 100
            or converted != self.total_minor
            or (self.source_currency == "PEN" and rate != 1)
            or (self.version == 2 and self.source_currency != "PEN")
            or self.net_minor != net
            or self.net_minor + self.tax_minor != self.total_minor
            or sum(row.total_minor for row in self.lines) != self.total_minor
            or len({row.id for row in self.lines}) != len(self.lines)
            or any(Decimal(row.quantity) <= 0 for row in self.lines)
            or self.due_date < self.issued_date
        ):
            raise ValueError("billing_draft_totals_invalid")
        if any(Decimal(row.total_minor) / 100 / Decimal(row.quantity) >= 10**12 for row in self.lines):
            raise ValueError("billing_draft_unit_price_invalid")
        return self


def validate_binding(item: dict[str, Any], draft: dict[str, Any]) -> None:
    if (
        any(item[key] != draft[key] for key in ("seller_name", "seller_ruc", "customer_name", "currency"))
        or item["invoice_amount_minor"] != draft["total_minor"]
    ):
        raise StoreError("billing_draft_binding_mismatch")


def payload_for(
    draft: dict[str, Any], number: int, unit_codes: dict[str, str], zero_tax_category: str | None
) -> dict[str, Any]:
    """The official manual's 18% onerous sale; explicit exempt/unaffected classification at 0%."""
    if not draft["customer_address"]:
        raise StoreError("invoice_customer_address_required")
    if draft["tax_rate"] == 0 and zero_tax_category not in {"exempt", "unaffected"}:
        raise StoreError("invoice_tax_classification_required")
    if any(line["unit"] not in unit_codes for line in draft["lines"]):
        raise StoreError("invoice_unit_mapping_required")
    divisor = 1 + Decimal(draft["tax_rate"]) / 100
    exact = [Decimal(line["total_minor"]) / divisor for line in draft["lines"]]
    net = [int(value.to_integral_value(rounding=ROUND_FLOOR)) for value in exact]
    remaining = draft["net_minor"] - sum(net)
    ranked = sorted(range(len(net)), key=lambda index: (-(exact[index] - net[index]), index))
    for index in ranked[:remaining]:
        net[index] += 1
    if sum(net) != draft["net_minor"]:
        raise StoreError("invoice_tax_rounding_invalid")
    items = []
    for line, subtotal in zip(draft["lines"], net, strict=True):
        quantity = Decimal(line["quantity"])
        items.append(
            {
                "unidad_de_medida": unit_codes[line["unit"]],
                "codigo": line["id"],
                "descripcion": line["description"],
                "cantidad": line["quantity"],
                "valor_unitario": str(
                    (Decimal(subtotal) / 100 / quantity).quantize(
                        Decimal("0.0000000001"), rounding=ROUND_HALF_UP
                    )
                ),
                "precio_unitario": str(
                    (Decimal(line["total_minor"]) / 100 / quantity).quantize(
                        Decimal("0.0000000001"), rounding=ROUND_HALF_UP
                    )
                ),
                "subtotal": str(Decimal(subtotal) / 100),
                "igv": str(Decimal(line["total_minor"] - subtotal) / 100),
                "total": str(Decimal(line["total_minor"]) / 100),
                "tipo_de_igv": 1 if draft["tax_rate"] == 18 else 8 if zero_tax_category == "exempt" else 9,
            }
        )
    base = (
        "total_gravada"
        if draft["tax_rate"] == 18
        else "total_exonerada"
        if zero_tax_category == "exempt"
        else "total_inafecta"
    )
    return {
        "tipo_de_comprobante": 1,
        "serie": draft["series"],
        "numero": number,
        "cliente_tipo_de_documento": "6",
        "cliente_numero_de_documento": draft["customer_ruc"],
        "cliente_denominacion": draft["customer_name"],
        "cliente_direccion": draft["customer_address"],
        "moneda": 1,
        "porcentaje_de_igv": draft["tax_rate"],
        base: str(Decimal(draft["net_minor"]) / 100),
        "total_igv": str(Decimal(draft["tax_minor"]) / 100),
        "total": str(Decimal(draft["total_minor"]) / 100),
        "enviar_automaticamente_a_la_sunat": True,
        "enviar_automaticamente_al_cliente": False,
        "items": items,
    }


class FiscalEngine:
    def __init__(self, store: CedarStore, client: httpx.AsyncClient, allow_live: bool):
        self.store, self.client, self.allow_live = store, client, allow_live
        self.locks: dict[str, asyncio.Lock] = {}
        self.concurrency = asyncio.Semaphore(3)

    def config(self, state: dict[str, Any]) -> dict[str, Any]:
        cfg = state["providers"].get("nubefact")
        if not cfg:
            raise StoreError("provider_configuration_required")
        if cfg["environment"] == "live" and not self.allow_live:
            raise StoreError("live_activation_required")
        return cfg

    @staticmethod
    def route_binding(cfg: dict[str, Any]) -> str:
        return fingerprint(
            [cfg["credentials"]["api_url"], cfg["credentials"]["seller_ruc"], cfg["environment"]]
        )

    def projection(self, state: dict[str, Any], item: dict[str, Any]) -> dict[str, Any]:
        record = next((r for r in state["documents"].values() if r["request_id"] == item["id"]), None)
        draft = item.get("billing_draft")
        cfg = state["providers"].get("nubefact", {})
        result = {
            "phase": "awaiting-authorization" if draft else "unprepared",
            "mode": cfg.get("environment"),
            "payment_requirement": "confirmed",
            "can_issue": False,
            "can_query": False,
        }
        if draft:
            result["draft_fingerprint"] = fingerprint(draft)
        if record:
            result.update(
                {
                    key: record[key]
                    for key in ("phase", "authorized_at", "checked_at", "error")
                    if key in record
                }
            )
            payload = record["payload"]
            result.update(
                record_id=record["id"],
                series=payload["serie"],
                number=payload["numero"],
                mode=record.get("mode", cfg.get("environment")),
            )
            authorized = record.get("owner_authorized", False) and (
                result["mode"] != "live" or self.allow_live
            )
            result["can_query"] = (
                authorized
                and not record.get("identity_conflict")
                and record["phase"] in {"submitting", "query-required", "pending", "accepted", "voided"}
            )
            result["can_issue"] = (
                authorized
                and record["phase"] == "authorized"
                and self.store.totals(item)["confirmed_minor"] == item["invoice_amount_minor"]
            )
            evidence = record.get("evidence", {})
            result["accepted_by_sunat"] = evidence.get("aceptada_por_sunat") is True
            result["voided"] = evidence.get("anulado") is True
            result["issue_date"] = record.get("issue_date")
            if record.get("issue_date_policy"):
                result["issue_date_policy"] = record["issue_date_policy"]
        return result

    def commission(self, workspace_id: str, data: dict[str, Any]) -> dict[str, Any]:
        def change(state: dict[str, Any]) -> dict[str, Any]:
            cfg = self.config(state)
            if data["seller_ruc"] != cfg["credentials"]["seller_ruc"]:
                raise StoreError("invoice_seller_mismatch")
            desired = {
                "seller_ruc": data["seller_ruc"],
                "mode": cfg["environment"],
                "route_binding": self.route_binding(cfg),
                "first_number": data["next_number"],
                "unit_codes": data["unit_codes"],
            }
            prior = state.setdefault("fiscal_series", {}).get(data["series"])
            if prior and any(prior[key] != value for key, value in desired.items()):
                raise StoreError("invoice_series_already_bound")
            state["fiscal_series"][data["series"]] = prior or {**desired, "next_number": data["next_number"]}
            return {"series": data["series"], "mode": cfg["environment"], "commissioned": True}

        return self.store.mutate(workspace_id, change)

    def authorize(self, workspace_id: str, request_id: str, data: dict[str, Any]) -> dict[str, Any]:
        def change(state: dict[str, Any]) -> dict[str, Any]:
            cfg = self.config(state)
            item = self.store.item(state, request_id)
            draft = item.get("billing_draft")
            if not draft or fingerprint(draft) != data["draft_fingerprint"]:
                raise StoreError("invoice_draft_review_required")
            validate_binding(item, draft)
            if draft["seller_ruc"] != cfg["credentials"]["seller_ruc"]:
                raise StoreError("invoice_seller_mismatch")
            series = state.get("fiscal_series", {}).get(draft["series"])
            if not series or series["route_binding"] != self.route_binding(cfg):
                raise StoreError("invoice_series_commissioning_required")
            if cfg["environment"] == "live":
                if any(row["source"] != "prometeo" for row in item["receipts"]):
                    raise StoreError("invoice_confirmed_payment_required")
                account = state["bank"].get("receiving_account", {})
                if (
                    state["providers"].get("prometeo", {}).get("environment") != "live"
                    or not account.get("number")
                    or account["number"] != item.get("receiving_account_number")
                    or account["currency"] != item["currency"]
                ):
                    raise StoreError("bank_account_selection_required")
            previous = next((r for r in state["documents"].values() if r["request_id"] == request_id), None)
            approval = fingerprint(data)
            if previous:
                if previous.get("approval_fingerprint") != approval:
                    raise StoreError("invoice_authorization_conflict")
                return item
            number = series["next_number"]
            if number > 99999999:
                raise StoreError("invoice_number_capacity")
            payload = payload_for(draft, number, series["unit_codes"], data.get("zero_tax_category"))
            identity = fingerprint([1, draft["series"], number])
            if identity in state["documents"]:
                raise StoreError("invoice_identity_conflict")
            stamp = now_iso()
            state["documents"][identity] = {
                "id": identity,
                "request_id": request_id,
                "fingerprint": fingerprint(payload),
                "payload": payload,
                "seller_ruc": draft["seller_ruc"],
                "mode": cfg["environment"],
                "route_binding": self.route_binding(cfg),
                "draft_fingerprint": fingerprint(draft),
                "approval_fingerprint": approval,
                "owner_authorized": True,
                "auto_issue_after_payment": data["auto_issue_after_payment"],
                "phase": "authorized",
                "issue_date_policy": data["issue_date_policy"],
                "authorized_at": stamp,
                "created_at": stamp,
            }
            series["next_number"] += 1
            if cfg["environment"] == "live":
                item.setdefault("commissioned_at", stamp)
            return item

        return self.store.mutate(workspace_id, change)

    def record(self, state: dict[str, Any], request_id: str) -> dict[str, Any]:
        self.store.item(state, request_id)
        record = next((r for r in state["documents"].values() if r["request_id"] == request_id), None)
        cfg = self.config(state)
        if (
            not record
            or not record.get("owner_authorized")
            or record.get("route_binding") != self.route_binding(cfg)
        ):
            raise StoreError("invoice_authorization_required")
        return record

    @staticmethod
    def outcome(result: dict[str, Any]) -> dict[str, Any]:
        phase = "voided" if result.get("anulado") is True else result["acceptance"]
        outcome = {"phase": phase, "evidence": result, "checked_at": now_iso()}
        if phase == "pending" and result.get("sunat_responsecode") not in (None, "", "0", 0):
            outcome.update(phase="query-required", error="nubefact_sunat_review_required")
        return outcome

    @staticmethod
    def apply_outcome(record: dict[str, Any], outcome: dict[str, Any]) -> None:
        if (record["phase"] == "accepted" and outcome["phase"] not in {"accepted", "voided"}) or (
            record["phase"] == "voided" and outcome["phase"] != "voided"
        ):
            raise StoreError("invoice_provider_state_review_required")
        record.pop("error", None)
        record.update(outcome)

    async def issue(self, workspace_id: str, request_id: str) -> dict[str, Any]:
        async with self.locks.setdefault(workspace_id, asyncio.Lock()):

            def claim(state: dict[str, Any]) -> dict[str, Any] | None:
                record = self.record(state, request_id)
                if record["phase"] != "authorized":
                    return None
                item = self.store.item(state, request_id)
                if self.store.totals(item)["confirmed_minor"] != item["invoice_amount_minor"]:
                    raise StoreError("invoice_confirmed_payment_required")
                # The reviewed date policy uses the first submission's Peru date. The entire
                # payload, number and date are durable before HTTP; recovery only queries them.
                issue_date = datetime.now(ZoneInfo("America/Lima")).date()
                record["payload"]["fecha_de_emision"] = issue_date.strftime("%d-%m-%Y")
                record.update(issue_date=issue_date.isoformat(), fingerprint=fingerprint(record["payload"]))
                record.update(phase="submitting", submitted_at=now_iso())
                return record

            record = self.store.mutate(workspace_id, claim)
            if record:
                cfg = self.config(self.store.read(workspace_id))["credentials"]
                try:
                    result = await NubeFactClient(cfg["api_url"], cfg["token"], self.client).submit(
                        record["payload"]
                    )
                    outcome = self.outcome(result)
                except ProviderError as exc:
                    rejected = exc.code in {
                        "nubefact_operation_rejected_20",
                        "nubefact_operation_rejected_22",
                    }
                    outcome = {
                        "phase": "rejected" if rejected else "query-required",
                        "error": exc.code,
                        "checked_at": now_iso(),
                    }
                    if exc.code == "nubefact_operation_rejected_23":
                        outcome["identity_conflict"] = True
                self.store.mutate(
                    workspace_id, lambda state: self.apply_outcome(state["documents"][record["id"]], outcome)
                )
            return self.store.item(self.store.read(workspace_id), request_id)

    async def query(self, workspace_id: str, request_id: str) -> dict[str, Any]:
        async with self.locks.setdefault(workspace_id, asyncio.Lock()):
            state = self.store.read(workspace_id)
            record = self.record(state, request_id)
            if record["phase"] == "authorized":
                raise StoreError("invoice_submission_required")
            if record["phase"] == "rejected" or record.get("identity_conflict"):
                # NubeFact's query omits buyer/amount. A pre-existing or definitively rejected
                # number cannot establish this draft's acceptance from identity alone.
                raise StoreError("invoice_document_review_required")
            cfg, payload = self.config(state)["credentials"], record["payload"]
            result = await NubeFactClient(cfg["api_url"], cfg["token"], self.client).query(
                1, payload["serie"], payload["numero"]
            )

            def update(state: dict[str, Any]) -> None:
                current = state["documents"][record["id"]]
                self.apply_outcome(current, self.outcome(result))

            self.store.mutate(workspace_id, update)
            return self.store.item(self.store.read(workspace_id), request_id)

    async def after_payments(self, workspace_id: str) -> None:
        state = self.store.read(workspace_id)
        for record in state["documents"].values():
            item = self.store.item(state, record["request_id"])
            if (
                record.get("auto_issue_after_payment")
                and record["phase"] == "authorized"
                and self.store.totals(item)["confirmed_minor"] == item["invoice_amount_minor"]
            ):
                try:
                    await self.issue(workspace_id, item["id"])
                except StoreError:
                    # Keep the already persisted payment while commissioning is resolved.
                    self.store.mutate(
                        workspace_id, lambda state: state.update(fiscal_retry_at=time.time() + 300)
                    )

    async def run_pending(self) -> None:
        async def resume(workspace_id: str) -> None:
            async with self.concurrency:
                await self.after_payments(workspace_id)

        await asyncio.gather(*(resume(wid) for wid in self.store.due_fiscal(time.time())))
