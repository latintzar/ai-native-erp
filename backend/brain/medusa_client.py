"""Async HTTP client for the Medusa Admin API — localhost only (medusa-integration.md §6).

Auth is emailpass → JWT, cached and refreshed on 401. The admin credential never leaves the box.
Order creation + the seeded-purge go through the custom `/admin/sancho/*` routes (Medusa side),
which wrap createOrderWorkflow with find-then-create idempotency + phone customer resolution.

Errors are classified for the drainer's retry policy:
  MedusaTransient  → 429 / 5xx / network / timeout → back off and retry
  MedusaPermanent  → 4xx that won't fix itself      → dead-letter
"""
from __future__ import annotations

import asyncio
from typing import Any, Dict, List, Optional

import httpx

import config


class MedusaError(Exception):
    pass


class MedusaTransient(MedusaError):
    pass


class MedusaPermanent(MedusaError):
    pass


def enabled() -> bool:
    """The drainer/proxy only call Medusa when sync is on AND a base url + admin creds exist."""
    return bool(
        config.MEDUSA_SYNC_ENABLED
        and config.MEDUSA_BASE_URL
        and config.MEDUSA_ADMIN_EMAIL
        and config.MEDUSA_ADMIN_PASSWORD
    )


class MedusaClient:
    def __init__(self) -> None:
        self._client: Optional[httpx.AsyncClient] = None
        self._token: Optional[str] = None
        self._lock = asyncio.Lock()

    def _http(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=config.MEDUSA_BASE_URL,
                timeout=httpx.Timeout(10.0, connect=5.0),
                limits=httpx.Limits(max_connections=10, max_keepalive_connections=5),
            )
        return self._client

    async def aclose(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    async def _auth(self, force: bool = False) -> str:
        async with self._lock:
            if self._token and not force:
                return self._token
            try:
                r = await self._http().post(
                    "/auth/user/emailpass",
                    json={"email": config.MEDUSA_ADMIN_EMAIL, "password": config.MEDUSA_ADMIN_PASSWORD},
                )
            except (httpx.ConnectError, httpx.ConnectTimeout, httpx.ReadTimeout) as e:
                raise MedusaTransient(f"auth network error: {e}") from e
            if r.status_code in (401, 400):
                raise MedusaPermanent(f"auth rejected ({r.status_code}): bad MEDUSA_ADMIN_* creds")
            if r.status_code >= 500:
                raise MedusaTransient(f"auth 5xx: {r.status_code}")
            tok = (r.json() or {}).get("token")
            if not tok:
                raise MedusaPermanent("auth returned no token")
            self._token = tok
            return tok

    async def _request(self, method: str, path: str, *, json: Any = None,
                       params: Any = None, _retry_auth: bool = True) -> httpx.Response:
        tok = await self._auth()
        try:
            r = await self._http().request(
                method, path, json=json, params=params,
                headers={"authorization": f"Bearer {tok}"},
            )
        except (httpx.ConnectError, httpx.ConnectTimeout, httpx.ReadTimeout, httpx.RemoteProtocolError) as e:
            raise MedusaTransient(f"{method} {path} network error: {e}") from e
        if r.status_code == 401 and _retry_auth:
            await self._auth(force=True)
            return await self._request(method, path, json=json, params=params, _retry_auth=False)
        if r.status_code == 429 or r.status_code >= 500:
            raise MedusaTransient(f"{method} {path} → {r.status_code}: {r.text[:200]}")
        if r.status_code >= 400:
            raise MedusaPermanent(f"{method} {path} → {r.status_code}: {r.text[:300]}")
        return r

    # ── the operations the drainer + proxy use ──────────────────────────────────────────────
    async def create_order(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Idempotent create via the custom route → {id, created}. The route does find-then-create
        on metadata.sancho_order_id AND resolves the phone customer, so this is safe to retry."""
        r = await self._request("POST", "/admin/sancho/orders", json=payload)
        return r.json() or {}

    async def edit_order(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Apply a post-approve edit to an existing Medusa order (payload carries medusa_order_id)."""
        r = await self._request("POST", "/admin/sancho/orders/edit", json=payload)
        return r.json() or {}

    async def update_product(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Write the e-commerce editor's product metadata through to Medusa (medusa-integration.md §3:
        the product editor writes Medusa product metadata via the proxy). `payload` carries the join key
        (medusa_variant_id / medusa_product_id / sancho_sku_id) + the metadata patch (live_on_ecom,
        image_url, customizations, asap_envelope). The Medusa-side route resolves the product and merges
        the metadata; idempotent (last-write-wins on metadata)."""
        r = await self._request("POST", "/admin/sancho/product/metadata", json=payload)
        return r.json() or {}

    async def find_order(self, sancho_order_id: str) -> Optional[str]:
        r = await self._request("GET", "/admin/sancho/orders", params={"sancho_order_id": sancho_order_id})
        return (r.json() or {}).get("id")

    async def get_order(self, medusa_order_id: str,
                        fields: str = "id,status,fulfillment_status,payment_status,created_at,"
                        "metadata,items.*,items.metadata,customer.*") -> Dict[str, Any]:
        r = await self._request("GET", f"/admin/orders/{medusa_order_id}", params={"fields": fields})
        return (r.json() or {}).get("order") or {}

    async def list_orders_for_dispatch(self) -> List[Dict[str, Any]]:
        """Approved-not-yet-dispatched batch for Sage/Excel (§8) via the custom route."""
        r = await self._request("GET", "/admin/sancho/orders/dispatch")
        return (r.json() or {}).get("orders") or []

    async def mark_dispatched(self, medusa_order_ids: List[str]) -> None:
        await self._request("POST", "/admin/sancho/orders/dispatched", json={"ids": medusa_order_ids})

    async def purge_seeded(self) -> Dict[str, int]:
        """Delete every Medusa entity tagged metadata.seeded=true (§7 founder reset)."""
        r = await self._request("POST", "/admin/sancho/purge-seeded", json={})
        return (r.json() or {}).get("deleted") or {}


# module-level singleton
_client: Optional[MedusaClient] = None


def get_client() -> MedusaClient:
    global _client
    if _client is None:
        _client = MedusaClient()
    return _client
