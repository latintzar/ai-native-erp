"""portal.py — THE CUSTOMER'S OWN DOOR (SPEC §5.9).

Peter, 2026-07-27: *"the confirmation links should properly work bro… should be real links on the
soyrocoto domain, which should be showing their order history and let them reorder, which sends us
the order and the rocoto writes to them to confirm as if they had sent a message on whatsapp."*

The party here is the DISTRIBUTOR'S CUSTOMER — a restaurant — not the distributor. They open one
link and see the orders they have placed with THIS distributor, and they can send another one.
Three things make it honest, and each is a hard contract in this file:

  ① IDENTITY IS A ROW, NOT A CLAIM. The link carries an opaque 256-bit token that resolves to
    exactly one `(tenant_id, phone_number)` pair — the key of `customer_profiles`. NOTHING on the
    wire ever names a customer, a tenant or a phone: every read and every write is bounded by what
    the ROW said, so a cross-tenant or cross-customer read is not expressible, not merely refused.
    The idiom is `brain/onboarding.mint_token`'s, deliberately reused rather than reinvented:
    `secrets.token_urlsafe` → a table row with `status` → a NON-LEAKING lookup that answers None
    identically for unknown / revoked / expired. (§5.9.1 has the expiry + rotation story.)

  ② THE REORDER IS A REAL ORDER, ON THE REAL RAIL. It lands through `brain/events.create_order` +
    `finalize_order` — the same two calls `brain/pipeline._build_order` ends with — at
    `status='needs_review'`, and then through the SAME review decision (`pipeline.order_checks` →
    `pipeline.park_decision` → `review.hold_for_review`). The comercial still decides; §0 gated
    agency is untouched. What the portal does NOT do is re-extract: there is nothing to extract.
    Every line the customer may pick comes from an order THEY ALREADY PLACED, so it is already
    grounded to a `catalogue_skus` row. Running it back through the matcher could only make it
    worse — it could resolve to a DIFFERENT sku than the one they pointed at. So the wire carries a
    `sku_id` and a qty and nothing else, the sku is checked against THIS customer's own history and
    THIS tenant's catalogue, and name/code/unit/price are read from the catalogue row. A sku that
    is not in their history, or has left the assortment, is REFUSED BY NAME — never guessed
    (§4.3 grounding: abstain, don't guess).

  ③ ROCOTO WRITES TO THEM, AND THE TONE LAW HOLDS. After the order lands, the outbound rail
    (`actions.send_whatsapp_as_rocoto` → the gate → sombra → Meta Cloud) carries the §5.8a
    acknowledgement: «recibido — déjame que lo confirme y te digo enseguida». The customer has been
    ACKNOWLEDGED, never CONFIRMED. No «listo», no «apuntado», no «anotado», no «confirmado» — the
    banned set is asserted in code below (`_TONE_BANNED`) and in `tests/vital_portal.py`, because a
    tone law that lives only in prose is one hurried edit from being broken.

WHAT THIS FILE IS NOT. It is not a shop: no prices are negotiated, no payment is taken, nothing is
promised. It is not a second intake brain: it owns no matcher, no extraction, no LLM call. It is a
door onto rows that already exist.

es-ES is canonical on every customer-facing string here (LOCKED LAW).
"""
from __future__ import annotations

import logging
import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import config
import db

log = logging.getLogger("rocoto.portal")

# ── §5.9.1 THE EXPIRY + ROTATION STORY (written down, as required) ───────────────────────────────
# A leaked link exposes ONE restaurant's own order history to whoever holds it. It exposes no other
# customer, no other tenant, no prices beyond that customer's own, and it can place nothing that a
# human does not then approve. So the risk is real but bounded, and the answer is bounded too:
#
#   · ENTROPY — `secrets.token_urlsafe(32)` = 256 bits. Not guessable, not enumerable; there is no
#     sequential id anywhere in the URL and no route that lists tokens.
#   · SLIDING EXPIRY — a link dies PORTAL_TTL_DAYS after its last USE, not after it was minted. A
#     restaurant that orders every week keeps the same bookmark forever; a link that fell out of a
#     WhatsApp thread eight months ago is already dead when it is found.
#   · ONE ACTIVE LINK PER CUSTOMER (a partial unique index enforces it). That is what makes the link
#     STABLE — every confirmation message can carry the same URL, and the customer can bookmark it —
#     and it is what makes revocation meaningful: there is one thing to revoke.
#   · ROTATION IS A MINT. `rotate()` revokes the active row and issues a new token in one commit, so
#     "they forwarded the link to someone" has a one-call answer that does not disturb anyone else.
#   · REVOCATION IS A STATUS, NEVER A DELETE — the row stays, so "who had a link, and when did it
#     stop working" is answerable. `resolve()` treats revoked and expired and unknown identically.
#   · NO PII IN THE URL. The token is the whole of it. The page shows a masked phone, and the API
#     never echoes the number back in full.
PORTAL_TTL_DAYS = 120           # sliding: extended on every successful use
PORTAL_HISTORY_LIMIT = 30       # orders shown on the page
PORTAL_HISTORY_DAYS = 365       # how far back a sku may come from and still count as "theirs"
PORTAL_MAX_LINES = 60           # a reorder may not carry more lines than this
PORTAL_MAX_QTY = 100_000        # a positive, finite, non-absurd quantity (too big is REVIEW's job)


