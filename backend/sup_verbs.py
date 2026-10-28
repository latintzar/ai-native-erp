"""§17.48b — THE ONE VERB REGISTRY the copilot and the MCP server share.

One registry means the copilot can never do what MCP can't, and vice versa — parity is
structural. Every verb is walled by the caller's membership (§17.34: the `cap` field) and every
CHANGE verb is draft-first: the agent loop never runs it — it stages a `config_draft` row, the
panel renders the draft, and only the operator's accept executes `run()` (which audits with the
SAME action names the direct endpoints use, so the audit trail has one vocabulary).

«Rocoto can get things wrong. Nothing changes until you accept it» is mechanical here, not copy.

Read verbs run inline in the loop — reading is what the caller's cap already allows.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Dict

import db
import sup_session

log = logging.getLogger("rocoto.sup_verbs")

# the alias sources the MACHINE wrote — «Olvidar» never removes those (sup_api's own tuple,
# duplicated here deliberately rather than imported: sup_api imports THIS module, not the reverse)
_MACHINE_ALIAS_SOURCES = ("seed", "golive", "create")


# ── the change verbs' executors ──────────────────────────────────────────────────────────────
async def _run_set_behaviour(slug: str, actor: str, ip: str, args: dict) -> dict:
    import behaviour
    changes = {str(args.get("key")): str(args.get("value"))}
    before, after = await behaviour.set_keys(slug, **changes)
    await sup_session.audit(actor, slug, ip, "behaviour.set",
                            detail={"before": before, "after": after,
                                    "changed": sorted(changes), "via": "copilot"})
    return {"s": after}


async def _run_set_customer_price(slug: str, actor: str, ip: str, args: dict) -> dict:
    phone = str(args.get("phone") or "")
    sku = str(args.get("sku_id") or "")
    price = args.get("price")
    async with db.get_pool().acquire() as con:
        known = await con.fetchval(
            "select 1 from customer_profiles where tenant_id=$1 and phone_number=$2", slug, phone)
        if not known:
            raise ValueError("Ese cliente no está en tu lista.")
        ok_sku = await con.fetchval(
            "select 1 from catalogue_skus where tenant_id=$1 and id=$2", slug, sku)
        if not ok_sku:
            raise ValueError("Ese artículo no está en tu catálogo.")
        await con.execute(
            "insert into customer_sku_prices(tenant_id, phone_number, sku_id, price, updated_by) "
            "values($1,$2,$3,$4,$5) on conflict (tenant_id, phone_number, sku_id) do update set "
            "price=$4, updated_at=now(), updated_by=$5",
            slug, phone, sku, price, actor)
    await sup_session.audit(actor, slug, ip, "customer.price", target_id=f"{phone[-4:]}:{sku}",
                            detail={"price": price, "via": "copilot"})
    return {"ok": True}


async def _run_set_range(slug: str, actor: str, ip: str, args: dict) -> dict:
    from brain import range as brain_range
    async with db.get_pool().acquire() as con:
        cur = await brain_range.get_range(con, slug)
        depot_lat = cur.get("depot_lat")
        depot_lon = cur.get("depot_lon")
        if depot_lat is None:
            t = await con.fetchrow("select lat, lng from tenants where slug=$1", slug)
            depot_lat = t and t["lat"]
            depot_lon = t and t["lng"]
        out = await brain_range.set_range(
            con, slug, range_km=args.get("range_km"),
            depot_lat=depot_lat, depot_lon=depot_lon,
            depot_label=cur.get("depot_label") or "")
    await sup_session.audit(actor, slug, ip, "settings.range",
                            detail={"range_km": out.get("range_km"), "via": "copilot"})
    return out


async def _run_toggle_product(slug: str, actor: str, ip: str, args: dict) -> dict:
    from brain import entitlement
    product = str(args.get("product") or "")
    want_on = bool(args.get("on"))
    before = await entitlement.state(product, slug)
    after = await entitlement.set_state(
        product, entitlement.LIVE if want_on else entitlement.OFF, slug,
        actor=f"copilot:{actor}")
    await sup_session.audit(actor, slug, ip, "product.toggle", target_id=product,
                            detail={"before": before, "after": after, "via": "copilot"})
    return {"product": product, "state": after}


async def _run_set_aviso_routing(slug: str, actor: str, ip: str, args: dict) -> dict:
    import sup_api
    moment = str(args.get("moment") or "")
    if moment not in sup_api.AVISO_DEFAULTS:
        raise ValueError("Ese momento no existe.")
    rails = {k: bool(args.get(k)) for k in ("rail_app", "rail_wa", "rail_email")}
    async with db.get_pool().acquire() as con:
        await con.execute(
            "insert into aviso_routing(tenant_id, moment, rail_app, rail_wa, rail_email, updated_by) "
            "values($1,$2,$3,$4,$5,$6) on conflict (tenant_id, moment) do update set "
            "rail_app=$3, rail_wa=$4, rail_email=$5, updated_at=now(), updated_by=$6",
            slug, moment, rails["rail_app"], rails["rail_wa"], rails["rail_email"], actor)
    await sup_session.audit(actor, slug, ip, "aviso.routing", target_id=moment,
                            detail={"after": rails, "via": "copilot"})
    return {"moment": moment, **rails}


async def _run_edit_company(slug: str, actor: str, ip: str, args: dict) -> dict:
    fields = {k: str(args[k]).strip() for k in ("name", "address", "city")
              if isinstance(args.get(k), str) and str(args[k]).strip()}
    if not fields:
        raise ValueError("No hay nada que cambiar.")
    async with db.get_pool().acquire() as con:
        sets = ", ".join(f"{k} = ${i + 2}" for i, k in enumerate(fields))
        await con.execute(  # noqa: S608 — fixed whitelist keys
            f"update tenants set {sets}, updated_at = now() where slug = $1",
            slug, *fields.values())
    await sup_session.audit(actor, slug, ip, "company.edit",
                            detail={"after": fields, "via": "copilot"})
    return {"ok": True, **fields}


async def _run_draft_chase(slug: str, actor: str, ip: str, args: dict) -> dict:
    """Accepting a Reclamar sends the reminder AS ROCOTO on the customer's thread. The text was
    drafted from the ledger; the amount is RE-DERIVED here at accept time — a debt settled
    between draft and accept must kill the send, not dun a customer who already paid."""
    import actions
    import credit
    import tenancy
    phone = str(args.get("phone") or "")
    fresh = await credit.chase_text(slug, phone)   # raises when nothing is owed any more
    scope = tenancy.scope_of(phone, slug)
    sid = await actions.send_whatsapp_as_rocoto(scope, fresh["text"])
    await sup_session.audit(actor, slug, ip, "chase.send", target_id=phone[-4:],
                            detail={"cents": fresh["cents"], "sid": bool(sid), "via": "copilot"})
    return {"sent": bool(sid), "text": fresh["text"], "cents": fresh["cents"]}


# ── the read verbs ───────────────────────────────────────────────────────────────────────────
async def _read_behaviour(slug: str, args: dict) -> dict:
    import behaviour
    return {"s": await behaviour.get(slug)}


async def _read_products(slug: str, args: dict) -> dict:
    from brain import entitlement
    return {"products": await entitlement.all_states(slug)}


async def _read_company(slug: str, args: dict) -> dict:
    from brain import range as brain_range
    async with db.get_pool().acquire() as con:
        t = await con.fetchrow(
            "select name, address, city from tenants where slug=$1", slug)
        rng = await brain_range.get_range(con, slug)
    return {"name": t and t["name"], "address": t and t["address"], "city": t and t["city"],
            "range_km": rng.get("range_km"), "range_set": rng.get("set")}


async def _read_day(slug: str, args: dict) -> dict:
    import app as _app
    held = [it for it in await _app.review_sheet_for_tenant(slug)
            if it.get("review_source") != "aviso"]
    return {"held": [{"party": h.get("party"), "why": h.get("why")} for h in held[:10]],
            "held_count": len(held)}


async def _read_catalogue(slug: str, args: dict) -> dict:
    async with db.get_pool().acquire() as con:
        rows = await con.fetch(
            "select family, count(*) as n from catalogue_skus "
            "where tenant_id=$1 and in_assortment group by 1 order by 2 desc", slug)
        total = await con.fetchval(
            "select count(*) from catalogue_skus where tenant_id=$1 and in_assortment", slug)
    return {"total": int(total or 0), "families": {r["family"]: int(r["n"]) for r in rows}}


async def _read_customer(slug: str, args: dict) -> dict:
    phone = str(args.get("phone") or "")
    async with db.get_pool().acquire() as con:
        r = await con.fetchrow(
            "select phone_number, display_name, cadence_days from customer_profiles "
            "where tenant_id=$1 and (phone_number=$2 or display_name ilike $3) limit 1",
            slug, phone, f"%{phone}%")
        if not r:
            return {"found": False}
        prices = await con.fetch(
            "select sku_id, price, only_his_list from customer_sku_prices "
            "where tenant_id=$1 and phone_number=$2", slug, r["phone_number"])
    return {"found": True, "phone": r["phone_number"], "name": r["display_name"],
            "own_prices": [{"sku_id": p["sku_id"],
                            "price": float(p["price"]) if p["price"] is not None else None,
                            "only_his_list": p["only_his_list"]} for p in prices]}



# ── §17.47b.4 · AN ADDRESS IS A PURPOSE — minted by DESCRIBING it (Peter, 2026-08-07) ─────────
async def _run_create_inbound_address(slug: str, actor: str, ip: str, args: dict) -> dict:
    import re as _re

    import mail_inbound
    purpose = _re.sub(r"[^a-z0-9-]", "", str(args.get("purpose") or "").lower().strip())[:24]
    if len(purpose) < 3:
        raise ValueError("El nombre de la dirección necesita al menos 3 letras (a-z, números o guiones).")
    if purpose in mail_inbound.PURPOSES:
        raise ValueError(f"«{purpose}» ya es una dirección de serie — no hace falta crearla.")
    label = str(args.get("label") or purpose).strip()[:80]
    recipe = str(args.get("recipe") or "").strip()[:1000]
    if not recipe:
        raise ValueError("Dime qué debe pasar con lo que llegue ahí — sin receta la dirección no sabe nada.")
    async with db.get_pool().acquire() as con:
        await con.execute(
            "insert into inbound_purpose(tenant_slug, purpose, label, recipe, created_by) "
            "values($1,$2,$3,$4,$5) on conflict (tenant_slug, purpose) do update set "
            "label=excluded.label, recipe=excluded.recipe",
            slug, purpose, label, recipe, actor)
    await sup_session.audit(actor, slug, ip, "inbound.address.create", target_id=purpose,
                            detail={"label": label, "via": "copilot"})
    return {"address": f"{purpose}.{slug}@{mail_inbound.INBOUND_DOMAIN}", "purpose": purpose}


async def _run_delete_inbound_address(slug: str, actor: str, ip: str, args: dict) -> dict:
    import mail_inbound
    purpose = str(args.get("purpose") or "").lower().strip()
    if purpose in mail_inbound.PURPOSES:
        raise ValueError("Esa dirección es de serie — no se puede quitar.")
    async with db.get_pool().acquire() as con:
        gone = await con.execute(
            "delete from inbound_purpose where tenant_slug=$1 and purpose=$2", slug, purpose)
    await sup_session.audit(actor, slug, ip, "inbound.address.delete", target_id=purpose,
                            detail={"via": "copilot"})
    return {"removed": gone.endswith("1")}


# ── §17.36 · the scheduled sends the panel builds in its wizard ───────────────────────────────
async def _run_create_scheduled_send(slug: str, actor: str, ip: str, args: dict) -> dict:
    import dispatch_sched
    out = await dispatch_sched.create(
        slug, name=str(args.get("name") or ""),
        purpose=str(args.get("purpose") or "otro"),
        format_id=str(args.get("format_id") or "standard"),
        cadence={"at": str(args.get("at") or ""), "days": args.get("days")},
        categories=[str(c) for c in (args.get("categories") or [])],
        recipients=[str(r) for r in (args.get("recipients") or [])],
        external=bool(args.get("external")),
        consent_by=actor if args.get("external") else None,
        created_by=actor)
    await sup_session.audit(actor, slug, ip, "sends.create", target_id=str(out.get("id") or ""),
                            detail={"purpose": args.get("purpose"), "via": "copilot"})
    return out


async def _run_set_scheduled_send(slug: str, actor: str, ip: str, args: dict) -> dict:
    """Pause / resume / delete a rule — the row-level verbs the /sends page shows."""
    import dispatch_sched
    sid = int(args.get("id") or 0)
    if str(args.get("action")) == "delete":
        await dispatch_sched.delete(slug, sid)
        await sup_session.audit(actor, slug, ip, "sends.delete", target_id=str(sid),
                                detail={"via": "copilot"})
        return {"deleted": sid}
    on = str(args.get("action")) == "resume"
    await dispatch_sched.set_enabled(slug, sid, on)
    await sup_session.audit(actor, slug, ip, "sends.enabled", target_id=str(sid),
                            detail={"enabled": on, "via": "copilot"})
    return {"id": sid, "enabled": on}


# ── §17.31 · the printed paper's options, per tenant ─────────────────────────────────────────
async def _run_set_doc_prefs(slug: str, actor: str, ip: str, args: dict) -> dict:
    opts = {k: bool(v) for k, v in (args or {}).items() if k in ("lot", "tick", "price", "sig")}
    if not opts:
        raise ValueError("Dime qué opción del papel cambiar (lote, casilla, precios o firma).")
    async with db.get_pool().acquire() as con:
        await con.execute(
            "insert into doc_prefs(tenant_slug, opts, updated_at) values($1,$2::jsonb, now()) "
            "on conflict (tenant_slug) do update set opts = doc_prefs.opts || excluded.opts, "
            "updated_at = now()", slug, opts)
    await sup_session.audit(actor, slug, ip, "docs.prefs", detail={**opts, "via": "copilot"})
    return {"opts": opts}


# ── §17.33 · who works here ──────────────────────────────────────────────────────────────────
async def _run_invite_person(slug: str, actor: str, ip: str, args: dict) -> dict:
    from brain import invitations
    email = str(args.get("email") or "").strip().lower()
    async with db.get_pool().acquire() as con:
        already = await con.fetchval(
            "select 1 from team_members tm join operators o on o.id = tm.operator_id "
            "where tm.tenant_slug=$1 and lower(o.email)=$2", slug, email)
    if already:
        raise ValueError("Esa persona ya está en tu equipo — no necesita invitación.")
    inv = await invitations.create(slug, email, str(args.get("role") or "staff"), invited_by=actor)
    await sup_session.audit(actor, slug, ip, "invitation.create", target_id=inv["email"],
                            detail={"role": inv["role"], "via": "copilot"})
    return {"email": inv["email"], "role": inv["role"],
            "link": f"https://app.soyrocoto.com/invite/{inv['token']}"}


# ── the customer's own fields the ficha edits ────────────────────────────────────────────────
async def _run_set_erp_code(slug: str, actor: str, ip: str, args: dict) -> dict:
    from identity_phone import canon as _canon
    phone = _canon(str(args.get("phone") or ""))
    code = str(args.get("code") or "").strip()[:40]
    async with db.get_pool().acquire() as con:
        known = await con.fetchval(
            "select 1 from customer_profiles where tenant_id=$1 and phone_number=$2", slug, phone)
        if not known:
            raise ValueError("Ese cliente no está en tu lista.")
        await con.execute(
            "update customer_profiles set erp_client_code=$3, updated_at=now() "
            "where tenant_id=$1 and phone_number=$2", slug, phone, code or None)
    await sup_session.audit(actor, slug, ip, "customer.erp_code", target_id=phone[-4:],
                            detail={"code": code, "via": "copilot"})
    return {"phone": phone, "erp_client_code": code}


# ── §17.28 · make it forget something it learned ─────────────────────────────────────────────
async def _run_forget_fact(slug: str, actor: str, ip: str, args: dict) -> dict:
    """OLVIDAR, exactly as the memory page does it (sup_api.sup_brain_forget): an alias row is
    deleted, a fact is INVALIDATED (invalid_at) so «it will not be relearned» stays true."""
    ref = str(args.get("ref") or "")
    kind, _, sid = ref.partition(":")
    if kind not in ("alias", "fact") or not sid.isdigit():
        raise ValueError("Eso no es algo que pueda olvidar — necesito su referencia (alias:N o fact:N).")
    if kind == "alias":
        async with db.get_pool().acquire() as con:
            row = await con.fetchrow(
                "delete from sku_aliases where id = $1 and tenant_id = $2 "
                "and source <> all($3::text[]) returning sku_id, source",
                int(sid), slug, list(_MACHINE_ALIAS_SOURCES))
        if not row:
            raise ValueError("Eso ya no está en su memoria.")
        detail = {"what": "alias", "sku_id": row["sku_id"]}
    else:
        async with db.control_pool().acquire() as con:
            row = await con.fetchrow(
                "update fact f set invalid_at = now() from scope_node n "
                "where f.id = $1 and n.scope = f.scope and n.tenant_slug = $2 "
                "and f.invalid_at is null returning f.kind", int(sid), slug)
        if not row:
            raise ValueError("Eso ya no está en su memoria.")
        detail = {"what": "fact", "kind": row["kind"]}
    await sup_session.audit(actor, slug, ip, "brain.forget", target_id=ref,
                            detail={**detail, "via": "copilot"})
    return {"forgotten": ref}



async def _read_sends(slug: str, args: dict) -> dict:
    import dispatch_sched
    rows = await dispatch_sched.list_for(slug)
    return {"sends": [{"id": r.get("id"), "name": r.get("name"), "purpose": r.get("purpose"),
                       "at": (r.get("cadence") or {}).get("at"),
                       "days": (r.get("cadence") or {}).get("days"),
                       "recipients": r.get("recipients"), "enabled": r.get("enabled")}
                      for r in rows]}


async def _read_inbound(slug: str, args: dict) -> dict:
    """§17.47b — the addresses this tenant has, built-in and minted, plus what arrived lately."""
    import mail_inbound
    async with db.get_pool().acquire() as con:
        minted = await con.fetch(
            "select purpose, label, recipe from inbound_purpose where tenant_slug=$1 "
            "order by purpose", slug)
        recent = await con.fetch(
            "select purpose, from_addr, subject, received_at from inbound_mail "
            "where tenant_id=$1 order by received_at desc limit 10", slug)
    dom = mail_inbound.INBOUND_DOMAIN
    return {
        "addresses": (
            [{"purpose": p, "address": f"{p}.{slug}@{dom}", "label": p, "built_in": True}
             for p in mail_inbound.PURPOSES]
            + [{"purpose": r["purpose"], "address": f"{r['purpose']}.{slug}@{dom}",
                "label": r["label"], "recipe": r["recipe"], "built_in": False} for r in minted]),
        "recent": [{"purpose": r["purpose"], "from": r["from_addr"], "subject": r["subject"],
                    "when": r["received_at"].isoformat() if r["received_at"] else None}
                   for r in recent],
    }


async def _read_team(slug: str, args: dict) -> dict:
    async with db.get_pool().acquire() as con:
        rows = await con.fetch(
            "select o.name, o.email, tm.role from team_members tm join operators o "
            "on o.id = tm.operator_id where tm.tenant_slug=$1 order by tm.role", slug)
    return {"team": [{"name": r["name"], "email": r["email"], "role": r["role"]} for r in rows]}


async def _read_doc_prefs(slug: str, args: dict) -> dict:
    async with db.get_pool().acquire() as con:
        r = await con.fetchrow("select opts from doc_prefs where tenant_slug=$1", slug)
    raw = r["opts"] if r else {}
    if isinstance(raw, str):
        try:
            raw = json.loads(raw or "{}")
        except Exception:
            raw = {}
    return {"opts": dict(raw) if isinstance(raw, dict) else {}}



async def _run_revoke_invitation(slug: str, actor: str, ip: str, args: dict) -> dict:
    from brain import invitations
    email = str(args.get("email") or "").strip().lower()
    async with db.get_pool().acquire() as con:
        tok = await con.fetchval(
            "select token from invitation where tenant_slug=$1 and lower(email)=$2 "
            "and accepted_at is null and revoked_at is null", slug, email)
    ok = bool(tok) and await invitations.revoke(tok)
    if not ok:
        raise ValueError("No hay ninguna invitación viva para ese correo.")
    await sup_session.audit(actor, slug, ip, "invitation.revoke", target_id=email,
                            detail={"via": "copilot"})
    return {"revoked": email}


async def _run_add_customer_note(slug: str, actor: str, ip: str, args: dict) -> dict:
    """«NOTA PARA EL REPARTIDOR» — surfaces on that customer's NEXT stop and nowhere else."""
    import avisos
    from identity_phone import canon as _canon
    phone = _canon(str(args.get("phone") or ""))
    body = str(args.get("body") or "").strip()[:500]
    if not body:
        raise ValueError("Dime qué apuntar para ese cliente.")
    from brain import teams as brain_teams
    async with db.get_pool().acquire() as con:
        known = await con.fetchval(
            "select 1 from customer_profiles where tenant_id=$1 and phone_number=$2", slug, phone)
        if not known:
            raise ValueError("Ese cliente no está en tu lista.")
        by = await brain_teams.operator_id_for(con, slug, actor)
        aviso = await avisos.write_nota(con, slug, phone, body,
                                        audience=avisos.REPARTIDOR,
                                        band=str(args.get("band") or "nota"), by=by)
    await sup_session.audit(actor, slug, ip, "customer.nota", target_id=phone[-4:],
                            detail={"chars": len(body), "via": "copilot"})
    return {"ok": True, "aviso": aviso}


