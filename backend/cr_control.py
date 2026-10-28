"""cr_control.py — Control Room CONTROL surfaces (WP-9 cr-control): account · refunds · GDPR data.

Money/data actions, born session-only (never the machine key). Hardened per the threat model:
  • refund (#10/#11/#9): NEVER trusts a client payment_intent — the server resolves it from the scope;
    a deterministic idempotency_key makes a repeat a Stripe no-op; a WRITE-AHEAD cr_audit 'pending' row
    lands BEFORE the Stripe call; partial refunds are capped at charged − already_refunded.
  • erase (#4/#13/#9): LEAF scope only (reject any scope with descendants); every DELETE carries an
    explicit `scope = $1::ltree` EQUALITY (never the RLS <@ descendant semantics); the manifest is the
    grep-verified full set of subject-bearing tables incl. endpoint (raw addr) + entity_map + legacy
    leads; write-ahead 'erase.begin' before / 'erase.complete' after; audit detail is NON-PII (counts).
  • anonymize: deterministic in-place PII scrub (irreversible pseudonym), testable + reliable.

cr_audit is the source of truth (append-only, owner pool). Scope-bound mirrors go through scoped_tx as
`override.<action>` events (tier-P fence-safe).
"""
from __future__ import annotations

import hashlib
import json
import logging

import config
import cr_session
import db
from control_room import _iso, _phone_of_scope  # reuse the CR read helpers

log = logging.getLogger("rocoto.cr_control")

# The scope-keyed runtime tables a subject's data lives in (deleted with explicit scope= equality).
_SCOPE_TABLES = [
    "event", "contact_role", "fact", "card", "summary", "open_loop", "timer", "pending_turn",
    "action", "scope_state", "sweep_state", "wake", "assembly_snapshot",
    "manifest_sense", "manifest_tool", "manifest_stakeholder", "manifest_duty", "manifest_presence",
]  # contact + scope_node deleted LAST (endpoint FKs contact; scope_node is the anchor)


def _pseudonym(addr: str) -> str:
    return "anon:" + hashlib.sha256(("cr" + (addr or "")).encode()).hexdigest()[:16]


# ── ACCOUNT ─────────────────────────────────────────────────────────────────────────────────────────
async def account_data(scope: str) -> dict:
    """The tenant/customer account card: identity · the tenant's contact number · the Rocoto number that
    serves them (from the shared pool the system holds) · plan/tier · onboarding stage · paid state ·
    the refundable setup-fee payment (if any). Reads: runtime card cross-scope (control_pool); legacy
    lead/onboarding via the owner pool."""
    if not scope:
        return {"ok": False, "error": "bad_args"}
    phone = _phone_of_scope(scope)
    rocoto_num = config.ROCOTO_WHATSAPP_FROM.replace("whatsapp:", "") if config.ROCOTO_WHATSAPP_FROM else None
    out = {"ok": True, "scope": scope, "contact_number": phone,
           "rocoto_number": rocoto_num, "rocoto_number_note": "número compartido del sistema",
           "plan": None, "tier": None, "stage": None, "status": None, "onboarded_unpaid": False,
           "name": None, "business": None, "email": None, "payments": []}
    try:
        cpool = db.control_pool()
        async with cpool.acquire() as con:
            node = await con.fetchrow("select label, tier, tenant_slug from scope_node where scope=$1::ltree", scope)
            if node:
                out["name"] = out["name"] or node["label"]; out["tier"] = node["tier"]
    except Exception:
        log.exception("account: node read failed")
    if phone:
        try:
            async with db.get_pool().acquire() as con:
                lead = await con.fetchrow(
                    "select id, name, business, status, email from leads where phone=$1 "
                    "and coalesce(is_test,false)=false order by created_at desc limit 1", phone)
                if lead:
                    out.update({"name": out["name"] or lead["name"], "business": lead["business"],
                                "email": lead["email"], "stage": lead["status"], "status": lead["status"]})
                    prog = await con.fetch(
                        "select op.token, op.paid_at, op.stripe_payment_intent, op.stripe_invoice_id, "
                        "  op.refunded_at, op.refunded_amount "
                        "from onboarding_progress op join onboarding_tokens ot on ot.token=op.token "
                        "where ot.lead_id=$1 order by op.paid_at desc nulls last", lead["id"])
                    for pr in prog:
                        if not pr["paid_at"]:
                            continue
                        out["payments"].append({
                            "kind": "setup_fee", "paid_at": _iso(pr["paid_at"]),
                            "payment_intent": pr["stripe_payment_intent"], "invoice": pr["stripe_invoice_id"],
                            "refunded_at": _iso(pr["refunded_at"]), "refunded_amount": pr["refunded_amount"]})
                    out["onboarded_unpaid"] = bool(lead["status"] == "onboarded_unpaid")
        except Exception:
            log.exception("account: lead read failed")
    # WP-2 READINESS block (dx F2): {paid_at, has_catalogue, number, active, blocking[]} — the CR
    # Números surface renders button-or-reason from THIS, so Peter always sees why Activar is absent.
    try:
        from brain import golive as brain_golive
        out["readiness"] = await brain_golive.readiness(scope)
    except Exception:
        log.exception("account: readiness read failed")
        out["readiness"] = None
    return out