_schema_ready = False


async def ensure_schema(con=None) -> None:
    """Verify migration ownership; application requests never alter schema."""
    from schema_migrations import assert_current

    if con is not None:
        await assert_current(con)
        return
    async with db.get_pool().acquire() as connection:
        await assert_current(connection)


def _digits(phone: str) -> str:
    return re.sub(r"[^0-9]", "", phone or "")


def _norm_phone(phone: str) -> str:
    """+E.164 as this product stores it everywhere (`customer_profiles.phone_number`)."""
    d = _digits(phone)
    return ("+" + d) if d else ""


def mask_phone(phone: str) -> str:
    """«···· ··· 101» — enough for the restaurant to recognise their own line, useless to anyone else."""
    d = _digits(phone)
    return ("···· ··· " + d[-3:]) if len(d) >= 3 else "····"


def portal_url(token: str) -> str:
    base = (config.ONBOARD_PUBLIC_BASE_URL or "https://soyrocoto.com").rstrip("/")
    return f"{base}/pedidos/{token}"


# ══ ① IDENTITY ═══════════════════════════════════════════════════════════════════════════════════

async def _tenant_of_customer(con, phone: str) -> str:
    """The tenant this customer belongs to, off their own profile row. Falls back to the configured
    single tenant — never to a guess, and never to a value the caller supplied."""
    t = await con.fetchval("select tenant_id from customer_profiles where phone_number=$1", phone)
    return str(t or config.BRAIN_TENANT)


async def mint(phone: str, *, tenant: Optional[str] = None, seeded: bool = False) -> dict[str, Any]:
    """Issue a FRESH link for this customer, revoking any active one in the same commit.

    Callers: the comercial's surfaces (app / desk / Control Room) and `link_for` below. This is
    deliberately not reachable from the customer side — a door cannot mint its own key."""
    phone = _norm_phone(phone)
    if not phone:
        raise ValueError("portal.mint: falta el teléfono del cliente")
    await ensure_schema()
    token = secrets.token_urlsafe(32)
    pool = db.get_pool()
    async with pool.acquire() as con, con.transaction():
        t = tenant or await _tenant_of_customer(con, phone)
        await con.execute(
            "update portal_tokens set status='revoked' "
            "where tenant_id=$1 and phone_number=$2 and status='active'", t, phone)
        row = await con.fetchrow(
            "insert into portal_tokens (token, tenant_id, phone_number, status, expires_at, seeded) "
            "values ($1,$2,$3,'active', now() + ($4 || ' days')::interval, $5) returning *",
            token, t, phone, str(PORTAL_TTL_DAYS), bool(seeded))
    log.info("portal: minted a link for %s (tenant=%s)", mask_phone(phone), row["tenant_id"])
    return {"token": token, "url": portal_url(token), "tenant_id": row["tenant_id"],
            "expires_at": row["expires_at"].isoformat(), "minted": True}


async def link_for(phone: str, *, tenant: Optional[str] = None,
                   seeded: bool = False) -> dict[str, Any]:
    """THE STABLE LINK for this customer — the live one if there is one, a fresh one otherwise.

    This is what a confirmation message appends, which is why it must be idempotent: sending the
    same customer a different URL every time would make the link un-bookmarkable and would train
    them to distrust it."""
    phone = _norm_phone(phone)
    if not phone:
        raise ValueError("portal.link_for: falta el teléfono del cliente")
    await ensure_schema()
    pool = db.get_pool()
    async with pool.acquire() as con:
        t = tenant or await _tenant_of_customer(con, phone)
        row = await con.fetchrow(
            "select * from portal_tokens where tenant_id=$1 and phone_number=$2 "
            "and status='active' and expires_at > now()", t, phone)
    if row:
        return {"token": row["token"], "url": portal_url(row["token"]),
                "tenant_id": row["tenant_id"], "expires_at": row["expires_at"].isoformat(),
                "minted": False}
    return await mint(phone, tenant=t, seeded=seeded)


