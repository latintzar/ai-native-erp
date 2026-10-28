"""Tenant registry — the canonical list of supplier shops (= teams).

This is the spine of multi-tenancy: the customer-facing directory reads it, every other table's
`tenant_id` is a `tenants.slug`, and onboarding a real company is just another INSERT here (plus its
Medusa sales channel + Stripe Express account). Rocoto is the FIRST row — test-marked, seeded — and its
Medusa scoping ids come from the SAME env/config the system already uses (`config.MEDUSA_*`), so nothing
is hardcoded twice. Stripe stays in `shop_connect` (joined for `accepting`); this owns identity +
location + Medusa scoping.

Public reads only (the directory + a shop's storefront config). The publishable key / region / sales
channel are public by nature (they ride in the browser); the connected-account id is NOT exposed here —
checkout resolves it server-side through the key-gated connect status.
"""
from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional

import config
import db

log = logging.getLogger("rocoto.tenants")

# Rocoto's real facts (the first, test-marked tenant). Location/hours are Rocoto's own; the Medusa
# scoping ids are pulled live from config so the seed always tracks the real store primitives.
# NOTE: the seed slug + "name" below stay "Sancho" — re-keying the tenant is the deferred infra
# migration (BRAIN_TENANT), not this code rename.
_SANCHO_SEED = {
    "slug": config.BRAIN_TENANT,  # "sancho"
    "name": "Sancho",
    "tagline": "Charcutería artesana",
    "status": "test",
    "city": "Alcalá de Henares",
    "region": "Madrid",
    "lat": 40.4818,
    "lng": -3.3643,
    "hours_open": 8,
    "hours_close": 20,
    "about": (
        "Charcutería artesana en Alcalá de Henares. Elaboramos embutidos curados, productos frescos y "
        "casquería de cerdo de forma tradicional, y los servimos a bares, restaurantes y tiendas en tu "
        "ruta de reparto habitual."
    ),
    "allergens": (
        "Nuestros productos contienen cerdo y sal, y según la receta pueden incluir o haber estado en "
        "contacto con especias, conservantes (nitritos/nitratos), lácteos o frutos secos. Para los "
        "alérgenos exactos de un producto, escríbenos por WhatsApp antes de pedir."
    ),
    "delivery_info": (
        "Entrega en tu ruta de reparto habitual por Alcalá de Henares y alrededores. Haz tu pedido antes "
        "de las 20:00. Pago seguro con tarjeta, o a 30 días para clientes con cuenta."
    ),
}


async def ensure_seed() -> None:
    """Idempotently ensure Rocoto exists as a tenant row, tracking its live Medusa scoping ids. Safe to
    call on every boot: it never clobbers operator-edited location, only backfills + refreshes the
    Medusa ids from config."""
    s = _SANCHO_SEED
    pool = db.get_pool()
    async with pool.acquire() as con:
        await con.execute(
            """insert into tenants (slug, name, tagline, status, seeded, city, region, lat, lng,
                                    hours_open, hours_close, medusa_publishable_key,
                                    medusa_sales_channel_id, medusa_region_id, medusa_stock_location_id,
                                    currency_code, about, allergens, delivery_info, updated_at)
                 values ($1,$2,$3,$4,true,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18, now())
               on conflict (slug) do update set
                 medusa_publishable_key   = coalesce(excluded.medusa_publishable_key,   tenants.medusa_publishable_key),
                 medusa_sales_channel_id  = coalesce(excluded.medusa_sales_channel_id,  tenants.medusa_sales_channel_id),
                 medusa_region_id         = coalesce(excluded.medusa_region_id,         tenants.medusa_region_id),
                 medusa_stock_location_id = coalesce(excluded.medusa_stock_location_id, tenants.medusa_stock_location_id),
                 lat = coalesce(tenants.lat, excluded.lat), lng = coalesce(tenants.lng, excluded.lng),
                 about = coalesce(tenants.about, excluded.about),
                 allergens = coalesce(tenants.allergens, excluded.allergens),
                 delivery_info = coalesce(tenants.delivery_info, excluded.delivery_info),
                 updated_at = now()""",
            s["slug"], s["name"], s["tagline"], s["status"], s["city"], s["region"], s["lat"], s["lng"],
            s["hours_open"], s["hours_close"], config.MEDUSA_PUBLISHABLE_KEY, config.MEDUSA_SALES_CHANNEL_ID,
            config.MEDUSA_REGION_ID, config.MEDUSA_STOCK_LOCATION_ID, config.MEDUSA_CURRENCY_CODE,
            s["about"], s["allergens"], s["delivery_info"])
    log.info("tenants: ensured seed for %s", s["slug"])


