"""Gate: WP-E's «Prueba la IA» / "Try the AI" public chat widget (SITE-V2-PLAN.md §6, try_chat.py).

Covers the four mandatory guardrails:
  1. SCOPE ISOLATION — a real turn never creates/touches a `wa.*` (real-customer-shaped) scope, the
     scope it DOES use resolves to TRY_CHAT_DEMO_TENANT (never BRAIN_TENANT), and its lineage is
     'test'. This is also the regression test for the scope-override leak found 2026-07-28 building
     this widget (agent_reply.py's tool loop used to recompute `wa.<digits(phone)>` regardless of
     `scope_override` — fixed via `agent_reply._SCOPE_OVERRIDE`, see that module's docstring).
  2. RATE LIMITS — per-IP and per-session sliding windows reject once exhausted.
  3. TURN CAP — a session at/over the cap gets a friendly close WITHOUT ever calling runtime.run_turn
     (no LLM spend on a closed session).
  4. EGRESS SANDBOX — `runtime.run_turn` is always invoked with `egress_stub=True`, and the real
     network-send functions the mind's tools could reach are never called for real on this path.

Uses a REAL Postgres + a REAL Claude call for the isolation gate (the one guarantee that matters most
and cannot be faithfully proven any other way); the other three gates are deterministic and monkeypatch
`runtime.run_turn` so they cost no LLM calls and can't be flaky.

Run:  PYTHONPATH=. venv/bin/python tests/test_try_chat.py
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gatelib  # noqa: E402

gatelib.setup_env()

import config  # noqa: E402
import tenancy  # noqa: E402
import try_chat  # noqa: E402

R = []


def ck(name, ok, detail=""):
    R.append(bool(ok))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


def _fresh_session() -> str:
    return try_chat.new_session_id()


async def _wa_scope_snapshot(con) -> set:
    rows = await con.fetch("select scope::text as s from event where scope::text like 'wa.%'")
    rows2 = await con.fetch("select scope::text as s from scope_node where scope::text like 'wa.%'")
    return {r["s"] for r in rows} | {r["s"] for r in rows2}


async def gate_scope_isolation(pool):
    """The one gate that must run for real: a genuine grounded order, on the real runtime."""
    print("\n-- 1. scope isolation --")

    # 1a. tenancy.tenant_of never resolves a try-chat scope to the real tenant (deterministic, no DB).
    ck("tenancy.tenant_of('test.try.X') -> TRY_CHAT_DEMO_TENANT (never BRAIN_TENANT)",
       tenancy.tenant_of("test.try.abc123") == config.TRY_CHAT_DEMO_TENANT
       and config.TRY_CHAT_DEMO_TENANT != config.BRAIN_TENANT,
       f"got {tenancy.tenant_of('test.try.abc123')!r}, demo={config.TRY_CHAT_DEMO_TENANT!r}, "
       f"brain={config.BRAIN_TENANT!r}")
    # other scope shapes must be COMPLETELY unaffected by the new branch (no regression).
    ck("tenancy.tenant_of unaffected for t.<slug>.c.<id>",
       tenancy.tenant_of("t.sancho.c.9") == "sancho")
    ck("tenancy.tenant_of unaffected for wa.<digits> (falls back to BRAIN_TENANT, as before)",
       tenancy.tenant_of("wa.34999000123") == config.BRAIN_TENANT)
    ck("tenancy.tenant_of unaffected for test.persona.<n> (persona console keeps grounding on BRAIN_TENANT)",
       tenancy.tenant_of("test.persona.1") == config.BRAIN_TENANT)

    async with pool.acquire() as con:
        before = await _wa_scope_snapshot(con)

    session = _fresh_session()
    scope = f"test.try.{session}"

    out1 = await try_chat.chat(session_id=session, text="hola", ip="203.0.113.5", lang="es")
    ck("greeting is junk-gated (no runtime turn, no order)", out1["turns_used"] == 0 and out1["order"] is None)

    out2 = await try_chat.chat(
        session_id=session, ip="203.0.113.5", lang="es",
        text="Apunta el pedido: 3 kg de chorizo ibérico extra y 2 kg de panceta ibérica, "
             "para mañana a las 10, solo para este pedido")
    ck("real turn ran (turns_used advanced)", out2["turns_used"] >= 1, out2)

    async with pool.acquire() as con:
        after = await _wa_scope_snapshot(con)
        sn = await con.fetchrow(
            "select tier, tenant_slug, lineage from scope_node where scope=$1::ltree", scope)
        ev_scopes = await con.fetch(
            "select distinct scope::text as s from event where scope <@ $1::ltree", scope)

    ck("NOT ONE new wa.* scope/event row was created by this turn (the regression this gate exists for)",
       after == before, f"new wa.* rows: {after - before}")
    ck("scope_node exists for the pinned scope, tenant_slug=DEMO_TENANT, lineage=test",
       bool(sn) and sn["tenant_slug"] == config.TRY_CHAT_DEMO_TENANT and sn["lineage"] == "test",
       dict(sn) if sn else None)
    ck("every event this turn wrote lives under test.try.<session> only (RLS scope-tree check)",
       all(s["s"].startswith(scope) for s in ev_scopes) and len(ev_scopes) >= 1)

    if out2.get("order"):
        skus = [l.get("sku", "") for l in out2["order"]["lines"]]
        ck("the drafted order's SKUs are ALL from the demo catalogue (never a real tenant's)",
           all(s.startswith(f"{config.TRY_CHAT_DEMO_TENANT}#") for s in skus), skus)
        print(f"    order drafted: {len(skus)} line(s), total {out2['order'].get('total')} "
              f"{out2['order'].get('currency')}")
    else:
        # The mind sometimes asks one more clarifying question before drafting (real, observed
        # behaviour) — not a failure of isolation, just fewer turns to assert the order shape on.
        print("    (mind didn't draft an order this turn — asked a clarifying question instead; "
              "isolation still holds, see the checks above)")

    # cleanup — this gate's own rows, so repeat runs don't pile up test.try.* scopes forever.
    async with pool.acquire() as con:
        # FK order (see vital_lifecycle._wipe_scope): open_loop/action/timer reference event.
        await con.execute("delete from action where scope <@ $1::ltree", scope)
        await con.execute("delete from timer where scope <@ $1::ltree", scope)
        await con.execute("delete from open_loop where scope <@ $1::ltree", scope)
        await con.execute("delete from event where scope <@ $1::ltree", scope)
        await con.execute("delete from card where scope=$1::ltree", scope)
        await con.execute("delete from scope_node where scope=$1::ltree", scope)


async def gate_rate_limits():
    print("\n-- 2. rate limits --")
    ip = "198.51.100.7"
    session = _fresh_session()
    # drain the per-session window first (smaller than the per-IP one by default) without touching
    # the mind: junk text short-circuits before runtime.run_turn, so this costs nothing.
    ok_count = 0
    last = None
    for _ in range(config.TRY_CHAT_SESSION_LIMIT + 5):
        last = await try_chat.chat(session_id=session, text="hola", ip=ip, lang="es")
        if last.get("ok") and last.get("error") != "rate_limited":
            ok_count += 1
        if not last.get("ok"):
            break
    ck("session rate limit trips once TRY_CHAT_SESSION_LIMIT is exceeded",
       (not last.get("ok")) and last.get("error") == "rate_limited",
       f"accepted {ok_count} before rejection, limit={config.TRY_CHAT_SESSION_LIMIT}")

    # a fresh session on the SAME ip should also eventually trip the per-IP window (shared bucket).
    ip2 = "198.51.100.8"
    rejected = False
    for i in range(config.TRY_CHAT_IP_LIMIT + 5):
        r = await try_chat.chat(session_id=_fresh_session(), text="hola", ip=ip2, lang="es")
        if not r.get("ok") and r.get("error") == "rate_limited":
            rejected = True
            break
    ck("per-IP rate limit trips across DIFFERENT sessions sharing one IP", rejected)


async def gate_turn_cap(monkeypatch_runtime):
    print("\n-- 3. turn cap --")
    session = _fresh_session()
    sess = try_chat._session(session)
    sess["turns"] = config.TRY_CHAT_MAX_TURNS  # simulate having used every real turn already

    called = {"n": 0}

    async def _spy_run_turn(*a, **kw):
        called["n"] += 1
        raise AssertionError("runtime.run_turn must NEVER be called once a session is capped")

    import runtime
    orig = runtime.run_turn
    runtime.run_turn = _spy_run_turn
    try:
        out = await try_chat.chat(session_id=session, text="6 kg de chorizo por favor", ip="203.0.113.9", lang="es")
    finally:
        runtime.run_turn = orig

    ck("capped session returns closed=True with the friendly close copy, never touching the mind",
       out["closed"] is True and called["n"] == 0 and out["reply"] == try_chat._CLOSE["es"], out)


async def gate_egress_sandbox(pool):
    print("\n-- 4. egress sandbox --")

    # 4a. deterministic — runtime.run_turn is ALWAYS invoked with egress_stub=True on this path.
    seen_kwargs = {}

    async def _spy_run_turn(*a, **kw):
        seen_kwargs.update(kw)
        return {"text": "ok (spy)", "actions": [], "scope": kw.get("scope_override"), "suppressed": False}

    import runtime
    orig = runtime.run_turn
    runtime.run_turn = _spy_run_turn
    try:
        await try_chat.chat(session_id=_fresh_session(),
                            text="6 kg de chorizo ibérico y avisa a Peter de que llegué",
                            ip="203.0.113.10", lang="es")
    finally:
        runtime.run_turn = orig
    ck("try_chat.chat() always calls runtime.run_turn(egress_stub=True, ...)",
       seen_kwargs.get("egress_stub") is True, seen_kwargs)
    ck("try_chat.chat() always pins a test.* scope_override (never None, never a wa.*/t.* scope)",
       str(seen_kwargs.get("scope_override", "")).startswith("test.try."), seen_kwargs)

    # 4b. the deeper, global floor (belt-and-suspenders): with config.EGRESS_SANDBOX on, every raw
    # send function short-circuits regardless of scope/egress_stub — same assertion vital_egress_
    # sandbox.py makes, re-run here so this file stands alone as proof for THIS endpoint's write-up.
    was = config.EGRESS_SANDBOX
    config.EGRESS_SANDBOX = True
    try:
        import actions
        import twilio_wa
        wa = await twilio_wa.send_whatsapp("+34999000123", "must never leave the box")
        ck("global EGRESS_SANDBOX floor: send_whatsapp suppressed", wa == "SANDBOX-wa", repr(wa))
        em = await actions.send_email("nobody@example.com", "must not send", "<p>x</p>")
        ck("global EGRESS_SANDBOX floor: send_email suppressed", em is True, repr(em))
    finally:
        config.EGRESS_SANDBOX = was


async def main():
    pool = await gatelib.prepare()
    # a fake scope override is never accepted for real writes — session helper for the turn-cap gate.
    await gate_scope_isolation(pool)
    await gate_rate_limits()
    await gate_turn_cap(None)
    await gate_egress_sandbox(pool)

    passed = sum(R)
    print(f"\nTRY-CHAT (WP-E): {passed}/{len(R)} — "
          f"{'ALL GUARDRAILS HOLD' if passed == len(R) else 'FAILURES ABOVE — DO NOT SHIP'}")
    return 0 if passed == len(R) else 1


def test_try_chat():
    code = asyncio.run(main())
    assert code == 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