async def rotate(phone: str, *, tenant: Optional[str] = None) -> dict[str, Any]:
    """«se lo he reenviado a alguien» — kill the old link and issue a new one, one call."""
    return await mint(phone, tenant=tenant)


async def revoke(phone: str, *, tenant: Optional[str] = None) -> int:
    """Turn this customer's link off. Returns how many rows were revoked (0 or 1)."""
    phone = _norm_phone(phone)
    await ensure_schema()
    pool = db.get_pool()
    async with pool.acquire() as con:
        t = tenant or await _tenant_of_customer(con, phone)
        n = await con.execute(
            "update portal_tokens set status='revoked' "
            "where tenant_id=$1 and phone_number=$2 and status='active'", t, phone)
    try:
        return int(str(n).rsplit(" ", 1)[-1])
    except ValueError:
        return 0


async def resolve(token: str, *, touch: bool = True) -> Optional[dict[str, Any]]:
    """token → {tenant_id, phone_number, expires_at} or None.

    NON-LEAKING BY CONSTRUCTION: unknown, revoked and expired all return None, and every caller
    answers the same 404 for all three — a probe cannot tell "no such link" from "that one is dead",
    so it cannot be used to confirm that a given restaurant is a customer.

    `touch=True` slides the expiry and counts the use, which is what makes a working link immortal
    and an abandoned one mortal (§5.9.1)."""
    token = (token or "").strip()
    # Cheap shape gate before the query: token_urlsafe(32) is 43 chars of [A-Za-z0-9_-].
    if not token or len(token) > 128 or not re.fullmatch(r"[A-Za-z0-9_-]{16,128}", token):
        return None
    await ensure_schema()
    pool = db.get_pool()
    async with pool.acquire() as con:
        row = await con.fetchrow(
            "select * from portal_tokens where token=$1 and status='active' and expires_at > now()",
            token)
        if not row:
            return None
        if touch:
            await con.execute(
                "update portal_tokens set last_used_at=now(), uses=uses+1, "
                "expires_at = now() + ($2 || ' days')::interval where token=$1",
                token, str(PORTAL_TTL_DAYS))
    return {"tenant_id": row["tenant_id"], "phone_number": row["phone_number"],
            "expires_at": row["expires_at"].isoformat()}


# ══ THE READ — their orders, with this distributor ════════════════════════════════════════════════

# es-ES, customer-facing. What the RESTAURANT is allowed to know about the state of their own order,
# and nothing about ours: they never see «needs_review» / «pendiente de que lo mire el comercial»,
# because that is our internal state and telling them would be a diagnosis nobody has confirmed
# (§5.8a, the same reason `review.hold_note` is reason-free).
STATUS_ES: dict[str, str] = {
    "preparing":    "recibido",
    "needs_review": "recibido",
    "approved":     "confirmado",
    "sent":         "en reparto",
    "failed":       "recibido",
    "rejected":     "anulado",
}


def _lines_out(lines: Any) -> list[dict[str, Any]]:
    """The customer-facing shape of a line. Deliberately narrow: what they ordered, how much, and
    what it cost THEM. No sku internals, no confidence band, no candidates, no keep-in-mind — that
    is the distributor's working state and it is not theirs to read."""
    import json
    if isinstance(lines, str):
        try:
            lines = json.loads(lines or "[]")
        except ValueError:
            lines = []
    out: list[dict[str, Any]] = []
    for ln in (lines or []):
        if not isinstance(ln, dict):
            continue
        sku = str(ln.get("sku_id") or "")
        name = str(ln.get("name") or ln.get("item") or ln.get("raw_text") or "").strip()
        if not name:
            continue
        qty = ln.get("qty")
        out.append({
            "sku_id": sku,
            "nombre": name,
            "cantidad": (float(qty) if isinstance(qty, (int, float)) and not isinstance(qty, bool)
                         else None),
            "unidad": str(ln.get("unit") or ""),
            "precio": (float(ln["price"]) if isinstance(ln.get("price"), (int, float))
                       and not isinstance(ln.get("price"), bool) else None),
            "importe": (float(ln["line_total"]) if isinstance(ln.get("line_total"), (int, float))
                        and not isinstance(ln.get("line_total"), bool) else None),
            "peso_variable": bool(ln.get("variable_weight")),
        })
    return out