# ── GO-LIVE (WP-2: seed → bind → activate → welcome; one-shot; write-ahead audit) ────────────────────
async def golive(scope: str, number: str, actor: str, ip: str) -> dict:
    """Activate the scope's tenant (the CR «Activar» button). Session-born only — the endpoint rides
    require_cr_cap('act') + _assert_human_session, NEVER the machine key (dx F1). Refund discipline:
    a WRITE-AHEAD cr_audit 'pending' row lands BEFORE anything moves; the golive_at atomic claim in
    brain.golive makes welcome/bind/activation one-shot (a repeat is a friendly already_live no-op).
    Audit detail is NON-PII (tenant + number tail)."""
    if not scope:
        return {"ok": False, "error": "bad_args"}
    from brain import golive as brain_golive
    tail = (number or "")[-4:]
    async with db.get_pool().acquire() as con:
        await con.execute(
            "insert into cr_audit(ts, actor_email, ip, action, target_scope, target_id, detail, result) "
            "values(now(),$1,$2,'golive',$3,null,$4::jsonb,'pending')",
            actor, ip, scope, json.dumps({"number_tail": tail}))
    try:
        r = await brain_golive.activate(scope, number)
    except Exception as e:
        log.exception("golive failed scope=%s", scope)
        await cr_session.audit(actor, ip, "golive", target_scope=scope,
                               detail={"error": str(e)[:200]}, result="failed")
        return {"ok": False, "reason": "error", "message": "Error interno — revisa los logs."}
    await cr_session.audit(actor, ip, "golive", target_scope=scope, target_id=r.get("tenant"),
                           detail={"tenant": r.get("tenant"), "number_tail": tail,
                                   "already_live": bool(r.get("already_live")),
                                   "reason": r.get("reason")},
                           result="ok" if r.get("ok") else "refused",
                           scoped_event=bool(r.get("ok") and not r.get("already_live")))
    return r


# ── REFUND (Stripe; server-resolved intent; idempotent; write-ahead audit) ───────────────────────────
async def refund(scope: str, amount_cents: int | None, reason: str, actor: str, ip: str) -> dict:
    """Refund the scope's setup-fee charge. NEVER accepts a client payment_intent — the server resolves
    it from onboarding_progress for this scope. Write-ahead cr_audit 'pending' (its id = the Stripe
    idempotency_key) BEFORE the call; caps a partial at charged − already_refunded. Returns {ok, refund_id}
    or {ok:False,error}."""
    phone = _phone_of_scope(scope)
    if not phone:
        return {"ok": False, "error": "no_phone_scope"}
    async with db.get_pool().acquire() as con:
        row = await con.fetchrow(
            "select op.token as optoken, op.stripe_payment_intent, op.refunded_amount, op.amount_total, l.id as lead_id "
            "from onboarding_progress op "
            "join onboarding_tokens ot on ot.token=op.token "
            "join leads l on l.id=ot.lead_id "
            "where l.phone=$1 and op.stripe_payment_intent is not null "
            "order by op.paid_at desc nulls last limit 1", phone)
    if not row or not row["stripe_payment_intent"]:
        return {"ok": False, "error": "no_refundable_payment"}
    pi = row["stripe_payment_intent"]
    already = int(row["refunded_amount"] or 0)
    charged = int(row["amount_total"] or 0)
    refundable = charged - already if charged else None
    if refundable is not None and refundable <= 0:
        return {"ok": False, "error": "already_refunded"}
    amt = int(amount_cents) if amount_cents else (refundable if refundable is not None else None)
    if refundable is not None and amt is not None and amt > refundable:
        return {"ok": False, "error": "exceeds_charge", "refundable": refundable}
    # write-ahead audit (pending) — its id anchors the Stripe idempotency_key
    audit_id = None
    async with db.get_pool().acquire() as con:
        audit_id = await con.fetchval(
            "insert into cr_audit(ts, actor_email, ip, action, target_scope, target_id, detail, result) "
            "values(now(),$1,$2,'refund',$3,$4,$5::jsonb,'pending') returning id",
            actor, ip, scope, pi, json.dumps({"amount": amount_cents, "already": already, "reason": reason}))
    # DETERMINISTIC: derived ONLY from the logical operation, so a retry (e.g. after a post-Stripe DB
    # failure) re-sends the identical key and Stripe returns the ORIGINAL refund as a no-op (no double spend).
    idem = hashlib.sha256(f"{scope}|{pi}|{amt}".encode()).hexdigest()
    try:
        import stripe
        stripe.api_key = config.STRIPE_SECRET_KEY
        stripe.max_network_retries = 2
        kwargs = {"payment_intent": pi, "idempotency_key": idem, "reason": "requested_by_customer"}
        if amt:
            kwargs["amount"] = int(amt)
        rf = stripe.Refund.create(**kwargs)
        refunded = int(getattr(rf, "amount", amt or 0) or 0)
        rid = getattr(rf, "id", None)
        # Record the money movement FIRST — cr_audit is the source of truth; a later ledger-write failure
        # must NOT erase the fact that money moved (that is what invited the double-refund retry).
        await cr_session.audit(actor, ip, "refund", target_scope=scope, target_id=pi,
                               detail={"amount": refunded, "refund_id": rid, "idem": idem},
                               result="ok", scoped_event=True)
        try:
            async with db.get_pool().acquire() as con:
                await con.execute(
                    "update onboarding_progress set refunded_at=coalesce(refunded_at, now()), "
                    "  refunded_amount=coalesce(refunded_amount,0)+$2 where token=$1", row["optoken"], refunded)
        except Exception:
            log.exception("refund LEDGER update failed after a successful Stripe refund pi=%s "
                          "(audit recorded the truth; deterministic key makes a retry a Stripe no-op)", pi)
        return {"ok": True, "refund_id": rid, "amount": refunded}
    except Exception as e:
        log.exception("refund failed pi=%s", pi)
        await cr_session.audit(actor, ip, "refund", target_scope=scope, target_id=pi,
                               detail={"error": str(e)[:200]}, result="failed")
        return {"ok": False, "error": "stripe_error", "detail": str(e)[:200]}


