"""Gate: basket accept hardening (plan Stage 5a / Stage 5-GATE; medusa-integration.md §1-2).

Asserts the three money-bug guards on brain/baskets.py, MOCKING the Medusa/outbox conversion so the gate
runs WITHOUT a live Medusa (the outbox/submit path is covered separately by test_outbox.py against :9000):

  1. version-mismatch → conflict  — a stale Accept (mid-chat edit bumped `version`) returns
     {"conflict": True, "basket": <fresh>} and does NOT flip status / mint a pay-link.
  2. access_token mint + verify + TTL-expiry — create mints an unguessable token; verify_access accepts
     the right token within TTL, rejects a wrong token, an expired token, and a nulled (post-accept) token.
  3. idempotent double-accept — accepting twice converts EXACTLY once (one outbox call) and is stable.

Runs against the brain Postgres (config.DATABASE_URL) via the gatelib harness — same shape as the other
gates. Skips cleanly if Postgres is unreachable.
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gatelib  # noqa: E402

gatelib.setup_env()
# keep the comms loop dark + the sync flag off — this gate is pure basket logic, providers are mocked.
os.environ.setdefault("NOTIFY_ENABLED", "false")
os.environ.setdefault("MEDUSA_SYNC_ENABLED", "false")

import config  # noqa: E402
from brain import baskets  # noqa: E402

PFX = "bsk_gbacc"


async def _clean(con):
    await con.execute("delete from basket_sessions where id like $1", PFX + "%")


async def _mk(con, bid, *, version=0, status="submitted", lines=None):
    """Insert a basket row with a known access_token + version, bypassing create() so the test controls
    exact state. Returns the minted token."""
    tok = baskets._mint_token()
    await con.execute(
        """insert into basket_sessions
             (id, tenant_id, phone_number, customer_name, lines, custom_note, total, status,
              access_token, access_token_at, version, seeded)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,now(),$10,true)""",
        bid, config.BRAIN_TENANT, "+34600111222", "Test Bar",
        lines or [{"item": "Paleta", "qty": 1, "unit": "ud", "price": 80.0, "custom": True}],
        "deshuesar al vacío", 80.0, status, tok, version)
    return tok


async def main():
    try:
        pool = await gatelib.prepare()
    except Exception as e:
        print(f"test_basket_accept: DB unreachable ({e}) — skipped")
        return "skipped"

    # MOCK the Medusa/outbox conversion: no live Medusa, count the calls to prove idempotency.
    calls = {"n": 0}

    async def _fake_route(con, basket_id, d, tenant):
        if d.get("medusa_order_id"):
            return d["medusa_order_id"]
        calls["n"] += 1
        return "ord_mock_" + basket_id.replace("bsk_", "")[:12]

    orig_route = baskets._route_to_outbox
    baskets._route_to_outbox = _fake_route
    try:
        async with pool.acquire() as con:
            await _clean(con)

        # ── 1. create() mints a token; verify_access honours it within TTL ──────────────────
        created = await baskets.create("+34600111222", "Casa Real",
                                       [{"item": "Chorizo", "qty": 2, "price": 9.0}],
                                       "envasar al vacío", phone_verified=True)
        bid_c = created["id"]
        token = created.get("access_token")
        assert token and len(token) > 20, ("create did not mint an access_token", created)
        assert created.get("phone_verified") is True, "phone_verified not persisted"

        ok = await baskets.verify_access(bid_c, token)
        assert ok and ok["id"] == bid_c, ("verify_access rejected a valid token", ok)
        bad = await baskets.verify_access(bid_c, "not-the-token")
        assert bad is None, "verify_access accepted a WRONG token (IDOR hole)"
        none_tok = await baskets.verify_access(bid_c, "")
        assert none_tok is None, "verify_access accepted an empty token"

        # TTL expiry: backdate access_token_at past the TTL → verify must reject.
        async with pool.acquire() as con:
            await con.execute(
                "update basket_sessions set access_token_at = now() - interval '400 days' where id=$1",
                bid_c)
        expired = await baskets.verify_access(bid_c, token)
        assert expired is None, "verify_access accepted an EXPIRED token (TTL not enforced)"

        # ── 2. version-mismatch → conflict (no accept, no pay-link) ─────────────────────────
        async with pool.acquire() as con:
            await _mk(con, PFX + "_v", version=3, status="submitted")
        conflict = await baskets.accept(PFX + "_v", expected_version=2)  # client rendered v2, row is v3
        assert isinstance(conflict, dict) and conflict.get("conflict") is True, \
            ("stale accept must conflict, not accept", conflict)
        assert conflict["basket"]["status"] == "submitted", "conflicted basket must stay submitted"
        async with pool.acquire() as con:
            st = await con.fetchval("select status from basket_sessions where id=$1", PFX + "_v")
            ver = await con.fetchval("select version from basket_sessions where id=$1", PFX + "_v")
        assert st == "submitted" and ver == 3, ("conflict must NOT flip status / bump version", st, ver)
        assert calls["n"] == 0, "a conflicting accept must NOT convert to an order"

        # matching version → accepts cleanly, converts once, mints a pay-link, nulls the token.
        ok_accept = await baskets.accept(PFX + "_v", expected_version=3)
        assert ok_accept and ok_accept["status"] == "accepted", ("matching version must accept", ok_accept)
        assert ok_accept.get("pay_link"), "accept did not mint a pay-link"
        assert "/shop/pay/" in ok_accept["pay_link"] or config.SHOP_PAY_PATH in ok_accept["pay_link"], \
            ("pay-link must use the config base path", ok_accept["pay_link"])
        assert calls["n"] == 1, ("accept must convert exactly once", calls["n"])
        # token nulled on accept → the public link is dead post-conversion
        post_tok = await baskets.verify_access(PFX + "_v", "anything")
        assert post_tok is None, "access token must be dead after accept"

        # ── 3. idempotent double-accept (no second conversion) ──────────────────────────────
        async with pool.acquire() as con:
            await _mk(con, PFX + "_idem", version=0, status="submitted")
        calls["n"] = 0
        a1 = await baskets.accept(PFX + "_idem")               # no expected_version → unconditional
        a2 = await baskets.accept(PFX + "_idem")               # replay
        a3 = await baskets.accept(PFX + "_idem", expected_version=999)  # stale replay also safe
        assert a1 and a1["status"] == "accepted", a1
        assert a2 and a2["status"] == "accepted", ("double-accept must stay accepted (idempotent)", a2)
        assert a3 and a3["status"] == "accepted", ("replay on accepted is idempotent, never a conflict", a3)
        assert calls["n"] == 1, ("double-accept must convert EXACTLY once", calls["n"])
        assert a1["pay_link"] == a2["pay_link"], "pay-link must be stable across replays"

        # accept on a missing basket → None (404 at the route)
        assert await baskets.accept(PFX + "_nope") is None, "accept of a missing basket must be None"

        async with pool.acquire() as con:
            await _clean(con)
        print("test_basket_accept: version-conflict + access-token(mint/verify/TTL) + idempotent-accept GREEN")
        return "ok"
    finally:
        baskets._route_to_outbox = orig_route


def test_basket_accept():
    r = asyncio.run(main())
    if r == "skipped":
        import pytest
        pytest.skip("brain Postgres not reachable")


if __name__ == "__main__":
    asyncio.run(main())