def _order_total(lines: list[dict[str, Any]]) -> Optional[float]:
    """Only a total we can actually stand behind. A single variable-weight or unpriced line means the
    order has no closed total yet — and a number we made up is a promise nobody made, so it is None
    and the page says «a confirmar» rather than showing a figure the invoice will contradict."""
    if not lines:
        return None
    total = 0.0
    for ln in lines:
        if ln.get("peso_variable") or ln.get("importe") is None:
            return None
        total += float(ln["importe"])
    return round(total, 2)


async def _history_rows(con, phone: str, limit: int = PORTAL_HISTORY_LIMIT) -> list[dict]:
    since = datetime.now(timezone.utc) - timedelta(days=PORTAL_HISTORY_DAYS)
    return list(await con.fetch(
        "select id, status, lines, note, delivery_date, created_at, from_storefront, "
        "card_paid_at, card_invoice_hosted_url "
        "from orders where phone_number=$1 and created_at >= $2 and status <> 'preparing' "
        "order by created_at desc limit $3", phone, since, int(limit)))


async def _catalogue(con, tenant: str, sku_ids: list[str]) -> dict[str, dict]:
    ids = [s for s in dict.fromkeys(sku_ids) if s]
    if not ids:
        return {}
    rows = await con.fetch(
        "select id, code, name, family, base_unit, price::float8 as price, variable_weight, "
        "in_assortment from catalogue_skus where tenant_id=$1 and id = any($2::text[])",
        tenant, ids)
    return {r["id"]: dict(r) for r in rows}


async def view(token: str) -> Optional[dict[str, Any]]:
    """THE PAGE. Everything `/pedidos/{token}` renders, in one read, es-ES.

    Returns None for any token that does not resolve — the route answers ONE 404 for all of them."""
    who = await resolve(token)
    if not who:
        return None
    tenant, phone = who["tenant_id"], who["phone_number"]
    pool = db.get_pool()
    async with pool.acquire() as con:
        prof = await con.fetchrow(
            "select display_name, address, lat, lon, phone_numbers, typical_basket, "
            "delivery_window_from, delivery_window_to, delivery_window_said "
            "from customer_profiles where phone_number=$1 and tenant_id=$2",
            phone, tenant)
        rows = await _history_rows(con, phone)
        # THE REORDER SET IS THEIR OWN HISTORY, nothing wider. A catalogue browser is a different
        # product (and a different conversation with the distributor about what a customer may see).
        hist_lines = [ln for r in rows for ln in _lines_out(r["lines"])]
        cat = await _catalogue(con, tenant, [ln["sku_id"] for ln in hist_lines])
        supplier = (await con.fetchrow("select slug, name from tenants where slug=$1", tenant)
                    if await _has_tenants(con) else None)

    # «lo de siempre» — every sku they have ordered in the window, newest first, with the quantity
    # they last asked for pre-filled. Ordered by recency then frequency: the thing they bought
    # yesterday is the thing they are most likely to buy again.
    seen: dict[str, dict[str, Any]] = {}
    freq: dict[str, int] = {}
    for ln in hist_lines:
        sku = ln["sku_id"]
        if not sku:
            continue
        freq[sku] = freq.get(sku, 0) + 1
        if sku not in seen:
            c = cat.get(sku) or {}
            if not c or not c.get("in_assortment"):
                continue     # gone from the assortment → not offerable. We abstain, we don't guess.
            seen[sku] = {
                "sku_id": sku,
                "nombre": c.get("name") or ln["nombre"],
                "unidad": ln.get("unidad") or c.get("base_unit") or "",
                "precio": (float(c["price"]) if isinstance(c.get("price"), (int, float)) else None),
                "peso_variable": bool(c.get("variable_weight")),
                "cantidad_habitual": ln.get("cantidad"),
                "veces": 0,
            }
    for sku, item in seen.items():
        item["veces"] = freq.get(sku, 0)

    # «en curso» vs. history — SPEC status keys, not the es-ES label: an order not yet dispatched is
    # still being worked (§0 — the comercial decides, nothing here promises a date). This is what lets
    # the portal show a Shopify-style "your order is confirmed" block for what is actually still
    # moving, separately from the settled record beneath it.
    EN_CURSO_KEYS = ("needs_review", "preparing", "approved")

    pedidos = []
    for r in rows:
        lns = _lines_out(r["lines"])
        total = _order_total(lns)
        paid = r["card_paid_at"] is not None
        pedidos.append({
            "id": r["id"],
            "fecha": r["created_at"].date().isoformat(),
            "entrega": r["delivery_date"] or "",
            "estado": STATUS_ES.get(str(r["status"]), "recibido"),
            "estado_clave": str(r["status"]),
            "en_curso": str(r["status"]) in EN_CURSO_KEYS,
            "lineas": lns,
            "total": total,
            "nota": str(r["note"] or ""),
            "pagado_tarjeta": paid,
            # The REAL Stripe factura when one was paid by card (VAT-correct, issued by the
            # distributor's own connected account — brain/order_payment.py); otherwise the plain
            # order-summary PDF this product renders itself (brain/invoice.py) — never both, and the
            # summary PDF is explicit that it is not a tax document. Pay is only offerable while a
            # total exists to charge and nothing has been paid yet.
            "factura_url": (str(r["card_invoice_hosted_url"]) if paid and r["card_invoice_hosted_url"] else ""),
            "documento_url": f"/api/portal/{token}/pedido/{r['id']}.pdf",
            "se_puede_pagar": (not paid) and total is not None and total > 0,
        })

    return {
        "cliente": {
            "nombre": (str(prof["display_name"] or "") if prof else ""),
            "telefono": mask_phone(phone),
            # 2026-07-27: Peter — "the profile of the customer up top (name, address etc)". Blank,
            # never invented, when the distributor has never captured one (`address` defaults to ''
            # at the column, not null) — the same silence-over-a-guess law as every other field here.
            "direccion": (str(prof["address"] or "") if prof else ""),
            "lat": (float(prof["lat"]) if prof and prof["lat"] is not None else None),
            "lon": (float(prof["lon"]) if prof and prof["lon"] is not None else None),
            # `phone_numbers` = linked staff numbers (customer_profiles' own jsonb column) — the
            # PRIMARY number is masked (①'s non-PII law); these are shown the same way, never in full.
            "telefonos_extra": _extra_phones(prof["phone_numbers"] if prof else None),
        },
        "proveedor": {
            "nombre": (str(supplier["name"]) if supplier else ""),
            "slug": tenant,
        },
        "pedidos": pedidos,
        "habituales": list(seen.values()),
        "caduca": who["expires_at"],
    }


