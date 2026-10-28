"""Identity resolution (Register #14) — right customer every time, hard tenant isolation.

Resolves (tenant, phone) → who this is, plus the two crunch cases:
  - owner → 2 venues: one customer with multiple sites; a venue cue in the text picks the site.
  - staff on a personal number: unknown phone whose text names a known venue → propose a link
    (the operator confirms; we never silently merge identities).
Every query is keyed by tenant_id.

── THE BINDING WRITER (2026-07-27, SPEC §6 "a second number belonging to an existing customer") ──
`resolve()` above could only ever PROPOSE a link (`proposed_link`) — nothing in the codebase could
write one. `customer_profiles.phone_numbers` was read by resolve(), preserved by brain/profile.py's
recompute, and written by NOBODY, so a boss saying "ese número es de Manolo" had nowhere to land.
`link_phone` / `unlink_phone` below are that missing write, and they follow §6's TRUST ORDER rather
than inventing one: (a) the boss declares it → the employee writes it as a logged, reversible
identity action — this function, `declared_by='boss'`; (b) pre-seeded from the customer-list import
— the same function, `declared_by='seed'`; (c) the customer claims it → the recognition challenge
verifies FIRST and only then calls this; (d) ambiguous → we refuse and hand it back, never merge.

The two refusals matter more than the write: a number that already owns its OWN customer row, or one
already linked to a DIFFERENT owner, is a MERGE decision and merges are the boss's, not ours
(exactly the discipline `runtime.link_email` uses for email). Both come back typed, never as a
silent no-op.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Dict, Optional

import config
import db

log = logging.getLogger("rocoto.brain.identity")


def _obj(v, default):
    """Tolerate a jsonb column arriving as dict/list (codec) or a raw string (defensive)."""
    if v is None:
        return default
    if isinstance(v, str):
        try:
            return json.loads(v)
        except Exception:
            return default
    return v


async def resolve(phone: str, *, text: Optional[str] = None,
                  tenant: Optional[str] = None) -> Dict[str, Any]:
    tenant = tenant or config.BRAIN_TENANT
    text_l = (text or "").lower()
    pool = db.get_pool()
    out: Dict[str, Any] = {
        "phone": phone, "tenant": tenant, "known": False, "display_name": "",
        "customer_name": "", "venue": None, "venues": [], "linked_phones": [],
        "proposed_link": None, "note": "",
    }
    async with pool.acquire() as con:
        prof = await con.fetchrow(
            "select * from customer_profiles where tenant_id=$1 and phone_number=$2", tenant, phone)
        wprof = await con.fetchrow(
            "select display_name from whatsapp_user_profiles where phone_number=$1", phone)

        # staff-on-personal already linked: phone listed in some owner's profile.phone_numbers
        owner = None
        if not prof:
            owner = await con.fetchrow(
                "select * from customer_profiles where tenant_id=$1 and phone_numbers @> $2::jsonb limit 1",
                tenant, [phone])

        src = prof or owner
        if src:
            out["known"] = True
            out["display_name"] = src["display_name"] or ""
            out["customer_name"] = src["display_name"] or ""
            out["linked_phones"] = list(_obj(src["phone_numbers"], []) or [])
            venues = list((_obj(src["stats"], {}) or {}).get("venues") or [])
            out["venues"] = venues
            if owner and not prof:
                out["note"] = f"staff phone linked to {src['display_name']}"
            # owner → 2 venues: pick by venue cue, else single venue, else leave for a note
            if venues:
                for v in venues:
                    if v and v.lower() in text_l:
                        out["venue"] = v
                        break
                if not out["venue"]:
                    out["venue"] = venues[0] if len(venues) == 1 else None
                    if out["venue"] is None:
                        out["note"] = "multiple venues — which site? (defaulted to none)"
        elif wprof:
            out["known"] = True
            out["display_name"] = wprof["display_name"] or ""
            out["customer_name"] = wprof["display_name"] or ""

        # unknown phone whose text names a known venue → propose a link (operator confirms)
        if not out["known"] and text_l:
            cands = await con.fetch(
                """select phone_number, display_name from whatsapp_user_profiles
                     where display_name <> '' and phone_number <> $1
                   union
                   select phone_number, display_name from customer_profiles
                     where tenant_id=$2 and display_name <> '' and phone_number <> $1""",
                phone, tenant)
            for c in cands:
                dn = (c["display_name"] or "").strip()
                if dn and len(dn) >= 4 and dn.lower() in text_l:
                    out["proposed_link"] = {"venue": dn, "phone": c["phone_number"]}
                    out["note"] = f"unknown number names '{dn}' — propose linking to that venue"
                    break

    return out


# ── IS THIS NUMBER A CUSTOMER CONTACT OF THIS TENANT, AND IS THAT ROW SEEDED OR REAL? ────────────
async def customer_role(phone: str, *, tenant: Optional[str] = None) -> Dict[str, Any]:
    """The one identity question the order-intake guard actually needs (app._creator_order_route).

    Returns {known, seeded, display_name, via, tier, owner_phone}:
      known   — this tenant holds a customer row for this number (its own, or linked as staff)
      seeded  — that row was minted by the demo world (`customer_profiles.seeded`), not by trade
      via     — 'customer_profile' | 'linked_phone' | '' (HOW we know, so a trace can say it)
      tier    — the runtime tier ladder's answer for this scope, verbatim, for the record

    `seeded` is the load-bearing field and it is deliberately reported rather than judged here: the
    caller decides what a seeded row licenses. Keeping the judgement out of the identity organ is
    what stops this from quietly becoming a second authorisation system.

    Fail-soft: any read error answers "not known" — the safe direction, because every caller uses a
    positive answer to RELAX something."""
    tenant = tenant or config.BRAIN_TENANT
    out: Dict[str, Any] = {"known": False, "seeded": False, "display_name": "", "via": "",
                           "tier": "", "owner_phone": "", "tenant": tenant}
    try:
        pool = db.get_pool()
        async with pool.acquire() as con:
            row = await con.fetchrow(
                "select phone_number, display_name, seeded from customer_profiles "
                "where tenant_id=$1 and phone_number=$2", tenant, phone)
            via = "customer_profile"
            if row is None:
                row = await con.fetchrow(
                    "select phone_number, display_name, seeded from customer_profiles "
                    "where tenant_id=$1 and phone_numbers @> $2::jsonb limit 1", tenant, [phone])
                via = "linked_phone"
            if row is not None:
                out.update({"known": True, "seeded": bool(row["seeded"]), "via": via,
                            "display_name": row["display_name"] or "",
                            "owner_phone": row["phone_number"] or ""})
    except Exception:
        log.debug("identity.customer_role commerce read fail-soft for %s", phone, exc_info=True)
    try:                                    # the tier ladder, for the record — never for the verdict
        import runtime as _runtime
        async with db.control_pool().acquire() as con:
            out["tier"] = await con.fetchval(
                "select tier from scope_node where scope=$1::ltree", _runtime.scope_of(phone)) or ""
    except Exception:
        log.debug("identity.customer_role tier read fail-soft for %s", phone, exc_info=True)
    return out


# ── THE BINDING WRITE (SPEC §6 trust order (a)/(b)) ─────────────────────────────────────────────
def _norm_phone(p: str) -> str:
    """E.164-ish: keep a leading '+' and the digits. Deliberately NOT a full libphonenumber parse —
    every caller here already holds a canonical number (app._norm / runtime.scope_of)."""
    p = (p or "").strip().replace("whatsapp:", "")
    digits = "".join(ch for ch in p if ch.isdigit())
    return ("+" + digits) if digits else ""


async def link_phone(owner_phone: str, new_phone: str, *, tenant: Optional[str] = None,
                     declared_by: str = "boss", source: str = "app") -> Dict[str, Any]:
    """Bind `new_phone` to the existing customer `owner_phone` (SPEC §6). Idempotent; typed refusals.

    Refuses — and these ARE the feature:
      no_owner        the owner has no customer row on this tenant (nothing to bind TO)
      same_number     the two are the same line
      owns_profile    `new_phone` already has its own customer row → that is a MERGE, the boss's call
      linked_elsewhere `new_phone` is already staff on a DIFFERENT customer → likewise
    Success returns {ok, owner_phone, display_name, linked_phones, already}. The write is a jsonb
    append on `customer_profiles.phone_numbers` — the column `resolve()` above already reads, so a
    linked number starts resolving to the right venue on the very next message, and `brain/profile`'s
    recompute carries it forward untouched. Reversible with `unlink_phone`.

    The identity EVENT is what makes it auditable: `identity.phone_linked` lands on the owner's own
    scope through the ordinary sense path, so "why does this number answer as Casa Bermejo?" is a
    question the flight recorder answers."""
    tenant = tenant or config.BRAIN_TENANT
    owner_phone, new_phone = _norm_phone(owner_phone), _norm_phone(new_phone)
    if not owner_phone or not new_phone:
        return {"ok": False, "reason": "bad_args"}
    if owner_phone == new_phone:
        return {"ok": False, "reason": "same_number"}
    pool = db.get_pool()
    async with pool.acquire() as con, con.transaction():
        owner = await con.fetchrow(
            "select phone_number, display_name, phone_numbers from customer_profiles "
            "where tenant_id=$1 and phone_number=$2 for update", tenant, owner_phone)
        if owner is None:
            return {"ok": False, "reason": "no_owner"}
        own = await con.fetchval(
            "select 1 from customer_profiles where tenant_id=$1 and phone_number=$2",
            tenant, new_phone)
        if own:
            return {"ok": False, "reason": "owns_profile"}
        other = await con.fetchval(
            "select phone_number from customer_profiles "
            "where tenant_id=$1 and phone_number<>$2 and phone_numbers @> $3::jsonb limit 1",
            tenant, owner_phone, [new_phone])
        if other:
            return {"ok": False, "reason": "linked_elsewhere", "owner_phone": other}
        current = list(_obj(owner["phone_numbers"], []) or [])
        already = new_phone in current
        if not already:
            current.append(new_phone)
            await con.execute(
                "update customer_profiles set phone_numbers=$3::jsonb, updated_at=now() "
                "where tenant_id=$1 and phone_number=$2", tenant, owner_phone, current)
    if not already:
        try:                                    # the audit trail — fail-soft, never blocks the bind
            import runtime as _runtime
            await _runtime.emit_sense(
                phone=owner_phone, type="identity.phone_linked", source=source,
                payload={"text": f"Número vinculado a este cliente: {new_phone} "
                                 f"(lo declaró: {declared_by}).",
                         "linked_phone": new_phone, "declared_by": declared_by, "tenant": tenant},
                dedupe_key=f"phonelink:{tenant}:{owner_phone}:{new_phone}")
        except Exception:
            log.debug("identity.link_phone event fail-soft", exc_info=True)
    return {"ok": True, "already": already, "owner_phone": owner_phone,
            "display_name": owner["display_name"] or "", "linked_phones": current}


async def unlink_phone(owner_phone: str, new_phone: str, *, tenant: Optional[str] = None,
                       source: str = "app") -> Dict[str, Any]:
    """Undo a binding. Reversibility is the reason `link_phone` is allowed to be the primary path at
    all (SPEC §6: "logged, reversible"). Idempotent — unlinking what was never linked is {ok, already}."""
    tenant = tenant or config.BRAIN_TENANT
    owner_phone, new_phone = _norm_phone(owner_phone), _norm_phone(new_phone)
    if not owner_phone or not new_phone:
        return {"ok": False, "reason": "bad_args"}
    pool = db.get_pool()
    async with pool.acquire() as con, con.transaction():
        owner = await con.fetchrow(
            "select display_name, phone_numbers from customer_profiles "
            "where tenant_id=$1 and phone_number=$2 for update", tenant, owner_phone)
        if owner is None:
            return {"ok": False, "reason": "no_owner"}
        current = list(_obj(owner["phone_numbers"], []) or [])
        if new_phone not in current:
            return {"ok": True, "already": True, "owner_phone": owner_phone,
                    "linked_phones": current}
        current = [p for p in current if p != new_phone]
        await con.execute(
            "update customer_profiles set phone_numbers=$3::jsonb, updated_at=now() "
            "where tenant_id=$1 and phone_number=$2", tenant, owner_phone, current)
    try:
        import runtime as _runtime
        await _runtime.emit_sense(
            phone=owner_phone, type="identity.phone_unlinked", source=source,
            payload={"text": f"Número desvinculado de este cliente: {new_phone}.",
                     "linked_phone": new_phone, "tenant": tenant},
            dedupe_key=f"phoneunlink:{tenant}:{owner_phone}:{new_phone}")
    except Exception:
        log.debug("identity.unlink_phone event fail-soft", exc_info=True)
    return {"ok": True, "already": False, "owner_phone": owner_phone,
            "display_name": owner["display_name"] or "", "linked_phones": current}
