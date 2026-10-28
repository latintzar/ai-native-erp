"""§17.4c / §17.36 — DISPATCH SCHEDULES: many scheduled sends, per tenant, honestly bounded.

The spec's generalization of the one DispatchSettings row (§2901): a `dispatch_schedule` row is
a NAMED send — «Pollo → Avícola Ruiz, 13:30, category pollo only» — and the runner is a loop
over enabled rows inside the existing scheduler tick. The legacy settings row REMAINS schedule
#1 in spirit: it keeps its own branch in `_dispatch_scheduler` and it alone marks orders
`dispatched_at` — a category send to a partner never consumes the day sheet's duty.

Laws carried in code, not copy:
  · A schedule that would send ZERO lines sends NOTHING and records that it chose not to —
    a partner receiving a blank sheet at 13:30 reads as breakage (§17.4c build note).
  · No unconsented external send can EXIST: the CHECK constraint on the table refuses the row
    from every path — panel, copilot, MCP, import (§17.36 correction 5).
  · Timezone Europe/Madrid, same as the metering (§0.10).
  · Category filtering joins order lines to `catalogue_skus` by sku_id — per-order columns are
    customer names and a purchase order carries QUANTITIES; the compras default is the matrix
    shape, never per-order columns leaving the building (§17.36 correction 1 lives in the UI's
    defaults; here every send is exactly what its row says).
"""
from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any, Optional
from zoneinfo import ZoneInfo

import db
import orders as orders_mod

log = logging.getLogger("rocoto.dispatch_sched")

MADRID = ZoneInfo("Europe/Madrid")

PURPOSES = ("compras", "direccion", "almacen", "facturacion", "incidencias", "otro")
FORMATS = orders_mod.EXCEL_FORMATS  # derived, per shared contract 4 — never a second hardcoded list


def _jd(v: Any) -> dict:
    if isinstance(v, dict):
        return v
    if isinstance(v, str):
        try:
            d = json.loads(v)
            return d if isinstance(d, dict) else {}
        except ValueError:
            return {}
    return {}


async def list_for(tenant: str) -> list[dict]:
    async with db.get_pool().acquire() as con:
        rows = await con.fetch(
            "select id, name, purpose, format_id, cadence, send_window, categories, recipients, "
            "       enabled, external, consent_by, last_run_at, last_run_note, created_by "
            "from dispatch_schedule where tenant_id = $1 order by id", tenant)
    out = []
    for r in rows:
        out.append({
            "id": int(r["id"]), "name": r["name"], "purpose": r["purpose"],
            "format_id": r["format_id"], "cadence": _jd(r["cadence"]), "window": r["send_window"],
            "categories": list(r["categories"] or []), "recipients": list(r["recipients"] or []),
            "enabled": bool(r["enabled"]), "external": bool(r["external"]),
            "consent_by": r["consent_by"],
            "last_run_at": r["last_run_at"].isoformat() if r["last_run_at"] else None,
            "last_run_note": r["last_run_note"] or "",
        })
    return out


async def create(tenant: str, *, name: str, purpose: str, format_id: str, cadence: dict,
                 categories: list[str], recipients: list[str], external: bool,
                 consent_by: Optional[str], created_by: str,
                 window: str = "today") -> dict:
    """Insert one schedule. The CHECK constraint is the real wall for external-without-consent;
    the ValueError here is just the es-ES sentence in front of it."""
    if purpose not in PURPOSES:
        raise ValueError("Ese propósito no existe.")
    if format_id not in FORMATS:
        raise ValueError(f"Ese formato no existe ({' | '.join(FORMATS)}).")
    if not name.strip():
        raise ValueError("El envío necesita un nombre.")
    recipients = [r.strip().lower() for r in recipients if r and "@" in r]
    if not recipients:
        raise ValueError("Hace falta al menos un correo de destino.")
    at = str((cadence or {}).get("at") or "")
    if len(at) != 5 or at[2] != ":":
        raise ValueError("La hora tiene que ser HH:MM.")
    if external and not consent_by:
        raise ValueError("Un envío fuera de tu equipo necesita el consentimiento del propietario.")
    async with db.get_pool().acquire() as con:
        row = await con.fetchrow(
            "insert into dispatch_schedule(tenant_id, name, purpose, format_id, cadence, send_window, "
            "  categories, recipients, external, consent_by, consent_at, created_by) "
            "values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::text, "
            "  case when $10::text is null then null else now() end, $11) "
            "returning id",
            tenant, name.strip(), purpose, format_id,
            json.dumps({"mode": "scheduled", "at": at,
                        "days": list((cadence or {}).get("days") or [1, 2, 3, 4, 5, 6, 7])}),
            window, categories, recipients, external, consent_by, created_by)
    return {"id": int(row["id"])}