def _extra_phones(raw: Any) -> list[str]:
    """`customer_profiles.phone_numbers` → masked display strings. Same non-leaking law as the
    primary number: nothing on this page ever shows a full phone to whoever holds the link."""
    import json
    if isinstance(raw, str):
        try:
            raw = json.loads(raw or "[]")
        except ValueError:
            raw = []
    out = []
    for v in (raw or []):
        num = v.get("number") if isinstance(v, dict) else v
        if isinstance(num, str) and num.strip():
            out.append(mask_phone(num))
    return out


async def _has_tenants(con) -> bool:
    try:
        return bool(await con.fetchval("select to_regclass('public.tenants') is not null"))
    except Exception:
        return False


# ══ ② THE REORDER RAIL ════════════════════════════════════════════════════════════════════════════

# Why a refusal is named and not silent: a line that quietly disappears between the tap and the order
# is the worst outcome here — the restaurant believes it ordered something it did not. Each refusal
# carries an es-ES sentence the page shows next to the line it is about.
REFUSALS_ES: dict[str, str] = {
    "no_es_tuyo":     "no lo has pedido nunca a este proveedor",
    "fuera_de_gama":  "ya no está en el catálogo de tu proveedor",
    "cantidad":       "la cantidad no es válida",
    "desconocido":    "no reconozco este artículo",
}


def _qty(v: Any) -> Optional[float]:
    try:
        q = float(v)
    except (TypeError, ValueError):
        return None
    if not (q > 0) or q != q or q in (float("inf"), float("-inf")) or q > PORTAL_MAX_QTY:
        return None
    return round(q, 3)


def _order_text_es(lines: list[dict[str, Any]]) -> str:
    """The order as a person would have written it — this is what lands in the conversation so the
    comercial reads one thread, not two. It is NOT presented as a WhatsApp message: the row it lands
    on is `message_type='portal'`, because the log must stay true about where a thing came from."""
    parts = []
    for ln in lines:
        q = ln.get("qty")
        qs = (f"{q:g}" if isinstance(q, (int, float)) else "")
        unit = str(ln.get("unit") or "")
        parts.append(" ".join(x for x in (qs, unit, str(ln.get("name") or "")) if x))
    return "\n".join(parts)


