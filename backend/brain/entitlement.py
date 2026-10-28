"""entitlement.py — which products a tenant has, and what «on» means (§17.2, §17.30k · WP-A2).

    P = {reparto, inventario, cobros, intel, facturas}   — §17.51's frozen wire vocabulary

THE ONE PLACE THIS IS DECIDED. §17.30k's component law says a product lights and darkens the
surfaces that declare it — Cobros off means Orders has NO payment column, not a greyed one — so
every surface asks the same question of the same function, or they disagree the day a flag moves.

THE LEGACY FLAGS ARE STILL AUTHORITATIVE, deliberately. Entitlement is three unrelated booleans
today (`tenants.inventory_enabled`, `tenants.ecommerce_enabled`,
`employee_subscriptions.ecommerce_enabled`) and the RUNTIME still reads them — `brain/stock` gates
on `inventory_enabled` this minute. So `tenant_product` is written first and read second: where a
legacy flag exists it WINS, and the new table only answers for products that never had one. That
makes this table additive on a live box; the flags are retired one at a time, each with its own
vital, and the reconciliation is here rather than smeared across the surfaces.

THE §17.9 WALL IS STRUCTURAL: `state` mirrors `tenants.status`, so `is_live()` can never be true
for a product while the tenant is still in test. A surface that wants "configured, not yet armed"
asks `state()`, not `is_on()`.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Optional

import config
import db

log = logging.getLogger("rocoto.entitlement")

# §17.2's catalogue. `pedidos` is the flagship and is not optional — a tenant without it is not a
# tenant — so it is not listed as a toggle; it is the thing the others depend on.
PRODUCTS = ("reparto", "cobros", "inventario", "inteligencia", "tienda", "facturas")

# product → the legacy boolean that still decides it, if any. While a product appears here, the old
# flag is the truth and `tenant_product` is a mirror; removing an entry is the migration.
_LEGACY: dict[str, tuple[str, str]] = {
    "inventario": ("tenants", "inventory_enabled"),
    "tienda": ("tenants", "ecommerce_enabled"),
}

OFF, TEST, LIVE = "off", "test", "live"


async def _legacy_flag(product: str, tenant: str) -> Optional[bool]:
    seat = _LEGACY.get(product)
    if not seat:
        return None
    table, column = seat
    try:
        async with db.get_pool().acquire() as con:
            return await con.fetchval(
                f"select {column} from {table} where slug = $1", tenant)  # noqa: S608 - fixed literals
    except Exception:
        log.debug("legacy flag %s.%s read fail-soft", table, column, exc_info=True)
        return None


async def state(product: str, tenant: Optional[str] = None) -> str:
    """'off' | 'test' | 'live' for one product. Unknown product → 'off' (deny, never assume)."""
    if product not in PRODUCTS:
        return OFF
    slug = tenant or config.BRAIN_TENANT

    legacy = await _legacy_flag(product, slug)
    if legacy is not None:
        # The old boolean carries no test/live distinction, so it resolves through the TENANT's
        # status — which is exactly the §17.9 wall the new column encodes explicitly.
        if not legacy:
            return OFF
        try:
            async with db.get_pool().acquire() as con:
                status = await con.fetchval("select status from tenants where slug = $1", slug)
        except Exception:
            status = None
        return LIVE if status == "live" else TEST

    try:
        async with db.get_pool().acquire() as con:
            row = await con.fetchrow(
                "select p.state, t.status from tenant_product p "
                "join tenants t on t.slug = p.tenant_id "
                "where p.tenant_id = $1 and p.product = $2", slug, product)
    except Exception:
        log.debug("tenant_product read fail-soft for %s/%s", slug, product, exc_info=True)
        return OFF                      # fail CLOSED: an unreadable entitlement is not a grant
    if not row:
        return OFF
    st = row["state"] or OFF
    # THE WALL, enforced on read as well as on write: a product cannot be live under a tenant that
    # is not. Storing it is not enough — the tenant can be moved back to test at any time.
    if st == LIVE and row["status"] != "live":
        return TEST
    return st


async def is_on(product: str, tenant: Optional[str] = None) -> bool:
    """Does this product exist for the tenant at all (test OR live)? This is what a SURFACE asks:
    §17.30k lights a component when the product is on, whether or not the tenant has armed."""
    return await state(product, tenant) != OFF


async def is_live(product: str, tenant: Optional[str] = None) -> bool:
    """Is it armed for real? Only ever true when the TENANT is live too (§17.9)."""
    return await state(product, tenant) == LIVE


async def all_states(tenant: Optional[str] = None) -> dict[str, str]:
    """Every product's state — the `P` map a panel page needs in one call rather than five."""
    slug = tenant or config.BRAIN_TENANT
    return {p: await state(p, slug) for p in PRODUCTS}


async def set_state(product: str, new_state: str, tenant: Optional[str] = None, *,
                    actor: str = "", settings: Optional[dict[str, Any]] = None) -> str:
    """Flip a product. Returns the resulting state (which may be TEST when LIVE was asked for and
    the tenant is not live — the wall, applied rather than reported after the fact).

    Every flip is also a spine event per §17.2, appended fail-soft: the entitlement write is the
    thing that must not be lost; its narration is not.
    """
    if product not in PRODUCTS:
        raise ValueError(f"unknown product {product!r} (known: {PRODUCTS})")
    if new_state not in (OFF, TEST, LIVE):
        raise ValueError(f"state must be off|test|live, not {new_state!r}")
    slug = tenant or config.BRAIN_TENANT

    async with db.get_pool().acquire() as con:
        status = await con.fetchval("select status from tenants where slug = $1", slug)
        effective = TEST if (new_state == LIVE and status != "live") else new_state
        await con.execute(
            "insert into tenant_product(tenant_id, product, state, settings, enabled_by, "
            "  enabled_at, disabled_at) "
            "values($1,$2,$3,coalesce($4::jsonb,'{}'::jsonb),$5, "
            "  case when $3 <> 'off' then now() end, case when $3 = 'off' then now() end) "
            "on conflict (tenant_id, product) do update set "
            "  state = excluded.state, enabled_by = excluded.enabled_by, "
            "  settings = case when $4 is null then tenant_product.settings else excluded.settings end, "
            "  enabled_at = case when excluded.state <> 'off' then now() else tenant_product.enabled_at end, "
            "  disabled_at = case when excluded.state = 'off' then now() else tenant_product.disabled_at end",
            slug, product, effective, json.dumps(settings) if settings is not None else None, actor)

        # keep the legacy boolean in step while it is still the authority, or the runtime and the
        # panel would immediately disagree about the same switch.
        seat = _LEGACY.get(product)
        if seat:
            table, column = seat
            await con.execute(
                f"update {table} set {column} = $2, updated_at = now() where slug = $1",  # noqa: S608
                slug, effective != OFF)

    try:
        import sup_session
        await sup_session.audit(actor, slug, "", "product.flipped",
                                detail={"product": product, "state": effective, "asked": new_state})
    except Exception:
        log.debug("entitlement audit fail-soft (%s/%s)", slug, product, exc_info=True)

    try:
        import spine
        import tenancy
        scope = f"t.{slug}" if tenancy.SCOPE_PATHED else slug
        async with db.scoped_tx(scope) as con:
            await spine.append_event(con, scope, "product.flipped", "entitlement",
                                     {"product": product, "state": effective, "by": actor},
                                     lane="world")
    except Exception:
        log.debug("product.flipped event fail-soft (%s/%s)", slug, product, exc_info=True)

    return effective