# ── THE REGISTRY ─────────────────────────────────────────────────────────────────────────────
# kind='change' verbs carry `run` (executed on ACCEPT, never by the loop) + `cap` (checked
# against the ACCEPTOR, §17.34) + `summary` (the es-ES sentence the draft card shows).
# kind='read' verbs carry `read` and run inline under the session's read cap.
Verb = Dict[str, Any]

REGISTRY: Dict[str, Verb] = {
    "set_behaviour": {
        "kind": "change", "cap": "admin:rocoto", "run": _run_set_behaviour,
        # §17.56 widened S: doubts gained `amount`, offsku gained `reject`, and `confirm` is a new
        # key — the copilot inherits them the moment the kernel does (values are validated by
        # behaviour.set_keys, so only the KEY enum lives here and only it needed extending).
        "desc": "Cambia un ajuste de comportamiento de Rocoto (S). key ∈ doubts|offsku|voice|scope|confirm.",
        "schema": {"type": "object", "properties": {
            "key": {"type": "string", "enum": ["doubts", "offsku", "voice", "scope", "confirm"]},
            "value": {"type": "string"}}, "required": ["key", "value"]},
        "summary": lambda a: f"Cambiar cómo actúa: «{a.get('key')}» → «{a.get('value')}»",
    },
    "set_customer_price": {
        "kind": "change", "cap": "admin:rocoto", "run": _run_set_customer_price,
        "desc": "Pone un precio propio a un artículo para un cliente (§17.45). price null = su lista a tu tarifa.",
        "schema": {"type": "object", "properties": {
            "phone": {"type": "string"}, "sku_id": {"type": "string"},
            "price": {"type": ["number", "null"]}}, "required": ["phone", "sku_id"]},
        "summary": lambda a: (f"Precio propio: {a.get('sku_id')} a "
                              f"{a.get('price') if a.get('price') is not None else 'su tarifa'} "
                              f"para {a.get('phone')}"),
    },
    "set_range": {
        "kind": "change", "cap": "admin", "run": _run_set_range,
        "desc": "Cambia el radio de reparto en kilómetros desde la nave.",
        "schema": {"type": "object", "properties": {"range_km": {"type": "number"}},
                   "required": ["range_km"]},
        "summary": lambda a: f"Radio de reparto → {a.get('range_km')} km",
    },
    "toggle_product": {
        "kind": "change", "cap": "admin:negocio", "run": _run_toggle_product,
        "desc": "Enciende o apaga un módulo (reparto|cobros|inventario|inteligencia|facturas). Encenderlo se suma a la suscripción.",
        "schema": {"type": "object", "properties": {
            "product": {"type": "string", "enum": ["reparto", "cobros", "inventario", "inteligencia", "facturas"]},
            "on": {"type": "boolean"}}, "required": ["product", "on"]},
        "summary": lambda a: f"{'Encender' if a.get('on') else 'Apagar'} el módulo {a.get('product')}",
    },
    "set_aviso_routing": {
        "kind": "change", "cap": "admin:rocoto", "run": _run_set_aviso_routing,
        "desc": "Cambia por qué vías llega un aviso (revision|duda|canal_caido|pedido_nuevo).",
        "schema": {"type": "object", "properties": {
            "moment": {"type": "string", "enum": ["revision", "duda", "canal_caido", "pedido_nuevo"]},
            "rail_app": {"type": "boolean"}, "rail_wa": {"type": "boolean"},
            "rail_email": {"type": "boolean"}}, "required": ["moment"]},
        "summary": lambda a: (f"Avisos de «{a.get('moment')}» → "
                              + (", ".join(n for n, k in (("app", "rail_app"), ("WhatsApp", "rail_wa"),
                                                          ("email", "rail_email")) if a.get(k)) or "ninguna vía")),
    },
    "edit_company": {
        "kind": "change", "cap": "admin:negocio", "run": _run_edit_company,
        "desc": "Edita el nombre, la dirección o la ciudad del negocio (solo texto).",
        "schema": {"type": "object", "properties": {
            "name": {"type": "string"}, "address": {"type": "string"}, "city": {"type": "string"}}},
        "summary": lambda a: "Editar la ficha del negocio: " + ", ".join(
            f"{k}=«{v}»" for k, v in a.items() if isinstance(v, str) and v.strip()),
    },
    "draft_chase": {
        "kind": "change", "cap": "act", "run": _run_draft_chase,
        "desc": "Redacta un recordatorio de cobro para un cliente que debe — el importe sale del "
                "libro, nunca se teclea. Al aceptarse, se envía como Rocoto.",
        "schema": {"type": "object", "properties": {
            "phone": {"type": "string"}, "text": {"type": "string"},
            "cents": {"type": "integer"}}, "required": ["phone"]},
        "summary": lambda a: (f"Reclamar a {a.get('phone')}: "
                              f"{(a.get('cents') or 0) / 100:.2f} € pendientes"),
    },
    # ── reads ──
    # ── §17.47b.4 · «una dirección donde mi gestor mande las nóminas» ──────────────────────
    "create_inbound_address": {
        "kind": "change", "cap": "admin:rocoto", "run": _run_create_inbound_address,
        "desc": ("Crea una dirección de correo de entrada nueva para un propósito que el "
                 "supplier describe («nóminas», «albaranes del transportista»). La dirección "
                 "es <propósito>.<slug>@in.soyrocoto.com y la receta dice qué hacer con lo que "
                 "llegue. NO sirve para pedidos ni facturas — esas ya existen de serie."),
        "schema": {"type": "object", "properties": {
            "purpose": {"type": "string", "description": "el prefijo, a-z 0-9 y guiones, p. ej. «nominas»"},
            "label": {"type": "string", "description": "cómo lo llama el supplier"},
            "recipe": {"type": "string", "description": "qué debe pasar con lo que llegue, en sus palabras"}},
            "required": ["purpose", "recipe"]},
        "summary": lambda a: (f"Crear la dirección {a.get('purpose')}.<tu-empresa>@in.soyrocoto.com "
                              f"— {str(a.get('recipe') or '')[:80]}"),
    },
    "delete_inbound_address": {
        "kind": "change", "cap": "admin:rocoto", "run": _run_delete_inbound_address,
        "desc": "Quita una dirección de entrada que se creó a medida (las de serie no se tocan).",
        "schema": {"type": "object", "properties": {"purpose": {"type": "string"}},
                   "required": ["purpose"]},
        "summary": lambda a: f"Quitar la dirección «{a.get('purpose')}»",
    },
    # ── §17.36 · los envíos programados ────────────────────────────────────────────────────
    "create_scheduled_send": {
        "kind": "change", "cap": "admin:rocoto", "run": _run_create_scheduled_send,
        "desc": ("Crea un correo programado: propósito (compras|direccion|almacen|facturacion|"
                 "incidencias|otro), formato (standard|flat|sage50|totales), hora HH:MM, días "
                 "1-7 (vacío = cada día), destinatarios. external=true si sale fuera del equipo."),
        "schema": {"type": "object", "properties": {
            "name": {"type": "string"}, "purpose": {"type": "string"},
            "format_id": {"type": "string"}, "at": {"type": "string"},
            "days": {"type": "array", "items": {"type": "integer"}},
            "categories": {"type": "array", "items": {"type": "string"}},
            "recipients": {"type": "array", "items": {"type": "string"}},
            "external": {"type": "boolean"}},
            "required": ["name", "purpose", "at", "recipients"]},
        "summary": lambda a: (f"Envío «{a.get('name')}» ({a.get('purpose')}) a las {a.get('at')} "
                              f"→ {', '.join(a.get('recipients') or [])}"),
    },
    "set_scheduled_send": {
        "kind": "change", "cap": "admin:rocoto", "run": _run_set_scheduled_send,
        "desc": "Pausa, reanuda o borra un correo programado por su id.",
        "schema": {"type": "object", "properties": {
            "id": {"type": "integer"},
            "action": {"type": "string", "enum": ["pause", "resume", "delete"]}},
            "required": ["id", "action"]},
        "summary": lambda a: f"{ {'pause': 'Pausar', 'resume': 'Reanudar', 'delete': 'Borrar'}.get(str(a.get('action')), '?') } el envío #{a.get('id')}",
    },
    # ── §17.31 · el papel ──────────────────────────────────────────────────────────────────
    "set_doc_prefs": {
        "kind": "change", "cap": "admin:rocoto", "run": _run_set_doc_prefs,
        "desc": ("Cambia las opciones del papel: lot (columna de lote), tick (casilla por línea), "
                 "price (precios en el albarán), sig (línea de firma)."),
        "schema": {"type": "object", "properties": {
            "lot": {"type": "boolean"}, "tick": {"type": "boolean"},
            "price": {"type": "boolean"}, "sig": {"type": "boolean"}}},
        "summary": lambda a: ("Papel: " + ", ".join(
            f"{k}={'sí' if v else 'no'}" for k, v in (a or {}).items() if k in ("lot", "tick", "price", "sig"))),
    },
    # ── §17.33 · quién trabaja contigo ─────────────────────────────────────────────────────
    "invite_person": {
        "kind": "change", "cap": "admin:negocio", "run": _run_invite_person,
        "desc": "Invita a alguien a tu Rocoto por correo (role: owner|staff|repartidor).",
        "schema": {"type": "object", "properties": {
            "email": {"type": "string"},
            "role": {"type": "string", "enum": ["owner", "staff", "repartidor"]}},
            "required": ["email"]},
        "summary": lambda a: f"Invitar a {a.get('email')} como {a.get('role') or 'staff'}",
    },
    # ── la ficha del cliente ───────────────────────────────────────────────────────────────
    "set_erp_code": {
        "kind": "change", "cap": "act", "run": _run_set_erp_code,
        "desc": "Pone (o borra, con code vacío) el código de un cliente en tu programa de gestión.",
        "schema": {"type": "object", "properties": {
            "phone": {"type": "string"}, "code": {"type": "string"}},
            "required": ["phone"]},
        "summary": lambda a: f"Código ERP de {a.get('phone')} → «{a.get('code') or '—'}»",
    },
    # ── §17.28 · olvidar ───────────────────────────────────────────────────────────────────
    "forget_fact": {
        "kind": "change", "cap": "admin:rocoto", "run": _run_forget_fact,
        "desc": ("Hace que Rocoto olvide un dato aprendido. ref viene de «Lo que sabe»: "
                 "«alias:N» (un mote) o «fact:N» (un dato). Un dato se invalida, no se borra."),
        "schema": {"type": "object", "properties": {"ref": {"type": "string"}},
                   "required": ["ref"]},
        "summary": lambda a: f"Olvidar «{a.get('ref')}»",
    },
    # ── reads ──────────────────────────────────────────────────────────────────────────────
    "revoke_invitation": {
        "kind": "change", "cap": "admin:negocio", "run": _run_revoke_invitation,
        "desc": "Mata una invitación viva por correo (el enlace deja de valer al instante).",
        "schema": {"type": "object", "properties": {"email": {"type": "string"}},
                   "required": ["email"]},
        "summary": lambda a: f"Revocar la invitación de {a.get('email')}",
    },
    "add_customer_note": {
        "kind": "change", "cap": "act", "run": _run_add_customer_note,
        "desc": ("Apunta una nota para un cliente — sale en su PRÓXIMA parada de reparto y en "
                 "ningún otro sitio. No es un mensaje al cliente."),
        "schema": {"type": "object", "properties": {
            "phone": {"type": "string"}, "body": {"type": "string"}},
            "required": ["phone", "body"]},
        "summary": lambda a: f"Nota para {a.get('phone')}: «{str(a.get('body') or '')[:60]}»",
    },
    "read_sends": {"kind": "read", "read": _read_sends,
                   "desc": "Lee los correos programados y su próxima salida.",
                   "schema": {"type": "object", "properties": {}}},
    "read_inbound": {"kind": "read", "read": _read_inbound,
                     "desc": "Lee las direcciones de entrada (de serie y a medida) y lo último que llegó.",
                     "schema": {"type": "object", "properties": {}}},
    "read_team": {"kind": "read", "read": _read_team,
                  "desc": "Lee quién trabaja contigo y con qué papel.",
                  "schema": {"type": "object", "properties": {}}},
    "read_doc_prefs": {"kind": "read", "read": _read_doc_prefs,
                       "desc": "Lee las opciones del papel guardadas.",
                       "schema": {"type": "object", "properties": {}}},
    "read_behaviour": {"kind": "read", "read": _read_behaviour,
                       "desc": "Lee los ajustes de comportamiento (S) actuales.",
                       "schema": {"type": "object", "properties": {}}},
    "read_products": {"kind": "read", "read": _read_products,
                      "desc": "Lee qué módulos están encendidos.",
                      "schema": {"type": "object", "properties": {}}},
    "read_company": {"kind": "read", "read": _read_company,
                     "desc": "Lee la ficha del negocio y el radio de reparto.",
                     "schema": {"type": "object", "properties": {}}},
    "read_day": {"kind": "read", "read": _read_day,
                 "desc": "Lee qué está retenido esperando al humano ahora mismo.",
                 "schema": {"type": "object", "properties": {}}},
    "read_catalogue": {"kind": "read", "read": _read_catalogue,
                       "desc": "Lee el tamaño del catálogo y sus familias.",
                       "schema": {"type": "object", "properties": {}}},
    "read_customer": {"kind": "read", "read": _read_customer,
                      "desc": "Busca un cliente por teléfono o nombre y lee sus precios propios.",
                      "schema": {"type": "object", "properties": {"phone": {"type": "string"}},
                                 "required": ["phone"]}},
}