# THE TONE LAW, AS CODE (§5.7 / §5.8a). Until the comercial decides, the customer has been
# ACKNOWLEDGED, never CONFIRMED. These words may not appear in anything this module says.
_TONE_BANNED = ("listo", "apuntado", "anotado", "confirmado", "confirmada", "cursado", "hecho está")

ACK_ES = ("Recibido — déjame que lo confirme y te digo enseguida.")


def acknowledgement(n_lines: int, customer_name: str = "") -> str:
    """The §5.8a acknowledgement Rocoto sends back on WhatsApp.

    It states a FACT about what arrived (how many lines) and promises NOTHING about what will
    happen to it. It is short on purpose: a long message about an order nobody has confirmed reads
    as confidence, and confidence is exactly what we do not have yet.

    NO NAME IN IT, deliberately. `customer_name` is accepted (the caller has it, and a future
    per-tenant register may want it) and is NOT used: a Spanish trade name is «Bar Lumbre» / «Café
    Sotillo» / «Mesón Peral», so greeting by its first word produces «Bar, recibido…» — measured on
    the real page, 2026-07-27 — and greeting by the whole name reads like a bank. A supplier
    answering a customer they know does not open with a name at all."""
    del customer_name          # see the docstring: accepted, deliberately unused
    line = f"Recibido tu pedido desde el enlace ({n_lines} línea{'s' if n_lines != 1 else ''}). " \
           "Déjame que lo confirme y te digo enseguida."
    low = line.lower()
    # Fail LOUD rather than send a sentence that breaks the law (one brain, no silent fallbacks).
    for bad in _TONE_BANNED:
        if bad in low:
            raise AssertionError(f"portal.acknowledgement: «{bad}» viola la ley de tono §5.8a")
    return line


async def _order_norm(con, phone: str, lines: list[dict[str, Any]]) -> dict[str, Any]:
    """§5.8a item 1 — is this order far bigger than this customer's own norm? Computed by calling
    `validators.validate_order`, never by copying its rule: there is ONE order-value rule in this
    product. We only have to hand it the shapes it expects (`grounded_lines` + `ctx.recent_orders`)."""
    try:
        from brain import validators
        grounded = [{"mention": ln.get("name") or "", "qty": ln.get("qty"),
                     "price": None,
                     "match": {"pick": {"sku_id": ln.get("sku_id") or "", "price": ln.get("price")}}}
                    for ln in lines]
        rows = await con.fetch(
            "select lines from orders where phone_number=$1 and status <> 'preparing' "
            "order by created_at desc limit 20", phone)
        ctx = {"recent_orders": [{"lines": r["lines"]} for r in rows]}
        return validators.validate_order(grounded, [{} for _ in grounded], ctx)
    except Exception:
        log.exception("portal: order-norm check failed (no claim, fail-soft)")
        return {}


_HHMM = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


def _clean_hhmm(v: Any) -> Optional[str]:
    s = str(v or "").strip()
    return s if _HHMM.fullmatch(s) else None


