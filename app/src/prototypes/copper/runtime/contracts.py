from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from typing import Literal

PaymentState = Literal["pending", "paid", "failed", "cancelled", "refunded"]


class ProviderError(Exception):
    """A safe, operator-facing provider failure without credentials or raw payloads."""

    def __init__(self, code: str, *, retryable: bool = False) -> None:
        super().__init__(code)
        self.code = code
        self.retryable = retryable


@dataclass(frozen=True)
class PaymentIntent:
    reference: str
    amount_minor: int
    currency: str
    description: str
    payer_email: str
    notify_url: str
    return_url: str
    billing: dict[str, str] = field(default_factory=dict)
    shipping: dict[str, str] = field(default_factory=dict)

    @property
    def amount(self) -> str:
        return f"{self.amount_minor // 100}.{self.amount_minor % 100:02d}"


@dataclass(frozen=True)
class Checkout:
    provider_id: str
    url: str
    recovery_token: str = ""


@dataclass(frozen=True)
class PaymentObservation:
    provider_id: str
    reference: str
    amount_minor: int
    currency: str
    status: PaymentState
    merchant_id: str = ""
    payment_method: str = ""


def minor_units(value: object) -> int:
    try:
        amount = Decimal(str(value))
        minor = amount * 100
        if not amount.is_finite() or minor != minor.to_integral_value() or minor < 0:
            raise ValueError("amount")
        return int(minor)
    except (InvalidOperation, ValueError, TypeError, OverflowError) as exc:
        raise ProviderError("invalid_provider_amount") from exc