# ── GDPR: export · anonymize · erase ─────────────────────────────────────────────────────────────────
async def export_data(scope: str) -> dict:
    """Export the subject's full data as JSON (runtime scope rows + legacy funnel). Read-only."""
    if not scope:
        return {"ok": False, "error": "bad_args"}
    data = {"scope": scope, "exported_from": "rocoto-control-room"}
    try:
        async with db.scoped_tx(scope) as con:
            for t in ("card", "fact", "summary", "open_loop", "timer", "event", "contact", "scope_state"):
                rows = await con.fetch(f"select * from {t} where scope=$1::ltree order by 1", scope)
                data[t] = [dict(r) for r in rows]
    except Exception:
        log.exception("export: runtime read failed")
    phone = _phone_of_scope(scope)
    if phone:
        try:
            async with db.get_pool().acquire() as con:
                data["whatsapp_messages"] = [dict(r) for r in await con.fetch(
                    "select * from whatsapp_messages where phone_number=$1 order by created_at", phone)]
                data["leads"] = [dict(r) for r in await con.fetch("select * from leads where phone=$1", phone)]
                data["demo_leads"] = [dict(r) for r in await con.fetch("select * from demo_leads where phone=$1", phone)]
        except Exception:
            log.exception("export: legacy read failed")
    return {"ok": True, "data": _jsonable(data)}