def anthropic_tools() -> list[dict]:
    """The registry as the Claude API's tool list — one source, rendered."""
    return [{"name": name, "description": v["desc"], "input_schema": v["schema"]}
            for name, v in REGISTRY.items()]


def summary_of(verb: str, args: dict) -> str:
    v = REGISTRY.get(verb)
    try:
        return v["summary"](args) if v and "summary" in v else verb
    except Exception:
        return verb


# ── the draft store (§17.48b: staged by any frontend, accepted in the panel) ─────────────────
async def stage_draft(slug: str, verb: str, args: dict, created_by: str) -> dict:
    async with db.get_pool().acquire() as con:
        row = await con.fetchrow(
            "insert into config_draft(tenant_id, verb, args, summary, created_by) "
            "values($1,$2,$3,$4,$5) returning id, created_at",
            slug, verb, json.dumps(args), summary_of(verb, args), created_by)
    return {"id": int(row["id"]), "verb": verb, "args": args,
            "summary": summary_of(verb, args), "created_at": row["created_at"].isoformat()}


async def pending_drafts(slug: str) -> list[dict]:
    async with db.get_pool().acquire() as con:
        rows = await con.fetch(
            "select id, verb, args, summary, created_by, created_at from config_draft "
            "where tenant_id=$1 and state='pending' order by id desc limit 20", slug)
    out = []
    for r in rows:
        args = r["args"]
        if isinstance(args, str):
            try:
                args = json.loads(args)
            except ValueError:
                args = {}
        out.append({"id": int(r["id"]), "verb": r["verb"], "args": args,
                    "summary": r["summary"], "created_by": r["created_by"],
                    "created_at": r["created_at"].isoformat()})
    return out


