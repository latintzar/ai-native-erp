"""§17.47b — HOW INBOUND MAIL ACTUALLY WORKS: there is no inbox (WP-G3's rail).

The wire: MX for in.soyrocoto.com → Resend receiving → their `email.received` webhook POSTs
here, svix-signed. What arrives becomes ROWS on the surface it belongs to — never a mailbox
anyone reads:

  pedidos.<slug>@in.soyrocoto.com   → purpose 'pedidos'  (the email CHANNEL's intake substrate)
  facturas.<slug>@in.soyrocoto.com  → purpose 'facturas' (§17.47 — the month's reconciliation
                                       substrate; suppliers' invoices land as rows with files)
  anything else                     → purpose 'unknown'  (a dead-letter ROW, never a silent drop)

Addresses are purposes; purposes are agents (§17.47b). The signature check is the whole wall:
an unsigned POST writes nothing and learns nothing.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import os
import re
import time

from fastapi import APIRouter, Request, Response

import db

log = logging.getLogger("rocoto.mail")

router = APIRouter()

INBOUND_DOMAIN = "in.soyrocoto.com"
PURPOSES = ("pedidos", "facturas")


def _secret() -> bytes:
    raw = os.environ.get("ROCOTO_RESEND_INBOUND_SECRET", "")
    raw = raw.split("whsec_", 1)[-1]
    try:
        return base64.b64decode(raw + "=" * (-len(raw) % 4))
    except Exception:
        return raw.encode()


def verify_svix(payload: bytes, headers: dict) -> bool:
    """The standard svix scheme Resend signs with: HMAC-SHA256 over `{id}.{timestamp}.{body}`,
    base64, matched against any `v1,<sig>` in svix-signature. Timestamp within 5 minutes."""
    sid = headers.get("svix-id") or ""
    ts = headers.get("svix-timestamp") or ""
    sig = headers.get("svix-signature") or ""
    if not sid or not ts or not sig:
        return False
    try:
        if abs(time.time() - int(ts)) > 300:
            return False
    except ValueError:
        return False
    want = base64.b64encode(
        hmac.new(_secret(), f"{sid}.{ts}.".encode() + payload, hashlib.sha256).digest()
    ).decode()
    return any(hmac.compare_digest(want, p.split(",", 1)[1])
               for p in sig.split() if p.startswith("v1,"))


def split_address(addr: str) -> tuple[str, str]:
    """`facturas.escofruit@in.soyrocoto.com` → ('facturas', 'escofruit'); anything that is not
    one of our addresses at all → ('', ''). Shape only — it says nothing about whether the
    purpose is KNOWN (that is route_address's job, and it can involve the DB)."""
    m = re.match(rf"^([a-z0-9-]+)\.([a-z0-9_-]+)@{re.escape(INBOUND_DOMAIN)}$",
                 (addr or "").strip().lower())
    return (m.group(1), m.group(2)) if m else ("", "")


def route_address(addr: str) -> tuple[str, str]:
    """The BUILT-IN purposes only, synchronously (`pedidos`, `facturas`). Kept because callers
    outside the webhook rely on it; the webhook itself uses route_address_async so a tenant's
    own minted purposes (§17.47b.4) route too."""
    purpose, tenant = split_address(addr)
    if not purpose or purpose not in PURPOSES:
        return "unknown", ""
    return purpose, tenant


async def route_address_async(addr: str) -> tuple[str, str]:
    """§17.47b.4 — the two built-ins PLUS whatever this tenant minted by describing it to the
    copilot. A purpose that belongs to a different tenant does not route: the address carries
    both halves and both must agree."""
    purpose, tenant = split_address(addr)
    if not purpose:
        return "unknown", ""
    if purpose in PURPOSES:
        return purpose, tenant
    async with db.get_pool().acquire() as con:
        minted = await con.fetchval(
            "select 1 from inbound_purpose where tenant_slug=$1 and purpose=$2", tenant, purpose)
    return (purpose, tenant) if minted else ("unknown", "")


async def _store(purpose: str, tenant: str, data: dict) -> int:
    atts = []
    for a in data.get("attachments") or []:
        if isinstance(a, dict):
            atts.append({"filename": str(a.get("filename") or ""),
                         "content_type": str(a.get("content_type") or ""),
                         # content stays with Resend; the row keeps the handle to fetch by need
                         "content_id": str(a.get("content_id") or a.get("id") or "")})
    async with db.get_pool().acquire() as con:
        row = await con.fetchrow(
            "insert into inbound_mail(tenant_id, purpose, from_addr, to_addr, subject, "
            "body_text, attachments, email_id) values($1,$2,$3,$4,$5,$6,$7,$8) "
            "on conflict (email_id) do update set email_id = excluded.email_id returning id",
            tenant or "", purpose,
            str(data.get("from") or "")[:300],
            ", ".join(data.get("to") or [])[:300],
            str(data.get("subject") or "")[:500],
            str(data.get("text") or data.get("html") or "")[:20000],
            json.dumps(atts),
            str(data.get("email_id") or data.get("id") or "") or None)
    return int(row["id"])


@router.post("/api/mail/inbound")
async def mail_inbound(request: Request):
    payload = await request.body()
    if not verify_svix(payload, {k.lower(): v for k, v in request.headers.items()}):
        return Response(status_code=401)
    try:
        body = json.loads(payload)
    except Exception:
        return Response(status_code=400)
    if str(body.get("type") or "") != "email.received":
        return Response(status_code=202)          # other event kinds are not ours to keep
    data = body.get("data") or {}
    tos = data.get("to") or []
    # one mail may carry several of our addresses — a row per purpose it was sent to
    routed = False
    for to in tos:
        purpose, tenant = await route_address_async(str(to))
        if purpose == "unknown":
            continue
        # the tenant must EXIST — a made-up slug in an address must not mint rows for nobody
        async with db.get_pool().acquire() as con:
            known = await con.fetchval("select 1 from tenants where slug = $1", tenant)
        if not known:
            continue
        rid = await _store(purpose, tenant, data)
        routed = True
        log.info("INBOUND MAIL → row %s (%s/%s) from %s", rid, tenant, purpose,
                 str(data.get("from") or "")[:60])
    if not routed:
        rid = await _store("unknown", "", data)   # the dead-letter ROW — findable, never silent
        log.info("INBOUND MAIL → dead-letter row %s (to=%s)", rid, tos[:2])
    return {"ok": True}


async def rows_for(tenant: str, purpose: str, limit: int = 50) -> list[dict]:
    async with db.get_pool().acquire() as con:
        rows = await con.fetch(
            "select id, from_addr, subject, body_text, attachments, received_at from inbound_mail "
            "where tenant_id = $1 and purpose = $2 order by received_at desc limit $3",
            tenant, purpose, limit)
    out = []
    for r in rows:
        atts = r["attachments"]
        if isinstance(atts, str):
            try:
                atts = json.loads(atts)
            except ValueError:
                atts = []
        out.append({"id": int(r["id"]), "from": r["from_addr"], "subject": r["subject"],
                    "preview": (r["body_text"] or "")[:200], "attachments": atts,
                    "received_at": r["received_at"].isoformat()})
    return out