async def set_enabled(tenant: str, sched_id: int, enabled: bool) -> bool:
    async with db.get_pool().acquire() as con:
        n = await con.execute(
            "update dispatch_schedule set enabled = $3 where tenant_id = $1 and id = $2",
            tenant, sched_id, enabled)
    return n.endswith("1")


async def delete(tenant: str, sched_id: int) -> bool:
    async with db.get_pool().acquire() as con:
        n = await con.execute(
            "delete from dispatch_schedule where tenant_id = $1 and id = $2", tenant, sched_id)
    return n.endswith("1")


# ── the runner ───────────────────────────────────────────────────────────────────────────────
async def _family_map(tenant: str) -> dict[str, str]:
    async with db.get_pool().acquire() as con:
        rows = await con.fetch(
            "select id, family from catalogue_skus where tenant_id = $1", tenant)
    return {r["id"]: (r["family"] or "") for r in rows}


def _filter_orders(orders: list[dict], categories: list[str], fam: dict[str, str]) -> list[dict]:
    """Keep only the lines whose catalogue family is in `categories`; drop line-less orders.
    Empty categories = the whole order set, untouched."""
    if not categories:
        return orders
    want = {c.strip().lower() for c in categories}
    out = []
    for o in orders:
        lines = [l for l in (o.get("lines") or [])
                 if fam.get(str(l.get("sku_id") or ""), "").strip().lower() in want]
        if lines:
            out.append({**o, "lines": lines})
    return out


async def run_due(now: Optional[datetime] = None) -> int:
    """One tick: run every enabled scheduled row whose HH:MM matches now (Madrid) and whose
    weekday is in its days, at most once per day. Returns how many rows fired."""
    now = now or datetime.now(MADRID)
    hhmm = now.strftime("%H:%M")
    dow = now.isoweekday()
    async with db.get_pool().acquire() as con:
        rows = await con.fetch(
            "select id, tenant_id, name, format_id, cadence, categories, recipients "
            "from dispatch_schedule where enabled "
            "and (last_run_at is null or last_run_at::date < $1::date)", now.date())
    fired = 0
    for r in rows:
        cad = _jd(r["cadence"])
        if cad.get("mode") != "scheduled" or cad.get("at") != hhmm:
            continue
        if dow not in (cad.get("days") or [1, 2, 3, 4, 5, 6, 7]):
            continue
        tenant = r["tenant_id"]
        note = ""
        try:
            orders = await db.orders_for_dispatch(tenant)
            fam = await _family_map(tenant)
            batch = _filter_orders(orders, list(r["categories"] or []), fam)
            if not batch:
                # zero lines → nothing sent, and the row SAYS so (never a blank sheet)
                note = f"{now.strftime('%H:%M')} — nada que enviar (0 líneas); no se envió archivo"
            else:
                sent_to = []
                for rcpt in list(r["recipients"] or []):
                    res = await orders_mod.dispatch_async(batch, rcpt, r["format_id"] or "standard")
                    sent_to.append(f"{rcpt}:{'ok' if res.get('ok') else res.get('error', 'fallo')}")
                note = f"{now.strftime('%H:%M')} — {len(batch)} pedido(s) → " + ", ".join(sent_to)
            fired += 1
        except Exception as e:  # noqa: BLE001 — one broken schedule must not kill the tick
            log.exception("dispatch_schedule %s (%s) failed", r["id"], r["name"])
            note = f"{now.strftime('%H:%M')} — falló: {type(e).__name__}"
        async with db.get_pool().acquire() as con:
            await con.execute(
                "update dispatch_schedule set last_run_at = now(), last_run_note = $3 "
                "where id = $1 and tenant_id = $2", r["id"], tenant, note)
    return fired