async def reorder(token: str, items: list[dict[str, Any]], *, note: str = "",
                  delivery_date: Optional[str] = None, window_from: Optional[str] = None,
                  window_to: Optional[str] = None, seeded: bool = False,
                  send: bool = True) -> Optional[dict[str, Any]]:
    """A reorder from the portal → a REAL order on the real rail, then the WhatsApp acknowledgement.

    Returns None for an unresolvable token (the route answers the same 404 as every other). Otherwise
    {ok, pedido_id, lineas, rechazadas, mensaje, aviso_enviado}.

    THE SEQUENCE, and why it is this order:
      1. resolve the token → (tenant, phone). Everything after this is bounded by that pair.
      2. ground each item against THEIR OWN HISTORY ∩ THIS TENANT'S CATALOGUE. Refuse by name.
      3. write the intake row (`whatsapp_messages`, type='portal') FIRST, so that if anything below
         fails the distributor still has the evidence that a customer asked for something.
      4. create + finalize the order — the same two `brain/events` calls the WhatsApp burst makes —
         at `needs_review`. The comercial decides; the portal never approves.
      5. run the SAME review decision (stock · range · order-value) and park at most ONE reason.
      6. only THEN speak: the §5.8a acknowledgement, on the standard outbound rail (gate + sombra).
         Speaking last is deliberate — we never acknowledge an order that did not land.
    """
    who = await resolve(token)
    if not who:
        return None
    tenant, phone = who["tenant_id"], who["phone_number"]

    items = [i for i in (items or []) if isinstance(i, dict)][:PORTAL_MAX_LINES]
    if not items:
        return {"ok": False, "motivo": "vacio", "mensaje": "No has añadido nada al pedido.",
                "lineas": [], "rechazadas": []}

    pool = db.get_pool()
    async with pool.acquire() as con:
        # ── ② grounding: their own history ∩ this tenant's live catalogue ────────────────────────
        hist = await _history_rows(con, phone, limit=200)
        theirs = {ln["sku_id"] for r in hist for ln in _lines_out(r["lines"]) if ln["sku_id"]}
        cat = await _catalogue(con, tenant, [str(i.get("sku_id") or "") for i in items])

        lines: list[dict[str, Any]] = []
        refused: list[dict[str, Any]] = []
        for it in items:
            sku = str(it.get("sku_id") or "").strip()
            qty = _qty(it.get("qty"))
            c = cat.get(sku)
            if not sku or not c:
                refused.append({"sku_id": sku, "nombre": str(it.get("nombre") or ""),
                                "motivo": "desconocido", "por_que": REFUSALS_ES["desconocido"]})
                continue
            if sku not in theirs:
                refused.append({"sku_id": sku, "nombre": c["name"], "motivo": "no_es_tuyo",
                                "por_que": REFUSALS_ES["no_es_tuyo"]})
                continue
            if not c.get("in_assortment"):
                refused.append({"sku_id": sku, "nombre": c["name"], "motivo": "fuera_de_gama",
                                "por_que": REFUSALS_ES["fuera_de_gama"]})
                continue
            if qty is None:
                refused.append({"sku_id": sku, "nombre": c["name"], "motivo": "cantidad",
                                "por_que": REFUSALS_ES["cantidad"]})
                continue
            price = c.get("price")
            variable = bool(c.get("variable_weight"))
            line_total = (round(qty * float(price), 2)
                          if isinstance(price, (int, float)) and not variable else None)
            # The line shape is `brain/tabular.build`'s, so every downstream reader (the Excel, the
            # app's order card, the value snapshot, the desk) sees exactly what a WhatsApp order
            # produces. `band`/`attention`/`confidence` say CLEAN because there was no reading to be
            # unsure about — the customer pointed at a row.
            lines.append({
                "raw_text": c["name"], "mention": c["name"], "item": c["name"],
                "sku_id": sku, "code": c.get("code"), "name": c["name"],
                "family": c.get("family"),
                "qty": qty, "unit": str(it.get("unidad") or c.get("base_unit") or ""),
                "price": (float(price) if isinstance(price, (int, float)) else None),
                "line_total": line_total, "variable_weight": variable,
                "note": "", "keep_in_mind": "", "attention": "clean",
                "band": "exact", "confidence": 1.0, "candidates": [],
                "source": "portal",
            })

        if not lines:
            return {"ok": False, "motivo": "sin_lineas", "lineas": [], "rechazadas": refused,
                    "mensaje": "No he podido cursar ninguna línea de este pedido."}

        cust_name = str(await con.fetchval(
            "select display_name from customer_profiles where phone_number=$1 and tenant_id=$2",
            phone, tenant) or "")

        # ── ③ the intake row: evidence first, before anything can fail ───────────────────────────
        mid = f"portal-{uuid.uuid4().hex[:16]}"
        await con.execute(
            "insert into whatsapp_messages (id, phone_number, role, message_text, message_type, "
            "transcript_meta, seeded) values ($1,$2,'user',$3,'portal',$4,$5) "
            "on conflict (id) do nothing",
            mid, phone, _order_text_es(lines),
            {"source": "portal", "token_uses": True, "tenant_id": tenant}, bool(seeded))

        norm = await _order_norm(con, phone, lines)

    # ── ④ the order, on the real rail ────────────────────────────────────────────────────────────
    from brain import events
    created = await events.create_order({
        "phone_number": phone, "customer_name": cust_name,
        "source_message_ids": [mid], "lines": [], "status": "preparing",
    }, actor="customer", seeded=seeded)
    oid = created["id"]
    order = await events.finalize_order(oid, {
        "phone_number": phone, "customer_name": cust_name,
        "source_message_ids": [mid], "lines": lines,
        "delivery_date": delivery_date or None,
        "note": (note or "").strip()[:400],
    }, status="needs_review", actor="customer")
    if not order:
        log.error("portal: finalize_order returned nothing for %s", oid)
        return {"ok": False, "motivo": "no_cursado", "lineas": [], "rechazadas": refused,
                "mensaje": "No he podido registrar el pedido. Escríbenos por WhatsApp."}

    wf, wt = _clean_hhmm(window_from), _clean_hhmm(window_to)
    if seeded or wf or wt:
        async with pool.acquire() as con:
            if seeded:
                await con.execute("update orders set seeded=true where id=$1", oid)
            if wf or wt:
                # §5.8a/WP-5's per-order override, straight from the customer who is asking for it —
                # the exact column pair `brain/window.py` already reads, written nowhere else on this
                # path today. May be open-ended (only `wf` set) — that is a real window, not a half one.
                await con.execute(
                    "update orders set window_from=coalesce($2,window_from), "
                    "window_to=coalesce($3,window_to) where id=$1", oid, wf, wt)

    # ── ⑤ the SAME review decision as a WhatsApp order (§5.8 / §5.8a) ────────────────────────────
    try:
        import review
        import runtime
        from brain import pipeline
        stock_v, range_v = await pipeline.order_checks(phone, tenant, lines)
        park = pipeline.park_decision(doubt_verdict={}, stock_verdict=stock_v,
                                      range_verdict=range_v, order_norm=norm)
        if park:
            await review.hold_for_review(
                runtime.scope_of(phone), park["source"], text=park["reason"],
                detail={"order_id": oid, "cause": park["cause"], "channel": "portal",
                        "checks": {"stock_ok": bool(stock_v.get("ok")),
                                   "inventory": bool(stock_v.get("inventory")),
                                   "range_known": bool(range_v.get("known")),
                                   "distance_km": range_v.get("distance_km"),
                                   "value_ratio": (norm or {}).get("ratio")}})
    except Exception:
        log.exception("portal: review decision failed for %s (fail-soft — the order stands)", oid)

    # ── ⑥ Rocoto writes to them, last ────────────────────────────────────────────────────────────
    sent_sid = None
    ack = acknowledgement(len(lines), cust_name)
    if send:
        sent_sid = await _acknowledge(phone, ack, oid)

    return {"ok": True, "pedido_id": oid, "lineas": _lines_out(lines), "rechazadas": refused,
            "mensaje": ack, "aviso_enviado": bool(sent_sid), "aviso_id": sent_sid}