async def decide_draft(slug: str, draft_id: int, accept: bool, actor: str, ip: str,
                       caps: list[str]) -> dict:
    """Accept (run under the ACCEPTOR's caps) or reject. Either way the row keeps its history."""
    async with db.get_pool().acquire() as con:
        row = await con.fetchrow(
            "select id, verb, args, state from config_draft where tenant_id=$1 and id=$2",
            slug, draft_id)
    if not row or row["state"] != "pending":
        raise LookupError("Ese borrador ya no está pendiente.")
    verb = REGISTRY.get(row["verb"])
    if not verb or verb["kind"] != "change":
        raise LookupError("Ese borrador no es de un verbo conocido.")
    args = row["args"]
    if isinstance(args, str):
        try:
            args = json.loads(args)
        except ValueError:
            args = {}
    if accept:
        # exact membership, the ROLE_CAPS way — no implication chain to reason about
        need = verb["cap"]
        if need not in caps:
            raise PermissionError(f"Aceptar esto necesita el permiso {need}.")
        result = await verb["run"](slug, actor, ip, args)
        state = "accepted"
    else:
        result = None
        state = "rejected"
    async with db.get_pool().acquire() as con:
        await con.execute(
            "update config_draft set state=$3, decided_by=$4, decided_at=now() "
            "where tenant_id=$1 and id=$2", slug, draft_id, state, actor)
    return {"id": draft_id, "state": state, "result": result}
