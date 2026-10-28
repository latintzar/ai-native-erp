"""§5.11.7 / §17.32 — CREDIT: money on the desk, derived ONLY from the ledger.

The engine already lives in delivery.py (`owed` · `credit_terms` · `breach` · `settle` — the
driver's half); this module is the DESK's home for it, so «backend/credit.py» exists where the
spec points and the two surfaces can never diverge on a number.

The two laws every function here carries:
  · **Amounts are always derived from the ledger.** There is no parameter anywhere for a human
    to type how much someone owes.
  · **The desk shows the RECORD, never a fake charge** (§5.11.6): the payment state per order
    is the driver's vocabulary verbatim — Pagado · efectivo / tarjeta / Bizum (a record) ·
    30 días · Billie (they carry it; you were paid) · Debe (confianza — you carry it, ageing)
    · Sin liquidar.

`chase_text` drafts the reminder («Reclamar» is ALWAYS a draft, §17.14.5) — the copilot's
draft store is where it waits for the supplier's accept; nothing here sends.
"""
from __future__ import annotations

import logging

import db
import delivery

log = logging.getLogger("rocoto.credit")


def _state_of(rows: list[dict]) -> dict:
    """One order's settlement rows → its state, driver's vocabulary. Newest row wins — the
    ledger is append-only, so the latest fact is the current one."""
    if not rows:
        return {"state": "sin_liquidar", "label": "Sin liquidar"}
    r = rows[-1]
    method = r["method"]
    kind = r["credit_kind"] or ""
    if method == "credito":
        if kind == "billie":
            return {"state": "billie", "label": "30 días · Billie"}
        from datetime import datetime, timezone
        days = max(0, (datetime.now(timezone.utc) - r["recorded_at"]).days)
        return {"state": "confianza", "label": f"Debe · {days} día{'s' if days != 1 else ''}",
                "days": days}
    label = {"efectivo": "Pagado · efectivo", "tarjeta": "Pagado · tarjeta",
             "bizum": "Pagado · Bizum"}.get(method, f"Pagado · {method}")
    return {"state": "pagado", "label": label, "method": method}


async def payment_states(tenant: str, order_ids: list[str]) -> dict[str, dict]:
    """order_id → payment state, for the sheet. One query, grouped in code."""
    if not order_ids:
        return {}
    async with db.get_pool().acquire() as con:
        rows = await con.fetch(
            "select order_id, method, credit_kind, recorded_at from delivery_settlements "
            "where tenant_id = $1 and order_id = any($2::text[]) order by recorded_at",
            tenant, order_ids)
    by: dict[str, list] = {}
    for r in rows:
        by.setdefault(r["order_id"], []).append(dict(r))
    return {oid: _state_of(by.get(oid, [])) for oid in order_ids}


async def position(tenant: str, phone: str) -> dict:
    """The customer's whole credit position — outstanding + terms + breach, delivery.py's own
    numbers (the same the door quotes; one truth)."""
    async with db.get_pool().acquire() as con:
        return await delivery.breach(con, tenant, phone)


async def chase_text(tenant: str, phone: str) -> dict:
    """The Reclamar DRAFT: the reminder in the house register, its amount computed from the
    ledger. Refuses when nothing is owed — a reminder for zero is a relationship wound."""
    pos = await position(tenant, phone)
    if not pos["count"] or pos["cents"] <= 0:
        raise ValueError("No debe nada según el libro — no hay nada que reclamar.")
    text = (f"Hola — te escribo por lo pendiente: {pos['label']} "
            f"({pos['count']} entrega{'s' if pos['count'] != 1 else ''}"
            + (f", la más antigua hace {pos['oldest_days']} días" if pos.get("oldest_days") else "")
            + "). ¿Te va bien liquidarlo esta semana, o lo hablamos?")
    return {"text": text, "cents": pos["cents"], "label": pos["label"],
            "breached": pos["breached"], "reason": pos.get("reason") or ""}