async def _acknowledge(phone: str, text: str, order_id: str) -> Optional[str]:
    """The outbound half — the EXISTING rail, not a second mouth.

    `actions.send_whatsapp_as_rocoto` is the one door: it resolves the wa endpoint, honours MODO
    SOMBRA (§5.5 — a held send records a draft on the review sheet and nothing reaches the rail),
    events it as `msg.sent`, and is fail-soft. We add the §5 gate check on the sentence in front of
    it, because the law is that EVERY outbound sentence is checked — an acknowledgement carries no
    price today, and the check is what keeps that true after the next edit."""
    try:
        import actions
        import gate
        import runtime
        verdict = gate.check_outbound(text)
        if not verdict.get("ok"):
            log.error("portal: the gate refused the acknowledgement for %s (%s)",
                      order_id, verdict.get("reason"))
            return None
        return await actions.send_whatsapp_as_rocoto(runtime.scope_of(phone), text)
    except Exception:
        log.exception("portal: acknowledgement failed for %s (fail-soft — the order stands)", order_id)
        return None


# ── the link, as a sentence the comercial can send ───────────────────────────────────────────────
def link_line_es(url: str) -> str:
    """One es-ES line carrying the link. Used by the confirmation rail and by the app's «enviar
    enlace» button. It describes what the customer gets — their orders — never how we built it."""
    return f"Aquí tienes tus pedidos con nosotros, por si quieres repetir alguno: {url}"


# ── housekeeping (for the vital + any future sweep) ──────────────────────────────────────────────
async def purge_expired(older_than_days: int = 365) -> int:
    """Delete rows that have been dead for a long time. Revocation is a status, not a delete — this
    is only for rows nobody could learn anything from any more."""
    await ensure_schema()
    pool = db.get_pool()
    async with pool.acquire() as con:
        n = await con.execute(
            "delete from portal_tokens where status='revoked' "
            "and coalesce(last_used_at, created_at) < now() - ($1 || ' days')::interval",
            str(int(older_than_days)))
    try:
        return int(str(n).rsplit(" ", 1)[-1])
    except ValueError:
        return 0