# A SLUG IS AN IDENTITY AND A PREDICATE, so its charset is a security boundary, not a style rule.
# `db.ALL_TENANTS` is the literal "*", and `db._tenant_or_default("*")` returns None — meaning NO
# TENANT PREDICATE. So a tenant whose slug were "*" would read every tenant's rows through the very
# helpers that exist to scope them. `tenants.slug` carries no CHECK constraint, and this is the
# provisioning seam, so the charset is enforced here. It is also the shape the scope path needs:
# the slug becomes an ltree label in `t.<slug>.wa.<digits>` (WP-A1).
_SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,39}$")


def _valid_slug(slug: str) -> str:
    s = (slug or "").strip().lower()
    if not _SLUG_RE.match(s):
        raise ValueError(
            f"invalid tenant slug {slug!r}: lowercase letters, digits, '-' and '_' only, "
            f"1-40 chars, starting alphanumeric. (A slug like '*' would mean 'every tenant' "
            f"to db._tenant_or_default and silently lift every tenant predicate.)")
    if s == db.ALL_TENANTS:
        raise ValueError("'*' is the ALL_TENANTS sentinel, never a tenant")
    return s


async def upsert(slug: str, **fields: Any) -> None:
    """Provisioning + edit seam: PATCH an existing tenant (update only the given columns) or INSERT a new
    one. Patch semantics matter — editing one field (e.g. `about`) must not require re-sending NOT NULL
    columns like `name`.

    The slug is VALIDATED here because this is the only door new tenants come through — see
    `_valid_slug` for why the charset is a security boundary rather than a style preference."""
    slug = _valid_slug(slug)
    pool = db.get_pool()
    async with pool.acquire() as con:
        exists = await con.fetchval("select 1 from tenants where slug=$1", slug)
        if exists:
            if not fields:
                return
            sets = ", ".join(f"{c}=${i + 2}" for i, c in enumerate(fields.keys()))
            await con.execute(
                f"update tenants set {sets}, updated_at=now() where slug=$1", slug, *fields.values())
        else:
            cols = ["slug"] + list(fields.keys())
            placeholders = ", ".join(f"${i + 1}" for i in range(len(cols)))
            await con.execute(
                f"insert into tenants ({', '.join(cols)}) values ({placeholders})", slug, *fields.values())


async def list_public() -> List[Dict[str, Any]]:
    """The directory: test/live shops, joined to their Stripe connect status (`accepting`)."""
    pool = db.get_pool()
    async with pool.acquire() as con:
        rows = await con.fetch(
            """select t.*, coalesce(sc.charges_enabled, false) as charges_enabled
                 from tenants t
                 left join shop_connect sc on sc.tenant_id = t.slug
                where t.status in ('test', 'live')
                order by t.name""")
    return [_dir_view(dict(r)) for r in rows]


async def get_public_config(slug: str) -> Optional[Dict[str, Any]]:
    """One shop's public storefront scoping config (publishable key + region + sales channel)."""
    pool = db.get_pool()
    async with pool.acquire() as con:
        r = await con.fetchrow("select * from tenants where slug=$1 and status in ('test','live')", slug)
    if not r:
        return None
    r = dict(r)
    return {
        "slug": r["slug"], "name": r["name"], "tagline": r["tagline"],
        "city": r["city"], "region": r["region"], "lat": r["lat"], "lng": r["lng"],
        "hours_open": r["hours_open"], "hours_close": r["hours_close"], "hero_image": r.get("hero_image"),
        "publishable_key": r.get("medusa_publishable_key"), "region_id": r.get("medusa_region_id"),
        "sales_channel_id": r.get("medusa_sales_channel_id"), "currency_code": r.get("currency_code") or "eur",
        "about": r.get("about"), "allergens": r.get("allergens"), "delivery_info": r.get("delivery_info"),
    }


def _dir_view(r: Dict[str, Any]) -> Dict[str, Any]:
    # Includes each shop's Medusa scoping so the directory enriches each card with ITS OWN catalogue
    # (publishable key is public). No connected-account / secrets.
    return {
        "slug": r["slug"], "name": r["name"], "tagline": r["tagline"],
        "city": r["city"], "region": r["region"], "lat": r["lat"], "lng": r["lng"],
        "hours_open": r["hours_open"], "hours_close": r["hours_close"], "hero_image": r.get("hero_image"),
        "sales_channel_id": r.get("medusa_sales_channel_id"),
        "publishable_key": r.get("medusa_publishable_key"),
        "region_id": r.get("medusa_region_id"),
        "currency_code": r.get("currency_code") or "eur",
        "accepting": bool(r.get("charges_enabled")),
    }
