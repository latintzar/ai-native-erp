"""Shared harness for the backend scenario-test gate (medusa-integration.md §12).

- setup_env(): point the brain at its Postgres; enable Medusa only when MEDUSA_TEST_URL explicitly
  selects a disposable test service. Credentials and region/channel IDs come from the environment.
- prepare(): db.init() (fresh pool per event loop) + ensure the seeded catalogue is loaded + linked
  to Medusa variants (so grounded lines resolve medusa_variant_id).
- Each test file runs ONE asyncio.run(main()) → one loop, one pool: avoids asyncpg cross-loop pain.
"""
import os
import socket
from urllib.parse import urlsplit


def medusa_up() -> bool:
    url = os.environ.get("MEDUSA_TEST_URL", "")
    if not url:
        return False
    parsed = urlsplit(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError("MEDUSA_TEST_URL must name the disposable HTTP(S) service")
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    try:
        with socket.create_connection((parsed.hostname, port), timeout=1):
            return True
    except OSError:
        return False


def setup_env() -> None:
    os.environ.setdefault("ROCOTO_MEDIA_DIR", "/tmp/sancho-media")
    os.environ.setdefault("DATABASE_URL", "postgresql://sancho@localhost:5432/sancho")
    os.environ.setdefault("BRAIN_TENANT", "sancho")
    test_url = os.environ.get("MEDUSA_TEST_URL", "")
    os.environ["MEDUSA_SYNC_ENABLED"] = "true" if test_url else "false"
    if test_url:
        os.environ["MEDUSA_BASE_URL"] = test_url


async def _medusa_variant_map():
    """sancho_sku_id → (variant_id, product_id) read straight from the Medusa Postgres."""
    import asyncpg
    out = {}
    test_dsn = os.environ.get("MEDUSA_TEST_DATABASE_URL", "")
    if not test_dsn:
        return out
    try:
        con = await asyncpg.connect(test_dsn)
        try:
            rows = await con.fetch(
                "select p.metadata->>'sancho_sku_id' as sid, pv.id as vid, p.id as pid "
                "from product_variant pv join product p on pv.product_id=p.id "
                "where p.metadata->>'sancho_sku_id' is not null")
            for r in rows:
                out[r["sid"]] = (r["vid"], r["pid"])
        finally:
            await con.close()
    except Exception:
        pass
    return out


async def link_catalogue_to_medusa():
    import db
    mp = await _medusa_variant_map()
    if not mp:
        return 0
    pool = db.get_pool()
    n = 0
    async with pool.acquire() as con:
        for sku_id, (vid, pid) in mp.items():
            r = await con.execute(
                "update catalogue_skus set medusa_variant_id=$2, medusa_product_id=$3 "
                "where id=$1 and tenant_id='sancho'", sku_id, vid, pid)
            if r.endswith(" 1"):
                n += 1
    return n


async def prepare():
    """Fresh pool in THIS event loop (avoids asyncpg cross-loop errors). Returns the brain pool.
    Fast — does NOT load embeddings (the new gates test projection/acceptability/tasks, not grounding)."""
    import db
    db._pool = None
    try:
        from brain import medusa_client
        medusa_client._client = None
    except Exception:
        pass
    await db.init()
    return db.get_pool()


async def seed_catalogue_minimal():
    """Insert catalogue_skus rows from seed/catalogue.json WITHOUT embeddings (fast), then link each
    to its Medusa variant. Enough for the outbox/sim variant-resolution path; grounding is covered by
    recall_eval/sim_live separately."""
    import json as _json

    import db
    path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "seed", "catalogue.json")
    data = _json.load(open(path))
    pool = db.get_pool()
    async with pool.acquire() as con:
        for s in data.get("skus", []):
            await con.execute(
                """insert into catalogue_skus (id,tenant_id,code,name,family,base_unit,pack_factor,
                       variable_weight,price,in_assortment,seeded)
                   values ($1,'sancho',$2,$3,$4,$5,$6,$7,$8,$9,true)
                   on conflict (id) do update set name=excluded.name, price=excluded.price,
                       variable_weight=excluded.variable_weight,
                       in_assortment=excluded.in_assortment""",
                s["id"], s["code"], s["name"], s["family"], s["base_unit"], s["pack_factor"],
                s["variable_weight"], s["price"],
                # was hardcoded true, which quietly made the three out-of-assortment rows
                # (pluma ibérica · chóped pork · queso de oveja) sellable in every gate that used
                # this loader — the opposite of what seed/catalogue.json says. Honour the file, the
                # way brain.seed.load_catalogue does.
                bool(s.get("in_assortment", True)))
    linked = await link_catalogue_to_medusa()
    return linked


async def clean_test_orders(prefix: str):
    import db
    pool = db.get_pool()
    async with pool.acquire() as con:
        await con.execute("delete from order_events where order_id like $1", prefix + "%")
        await con.execute("delete from medusa_sync where sancho_order_id like $1", prefix + "%")
        await con.execute("delete from orders where id like $1", prefix + "%")


def sign_meta(raw: bytes) -> dict:
    """The `X-Hub-Signature-256` header for `raw`, and the secret to verify it with installed on
    `config` if the environment carries none.

    WP-E made the Meta door unconditional: an absent FB_APP_SECRET now REFUSES a webhook instead of
    skipping the check, so a vital that used to blank the secret to take "the unsigned path" was
    driving a door that no longer exists. It signs like Meta does instead — which is also the more
    honest test, because it exercises the code the box runs."""
    import hashlib
    import hmac

    import config
    if not config.FB_APP_SECRET:
        config.FB_APP_SECRET = "vital-fb-app-secret"
    mac = hmac.new(config.FB_APP_SECRET.encode(), raw, hashlib.sha256).hexdigest()
    return {"X-Hub-Signature-256": f"sha256={mac}"}