def _jsonable(o):
    import uuid as _u
    from datetime import date, datetime
    if isinstance(o, dict):
        return {k: _jsonable(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [_jsonable(v) for v in o]
    if isinstance(o, (datetime, date)):
        return o.isoformat()
    if isinstance(o, _u.UUID):
        return str(o)
    return o


async def _scope_has_descendants(scope: str) -> bool:
    """LEAF guard (#4): true if any scope strictly under this one exists (deleting a parent must never
    cascade a whole subtree)."""
    async with db.control_pool().acquire() as con:
        n = await con.fetchval(
            "select count(*) from scope_node where scope <@ $1::ltree and scope <> $1::ltree", scope)
    return bool(n)


async def erase(scope: str, actor: str, ip: str, *, mode: str = "erase") -> dict:
    """GDPR hard-delete (mode='erase') or in-place anonymise (mode='anonymize') of ONE leaf subject.
    Rejects any non-leaf scope. Every DELETE carries `scope = $1::ltree` equality (never <@). Write-ahead
    'erase.begin' before / 'erase.complete' after; detail is NON-PII (row counts). Returns {ok, counts}."""
    if not scope:
        return {"ok": False, "error": "bad_args"}
    if await _scope_has_descendants(scope):
        return {"ok": False, "error": "not_a_leaf_scope"}
    phone = _phone_of_scope(scope)
    # write-ahead begin (append-only WAL row; NON-PII)
    await cr_session.audit(actor, ip, f"data.{mode}.begin", target_scope=scope,
                           target_id=None, detail={"phone_hash": _pseudonym(phone or scope)}, result="pending")
    counts = {}
    try:
        if mode == "anonymize":
            counts = await _anonymize(scope, phone)
        else:
            counts = await _hard_delete(scope, phone)
    except Exception as e:
        log.exception("%s failed scope=%s", mode, scope)
        await cr_session.audit(actor, ip, f"data.{mode}", target_scope=scope, target_id=None,
                               detail={"error": str(e)[:200]}, result="failed")
        return {"ok": False, "error": "erase_failed", "detail": str(e)[:200]}
    await cr_session.audit(actor, ip, f"data.{mode}.complete", target_scope=scope, target_id=None,
                           detail={"counts": counts}, result="ok")
    return {"ok": True, "mode": mode, "counts": counts}


async def _hard_delete(scope: str, phone: str | None) -> dict:
    counts = {}
    async with db.scoped_tx(scope) as con:
        # endpoint FKs contact → delete endpoints of this scope's contacts FIRST
        counts["endpoint"] = _n(await con.execute(
            "delete from endpoint where contact_id in (select id from contact where scope=$1::ltree)", scope))
        for t in _SCOPE_TABLES:
            counts[t] = _n(await con.execute(f"delete from {t} where scope=$1::ltree", scope))
        counts["contact"] = _n(await con.execute("delete from contact where scope=$1::ltree", scope))
        counts["scope_node"] = _n(await con.execute("delete from scope_node where scope=$1::ltree", scope))
        counts["entity_map"] = _n(await con.execute("delete from entity_map where scope=$1::ltree", scope))
    if phone:
        async with db.get_pool().acquire() as con:
            lead_ids = [r["id"] for r in await con.fetch("select id from leads where phone=$1", phone)]
            if lead_ids:
                toks = [r["token"] for r in await con.fetch("select token from onboarding_tokens where lead_id = any($1::text[])", lead_ids)]
                if toks:
                    counts["onboarding_progress"] = _n(await con.execute("delete from onboarding_progress where token = any($1::text[])", toks))
                counts["onboarding_tokens"] = _n(await con.execute("delete from onboarding_tokens where lead_id = any($1::text[])", lead_ids))
            counts["whatsapp_messages"] = _n(await con.execute("delete from whatsapp_messages where phone_number=$1", phone))
            counts["demo_leads"] = _n(await con.execute("delete from demo_leads where phone=$1", phone))
            counts["leads"] = _n(await con.execute("delete from leads where phone=$1", phone))
    return counts


async def _anonymize(scope: str, phone: str | None) -> dict:
    counts = {}
    pseud = _pseudonym(phone or scope)
    async with db.scoped_tx(scope) as con:
        counts["card"] = _n(await con.execute("update card set body='[anonimizado]' where scope=$1::ltree", scope))
        counts["fact"] = _n(await con.execute("update fact set text='[anonimizado]', key=null where scope=$1::ltree", scope))
        counts["summary"] = _n(await con.execute("update summary set text='[anonimizado]' where scope=$1::ltree", scope))
        # the raw conversation store — the LARGEST PII surface. Scrub the free-text payload keys in place.
        counts["event"] = _n(await con.execute(
            "update event set payload = (coalesce(payload,'{}'::jsonb) "
            "  || jsonb_build_object('text','[anonimizado]','body','[anonimizado]','transcript','[anonimizado]')) "
            "where scope=$1::ltree and (payload ? 'text' or payload ? 'body' or payload ? 'transcript')", scope))
        counts["contact"] = _n(await con.execute(
            "update contact set display_name='[anonimizado]', flags='{}'::jsonb where scope=$1::ltree", scope))
        counts["open_loop"] = _n(await con.execute(
            "update open_loop set text='[anonimizado]', notes=null where scope=$1::ltree", scope))
        counts["endpoint"] = _n(await con.execute(
            "update endpoint set addr=$2 where contact_id in (select id from contact where scope=$1::ltree)", scope, pseud))
    if phone:
        async with db.get_pool().acquire() as con:
            counts["whatsapp_messages"] = _n(await con.execute(
                "update whatsapp_messages set phone_number=$2, message_text='[anonimizado]', transcript=null where phone_number=$1", phone, pseud))
            counts["leads"] = _n(await con.execute(
                "update leads set name='[anonimizado]', email=null, phone=$2 where phone=$1", phone, pseud))
            counts["demo_leads"] = _n(await con.execute(
                "update demo_leads set name='[anonimizado]', business='[anonimizado]', summary=null, phone=$2 where phone=$1", phone, pseud))
    return counts


def _n(status: str) -> int:
    try:
        return int(str(status).split()[-1])
    except Exception:
        return 0
